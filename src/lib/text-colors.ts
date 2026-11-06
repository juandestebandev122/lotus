// ============================================================================
// TEXT COLOUR MANAGEMENT — a system of its own, deliberately SEPARATE from
// Theme Management.
//
// Theme Management owns the *look*: accent colours, surfaces, button/chat shape,
// custom CSS. It never decides what colour a paragraph is. The trouble was that
// changing a theme still moved text around indirectly — the accent ramp is used
// for labels and links, and lifting the surface brightness leaves the fixed
// light-on-dark text ramp looking faded.
//
// So text gets its own controls. Every category below can be set independently,
// and each one is emitted as an `!important` rule AFTER the theme's variables,
// which is what makes "themes must not overwrite the chosen text colours" true
// rather than merely intended. A category left blank is not emitted at all —
// that part of the app keeps its built-in colour.
// ============================================================================

export interface TextColors {
  /** Master switch. Off (default) = the app's built-in text colours, untouched. */
  enabled?: boolean;
  /** Main body text. */
  body?: string;
  /** Page + section headings (h1–h6 and display type). */
  heading?: string;
  /** Secondary / supporting text. */
  secondary?: string;
  /** Form labels and field captions. */
  label?: string;
  /** Small descriptions, hints and helper lines. */
  description?: string;
  /** Text inside buttons. */
  button?: string;
  /** Input placeholder text. */
  placeholder?: string;
  /** Icon glyphs (they draw with currentColor). */
  icon?: string;
  /** Links. */
  link?: string;
  /** Sidebar / menu items. */
  menu?: string;
  /** The ACTIVE sidebar / menu item. */
  menuActive?: string;
  /**
   * FULL TEXT STYLING per category — font, size, bold/italic/underline,
   * alignment, letter spacing and line height. Keyed by the same category names
   * as the colours above, so one category can be restyled without touching any
   * other. Anything unset keeps the app's built-in styling.
   */
  styles?: Record<string, TextStyle>;
}

/** The categories that carry a COLOUR (and now a style). Named explicitly rather
 *  than derived from TextColors, so adding a non-colour field like `styles` can
 *  never widen this and break the colour handling. */
export type TextCategory =
  | "heading" | "body" | "secondary" | "description" | "label"
  | "button" | "placeholder" | "icon" | "link" | "menu" | "menuActive";

export interface TextColorField {
  key: TextCategory;
  label: string;
  desc: string;
  /** The colour this category has when nothing is set — shown as the Reset target. */
  fallback: string;
}

/** Every controllable text category, in the order the admin page lists them. */
export const TEXT_COLOR_FIELDS: TextColorField[] = [
  { key: "heading",     label: "Headings",        desc: "Page titles and section headings (h1–h6, display type).", fallback: "#f7f4ff" },
  { key: "body",        label: "Main text",       desc: "Ordinary body copy across the whole app.",                fallback: "#e0d8f5" },
  { key: "secondary",   label: "Secondary text",  desc: "Supporting lines under a title, meta text, counts.",      fallback: "#bcb1de" },
  { key: "description", label: "Descriptions",    desc: "Small helper text, hints and captions.",                  fallback: "#968abb" },
  { key: "label",       label: "Labels",          desc: "Form labels and field captions.",                         fallback: "#bcb1de" },
  { key: "button",      label: "Button text",     desc: "The words inside buttons.",                               fallback: "#ffffff" },
  { key: "placeholder", label: "Placeholders",    desc: "The greyed-out text inside an empty input box.",          fallback: "#756a9c" },
  { key: "icon",        label: "Icons",           desc: "Icon glyphs (they follow the text colour).",              fallback: "#bcb1de" },
  { key: "link",        label: "Links",           desc: "Tappable links inside text.",                             fallback: "#a78bfa" },
  { key: "menu",        label: "Menu text",       desc: "Sidebar and bottom-bar menu items.",                      fallback: "#bcb1de" },
  { key: "menuActive",  label: "Active menu item", desc: "The menu entry for the screen you're on.",               fallback: "#f7f4ff" },
];

/** #abc / #aabbcc / rgb(…) / rgba(…) — what the admin may type into the box. */
export function isValidColor(v: string): boolean {
  const s = (v ?? "").trim();
  if (!s) return false;
  if (/^#([0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$/i.test(s)) return true;
  return /^rgba?\(\s*\d{1,3}\s*,\s*\d{1,3}\s*,\s*\d{1,3}\s*(,\s*(0|1|0?\.\d+)\s*)?\)$/i.test(s);
}

/** rgb(124, 92, 252) → #7c5cfc, so <input type="color"> can show it. */
export function toHex(v: string): string {
  const s = (v ?? "").trim();
  if (/^#[0-9a-f]{6}$/i.test(s)) return s.toLowerCase();
  if (/^#[0-9a-f]{3}$/i.test(s)) return `#${s[1]}${s[1]}${s[2]}${s[2]}${s[3]}${s[3]}`.toLowerCase();
  if (/^#[0-9a-f]{8}$/i.test(s)) return s.slice(0, 7).toLowerCase();
  const m = s.match(/^rgba?\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})/i);
  if (m) {
    const hx = (n: string) => Math.max(0, Math.min(255, parseInt(n, 10))).toString(16).padStart(2, "0");
    return `#${hx(m[1])}${hx(m[2])}${hx(m[3])}`;
  }
  return "";
}

/** Relative luminance (WCAG) — used for the contrast warning in the admin page. */
function luminance(hex: string): number | null {
  const h = toHex(hex);
  if (!h) return null;
  const ch = (i: number) => {
    const c = parseInt(h.slice(1 + i * 2, 3 + i * 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * ch(0) + 0.7152 * ch(1) + 0.0722 * ch(2);
}

/**
 * WCAG contrast ratio between a text colour and the surface behind it, so the
 * admin is TOLD when a pick would be hard to read rather than discovering it
 * from a member complaint. Returns null when either colour can't be parsed.
 */
export function contrastRatio(fg: string, bg: string): number | null {
  const a = luminance(fg);
  const b = luminance(bg);
  if (a === null || b === null) return null;
  const [hi, lo] = a > b ? [a, b] : [b, a];
  return (hi + 0.05) / (lo + 0.05);
}

/** Only ever let a validated colour reach the stylesheet. */
const safe = (v?: string) => {
  const s = (v ?? "").trim();
  return isValidColor(s) ? s : "";
};

// ===========================================================================
// TEXT STYLE — everything about a category's type, not just its colour.
// Each category can set any of these independently; anything left unset keeps
// the app's built-in styling for that property.
// ===========================================================================

export type TextAlign = "left" | "center" | "right" | "justify";

export interface TextStyle {
  /** A key from FONT_FAMILIES ("" = the app's own font). */
  font?: string;
  /** Size as a % of the app's normal size for that category (50–200). */
  sizePct?: number;
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  align?: TextAlign;
  /** Letter spacing in px (-2 to 10). */
  letterSpacing?: number;
  /** Line height as a multiple (1.0 to 2.5). */
  lineHeight?: number;
}

/** Font choices. Inter and Poppins are ALREADY loaded by the app, and the rest
 *  are installed on every device, so nothing here costs an extra download. */
export const FONT_FAMILIES: { id: string; label: string; stack: string }[] = [
  { id: "", label: "App default", stack: "" },
  { id: "inter", label: "Inter (app body)", stack: "var(--font-inter), ui-sans-serif, system-ui, sans-serif" },
  { id: "poppins", label: "Poppins (app headings)", stack: "var(--font-poppins), var(--font-inter), sans-serif" },
  { id: "system", label: "System UI", stack: "ui-sans-serif, system-ui, -apple-system, 'Segoe UI', sans-serif" },
  { id: "arial", label: "Arial", stack: "Arial, Helvetica, sans-serif" },
  { id: "verdana", label: "Verdana", stack: "Verdana, Geneva, sans-serif" },
  { id: "tahoma", label: "Tahoma", stack: "Tahoma, Verdana, sans-serif" },
  { id: "trebuchet", label: "Trebuchet MS", stack: "'Trebuchet MS', Tahoma, sans-serif" },
  { id: "georgia", label: "Georgia (serif)", stack: "Georgia, 'Times New Roman', serif" },
  { id: "times", label: "Times New Roman (serif)", stack: "'Times New Roman', Times, serif" },
  { id: "courier", label: "Courier New (mono)", stack: "'Courier New', Courier, monospace" },
];

export const fontStack = (id?: string) => FONT_FAMILIES.find((f) => f.id === (id ?? ""))?.stack ?? "";

export const TEXT_ALIGNS: { id: TextAlign; label: string }[] = [
  { id: "left", label: "Left" },
  { id: "center", label: "Centre" },
  { id: "right", label: "Right" },
  { id: "justify", label: "Justify" },
];

const clampNum = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n));

/** The CSS declarations for one category's style (colour handled separately). */
export function styleDeclarations(s?: TextStyle | null): string[] {
  if (!s) return [];
  const d: string[] = [];
  const stack = fontStack(s.font);
  if (stack) d.push(`font-family:${stack} !important`);
  if (typeof s.sizePct === "number" && s.sizePct !== 100) d.push(`font-size:${clampNum(s.sizePct, 50, 200)}% !important`);
  if (s.bold === true) d.push("font-weight:700 !important");
  if (s.bold === false) d.push("font-weight:400 !important");
  if (s.italic) d.push("font-style:italic !important");
  if (s.underline) d.push("text-decoration:underline !important");
  if (s.align) d.push(`text-align:${s.align} !important`);
  if (typeof s.letterSpacing === "number" && s.letterSpacing !== 0) d.push(`letter-spacing:${clampNum(s.letterSpacing, -2, 10)}px !important`);
  if (typeof s.lineHeight === "number" && s.lineHeight > 0) d.push(`line-height:${clampNum(s.lineHeight, 1, 2.5)} !important`);
  return d;
}

/** True when this style actually asks for something. */
export const hasStyle = (s?: TextStyle | null) => styleDeclarations(s).length > 0;

/**
 * The stylesheet that puts the admin's choices on the screen.
 *
 * Every rule carries `!important` on purpose: Tailwind utility classes
 * (`text-mist-300`, `text-lotus-200`, …) are what paint text in this app, and a
 * plain rule would lose to them. This is also what keeps a later theme change
 * from washing the chosen colours out.
 *
 * Returns "" when the system is off or nothing is set, so the app is byte-for-byte
 * its old self until an admin actually picks something.
 */
/** The CSS selector each category paints. Kept in one place so the colour rules
 *  and the style rules can never target different things. */
export const CATEGORY_SELECTOR: Record<string, string> = {
  body: "body, .text-mist-200",
  heading: "h1, h2, h3, h4, h5, h6, .font-display, .text-mist-100",
  secondary: ".text-mist-300",
  description: ".text-mist-400, .text-mist-500, .text-mist-600",
  label: "label, label > span",
  button: "button, [role='button']",
  placeholder: "input::placeholder, textarea::placeholder",
  icon: "svg",
  link: "a",
  menu: "[data-lotus-menu] a, [data-lotus-menu] button",
  menuActive: "[data-lotus-menu] a[data-active='true'], [data-lotus-menu] button[data-active='true']",
};

export function buildTextColorCss(tc?: TextColors | null): string {
  if (!tc || tc.enabled === false || !tc.enabled) return "";
  const out: string[] = [];
  const push = (selector: string, color: string, prop = "color") => {
    if (color) out.push(`${selector}{${prop}:${color} !important}`);
  };

  const body = safe(tc.body);
  const heading = safe(tc.heading);
  const secondary = safe(tc.secondary);
  const description = safe(tc.description);
  const label = safe(tc.label);
  const button = safe(tc.button);
  const placeholder = safe(tc.placeholder);
  const icon = safe(tc.icon);
  const link = safe(tc.link);
  const menu = safe(tc.menu);
  const menuActive = safe(tc.menuActive);

  // Main text. `.text-mist-200` is the app's strong-body class; body copy that
  // inherits (plain <p>, <span>, <div>) is covered by the body rule.
  push("body, .text-mist-200", body);
  // Headings — both real heading tags and the display font used for card titles.
  push("h1, h2, h3, h4, h5, h6, .font-display, .text-mist-100", heading);
  push(".text-mist-300", secondary);
  push(".text-mist-400, .text-mist-500, .text-mist-600", description);
  push("label, label > span", label);
  push("button, [role='button']", button);
  push("::placeholder", placeholder, "color");
  push("input::placeholder, textarea::placeholder", placeholder, "color");
  // Icons draw with currentColor, so setting the colour on the <svg> is enough.
  // Scoped away from images/logos, which are not svg text.
  push("svg", icon);
  push("a", link);
  // The menu rails carry data-lotus-menu. These selectors are MORE specific than
  // the plain `a` / `button` rules above, so menu text stays independent of the
  // link and button colours no matter what order the rules end up in.
  push("[data-lotus-menu] a, [data-lotus-menu] button", menu);
  push("[data-lotus-menu] a[data-active='true'], [data-lotus-menu] button[data-active='true']", menuActive);

  // ---- FULL TEXT STYLING (font, size, weight, italic, underline, alignment,
  // letter spacing, line height) — emitted per category, after the colours, so a
  // category can carry any combination of the two.
  for (const f of TEXT_COLOR_FIELDS) {
    const decls = styleDeclarations(tc.styles?.[f.key]);
    if (!decls.length) continue;
    const sel = CATEGORY_SELECTOR[f.key];
    if (sel) out.push(`${sel}{${decls.join(";")}}`);
  }

  return out.join("\n");
}
