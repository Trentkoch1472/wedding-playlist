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

// Add this CORS proxy function at the top with your other helper functions
async function fetchWithCORS(url) {
  try {
    // First try direct fetch with desktop user agent to avoid mobile restrictions
    const response = await fetch(url, {
      mode: "cors",
      credentials: "omit",
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      }
    });
    console.log("Direct fetch succeeded for:", url);
    return response;
  } catch (error) {
    // If direct fetch fails, try with a CORS proxy
    console.warn("Direct fetch failed, trying CORS proxy:", error);
    const proxyUrl = `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`;
    return fetch(proxyUrl);
  }
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
  const {
  user: spUser,
  busy: spBusy,
  msg: spMsg,
  login: spotifyLogin,
  exportToSpotify,
  findTrackMeta,
} = useSpotify({
  clientId: "7ced125c87d944d09bb2a301f8576fb8",
  redirectUri:
    window.location.hostname === "swipetodance.trentkoch.com"
      ? "https://swipetodance.trentkoch.com/wedding-playlist"
      : "https://trentkoch1472.github.io/wedding-playlist",
});

  const fileInputRef = useRef(null);

  // Export dropdown state
  const [exportOpen, setExportOpen] = useState(false);
  const exportMenuRef = useRef(null);
  // Upload dropdown state
  const [uploadOpen, setUploadOpen] = useState(false);
  const uploadMenuRef = useRef(null);
  const pendingUploadModeRef = useRef("replace"); // "add" | "replace"

  // MOBILE: separate dropdown state/refs (only visible on small screens)
  const [mobileExportOpen, setMobileExportOpen] = useState(false);
  const mobileExportMenuRef = useRef(null);
  const [mobileUploadOpen, setMobileUploadOpen] = useState(false);
  const mobileUploadMenuRef = useRef(null);

  // Handlers for Upload menu
const triggerUploadAdd = () => {
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
    setUploadOpen(false);
  });
};

const triggerUploadReplace = () => {
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
    setUploadOpen(false);
  });
};

  // MOBILE triggers (use same file input; just close mobile menu instead)
  const triggerUploadAddMobile = () => {
    requirePro(() => {
      pendingUploadModeRef.current = "add";
      fileInputRef.current?.click();
      setMobileUploadOpen(false);
    });
  };

  const triggerUploadReplaceMobile = () => {
    requirePro(() => {
      pendingUploadModeRef.current = "replace";
      fileInputRef.current?.click();
      setMobileUploadOpen(false);
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
  // MOBILE: close menus on outside click / ESC
  useEffect(() => {
    const onDocClick = (e) => {
      if (mobileUploadMenuRef.current && !mobileUploadMenuRef.current.contains(e.target)) {
        setMobileUploadOpen(false);
      }
      if (mobileExportMenuRef.current && !mobileExportMenuRef.current.contains(e.target)) {
        setMobileExportOpen(false);
      }
    };
    const onKey = (e) => {
      if (e.key === "Escape") {
        setMobileUploadOpen(false);
        setMobileExportOpen(false);
      }
    };
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

// Spotify must always send users back to ONE exact URL
const SPOTIFY_REDIRECT_URI = "https://swipetodance.trentkoch.com/wedding-playlist";

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

// One handler to ensure we start on the redirect origin
const connectToSpotify = useCallback(() => {
  const currentOrigin = window.location.origin;
  const redirectOrigin = new URL(SPOTIFY_REDIRECT_URI).origin;

  if (currentOrigin !== redirectOrigin) {
    // hop to the redirect site and tell it to auto-start login
    const u = new URL(SPOTIFY_REDIRECT_URI);
    u.searchParams.set("connect", "1");
    window.location.assign(u.toString());
  } else {
    // already on the right origin — start now
    spotifyLogin();
  }
}, [SPOTIFY_REDIRECT_URI, spotifyLogin]);

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

// Store original default songs for reset
const defaultSongsRef = useRef(null);

  const maybeOfferCoffee = useCallback(() => {
    if (coffeeOffered) return;
    setCoffeeOpen(true);
    setCoffeeOffered(true);
  }, [coffeeOffered, setCoffeeOffered]);

  // --- Pro gating ---
  const [proUnlocked, setProUnlocked] = useLocalState("wps_pro", false);
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

  const unlockPro = useCallback(() => {
    setProUnlocked(true);
    setPayOpen(false);
    showToast('🎉 Pro features unlocked!', 'success');
    if (typeof pendingActionRef.current === "function") {
      const run = pendingActionRef.current;
      pendingActionRef.current = null;
      setTimeout(() => run(), 50);
    }
  }, [setProUnlocked]);

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
    { bg: "bg-rose-50", border: "border-rose-200" },
    { bg: "bg-[#FAFAF7]", border: "border-[#EAEAEA]" },
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

    // Try iTunes first
for (const q of attempts) {
  try {
    const url = `https://itunes.apple.com/search?term=${encodeURIComponent(q)}&media=music&entity=song&country=US&limit=5`;
    console.log("Fetching iTunes for:", q);
    const r = await fetchWithCORS(url);
    console.log("iTunes fetch status:", r.status, r.ok);
    const j = await r.json();
    console.log("iTunes results count:", j.results?.length || 0);
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
          console.log("Found art:", bestArt);
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
          return { __id: uid(), title: String(title).trim(), artist: String(artist || "").trim(), bpm, decade, genre };
        })
        .filter((r) => r.title);
      const clean = dedupeSongs(mapped);
      const randomized = shuffle(clean);
      
      // Always save to ref for reset functionality
      defaultSongsRef.current = randomized;
      
      // Only set as active songs if localStorage is empty
      if (songs.length === 0 && randomized.length) {
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
  const exportBuckets = () => {
    const toCSV = (arr) => Papa.unparse(arr.map((s) => ({ title: s.title, artist: s.artist })));
    download("must-haves.csv", toCSV(starList));
    download("approved.csv", toCSV(yesList.filter((s) => !starList.includes(s))));
    download("no-thanks.csv", toCSV(noList));
    maybeOfferCoffee();
  };

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
  return (
    <div className="min-h-screen bg-white text-stone-800">
      <header className="sticky top-0 z-10 backdrop-blur bg-white/80 border-b border-stone-200/30">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center gap-2">
  <h1 className="text-xl md:text-xl text-base font-light text-stone-800">Swipe to Dance</h1>

  {/* Mobile buttons (visible on small screens) */}
  <div className="ml-auto md:hidden flex flex-wrap items-center justify-end gap-1.5">
    {/* Connect to Spotify (mobile) */}
    <button
      type="button"
      onClick={() => { if (!spUser) spotifyLogin(); }}
      disabled={!!spUser}
      className={`inline-flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-light transition-colors ${
        spUser
          ? "bg-emerald-100 text-emerald-800 cursor-default"
          : "bg-emerald-600 text-white hover:bg-emerald-500"
      }`}
    >
      {spUser ? "✓" : "Spotify"}
    </button>

    {/* Export (mobile) */}
    <div className="relative" ref={mobileExportMenuRef}>
      <button
        onClick={() => setMobileExportOpen((v) => !v)}
        className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-rose-100 text-rose-700 text-xs font-light hover:bg-rose-200 disabled:opacity-50 transition-colors"
        disabled={!songs.length}
      >
        <Download size={12} /> Export
      </button>

      {mobileExportOpen && (
        <div className="absolute right-0 mt-2 w-64 rounded-xl border border-rose-200 bg-white shadow-lg overflow-hidden z-20">
          <button
            className="w-full text-left px-3 py-2 text-sm hover:bg-rose-50"
            onClick={() => {
              exportPlaylist();
              setMobileExportOpen(false);
            }}
          >
            Export playlist (CSV)
          </button>

          <button
            className="w-full px-3 py-2 text-sm hover:bg-rose-50 disabled:opacity-50 flex items-center justify-between"
            onClick={() => {
              requirePro(() => {
                void handleExportToSpotify();
              });
              setMobileExportOpen(false);
            }}
            disabled={spBusy}
          >
            <span className="text-left">
              Export to Spotify <span className="text-rose-700/70">(Pro)</span>
            </span>
          </button>

          <button
            className="w-full text-left px-3 py-2 text-sm hover:bg-rose-50"
            onClick={() => {
              exportBuckets();
              setMobileExportOpen(false);
            }}
          >
            Export all buckets (3 CSVs)
          </button>
        </div>
      )}
    </div>

    {/* Reset (mobile) */}
    <button
      onClick={resetAll}
      className="inline-flex items-center px-2 py-1 rounded-lg bg-transparent border border-rose-200 text-rose-700 text-xs font-light hover:bg-rose-50 transition-colors"
    >
      Reset
    </button>
  </div>

  {/* RIGHT SIDE (desktop toolbar) */}
  <div className="ml-auto hidden md:flex items-center gap-2">
  {/* Upload (menu) */}
  <div className="relative" ref={uploadMenuRef}>
    <button
      type="button"
      onClick={() => setUploadOpen(v => !v)}
      className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-rose-100 text-rose-700 text-sm font-light hover:bg-rose-200 transition-colors"
    >
      <Upload size={16} /> Upload your own songs <span className="text-rose-700/70">(Pro)</span>
    </button>

    {uploadOpen && (
      <div className="absolute right-0 mt-2 w-64 rounded-xl border border-pink-200 bg-white shadow-lg overflow-hidden z-20">
        <button className="w-full text-left px-3 py-2 text-sm hover:bg-rose-50" onClick={triggerUploadAdd}>
          Add to existing songs <span className="text-pink-700/70">(Pro)</span>
        </button>
        <button className="w-full text-left px-3 py-2 text-sm hover:bg-rose-50" onClick={triggerUploadReplace}>
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
     onChange={(e) => {
    handleFiles(e.target.files?.[0], pendingUploadModeRef.current);
    e.target.value = '';
  }}
  />

  {/* Connect to Spotify (single button) */}
  <button
    type="button"
    onClick={() => { if (!spUser) spotifyLogin(); }}
    disabled={!!spUser}
    className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-light transition-colors ${
      spUser
        ? "bg-emerald-100 text-emerald-800 cursor-default"
        : "bg-emerald-600 text-white hover:bg-emerald-500"
    }`}
  >
    {spUser ? "Spotify connected" : "Connect to Spotify"}
  </button>

  {/* Export */}
  <div className="relative" ref={exportMenuRef}>
    <button
      type="button"
      onClick={() => setExportOpen(v => !v)}
      className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-rose-100 text-rose-700 text-sm font-light hover:bg-rose-200 disabled:opacity-50 transition-colors"
      disabled={!songs.length}
    >
      <Download size={16} /> Export
    </button>

    {exportOpen && (
      <div className="absolute right-0 mt-2 w-64 rounded-xl border border-pink-200 bg-white shadow-lg overflow-hidden z-20">
        <button
          className="w-full text-left px-3 py-2 text-sm hover:bg-rose-50"
          onClick={() => { exportPlaylist(); setExportOpen(false); }}
        >
          Export playlist (CSV)
        </button>

        <button
          className="w-full px-3 py-2 text-sm hover:bg-rose-50 disabled:opacity-50 flex items-center justify-between"
          onClick={() => { requirePro(() => { void handleExportToSpotify(); }); setExportOpen(false); }}
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
          onClick={() => { exportBuckets(); setExportOpen(false); }}
        >
          Export all buckets (3 CSVs)
        </button>
      </div>
    )}
  </div>

  <button
    type="button"
    onClick={resetAll}
    className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-transparent border border-rose-200 text-rose-700 text-sm font-light hover:bg-rose-50 transition-colors"
  >
    Reset
  </button>
</div>

        </div>

<div className="h-0.5 w-full bg-rose-100">
  <div className="h-full bg-rose-400" style={{ width: `${progress * 100}%` }} />
</div>

        {spMsg ? <div className="text-xs text-pink-700/70 text-center py-1">{spMsg}</div> : null}
      </header>

      <main className="max-w-5xl mx-auto px-4 py-2">
        {!songs.length ? (
          <div className="grid place-items-center text-center py-24">
            <div className="max-w-xl">
              <h2 className="text-2xl font-semibold mb-2">Import your song list</h2>
              <p className="text-slate-600 mb-6">
                Accepted formats: CSV or JSONL. Include at least a title field, artist is optional. Duplicate titles and artists will be
                auto merged.
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
                      className={`relative rounded-3xl ${themeNext.bg} shadow-xl border ${themeNext.border} p-6 md:p-8 min-h-[360px] md:min-h-[480px] flex flex-col justify-between`}
                    >
                      <div className="text-sm font-light text-stone-400">
                        Song {Math.min(index + 2, songs.length)} of {songs.length} • Remaining {Math.max(remaining - 1, 0)}
                      </div>

                      <div className="text-center py-2">
                        <div className="text-2xl font-light tracking-wide text-stone-800">{nextSong.title}</div>

                        {nextSong.__art ? (
                          <img
                            src={toHttps(nextSong.__art)}
                            referrerPolicy="no-referrer"
                            alt={`${nextSong.title} cover`}
                            className="mx-auto mt-4 w-28 h-28 rounded-xl shadow-md object-cover"
                            loading="lazy"
                          />
                        ) : null}

                        {nextSong.artist ? <div className="text-base font-light text-stone-500 mt-3">{nextSong.artist}</div> : null}

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
                        Left swipe = No. Right swipe or Space = Yes. Up swipe or S = Star. Down swipe = Skip.
                      </div>
                    </div>
                  </div>
                )}

                {/* current card */}
                <div
                  key={current ? current.__id : "empty"}
                  className={`relative rounded-3xl ${theme.bg} shadow-xl hover:shadow-2xl hover:shadow-rose-100 transition-shadow border ${theme.border} p-6 md:p-8 min-h[420px] md:min-h-[480px] flex flex-col justify-between`.replace(
                    "min-h[360px]",
                    "min-h-[360px]"
                  )}
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
                    <div className="text-center py-2">
                      <div className="text-3xl font-bold tracking-tight">{current.title}</div>

                      {current.__art ? (
                        <img
                          src={toHttps(current.__art)}
                          crossOrigin="anonymous"
                          referrerPolicy="no-referrer"
                          alt={`${current.title} cover`}
                          className="mx-auto mt-4 w-48 h-48 rounded-xl object-cover shadow"
                          loading="lazy"
                        />
                      ) : null}

                      {current.artist ? <div className="text-lg text-slate-600 mt-2">{current.artist}</div> : null}

                      {/* play snippet button under title/art */}
                      <div className="mt-3 flex items-center justify-center">
                        <button
                          aria-label="Preview"
                          onClick={togglePreview}
                          disabled={!current || fling.active}
                          className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-rose-200 bg-white/90 hover:bg-rose-50 text-sm font-light text-rose-700 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-300 focus-visible:ring-offset-2 focus-visible:ring-offset-white"
                        >
                          {previewing ? <Pause size={16} /> : <Play size={16} />}
                          <span>{previewing ? "Stop snippet" : previewPreparing ? "Preparing…" : "Play snippet"}</span>
                        </button>
                      </div>

                      <div className="mt-4 flex justify-center gap-3 text-xs text-slate-500">
                        {current.genre ? (
                          <span className="px-3 py-1 rounded-full bg-stone-100/50 text-xs font-light text-stone-500">{current.genre}</span>
                        ) : null}
                        {current.decade ? <span className="px-2 py-1 rounded-full bg-slate-100">{current.decade}</span> : null}
                        {current.bpm ? <span className="px-2 py-1 rounded-full bg-slate-100">{current.bpm} BPM</span> : null}
                      </div>

                      {/* overlays */}
                      <div className="pointer-events-none">
                        <div
                          className="absolute left-4 top-4 text-green-700/70 bg-green-50/50 border border-green-200/30 rounded-lg px-3 py-1 text-sm font-light"
                          style={{ opacity: yesOpacity }}
                        >
                          ✓ Yes
                        </div>
                        <div
                          className="absolute left-4 top-4 text-green-700/70 bg-green-50/50 border border-green-200/30 rounded-lg px-3 py-1 text-sm font-light"
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
                  <div className="flex items-center justify-center gap-3 pt-1">
                    <button
                      aria-label="Undo"
                      onClick={onUndo}
                      disabled={fling.active}
                      className="p-3 rounded-full border border-rose-200/50 bg-white hover:bg-rose-50 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-300 focus-visible:ring-offset-2 focus-visible:ring-offset-white"
                    >
                      <RotateCcw />
                    </button>
                    <button
                      aria-label="No"
                      onClick={onNo}
                      disabled={fling.active}
                      className="p-4 rounded-full bg-rose-100/50 text-rose-600 hover:bg-rose-100 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-300 focus-visible:ring-offset-2 focus-visible:ring-offset-white"
                    >
                      <X size={28} />
                    </button>
                    <button
                      aria-label="Yes"
                      onClick={onYes}
                      disabled={fling.active}
                      className="p-5 rounded-full bg-green-100/60 text-green-700 hover:bg-green-100 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-300 focus-visible:ring-offset-2 focus-visible:ring-offset-white"
                    >
                      <Check size={30} />
                    </button>
                    <button
                      aria-label="Star"
                      onClick={onStar}
                      disabled={fling.active}
                      className="p-4 rounded-full bg-yellow-50/60 text-yellow-700 hover:bg-yellow-100/60 transition-colors"
                    >
                      <Star size={26} />
                    </button>
                    <button
                      aria-label="Skip"
                      onClick={onSkip}
                      disabled={fling.active}
                      className="p-3 rounded-full border border-rose-200/50 bg-white hover:bg-rose-50 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-300 focus-visible:ring-offset-2 focus-visible:ring-offset-white"
                    >
                      <SkipForward />
                    </button>
                  </div>

                  <div className="mt-3 text-center text-xs text-slate-500">
                    Left swipe = No. Right swipe or Space = Yes. Up swipe or S = Star. Down swipe = Skip.
                  </div>
                </div>
              </div>
            </section>

           {/* Mobile controls under the card - just Upload */}
<div className="md:hidden mt-4 flex items-center justify-center">
  {/* Upload (mobile) */}
  <div className="relative" ref={mobileUploadMenuRef}>
    <button
      onClick={() => setMobileUploadOpen((v) => !v)}
      className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-rose-100 text-rose-700 text-sm font-light hover:bg-rose-200 transition-colors"
    >
      <Upload size={16} /> Upload <span className="text-rose-700/70">(Pro)</span>
    </button>

    {mobileUploadOpen && (
      <div className="absolute left-0 mt-2 w-64 rounded-xl border border-rose-200 bg-white shadow-lg overflow-hidden z-20">
        <button className="w-full text-left px-3 py-2 text-sm hover:bg-rose-50" onClick={triggerUploadAddMobile}>
          Add to existing songs <span className="text-rose-700/70">(Pro)</span>
        </button>
        <button className="w-full text-left px-3 py-2 text-sm hover:bg-rose-50" onClick={triggerUploadReplaceMobile}>
          Replace songs <span className="text-rose-700/70">(Pro)</span>
        </button>
      </div>
    )}
  </div>
</div>

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

      <footer className="py-6 text-center text-xs text-slate-500">Made for choosing bangers, not ballads only. Choose responsibly.</footer>

      {coffeeOpen && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/40">
          <div className="w-[min(92vw,420px)] rounded-2xl bg-white shadow-xl border border-pink-200 p-5">
            <h3 className="text-lg font-semibold mb-1">Enjoying Swipe to Dance?</h3>
            <p className="text-slate-600 mb-4">If this saved you time, you can buy me a coffee ☕</p>
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
              <button onClick={cancelPay} className="px-3 py-2 rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-50">
                Not now
              </button>
              <button onClick={startCheckout} className="px-3 py-2 rounded-lg bg-pink-600 text-white hover:bg-pink-500">
                Continue to checkout
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {toast ? (
        <div className="fixed bottom-6 right-6 z-50">
          <div className="rounded-xl border border-pink-200 bg-white/95 shadow-lg px-4 py-2 text-sm text-pink-900">{toast}</div>
        </div>
      ) : null}
    </div>
  );
}

/* ---------- tiny UI helpers ---------- */
function Panel({ title, children }) {
  return (
    <div className="rounded-xl bg-white border border-rose-200 shadow-none">
      <div className="px-5 py-3 border-b border-rose-100 bg-rose-50/60 text-rose-800 font-medium rounded-t-xl">{title}</div>
      <div className="p-4">{children}</div>
    </div>
  );
}

function Stat({ label, value }) {
  return (
    <div className="rounded-lg bg-rose-50 border border-rose-100 p-4">
      <div className="text-2xl font-semibold text-rose-900">{value}</div>
      <div className="text-xs text-rose-700/80">{label}</div>
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

        {items.length > MAX ? <div className="text-xs text-slate-400">{`+ ${items.length - MAX} more`}</div> : null}
      </div>
    </div>
  );
}
