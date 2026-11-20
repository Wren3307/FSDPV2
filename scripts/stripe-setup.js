// Creates the membership Products and Prices in your Stripe account, or reuses them if they exist.
//   joining: $60 first membership, which includes the one-time registration
//   renewal: $48 for each later year
// Run with: npm run stripe:setup
// Uses STRIPE_SECRET_KEY from .env. Refuses a live key unless you add --live.
import { fileURLToPath } from 'node:url';
import Stripe from 'stripe';
import { PLANS } from '../server/membership.js';
import { PRICE_LOOKUP_KEYS } from '../server/payments.js';

const CURRENCY = 'sgd';
const PRODUCTS = {
  joining: {
    name: 'Aikido Shinju-Kai membership with registration',
    description: 'First membership. Includes the one-time registration, membership to 31 December, membership book and student handbook.',
  },
  renewal: {
    name: 'Aikido Shinju-Kai annual membership',
    description: 'Membership renewal for one calendar year, to 31 December.',
  },
};

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

async function setUp(kind) {
  const lookupKey = PRICE_LOOKUP_KEYS[kind];
  const amount = PLANS[kind].amountCents;
  const label = `${CURRENCY.toUpperCase()} ${(amount / 100).toFixed(2)}`;
  const { data: [existing] } = await stripe.prices.list({ lookup_keys: [lookupKey], active: true, limit: 1, expand: ['data.product'] });

  if (existing && existing.unit_amount === amount && existing.currency === CURRENCY) {
    console.log(`Already set up: "${existing.product.name}" at ${label} (${existing.id}). Nothing changed.`);
    return;
  }

  // Reuse the product if a price already exists for it, so the dashboard keeps one product per kind.
  const product = existing?.product ?? await stripe.products.create({ ...PRODUCTS[kind], metadata: { site: 'aikido-shinju-kai', kind } });
  const price = await stripe.prices.create({
    product: product.id,
    unit_amount: amount,
    currency: CURRENCY,
    lookup_key: lookupKey,
    transfer_lookup_key: true, // moves the lookup key off any older price
    nickname: PLANS[kind].name,
  });
  if (existing) await stripe.prices.update(existing.id, { active: false });
  console.log(`${existing ? 'Updated' : 'Created'} "${product.name}" at ${label} (${price.id}) in ${isTest ? 'test' : 'LIVE'} mode.`);
}

try {
  await setUp('joining');
  await setUp('renewal');
} catch (err) {
  console.error(`Stripe refused the request: ${err.message}`);
  process.exit(1);
}
