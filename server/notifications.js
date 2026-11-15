// FP-11 eligibility notifications: tell a student when they become eligible for their next grading.
//
// A notification is one row in the notifications table, shown on the student's account page.
// A student has at most one "eligible for grading" notification, and it is kept in step with
// what the eligibility engine (FP-10) says right now:
//   - eligible, and no notification yet -> add one (they have just become eligible)
//   - not eligible, but one exists      -> remove it (an attendance mark was corrected, or they
//                                          were promoted and start again towards the next rank)
// The check runs after every attendance save (for the students in that save) and once when the
// server starts (for everyone). There is no timer in this prototype: a live system would also
// run checkEveryone() every night, to catch students who only needed more months in rank.
import { createEligibilityEngine } from './eligibility.js';

const ELIGIBLE = 'grading_eligible';

export function createNotifier(connection) {
  const engine = createEligibilityEngine(connection);

  const findNotice = connection.prepare('SELECT id FROM notifications WHERE user_id = ? AND type = ?');
  const addNotice = connection.prepare('INSERT INTO notifications (user_id, type, message) VALUES (?, ?, ?)');
  const removeNotice = connection.prepare('DELETE FROM notifications WHERE user_id = ? AND type = ?');
  const allStudentIds = connection.prepare(`SELECT id FROM users WHERE role = 'student'`);

  // Brings one student's notification in step with the engine. Returns the engine's result when
  // this call is the one that notified them, otherwise null.
  function checkStudent(studentId) {
    const result = engine.check(studentId);
    if (!result) return null; // the id isn't a student

    const alreadyNotified = Boolean(findNotice.get(studentId, ELIGIBLE));
    if (result.eligible && !alreadyNotified) {
      addNotice.run(studentId, ELIGIBLE, `You are now eligible for your ${result.nextRank} grading.`);
      return result;
    }
    if (!result.eligible && alreadyNotified) removeNotice.run(studentId, ELIGIBLE);
    return null;
  }

  // Checks several students. Returns the results for the ones who have just become eligible.
  function checkStudents(studentIds) {
    return studentIds.map(checkStudent).filter(Boolean);
  }

  function checkEveryone() {
    return checkStudents(allStudentIds.all().map((row) => row.id));
  }

  return { checkStudents, checkEveryone };
}
