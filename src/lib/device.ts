"use client";

// A stable per-browser device id + best-effort device details.
//
// IMPORTANT (this is a web app): a browser cannot expose the real hardware id, IMEI,
// MAC, brand, or model — this id is a random value we generate and keep in
// localStorage. It's stable per browser but can be cleared or spoofed. It is what
// powers "how many accounts share this device" detection and the admin block/force-
// logout controls. It is not personal data on its own (just a random string).

const KEY = "lotus.device.id";
const HINTS_KEY = "lotus.device.hints";

// User-Agent Client Hints let a Chromium browser reveal the REAL device model
// (e.g. "SM-S921B" for a Galaxy S24) that modern Chrome redacts from the UA string
// (it shows the placeholder "K"). It's async + Chromium-only (undefined on iOS
// Safari / Firefox), so we resolve it once, cache it, and read it synchronously.
let hints: { model?: string; platform?: string; platformVersion?: string } = {};
if (typeof window !== "undefined") {
  try { const raw = localStorage.getItem(HINTS_KEY); if (raw) hints = JSON.parse(raw); } catch { /* ignore */ }
  try {
    const uad = (navigator as unknown as { userAgentData?: { getHighEntropyValues?: (h: string[]) => Promise<Record<string, unknown>> } }).userAgentData;
    uad?.getHighEntropyValues?.(["model", "platform", "platformVersion"]).then((v) => {
      const next = {
        model: String(v.model ?? "").slice(0, 60),
        platform: String(v.platform ?? "").slice(0, 30),
        platformVersion: String(v.platformVersion ?? "").slice(0, 20),
      };
      hints = next;
      try { localStorage.setItem(HINTS_KEY, JSON.stringify(next)); } catch { /* ignore */ }
    }).catch(() => { /* unsupported → leave blank */ });
  } catch { /* ignore */ }
}

export function getDeviceId(): string {
  try {
    let id = localStorage.getItem(KEY);
    if (!id) {
      id = (typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : `d_${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`);
      localStorage.setItem(KEY, id);
    }
    return id;
  } catch {
    return "";
  }
}

export interface ClientDeviceInfo {
  deviceId: string;
  screen?: string;
  lang?: string;
  tz?: string;
  netType?: string;
  ua?: string;
  appVersion?: string;
  model?: string;           // real device model from Client Hints (e.g. "SM-S921B")
  platform?: string;        // "Android" / "iOS" / "Windows" …
  platformVersion?: string; // OS version from Client Hints
}

export function collectDeviceInfo(appVersion?: string): ClientDeviceInfo {
  const info: ClientDeviceInfo = { deviceId: getDeviceId() };
  try {
    const s = window.screen;
    const dpr = Math.round((window.devicePixelRatio || 1) * 10) / 10;
    if (s?.width) info.screen = `${s.width}×${s.height}${dpr && dpr !== 1 ? ` @${dpr}x` : ""}`;
    if (navigator.language) info.lang = navigator.language;
    info.tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    const conn = (navigator as unknown as { connection?: { effectiveType?: string } }).connection;
    if (conn?.effectiveType) info.netType = conn.effectiveType;
    info.ua = navigator.userAgent;
    if (hints.model) info.model = hints.model;
    if (hints.platform) info.platform = hints.platform;
    if (hints.platformVersion) info.platformVersion = hints.platformVersion;
    if (appVersion) info.appVersion = appVersion;
  } catch {
    /* best-effort — any missing API just leaves that field blank */
  }
  return info;
}
