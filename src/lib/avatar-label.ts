// WHAT A DEFAULT (photo-less) AVATAR SHOWS.
//
// THE BUG THIS FIXES: the old code was
//     name.split(" ").slice(0, 2).map((p) => p[0]?.toUpperCase()).join("")
// `p[0]` takes the first UTF-16 CODE UNIT, not the first character. An emoji is
// a surrogate PAIR, so a name like "🌸SIVA SIVA" yielded half a surrogate plus
// "S" — which the browser drew as a broken "◆S". Names that begin with an emoji
// are common here, so this hit a lot of members.
//
// It is also admin-controlled now: some clients want initials, some want the
// first name, some the whole name. See config.defaultAvatar.

export type AvatarLabelMode = "initials" | "first" | "full";

export interface AvatarLabelCfg {
  mode?: AvatarLabelMode;   // initials "SS" · first name "Siva" · full name "Siva Siva"
  maxChars?: number;        // hard cap so a long name can't overflow the circle
  uppercase?: boolean;      // force upper case
  keepEmoji?: boolean;      // keep emoji in the text (off — they read as noise at 28px)
  imageUrl?: string;        // a house picture to use instead of the colour circle
  showName?: boolean;       // draw the name on top of that picture too
}

export const DEFAULT_AVATAR_LABEL: Required<AvatarLabelCfg> = {
  mode: "first",            // the client's ask: show the NAME, not one letter
  maxChars: 10,
  uppercase: false,
  keepEmoji: false,
  imageUrl: "",
  showName: true,
};

/** Split into real CHARACTERS, so surrogate pairs (emoji) stay whole. */
function chars(s: string): string[] {
  return Array.from(s);
}

/** Drop emoji, pictographs, variation selectors and zero-width joiners. */
function stripEmoji(s: string): string {
  return chars(s)
    .filter((c) => {
      const cp = c.codePointAt(0) ?? 0;
      if (cp === 0x200d || cp === 0xfe0f || cp === 0xfe0e) return false;   // ZWJ + variation selectors
      if (cp >= 0x1f000 && cp <= 0x1ffff) return false;                    // emoji planes
      if (cp >= 0x2600 && cp <= 0x27bf) return false;                      // misc symbols + dingbats
      if (cp >= 0x2b00 && cp <= 0x2bff) return false;                      // arrows/symbols
      if (cp >= 0xe000 && cp <= 0xf8ff) return false;                      // private use
      if (cp >= 0xfe00 && cp <= 0xfe0f) return false;                      // variation selectors
      return true;
    })
    .join("");
}

// A module-level setting, installed once from the admin config by
// <AvatarLabelConfig/>. Avatar itself stays a plain (server-safe) component —
// giving it a React hook would force every screen that renders one to become a
// client component.
let CURRENT: Required<AvatarLabelCfg> = { ...DEFAULT_AVATAR_LABEL };

function merge(cfg?: AvatarLabelCfg, base = DEFAULT_AVATAR_LABEL): Required<AvatarLabelCfg> {
  return {
    mode: cfg?.mode ?? base.mode,
    maxChars: Math.max(1, Math.min(24, Number(cfg?.maxChars) || base.maxChars)),
    uppercase: cfg?.uppercase ?? base.uppercase,
    keepEmoji: cfg?.keepEmoji ?? base.keepEmoji,
    imageUrl: (cfg?.imageUrl ?? base.imageUrl) || "",
    showName: cfg?.showName ?? base.showName,
  };
}

export function configureAvatarLabel(cfg?: AvatarLabelCfg): void {
  CURRENT = merge(cfg);
}

/** House default picture, when the admin has set one (else ""). */
export function avatarDefaultImage(): string {
  return CURRENT.imageUrl;
}

/** Whether the name is drawn on top of that house picture. */
export function avatarShowName(): boolean {
  return CURRENT.showName;
}

/** The text drawn inside a default avatar. `override` is for the admin preview. */
export function avatarLabel(name: string, override?: AvatarLabelCfg): string {
  const c = override ? merge(override, CURRENT) : CURRENT;

  const cleaned = (c.keepEmoji ? name : stripEmoji(name)).trim();
  const words = cleaned.split(/\s+/).filter(Boolean);

  let out: string;
  if (!words.length) {
    // A name made ENTIRELY of emoji still needs something in the circle — fall
    // back to the first real character of the original rather than a blank.
    out = chars(name.trim())[0] ?? "?";
  } else if (c.mode === "initials") {
    out = words.slice(0, 2).map((w) => chars(w)[0] ?? "").join("").toUpperCase();
  } else if (c.mode === "full") {
    out = words.join(" ");
  } else {
    out = words[0];
  }

  let cut = chars(out).slice(0, c.maxChars).join("");
  // Never end mid-word on a multi-word label — "Ahmed Al R" reads as a typo.
  // Drop the part-word instead, as long as a whole word survives.
  if (cut.length < out.length && cut.includes(" ")) {
    const trimmed = cut.slice(0, cut.lastIndexOf(" ")).trimEnd();
    if (trimmed) cut = trimmed;
  }
  return c.uppercase ? cut.toUpperCase() : cut;
}

/** Rough text-size class so a longer label still fits the circle. */
export function avatarLabelScale(label: string): string {
  const n = Array.from(label).length;
  if (n <= 2) return "";               // initials keep the size the avatar set
  if (n <= 4) return "text-[0.72em]";
  if (n <= 6) return "text-[0.58em]";
  if (n <= 9) return "text-[0.46em]";
  return "text-[0.38em]";
}
