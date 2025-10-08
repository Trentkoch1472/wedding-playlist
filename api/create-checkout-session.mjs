// /api/create-checkout-session.mjs
import Stripe from 'stripe';

const CANONICAL_DOMAIN = process.env.SITE_URL || 'https://swipetodance.trentkoch.com';
const PRICE_ID = process.env.PRICE_ID;

export default async function handler(req, res) {
  // Add CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Initialize Stripe INSIDE the handler, not at module level
    const stripeKey = process.env.STRIPE_SECRET_KEY;
    
    if (!stripeKey) {
      throw new Error('Missing STRIPE_SECRET_KEY env var');
    }
    
    if (!PRICE_ID) {
      throw new Error('Missing PRICE_ID env var');
    }

    const stripe = new Stripe(stripeKey);

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