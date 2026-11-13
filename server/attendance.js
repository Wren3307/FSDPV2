// FP-7 attendance API: list a day's classes, open a session, fetch the roster, save attendance.
// Ported from the first attempt (Postgres) to node:sqlite. Every route needs an instructor or admin.
import express from 'express';
import { loadUser, requireRole } from './auth.js';
import { daysBetween, isDate, isoWeekday, today } from './dates.js';

// The only statuses the attendance table accepts.
const STATUSES = ['present', 'late', 'absent', 'excused'];

// Instructors only touch classes at their own centre; admins touch everything.
function canUseCentre(user, centreId) {
  return user.role === 'admin' || user.centre_id === centreId;
}

export function createAttendanceRouter(connection) {
  const router = express.Router();

  // Put on each route rather than router.use(), so unknown /api paths still answer 404, not 401.
  const staffOnly = [loadUser(connection), requireRole('instructor', 'admin')];

  // A session's centre and date. External sessions have no class, so fall back to the session's own centre.
  const findSession = connection.prepare(`
    SELECT s.id, s.class_id, s.date, COALESCE(c.centre_id, s.centre_id) AS centre_id
      FROM sessions s
      LEFT JOIN classes c ON c.id = s.class_id
     WHERE s.id = ?
  `);

  // Shared by the roster and the PUT: 404 if the session is missing, 403 if it's another centre's.
  // Returns the session, or null once it has already sent the error.
  function sessionFor(req, res) {
    const sessionId = Number(req.params.id);
    if (!Number.isInteger(sessionId)) {
      res.status(400).json({ error: 'id must be a number' });
      return null;
    }
    const session = findSession.get(sessionId);
    if (!session) {
      res.status(404).json({ error: 'Session not found' });
      return null;
    }
    if (!canUseCentre(req.user, session.centre_id)) {
      res.status(403).json({ error: 'That session belongs to another centre' });
      return null;
    }
    return session;
  }

  // The classes running on a date (default today) at the instructor's centre, or every centre for an admin.
  // sessionId is null until someone opens a session for that class and date.
  const classesOnDay = connection.prepare(`
    SELECT c.id         AS classId,
           c.name,
           c.start_time AS startTime,
           c.end_time   AS endTime,
           c.centre_id  AS centreId,
           ct.name      AS centreName,
           s.id         AS sessionId
      FROM classes c
      JOIN centres ct ON ct.id = c.centre_id
      LEFT JOIN sessions s ON s.class_id = c.id AND s.date = :date AND s.type = 'regular'
     WHERE c.day_of_week = :weekday
       AND (:centreId IS NULL OR c.centre_id = :centreId)
     ORDER BY c.start_time, c.name
  `);

  router.get('/instructor/classes', ...staffOnly, (req, res) => {
    const date = req.query.date ?? today();
    if (!isDate(date)) return res.status(400).json({ error: 'date must look like YYYY-MM-DD' });

    // An admin has no centre, so a NULL centreId means "no filter".
    const centreId = req.user.role === 'admin' ? null : req.user.centre_id;
    res.json(classesOnDay.all({ date, weekday: isoWeekday(date), centreId }));
  });

  const findClass = connection.prepare('SELECT id, centre_id, start_time, end_time FROM classes WHERE id = ?');
  const findRegularSession = connection.prepare(
    `SELECT id FROM sessions WHERE class_id = ? AND date = ? AND type = 'regular'`,
  );
  const insertRegularSession = connection.prepare(`
    INSERT INTO sessions (class_id, centre_id, date, start_time, end_time, type)
    VALUES (?, ?, ?, ?, ?, 'regular')
  `);

  // Open the regular session for a class on a date. The same class and date always give back
  // the same id, so a double tap can't create two sessions.
  router.post('/classes/:classId/sessions', ...staffOnly, (req, res) => {
    const classId = Number(req.params.classId);
    if (!Number.isInteger(classId)) return res.status(400).json({ error: 'classId must be a number' });

    const date = req.body?.date ?? today();
    if (!isDate(date)) return res.status(400).json({ error: 'date must look like YYYY-MM-DD' });

    // `class` is reserved in JavaScript, so the row gets its own name.
    const aikidoClass = findClass.get(classId);
    if (!aikidoClass) return res.status(404).json({ error: 'Class not found' });
    if (!canUseCentre(req.user, aikidoClass.centre_id)) {
      return res.status(403).json({ error: 'That class belongs to another centre' });
    }

    const existing = findRegularSession.get(classId, date);
    if (existing) return res.json({ sessionId: existing.id });

    const { lastInsertRowid } = insertRegularSession.run(
      classId, aikidoClass.centre_id, date, aikidoClass.start_time, aikidoClass.end_time,
    );
    res.status(201).json({ sessionId: Number(lastInsertRowid) });
  });

  // Everyone to mark: the class's enrolled students, plus any walk-in who already has an
  // attendance row. For an external session class_id is NULL, so only attendance rows match.
  const rosterFor = connection.prepare(`
    SELECT u.id AS studentId, u.name, cr.rank_name AS rank, a.status
      FROM users u
      LEFT JOIN current_ranks cr ON cr.student_id = u.id
      LEFT JOIN attendance a ON a.session_id = :sessionId AND a.student_id = u.id
     WHERE EXISTS (SELECT 1 FROM enrolments e WHERE e.class_id = :classId AND e.student_id = u.id)
        OR a.id IS NOT NULL
     ORDER BY u.name
  `);

  router.get('/sessions/:id/roster', ...staffOnly, (req, res) => {
    const session = sessionFor(req, res);
    if (!session) return;
    res.json(rosterFor.all({ sessionId: session.id, classId: session.class_id }));
  });

  // Student search for the "Add walk-in" box, limited to one centre.
  const searchStudents = connection.prepare(`
    SELECT u.id AS studentId, u.name, cr.rank_name AS rank
      FROM users u
      LEFT JOIN current_ranks cr ON cr.student_id = u.id
     WHERE u.role = 'student' AND u.centre_id = ? AND u.name LIKE ?
     ORDER BY u.name
     LIMIT 20
  `);

  router.get('/centres/:centreId/students', ...staffOnly, (req, res) => {
    const centreId = Number(req.params.centreId);
    if (!Number.isInteger(centreId)) return res.status(400).json({ error: 'centreId must be a number' });
    if (!canUseCentre(req.user, centreId)) return res.status(403).json({ error: 'That centre is not yours' });

    // SQLite's LIKE already ignores case for English letters, like Postgres's ILIKE.
    const q = String(req.query.q ?? '').trim();
    res.json(searchStudents.all(centreId, `%${q}%`));
  });

  const findRole = connection.prepare('SELECT role FROM users WHERE id = ?');
  // Re-saving the same student hits UNIQUE(session_id, student_id) and updates that row instead.
  const upsertAttendance = connection.prepare(`
    INSERT INTO attendance (session_id, student_id, status, marked_by)
    VALUES (?, ?, ?, ?)
    ON CONFLICT (session_id, student_id) DO UPDATE
       SET status    = excluded.status,
           marked_by = excluded.marked_by,
           marked_at = datetime('now')
  `);

  // Mark or re-mark attendance for a session. Body: [{ studentId, status }, ...]
  router.put('/sessions/:id/attendance', ...staffOnly, (req, res) => {
    const session = sessionFor(req, res);
    if (!session) return;

    // Attendance stays editable on the day and the day after, then it is locked.
    if (daysBetween(session.date, today()) > 1) {
      return res.status(403).json({ error: 'This session is more than a day old, so attendance is locked' });
    }

    const entries = req.body;
    if (!Array.isArray(entries)) {
      return res.status(400).json({ error: 'Body must be an array of { studentId, status }' });
    }
    for (const entry of entries) {
      if (!Number.isInteger(entry?.studentId) || !STATUSES.includes(entry?.status)) {
        return res.status(400).json({
          error: `Each entry needs an integer studentId and a status of ${STATUSES.join(', ')}`,
        });
      }
    }

    // A walk-in who is also enrolled can arrive twice. Keep the last status sent for each student.
    const byStudent = new Map(entries.map((entry) => [entry.studentId, entry.status]));

    // Only students can have attendance. Checked up front so a bad id saves nothing.
    for (const studentId of byStudent.keys()) {
      if (findRole.get(studentId)?.role !== 'student') {
        return res.status(400).json({ error: `User ${studentId} is not a student` });
      }
    }

    // One transaction for the whole save: either every row lands or none does.
    connection.exec('BEGIN');
    try {
      for (const [studentId, status] of byStudent) {
        upsertAttendance.run(session.id, studentId, status, req.user.id);
      }
      connection.exec('COMMIT');
    } catch (err) {
      connection.exec('ROLLBACK');
      throw err; // createApi's error handler turns this into a JSON 500.
    }

    res.json({ saved: byStudent.size });
  });

  return router;
}
