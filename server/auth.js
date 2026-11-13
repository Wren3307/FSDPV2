// Login (FP-1): password hashing, session cookies, and the role checks every feature router uses.
// createApi runs sessions.load on every request, so req.user is the logged-in user or null.
import { createHash, randomBytes, scrypt, scryptSync, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';

const scryptAsync = promisify(scrypt);
const KEY_LENGTH = 64;
const COOKIE = 'ask_session';
const SESSION_DAYS = 7;

const formatHash = (salt, key) => `scrypt$${salt.toString('base64')}$${key.toString('base64')}`;

export async function hashPassword(password) {
  const salt = randomBytes(16);
  return formatHash(salt, await scryptAsync(password, salt, KEY_LENGTH));
}

/** For the seed script, which runs synchronously. */
export function hashPasswordSync(password) {
  const salt = randomBytes(16);
  return formatHash(salt, scryptSync(password, salt, KEY_LENGTH));
}

export async function verifyPassword(password, stored) {
  const [scheme, salt, hash] = (stored ?? '').split('$');
  if (scheme !== 'scrypt' || !salt || !hash) return false;
  const expected = Buffer.from(hash, 'base64');
  const actual = await scryptAsync(password, Buffer.from(salt, 'base64'), expected.length);
  return timingSafeEqual(actual, expected);
}

// A hash to compare against when the email is unknown, so failed logins take the same time either way.
const DUMMY_HASH = await hashPassword(randomBytes(12).toString('hex'));
export const checkPassword = (password, stored) => verifyPassword(password, stored ?? DUMMY_HASH);

const hashToken = (token) => createHash('sha256').update(token).digest('hex');

function readCookie(req, name) {
  for (const part of (req.headers.cookie ?? '').split(';')) {
    const [key, ...rest] = part.trim().split('=');
    if (key === name) return decodeURIComponent(rest.join('='));
  }
  return null;
}

export function createSessions(db, { secureCookies }) {
  const cookieAttrs = `Path=/; HttpOnly; SameSite=Lax${secureCookies ? '; Secure' : ''}`;

  return {
    start(res, userId) {
      const token = randomBytes(32).toString('base64url');
      const maxAge = SESSION_DAYS * 24 * 60 * 60;
      db.createSession(hashToken(token), userId, Date.now() + maxAge * 1000);
      res.append('Set-Cookie', `${COOKIE}=${token}; Max-Age=${maxAge}; ${cookieAttrs}`);
    },
    end(req, res) {
      const token = readCookie(req, COOKIE);
      if (token) db.deleteSession(hashToken(token));
      res.append('Set-Cookie', `${COOKIE}=; Max-Age=0; ${cookieAttrs}`);
    },
    /** Middleware: sets req.user to the logged-in user, or null. Switched-off accounts count as logged out. */
    load(req, _res, next) {
      const token = readCookie(req, COOKIE);
      const user = token ? db.userForSession(hashToken(token)) : null;
      req.user = user && user.status !== 'inactive' ? user : null;
      next();
    },
  };
}

/**
 * Requires a logged-in user. The feature routers (attendance, eligibility) were written against a
 * header-based stand-in for login; they still call loadUser(connection), which now just checks the
 * session that createApi has already loaded.
 */
export function loadUser(_connection) {
  return (req, res, next) => {
    if (!req.user) return res.status(401).json({ error: 'Log in to continue.' });
    return next();
  };
}

// 401 when logged out, 403 unless the user has one of the given roles. Keeping every role check in
// this one helper means every feature checks access the same way.
export function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user) return res.status(401).json({ error: 'Log in to continue.' });
    if (!roles.includes(req.user.role)) return res.status(403).json({ error: 'You do not have permission to do that.' });
    return next();
  };
}
