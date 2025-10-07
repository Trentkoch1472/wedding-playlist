// /api/verify-session.mjs
import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { session_id } = req.query || {};
  if (!session_id) return res.status(400).json({ ok: false, error: 'missing_session_id' });

  try {
    const session = await stripe.checkout.sessions.retrieve(session_id);
    const paid = session?.payment_status === 'paid';
    return res.status(200).json({ ok: !!paid });
  } catch (e) {
    console.error('verify-session error:', e);
    return res.status(200).json({ ok: false });
  }
}
