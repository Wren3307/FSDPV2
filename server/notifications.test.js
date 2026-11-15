// FP-11 notification tests, run against a fresh in-memory copy of the demo seed.
// Seed users: 1 = admin, 2 = Kenji (instructor at centre 1), 4 = Alice and 6 = Chen (already eligible),
// 5 = Ben (13 of 14 sessions, so one more makes him eligible), 7 = Divya (far from eligible).
import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import express from 'express';
import { createApi } from './app.js';
import { openDatabase } from './db.js';
import { seedDatabase } from './seed.js';
import { loginSeedUsers } from './testLogin.js';

let server, base, db, cookies, sessionId;

// Calls the API as a given seed user, using that user's login session.
function call(method, path, userId, body) {
  const headers = { 'content-type': 'application/json' };
  if (userId) headers.cookie = cookies[userId];
  return fetch(`${base}${path}`, { method, headers, body: body && JSON.stringify(body) });
}

const notificationsFor = async (userId) => (await call('GET', '/me/notifications', userId)).json();

// Kenji marks one student in today's session and gets back who that save made eligible.
async function mark(studentId, status) {
  const res = await call('PUT', `/sessions/${sessionId}/attendance`, 2, [{ studentId, status }]);
  assert.equal(res.status, 200);
  return (await res.json()).newlyEligible;
}

before(async () => {
  db = openDatabase(':memory:');
  seedDatabase(db.connection);
  const app = express();
  app.use('/api', createApi({ db, limits: { login: 1000 } }));
  await new Promise((resolve) => { server = app.listen(0, resolve); });
  base = `http://127.0.0.1:${server.address().port}/api`;
  cookies = await loginSeedUsers(base, db);
  // Today's session of class 1 (Monday Beginners), which Alice, Ben and Divya are enrolled in.
  sessionId = (await (await call('POST', '/classes/1/sessions', 2, {})).json()).sessionId;
});

after(() => {
  server.closeAllConnections();
  server.close();
  db.close();
});

test('students who are already eligible are notified when the server starts', async () => {
  const alice = await notificationsFor(4);
  assert.equal(alice.length, 1);
  assert.equal(alice[0].type, 'grading_eligible');
  assert.equal(alice[0].message, 'You are now eligible for your 5th kyu grading.');
  assert.equal(alice[0].readAt, null);

  assert.equal((await notificationsFor(6))[0].message, 'You are now eligible for your 4th kyu grading.');
  assert.deepEqual(await notificationsFor(5), []); // Ben is one session short
  assert.deepEqual(await notificationsFor(2), []); // instructors have no gradings to be notified about
});

test('the save that makes a student eligible notifies them, once', async () => {
  assert.deepEqual(await mark(5, 'present'), [{ studentId: 5, name: 'Ben Lim', nextRank: '5th kyu' }]);
  assert.equal((await notificationsFor(5)).length, 1);

  // Saving again changes nothing, so nobody is newly eligible and Ben still has one notification.
  assert.deepEqual(await mark(5, 'late'), []);
  assert.equal((await notificationsFor(5)).length, 1);
});

test('correcting the mark withdraws the notification, and marking again restores it', async () => {
  assert.deepEqual(await mark(5, 'absent'), []);
  assert.deepEqual(await notificationsFor(5), []);

  assert.equal((await mark(5, 'present')).length, 1);
  assert.equal((await notificationsFor(5)).length, 1);
});

test('a save that does not change anyone\'s eligibility notifies nobody', async () => {
  assert.deepEqual(await mark(7, 'present'), []); // Divya: 9 of 14, still short
  assert.deepEqual(await notificationsFor(7), []);

  assert.deepEqual(await mark(4, 'present'), []); // Alice was eligible already
  assert.equal((await notificationsFor(4)).length, 1);
});

test('dismissing marks a user\'s own notifications as read, and nobody else\'s', async () => {
  assert.equal((await call('POST', '/me/notifications/read', 4, {})).status, 200);
  assert.notEqual((await notificationsFor(4))[0].readAt, null);
  assert.equal((await notificationsFor(6))[0].readAt, null); // Chen's is untouched
});

test('a promotion withdraws the notification for the old rank', async () => {
  // Chen moves up to 4th kyu, so he starts again towards 3rd kyu and is no longer eligible.
  const promote = await call('PATCH', '/admin/users/6', 1, { rank: '4th kyu' });
  assert.equal(promote.status, 200);
  assert.deepEqual(await notificationsFor(6), []);
});

test('notifications need a login', async () => {
  assert.equal((await call('GET', '/me/notifications')).status, 401);
  assert.equal((await call('POST', '/me/notifications/read', undefined, {})).status, 401);
});
