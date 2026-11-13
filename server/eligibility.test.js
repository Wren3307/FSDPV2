// FP-10 eligibility tests, run against a fresh in-memory copy of the demo seed.
// Seed users: 1 = admin, 2 and 3 = instructors, 4 = Alice, 5 = Ben, 6 = Chen, 15 = Lena (1st kyu, rule has a min age).
import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import express from 'express';
import { createApi } from './app.js';
import { openDatabase } from './db.js';
import { ageOn, wholeMonthsBetween } from './eligibility.js';
import { seedDatabase } from './seed.js';

let server, base, db;

const get = (path, userId) => fetch(`${base}${path}`, { headers: userId ? { 'x-user-id': String(userId) } : {} });
const eligibility = async (studentId) => (await get(`/students/${studentId}/eligibility`, 1)).json();
const checkNamed = (result, start) => result.checks.find((c) => c.rule.startsWith(start));

// Chen's rule is 5th kyu -> 4th kyu (from_rank_id 2).
const setChenCountsExternal = (value) =>
  db.connection.prepare('UPDATE grading_rules SET counts_external = ? WHERE from_rank_id = 2').run(value);

before(async () => {
  db = openDatabase(':memory:');
  seedDatabase(db.connection);
  const app = express();
  app.use('/api', createApi({ db, adminToken: 'secret-token' }));
  await new Promise((resolve) => { server = app.listen(0, resolve); });
  base = `http://127.0.0.1:${server.address().port}/api`;
});

after(() => {
  server.closeAllConnections();
  server.close();
  db.close();
});

test('counts whole months and years only once the day comes round again', () => {
  assert.equal(wholeMonthsBetween('2026-01-31', '2026-03-30'), 1);
  assert.equal(wholeMonthsBetween('2026-01-15', '2026-04-15'), 3);
  assert.equal(ageOn('2008-11-14', '2026-11-13'), 17);
  assert.equal(ageOn('2008-11-13', '2026-11-13'), 18);
});

test('(a) Alice is clearly eligible', async () => {
  const alice = await eligibility(4);
  assert.equal(alice.currentRank, '6th kyu');
  assert.equal(alice.nextRank, '5th kyu');
  assert.equal(alice.eligible, true);
  assert.ok(alice.checks.every((c) => c.met));
});

test('(b) Ben is one session short', async () => {
  const ben = await eligibility(5);
  assert.equal(ben.eligible, false);
  assert.deepEqual(checkNamed(ben, 'Sessions'), { rule: 'Sessions since last grading', required: 14, actual: 13, met: false });
  assert.equal(checkNamed(ben, 'Months').met, true);
});

test('(c) Chen is eligible only while external sessions count', async () => {
  setChenCountsExternal(0);
  const without = await eligibility(6);
  assert.equal(without.eligible, false);
  assert.equal(checkNamed(without, 'Sessions').actual, 15);

  setChenCountsExternal(1);
  const withExternal = await eligibility(6);
  assert.equal(withExternal.eligible, true);
  assert.equal(checkNamed(withExternal, 'Sessions').actual, 18);
});

test('adds an age check when the rule has a minimum age', async () => {
  const lena = await eligibility(15);
  assert.equal(lena.nextRank, 'shodan');
  assert.equal(checkNamed(lena, 'Minimum age').required, 18);
});

test('explains why when there is no rule to check', async () => {
  db.connection.prepare('UPDATE grading_rules SET active = 0 WHERE from_rank_id = 1').run();
  const alice = await eligibility(4);
  db.connection.prepare('UPDATE grading_rules SET active = 1 WHERE from_rank_id = 1').run();

  assert.equal(alice.eligible, false);
  assert.deepEqual(alice.checks, []);
  assert.match(alice.reason, /no active grading rule/);
});

test('students see only their own result; staff see anyone\'s', async () => {
  assert.equal((await get('/students/4/eligibility', 4)).status, 200);
  assert.equal((await get('/students/5/eligibility', 4)).status, 403);
  assert.equal((await get('/students/5/eligibility', 3)).status, 200); // instructor at another centre
  assert.equal((await get('/students/5/eligibility')).status, 401);
  assert.equal((await get('/students/2/eligibility', 1)).status, 404); // an instructor, not a student
});

test('batch view lists one centre, and only staff can use it', async () => {
  const centre1 = await (await get('/eligibility?centreId=1', 2)).json();
  assert.equal(centre1.length, 8);
  assert.ok(centre1.every((r) => r.centreName === 'Shinjuku Dojo'));
  assert.equal(centre1.find((r) => r.studentName === 'Alice Tan').eligible, true);

  const everyone = await (await get('/eligibility', 1)).json();
  assert.equal(everyone.length, 12);

  assert.equal((await get('/eligibility', 4)).status, 403);
  assert.equal((await get('/eligibility?centreId=x', 1)).status, 400);
});

test('lists the active grading rules for the screen', async () => {
  const rules = await (await get('/grading-rules', 2)).json();
  assert.equal(rules.length, 6);
  assert.deepEqual(rules[0], {
    id: 1, fromRank: '6th kyu', toRank: '5th kyu', minSessions: 14, minMonths: 3, countsExternal: false, minAge: null,
  });
});
