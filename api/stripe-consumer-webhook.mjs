// /api/stripe-consumer-webhook.mjs
// Handles checkout.session.completed for the $14.99 consumer Spotify unlock.
import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';

export const config = { api: { bodyParser: false } };

const CONSUMER_PRICE_ID = 'price_1TXEEE9JXeoPRyDajkjZ0K5n';

function getRawBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', chunk => chunks.push(chunk));
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
  const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );

  const rawBody = await getRawBody(req);
  const sig = req.headers['stripe-signature'];

  let event;
  try {
    event = stripe.webhooks.constructEvent(rawBody, sig, process.env.STRIPE_CONSUMER_WEBHOOK_SECRET);
  } catch (e) {
    console.error('Consumer webhook signature error:', e.message);
    return res.status(400).json({ error: `Webhook signature failed: ${e.message}` });
  }

  if (event.type !== 'checkout.session.completed') {
    return res.status(200).json({ received: true });
  }

  const session = event.data.object;

  // Only handle the $14.99 consumer price
  const lineItems = await stripe.checkout.sessions.listLineItems(session.id, { limit: 5 });
  const isConsumerPurchase = lineItems.data.some(li => li.price?.id === CONSUMER_PRICE_ID);
  if (!isConsumerPurchase) {
    return res.status(200).json({ received: true, skipped: 'not consumer price' });
  }

  const email = session.customer_details?.email;
  const stripeCustomerId = session.customer;

  if (!email) {
    console.error('Consumer webhook: no email in session', session.id);
    return res.status(200).json({ received: true, warning: 'no email' });
  }

  try {
    // Check if a Supabase auth user already exists with this email
    const { data: { users } } = await supabase.auth.admin.listUsers({ page: 1, perPage: 1000 });
    const existing = users.find(u => u.email?.toLowerCase() === email.toLowerCase());

    let userId;

    if (existing) {
      // User already has an account — just unlock, no email needed
      userId = existing.id;
    } else {
      // New user — invite them. Supabase sends the email via its configured SMTP (Resend),
      // with a link to set their password. redirectTo sends them back to the app.
      const { data: invited, error: inviteErr } = await supabase.auth.admin.inviteUserByEmail(email, {
        redirectTo: 'https://swipedj.app/app',
        data: { spotify_unlocked: true },
      });
      if (inviteErr) throw inviteErr;
      userId = invited.user.id;
    }

    // Upsert consumer_profiles row
    const { error: upsertErr } = await supabase.from('consumer_profiles').upsert(
      {
        user_id: userId,
        email: email.toLowerCase(),
        spotify_unlocked: true,
        stripe_customer_id: stripeCustomerId,
      },
      { onConflict: 'email' }
    );
    if (upsertErr) throw upsertErr;

    return res.status(200).json({ received: true, userId, newUser: !existing });
  } catch (e) {
    console.error('Consumer webhook error:', e);
    return res.status(500).json({ error: e.message });
  }
}
