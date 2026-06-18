// src/useSpotify.js
import { useCallback, useEffect, useState } from "react";

const AUTH_URL = "https://accounts.spotify.com/authorize";
const API_BASE = "https://api.spotify.com/v1";

// Always hit same-origin serverless function
const TOKEN_PROXY = "/api/spotify-token";

// Storage keys
const LS_TOKEN = "sp_token_v2"; // { accessToken, refreshToken, expAt }

// ---------- PKCE helpers ----------
function b64urlFromBuffer(buf) {
  let str = btoa(String.fromCharCode(...new Uint8Array(buf)));
  return str.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
function randUrlSafe(len = 64) {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~";
  const arr = new Uint32Array(len);
  crypto.getRandomValues(arr);
  let out = "";
  for (let i = 0; i < len; i++) out += chars[arr[i] % chars.length];
  return out;
}
async function codeChallengeS256(verifier) {
  const data = new TextEncoder().encode(verifier);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return b64urlFromBuffer(digest);
}

export default function useSpotify({
  clientId,
  redirectUri,
  scopes = ["playlist-modify-public", "playlist-modify-private"],
}) {
  const [token, setToken] = useState(null);
  const [refreshToken, setRefreshToken] = useState(null);
  const [user, setUser] = useState(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  // 1) Handle callback (?code=...) AND restore from localStorage if already signed in
  useEffect(() => {
    const url = new URL(window.location.href);
    const code = url.searchParams.get("code");
    const returnedState = url.searchParams.get("state");
    const error = url.searchParams.get("error");

    if (error) {
      setMsg(`Spotify auth error: ${error}`);
      url.searchParams.delete("error");
      url.searchParams.delete("state");
      window.history.replaceState({}, document.title, url.pathname + url.search + url.hash);
      return;
    }

    // If we returned from Spotify with a code, exchange it.
    // State format is "nonce.verifier" — verifier is extracted directly from state,
    // no storage needed (handles Facebook auth popups clearing sessionStorage/localStorage).
    if (code) {
      // State = 16-char nonce + 64-char verifier (no separator to avoid charset collision)
      if (!returnedState || returnedState.length < 80) {
        setMsg("Spotify login aborted (invalid state).");
        return;
      }
      const verifier = returnedState.slice(16);
      if (!verifier || verifier.length < 40) {
        setMsg("Missing PKCE verifier; please connect again.");
        return;
      }

      (async () => {
        try {
          const body = new URLSearchParams({
            grant_type: "authorization_code",
            code,
            redirect_uri: redirectUri,
            client_id: clientId,
            code_verifier: verifier,
          });

          const r = await fetch(TOKEN_PROXY, {
            method: "POST",
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            body,
          });
          const js = await r.json();
          if (!r.ok || !js.access_token) {
            throw new Error(js.error_description || "token proxy failed");
          }

          const accessToken = js.access_token;
          const expiresIn = js.expires_in || 3600;
          const refreshTok = js.refresh_token || null;
          const expAt = Date.now() + expiresIn * 1000 - 60_000;

          setToken(accessToken);
          setRefreshToken(refreshTok);
          try {
            localStorage.setItem(
              LS_TOKEN,
              JSON.stringify({ accessToken, refreshToken: refreshTok, expAt })
            );
          } catch {}

          url.searchParams.delete("code");
          url.searchParams.delete("state");
          window.history.replaceState({}, document.title, url.pathname + url.search + url.hash);
          setMsg("");
        } catch (e) {
          console.error(e);
          setMsg("Spotify sign-in failed.");
        }
      })();

      return; // don't also run restore on this render
    }

    // No auth code in URL: attempt restore, and refresh if expired
    try {
      const raw = localStorage.getItem(LS_TOKEN);
      if (!raw) return;
      const saved = JSON.parse(raw);
      if (saved?.accessToken && saved?.expAt > Date.now()) {
        setToken(saved.accessToken);
        setRefreshToken(saved.refreshToken || null);
      } else if (saved?.refreshToken) {
        (async () => {
          try {
            const body = new URLSearchParams({
              grant_type: "refresh_token",
              refresh_token: saved.refreshToken,
              client_id: clientId,
            });
            const r = await fetch(TOKEN_PROXY, {
              method: "POST",
              headers: { "Content-Type": "application/x-www-form-urlencoded" },
              body,
            });
            const js = await r.json();
            if (!r.ok || !js.access_token) throw new Error("Refresh failed");
            const accessToken = js.access_token;
            const newRefresh = js.refresh_token || saved.refreshToken;
            const expAt = Date.now() + (js.expires_in || 3600) * 1000 - 60_000;
            setToken(accessToken);
            setRefreshToken(newRefresh);
            localStorage.setItem(
              LS_TOKEN,
              JSON.stringify({ accessToken, refreshToken: newRefresh, expAt })
            );
            setMsg("");
          } catch {
            localStorage.removeItem(LS_TOKEN);
          }
        })();
      }
    } catch {}
  }, [clientId, redirectUri]);

  // 2) Load profile when we have a token
  useEffect(() => {
    if (!token) return;
    (async () => {
      try {
        const r = await fetch(`${API_BASE}/me`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!r.ok) throw new Error(`Profile ${r.status}`);
        setUser(await r.json());
        setMsg("");
      } catch (e) {
        console.error(e);
        setMsg("Spotify auth expired. Please connect again.");
        setToken(null);
        setRefreshToken(null);
        localStorage.removeItem(LS_TOKEN);
      }
    })();
  }, [token]);

  // 3) Listen for token delivered by the popup callback
  useEffect(() => {
    function onMessage(e) {
      if (e.origin !== window.location.origin) return;
      if (e.data?.type !== 'spotify_connected') return;
      const { accessToken, refreshToken: rt, expAt } = e.data;
      setToken(accessToken);
      setRefreshToken(rt || null);
      try {
        localStorage.setItem(LS_TOKEN, JSON.stringify({ accessToken, refreshToken: rt, expAt }));
      } catch {}
      setMsg("");
    }
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, []);

  // 4) Start login (PKCE) — opens a popup so the main page never navigates away.
  // This keeps all swipe data / localStorage intact across the Facebook → Spotify redirect chain.
  const login = useCallback(async () => {
    // Open the popup immediately while we're still in the user-gesture call stack.
    // iOS Safari blocks window.open() if called after an await.
    const popup = window.open('about:blank', 'spotify_auth', 'width=500,height=700,scrollbars=yes,resizable=yes');

    const verifier = randUrlSafe(64);
    const challenge = await codeChallengeS256(verifier);
    const nonce = randUrlSafe(16);
    // Encode verifier in state so SpotifyCallback can extract it without storage
    // Concatenate without a separator — nonce is always 16 chars, verifier 64.
    // A separator char like '.' can appear in randUrlSafe output and would corrupt the split.
    const authState = nonce + verifier; // 80 chars total

    const url = new URL(AUTH_URL);
    url.searchParams.set("client_id", clientId);
    url.searchParams.set("response_type", "code");
    url.searchParams.set("redirect_uri", redirectUri);
    url.searchParams.set("scope", scopes.join(" "));
    url.searchParams.set("state", authState);
    url.searchParams.set("code_challenge_method", "S256");
    url.searchParams.set("code_challenge", challenge);

    if (popup && !popup.closed) {
      popup.location.href = url.toString();
    } else {
      // Popup was blocked — fall back to full-page redirect
      window.location.assign(url.toString());
    }
  }, [clientId, redirectUri, scopes]);

  // 4) Optional refresh-on-demand
  const refresh = useCallback(async () => {
    if (!refreshToken) return false;
    try {
      const body = new URLSearchParams({
        grant_type: "refresh_token",
        refresh_token: refreshToken,
        client_id: clientId,
      });
      const r = await fetch(TOKEN_PROXY, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body,
      });
      const js = await r.json();
      if (!r.ok || !js.access_token) return false;

      const accessToken = js.access_token;
      const newRefresh = js.refresh_token || refreshToken;
      const expAt = Date.now() + (js.expires_in || 3600) * 1000 - 60_000;

      setToken(accessToken);
      setRefreshToken(newRefresh);
      localStorage.setItem(
        LS_TOKEN,
        JSON.stringify({ accessToken, refreshToken: newRefresh, expAt })
      );
      return true;
    } catch {
      return false;
    }
  }, [clientId, refreshToken]);

  // 5) Fallback metadata search (unchanged API)
  const findTrackMeta = useCallback(
    async (title, artist) => {
      if (!token) return null;
      const q = [title, artist].filter(Boolean).join(" ");
      try {
        const r = await fetch(
          `${API_BASE}/search?type=track&limit=1&q=${encodeURIComponent(q)}`,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        if (!r.ok) return null;
        const js = await r.json();
        const t = js.tracks?.items?.[0];
        if (!t) return null;
        return {
          preview: t.preview_url || null,
          art: t.album?.images?.[0]?.url || null,
        };
      } catch {
        return null;
      }
    },
    [token]
  );

  // 6) Export playlist (unchanged behavior)
  const exportToSpotify = useCallback(
    async (stars, yeses) => {
      if (!token || !user) {
        setMsg("Connect to Spotify first.");
        return null;
      }
      setBusy(true);
      setMsg("Creating playlist…");
      try {
        const name = "Swipe to Dance";
        const createRes = await fetch(`${API_BASE}/users/${user.id}/playlists`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            name,
            description: "Generated by Swipe to Dance",
            public: false,
          }),
        });
        if (!createRes.ok) throw new Error(`Create playlist ${createRes.status}`);
        const playlist = await createRes.json();

        const wanted = [...stars, ...yeses];
        const uris = [];
        for (const s of wanted) {
          const q = [s.title, s.artist].filter(Boolean).join(" ");
          const sr = await fetch(
            `${API_BASE}/search?type=track&limit=1&q=${encodeURIComponent(q)}`,
            { headers: { Authorization: `Bearer ${token}` } }
          );
          if (!sr.ok) continue;
          const js = await sr.json();
          const t = js.tracks?.items?.[0];
          if (t?.uri) uris.push(t.uri);
        }

        for (let i = 0; i < uris.length; i += 100) {
          const chunk = uris.slice(i, i + 100);
          await fetch(`${API_BASE}/playlists/${playlist.id}/tracks`, {
            method: "POST",
            headers: {
              Authorization: `Bearer ${token}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ uris: chunk }),
          });
        }

        setMsg("Playlist ready!");
        return playlist.external_urls?.spotify || null;
      } catch (e) {
        console.error(e);
        if ((e?.status === 401 || e?.message?.includes("401")) && (await refresh())) {
          return null;
        }
        setMsg("Spotify export failed.");
        return null;
      } finally {
        setBusy(false);
      }
    },
    [token, user, refresh]
  );

  return { user, busy, msg, login, exportToSpotify, findTrackMeta };
}
