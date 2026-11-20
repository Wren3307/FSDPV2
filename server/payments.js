import Stripe from 'stripe';

/**
 * The Stripe Price for each kind of membership is found by its lookup key, so no Price ids are copied
 * into settings. `npm run stripe:setup` creates both.
 *   joining: the first membership, $60, which includes the one-time registration
 *   renewal: each later year, $48
 */
export const PRICE_LOOKUP_KEYS = {
  joining: 'ask_registration_fee',
  renewal: 'ask_annual_membership',
};
export const REGISTRATION_LOOKUP_KEY = PRICE_LOOKUP_KEYS.joining;

export class MissingPriceError extends Error {
  constructor(lookupKey) {
    super(`No active Stripe Price has the lookup key "${lookupKey}". Run "npm run stripe:setup" to create it.`);
  }
}

/**
 * Stripe Checkout for membership, charged at the Prices set up in Stripe.
 * Returns null when STRIPE_SECRET_KEY is not set, so the site still runs without online payments.
 */
export function createPayments({ secretKey, publicUrl, stripe = secretKey ? new Stripe(secretKey) : null }) {
  if (!stripe) return null;

  const pricePromises = {};
  /** Looks a kind's Price up once, and again later if that lookup failed. */
  function priceFor(kind) {
    const lookupKey = PRICE_LOOKUP_KEYS[kind];
    if (!lookupKey) return Promise.reject(new Error(`Unknown membership kind "${kind}"`));
    pricePromises[kind] ??= stripe.prices
      .list({ lookup_keys: [lookupKey], active: true, limit: 1 })
      .then(({ data }) => {
        if (!data[0]) throw new MissingPriceError(lookupKey);
        return data[0];
      })
      .catch((err) => {
        delete pricePromises[kind];
        throw err;
      });
    return pricePromises[kind];
  }

  return {
    isTestMode: (secretKey ?? '').startsWith('sk_test_') || (secretKey ?? '').startsWith('rk_test_'),
    priceFor,

    /** Opens Checkout for one membership of the given kind ('joining' or 'renewal'). */
    async createCheckout(user, kind) {
      const price = await priceFor(kind);
      const session = await stripe.checkout.sessions.create({
        mode: 'payment',
        customer_email: user.email,
        client_reference_id: String(user.id),
        metadata: { userId: String(user.id), kind },
        line_items: [{ price: price.id, quantity: 1 }],
        success_url: `${publicUrl}/signup/complete?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${publicUrl}/account?payment=cancelled`,
      });
      return { id: session.id, url: session.url };
    },

    /**
     * What a Checkout session paid for, or null if it doesn't count: it must belong to this user,
     * be paid in full, and be for the membership Price its metadata names.
     */
    async paidMembership(sessionId, userId) {
      const session = await stripe.checkout.sessions.retrieve(sessionId, { expand: ['line_items'] });
      const kind = session.metadata?.kind ?? 'joining'; // sessions from before renewals were all 'joining'
      if (!PRICE_LOOKUP_KEYS[kind]) return null;
      const priceId = (await priceFor(kind)).id;
      const ok = session.client_reference_id === String(userId)
        && session.payment_status === 'paid'
        && session.line_items?.data.some((item) => item.price?.id === priceId);
      return ok ? { kind, amountCents: session.amount_total ?? null } : null;
    },
  };
}
