// /api/spotify-token.mjs
// Edge runtime proxy for Spotify token endpoint.
// Supports both public (PKCE) and confidential (client_secret) app types.
export const config = { runtime: 'edge' };

export default async function handler(req) {
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { 'content-type': 'application/json', 'allow': 'POST' },
    });
  }

  try {
    const bodyText = await req.text();

    const headers = { 'content-type': 'application/x-www-form-urlencoded' };

    // If a client secret is configured (confidential client), authenticate via
    // HTTP Basic Auth. Spotify requires this for apps that have a secret set,
    // even when using PKCE. Public/PKCE-only apps don't need this.
    const clientSecret = process.env.SPOTIFY_CLIENT_SECRET;
    if (clientSecret) {
      // Extract client_id from the forwarded body so we can build the credential
      const params = new URLSearchParams(bodyText);
      const clientId = params.get('client_id') || '';
      const credential = btoa(`${clientId}:${clientSecret}`);
      headers['authorization'] = `Basic ${credential}`;
    }

    const resp = await fetch('https://accounts.spotify.com/api/token', {
      method: 'POST',
      headers,
      body: bodyText,
    });

    const json = await resp.json();

    // Surface Spotify's error details in the response body for easier debugging
    return new Response(JSON.stringify(json), {
      status: resp.status,
      headers: { 'content-type': 'application/json' },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: 'proxy_failed', detail: e.message }), {
      status: 500,
      headers: { 'content-type': 'application/json' },
    });
  }
}
