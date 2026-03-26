import React from "react";
import { Lock, Music, Download, RefreshCw } from "lucide-react";

export default function ExportScreen({
  acceptedSongs,   // yesList (yes + star)
  starredSongs,    // starList
  proUnlocked,
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
  const totalAdded = acceptedSongs.length; // starred are included in accepted

  /* ── Spotify button state ─────────────────────────────── */
  let spotifyLabel, spotifySub, spotifyIcon, spotifyAction;

  if (!proUnlocked) {
    spotifyLabel = "Unlock on Spotify";
    spotifySub = "$9.99 one-time";
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
    <div className="min-h-screen bg-[#FAF6F0] flex flex-col items-center px-4 py-12">
      <div className="max-w-sm w-full flex flex-col gap-8">

        {/* ── Celebratory header ─────────────────────────── */}
        <div className="text-center">
          <div className="text-5xl mb-4">🎉</div>
          <h1 className="text-2xl font-black text-[#1A1A1A] leading-tight">
            Your playlist is ready!
          </h1>
          <p className="text-sm text-gray-500 mt-2">
            Time to get the dancefloor going.
          </p>
        </div>

        {/* ── Stats ──────────────────────────────────────── */}
        <div className="flex justify-center gap-6">
          <div className="text-center">
            <div className="text-3xl font-black text-[#E8502A]">{totalAdded}</div>
            <div className="text-xs text-gray-500 mt-0.5 font-semibold uppercase tracking-wide">
              songs added
            </div>
          </div>
          <div className="w-px bg-gray-200" />
          <div className="text-center">
            <div className="text-3xl font-black text-[#D4A017]">{starredSongs.length}</div>
            <div className="text-xs text-gray-500 mt-0.5 font-semibold uppercase tracking-wide">
              must-haves
            </div>
          </div>
          {yesOnly.length > 0 && (
            <>
              <div className="w-px bg-gray-200" />
              <div className="text-center">
                <div className="text-3xl font-black text-[#1A1A1A]">{yesOnly.length}</div>
                <div className="text-xs text-gray-500 mt-0.5 font-semibold uppercase tracking-wide">
                  approved
                </div>
              </div>
            </>
          )}
        </div>

        {/* ── Action buttons ─────────────────────────────── */}
        <div className="flex flex-col gap-3">

          {/* CSV export — free */}
          <button
            type="button"
            onClick={onExportCSV}
            disabled={!totalAdded}
            className="w-full flex items-center justify-center gap-2 py-3.5 rounded-2xl border-2 border-[#E8502A] text-[#E8502A] font-bold text-base bg-white hover:bg-[#FFE8E0] active:scale-95 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <Download size={18} />
            Export as CSV
            <span className="text-xs font-normal opacity-60">(free)</span>
          </button>

          {/* Spotify export — paid */}
          <button
            type="button"
            onClick={spotifyAction}
            disabled={spBusy}
            className="w-full flex flex-col items-center justify-center gap-0.5 py-4 rounded-2xl bg-[#E8502A] text-white font-bold text-base shadow-lg hover:bg-[#C43E1F] active:scale-95 transition-all disabled:opacity-60 disabled:cursor-not-allowed"
          >
            <span className="flex items-center gap-2">
              {spotifyIcon}
              {spotifyLabel}
            </span>
            <span className="text-xs font-normal opacity-70">{spotifySub}</span>
          </button>

        </div>

        {/* ── Pro badge when unlocked ─────────────────────── */}
        {proUnlocked && (
          <p className="text-center text-xs text-[#D4A017] font-semibold">
            ★ Pro unlocked
          </p>
        )}

        {/* ── Start over ─────────────────────────────────── */}
        <div className="text-center pt-2">
          <button
            type="button"
            onClick={onReset}
            className="inline-flex items-center gap-1.5 text-sm text-gray-400 hover:text-[#E8502A] transition-colors"
          >
            <RefreshCw size={13} />
            Start over
          </button>
        </div>

      </div>
    </div>
  );
}
