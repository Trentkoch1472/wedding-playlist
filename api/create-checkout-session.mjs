import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

function setCors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Cache-Control', 'no-store');
}

export default async function handler(req, res) {
  setCors(res);

  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return;
  }
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  try {
    const SITE_URL = process.env.SITE_URL || 'http://localhost:3000';
    const priceId = process.env.PRICE_ID; // optional, if you set one

    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      // If you have a Price, use line_items: [{ price: priceId, quantity: 1 }]
      line_items: priceId
        ? [{ price: priceId, quantity: 1 }]
        : [{
            price_data: {
              currency: 'usd',
              product_data: { name: 'Swipe to Dance — Pro (lifetime)' },
              unit_amount: 500, // $5.00
            },
            quantity: 1,
          }],
      success_url: `${SITE_URL}/?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${SITE_URL}/?canceled=1`,
      allow_promotion_codes: true,
    });

    res.status(200).json({ url: session.url });
  } catch (err) {
    console.error('create-checkout-session error:', err);
    res.status(500).json({ error: err.message || 'Server error' });
  }
}
