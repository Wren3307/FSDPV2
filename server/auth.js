// Auth stub for FP-7. Real login (passwords, sessions) is FP-1, so until then the
// client tells the API who it is with an X-User-Id header.

// TODO(FP-1): replace with real auth (verify a session or JWT and drop the header).
// Loads the acting user from the header and puts them on req.user.
export function loadUser(connection) {
  const findUser = connection.prepare('SELECT id, name, role, centre_id FROM users WHERE id = ?');

  return (req, res, next) => {
    const userId = Number(req.get('X-User-Id'));
    if (!Number.isInteger(userId) || userId <= 0) {
      return res.status(401).json({ error: 'Missing or invalid X-User-Id header' });
    }

    const user = findUser.get(userId);
    if (!user) return res.status(401).json({ error: 'Unknown user' });

    req.user = user;
    next();
  };
}

// 403 unless the acting user has one of the given roles. Keeping every role check in
// this one helper means FP-1's real auth only has to change how req.user gets set.
export function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'You do not have permission to do that' });
    }
    next();
  };
}
