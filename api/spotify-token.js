// /api/spotify-token.js
export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const body = await req.text(); // pass-thru x-www-form-urlencoded body

    const r = await fetch("https://accounts.spotify.com/api/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
    });

    const text = await r.text();
    // Forward Spotify’s status and body unmodified
    res.status(r.status).send(text);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "token proxy failed" });
  }
}
