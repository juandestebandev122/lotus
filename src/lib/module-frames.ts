// ============================================================
// Per-module FRAME + BADGE visibility control (admin-managed).
//
// The client wants to decide, for EACH area of the app, whether purchased
// profile FRAMES and profile BADGES ("batches") are shown, and whether they are
// Required (always shown there — the visibility switch can't turn them off) or
// Optional (shown unless the admin hides them).
//
// Design goals:
//  • ADDITIVE + safe default: a module with NO saved setting shows frames AND
//    badges (Visible + Optional) — exactly today's behaviour. Nothing changes
//    until an admin flips a switch, so this can never regress a live game.
//  • ONE source of truth: config.moduleFrames keyed by the module id below.
//  • Simple helpers the render sites call: framesOnIn() / badgesOnIn().
// ============================================================
import type { AppConfig } from "@/lib/config";

// Every module the admin can control, in the client's requested order. The `key`
// is what render sites pass; the `label` is what the admin sees. `note` flags
// whether that surface currently renders a frame today (so the admin knows the
// switch takes effect there now vs. applies as that surface gains frames).
export const FRAME_MODULES: { key: string; label: string; live: boolean }[] = [
  { key: "profile", label: "User Profile", live: true },
  { key: "paidZone", label: "Paid Zone", live: true },
  { key: "business", label: "Business Profile", live: true },
  { key: "ludo", label: "Ludo Game", live: true },
  { key: "tournament", label: "Tournament", live: true },
  { key: "voiceRoom", label: "Voice Room", live: true },
  { key: "groupSummary", label: "Group Summary", live: true },
  { key: "voiceCall", label: "Voice Call", live: true },
  { key: "videoCall", label: "Video Call", live: true },
  { key: "privateChat", label: "Private Chat", live: true },
  { key: "groupChat", label: "Group Chat", live: true },
  { key: "competition", label: "Competition Room", live: true },
  { key: "leaderboard", label: "Leaderboard", live: true },
  { key: "matchHistory", label: "Match History", live: true },
  { key: "spectator", label: "Spectator Mode", live: true },
  { key: "friends", label: "Friends List", live: true },
  { key: "search", label: "Search Results", live: true },
  { key: "giftRankings", label: "Gift Rankings", live: true },
  { key: "agency", label: "Agency Panel", live: true },
  { key: "adminPanel", label: "Admin Panel", live: true },
  { key: "profileElements", label: "Profile Elements", live: true },
];

export type ModuleFrameSetting = {
  framesVisible?: boolean;   // default true — show purchased frames in this module
  framesRequired?: boolean;  // default false — when true, frames are ALWAYS shown (visibility can't hide them)
  badgesVisible?: boolean;   // default true — show profile badges in this module
  badgesRequired?: boolean;  // default false — when true, badges are ALWAYS shown
};

export type ModuleFramesConfig = Record<string, ModuleFrameSetting>;

function settingFor(config: AppConfig | undefined | null, moduleKey: string): ModuleFrameSetting {
  return config?.moduleFrames?.[moduleKey] ?? {};
}

/** Should purchased FRAMES render in this module right now?
 *  Required forces them on; otherwise on unless explicitly hidden. Missing
 *  config → true (today's behaviour). */
export function framesOnIn(config: AppConfig | undefined | null, moduleKey: string): boolean {
  const s = settingFor(config, moduleKey);
  return s.framesRequired === true || s.framesVisible !== false;
}

/** Should profile BADGES render in this module right now? Same rule as frames. */
export function badgesOnIn(config: AppConfig | undefined | null, moduleKey: string): boolean {
  const s = settingFor(config, moduleKey);
  return s.badgesRequired === true || s.badgesVisible !== false;
}

/** Whether a module's frames are marked Required (for the admin display + policy). */
export function framesRequiredIn(config: AppConfig | undefined | null, moduleKey: string): boolean {
  return settingFor(config, moduleKey).framesRequired === true;
}
export function badgesRequiredIn(config: AppConfig | undefined | null, moduleKey: string): boolean {
  return settingFor(config, moduleKey).badgesRequired === true;
}

/** Sanitise an incoming moduleFrames object (admin PATCH) — only known keys,
 *  only boolean flags. Keeps the stored blob small and safe. */
export function sanitizeModuleFrames(raw: unknown): ModuleFramesConfig {
  const out: ModuleFramesConfig = {};
  if (!raw || typeof raw !== "object") return out;
  const known = new Set(FRAME_MODULES.map((m) => m.key));
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    if (!known.has(k) || !v || typeof v !== "object") continue;
    const s = v as Record<string, unknown>;
    const entry: ModuleFrameSetting = {};
    if (typeof s.framesVisible === "boolean") entry.framesVisible = s.framesVisible;
    if (typeof s.framesRequired === "boolean") entry.framesRequired = s.framesRequired;
    if (typeof s.badgesVisible === "boolean") entry.badgesVisible = s.badgesVisible;
    if (typeof s.badgesRequired === "boolean") entry.badgesRequired = s.badgesRequired;
    out[k] = entry;
  }
  return out;
}
