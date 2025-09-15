import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSwipeable } from "react-swipeable";
import Papa from "papaparse";
import useSpotify from "./useSpotify";
import {
  X,
  Check,
  Star,
  Upload,
  Download,
  RotateCcw,
  SkipForward,
  Play,
  Pause,
} from "lucide-react";
const DONATION_URL = "https://buymeacoffee.com/your-link"; // <-- put your real link

/* ---------- helpers ---------- */
const uid = (() => {
  let n = 0;
  return () => (++n).toString();
})();

function normalize(str = "") {
  return str
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

// Force HTTPS on Apple assets to avoid mixed-content on mobile
function toHttps(u) {
  return typeof u === "string" ? u.replace(/^http:\/\//i, "https://") : u;
}

// Choose the best iTunes hit that actually has a preview/art
function pickBestItunes(items, wantTitle, wantArtist) {
  const nt = (wantTitle || "").toLowerCase();
  const na = (wantArtist || "").toLowerCase();

  // Prefer: has preview, then artwork, then title/artist similarity
  let best = null;
  let bestScore = -1;

  for (const it of items || []) {
    const t = (it.trackName || "").toLowerCase();
    const a = (it.artistName || "").toLowerCase();

    let score = 0;
    if (it.previewUrl) score += 3;
    if (it.artworkUrl100 || it.artworkUrl60 || it.artworkUrl512) score += 2;

    // Light-weight matching bonus
    if (t && nt && (t.includes(nt) || nt.includes(t))) score += 2;
    if (a && na && (a.includes(na) || na.includes(a))) score += 2;

    if (score > bestScore) {
      best = it;
      bestScore = score;
    }
  }
  return best;
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
      rows.push(JSON.parse(line));
    } catch {
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
}

// Fisher–Yates shuffle
function shuffle(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/* ========== App ========== */
export default function App() {
  const fileInputRef = useRef(null);

  // Export dropdown state
  const [exportOpen, setExportOpen] = useState(false);
  const exportMenuRef = useRef(null);
  // Upload dropdown state
const [uploadOpen, setUploadOpen] = useState(false);
const uploadMenuRef = useRef(null);
const pendingUploadModeRef = useRef("replace"); // "add" | "replace"
// Handlers for Upload menu
const triggerUploadAdd = () => {
  requirePro(() => {
    pendingUploadModeRef.current = "add";
    fileInputRef.current?.click();
    setUploadOpen(false);
  });
};

const triggerUploadReplace = () => {
  requirePro(() => {
    pendingUploadModeRef.current = "replace";
    fileInputRef.current?.click();
    setUploadOpen(false);
  });
};

// close the Upload menu on outside click / ESC
useEffect(() => {
  const onDocClick = (e) => {
    if (!uploadMenuRef.current) return;
    if (!uploadMenuRef.current.contains(e.target)) setUploadOpen(false);
  };
  const onKey = (e) => e.key === "Escape" && setUploadOpen(false);
  document.addEventListener("click", onDocClick);
  document.addEventListener("keydown", onKey);
  return () => {
    document.removeEventListener("click", onDocClick);
    document.removeEventListener("keydown", onKey);
  };
}, []);

  useEffect(() => {
    const onDocClick = (e) => {
      if (!exportMenuRef.current) return;
      if (!exportMenuRef.current.contains(e.target)) setExportOpen(false);
    };
    const onKey = (e) => e.key === "Escape" && setExportOpen(false);
    document.addEventListener("click", onDocClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("click", onDocClick);
      document.removeEventListener("keydown", onKey);
    };
  }, []);
    // Set browser tab title
  useEffect(() => {
    document.title = "Swipe to Dance";
  }, []);


// --- Spotify redirect: use the exact current page URL (no trailing slash) ---
const SPOTIFY_REDIRECT_URI = (() => {
  const u = new URL(window.location.href);
  const exact = u.origin + u.pathname.replace(/\/$/, ""); // strip trailing slash
  console.log("Using Spotify redirect:", exact);
  return exact;
})();

const {
  user: spUser,
  busy: spBusy,
  msg: spMsg,
  login: spotifyLogin,
  exportToSpotify
  findTrackMeta,
} = useSpotify({
  clientId: "7ced125c87d944d09bb2a301f8576fb8",
  redirectUri: SPOTIFY_REDIRECT_URI,
});

  // Local storage state
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
      try {
        localStorage.setItem(key, JSON.stringify(value));
      } catch {}
    }, [key, value]);
    return [value, setValue];
  }

  // Core state
  const [songs, setSongs] = useLocalState("wps_songs", []);
  const [index, setIndex] = useLocalState("wps_index", 0);
  const [choices, setChoices] = useLocalState("wps_choices", {});
  // Donation prompt (show once per browser unless cleared)
const [coffeeOpen, setCoffeeOpen] = useState(false);
const [coffeeOffered, setCoffeeOffered] = useLocalState("wps_coffee_offered", false);

const maybeOfferCoffee = useCallback(() => {
  if (coffeeOffered) return;
  setCoffeeOpen(true);
  setCoffeeOffered(true);
}, [coffeeOffered, setCoffeeOffered]);

  // --- Pro gating ---
const [proUnlocked, setProUnlocked] = useLocalState("wps_pro", false);
const [payOpen, setPayOpen] = useState(false);
const pendingActionRef = useRef(null);

const requirePro = useCallback((fn) => {
  if (proUnlocked) {
    fn();
  } else {
    pendingActionRef.current = fn;
    setPayOpen(true);
  }
}, [proUnlocked]);

const unlockPro = useCallback(() => {
  setProUnlocked(true);
  setPayOpen(false);
  if (typeof pendingActionRef.current === "function") {
    const run = pendingActionRef.current;
    pendingActionRef.current = null;
    // run after a tick (so modal can close smoothly)
    setTimeout(() => run(), 50);
  }
}, [setProUnlocked]);

const cancelPay = useCallback(() => {
  pendingActionRef.current = null;
  setPayOpen(false);
}, []);

  // Theme for cards
  const themes = [
    { bg: "bg-orange-50", border: "border-orange-200" },
    { bg: "bg-sky-50", border: "border-sky-200" },
  ];
  const theme = themes[index % 2];
  const themeNext = themes[(index + 1) % 2];

  const current = songs[index] || null;
  const nextSong = songs[index + 1] || null;

  // Drag/fling
  const [drag, setDrag] = useState({ dx: 0, dy: 0, active: false });
  const H_THRESHOLD = 120;
  const V_THRESHOLD = 100;
  const ROTATE_LIMIT = 10;

  const [fling, setFling] = useState({ active: false, toX: 0, toY: 0, rotate: 0, id: null });
  // Toast state + helper
const [toast, setToast] = useState("");
const toastTimerRef = useRef(null);
const showToast = useCallback((text) => {
  setToast(text);
  if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
  toastTimerRef.current = setTimeout(() => setToast(""), 2800);
}, []);
useEffect(() => {
  return () => {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
  };
}, []);


  // Derived lists
  const yesList = useMemo(
    () => songs.filter((s) => choices[s.__id]?.status === "yes" || choices[s.__id]?.status === "star"),
    [songs, choices]
  );
  const noList = useMemo(() => songs.filter((s) => choices[s.__id]?.status === "no"), [songs, choices]);
  const starList = useMemo(() => songs.filter((s) => choices[s.__id]?.status === "star"), [songs, choices]);

  const progress = songs.length ? Math.min(index, songs.length) / songs.length : 0;

  /* ---- Preview audio + cover art ---- */
  const [previewAudio, setPreviewAudio] = useState(null);
  const [previewing, setPreviewing] = useState(false);
  const [previewPreparing, setPreviewPreparing] = useState(false);

  const stopPreview = useCallback(() => {
    if (previewAudio) {
      try {
        previewAudio.pause();
      } catch {}
    }
    setPreviewAudio(null);
    setPreviewing(false);
  }, [previewAudio]);

// Fetch & cache preview URL + cover art (retry if previous result was null)
// REPLACE your existing ensureMeta with this whole block:
const ensureMeta = useCallback(
  async (song, { force = false } = {}) => {
    if (!song) return null;

    const haveGoodPreview = typeof song.__preview === "string" && !!song.__preview;
    const haveArt = typeof song.__art === "string" && !!song.__art;
    if (!force && haveGoodPreview && haveArt) {
      return { preview: song.__preview, art: song.__art };
    }

    const attempts = [
      `${song.artist || ""} ${song.title}`.trim(),
      song.title?.trim(),
      (song.artist || "").trim(),
    ].filter(Boolean);

    let bestPreview = haveGoodPreview ? song.__preview : null;
    let bestArt = haveArt ? song.__art : null;

    // 1) Try iTunes first (often has 30s previews)
    for (const q of attempts) {
      try {
        const r = await fetch(
          `https://itunes.apple.com/search?term=${encodeURIComponent(q)}&media=music&entity=song&country=US&limit=5`
        );
        const j = await r.json();
        const results = Array.isArray(j.results) ? j.results : [];

        const tn = normalize(song.title);
        const an = normalize(song.artist || "");

        let bestItem = null;
        let bestScore = -1;
        for (const it of results) {
          const t2 = normalize(it.trackName || "");
          const a2 = normalize(it.artistName || "");
          let score = 0;
          if (t2 === tn) score += 3;
          if (a2 && an && a2 === an) score += 3;
          if (t2.includes(tn) || tn.includes(t2)) score += 1;
          if (a2 && an && (a2.includes(an) || an.includes(a2))) score += 1;
          if (score > bestScore) {
            bestScore = score;
            bestItem = it;
          }
        }

        const item = bestItem || results[0];
        if (item) {
          if (!bestPreview && item.previewUrl) bestPreview = item.previewUrl;
          if (!bestArt) {
            const raw = item.artworkUrl100 || item.artworkUrl60 || item.artworkUrl512 || null;
            if (raw) {
              const big = raw.replace(/\/\d+x\d+bb\//, "/600x600bb/");
              bestArt = big || raw;
            }
          }
        }

        if (bestPreview && bestArt) break; // got both, stop early
      } catch {
        // try next attempt
      }
    }

    // 2) If we STILL don't have preview and/or art, try Spotify (requires user to be logged in)
    if ((!bestPreview || !bestArt) && typeof findTrackMeta === "function") {
      try {
        const sp = await findTrackMeta(song.title, song.artist);
        if (sp) {
          if (!bestPreview && sp.preview) bestPreview = sp.preview;
          if (!bestArt && sp.art) bestArt = sp.art;
        }
      } catch {}
    }

    // 3) Force HTTPS to avoid mobile mixed-content blocks
    if (bestPreview) bestPreview = toHttps(bestPreview);
    if (bestArt) bestArt = toHttps(bestArt);

    // 4) Save into our songs array
    setSongs((prev) => {
      const idx = prev.findIndex((s) => s.__id === song.__id);
      if (idx === -1) return prev;
      const cur = prev[idx];
      const nextVals = {
        ...cur,
        __preview: bestPreview ?? null,
        __art: bestArt ?? null,
      };
      if (cur.__preview === nextVals.__preview && cur.__art === nextVals.__art) return prev;
      const copy = prev.slice();
      copy[idx] = nextVals;
      return copy;
    });

    return { preview: bestPreview ?? null, art: bestArt ?? null };
  },
  [setSongs, findTrackMeta] // <-- include findTrackMeta here
);

  // Audio element factory
  const makeAudio = (url) => {
    const a = new Audio(url);
    a.preload = "auto";
    a.onended = () => setPreviewing(false);
    a.onerror = () => {
      const code = a.error?.code; // 1=ABORTED,2=NETWORK,3=DECODE,4=SRC_NOT_SUPPORTED
      console.error("Audio element error", a.error, "url:", url);
      setPreviewing(false);
      setPreviewAudio(null);
      alert(`Audio error (${code ?? "?"}): Couldn't load or decode the preview.`);
    };
    return a;
  };

  const tryPlay = async (audio) => {
    const probe = document.createElement("audio");
    const supportsAAC =
      probe.canPlayType('audio/mp4; codecs="mp4a.40.2"') || probe.canPlayType("audio/aac");
    if (!supportsAAC) {
      alert("This browser can't play AAC/M4A previews.");
      return;
    }
    try {
      await audio.play();
    } catch (err) {
      console.error("audio.play() failed", err);
      setPreviewing(false);
      setPreviewAudio(null);
      alert(
        err?.name === "NotAllowedError"
          ? "Playback was blocked by the browser. Tap the button again."
          : `Couldn't play the preview. ${err?.message ?? ""}`
      );
    }
  };

  const togglePreview = useCallback(async () => {
  if (previewing) {
    stopPreview();
    return;
  }

  const song = current;
  if (!song) return;

  // If we don't have a preview yet, try to fetch it now.
  if (!song.__preview) {
    setPreviewPreparing(true);
    const meta = await ensureMeta(song).catch(() => null);
    setPreviewPreparing(false);

    // If still no preview after fetching, let the user know and bail.
    if (!meta?.preview) {
      alert("No 30s preview available for this track.");
      return;
    }

    // Try playing immediately. Some mobile browsers still require a second tap,
    // in which case our tryPlay() will show a helpful message.
    const a = makeAudio(toHttps(meta.preview));
    setPreviewAudio(a);
    setPreviewing(true);
    await tryPlay(a);
    return;
  }

  // We have a cached preview: play immediately.
  const a = makeAudio(toHttps(song.__preview));
  setPreviewAudio(a);
  setPreviewing(true);
  await tryPlay(a);
}, [previewing, stopPreview, current, ensureMeta]);

  // stop preview when changing card
  useEffect(() => {
    if (!previewAudio) return;
    try {
      previewAudio.pause();
    } catch {}
    setPreviewAudio(null);
    setPreviewing(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index]);

  // cleanup previous audio on change/unmount
  useEffect(() => {
    return () => {
      try {
        previewAudio?.pause();
      } catch {}
    };
  }, [previewAudio]);

// prefetch current + next preview; retry if either preview or art is missing
useEffect(() => {
  if (current) {
    const hasPreview = !!current.__preview;
    const hasArt = !!current.__art;
    ensureMeta(current, { force: !(hasPreview && hasArt) });
  }
  if (nextSong) {
    const hasPreview = !!nextSong.__preview;
    const hasArt = !!nextSong.__art;
    ensureMeta(nextSong, { force: !(hasPreview && hasArt) });
  }
}, [current, nextSong, ensureMeta]);


  /* ---- swipe logic ---- */
  const flingAndCommit = useCallback(
    (status, dir) => {
      if (!current || fling.active) return;

      const OFF_X = Math.max(window.innerWidth, 800) * 1.2;
      const OFF_Y = Math.max(window.innerHeight, 600) * 1.2;

      let toX = 0,
        toY = 0,
        rotate = 0;
      if (dir === "Left") {
        toX = -OFF_X;
        rotate = -15;
      } else if (dir === "Right") {
        toX = OFF_X;
        rotate = 15;
      } else if (dir === "Up") {
        toY = -OFF_Y;
      } else if (dir === "Down") {
        toY = OFF_Y;
      }

      stopPreview();

      setFling({ active: true, toX, toY, rotate, id: current.__id });

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
    [current, fling.active, songs.length, setChoices, setIndex, stopPreview]
  );

  const onYes = useCallback(() => flingAndCommit("yes", "Right"), [flingAndCommit]);
  const onNo = useCallback(() => flingAndCommit("no", "Left"), [flingAndCommit]);
  const onStar = useCallback(() => flingAndCommit("star", "Up"), [flingAndCommit]);
  const onSkip = useCallback(() => flingAndCommit("skip", "Down"), [flingAndCommit]);

  const onUndo = useCallback(() => {
    stopPreview();
    if (index === 0) return;
    const prevSong = songs[index - 1];
    if (prevSong) {
      setChoices((c) => {
        const { [prevSong.__id]: _removed, ...rest } = c;
        return rest;
      });
    }
    setIndex((i) => Math.max(i - 1, 0));
  }, [index, songs, setChoices, setIndex, stopPreview]);

  const swipeHandlers = useSwipeable({
    onSwiping: (e) => {
      if (fling.active || !current) return;
      setDrag({ dx: e.deltaX, dy: e.deltaY, active: true });
    },
    onSwiped: () => {
      if (fling.active || !current) return;
      setDrag({ dx: 0, dy: 0, active: false });
    },
    onSwipedLeft: () => !fling.active && current && onNo(),
    onSwipedRight: () => !fling.active && current && onYes(),
    onSwipedUp: () => !fling.active && current && onStar(),
    onSwipedDown: () => !fling.active && current && onSkip(),
    preventScrollOnSwipe: true,
    trackMouse: true,
  });

  // reset transforms when index changes
  useEffect(() => {
    setFling({ active: false, toX: 0, toY: 0, rotate: 0, id: null });
    setDrag({ dx: 0, dy: 0, active: false });
  }, [index]);

  /* ---- bootstrap default list on first visit ---- */
  useEffect(() => {
    if (songs.length > 0) return;
    const url = `${process.env.PUBLIC_URL || ""}/default-songs.jsonl`;
    (async () => {
      try {
        const res = await fetch(url);
        if (!res.ok) return;
        const text = await res.text();
        const rows = parseJSONL(text);
        const mapped = rows
          .map((r) => {
            const title = r.title ?? r.song ?? r.Song ?? r["Song Title"] ?? r["Track"] ?? "";
            const artist = r.artist ?? r.Artist ?? r.singer ?? r["Performer"] ?? "";
            const bpm = r.bpm ?? r.BPM ?? r.tempo ?? undefined;
            const decade = r.decade ?? r.Decade ?? undefined;
            const genre = r.genre ?? r.Genre ?? undefined;
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

  // keyboard shortcuts
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

  // file ingestion
const handleFiles = async (file, mode = "replace") => {
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

  const mapped = rows
    .map((r) => {
      const title = r.title ?? r.song ?? r.Song ?? r["Song Title"] ?? r["Track"] ?? "";
      const artist = r.artist ?? r.Artist ?? r.singer ?? r["Performer"] ?? "";
      const bpm = r.bpm ?? r.BPM ?? r.tempo ?? undefined;
      const decade = r.decade ?? r.Decade ?? undefined;
      const genre = r.genre ?? r.Genre ?? undefined;
      return { __id: uid(), title: String(title).trim(), artist: String(artist || "").trim(), bpm, decade, genre };
    })
    .filter((r) => r.title);

  const clean = dedupeSongs(mapped);

  if (mode === "add") {
    setSongs((prev) => {
      const before = prev.length;
      const next = dedupeSongs([...prev, ...clean]);
      const added = next.length - before;
      if (added > 0) {
        showToast(`${added} ${added === 1 ? "song" : "songs"} added`);
      } else {
        showToast("No new songs added (all duplicates)");
      }
      return next;
    });
  } else {
    setSongs(clean);
    setIndex(0);
    setChoices({});
    showToast(`Replaced with ${clean.length} ${clean.length === 1 ? "song" : "songs"}`);
  }
};

  // 1) Full playlist export (CSV)
const exportPlaylist = () => {
  const approved = yesList.filter((s) => !starList.includes(s));
  const ordered = [...starList, ...approved];
  if (!ordered.length) {
    alert("No songs to export yet. Approve or star some songs first.");
    return;
  }
  const rows = ordered.map((s) => ({ title: s.title, artist: s.artist || "" }));
  const csv = Papa.unparse(rows);
  download("playlist.csv", csv);
  maybeOfferCoffee(); // show donation prompt (once per browser)
};


  const handleExportToSpotify = useCallback(async () => {
    if (!starList.length && !yesList.length) {
      alert("No songs to export yet. Approve or star some songs first.");
      return;
    }
    if (!spUser) {
      spotifyLogin();
      return;
    }
    const url = await exportToSpotify(starList, yesList);
    if (url) window.open(url, "_blank", "noopener,noreferrer");
  }, [spUser, spotifyLogin, exportToSpotify, starList, yesList]);
  const onExportSpotify = useCallback(() => {
  requirePro(() => { void handleExportToSpotify(); });
}, [requirePro, handleExportToSpotify]);


  // 2) Buckets export (3 CSVs)
const exportBuckets = () => {
  const toCSV = (arr) => Papa.unparse(arr.map((s) => ({ title: s.title, artist: s.artist })));
  download("must-haves.csv", toCSV(starList));
  download("approved.csv", toCSV(yesList.filter((s) => !starList.includes(s))));
  download("no-thanks.csv", toCSV(noList));
  maybeOfferCoffee(); // show donation prompt (once per browser)
};

  const resetAll = () => {
    stopPreview();
    const ok = window.confirm("Start over and shuffle the order?");
    if (!ok) return;
    setChoices({});
    setIndex(0);
    setSongs((prev) => shuffle(prev));
  };

  const remaining = songs.length - Math.min(index, songs.length);

  // transforms & overlays
  const rotation = Math.max(-ROTATE_LIMIT, Math.min(ROTATE_LIMIT, drag.dx / 12));
  const yesOpacity = drag.dx > 0 ? Math.min(Math.abs(drag.dx) / H_THRESHOLD, 1) : 0;
  const noOpacity = drag.dx < 0 ? Math.min(Math.abs(drag.dx) / H_THRESHOLD, 1) : 0;
  const starOpacity = drag.dy < 0 ? Math.min(Math.abs(drag.dy) / V_THRESHOLD, 1) : 0;
  const skipOpacity = drag.dy > 0 ? Math.min(Math.abs(drag.dy) / V_THRESHOLD, 1) : 0;

  const dragAmount = Math.min(
    Math.max(Math.abs(drag.dx) / H_THRESHOLD, Math.abs(drag.dy) / V_THRESHOLD),
    1
  );
  const nextScale = fling.active ? 1.0 : drag.active ? 0.98 + 0.02 * dragAmount : 0.98;
  const nextOpacity = fling.active ? 1.0 : drag.active ? 0.9 + 0.1 * dragAmount : 0.9;

  /* ---------- UI ---------- */
  return (
    <div className="min-h-screen bg-gradient-to-b from-rose-50 via-white to-sky-50 text-slate-900">
      <header className="sticky top-0 z-10 backdrop-blur bg-gradient-to-r from-rose-50 to-sky-50 border-b border-pink-200/60">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center gap-3">
         <h1 className="text-xl font-semibold text-pink-900">Swipe to Dance</h1>

<div className="ml-auto flex items-center gap-2">
 {/* Upload (with Add / Replace menu) */}
<div className="relative" ref={uploadMenuRef}>
 <button
  onClick={() => setUploadOpen((v) => !v)}
  className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-pink-200 text-pink-900 text-sm hover:bg-pink-300"
>
  <Upload size={16} /> Upload your own songs <span className="text-pink-800/80">(Pro)</span>
</button>

  {uploadOpen && (
    <div className="absolute right-0 mt-2 w-64 rounded-xl border border-pink-200 bg-white shadow-lg overflow-hidden z-20">
      <button
  className="w-full text-left px-3 py-2 text-sm hover:bg-rose-50"
  onClick={triggerUploadAdd}
>
  Add to existing songs <span className="text-pink-700/70">(Pro)</span>
</button>
     <button
  className="w-full text-left px-3 py-2 text-sm hover:bg-rose-50"
  onClick={triggerUploadReplace}
>
  Replace songs <span className="text-pink-700/70">(Pro)</span>
</button>
    </div>
  )}
</div>

<input
  ref={fileInputRef}
  type="file"
  accept=".csv,.json,.jsonl,.ndjson"
  className="hidden"
  onChange={(e) => handleFiles(e.target.files?.[0], pendingUploadModeRef.current)}
/>


  <div className="relative" ref={exportMenuRef}>
    <button
      onClick={() => setExportOpen((v) => !v)}
      className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-sky-200 text-sky-900 text-sm hover:bg-sky-300 disabled:opacity-50"
      disabled={!songs.length}
    >
      <Download size={16} /> Export
    </button>

    {exportOpen && (
      <div className="absolute right-0 mt-2 w-64 rounded-xl border border-pink-200 bg-white shadow-lg overflow-hidden z-20">
        <button
          className="w-full text-left px-3 py-2 text-sm hover:bg-rose-50"
          onClick={() => {
            exportPlaylist();
            setExportOpen(false);
          }}
        >
          Export playlist (CSV)
        </button>

       <button
  className="w-full px-3 py-2 text-sm hover:bg-sky-50 disabled:opacity-50 flex items-center justify-between"
  onClick={() => {
    requirePro(() => { void handleExportToSpotify(); }); // gate with Pro
    setExportOpen(false);
  }}
  disabled={spBusy}
>
  <span className="text-left">
    Export to Spotify <span className="text-pink-700/70">(Pro)</span> {spBusy ? "…" : ""}
  </span>
  <span className="ml-2 inline-flex items-center gap-1 text-xs">
    <span className={`w-2 h-2 rounded-full ${spUser ? "bg-emerald-500" : "bg-slate-300"}`} />
    <span className={spUser ? "text-emerald-700" : "text-slate-500"}>
      {spUser ? "connected" : "not connected"}
    </span>
  </span>
</button>


        <button
          className="w-full text-left px-3 py-2 text-sm hover:bg-rose-50"
          onClick={() => {
            exportBuckets();
            setExportOpen(false);
          }}
        >
          Export all buckets (3 CSVs)
        </button>
      </div>
    )}
  </div>

  <button
    onClick={resetAll}
    className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-white border border-sky-200 text-sky-900 text-sm hover:bg-sky-50"
  >
    Reset
  </button>
</div>


        </div>

        <div className="h-1 w-full bg-pink-100">
          <div className="h-full bg-pink-400" style={{ width: `${progress * 100}%` }} />
        </div>

        {spMsg ? <div className="text-xs text-pink-700/70 text-center py-1">{spMsg}</div> : null}
      </header>

      <main className="max-w-5xl mx-auto px-4 py-10">
        {!songs.length ? (
          <div className="grid place-items-center text-center py-24">
            <div className="max-w-xl">
              <h2 className="text-2xl font-semibold mb-2">Import your song list</h2>
              <p className="text-slate-600 mb-6">
                Accepted formats: CSV or JSONL. Include at least a title field, artist is optional. Duplicate titles and
                artists will be auto merged.
              </p>
              <button
                className="inline-flex items-center gap-2 px-4 py-3 rounded-2xl bg-pink-200 text-pink-900 hover:bg-pink-300"
                onClick={triggerUploadReplace}
              >
                <Upload /> Upload your own songs
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            {/* swipe card */}
            <section {...swipeHandlers} className="select-none touch-none overscroll-contain">
              <div className="relative mx-auto w-full max-w-md md:max-w-lg">
                {/* next card preview */}
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
                      <div className="text-sm text-slate-500">
                        Song {Math.min(index + 2, songs.length)} of {songs.length} • Remaining {Math.max(remaining - 1, 0)}
                      </div>

                      <div className="text-center py-8">
                        <div className="text-3xl font-bold tracking-tight">{nextSong.title}</div>

                        {nextSong.__art ? (
                          <img
                            src={toHttps(nextSong.__art)}
                            alt={`${nextSong.title} cover`}
                            className="mx-auto mt-4 w-28 h-28 rounded-xl shadow-md object-cover"
                            loading="lazy"
                          />
                        ) : null}

                        {nextSong.artist ? <div className="text-lg text-slate-600 mt-2">{nextSong.artist}</div> : null}

                        <div className="mt-4 flex justify-center gap-3 text-xs text-slate-500">
                          {nextSong.genre ? <span className="px-2 py-1 rounded-full bg-slate-100">{nextSong.genre}</span> : null}
                          {nextSong.decade ? <span className="px-2 py-1 rounded-full bg-slate-100">{nextSong.decade}</span> : null}
                          {nextSong.bpm ? <span className="px-2 py-1 rounded-full bg-slate-100">{nextSong.bpm} BPM</span> : null}
                        </div>
                      </div>

                      <div className="flex items-center justify-center gap-3 pt-4 opacity-50">
                        <button aria-hidden="true" disabled className="p-3 rounded-2xl border border-slate-200 bg-white">
                          <RotateCcw />
                        </button>
                        <button aria-hidden="true" disabled className="p-4 rounded-2xl bg-red-100 text-red-700">
                          <X size={28} />
                        </button>
                        <button aria-hidden="true" disabled className="p-5 rounded-2xl bg-emerald-600 text-white">
                          <Check size={30} />
                        </button>
                        <button aria-hidden="true" disabled className="p-4 rounded-2xl bg-yellow-100 text-yellow-800">
                          <Star size={26} />
                        </button>
                        <button aria-hidden="true" disabled className="p-3 rounded-2xl border border-slate-200 bg-white">
                          <SkipForward />
                        </button>
                      </div>

                      <div className="mt-3 text-center text-xs text-slate-500">
                        Shortcuts or swipe: Left swipe = No. Right swipe or Space = Yes. Up swipe or S = Star. U or Backspace = Undo. Down
                        swipe = Skip.
                      </div>
                    </div>
                  </div>
                )}

                {/* current card */}
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
                  <div className="text-sm text-slate-500">
                    Song {Math.min(index + 1, songs.length)} of {songs.length} • Remaining {remaining}
                  </div>

                  {current ? (
                    <div className="text-center py-8">
                      <div className="text-3xl font-bold tracking-tight">{current.title}</div>

                      {current.__art ? (
                        <img
                          src={toHttps(current.__art)}
                          alt={`${current.title} cover`}
                          className="mx-auto mt-4 w-48 h-48 rounded-xl object-cover shadow"
                        />
                      ) : null}

                      {current.artist ? <div className="text-lg text-slate-600 mt-2">{current.artist}</div> : null}

                      {/* play snippet button under title/art */}
                      <div className="mt-3 flex items-center justify-center">
                        <button
                          aria-label="Preview"
                          onClick={togglePreview}
                          disabled={!current || fling.active}
                          className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border border-pink-200 bg-white hover:bg-rose-50 text-sm"
                        >
                          {previewing ? <Pause size={16} /> : <Play size={16} />}
                          <span>{previewing ? "Stop snippet" : previewPreparing ? "Preparing…" : "Play snippet"}</span>
                        </button>
                      </div>

                      <div className="mt-4 flex justify-center gap-3 text-xs text-slate-500">
                        {current.genre ? <span className="px-2 py-1 rounded-full bg-slate-100">{current.genre}</span> : null}
                        {current.decade ? <span className="px-2 py-1 rounded-full bg-slate-100">{current.decade}</span> : null}
                        {current.bpm ? <span className="px-2 py-1 rounded-full bg-slate-100">{current.bpm} BPM</span> : null}
                      </div>

                      {/* overlays */}
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

                  {/* controls */}
                  <div className="flex items-center justify-center gap-3 pt-4">
                    <button
                      aria-label="Undo"
                      onClick={onUndo}
                      disabled={fling.active}
                      className="p-3 rounded-2xl border border-slate-200 bg-white hover:bg-slate-50"
                    >
                      <RotateCcw />
                    </button>
                    <button
                      aria-label="No"
                      onClick={onNo}
                      disabled={fling.active}
                      className="p-4 rounded-2xl bg-red-100 text-red-700 hover:bg-red-200"
                    >
                      <X size={28} />
                    </button>
                    <button
                      aria-label="Yes"
                      onClick={onYes}
                      disabled={fling.active}
                      className="p-5 rounded-2xl bg-emerald-600 text-white hover:bg-emerald-500"
                    >
                      <Check size={30} />
                    </button>
                    <button
                      aria-label="Star"
                      onClick={onStar}
                      disabled={fling.active}
                      className="p-4 rounded-2xl bg-yellow-100 text-yellow-800 hover:bg-yellow-200"
                    >
                      <Star size={26} />
                    </button>
                    <button
                      aria-label="Skip"
                      onClick={onSkip}
                      disabled={fling.active}
                      className="p-3 rounded-2xl border border-slate-200 bg-white hover:bg-slate-50"
                    >
                      <SkipForward />
                    </button>
                  </div>

                  <div className="mt-3 text-center text-xs text-slate-500">
                    Shortcuts or swipe: Left swipe = No. Right swipe or Space = Yes. Up swipe or S = Star. U or Backspace = Undo. Down swipe =
                    Skip.
                  </div>
                </div>
              </div>
            </section>

            {/* sidebar under the card (stacked layout) */}
            <aside className="space-y-4">
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

      <footer className="py-6 text-center text-xs text-slate-500">
        Made for choosing bangers, not ballads only. Choose responsibly.
      </footer>
      {coffeeOpen && (
  <div className="fixed inset-0 z-50 grid place-items-center bg-black/40">
    <div className="w-[min(92vw,420px)] rounded-2xl bg-white shadow-xl border border-pink-200 p-5">
      <h3 className="text-lg font-semibold mb-1">Enjoying Swipe to Dance?</h3>
      <p className="text-slate-600 mb-4">
        If this saved you time, you can buy me a coffee ☕
      </p>
      <div className="flex items-center justify-end gap-2">
        <button
          onClick={() => setCoffeeOpen(false)}
          className="px-3 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-sm"
        >
          Maybe later
        </button>
        <a
          href={DONATION_URL}
          target="_blank"
          rel="noreferrer"
          onClick={() => setCoffeeOpen(false)}
          className="px-3 py-2 rounded-xl bg-amber-200 text-amber-900 hover:bg-amber-300 text-sm"
        >
          Buy me a coffee
        </a>
      </div>
    </div>
  </div>
)}

      {payOpen ? (
  <div className="fixed inset-0 z-50 flex items-center justify-center">
    <div className="absolute inset-0 bg-black/40" onClick={cancelPay} />
    <div className="relative z-10 w-full max-w-md rounded-2xl bg-white shadow-xl border border-pink-200 p-5">
      <div className="text-lg font-semibold text-pink-900">Unlock Pro</div>
      <p className="mt-1 text-sm text-slate-600">
        Pro lets you <strong>upload your own songs</strong> and <strong>export to Spotify</strong>.
      </p>
      <div className="mt-4 flex items-center justify-between rounded-xl border border-pink-100 bg-rose-50/60 p-3">
        <div>
          <div className="text-sm font-medium text-pink-900">One-time purchase</div>
          <div className="text-xs text-pink-800/80">Lifetime access</div>
        </div>
        <div className="text-xl font-bold text-pink-900">$5</div>
      </div>
      <div className="mt-4 flex gap-2 justify-end">
        <button
          onClick={cancelPay}
          className="px-3 py-2 rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-50"
        >
          Not now
        </button>
        <button
          onClick={unlockPro}
          className="px-3 py-2 rounded-lg bg-pink-600 text-white hover:bg-pink-500"
        >
          Unlock Pro
        </button>
      </div>
    </div>
  </div>
) : null}

      {toast ? (
  <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50">
    <div className="rounded-xl border border-pink-200 bg-white/95 shadow-lg px-4 py-2 text-sm text-pink-900">
      {toast}
    </div>
  </div>
) : null}
    </div>
  );
}

/* ---------- tiny UI helpers ---------- */
function Panel({ title, children }) {
  return (
    <div className="rounded-2xl bg-white/90 border border-pink-200 shadow-sm">
      <div className="px-4 py-3 border-b border-pink-100 bg-rose-50/60 text-pink-900 font-medium rounded-t-2xl">
        {title}
      </div>
      <div className="p-4">{children}</div>
    </div>
  );
}

function Stat({ label, value }) {
  return (
    <div className="rounded-xl bg-sky-50 border border-sky-100 p-3">
      <div className="text-2xl font-bold text-sky-900">{value}</div>
      <div className="text-xs text-sky-700/80">{label}</div>
    </div>
  );
}

function PeekList({ title, items }) {
  const MAX = 6;
  return (
    <div className="mb-3">
      <div className="text-xs font-semibold text-slate-500 mb-1">
        {title} ({items.length})
      </div>
      <div className="space-y-1 max-h-48 overflow-auto pr-1">
        {items.slice(0, MAX).map((s, i) => (
          <div key={s.__id} className="text-sm truncate">
            {i + 1}. {s.title}
            {s.artist ? ` — ${s.artist}` : ""}
          </div>
        ))}
        {items.length > MAX ? <div className="text-xs text-slate-400">+ {items.length - MAX} more</div> : null}
      </div>
    </div>
  );
}
