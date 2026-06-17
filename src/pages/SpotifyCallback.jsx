import React, { useEffect, useRef, useState } from 'react';

const TOKEN_PROXY = '/api/spotify-token';
const LS_TOKEN    = 'sp_token_v2';

export default function SpotifyCallback() {
  const [status, setStatus] = useState('loading'); // 'loading' | 'error'
  const [errorMsg, setErrorMsg] = useState('');
  const ran = useRef(false); // strict-mode guard — exchange must fire exactly once

  useEffect(() => {
    if (ran.current) return;
    ran.current = true;

    const url        = new URL(window.location.href);
    const code       = url.searchParams.get('code');
    const state      = url.searchParams.get('state');
    const oauthError = url.searchParams.get('error');

    if (oauthError) {
      setErrorMsg(`Spotify declined the connection: ${oauthError}`);
      setStatus('error');
      return;
    }

    if (!code) {
      setErrorMsg('No authorization code in the callback URL.');
      setStatus('error');
      return;
    }

    // State format: "nonce.verifier" — the verifier is encoded directly in state
    // so no browser storage is needed. This survives Facebook auth popups/tabs,
    // Safari private mode, and any other context that clears sessionStorage/localStorage/cookies.
    if (!state || !state.includes('.')) {
      setErrorMsg(`Invalid state parameter: "${state}". Please try connecting Spotify again.`);
      setStatus('error');
      return;
    }

    const dotIdx  = state.indexOf('.');
    const verifier = state.slice(dotIdx + 1);

    if (!verifier || verifier.length < 40) {
      setErrorMsg('Malformed state — verifier missing. Please try connecting Spotify again.');
      setStatus('error');
      return;
    }

    const clientId   = '7ced125c87d944d09bb2a301f8576fb8';
    const redirectUri = 'https://swipedj.app/callback';

    async function exchange() {
      try {
        const body = new URLSearchParams({
          grant_type:    'authorization_code',
          code,
          redirect_uri:  redirectUri,
          client_id:     clientId,
          code_verifier: verifier,
        });

        const r  = await fetch(TOKEN_PROXY, {
          method:  'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body,
        });
        const js = await r.json();

        if (!r.ok || !js.access_token) {
          const detail = [js.error, js.error_description].filter(Boolean).join(' — ') || `HTTP ${r.status}`;
          throw new Error(detail);
        }

        const expAt = Date.now() + (js.expires_in || 3600) * 1000 - 60_000;
        localStorage.setItem(LS_TOKEN, JSON.stringify({
          accessToken:  js.access_token,
          refreshToken: js.refresh_token || null,
          expAt,
        }));

        window.location.replace('/app');

      } catch (e) {
        console.error('[SpotifyCallback] exchange error:', e);
        setErrorMsg(e.message || 'Token exchange failed.');
        setStatus('error');
      }
    }

    exchange();
  }, []);

  const containerStyle = {
    minHeight: '100vh',
    background: '#0D0D0D',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '16px',
    fontFamily: '-apple-system, BlinkMacSystemFont, "Inter", sans-serif',
    color: '#ffffff',
    padding: '24px',
  };

  if (status === 'error') {
    return (
      <div style={containerStyle}>
        <div style={{ fontSize: '32px' }}>⚠️</div>
        <p style={{ margin: 0, fontSize: '15px', color: '#f87171', textAlign: 'center', maxWidth: '340px', whiteSpace: 'pre-line' }}>
          {errorMsg}
        </p>
        <a
          href="/app"
          style={{ marginTop: '8px', fontSize: '14px', color: '#E8502A', textDecoration: 'none', fontWeight: 600 }}
        >
          ← Back to app
        </a>
      </div>
    );
  }

  return (
    <div style={containerStyle}>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      <div style={{ width: '28px', height: '28px', border: '2px solid #2A2A2A', borderTopColor: '#1DB954', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />
      <p style={{ margin: 0, fontSize: '15px', color: '#888888' }}>Connecting your Spotify…</p>
    </div>
  );
}
