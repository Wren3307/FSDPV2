import Stripe from 'stripe';

export const REGISTRATION_FEE_CENTS = 6000;

/**
 * Stripe Checkout for the one-time $60 registration fee.
 * Returns null when STRIPE_SECRET_KEY is not set, so the site still runs without payments.
 */
export function createPayments({ secretKey, publicUrl }) {
  if (!secretKey) return null;
  const stripe = new Stripe(secretKey);

  return {
    isTestMode: secretKey.startsWith('sk_test_'),

    async createCheckout(user) {
      const session = await stripe.checkout.sessions.create({
        mode: 'payment',
        customer_email: user.email,
        client_reference_id: String(user.id),
        metadata: { userId: String(user.id) },
        line_items: [{
          quantity: 1,
          price_data: {
            currency: 'sgd',
            unit_amount: REGISTRATION_FEE_CENTS,
            product_data: {
              name: 'Aikido Shinju-Kai registration',
              description: 'One-time fee. Includes current-year membership, membership book and student handbook.',
            },
          },
        }],
        success_url: `${publicUrl}/signup/complete?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${publicUrl}/account?payment=cancelled`,
      });
      return { id: session.id, url: session.url };
    },

    /** True when the Checkout session belongs to this user and the fee was paid in full. */
    async isPaid(sessionId, userId) {
      const session = await stripe.checkout.sessions.retrieve(sessionId);
      return session.client_reference_id === String(userId)
        && session.payment_status === 'paid'
        && session.amount_total === REGISTRATION_FEE_CENTS
        && session.currency === 'sgd';
    },
  };
}
