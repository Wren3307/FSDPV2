// Creates the registration fee Product and Price in your Stripe account, or reuses them if they exist.
// Run with: npm run stripe:setup
// Uses STRIPE_SECRET_KEY from .env. Refuses a live key unless you add --live.
import { fileURLToPath } from 'node:url';
import Stripe from 'stripe';
import { REGISTRATION_LOOKUP_KEY } from '../server/payments.js';

const AMOUNT_CENTS = 6000;
const CURRENCY = 'sgd';
const PRODUCT_NAME = 'Aikido Shinju-Kai registration';
const PRODUCT_DESCRIPTION = 'One-time fee. Includes current-year membership, membership book and student handbook.';

try {
  process.loadEnvFile(fileURLToPath(new URL('../.env', import.meta.url)));
} catch {
  // No .env file; the key check below explains what to do.
}

const key = process.env.STRIPE_SECRET_KEY ?? '';
if (!key) {
  console.error('STRIPE_SECRET_KEY is empty. Paste your test secret key (sk_test_...) into .env, then run this again.');
  process.exit(1);
}
const isTest = key.startsWith('sk_test_') || key.startsWith('rk_test_');
if (!isTest && !process.argv.includes('--live')) {
  console.error('This is not a test key. To set up your LIVE account, run: npm run stripe:setup -- --live');
  process.exit(1);
}

const stripe = new Stripe(key);
const label = `${CURRENCY.toUpperCase()} ${(AMOUNT_CENTS / 100).toFixed(2)}`;

try {
  const { data: [existing] } = await stripe.prices.list({ lookup_keys: [REGISTRATION_LOOKUP_KEY], active: true, limit: 1, expand: ['data.product'] });

  if (existing && existing.unit_amount === AMOUNT_CENTS && existing.currency === CURRENCY) {
    console.log(`Already set up: "${existing.product.name}" at ${label} (${existing.id}). Nothing changed.`);
    process.exit(0);
  }

  // Reuse the product if a price already exists for it, so the dashboard keeps one product.
  const product = existing?.product ?? await stripe.products.create({
    name: PRODUCT_NAME,
    description: PRODUCT_DESCRIPTION,
    metadata: { site: 'aikido-shinju-kai' },
  });

  const price = await stripe.prices.create({
    product: product.id,
    unit_amount: AMOUNT_CENTS,
    currency: CURRENCY,
    lookup_key: REGISTRATION_LOOKUP_KEY,
    transfer_lookup_key: true, // moves the lookup key off any older price
    nickname: 'Registration fee',
  });
  if (existing) await stripe.prices.update(existing.id, { active: false });

  console.log(`${existing ? 'Updated' : 'Created'} "${product.name}" at ${label} (${price.id}) in ${isTest ? 'test' : 'LIVE'} mode.`);
} catch (err) {
  console.error(`Stripe refused the request: ${err.message}`);
  process.exit(1);
}
