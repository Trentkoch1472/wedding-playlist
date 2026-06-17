import React from "react";
import { Lock, Music, Download, RefreshCw } from "lucide-react";

export default function ExportScreen({
  acceptedSongs,   // yesList (yes + star)
  starredSongs,    // starList
  proUnlocked,
  isLinkedToDJ,
  spUser,
  spBusy,
  onExportCSV,
  onExportSpotify,
  onSpotifyLogin,
  onStartCheckout,
  onReset,
}) {
  const yesOnly = acceptedSongs.filter(
    (s) => !starredSongs.find((st) => st.__id === s.__id)
  );
  const totalAdded = acceptedSongs.length;

  // DJ-linked couples have their export covered by the DJ's subscription
  const exportUnlocked = proUnlocked || isLinkedToDJ;

  /* ── Spotify button state ─────────────────────────────── */
  let spotifyLabel, spotifySub, spotifyIcon, spotifyAction;

  if (!exportUnlocked) {
    spotifyLabel = "Unlock on Spotify";
    spotifySub = "$14.99 one-time";
    spotifyIcon = <Lock size={18} className="flex-shrink-0" />;
    spotifyAction = onStartCheckout;
  } else if (!spUser) {
    spotifyLabel = "Connect Spotify to Export";
    spotifySub = "Tap to authorise";
    spotifyIcon = <Music size={18} className="flex-shrink-0" />;
    spotifyAction = onSpotifyLogin;
  } else {
    spotifyLabel = spBusy ? "Exporting…" : "Export to Spotify";
    spotifySub = spBusy ? "Please wait" : "Creates a playlist in your library";
    spotifyIcon = <Music size={18} className="flex-shrink-0" />;
    spotifyAction = onExportSpotify;
  }

  return (
    <div style={{ minHeight: '100vh', background: '#0D0D0D', display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '48px 16px' }}>
      <div style={{ width: '100%', maxWidth: '384px', display: 'flex', flexDirection: 'column', gap: '32px' }}>

        {/* ── Celebratory header ─────────────────────────── */}
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '48px', marginBottom: '16px' }}>🎉</div>
          <h1 style={{ fontSize: '24px', fontWeight: 900, color: '#FFFFFF', lineHeight: 1.2, margin: 0 }}>
            Your playlist is ready!
          </h1>
          <p style={{ fontSize: '14px', color: '#888888', marginTop: '8px', marginBottom: 0 }}>
            Time to get the dancefloor going.
          </p>
        </div>

        {/* ── Stats ──────────────────────────────────────── */}
        <div style={{ display: 'flex', justifyContent: 'center', gap: '24px' }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '30px', fontWeight: 900, color: '#E8502A' }}>{totalAdded}</div>
            <div style={{ fontSize: '11px', color: '#888888', marginTop: '2px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              songs added
            </div>
          </div>
          <div style={{ width: '1px', background: '#2A2A2A' }} />
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '30px', fontWeight: 900, color: '#D4A017' }}>{starredSongs.length}</div>
            <div style={{ fontSize: '11px', color: '#888888', marginTop: '2px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              must-haves
            </div>
          </div>
          {yesOnly.length > 0 && (
            <>
              <div style={{ width: '1px', background: '#2A2A2A' }} />
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '30px', fontWeight: 900, color: '#FFFFFF' }}>{yesOnly.length}</div>
                <div style={{ fontSize: '11px', color: '#888888', marginTop: '2px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                  approved
                </div>
              </div>
            </>
          )}
        </div>

        {/* ── Action buttons ─────────────────────────────── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>

          {/* CSV export — free */}
          <button
            type="button"
            onClick={onExportCSV}
            disabled={!totalAdded}
            style={{
              width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
              padding: '14px', borderRadius: '16px',
              border: '2px solid #E8502A', background: '#1C1C1E',
              color: '#E8502A', fontWeight: 700, fontSize: '15px',
              cursor: totalAdded ? 'pointer' : 'not-allowed', opacity: totalAdded ? 1 : 0.4,
              transition: 'opacity 0.15s',
            }}
          >
            <Download size={18} />
            Export as CSV
            <span style={{ fontSize: '12px', fontWeight: 400, opacity: 0.6 }}>(free)</span>
          </button>

          {/* Spotify export — paid */}
          <button
            type="button"
            onClick={spotifyAction}
            disabled={spBusy}
            style={{
              width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '2px',
              padding: '16px', borderRadius: '16px',
              background: '#E8502A', color: '#FFFFFF',
              fontWeight: 700, fontSize: '15px', border: 'none',
              cursor: spBusy ? 'not-allowed' : 'pointer', opacity: spBusy ? 0.6 : 1,
              boxShadow: '0 4px 20px rgba(232,80,42,0.4)', transition: 'opacity 0.15s',
            }}
          >
            <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              {spotifyIcon}
              {spotifyLabel}
            </span>
            <span style={{ fontSize: '12px', fontWeight: 400, opacity: 0.7 }}>{spotifySub}</span>
          </button>

        </div>

        {/* ── Pro badge when unlocked ─────────────────────── */}
        {exportUnlocked && (
          <p style={{ textAlign: 'center', fontSize: '12px', color: '#D4A017', fontWeight: 600 }}>
            ★ Pro unlocked
          </p>
        )}

        {/* ── Start over ─────────────────────────────────── */}
        <div style={{ textAlign: 'center', paddingTop: '8px' }}>
          <button
            type="button"
            onClick={onReset}
            style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '14px', color: '#888888', background: 'none', border: 'none', cursor: 'pointer' }}
          >
            <RefreshCw size={13} />
            Start over
          </button>
        </div>

      </div>
    </div>
  );
}
