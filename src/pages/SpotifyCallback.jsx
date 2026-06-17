import React, { useEffect, useRef, useState } from 'react';

const TOKEN_PROXY      = '/api/spotify-token';
const SS_CODE_VERIFIER = 'sp_code_verifier';
const SS_AUTH_STATE    = 'sp_auth_state';
const SS_REDIRECT_URI  = 'sp_redirect_uri';
const LS_TOKEN         = 'sp_token_v2';

function getCookie(name) {
  const m = document.cookie.match(new RegExp('(?:^|; )' + name + '=([^;]*)'));
  return m ? decodeURIComponent(m[1]) : null;
}
function deleteCookie(name) {
  document.cookie = `${name}=; Max-Age=0; Path=/`;
}

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
    // Try cookies first (most reliable in private/incognito — survive cross-origin redirects),
    // then fall back to sessionStorage and localStorage.
    const cookieState = getCookie(SS_AUTH_STATE);
    const ssState = sessionStorage.getItem(SS_AUTH_STATE);
    const lsState = localStorage.getItem(SS_AUTH_STATE);
    const expectedState = cookieState || ssState || lsState || '';
    console.log('[SpotifyCallback] state check', { urlState: state, cookieState, ssState, lsState, expectedState });
    if (!state || state !== expectedState) {
      setErrorMsg(`State mismatch\nURL state: "${state}"\nCookie: "${cookieState}"\nSessionStorage: "${ssState}"\nLocalStorage: "${lsState}"`);
      setStatus('error');
      return;
    }

    const verifier = getCookie(SS_CODE_VERIFIER) || sessionStorage.getItem(SS_CODE_VERIFIER) || localStorage.getItem(SS_CODE_VERIFIER);
    if (!verifier) {
      setErrorMsg('Missing PKCE verifier — please try connecting Spotify again.');
      setStatus('error');
      return;
    }

    const clientId    = '7ced125c87d944d09bb2a301f8576fb8';
    // redirect_uri in the token exchange MUST be byte-for-byte identical to
    // what was sent in the authorization request and registered in the Spotify dashboard.
    // We hardcode it to avoid any origin-mismatch surprises from sessionStorage.
    const redirectUri = 'https://swipedj.app/callback';
    console.log('[SpotifyCallback] using redirect_uri:', redirectUri);

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
          console.error('[SpotifyCallback] token exchange failed. redirect_uri sent:', redirectUri, 'Spotify response:', js);
          const detail = [js.error, js.error_description].filter(Boolean).join(' — ') || `HTTP ${r.status}`;
          throw new Error(`${detail}\n\nredirect_uri sent: ${redirectUri}`);
        }

        const expAt = Date.now() + (js.expires_in || 3600) * 1000 - 60_000;
        localStorage.setItem(LS_TOKEN, JSON.stringify({
          accessToken:  js.access_token,
          refreshToken: js.refresh_token || null,
          expAt,
        }));

        // Clean up one-time PKCE entries from all storage locations
        deleteCookie(SS_CODE_VERIFIER);
        deleteCookie(SS_AUTH_STATE);
        sessionStorage.removeItem(SS_CODE_VERIFIER);
        sessionStorage.removeItem(SS_AUTH_STATE);
        sessionStorage.removeItem(SS_REDIRECT_URI);
        localStorage.removeItem(SS_CODE_VERIFIER);
        localStorage.removeItem(SS_AUTH_STATE);

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
