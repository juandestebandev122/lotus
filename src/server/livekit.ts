// ============================================================
// LiveKit integration — real-time voice for rooms.
// Credentials come from Admin → Settings (config.livekit) when url + key +
// secret are all saved there; otherwise from the env vars:
//   Server env:  LIVEKIT_API_KEY, LIVEKIT_API_SECRET, LIVEKIT_SERVER_URL
//   URL:         NEXT_PUBLIC_LIVEKIT_URL / LIVEKIT_URL (wss://...)
// The URL reaches clients only via the token routes, so a saved change
// applies on the next join with no rebuild.
//
// Access tokens are LiveKit-compatible JWTs (HS256) signed with the API
// secret. We hand-roll them with crypto so no SDK is needed on the server.
// ============================================================

import crypto from "node:crypto";
import { getDB } from "./db";

export interface LivekitCreds {
  url: string;
  apiKey: string;
  apiSecret: string;
  serverUrl: string;
}

export type LivekitSource = "settings" | "env" | "none";

export function envLivekitCreds(): LivekitCreds {
  return {
    url: process.env.NEXT_PUBLIC_LIVEKIT_URL || process.env.LIVEKIT_URL || "",
    apiKey: process.env.LIVEKIT_API_KEY || "",
    apiSecret: process.env.LIVEKIT_API_SECRET || "",
    serverUrl: process.env.LIVEKIT_SERVER_URL || "",
  };
}

export function credsComplete(c: LivekitCreds): boolean {
  return c.apiKey.length > 0 && c.apiSecret.length > 0 && c.url.startsWith("ws");
}

/** The active credentials: the admin-saved set when complete, else env. */
export async function livekitCreds(): Promise<LivekitCreds & { source: LivekitSource }> {
  const saved = (await getDB()).config?.livekit;
  const fromSettings: LivekitCreds = {
    url: (saved?.url || "").trim(),
    apiKey: (saved?.apiKey || "").trim(),
    apiSecret: (saved?.apiSecret || "").trim(),
    serverUrl: (saved?.serverUrl || "").trim(),
  };
  if (credsComplete(fromSettings)) return { ...fromSettings, source: "settings" };
  const env = envLivekitCreds();
  return { ...env, source: credsComplete(env) ? "env" : "none" };
}

export async function livekitUrl(): Promise<string> {
  return (await livekitCreds()).url;
}

export async function livekitConfigured(): Promise<boolean> {
  return credsComplete(await livekitCreds());
}

function base64url(input: Buffer | string): string {
  return Buffer.from(input)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

function httpUrl(c: LivekitCreds): string {
  // Server-side API calls (twirp) use the internal URL when set, so the server
  // talks to a self-hosted LiveKit directly (e.g. http://127.0.0.1:7880) instead
  // of hair-pinning out through the public nginx/TLS endpoint.
  return (c.serverUrl || c.url.replace(/^ws/, "http")).replace(/\/+$/, "");
}

/** Sign a short-lived server token with an arbitrary video grant (for the REST API). */
function createGrantToken(c: LivekitCreds, grant: Record<string, unknown>, ttlSeconds = 60): string {
  const now = Math.floor(Date.now() / 1000);
  const head = base64url(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const body = base64url(
    JSON.stringify({ iss: c.apiKey, sub: c.apiKey, iat: now, nbf: now, exp: now + ttlSeconds, video: grant }),
  );
  const sig = base64url(crypto.createHmac("sha256", c.apiSecret).update(`${head}.${body}`).digest());
  return `${head}.${body}.${sig}`;
}

/** Admin "Test connection": one real authenticated call (ListRooms) with the
 *  given credentials, so a wrong URL/key/secret shows up before anyone joins. */
export async function testLivekitConnection(c: LivekitCreds): Promise<{ ok: boolean; rooms?: number; error?: string }> {
  if (!c.url.startsWith("ws")) return { ok: false, error: "The server address must start with wss:// (or ws://)." };
  if (!c.apiKey || !c.apiSecret) return { ok: false, error: "The API key and API secret are both required." };
  try {
    const token = createGrantToken(c, { roomList: true });
    const res = await fetch(`${httpUrl(c)}/twirp/livekit.RoomService/ListRooms`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: "{}",
      signal: AbortSignal.timeout(8000),
    });
    if (res.status === 401 || res.status === 403) {
      return { ok: false, error: "LiveKit refused the API key / secret. Copy both again from your LiveKit project." };
    }
    if (!res.ok) return { ok: false, error: `LiveKit answered with an error (HTTP ${res.status}). Check the server address.` };
    const data = await res.json().catch(() => ({}));
    return { ok: true, rooms: Array.isArray(data.rooms) ? data.rooms.length : 0 };
  } catch (e) {
    const timedOut = e instanceof Error && (e.name === "TimeoutError" || e.name === "AbortError");
    return { ok: false, error: timedOut ? "No answer from the LiveKit server (timed out). Check the server address." : "Could not reach the LiveKit server. Check the server address." };
  }
}

/** Who is CURRENTLY connected to a LiveKit room (the live voice members). */
export async function listRoomParticipants(
  roomName: string,
): Promise<{ identity: string; name: string; metadata: string }[]> {
  const c = await livekitCreds();
  if (!credsComplete(c)) return [];
  try {
    const token = createGrantToken(c, { roomAdmin: true, room: roomName });
    const res = await fetch(`${httpUrl(c)}/twirp/livekit.RoomService/ListParticipants`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ room: roomName }),
    });
    if (!res.ok) return [];
    const data = await res.json().catch(() => ({}));
    return ((data.participants as { identity: string; name?: string; metadata?: string }[]) || []).map((p) => ({
      identity: p.identity,
      name: p.name || "",
      metadata: p.metadata || "",
    }));
  } catch {
    return [];
  }
}

/** Detailed live roster for a room: who is CONNECTED, and — for the "speaking"
 *  count — who is actually publishing an UNMUTED audio track (i.e. can be heard
 *  right now). This is the ground truth the admin dashboard needs; DB heartbeat
 *  presence lags on mobile (throttled timers) and collapsed the count to just the
 *  host. Returns [] when LiveKit isn't configured. */
export async function listRoomRoster(
  roomName: string,
): Promise<{ identity: string; audioLive: boolean }[]> {
  const c = await livekitCreds();
  if (!credsComplete(c)) return [];
  try {
    const token = createGrantToken(c, { roomAdmin: true, room: roomName });
    const res = await fetch(`${httpUrl(c)}/twirp/livekit.RoomService/ListParticipants`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ room: roomName }),
    });
    if (!res.ok) return [];
    const data = await res.json().catch(() => ({}));
    const parts = (data.participants as { identity: string; tracks?: { type?: string | number; muted?: boolean }[] }[]) || [];
    return parts.map((p) => ({
      identity: p.identity,
      // Publishing an audio track that isn't muted = currently able to be heard.
      audioLive: (p.tracks || []).some((t) => (t.type === "AUDIO" || t.type === 1) && !t.muted),
    }));
  } catch {
    return [];
  }
}

/**
 * Force-mute (or unmute) a participant's microphone at the SFU — authoritative
 * and immediate, so a muted user genuinely cannot be heard regardless of their
 * client. Returns true if the mute was applied (or there was nothing to mute).
 */
export async function setParticipantMute(roomName: string, identity: string, muted: boolean): Promise<boolean> {
  const c = await livekitCreds();
  if (!credsComplete(c)) return false;
  try {
    const token = createGrantToken(c, { roomAdmin: true, room: roomName });
    const headers = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };
    // Find the participant's audio track sid.
    const pRes = await fetch(`${httpUrl(c)}/twirp/livekit.RoomService/GetParticipant`, {
      method: "POST",
      headers,
      body: JSON.stringify({ room: roomName, identity }),
    });
    if (!pRes.ok) return false;
    const p = await pRes.json().catch(() => ({}));
    const tracks = (p.tracks as { sid: string; type?: string | number }[]) || [];
    const audio = tracks.find((t) => t.type === "AUDIO" || t.type === 1);
    if (!audio) return true; // nothing published to mute
    const mRes = await fetch(`${httpUrl(c)}/twirp/livekit.RoomService/MutePublishedTrack`, {
      method: "POST",
      headers,
      body: JSON.stringify({ room: roomName, identity, track_sid: audio.sid, muted }),
    });
    return mRes.ok;
  } catch {
    return false;
  }
}

/**
 * Grant or revoke a participant's permission to PUBLISH (i.e. to speak) at the
 * SFU — this is what enforces "only seated users can talk". It overrides the
 * join token's grant for the LIVE session, so a member who takes a seat can
 * publish immediately (no reconnect) and one who leaves a seat is silenced at
 * the server. Returns true on success. No-op if LiveKit isn't configured or the
 * participant isn't connected yet (their token still carries the correct grant).
 */
export async function setParticipantCanPublish(roomName: string, identity: string, canPublish: boolean): Promise<boolean> {
  if (!identity) return false;
  const c = await livekitCreds();
  if (!credsComplete(c)) return false;
  try {
    const token = createGrantToken(c, { roomAdmin: true, room: roomName });
    const res = await fetch(`${httpUrl(c)}/twirp/livekit.RoomService/UpdateParticipant`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      // ParticipantPermission uses snake_case in the twirp JSON API (like track_sid
      // in MutePublishedTrack above). Keep subscribe + data on so listeners still
      // hear everyone and reactions/gifts still flow; only PUBLISH (mic) is gated.
      body: JSON.stringify({ room: roomName, identity, permission: { can_subscribe: true, can_publish: canPublish, can_publish_data: true } }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

/**
 * Forcibly disconnect a participant from the SFU — used when a member is
 * kicked or blocked, so they stop hearing/speaking IMMEDIATELY (not on the next
 * poll). Their token is also denied on reconnect (see the token route), so they
 * cannot re-enter. No-op if LiveKit isn't configured.
 */
export async function removeRoomParticipant(roomName: string, identity: string): Promise<boolean> {
  const c = await livekitCreds();
  if (!credsComplete(c)) return false;
  try {
    const token = createGrantToken(c, { roomAdmin: true, room: roomName });
    const res = await fetch(`${httpUrl(c)}/twirp/livekit.RoomService/RemoveParticipant`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ room: roomName, identity }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

/**
 * Forcibly CLOSE an entire LiveKit room at the SFU — every participant is
 * disconnected immediately (their mic/audio stops AT THE SERVER, so it also stops
 * when their app is minimised — the client doesn't have to do anything). Used to
 * hard-terminate a Paid Zone call room the instant its coins run out. No-op if
 * LiveKit isn't configured. `room_${roomId}` is the LiveKit room name convention.
 */
export async function deleteLivekitRoom(roomName: string): Promise<boolean> {
  if (!roomName) return false;
  const c = await livekitCreds();
  if (!credsComplete(c)) return false;
  try {
    // DeleteRoom requires the `roomCreate` grant (room MANAGEMENT), NOT `roomAdmin`
    // (which only authorises actions scoped to a specific room). Using roomAdmin
    // returns 401 "permissions denied" and silently fails to close the room.
    const token = createGrantToken(c, { roomCreate: true, roomAdmin: true, room: roomName });
    const res = await fetch(`${httpUrl(c)}/twirp/livekit.RoomService/DeleteRoom`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ room: roomName }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

/** Build a signed LiveKit access token for a participant joining a room. Pass
 *  the same `creds` whose `url` is handed to the client, so the token and the
 *  address always come from one consistent set. */
export function createAccessToken(creds: LivekitCreds, opts: {
  room: string;
  identity: string;
  name?: string;
  metadata?: string;
  canPublish?: boolean;
  hidden?: boolean; // a HIDDEN participant (admin monitor) subscribes to audio but is invisible to others
  ttlSeconds?: number;
}): string {
  const now = Math.floor(Date.now() / 1000);
  const ttl = opts.ttlSeconds ?? 6 * 60 * 60; // 6 hours
  const header = { alg: "HS256", typ: "JWT" };
  const payload: Record<string, unknown> = {
    iss: creds.apiKey,
    sub: opts.identity,
    iat: now,
    nbf: now,
    exp: now + ttl,
    name: opts.name,
    metadata: opts.metadata,
    video: {
      room: opts.room,
      roomJoin: true,
      canPublish: opts.canPublish ?? true,
      canSubscribe: true,
      canPublishData: true,
      canUpdateOwnMetadata: true, // lets a user push a new avatar/name live
      // Hidden = admin silent-observer: they RECEIVE audio + speaker events but
      // are NOT shown to anyone and cannot be heard (monitoring, not joining).
      ...(opts.hidden ? { hidden: true } : {}),
    },
  };
  const head = base64url(JSON.stringify(header));
  const body = base64url(JSON.stringify(payload));
  const sig = base64url(crypto.createHmac("sha256", creds.apiSecret).update(`${head}.${body}`).digest());
  return `${head}.${body}.${sig}`;
}
