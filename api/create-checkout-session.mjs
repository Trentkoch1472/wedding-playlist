// api/create-checkout-session.mjs
import Stripe from "stripe";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    // Guardrails: make sure envs exist
    if (!process.env.STRIPE_SECRET_KEY || !process.env.STRIPE_PRICE_ID) {
      return res.status(500).json({ error: "Missing Stripe env vars" });
    }

    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

    // Prefer SITE_URL; otherwise fall back to the actual request host/proto.
    // This guarantees a full URL with http/https for Stripe.
    const siteUrl =
      process.env.SITE_URL ||
      `${req.headers["x-forwarded-proto"] || "http"}://${req.headers.host}`;

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      line_items: [{ price: process.env.STRIPE_PRICE_ID, quantity: 1 }],
      allow_promotion_codes: true,
      success_url: `${siteUrl}/?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${siteUrl}/?canceled=1`,
    });

    return res.status(200).json({ url: session.url });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: "Failed to create checkout session" });
  }
}
