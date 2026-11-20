import assert from 'node:assert/strict';
import { test } from 'node:test';
import { MissingPriceError, PRICE_LOOKUP_KEYS, createPayments } from './payments.js';

const PRICES = {
  [PRICE_LOOKUP_KEYS.joining]: { id: 'price_join', unit_amount: 6000, currency: 'sgd' },
  [PRICE_LOOKUP_KEYS.renewal]: { id: 'price_renew', unit_amount: 4800, currency: 'sgd' },
};

/** A stand-in for the Stripe client with just the calls payments.js makes. */
function fakeStripe({ prices = PRICES, session = {} } = {}) {
  const calls = { list: 0, created: null };
  return {
    calls,
    prices: {
      list: async ({ lookup_keys: [key] }) => {
        calls.list += 1;
        return { data: prices[key] ? [prices[key]] : [] };
      },
    },
    checkout: {
      sessions: {
        create: async (params) => { calls.created = params; return { id: 'cs_test_1', url: 'https://checkout.stripe.com/c/pay/cs_test_1' }; },
        retrieve: async () => session,
      },
    },
  };
}

const user = { id: 7, email: 'mei@example.com' };
const paidSession = (overrides = {}) => ({
  client_reference_id: '7',
  payment_status: 'paid',
  amount_total: 6000,
  metadata: { kind: 'joining' },
  line_items: { data: [{ price: { id: 'price_join' } }] },
  ...overrides,
});

test('checkout charges the Price for the kind of membership, looked up in Stripe', async () => {
  const stripe = fakeStripe();
  const payments = createPayments({ secretKey: 'sk_test_x', publicUrl: 'http://localhost:3100', stripe });
  const checkout = await payments.createCheckout(user, 'joining');
  assert.equal(checkout.url, 'https://checkout.stripe.com/c/pay/cs_test_1');
  assert.deepEqual(stripe.calls.created.line_items, [{ price: 'price_join', quantity: 1 }]);
  assert.equal(stripe.calls.created.client_reference_id, '7');
  assert.equal(stripe.calls.created.metadata.kind, 'joining');
  assert.match(stripe.calls.created.success_url, /^http:\/\/localhost:3100\/signup\/complete\?session_id=\{CHECKOUT_SESSION_ID\}$/);

  await payments.createCheckout(user, 'joining');
  assert.equal(stripe.calls.list, 1, 'the Price is looked up once and reused');

  await payments.createCheckout(user, 'renewal');
  assert.deepEqual(stripe.calls.created.line_items, [{ price: 'price_renew', quantity: 1 }]);
});

test('a missing Price gives a clear error, and is looked up again next time', async () => {
  const stripe = fakeStripe({ prices: {} });
  const payments = createPayments({ secretKey: 'sk_test_x', publicUrl: 'http://x', stripe });
  await assert.rejects(payments.createCheckout(user, 'renewal'), MissingPriceError);
  await assert.rejects(payments.createCheckout(user, 'renewal'), MissingPriceError);
  assert.equal(stripe.calls.list, 2);
});

test('a session counts only for this user, paid in full, for the Price of the kind it names', async () => {
  const check = (session) => createPayments({ secretKey: 'sk_test_x', publicUrl: 'http://x', stripe: fakeStripe({ session }) })
    .paidMembership('cs_test_1', 7);
  assert.deepEqual(await check(paidSession()), { kind: 'joining', amountCents: 6000 });
  assert.deepEqual(
    await check(paidSession({ metadata: { kind: 'renewal' }, amount_total: 4800, line_items: { data: [{ price: { id: 'price_renew' } }] } })),
    { kind: 'renewal', amountCents: 4800 },
  );
  assert.equal(await check(paidSession({ client_reference_id: '8' })), null);
  assert.equal(await check(paidSession({ payment_status: 'unpaid' })), null);
  assert.equal(await check(paidSession({ line_items: { data: [{ price: { id: 'price_other' } }] } })), null);
  // Claiming to be a renewal while paying the joining Price doesn't count.
  assert.equal(await check(paidSession({ metadata: { kind: 'renewal' } })), null);
});

test('without a key there are no payments, and test keys are recognised', () => {
  assert.equal(createPayments({ secretKey: '', publicUrl: 'http://x' }), null);
  assert.equal(createPayments({ secretKey: 'sk_test_x', publicUrl: 'http://x', stripe: fakeStripe() }).isTestMode, true);
  assert.equal(createPayments({ secretKey: 'sk_live_x', publicUrl: 'http://x', stripe: fakeStripe() }).isTestMode, false);
});
