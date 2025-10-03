// api/create-checkout-session.mjs
import Stripe from "stripe";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: "2022-11-15",
});

const ALLOWLIST = new Set([
  "https://swipetodance.trentkoch.com",
  "https://trentkoch1472.github.io",
  "http://localhost:3000",
  "http://127.0.0.1:3000",
]);

function setCors(res, origin) {
  if (ALLOWLIST.has(origin)) {
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Vary", "Origin");
  }
  res.setHeader("Access-Control-Allow-Credentials", "true");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
}

export default async function handler(req, res) {
  const origin = req.headers.origin || "";
  setCors(res, origin);

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  // Figure out where to send users back after Stripe
  const site =
    (req.query.site && decodeURIComponent(req.query.site)) ||
    process.env.SITE_URL ||
    (ALLOWLIST.has(origin) ? origin : "https://swipetodance.trentkoch.com");

  try {
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      line_items: [
        {
          price_data: {
            currency: "usd",
            unit_amount: 699, // $6.99 example
            product_data: {
              name: "Swipe to Dance — Pro",
              description: "Upload your own songs + export to Spotify",
            },
          },
          quantity: 1,
        },
      ],
      success_url: `${site}?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${site}?checkout=cancelled`,
    });

    // For navigation (no CORS) just 302 to Stripe
    if (req.method === "GET") {
      res.statusCode = 302;
      res.setHeader("Location", session.url);
      return res.end();
    }

    // For local dev POST usage
    if (req.method === "POST") {
      return res.status(200).json({ url: session.url });
    }

    return res.status(405).json({ error: "Method not allowed" });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: "create_session_failed" });
  }
}
