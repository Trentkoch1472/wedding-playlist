import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

export default function SetPassword() {
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [sessionReady, setSessionReady] = useState(false);
  const [expired, setExpired] = useState(false);

  // Invite links sign the user in automatically on arrival, so we watch for a
  // live session rather than the PASSWORD_RECOVERY event a reset link fires.
  useEffect(() => {
    let settled = false;

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        settled = true;
        setSessionReady(true);
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (session && (event === 'SIGNED_IN' || event === 'INITIAL_SESSION' || event === 'PASSWORD_RECOVERY')) {
        settled = true;
        setSessionReady(true);
      }
    });

    // Invite links are single-use — a second click lands here with no session.
    const timer = setTimeout(() => {
      if (!settled) setExpired(true);
    }, 3000);

    return () => {
      subscription.unsubscribe();
      clearTimeout(timer);
    };
  }, []);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');

    if (password.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }
    if (password !== confirm) {
      setError('Passwords do not match.');
      return;
    }

    setLoading(true);
    const { error: updateError } = await supabase.auth.updateUser({ password });
    setLoading(false);

    if (updateError) {
      setError(updateError.message || 'Could not set password. Try requesting a new link.');
    } else {
      setSuccess(true);
      setTimeout(() => {
        window.location.replace('/app');
      }, 2000);
    }
  }

  const inp = {
    width: '100%', padding: '12px 14px', borderRadius: '10px',
    background: '#1C1C1E', '--input-bg': '#1C1C1E', border: '1px solid #2A2A2A', color: '#ffffff',
    fontSize: '15px', outline: 'none', boxSizing: 'border-box',
  };

  return (
    <div style={{ minHeight: '100vh', background: '#0D0D0D', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px' }}>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      <div style={{ width: '100%', maxWidth: '380px' }}>

        <div style={{ textAlign: 'center', marginBottom: '32px' }}>
          <a href="/">
            <img src="/swipeDJ logo.svg" alt="SwipeDJ" style={{ height: '28px', marginBottom: '12px' }} />
          </a>
          <div style={{ fontSize: '13px', color: '#888888', letterSpacing: '0.08em', textTransform: 'uppercase', fontWeight: 600 }}>Spotify Export Unlocked</div>
        </div>

        <div style={{ background: '#1A1A1A', borderRadius: '16px', padding: '28px', border: '1px solid #2A2A2A' }}>

          {success ? (
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '32px', marginBottom: '12px' }}>✓</div>
              <h2 style={{ margin: '0 0 8px', fontSize: '17px', fontWeight: 700, color: '#ffffff' }}>You're all set</h2>
              <p style={{ margin: 0, fontSize: '13px', color: '#888888' }}>Taking you to your playlist…</p>
            </div>
          ) : expired ? (
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '32px', marginBottom: '12px' }}>⚠️</div>
              <h2 style={{ margin: '0 0 8px', fontSize: '17px', fontWeight: 700, color: '#ffffff' }}>Link expired</h2>
              <p style={{ margin: '0 0 20px', fontSize: '13px', color: '#888888' }}>
                This link has expired or has already been used.
              </p>
              <button
                onClick={() => window.location.replace('/dj/login')}
                style={{ width: '100%', padding: '13px', borderRadius: '10px', border: 'none', cursor: 'pointer', background: '#E8502A', color: '#ffffff', fontSize: '15px', fontWeight: 600 }}
              >
                Go to log in
              </button>
            </div>
          ) : !sessionReady ? (
            <div style={{ textAlign: 'center', padding: '16px 0' }}>
              <div style={{ width: '24px', height: '24px', border: '2px solid #2A2A2A', borderTopColor: '#E8502A', borderRadius: '50%', animation: 'spin 0.7s linear infinite', margin: '0 auto 12px' }} />
              <p style={{ margin: 0, fontSize: '13px', color: '#888888' }}>Verifying your link…</p>
            </div>
          ) : (
            <>
              <h2 style={{ margin: '0 0 6px', fontSize: '17px', fontWeight: 700, color: '#ffffff' }}>Set your password</h2>
              <p style={{ margin: '0 0 20px', fontSize: '13px', color: '#888888' }}>
                So you can access your unlock from any device. Must be at least 8 characters.
              </p>

              <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <input
                  style={inp}
                  type="password"
                  placeholder="Password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  required
                  autoFocus
                />
                <input
                  style={inp}
                  type="password"
                  placeholder="Confirm password"
                  value={confirm}
                  onChange={e => setConfirm(e.target.value)}
                  required
                />

                {error && <p style={{ fontSize: '13px', color: '#f87171', margin: 0 }}>{error}</p>}

                <button
                  type="submit"
                  disabled={loading}
                  style={{ marginTop: '4px', width: '100%', padding: '13px', borderRadius: '10px', border: 'none', cursor: loading ? 'not-allowed' : 'pointer', background: '#E8502A', color: '#ffffff', fontSize: '15px', fontWeight: 600, opacity: loading ? 0.7 : 1, transition: 'opacity 0.15s', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
                >
                  {loading
                    ? <><div style={{ width: '16px', height: '16px', border: '2px solid rgba(255,255,255,0.3)', borderTopColor: '#fff', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} /> Saving…</>
                    : 'Save password'
                  }
                </button>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
