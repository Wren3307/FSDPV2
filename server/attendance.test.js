// FP-7 attendance API tests. Each run uses a fresh in-memory database loaded with the demo seed.
// Seed users: 1 = admin, 2 = instructor at centre 1, 3 = instructor at centre 2, 4+ = students.
// Class 1 (Monday Beginners) is at centre 1 with students 4-9 enrolled.
import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import express from 'express';
import { createApi } from './app.js';
import { addDays, isoWeekday, today } from './dates.js';
import { openDatabase } from './db.js';
import { seedDatabase } from './seed.js';
import { loginSeedUsers } from './testLogin.js';

let server, base, db, cookies;

// Calls the API as a given seed user, using that user's login session.
function call(method, path, userId, body) {
  const headers = { 'content-type': 'application/json' };
  if (userId) headers.cookie = cookies[userId];
  return fetch(`${base}${path}`, { method, headers, body: body && JSON.stringify(body) });
}

const countRows = (sessionId) =>
  db.connection.prepare('SELECT COUNT(*) AS n FROM attendance WHERE session_id = ?').get(sessionId).n;

before(async () => {
  db = openDatabase(':memory:');
  seedDatabase(db.connection);
  const app = express();
  app.use('/api', createApi({ db, limits: { login: 1000 } }));
  await new Promise((resolve) => { server = app.listen(0, resolve); });
  base = `http://127.0.0.1:${server.address().port}/api`;
  cookies = await loginSeedUsers(base, db);
});

after(() => {
  server.closeAllConnections();
  server.close();
  db.close();
});

test('lists a day\'s classes for the instructor\'s own centre only', async () => {
  const monday = addDays(today(), 1 - isoWeekday(today()));
  const own = await (await call('GET', `/instructor/classes?date=${monday}`, 2)).json();
  assert.deepEqual(own.map((c) => c.name), ['Monday Beginners']);

  const other = await (await call('GET', `/instructor/classes?date=${monday}`, 3)).json();
  assert.deepEqual(other, []);
});

test('opening a session twice gives back the same session', async () => {
  const first = await call('POST', '/classes/1/sessions', 2, {});
  assert.equal(first.status, 201);
  const again = await call('POST', '/classes/1/sessions', 2, {});
  assert.equal(again.status, 200);
  assert.equal((await again.json()).sessionId, (await first.json()).sessionId);
});

test('marks, re-marks without duplicating, and shows walk-ins on the roster', async () => {
  const { sessionId } = await (await call('POST', '/classes/1/sessions', 2, {})).json();

  // Jia Lee (13) isn't enrolled in class 1, so she's a walk-in.
  const save = await call('PUT', `/sessions/${sessionId}/attendance`, 2, [
    { studentId: 4, status: 'present' },
    { studentId: 5, status: 'late' },
    { studentId: 13, status: 'present' },
  ]);
  assert.equal(save.status, 200);
  assert.equal(countRows(sessionId), 3);

  const resave = await call('PUT', `/sessions/${sessionId}/attendance`, 2, [{ studentId: 5, status: 'absent' }]);
  assert.equal(resave.status, 200);
  assert.equal(countRows(sessionId), 3);

  const roster = await (await call('GET', `/sessions/${sessionId}/roster`, 2)).json();
  const byName = Object.fromEntries(roster.map((r) => [r.name, r]));
  assert.equal(roster.length, 7); // 6 enrolled + 1 walk-in
  assert.equal(byName['Ben Lim'].status, 'absent');
  assert.equal(byName['Jia Lee'].status, 'present');
  assert.equal(byName['Ethan Koh'].status, null); // enrolled, not marked yet
  assert.equal(byName['Alice Tan'].rank, '6th kyu');

  const markedBy = db.connection.prepare('SELECT DISTINCT marked_by FROM attendance WHERE session_id = ?').all(sessionId);
  assert.deepEqual(markedBy.map((r) => r.marked_by), [2]);
});

test('rejects bad statuses and non-students without saving anything', async () => {
  const { sessionId } = await (await call('POST', '/classes/1/sessions', 2, {})).json();
  const before = countRows(sessionId);

  const badStatus = await call('PUT', `/sessions/${sessionId}/attendance`, 2, [{ studentId: 4, status: 'here' }]);
  assert.equal(badStatus.status, 400);

  const instructor = await call('PUT', `/sessions/${sessionId}/attendance`, 2, [
    { studentId: 6, status: 'present' },
    { studentId: 3, status: 'present' },
  ]);
  assert.equal(instructor.status, 400);
  assert.equal(countRows(sessionId), before);
});

test('locks attendance more than a day after the session', async () => {
  // Every seeded regular session is at least a week old.
  const old = db.connection.prepare(`SELECT id FROM sessions WHERE class_id = 1 ORDER BY date LIMIT 1`).get();
  const res = await call('PUT', `/sessions/${old.id}/attendance`, 2, [{ studentId: 4, status: 'present' }]);
  assert.equal(res.status, 403);
});

test('blocks other centres, students and missing users', async () => {
  const { sessionId } = await (await call('POST', '/classes/1/sessions', 2, {})).json();

  assert.equal((await call('GET', `/sessions/${sessionId}/roster`, 3)).status, 403); // centre 2 instructor
  assert.equal((await call('POST', '/classes/1/sessions', 3, {})).status, 403);
  assert.equal((await call('GET', `/sessions/${sessionId}/roster`, 4)).status, 403); // a student
  assert.equal((await call('GET', `/sessions/${sessionId}/roster`)).status, 401); // no header
  assert.equal((await call('GET', `/sessions/${sessionId}/roster`, 999)).status, 401); // unknown user
  assert.equal((await call('GET', `/sessions/${sessionId}/roster`, 1)).status, 200); // admin sees all
});

test('answers 404 for a missing class or session', async () => {
  assert.equal((await call('POST', '/classes/999/sessions', 2, {})).status, 404);
  assert.equal((await call('GET', '/sessions/999999/roster', 2)).status, 404);
});

test('walk-in search stays within the centre', async () => {
  const found = await (await call('GET', '/centres/1/students?q=jia', 2)).json();
  assert.deepEqual(found.map((s) => s.name), ['Jia Lee']);
  assert.equal((await call('GET', '/centres/2/students?q=a', 2)).status, 403);
});

test('seed keeps the FP-10 test cases intact', () => {
  // Present or late regular sessions, the way FP-10 will count them.
  const attended = (studentId) => db.connection.prepare(`
    SELECT COUNT(*) AS n FROM attendance a JOIN sessions s ON s.id = a.session_id
     WHERE a.student_id = ? AND a.status IN ('present', 'late') AND s.type = ? AND s.date < date('now', 'localtime')
  `).get(studentId, 'regular').n;
  assert.equal(attended(5), 13); // Ben: one short of 14
  assert.equal(attended(6), 15); // Chen: 15 regular...
  const chenExternal = db.connection.prepare(`
    SELECT COUNT(*) AS n FROM attendance a JOIN sessions s ON s.id = a.session_id
     WHERE a.student_id = 6 AND a.status = 'present' AND s.type = 'external'
  `).get().n;
  assert.equal(chenExternal, 3); // ...plus 3 external
});
