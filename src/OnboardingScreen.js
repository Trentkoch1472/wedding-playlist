import React, { useEffect, useMemo, useState } from "react";

/* ── helpers (self-contained) ─────────────────────────── */
let _uid = 0;
const uid = () => (++_uid).toString();

function parseJSONL(text) {
  const lines = text.split(/\r?\n/).filter(Boolean);
  const rows = [];
  for (const line of lines) {
    try { rows.push(JSON.parse(line)); } catch { /* skip */ }
  }
  return rows;
}

function shuffle(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/* ── filter config ────────────────────────────────────── */
const EVENT_TYPES = ["Reception", "Cocktail Hour", "Both"];

const VIBE_OPTIONS = [
  { label: "Top 40 / Pop",           tags: ["white_wedding", "black_wedding"] },
  { label: "R&B / Hip-Hop",          tags: ["black_wedding"] },
  { label: "Latin",                   tags: ["latin_wedding"] },
  { label: "Bollywood / South Asian", tags: ["south_asian"] },
  { label: "Afrobeats",              tags: ["afrobeats"] },
  { label: "Country",                tags: ["country_wedding"] },
  { label: "K-Pop",                  tags: ["kpop"] },
  { label: "Rock & Alt",             tags: ["white_wedding"] },
];

function applyFilters(songs, { eventType, vibes, englishOnly, hideExplicit }) {
  return songs.filter((song) => {
    // Event type
    if (eventType === "Reception" && !song.suitable_for?.includes("reception")) return false;
    if (eventType === "Cocktail Hour" && !song.suitable_for?.includes("cocktail")) return false;

    // Vibes — if any selected, song must have at least one matching tag
    if (vibes.length > 0) {
      const wantedTags = [
        ...new Set(vibes.flatMap((v) => VIBE_OPTIONS.find((o) => o.label === v)?.tags ?? [])),
      ];
      if (!wantedTags.some((t) => (song.cultural_tags ?? []).includes(t))) return false;
    }

    if (englishOnly && song.language !== "english") return false;
    if (hideExplicit && song.explicit === true) return false;

    return true;
  });
}

/* ── Toggle ───────────────────────────────────────────── */
function Toggle({ label, checked, onChange }) {
  return (
    <label className="flex items-center justify-between gap-3 cursor-pointer select-none">
      <span className="text-sm font-semibold text-[#1A1A1A]">{label}</span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`relative inline-flex h-6 w-11 flex-shrink-0 rounded-full transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#E8502A] ${
          checked ? "bg-[#E8502A]" : "bg-gray-300"
        }`}
      >
        <span
          className={`pointer-events-none absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform duration-200 ${
            checked ? "translate-x-5" : "translate-x-0"
          }`}
        />
      </button>
    </label>
  );
}

/* ── Main component ───────────────────────────────────── */
export default function OnboardingScreen({ onComplete }) {
  const [allSongs, setAllSongs] = useState([]);
  const [loading, setLoading] = useState(true);

  const [eventType, setEventType] = useState("Both");
  const [vibes, setVibes] = useState([]);
  const [englishOnly, setEnglishOnly] = useState(false);
  const [hideExplicit, setHideExplicit] = useState(false);

  useEffect(() => {
    const url = `${process.env.PUBLIC_URL || ""}/default-songs.jsonl`;
    fetch(url)
      .then((r) => r.text())
      .then((text) => {
        const rows = parseJSONL(text);
        const seen = new Set();
        const mapped = rows
          .map((r) => {
            const title = r.title ?? r.song ?? r.Song ?? r["Song Title"] ?? r["Track"] ?? "";
            const artist = r.artist ?? r.Artist ?? r.singer ?? r["Performer"] ?? "";
            return {
              __id: uid(),
              title: String(title).trim(),
              artist: String(artist || "").trim(),
              bpm: r.bpm ?? r.BPM ?? r.tempo ?? undefined,
              decade: r.decade ?? r.Decade ?? undefined,
              genre: r.genre ?? r.Genre ?? undefined,
              energy: r.energy ?? undefined,
              explicit: r.explicit ?? undefined,
              language: r.language ?? undefined,
              cultural_tags: r.cultural_tags ?? [],
              suitable_for: r.suitable_for ?? [],
            };
          })
          .filter((s) => {
            if (!s.title) return false;
            const key = `${s.title.toLowerCase()}|${s.artist.toLowerCase()}`;
            if (seen.has(key)) return false;
            seen.add(key);
            return true;
          });
        setAllSongs(mapped);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const toggleVibe = (label) =>
    setVibes((prev) =>
      prev.includes(label) ? prev.filter((v) => v !== label) : [...prev, label]
    );

  const previewCount = useMemo(
    () => applyFilters(allSongs, { eventType, vibes, englishOnly, hideExplicit }).length,
    [allSongs, eventType, vibes, englishOnly, hideExplicit]
  );

  const handleBuild = () => {
    let filtered = applyFilters(allSongs, { eventType, vibes, englishOnly, hideExplicit });
    if (!filtered.length) filtered = allSongs; // fallback if filters are too narrow
    onComplete(shuffle(filtered));
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#FAF6F0] flex items-center justify-center">
        <p className="text-gray-400 text-sm animate-pulse">Loading songs…</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#FAF6F0] flex flex-col items-center px-4 py-10">
      <div className="max-w-sm w-full space-y-8">

        {/* Header */}
        <div className="text-center">
          <img src="/logo.png" alt="SwipeDJ" className="h-10 w-auto mx-auto mb-3" />
          <h1 className="text-2xl font-black text-[#1A1A1A]">Build Your Playlist</h1>
          <p className="text-sm text-gray-500 mt-1 leading-relaxed">
            Tell us about your event and we'll curate the perfect mix.
          </p>
        </div>

        {/* Event type */}
        <div>
          <p className="text-xs font-bold tracking-widest text-[#E8502A] uppercase mb-3">
            Event Type
          </p>
          <div className="flex gap-2">
            {EVENT_TYPES.map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setEventType(t)}
                className={`flex-1 py-2.5 rounded-xl text-sm font-semibold transition-colors border ${
                  eventType === t
                    ? "bg-[#E8502A] text-white border-[#E8502A]"
                    : "bg-white text-[#1A1A1A] border-gray-200 hover:border-[#E8502A]"
                }`}
              >
                {t}
              </button>
            ))}
          </div>
        </div>

        {/* Music vibes */}
        <div>
          <p className="text-xs font-bold tracking-widest text-[#E8502A] uppercase mb-1">
            Music Vibe
          </p>
          <p className="text-xs text-gray-400 mb-3">Pick any that fit — leave blank for everything</p>
          <div className="flex flex-wrap gap-2">
            {VIBE_OPTIONS.map((v) => {
              const selected = vibes.includes(v.label);
              return (
                <button
                  key={v.label}
                  type="button"
                  onClick={() => toggleVibe(v.label)}
                  className={`px-3 py-1.5 rounded-full text-sm font-semibold transition-colors border ${
                    selected
                      ? "bg-[#E8502A] text-white border-[#E8502A]"
                      : "bg-white text-[#1A1A1A] border-gray-200 hover:border-[#E8502A]"
                  }`}
                >
                  {v.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Toggles */}
        <div className="rounded-2xl bg-white border border-gray-100 p-4 space-y-4 shadow-sm">
          <Toggle label="English songs only" checked={englishOnly} onChange={setEnglishOnly} />
          <div className="h-px bg-gray-100" />
          <Toggle label="Hide explicit songs" checked={hideExplicit} onChange={setHideExplicit} />
        </div>

        {/* Build button */}
        <button
          type="button"
          onClick={handleBuild}
          disabled={!allSongs.length}
          className="w-full py-4 rounded-2xl bg-[#E8502A] text-white font-bold text-lg shadow-md hover:bg-[#C43E1F] active:scale-95 transition-all disabled:opacity-50"
        >
          Build My Playlist →
          {allSongs.length > 0 && (
            <span className="block text-sm font-normal opacity-80 mt-0.5">
              {previewCount} songs match your filters
            </span>
          )}
        </button>

      </div>
    </div>
  );
}
