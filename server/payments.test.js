import assert from 'node:assert/strict';
import { test } from 'node:test';
import { MissingPriceError, REGISTRATION_LOOKUP_KEY, createPayments } from './payments.js';

/** A stand-in for the Stripe client with just the calls payments.js makes. */
function fakeStripe({ prices = [{ id: 'price_reg', unit_amount: 6000, currency: 'sgd' }], session = {} } = {}) {
  const calls = { list: 0, created: null };
  return {
    calls,
    prices: {
      list: async ({ lookup_keys: keys }) => {
        calls.list += 1;
        assert.deepEqual(keys, [REGISTRATION_LOOKUP_KEY]);
        return { data: prices };
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
  line_items: { data: [{ price: { id: 'price_reg' } }] },
  ...overrides,
});

test('checkout charges the registration Price looked up in Stripe', async () => {
  const stripe = fakeStripe();
  const payments = createPayments({ secretKey: 'sk_test_x', publicUrl: 'http://localhost:3100', stripe });
  const checkout = await payments.createCheckout(user);
  assert.equal(checkout.url, 'https://checkout.stripe.com/c/pay/cs_test_1');
  assert.deepEqual(stripe.calls.created.line_items, [{ price: 'price_reg', quantity: 1 }]);
  assert.equal(stripe.calls.created.client_reference_id, '7');
  assert.match(stripe.calls.created.success_url, /^http:\/\/localhost:3100\/signup\/complete\?session_id=\{CHECKOUT_SESSION_ID\}$/);

  await payments.createCheckout(user);
  assert.equal(stripe.calls.list, 1, 'the Price is looked up once and reused');
});

test('a missing Price gives a clear error, and is looked up again next time', async () => {
  const stripe = fakeStripe({ prices: [] });
  const payments = createPayments({ secretKey: 'sk_test_x', publicUrl: 'http://x', stripe });
  await assert.rejects(payments.createCheckout(user), MissingPriceError);
  await assert.rejects(payments.createCheckout(user), MissingPriceError);
  assert.equal(stripe.calls.list, 2);
});

test('a session counts as paid only for this user, paid in full, for the registration Price', async () => {
  const check = (session) => createPayments({ secretKey: 'sk_test_x', publicUrl: 'http://x', stripe: fakeStripe({ session }) }).isPaid('cs_test_1', 7);
  assert.equal(await check(paidSession()), true);
  assert.equal(await check(paidSession({ client_reference_id: '8' })), false);
  assert.equal(await check(paidSession({ payment_status: 'unpaid' })), false);
  assert.equal(await check(paidSession({ line_items: { data: [{ price: { id: 'price_other' } }] } })), false);
});

test('without a key there are no payments, and test keys are recognised', () => {
  assert.equal(createPayments({ secretKey: '', publicUrl: 'http://x' }), null);
  assert.equal(createPayments({ secretKey: 'sk_test_x', publicUrl: 'http://x', stripe: fakeStripe() }).isTestMode, true);
  assert.equal(createPayments({ secretKey: 'sk_live_x', publicUrl: 'http://x', stripe: fakeStripe() }).isTestMode, false);
});
