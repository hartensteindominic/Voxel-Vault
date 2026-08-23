import Stripe from 'stripe';

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', { apiVersion: '2025-07-30.basil' });

export async function createCheckoutSession(userId: string, email: string, priceId: string) {
  if (!process.env.STRIPE_SECRET_KEY || !priceId) throw new Error('Stripe is not configured');
  return stripe.checkout.sessions.create({ mode: 'subscription', customer_email: email, line_items: [{ price: priceId, quantity: 1 }], success_url: `${process.env.NEXT_PUBLIC_APP_URL}/dashboard?billing=success`, cancel_url: `${process.env.NEXT_PUBLIC_APP_URL}/pricing?billing=cancelled`, metadata: { userId }, allow_promotion_codes: true });
}