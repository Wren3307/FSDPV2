// FP-10 grading eligibility engine.
//
// Worked out fresh every time it's asked (no cron, nothing stored), in four steps:
//   1. The student's current rank is their latest rank_history row (the current_ranks view).
//   2. The rule to check is the active grading_rules row whose from_rank_id is that rank.
//   3. Count sessions marked present or late since the rank was awarded. External sessions
//      (seminars, FP-8) only count when the rule's counts_external is 1.
//   4. Work out whole months in rank, and age when the rule has a min_age.
// The student is eligible only when every check is met.
//
// The result shape feeds FP-11, FP-12, FP-15 and the student progress bar, so keep it stable:
//   { studentId, studentName, currentRank, nextRank, eligible, reason, checks: [{ rule, required, actual, met }] }
import { today } from './dates.js';

// Whole calendar months from one YYYY-MM-DD date to another, e.g. 2026-01-31 -> 2026-03-30 is 1.
// A month only counts once the day of the month has been reached again.
export function wholeMonthsBetween(from, to) {
  const [y1, m1, d1] = from.split('-').map(Number);
  const [y2, m2, d2] = to.split('-').map(Number);
  return (y2 - y1) * 12 + (m2 - m1) - (d2 < d1 ? 1 : 0);
}

// Age in whole years is the same calculation in months, divided down.
export function ageOn(dateOfBirth, on) {
  return Math.floor(wholeMonthsBetween(dateOfBirth, on) / 12);
}

export function createEligibilityEngine(connection) {
  const findStudent = connection.prepare(
    `SELECT id, name, date_of_birth FROM users WHERE id = ? AND role = 'student'`,
  );
  const findCurrentRank = connection.prepare(
    'SELECT rank_id, rank_name, sort_order, rank_since FROM current_ranks WHERE student_id = ?',
  );
  const findRule = connection.prepare(`
    SELECT gr.min_sessions, gr.min_months_in_rank, gr.counts_external, gr.min_age, r.name AS next_rank
      FROM grading_rules gr
      JOIN ranks r ON r.id = gr.to_rank_id
     WHERE gr.from_rank_id = ? AND gr.active = 1
  `);
  const findHigherRank = connection.prepare('SELECT name FROM ranks WHERE sort_order > ? ORDER BY sort_order LIMIT 1');

  // Sessions that count towards the next grading. date <= :asOf leaves out sessions opened for a future day.
  const countSessions = connection.prepare(`
    SELECT COUNT(*) AS n
      FROM attendance a
      JOIN sessions s ON s.id = a.session_id
     WHERE a.student_id = :studentId
       AND a.status IN ('present', 'late')
       AND s.date >= :since
       AND s.date <= :asOf
       AND (s.type = 'regular' OR :countsExternal = 1)
  `);

  // Returns the eligibility result for one student, or null if the id isn't a student.
  function check(studentId, asOf = today()) {
    const student = findStudent.get(studentId);
    if (!student) return null;

    const result = {
      studentId: student.id,
      studentName: student.name,
      currentRank: null,
      nextRank: null,
      eligible: false,
      reason: null,
      checks: [],
    };

    // Step 1: current rank.
    const rank = findCurrentRank.get(student.id);
    if (!rank) {
      result.reason = 'No rank has been recorded for this student yet.';
      return result;
    }
    result.currentRank = rank.rank_name;

    // Step 2: the rule for moving up from that rank.
    const rule = findRule.get(rank.rank_id);
    if (!rule) {
      const higher = findHigherRank.get(rank.sort_order);
      result.nextRank = higher?.name ?? null;
      result.reason = higher
        ? `There is no active grading rule from ${rank.rank_name} yet.`
        : `${rank.rank_name} is the highest rank, so there is no next grading.`;
      return result;
    }
    result.nextRank = rule.next_rank;

    // Step 3: sessions since the rank was awarded.
    const sessions = countSessions.get({
      studentId: student.id,
      since: rank.rank_since,
      asOf,
      countsExternal: rule.counts_external,
    }).n;
    result.checks.push({
      rule: rule.counts_external ? 'Sessions since last grading (incl. external)' : 'Sessions since last grading',
      required: rule.min_sessions,
      actual: sessions,
      met: sessions >= rule.min_sessions,
    });

    // Step 4: time in rank, and age when the rule asks for it.
    const months = wholeMonthsBetween(rank.rank_since, asOf);
    result.checks.push({
      rule: 'Months in rank',
      required: rule.min_months_in_rank,
      actual: months,
      met: months >= rule.min_months_in_rank,
    });

    if (rule.min_age !== null) {
      // No date of birth on file means the age can't be confirmed, so the check isn't met.
      const age = student.date_of_birth ? ageOn(student.date_of_birth, asOf) : null;
      result.checks.push({ rule: 'Minimum age', required: rule.min_age, actual: age, met: age !== null && age >= rule.min_age });
    }

    result.eligible = result.checks.every((c) => c.met);
    return result;
  }

  return { check };
}
