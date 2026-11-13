import { readFileSync } from 'node:fs';
import express from 'express';
import rateLimit from 'express-rate-limit';
import { checkPassword, createSessions, hashPassword, requireRole } from './auth.js';
import {
  RANKS, checkNewPassword, hasErrors, validateEnquiry, validateInstructor, validateProfile, validateSignup,
} from './validate.js';

const readJson = (name) => JSON.parse(readFileSync(new URL(`../data/${name}.json`, import.meta.url), 'utf8'));

const ROLE_NAMES = { member: 'member', instructor: 'instructor', admin: 'admin' };
const STATUSES = ['active', 'disabled', 'pending_payment'];

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
export function createApi({ db, payments, secureCookies = false, limits = {} }) {
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

  // Accounts -------------------------------------------------------------

  const loginLimit = limit(15, limits.login ?? 10, 'Too many login attempts. Wait 15 minutes, then try again.');
  const signupLimit = limit(60, limits.signup ?? 5, 'Too many sign-ups from this connection. Try again in an hour.');

  api.get('/auth/me', (req, res) => res.json({ user: req.user }));

  api.post('/auth/login', loginLimit, async (req, res) => {
    const email = typeof req.body?.email === 'string' ? req.body.email.trim() : '';
    const password = typeof req.body?.password === 'string' ? req.body.password : '';
    const role = req.body?.role;
    if (!ROLE_NAMES[role]) return res.status(400).json({ error: 'Choose whether you are logging in as a member or an instructor.' });

    const account = email ? db.getAuthByEmail(email) : undefined;
    const valid = await checkPassword(password, account?.password_hash);
    if (!account || !valid) return res.status(401).json({ error: 'That email or password is not correct.' });
    if (account.status === 'disabled') return res.status(403).json({ error: 'This account is switched off. Contact Headquarters on (+65) 6513 1588.' });
    if (account.role !== role) {
      if (role === 'admin') return res.status(403).json({ error: 'This is not an admin account.' });
      if (account.role === 'admin') return res.status(403).json({ error: 'Admin accounts log in on the admin page.' });
      const wanted = role === 'instructor' ? 'an instructor' : 'a member';
      const actual = account.role === 'instructor' ? 'Instructor' : 'Member';
      return res.status(403).json({ error: `This account is not ${wanted} account. Choose ${actual} instead.` });
    }

    sessions.start(res, account.id);
    return res.json({ user: db.getUser(account.id) });
  });

  api.post('/auth/logout', (req, res) => {
    sessions.end(req, res);
    res.json({ ok: true });
  });

  api.post('/auth/signup', signupLimit, async (req, res) => {
    if (!payments) return res.status(503).json({ error: 'Online sign-up is not available yet because payments are not set up. Call (+65) 6513 1588 to join.' });

    const { errors, values } = validateSignup(req.body, signupDojos);
    if (hasErrors(errors)) return res.status(400).json({ errors });

    const id = db.createUser({
      role: 'member',
      name: values.name,
      email: values.email,
      passwordHash: await hashPassword(values.password),
      phone: values.phone,
      dojo: values.dojo,
      status: 'pending_payment',
    });
    if (!id) return res.status(409).json({ errors: { email: 'An account with this email already exists. Log in instead.' } });

    sessions.start(res, id);
    try {
      const checkout = await payments.createCheckout(db.getUser(id));
      db.setCheckoutSession(id, checkout.id);
      return res.status(201).json({ checkoutUrl: checkout.url });
    } catch (err) {
      console.error('Stripe checkout failed', err.message);
      return res.status(502).json({ error: 'Your account was created, but the payment page could not open. Go to your account to try paying again.', account: true });
    }
  });

  // Payments ---------------------------------------------------------------

  const needsPayment = (req, res, next) => {
    if (req.user.status !== 'pending_payment') return res.status(409).json({ error: 'Your registration fee is already paid.' });
    if (!payments) return res.status(503).json({ error: 'Online payment is not set up yet. Call (+65) 6513 1588 to pay.' });
    return next();
  };

  api.post('/payments/checkout', requireRole('member'), needsPayment, async (req, res) => {
    try {
      const checkout = await payments.createCheckout(req.user);
      db.setCheckoutSession(req.user.id, checkout.id);
      res.json({ checkoutUrl: checkout.url });
    } catch (err) {
      console.error('Stripe checkout failed', err.message);
      res.status(502).json({ error: 'The payment page could not open. Try again in a moment.' });
    }
  });

  api.post('/payments/confirm', requireRole('member'), needsPayment, async (req, res) => {
    const sessionId = typeof req.body?.sessionId === 'string' && req.body.sessionId
      ? req.body.sessionId
      : db.getCheckoutSession(req.user.id);
    if (!sessionId) return res.status(404).json({ error: 'No payment was found for your account yet.' });
    try {
      if (!(await payments.isPaid(sessionId, req.user.id))) {
        return res.status(402).json({ error: 'Your payment has not gone through yet. If you have just paid, wait a minute and check again.' });
      }
    } catch (err) {
      console.error('Stripe lookup failed', err.message);
      return res.status(502).json({ error: 'Your payment could not be checked right now. Try again in a moment.' });
    }
    db.markPaid(req.user.id, sessionId);
    return res.json({ user: db.getUser(req.user.id) });
  });

  // Profile ----------------------------------------------------------------

  api.patch('/me', requireRole('member', 'instructor', 'admin'), (req, res) => {
    const isMember = req.user.role === 'member';
    const { errors, values } = validateProfile(req.body, dojoNames, { requireDojo: isMember });
    if (hasErrors(errors)) return res.status(400).json({ errors });
    db.updateProfile(req.user.id, { ...values, dojo: isMember ? values.dojo : req.user.dojo });
    return res.json({ user: db.getUser(req.user.id) });
  });

  api.post('/me/password', requireRole('member', 'instructor', 'admin'), async (req, res) => {
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
    res.json({ dojos: req.user.dojos, members: db.membersForInstructor(req.user.id) });
  });

  // Admin ------------------------------------------------------------------

  const admin = express.Router();
  admin.use(requireRole('admin'));

  admin.get('/enquiries', (_req, res) => res.json({ enquiries: db.listEnquiries() }));
  admin.get('/users', (_req, res) => res.json({ users: db.listUsers(), ranks: RANKS }));

  admin.post('/instructors', async (req, res) => {
    const { errors, values } = validateInstructor(req.body, dojoNames);
    if (hasErrors(errors)) return res.status(400).json({ errors });
    const id = db.createUser({
      role: 'instructor',
      name: values.name,
      email: values.email,
      passwordHash: await hashPassword(values.password),
      phone: values.phone,
      status: 'active',
      dojos: values.dojos,
    });
    if (!id) return res.status(409).json({ errors: { email: 'An account with this email already exists.' } });
    return res.status(201).json({ user: db.getUser(id) });
  });

  admin.patch('/users/:id', (req, res) => {
    const id = Number(req.params.id);
    const target = Number.isInteger(id) ? db.getUser(id) : null;
    if (!target) return res.status(404).json({ error: 'That account no longer exists.' });
    if (target.role === 'admin') return res.status(403).json({ error: 'Admin accounts cannot be changed here.' });

    const { rank, status, dojos } = req.body ?? {};
    if (rank !== undefined && !RANKS.includes(rank)) return res.status(400).json({ error: 'Choose a rank from the list.' });
    if (status !== undefined && !STATUSES.includes(status)) return res.status(400).json({ error: 'Choose a status from the list.' });
    if (status === 'active' && target.status === 'pending_payment') {
      return res.status(400).json({ error: 'This member has not paid the registration fee. Mark them as paid only after you receive payment at the dojo.' });
    }
    if (dojos !== undefined && (target.role !== 'instructor' || !Array.isArray(dojos) || dojos.length === 0 || dojos.some((d) => !dojoNames.has(d)))) {
      return res.status(400).json({ error: 'Choose at least one dojo from the list.' });
    }

    if (rank !== undefined) db.setRank(id, rank);
    if (status !== undefined) db.setStatus(id, status);
    if (dojos !== undefined) db.setInstructorDojos(id, [...new Set(dojos)]);
    return res.json({ user: db.getUser(id) });
  });

  // An admin records a fee paid in person, which activates a pending member.
  admin.post('/users/:id/mark-paid', (req, res) => {
    const id = Number(req.params.id);
    const target = Number.isInteger(id) ? db.getUser(id) : null;
    if (!target || target.status !== 'pending_payment') return res.status(400).json({ error: 'Only members waiting to pay can be marked as paid.' });
    db.markPaid(id, 'paid-at-dojo');
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

/** Creates the first admin from environment settings when the database has none. */
export async function ensureAdmin(db, { email, password, name = 'Site admin' }) {
  if (!email || !password || db.hasAdmin()) return false;
  db.createUser({ role: 'admin', name, email: email.toLowerCase(), passwordHash: await hashPassword(password), status: 'active' });
  return true;
}
