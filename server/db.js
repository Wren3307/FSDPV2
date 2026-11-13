import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { DatabaseSync } from 'node:sqlite';

const SCHEMA = `
  CREATE TABLE IF NOT EXISTS enquiries (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    name       TEXT NOT NULL,
    email      TEXT NOT NULL,
    phone      TEXT NOT NULL DEFAULT '',
    interest   TEXT NOT NULL,
    dojo       TEXT NOT NULL DEFAULT '',
    message    TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS users (
    id                INTEGER PRIMARY KEY AUTOINCREMENT,
    role              TEXT NOT NULL CHECK (role IN ('member', 'instructor', 'admin')),
    name              TEXT NOT NULL,
    email             TEXT NOT NULL UNIQUE COLLATE NOCASE,
    password_hash     TEXT NOT NULL,
    phone             TEXT NOT NULL DEFAULT '',
    dojo              TEXT NOT NULL DEFAULT '',
    rank              TEXT NOT NULL DEFAULT 'Ungraded',
    status            TEXT NOT NULL CHECK (status IN ('pending_payment', 'active', 'disabled')),
    checkout_session  TEXT,
    paid_at           TEXT,
    created_at        TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS instructor_dojos (
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    dojo    TEXT NOT NULL,
    PRIMARY KEY (user_id, dojo)
  );

  CREATE TABLE IF NOT EXISTS sessions (
    token_hash TEXT PRIMARY KEY,
    user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    expires_at INTEGER NOT NULL
  );
`;

const USER_COLUMNS = 'id, role, name, email, phone, dojo, rank, status, paid_at, created_at';

export function openDatabase(path) {
  if (path !== ':memory:') mkdirSync(dirname(path), { recursive: true });
  const db = new DatabaseSync(path);
  db.exec('PRAGMA foreign_keys = ON;');
  db.exec(SCHEMA);

  const q = {
    insertEnquiry: db.prepare(`
      INSERT INTO enquiries (name, email, phone, interest, dojo, message)
      VALUES (:name, :email, :phone, :interest, :dojo, :message)`),
    listEnquiries: db.prepare('SELECT * FROM enquiries ORDER BY id DESC LIMIT 500'),

    insertUser: db.prepare(`
      INSERT INTO users (role, name, email, password_hash, phone, dojo, status)
      VALUES (:role, :name, :email, :password_hash, :phone, :dojo, :status)`),
    userById: db.prepare(`SELECT ${USER_COLUMNS} FROM users WHERE id = ?`),
    authByEmail: db.prepare(`SELECT ${USER_COLUMNS}, password_hash FROM users WHERE email = ?`),
    hashById: db.prepare('SELECT password_hash FROM users WHERE id = ?'),
    checkoutById: db.prepare('SELECT checkout_session FROM users WHERE id = ?'),
    setCheckout: db.prepare('UPDATE users SET checkout_session = ? WHERE id = ?'),
    markPaid: db.prepare(`UPDATE users SET status = 'active', paid_at = datetime('now'), checkout_session = ? WHERE id = ? AND status = 'pending_payment'`),
    updateProfile: db.prepare('UPDATE users SET name = :name, phone = :phone, dojo = :dojo WHERE id = :id'),
    setPassword: db.prepare('UPDATE users SET password_hash = ? WHERE id = ?'),
    setRank: db.prepare('UPDATE users SET rank = ? WHERE id = ?'),
    setStatus: db.prepare('UPDATE users SET status = ? WHERE id = ?'),
    listUsers: db.prepare(`SELECT ${USER_COLUMNS} FROM users ORDER BY role, name`),
    adminCount: db.prepare(`SELECT count(*) AS n FROM users WHERE role = 'admin'`),

    instructorDojos: db.prepare('SELECT dojo FROM instructor_dojos WHERE user_id = ? ORDER BY dojo'),
    addInstructorDojo: db.prepare('INSERT OR IGNORE INTO instructor_dojos (user_id, dojo) VALUES (?, ?)'),
    clearInstructorDojos: db.prepare('DELETE FROM instructor_dojos WHERE user_id = ?'),
    membersForInstructor: db.prepare(`
      SELECT ${USER_COLUMNS.split(', ').map((c) => `u.${c}`).join(', ')}
      FROM users u JOIN instructor_dojos d ON d.dojo = u.dojo AND d.user_id = ?
      WHERE u.role = 'member' AND u.status = 'active'
      ORDER BY u.dojo, u.name`),

    insertSession: db.prepare('INSERT INTO sessions (token_hash, user_id, expires_at) VALUES (?, ?, ?)'),
    sessionUser: db.prepare(`
      SELECT ${USER_COLUMNS.split(', ').map((c) => `u.${c}`).join(', ')}
      FROM sessions s JOIN users u ON u.id = s.user_id
      WHERE s.token_hash = ? AND s.expires_at > ?`),
    deleteSession: db.prepare('DELETE FROM sessions WHERE token_hash = ?'),
    deleteUserSessions: db.prepare('DELETE FROM sessions WHERE user_id = ?'),
    deleteExpired: db.prepare('DELETE FROM sessions WHERE expires_at <= ?'),
  };

  const withDojos = (user) => (user && user.role === 'instructor'
    ? { ...user, dojos: q.instructorDojos.all(user.id).map((r) => r.dojo) }
    : user);

  const transaction = (fn) => {
    db.exec('BEGIN');
    try {
      const result = fn();
      db.exec('COMMIT');
      return result;
    } catch (err) {
      db.exec('ROLLBACK');
      throw err;
    }
  };

  return {
    addEnquiry: (values) => Number(q.insertEnquiry.run(values).lastInsertRowid),
    listEnquiries: () => q.listEnquiries.all(),

    /** Returns the new user's id, or null when the email is already registered. */
    createUser({ role, name, email, passwordHash, phone = '', dojo = '', status, dojos = [] }) {
      try {
        return transaction(() => {
          const id = Number(q.insertUser.run({ role, name, email, password_hash: passwordHash, phone, dojo, status }).lastInsertRowid);
          for (const d of dojos) q.addInstructorDojo.run(id, d);
          return id;
        });
      } catch (err) {
        if (/UNIQUE/i.test(err.message)) return null;
        throw err;
      }
    },
    getUser: (id) => withDojos(q.userById.get(id)),
    getAuthByEmail: (email) => q.authByEmail.get(email),
    getPasswordHash: (id) => q.hashById.get(id)?.password_hash,
    getCheckoutSession: (id) => q.checkoutById.get(id)?.checkout_session ?? null,
    setCheckoutSession: (id, sessionId) => q.setCheckout.run(sessionId, id),
    markPaid: (id, sessionId) => q.markPaid.run(sessionId, id).changes > 0,
    updateProfile: (id, values) => q.updateProfile.run({ id, ...values }),
    setPassword: (id, hash) => q.setPassword.run(hash, id),
    setRank: (id, rank) => q.setRank.run(rank, id).changes > 0,
    setStatus: (id, status) => {
      const changed = q.setStatus.run(status, id).changes > 0;
      if (status === 'disabled') q.deleteUserSessions.run(id);
      return changed;
    },
    setInstructorDojos: (id, dojos) => transaction(() => {
      q.clearInstructorDojos.run(id);
      for (const d of dojos) q.addInstructorDojo.run(id, d);
    }),
    listUsers: () => q.listUsers.all().map(withDojos),
    hasAdmin: () => q.adminCount.get().n > 0,
    membersForInstructor: (id) => q.membersForInstructor.all(id),

    createSession: (tokenHash, userId, expiresAt) => {
      q.deleteExpired.run(Date.now());
      q.insertSession.run(tokenHash, userId, expiresAt);
    },
    userForSession: (tokenHash) => withDojos(q.sessionUser.get(tokenHash, Date.now())),
    deleteSession: (tokenHash) => q.deleteSession.run(tokenHash),
    deleteUserSessions: (userId) => q.deleteUserSessions.run(userId),

    close: () => db.close(),
  };
}
