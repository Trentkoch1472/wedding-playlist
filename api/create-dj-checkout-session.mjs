// /api/create-dj-checkout-session.mjs
import Stripe from 'stripe';

const CANONICAL_DOMAIN = process.env.SITE_URL || 'https://swipedj.app';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { djId } = req.body;
    if (!djId) return res.status(400).json({ error: 'Missing djId' });

    const stripeKey = process.env.STRIPE_SECRET_KEY;
    const priceId = process.env.DJ_PRICE_ID;
    if (!stripeKey) throw new Error('Missing STRIPE_SECRET_KEY env var');
    if (!priceId) throw new Error('Missing DJ_PRICE_ID env var');

    const stripe = new Stripe(stripeKey);

    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      line_items: [{ price: priceId, quantity: 1 }],
      subscription_data: {
        trial_period_days: 14,
        metadata: { dj_id: djId },
      },
      metadata: { dj_id: djId },
      success_url: `${CANONICAL_DOMAIN}/dj?checkout=success`,
      cancel_url: `${CANONICAL_DOMAIN}/dj`,
    });

    return res.status(200).json({ url: session.url });
  } catch (e) {
    console.error('create-dj-checkout-session error:', e);
    return res.status(500).json({ error: 'server_error', details: String(e.message || e) });
  }
}
