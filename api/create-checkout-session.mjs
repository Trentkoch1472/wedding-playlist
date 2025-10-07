// /api/create-checkout-session.js
const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);

const ALLOWED = new Set([
  "https://swipetodance.trentkoch.com",
  "http://localhost:3000",
  "http://127.0.0.1:3000",
  "https://trentkoch1472.github.io",
  "https://trentkoch1472.github.io/wedding-playlist"
]);
function setCORS(req, res) {
  const origin = req.headers.origin || "";
  if (ALLOWED.has(origin)) {
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Vary", "Origin");
  }
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
}

module.exports = async (req, res) => {
  try {
    setCORS(req, res);
    if (req.method === "OPTIONS") return res.status(204).end();
    if (req.method !== "GET" && req.method !== "POST") {
      return res.status(405).json({ error: "Method not allowed" });
    }

    const priceId = process.env.STRIPE_PRICE_ID || process.env.PRICE_ID;
    if (!process.env.STRIPE_SECRET_KEY || !priceId) {
      return res.status(500).json({
        error: "Server misconfigured",
        message: "Missing STRIPE_SECRET_KEY or STRIPE_PRICE_ID"
      });
    }

    const siteFromQuery = req.method === "GET" ? req.query.site : undefined;
    const siteFromBody = req.method === "POST" && req.body ? req.body.site : undefined;
    const origin = req.headers.origin || "";
    const site =
      siteFromQuery ||
      siteFromBody ||
      process.env.SITE_URL ||
      origin ||
      "https://swipetodance.trentkoch.com";

    const siteBase = String(site).replace(/\/$/, "");

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${siteBase}/?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${siteBase}/?canceled=1`,
      metadata: { app: "swipe-to-dance" }
    });

    if (req.method === "GET") {
      res.writeHead(302, { Location: session.url });
      return res.end();
    }
    return res.status(200).json({ url: session.url, id: session.id });
  } catch (e) {
    console.error("Stripe create session error:", e);
    return res.status(500).json({ error: "Stripe error", message: e.message || "unknown" });
  }
};
