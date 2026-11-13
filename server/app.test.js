import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import express from 'express';
import { createApi, ensureAdmin } from './app.js';
import { openDatabase } from './db.js';

const DOJO = 'Cheng San Dojo';
const paidSessions = new Set();

// Stands in for Stripe: a session counts as paid once the test adds it to paidSessions.
const fakePayments = {
  isTestMode: true,
  count: 0,
  async createCheckout(user) {
    this.count += 1;
    return { id: `cs_test_${user.id}_${this.count}`, url: `https://checkout.stripe.test/${user.id}` };
  },
  async isPaid(sessionId, userId) {
    return paidSessions.has(sessionId) && sessionId.startsWith(`cs_test_${userId}_`);
  },
};

let server, base, db;

/** A tiny cookie-keeping client, one per simulated browser. */
function client() {
  let cookie = '';
  return async (method, path, body) => {
    const res = await fetch(`${base}${path}`, {
      method,
      headers: { 'content-type': 'application/json', ...(cookie && { cookie }) },
      body: body === undefined ? undefined : typeof body === 'string' ? body : JSON.stringify(body),
    });
    const set = res.headers.get('set-cookie');
    if (set) cookie = set.split(';')[0].endsWith('=') ? '' : set.split(';')[0];
    return { status: res.status, body: await res.json().catch(() => ({})) };
  };
}

const signup = (as, overrides = {}) => as('POST', '/auth/signup', {
  name: 'Mei Tan', email: 'mei@example.com', password: 'correct-horse-1', phone: '9123 4567', dojo: DOJO, terms: true, ...overrides,
});

before(async () => {
  db = openDatabase(':memory:');
  await ensureAdmin(db, { email: 'admin@example.com', password: 'admin-password-1' });
  const app = express();
  app.use('/api', createApi({ db, payments: fakePayments, limits: { enquiries: 1000, login: 1000, signup: 1000 } }));
  await new Promise((resolve) => { server = app.listen(0, resolve); });
  base = `http://127.0.0.1:${server.address().port}/api`;
});

after(() => {
  server.closeAllConnections();
  server.close();
  db.close();
});

test('serves the dojo list', async () => {
  const { body } = await client()('GET', '/dojos');
  assert.equal(body.length, 45);
});

test('stores a valid enquiry and rejects a bad one field by field', async () => {
  const as = client();
  const ok = await as('POST', '/enquiries', { name: 'Test', email: 'test@example.com', interest: 'adult', consent: true });
  assert.equal(ok.status, 201);
  const bad = await as('POST', '/enquiries', { name: '', email: 'nope', interest: 'x' });
  assert.deepEqual(Object.keys(bad.body.errors).sort(), ['consent', 'email', 'interest', 'name']);
});

test('refuses form posts that are not JSON', async () => {
  const res = await fetch(`${base}/auth/login`, { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: 'a=1' });
  assert.equal(res.status, 415);
});

test('member signs up, pays, and only then becomes active', async () => {
  const mei = client();
  const res = await signup(mei);
  assert.equal(res.status, 201);
  assert.match(res.body.checkoutUrl, /^https:\/\/checkout\.stripe\.test\//);

  let me = await mei('GET', '/auth/me');
  assert.equal(me.body.user.status, 'pending_payment');

  const unpaid = await mei('POST', '/payments/confirm', {});
  assert.equal(unpaid.status, 402);

  paidSessions.add(`cs_test_${me.body.user.id}_${fakePayments.count}`);
  const paid = await mei('POST', '/payments/confirm', {});
  assert.equal(paid.status, 200);
  assert.equal(paid.body.user.status, 'active');

  const again = await mei('POST', '/payments/confirm', {});
  assert.equal(again.status, 409);
});

test("a payment for another member's account does not activate yours", async () => {
  const other = client();
  await signup(other, { email: 'other@example.com' });
  const { body } = await other('GET', '/auth/me');
  const res = await other('POST', '/payments/confirm', { sessionId: 'cs_test_1_1' });
  assert.equal(res.status, 402);
  assert.equal((await other('GET', '/auth/me')).body.user.status, 'pending_payment');
  assert.ok(body.user.id);
});

test('duplicate emails and weak passwords are refused at sign-up', async () => {
  assert.equal((await signup(client())).status, 409);
  const weak = await signup(client(), { email: 'new@example.com', password: 'short' });
  assert.ok(weak.body.errors.password);
});

test('login checks the chosen role', async () => {
  const as = client();
  const wrong = await as('POST', '/auth/login', { email: 'mei@example.com', password: 'correct-horse-1', role: 'instructor' });
  assert.equal(wrong.status, 403);
  assert.match(wrong.body.error, /not an instructor account/);

  const badPassword = await as('POST', '/auth/login', { email: 'mei@example.com', password: 'nope-nope-nope', role: 'member' });
  assert.equal(badPassword.status, 401);

  const ok = await as('POST', '/auth/login', { email: 'MEI@example.com', password: 'correct-horse-1', role: 'member' });
  assert.equal(ok.status, 200);
  assert.equal(ok.body.user.role, 'member');

  await as('POST', '/auth/logout', {});
  assert.equal((await as('GET', '/auth/me')).body.user, null);
});

test('only the admin can create instructors, who then see members at their dojos', async () => {
  const mei = client();
  await mei('POST', '/auth/login', { email: 'mei@example.com', password: 'correct-horse-1', role: 'member' });
  assert.equal((await mei('POST', '/admin/instructors', {})).status, 403);
  assert.equal((await mei('GET', '/instructor/members')).status, 403);

  const admin = client();
  const login = await admin('POST', '/auth/login', { email: 'admin@example.com', password: 'admin-password-1', role: 'admin' });
  assert.equal(login.status, 200);
  const created = await admin('POST', '/admin/instructors', {
    name: 'Robin Tan', email: 'robin@example.com', password: 'instructor-pass-1', dojos: [DOJO],
  });
  assert.equal(created.status, 201);

  const robin = client();
  await robin('POST', '/auth/login', { email: 'robin@example.com', password: 'instructor-pass-1', role: 'instructor' });
  const { body } = await robin('GET', '/instructor/members');
  assert.deepEqual(body.dojos, [DOJO]);
  // Mei has paid; the other sign-up has not, so only Mei is listed.
  assert.deepEqual(body.members.map((m) => m.email), ['mei@example.com']);
});

test('admin can change a rank, and switching an account off logs it out', async () => {
  const admin = client();
  await admin('POST', '/auth/login', { email: 'admin@example.com', password: 'admin-password-1', role: 'admin' });
  const { body } = await admin('GET', '/admin/users');
  const mei = body.users.find((u) => u.email === 'mei@example.com');

  assert.equal((await admin('PATCH', `/admin/users/${mei.id}`, { rank: '5th Kyu' })).body.user.rank, '5th Kyu');
  assert.equal((await admin('PATCH', `/admin/users/${mei.id}`, { rank: 'Black belt' })).status, 400);

  const meiBrowser = client();
  await meiBrowser('POST', '/auth/login', { email: 'mei@example.com', password: 'correct-horse-1', role: 'member' });
  await admin('PATCH', `/admin/users/${mei.id}`, { status: 'disabled' });
  assert.equal((await meiBrowser('GET', '/auth/me')).body.user, null);
  const blocked = await meiBrowser('POST', '/auth/login', { email: 'mei@example.com', password: 'correct-horse-1', role: 'member' });
  assert.equal(blocked.status, 403);
});

test('members can edit their own profile and password', async () => {
  const as = client();
  await signup(as, { email: 'jun@example.com' });
  const edit = await as('PATCH', '/me', { name: 'Jun Lim', phone: '9000 1111', dojo: 'Thomson Dojo' });
  assert.equal(edit.body.user.name, 'Jun Lim');
  assert.equal(edit.body.user.dojo, 'Thomson Dojo');

  const wrong = await as('POST', '/me/password', { currentPassword: 'nope', newPassword: 'another-pass-1' });
  assert.ok(wrong.body.errors.currentPassword);
  assert.equal((await as('POST', '/me/password', { currentPassword: 'correct-horse-1', newPassword: 'another-pass-1' })).status, 200);
  assert.equal((await as('GET', '/auth/me')).body.user.email, 'jun@example.com');
});
