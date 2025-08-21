import { useCallback, useEffect, useState } from "react";

// Scopes you need
const SPOTIFY_SCOPES = [
  "playlist-modify-private",
  "user-read-private",
  "ugc-image-upload",
].join(" ");

// ---------- Small helpers ----------
function randString(len = 64) {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~";
  const bytes = new Uint8Array(len);
  crypto.getRandomValues(bytes);
  let out = "";
  for (let i = 0; i < len; i++) out += chars[bytes[i] % chars.length];
  return out;
}
function base64url(bytes) {
  return btoa(String.fromCharCode(...new Uint8Array(bytes)))
    .replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
async function sha256(input) {
  const enc = new TextEncoder();
  const hash = await crypto.subtle.digest("SHA-256", enc.encode(input));
  return new Uint8Array(hash);
}
async function pkceChallenge(verifier) {
  return base64url(await sha256(verifier));
}
function saveTokens(t) { localStorage.setItem("sp_tokens", JSON.stringify(t)); }
function loadTokens() {
  try { return JSON.parse(localStorage.getItem("sp_tokens") || "null"); } catch { return null; }
}
// Simple normalize for matching
function norm(s = "") {
  return String(s).toLowerCase()
    .normalize("NFD").replace(/\p{Diacritic}/gu, "")
    .replace(/[^\w\s]/g, "").replace(/\s+/g, " ").trim();
}

// ---------- The hook ----------
export default function useSpotify({ clientId, redirectUri = window.location.origin }) {
  const [user, setUser]   = useState(null);   // {id, display_name, country}
  const [token, setToken] = useState(null);   // {access_token, refresh_token, expires_at}
  const [busy, setBusy]   = useState(false);
  const [msg, setMsg]     = useState("");

  // Begin login
  const login = useCallback(async () => {
    if (!clientId) { alert("Missing Spotify Client ID"); return; }
    const state = randString(16);
    const verifier = randString(64);
    const challenge = await pkceChallenge(verifier);
    localStorage.setItem("sp_state", state);
    localStorage.setItem("sp_verifier", verifier);

    const params = new URLSearchParams({
      client_id: clientId,
      response_type: "code",
      redirect_uri: redirectUri,
      scope: SPOTIFY_SCOPES,
      code_challenge_method: "S256",
      code_challenge: challenge,
      state,
    });
    window.location.href = `https://accounts.spotify.com/authorize?${params.toString()}`;
  }, [clientId, redirectUri]);

  // Exchange auth code for tokens
  const exchangeCodeForToken = useCallback(async (code) => {
    const verifier = localStorage.getItem("sp_verifier");
    if (!verifier) return;
    const body = new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: redirectUri,
      client_id: clientId,
      code_verifier: verifier,
    });
    const res = await fetch("https://accounts.spotify.com/api/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
    });
    if (!res.ok) throw new Error("Token exchange failed");
    const data = await res.json();
    const t = {
      access_token: data.access_token,
      refresh_token: data.refresh_token,
      expires_at: Date.now() + (data.expires_in * 1000) - 60_000,
    };
    saveTokens(t);
    setToken(t);
  }, [clientId, redirectUri]);

  // Refresh token
  const refreshToken = useCallback(async () => {
    const saved = loadTokens();
    if (!saved?.refresh_token) return null;
    const body = new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: saved.refresh_token,
      client_id: clientId,
    });
    const res = await fetch("https://accounts.spotify.com/api/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
    });
    if (!res.ok) return null;
    const data = await res.json();
    const t = {
      access_token: data.access_token,
      refresh_token: data.refresh_token || saved.refresh_token,
      expires_at: Date.now() + (data.expires_in * 1000) - 60_000,
    };
    saveTokens(t);
    setToken(t);
    return t;
  }, [clientId]);

  // Ensure valid access token
  const ensureToken = useCallback(async () => {
    let t = token || loadTokens();
    if (!t) return null;
    if (Date.now() >= t.expires_at) t = await refreshToken();
    if (t) setToken(t);
    return t;
  }, [token, refreshToken]);

  // Small wrapper for Spotify API calls
  const spFetch = useCallback(async (path, init = {}) => {
    const t = await ensureToken();
    if (!t) throw new Error("Not authenticated");
    const headers = new Headers(init.headers || {});
    headers.set("Authorization", `Bearer ${t.access_token}`);
    if (init.body && typeof init.body === "string" && !headers.has("Content-Type") && path.indexOf("/images") === -1) {
      headers.set("Content-Type", "application/json");
    }
    const res = await fetch(`https://api.spotify.com/${path}`, { ...init, headers });
    if (res.status === 429) {
      const retry = Number(res.headers.get("Retry-After") || "1");
      await new Promise(r => setTimeout(r, retry * 1000));
      return spFetch(path, init);
    }
    if (!res.ok) throw new Error(`Spotify error ${res.status}`);
    return res;
  }, [ensureToken]);

  // Handle redirect back from Spotify
  useEffect(() => {
    const url = new URL(window.location.href);
    const code = url.searchParams.get("code");
    const state = url.searchParams.get("state");
    const expect = localStorage.getItem("sp_state");
    if (code) {
      (async () => {
        try {
          if (!expect || state !== expect) throw new Error("State mismatch");
          await exchangeCodeForToken(code);
        } catch {
          alert("Spotify sign-in failed. Try again.");
        } finally {
          url.searchParams.delete("code");
          url.searchParams.delete("state");
          window.history.replaceState({}, "", url.pathname + url.search);
          localStorage.removeItem("sp_state");
          localStorage.removeItem("sp_verifier");
        }
      })();
    } else {
      const saved = loadTokens();
      if (saved) setToken(saved);
    }
  }, [exchangeCodeForToken]);

  // Load the user profile when we have a token
  useEffect(() => {
    (async () => {
      try {
        if (!token) return;
        const res = await spFetch("v1/me");
        const me = await res.json();
        setUser({ id: me.id, display_name: me.display_name || "Spotify User", country: me.country || "US" });
      } catch {
        // ignore
      }
    })();
  }, [token, spFetch]);

  // Search best track URI
  const findTrackURI = useCallback(async (song, market = "US") => {
    const title = song?.title || "";
    const artist = song?.artist || "";
    if (!title) return null;

    const q = new URLSearchParams({
      q: `track:"${title}" artist:"${artist}"`,
      type: "track",
      limit: "5",
      market,
    });
    const res = await spFetch(`v1/search?${q.toString()}`);
    const data = await res.json();
    const items = data?.tracks?.items || [];
    if (!items.length) return null;

    const tNorm = norm(title);
    const aNorm = norm(artist);
    let best = items[0], bestScore = -1;
    for (const it of items) {
      const itTitle = norm(it.name);
      const itArtist = norm(it.artists?.[0]?.name || "");
      let score = 0;
      if (itTitle === tNorm) score += 2;
      if (aNorm && itArtist === aNorm) score += 2;
      if (it.is_playable !== false) score += 1;
      if (/live|acoustic|remaster/i.test(it.name)) score -= 1;
      if (score > bestScore) { bestScore = score; best = it; }
    }
    return best?.uri || null;
  }, [spFetch]);

  // Generate a 640x640 base64 JPEG cover
  async function generateCoverImageBase64(title = "Wedding Bangers") {
    const size = 640;
    const canvas = document.createElement("canvas");
    canvas.width = size; canvas.height = size;
    const ctx = canvas.getContext("2d");

    const g = ctx.createLinearGradient(0, 0, size, size);
    g.addColorStop(0, "#0ea5e9");
    g.addColorStop(1, "#f97316");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, size, size);

    ctx.fillStyle = "rgba(255,255,255,0.08)";
    for (let i = 0; i < 6; i++) {
      const r = Math.random() * 220 + 60;
      const x = Math.random() * size;
      const y = Math.random() * size;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.fillStyle = "#fff";
    ctx.font = "bold 64px system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";

    const words = title.split(" ");
    const lines = [];
    let line = "";
    for (const w of words) {
      const test = line ? `${line} ${w}` : w;
      if (ctx.measureText(test).width < 520) line = test; else { lines.push(line); line = w; }
    }
    if (line) lines.push(line);
    const startY = size / 2 - ((lines.length - 1) * 40);
    lines.forEach((ln, i) => ctx.fillText(ln, size / 2, startY + i * 80));

    const dataUrl = canvas.toDataURL("image/jpeg", 0.9);
    return dataUrl.replace(/^data:image\/jpeg;base64,/, "");
  }

  // Export one playlist: stars first then approved, skip misses
  const exportToSpotify = useCallback(async (starList, yesList) => {
    if (!user) { alert("Connect Spotify first."); return; }

    const approved = yesList.filter(s => !starList.includes(s));
    const ordered = [...starList, ...approved];
    if (!ordered.length) { alert("No songs to export. Star or approve some first."); return; }

    try {
      setBusy(true);
      setMsg("Creating playlist...");
      const resP = await spFetch(`v1/users/${user.id}/playlists`, {
        method: "POST",
        body: JSON.stringify({
          name: "Wedding Bangers",
          public: false,
          description: "Starred first, then approved. Created with Wedding Playlist Swipe.",
        }),
      });
      const playlist = await resP.json();

      setMsg("Matching songs on Spotify...");
      const uris = [];
      for (const song of ordered) {
        try {
          const uri = await findTrackURI(song, user.country || "US");
          if (uri) uris.push(uri);
        } catch { /* skip on error */ }
      }
      if (!uris.length) { alert("Could not match any tracks on Spotify."); setBusy(false); return; }

      setMsg(`Adding ${uris.length} tracks...`);
      for (let i = 0; i < uris.length; i += 100) {
        const chunk = uris.slice(i, i + 100);
        await spFetch(`v1/playlists/${playlist.id}/tracks`, {
          method: "POST",
          body: JSON.stringify({ uris: chunk }),
        });
      }

      setMsg("Uploading cover art...");
      const jpgBase64 = await generateCoverImageBase64("Wedding Bangers");
      await spFetch(`v1/playlists/${playlist.id}/images`, {
        method: "PUT",
        headers: { "Content-Type": "image/jpeg" },
        body: jpgBase64,
      });

      setMsg("Done.");
      setBusy(false);
      return `https://open.spotify.com/playlist/${playlist.id}`;
    } catch (e) {
      setBusy(false);
      alert("Export failed. Try reconnecting Spotify and try again.");
      return null;
    }
  }, [user, findTrackURI, spFetch]);

  return { user, busy, msg, login, exportToSpotify };
}
