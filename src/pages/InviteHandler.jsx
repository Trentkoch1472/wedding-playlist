import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';

export default function InviteHandler() {
  const { token } = useParams();
  const navigate = useNavigate();
  const [invalid, setInvalid] = useState(false);

  useEffect(() => {
    async function resolve() {
      const { data, error } = await supabase
        .from('clients')
        .select('id')
        .eq('invite_token', token)
        .single();

      if (error || !data) {
        setInvalid(true);
        return;
      }

      localStorage.setItem('swipedj_client_id', data.id);
      navigate('/app', { replace: true });
    }

    resolve();
  }, [token, navigate]);

  if (!invalid) {
    return (
      <div style={{ minHeight: '100vh', background: '#0D0D0D', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ width: '24px', height: '24px', border: '2px solid #2A2A2A', borderTopColor: '#E8502A', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', background: '#0D0D0D', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '20px', padding: '24px', textAlign: 'center' }}>
      <p style={{ margin: 0, fontSize: '16px', color: '#ffffff' }}>
        This invite link is invalid or has expired.
      </p>
      <button
        onClick={() => navigate('/app')}
        style={{ background: 'none', border: 'none', color: '#E8502A', fontSize: '15px', fontWeight: 600, cursor: 'pointer', padding: 0 }}
      >
        Start swiping anyway
      </button>
    </div>
  );
}
