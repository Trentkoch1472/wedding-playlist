// /api/spotify-token.js
// Edge runtime so we can parse x-www-form-urlencoded easily with the Web API
export const config = { runtime: 'edge' };

export default async function handler(req) {
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { 'content-type': 'application/json', 'allow': 'POST' },
    });
  }

  try {
    const bodyText = await req.text(); // forward exactly what the client sent
    const resp = await fetch('https://accounts.spotify.com/api/token', {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: bodyText,
    });

    const json = await resp.json();
    return new Response(JSON.stringify(json), {
      status: resp.status,
      headers: { 'content-type': 'application/json' },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: 'proxy_failed' }), {
      status: 500,
      headers: { 'content-type': 'application/json' },
    });
  }
}
