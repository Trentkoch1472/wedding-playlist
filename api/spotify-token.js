// /api/spotify-token.js
const ALLOWED_ORIGINS = [
  "https://wedding-playlist-zeta.vercel.app",
  "https://swipetodance.trentkoch.com",
  "https://trentkoch1472.github.io"
];

function allowOrigin(req) {
  const o = req.headers.origin || "";
  return ALLOWED_ORIGINS.includes(o) ? o : ALLOWED_ORIGINS[0];
}

export default async function handler(req, res) {
  // Add CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  // Handle OPTIONS request for CORS preflight
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }
  
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  try {
    // pass-thru x-www-form-urlencoded body to Spotify
    const body = await req.text();

    const r = await fetch("https://accounts.spotify.com/api/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body
    });

    const text = await r.text();          // forward Spotify JSON as-is
    res.status(r.status).send(text);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "token proxy failed" });
  }
}
