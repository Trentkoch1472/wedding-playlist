import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { X, Check, Star, Upload, Download, RotateCcw, SkipForward } from "lucide-react";
import { useSwipeable } from "react-swipeable";
import Papa from "papaparse";
import useSpotify from "./useSpotify";


// Utility helpers
const uid = (() => {
  let n = 0; return () => (++n).toString();
})();

function normalize(str = "") {
  return str
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function download(filename, text) {
  const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
}

function parseJSONL(text) {
  const lines = text.split(/\r?\n/).filter(Boolean);
  const rows = [];
  for (const line of lines) {
    try {
      const obj = JSON.parse(line);
      rows.push(obj);
    } catch (e) {
      console.warn("Invalid JSONL line skipped:", line);
    }
  }
  return rows;
}

function dedupeSongs(songs) {
  const seen = new Set();
  const out = [];
  for (const s of songs) {
    const key = `${normalize(s.title)}|${normalize(s.artist || "")}`;
    if (!seen.has(key)) {
      out.push(s);
      seen.add(key);
    }
  }
  return out;
}// Fisher-Yates shuffle
function shuffle(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}


function useLocalState(key, initial) {
  const [value, setValue] = useState(() => {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : initial;
    } catch {
      return initial;
    }
  });
  useEffect(() => {
    try { localStorage.setItem(key, JSON.stringify(value)); } catch {}
  }, [key, value]);
  return [value, setValue];
}

export default function App() {
  const fileInputRef = useRef(null);

  // Spotify
const {
  user: spUser,
  busy: spBusy,
  msg: spMsg,
  login: spotifyLogin,
  exportToSpotify,
} = useSpotify({
  clientId: "7ced125c87d944d09bb2a301f8576fb8",
  redirectUri: "window.location.origin",
});


  // Core state
  const [songs, setSongs] = useLocalState("wps_songs", []);
  const [index, setIndex] = useLocalState("wps_index", 0);
  const [choices, setChoices] = useLocalState("wps_choices", {});
  // ...rest of your state


  // Alternate card themes, even = orange, odd = blue
  const themes = [
    { bg: "bg-orange-50", border: "border-orange-200" },
    { bg: "bg-sky-50",    border: "border-sky-200" },
  ];
  const theme     = themes[index % 2];
  const themeNext = themes[(index + 1) % 2];

  // Show next card in the stack
  const nextSong = songs[index + 1] || null;

  // Drag state for gestures
  const [drag, setDrag] = useState({ dx: 0, dy: 0, active: false });
  const H_THRESHOLD = 120;  // pixels for yes or no
  const V_THRESHOLD = 100;  // pixels for star or skip
  const ROTATE_LIMIT = 10;  // degrees

  // Fling animation state
  const [fling, setFling] = useState({ active: false, toX: 0, toY: 0, rotate: 0 });
  // Derived lists
  const yesList = useMemo(
    () => songs.filter((s) => choices[s.__id]?.status === "yes" || choices[s.__id]?.status === "star"),
    [songs, choices]
  );
  const noList = useMemo(
    () => songs.filter((s) => choices[s.__id]?.status === "no"),
    [songs, choices]
  );
  const starList = useMemo(
    () => songs.filter((s) => choices[s.__id]?.status === "star"),
    [songs, choices]
  );

  const progress = songs.length ? Math.min(index, songs.length) / songs.length : 0;
  const current = songs[index] || null;

  // Throw the card off-screen, then commit the decision
const flingAndCommit = useCallback(
  (status, dir) => {
    if (!current || fling.active) return;

    // how far to throw so it exits the screen
    const OFF_X = Math.max(window.innerWidth, 800) * 1.2;
    const OFF_Y = Math.max(window.innerHeight, 600) * 1.2;

    let toX = 0, toY = 0, rotate = 0;
    if (dir === "Left")  { toX = -OFF_X; rotate = -15; }
    else if (dir === "Right") { toX =  OFF_X; rotate =  15; }
    else if (dir === "Up")    { toY = -OFF_Y; rotate =   0; }
    else if (dir === "Down")  { toY =  OFF_Y; rotate =   0; }

    // start fling animation
    setFling({ active: true, toX, toY, rotate, id: current.__id });


    // after animation, record decision and advance
    window.setTimeout(() => {
      if (status === "skip") {
        setIndex((i) => Math.min(i + 1, songs.length));
      } else {
        setChoices((c) => ({ ...c, [current.__id]: { status } }));
        setIndex((i) => Math.min(i + 1, songs.length));
      }
     setFling({ active: false, toX: 0, toY: 0, rotate: 0, id: null });
      setDrag({ dx: 0, dy: 0, active: false });
    }, 360);
  },
  [current, fling.active, songs.length]
);

const onYes  = useCallback(() => flingAndCommit("yes",  "Right"), [flingAndCommit]);
const onNo   = useCallback(() => flingAndCommit("no",   "Left"),  [flingAndCommit]);
const onStar = useCallback(() => flingAndCommit("star", "Up"),    [flingAndCommit]);
const onSkip = useCallback(() => flingAndCommit("skip", "Down"),  [flingAndCommit]);

const onUndo = useCallback(() => {
  if (index === 0) return;
  const prevSong = songs[index - 1];
  if (prevSong) {
    setChoices((c) => {
      const { [prevSong.__id]: _removed, ...rest } = c;
      return rest; // remove from all lists
    });
  }
  setIndex((i) => Math.max(i - 1, 0));
}, [index, songs]);

const swipeHandlers = useSwipeable({
  onSwiping: (e) => {
    if (fling.active || !current) return;
    setDrag({ dx: e.deltaX, dy: e.deltaY, active: true });
  },
  onSwiped: () => {
    if (fling.active || !current) return;
    setDrag({ dx: 0, dy: 0, active: false });
  },
  onSwipedLeft:  () => { if (!fling.active && current) onNo(); },
  onSwipedRight: () => { if (!fling.active && current) onYes(); },
  onSwipedUp:    () => { if (!fling.active && current) onStar(); },
  onSwipedDown:  () => { if (!fling.active && current) onSkip(); },
  preventScrollOnSwipe: true,
  trackMouse: true,
});


// Safety reset when advancing to a new card
useEffect(() => {
  setFling({ active: false, toX: 0, toY: 0, rotate: 0, id: null });
  setDrag({ dx: 0, dy: 0, active: false });
}, [index]);

// Auto-load a default list on first visit if nothing is loaded yet
useEffect(() => {
  if (songs.length > 0) return; // do not overwrite anything if songs already exist

  const url = `${process.env.PUBLIC_URL || ""}/default-songs.jsonl`;

  (async () => {
    try {
      const res = await fetch(url);
      if (!res.ok) return; // file not found, just skip
      const text = await res.text();

      // Reuse your existing helpers to parse and clean
      const rows = parseJSONL(text);
      const mapped = rows
        .map((r) => {
          const title  = r.title ?? r.song ?? r.Song ?? r["Song Title"] ?? r["Track"] ?? "";
          const artist = r.artist ?? r.Artist ?? r.singer ?? r["Performer"] ?? "";
          const bpm    = r.bpm ?? r.BPM ?? r.tempo ?? undefined;
          const decade = r.decade ?? r.Decade ?? undefined;
          const genre  = r.genre ?? r.Genre ?? undefined;
          return { __id: uid(), title: String(title).trim(), artist: String(artist || "").trim(), bpm, decade, genre };
        })
        .filter((r) => r.title);

      const clean = dedupeSongs(mapped);
const randomized = shuffle(clean);
if (randomized.length) {
  setSongs(randomized);

        setIndex(0);
        setChoices({});
      }
    } catch (e) {
      console.warn("Default autoload skipped:", e);
    }
  })();
}, [songs.length, setSongs, setIndex, setChoices]);

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.key === "ArrowLeft") onNo();
      else if (e.key === "ArrowRight" || e.key === " ") onYes();
      else if (e.key.toLowerCase() === "s" || e.key === "ArrowUp") onStar();
      else if (e.key.toLowerCase() === "u" || e.key === "Backspace") onUndo();
      else if (e.key === "ArrowDown") onSkip();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onNo, onYes, onStar, onUndo, onSkip]);

  // File ingestion
  const handleFiles = async (file) => {
    if (!file) return;

    const ext = file.name.split(".").pop().toLowerCase();
    const text = await file.text();

    let rows = [];
    if (ext === "csv") {
      const parsed = Papa.parse(text, { header: true, skipEmptyLines: true });
      rows = parsed.data;
    } else if (ext === "jsonl" || ext === "ndjson") {
      rows = parseJSONL(text);
    } else if (ext === "json") {
      try { rows = JSON.parse(text); } catch { rows = []; }
    } else {
      alert("Unsupported file type. Please upload CSV, JSON, or JSONL.");
      return;
    }

    // Normalize field names
    const mapped = rows.map((r) => {
      const title = r.title ?? r.song ?? r.Song ?? r["Song Title"] ?? r["Track"] ?? "";
      const artist = r.artist ?? r.Artist ?? r.singer ?? r["Performer"] ?? "";
      const bpm = r.bpm ?? r.BPM ?? r.tempo ?? undefined;
      const decade = r.decade ?? r.Decade ?? undefined;
      const genre = r.genre ?? r.Genre ?? undefined;
      return { __id: uid(), title: String(title).trim(), artist: String(artist || "").trim(), bpm, decade, genre };
    }).filter((r) => r.title);

    const clean = dedupeSongs(mapped);

    setSongs(clean);
    setIndex(0);
    setChoices({});
  };

  const triggerUpload = () => fileInputRef.current?.click();

  // Export only the playlist: stars first, then approved
const exportPlaylist = () => {
  // yesList already includes stars, so exclude them to avoid duplicates
  const approved = yesList.filter((s) => !starList.includes(s));
  const ordered = [...starList, ...approved];

  if (!ordered.length) {
    alert("No songs to export yet. Approve or star some songs first.");
    return;
  }

  const rows = ordered.map((s) => ({
    title: s.title,
    artist: s.artist || "",
  }));
  const csv = Papa.unparse(rows);
  download("playlist.csv", csv);
};


  const exportBuckets = () => {
    const toCSV = (arr) => Papa.unparse(arr.map((s) => ({ title: s.title, artist: s.artist })));
    download("must-haves.csv", toCSV(starList));
    download("approved.csv", toCSV(yesList.filter((s) => !starList.includes(s))));
    download("no-thanks.csv", toCSV(noList));
  };

  const resetAll = () => {
  const ok = window.confirm("Start over and shuffle the order?");
  if (!ok) return;
  setChoices({});
  setIndex(0);
  // keep the current pool, just randomize its order
  setSongs((prev) => shuffle(prev));
};


const remaining = songs.length - Math.min(index, songs.length);

// Drag-driven styles and overlay strengths
const rotation   = Math.max(-ROTATE_LIMIT, Math.min(ROTATE_LIMIT, drag.dx / 12));
const yesOpacity = drag.dx > 0 ? Math.min(Math.abs(drag.dx) / H_THRESHOLD, 1) : 0;
const noOpacity  = drag.dx < 0 ? Math.min(Math.abs(drag.dx) / H_THRESHOLD, 1) : 0;
const starOpacity= drag.dy < 0 ? Math.min(Math.abs(drag.dy) / V_THRESHOLD, 1) : 0;
const skipOpacity= drag.dy > 0 ? Math.min(Math.abs(drag.dy) / V_THRESHOLD, 1) : 0;

const dragAmount  = Math.min(Math.max(Math.abs(drag.dx) / H_THRESHOLD, Math.abs(drag.dy) / V_THRESHOLD), 1);
const nextScale   = fling.active ? 1.0 : (drag.active ? 0.98 + 0.02 * dragAmount : 0.98);
const nextOpacity = fling.active ? 1.0 : (drag.active ? 0.9  + 0.1  * dragAmount : 0.9);


  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <header className="sticky top-0 z-10 backdrop-blur bg-white/70 border-b border-slate-200">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-indigo-600 text-white grid place-items-center font-bold">WP</div>
          <h1 className="text-xl font-semibold">Wedding Playlist Swipe</h1>
          <div className="ml-auto flex items-center gap-2">
            <button onClick={triggerUpload} className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-slate-900 text-white text-sm hover:bg-slate-800">
              <Upload size={16}/> Upload your own songs

            </button>
            <input ref={fileInputRef} type="file" accept=".csv,.json,.jsonl,.ndjson" className="hidden" onChange={(e) => handleFiles(e.target.files?.[0])}/>
            <button
  onClick={exportPlaylist}
  disabled={!songs.length}
  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-indigo-600 text-white text-sm hover:bg-indigo-500 disabled:opacity-50 whitespace-nowrap"
>
  <Download size={16} />
  <span>Export Playlist</span>
</button>


            <button onClick={exportBuckets} className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-indigo-100 text-indigo-900 text-sm hover:bg-indigo-200 disabled:opacity-50" disabled={!songs.length}>
              <Download size={16}/> Export Buckets
            </button>
            <button onClick={resetAll} className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-white border border-slate-200 text-sm hover:bg-slate-100">
              Reset
            </button>
          {/* Connect Spotify */}
<button
  onClick={spotifyLogin}
  className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-green-600 text-white text-sm hover:bg-green-500"
  title={spUser ? `Connected as ${spUser.display_name}` : "Connect your Spotify account"}
>
  <span className={`inline-block w-2 h-2 rounded-full ${spUser ? "bg-white" : "bg-white/60"}`} />
  <span>{spUser ? "Spotify Connected" : "Connect Spotify"}</span>
</button>

{/* Export to Spotify */}
<button
  onClick={async () => {
    const url = await exportToSpotify(starList, yesList);
    if (url && window.confirm("Playlist created. Open in Spotify?")) {
      window.open(url, "_blank", "noopener,noreferrer");
    }
  }}
  disabled={!spUser || (!starList.length && !yesList.length) || spBusy}
  className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-emerald-700 text-white text-sm hover:bg-emerald-600 disabled:opacity-50 whitespace-nowrap"
>
  <span>Export to Spotify</span>
</button>
</div>
        </div>
        <div className="h-1 w-full bg-slate-200">
          <div className="h-full bg-indigo-500" style={{ width: `${progress * 100}%` }} />
        </div>
        {spMsg ? <div className="text-xs text-slate-500 text-center py-1">{spMsg}</div> : null}

      </header>

      <main className="max-w-5xl mx-auto px-4 py-10">
        {!songs.length ? (
          <div className="grid place-items-center text-center py-24">
            <div className="max-w-xl">
              <h2 className="text-2xl font-semibold mb-2">Import your song list</h2>
              <p className="text-slate-600 mb-6">Accepted formats: CSV or JSONL. Include at least a title field, artist is optional. Duplicate titles and artists will be auto merged.</p>
              <button onClick={triggerUpload} className="inline-flex items-center gap-2 px-4 py-3 rounded-2xl bg-slate-900 text-white hover:bg-slate-800">
                <Upload/> Upload your own songs

              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-6"
>
            {/* Swipe card */}
            <section {...swipeHandlers} className="select-none touch-none overscroll-contain">
              <div className="relative mx-auto w-full max-w-md md:max-w-lg"
>
   {/* NEXT CARD PREVIEW - insert here */}
    {nextSong && (
  <div
    className="absolute inset-0 pointer-events-none"
    aria-hidden="true"
    style={{
      transform: `scale(${nextScale})`,
      opacity: nextOpacity,
      transition: drag.active ? "none" : "transform 200ms ease-out, opacity 200ms ease-out",
    }}
  >
    <div
      className={`relative rounded-3xl ${themeNext.bg} shadow-xl border ${themeNext.border} p-6 md:p-8 min-h-[420px] md:min-h-[480px] flex flex-col justify-between`}
    >
      {/* Header line, aligned with active card */}
      <div className="text-sm text-slate-500">
        Song {Math.min(index + 2, songs.length)} of {songs.length} • Remaining {Math.max(remaining - 1, 0)}
      </div>

      {/* Main content */}
      <div className="text-center py-8">
        <div className="text-3xl font-bold tracking-tight">{nextSong.title}</div>
        {nextSong.artist ? (
          <div className="text-lg text-slate-600 mt-2">{nextSong.artist}</div>
        ) : null}
        <div className="mt-4 flex justify-center gap-3 text-xs text-slate-500">
          {nextSong.genre ? <span className="px-2 py-1 rounded-full bg-slate-100">{nextSong.genre}</span> : null}
          {nextSong.decade ? <span className="px-2 py-1 rounded-full bg-slate-100">{nextSong.decade}</span> : null}
          {nextSong.bpm ? <span className="px-2 py-1 rounded-full bg-slate-100">{nextSong.bpm} BPM</span> : null}
        </div>
      </div>

      {/* Controls row, visually identical but disabled */}
      <div className="flex items-center justify-center gap-3 pt-4 opacity-50">
        <button aria-hidden="true" disabled className="p-3 rounded-2xl border border-slate-200 bg-white">
          <RotateCcw/>
        </button>
        <button aria-hidden="true" disabled className="p-4 rounded-2xl bg-red-100 text-red-700">
          <X size={28}/>
        </button>
        <button aria-hidden="true" disabled className="p-5 rounded-2xl bg-emerald-600 text-white">
          <Check size={30}/>
        </button>
        <button aria-hidden="true" disabled className="p-4 rounded-2xl bg-yellow-100 text-yellow-800">
          <Star size={26}/>
        </button>
        <button aria-hidden="true" disabled className="p-3 rounded-2xl border border-slate-200 bg-white">
          <SkipForward/>
        </button>
      </div>

      {/* Shortcuts line, same text */}
      <div className="mt-3 text-center text-xs text-slate-500">
        Shortcuts or swipe: Left swipe = No. Right swipe or Space = Yes. Up swipe or S = Star. U or Backspace = Undo. Down swipe = Skip.
      </div>
    </div>
  </div>
)}


                <div
  key={current ? current.__id : "empty"}
  className={`relative rounded-3xl ${theme.bg} shadow-xl border ${theme.border} p-6 md:p-8 min-h-[420px] md:min-h-[480px] flex flex-col justify-between`}
  style={{
    transform:
      fling.active && current && fling.id === current.__id
        ? `translate(${fling.toX}px, ${fling.toY}px) rotate(${fling.rotate}deg)`
        : `translate(${drag.dx}px, ${drag.dy}px) rotate(${rotation}deg)`,
    transition:
      fling.active && current && fling.id === current.__id
        ? "transform 360ms cubic-bezier(0.22, 1, 0.36, 1)"
        : drag.active
          ? "none"
          : "transform 220ms ease-out",
  }}
>

                  <div className="text-sm text-slate-500">Song {Math.min(index + 1, songs.length)} of {songs.length} • Remaining {remaining}</div>
                  {current ? (
                    <div className="text-center py-8">
                      <div className="text-3xl font-bold tracking-tight">{current.title}</div>
                      {current.artist ? (<div className="text-lg text-slate-600 mt-2">{current.artist}</div>) : null}
                      <div className="mt-4 flex justify-center gap-3 text-xs text-slate-500">
                        {current.genre ? <span className="px-2 py-1 rounded-full bg-slate-100">{current.genre}</span> : null}
                        {current.decade ? <span className="px-2 py-1 rounded-full bg-slate-100">{current.decade}</span> : null}
                        {current.bpm ? <span className="px-2 py-1 rounded-full bg-slate-100">{current.bpm} BPM</span> : null}
                      </div>
                      {/* Drag overlays */}
<div className="pointer-events-none">
  <div
    className="absolute left-4 top-4 text-emerald-700/90 bg-emerald-50 border border-emerald-200 rounded-lg px-2 py-1 text-sm font-medium"
    style={{ opacity: yesOpacity }}
  >
    ✓ Yes
  </div>
  <div
    className="absolute right-4 top-4 text-red-700/90 bg-red-50 border border-red-200 rounded-lg px-2 py-1 text-sm font-medium"
    style={{ opacity: noOpacity }}
  >
    ✕ No
  </div>
  <div
    className="absolute left-1/2 -translate-x-1/2 top-3 text-yellow-800 bg-yellow-50 border border-yellow-200 rounded-lg px-2 py-1 text-sm font-medium"
    style={{ opacity: starOpacity }}
  >
    ★ Must have
  </div>
  <div
    className="absolute left-1/2 -translate-x-1/2 bottom-3 text-slate-700 bg-slate-50 border border-slate-200 rounded-lg px-2 py-1 text-sm font-medium"
    style={{ opacity: skipOpacity }}
  >
    ↧ Skip
  </div>
</div>

                    </div>
                  ) : (
                    <div className="text-center py-16">
                      <div className="text-2xl font-semibold">You have reviewed all songs</div>
                      <p className="text-slate-600 mt-2">Export your results or reset to start again.</p>
                    </div>
                  )}

                  {/* Controls */}
                  <div className="flex items-center justify-center gap-3 pt-4">
                    <button aria-label="Undo" onClick={onUndo} disabled={fling.active} className="p-3 rounded-2xl border border-slate-200 bg-white hover:bg-slate-50">
                      <RotateCcw/>
                    </button>
                    <button aria-label="No" onClick={onNo} disabled={fling.active} className="p-4 rounded-2xl bg-red-100 text-red-700 hover:bg-red-200">
                      <X size={28}/>
                    </button>
                    <button aria-label="Yes" onClick={onYes} disabled={fling.active} className="p-5 rounded-2xl bg-emerald-600 text-white hover:bg-emerald-500">
                      <Check size={30}/>
                    </button>
                    <button aria-label="Star" onClick={onStar} disabled={fling.active} className="p-4 rounded-2xl bg-yellow-100 text-yellow-800 hover:bg-yellow-200">
                      <Star size={26}/>
                    </button>
                    <button aria-label="Skip" onClick={onSkip} disabled={fling.active} className="p-3 rounded-2xl border border-slate-200 bg-white hover:bg-slate-50">
                      <SkipForward/>
                    </button>
                  </div>

                  <div className="mt-3 text-center text-xs text-slate-500">Shortcuts or swipe: Left swipe = No. Right swipe or Space = Yes. Up swipe or S = Star. U or Backspace = Undo. Down swipe = Skip.
</div>
                </div>
              </div>
            </section>

            {/* Sidebar */}
            <aside className="sticky top-20 space-y-4">
              <Panel title="Stats">
                <div className="grid grid-cols-3 gap-2 text-center">
                  <Stat label="Must haves" value={starList.length} />
                  <Stat label="Yes" value={yesList.length} />
                  <Stat label="No" value={noList.length} />
                </div>
              </Panel>

              <Panel title="Peek lists">
                <PeekList title="Must haves" items={starList} />
                <PeekList title="Approved" items={yesList.filter((s) => !starList.includes(s))} />
                <PeekList title="No thanks" items={noList} />
              </Panel>

              <Panel title="Actions">
                <div className="flex flex-wrap gap-2">
                  <button
  onClick={exportPlaylist}
  disabled={!songs.length}
  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-indigo-600 text-white text-sm hover:bg-indigo-500 disabled:opacity-50 whitespace-nowrap"
>
  <Download size={16} />
  <span>Export Playlist</span>
</button>

                  <button onClick={exportBuckets} className="px-3 py-2 rounded-xl bg-indigo-100 text-indigo-900 text-sm hover:bg-indigo-200 w-full">Export buckets</button>
                  <button onClick={resetAll} className="px-3 py-2 rounded-xl bg-white border border-slate-200 text-sm hover:bg-slate-100 w-full">Reset</button>
                </div>
              </Panel>

              <Panel title="Tips">
                <ul className="text-sm text-slate-600 space-y-2 list-disc pl-5">
                  <li>Swipe left for No, right for Yes, up for Must have.</li>
                  <li>Use keyboard shortcuts for speed. Try Space for Yes and S for Star.</li>
                  <li>Upload a new file any time to replace the list. Progress is saved locally to your browser.</li>
                </ul>
              </Panel>
            </aside>
          </div>
        )}
      </main>

      <footer className="py-6 text-center text-xs text-slate-500">Made for choosing bangers, not ballads only. Choose responsibly.</footer>
    </div>
  );
}

function Panel({ title, children }) {
  return (
    <div className="rounded-2xl bg-white border border-slate-200 shadow-sm">
      <div className="px-4 py-3 border-b border-slate-200 font-medium">{title}</div>
      <div className="p-4">{children}</div>
    </div>
  );
}

function Stat({ label, value }) {
  return (
    <div className="rounded-xl bg-slate-50 p-3">
      <div className="text-2xl font-bold">{value}</div>
      <div className="text-xs text-slate-500">{label}</div>
    </div>
  );
}

function PeekList({ title, items }) {
  const MAX = 6;
  return (
    <div className="mb-3">
      <div className="text-xs font-semibold text-slate-500 mb-1">{title} ({items.length})</div>
      <div className="space-y-1 max-h-48 overflow-auto pr-1">
        {items.slice(0, MAX).map((s, i) => (
          <div key={s.__id} className="text-sm truncate">{i + 1}. {s.title}{s.artist ? ` — ${s.artist}` : ""}</div>
        ))}
        {items.length > MAX ? (
          <div className="text-xs text-slate-400">+ {items.length - MAX} more</div>
        ) : null}
      </div>
    </div>
  );
}
