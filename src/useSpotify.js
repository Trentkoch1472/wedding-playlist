// src/useSpotify.js
import { useCallback, useEffect, useState } from "react";

const AUTH_URL  = "https://accounts.spotify.com/authorize";
const TOKEN_URL = "https://accounts.spotify.com/api/token";
const API_BASE  = "https://api.spotify.com/v1";

// --- PKCE helpers ---
function b64url(arrayBuffer) {
  let str = "";
  const bytes = new Uint8Array(arrayBuffer);
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) str += String.fromCharCode(bytes[i]);
  return btoa(str).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
function randomString(len = 128) {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let out = "";
  crypto.getRandomValues(new Uint8Array(len)).forEach(v => (out += chars[v % chars.length]));
  return out;
}
async function pkceChallenge(verifier) {
  const data = new TextEncoder().encode(verifier);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return b64url(digest);
}

export default function useSpotify({
  clientId,
  redirectUri,
  scopes = ["playlist-modify-public", "playlist-modify-private"],
}) {
  const [token, setToken] = useState(null);
  const [user, setUser]   = useState(null);
  const [busy, setBusy]   = useState(false);
  const [msg, setMsg]     = useState("");

  // Handle legacy hash tokens (from old implicit flow) by clearing them
  useEffect(() => {
    if (window.location.hash.includes("access_token=")) {
      window.history.replaceState({}, document.title, window.location.pathname + window.location.search);
    }
  }, []);

  // Restore a still-valid token from storage
  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem("sp_token") || "null");
      if (saved?.accessToken && saved?.expAt > Date.now()) {
        setToken(saved.accessToken);
      } else {
        localStorage.removeItem("sp_token");
      }
    } catch {}
  }, []);

  // If we were redirected back with ?code=..., exchange it for an access token (PKCE)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get("code");
    if (!code) return;

    const verifier = sessionStorage.getItem("sp_verifier");
    if (!verifier) return;

    (async () => {
      try {
        const body = new URLSearchParams();
        body.set("client_id", clientId);
        body.set("grant_type", "authorization_code");
        body.set("code", code);
        body.set("redirect_uri", redirectUri);
        body.set("code_verifier", verifier);

        const res = await fetch(TOKEN_URL, {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body,
        });
        const data = await res.json();
        if (!res.ok) throw new Error(JSON.stringify(data));

        const accessToken = data.access_token;
        const expiresIn   = data.expires_in || 3600;

        setToken(accessToken);
        localStorage.setItem(
          "sp_token",
          JSON.stringify({ accessToken, expAt: Date.now() + expiresIn * 1000 })
        );
      } catch (e) {
        console.error(e);
        setMsg("Spotify sign-in failed. Try again.");
      } finally {
        sessionStorage.removeItem("sp_verifier");
        const clean = new URL(window.location.href);
        clean.searchParams.delete("code");
        clean.searchParams.delete("state");
        window.history.replaceState({}, document.title, clean.pathname + clean.search);
      }
    })();
  }, [clientId, redirectUri]);

  // Load the user's profile when we have a token
  useEffect(() => {
    if (!token) return;
    (async () => {
      try {
        const r = await fetch(`${API_BASE}/me`, { headers: { Authorization: `Bearer ${token}` } });
        if (!r.ok) throw new Error(`Profile ${r.status}`);
        setUser(await r.json());
      } catch (e) {
        console.error(e);
        setMsg("Spotify auth expired. Please sign in again.");
        setToken(null);
        localStorage.removeItem("sp_token");
      }
    })();
  }, [token]);

  // Start the PKCE auth flow
  const login = useCallback(async () => {
    const verifier  = randomString(128);
    const challenge = await pkceChallenge(verifier);
    sessionStorage.setItem("sp_verifier", verifier);

    const url = new URL(AUTH_URL);
    url.searchParams.set("client_id", clientId);
    url.searchParams.set("response_type", "code");
    url.searchParams.set("redirect_uri", redirectUri);
    url.searchParams.set("scope", scopes.join(" "));
    url.searchParams.set("code_challenge_method", "S256");
    url.searchParams.set("code_challenge", challenge);

    window.location.assign(url.toString());
  }, [clientId, redirectUri, scopes]);

  // Your existing export logic (unchanged)
  const exportToSpotify = useCallback(async (stars, yeses) => {
    if (!token || !user) { setMsg("Sign in to Spotify first."); return null; }
    setBusy(true); setMsg("Creating playlist…");
    try {
      const name = "Swipe to Dance";
      const createRes = await fetch(`${API_BASE}/users/${user.id}/playlists`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ name, description: "Generated by Wedding Playlist Swipe", public: false })
      });
      if (!createRes.ok) throw new Error(`Create playlist ${createRes.status}`);
      const playlist = await createRes.json();

      const wanted = [...stars, ...yeses];
      const uris = [];
      for (const s of wanted) {
        const q = [s.title, s.artist].filter(Boolean).join(" ");
        const sr = await fetch(`${API_BASE}/search?type=track&limit=1&q=${encodeURIComponent(q)}`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (!sr.ok) continue;
        const js = await sr.json();
        const t = js.tracks?.items?.[0];
        if (t?.uri) uris.push(t.uri);
      }

      for (let i = 0; i < uris.length; i += 100) {
        const chunk = uris.slice(i, i + 100);
        await fetch(`${API_BASE}/playlists/${playlist.id}/tracks`, {
          method: "POST",
          headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
          body: JSON.stringify({ uris: chunk })
        });
      }

      setMsg("Playlist ready!");
      return playlist.external_urls?.spotify || null;
    } catch (e) {
      console.error(e);
      setMsg("Spotify export failed.");
      return null;
    } finally {
      setBusy(false);
    }
  }, [token, user]);

  return { user, busy, msg, login, exportToSpotify };
}
