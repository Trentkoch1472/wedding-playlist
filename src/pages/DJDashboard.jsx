import React, { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

/* ─── helpers ─────────────────────────────────────────────── */
function fmt(dateStr) {
  if (!dateStr) return '—';
  return new Date(dateStr + 'T00:00:00').toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
  });
}

function statusColor(status) {
  switch (status) {
    case 'active':   return { background: '#1a3a1a', color: '#4ade80', border: '1px solid #166534' };
    case 'invited':  return { background: '#1a2a3a', color: '#60a5fa', border: '1px solid #1e40af' };
    case 'complete': return { background: '#2a2a1a', color: '#fbbf24', border: '1px solid #92400e' };
    default:         return { background: '#1C1C1E', color: '#888888', border: '1px solid #2A2A2A' };
  }
}

/* ─── sub-components ──────────────────────────────────────── */
function Pill({ status }) {
  const s = statusColor(status);
  return (
    <span style={{ ...s, fontSize: '11px', fontWeight: 600, padding: '3px 10px', borderRadius: '999px', letterSpacing: '0.04em', textTransform: 'uppercase' }}>
      {status}
    </span>
  );
}

function Stat({ label, value }) {
  return (
    <div style={{ flex: 1, background: '#1A1A1A', borderRadius: '12px', padding: '16px', border: '1px solid #2A2A2A' }}>
      <div style={{ fontSize: '28px', fontWeight: 700, color: '#ffffff', lineHeight: 1 }}>{value}</div>
      <div style={{ fontSize: '12px', color: '#888888', marginTop: '6px' }}>{label}</div>
    </div>
  );
}

/* ─── Auth screen ─────────────────────────────────────────── */
function AuthScreen({ onAuth }) {
  const [mode, setMode] = useState('login'); // 'login' | 'signup'
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState('');

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setSuccess('');
    setLoading(true);

    try {
      if (mode === 'signup') {
        const { data, error: signUpError } = await supabase.auth.signUp({ email, password });
        if (signUpError) throw signUpError;
        if (data.user) {
          await supabase.from('dj_profiles').upsert({
            id: data.user.id,
            email,
            name: name || email.split('@')[0],
          });
        }
        setSuccess('Check your email to confirm your account, then log in.');
      } else {
        const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
        if (signInError) throw signInError;
        onAuth();
      }
    } catch (err) {
      setError(err.message || 'Something went wrong');
    } finally {
      setLoading(false);
    }
  }

  const inp = {
    width: '100%', padding: '12px 14px', borderRadius: '10px',
    background: '#1C1C1E', border: '1px solid #2A2A2A', color: '#ffffff',
    fontSize: '15px', outline: 'none', boxSizing: 'border-box',
  };

  return (
    <div style={{ minHeight: '100vh', background: '#0D0D0D', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px' }}>
      <div style={{ width: '100%', maxWidth: '380px' }}>
        <div style={{ textAlign: 'center', marginBottom: '32px' }}>
          <img src="/swipeDJ logo.svg" alt="SwipeDJ" style={{ height: '28px', marginBottom: '12px' }} />
          <div style={{ fontSize: '13px', color: '#888888', letterSpacing: '0.08em', textTransform: 'uppercase', fontWeight: 600 }}>DJ Dashboard</div>
        </div>

        <div style={{ background: '#1A1A1A', borderRadius: '16px', padding: '28px', border: '1px solid #2A2A2A' }}>
          <div style={{ display: 'flex', marginBottom: '24px', background: '#0D0D0D', borderRadius: '10px', padding: '4px' }}>
            {['login', 'signup'].map(m => (
              <button key={m} onClick={() => { setMode(m); setError(''); setSuccess(''); }}
                style={{ flex: 1, padding: '8px', borderRadius: '8px', border: 'none', cursor: 'pointer', fontSize: '14px', fontWeight: 600, transition: 'all 0.15s',
                  background: mode === m ? '#2A2A2A' : 'transparent',
                  color: mode === m ? '#ffffff' : '#888888',
                }}>
                {m === 'login' ? 'Log in' : 'Sign up'}
              </button>
            ))}
          </div>

          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {mode === 'signup' && (
              <input style={inp} type="text" placeholder="Your name" value={name} onChange={e => setName(e.target.value)} />
            )}
            <input style={inp} type="email" placeholder="Email" value={email} onChange={e => setEmail(e.target.value)} required />
            <input style={inp} type="password" placeholder="Password" value={password} onChange={e => setPassword(e.target.value)} required />

            {error && <p style={{ fontSize: '13px', color: '#f87171', margin: 0 }}>{error}</p>}
            {success && <p style={{ fontSize: '13px', color: '#4ade80', margin: 0 }}>{success}</p>}

            <button type="submit" disabled={loading}
              style={{ marginTop: '4px', width: '100%', padding: '13px', borderRadius: '10px', border: 'none', cursor: loading ? 'not-allowed' : 'pointer',
                background: '#E8502A', color: '#ffffff', fontSize: '15px', fontWeight: 600, opacity: loading ? 0.7 : 1, transition: 'opacity 0.15s',
              }}>
              {loading ? 'Please wait…' : mode === 'login' ? 'Log in' : 'Create account'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

/* ─── Add Client Modal ────────────────────────────────────── */
function AddClientModal({ djId, onClose, onAdded }) {
  const [p1, setP1] = useState('');
  const [p2, setP2] = useState('');
  const [date, setDate] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e) {
    e.preventDefault();
    if (!p1) { setError('Partner 1 name is required'); return; }
    setLoading(true);
    const { data, error: err } = await supabase.from('clients').insert({
      dj_id: djId,
      partner_1_name: p1,
      partner_2_name: p2 || null,
      wedding_date: date || null,
      status: 'invited',
    }).select().single();
    setLoading(false);
    if (err) { setError(err.message); return; }
    onAdded(data);
  }

  const inp = {
    width: '100%', padding: '11px 14px', borderRadius: '10px',
    background: '#0D0D0D', border: '1px solid #2A2A2A', color: '#ffffff',
    fontSize: '15px', outline: 'none', boxSizing: 'border-box',
  };

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px' }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div style={{ width: '100%', maxWidth: '400px', background: '#1A1A1A', borderRadius: '16px', padding: '28px', border: '1px solid #2A2A2A' }}>
        <h2 style={{ margin: '0 0 20px', fontSize: '18px', fontWeight: 700, color: '#ffffff' }}>Add client couple</h2>
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <input style={inp} type="text" placeholder="Partner 1 name *" value={p1} onChange={e => setP1(e.target.value)} required />
          <input style={inp} type="text" placeholder="Partner 2 name" value={p2} onChange={e => setP2(e.target.value)} />
          <input style={{ ...inp, colorScheme: 'dark' }} type="date" value={date} onChange={e => setDate(e.target.value)} />
          {error && <p style={{ fontSize: '13px', color: '#f87171', margin: 0 }}>{error}</p>}
          <div style={{ display: 'flex', gap: '10px', marginTop: '4px' }}>
            <button type="button" onClick={onClose}
              style={{ flex: 1, padding: '12px', borderRadius: '10px', border: '1px solid #2A2A2A', background: 'none', color: '#888888', fontSize: '14px', fontWeight: 600, cursor: 'pointer' }}>
              Cancel
            </button>
            <button type="submit" disabled={loading}
              style={{ flex: 2, padding: '12px', borderRadius: '10px', border: 'none', background: '#E8502A', color: '#ffffff', fontSize: '14px', fontWeight: 600, cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.7 : 1 }}>
              {loading ? 'Adding…' : 'Add couple'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

/* ─── Client Detail ───────────────────────────────────────── */
function ClientDetail({ client, onBack }) {
  const [songs, setSongs] = useState([]);
  const [loading, setLoading] = useState(true);
  const inviteUrl = `${window.location.origin}/app?client=${client.invite_token}`;

  useEffect(() => {
    supabase.from('client_songs')
      .select('*')
      .eq('client_id', client.id)
      .order('saved_at', { ascending: false })
      .then(({ data }) => { setSongs(data || []); setLoading(false); });
  }, [client.id]);

  function copyInvite() {
    navigator.clipboard.writeText(inviteUrl).catch(() => {});
  }

  const mustHaves = songs.filter(s => s.decision === 'must_have');
  const yesSongs  = songs.filter(s => s.decision === 'yes' || !s.decision);
  const noSongs   = songs.filter(s => s.decision === 'no');

  function SongRow({ song, index, total, titleStyle }) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 16px', borderBottom: index < total - 1 ? '1px solid #2A2A2A' : 'none' }}>
        {song.album_art_url
          ? <img src={song.album_art_url} alt="" style={{ width: '40px', height: '40px', borderRadius: '6px', objectFit: 'cover', flexShrink: 0 }} />
          : <div style={{ width: '40px', height: '40px', borderRadius: '6px', background: '#2A2A2A', flexShrink: 0 }} />
        }
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: '14px', fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', ...titleStyle }}>{song.title}</div>
          <div style={{ fontSize: '12px', color: '#888888', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{song.artist}</div>
        </div>
      </div>
    );
  }

  function SongSection({ label, accentColor, songs: list, titleStyle, emptyMsg }) {
    return (
      <div style={{ marginBottom: '24px' }}>
        <div style={{ fontSize: '11px', fontWeight: 600, color: accentColor, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: '8px' }}>
          {label} ({list.length})
        </div>
        {list.length === 0
          ? <div style={{ background: '#1A1A1A', border: '1px solid #2A2A2A', borderRadius: '12px', padding: '16px', color: '#555555', fontSize: '13px', textAlign: 'center' }}>{emptyMsg}</div>
          : (
            <div style={{ background: '#1A1A1A', border: '1px solid #2A2A2A', borderRadius: '12px', overflow: 'hidden' }}>
              {list.map((song, i) => (
                <SongRow key={song.id} song={song} index={i} total={list.length} titleStyle={titleStyle} />
              ))}
            </div>
          )
        }
      </div>
    );
  }

  return (
    <div style={{ maxWidth: '720px', margin: '0 auto', padding: '24px 16px' }}>
      <button onClick={onBack}
        style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', background: 'none', border: 'none', color: '#888888', fontSize: '14px', cursor: 'pointer', padding: 0, marginBottom: '24px' }}>
        ← Back to clients
      </button>

      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '16px', flexWrap: 'wrap', marginBottom: '24px' }}>
        <div>
          <h1 style={{ margin: '0 0 4px', fontSize: '24px', fontWeight: 700, color: '#ffffff' }}>
            {client.partner_1_name}{client.partner_2_name ? ` & ${client.partner_2_name}` : ''}
          </h1>
          <div style={{ fontSize: '14px', color: '#888888' }}>{fmt(client.wedding_date)}</div>
        </div>
        <Pill status={client.status} />
      </div>

      {/* Invite link */}
      <div style={{ background: '#1A1A1A', border: '1px solid #2A2A2A', borderRadius: '12px', padding: '16px', marginBottom: '24px' }}>
        <div style={{ fontSize: '11px', fontWeight: 600, color: '#888888', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: '8px' }}>Client invite link</div>
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          <code style={{ flex: 1, fontSize: '12px', color: '#a8a29e', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', background: '#0D0D0D', padding: '8px 12px', borderRadius: '8px', border: '1px solid #2A2A2A' }}>
            {inviteUrl}
          </code>
          <button onClick={copyInvite}
            style={{ padding: '8px 14px', borderRadius: '8px', border: 'none', background: '#E8502A', color: '#ffffff', fontSize: '13px', fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap' }}>
            Copy
          </button>
        </div>
      </div>

      {loading && <div style={{ color: '#888888', fontSize: '14px' }}>Loading…</div>}

      {!loading && songs.length === 0 && (
        <div style={{ background: '#1A1A1A', border: '1px solid #2A2A2A', borderRadius: '12px', padding: '32px', textAlign: 'center', color: '#888888', fontSize: '14px' }}>
          No songs yet — share the invite link so your couple can start swiping.
        </div>
      )}

      {!loading && songs.length > 0 && (
        <>
          <SongSection
            label="⭐ Must Haves"
            accentColor="#F0A030"
            songs={mustHaves}
            titleStyle={{ color: '#ffffff' }}
            emptyMsg="No must-haves yet"
          />
          <SongSection
            label="Playlist"
            accentColor="#888888"
            songs={yesSongs}
            titleStyle={{ color: '#ffffff' }}
            emptyMsg="No songs added yet"
          />
          <SongSection
            label="Do Not Play"
            accentColor="#FF4444"
            songs={noSongs}
            titleStyle={{ color: '#FF4444', textDecoration: 'line-through' }}
            emptyMsg="No do-not-plays"
          />
        </>
      )}
    </div>
  );
}

/* ─── Client List ─────────────────────────────────────────── */
function ClientList({ djId, djName, onSelectClient, onSignOut }) {
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);

  const load = useCallback(async () => {
    const { data } = await supabase.from('clients')
      .select('*')
      .eq('dj_id', djId)
      .order('created_at', { ascending: false });
    setClients(data || []);
    setLoading(false);
  }, [djId]);

  useEffect(() => { load(); }, [load]);

  const upcoming = clients.filter(c => c.wedding_date && new Date(c.wedding_date) >= new Date()).length;
  const active   = clients.filter(c => c.status === 'active').length;

  return (
    <div style={{ minHeight: '100vh', background: '#0D0D0D', color: '#ffffff' }}>
      {/* Header */}
      <header style={{ borderBottom: '1px solid #2A2A2A', padding: '0 24px' }}>
        <div style={{ maxWidth: '720px', margin: '0 auto', height: '56px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <img src="/swipeDJ logo.svg" alt="SwipeDJ" style={{ height: '24px' }} />
            <span style={{ fontSize: '12px', color: '#888888', borderLeft: '1px solid #2A2A2A', paddingLeft: '12px', letterSpacing: '0.06em', textTransform: 'uppercase', fontWeight: 600 }}>DJ</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <span style={{ fontSize: '13px', color: '#888888' }}>{djName}</span>
            <button onClick={onSignOut}
              style={{ fontSize: '13px', color: '#888888', background: 'none', border: '1px solid #2A2A2A', borderRadius: '8px', padding: '6px 12px', cursor: 'pointer' }}>
              Sign out
            </button>
          </div>
        </div>
      </header>

      <div style={{ maxWidth: '720px', margin: '0 auto', padding: '24px 16px' }}>
        {/* Stats */}
        <div style={{ display: 'flex', gap: '12px', marginBottom: '28px' }}>
          <Stat label="Total clients" value={clients.length} />
          <Stat label="Upcoming weddings" value={upcoming} />
          <Stat label="Active sessions" value={active} />
        </div>

        {/* List header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
          <div style={{ fontSize: '11px', fontWeight: 600, color: '#888888', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
            Clients ({clients.length})
          </div>
          <button onClick={() => setShowAdd(true)}
            style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '8px 14px', borderRadius: '8px', border: 'none', background: '#E8502A', color: '#ffffff', fontSize: '13px', fontWeight: 600, cursor: 'pointer' }}>
            + Add couple
          </button>
        </div>

        {loading && <div style={{ color: '#888888', fontSize: '14px', padding: '24px 0' }}>Loading…</div>}

        {!loading && clients.length === 0 && (
          <div style={{ background: '#1A1A1A', border: '1px solid #2A2A2A', borderRadius: '16px', padding: '48px 24px', textAlign: 'center' }}>
            <div style={{ fontSize: '32px', marginBottom: '12px' }}>💍</div>
            <div style={{ fontSize: '16px', fontWeight: 600, color: '#ffffff', marginBottom: '8px' }}>No clients yet</div>
            <div style={{ fontSize: '14px', color: '#888888', marginBottom: '20px' }}>Add your first couple to get started.</div>
            <button onClick={() => setShowAdd(true)}
              style={{ padding: '11px 20px', borderRadius: '10px', border: 'none', background: '#E8502A', color: '#ffffff', fontSize: '14px', fontWeight: 600, cursor: 'pointer' }}>
              Add couple
            </button>
          </div>
        )}

        {!loading && clients.length > 0 && (
          <div style={{ background: '#1A1A1A', border: '1px solid #2A2A2A', borderRadius: '16px', overflow: 'hidden' }}>
            {clients.map((c, i) => (
              <button key={c.id} onClick={() => onSelectClient(c)}
                style={{ display: 'flex', alignItems: 'center', width: '100%', padding: '16px', gap: '14px', background: 'none', border: 'none', borderBottom: i < clients.length - 1 ? '1px solid #2A2A2A' : 'none', cursor: 'pointer', textAlign: 'left', transition: 'background 0.1s' }}
                onMouseEnter={e => e.currentTarget.style.background = '#222222'}
                onMouseLeave={e => e.currentTarget.style.background = 'none'}
              >
                {/* Avatar */}
                <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: '#E8502A22', border: '1px solid #E8502A44', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontSize: '16px' }}>
                  💍
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: '15px', fontWeight: 600, color: '#ffffff', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {c.partner_1_name}{c.partner_2_name ? ` & ${c.partner_2_name}` : ''}
                  </div>
                  <div style={{ fontSize: '13px', color: '#888888', marginTop: '2px' }}>{fmt(c.wedding_date)}</div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexShrink: 0 }}>
                  <Pill status={c.status} />
                  <span style={{ color: '#444', fontSize: '16px' }}>›</span>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {showAdd && (
        <AddClientModal
          djId={djId}
          onClose={() => setShowAdd(false)}
          onAdded={newClient => {
            setClients(prev => [newClient, ...prev]);
            setShowAdd(false);
          }}
        />
      )}
    </div>
  );
}

/* ─── DJ Paywall ──────────────────────────────────────────── */
function DJPaywall({ djId }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function startTrial() {
    setError('');
    setLoading(true);
    try {
      const r = await fetch('/api/create-dj-checkout-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ djId }),
      });
      const j = await r.json();
      if (j?.url) {
        window.location.assign(j.url);
      } else {
        setError('Could not start checkout' + (j?.error ? `: ${j.error}` : '.'));
        setLoading(false);
      }
    } catch (e) {
      setError('Network error — please try again.');
      setLoading(false);
    }
  }

  return (
    <div style={{ minHeight: '100vh', background: '#0D0D0D', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px' }}>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      <div style={{ width: '100%', maxWidth: '400px' }}>
        <div style={{ textAlign: 'center', marginBottom: '32px' }}>
          <img src="/swipeDJ logo.svg" alt="SwipeDJ" style={{ height: '28px', marginBottom: '12px' }} />
          <div style={{ fontSize: '13px', color: '#888888', letterSpacing: '0.08em', textTransform: 'uppercase', fontWeight: 600 }}>DJ Dashboard</div>
        </div>

        <div style={{ background: '#1C1C1E', borderRadius: '20px', padding: '32px', border: '1px solid #2A2A2A' }}>
          <h2 style={{ margin: '0 0 4px', fontSize: '22px', fontWeight: 700, color: '#ffffff' }}>Start your DJ License</h2>
          <div style={{ fontSize: '32px', fontWeight: 800, color: '#ffffff', margin: '16px 0 4px' }}>
            $49<span style={{ fontSize: '16px', fontWeight: 400, color: '#888888' }}>/month</span>
          </div>
          <div style={{ fontSize: '13px', color: '#E8502A', marginBottom: '24px', fontWeight: 600 }}>14-day free trial — no charge today</div>

          <ul style={{ margin: '0 0 28px', padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {[
              'Unlimited clients',
              'Real-time playlist sync',
              'Do not play list',
              'Must-haves tracking',
              'CSV export per client',
            ].map(f => (
              <li key={f} style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '14px', color: '#cccccc' }}>
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="#E8502A" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="m3 8 3.5 3.5L13 5"/>
                </svg>
                {f}
              </li>
            ))}
          </ul>

          {error && <p style={{ fontSize: '13px', color: '#f87171', margin: '0 0 12px' }}>{error}</p>}

          <button onClick={startTrial} disabled={loading}
            style={{ width: '100%', padding: '14px', borderRadius: '12px', border: 'none', background: '#E8502A', color: '#ffffff', fontSize: '16px', fontWeight: 700, cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.7 : 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
            {loading
              ? <><div style={{ width: '18px', height: '18px', border: '2px solid rgba(255,255,255,0.3)', borderTopColor: '#fff', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} /> Starting…</>
              : 'Start 14-day free trial'
            }
          </button>
        </div>
      </div>
    </div>
  );
}

/* ─── Verifying screen (post-checkout polling) ────────────── */
function VerifyingScreen() {
  return (
    <div style={{ minHeight: '100vh', background: '#0D0D0D', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '16px' }}>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      <div style={{ width: '28px', height: '28px', border: '2px solid #2A2A2A', borderTopColor: '#E8502A', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />
      <div style={{ fontSize: '15px', color: '#888888' }}>Setting up your account…</div>
    </div>
  );
}

/* ─── Main component ──────────────────────────────────────── */
export default function DJDashboard() {
  const [session, setSession] = useState(undefined); // undefined = loading
  const [profile, setProfile] = useState(null);
  const [selectedClient, setSelectedClient] = useState(null);
  const [checkoutPending, setCheckoutPending] = useState(false);

  // Detect returning from Stripe checkout
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('checkout') === 'success') {
      setCheckoutPending(true);
      window.history.replaceState({}, document.title, '/dj');
    }
  }, []);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session: s } }) => setSession(s));
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!session?.user) { setProfile(null); return; }
    const { id, email } = session.user;
    supabase.from('dj_profiles').select('*').eq('id', id).single()
      .then(async ({ data }) => {
        if (data) { setProfile(data); return; }
        const { data: created } = await supabase.from('dj_profiles')
          .upsert({ id, email, name: email.split('@')[0] })
          .select().single();
        setProfile(created);
      });
  }, [session]);

  // Poll until webhook has updated subscription status to active
  useEffect(() => {
    if (!checkoutPending || !session?.user) return;
    const interval = setInterval(async () => {
      const { data } = await supabase.from('dj_profiles').select('*').eq('id', session.user.id).single();
      if (data?.stripe_subscription_status === 'active') {
        setProfile(data);
        setCheckoutPending(false);
      }
    }, 2000);
    return () => clearInterval(interval);
  }, [checkoutPending, session]);

  async function signOut() {
    await supabase.auth.signOut();
    setSelectedClient(null);
  }

  if (session === undefined || (session && !profile)) {
    return (
      <div style={{ minHeight: '100vh', background: '#0D0D0D', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        <div style={{ width: '24px', height: '24px', border: '2px solid #2A2A2A', borderTopColor: '#E8502A', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />
      </div>
    );
  }

  if (!session) {
    return <AuthScreen onAuth={() => {}} />;
  }

  if (checkoutPending) {
    return <VerifyingScreen />;
  }

  if (profile?.stripe_subscription_status !== 'active') {
    return <DJPaywall djId={session.user.id} />;
  }

  if (selectedClient) {
    return <ClientDetail client={selectedClient} onBack={() => setSelectedClient(null)} />;
  }

  return (
    <ClientList
      djId={session.user.id}
      djName={profile?.name || session.user.email}
      onSelectClient={setSelectedClient}
      onSignOut={signOut}
    />
  );
}
