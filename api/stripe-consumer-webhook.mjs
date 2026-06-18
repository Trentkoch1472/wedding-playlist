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

async function sendUnlockEmail(email, setupLink) {
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: 'SwipeDJ <noreply@swipedj.app>',
      to: email,
      subject: 'Your Spotify export is unlocked 🎉',
      html: `
        <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:32px 16px">
          <img src="https://swipedj.app/swipeDJ logo.svg" alt="SwipeDJ" style="height:32px;margin-bottom:24px" />
          <h1 style="font-size:22px;font-weight:800;margin:0 0 12px">Your Spotify export is unlocked!</h1>
          <p style="color:#555;margin:0 0 24px">
            You can now export your wedding playlist directly to Spotify.
            Set a password to access your unlock from any device.
          </p>
          <a href="${setupLink}"
             style="display:inline-block;background:#E8502A;color:#fff;font-weight:700;
                    padding:14px 28px;border-radius:10px;text-decoration:none;font-size:15px">
            Set your password
          </a>
          <p style="color:#999;font-size:12px;margin-top:32px">
            If you didn't purchase this, you can ignore this email.
          </p>
        </div>
      `,
    }),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Resend error ${res.status}: ${body}`);
  }
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
    // Check if a Supabase auth user exists with this email
    const { data: { users } } = await supabase.auth.admin.listUsers({ page: 1, perPage: 1000 });
    const existing = users.find(u => u.email?.toLowerCase() === email.toLowerCase());

    let userId;

    if (existing) {
      userId = existing.id;
    } else {
      // Create a confirmed user — no password yet, they'll set one via the recovery link
      const { data: created, error: createErr } = await supabase.auth.admin.createUser({
        email,
        email_confirm: true,
      });
      if (createErr) throw createErr;
      userId = created.user.id;
    }

    // Upsert consumer_profiles row
    const { error: upsertErr } = await supabase.from('consumer_profiles').upsert(
      { user_id: userId, email: email.toLowerCase(), spotify_unlocked: true, stripe_customer_id: stripeCustomerId },
      { onConflict: 'email' }
    );
    if (upsertErr) throw upsertErr;

    // Generate a password-setup (recovery) link and email it
    const { data: linkData, error: linkErr } = await supabase.auth.admin.generateLink({
      type: 'recovery',
      email,
      options: { redirectTo: 'https://swipedj.app/app' },
    });
    if (linkErr) throw linkErr;

    await sendUnlockEmail(email, linkData.properties.action_link);

    return res.status(200).json({ received: true, userId });
  } catch (e) {
    console.error('Consumer webhook error:', e);
    return res.status(500).json({ error: e.message });
  }
}
