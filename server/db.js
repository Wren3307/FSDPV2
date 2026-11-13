import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { DatabaseSync } from 'node:sqlite';
import { createSchema } from './schema.js';

// Where the database file lives unless DATABASE_PATH says otherwise. Shared by the server and `npm run seed`.
export function defaultDatabasePath() {
  return process.env.DATABASE_PATH ?? fileURLToPath(new URL('../storage/enquiries.db', import.meta.url));
}

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

  const insert = db.prepare(`
    INSERT INTO enquiries (name, email, phone, interest, dojo, message)
    VALUES (:name, :email, :phone, :interest, :dojo, :message)
  `);
  const list = db.prepare('SELECT * FROM enquiries ORDER BY id DESC LIMIT 500');

  return {
    addEnquiry: (values) => Number(insert.run(values).lastInsertRowid),
    listEnquiries: () => list.all(),
    // The raw connection, for feature routes (like attendance) that write their own queries.
    connection: db,
    close: () => db.close(),
  };
}
