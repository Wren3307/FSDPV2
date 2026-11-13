// Shared tables for the student management features (FP-7 attendance, FP-10 eligibility, and others).
// This is the team's Postgres design from the first attempt, rewritten for SQLite:
//   - dates are 'YYYY-MM-DD' text and times are 'HH:MM' text (both sort correctly as text)
//   - booleans are INTEGER 0/1
//   - INTEGER PRIMARY KEY auto-numbers, so there is no IDENTITY or sequence
// Payments (Stripe) are left for that story's owner to add.

// Every statement uses IF NOT EXISTS, so this is safe to run on each server start.
const CREATE_TABLES = `
  CREATE TABLE IF NOT EXISTS centres (
    id      INTEGER PRIMARY KEY,
    name    TEXT NOT NULL,
    address TEXT
  );

  -- Students, instructors and admins all live here. A student's home centre is users.centre_id.
  CREATE TABLE IF NOT EXISTS users (
    id                INTEGER PRIMARY KEY,
    name              TEXT NOT NULL,
    email             TEXT NOT NULL UNIQUE,
    password_hash     TEXT NOT NULL,
    role              TEXT NOT NULL CHECK (role IN ('student', 'instructor', 'admin')),
    centre_id         INTEGER REFERENCES centres (id) ON DELETE SET NULL,
    date_of_birth     TEXT,
    membership_status TEXT NOT NULL DEFAULT 'active' CHECK (membership_status IN ('active', 'inactive')),
    joined_on         TEXT NOT NULL DEFAULT (date('now')),
    created_at        TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS ranks (
    id         INTEGER PRIMARY KEY,
    name       TEXT NOT NULL UNIQUE,
    sort_order INTEGER NOT NULL UNIQUE CHECK (sort_order > 0) -- higher = more senior
  );

  -- A student's current rank is their latest row here (see the current_ranks view).
  CREATE TABLE IF NOT EXISTS rank_history (
    id         INTEGER PRIMARY KEY,
    student_id INTEGER NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    rank_id    INTEGER NOT NULL REFERENCES ranks (id) ON DELETE RESTRICT,
    awarded_on TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS classes (
    id            INTEGER PRIMARY KEY,
    centre_id     INTEGER NOT NULL REFERENCES centres (id) ON DELETE RESTRICT,
    instructor_id INTEGER NOT NULL REFERENCES users (id) ON DELETE RESTRICT,
    name          TEXT NOT NULL,
    day_of_week   INTEGER NOT NULL CHECK (day_of_week BETWEEN 1 AND 7), -- ISO: 1 = Monday ... 7 = Sunday
    start_time    TEXT NOT NULL,
    end_time      TEXT NOT NULL,
    min_rank_id   INTEGER REFERENCES ranks (id) ON DELETE SET NULL,
    capacity      INTEGER NOT NULL DEFAULT 20 CHECK (capacity > 0),
    fee_cents     INTEGER NOT NULL DEFAULT 0 CHECK (fee_cents >= 0),
    CHECK (start_time < end_time)
  );

  CREATE TABLE IF NOT EXISTS enrolments (
    id          INTEGER PRIMARY KEY,
    student_id  INTEGER NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    class_id    INTEGER NOT NULL REFERENCES classes (id) ON DELETE CASCADE,
    status      TEXT NOT NULL DEFAULT 'pending_payment' CHECK (status IN ('pending_payment', 'active')),
    enrolled_on TEXT NOT NULL DEFAULT (date('now')),
    UNIQUE (student_id, class_id)
  );

  -- Regular sessions belong to a class; external sessions (FP-8) name an outside event instead.
  CREATE TABLE IF NOT EXISTS sessions (
    id            INTEGER PRIMARY KEY,
    class_id      INTEGER REFERENCES classes (id) ON DELETE RESTRICT,
    centre_id     INTEGER REFERENCES centres (id) ON DELETE SET NULL,
    date          TEXT NOT NULL,
    start_time    TEXT NOT NULL,
    end_time      TEXT NOT NULL,
    type          TEXT NOT NULL CHECK (type IN ('regular', 'external')),
    external_name TEXT,
    CHECK (start_time < end_time),
    CHECK ((type = 'regular' AND class_id IS NOT NULL) OR (type = 'external' AND external_name IS NOT NULL))
  );

  -- UNIQUE(session_id, student_id) is what lets a re-save update a row instead of duplicating it.
  CREATE TABLE IF NOT EXISTS attendance (
    id         INTEGER PRIMARY KEY,
    session_id INTEGER NOT NULL REFERENCES sessions (id) ON DELETE CASCADE,
    student_id INTEGER NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    status     TEXT NOT NULL CHECK (status IN ('present', 'late', 'absent', 'excused')),
    marked_by  INTEGER REFERENCES users (id) ON DELETE SET NULL,
    marked_at  TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE (session_id, student_id)
  );

  CREATE TABLE IF NOT EXISTS grading_rules (
    id                 INTEGER PRIMARY KEY,
    from_rank_id       INTEGER NOT NULL REFERENCES ranks (id) ON DELETE CASCADE,
    to_rank_id         INTEGER NOT NULL REFERENCES ranks (id) ON DELETE CASCADE,
    min_sessions       INTEGER NOT NULL CHECK (min_sessions >= 0),
    min_months_in_rank INTEGER NOT NULL CHECK (min_months_in_rank >= 0),
    counts_external    INTEGER NOT NULL DEFAULT 0 CHECK (counts_external IN (0, 1)),
    min_age            INTEGER CHECK (min_age IS NULL OR min_age >= 0),
    active             INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0, 1)),
    UNIQUE (from_rank_id, to_rank_id)
  );

  -- Each student's current rank: their latest rank_history row (ties broken by the newest id).
  -- Postgres used DISTINCT ON for this; SQLite numbers each student's rows and keeps row 1.
  CREATE VIEW IF NOT EXISTS current_ranks AS
  SELECT student_id, rank_id, rank_name, sort_order, rank_since
    FROM (
      SELECT rh.student_id, rh.rank_id, r.name AS rank_name, r.sort_order, rh.awarded_on AS rank_since,
             ROW_NUMBER() OVER (PARTITION BY rh.student_id ORDER BY rh.awarded_on DESC, rh.id DESC) AS row_num
        FROM rank_history rh
        JOIN ranks r ON r.id = rh.rank_id
    )
   WHERE row_num = 1;

  CREATE INDEX IF NOT EXISTS idx_rank_history_student_id ON rank_history (student_id);
  CREATE INDEX IF NOT EXISTS idx_attendance_student_id ON attendance (student_id);
  CREATE INDEX IF NOT EXISTS idx_sessions_date ON sessions (date);
  CREATE INDEX IF NOT EXISTS idx_enrolments_class_id ON enrolments (class_id);
`;

// Children first, so no foreign key is left pointing at a dropped table.
const DROP_TABLES = `
  DROP VIEW  IF EXISTS current_ranks;
  DROP TABLE IF EXISTS attendance;
  DROP TABLE IF EXISTS sessions;
  DROP TABLE IF EXISTS enrolments;
  DROP TABLE IF EXISTS classes;
  DROP TABLE IF EXISTS grading_rules;
  DROP TABLE IF EXISTS rank_history;
  DROP TABLE IF EXISTS users;
  DROP TABLE IF EXISTS ranks;
  DROP TABLE IF EXISTS centres;
`;

export function createSchema(connection) {
  connection.exec(CREATE_TABLES);
}

// Used by the seed to start from empty tables. The enquiries table is left alone.
export function dropSchema(connection) {
  connection.exec(DROP_TABLES);
}
