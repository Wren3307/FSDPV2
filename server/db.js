import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { DatabaseSync } from 'node:sqlite';

export function openDatabase(path) {
  if (path !== ':memory:') mkdirSync(dirname(path), { recursive: true });
  const db = new DatabaseSync(path);
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

  const insert = db.prepare(`
    INSERT INTO enquiries (name, email, phone, interest, dojo, message)
    VALUES (:name, :email, :phone, :interest, :dojo, :message)
  `);
  const list = db.prepare('SELECT * FROM enquiries ORDER BY id DESC LIMIT 500');

  return {
    addEnquiry: (values) => Number(insert.run(values).lastInsertRowid),
    listEnquiries: () => list.all(),
    close: () => db.close(),
  };
}
