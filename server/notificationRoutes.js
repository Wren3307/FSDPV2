// FP-11 notifications API: a logged-in user reads and dismisses their own notifications.
// The rows are written by notifications.js. Both routes use req.user.id, never an id from the
// request, so nobody can read or change another person's notifications.
import express from 'express';
import { loadUser } from './auth.js';

export function createNotificationRouter(connection) {
  const router = express.Router();
  const loggedIn = loadUser(connection);

  // Newest first. Twenty is plenty for the account page.
  const listForUser = connection.prepare(`
    SELECT id, type, message, created_at AS createdAt, read_at AS readAt
      FROM notifications
     WHERE user_id = ?
     ORDER BY id DESC
     LIMIT 20
  `);

  router.get('/me/notifications', loggedIn, (req, res) => {
    res.json(listForUser.all(req.user.id));
  });

  // "Dismiss" on the account page: everything the user hasn't read yet becomes read.
  const markAllRead = connection.prepare(`
    UPDATE notifications SET read_at = datetime('now') WHERE user_id = ? AND read_at IS NULL
  `);

  router.post('/me/notifications/read', loggedIn, (req, res) => {
    markAllRead.run(req.user.id);
    res.json({ ok: true });
  });

  return router;
}
