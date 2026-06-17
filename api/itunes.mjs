// /api/itunes.mjs
// Server-side proxy for iTunes Search API.
// Avoids browser CORS restrictions and CSP issues with third-party proxies.
export const config = { runtime: 'edge' };

export default async function handler(req) {
  const { searchParams } = new URL(req.url);
  const q = searchParams.get('q');

  if (!q) {
    return new Response(JSON.stringify({ error: 'Missing q param' }), {
      status: 400,
      headers: { 'content-type': 'application/json' },
    });
  }

  const itunesUrl = `https://itunes.apple.com/search?term=${encodeURIComponent(q)}&media=music&entity=song&country=US&limit=5`;

  try {
    const resp = await fetch(itunesUrl, {
      headers: { 'User-Agent': 'SwipeDJ/1.0' },
    });
    const json = await resp.json();
    return new Response(JSON.stringify(json), {
      status: resp.status,
      headers: {
        'content-type': 'application/json',
        'cache-control': 'public, max-age=86400',
      },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: 'itunes_proxy_failed', detail: e.message }), {
      status: 500,
      headers: { 'content-type': 'application/json' },
    });
  }
}
