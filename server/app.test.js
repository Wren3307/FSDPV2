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
  kinds: new Map(),
  async createCheckout(user, kind) {
    this.count += 1;
    const id = `cs_test_${user.id}_${this.count}`;
    this.kinds.set(id, kind);
    return { id, url: `https://checkout.stripe.test/${user.id}` };
  },
  async paidMembership(sessionId, userId) {
    const ok = paidSessions.has(sessionId) && sessionId.startsWith(`cs_test_${userId}_`);
    return ok ? { kind: this.kinds.get(sessionId), amountCents: null } : null;
  },
};
const thisYear = new Date().getFullYear();

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
  db.connection.exec(`INSERT INTO ranks (name, sort_order) VALUES ('6th kyu', 1), ('5th kyu', 2)`);
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

test('sign-up is free: the account is active straight away, with no membership', async () => {
  const free = client();
  const res = await signup(free, { email: 'free@example.com' });
  assert.equal(res.status, 201);
  assert.equal(res.body.checkoutUrl, undefined);
  assert.equal(res.body.user.status, 'active');
  assert.equal(res.body.user.is_member, false);
  assert.equal(res.body.user.member_until, null);

  const membership = (await free('GET', '/me/membership')).body;
  assert.equal(membership.isMember, false);
  assert.equal(membership.next.kind, 'joining');
  assert.equal(membership.next.amountCents, 6000);
  assert.equal(membership.next.endsOn, `${thisYear}-12-31`);
});

test('ticking membership at sign-up opens payment, and the paid membership is recorded once', async () => {
  const mei = client();
  const res = await signup(mei, { membership: true });
  assert.equal(res.status, 201);
  assert.match(res.body.checkoutUrl, /^https:\/\/checkout\.stripe\.test\//);
  assert.equal(res.body.user.status, 'active');
  assert.equal(res.body.user.is_member, false); // not until Stripe confirms the payment

  const unpaid = await mei('POST', '/payments/confirm', {});
  assert.equal(unpaid.status, 402);

  const sessionId = `cs_test_${res.body.user.id}_${fakePayments.count}`;
  paidSessions.add(sessionId);
  const paid = await mei('POST', '/payments/confirm', {});
  assert.equal(paid.status, 200);
  assert.equal(paid.body.user.is_member, true);
  assert.equal(paid.body.user.member_until, `${thisYear}-12-31`);

  // Confirming the same payment again doesn't add another year.
  assert.equal((await mei('POST', '/payments/confirm', { sessionId })).status, 200);
  const membership = (await mei('GET', '/me/membership')).body;
  assert.equal(membership.history.length, 1);
  const [first] = membership.history;
  assert.deepEqual([first.kind, first.amountCents, first.paidVia], ['joining', 6000, 'stripe']);
  // The next payment is a $48 renewal for next year.
  assert.equal(membership.next.kind, 'renewal');
  assert.equal(membership.next.amountCents, 4800);
  assert.equal(membership.next.endsOn, `${thisYear + 1}-12-31`);
});

test("a payment for another member's account does not make you a member", async () => {
  const other = client();
  await signup(other, { email: 'other@example.com', membership: true });
  const res = await other('POST', '/payments/confirm', { sessionId: [...paidSessions][0] });
  assert.equal(res.status, 402);
  assert.equal((await other('GET', '/auth/me')).body.user.is_member, false);
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

  const badPassword = await as('POST', '/auth/login', { email: 'mei@example.com', password: 'nope-nope-nope', role: 'student' });
  assert.equal(badPassword.status, 401);

  const ok = await as('POST', '/auth/login', { email: 'MEI@example.com', password: 'correct-horse-1', role: 'student' });
  assert.equal(ok.status, 200);
  assert.equal(ok.body.user.role, 'student');

  await as('POST', '/auth/logout', {});
  assert.equal((await as('GET', '/auth/me')).body.user, null);
});

test('only the admin can create instructors, who then see members at their dojo', async () => {
  const mei = client();
  await mei('POST', '/auth/login', { email: 'mei@example.com', password: 'correct-horse-1', role: 'student' });
  assert.equal((await mei('POST', '/admin/instructors', {})).status, 403);
  assert.equal((await mei('GET', '/instructor/members')).status, 403);

  const admin = client();
  const login = await admin('POST', '/auth/login', { email: 'admin@example.com', password: 'admin-password-1', role: 'admin' });
  assert.equal(login.status, 200);
  const created = await admin('POST', '/admin/instructors', {
    name: 'Robin Tan', email: 'robin@example.com', password: 'instructor-pass-1', dojo: DOJO,
  });
  assert.equal(created.status, 201);

  const robin = client();
  await robin('POST', '/auth/login', { email: 'robin@example.com', password: 'instructor-pass-1', role: 'instructor' });
  const { body } = await robin('GET', '/instructor/members');
  assert.equal(body.dojo, DOJO);
  // Sign-up is free, so every active account at the dojo is listed, member or not.
  assert.deepEqual(body.members.map((m) => m.email).sort(), ['free@example.com', 'mei@example.com', 'other@example.com']);
  assert.equal(body.members.find((m) => m.email === 'mei@example.com').is_member, true);
  assert.equal(body.members.find((m) => m.email === 'free@example.com').is_member, false);
});

test('admin can change a rank, and switching an account off logs it out', async () => {
  const admin = client();
  await admin('POST', '/auth/login', { email: 'admin@example.com', password: 'admin-password-1', role: 'admin' });
  const { body } = await admin('GET', '/admin/users');
  const mei = body.users.find((u) => u.email === 'mei@example.com');

  assert.equal((await admin('PATCH', `/admin/users/${mei.id}`, { rank: '5th kyu' })).body.user.rank, '5th kyu');
  assert.equal((await admin('PATCH', `/admin/users/${mei.id}`, { rank: 'Black belt' })).status, 400);

  const meiBrowser = client();
  await meiBrowser('POST', '/auth/login', { email: 'mei@example.com', password: 'correct-horse-1', role: 'student' });
  await admin('PATCH', `/admin/users/${mei.id}`, { status: 'inactive' });
  assert.equal((await meiBrowser('GET', '/auth/me')).body.user, null);
  const blocked = await meiBrowser('POST', '/auth/login', { email: 'mei@example.com', password: 'correct-horse-1', role: 'student' });
  assert.equal(blocked.status, 403);
});

test('only the admin can record a membership paid at the dojo: $60, then a $48 renewal, then no further', async () => {
  const admin = client();
  await admin('POST', '/auth/login', { email: 'admin@example.com', password: 'admin-password-1', role: 'admin' });
  const { body } = await admin('GET', '/admin/users');
  const other = body.users.find((u) => u.email === 'other@example.com');
  const robin = body.users.find((u) => u.email === 'robin@example.com');

  const first = await admin('POST', `/admin/users/${other.id}/membership`, {});
  assert.equal(first.status, 200);
  assert.equal(first.body.user.member_until, `${thisYear}-12-31`);

  const renewal = await admin('POST', `/admin/users/${other.id}/membership`, {});
  assert.equal(renewal.body.user.member_until, `${thisYear + 1}-12-31`);
  const rows = db.connection.prepare('SELECT kind, amount_cents AS a, paid_via AS via FROM memberships WHERE user_id = ? ORDER BY id').all(other.id);
  assert.deepEqual(rows.map((m) => [m.kind, m.a, m.via]), [['joining', 6000, 'dojo'], ['renewal', 4800, 'dojo']]);

  assert.equal((await admin('POST', `/admin/users/${other.id}/membership`, {})).status, 409); // already paid for next year
  assert.equal((await admin('POST', `/admin/users/${robin.id}/membership`, {})).status, 400); // instructors are not members

  const free = client();
  await free('POST', '/auth/login', { email: 'free@example.com', password: 'correct-horse-1', role: 'student' });
  assert.equal((await free('POST', `/admin/users/${other.id}/membership`, {})).status, 403);
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
