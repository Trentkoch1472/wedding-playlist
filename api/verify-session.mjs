// api/verify-session.mjs
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
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
}

export default async function handler(req, res) {
  const origin = req.headers.origin || "";
  setCors(res, origin);

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const sid = req.query.session_id;
    if (!sid) return res.status(400).json({ ok: false, error: "missing_session_id" });

    const session = await stripe.checkout.sessions.retrieve(sid);
    const paid =
      session?.payment_status === "paid" ||
      session?.status === "complete" ||
      session?.status === "paid";

    return res.status(200).json({ ok: !!paid });
  } catch (e) {
    console.error(e);
    return res.status(200).json({ ok: false });
  }
}
