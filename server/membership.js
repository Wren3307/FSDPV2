// Paid membership. Sign-up is free; membership is bought separately and recorded in the
// memberships table, which is what member offers and member prices check.
//
// Rules (from data/fees.json):
//   - The first membership ('joining') is $60. It includes the one-time registration.
//   - Each later year ('renewal') is $48.
//   - A membership runs to 31 December of the year it is for. Paying while still a member adds
//     the next calendar year, starting the day after the current one ends.
//   - A member can renew for next year once they are in their final year, but not further ahead.
import { addDays, today } from './dates.js';

export const PLANS = {
  joining: { amountCents: 6000, name: 'Membership with registration' },
  renewal: { amountCents: 4800, name: 'Annual membership renewal' },
};

const endOfYear = (date) => `${date.slice(0, 4)}-12-31`;

export function createMemberships(connection) {
  const summary = connection.prepare(`
    SELECT MAX(ends_on) AS until, COUNT(*) AS n FROM memberships WHERE user_id = ?
  `);
  const findRole = connection.prepare('SELECT role FROM users WHERE id = ?');
  const history = connection.prepare(`
    SELECT kind, starts_on AS startsOn, ends_on AS endsOn, amount_cents AS amountCents,
           paid_via AS paidVia, created_at AS recordedAt
      FROM memberships WHERE user_id = ? ORDER BY ends_on DESC, id DESC
  `);
  const byReference = connection.prepare('SELECT id FROM memberships WHERE reference = ?');
  const insert = connection.prepare(`
    INSERT INTO memberships (user_id, kind, starts_on, ends_on, amount_cents, paid_via, reference, recorded_by)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);

  // What the user's next payment would buy: its kind and price, and the period it covers.
  // canBuy is false when they are already a member beyond this calendar year.
  function nextPurchase(userId, on = today()) {
    const { until, n } = summary.get(userId);
    const kind = n > 0 ? 'renewal' : 'joining';
    const stillMember = until !== null && until >= on;
    const startsOn = stillMember ? addDays(until, 1) : on;
    return {
      kind,
      ...PLANS[kind],
      startsOn,
      endsOn: endOfYear(startsOn),
      canBuy: !stillMember || until.slice(0, 4) <= on.slice(0, 4),
    };
  }

  // Whether the user is a member today, and until when. Only students can be members.
  function status(userId, on = today()) {
    const isStudent = findRole.get(userId)?.role === 'student';
    const { until } = summary.get(userId);
    const isMember = isStudent && until !== null && until >= on;
    return {
      isMember,
      memberUntil: isMember ? until : null,
      lastMembershipEnded: !isMember && until ? until : null,
      next: isStudent ? nextPurchase(userId, on) : null,
    };
  }

  /**
   * Records a paid membership. Returns false when this Stripe reference was already recorded
   * (e.g. the member pressed "check again"), so a payment never counts twice.
   * `kind` is what was paid for; the period is worked out now, from the user's existing memberships.
   */
  function record(userId, { kind, amountCents = PLANS[kind].amountCents, paidVia, reference = null, recordedBy = null }, on = today()) {
    if (reference && byReference.get(reference)) return false;
    const { startsOn, endsOn } = nextPurchase(userId, on);
    insert.run(userId, kind, startsOn, endsOn, amountCents, paidVia, reference, recordedBy);
    return true;
  }

  return { status, nextPurchase, record, history: (userId) => history.all(userId) };
}
