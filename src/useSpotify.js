// src/useSpotify.js
import { useCallback, useEffect, useState } from "react";

const AUTH_URL = "https://accounts.spotify.com/authorize";
const API_BASE = "https://api.spotify.com/v1";

// Always hit same-origin serverless function
const TOKEN_PROXY = "/api/spotify-token";

// Storage keys
const LS_TOKEN = "sp_token_v2";                 // { accessToken, refreshToken, expAt }
const SS_CODE_VERIFIER = "sp_code_verifier";
const SS_AUTH_STATE   = "sp_auth_state";
const SS_REDIRECT_URI = "sp_redirect_uri";

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

    // If we returned from Spotify with a code, exchange it
    if (code) {
      const expectedState = sessionStorage.getItem(SS_AUTH_STATE) || "";
      if (!returnedState || returnedState !== expectedState) {
        setMsg("Spotify login aborted (state mismatch).");
        url.searchParams.delete("code");
        url.searchParams.delete("state");
        window.history.replaceState({}, document.title, url.pathname + url.search + url.hash);
        return;
      }

      const verifier = sessionStorage.getItem(SS_CODE_VERIFIER);
      if (!verifier) {
        setMsg("Missing PKCE verifier; please connect again.");
        return;
      }

      (async () => {
        try {
          // Use the same redirect URI that initiated login
          const fromStore = sessionStorage.getItem(SS_REDIRECT_URI);
          const lockedRedirect =
            fromStore && fromStore.startsWith(window.location.origin)
              ? fromStore
              : redirectUri;

          const body = new URLSearchParams({
            grant_type: "authorization_code",
            code,
            redirect_uri: lockedRedirect,
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
          const expAt = Date.now() + expiresIn * 1000 - 60_000; // refresh a minute early

          setToken(accessToken);
          setRefreshToken(refreshTok);
          try {
            localStorage.setItem(
              LS_TOKEN,
              JSON.stringify({ accessToken, refreshToken: refreshTok, expAt })
            );
          } catch {}

          // Clean up one-time items + query params
          sessionStorage.removeItem(SS_CODE_VERIFIER);
          sessionStorage.removeItem(SS_AUTH_STATE);
          sessionStorage.removeItem(SS_REDIRECT_URI);
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

  // 3) Start login (PKCE)
  const login = useCallback(async () => {
    const verifier = randUrlSafe(64);
    const challenge = await codeChallengeS256(verifier);
    const authState = randUrlSafe(16);

    // use sessionStorage so multiple tabs don't collide
    sessionStorage.setItem(SS_CODE_VERIFIER, verifier);
    sessionStorage.setItem(SS_AUTH_STATE, authState);
    sessionStorage.setItem(SS_REDIRECT_URI, redirectUri);

    const url = new URL(AUTH_URL);
    url.searchParams.set("client_id", clientId);
    url.searchParams.set("response_type", "code");
    url.searchParams.set("redirect_uri", redirectUri);
    url.searchParams.set("scope", scopes.join(" "));
    url.searchParams.set("state", authState);
    url.searchParams.set("code_challenge_method", "S256");
    url.searchParams.set("code_challenge", challenge);
    url.searchParams.set("show_dialog", "true");

 console.log("Spotify auth URL:", url.toString());

    window.location.assign(url.toString());
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
