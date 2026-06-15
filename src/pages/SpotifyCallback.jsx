import React, { useEffect, useRef, useState } from 'react';

const TOKEN_PROXY      = '/api/spotify-token';
const SS_CODE_VERIFIER = 'sp_code_verifier';
const SS_AUTH_STATE    = 'sp_auth_state';
const SS_REDIRECT_URI  = 'sp_redirect_uri';
const LS_TOKEN         = 'sp_token_v2';

export default function SpotifyCallback() {
  const [status, setStatus] = useState('loading'); // 'loading' | 'error'
  const [errorMsg, setErrorMsg] = useState('');
  const ran = useRef(false); // strict-mode guard — exchange must fire exactly once

  useEffect(() => {
    if (ran.current) return;
    ran.current = true;

    const url    = new URL(window.location.href);
    const code   = url.searchParams.get('code');
    const state  = url.searchParams.get('state');
    const oauthError = url.searchParams.get('error');

    // Spotify reported an error
    if (oauthError) {
      setErrorMsg(`Spotify declined the connection: ${oauthError}`);
      setStatus('error');
      return;
    }

    // Missing code
    if (!code) {
      setErrorMsg('No authorization code in the callback URL.');
      setStatus('error');
      return;
    }

    // State mismatch — possible CSRF
    const expectedState = sessionStorage.getItem(SS_AUTH_STATE) || '';
    if (!state || state !== expectedState) {
      setErrorMsg('State mismatch — please try connecting Spotify again.');
      setStatus('error');
      return;
    }

    const verifier = sessionStorage.getItem(SS_CODE_VERIFIER);
    if (!verifier) {
      setErrorMsg('Missing PKCE verifier — please try connecting Spotify again.');
      setStatus('error');
      return;
    }

    // Use the redirect_uri that was stored when login started
    const storedRedirect = sessionStorage.getItem(SS_REDIRECT_URI);
    const clientId       = '7ced125c87d944d09bb2a301f8576fb8';
    const redirectUri    = storedRedirect && storedRedirect.startsWith(window.location.origin)
      ? storedRedirect
      : `${window.location.origin}/callback`;

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
          const detail = js.error_description || js.error || `HTTP ${r.status}`;
          console.error('[SpotifyCallback] token exchange failed:', js);
          throw new Error(detail);
        }

        const expAt = Date.now() + (js.expires_in || 3600) * 1000 - 60_000;
        localStorage.setItem(LS_TOKEN, JSON.stringify({
          accessToken:  js.access_token,
          refreshToken: js.refresh_token || null,
          expAt,
        }));

        // Clean up one-time sessionStorage entries
        sessionStorage.removeItem(SS_CODE_VERIFIER);
        sessionStorage.removeItem(SS_AUTH_STATE);
        sessionStorage.removeItem(SS_REDIRECT_URI);

        // Hard navigate — App needs to mount fresh and pick up the token from localStorage
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
        <p style={{ margin: 0, fontSize: '15px', color: '#f87171', textAlign: 'center', maxWidth: '340px' }}>
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
