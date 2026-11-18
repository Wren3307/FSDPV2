import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { DatabaseSync } from 'node:sqlite';
import { checkSchema, createSchema } from './schema.js';

// Where the database file lives unless DATABASE_PATH says otherwise. Shared by the server and `npm run seed`.
export function defaultDatabasePath() {
  return process.env.DATABASE_PATH ?? fileURLToPath(new URL('../storage/enquiries.db', import.meta.url));
}

// The account fields the API sends to the browser. `dojo` is the user's centre name and `status` their
// membership status, so the site's pages don't need to know the table layout.
const USER_SELECT = `
  SELECT u.id, u.role, u.name, u.email, u.phone, u.centre_id, c.name AS dojo,
         COALESCE(cr.rank_name, 'Ungraded') AS rank, u.membership_status AS status,
         u.paid_at, u.created_at
    FROM users u
    LEFT JOIN centres c ON c.id = u.centre_id
    LEFT JOIN current_ranks cr ON cr.student_id = u.id`;

export function openDatabase(path) {
  if (path !== ':memory:') mkdirSync(dirname(path), { recursive: true });
  const db = new DatabaseSync(path);
  // SQLite ignores REFERENCES unless this is switched on, once per connection.
  db.exec('PRAGMA foreign_keys = ON');
  db.exec(`
    CREATE TABLE IF NOT EXISTS enquiries (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      name       TEXT NOT NULL,
      email      TEXT NOT NULL,
      phone      TEXT NOT NULL DEFAULT '',
      interest   TEXT NOT NULL,
      dojo       TEXT NOT NULL DEFAULT '',
      message    TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);
  // Centres, users, classes, sessions, attendance and the rest (see schema.js).
  createSchema(db);

  const q = {
    insertEnquiry: db.prepare(`
      INSERT INTO enquiries (name, email, phone, interest, dojo, message)
      VALUES (:name, :email, :phone, :interest, :dojo, :message)`),
    listEnquiries: db.prepare('SELECT * FROM enquiries ORDER BY id DESC LIMIT 500'),

    centreByName: db.prepare('SELECT id FROM centres WHERE name = ?'),
    insertCentre: db.prepare('INSERT INTO centres (name, address) VALUES (?, ?)'),

    insertUser: db.prepare(`
      INSERT INTO users (role, name, email, password_hash, phone, centre_id, membership_status)
      VALUES (:role, :name, :email, :password_hash, :phone, :centre_id, :status)`),
    userById: db.prepare(`${USER_SELECT} WHERE u.id = ?`),
    authByEmail: db.prepare(`
      SELECT u.id, u.role, u.membership_status AS status, u.password_hash
        FROM users u WHERE u.email = ?`),
    hashById: db.prepare('SELECT password_hash FROM users WHERE id = ?'),
    checkoutById: db.prepare('SELECT checkout_session FROM users WHERE id = ?'),
    setCheckout: db.prepare('UPDATE users SET checkout_session = ? WHERE id = ?'),
    markPaid: db.prepare(`
      UPDATE users SET membership_status = 'active', paid_at = datetime('now'), joined_on = date('now'), checkout_session = ?
       WHERE id = ? AND membership_status = 'pending_payment'`),
    updateProfile: db.prepare('UPDATE users SET name = :name, phone = :phone, centre_id = :centre_id WHERE id = :id'),
    setPassword: db.prepare('UPDATE users SET password_hash = ? WHERE id = ?'),
    setStatus: db.prepare('UPDATE users SET membership_status = ? WHERE id = ?'),
    setCentre: db.prepare('UPDATE users SET centre_id = ? WHERE id = ?'),
    listUsers: db.prepare(`${USER_SELECT} ORDER BY CASE u.role WHEN 'admin' THEN 0 WHEN 'instructor' THEN 1 ELSE 2 END, u.name`),
    userByEmail: db.prepare('SELECT id FROM users WHERE email = ?'),

    listRanks: db.prepare('SELECT id, name FROM ranks ORDER BY sort_order'),
    rankByName: db.prepare('SELECT id FROM ranks WHERE name = ?'),
    currentRank: db.prepare('SELECT rank_id FROM current_ranks WHERE student_id = ?'),
    insertRank: db.prepare(`INSERT INTO rank_history (student_id, rank_id, awarded_on) VALUES (?, ?, date('now'))`),

    studentsAtCentre: db.prepare(`${USER_SELECT}
      WHERE u.role = 'student' AND u.membership_status = 'active' AND u.centre_id = ?
      ORDER BY u.name`),

    insertSession: db.prepare('INSERT INTO auth_sessions (token_hash, user_id, expires_at) VALUES (?, ?, ?)'),
    sessionUserId: db.prepare('SELECT user_id FROM auth_sessions WHERE token_hash = ? AND expires_at > ?'),
    deleteSession: db.prepare('DELETE FROM auth_sessions WHERE token_hash = ?'),
    deleteUserSessions: db.prepare('DELETE FROM auth_sessions WHERE user_id = ?'),
    deleteExpired: db.prepare('DELETE FROM auth_sessions WHERE expires_at <= ?'),
  };

  return {
    /** Null when the tables match this version of the code; otherwise a message saying how to fix them. */
    schemaProblem: () => checkSchema(db),

    addEnquiry: (values) => Number(q.insertEnquiry.run(values).lastInsertRowid),
    listEnquiries: () => q.listEnquiries.all(),

    /** Adds any dojo from the site's list that the centres table doesn't have yet. */
    ensureCentres(dojos) {
      for (const d of dojos) {
        if (!q.centreByName.get(d.name)) q.insertCentre.run(d.name, d.address);
      }
    },
    centreId: (name) => q.centreByName.get(name)?.id ?? null,

    /** Returns the new user's id, or null when the email is already registered. */
    createUser({ role, name, email, passwordHash, phone = '', centreId = null, status }) {
      try {
        return Number(q.insertUser.run({ role, name, email, password_hash: passwordHash, phone, centre_id: centreId, status }).lastInsertRowid);
      } catch (err) {
        if (/UNIQUE/i.test(err.message)) return null;
        throw err;
      }
    },
    getUser: (id) => q.userById.get(id),
    getAuthByEmail: (email) => q.authByEmail.get(email),
    hasUserWithEmail: (email) => Boolean(q.userByEmail.get(email)),
    getPasswordHash: (id) => q.hashById.get(id)?.password_hash,
    getCheckoutSession: (id) => q.checkoutById.get(id)?.checkout_session ?? null,
    setCheckoutSession: (id, sessionId) => q.setCheckout.run(sessionId, id),
    markPaid: (id, sessionId) => q.markPaid.run(sessionId, id).changes > 0,
    updateProfile: (id, { name, phone, centreId }) => q.updateProfile.run({ id, name, phone, centre_id: centreId }),
    setPassword: (id, hash) => q.setPassword.run(hash, id),
    setCentre: (id, centreId) => q.setCentre.run(centreId, id),
    setStatus: (id, status) => {
      const changed = q.setStatus.run(status, id).changes > 0;
      if (status === 'inactive') q.deleteUserSessions.run(id);
      return changed;
    },
    listUsers: () => q.listUsers.all(),

    listRanks: () => q.listRanks.all().map((r) => r.name),
    /** Records a promotion (a new rank_history row dated today). Returns false for an unknown rank. */
    setRank(userId, rankName) {
      const rank = q.rankByName.get(rankName);
      if (!rank) return false;
      if (q.currentRank.get(userId)?.rank_id !== rank.id) q.insertRank.run(userId, rank.id);
      return true;
    },

    /** Active students whose home centre is this instructor's centre. */
    studentsForInstructor: (instructor) => (instructor.centre_id ? q.studentsAtCentre.all(instructor.centre_id) : []),

    createSession: (tokenHash, userId, expiresAt) => {
      q.deleteExpired.run(Date.now());
      q.insertSession.run(tokenHash, userId, expiresAt);
    },
    userForSession: (tokenHash) => {
      const row = q.sessionUserId.get(tokenHash, Date.now());
      return row ? q.userById.get(row.user_id) : null;
    },
    deleteSession: (tokenHash) => q.deleteSession.run(tokenHash),
    deleteUserSessions: (userId) => q.deleteUserSessions.run(userId),

    // The raw connection, for feature routes (like attendance) that write their own queries.
    connection: db,
    close: () => db.close(),
  };
}
