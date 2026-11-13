// FP-10 eligibility API. The rules themselves live in eligibility.js; this file only handles
// who may ask and which students to check.
import express from 'express';
import { loadUser, requireRole } from './auth.js';
import { createEligibilityEngine } from './eligibility.js';

export function createEligibilityRouter(connection) {
  const router = express.Router();
  const engine = createEligibilityEngine(connection);
  const staffOnly = [loadUser(connection), requireRole('instructor', 'admin')];

  // One student's result. Students may only see their own; instructors and admins can see anyone's.
  router.get('/students/:id/eligibility', loadUser(connection), (req, res) => {
    const studentId = Number(req.params.id);
    if (!Number.isInteger(studentId)) return res.status(400).json({ error: 'id must be a number' });
    if (req.user.role === 'student' && req.user.id !== studentId) {
      return res.status(403).json({ error: 'Students can only see their own eligibility' });
    }

    const result = engine.check(studentId);
    if (!result) return res.status(404).json({ error: 'Student not found' });
    res.json(result);
  });

  // Batch version for the staff view: every student, or just one centre's with ?centreId=.
  const studentsAt = connection.prepare(`
    SELECT u.id, c.name AS centre_name
      FROM users u
      LEFT JOIN centres c ON c.id = u.centre_id
     WHERE u.role = 'student'
       AND (:centreId IS NULL OR u.centre_id = :centreId)
     ORDER BY u.name
  `);

  router.get('/eligibility', ...staffOnly, (req, res) => {
    let centreId = null;
    if (req.query.centreId !== undefined && req.query.centreId !== '') {
      centreId = Number(req.query.centreId);
      if (!Number.isInteger(centreId)) return res.status(400).json({ error: 'centreId must be a number' });
    }

    const results = studentsAt.all({ centreId }).map((row) => ({
      ...engine.check(row.id),
      centreName: row.centre_name,
    }));
    res.json(results);
  });

  // The rules the engine checks against, shown on the eligibility screen so staff can see why.
  const allRules = connection.prepare(`
    SELECT gr.id, f.name AS fromRank, t.name AS toRank, gr.min_sessions AS minSessions,
           gr.min_months_in_rank AS minMonths, gr.counts_external AS countsExternal, gr.min_age AS minAge
      FROM grading_rules gr
      JOIN ranks f ON f.id = gr.from_rank_id
      JOIN ranks t ON t.id = gr.to_rank_id
     WHERE gr.active = 1
     ORDER BY f.sort_order
  `);
  router.get('/grading-rules', ...staffOnly, (req, res) => {
    // SQLite stores booleans as 0/1; send real true/false to the browser.
    res.json(allRules.all().map((rule) => ({ ...rule, countsExternal: rule.countsExternal === 1 })));
  });

  // Centre list for the screen's filter.
  const allCentres = connection.prepare('SELECT id, name FROM centres ORDER BY name');
  router.get('/centres', ...staffOnly, (req, res) => res.json(allCentres.all()));

  return router;
}
