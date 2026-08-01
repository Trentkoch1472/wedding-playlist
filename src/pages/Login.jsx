import React, { useState } from 'react';
import { supabase } from '../lib/supabase';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [mode, setMode] = useState('login'); // 'login' | 'forgot' | 'sent'

  // Account type is derived from which profile table holds this user, not from
  // anything they select — one auth pool, so asking would be redundant and
  // a wrong pick would strand them on the other side of the app.
  async function routeForUser(userId) {
    const { data: dj } = await supabase
      .from('dj_profiles')
      .select('id')
      .eq('id', userId)
      .maybeSingle();

    window.location.replace(dj ? '/dj' : '/app');
  }

  async function handleLogin(e) {
    e.preventDefault();
    setError('');
    setLoading(true);

    const { data, error: signInError } = await supabase.auth.signInWithPassword({ email, password });

    if (signInError) {
      setLoading(false);
      setError(signInError.message || 'Could not sign in.');
      return;
    }

    await routeForUser(data.user.id);
  }

  async function handleForgot(e) {
    e.preventDefault();
    setError('');
    setLoading(true);

    const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: 'https://swipedj.app/reset-password',
    });
    setLoading(false);

    if (resetError) setError(resetError.message || 'Could not send reset email.');
    else setMode('sent');
  }

  const inp = {
    width: '100%', padding: '12px 14px', borderRadius: '10px',
    background: '#1C1C1E', border: '1px solid #2A2A2A', color: '#ffffff',
    fontSize: '15px', outline: 'none', boxSizing: 'border-box',
  };

  const btn = {
    marginTop: '4px', width: '100%', padding: '13px', borderRadius: '10px',
    border: 'none', cursor: loading ? 'not-allowed' : 'pointer',
    background: '#E8502A', color: '#ffffff', fontSize: '15px', fontWeight: 600,
    opacity: loading ? 0.7 : 1, transition: 'opacity 0.15s',
    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
  };

  const linkBtn = {
    background: 'none', border: 'none', color: '#888888',
    fontSize: '13px', cursor: 'pointer', padding: 0, marginTop: '16px',
    width: '100%', textAlign: 'center',
  };

  return (
    <div style={{ minHeight: '100vh', background: '#0D0D0D', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px' }}>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      <div style={{ width: '100%', maxWidth: '380px' }}>

        <div style={{ textAlign: 'center', marginBottom: '32px' }}>
          <a href="/">
            <img src="/swipeDJ logo.svg" alt="SwipeDJ" style={{ height: '28px' }} />
          </a>
        </div>

        <div style={{ background: '#1A1A1A', borderRadius: '16px', padding: '28px', border: '1px solid #2A2A2A' }}>

          {mode === 'sent' ? (
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '32px', marginBottom: '12px' }}>✉️</div>
              <h2 style={{ margin: '0 0 8px', fontSize: '17px', fontWeight: 700, color: '#ffffff' }}>Check your email</h2>
              <p style={{ margin: 0, fontSize: '13px', color: '#888888' }}>
                We sent a password reset link to {email}.
              </p>
              <button onClick={() => { setMode('login'); setError(''); }} style={linkBtn}>
                ← Back to log in
              </button>
            </div>
          ) : mode === 'forgot' ? (
            <>
              <h2 style={{ margin: '0 0 6px', fontSize: '17px', fontWeight: 700, color: '#ffffff' }}>Reset your password</h2>
              <p style={{ margin: '0 0 20px', fontSize: '13px', color: '#888888' }}>
                We'll email you a link to set a new one.
              </p>

              <form onSubmit={handleForgot} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <input
                  style={inp}
                  type="email"
                  placeholder="Email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  required
                  autoFocus
                />
                {error && <p style={{ fontSize: '13px', color: '#f87171', margin: 0 }}>{error}</p>}
                <button type="submit" disabled={loading} style={btn}>
                  {loading
                    ? <><div style={{ width: '16px', height: '16px', border: '2px solid rgba(255,255,255,0.3)', borderTopColor: '#fff', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} /> Sending…</>
                    : 'Send reset link'}
                </button>
              </form>

              <button onClick={() => { setMode('login'); setError(''); }} style={linkBtn}>
                ← Back to log in
              </button>
            </>
          ) : (
            <>
              <h2 style={{ margin: '0 0 6px', fontSize: '17px', fontWeight: 700, color: '#ffffff' }}>Log in</h2>
              <p style={{ margin: '0 0 20px', fontSize: '13px', color: '#888888' }}>
                We'll take you to the right place automatically.
              </p>

              <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <input
                  style={inp}
                  type="email"
                  placeholder="Email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  required
                  autoFocus
                />
                <input
                  style={inp}
                  type="password"
                  placeholder="Password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  required
                />
                {error && <p style={{ fontSize: '13px', color: '#f87171', margin: 0 }}>{error}</p>}
                <button type="submit" disabled={loading} style={btn}>
                  {loading
                    ? <><div style={{ width: '16px', height: '16px', border: '2px solid rgba(255,255,255,0.3)', borderTopColor: '#fff', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} /> Logging in…</>
                    : 'Log in'}
                </button>
              </form>

              <button onClick={() => { setMode('forgot'); setError(''); }} style={linkBtn}>
                Forgot your password?
              </button>

              <div style={{ marginTop: '20px', paddingTop: '16px', borderTop: '1px solid #2A2A2A', textAlign: 'center' }}>
                <span style={{ fontSize: '13px', color: '#888888' }}>Are you a DJ? </span>
                <a href="/for-djs" style={{ fontSize: '13px', color: '#E8502A', textDecoration: 'none', fontWeight: 600 }}>
                  Start here
                </a>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
