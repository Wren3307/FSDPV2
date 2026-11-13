// Demo data for the student management features. Ported from the first attempt's db/seed.sql.
//
// Run `npm run seed` to wipe and reload it. Dates are relative to today, so re-seed
// before a demo to keep the data looking recent.
//
// Test cases used by FP-7 / FP-10 / FP-9:
//   (a) Alice Tan  (user 4): clearly eligible for 5th kyu
//   (b) Ben Lim    (user 5): just short on sessions (13 of 14)
//   (c) Chen Wei   (user 6): eligible only if external sessions count (15 regular + 3 external, needs 16)
//   (d) Divya Nair (user 7): strong in weeks 1-4, dropped off in weeks 5-8
import { fileURLToPath } from 'node:url';
import { addDays, isoWeekday, today } from './dates.js';
import { createSchema, dropSchema } from './schema.js';

const CENTRES = [
  [1, 'Shinjuku Dojo', '1-2-3 Shinjuku, Tokyo'],
  [2, 'Shibuya Dojo', '4-5-6 Shibuya, Tokyo'],
];

const RANKS = [
  [1, '6th kyu', 1], [2, '5th kyu', 2], [3, '4th kyu', 3], [4, '3rd kyu', 4],
  [5, '2nd kyu', 5], [6, '1st kyu', 6], [7, 'shodan', 7],
];

// [id, name, email, role, centre_id, date_of_birth]. Password hashes are placeholders until FP-1.
const USERS = [
  [1, 'Aiko Tanaka', 'aiko.tanaka@example.com', 'admin', null, '1985-02-11'],
  [2, 'Kenji Yamamoto', 'kenji.yamamoto@example.com', 'instructor', 1, '1979-07-19'],
  [3, 'Mei Lin', 'mei.lin@example.com', 'instructor', 2, '1983-11-02'],
  [4, 'Alice Tan', 'alice.tan@example.com', 'student', 1, '1998-04-12'],
  [5, 'Ben Lim', 'ben.lim@example.com', 'student', 1, '2001-09-03'],
  [6, 'Chen Wei', 'chen.wei@example.com', 'student', 1, '1995-01-27'],
  [7, 'Divya Nair', 'divya.nair@example.com', 'student', 1, '2003-06-18'],
  [8, 'Ethan Koh', 'ethan.koh@example.com', 'student', 1, '1999-11-05'],
  [9, 'Farah Ismail', 'farah.ismail@example.com', 'student', 1, '1997-02-14'],
  [10, 'Glen Ong', 'glen.ong@example.com', 'student', 1, '1992-08-30'],
  [11, 'Hana Sato', 'hana.sato@example.com', 'student', 2, '2005-03-22'],
  [12, 'Ivan Petrov', 'ivan.petrov@example.com', 'student', 2, '1990-12-09'],
  [13, 'Jia Lee', 'jia.lee@example.com', 'student', 1, '2000-07-16'],
  [14, 'Kenji Mori', 'kenji.mori@example.com', 'student', 2, '1988-05-04'],
  [15, 'Lena Fischer', 'lena.fischer@example.com', 'student', 2, '1994-10-21'],
];

// [student_id, rank_id, days ago]. Older students keep their earlier promotions.
const RANK_HISTORY = [
  [4, 1, 150], [5, 1, 140], [6, 1, 900], [6, 2, 400], [7, 1, 170], [8, 1, 160],
  [9, 1, 820], [9, 2, 300], [10, 1, 1200], [10, 2, 700], [10, 3, 240],
  [11, 1, 1100], [11, 2, 600], [11, 3, 200],
  [12, 1, 1500], [12, 2, 1000], [12, 3, 500], [12, 4, 180],
  [13, 1, 1400], [13, 2, 950], [13, 3, 420], [13, 4, 150],
  [14, 1, 1600], [14, 2, 1200], [14, 3, 800], [14, 4, 450], [14, 5, 120],
  [15, 1, 1800], [15, 2, 1400], [15, 3, 1000], [15, 4, 650], [15, 5, 300], [15, 6, 90],
];

// [id, centre_id, instructor_id, name, day_of_week, start_time, end_time, min_rank_id]
const CLASSES = [
  [1, 1, 2, 'Monday Beginners', 1, '18:00', '19:30', 1],
  [2, 1, 2, 'Wednesday General', 3, '18:00', '19:30', null],
  [3, 2, 3, 'Saturday Advanced', 6, '09:00', '11:00', 3],
];

// [student_id, class_id, days ago]
const ENROLMENTS = [
  [4, 1, 330], [5, 1, 320], [6, 1, 300], [7, 1, 310], [8, 1, 280], [9, 1, 290],
  [4, 2, 330], [5, 2, 320], [6, 2, 300], [7, 2, 310], [9, 2, 290], [10, 2, 260], [13, 2, 250],
  [11, 3, 240], [12, 3, 230], [14, 3, 220], [15, 3, 210],
];

// [centre_id, days ago, start, end, event name]
const EXTERNAL_SESSIONS = [
  [1, 28, '09:00', '13:00', 'Kanto Regional Seminar'],
  [1, 14, '10:00', '12:00', 'City Dojo Exchange'],
  [2, 5, '09:30', '15:00', 'National Grading Clinic'],
];

// [event name, student_id, status]. Chen attends all three, which is what makes case (c) eligible.
const EXTERNAL_ATTENDANCE = [
  ['Kanto Regional Seminar', 6, 'present'], ['City Dojo Exchange', 6, 'present'], ['National Grading Clinic', 6, 'present'],
  ['Kanto Regional Seminar', 4, 'present'], ['City Dojo Exchange', 4, 'present'],
  ['Kanto Regional Seminar', 11, 'late'],
  ['City Dojo Exchange', 12, 'absent'],
];

// PLACEHOLDER: confirm the real requirements with the club.
// [from_rank_id, to_rank_id, min_sessions, min_months_in_rank, counts_external, min_age]
const GRADING_RULES = [
  [1, 2, 14, 3, 0, null],
  [2, 3, 16, 4, 1, null],
  [3, 4, 18, 6, 0, null],
  [4, 5, 20, 8, 1, 16],
  [5, 6, 22, 10, 0, null],
  [6, 7, 24, 12, 1, 18],
];

// The status a student gets for one regular session. weeksAgo runs 8 (oldest) to 1 (last week).
// The four test students follow their cases exactly; everyone else gets a varied but fixed pattern.
function regularStatus(studentId, weeksAgo, classId) {
  if (studentId === 4) { // (a) Alice: attends everything
    return weeksAgo === 4 && classId === 1 ? 'late' : 'present';
  }
  if (studentId === 5) { // (b) Ben: 13 attended, rule needs 14
    if (weeksAgo >= 3) return 'present';
    return weeksAgo === 2 && classId === 1 ? 'present' : 'absent';
  }
  if (studentId === 6) { // (c) Chen: 15 of 16 regular sessions
    return weeksAgo === 8 && classId === 2 ? 'excused' : 'present';
  }
  if (studentId === 7) { // (d) Divya: weeks 8-5 present, weeks 4-1 absent
    if (weeksAgo <= 4) return 'absent';
    return weeksAgo === 6 && classId === 2 ? 'late' : 'present';
  }
  return ['absent', 'late', 'excused', 'present', 'present', 'present', 'present', 'present'][
    (studentId * 3 + weeksAgo + classId) % 8
  ];
}

// Wipes the shared tables and reloads the demo data, all in one transaction.
export function seedDatabase(connection, now = today()) {
  dropSchema(connection);
  createSchema(connection);

  const run = (sql, rows) => {
    const statement = connection.prepare(sql);
    for (const row of rows) statement.run(...row);
  };

  connection.exec('BEGIN');
  try {
    run('INSERT INTO centres (id, name, address) VALUES (?, ?, ?)', CENTRES);
    run('INSERT INTO ranks (id, name, sort_order) VALUES (?, ?, ?)', RANKS);
    run(
      `INSERT INTO users (id, name, email, role, centre_id, date_of_birth, password_hash)
       VALUES (?, ?, ?, ?, ?, ?, 'placeholder-hash')`,
      USERS,
    );
    run(
      'INSERT INTO rank_history (student_id, rank_id, awarded_on) VALUES (?, ?, ?)',
      RANK_HISTORY.map(([student, rank, daysAgo]) => [student, rank, addDays(now, -daysAgo)]),
    );
    run(
      `INSERT INTO classes (id, centre_id, instructor_id, name, day_of_week, start_time, end_time, min_rank_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      CLASSES,
    );
    run(
      `INSERT INTO enrolments (student_id, class_id, status, enrolled_on) VALUES (?, ?, 'active', ?)`,
      ENROLMENTS.map(([student, aikidoClass, daysAgo]) => [student, aikidoClass, addDays(now, -daysAgo)]),
    );

    // Eight weeks of regular sessions: one per class per week, on the class's own weekday,
    // from eight weeks ago up to last week. Every enrolled student gets an attendance row.
    const thisMonday = addDays(now, 1 - isoWeekday(now));
    const insertSession = connection.prepare(
      `INSERT INTO sessions (class_id, centre_id, date, start_time, end_time, type, external_name)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    );
    const insertAttendance = connection.prepare(
      'INSERT INTO attendance (session_id, student_id, status, marked_by, marked_at) VALUES (?, ?, ?, ?, ?)',
    );

    for (let weeksAgo = 8; weeksAgo >= 1; weeksAgo--) {
      for (const [classId, centreId, instructorId, , dayOfWeek, start, end] of CLASSES) {
        const date = addDays(thisMonday, -7 * weeksAgo + (dayOfWeek - 1));
        const { lastInsertRowid } = insertSession.run(classId, centreId, date, start, end, 'regular', null);
        for (const [studentId, enrolledClass] of ENROLMENTS) {
          if (enrolledClass !== classId) continue;
          insertAttendance.run(
            lastInsertRowid, studentId, regularStatus(studentId, weeksAgo, classId), instructorId, `${date} ${end}`,
          );
        }
      }
    }

    // External sessions (FP-8) have no class, just an event name. Mei Lin (user 3) marked them.
    const externalIds = new Map();
    for (const [centreId, daysAgo, start, end, name] of EXTERNAL_SESSIONS) {
      const date = addDays(now, -daysAgo);
      const { lastInsertRowid } = insertSession.run(null, centreId, date, start, end, 'external', name);
      externalIds.set(name, { id: lastInsertRowid, markedAt: `${date} ${end}` });
    }
    for (const [name, studentId, status] of EXTERNAL_ATTENDANCE) {
      const session = externalIds.get(name);
      insertAttendance.run(session.id, studentId, status, 3, session.markedAt);
    }

    run(
      `INSERT INTO grading_rules (from_rank_id, to_rank_id, min_sessions, min_months_in_rank, counts_external, min_age)
       VALUES (?, ?, ?, ?, ?, ?)`,
      GRADING_RULES,
    );

    connection.exec('COMMIT');
  } catch (err) {
    connection.exec('ROLLBACK');
    throw err;
  }
}

// `npm run seed` runs this file directly. Importing it (from tests or index.js) skips this block.
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { openDatabase, defaultDatabasePath } = await import('./db.js');
  const db = openDatabase(defaultDatabasePath());
  seedDatabase(db.connection);
  db.close();
  console.log('Seeded the demo data.');
}
