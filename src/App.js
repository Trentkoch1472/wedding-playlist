import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import OnboardingScreen from "./OnboardingScreen";
import ExportScreen from "./ExportScreen";
import { useSwipeable } from "react-swipeable";
import Papa from "papaparse";
import useSpotify from "./useSpotify";
import { supabase } from "./lib/supabase";
import {
  X,
  Check,
  Star,
  Upload,
  RotateCcw,
  SkipForward,
  Play,
  Pause,
  Settings,
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


// iOS check in module scope to avoid hook dependency warnings
const IS_IOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;

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
  // Spotify must always send users back to ONE exact URL
  const SPOTIFY_REDIRECT_URI = "https://swipedj.app/callback";


  const {
    user: spUser,
    busy: spBusy,
    msg: spMsg,
    login: spotifyLogin,
    exportToSpotify,
    findTrackMeta,
  } = useSpotify({
    clientId: "7ced125c87d944d09bb2a301f8576fb8",
    redirectUri: SPOTIFY_REDIRECT_URI
  });
  
  const fileInputRef = useRef(null);

  const pendingUploadModeRef = useRef("replace"); // "add" | "replace"

  // Bottom tab navigation
  const [activeTab, setActiveTab] = useState('swipe');

  // Settings drawer
  const [drawerOpen, setDrawerOpen] = useState(false);

  // Dark mode
  const [darkMode, setDarkMode] = useState(true);

  // Export screen — persisted so Spotify OAuth redirect doesn't send user back to swipe screen
  const [showExport, setShowExport] = useLocalState("wps_show_export", false);

  // Handlers for Upload menu
const triggerUploadAdd = () => {
  setDrawerOpen(false);
  requirePro(() => {
    if (window.confirm(
      "CSV Upload Requirements:\n\n" +
      "• File must be CSV format (.csv), not Excel (.xlsx)\n" +
      "• First row must be headers (title, artist)\n" +
      "• Example:\n" +
      "  title,artist\n" +
      "  Sweet Caroline,Neil Diamond\n\n" +
      "Also accepts: song/Song/Track and artist/Artist/Performer\n\n" +
      "Click OK to select your file."
    )) {
      pendingUploadModeRef.current = "add";
      fileInputRef.current?.click();
    }
  });
};

const triggerUploadReplace = () => {
  setDrawerOpen(false);
  requirePro(() => {
    if (window.confirm(
      "CSV Upload Requirements:\n\n" +
      "• File must be CSV format (.csv), not Excel (.xlsx)\n" +
      "• First row must be headers (title, artist)\n" +
      "• Example:\n" +
      "  title,artist\n" +
      "  Sweet Caroline,Neil Diamond\n\n" +
      "Also accepts: song/Song/Track and artist/Artist/Performer\n\n" +
      "⚠️ This will REPLACE all current songs!\n\n" +
      "Click OK to select your file."
    )) {
      pendingUploadModeRef.current = "replace";
      fileInputRef.current?.click();
    }
  });
};

  // Close drawer on ESC
  useEffect(() => {
    const onKey = (e) => { if (e.key === "Escape") setDrawerOpen(false); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  // Set browser tab title
  useEffect(() => {
    document.title = "SwipeDJ";
  }, []);


// Keep your existing auto-start login useEffect as-is
useEffect(() => {
  const url = new URL(window.location.href);
  if (url.searchParams.get("connect") === "1") {
    url.searchParams.delete("connect");
    window.history.replaceState({}, document.title, url.pathname + (url.searchParams.toString() ? `?${url.searchParams}` : "") + url.hash);
    if (!spUser) {
      // kick off Spotify PKCE flow on the SAME origin as redirect_uri
      spotifyLogin();
    }
  }
}, [spUser, spotifyLogin]);


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
  const [onboarded, setOnboarded] = useLocalState("wps_onboarded", false);
  const [songs, setSongs] = useLocalState("wps_songs", []);
  const [index, setIndex] = useLocalState("wps_index", 0);
  const [choices, setChoices] = useLocalState("wps_choices", {});
  // Donation prompt (show once per browser unless cleared)
  const [coffeeOpen, setCoffeeOpen] = useState(false);
  const [coffeeOffered, setCoffeeOffered] = useLocalState("wps_coffee_offered", false);

// Store original default songs for reset
const defaultSongsRef = useRef(null);

  const maybeOfferCoffee = useCallback(() => {
    if (coffeeOffered) return;
    setCoffeeOpen(true);
    setCoffeeOffered(true);
  }, [coffeeOffered, setCoffeeOffered]);

  // --- Pro gating ---
  const [proUnlocked, setProUnlocked] = useLocalState("wps_pro", false);
  const [hasSwipedOnce, setHasSwipedOnce] = useLocalState("wps_hasSwipedOnce", false);
  const [hintFading, setHintFading] = useState(false);
  const hasSwipedOnceRef = useRef(hasSwipedOnce);
  const clientIdRef = useRef(localStorage.getItem('swipedj_client_id'));
  // Reactive version so ExportScreen re-evaluates when Spotify connects after redirect
  const [isLinkedToDJ, setIsLinkedToDJ] = useState(() => !!localStorage.getItem('swipedj_client_id'));
  const [payOpen, setPayOpen] = useState(false);
  const pendingActionRef = useRef(null);

  const requirePro = useCallback(
    (fn) => {
      if (proUnlocked) {
        fn();
      } else {
        pendingActionRef.current = fn;
        setPayOpen(true);
      }
    },
    [proUnlocked]
  );


  const cancelPay = useCallback(() => {
    pendingActionRef.current = null;
    setPayOpen(false);
  }, []);

const startCheckout = useCallback(async () => {
  try {
    const r = await fetch(`/api/create-checkout-session`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({})
    });
    const j = await r.json();
    if (j?.url) {
      setPayOpen(false);
      window.location.assign(j.url);
    } else {
      alert("Couldn't start checkout" + (j?.error ? `: ${j.error}` : "."));
    }
  } catch (e) {
    console.error(e);
    alert("Checkout error: " + (e?.message || "Network"));
  }
}, [setPayOpen]);

  // Theme for cards
  const themes = [
    { bg: "bg-white", border: "border-stone-100" },
    { bg: "bg-[#fafafa]", border: "border-stone-100" },
  ];
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

  // Verify Stripe session on return
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const sid = params.get("session_id");
    if (!sid) return;

    (async () => {
      try {
       const r = await fetch(`/api/verify-session?session_id=${sid}`);
        const j = await r.json();
        if (j.ok) {
          setProUnlocked(true);
          showToast("Pro unlocked — thanks!");
        } else {
          showToast("Payment not verified. Try again.");
        }
      } catch (e) {
        console.error(e);
        showToast("Verification error.");
      } finally {
        params.delete("session_id");
        const qs = params.toString();
        const clean = window.location.pathname + (qs ? `?${qs}` : "");
        window.history.replaceState({}, document.title, clean);
      }
    })();
  }, [showToast, setProUnlocked]);

  // Resolve DJ invite token → client ID on first load
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const token = params.get("client");
    if (!token) return;

    // If we already have a stored client ID for this token, skip the lookup
    if (clientIdRef.current) return;

    (async () => {
      const { data, error } = await supabase
        .from('clients')
        .select('id')
        .eq('invite_token', token)
        .single();

      if (error || !data) {
        console.warn('Invite token lookup failed:', error?.message);
        return;
      }

      localStorage.setItem('swipedj_client_id', data.id);
      clientIdRef.current = data.id;
      setIsLinkedToDJ(true);

      // Clean token from URL without triggering a reload
      params.delete("client");
      const qs = params.toString();
      const clean = window.location.pathname + (qs ? `?${qs}` : "");
      window.history.replaceState({}, document.title, clean);
    })();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Derived lists
  const yesList = useMemo(
    () => songs.filter((s) => choices[s.__id]?.status === "yes" || choices[s.__id]?.status === "star"),
    [songs, choices]
  );
  const noList = useMemo(() => songs.filter((s) => choices[s.__id]?.status === "no"), [songs, choices]);
  const starList = useMemo(() => songs.filter((s) => choices[s.__id]?.status === "star"), [songs, choices]);

  const progress = songs.length ? Math.min(index, songs.length) / songs.length : 0;

  // Auto-navigate to export when all songs have been reviewed
  useEffect(() => {
    if (songs.length > 0 && index >= songs.length) {
      setShowExport(true);
    }
  }, [songs.length, index, setShowExport]);

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
  const ensureMeta = useCallback(
    async (song, { force = false } = {}) => {
      if (!song) return null;

      const havePreview = typeof song.__preview === "string" && song.__preview;
      const haveArt = typeof song.__art === "string" && song.__art;
      if (!force && havePreview && haveArt) {
        return { preview: song.__preview, art: song.__art };
      }

      const attempts = [`${song.artist || ""} ${song.title}`.trim(), song.title?.trim(), (song.artist || "").trim()].filter(Boolean);

      let bestPreview = havePreview ? song.__preview : null;
      let bestArt = haveArt ? song.__art : null;

    // Try iTunes first (via server-side proxy to avoid browser CORS/CSP issues)
for (const q of attempts) {
  try {
    const url = `/api/itunes?q=${encodeURIComponent(q)}`;
    const r = await fetch(url);
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
        const raw = item.artworkUrl100 || item.artworkUrl60 || null;
        if (raw) {
          // iTunes CDN supports arbitrary sizes — replace e.g. "100x100bb.jpg" → "1200x1200bb.jpg"
          bestArt = raw.replace(/\d+x\d+bb\.jpg/, "1200x1200bb.jpg");
        }
      }
    }
    if (bestPreview && bestArt) break;
  } catch (e) {
    console.error("iTunes fetch error:", e);
  }
}

      // Spotify fallback (needs token)
      if ((!bestPreview || !bestArt) && findTrackMeta) {
        try {
          const sp = await findTrackMeta(song.title, song.artist);
          if (sp) {
            if (!bestPreview && sp.preview) bestPreview = sp.preview;
            if (!bestArt && sp.art) bestArt = sp.art;
          }
        } catch {}
      }

      if (bestPreview) bestPreview = toHttps(bestPreview);
      if (bestArt) bestArt = toHttps(bestArt);

      setSongs((prev) => {
        const idx = prev.findIndex((s) => s.__id === song.__id);
        if (idx === -1) return prev;
        const cur = prev[idx];
        const nextVals = { ...cur, __preview: bestPreview ?? null, __art: bestArt ?? null };
        if (cur.__preview === nextVals.__preview && cur.__art === nextVals.__art) return prev;
        const copy = prev.slice();
        copy[idx] = nextVals;
        return copy;
      });

      return { preview: bestPreview ?? null, art: bestArt ?? null };
    },
    [setSongs, findTrackMeta]
  );

  // Audio element factory
  const makeAudio = (url) => {
    const a = new Audio();
    a.preload = "auto";
    a.crossOrigin = "anonymous";
    a.src = toHttps(url);

    a.onended = () => setPreviewing(false);
    a.onerror = () => {
      const code = a.error?.code;
      console.error("Audio element error", a.error, "url:", url);
      setPreviewing(false);
      setPreviewAudio(null);
      let errorMsg = "Couldn't load the preview.";
      if (code === 2) errorMsg = "Network error loading preview. Check your connection.";
      else if (code === 3) errorMsg = "Audio format not supported.";
      else if (code === 4) errorMsg = "Preview source not available.";
      alert(errorMsg);
    };
    return a;
  };

  const tryPlay = async (audio) => {
    try {
      if (IS_IOS) {
        audio.load();
      }

      await audio.play();
    } catch (err) {
      console.error("audio.play() failed", err);
      setPreviewing(false);
      setPreviewAudio(null);

      if (err?.name === "NotAllowedError") {
        alert("Playback was blocked. Tap the button again to play.");
      } else if (err?.name === "NotSupportedError") {
        alert("This audio format is not supported on your device.");
      } else {
        alert(`Couldn't play the preview. ${err?.message ?? ""}`);
      }
    }
  };

  const togglePreview = useCallback(async () => {
    if (previewing) {
      stopPreview();
      return;
    }

    const song = current;
    if (!song) return;

    if (!song.__preview) {
      setPreviewPreparing(true);
      await ensureMeta(song).catch(() => null);
      setPreviewPreparing(false);

      const updated = songs.find((s) => s.__id === song.__id);
      const url = updated?.__preview ? toHttps(updated.__preview) : null;

      if (!url) {
        alert("No 30s preview available for this track.");
        return;
      }

      if (IS_IOS) {
        showToast("Snippet ready, tap again to play");
        return;
      }

      const a = makeAudio(url);
      setPreviewAudio(a);
      setPreviewing(true);
      await tryPlay(a);
      return;
    }

    const a = makeAudio(toHttps(song.__preview));
    setPreviewAudio(a);
    setPreviewing(true);
    await tryPlay(a);
  }, [previewing, stopPreview, current, ensureMeta, songs, showToast]);

  // stop preview when changing card
  useEffect(() => {
    if (!previewAudio) return;
    try {
      previewAudio.pause();
    } catch {}
    setPreviewAudio(null);
    setPreviewing(false);
  }, [index]); // eslint-disable-line react-hooks/exhaustive-deps

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

  // Keep ref in sync so flingAndCommit can read it without being in deps
  hasSwipedOnceRef.current = hasSwipedOnce;

  /* ---- swipe logic ---- */
  const flingAndCommit = useCallback(
    (status, dir) => {
      if (!current || fling.active) return;

      if (!hasSwipedOnceRef.current) {
        setHintFading(true);
        window.setTimeout(() => setHasSwipedOnce(true), 600);
      }

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

          // Write swipes to Supabase if arriving from a DJ invite link
          if (clientIdRef.current && (status === "yes" || status === "no" || status === "star")) {
            const decision = status === "star" ? "must_have" : status;
            supabase.from('client_songs').insert({
              client_id: clientIdRef.current,
              spotify_track_id: current.__spotify_id ?? null,
              title: current.title,
              artist: current.artist ?? null,
              album: current.album ?? null,
              album_art_url: current.__art ?? null,
              moment: null,
              decision,
            }).then(({ error }) => {
              if (error) console.warn('client_songs insert failed:', error.message);
            });
          }
        }
        setFling({ active: false, toX: 0, toY: 0, rotate: 0, id: null });
        setDrag({ dx: 0, dy: 0, active: false });
      }, 360);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
  // Load defaults into ref on first mount, regardless of localStorage
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
          return {
            __id: uid(),
            title: String(title).trim(),
            artist: String(artist || "").trim(),
            bpm, decade, genre,
            energy: r.energy ?? undefined,
            explicit: r.explicit ?? undefined,
            language: r.language ?? undefined,
            cultural_tags: r.cultural_tags ?? [],
            suitable_for: r.suitable_for ?? [],
          };
        })
        .filter((r) => r.title);
      const clean = dedupeSongs(mapped);
      const randomized = shuffle(clean);
      
      // Always save to ref for reset functionality
      defaultSongsRef.current = randomized;
      
      // Only set as active songs if onboarding is done and localStorage is empty
      if (onboarded && songs.length === 0 && randomized.length) {
        setSongs(randomized);
        setIndex(0);
        setChoices({});
      }
    } catch (e) {
      console.warn("Default autoload skipped:", e);
    }
  })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, []); // Empty deps - run only once on mount

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
      try {
        rows = JSON.parse(text);
      } catch {
        rows = [];
      }
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
         showToast(`✅ ${added} ${added === 1 ? "song" : "songs"} successfully added!`, 'success');
        } else {
          showToast("No new songs added (all duplicates)", 'info');
        }
        return next;
      });
    } else {
      setSongs(clean);
      setIndex(0);
      setChoices({});
       showToast(`✅ Songs successfully replaced! (${clean.length} ${clean.length === 1 ? "song" : "songs"})`, 'success');
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
    maybeOfferCoffee();
  };

  const handleExportToSpotify = useCallback(
    async () => {
      if (!starList.length && !yesList.length) {
        alert("No songs to export yet. Approve or star some songs first.");
        return;
      }
      if (!spUser) {
        alert("Please connect to Spotify first (use the Connect button).");
        return;
      }
      const url = await exportToSpotify(starList, yesList);
      if (url) window.open(url, "_blank", "noopener,noreferrer");
    },
    [spUser, exportToSpotify, starList, yesList]
  );

  // 2) Buckets export (3 CSVs)

  const resetAll = () => {
  stopPreview();
  const ok = window.confirm("Reset to original song list and shuffle?");
  if (!ok) return;
  
  if (defaultSongsRef.current) {
    // Reset to original defaults
    const reshuffled = shuffle([...defaultSongsRef.current]);
    setSongs(reshuffled);
    setIndex(0);
    setChoices({});
    showToast("✅ Reset to original song list!", "success");
  } else {
    // Fallback: just reshuffle current songs if defaults haven't loaded
    setChoices({});
    setIndex(0);
    setSongs((prev) => shuffle(prev));
    showToast("⚠️ Shuffled current songs (original defaults not loaded yet)", "info");
  }
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

  if (!onboarded) {
    return (
      <OnboardingScreen
        onComplete={(filteredSongs) => {
          setSongs(filteredSongs);
          setIndex(0);
          setChoices({});
          setOnboarded(true);
        }}
      />
    );
  }

  if (showExport) {
    return (
      <ExportScreen
        acceptedSongs={yesList}
        starredSongs={starList}
        proUnlocked={proUnlocked}
        isLinkedToDJ={isLinkedToDJ}
        spUser={spUser}
        spBusy={spBusy}
        onExportCSV={exportPlaylist}
        onExportSpotify={handleExportToSpotify}
        onSpotifyLogin={spotifyLogin}
        onStartCheckout={startCheckout}
        onReset={() => {
          stopPreview();
          setSongs([]);
          setIndex(0);
          setChoices({});
          setShowExport(false);
          setOnboarded(false);
        }}
      />
    );
  }

  return (
    <div
      className="bg-[#0D0D0D] text-stone-100"
      style={{ height: '100dvh', display: 'flex', flexDirection: 'column', paddingTop: 'env(safe-area-inset-top)', overflow: 'hidden' }}
    >
      <header className="sticky top-0 z-10 backdrop-blur border-b bg-[#0D0D0D] border-[#2A2A2A]">
        <div className="max-w-sm mx-auto px-4 py-3 flex items-center gap-3">
          <img src="/swipeDJ logo.svg" alt="SwipeDJ" className="h-8 w-auto" />

          {/* Hidden file input — used by drawer upload actions */}
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv,.json,.jsonl,.ndjson"
            className="hidden"
            onChange={(e) => {
              handleFiles(e.target.files?.[0], pendingUploadModeRef.current);
              e.target.value = "";
            }}
          />

          <div className="ml-auto flex items-center gap-2">
            {/* Done */}
            <button
              type="button"
              onClick={() => setShowExport(true)}
              className={`inline-flex items-center px-3 py-1.5 rounded-lg border text-sm font-semibold transition-colors ${
                darkMode
                  ? "border-[#E8502A] text-[#E8502A] hover:bg-[#E8502A]/10"
                  : "border-[#E8502A] text-[#E8502A] hover:bg-[#E8502A]/10"
              }`}
            >
              Done
            </button>

            {/* Gear / settings */}
            <button
              type="button"
              onClick={() => setDrawerOpen(true)}
              aria-label="Settings"
              className="inline-flex items-center justify-center w-9 h-9 rounded-full transition-colors text-stone-300 hover:bg-[#2A2A2A]"
            >
              <Settings size={20} />
            </button>
          </div>
        </div>

<div className="max-w-sm mx-auto h-0.5 bg-[#2A2A2A]">
  <div className="h-full bg-[#E8502A]" style={{ width: `${progress * 100}%` }} />
</div>

        {spMsg ? <div className="text-xs text-center py-1" style={{ color: '#888888' }}>{spMsg}</div> : null}
      </header>

      {/* ── Settings drawer ─────────────────────────────── */}
      {drawerOpen && (
        <>
          {/* Overlay */}
          <div
            className="fixed inset-0 z-40 bg-black/50"
            onClick={() => setDrawerOpen(false)}
            aria-hidden="true"
          />

          {/* Panel */}
          <div className="fixed top-0 right-0 h-full w-72 z-50 flex flex-col shadow-2xl bg-[#1A1A1A] text-stone-100">
            {/* Drawer header */}
            <div
              className="flex items-center justify-between px-5 py-4 border-b border-[#2A2A2A]"
              style={{ paddingTop: 'calc(env(safe-area-inset-top) + 1rem)' }}
            >
              <span className="font-bold text-base">Settings</span>
              <button
                type="button"
                onClick={() => setDrawerOpen(false)}
                aria-label="Close settings"
                className="w-8 h-8 flex items-center justify-center rounded-full transition-colors hover:bg-[#2A2A2A] text-stone-400"
              >
                <X size={18} />
              </button>
            </div>

            {/* Drawer body */}
            <div className="flex-1 overflow-y-auto px-5 py-4 space-y-1">

              {/* Upload — Add */}
              <button
                type="button"
                onClick={triggerUploadAdd}
                className="w-full flex items-center gap-3 px-3 py-3 rounded-xl text-sm font-semibold text-left transition-colors hover:bg-[#2A2A2A]"
              >
                <Upload size={16} className="text-[#E8502A] flex-shrink-0" />
                <span>Upload songs <span className="text-xs font-normal opacity-50 ml-1">add to list</span></span>
              </button>

              {/* Upload — Replace */}
              <button
                type="button"
                onClick={triggerUploadReplace}
                className="w-full flex items-center gap-3 px-3 py-3 rounded-xl text-sm font-semibold text-left transition-colors hover:bg-[#2A2A2A]"
              >
                <Upload size={16} className="text-[#E8502A] flex-shrink-0" />
                <span>Replace song list</span>
              </button>

              <div className="my-2 h-px bg-[#2A2A2A]" />

              {/* Reset session */}
              <button
                type="button"
                onClick={() => { setDrawerOpen(false); resetAll(); }}
                className="w-full flex items-center gap-3 px-3 py-3 rounded-xl text-sm font-semibold text-left transition-colors hover:bg-[#2A2A2A]"
              >
                <RotateCcw size={16} className="text-stone-400 flex-shrink-0" />
                Reset session
              </button>

              <div className="my-2 h-px bg-[#2A2A2A]" />

              {/* Dark / light toggle */}
              <div className="flex items-center justify-between px-3 py-3 rounded-xl hover:bg-[#2A2A2A]">
                <span className="text-sm font-semibold">Dark mode</span>
                <button
                  type="button"
                  role="switch"
                  aria-checked={darkMode}
                  onClick={() => setDarkMode(v => !v)}
                  className={`relative inline-flex h-6 w-11 flex-shrink-0 rounded-full transition-colors ${
                    darkMode ? "bg-[#E8502A]" : "bg-stone-600"
                  }`}
                >
                  <span className={`absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${
                    darkMode ? "translate-x-5" : "translate-x-0"
                  }`} />
                </button>
              </div>

              {/* Spotify status */}
              <div className="flex items-center justify-between px-3 py-3 rounded-xl hover:bg-[#2A2A2A]">
                <span className="text-sm font-semibold">Spotify</span>
                {spUser ? (
                  <span className="text-xs text-emerald-400 font-semibold">Connected ✓</span>
                ) : (
                  <button
                    type="button"
                    onClick={() => {
                      setDrawerOpen(false);
                      const isSafari = /^((?!chrome|android).)*safari/i.test(navigator.userAgent);
                      if (isSafari) alert('⚠️ Note: If using Safari Private Mode, you may need to click "Connect" twice.');
                      spotifyLogin();
                    }}
                    className="text-xs font-bold text-[#E8502A] hover:underline"
                  >
                    Connect
                  </button>
                )}
              </div>

              {/* Upgrade to Pro */}
              {!proUnlocked && (
                <>
                  <div className="my-2 h-px bg-[#2A2A2A]" />
                  <button
                    type="button"
                    onClick={() => { setDrawerOpen(false); setPayOpen(true); }}
                    className="w-full flex items-center justify-between px-3 py-3 rounded-xl bg-gradient-to-r from-[#E8502A] to-[#D4A017] text-white text-sm font-bold transition-opacity hover:opacity-90"
                  >
                    <span>Upgrade to Pro</span>
                    <span className="text-xs font-normal opacity-80">$9.99 one-time</span>
                  </button>
                </>
              )}

              {proUnlocked && (
                <p className="px-3 text-xs text-[#D4A017] font-semibold">★ Pro unlocked</p>
              )}
            </div>
          </div>
        </>
      )}

      {/* ── Tab content area ─────────────────────────────── */}
      <div style={{ flex: 1, minHeight: 0, position: 'relative' }}>

        {/* ── Swipe tab ── */}
        <div
          style={{
            position: 'absolute', inset: 0,
            display: activeTab === 'swipe' ? 'flex' : 'none',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            overflow: 'hidden',
          }}
        >
          {!songs.length ? (
            <div className="text-center px-8">
              <h2 className="text-2xl font-semibold mb-2">Import your song list</h2>
              <p className="text-gray-400 mb-6">
                Accepted formats: CSV or JSONL. Include at least a title field, artist is optional.
              </p>
              <button
                className="inline-flex items-center gap-2 px-4 py-3 rounded-2xl bg-[#E8502A] text-white hover:bg-[#C43E1F]"
                onClick={triggerUploadReplace}
              >
                <Upload /> Upload your own songs
              </button>
            </div>
          ) : (
            <div style={{ width: '100%', maxWidth: '448px' }}>
            {/* swipe card */}
            <section {...swipeHandlers} className="select-none touch-none overscroll-contain">
              <div className="relative mx-auto w-full">
                {/* Ambient blur — lives in the container, BEHIND the card */}
                {current?.__art && (
                  <div
                    aria-hidden="true"
                    className="pointer-events-none absolute inset-0"
                    style={{
                      backgroundImage: `url(${toHttps(current.__art)})`,
                      backgroundSize: 'cover',
                      backgroundPosition: 'center',
                      filter: 'blur(42px)',
                      opacity: 0.45,
                      transform: 'scale(1.8)',
                      zIndex: 0,
                    }}
                  />
                )}

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
                      className={`relative rounded-[20px] ${themeNext.bg} shadow-[0_8px_32px_rgba(0,0,0,0.08)] border ${themeNext.border} p-6 md:p-8 min-h-[360px] md:min-h-[480px] flex flex-col justify-between mx-5`}
                    >
                      <div className="text-sm font-normal text-stone-400">
                        Song {Math.min(index + 2, songs.length)} of {songs.length} • Remaining {Math.max(remaining - 1, 0)}
                      </div>

                      <div className="text-center py-2">
                        <div className="text-2xl font-normal tracking-wide text-stone-800">{nextSong.title}</div>

                        {nextSong.__art ? (
                          <img
                            src={toHttps(nextSong.__art)}
                            referrerPolicy="no-referrer"
                            alt={`${nextSong.title} cover`}
                            draggable="false"
                            className="relative z-10 w-full rounded-[16px] object-cover mt-4"
                            style={{ height: '260px', imageRendering: 'high-quality', pointerEvents: 'none' }}
                          />
                        ) : null}

                        {nextSong.artist ? <div className="text-base font-normal text-stone-500 mt-3">{nextSong.artist}</div> : null}

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
                        <button aria-hidden="true" disabled className="p-5 rounded-2xl bg-[#C43E1F] text-white">
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
                        Left swipe = No. Right swipe or Space = Yes. Up swipe or S = Star. Down swipe = Skip.
                      </div>
                    </div>
                  </div>
                )}

                {/* current card */}
                <div
                  key={current ? current.__id : "empty"}
                  className="relative rounded-[20px] transition-shadow px-6 md:px-8 pt-3 pb-4 flex flex-col mx-5"
                  style={{
                    background: '#FFFFFF',
                    boxShadow: '0 8px 40px rgba(0,0,0,0.4)',
                    zIndex: 1,
                    willChange: 'transform',
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
                  <div className="relative z-10 text-sm mb-3" style={{ color: '#888888' }}>
                    Song {Math.min(index + 1, songs.length)} of {songs.length} • Remaining {remaining}
                  </div>

                  {current ? (
                    <>
                      {/* Album art — full card width, 260px tall */}
                      {current.__art ? (
                        <img
                          src={toHttps(current.__art)}
                          crossOrigin="anonymous"
                          referrerPolicy="no-referrer"
                          alt={`${current.title} cover`}
                          draggable="false"
                          className="relative z-10 w-full rounded-[16px] object-cover"
                          style={{ height: '260px', imageRendering: 'high-quality', WebkitUserDrag: 'none', userSelect: 'none', pointerEvents: 'none' }}
                        />
                      ) : null}

                      {/* Decade / genre tag — top-right corner of card interior */}
                      {(current.decade || current.genre) && (
                        <div className="absolute top-3 right-3 z-20 flex gap-1">
                          {current.decade ? (
                            <span style={{ background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(6px)', borderRadius: '999px', fontSize: '11px', fontWeight: 500, color: '#ffffff', padding: '3px 10px' }}>{current.decade}</span>
                          ) : null}
                          {current.genre ? (
                            <span style={{ background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(6px)', borderRadius: '999px', fontSize: '11px', fontWeight: 500, color: '#ffffff', padding: '3px 10px' }}>{current.genre}</span>
                          ) : null}
                        </div>
                      )}

                      {/* Title + Artist — below art */}
                      <div className="relative z-10 text-center mt-4">
                        <div className="text-2xl font-black leading-tight text-[#1A1A1A]">{current.title}</div>
                        {current.artist ? <div className="text-base font-semibold mt-1 text-gray-500">{current.artist}</div> : null}
                      </div>

                      {/* Play snippet button */}
                      <div className="relative z-10 mt-4 w-full">
                        <button
                          aria-label="Preview"
                          onClick={togglePreview}
                          disabled={!current || fling.active}
                          className="w-full inline-flex items-center justify-center gap-2 px-6 py-3 rounded-full bg-[#E8502A] text-white font-bold transition-colors disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#E8502A] focus-visible:ring-offset-2"
                        >
                          {previewing ? <Pause size={16} /> : <Play size={16} />}
                          <span>{previewing ? "Stop snippet" : previewPreparing ? "Preparing…" : "Play snippet"}</span>
                        </button>
                      </div>

                      {/* BPM tag below play button if present */}
                      {current.bpm ? (
                        <div className="relative z-10 mt-2 flex justify-center">
                          <span style={{ background: '#f0f0f0', borderRadius: '999px', fontSize: '12px', fontWeight: 500, color: '#666666', padding: '4px 12px' }}>{current.bpm} BPM</span>
                        </div>
                      ) : null}

                      {/* Action buttons */}
                      <div className="relative z-10 mt-4 pb-1 flex flex-col items-center gap-3">
                        <div className="flex items-center justify-between w-full">

                          {/* Undo — ghost, 40px */}
                          <button
                            aria-label="Undo"
                            onClick={onUndo}
                            disabled={fling.active}
                            className="w-10 h-10 rounded-full flex items-center justify-center transition-transform active:scale-[0.92] disabled:opacity-40"
                            style={{ color: '#666666' }}
                          >
                            <RotateCcw size={16} />
                          </button>

                          {/* No/X — 52px, dark bg, coral icon */}
                          <button
                            aria-label="No"
                            onClick={onNo}
                            disabled={fling.active}
                            className="w-[52px] h-[52px] rounded-full flex items-center justify-center transition-transform active:scale-[0.92] disabled:opacity-40"
                            style={{ background: '#1C1C1E', color: '#E8502A' }}
                          >
                            <X size={20} />
                          </button>

                          {/* Yes/Check — 64px, orange fill, shadow */}
                          <button
                            aria-label="Yes"
                            onClick={onYes}
                            disabled={fling.active}
                            className="w-16 h-16 rounded-full bg-[#E8502A] text-white flex items-center justify-center transition-transform active:scale-[0.92] disabled:opacity-40 shadow-[0_4px_14px_rgba(232,80,42,0.45)]"
                          >
                            <Check size={26} />
                          </button>

                          {/* Star — 52px, dark bg, gold icon */}
                          <button
                            aria-label="Star"
                            onClick={onStar}
                            disabled={fling.active}
                            className="w-[52px] h-[52px] rounded-full flex items-center justify-center transition-transform active:scale-[0.92] disabled:opacity-40"
                            style={{ background: '#1C1C1E', color: '#D4A017' }}
                          >
                            <Star size={20} />
                          </button>

                          {/* Skip — ghost, 40px */}
                          <button
                            aria-label="Skip"
                            onClick={onSkip}
                            disabled={fling.active}
                            className="w-10 h-10 rounded-full flex items-center justify-center transition-transform active:scale-[0.92] disabled:opacity-40"
                            style={{ color: '#666666' }}
                          >
                            <SkipForward size={16} />
                          </button>

                        </div>
                        {!hasSwipedOnce && (
                          <p
                            className="text-xs text-center"
                            style={{ color: '#888888', opacity: hintFading ? 0 : 1, transition: 'opacity 600ms ease-out' }}
                          >
                            Swipe left to pass, swipe right to add
                          </p>
                        )}
                      </div>

                      {/* Swipe direction overlays */}
                      <div className="pointer-events-none">
                        <div
                          className="absolute left-4 top-4 text-green-700/70 bg-green-50/50 border border-green-200/30 rounded-lg px-3 py-1 text-sm font-normal"
                          style={{ opacity: yesOpacity }}
                        >
                          ✓ Yes
                        </div>
                        <div
                          className="absolute left-4 top-4 text-green-700/70 bg-green-50/50 border border-green-200/30 rounded-lg px-3 py-1 text-sm font-normal"
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
                    </>
                  ) : (
                    <div className="text-center py-16">
                      <div className="text-2xl font-semibold">You have reviewed all songs</div>
                      <p className="text-gray-400 mt-2">Export your results or reset to start again.</p>
                    </div>
                  )}

                </div>
              </div>
            </section>


            </div>
          )}
        </div>

        {/* ── Your List tab ── */}
        <div
          style={{
            position: 'absolute', inset: 0,
            display: activeTab === 'list' ? 'block' : 'none',
            overflowY: 'auto',
            WebkitOverflowScrolling: 'touch',
          }}
        >
          <div style={{ padding: '16px', paddingBottom: 'calc(env(safe-area-inset-bottom) + 72px)' }}>

            {/* Stats row */}
            <div style={{ display: 'flex', gap: '12px', marginBottom: '24px' }}>
              <Stat label="Must Haves" value={starList.length} />
              <Stat label="Yes" value={yesList.length} />
              <Stat label="No" value={noList.length} />
            </div>

            {/* YOUR SELECTIONS section label */}
            <div style={{ fontSize: '11px', fontWeight: 600, letterSpacing: '0.08em', color: '#888888', textTransform: 'uppercase', marginBottom: '8px', paddingLeft: '4px' }}>
              Your Selections
            </div>

            {/* Peek lists card */}
            <div style={{ background: '#1A1A1A', borderRadius: '12px', boxShadow: '0 2px 8px rgba(0,0,0,0.3)', overflow: 'hidden' }}>
              <PeekList title="Must Haves" items={starList} />
              <div style={{ height: '1px', background: '#2A2A2A' }} />
              <PeekList title="Approved" items={yesList.filter((s) => !starList.includes(s))} />
              <div style={{ height: '1px', background: '#2A2A2A' }} />
              <PeekList title="No Thanks" items={noList} />
            </div>

          </div>
        </div>

      </div> {/* end tab content area */}

      {/* ── Bottom tab bar ─────────────────────────────── */}
      <div style={{display:'flex', flexDirection:'row', width:'100%',
        height:'50px', paddingBottom:'env(safe-area-inset-bottom)',
        background:'#111111', borderTop:'1px solid #2A2A2A',
        position:'fixed', bottom:0, left:0, right:0, zIndex:30}}>

        <button onClick={()=>setActiveTab('swipe')} style={{flex:1,
          border:'none', background:'none', cursor:'pointer',
          fontSize:'15px', fontWeight:600, paddingTop:'10px',
          color: activeTab==='swipe' ? '#E8522A' : '#aaaaaa'}}>
          Swipe
        </button>

        <button onClick={()=>setActiveTab('list')} style={{flex:1,
          border:'none', background:'none', cursor:'pointer',
          fontSize:'15px', fontWeight:600, paddingTop:'10px',
          color: activeTab==='list' ? '#E8522A' : '#aaaaaa'}}>
          Your List
        </button>

      </div>

      {coffeeOpen && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/60">
          <div className="w-[min(92vw,420px)] rounded-2xl bg-[#1A1A1A] shadow-xl border border-[#2A2A2A] p-5">
            <h3 className="text-lg font-semibold text-white mb-1">Enjoying Swipe to Dance?</h3>
            <p className="text-gray-400 mb-4">If this saved you time, you can buy me a coffee ☕</p>
            <div className="flex items-center justify-end gap-2">
              <button
                onClick={() => setCoffeeOpen(false)}
                className="px-3 py-2 rounded-xl border border-[#2A2A2A] bg-[#111111] hover:bg-[#2A2A2A] text-gray-300 text-sm"
              >
                Maybe later
              </button>
              <a
                href={DONATION_URL}
                target="_blank"
                rel="noreferrer"
                onClick={() => setCoffeeOpen(false)}
                className="px-3 py-2 rounded-xl bg-[#E8502A] text-white hover:bg-[#C43E1F] text-sm"
              >
                Buy me a coffee
              </a>
            </div>
          </div>
        </div>
      )}

      {payOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/60" onClick={cancelPay} />
          <div className="relative z-10 w-full max-w-md rounded-2xl bg-[#1A1A1A] shadow-xl border border-[#2A2A2A] p-5">
            <div className="text-lg font-semibold text-white">Unlock Pro</div>
            <p className="mt-1 text-sm text-gray-400">
              Pro lets you <strong>upload your own songs</strong> and <strong>export to Spotify</strong>.
            </p>
            <div className="mt-4 flex items-center justify-between rounded-xl border border-[#2A2A2A] bg-[#111111] p-3">
              <div>
                <div className="text-sm font-medium text-gray-200">One-time purchase</div>
                <div className="text-xs text-gray-500">Lifetime access</div>
              </div>
              <div className="text-xl font-bold text-white">$5</div>
            </div>
            <div className="mt-4 flex gap-2 justify-end">
              <button onClick={cancelPay} className="px-3 py-2 rounded-lg border border-[#2A2A2A] text-gray-300 hover:bg-[#2A2A2A]">
                Not now
              </button>
              <button onClick={startCheckout} className="px-3 py-2 rounded-lg bg-[#E8502A] text-white hover:bg-[#C43E1F]">
                Continue to checkout
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {toast ? (
        <div className="fixed bottom-6 right-6 z-50">
          <div className="rounded-xl border border-[#2A2A2A] bg-[#1A1A1A] shadow-lg px-4 py-2 text-sm text-gray-200">{toast}</div>
        </div>
      ) : null}
    </div>
  );
}

/* ---------- tiny UI helpers ---------- */
function Stat({ label, value }) {
  return (
    <div style={{
      flex: 1,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      padding: '16px 8px',
      background: '#1A1A1A',
      borderRadius: '12px',
      boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
    }}>
      <div style={{ fontSize: '32px', fontWeight: 700, color: '#FFFFFF', lineHeight: 1 }}>{value}</div>
      <div style={{ fontSize: '12px', fontWeight: 400, color: '#aaaaaa', marginTop: '6px' }}>{label}</div>
    </div>
  );
}

function PeekList({ title, items }) {
  const MAX = 6;
  const [expanded, setExpanded] = useState(false);
  const visible = expanded ? items : items.slice(0, MAX);
  const hasMore = !expanded && items.length > MAX;

  return (
    <div>
      {/* Sub-section header */}
      <div style={{ fontSize: '11px', fontWeight: 600, letterSpacing: '0.08em', color: '#aaaaaa', textTransform: 'uppercase', padding: '12px 16px 4px' }}>
        {title} ({items.length})
      </div>

      {/* Empty state */}
      {items.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '16px', fontSize: '14px', color: '#bbbbbb' }}>
          No songs yet — keep swiping
        </div>
      ) : (
        <>
          {visible.map((s, i) => (
            <div key={s.__id} style={{ position: 'relative' }}>
              <div style={{ display: 'flex', alignItems: 'center', minHeight: '56px', padding: '8px 16px', gap: '12px' }}>
                <span style={{ fontSize: '12px', fontFamily: 'monospace', color: '#cccccc', minWidth: '18px', textAlign: 'right', flexShrink: 0 }}>
                  {i + 1}
                </span>
                <div style={{ flex: 1, overflow: 'hidden' }}>
                  <div style={{ fontSize: '15px', fontWeight: 500, color: '#FFFFFF', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {s.title}
                  </div>
                  {s.artist && (
                    <div style={{ fontSize: '13px', fontWeight: 400, color: '#888888', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {s.artist}
                    </div>
                  )}
                </div>
              </div>
              {i < visible.length - 1 && (
                <div style={{ position: 'absolute', bottom: 0, left: '46px', right: 0, height: '1px', background: '#2A2A2A' }} />
              )}
            </div>
          ))}

          {hasMore && (
            <button
              type="button"
              onClick={() => setExpanded(true)}
              style={{ display: 'flex', alignItems: 'center', width: '100%', minHeight: '44px', padding: '0 16px 0 46px', background: 'none', border: 'none', cursor: 'pointer' }}
            >
              <span style={{ fontSize: '14px', fontWeight: 500, color: '#E8502A' }}>
                + {items.length - MAX} more
              </span>
            </button>
          )}
        </>
      )}
    </div>
  );
}
