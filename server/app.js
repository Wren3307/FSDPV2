import { timingSafeEqual } from 'node:crypto';
import { readFileSync } from 'node:fs';
import express from 'express';
import rateLimit from 'express-rate-limit';
import { createAttendanceRouter } from './attendance.js';
import { createEligibilityRouter } from './eligibilityRoutes.js';
import { validateEnquiry } from './validate.js';

const readJson = (name) => JSON.parse(readFileSync(new URL(`../data/${name}.json`, import.meta.url), 'utf8'));

function tokenMatches(given, expected) {
  const a = Buffer.from(given);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

/** Builds the JSON API. Kept apart from the HTTP server so tests can run it directly. */
export function createApi({ db, adminToken, enquiryLimit = 5 }) {
  const api = express.Router();
  api.use(express.json({ limit: '20kb' }));

  const content = {
    dojos: readJson('dojos'),
    timetable: readJson('hq-timetable'),
    instructors: readJson('instructors'),
    fees: readJson('fees'),
  };
  for (const [name, data] of Object.entries(content)) {
    api.get(`/${name}`, (_req, res) => res.json(data));
  }

  const limiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: enquiryLimit,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Too many enquiries from this connection. Try again in 15 minutes, or call (+65) 6513 1588.' },
  });

  api.post('/enquiries', limiter, (req, res) => {
    // Bots fill the hidden "website" field. Answer as normal so they don't retry, but store nothing.
    if (req.body?.website) return res.status(201).json({ ok: true });

    const { errors, values } = validateEnquiry(req.body);
    if (Object.keys(errors).length > 0) return res.status(400).json({ errors });

    const id = db.addEnquiry(values);
    return res.status(201).json({ ok: true, id });
  });

  api.get('/admin/enquiries', (req, res) => {
    if (!adminToken) return res.status(503).json({ error: 'Set ADMIN_TOKEN on the server to view enquiries.' });
    const given = (req.get('authorization') ?? '').replace(/^Bearer\s+/i, '');
    if (!tokenMatches(given, adminToken)) return res.status(401).json({ error: 'That admin token is not correct.' });
    return res.json({ enquiries: db.listEnquiries() });
  });

  // FP-7: classes, sessions, rosters and attendance (instructors and admins only).
  api.use(createAttendanceRouter(db.connection));
  // FP-10: grading eligibility, worked out from attendance and the grading rules.
  api.use(createEligibilityRouter(db.connection));

  api.use((_req, res) => res.status(404).json({ error: 'Not found.' }));

  // Malformed JSON and other request errors: reply in JSON without leaking internals.
  api.use((err, _req, res, _next) => {
    const status = err.status ?? 500;
    if (status >= 500) console.error(err);
    res.status(status).json({ error: status >= 500 ? 'Something went wrong on the server.' : 'That request could not be read.' });
  });

  return api;
}
