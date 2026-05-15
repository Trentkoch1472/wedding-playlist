import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';

const inp = {
  width: '100%', padding: '12px', borderRadius: '8px',
  background: '#0D0D0D', border: '1px solid #2C2C2E',
  color: '#ffffff', fontSize: '15px', outline: 'none',
  boxSizing: 'border-box',
};

export default function DJLogin() {
  const navigate = useNavigate();
  const [mode, setMode] = useState('signin'); // 'signin' | 'signup'
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      if (mode === 'signup') {
        const { data, error: signUpError } = await supabase.auth.signUp({ email, password });
        if (signUpError) throw signUpError;
        if (data.user) {
          await supabase.from('dj_profiles').insert({
            id: data.user.id,
            name: name || email.split('@')[0],
            email,
          });
        }
        navigate('/dj');
      } else {
        const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
        if (signInError) throw signInError;
        navigate('/dj');
      }
    } catch (err) {
      setError(err.message || 'Something went wrong');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ minHeight: '100vh', background: '#0D0D0D', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px' }}>
      <div style={{ width: '100%', maxWidth: '420px', background: '#1C1C1E', borderRadius: '16px', padding: '40px', border: '1px solid #2A2A2A' }}>
        <img src="/swipeDJ logo.svg" alt="SwipeDJ" style={{ height: '28px', marginBottom: '32px', display: 'block' }} />

        <h1 style={{ margin: '0 0 24px', fontSize: '20px', fontWeight: 700, color: '#ffffff' }}>
          {mode === 'signin' ? 'Sign in to your DJ account' : 'Create your DJ account'}
        </h1>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {mode === 'signup' && (
            <input
              style={inp}
              type="text"
              placeholder="Your name"
              value={name}
              onChange={e => setName(e.target.value)}
            />
          )}
          <input
            style={inp}
            type="email"
            placeholder="Email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            required
          />
          <input
            style={inp}
            type="password"
            placeholder="Password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            required
          />

          {error && (
            <p style={{ margin: 0, fontSize: '13px', color: '#f87171' }}>{error}</p>
          )}

          <button
            type="submit"
            disabled={loading}
            style={{
              marginTop: '8px', width: '100%', padding: '13px',
              borderRadius: '999px', border: 'none',
              background: '#E8502A', color: '#ffffff',
              fontSize: '15px', fontWeight: 600,
              cursor: loading ? 'not-allowed' : 'pointer',
              opacity: loading ? 0.7 : 1,
            }}
          >
            {loading ? 'Please wait…' : mode === 'signin' ? 'Sign in' : 'Create account'}
          </button>
        </form>

        <p style={{ margin: '20px 0 0', textAlign: 'center', fontSize: '14px', color: '#888888' }}>
          {mode === 'signin' ? "Don't have an account? " : 'Already have an account? '}
          <button
            onClick={() => { setMode(mode === 'signin' ? 'signup' : 'signin'); setError(''); }}
            style={{ background: 'none', border: 'none', color: '#E8502A', fontSize: '14px', fontWeight: 600, cursor: 'pointer', padding: 0 }}
          >
            {mode === 'signin' ? 'Create account' : 'Sign in'}
          </button>
        </p>
      </div>
    </div>
  );
}
