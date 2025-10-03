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
  
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  try {
    // In Vercel, req.body is already a string if Content-Type is application/x-www-form-urlencoded
    const params = new URLSearchParams(req.body);
    
    const tokenBody = new URLSearchParams({
      grant_type: params.get('grant_type'),
      code: params.get('code'),
      redirect_uri: params.get('redirect_uri'),
      client_id: params.get('client_id'),
      code_verifier: params.get('code_verifier'),
      refresh_token: params.get('refresh_token'),
      client_secret: process.env.SPOTIFY_CLIENT_SECRET,
    });

    // Remove undefined/null values
    for (const [key, value] of [...tokenBody.entries()]) {
      if (!value || value === 'null' || value === 'undefined') {
        tokenBody.delete(key);
      }
    }

    const response = await fetch('https://accounts.spotify.com/api/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: tokenBody.toString(),
    });

    const data = await response.json();
    res.status(response.status).json(data);
  } catch (error) {
    console.error('Token exchange error:', error);
    res.status(500).json({ error: 'token_proxy_failed', details: error.message });
  }
}