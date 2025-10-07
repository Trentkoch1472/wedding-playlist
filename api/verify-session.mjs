import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

function setCors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
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
  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  try {
    const sid = req.query.session_id;
    if (!sid) {
      res.status(400).json({ ok: false, error: 'Missing session_id' });
      return;
    }

    const session = await stripe.checkout.sessions.retrieve(sid);
    const paid =
      session.payment_status === 'paid' ||
      session.status === 'complete' ||
      session.amount_total === session.amount_subtotal; // loose fallback

    res.status(200).json({ ok: !!paid });
  } catch (err) {
    console.error('verify-session error:', err);
    res.status(500).json({ ok: false, error: err.message || 'Server error' });
  }
}
