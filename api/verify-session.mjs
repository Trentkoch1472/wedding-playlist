// api/verify-session.js
import Stripe from "stripe";

export default async function handler(req, res) {
  try {
    const { session_id } = req.query;
    if (!session_id) return res.status(400).json({ ok: false, error: "Missing session_id" });

    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
    const session = await stripe.checkout.sessions.retrieve(session_id, {
      expand: ["line_items.data.price"],
    });

    const paid = session.payment_status === "paid";
    const isSinglePayment = session.mode === "payment";
    const hasCorrectPrice =
      (session.line_items?.data?.[0]?.price?.id || "") === process.env.STRIPE_PRICE_ID;

    if (paid && isSinglePayment && hasCorrectPrice) {
      return res.status(200).json({ ok: true });
    }
    return res.status(200).json({ ok: false });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ ok: false, error: "Verification error" });
  }
}
