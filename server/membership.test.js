// FP-2 membership rules: what a payment buys and for how long. Dates are fixed so the tests don't
// depend on today's date.
import assert from 'node:assert/strict';
import { rmSync } from 'node:fs';
import { test } from 'node:test';
import { openDatabase } from './db.js';
import { createMemberships } from './membership.js';

function setUp() {
  const db = openDatabase(':memory:');
  const add = (role) => db.createUser({ role, name: 'X', email: `${Math.random()}@example.com`, passwordHash: 'x', status: 'active' });
  return { db, memberships: createMemberships(db.connection), student: add('student'), instructor: add('instructor') };
}

test('a first membership is $60 and runs to 31 December', () => {
  const { memberships, student } = setUp();
  const next = memberships.nextPurchase(student, '2026-03-15');
  assert.deepEqual(
    { kind: next.kind, amountCents: next.amountCents, startsOn: next.startsOn, endsOn: next.endsOn, canBuy: next.canBuy },
    { kind: 'joining', amountCents: 6000, startsOn: '2026-03-15', endsOn: '2026-12-31', canBuy: true },
  );
  memberships.record(student, { kind: 'joining', paidVia: 'dojo' }, '2026-03-15');
  assert.deepEqual(memberships.status(student, '2026-06-01').isMember, true);
  assert.equal(memberships.status(student, '2026-12-31').memberUntil, '2026-12-31');
  assert.equal(memberships.status(student, '2027-01-01').isMember, false);
  assert.equal(memberships.status(student, '2027-01-01').lastMembershipEnded, '2026-12-31');
});

test('renewing while still a member adds the next calendar year; renewing after it lapsed starts today', () => {
  const { memberships, student } = setUp();
  memberships.record(student, { kind: 'joining', paidVia: 'dojo' }, '2026-03-15');

  const early = memberships.nextPurchase(student, '2026-11-20');
  assert.deepEqual([early.kind, early.amountCents, early.startsOn, early.endsOn], ['renewal', 4800, '2027-01-01', '2027-12-31']);
  memberships.record(student, { kind: 'renewal', paidVia: 'dojo' }, '2026-11-20');
  assert.equal(memberships.status(student, '2026-11-20').memberUntil, '2027-12-31');
  // Already paid for next year, so nothing more can be bought yet.
  assert.equal(memberships.nextPurchase(student, '2026-11-20').canBuy, false);

  const lapsed = memberships.nextPurchase(student, '2028-04-02');
  assert.deepEqual([lapsed.kind, lapsed.startsOn, lapsed.endsOn, lapsed.canBuy], ['renewal', '2028-04-02', '2028-12-31', true]);
});

test('a Stripe payment is recorded only once', () => {
  const { memberships, student } = setUp();
  assert.equal(memberships.record(student, { kind: 'joining', paidVia: 'stripe', reference: 'cs_1' }, '2026-01-10'), true);
  assert.equal(memberships.record(student, { kind: 'joining', paidVia: 'stripe', reference: 'cs_1' }, '2026-01-10'), false);
  assert.equal(memberships.history(student).length, 1);
});

test('only students can be members', () => {
  const { memberships, instructor } = setUp();
  assert.deepEqual(memberships.status(instructor), { isMember: false, memberUntil: null, lastMembershipEnded: null, next: null });
});

test('accounts from before free sign-up are converted when the database opens', () => {
  const { db } = setUp();
  const c = db.connection;
  c.exec(`INSERT INTO users (name, email, password_hash, role, membership_status, paid_at, checkout_session)
          VALUES ('Paid', 'paid@example.com', 'x', 'student', 'active', '2025-05-02 10:00:00', 'cs_old'),
                 ('Waiting', 'wait@example.com', 'x', 'student', 'pending_payment', NULL, NULL)`);
  c.exec('DELETE FROM memberships');
  // Reopening runs the conversion. An in-memory database can't be reopened, so run it on a file.
  const path = `${process.env.TEMP ?? '/tmp'}/ask-migrate-${process.pid}.db`;
  c.exec(`VACUUM INTO '${path.replace(/'/g, "''")}'`);
  const reopened = openDatabase(path);
  const rows = reopened.connection.prepare(`
    SELECT u.email, u.membership_status AS status, m.ends_on, m.reference
      FROM users u LEFT JOIN memberships m ON m.user_id = u.id WHERE u.email IN ('paid@example.com', 'wait@example.com') ORDER BY u.email`).all();
  reopened.close();
  rmSync(path, { force: true });
  assert.deepEqual(rows.map((r) => ({ ...r })), [
    { email: 'paid@example.com', status: 'active', ends_on: '2025-12-31', reference: 'cs_old' },
    { email: 'wait@example.com', status: 'active', ends_on: null, reference: null },
  ]);
});
