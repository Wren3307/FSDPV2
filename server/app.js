import { readFileSync } from 'node:fs';
import express from 'express';
import rateLimit from 'express-rate-limit';
import { createAttendanceRouter } from './attendance.js';
import { checkPassword, createSessions, hashPassword, requireRole } from './auth.js';
import { createEligibilityRouter } from './eligibilityRoutes.js';
import { createNotificationRouter } from './notificationRoutes.js';
import { createNotifier } from './notifications.js';
import { PLANS, createMemberships } from './membership.js';
import { MissingPriceError } from './payments.js';
import {
  checkNewPassword, hasErrors, validateEnquiry, validateInstructor, validateProfile, validateSignup,
} from './validate.js';

const readJson = (name) => JSON.parse(readFileSync(new URL(`../data/${name}.json`, import.meta.url), 'utf8'));

// Members are 'student' accounts in the database; the site calls them members.
const LOGIN_ROLES = ['student', 'instructor', 'admin'];
const ROLE_WORDS = { student: 'a student', instructor: 'an instructor', admin: 'an admin' };
const ROLE_CHOICE = { student: 'Student', instructor: 'Instructor' };
const STATUSES = ['active', 'inactive'];
const HQ_PHONE = '(+65) 6513 1588';

const limit = (windowMinutes, max, error) => rateLimit({
  windowMs: windowMinutes * 60 * 1000,
  limit: max,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error },
});

/**
 * Builds the JSON API. Kept apart from the HTTP server so tests can run it directly.
 * `payments` is null when Stripe is not configured.
 */
export function createApi({ db, payments = null, secureCookies = false, limits = {} }) {
  const api = express.Router();
  const sessions = createSessions(db, { secureCookies });

  api.use(express.json({ limit: '20kb' }));
  // Browsers can't send a cross-site JSON request without permission, so requiring JSON blocks CSRF.
  api.use((req, res, next) => {
    if (req.method !== 'GET' && req.method !== 'HEAD' && !req.is('application/json')) {
      return res.status(415).json({ error: 'Send this request as JSON.' });
    }
    return next();
  });
  api.use(sessions.load);

  const content = {
    dojos: readJson('dojos'),
    timetable: readJson('hq-timetable'),
    instructors: readJson('instructors'),
    fees: readJson('fees'),
  };
  for (const [name, data] of Object.entries(content)) {
    api.get(`/${name}`, (_req, res) => res.json(data));
  }
  // Every dojo on the public site is also a centre, so accounts, classes and attendance can point at it.
  db.ensureCentres(content.dojos);
  const dojoNames = new Set(content.dojos.map((d) => d.name));
  const signupDojos = new Set(content.dojos.filter((d) => d.status === 'open' && !d.membersOnly).map((d) => d.name));

  // Enquiries ------------------------------------------------------------

  api.post('/enquiries', limit(15, limits.enquiries ?? 5, 'Too many enquiries from this connection. Try again in 15 minutes, or call (+65) 6513 1588.'), (req, res) => {
    // Bots fill the hidden "website" field. Answer as normal so they don't retry, but store nothing.
    if (req.body?.website) return res.status(201).json({ ok: true });
    const { errors, values } = validateEnquiry(req.body);
    if (hasErrors(errors)) return res.status(400).json({ errors });
    return res.status(201).json({ ok: true, id: db.addEnquiry(values) });
  });

  // Accounts (FP-1) --------------------------------------------------------

  const loginLimit = limit(15, limits.login ?? 10, 'Too many login attempts. Wait 15 minutes, then try again.');
  const signupLimit = limit(60, limits.signup ?? 5, 'Too many sign-ups from this connection. Try again in an hour.');

  api.get('/auth/me', (req, res) => res.json({ user: req.user }));

  api.post('/auth/login', loginLimit, async (req, res) => {
    const email = typeof req.body?.email === 'string' ? req.body.email.trim() : '';
    const password = typeof req.body?.password === 'string' ? req.body.password : '';
    const role = req.body?.role;
    if (!LOGIN_ROLES.includes(role)) return res.status(400).json({ error: 'Choose whether you are logging in as a student or an instructor.' });

    const account = email ? db.getAuthByEmail(email) : undefined;
    const valid = await checkPassword(password, account?.password_hash);
    if (!account || !valid) return res.status(401).json({ error: 'That email or password is not correct.' });
    if (account.status === 'inactive') return res.status(403).json({ error: 'This account is switched off. Contact Headquarters on (+65) 6513 1588.' });
    if (account.role !== role) {
      if (role === 'admin') return res.status(403).json({ error: 'This is not an admin account.' });
      if (account.role === 'admin') return res.status(403).json({ error: 'Admin accounts log in on the admin page.' });
      return res.status(403).json({ error: `This account is not ${ROLE_WORDS[role]} account. Choose ${ROLE_CHOICE[account.role]} instead.` });
    }

    sessions.start(res, account.id);
    return res.json({ user: db.getUser(account.id) });
  });

  api.post('/auth/logout', (req, res) => {
    sessions.end(req, res);
    res.json({ ok: true });
  });

  // FP-2: sign-up is free. Membership is optional and bought separately (see membership.js); a member
  // can tick "also become a member" to go straight to payment.
  const memberships = createMemberships(db.connection);

  // Opens Stripe Checkout for the user's next membership. Returns { checkoutUrl } or { error, status }.
  async function startMembershipCheckout(user) {
    const next = memberships.nextPurchase(user.id);
    if (!next.canBuy) {
      return { status: 409, error: `You are already a member until ${memberships.status(user.id).memberUntil}.` };
    }
    if (!payments) return { status: 503, error: `Online payment is not set up yet. Pay at your dojo, or call ${HQ_PHONE}.` };
    try {
      const checkout = await payments.createCheckout(user, next.kind);
      db.setCheckoutSession(user.id, checkout.id);
      return { checkoutUrl: checkout.url };
    } catch (err) {
      console.error(err instanceof MissingPriceError ? err.message : `Stripe checkout failed: ${err.message}`);
      return { status: 502, error: 'The payment page could not open. Try again in a moment.' };
    }
  }

  api.post('/auth/signup', signupLimit, async (req, res) => {
    const { errors, values } = validateSignup(req.body, signupDojos);
    if (hasErrors(errors)) return res.status(400).json({ errors });

    const id = db.createUser({
      role: 'student',
      name: values.name,
      email: values.email,
      passwordHash: await hashPassword(values.password),
      phone: values.phone,
      centreId: db.centreId(values.dojo),
      status: 'active',
    });
    if (!id) return res.status(409).json({ errors: { email: 'An account with this email already exists. Log in instead.' } });

    sessions.start(res, id);
    const user = db.getUser(id);
    if (!values.membership) return res.status(201).json({ user });

    // The account exists either way; if payment can't start, they can become a member from their account.
    const checkout = await startMembershipCheckout(user);
    if (checkout.checkoutUrl) return res.status(201).json({ user, checkoutUrl: checkout.checkoutUrl });
    return res.status(201).json({ user, notice: `Your free account is ready. ${checkout.error} You can become a member from your account at any time.` });
  });

  // Membership -------------------------------------------------------------

  // The member's own membership: whether they are a member, until when, what their next payment
  // would buy, and every membership they have had.
  api.get('/me/membership', requireRole('student'), (req, res) => {
    res.json({
      ...memberships.status(req.user.id),
      history: memberships.history(req.user.id),
      awaitingPayment: Boolean(db.getCheckoutSession(req.user.id)),
      onlinePayment: Boolean(payments),
    });
  });

  api.post('/payments/checkout', requireRole('student'), async (req, res) => {
    const checkout = await startMembershipCheckout(req.user);
    if (checkout.checkoutUrl) return res.json({ checkoutUrl: checkout.checkoutUrl });
    return res.status(checkout.status).json({ error: checkout.error });
  });

  // Records the membership once Stripe confirms the payment. Safe to repeat: a session that has
  // already been recorded just returns the user again.
  api.post('/payments/confirm', requireRole('student'), async (req, res) => {
    if (!payments) return res.status(503).json({ error: `Online payment is not set up yet. Call ${HQ_PHONE}.` });
    const sessionId = typeof req.body?.sessionId === 'string' && req.body.sessionId
      ? req.body.sessionId
      : db.getCheckoutSession(req.user.id);
    if (!sessionId) return res.status(404).json({ error: 'No payment was found for your account yet.' });
    let paid;
    try {
      paid = await payments.paidMembership(sessionId, req.user.id);
    } catch (err) {
      console.error('Stripe lookup failed', err.message);
      return res.status(502).json({ error: 'Your payment could not be checked right now. Try again in a moment.' });
    }
    if (!paid) {
      return res.status(402).json({ error: 'Your payment has not gone through yet. If you have just paid, wait a minute and check again.' });
    }
    memberships.record(req.user.id, {
      kind: paid.kind, amountCents: paid.amountCents ?? PLANS[paid.kind].amountCents, paidVia: 'stripe', reference: sessionId,
    });
    if (db.getCheckoutSession(req.user.id) === sessionId) db.setCheckoutSession(req.user.id, null);
    return res.json({ user: db.getUser(req.user.id) });
  });

  // Profile ----------------------------------------------------------------

  api.patch('/me', requireRole(...LOGIN_ROLES), (req, res) => {
    const isMember = req.user.role === 'student';
    const { errors, values } = validateProfile(req.body, signupDojos, { requireDojo: isMember });
    if (hasErrors(errors)) return res.status(400).json({ errors });
    // Only members choose their own dojo; an instructor's centre is set by the admin.
    const centreId = isMember ? db.centreId(values.dojo) : req.user.centre_id;
    db.updateProfile(req.user.id, { name: values.name, phone: values.phone, centreId });
    return res.json({ user: db.getUser(req.user.id) });
  });

  api.post('/me/password', requireRole(...LOGIN_ROLES), async (req, res) => {
    const errors = {};
    checkNewPassword(req.body?.newPassword, errors, 'newPassword');
    const ok = await checkPassword(String(req.body?.currentPassword ?? ''), db.getPasswordHash(req.user.id));
    if (!ok) errors.currentPassword = 'Your current password is not correct.';
    if (hasErrors(errors)) return res.status(400).json({ errors });
    db.setPassword(req.user.id, await hashPassword(req.body.newPassword));
    db.deleteUserSessions(req.user.id);
    sessions.start(res, req.user.id);
    return res.json({ ok: true });
  });

  // Instructors ------------------------------------------------------------

  api.get('/instructor/members', requireRole('instructor'), (req, res) => {
    res.json({ dojo: req.user.dojo, members: db.studentsForInstructor(req.user) });
  });

  // FP-7: classes, sessions, rosters and attendance (instructors and admins only).
  api.use(createAttendanceRouter(db.connection));
  // FP-10: grading eligibility, worked out from attendance and the grading rules.
  api.use(createEligibilityRouter(db.connection));
  // FP-11: a user's own notifications, such as "You are now eligible for your 5th kyu grading."
  api.use(createNotificationRouter(db.connection));

  // FP-11: notify anyone who is already eligible but hasn't been told yet, e.g. in freshly loaded
  // demo data, or after months passed while the server was off. Attendance saves keep it up to date.
  const notifier = createNotifier(db.connection);
  notifier.checkEveryone();

  // Admin ------------------------------------------------------------------

  const admin = express.Router();
  admin.use(requireRole('admin'));

  admin.get('/enquiries', (_req, res) => res.json({ enquiries: db.listEnquiries() }));
  admin.get('/users', (_req, res) => res.json({ users: db.listUsers(), ranks: db.listRanks(), plans: PLANS }));

  admin.post('/instructors', async (req, res) => {
    const { errors, values } = validateInstructor(req.body, dojoNames);
    if (hasErrors(errors)) return res.status(400).json({ errors });
    const id = db.createUser({
      role: 'instructor',
      name: values.name,
      email: values.email,
      passwordHash: await hashPassword(values.password),
      phone: values.phone,
      centreId: db.centreId(values.dojo),
      status: 'active',
    });
    if (!id) return res.status(409).json({ errors: { email: 'An account with this email already exists.' } });
    return res.status(201).json({ user: db.getUser(id) });
  });

  admin.patch('/users/:id', (req, res) => {
    const id = Number(req.params.id);
    const target = Number.isInteger(id) ? db.getUser(id) : null;
    if (!target) return res.status(404).json({ error: 'That account no longer exists.' });
    if (target.role === 'admin') return res.status(403).json({ error: 'Admin accounts cannot be changed here.' });

    const { rank, status, dojo } = req.body ?? {};
    if (rank !== undefined && (target.role !== 'student' || !db.listRanks().includes(rank))) {
      return res.status(400).json({ error: 'Choose a rank from the list. Only members have ranks.' });
    }
    if (status !== undefined && !STATUSES.includes(status)) return res.status(400).json({ error: 'Choose a status from the list.' });
    if (dojo !== undefined && !dojoNames.has(dojo)) return res.status(400).json({ error: 'Choose a dojo from the list.' });

    if (rank !== undefined) {
      db.setRank(id, rank);
      // FP-11: a new rank starts the count towards the next grading again, so an old
      // "eligible" notification no longer applies.
      notifier.checkStudents([id]);
    }
    if (status !== undefined) db.setStatus(id, status);
    if (dojo !== undefined) db.setCentre(id, db.centreId(dojo));
    return res.json({ user: db.getUser(id) });
  });

  // An admin records a membership paid in person at a dojo. The price and period are the same as
  // online: $60 for a first membership, $48 for a renewal, to 31 December.
  admin.post('/users/:id/membership', (req, res) => {
    const id = Number(req.params.id);
    const target = Number.isInteger(id) ? db.getUser(id) : null;
    if (!target || target.role !== 'student') return res.status(400).json({ error: 'Only member accounts can have a membership.' });
    const next = memberships.nextPurchase(id);
    if (!next.canBuy) return res.status(409).json({ error: `${target.name} is already a member until ${target.member_until}.` });
    memberships.record(id, { kind: next.kind, paidVia: 'dojo', recordedBy: req.user.id });
    return res.json({ user: db.getUser(id) });
  });

  api.use('/admin', admin);

  api.use((_req, res) => res.status(404).json({ error: 'Not found.' }));

  // Malformed JSON and other request errors: reply in JSON without leaking internals.
  api.use((err, _req, res, _next) => {
    const status = err.status ?? 500;
    if (status >= 500) console.error(err);
    res.status(status).json({ error: status >= 500 ? 'Something went wrong on the server.' : 'That request could not be read.' });
  });

  return api;
}

/** Creates the admin account named in the environment settings, unless that email already has an account. */
export async function ensureAdmin(db, { email, password, name = 'Site admin' }) {
  if (!email || !password || db.hasUserWithEmail(email)) return false;
  db.createUser({ role: 'admin', name, email: email.toLowerCase(), passwordHash: await hashPassword(password), status: 'active' });
  return true;
}
