import { createServer as createHttpServer } from 'node:http';
import { fileURLToPath } from 'node:url';
import express from 'express';
import helmet from 'helmet';
import { createApi, ensureAdmin } from './app.js';
import { openDatabase } from './db.js';
import { createPayments } from './payments.js';

const root = fileURLToPath(new URL('..', import.meta.url));

try {
  process.loadEnvFile(`${root}.env`);
} catch {
  // No .env file: fall back to the defaults below.
}

const isProduction = process.env.NODE_ENV === 'production';
const port = Number(process.env.PORT ?? 3000);
const publicUrl = (process.env.PUBLIC_URL ?? `http://localhost:${port}`).replace(/\/$/, '');
const adminPath = process.env.VITE_ADMIN_PATH;
const db = openDatabase(process.env.DATABASE_PATH ?? `${root}storage/enquiries.db`);

if (await ensureAdmin(db, { email: process.env.ADMIN_EMAIL, password: process.env.ADMIN_PASSWORD })) {
  console.log(`Created the admin account for ${process.env.ADMIN_EMAIL}`);
}

const payments = createPayments({ secretKey: process.env.STRIPE_SECRET_KEY, publicUrl });
if (!payments) console.warn('STRIPE_SECRET_KEY is not set, so member sign-up is switched off.');
else if (!payments.isTestMode) console.warn('Stripe is using a LIVE key: sign-ups will take real payments.');

const app = express();
const httpServer = createHttpServer(app);
app.disable('x-powered-by');
// Set TRUST_PROXY=1 when hosted behind one proxy, so rate limits see the visitor's real address.
if (process.env.TRUST_PROXY) app.set('trust proxy', Number(process.env.TRUST_PROXY));

app.use(helmet({
  // Vite's dev server injects inline scripts, so the content policy only applies in production.
  contentSecurityPolicy: isProduction
    ? { directives: { 'upgrade-insecure-requests': null } }
    : false,
  strictTransportSecurity: isProduction,
}));

// Keep the hidden admin page out of search engines.
if (adminPath) {
  app.use(adminPath, (_req, res, next) => {
    res.set('X-Robots-Tag', 'noindex, nofollow');
    next();
  });
}

app.use('/api', createApi({ db, payments, secureCookies: publicUrl.startsWith('https://') }));

if (isProduction) {
  const dist = `${root}dist`;
  app.use(express.static(dist, { maxAge: '1h' }));
  app.get(/.*/, (_req, res) => res.sendFile(`${dist}/index.html`));
} else {
  const { createServer } = await import('vite');
  const vite = await createServer({ root, server: { middlewareMode: true, hmr: { server: httpServer } }, appType: 'spa' });
  app.use(vite.middlewares);
}

httpServer.listen(port, () => console.log(`Aikido Shinju-Kai site running at http://localhost:${port}`));
