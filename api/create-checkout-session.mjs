// /api/create-checkout-session.mjs
import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
const CANONICAL_DOMAIN = process.env.SITE_URL || 'https://swipetodance.trentkoch.com';
const PRICE_ID = process.env.PRICE_ID;

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    if (!PRICE_ID) throw new Error('Missing PRICE_ID env var');

    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      line_items: [{ price: PRICE_ID, quantity: 1 }],
      success_url: `${CANONICAL_DOMAIN}/?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${CANONICAL_DOMAIN}/?canceled=1`,
    });

    return res.status(200).json({ url: session.url });
  } catch (e) {
    console.error('create-checkout-session error:', e);
    return res.status(500).json({ error: 'server_error', details: String(e.message || e) });
  }
}
