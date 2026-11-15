// Test helper: logs in every seeded account and returns each one's session cookie by user id,
// so tests can call the API as "user 2" the way the demo seed describes.
import { DEMO_PASSWORD } from './seed.js';

export async function loginSeedUsers(base, db) {
  const users = db.connection.prepare('SELECT id, email, role FROM users').all();
  const cookies = {};
  for (const user of users) {
    const res = await fetch(`${base}/auth/login`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email: user.email, password: DEMO_PASSWORD, role: user.role }),
    });
    if (!res.ok) throw new Error(`Seed user ${user.id} could not log in: ${res.status}`);
    cookies[user.id] = res.headers.get('set-cookie').split(';')[0];
  }
  return cookies;
}
