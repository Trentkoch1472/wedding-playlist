// src/lib/playlistSync.js
//
// Cross-device playlist sync for signed-in consumer accounts.
//
// Remote (consumer_profiles.playlist_state) is the source of truth once an
// account exists. Anonymous users never touch this module — their state stays
// in localStorage exactly as before.
//
// Every call is best-effort: a sync failure degrades to localStorage-only and
// must never block swiping or surface an error in the UI.

import { supabase } from './supabase';

export const PLAYLIST_STATE_VERSION = 1;

const LS_SONGS   = 'wps_songs';
const LS_CHOICES = 'wps_choices';
const LS_INDEX   = 'wps_index';

const PUSH_DEBOUNCE_MS = 2000;

/**
 * DJ-linked couples already persist swipes server-side via client_songs keyed
 * on client_id. Running consumer sync alongside that would give two writers for
 * one deck, so this path bows out entirely.
 */
export function isDJLinked() {
  try {
    return !!localStorage.getItem('swipedj_client_id');
  } catch {
    return false;
  }
}

/** Read the current deck out of localStorage into a playlist_state payload. */
export function readLocalState() {
  try {
    return {
      songs:   JSON.parse(localStorage.getItem(LS_SONGS)   || '[]'),
      choices: JSON.parse(localStorage.getItem(LS_CHOICES) || '{}'),
      index:   JSON.parse(localStorage.getItem(LS_INDEX)   || '0'),
      version: PLAYLIST_STATE_VERSION,
    };
  } catch (e) {
    console.error('[playlistSync] could not read local state:', e);
    return null;
  }
}

/** Write a playlist_state payload back into localStorage. */
export function writeLocalState(state) {
  try {
    localStorage.setItem(LS_SONGS,   JSON.stringify(state.songs   ?? []));
    localStorage.setItem(LS_CHOICES, JSON.stringify(state.choices ?? {}));
    localStorage.setItem(LS_INDEX,   JSON.stringify(state.index   ?? 0));
    return true;
  } catch (e) {
    console.error('[playlistSync] could not write local state:', e);
    return false;
  }
}

export function isEmptyState(state) {
  return !state || !Array.isArray(state.songs) || state.songs.length === 0;
}

/**
 * Fetch the stored deck for a user.
 * @returns {Promise<object|null>} the playlist_state, or null if absent/failed.
 */
export async function pullPlaylist(userId) {
  if (!userId) return null;
  try {
    const { data, error } = await supabase
      .from('consumer_profiles')
      .select('playlist_state')
      .eq('user_id', userId)
      .maybeSingle();

    if (error) throw error;
    return data?.playlist_state ?? null;
  } catch (e) {
    console.error('[playlistSync] pull failed:', e);
    return null;
  }
}

/**
 * Persist a deck for a user. Resolves false on any failure rather than throwing —
 * callers are in swipe handlers and must not be interrupted.
 */
export async function pushPlaylist(userId, state) {
  if (!userId || !state) return false;
  try {
    const { error } = await supabase
      .from('consumer_profiles')
      .update({
        playlist_state: { ...state, version: PLAYLIST_STATE_VERSION },
        playlist_updated_at: new Date().toISOString(),
      })
      .eq('user_id', userId);

    if (error) throw error;
    return true;
  } catch (e) {
    console.error('[playlistSync] push failed:', e);
    return false;
  }
}

/* ── debounced push ──────────────────────────────────────── */

let pushTimer = null;
let pendingUserId = null;
let pendingState = null;

/**
 * Coalesce rapid swipes into one write. Each call replaces the pending payload
 * and restarts the timer, so a burst of swipes costs a single request.
 */
export function schedulePush(userId, state) {
  if (!userId || !state) return;
  pendingUserId = userId;
  pendingState = state;

  if (pushTimer) clearTimeout(pushTimer);
  pushTimer = setTimeout(() => {
    pushTimer = null;
    const uid = pendingUserId;
    const s = pendingState;
    pendingUserId = null;
    pendingState = null;
    pushPlaylist(uid, s);
  }, PUSH_DEBOUNCE_MS);
}

/** Flush any queued write immediately (sign-out, tab close). */
export async function flushPush() {
  if (!pushTimer) return;
  clearTimeout(pushTimer);
  pushTimer = null;
  const uid = pendingUserId;
  const s = pendingState;
  pendingUserId = null;
  pendingState = null;
  if (uid && s) await pushPlaylist(uid, s);
}

/** Drop any queued write without sending it. */
export function cancelPush() {
  if (pushTimer) clearTimeout(pushTimer);
  pushTimer = null;
  pendingUserId = null;
  pendingState = null;
}
