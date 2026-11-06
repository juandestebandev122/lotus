// WHERE A CUSTOM UPLOAD / BANNER CAN APPEAR — the single source of truth.
//
// THE BUG THIS EXISTS TO PREVENT: this list used to be written down TWICE — once
// in the admin page (what the admin can tick) and once as a server-side whitelist
// (what the server agrees to save). When new placements were added they were only
// added to the admin page, so the server quietly DELETED them on save:
//
//     placements: arr(input.placements).filter((p) => UPLOAD_PLACEMENTS.has(p))
//
// The admin ticked "Inside a voice room", pressed Save, and it vanished with no
// error — which is exactly why only the Home banner ever appeared. Both sides now
// import this one list, so the two can never drift apart again.
//
// RULE: a placement belongs here ONLY if something actually renders it. Check for
// a matching <CustomUploads placement="..."> before adding one.

export interface UploadPlacement {
  key: string;
  label: string;
  group: string;
}

export const UPLOAD_PLACEMENT_LIST: UploadPlacement[] = [
  // Home — rendered in app/(app)/home/page.tsx
  { key: "home-top", label: "Home — top banner", group: "Home" },
  { key: "home-popup", label: "Home — popup", group: "Home" },
  { key: "marquee", label: "Home — scrolling notice", group: "Home" },
  // Every screen — rendered in components/app-shell/AppShell.tsx
  { key: "all-pages", label: "All pages — top banner", group: "Every screen" },
  { key: "all-marquee", label: "All pages — scrolling notice", group: "Every screen" },
  { key: "all-popup", label: "All pages — popup", group: "Every screen" },
  // Voice rooms — rendered in app/(app)/rooms/page.tsx and rooms/[id]/page.tsx
  { key: "room-list", label: "Voice room list", group: "Voice rooms" },
  { key: "room-list-marquee", label: "Voice room list — scrolling notice", group: "Voice rooms" },
  { key: "room", label: "Inside a voice room", group: "Voice rooms" },
  { key: "room-marquee", label: "Voice room — scrolling notice", group: "Voice rooms" },
  // Games — rendered in games/ludo and games/snake
  { key: "game", label: "Playing-game screen", group: "Games" },
  { key: "game-marquee", label: "Game screen — scrolling notice", group: "Games" },
  // Other screens
  { key: "login", label: "Login screen", group: "Other screens" },
  { key: "wallet", label: "Wallet page", group: "Other screens" },
];

/** Every valid placement key. `wallet-top` is a legacy alias kept so older saved
 *  items don't lose their targeting. */
export const UPLOAD_PLACEMENT_KEYS: string[] = [
  ...UPLOAD_PLACEMENT_LIST.map((p) => p.key),
  "wallet-top",
];

export const UPLOAD_PLACEMENT_SET = new Set(UPLOAD_PLACEMENT_KEYS);

/** Admin-panel grouping, in display order. */
export const UPLOAD_PLACEMENT_GROUPS: { group: string; items: UploadPlacement[] }[] =
  UPLOAD_PLACEMENT_LIST.reduce<{ group: string; items: UploadPlacement[] }[]>((acc, p) => {
    const found = acc.find((g) => g.group === p.group);
    if (found) found.items.push(p);
    else acc.push({ group: p.group, items: [p] });
    return acc;
  }, []);

/** Human label for a placement key (falls back to the key itself). */
export function uploadPlacementLabel(key: string): string {
  return UPLOAD_PLACEMENT_LIST.find((p) => p.key === key)?.label ?? key;
}
