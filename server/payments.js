import Stripe from 'stripe';

/** The Stripe Price for the registration fee is found by this lookup key. `npm run stripe:setup` creates it. */
export const REGISTRATION_LOOKUP_KEY = 'ask_registration_fee';

export class MissingPriceError extends Error {
  constructor() {
    super(`No active Stripe Price has the lookup key "${REGISTRATION_LOOKUP_KEY}". Run "npm run stripe:setup" to create it.`);
  }
}

/**
 * Stripe Checkout for the one-time registration fee, charged at the Price set up in Stripe.
 * Returns null when STRIPE_SECRET_KEY is not set, so the site still runs without payments.
 */
export function createPayments({ secretKey, publicUrl, stripe = secretKey ? new Stripe(secretKey) : null }) {
  if (!stripe) return null;

  let pricePromise = null;
  /** Looks the Price up once, and again later if that lookup failed. */
  function registrationPrice() {
    pricePromise ??= stripe.prices
      .list({ lookup_keys: [REGISTRATION_LOOKUP_KEY], active: true, limit: 1 })
      .then(({ data }) => {
        if (!data[0]) throw new MissingPriceError();
        return data[0];
      })
      .catch((err) => {
        pricePromise = null;
        throw err;
      });
    return pricePromise;
  }

  return {
    isTestMode: (secretKey ?? '').startsWith('sk_test_') || (secretKey ?? '').startsWith('rk_test_'),
    registrationPrice,

    async createCheckout(user) {
      const price = await registrationPrice();
      const session = await stripe.checkout.sessions.create({
        mode: 'payment',
        customer_email: user.email,
        client_reference_id: String(user.id),
        metadata: { userId: String(user.id) },
        line_items: [{ price: price.id, quantity: 1 }],
        success_url: `${publicUrl}/signup/complete?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${publicUrl}/account?payment=cancelled`,
      });
      return { id: session.id, url: session.url };
    },

    /** True when the Checkout session belongs to this user and paid in full for the registration Price. */
    async isPaid(sessionId, userId) {
      const session = await stripe.checkout.sessions.retrieve(sessionId, { expand: ['line_items'] });
      const priceId = (await registrationPrice()).id;
      return session.client_reference_id === String(userId)
        && session.payment_status === 'paid'
        && session.line_items?.data.some((item) => item.price?.id === priceId);
    },
  };
}
