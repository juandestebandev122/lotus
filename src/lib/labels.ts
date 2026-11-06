// Editable front-end text labels. The admin can override any of these from
// Admin → Text & Labels (saved to config.labels). Code reads them via lbl().
// Defaults live HERE; config.labels only stores the admin's overrides.

export interface LabelDef { key: string; default: string; section: string; hint?: string }

export const LABEL_DEFS: LabelDef[] = [
  // ===== Navigation (sidebar / bottom bar) =====
  { section: "Navigation menu", key: "nav./home", default: "Home" },
  { section: "Navigation menu", key: "nav./rooms", default: "Voice Rooms" },
  { section: "Navigation menu", key: "nav./tournaments", default: "Tournaments" },
  { section: "Navigation menu", key: "nav./wallet", default: "Wallet" },
  { section: "Navigation menu", key: "nav./documents", default: "Documents" },
  { section: "Navigation menu", key: "nav./friends", default: "Friends" },
  { section: "Navigation menu", key: "nav./messages", default: "Messages" },
  { section: "Navigation menu", key: "nav./search", default: "Search" },
  { section: "Navigation menu", key: "nav./notifications", default: "Notifications" },
  { section: "Navigation menu", key: "nav./profile", default: "Profile" },
  // The rest of the menu. Every nav entry is rendered through lbl("nav.<href>"),
  // so listing them here is all that's needed to make them editable.
  { section: "Navigation menu", key: "nav./paid-zone", default: "Paid Zone" },
  { section: "Navigation menu", key: "nav./competitions", default: "Competitions" },
  { section: "Navigation menu", key: "nav./reels", default: "Reels" },
  { section: "Navigation menu", key: "nav./lucky-number", default: "Lucky Number" },
  { section: "Navigation menu", key: "nav./lucky-spin", default: "Lucky Spin" },
  { section: "Navigation menu", key: "nav./leaderboard", default: "Leaderboards" },
  { section: "Navigation menu", key: "nav./business", default: "Business" },
  { section: "Navigation menu", key: "nav./jobs", default: "Jobs" },
  { section: "Navigation menu", key: "nav./agencies", default: "Agencies" },
  { section: "Navigation menu", key: "nav./agency", default: "My Agency" },
  { section: "Navigation menu", key: "nav./store", default: "Store" },
  { section: "Navigation menu", key: "nav./customize", default: "Frames & Appearance" },
  { section: "Navigation menu", key: "nav./storage", default: "My Storage" },
  { section: "Navigation menu", key: "nav./support", default: "Help & Support" },
  { section: "Navigation menu", key: "nav./all-pages", default: "All Pages", hint: "Also the “All” button on the phone bottom bar." },

  // ===== Home — hero banner =====
  { section: "Home — banner", key: "home.dailyRewards", default: "Daily Rewards" },
  { section: "Home — banner", key: "home.heroTitle", default: "Play games, win rewards", hint: "Big banner heading" },
  { section: "Home — banner", key: "home.heroSubtitle", default: "Jump into a voice room, challenge a friend to Ludo or Chess, and climb the leaderboard." },
  { section: "Home — banner", key: "home.joinRoom", default: "Join a room" },
  { section: "Home — banner", key: "home.createRoom", default: "Create room" },

  // ===== Home — quick action tiles =====
  { section: "Home — quick actions", key: "qa.voiceRooms", default: "Voice Rooms" },
  { section: "Home — quick actions", key: "qa.voiceRooms.sub", default: "Join live conversations" },
  { section: "Home — quick actions", key: "qa.paidZone", default: "Paid Zone" },
  { section: "Home — quick actions", key: "qa.paidZone.sub", default: "Premium 1:1 audio & video" },
  { section: "Home — quick actions", key: "qa.messages", default: "Messages" },
  { section: "Home — quick actions", key: "qa.messages.sub", default: "Chat with friends" },
  { section: "Home — quick actions", key: "qa.tournaments", default: "Tournaments" },
  { section: "Home — quick actions", key: "qa.tournaments.sub", default: "Compete & win" },
  { section: "Home — quick actions", key: "qa.findFriends", default: "Find Friends" },
  { section: "Home — quick actions", key: "qa.findFriends.sub", default: "Connect & play" },
  { section: "Home — quick actions", key: "qa.competitions", default: "Competitions" },
  { section: "Home — quick actions", key: "qa.competitions.sub", default: "Sing, vote & win" },

  // ===== Home — section headings =====
  { section: "Home — sections", key: "home.liveRooms", default: "Live voice rooms" },
  { section: "Home — sections", key: "home.tournaments", default: "Upcoming tournaments" },
  { section: "Home — sections", key: "home.onlineFriends", default: "Online friends" },
  { section: "Home — sections", key: "home.recentActivity", default: "Recent activity" },

  // ===== Terminology (words reused across the whole app) =====
  // The word shown for a competition/tournament payout POSITION. Kept as
  // "Support Staff" for compliance; once certified, the admin can change this ONE
  // value (e.g. to "Prize") and it updates everywhere it's used automatically.
  { section: "Terminology", key: "term.prize", default: "Support Staff", hint: 'Word for a payout position (tournaments & competitions). Change it once here and it updates across the whole app. Kept as "Support Staff" until certification.' },
];

const DEFAULTS: Record<string, string> = Object.fromEntries(LABEL_DEFS.map((d) => [d.key, d.default]));

/** Stable, readable key for one tile in the All Pages directory. Built from the
 *  section + the tile's own title so it survives the list being reordered. */
export function pageLabelKey(sectionKey: string, title: string, part: "title" | "desc" = "title"): string {
  const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40);
  return `page.${sectionKey}.${slug}${part === "desc" ? ".desc" : ""}`;
}

/** Which label keys the admin is allowed to override.
 *
 *  The catalogue above is hand-written, but the App Pages directory and the
 *  navigation menu generate their keys from real data, so a fixed list can
 *  never cover them. Those two families are accepted by SHAPE instead — the
 *  pattern is deliberately tight (no spaces, no HTML, bounded length) so this
 *  stays a text-label whitelist and not an open config write. */
const DYNAMIC_KEY = /^(?:nav|page)\.[A-Za-z0-9./_-]{1,80}$/;
export function isEditableLabelKey(key: string): boolean {
  return Object.prototype.hasOwnProperty.call(DEFAULTS, key) || DYNAMIC_KEY.test(key);
}

/** Resolve a label: the admin's override (if set & non-empty), else the built-in
 *  default, else the explicit fallback, else the key itself. */
export function lbl(labels: Record<string, string> | undefined | null, key: string, fallback?: string): string {
  const o = labels?.[key];
  if (typeof o === "string" && o.trim()) return o;
  return DEFAULTS[key] ?? fallback ?? key;
}
