import { ok, fail, readJson } from "@/server/http";
import { getCurrentUser } from "@/server/auth";
import { getConfig, updateConfig, addAdminLog, recordShareChange } from "@/server/repo";
import type { AppConfig, BusinessFieldDef, BusinessSection, ProductFieldDef } from "@/server/db";
import { isEditableLabelKey } from "@/lib/labels";
import { sanitizeModuleFrames } from "@/lib/module-frames";
import { canAccess } from "@/lib/admin-perms";
import { sanitizeThemePreset } from "@/lib/theme-presets";
import { sanitizeSiteNav } from "@/lib/site-nav";
import { isValidColor, TEXT_COLOR_FIELDS, FONT_FAMILIES } from "@/lib/text-colors";
import { slugify, safePageHref } from "@/lib/custom-pages";

export const runtime = "nodejs";

const FIELD_TYPES = ["text", "textarea", "tel", "email", "url", "number", "select"];

/** Validate + normalise one admin-defined business form field. Returns null for
 *  anything unusable (missing label). Derives a stable `key` from the label. */
function sanitizeFieldDef(raw: unknown): BusinessFieldDef | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const label = typeof r.label === "string" ? r.label.trim().slice(0, 60) : "";
  if (!label) return null;
  const rawKey = typeof r.key === "string" && r.key.trim() ? r.key : label;
  const key = rawKey.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "").slice(0, 60) || "field";
  const type = (typeof r.type === "string" && FIELD_TYPES.includes(r.type) ? r.type : "text") as BusinessFieldDef["type"];
  const options = Array.isArray(r.options)
    ? (r.options as unknown[]).filter((o): o is string => typeof o === "string").map((o) => o.trim().slice(0, 60)).filter(Boolean).slice(0, 100)
    : undefined;
  return {
    key,
    label,
    type,
    options: type === "select" ? (options ?? []) : undefined,
    placeholder: typeof r.placeholder === "string" ? r.placeholder.trim().slice(0, 100) : undefined,
    required: r.required === true,
    enabled: r.enabled !== false,
  };
}

const SECTION_KEYS = ["page", "reels", "videos", "products", "offers", "jobs", "reviews"];

/** Validate one business-profile section. Only known (feature-backed) keys are
 *  accepted; the admin controls label / visibility / order, not the key itself. */
function sanitizeSection(raw: unknown): BusinessSection | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const key = typeof r.key === "string" ? r.key.trim() : "";
  if (!SECTION_KEYS.includes(key)) return null;
  const label = typeof r.label === "string" && r.label.trim() ? r.label.trim().slice(0, 40) : key;
  return { key, label, enabled: r.enabled !== false };
}

// Anyone may read the public config (the app needs it to render
// announcements, enabled games, maintenance state, etc.).
/** A short hash, so a changed QR gets a fresh (cache-busting) URL. */
function shortHash(s: string): string {
  let h1 = 0x811c9dc5, h2 = 0x01000193;
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i);
    h1 = Math.imul(h1 ^ c, 0x01000193) >>> 0;
    h2 = Math.imul(h2 + c, 0x85ebca6b) >>> 0;
  }
  return (h1.toString(16) + h2.toString(16)).slice(0, 12);
}

export async function GET() {
  const config = await getConfig();
  const user = await getCurrentUser();
  const isAdmin = user?.role === "admin";

  // MOBILE DATA: the payment QR is a base64 image stored in the config. This
  // endpoint is public and fetched by every client, so that one picture was
  // ~82 KB — 58% of the whole config — shipped to every member on every load,
  // for something only drawn inside the "Buy coins" modal. Members now get a
  // short URL to /api/payment-qr (downloaded once, then cached); the admin
  // panel still receives the raw value so its editor can show/replace it.
  let out: typeof config = config;
  const qrImg = config.paymentQr?.imageUrl ?? "";
  if (!isAdmin && qrImg.startsWith("data:image/")) {
    out = { ...config, paymentQr: { ...config.paymentQr!, imageUrl: `/api/payment-qr?v=${shortHash(qrImg)}` } };
  }

  // PRIVACY: never broadcast the full Dice-Control player-targeting list to every
  // client. A non-admin only needs their OWN rule (the roll happens on their device);
  // admins read the complete set via /api/admin/dice-control. This keeps who-is-being-
  // controlled from leaking to players.
  const pcs = out.diceControl?.playerControls;
  if (pcs?.length && !isAdmin) {
    const mine = pcs.filter((p) => p.userId === user?.id);
    out = { ...out, diceControl: { ...out.diceControl, playerControls: mine } };
  }
  return ok({ config: out });
}

// Only an administrator may change platform configuration.
export async function PATCH(req: Request) {
  const user = await getCurrentUser();
  if (!user) return fail("Please log in first", 401);
  if (user.role !== "admin") return fail("Administrator access required", 403);

  const body = await readJson(req);
  const patch: Partial<AppConfig> = {};
  type ShareSnap = { user: number; agency: number; company: number; trust: number; trustEnabled: boolean; gst: number };
  let shareChange: { before: ShareSnap; after: ShareSnap } | null = null;

  if (typeof body.appName === "string") patch.appName = body.appName.slice(0, 60);
  if (typeof body.companyName === "string") patch.companyName = body.companyName.slice(0, 60);
  if (typeof body.themeColor === "string") { const c = body.themeColor.trim(); patch.themeColor = /^#[0-9a-fA-F]{6}$/.test(c) ? c.toLowerCase() : ""; }
  if (typeof body.themeColor2 === "string") { const c = body.themeColor2.trim(); patch.themeColor2 = /^#[0-9a-fA-F]{6}$/.test(c) ? c.toLowerCase() : ""; }
  // SURFACE THEMING — the tint/brightness of every panel + the page background.
  if (typeof body.themeSurface === "string") { const c = body.themeSurface.trim(); patch.themeSurface = /^#[0-9a-fA-F]{6}$/.test(c) ? c.toLowerCase() : ""; }
  if (typeof body.themeSurfaceBrightness === "number" && isFinite(body.themeSurfaceBrightness)) patch.themeSurfaceBrightness = Math.max(0, Math.min(100, Math.round(body.themeSurfaceBrightness)));
  if (typeof body.themeGlow === "number" && isFinite(body.themeGlow)) patch.themeGlow = Math.max(0, Math.min(100, Math.round(body.themeGlow)));
  // Only our OWN uploaded media may become the app background — never an off-site URL.
  if (typeof body.themeBgImage === "string") {
    const s = body.themeBgImage.trim().slice(0, 400);
    patch.themeBgImage = /^\/api\/(media|file)\/[\w.-]+$/i.test(s) ? s : "";
  }
  // Super-admin custom CSS injected app-wide. Cap length and neutralise any attempt to
  // break out of the <style> tag or smuggle a <script> — CSS itself can't run JS, and the
  // page injects this into a single <style> element, so those are the only escape vectors.
  // GATE: because this styles the WHOLE app for everyone, only an admin with the `settings`
  // permission (super-admins) may set it — a limited moderator/support sub-role cannot.
  if (typeof body.customCss === "string" && canAccess("settings", user.adminRole, user.adminPermissions)) {
    patch.customCss = body.customCss.slice(0, 20000).replace(/<\/?\s*(style|script)/gi, "/**/");
  }
  // Menu layout — reorder + show/hide the user nav. order/hidden are lists of item hrefs
  // (start with "/"). Capped so a bad payload can't bloat the config.
  if (body.menuLayout && typeof body.menuLayout === "object") {
    const m = body.menuLayout as Record<string, unknown>;
    const curMenu = (await getConfig()).menuLayout;
    const hrefs = (v: unknown) => Array.isArray(v) ? (v as unknown[]).filter((x): x is string => typeof x === "string" && x.startsWith("/")).slice(0, 60) : undefined;
    // SUBMENUS — child links under a menu item. Internal paths only, so a submenu
    // can never point the app off-site.
    const submenus = (() => {
      if (!m.submenus || typeof m.submenus !== "object") return curMenu?.submenus;
      const out: Record<string, { label: string; href: string }[]> = {};
      for (const [parent, kids] of Object.entries(m.submenus as Record<string, unknown>).slice(0, 60)) {
        if (!parent.startsWith("/") || !Array.isArray(kids)) continue;
        const list = (kids as unknown[])
          .filter((k): k is Record<string, unknown> => !!k && typeof k === "object")
          .map((k) => ({
            label: typeof k.label === "string" ? k.label.trim().slice(0, 60) : "",
            href: typeof k.href === "string" && k.href.startsWith("/") && !k.href.startsWith("//") ? k.href.slice(0, 200) : "",
          }))
          .filter((k) => k.label && k.href)
          .slice(0, 20);
        if (list.length) out[parent] = list;
      }
      return out;
    })();
    patch.menuLayout = { order: hrefs(m.order), hidden: hrefs(m.hidden), submenus };
  }
  // Public site header + footer (links, tagline, copyright). Every href is
  // validated in sanitizeSiteNav — only internal paths and safe web/mail/tel
  // addresses survive, so a nav link can never carry a script.
  if (body.siteNav && typeof body.siteNav === "object") {
    patch.siteNav = sanitizeSiteNav(body.siteNav) as AppConfig["siteNav"];
  }
  // UI style tokens — only known enum values; anything else falls back to the default look.
  if (body.uiStyle && typeof body.uiStyle === "object") {
    const u = body.uiStyle as Record<string, unknown>;
    const pick = <T extends string>(v: unknown, allowed: readonly T[]): T | undefined => (typeof v === "string" && (allowed as readonly string[]).includes(v)) ? v as T : undefined;
    patch.uiStyle = {
      buttonShape: pick(u.buttonShape, ["sharp", "rounded", "pill"] as const),
      chatBubbleShape: pick(u.chatBubbleShape, ["sharp", "rounded", "round"] as const),
      chatFontSize: pick(u.chatFontSize, ["small", "normal", "large"] as const),
    };
  }
  // Theme Management — the saved themes list + active theme + user-switch flag.
  if (Array.isArray(body.themes)) {
    patch.themes = (body.themes as unknown[]).slice(0, 100).map(sanitizeThemePreset).filter((t): t is NonNullable<typeof t> => t !== null);
  }
  if (typeof body.activeThemeId === "string") patch.activeThemeId = body.activeThemeId.slice(0, 40);
  if (typeof body.allowUserThemeSwitch === "boolean") patch.allowUserThemeSwitch = body.allowUserThemeSwitch;
  if (typeof body.announcement === "string") patch.announcement = body.announcement.slice(0, 280);
  if (typeof body.adminLimit === "number") patch.adminLimit = Math.max(1, Math.min(100, Math.floor(body.adminLimit)));
  // Chance-missing timer: seconds a player has per turn before it counts as a
  // missed turn (loses a heart). Clamped to a sane 5–120s range.
  if (typeof body.gameTurnSeconds === "number") patch.gameTurnSeconds = Math.max(5, Math.min(120, Math.floor(body.gameTurnSeconds)));
  if (body.gameDiceSpeed === "slow" || body.gameDiceSpeed === "normal" || body.gameDiceSpeed === "fast") patch.gameDiceSpeed = body.gameDiceSpeed;
  if (body.gameTokenSpeed === "slow" || body.gameTokenSpeed === "normal" || body.gameTokenSpeed === "fast") patch.gameTokenSpeed = body.gameTokenSpeed;
  // PER-GAME overrides (ludo/snake/chess) — each field optional; unset = global fallback.
  if (body.perGameSettings && typeof body.perGameSettings === "object") {
    const spd = (v: unknown) => (v === "slow" || v === "normal" || v === "fast" ? v : undefined);
    const src = body.perGameSettings as Record<string, Record<string, unknown>>;
    const out: Record<string, { turnSeconds?: number; diceSpeed?: "slow" | "normal" | "fast"; tokenSpeed?: "slow" | "normal" | "fast"; returnChancesOnRejoin?: boolean }> = {};
    for (const g of ["ludo", "snake", "chess"]) {
      const s = src[g]; if (!s || typeof s !== "object") continue;
      const entry: { turnSeconds?: number; diceSpeed?: "slow" | "normal" | "fast"; tokenSpeed?: "slow" | "normal" | "fast"; returnChancesOnRejoin?: boolean } = {};
      if (typeof s.turnSeconds === "number") entry.turnSeconds = Math.max(5, Math.min(120, Math.floor(s.turnSeconds)));
      const d = spd(s.diceSpeed); if (d) entry.diceSpeed = d;
      const t = spd(s.tokenSpeed); if (t) entry.tokenSpeed = t;
      if (typeof s.returnChancesOnRejoin === "boolean") entry.returnChancesOnRejoin = s.returnChancesOnRejoin;
      if (Object.keys(entry).length) out[g] = entry;
    }
    patch.perGameSettings = out;
  }
  // OPTIONAL "Fair Dice" pity system — merged onto the current value so a partial
  // save never wipes it. Clamped to safe ranges; ships OFF (pure-random dice).
  if (body.fairDice && typeof body.fairDice === "object") {
    const fd = body.fairDice as Record<string, unknown>;
    const cur = (await getConfig()).fairDice ?? {};
    patch.fairDice = {
      enabled: typeof fd.enabled === "boolean" ? fd.enabled : (cur.enabled ?? false),
      threshold: typeof fd.threshold === "number" ? Math.max(3, Math.min(40, Math.floor(fd.threshold))) : (cur.threshold ?? 12),
      boostPercent: typeof fd.boostPercent === "number" ? Math.max(0, Math.min(100, Math.floor(fd.boostPercent))) : (cur.boostPercent ?? 50),
      guaranteeAfter: typeof fd.guaranteeAfter === "number" ? Math.max(0, Math.min(60, Math.floor(fd.guaranteeAfter))) : (cur.guaranteeAfter ?? 20),
    };
  }
  // Speaking (active-speaker) avatar effect — style / colour / speed / on-off.
  if (body.speakingFx && typeof body.speakingFx === "object") {
    const sf = body.speakingFx as Record<string, unknown>;
    const cur = (await getConfig()).speakingFx ?? {};
    const STYLES = ["glow", "pulse", "scale", "float", "neon", "ringPulse", "ripple", "waves", "rotatingRing", "equalizer", "custom", "none"];
    // Custom animation URL — only accept our own uploaded media path (server-served,
    // no external/inline URLs), so this can never inject an off-site or unsafe asset.
    // imageUrl rules: key absent → keep current (partial save can't wipe it);
    // empty string → explicit "remove" (the Remove button sends ""); a non-empty
    // value must match our own media path or it's rejected (kept as-is), so an
    // off-site / unsafe URL can never be injected.
    const hasImg = Object.prototype.hasOwnProperty.call(sf, "imageUrl");
    const rawImg = typeof sf.imageUrl === "string" ? sf.imageUrl.trim().slice(0, 300) : "";
    const imageUrl = !hasImg ? (cur.imageUrl ?? "")
      : rawImg === "" ? ""
      : (/^\/api\/media\/[a-z0-9_.-]+$/i.test(rawImg) ? rawImg : (cur.imageUrl ?? ""));
    patch.speakingFx = {
      enabled: typeof sf.enabled === "boolean" ? sf.enabled : (cur.enabled !== false),
      style: (typeof sf.style === "string" && STYLES.includes(sf.style) ? sf.style : (cur.style ?? "glow")),
      color: typeof sf.color === "string" ? (/^#?[0-9a-fA-F]{6}$/.test(sf.color.trim()) ? (sf.color.trim().startsWith("#") ? sf.color.trim() : "#" + sf.color.trim()) : "") : (cur.color ?? ""),
      speed: (sf.speed === "slow" || sf.speed === "normal" || sf.speed === "fast" ? sf.speed : (cur.speed ?? "normal")) as "slow" | "normal" | "fast",
      imageUrl,
    };
  }
  // Configurable Agency LEVEL tiers (Admin → Agency Levels). Full replace, each
  // tier validated + clamped; merged onto the current value so a partial save keeps
  // the rest.
  if (body.agencyLevels && typeof body.agencyLevels === "object") {
    const al = body.agencyLevels as Record<string, unknown>;
    const cur = (await getConfig()).agencyLevels ?? {};
    // "coins" is intentionally NOT accepted — Agency.totalCoins is never fed, so it
    // would pin every agency to the lowest tier. Only members / earnings are real.
    const metric = al.metric === "members" || al.metric === "earnings" ? al.metric : (cur.metric === "earnings" ? "earnings" : "members");
    const tiers = Array.isArray(al.tiers)
      ? (al.tiers as unknown[])
          .filter((t): t is Record<string, unknown> => !!t && typeof t === "object")
          .slice(0, 100)
          .map((t) => ({
            id: typeof t.id === "string" && t.id ? t.id.slice(0, 40) : `agl_${Math.random().toString(36).slice(2, 8)}`,
            name: (typeof t.name === "string" ? t.name : "Tier").slice(0, 30),
            badge: (typeof t.badge === "string" ? t.badge : "🏅").slice(0, 8),
            color: typeof t.color === "string" && /^#?[0-9a-fA-F]{6}$/.test(t.color.trim()) ? (t.color.trim().startsWith("#") ? t.color.trim() : "#" + t.color.trim()) : "#a855f7",
            minValue: typeof t.minValue === "number" ? Math.max(0, Math.min(10_000_000, Math.floor(t.minValue))) : 0,
            perk: typeof t.perk === "string" && t.perk.trim() ? t.perk.slice(0, 120) : undefined,
          }))
      : (cur.tiers ?? []);
    patch.agencyLevels = { enabled: typeof al.enabled === "boolean" ? al.enabled : (cur.enabled !== false), metric, tiers };
  }
  // Admin-managed categories (Store + Room). Full replace of the array from the
  // Categories admin page; each entry validated + clamped.
  if (Array.isArray(body.categories)) {
    patch.categories = (body.categories as unknown[])
      .filter((c): c is Record<string, unknown> => !!c && typeof c === "object")
      .map((c) => ({
        id: String(c.id ?? "").slice(0, 60) || `cat_${Math.random().toString(36).slice(2, 8)}`,
        name: String(c.name ?? "").trim().slice(0, 40),
        scope: (c.scope === "store" ? "store" : "room") as "store" | "room",
        enabled: c.enabled !== false,
        order: typeof c.order === "number" && isFinite(c.order) ? Math.max(0, Math.floor(c.order)) : 0,
      }))
      .filter((c) => c.name)
      .slice(0, 200);
  }
  // Admin-managed token designs (enable/disable/rename + custom image tokens).
  if (Array.isArray(body.tokenDesigns)) {
    patch.tokenDesigns = body.tokenDesigns
      .filter((d): d is Record<string, unknown> => !!d && typeof d === "object")
      .map((d) => ({
        id: String(d.id ?? "").slice(0, 60),
        name: String(d.name ?? "Token").slice(0, 60),
        enabled: d.enabled !== false,
        ...(typeof d.builtin === "string" ? { builtin: d.builtin.slice(0, 60) } : {}),
        ...(typeof d.image === "string" ? { image: d.image.slice(0, 400) } : {}),
        // PER-COLOUR artwork, so the four players' coins can look different.
        // Only the four real Ludo colours are accepted; empty values are dropped
        // so a colour with no picture cleanly falls back to the shared `image`.
        ...(d.images && typeof d.images === "object"
          ? {
              images: (["red", "green", "yellow", "blue"] as const).reduce((acc, c) => {
                const v = (d.images as Record<string, unknown>)[c];
                if (typeof v === "string" && v.trim()) acc[c] = v.slice(0, 400);
                return acc;
              }, {} as Record<string, string>),
            }
          : {}),
        ...(typeof d.category === "string" ? { category: d.category.slice(0, 20) } : {}),
        ...(typeof d.order === "number" && isFinite(d.order) ? { order: Math.max(0, Math.floor(d.order)) } : {}),
        // Coin price — 0/unset keeps the token free, above 0 puts it in the Store.
        priceCoins: Math.max(0, Math.floor(Number(d.priceCoins) || 0)),
        validityDays: Math.max(0, Math.floor(Number(d.validityDays) || 0)),
      }))
      .filter((d) => d.id);
  }
  // Admin-managed DICE library — same shape as the token catalogue.
  if (Array.isArray(body.diceDesigns)) {
    patch.diceDesigns = body.diceDesigns
      .filter((d): d is Record<string, unknown> => !!d && typeof d === "object")
      .map((d) => ({
        id: String(d.id ?? "").slice(0, 60),
        name: String(d.name ?? "Dice").slice(0, 60),
        enabled: d.enabled !== false,
        ...(typeof d.builtin === "string" ? { builtin: d.builtin.slice(0, 60) } : {}),
        ...(typeof d.image === "string" ? { image: d.image.slice(0, 400) } : {}),
        // Tailwind class strings for a non-image die. Length-capped, and never
        // interpolated into anything but a className, so they cannot inject markup.
        ...(typeof d.surface === "string" ? { surface: d.surface.slice(0, 200) } : {}),
        ...(typeof d.pip === "string" ? { pip: d.pip.slice(0, 200) } : {}),
        ...(typeof d.category === "string" ? { category: d.category.slice(0, 20) } : {}),
        ...(typeof d.order === "number" && isFinite(d.order) ? { order: Math.max(0, Math.floor(d.order)) } : {}),
        // Coin price for a paid dice (0 = free). Capped so a typo can't create a
        // million-coin item.
        priceCoins: typeof d.priceCoins === "number" && isFinite(d.priceCoins) ? Math.max(0, Math.min(1_000_000, Math.floor(d.priceCoins))) : 0,
        validityDays: Math.max(0, Math.floor(Number(d.validityDays) || 0)),
      }))
      .filter((d) => d.id)
      .slice(0, 60);
  }
  // DICE MODEL MANAGEMENT — the full model library. Every colour is validated
  // before it can reach an inline style, and every enum is checked against its
  // own list, so nothing arbitrary from the request ends up being rendered.
  if (Array.isArray(body.diceModels)) {
    const col = (v: unknown): string | undefined => {
      if (typeof v !== "string") return undefined;
      const s = v.trim();
      if (!s) return "";
      return /^#([0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$/i.test(s) || /^rgba?\(\s*\d{1,3}\s*,\s*\d{1,3}\s*,\s*\d{1,3}\s*(,\s*(0|1|0?\.\d+)\s*)?\)$/i.test(s) ? s : "";
    };
    const pick = <T extends string>(v: unknown, allowed: readonly T[]): T | undefined =>
      typeof v === "string" && (allowed as readonly string[]).includes(v) ? (v as T) : undefined;
    const num = (v: unknown, lo: number, hi: number): number | undefined =>
      typeof v === "number" && isFinite(v) ? Math.max(lo, Math.min(hi, Math.round(v))) : undefined;
    const TEXTURES = ["glossy", "matte", "metal", "wood", "marble", "glass", "neon"] as const;
    const SHAPES = ["rounded", "soft", "square", "circle"] as const;
    const PIPS = ["circle", "square", "diamond", "star", "heart", "flower"] as const;
    const MODES = ["pips", "number", "symbol", "image"] as const;
    const STYLES = ["tumble", "spin", "flip", "shake", "bounce", "wobble", "zoom", "roll2d"] as const;
    const STOPS = ["snap", "settle", "wobble"] as const;
    const SPEEDS = ["slow", "normal", "fast"] as const;

    patch.diceModels = (body.diceModels as unknown[])
      .filter((m): m is Record<string, unknown> => !!m && typeof m === "object")
      // Raised 60 → 300. This is a SILENT truncation: past the cap the extra
      // models were dropped on save with no error, so an admin would add them,
      // press Save, and find them gone. Token designs have no cap at all.
      .slice(0, 300)
      .map((m) => {
        // Per-number designs: only the six real faces, each independently styled.
        const faces: Record<string, Record<string, unknown>> = {};
        const rawFaces = (m.faces && typeof m.faces === "object" ? m.faces : {}) as Record<string, unknown>;
        for (const n of ["1", "2", "3", "4", "5", "6"]) {
          const f = rawFaces[n];
          if (!f || typeof f !== "object") continue;
          const ff = f as Record<string, unknown>;
          const out: Record<string, unknown> = {};
          const mode = pick(ff.mode, MODES); if (mode) out.mode = mode;
          if (typeof ff.image === "string") out.image = ff.image.slice(0, 400);
          if (typeof ff.symbol === "string") out.symbol = ff.symbol.slice(0, 8);
          const pc = col(ff.pipColor); if (pc !== undefined) out.pipColor = pc;
          const ps = pick(ff.pipShape, PIPS); if (ps) out.pipShape = ps;
          if (Object.keys(out).length) faces[n] = out;
        }
        const rawRoll = (m.roll && typeof m.roll === "object" ? m.roll : {}) as Record<string, unknown>;
        return {
          id: String(m.id ?? "").slice(0, 60),
          name: String(m.name ?? "Dice").slice(0, 60),
          enabled: m.enabled !== false,
          ...(m.builtin === true ? { builtin: true } : {}),
          ...(typeof m.category === "string" ? { category: m.category.slice(0, 20) } : {}),
          ...(num(m.order, 0, 999) !== undefined ? { order: num(m.order, 0, 999) } : {}),
          // Coin price + how long a purchase lasts. 0 = free for everyone; above
          // 0 puts this dice in the Store on its own.
          priceCoins: Math.max(0, Math.min(1_000_000, Math.floor(Number(m.priceCoins) || 0))),
          validityDays: Math.max(0, Math.floor(Number(m.validityDays) || 0)),
          bodyColor: col(m.bodyColor) ?? "",
          bodyColor2: col(m.bodyColor2) ?? "",
          texture: pick(m.texture, TEXTURES) ?? "glossy",
          shape: pick(m.shape, SHAPES) ?? "rounded",
          ...(num(m.cornerPct, 0, 50) !== undefined ? { cornerPct: num(m.cornerPct, 0, 50) } : {}),
          borderColor: col(m.borderColor) ?? "",
          ...(num(m.borderWidth, 1, 8) !== undefined ? { borderWidth: num(m.borderWidth, 1, 8) } : {}),
          glowColor: col(m.glowColor) ?? "",
          shadow: m.shadow !== false,
          ...(num(m.sizePct, 50, 200) !== undefined ? { sizePct: num(m.sizePct, 50, 200) } : {}),
          ...(typeof m.faceImage === "string" ? { faceImage: m.faceImage.slice(0, 400) } : {}),
          pipColor: col(m.pipColor) ?? "",
          pipShape: pick(m.pipShape, PIPS) ?? "circle",
          ...(num(m.pipSizePct, 30, 95) !== undefined ? { pipSizePct: num(m.pipSizePct, 30, 95) } : {}),
          ...(Object.keys(faces).length ? { faces } : {}),
          roll: {
            style: pick(rawRoll.style, STYLES) ?? "tumble",
            durationMs: num(rawRoll.durationMs, 150, 5000) ?? 700,
            speed: pick(rawRoll.speed, SPEEDS) ?? "normal",
            stop: pick(rawRoll.stop, STOPS) ?? "settle",
          },
        };
      })
      .filter((m) => m.id) as AppConfig["diceModels"];
  }
  if (typeof body.activeDiceModelId === "string") {
    patch.activeDiceModelId = body.activeDiceModelId.slice(0, 60);
  }
  // CUSTOM CONTENT PAGES ("Add Content"). Text is stored as PLAIN text and is
  // rendered as plain text, so nothing an admin types can inject markup; a
  // button's link is scheme-checked the same way the rest of the app does it.
  if (Array.isArray(body.customPages)) {
    const KINDS = ["heading", "text", "image", "button", "divider"] as const;
    patch.customPages = (body.customPages as unknown[])
      .filter((p): p is Record<string, unknown> => !!p && typeof p === "object")
      .slice(0, 200)
      .map((p) => ({
        id: String(p.id ?? "").slice(0, 40) || `pg_${crypto.randomUUID().slice(0, 8)}`,
        slug: slugify(String(p.slug ?? p.title ?? "page")),
        title: String(p.title ?? "Page").slice(0, 120),
        subtitle: typeof p.subtitle === "string" ? p.subtitle.slice(0, 300) : "",
        enabled: p.enabled !== false,
        requireLogin: p.requireLogin === true,
        seoDescription: typeof p.seoDescription === "string" ? p.seoDescription.slice(0, 300) : "",
        createdAt: typeof p.createdAt === "string" ? p.createdAt.slice(0, 40) : new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        blocks: (Array.isArray(p.blocks) ? p.blocks : [])
          .filter((b): b is Record<string, unknown> => !!b && typeof b === "object")
          .slice(0, 300)
          .map((b) => {
            const kind = (KINDS as readonly string[]).includes(b.kind as string) ? (b.kind as (typeof KINDS)[number]) : "text";
            return {
              id: String(b.id ?? "").slice(0, 40) || `b_${crypto.randomUUID().slice(0, 8)}`,
              kind,
              ...(typeof b.text === "string" ? { text: b.text.slice(0, 8000) } : {}),
              ...(typeof b.image === "string" ? { image: b.image.slice(0, 400) } : {}),
              ...(typeof b.href === "string" ? { href: safePageHref(b.href).slice(0, 400) } : {}),
              ...(b.level === 3 ? { level: 3 as const } : b.level === 2 ? { level: 2 as const } : {}),
              ...(typeof b.widthPct === "number" && isFinite(b.widthPct) ? { widthPct: Math.max(20, Math.min(100, Math.round(b.widthPct))) } : {}),
              ...(b.align === "center" ? { align: "center" as const } : b.align === "left" ? { align: "left" as const } : {}),
            };
          }),
      }))
      .filter((p) => p.slug) as AppConfig["customPages"];
  }
  // Ludo board look — centre image (§3) + coin spacing (§5). Merged onto the
  // current value so a partial save never wipes the rest.
  if (body.gameBoard && typeof body.gameBoard === "object") {
    const gb = body.gameBoard as Record<string, unknown>;
    const cur = (await getConfig()).gameBoard ?? {};
    const curC = cur.center ?? {};
    const num = (v: unknown, d: number, lo: number, hi: number) =>
      typeof v === "number" && isFinite(v) ? Math.max(lo, Math.min(hi, Math.round(v))) : d;
    const c = (gb.center && typeof gb.center === "object" ? gb.center : {}) as Record<string, unknown>;
    patch.gameBoard = {
      center: {
        image: typeof c.image === "string" ? c.image.slice(0, 400) : (curC.image ?? ""),
        show: typeof c.show === "boolean" ? c.show : (curC.show ?? true),
        sizePct: num(c.sizePct, curC.sizePct ?? 84, 30, 100),
        opacityPct: num(c.opacityPct, curC.opacityPct ?? 40, 0, 100),
        rotateDeg: num(c.rotateDeg, curC.rotateDeg ?? 0, -180, 180),
        offsetXPct: num(c.offsetXPct, curC.offsetXPct ?? 0, -40, 40),
        offsetYPct: num(c.offsetYPct, curC.offsetYPct ?? 0, -40, 40),
      },
      // Snake board centre watermark image (per-game centre image, ships OFF).
      centerSnake: (() => {
        const curS = cur.centerSnake ?? {};
        const s = (gb.centerSnake && typeof gb.centerSnake === "object" ? gb.centerSnake : {}) as Record<string, unknown>;
        return {
          image: typeof s.image === "string" ? s.image.slice(0, 400) : (curS.image ?? ""),
          show: typeof s.show === "boolean" ? s.show : (curS.show ?? false),
          sizePct: num(s.sizePct, curS.sizePct ?? 50, 20, 100),
          opacityPct: num(s.opacityPct, curS.opacityPct ?? 25, 0, 100),
        };
      })(),
      // Where the playable grid sits inside the Snake board image. Width/height
      // are floored at 10% so a mis-drag can never collapse the grid to nothing.
      snakeGrid: (() => {
        const curG = cur.snakeGrid ?? {};
        const g = (gb.snakeGrid && typeof gb.snakeGrid === "object" ? gb.snakeGrid : {}) as Record<string, unknown>;
        return {
          topPct: num(g.topPct, curG.topPct ?? 0, 0, 45),
          leftPct: num(g.leftPct, curG.leftPct ?? 0, 0, 45),
          widthPct: num(g.widthPct, curG.widthPct ?? 100, 10, 100),
          heightPct: num(g.heightPct, curG.heightPct ?? 100, 10, 100),
        };
      })(),
      snakeMyPosition: (["bottom", "top"].includes(gb.snakeMyPosition as string) ? gb.snakeMyPosition : (cur.snakeMyPosition ?? "bottom")) as NonNullable<AppConfig["gameBoard"]>["snakeMyPosition"],
      // Where the LUDO grid sits inside the board picture. Width/height floored at
      // 20% so a mis-drag can never shrink the playing area to nothing.
      ludoGrid: (() => {
        const curG = cur.ludoGrid ?? {};
        const g = (gb.ludoGrid && typeof gb.ludoGrid === "object" ? gb.ludoGrid : {}) as Record<string, unknown>;
        return {
          topPct: num(g.topPct, curG.topPct ?? 0, 0, 45),
          leftPct: num(g.leftPct, curG.leftPct ?? 0, 0, 45),
          widthPct: num(g.widthPct, curG.widthPct ?? 100, 20, 100),
          heightPct: num(g.heightPct, curG.heightPct ?? 100, 20, 100),
        };
      })(),
      tokenScalePct: num(gb.tokenScalePct, cur.tokenScalePct ?? 100, 70, 140),
      tokenFanPct: num(gb.tokenFanPct, cur.tokenFanPct ?? 100, 0, 200),
      shareStyle: (["corners", "diagonal", "row", "stack"].includes(gb.shareStyle as string) ? gb.shareStyle : (cur.shareStyle ?? "corners")) as NonNullable<AppConfig["gameBoard"]>["shareStyle"],
      decor: (() => {
        const curD = cur.decor ?? {};
        const d = (gb.decor && typeof gb.decor === "object" ? gb.decor : {}) as Record<string, unknown>;
        const str = (v: unknown, dv: string) => (typeof v === "string" ? v.slice(0, 400) : dv);
        return {
          homeSymbol: str(d.homeSymbol, curD.homeSymbol ?? ""),
          homeSymbolShow: typeof d.homeSymbolShow === "boolean" ? d.homeSymbolShow : (curD.homeSymbolShow ?? true),
          safeIcon: str(d.safeIcon, curD.safeIcon ?? ""),
          safeIconShow: typeof d.safeIconShow === "boolean" ? d.safeIconShow : (curD.safeIconShow ?? true),
          safeHighlight: typeof d.safeHighlight === "boolean" ? d.safeHighlight : (curD.safeHighlight ?? true),
          safeColor: str(d.safeColor, curD.safeColor ?? "#10b981").slice(0, 60),
          frameColor: str(d.frameColor, curD.frameColor ?? "").slice(0, 60),
          fullImage: str(d.fullImage, curD.fullImage ?? ""),
          fullImageShow: typeof d.fullImageShow === "boolean" ? d.fullImageShow : (curD.fullImageShow ?? true),
          fullImageOpacityPct: num(d.fullImageOpacityPct, curD.fullImageOpacityPct ?? 100, 30, 100),
          fullImageFit: (["contain", "cover", "fill"].includes(d.fullImageFit as string) ? d.fullImageFit : (curD.fullImageFit ?? "contain")) as "contain" | "cover" | "fill",
          fullImageOffsetXPct: num(d.fullImageOffsetXPct, curD.fullImageOffsetXPct ?? 0, -40, 40),
          fullImageOffsetYPct: num(d.fullImageOffsetYPct, curD.fullImageOffsetYPct ?? 0, -40, 40),
          fullImageScalePct: num(d.fullImageScalePct, curD.fullImageScalePct ?? 100, 50, 150),
          // Board Settings toggles.
          boxBorder: typeof d.boxBorder === "boolean" ? d.boxBorder : (curD.boxBorder ?? true),
          borderColor: str(d.borderColor, curD.borderColor ?? "").slice(0, 60),
          boxHighlight: typeof d.boxHighlight === "boolean" ? d.boxHighlight : (curD.boxHighlight ?? true),
          showArrow: typeof d.showArrow === "boolean" ? d.showArrow : (curD.showArrow ?? true),
          // Token home area + safe-star editor.
          hideHomeBg: typeof d.hideHomeBg === "boolean" ? d.hideHomeBg : (curD.hideHomeBg ?? false),
          homeBgColor: str(d.homeBgColor, curD.homeBgColor ?? "").slice(0, 60),
          safeSizePct: num(d.safeSizePct, curD.safeSizePct ?? 100, 20, 200),
          safeOpacityPct: num(d.safeOpacityPct, curD.safeOpacityPct ?? 100, 0, 100),
          safeGlow: typeof d.safeGlow === "boolean" ? d.safeGlow : (curD.safeGlow ?? false),
          safeRotateDeg: num(d.safeRotateDeg, curD.safeRotateDeg ?? 0, -180, 180),
          // Full safe-star editor (appearance only).
          safeIconMode: (["default", "custom", "none"].includes(d.safeIconMode as string) ? d.safeIconMode : (curD.safeIconMode ?? "default")) as "default" | "custom" | "none",
          safeBorder: typeof d.safeBorder === "boolean" ? d.safeBorder : (curD.safeBorder ?? false),
          safeBorderColor: str(d.safeBorderColor, curD.safeBorderColor ?? "").slice(0, 60),
          safeGlowPx: num(d.safeGlowPx, curD.safeGlowPx ?? 4, 1, 24),
          safeShadow: typeof d.safeShadow === "boolean" ? d.safeShadow : (curD.safeShadow ?? true),
          safeShadowOpacityPct: num(d.safeShadowOpacityPct, curD.safeShadowOpacityPct ?? 55, 0, 100),
          safePosXPct: num(d.safePosXPct, curD.safePosXPct ?? 0, -50, 50),
          safePosYPct: num(d.safePosYPct, curD.safePosYPct ?? 0, -50, 50),
          safeVisibility: (["visible", "hidden", "transparent", "gameplayOnly"].includes(d.safeVisibility as string) ? d.safeVisibility : (curD.safeVisibility ?? "visible")) as "visible" | "hidden" | "transparent" | "gameplayOnly",
        };
      })(),
      // Element Show / Hide / Transparent table. Only known element keys and known
      // modes survive; anything else keeps whatever was saved before.
      elements: (() => {
        const curE = cur.elements ?? {};
        if (!gb.elements || typeof gb.elements !== "object") return curE;
        const KEYS = ["board", "grid", "safeStar", "startArrow", "pathNumbers", "tokenAreaBg", "tokenSlot", "cellBorder", "homeArea"] as const;
        const MODES = ["show", "hide", "transparent"];
        const src = gb.elements as Record<string, unknown>;
        const out: Record<string, "show" | "hide" | "transparent"> = {};
        for (const k of KEYS) {
          const v = src[k];
          if (typeof v === "string" && MODES.includes(v)) out[k] = v as "show" | "hide" | "transparent";
          else if (curE[k]) out[k] = curE[k]!;
        }
        return out as NonNullable<AppConfig["gameBoard"]>["elements"];
      })(),
      // CHESS board + pieces. Appearance only — no chess rule can be reached from
      // here. Merged onto the current value so a partial save keeps the rest.
      chess: (() => {
        const curC2 = cur.chess ?? {};
        if (!gb.chess || typeof gb.chess !== "object") return curC2;
        const ch = gb.chess as Record<string, unknown>;
        const bool = (v: unknown, d: boolean) => (typeof v === "boolean" ? v : d);
        const colour = (v: unknown, d: string) => (typeof v === "string" && /^#?[0-9a-fA-F]{3,8}$/.test(v.trim()) ? (v.trim().startsWith("#") ? v.trim() : "#" + v.trim()) : d);
        const THEMES = ["green", "brown", "blue", "grey", "midnight", "lotus", "custom"];
        const STYLES = ["classic", "solid", "outline", "letters", "custom"];
        // Only our own uploaded media paths are accepted for piece / board art, so
        // an off-site or unsafe URL can never be injected here.
        const media = (v: unknown, d: string) => {
          const s = typeof v === "string" ? v.trim().slice(0, 400) : "";
          if (!s) return "";
          return /^\/api\/(media|file)\/[\w.-]+$/i.test(s) || s.startsWith("/tokens/") ? s : d;
        };
        const imgs: Record<string, string> = { ...(curC2.pieceImages ?? {}) };
        if (ch.pieceImages && typeof ch.pieceImages === "object") {
          for (const [k, v] of Object.entries(ch.pieceImages as Record<string, unknown>)) {
            if (!/^[wb]-[kqrbnp]$/.test(k)) continue;
            const url = media(v, "");
            if (url) imgs[k] = url; else delete imgs[k];
          }
        }
        return {
          themeId: (THEMES.includes(ch.themeId as string) ? ch.themeId : (curC2.themeId ?? "green")) as NonNullable<AppConfig["gameBoard"]>["chess"] extends { themeId?: infer T } ? T : never,
          lightColor: colour(ch.lightColor, curC2.lightColor ?? ""),
          darkColor: colour(ch.darkColor, curC2.darkColor ?? ""),
          boardImage: media(ch.boardImage, curC2.boardImage ?? ""),
          boardImageOpacityPct: num(ch.boardImageOpacityPct, curC2.boardImageOpacityPct ?? 100, 0, 100),
          boardImageFit: (["contain", "cover", "fill"].includes(ch.boardImageFit as string) ? ch.boardImageFit : (curC2.boardImageFit ?? "cover")) as "contain" | "cover" | "fill",
          boardImageOffsetXPct: num(ch.boardImageOffsetXPct, curC2.boardImageOffsetXPct ?? 0, -40, 40),
          boardImageOffsetYPct: num(ch.boardImageOffsetYPct, curC2.boardImageOffsetYPct ?? 0, -40, 40),
          boardImageScalePct: num(ch.boardImageScalePct, curC2.boardImageScalePct ?? 100, 50, 150),
          pieceStyle: (STYLES.includes(ch.pieceStyle as string) ? ch.pieceStyle : (curC2.pieceStyle ?? "solid")) as NonNullable<AppConfig["gameBoard"]>["chess"] extends { pieceStyle?: infer S } ? S : never,
          pieceImages: imgs,
          pieceScalePct: num(ch.pieceScalePct, curC2.pieceScalePct ?? 100, 50, 160),
          showCoords: bool(ch.showCoords, curC2.showCoords !== false),
          showLegalDots: bool(ch.showLegalDots, curC2.showLegalDots !== false),
          showLastMove: bool(ch.showLastMove, curC2.showLastMove !== false),
          showCheckHighlight: bool(ch.showCheckHighlight, curC2.showCheckHighlight !== false),
          showWatermark: bool(ch.showWatermark, curC2.showWatermark !== false),
          animateMoves: bool(ch.animateMoves, curC2.animateMoves !== false),
          animMs: num(ch.animMs, curC2.animMs ?? 220, 0, 1200),
          captureFlash: bool(ch.captureFlash, curC2.captureFlash !== false),
          flipForBlack: bool(ch.flipForBlack, curC2.flipForBlack !== false),
          showMoveHistory: bool(ch.showMoveHistory, curC2.showMoveHistory !== false),
          showCapturedTray: bool(ch.showCapturedTray, curC2.showCapturedTray !== false),
          boardBorder: bool(ch.boardBorder, curC2.boardBorder !== false),
        };
      })(),
      // WHICH ring squares are safe. Validated to 0–51, de-duplicated and capped;
      // an empty list means "use the classic 8" (see lib/ludo.ts).
      safeCells: (() => {
        if (!Array.isArray(gb.safeCells)) return cur.safeCells ?? [];
        return [...new Set((gb.safeCells as unknown[])
          .map((v) => (typeof v === "number" && isFinite(v) ? Math.floor(v) : -1))
          .filter((n) => n >= 0 && n < 52))]
          .sort((a, b) => a - b)
          .slice(0, 52);
      })(),
      // Custom Board LIBRARY — keep at most 30 saved boards; sanitise each.
      boards: (() => {
        const raw = Array.isArray(gb.boards) ? gb.boards : (cur.boards ?? []);
        const fit = (v: unknown): "contain" | "cover" | "fill" => (["contain", "cover", "fill"].includes(v as string) ? (v as "contain" | "cover" | "fill") : "contain");
        return (raw as unknown[])
          .filter((x): x is Record<string, unknown> => !!x && typeof x === "object")
          .slice(0, 200)
          .map((x, i) => ({
            id: (typeof x.id === "string" && x.id.trim() ? x.id : `board-${i}`).slice(0, 60),
            name: (typeof x.name === "string" ? x.name : "").slice(0, 80),
            image: (typeof x.image === "string" ? x.image : "").slice(0, 400),
            fit: fit(x.fit),
            opacityPct: num(x.opacityPct, 100, 30, 100),
            offsetXPct: num(x.offsetXPct, 0, -40, 40),
            offsetYPct: num(x.offsetYPct, 0, -40, 40),
            scalePct: num(x.scalePct, 100, 50, 150),
            enabled: x.enabled !== false,
            createdAt: (typeof x.createdAt === "string" ? x.createdAt : new Date().toISOString()).slice(0, 40),
            // Coin price — 0/unset keeps the board free for everyone; above 0
            // puts it in the Store's Boards category as a paid board.
            priceCoins: typeof x.priceCoins === "number" && isFinite(x.priceCoins) ? Math.max(0, Math.min(1_000_000, Math.floor(x.priceCoins))) : 0,
            validityDays: Math.max(0, Math.floor(Number(x.validityDays) || 0)),
          }))
          .filter((b) => b.image); // drop any board with no image
      })(),
      activeBoardId: typeof gb.activeBoardId === "string" ? gb.activeBoardId.slice(0, 60) : (cur.activeBoardId ?? ""),
      // Per-slot token layout (client spec §6) — enable flag + up to 4 slot transforms.
      tokenSlots: (() => {
        const raw = (gb.tokenSlots && typeof gb.tokenSlots === "object" ? gb.tokenSlots : cur.tokenSlots ?? {}) as Record<string, unknown>;
        const arr = Array.isArray(raw.slots) ? raw.slots : (cur.tokenSlots?.slots ?? []);
        const slots = (arr as unknown[]).slice(0, 4).map((x) => {
          const s = (x && typeof x === "object" ? x : {}) as Record<string, unknown>;
          return {
            dxPct: num(s.dxPct, 0, -150, 150),
            dyPct: num(s.dyPct, 0, -150, 150),
            sizePct: num(s.sizePct, 100, 40, 200),
            rotateDeg: num(s.rotateDeg, 0, -180, 180),
          };
        });
        return { enabled: raw.enabled === true, slots };
      })(),
      // TOKEN PLACEMENT AREAS — the four home corners, each configured on its own
      // (background mode/colour/image/opacity, "hide white token area", layer) plus
      // all four token slots inside it. Every value validated + clamped; unknown
      // modes fall back to the safe default. Appearance only — nothing here can
      // reach the game engine.
      homeAreas: (() => {
        const curH = cur.homeAreas ?? {};
        if (!gb.homeAreas || typeof gb.homeAreas !== "object") return curH;
        const h = gb.homeAreas as Record<string, unknown>;
        const HOME_BG = ["default", "show", "hide", "transparent", "white", "color", "image"];
        const SLOT_BG = ["default", "transparent", "white", "color", "image"];
        const LAYERS = ["aboveBoard", "behindBoard", "aboveTokens", "hidden"];
        const pick = (v: unknown, allowed: string[], dv: string) => (typeof v === "string" && allowed.includes(v) ? v : dv);
        const colour = (v: unknown) => (typeof v === "string" && /^#?[0-9a-fA-F]{3,8}$/.test(v.trim()) ? (v.trim().startsWith("#") ? v.trim() : "#" + v.trim()) : "");
        type HomeAreasT = NonNullable<NonNullable<AppConfig["gameBoard"]>["homeAreas"]>;
        type AreasT = NonNullable<HomeAreasT["areas"]>;
        const src = (h.areas && typeof h.areas === "object" ? h.areas : {}) as Record<string, unknown>;
        const areas: Record<string, unknown> = {};
        for (const key of ["red", "green", "yellow", "blue"]) {
          const raw = src[key];
          if (!raw || typeof raw !== "object") continue;
          const A = raw as Record<string, unknown>;
          const slotsRaw = Array.isArray(A.slots) ? A.slots : [];
          areas[key] = {
            hideWhite: A.hideWhite === true,
            bgMode: pick(A.bgMode, HOME_BG, "default"),
            bgColor: colour(A.bgColor),
            bgImage: typeof A.bgImage === "string" ? A.bgImage.slice(0, 400) : "",
            bgOpacityPct: num(A.bgOpacityPct, 100, 0, 100),
            showBorder: A.showBorder !== false,
            layer: pick(A.layer, LAYERS, "aboveBoard"),
            slots: [0, 1, 2, 3].map((i) => {
              const s = (slotsRaw[i] && typeof slotsRaw[i] === "object" ? slotsRaw[i] : {}) as Record<string, unknown>;
              return {
                visible: s.visible !== false,
                xPct: num(s.xPct, 0, -150, 150),
                yPct: num(s.yPct, 0, -150, 150),
                widthPct: num(s.widthPct, 100, 20, 200),
                heightPct: num(s.heightPct, 100, 20, 200),
                tokenSizePct: num(s.tokenSizePct, 100, 40, 200),
                rotateDeg: num(s.rotateDeg, 0, -180, 180),
                bgMode: pick(s.bgMode, SLOT_BG, "default"),
                bgColor: colour(s.bgColor),
                bgImage: typeof s.bgImage === "string" ? s.bgImage.slice(0, 400) : "",
                border: s.border !== false,
                borderColor: colour(s.borderColor),
                opacityPct: num(s.opacityPct, 100, 0, 100),
                layer: pick(s.layer, LAYERS, "aboveBoard"),
              };
            }),
          };
        }
        return {
          enabled: h.enabled === true,
          areas: (Object.keys(areas).length ? areas : (curH.areas ?? {})) as AreasT,
        };
      })(),
    };
  }
  // Animation Management (§4 + §6) — merged onto the current value so a partial
  // save never wipes the rest.
  if (body.gameAnim && typeof body.gameAnim === "object") {
    const ga = body.gameAnim as Record<string, unknown>;
    const cur = (await getConfig()).gameAnim ?? {};
    const curR = cur.centerReach ?? {};
    const bool = (v: unknown, d: boolean) => (typeof v === "boolean" ? v : d);
    const cr = (ga.centerReach && typeof ga.centerReach === "object" ? ga.centerReach : {}) as Record<string, unknown>;
    const intensity = ga.winIntensity === "low" || ga.winIntensity === "high" || ga.winIntensity === "normal" ? ga.winIntensity : (cur.winIntensity ?? "normal");
    const style = cr.style === "sparkle" || cr.style === "bloom" || cr.style === "confetti" || cr.style === "fireworks" ? cr.style : (curR.style ?? "bloom");
    const speed = cr.speed === "slow" || cr.speed === "fast" || cr.speed === "normal" ? cr.speed : (curR.speed ?? "normal");
    const MOVE_STYLES = ["slide", "jump", "bounce", "fly", "spin", "instant"];
    // Turn-animation style for the ACTIVE player's avatar (admin-selectable).
    const TURN_STYLES = ["shake", "bounce", "pulse", "glow", "rotate", "heartbeat", "ripple", "breathing", "sparkle", "none"];
    // Dice-roll animation style (admin-selectable).
    const DICE_STYLES = ["tumble", "spin", "flip", "shake", "bounce", "wobble", "zoom", "roll2d"];
    patch.gameAnim = {
      diceRoll: bool(ga.diceRoll, cur.diceRoll ?? true),
      diceStyle: (typeof ga.diceStyle === "string" && DICE_STYLES.includes(ga.diceStyle) ? ga.diceStyle : (cur.diceStyle ?? "tumble")) as NonNullable<AppConfig["gameAnim"]>["diceStyle"],
      diceDisplaySeconds: (typeof ga.diceDisplaySeconds === "number" && isFinite(ga.diceDisplaySeconds) ? Math.max(1, Math.min(10, Math.round(ga.diceDisplaySeconds))) : (cur.diceDisplaySeconds ?? 2)),
      turnDelaySeconds: (typeof ga.turnDelaySeconds === "number" && isFinite(ga.turnDelaySeconds) ? Math.max(1, Math.min(10, Math.round(ga.turnDelaySeconds))) : (cur.turnDelaySeconds ?? 1)),
      tokenMove: bool(ga.tokenMove, cur.tokenMove ?? true),
      moveStyle: (typeof ga.moveStyle === "string" && MOVE_STYLES.includes(ga.moveStyle) ? ga.moveStyle : (cur.moveStyle ?? "slide")) as NonNullable<AppConfig["gameAnim"]>["moveStyle"],
      winCelebration: bool(ga.winCelebration, cur.winCelebration ?? true),
      winIntensity: intensity,
      captureFlash: bool(ga.captureFlash, cur.captureFlash ?? true),
      coinGlow: bool(ga.coinGlow, cur.coinGlow ?? true),
      soundEffects: bool(ga.soundEffects, cur.soundEffects ?? true),
      turnAnim: bool(ga.turnAnim, cur.turnAnim ?? true),
      turnAnimStyle: (typeof ga.turnAnimStyle === "string" && TURN_STYLES.includes(ga.turnAnimStyle) ? ga.turnAnimStyle : (cur.turnAnimStyle ?? "glow")) as NonNullable<AppConfig["gameAnim"]>["turnAnimStyle"],
      // Profile picture moving WHILE the dice rolls. Defaults to false: it was
      // hard-coded on with no way to switch it off, which is what was reported.
      rollShake: bool(ga.rollShake, cur.rollShake ?? false),
      rollShakeStyle: (typeof ga.rollShakeStyle === "string" && TURN_STYLES.includes(ga.rollShakeStyle) && ga.rollShakeStyle !== "none" ? ga.rollShakeStyle : (cur.rollShakeStyle ?? "shake")) as NonNullable<AppConfig["gameAnim"]>["rollShakeStyle"],
      centerReach: {
        enabled: bool(cr.enabled, curR.enabled ?? true),
        style,
        speed,
      },
    };
  }
  // Game theme (§7) — background/accent preset (or custom) + background music.
  // Merged onto the current value so a partial save never wipes the rest.
  if (body.gameTheme && typeof body.gameTheme === "object") {
    const gt = body.gameTheme as Record<string, unknown>;
    const cur = (await getConfig()).gameTheme ?? {};
    const curM = cur.music ?? {};
    const str = (v: unknown, d: string, max: number) => (typeof v === "string" ? v.slice(0, max) : d);
    const m = (gt.music && typeof gt.music === "object" ? gt.music : {}) as Record<string, unknown>;
    patch.gameTheme = {
      preset: str(gt.preset, cur.preset ?? "default", 40),
      bgColor: str(gt.bgColor, cur.bgColor ?? "", 200),
      bgImage: str(gt.bgImage, cur.bgImage ?? "", 400),
      accent: str(gt.accent, cur.accent ?? "", 40),
      music: {
        enabled: typeof m.enabled === "boolean" ? m.enabled : (curM.enabled ?? false),
        track: str(m.track, curM.track ?? "", 400),
        volumePct: typeof m.volumePct === "number" && isFinite(m.volumePct) ? Math.max(0, Math.min(100, Math.round(m.volumePct))) : (curM.volumePct ?? 40),
      },
    };
  }
  // Same-colour-block SHIELD appearance (look-only).
  if (body.shield && typeof body.shield === "object") {
    const s = body.shield as Record<string, unknown>;
    const cur = (await getConfig()).shield ?? {};
    const b = (v: unknown, d: boolean) => (typeof v === "boolean" ? v : d);
    const str = (v: unknown, d: string, max: number) => (typeof v === "string" ? v.slice(0, max) : d);
    const anim = ["none", "pulse", "spin", "bounce"];
    const spd = ["slow", "normal", "fast"];
    patch.shield = {
      iconEnabled: b(s.iconEnabled, cur.iconEnabled ?? true),
      glow: b(s.glow, cur.glow ?? true),
      blink: b(s.blink, cur.blink ?? false),
      particles: b(s.particles, cur.particles ?? false),
      image: str(s.image, cur.image ?? "", 2_000_000),
      color: str(s.color, cur.color ?? "#10b981", 40),
      animationStyle: anim.includes(String(s.animationStyle)) ? (s.animationStyle as "none" | "pulse" | "spin" | "bounce") : (cur.animationStyle ?? "pulse"),
      speed: spd.includes(String(s.speed)) ? (s.speed as "slow" | "normal" | "fast") : (cur.speed ?? "normal"),
    };
  }
  // Recording controls (rooms + Paid-Zone calls) — merged onto the current value.
  if (body.recording && typeof body.recording === "object") {
    const r = body.recording as Record<string, unknown>;
    const cur = (await getConfig()).recording ?? {};
    const bool = (v: unknown, d: boolean) => (typeof v === "boolean" ? v : d);
    const int = (v: unknown, d: number, lo: number, hi: number) => (typeof v === "number" && isFinite(v) ? Math.max(lo, Math.min(hi, Math.floor(v))) : d);
    const curMod = cur.modules ?? {};
    const mIn = (r.modules && typeof r.modules === "object" ? r.modules : {}) as Record<string, unknown>;
    const MOD_KEYS = ["voiceRoomVoice", "voiceRoomChat", "privateRoomVoice", "privateRoomChat", "competitionAudio", "competitionChat", "paidZoneVoice", "paidZoneVideo", "paidZoneChat", "privateVoiceCall", "privateVideoCall", "personalChat", "groupChat"] as const;
    const modules: Record<string, boolean> = {};
    for (const k of MOD_KEYS) modules[k] = typeof mIn[k] === "boolean" ? (mIn[k] as boolean) : ((curMod as Record<string, boolean>)[k] ?? false);
    patch.recording = {
      master: bool(r.master, cur.master ?? false),
      roomEnabled: bool(r.roomEnabled, cur.roomEnabled ?? false),
      callEnabled: bool(r.callEnabled, cur.callEnabled ?? false),
      retentionDays: int(r.retentionDays, cur.retentionDays ?? 30, 0, 3650),
      autoDelete: bool(r.autoDelete, cur.autoDelete ?? false),
      maxStorageMB: int(r.maxStorageMB, cur.maxStorageMB ?? 0, 0, 10_000_000),
      userAccess: r.userAccess === "hostAndAdmin" ? "hostAndAdmin" : "adminOnly",
      modules: modules as NonNullable<AppConfig["recording"]>["modules"],
      notify: (() => {
        const curN = cur.notify ?? {};
        const nIn = (r.notify && typeof r.notify === "object" ? r.notify : {}) as Record<string, unknown>;
        const nb = (k: string, d: boolean) => (typeof nIn[k] === "boolean" ? (nIn[k] as boolean) : d);
        return {
          enabled: nb("enabled", curN.enabled ?? true),
          text: typeof nIn.text === "string" ? nIn.text.slice(0, 300) : (curN.text ?? "This room is being recorded."),
          voiceRoom: nb("voiceRoom", curN.voiceRoom ?? true),
          privateRoom: nb("privateRoom", curN.privateRoom ?? true),
          competition: nb("competition", curN.competition ?? true),
          paidZoneCall: nb("paidZoneCall", curN.paidZoneCall ?? true),
          voiceCall: nb("voiceCall", curN.voiceCall ?? true),
          videoCall: nb("videoCall", curN.videoCall ?? true),
          chat: nb("chat", curN.chat ?? true),
        };
      })(),
    };
  }
  // Active-time / Startup-Bonus reward — merged onto the current value.
  if (body.activityReward && typeof body.activityReward === "object") {
    const a = body.activityReward as Record<string, unknown>;
    const cur = (await getConfig()).activityReward ?? {};
    const b = (v: unknown, d: boolean) => (typeof v === "boolean" ? v : d);
    const n = (v: unknown, d: number, lo: number, hi: number) => (typeof v === "number" && isFinite(v) ? Math.max(lo, Math.min(hi, Math.floor(v))) : d);
    const s = (v: unknown, d: string, max: number) => (typeof v === "string" ? v.slice(0, max) : d);
    patch.activityReward = {
      enabled: b(a.enabled, cur.enabled ?? false),
      name: s(a.name, cur.name ?? "Startup Bonus", 40),
      requiredMinutes: n(a.requiredMinutes, cur.requiredMinutes ?? 60, 1, 100000),
      continuousCoins: n(a.continuousCoins, cur.continuousCoins ?? 50, 0, 1_000_000),
      accumulatedCoins: n(a.accumulatedCoins, cur.accumulatedCoins ?? 25, 0, 1_000_000),
      gapMinutes: n(a.gapMinutes, cur.gapMinutes ?? 3, 1, 1440),
      dailyLimit: n(a.dailyLimit, cur.dailyLimit ?? 0, 0, 100000),
      maxPerUser: n(a.maxPerUser, cur.maxPerUser ?? 0, 0, 10_000_000),
      notifyTitle: s(a.notifyTitle, cur.notifyTitle ?? "Congratulations!", 80),
      continuousMsg: s(a.continuousMsg, cur.continuousMsg ?? "", 300),
      accumulatedMsg: s(a.accumulatedMsg, cur.accumulatedMsg ?? "", 300),
    };
  }
  // Free Coins Management. Merged onto the current value so a partial save never
  // wipes the rest.
  if (body.freeCoins && typeof body.freeCoins === "object") {
    const a = body.freeCoins as Record<string, unknown>;
    const cur = (await getConfig()).freeCoins ?? {};
    const b = (v: unknown, d: boolean) => (typeof v === "boolean" ? v : d);
    const n = (v: unknown, d: number, lo: number, hi: number) => (typeof v === "number" && isFinite(v) ? Math.max(lo, Math.min(hi, Math.floor(v))) : d);
    const sub = (raw: unknown) => (raw && typeof raw === "object" ? raw as Record<string, unknown> : {});
    const w = sub(a.welcome), dl = sub(a.dailyLogin), ev = sub(a.event), pe = sub(a.periodic);
    patch.freeCoins = {
      enabled: b(a.enabled, cur.enabled ?? true),
      welcome: { enabled: b(w.enabled, cur.welcome?.enabled ?? true), amount: n(w.amount, cur.welcome?.amount ?? 100, 0, 10_000_000) },
      dailyLogin: { enabled: b(dl.enabled, cur.dailyLogin?.enabled ?? false), amount: n(dl.amount, cur.dailyLogin?.amount ?? 25, 0, 10_000_000) },
      event: {
        enabled: b(ev.enabled, cur.event?.enabled ?? true),
        amount: n(ev.amount, cur.event?.amount ?? 50, 0, 10_000_000),
        validUntil: typeof ev.validUntil === "string" ? ev.validUntil.slice(0, 30) : (cur.event?.validUntil ?? ""),
      },
      // Periodic (timed) reward. `intervalMinutes` clamped to a sane 1-min floor
      // so a stray 0 can't turn the reward into an unlimited free-money tap.
      periodic: {
        enabled: b(pe.enabled, cur.periodic?.enabled ?? false),
        intervalMinutes: n(pe.intervalMinutes, cur.periodic?.intervalMinutes ?? 30, 1, 100000),
        amount: n(pe.amount, cur.periodic?.amount ?? 0, 0, 10_000_000),
        dailyLimit: n(pe.dailyLimit, cur.periodic?.dailyLimit ?? 0, 0, 100000),
        minLevel: n(pe.minLevel, cur.periodic?.minLevel ?? 0, 0, 100000),
      },
    };
  }
  // Inactivity Detection & Auto Logout. Merged onto the current value so a partial
  // save never wipes the rest. NOTE: `enabled` and `backgroundMonitor` are the two
  // switches that can reintroduce the v160 background-logout bug — they are only
  // ever true when an admin explicitly sets them.
  if (body.inactivity && typeof body.inactivity === "object") {
    const a = body.inactivity as Record<string, unknown>;
    const cur = (await getConfig()).inactivity ?? {};
    const b = (v: unknown, d: boolean) => (typeof v === "boolean" ? v : d);
    const n = (v: unknown, d: number, lo: number, hi: number) => (typeof v === "number" && isFinite(v) ? Math.max(lo, Math.min(hi, Math.floor(v))) : d);
    const roles = Array.isArray(a.exemptRoles)
      ? (a.exemptRoles as unknown[]).filter((r): r is string => typeof r === "string").slice(0, 20)
      : (cur.exemptRoles ?? []);
    patch.inactivity = {
      enabled: b(a.enabled, cur.enabled ?? false),
      // 1 minute floor so a mis-typed 0 can never log everyone out instantly.
      timeoutMinutes: n(a.timeoutMinutes, cur.timeoutMinutes ?? 15, 1, 1440),
      warningSeconds: n(a.warningSeconds, cur.warningSeconds ?? 30, 10, 300),
      backgroundMonitor: b(a.backgroundMonitor, cur.backgroundMonitor ?? false),
      exemptAdmins: b(a.exemptAdmins, cur.exemptAdmins ?? true),
      exemptRoles: roles,
      singleSession: b(a.singleSession, cur.singleSession ?? true),
      rewardRequiresActivity: b(a.rewardRequiresActivity, cur.rewardRequiresActivity ?? true),
      rewardGraceMinutes: n(a.rewardGraceMinutes, cur.rewardGraceMinutes ?? 5, 1, 120),
      // Ghost-user cutoff: 20s floor (so a normal ~15s heartbeat gap never drops a live member), 10-min ceiling.
      roomTimeoutSeconds: n(a.roomTimeoutSeconds, cur.roomTimeoutSeconds ?? 60, 20, 600),
    };
  }
  // Tax + service charge on coin purchases. Merged onto the current value so a
  // partial save never wipes the rest. Percentages are clamped 0–100 so a typo
  // can't charge someone 5000%.
  if (body.coinFees && typeof body.coinFees === "object") {
    const a = body.coinFees as Record<string, unknown>;
    const cur = (await getConfig()).coinFees ?? {};
    const b = (v: unknown, d: boolean) => (typeof v === "boolean" ? v : d);
    const num = (v: unknown, d: number, lo: number, hi: number) => (typeof v === "number" && isFinite(v) ? Math.max(lo, Math.min(hi, v)) : d);
    const s = (v: unknown, d: string, max: number) => (typeof v === "string" && v.trim() ? v.slice(0, max) : d);
    patch.coinFees = {
      taxEnabled: b(a.taxEnabled, cur.taxEnabled ?? false),
      taxLabel: s(a.taxLabel, cur.taxLabel ?? "VAT", 30),
      taxPct: num(a.taxPct, cur.taxPct ?? 15, 0, 100),
      serviceEnabled: b(a.serviceEnabled, cur.serviceEnabled ?? false),
      serviceLabel: s(a.serviceLabel, cur.serviceLabel ?? "Service charge", 30),
      servicePct: num(a.servicePct, cur.servicePct ?? 0, 0, 100),
      serviceFixed: num(a.serviceFixed, cur.serviceFixed ?? 0, 0, 1_000_000),
      showBreakdown: b(a.showBreakdown, cur.showBreakdown ?? true),
    };
  }
  // Privacy & Messaging controls. Merged onto the current value so a partial
  // save never wipes the rest.
  if (body.privacy && typeof body.privacy === "object") {
    const a = body.privacy as Record<string, unknown>;
    const cur = (await getConfig()).privacy ?? {};
    const b = (v: unknown, d: boolean) => (typeof v === "boolean" ? v : d);
    const num = (v: unknown, d: number, lo: number, hi: number) => (typeof v === "number" && isFinite(v) ? Math.max(lo, Math.min(hi, Math.floor(v))) : d);
    patch.privacy = {
      enabled: b(a.enabled, cur.enabled ?? true),
      mutualFollowToView: b(a.mutualFollowToView, cur.mutualFollowToView ?? false),
      dmLimitEnabled: b(a.dmLimitEnabled, cur.dmLimitEnabled ?? false),
      // 1..50: a sane range so a mis-typed 0 can't block ALL messages.
      maxUnansweredDMs: num(a.maxUnansweredDMs, cur.maxUnansweredDMs ?? 4, 1, 50),
      unlockOnFollow: b(a.unlockOnFollow, cur.unlockOnFollow ?? true),
    };
  }
  // Login attempt limit / lockout.
  if (body.loginSecurity && typeof body.loginSecurity === "object") {
    const a = body.loginSecurity as Record<string, unknown>;
    const cur = (await getConfig()).loginSecurity ?? {};
    const b = (v: unknown, d: boolean) => (typeof v === "boolean" ? v : d);
    const num = (v: unknown, d: number, lo: number, hi: number) => (typeof v === "number" && isFinite(v) ? Math.max(lo, Math.min(hi, Math.floor(v))) : d);
    patch.loginSecurity = {
      enabled: b(a.enabled, cur.enabled ?? true),
      maxAttempts: num(a.maxAttempts, cur.maxAttempts ?? 5, 1, 50),
      lockoutMinutes: num(a.lockoutMinutes, cur.lockoutMinutes ?? 15, 1, 1440),
    };
  }
  // Device & Security restrictions.
  if (body.deviceSecurity && typeof body.deviceSecurity === "object") {
    const a = body.deviceSecurity as Record<string, unknown>;
    const cur = (await getConfig()).deviceSecurity ?? {};
    const b2 = (v: unknown, d: boolean) => (typeof v === "boolean" ? v : d);
    const n2 = (v: unknown, d: number, lo: number, hi: number) => (typeof v === "number" && isFinite(v) ? Math.max(lo, Math.min(hi, Math.floor(v))) : d);
    patch.deviceSecurity = {
      maxAccountsPerDevice: n2(a.maxAccountsPerDevice, cur.maxAccountsPerDevice ?? 0, 0, 1000),
      maxDevicesPerAccount: n2(a.maxDevicesPerAccount, cur.maxDevicesPerAccount ?? 0, 0, 1000),
      blockMultiAccountPerDevice: b2(a.blockMultiAccountPerDevice, cur.blockMultiAccountPerDevice ?? false),
      whitelistMode: b2(a.whitelistMode, cur.whitelistMode ?? false),
      retentionDays: n2(a.retentionDays, cur.retentionDays ?? 0, 0, 3650),
      alertNewDevice: b2(a.alertNewDevice, cur.alertNewDevice ?? false),
      alertNewDeviceUser: b2(a.alertNewDeviceUser, cur.alertNewDeviceUser ?? false),
      alertMultiAccount: b2(a.alertMultiAccount, cur.alertMultiAccount ?? true),
      alertBlockedAttempt: b2(a.alertBlockedAttempt, cur.alertBlockedAttempt ?? true),
      alertFailedLogins: b2(a.alertFailedLogins, cur.alertFailedLogins ?? false),
      failedLoginThreshold: n2(a.failedLoginThreshold, cur.failedLoginThreshold ?? 5, 1, 50),
    };
  }
  // Messaging & file controls.
  if (body.messaging && typeof body.messaging === "object") {
    const a = body.messaging as Record<string, unknown>;
    const cur = (await getConfig()).messaging ?? {};
    const b3 = (v: unknown, d: boolean) => (typeof v === "boolean" ? v : d);
    const n3 = (v: unknown, d: number, lo: number, hi: number) => (typeof v === "number" && isFinite(v) ? Math.max(lo, Math.min(hi, Math.floor(v))) : d);
    const extList = (v: unknown, d: string[]) => (Array.isArray(v)
      ? Array.from(new Set(v.map((x) => String(x).trim().toLowerCase().replace(/^\./, "")).filter((x) => /^[a-z0-9]{1,10}$/.test(x)))).slice(0, 100)
      : d);
    const curTypes = cur.types ?? {};
    const types: Record<string, boolean> = { ...curTypes };
    if (a.types && typeof a.types === "object") for (const [k, v] of Object.entries(a.types as Record<string, unknown>)) if (typeof v === "boolean") types[k] = v;
    patch.messaging = {
      types,
      maxFileMB: n3(a.maxFileMB, cur.maxFileMB ?? 50, 0, 2048),
      blockedExtensions: extList(a.blockedExtensions, cur.blockedExtensions ?? []),
      allowedExtensions: extList(a.allowedExtensions, cur.allowedExtensions ?? []),
      allowAllTypes: b3(a.allowAllTypes, cur.allowAllTypes ?? false),
      allowDownload: b3(a.allowDownload, cur.allowDownload ?? true),
      allowForward: b3(a.allowForward, cur.allowForward ?? true),
      allowCopy: b3(a.allowCopy, cur.allowCopy ?? true),
      editWindowMin: n3(a.editWindowMin, cur.editWindowMin ?? 15, 0, 1440),
      retentionDays: n3(a.retentionDays, cur.retentionDays ?? 0, 0, 3650),
      virusScan: b3(a.virusScan, cur.virusScan ?? false),
      auditUploads: b3(a.auditUploads, cur.auditUploads ?? true),
      // Edit / Delete message permissions — four global switches plus per-user
      // overrides (a member id → which of the two options they get). Capped so a
      // bad payload can't bloat the config.
      userEdit: b3(a.userEdit, cur.userEdit ?? true),
      userDelete: b3(a.userDelete, cur.userDelete ?? true),
      adminEditAny: b3(a.adminEditAny, cur.adminEditAny ?? true),
      adminDeleteAny: b3(a.adminDeleteAny, cur.adminDeleteAny ?? true),
      perUser: (() => {
        if (!a.perUser || typeof a.perUser !== "object") return cur.perUser ?? {};
        const out: Record<string, { edit?: boolean; delete?: boolean }> = {};
        for (const [id, raw] of Object.entries(a.perUser as Record<string, unknown>).slice(0, 500)) {
          if (!id || typeof id !== "string" || !raw || typeof raw !== "object") continue;
          const r = raw as Record<string, unknown>;
          const rule: { edit?: boolean; delete?: boolean } = {};
          if (typeof r.edit === "boolean") rule.edit = r.edit;
          if (typeof r.delete === "boolean") rule.delete = r.delete;
          out[id.slice(0, 60)] = rule;
        }
        return out;
      })(),
    };
  }
  // Admin File Storage — quota + per-file ceiling for the admin file library.
  if (body.fileStorage && typeof body.fileStorage === "object") {
    const a = body.fileStorage as Record<string, unknown>;
    const cur = (await getConfig()).fileStorage ?? {};
    const n4 = (v: unknown, d: number, lo: number, hi: number) => (typeof v === "number" && isFinite(v) ? Math.max(lo, Math.min(hi, Math.round(v))) : d);
    patch.fileStorage = {
      quotaGB: n4(a.quotaGB, cur.quotaGB ?? 0, 0, 100000),   // 0 = unlimited
      maxFileMB: n4(a.maxFileMB, cur.maxFileMB ?? 200, 1, 20000),
    };
  }
  // Profile Photo Editor.
  if (body.photoEditor && typeof body.photoEditor === "object") {
    const a = body.photoEditor as Record<string, unknown>;
    const cur = (await getConfig()).photoEditor ?? {};
    const b3 = (v: unknown, d: boolean) => (typeof v === "boolean" ? v : d);
    const n3 = (v: unknown, d: number, lo: number, hi: number) => (typeof v === "number" && isFinite(v) ? Math.max(lo, Math.min(hi, Math.floor(v))) : d);
    const FORMATS = ["jpg", "png", "webp", "heic"];
    patch.photoEditor = {
      enabled: b3(a.enabled, cur.enabled ?? true),
      mode: a.mode === "cropOnly" ? "cropOnly" : "full",
      maxSizeMB: n3(a.maxSizeMB, cur.maxSizeMB ?? 10, 1, 100),
      formats: Array.isArray(a.formats) ? (a.formats.filter((f): f is string => typeof f === "string" && FORMATS.includes(f))) : (cur.formats ?? ["jpg", "png", "webp"]),
      minRes: n3(a.minRes, cur.minRes ?? 0, 0, 4000),
      maxRes: n3(a.maxRes, cur.maxRes ?? 512, 64, 4000),
      autoCompress: b3(a.autoCompress, cur.autoCompress ?? true),
      quality: n3(a.quality, cur.quality ?? 82, 30, 100),
      forceSquare: b3(a.forceSquare, cur.forceSquare ?? true),
      forceCircle: b3(a.forceCircle, cur.forceCircle ?? true),
      allowRotate: b3(a.allowRotate, cur.allowRotate ?? true),
      allowZoom: b3(a.allowZoom, cur.allowZoom ?? true),
      allowDrag: b3(a.allowDrag, cur.allowDrag ?? true),
      allowFlip: b3(a.allowFlip, cur.allowFlip ?? true),
      autoCenter: b3(a.autoCenter, cur.autoCenter ?? true),
      approvalRequired: b3(a.approvalRequired, cur.approvalRequired ?? false),
      moderation: a.moderation === "manual" || a.moderation === "ai" ? a.moderation : "off",
      defaultImage: typeof a.defaultImage === "string" ? a.defaultImage.slice(0, 2_000_000) : (cur.defaultImage ?? ""),
    };
  }
  // Default (photo-less) profile picture — what shows when a member has no photo.
  if (body.defaultAvatar && typeof body.defaultAvatar === "object") {
    const a = body.defaultAvatar as Record<string, unknown>;
    const cur = (await getConfig()).defaultAvatar ?? {};
    const bA = (v: unknown, d: boolean) => (typeof v === "boolean" ? v : d);
    patch.defaultAvatar = {
      mode: a.mode === "initials" || a.mode === "full" ? a.mode : "first",
      maxChars: typeof a.maxChars === "number" && isFinite(a.maxChars) ? Math.max(1, Math.min(24, Math.floor(a.maxChars))) : (cur.maxChars ?? 10),
      uppercase: bA(a.uppercase, cur.uppercase ?? false),
      keepEmoji: bA(a.keepEmoji, cur.keepEmoji ?? false),
      imageUrl: typeof a.imageUrl === "string" ? a.imageUrl.slice(0, 2_000_000) : (cur.imageUrl ?? ""),
      showName: bA(a.showName, cur.showName ?? true),
    };
  }
  // Voice room audio quality. These used to be fixed in the code at LiveKit's
  // LOWEST settings to save mobile data, which is what made voice sound thin.
  if (body.voiceQuality && typeof body.voiceQuality === "object") {
    const a = body.voiceQuality as Record<string, unknown>;
    const cur = (await getConfig()).voiceQuality ?? {};
    const bq = (v: unknown, d: boolean) => (typeof v === "boolean" ? v : d);
    patch.voiceQuality = {
      // 8 kbps floor (below this Opus speech falls apart) and a 64 kbps ceiling
      // (past that is pure data cost for a voice room).
      bitrateKbps: typeof a.bitrateKbps === "number" && isFinite(a.bitrateKbps)
        ? Math.max(8, Math.min(64, Math.round(a.bitrateKbps)))
        : (cur.bitrateKbps ?? 32),
      dtx: bq(a.dtx, cur.dtx ?? false),
      red: bq(a.red, cur.red ?? true),
      noiseSuppression: bq(a.noiseSuppression, cur.noiseSuppression ?? true),
      echoCancellation: bq(a.echoCancellation, cur.echoCancellation ?? true),
      autoGainControl: bq(a.autoGainControl, cur.autoGainControl ?? true),
      voiceIsolation: bq(a.voiceIsolation, cur.voiceIsolation ?? true),
      stereo: bq(a.stereo, cur.stereo ?? false),
    };
  }
  // Room image overlays (admin-placed banners/decorations on the room screen).
  if (Array.isArray(body.roomOverlays)) {
    const pct = (v: unknown, d: number) => (typeof v === "number" && isFinite(v) ? Math.max(0, Math.min(100, Math.round(v))) : d);
    const vis = (v: unknown) => (v === "hosts" || v === "vip" ? v : "all");
    const ZONES = ["free", "aboveSeats", "belowChat", "roomList", "gameTop"] as const;
    const zone = (v: unknown) => (ZONES.includes(v as never) ? (v as typeof ZONES[number]) : "free");
    patch.roomOverlays = (body.roomOverlays as unknown[])
      .filter((o): o is Record<string, unknown> => !!o && typeof o === "object")
      .slice(0, 200)
      .map((o) => ({
        id: typeof o.id === "string" && o.id ? o.id.slice(0, 40) : `ov_${Math.random().toString(36).slice(2, 10)}`,
        name: typeof o.name === "string" ? o.name.slice(0, 60) : "Overlay",
        image: typeof o.image === "string" ? o.image.slice(0, 2_500_000) : "",
        // Videos / documents are stored as a served /api/media URL, so only the
        // media kind travels here; the file itself never enters the config.
        mediaType: (["image", "video", "audio", "pdf", "file"].includes(o.mediaType as string) ? o.mediaType : "image") as "image" | "video" | "audio" | "pdf" | "file",
        fileName: typeof o.fileName === "string" ? o.fileName.slice(0, 160) : "",
        enabled: o.enabled !== false,
        xPct: pct(o.xPct, 50), yPct: pct(o.yPct, 50), widthPct: Math.max(5, Math.min(100, pct(o.widthPct, 25) || 25)), opacity: pct(o.opacity, 100),
        visibility: vis(o.visibility) as "all" | "hosts" | "vip",
        scope: o.scope === "specific" ? "specific" as const : "all" as const,
        roomIds: Array.isArray(o.roomIds) ? o.roomIds.filter((x): x is string => typeof x === "string").slice(0, 200) : [],
        link: typeof o.link === "string" ? o.link.slice(0, 400) : "",
        // cover-seats only applies to the free placement — never let an overlay be both a
        // fixed zone AND a seat cover (would render twice), even from hand-edited data.
        coverSeats: o.coverSeats === true && zone(o.zone) === "free",
        zone: zone(o.zone),
        closable: o.closable === true,
      }))
      .filter((o) => o.image);
  }
  // Game rules (chance-return-on-rejoin).
  if (body.gameRules && typeof body.gameRules === "object") {
    const a = body.gameRules as Record<string, unknown>;
    const cur = (await getConfig()).gameRules ?? {};
    patch.gameRules = {
      returnChancesOnRejoin: typeof a.returnChancesOnRejoin === "boolean" ? a.returnChancesOnRejoin : (cur.returnChancesOnRejoin ?? true),
    };
  }
  // Gift earnings split: % of each gift's value credited to the receiver's
  // wallet; the rest is company/admin revenue. Clamped 0–100.
  if (typeof body.giftReceiverSharePct === "number") patch.giftReceiverSharePct = Math.max(0, Math.min(100, Math.round(body.giftReceiverSharePct)));
  // Media system controls (library access + per-type enable + free/paid pricing).
  // Reads the current media config and merges, so a partial save never wipes the
  // other fields.
  if (body.media && typeof body.media === "object") {
    const m = body.media as Record<string, unknown>;
    const cur = (await getConfig()).media ?? {};
    const bool = (v: unknown, d: boolean) => (typeof v === "boolean" ? v : d);
    const price = (v: unknown, d: number) => (typeof v === "number" ? Math.max(0, Math.min(100000, Math.floor(v))) : d);
    patch.media = {
      libraryAccess: bool(m.libraryAccess, cur.libraryAccess ?? true),
      audioEnabled: bool(m.audioEnabled, cur.audioEnabled ?? true),
      videoEnabled: bool(m.videoEnabled, cur.videoEnabled ?? true),
      imageEnabled: bool(m.imageEnabled, cur.imageEnabled ?? true),
      audioPaid: bool(m.audioPaid, cur.audioPaid ?? false),
      audioPrice: price(m.audioPrice, cur.audioPrice ?? 0),
      videoPaid: bool(m.videoPaid, cur.videoPaid ?? false),
      videoPrice: price(m.videoPrice, cur.videoPrice ?? 0),
      imagePaid: bool(m.imagePaid, cur.imagePaid ?? false),
      imagePrice: price(m.imagePrice, cur.imagePrice ?? 0),
    };
  }
  // TEXT COLOURS (Admin → Text Colours) — its own system, kept apart from Theme
  // Management. Only validated colour strings are stored, so nothing arbitrary
  // can reach the stylesheet these values build.
  if (body.textColors && typeof body.textColors === "object") {
    const t = body.textColors as Record<string, unknown>;
    const cur = (await getConfig()).textColors ?? {};
    const col = (v: unknown, d?: string) => {
      if (typeof v !== "string") return d ?? "";
      const s = v.trim();
      if (!s) return "";                       // blank = "use the built-in colour"
      return isValidColor(s) ? s : (d ?? "");
    };
    const out: Record<string, unknown> = { enabled: typeof t.enabled === "boolean" ? t.enabled : (cur.enabled ?? false) };
    for (const f of TEXT_COLOR_FIELDS) out[f.key] = col(t[f.key], (cur as Record<string, string | undefined>)[f.key]);

    // FULL TEXT STYLING per category. Sent as a whole object, so an absent
    // `styles` key means "leave the styles alone" while an empty object means
    // "clear them" — which is what Reset relies on.
    if (t.styles !== undefined) {
      const ALIGNS = ["left", "center", "right", "justify"];
      const FONTS = FONT_FAMILIES.map((f) => f.id);
      const styles: Record<string, Record<string, unknown>> = {};
      const raw = (t.styles && typeof t.styles === "object" ? t.styles : {}) as Record<string, unknown>;
      for (const f of TEXT_COLOR_FIELDS) {
        const s = raw[f.key];
        if (!s || typeof s !== "object") continue;
        const v = s as Record<string, unknown>;
        const o: Record<string, unknown> = {};
        if (typeof v.font === "string" && FONTS.includes(v.font)) o.font = v.font;
        if (typeof v.sizePct === "number" && isFinite(v.sizePct)) o.sizePct = Math.max(50, Math.min(200, Math.round(v.sizePct)));
        if (typeof v.bold === "boolean") o.bold = v.bold;
        if (typeof v.italic === "boolean") o.italic = v.italic;
        if (typeof v.underline === "boolean") o.underline = v.underline;
        if (typeof v.align === "string" && ALIGNS.includes(v.align)) o.align = v.align;
        if (typeof v.letterSpacing === "number" && isFinite(v.letterSpacing)) o.letterSpacing = Math.max(-2, Math.min(10, Math.round(v.letterSpacing * 10) / 10));
        if (typeof v.lineHeight === "number" && isFinite(v.lineHeight)) o.lineHeight = Math.max(1, Math.min(2.5, Math.round(v.lineHeight * 100) / 100));
        if (Object.keys(o).length) styles[f.key] = o;
      }
      out.styles = styles;
    } else if (cur.styles) {
      out.styles = cur.styles;
    }
    patch.textColors = out as AppConfig["textColors"];
  }
  // ALL PAGES directory (Admin → All Pages) — on/off plus which sections and
  // tiles members see, and in what order.
  if (body.allPages && typeof body.allPages === "object") {
    const a = body.allPages as Record<string, unknown>;
    const cur = (await getConfig()).allPages ?? {};
    const bl = (v: unknown, d: boolean) => (typeof v === "boolean" ? v : d);
    const str = (v: unknown, d: string) => (typeof v === "string" ? v.slice(0, 160) : d);
    const rules = (v: unknown): Record<string, { hidden?: boolean; order?: number }> => {
      if (!v || typeof v !== "object") return {};
      const out: Record<string, { hidden?: boolean; order?: number }> = {};
      for (const [k, raw] of Object.entries(v as Record<string, unknown>).slice(0, 400)) {
        if (!raw || typeof raw !== "object") continue;
        const r = raw as Record<string, unknown>;
        const rule: { hidden?: boolean; order?: number } = {};
        if (typeof r.hidden === "boolean") rule.hidden = r.hidden;
        if (typeof r.order === "number" && isFinite(r.order)) rule.order = Math.max(0, Math.min(999, Math.floor(r.order)));
        if (rule.hidden !== undefined || rule.order !== undefined) out[k.slice(0, 120)] = rule;
      }
      return out;
    };
    patch.allPages = {
      enabled: bl(a.enabled, cur.enabled !== false),
      title: str(a.title, cur.title ?? ""),
      subtitle: str(a.subtitle, cur.subtitle ?? ""),
      showSearch: bl(a.showSearch, cur.showSearch !== false),
      showJumpLinks: bl(a.showJumpLinks, cur.showJumpLinks !== false),
      showCounts: bl(a.showCounts, cur.showCounts !== false),
      showDescriptions: bl(a.showDescriptions, cur.showDescriptions !== false),
      showFooterNote: bl(a.showFooterNote, cur.showFooterNote !== false),
      sections: rules(a.sections),
      pages: rules(a.pages),
      // Tiles the admin added themselves. `href` is scheme-checked like every
      // other admin-entered link so nothing but a real destination can be stored.
      customTiles: (Array.isArray(a.customTiles) ? a.customTiles : [])
        .filter((t): t is Record<string, unknown> => !!t && typeof t === "object")
        .slice(0, 200)
        .map((t) => ({
          id: String(t.id ?? "").slice(0, 40) || `t_${crypto.randomUUID().slice(0, 8)}`,
          section: String(t.section ?? "").slice(0, 40),
          label: String(t.label ?? "Page").slice(0, 80),
          desc: typeof t.desc === "string" ? t.desc.slice(0, 200) : "",
          href: safePageHref(typeof t.href === "string" ? t.href : "").slice(0, 400),
          hidden: t.hidden === true,
          ...(typeof t.order === "number" && isFinite(t.order) ? { order: Math.max(0, Math.min(999, Math.floor(t.order))) } : {}),
        }))
        .filter((t) => t.section && t.href),
    };
  }
  // LUCKY NUMBER — Host / Co-Host permissions.
  if (body.luckyNumber && typeof body.luckyNumber === "object") {
    const l = body.luckyNumber as Record<string, unknown>;
    const cur = (await getConfig()).luckyNumber ?? {};
    const b = (v: unknown, d: boolean) => (typeof v === "boolean" ? v : d);
    patch.luckyNumber = {
      start: b(l.start, cur.start !== false),
      round: b(l.round, cur.round !== false),
      draw: b(l.draw, cur.draw !== false),
      // Hand-picking the winner stays OFF unless the admin deliberately allows it.
      manualPick: b(l.manualPick, cur.manualPick === true),
      complete: b(l.complete, cur.complete !== false),
      joining: b(l.joining, cur.joining !== false),
    };
  }
  if (Array.isArray(body.games)) patch.games = body.games as AppConfig["games"];
  if (body.settings && typeof body.settings === "object") patch.settings = body.settings as AppConfig["settings"];
  if (body.features && typeof body.features === "object") {
    const f = body.features as Record<string, unknown>;
    const keys = ["registration", "voiceRooms", "privateRooms", "paidZone", "gifts", "coins", "levels", "games", "coHost", "chat", "business", "reels", "tournaments", "competitions", "luckyNumber",
      // Section switches (v469) — every main area of the app.
      "leaderboards", "jobs", "agencies", "customize", "myStorage", "documents", "friends", "search", "support", "luckySpin", "store", "notifications"] as const;
    const out: Record<string, boolean> = {};
    for (const k of keys) if (typeof f[k] === "boolean") out[k] = f[k] as boolean;
    patch.features = out as AppConfig["features"];
  }
  // Tournament & Competition management — granular sub-feature toggles.
  if (body.tournamentControls && typeof body.tournamentControls === "object") {
    const t = body.tournamentControls as Record<string, unknown>;
    const cur = (await getConfig()).tournamentControls ?? {};
    const b = (k: string, d: boolean) => (typeof t[k] === "boolean" ? (t[k] as boolean) : ((cur as Record<string, boolean>)[k] ?? d));
    patch.tournamentControls = {
      tournamentRegistration: b("tournamentRegistration", true), tournamentAutoStart: b("tournamentAutoStart", true), tournamentAutoPrize: b("tournamentAutoPrize", true), tournamentMatchRooms: b("tournamentMatchRooms", true), tournamentPublicListing: b("tournamentPublicListing", true),
      competitionRegistration: b("competitionRegistration", true), competitionVoting: b("competitionVoting", true), competitionGifts: b("competitionGifts", true), competitionResults: b("competitionResults", true),
      adminAutoJoinCompetition: b("adminAutoJoinCompetition", true),
    };
  }
  // Dice look & behaviour — merged onto the current value.
  if (body.gameDice && typeof body.gameDice === "object") {
    const gd = body.gameDice as Record<string, unknown>;
    const cur = (await getConfig()).gameDice ?? {};
    patch.gameDice = {
      customFace: typeof gd.customFace === "boolean" ? gd.customFace : (cur.customFace ?? false),
      faceImage: typeof gd.faceImage === "string" ? gd.faceImage.slice(0, 2_000_000) : (cur.faceImage ?? ""),
      showLastRolled: typeof gd.showLastRolled === "boolean" ? gd.showLastRolled : (cur.showLastRolled ?? true),
    };
  }
  // New match-start flow (Manual invite / Automatic-Join lobby) — merged onto current.
  if (body.lobby && typeof body.lobby === "object") {
    const l = body.lobby as Record<string, unknown>;
    const cur = (await getConfig()).lobby ?? {};
    const b = (k: string, d: boolean) => (typeof l[k] === "boolean" ? (l[k] as boolean) : ((cur as Record<string, boolean>)[k] ?? d));
    const n = (k: string, d: number, lo: number, hi: number) => (typeof l[k] === "number" && isFinite(l[k] as number) ? Math.max(lo, Math.min(hi, Math.floor(l[k] as number))) : ((cur as Record<string, number>)[k] ?? d));
    patch.lobby = {
      enabled: b("enabled", false), hostOnlyStart: b("hostOnlyStart", true), autoJoin: b("autoJoin", true), manualInvite: b("manualInvite", true),
      countdownSeconds: n("countdownSeconds", 20, 5, 120), startingSeconds: n("startingSeconds", 3, 0, 15), minPlayers: n("minPlayers", 2, 2, 4), maxPlayers: n("maxPlayers", 4, 2, 4),
      // Seat DISPLAY order. Must contain each of the four colours exactly once —
      // anything else is rejected and the previous order is kept, so a bad payload
      // can never drop or duplicate a seat.
      seatOrder: (() => {
        const DEF = ["red", "green", "yellow", "blue"];
        const cure = Array.isArray(cur.seatOrder) && cur.seatOrder.length === 4 ? cur.seatOrder : DEF;
        if (!Array.isArray(l.seatOrder)) return cure;
        const list = (l.seatOrder as unknown[]).filter((x): x is string => typeof x === "string");
        const ok = list.length === 4 && DEF.every((c) => list.filter((x) => x === c).length === 1);
        return ok ? list : cure;
      })(),
    };
  }
  // AUTO RESET / AUTO CLEANUP of stuck games. Durations are stored as HOURS and
  // may be fractional (the admin can pick "30 minutes"), so these are not floored.
  if (body.autoReset && typeof body.autoReset === "object") {
    const a = body.autoReset as Record<string, unknown>;
    const cur = (await getConfig()).autoReset ?? {};
    const b = (k: string, d: boolean) => (typeof a[k] === "boolean" ? (a[k] as boolean) : ((cur as Record<string, boolean>)[k] ?? d));
    const n = (k: string, d: number, lo: number, hi: number) => {
      const v = Number(a[k]);
      if (Number.isFinite(v)) return Math.max(lo, Math.min(hi, v));
      const c = Number((cur as Record<string, number>)[k]);
      return Number.isFinite(c) ? c : d;
    };
    patch.autoReset = {
      enabled: b("enabled", true),
      afterHours: n("afterHours", 24, 0.25, 720),
      staleStartingMinutes: n("staleStartingMinutes", 10, 1, 1440),
      emptyLobbyHours: n("emptyLobbyHours", 2, 0.25, 720),
      notifyPlayers: b("notifyPlayers", true),
    };
  }
  if (body.posting && typeof body.posting === "object") {
    const p = body.posting as Record<string, unknown>;
    const cur = (await getConfig()).posting ?? {};
    patch.posting = {
      users: typeof p.users === "boolean" ? p.users : cur.users,
      businesses: typeof p.businesses === "boolean" ? p.businesses : cur.businesses,
      jobs: typeof p.jobs === "boolean" ? p.jobs : cur.jobs,
    };
  }
  if (body.business && typeof body.business === "object") {
    const bz = body.business as Record<string, unknown>;
    const curBiz = (await getConfig()).business ?? {};
    const cats = Array.isArray(bz.categories)
      ? (bz.categories as unknown[]).filter((c): c is string => typeof c === "string").map((c) => c.trim().slice(0, 40)).filter(Boolean).slice(0, 200)
      : (curBiz.categories ?? []);
    const registerCost = bz.registerCost !== undefined ? Math.max(0, Math.floor(Number(bz.registerCost) || 0)) : (curBiz.registerCost ?? 0);
    const jobTypes = Array.isArray(bz.jobTypes)
      ? (bz.jobTypes as unknown[]).filter((c): c is string => typeof c === "string").map((c) => c.trim().slice(0, 40)).filter(Boolean).slice(0, 100)
      : (curBiz.jobTypes ?? []);
    // Admin-defined custom business-form fields — validated field-by-field (order preserved).
    const fields = Array.isArray(bz.fields)
      ? (bz.fields as unknown[]).map(sanitizeFieldDef).filter((x): x is BusinessFieldDef => x !== null).slice(0, 100)
      : (curBiz.fields ?? []);
    // Admin-defined custom job-post-form fields.
    const jobFields = Array.isArray(bz.jobFields)
      ? (bz.jobFields as unknown[]).map(sanitizeFieldDef).filter((x): x is BusinessFieldDef => x !== null).slice(0, 100)
      : (curBiz.jobFields ?? []);
    // Business-profile sections: rename / show-hide / reorder (order preserved).
    const profileSections = Array.isArray(bz.profileSections)
      ? (bz.profileSections as unknown[]).map(sanitizeSection).filter((x): x is BusinessSection => x !== null).slice(0, 60)
      : (curBiz.profileSections ?? []);
    patch.business = { categories: cats, registerCost, jobTypes, fields, jobFields, profileSections };
  }
  let seatsChangedTo: number | null = null;
  // Room / group LIST visibility. Listing-only — it can never change how a room
  // behaves, only which rooms appear in the browse list.
  if (body.roomList && typeof body.roomList === "object") {
    const rl = body.roomList as Record<string, unknown>;
    const cur = (await getConfig()).roomList ?? {};
    const MODES = ["all", "hostOnline", "coHostOnline", "memberOnline", "custom"];
    const b4 = (v: unknown, d: boolean) => (typeof v === "boolean" ? v : d);
    patch.roomList = {
      mode: (MODES.includes(rl.mode as string) ? rl.mode : (cur.mode ?? "all")) as NonNullable<AppConfig["roomList"]>["mode"],
      hideOffline: b4(rl.hideOffline, cur.hideOffline === true),
      requireHost: b4(rl.requireHost, cur.requireHost === true),
      requireCoHost: b4(rl.requireCoHost, cur.requireCoHost === true),
      requireMember: b4(rl.requireMember, cur.requireMember === true),
      minLive: typeof rl.minLive === "number" && isFinite(rl.minLive) ? Math.max(0, Math.min(50, Math.floor(rl.minLive))) : (cur.minLive ?? 0),
      alwaysShowMine: b4(rl.alwaysShowMine, cur.alwaysShowMine !== false),
      adminSeesAll: b4(rl.adminSeesAll, cur.adminSeesAll !== false),
      // The Active / Inactive browse buttons on the members' Voice Rooms screen.
      showActive: b4(rl.showActive, cur.showActive !== false),
      showInactive: b4(rl.showInactive, cur.showInactive !== false),
    };
  }
  if (body.roomControls && typeof body.roomControls === "object") {
    patch.roomControls = body.roomControls as AppConfig["roomControls"];
    // Whenever the admin SAVES the seat controls, roll the default seat count out
    // to every existing room (below) — so "Save controls" always applies it
    // everywhere, not just to new rooms (client: the seat setting must work
    // across the whole system).
    const newSeats = patch.roomControls.defaultSeats;
    if (typeof newSeats === "number" && Number.isFinite(newSeats)) {
      seatsChangedTo = Math.min(50, Math.max(2, Math.floor(newSeats)));
    }
  }
  if (body.permissions && typeof body.permissions === "object") patch.permissions = body.permissions as AppConfig["permissions"];
  if (body.content && typeof body.content === "object") patch.content = body.content as AppConfig["content"];
  if (body.membership && typeof body.membership === "object") patch.membership = body.membership as AppConfig["membership"];
  if (Array.isArray(body.rewards)) patch.rewards = body.rewards as AppConfig["rewards"];
  // ADVERTISEMENTS. Previously this array was stored verbatim with no checks at
  // all, which allowed two problems: an ad saved as ACTIVE with no image (it can
  // never render, so it sits switched on but invisible — exactly how one live ad
  // ended up doing nothing), and an unchecked linkUrl, which is a click target
  // and so must never be allowed to carry a javascript:/data: scheme.
  if (Array.isArray(body.ads)) {
    const POSITIONS = ["top", "sidebar", "feed", "interstitial", "gameTop"] as const;
    patch.ads = (body.ads as unknown[])
      .filter((a): a is Record<string, unknown> => !!a && typeof a === "object")
      .slice(0, 200)
      .map((a) => {
        const imageUrl = typeof a.imageUrl === "string" ? a.imageUrl.slice(0, 400) : "";
        const wantsActive = a.active === true;
        return {
          id: String(a.id ?? "").slice(0, 60) || `ad_${crypto.randomUUID().slice(0, 8)}`,
          title: String(a.title ?? "Advertisement").slice(0, 120),
          imageUrl,
          // Same allow-list the rest of the app uses for admin-entered links.
          linkUrl: safePageHref(typeof a.linkUrl === "string" ? a.linkUrl : "").slice(0, 400),
          position: (POSITIONS as readonly string[]).includes(a.position as string) ? (a.position as (typeof POSITIONS)[number]) : "top",
          // An ad with no picture cannot be shown, so it is never stored as
          // "active" — that state only looks like it is working.
          active: wantsActive && !!imageUrl.trim(),
          impressions: typeof a.impressions === "number" && isFinite(a.impressions) ? Math.max(0, Math.floor(a.impressions)) : 0,
          clicks: typeof a.clicks === "number" && isFinite(a.clicks) ? Math.max(0, Math.floor(a.clicks)) : 0,
          ...(typeof a.text === "string" ? { text: a.text.slice(0, 300) } : {}),
          ...(typeof a.priority === "number" && isFinite(a.priority) ? { priority: Math.max(0, Math.min(999, Math.floor(a.priority))) } : {}),
        };
      })
      .filter((a) => a.title) as AppConfig["ads"];
  }
  if (Array.isArray(body.coinPackages)) patch.coinPackages = body.coinPackages as AppConfig["coinPackages"];
  if (Array.isArray(body.coinOffers)) patch.coinOffers = body.coinOffers as AppConfig["coinOffers"];
  if (Array.isArray(body.giftCatalog)) patch.giftCatalog = body.giftCatalog as AppConfig["giftCatalog"];
  if (body.moderation && typeof body.moderation === "object") patch.moderation = body.moderation as AppConfig["moderation"];
  // Editable front-end text labels — only known keys, string values, capped length.
  if (body.labels && typeof body.labels === "object") {
    const out: Record<string, string> = {};
    for (const [k, v] of Object.entries(body.labels as Record<string, unknown>)) {
      // isEditableLabelKey covers the hand-written catalogue AND the generated
      // nav./page. keys (menu entries + All Pages tiles), which no fixed list can.
      if (isEditableLabelKey(k) && typeof v === "string") out[k] = v.slice(0, 400);
    }
    patch.labels = out;
  }
  // Chat & messages policy.
  if (body.chat && typeof body.chat === "object") {
    const c = body.chat as Record<string, unknown>;
    patch.chat = {
      storeMessages: c.storeMessages !== false,
      groupRetentionDays: Math.max(1, Math.min(365, Math.floor(Number(c.groupRetentionDays) || 3))),
      deleteForEveryone: c.deleteForEveryone !== false,
    };
  }
  if (typeof body.uploadMaxMB === "number") patch.uploadMaxMB = Math.max(1, Math.min(100, Math.floor(body.uploadMaxMB)));
  if (body.featurePricing && typeof body.featurePricing === "object") {
    const fp = body.featurePricing as Record<string, unknown>;
    patch.featurePricing = {
      roomNameChange: Math.max(0, Math.floor(Number(fp.roomNameChange) || 0)),
      videoUnlock: Math.max(0, Math.floor(Number(fp.videoUnlock) || 0)),
      coHostSlot: Math.max(0, Math.floor(Number(fp.coHostSlot) || 0)),
      extraPublicRoom: Math.max(0, Math.floor(Number(fp.extraPublicRoom) || 0)),
    };
  }
  if (body.coHostLimit !== undefined) patch.coHostLimit = Math.max(0, Math.min(20, Math.floor(Number(body.coHostLimit) || 0)));
  // Competition prize positions (1st–4th) — each with coins + an ON/OFF toggle.
  if (Array.isArray(body.competitionPrizes)) {
    patch.competitionPrizes = (body.competitionPrizes as unknown[])
      .slice(0, 4)
      .map((p) => (p ?? {}) as Record<string, unknown>)
      .map((p) => ({ coins: Math.max(0, Math.floor(Number(p.coins) || 0)), enabled: p.enabled !== false }));
  }
  if (body.paidZone && typeof body.paidZone === "object") {
    const pz = body.paidZone as Record<string, unknown>;
    patch.paidZone = {
      enabled: pz.enabled !== false,
      joinCost: Math.max(0, Math.floor(Number(pz.joinCost) || 0)),
      audioPerMin: Math.max(0, Math.floor(Number(pz.audioPerMin) || 0)),
      videoPerMin: Math.max(0, Math.floor(Number(pz.videoPerMin) || 0)),
      callsEnabled: pz.callsEnabled !== false,
      videoCallsEnabled: pz.videoCallsEnabled !== false,
      recordingEnabled: pz.recordingEnabled === true,
      receiverRewardsEnabled: pz.receiverRewardsEnabled !== false,
      receiverSharePct: Math.max(0, Math.min(100, Math.floor(Number(pz.receiverSharePct) || 0))),
      agencyProfitPct: Math.max(0, Math.min(100, Math.floor(Number(pz.agencyProfitPct) || 0))),
      monthlyCoins: Math.max(0, Math.floor(Number(pz.monthlyCoins) || 0)),
      renewalDays: Math.max(1, Math.floor(Number(pz.renewalDays) || 30)),
      graceDays: Math.max(0, Math.floor(Number(pz.graceDays) || 0)),
      autoRenew: pz.autoRenew !== false,
    };
  }
  if (body.withdraw && typeof body.withdraw === "object") {
    const w = body.withdraw as Record<string, unknown>;
    patch.withdraw = {
      coinsPerUnit: Math.max(1, Math.floor(Number(w.coinsPerUnit) || 1)),
      currency: typeof w.currency === "string" && w.currency.trim() ? w.currency.trim().slice(0, 8) : "SAR",
      feePct: Math.max(0, Math.min(100, Math.round(Number(w.feePct) || 0))),
      minCoins: Math.max(0, Math.floor(Number(w.minCoins) || 0)),
      maxCoins: Math.max(0, Math.floor(Number(w.maxCoins) || 0)),
      autoApprove: w.autoApprove === true,
    };
  }
  // Public site content (About / FAQ / Disclaimer / Blog / SEO) — admin-managed.
  if (body.siteContent && typeof body.siteContent === "object") {
    const s = body.siteContent as Record<string, unknown>;
    const str = (v: unknown, max = 200000) => (typeof v === "string" ? v.slice(0, max) : "");
    const pageOf = (v: unknown) => { const p = (v && typeof v === "object" ? v : {}) as Record<string, unknown>; return { title: str(p.title, 200), body: str(p.body), seoTitle: str(p.seoTitle, 200), seoDesc: str(p.seoDesc, 400), published: p.published !== false }; };
    const slugify = (t: string) => t.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 80) || `post-${Math.random().toString(36).slice(2, 7)}`;
    patch.siteContent = {
      seo: (() => { const q = (s.seo && typeof s.seo === "object" ? s.seo : {}) as Record<string, unknown>; return { siteTitle: str(q.siteTitle, 200), description: str(q.description, 400), keywords: str(q.keywords, 400), googleVerification: str(q.googleVerification, 200), bingVerification: str(q.bingVerification, 200) }; })(),
      // AdSense ID + raw head/footer code, managed from Admin → Site Content.
      // The publisher ID is normalised and format-checked, because a malformed
      // one silently stops ads serving with no visible error anywhere. The two
      // code blocks are stored VERBATIM on purpose — ad tags, analytics and
      // verification snippets only work if they are byte-for-byte what the
      // provider gave you — so they are only capped in length.
      customCode: (() => {
        const c = (s.customCode && typeof s.customCode === "object" ? s.customCode : {}) as Record<string, unknown>;
        const raw = str(c.adsenseClient, 60).trim();
        // Accept "ca-pub-123…", a bare "pub-123…", or just the digits, and
        // store the canonical form. Anything else is stored empty rather than
        // written out as a broken script tag.
        const digits = raw.replace(/[^0-9]/g, "");
        const adsenseClient = raw && digits.length >= 10 ? `ca-pub-${digits}` : "";
        return {
          adsenseClient,
          headCode: str(c.headCode, 20000),
          footerCode: str(c.footerCode, 20000),
        };
      })(),
      homeIntro: str(s.homeIntro),
      // Every block of words on the public home page. TEXT ONLY — icons, colours
      // and layout stay in code, so nothing here can break the page's design.
      homePage: (() => {
        const hp = (s.homePage && typeof s.homePage === "object" ? s.homePage : {}) as Record<string, unknown>;
        const sec = (k: string) => (hp[k] && typeof hp[k] === "object" ? hp[k] : {}) as Record<string, unknown>;
        // Only an internal path, a full web address, or an on-page anchor.
        const link = (v: unknown) => { const l = str(v, 300).trim(); return l.startsWith("/") && !l.startsWith("//") ? l : l.startsWith("#") ? l : /^https?:\/\//i.test(l) ? l : ""; };
        const rows = <T,>(v: unknown, cap: number, map: (o: Record<string, unknown>) => T): T[] =>
          (Array.isArray(v) ? v : []).slice(0, cap).map((x) => map((x && typeof x === "object" ? x : {}) as Record<string, unknown>));
        const hero = sec("hero"), pil = sec("pillars"), gam = sec("games"), fea = sec("features"), jou = sec("journey"), cta = sec("cta");
        return {
          hero: {
            badge: str(hero.badge, 120), titleA: str(hero.titleA, 120), titleB: str(hero.titleB, 120), titleC: str(hero.titleC, 120),
            subtitle: str(hero.subtitle, 600),
            primaryLabel: str(hero.primaryLabel, 60), primaryHref: link(hero.primaryHref),
            secondaryLabel: str(hero.secondaryLabel, 60), secondaryHref: link(hero.secondaryHref),
            installLabel: str(hero.installLabel, 60),
            stats: rows(hero.stats, 8, (o) => ({ value: str(o.value, 20), label: str(o.label, 40) })),
          },
          pillars: { eyebrow: str(pil.eyebrow, 80), title: str(pil.title, 160), subtitle: str(pil.subtitle, 400), cards: rows(pil.cards, 12, (o) => ({ title: str(o.title, 80), text: str(o.text, 400) })) },
          games: {
            badge: str(gam.badge, 80), titleA: str(gam.titleA, 120), titleB: str(gam.titleB, 120), text: str(gam.text, 600),
            bullets: (Array.isArray(gam.bullets) ? gam.bullets : []).slice(0, 12).map((b) => str(b, 160)).filter(Boolean),
            buttonLabel: str(gam.buttonLabel, 60), buttonHref: link(gam.buttonHref),
          },
          features: { eyebrow: str(fea.eyebrow, 80), title: str(fea.title, 160), subtitle: str(fea.subtitle, 400), cards: rows(fea.cards, 12, (o) => ({ title: str(o.title, 80), text: str(o.text, 400) })) },
          journey: { eyebrow: str(jou.eyebrow, 80), title: str(jou.title, 160), steps: rows(jou.steps, 8, (o) => ({ num: str(o.num, 8), title: str(o.title, 80), text: str(o.text, 300) })) },
          cta: { title: str(cta.title, 160), text: str(cta.text, 600), buttonLabel: str(cta.buttonLabel, 60), buttonHref: link(cta.buttonHref) },
        };
      })(),
      homeFeature: (() => {
        const f = (s.homeFeature && typeof s.homeFeature === "object" ? s.homeFeature : {}) as Record<string, unknown>;
        // Only an internal path or a plain https address — never javascript:/data:.
        const link = str(f.href, 300).trim();
        const safeHref = link.startsWith("/") && !link.startsWith("//") ? link : /^https?:\/\//i.test(link) ? link : "";
        // Media URLs are the uploader's /api/media/ path, or an https address.
        const mediaUrl = (v: unknown) => {
          const u = str(v, 2000).trim();
          if (u.startsWith("/api/media/") && !u.includes("..")) return u;
          return /^https?:\/\//i.test(u) ? u : "";
        };
        const items = (Array.isArray(f.items) ? f.items : []).slice(0, 24).map((raw) => {
          const o = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
          const url = mediaUrl(o.url);
          if (!url) return null;
          return {
            id: str(o.id, 40) || `hf_${Math.random().toString(36).slice(2, 9)}`,
            url,
            kind: o.kind === "video" ? "video" as const : "image" as const,
            name: str(o.name, 120),
          };
        }).filter((x): x is { id: string; url: string; kind: "image" | "video"; name: string } => !!x);
        const wanted = str(f.selectedId, 40);
        const selected = items.find((i) => i.id === wanted);
        const legacy = mediaUrl(f.image);
        return {
          image: selected?.url ?? legacy,
          kind: selected ? selected.kind : "image",
          alt: str(f.alt, 300),
          caption: str(f.caption, 300),
          href: safeHref,
          selectedId: selected?.id ?? "",
          items,
        };
      })(),
      about: pageOf(s.about),
      disclaimer: pageOf(s.disclaimer),
      // Real-world business/contact details shown on /legal/contact and referenced
      // by the Privacy Policy.
      contact: (() => {
        const k = (s.contact && typeof s.contact === "object" ? s.contact : {}) as Record<string, unknown>;
        const num = (v: unknown, d: number, hi: number) => (typeof v === "number" && isFinite(v) ? Math.max(1, Math.min(hi, Math.floor(v))) : d);
        return {
          brandName: str(k.brandName, 120), legalName: str(k.legalName, 200), address: str(k.address, 500),
          supportEmail: str(k.supportEmail, 160), privacyEmail: str(k.privacyEmail, 160),
          grievanceName: str(k.grievanceName, 120), grievanceEmail: str(k.grievanceEmail, 160),
          phone: str(k.phone, 60), hours: str(k.hours, 160),
          ackHours: num(k.ackHours, 24, 720), resolveDays: num(k.resolveDays, 15, 365),
        };
      })(),
      faq: (() => { const f = (s.faq && typeof s.faq === "object" ? s.faq : {}) as Record<string, unknown>; return { title: str(f.title, 200), seoTitle: str(f.seoTitle, 200), seoDesc: str(f.seoDesc, 400), items: Array.isArray(f.items) ? (f.items as unknown[]).slice(0, 100).map((it) => { const o = (it && typeof it === "object" ? it : {}) as Record<string, unknown>; return { q: str(o.q, 500), a: str(o.a, 5000) }; }).filter((it) => it.q) : [] }; })(),
      blog: Array.isArray(s.blog) ? (s.blog as unknown[]).slice(0, 500).map((it) => {
        const o = (it && typeof it === "object" ? it : {}) as Record<string, unknown>;
        const title = str(o.title, 200);
        return { id: str(o.id, 40) || `b_${Math.random().toString(36).slice(2, 9)}`, slug: (str(o.slug, 80) || slugify(title)), title, excerpt: str(o.excerpt, 500), body: str(o.body), cover: str(o.cover, 400), author: str(o.author, 100), date: str(o.date, 40) || new Date().toISOString(), published: o.published !== false, seoTitle: str(o.seoTitle, 200), seoDesc: str(o.seoDesc, 400) };
      }).filter((b) => b.title) : [],
    };
  }
  // Level & reward system — admin-controlled XP amounts + level-up bonus coins.
  if (body.levelRewards && typeof body.levelRewards === "object") {
    const lr = body.levelRewards as Record<string, unknown>;
    const cur = (await getConfig()).levelRewards ?? { enabled: true, base: 20, perLevel: 10, cap: 500, xpPlay: 12, xpWin: 30, xpGift: 6, xpDailyLogin: 25, xpPurchase: 15 };
    const nf = (v: unknown, d: number) => (typeof v === "number" && Number.isFinite(v) ? Math.max(0, Math.round(v)) : d);
    patch.levelRewards = {
      enabled: typeof lr.enabled === "boolean" ? lr.enabled : cur.enabled,
      base: nf(lr.base, cur.base),
      perLevel: nf(lr.perLevel, cur.perLevel),
      cap: nf(lr.cap, cur.cap),
      xpPlay: nf(lr.xpPlay, cur.xpPlay),
      xpWin: nf(lr.xpWin, cur.xpWin),
      xpGift: nf(lr.xpGift, cur.xpGift),
      xpDailyLogin: nf(lr.xpDailyLogin, cur.xpDailyLogin),
      xpPurchase: nf(lr.xpPurchase, cur.xpPurchase),
    };
  }
  // Lotus Flower loyalty rewards — editable milestone tiers + toggles.
  if (body.lotusRewards && typeof body.lotusRewards === "object") {
    const lf = body.lotusRewards as Record<string, unknown>;
    const cur = (await getConfig()).lotusRewards ?? { enabled: false, notifyUser: true, validityDays: 0, tiers: [] };
    const nfp = (v: unknown, d: number) => (typeof v === "number" && Number.isFinite(v) ? Math.max(0, Math.round(v)) : d);
    const rawTiers = Array.isArray(lf.tiers) ? lf.tiers : cur.tiers;
    const tiers = (rawTiers as unknown[])
      .map((t) => t as Record<string, unknown>)
      .map((t) => ({ minCoins: nfp(t.minCoins, 0), flowers: nfp(t.flowers, 0) }))
      .filter((t) => t.minCoins > 0 && t.flowers > 0)
      .sort((a, b) => a.minCoins - b.minCoins)
      .slice(0, 50);
    patch.lotusRewards = {
      enabled: typeof lf.enabled === "boolean" ? lf.enabled : cur.enabled,
      notifyUser: typeof lf.notifyUser === "boolean" ? lf.notifyUser : (cur.notifyUser ?? true),
      validityDays: nfp(lf.validityDays, cur.validityDays ?? 0),
      tiers,
    };
  }
  // Lotus Flower economy — rates + limits, editable anytime. Merged onto the
  // current config so a partial save never wipes the other fields.
  if (body.lotus && typeof body.lotus === "object") {
    const l = body.lotus as Record<string, unknown>;
    const cur = (await getConfig()).lotus!;
    const numf = (v: unknown, d: number, min = 0) => (typeof v === "number" && Number.isFinite(v) ? Math.max(min, v) : d);
    patch.lotus = {
      enabled: typeof l.enabled === "boolean" ? l.enabled : cur.enabled,
      name: typeof l.name === "string" && l.name.trim() ? l.name.trim().slice(0, 24) : cur.name,
      icon: typeof l.icon === "string" ? l.icon.slice(0, 400) : (cur.icon ?? ""),
      coinToLotus: numf(l.coinToLotus, cur.coinToLotus, 0),
      lotusToCurrency: numf(l.lotusToCurrency, cur.lotusToCurrency, 0),
      currency: typeof l.currency === "string" && l.currency.trim() ? l.currency.trim().slice(0, 8) : cur.currency,
      minWithdraw: Math.floor(numf(l.minWithdraw, cur.minWithdraw, 0)),
      maxWithdraw: Math.floor(numf(l.maxWithdraw, cur.maxWithdraw, 0)),
      dailyLimit: Math.floor(numf(l.dailyLimit, cur.dailyLimit, 0)),
      feePct: Math.max(0, Math.min(100, Math.round(numf(l.feePct, cur.feePct ?? 5, 0)))),
      autoApprove: typeof l.autoApprove === "boolean" ? l.autoApprove : cur.autoApprove,
      userSharePct: Math.max(0, Math.min(100, Math.round(numf(l.userSharePct, cur.userSharePct ?? 65, 0)))),
      agencySharePct: Math.max(0, Math.min(100, Math.round(numf(l.agencySharePct, cur.agencySharePct ?? 5, 0)))),
      companySharePct: Math.max(0, Math.min(100, Math.round(numf(l.companySharePct, cur.companySharePct ?? 25, 0)))),
      trustSharePct: Math.max(0, Math.min(100, Math.round(numf(l.trustSharePct, cur.trustSharePct ?? 5, 0)))),
      trustEnabled: typeof l.trustEnabled === "boolean" ? l.trustEnabled : (cur.trustEnabled ?? true),
      gstPct: Math.max(0, Math.min(100, Math.round(numf(l.gstPct, cur.gstPct ?? 18, 0)))),
      // Conversion slabs ("500 Lotus = ₹300") — sanitize each admin-defined rule;
      // a save without the field keeps the current rules unchanged.
      conversionTiers: Array.isArray(l.conversionTiers)
        ? (l.conversionTiers as unknown[]).slice(0, 100).flatMap((t) => {
            if (!t || typeof t !== "object") return [];
            const r = t as Record<string, unknown>;
            const lot = Math.floor(numf(r.lotus, 0, 0));
            if (lot <= 0) return [];
            const val = Math.round(numf(r.value, 0, 0) * 100) / 100;
            const id = typeof r.id === "string" && r.id.trim() ? r.id.trim().slice(0, 24) : `ct_${lot}_${Math.random().toString(36).slice(2, 6)}`;
            return [{ id, lotus: lot, value: val, enabled: r.enabled !== false }];
          })
        : (cur.conversionTiers ?? []),
      // Per-reward-type Lotus eligibility (which free rewards convert vs stay coins).
      // Merged onto current so a partial save keeps the rest; only known boolean keys kept.
      rewardTypes: (() => {
        const KEYS = ["welcome", "dailyLogin", "timed", "activity", "luckySpin", "referral", "tournament", "levelUp", "event", "manual"];
        if (!l.rewardTypes || typeof l.rewardTypes !== "object") return cur.rewardTypes;
        const src = l.rewardTypes as Record<string, unknown>;
        const out: Record<string, boolean> = { ...(cur.rewardTypes ?? {}) };
        for (const k of KEYS) if (typeof src[k] === "boolean") out[k] = src[k] as boolean;
        return out;
      })(),
    };
    // Audit any Share Distribution % change (User/Agency/Company/Trust/GST/on-off).
    const pl = patch.lotus;
    const before = { user: cur.userSharePct ?? 65, agency: cur.agencySharePct ?? 5, company: cur.companySharePct ?? 25, trust: cur.trustSharePct ?? 5, trustEnabled: cur.trustEnabled ?? true, gst: cur.gstPct ?? 18 };
    const after = { user: pl.userSharePct ?? 65, agency: pl.agencySharePct ?? 5, company: pl.companySharePct ?? 25, trust: pl.trustSharePct ?? 5, trustEnabled: pl.trustEnabled ?? true, gst: pl.gstPct ?? 18 };
    if (JSON.stringify(before) !== JSON.stringify(after)) shareChange = { before, after };
  }
  if (body.logCleanup && typeof body.logCleanup === "object") {
    const c = body.logCleanup as Record<string, unknown>;
    const days = Math.max(0, Math.floor(Number(c.days) || 0));
    patch.logCleanup = { enabled: c.enabled === true, days: [30, 60, 90, 180, 365].includes(days) ? days : 90 };
  }
  if (Array.isArray(body.productCategoryFields)) {
    const PT = ["text", "textarea", "number", "select", "radio", "checkbox", "date", "file", "image", "url"];
    patch.productCategoryFields = (body.productCategoryFields as unknown[]).map((raw, i): ProductFieldDef | null => {
      if (!raw || typeof raw !== "object") return null;
      const r = raw as Record<string, unknown>;
      const label = typeof r.label === "string" ? r.label.trim().slice(0, 60) : "";
      if (!label) return null;
      const key = (typeof r.key === "string" && r.key.trim() ? r.key : label).toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "").slice(0, 60) || "field";
      const type = (typeof r.type === "string" && PT.includes(r.type) ? r.type : "text") as ProductFieldDef["type"];
      const options = Array.isArray(r.options) ? (r.options as unknown[]).filter((o): o is string => typeof o === "string").map((o) => o.trim().slice(0, 60)).filter(Boolean).slice(0, 40) : undefined;
      return {
        id: typeof r.id === "string" && r.id ? r.id : `pf_${i}_${Date.now().toString(36)}`,
        category: typeof r.category === "string" ? r.category.trim().slice(0, 60) : "",
        key, label, type,
        options: ["select", "radio", "checkbox"].includes(type) ? (options ?? []) : undefined,
        placeholder: typeof r.placeholder === "string" ? r.placeholder.trim().slice(0, 100) : undefined,
        required: r.required === true,
        enabled: r.enabled !== false,
        order: Number.isFinite(Number(r.order)) ? Number(r.order) : i,
      };
    }).filter((f): f is ProductFieldDef => !!f).slice(0, 500);
  }
  if (body.referral && typeof body.referral === "object") {
    const r = body.referral as Record<string, unknown>;
    patch.referral = {
      enabled: r.enabled !== false,
      reward: Math.max(0, Math.floor(Number(r.reward) || 0)),
      requireApproval: r.requireApproval === true,
      autoBlockDuplicates: r.autoBlockDuplicates !== false,
      agencyReward: Math.max(0, Math.floor(Number(r.agencyReward) || 0)),
    };
  }
  // Store items catalog (backgrounds / name effects / badges / overlays, plus
  // the game cosmetics: dice / board / token).
  if (Array.isArray(body.storeItems)) {
    const KINDS = ["background", "nameEffect", "badge", "overlay"];
    patch.storeItems = (body.storeItems as unknown[])
      .map((x) => x as Record<string, unknown>)
      .map((x) => ({
        id: String(x.id ?? "").slice(0, 60),
        kind: (KINDS.includes(String(x.kind)) ? String(x.kind) : "background") as "background" | "nameEffect" | "badge" | "overlay",
        name: String(x.name ?? "").trim().slice(0, 40) || "Item",
        image: typeof x.image === "string" ? x.image.slice(0, 400) : undefined,
        style: typeof x.style === "string" ? x.style.slice(0, 40) : undefined,
        price: Math.max(0, Math.floor(Number(x.price) || 0)),
        enabled: x.enabled !== false,
        category: typeof x.category === "string" ? x.category.trim().slice(0, 40) : undefined,
        badge: typeof x.badge === "string" ? x.badge.trim().slice(0, 20) : undefined,
        description: typeof x.description === "string" ? x.description.trim().slice(0, 160) : undefined,
        validityDays: Math.max(0, Math.floor(Number(x.validityDays) || 0)),
        order: Math.max(0, Math.floor(Number(x.order) || 0)),
        vipOnly: x.vipOnly === true,
        // v400 store controls
        archived: x.archived === true,
        featured: x.featured === true,
        newArrival: x.newArrival === true,
        trending: x.trending === true,
        comingSoon: x.comingSoon === true,
        limitedEdition: x.limitedEdition === true,
        salePrice: typeof x.salePrice === "number" && isFinite(x.salePrice) && x.salePrice >= 0 ? Math.floor(x.salePrice) : undefined,
        saleStart: typeof x.saleStart === "string" ? x.saleStart.slice(0, 30) : undefined,
        saleEnd: typeof x.saleEnd === "string" ? x.saleEnd.slice(0, 30) : undefined,
        stock: typeof x.stock === "number" && isFinite(x.stock) && x.stock >= 0 ? Math.floor(x.stock) : undefined,
        purchaseLimit: (["once", "daily", "weekly", "monthly", "lifetime"].includes(String(x.purchaseLimit)) ? String(x.purchaseLimit) : undefined) as "once" | "daily" | "weekly" | "monthly" | "lifetime" | undefined,
        minLevel: typeof x.minLevel === "number" && isFinite(x.minLevel) && x.minLevel > 0 ? Math.floor(x.minLevel) : undefined,
        maxLevel: typeof x.maxLevel === "number" && isFinite(x.maxLevel) && x.maxLevel > 0 ? Math.floor(x.maxLevel) : undefined,
        displayOnly: x.displayOnly === true,
        agencyIds: Array.isArray(x.agencyIds) ? (x.agencyIds as unknown[]).filter((a): a is string => typeof a === "string").slice(0, 300) : undefined,
        userIds: Array.isArray(x.userIds) ? (x.userIds as unknown[]).filter((a): a is string => typeof a === "string").slice(0, 500) : undefined,
        gender: x.gender === "male" ? "male" as const : x.gender === "female" ? "female" as const : undefined,
        restrictMode: x.restrictMode === "show" ? "show" as const : x.restrictMode === "hide" ? "hide" as const : undefined,
        freeForVip: x.freeForVip === true,
        firstBuyDiscountPct: typeof x.firstBuyDiscountPct === "number" && isFinite(x.firstBuyDiscountPct) && x.firstBuyDiscountPct > 0 ? Math.min(100, Math.floor(x.firstBuyDiscountPct)) : undefined,
      }))
      // A background/badge/overlay needs an image. A name effect needs a style.
      // A dice/board/token needs a style too — the design it unlocks — and its
      // picture is optional, because the game already draws the real artwork.
      .filter((x) => x.id && (x.kind === "nameEffect" ? !!x.style : !!x.image))
      .slice(0, 150);
  }
  // Google Sign-In public Client ID (plain string; "" turns the button off).
  if (typeof body.googleClientId === "string") {
    patch.googleClientId = body.googleClientId.trim().slice(0, 200);
  }
  // Duplicate-name rule per name type (true = allowed, false = must be unique).
  if (body.duplicateNames && typeof body.duplicateNames === "object") {
    const d = body.duplicateNames as Record<string, unknown>;
    patch.duplicateNames = { user: d.user !== false, group: d.group !== false, agency: d.agency !== false };
  }
  // Android app-link fingerprint (Play Console → Setup → App integrity).
  // Normalised: uppercase hex pairs joined by colons, so it does not matter how
  // it was copied. Anything that is not a valid fingerprint is stored empty
  // rather than silently serving a broken assetlinks file.
  if (typeof body.androidFingerprint === "string") {
    const cleaned = body.androidFingerprint.replace(/[^0-9a-fA-F]/g, "").toUpperCase();
    patch.androidFingerprint = cleaned.length === 64 ? (cleaned.match(/.{2}/g) ?? []).join(":") : "";
  }
  // Avatar frame shop catalog (id/name/image/price/enabled + store metadata).
  if (Array.isArray(body.avatarFrames)) {
    const iso = (v: unknown) => (typeof v === "string" && v && !isNaN(new Date(v).getTime()) ? new Date(v).toISOString() : undefined);
    patch.avatarFrames = (body.avatarFrames as unknown[])
      .map((x) => x as Record<string, unknown>)
      .map((x) => ({
        id: String(x.id ?? "").slice(0, 60),
        name: String(x.name ?? "").trim().slice(0, 40) || "Frame",
        image: typeof x.image === "string" ? x.image.slice(0, 400) : "",
        price: Math.max(0, Math.floor(Number(x.price) || 0)),
        enabled: x.enabled !== false,
        category: typeof x.category === "string" ? x.category.trim().slice(0, 40) : undefined,
        badge: typeof x.badge === "string" ? x.badge.trim().slice(0, 20) : undefined,
        description: typeof x.description === "string" ? x.description.trim().slice(0, 160) : undefined,
        validityDays: Math.max(0, Math.floor(Number(x.validityDays) || 0)),
        order: Math.max(0, Math.floor(Number(x.order) || 0)),
        launchAt: iso(x.launchAt),
        endAt: iso(x.endAt),
      }))
      .filter((x) => x.id && x.image)
      .slice(0, 100);
  }
  // Per-module frame + badge visibility (Visible/Hidden + Required/Optional).
  if (body.moduleFrames && typeof body.moduleFrames === "object") {
    patch.moduleFrames = sanitizeModuleFrames(body.moduleFrames);
  }
  // In-game activity notifications — master on/off + timings + per-type toggles.
  if (body.gameAlerts && typeof body.gameAlerts === "object") {
    const g = body.gameAlerts as Record<string, unknown>;
    const t = (g.types && typeof g.types === "object" ? g.types : {}) as Record<string, unknown>;
    const boolOr = (v: unknown, d: boolean) => (typeof v === "boolean" ? v : d);
    patch.gameAlerts = {
      enabled: boolOr(g.enabled, true),
      infoSeconds: Math.max(1, Math.min(15, Math.round(Number(g.infoSeconds) || 3))),
      approvalSeconds: Math.max(3, Math.min(60, Math.round(Number(g.approvalSeconds) || 10))),
      types: {
        joins: boolOr(t.joins, true),
        leaves: boolOr(t.leaves, true),
        seatRequests: boolOr(t.seatRequests, true),
        messages: boolOr(t.messages, true),
        gameEvents: boolOr(t.gameEvents, true),
      },
    };
  }
  // Sound Management — pack + per-effect {enabled, url} (custom uploaded sound).
  if (body.gameSound && typeof body.gameSound === "object") {
    const gs = body.gameSound as Record<string, unknown>;
    const PACKS = ["classic", "modern", "premium", "casino", "arcade", "fantasy", "silent"];
    const EFFECTS = ["diceRoll", "tokenMove", "capture", "home", "win", "lose", "countdown", "notification", "click"] as const;
    const cur = (await getConfig()).gameSound ?? {};
    const rawFx = (gs.effects && typeof gs.effects === "object" ? gs.effects : {}) as Record<string, unknown>;
    const effects: NonNullable<AppConfig["gameSound"]>["effects"] = {};
    for (const key of EFFECTS) {
      const raw = rawFx[key];
      const curE = cur.effects?.[key] ?? {};
      if (raw && typeof raw === "object") {
        const e = raw as Record<string, unknown>;
        effects[key] = {
          enabled: typeof e.enabled === "boolean" ? e.enabled : (curE.enabled ?? true),
          url: typeof e.url === "string" ? e.url.slice(0, 400) : (curE.url ?? ""),
        };
      } else if (curE.enabled !== undefined || curE.url) {
        effects[key] = curE;
      }
    }
    patch.gameSound = {
      pack: (typeof gs.pack === "string" && PACKS.includes(gs.pack) ? gs.pack : (cur.pack ?? "classic")) as NonNullable<AppConfig["gameSound"]>["pack"],
      effects,
    };
  }
  // Background music — master + volume + per-screen {url, enabled}.
  if (body.bgMusic && typeof body.bgMusic === "object") {
    const bm = body.bgMusic as Record<string, unknown>;
    const SCREENS = ["home", "lobby", "voiceRoom", "ludo", "snake", "tournament", "waiting", "result"] as const;
    const cur = (await getConfig()).bgMusic ?? {};
    const rawS = (bm.screens && typeof bm.screens === "object" ? bm.screens : {}) as Record<string, unknown>;
    const screens: NonNullable<AppConfig["bgMusic"]>["screens"] = {};
    for (const key of SCREENS) {
      const raw = rawS[key];
      const curS = cur.screens?.[key] ?? {};
      if (raw && typeof raw === "object") {
        const s = raw as Record<string, unknown>;
        screens[key] = {
          url: typeof s.url === "string" ? s.url.slice(0, 400) : (curS.url ?? ""),
          enabled: typeof s.enabled === "boolean" ? s.enabled : (curS.enabled ?? false),
        };
      } else if (curS.url || curS.enabled !== undefined) {
        screens[key] = curS;
      }
    }
    patch.bgMusic = {
      enabled: typeof bm.enabled === "boolean" ? bm.enabled : (cur.enabled ?? false),
      volumePct: (typeof bm.volumePct === "number" && isFinite(bm.volumePct) ? Math.max(0, Math.min(100, Math.round(bm.volumePct))) : (cur.volumePct ?? 35)),
      screens,
    };
  }
  if (body.captureProtection && typeof body.captureProtection === "object") {
    const cp = body.captureProtection as Record<string, unknown>;
    const curMods = (await getConfig()).captureProtection?.modules ?? {};
    const inMods = (cp.modules && typeof cp.modules === "object" ? cp.modules : {}) as Record<string, unknown>;
    const modKey = (k: string, d: boolean) => (typeof inMods[k] === "boolean" ? (inMods[k] as boolean) : ((curMods as Record<string, boolean>)[k] ?? d));
    patch.captureProtection = {
      screenshot: cp.screenshot !== false,
      recording: cp.recording !== false,
      sharing: cp.sharing !== false,
      thirdParty: cp.thirdParty !== false,
      autoEndCall: cp.autoEndCall === true,
      warning: cp.warning !== false,
      watermark: cp.watermark === true, // traceable name+ID overlay — opt-in (default OFF, client asked to remove it)
      audioRecording: cp.audioRecording !== false,
      videoRecording: cp.videoRecording !== false,
      mirroring: cp.mirroring !== false,
      allScreens: cp.allScreens === true, // master: protect EVERY screen (default OFF)
      modules: {
        home: modKey("home", false), profile: modKey("profile", false), chat: modKey("chat", false),
        voiceRoom: modKey("voiceRoom", false), wallet: modKey("wallet", true), paidZone: modKey("paidZone", true),
        reels: modKey("reels", false), tournaments: modKey("tournaments", false), competitions: modKey("competitions", false),
      },
    };
  }
  if (body.luckySpin && typeof body.luckySpin === "object") {
    const s = body.luckySpin as Record<string, unknown>;
    const rawSegs = Array.isArray(s.segments) ? s.segments : [];
    const segments = rawSegs
      .map((x) => x as Record<string, unknown>)
      .map((x) => ({
        label: String(x.label ?? "").slice(0, 16) || "0",
        coins: Math.max(0, Math.floor(Number(x.coins) || 0)),
        weight: Math.max(0, Number(x.weight) || 0),
        // Paid-spin odds are OPTIONAL — absent/blank means "same as free".
        ...(x.weightPaid === undefined || x.weightPaid === null || x.weightPaid === ""
          ? {}
          : { weightPaid: Math.max(0, Number(x.weightPaid) || 0) }),
      }))
      .slice(0, 12);
    // Spending-based reward boost tiers (min coins purchased+spent → boost %).
    const sbRaw = (s.spendBoost ?? {}) as Record<string, unknown>;
    const sbTiers = (Array.isArray(sbRaw.tiers) ? sbRaw.tiers : [])
      .map((x) => x as Record<string, unknown>)
      .map((x) => ({ minCoins: Math.max(0, Math.floor(Number(x.minCoins) || 0)), boostPct: Math.min(90, Math.max(0, Math.floor(Number(x.boostPct) || 0))) }))
      .slice(0, 8);
    patch.luckySpin = {
      spendBoost: { enabled: sbRaw.enabled === true, tiers: sbTiers },
      enabled: s.enabled !== false,
      cooldownHours: Math.max(0, Math.floor(Number(s.cooldownHours) || 0)),
      segments: segments.length >= 2 ? segments : (patch.luckySpin?.segments ?? []),
      extraChancesEnabled: s.extraChancesEnabled !== false,
      dailyLoginChances: Math.max(0, Math.floor(Number(s.dailyLoginChances) || 0)),
      winTaskChances: Math.max(0, Math.floor(Number(s.winTaskChances) || 0)),
      buyCostCoins: Math.max(0, Math.floor(Number(s.buyCostCoins) || 0)),
      adChancesPerDay: Math.max(0, Math.floor(Number(s.adChancesPerDay) || 0)),
      chanceExpiryDays: Math.max(0, Math.floor(Number(s.chanceExpiryDays) || 0)),
    };
    // If the incoming segments were invalid/too few, keep the current ones.
    if (patch.luckySpin.segments.length < 2) delete (patch as Record<string, unknown>).luckySpin;
  }
  if (body.paymentQr && typeof body.paymentQr === "object") {
    const q = body.paymentQr as Record<string, unknown>;
    patch.paymentQr = {
      enabled: q.enabled !== false, // default ON; only an explicit false disables the QR method
      imageUrl: typeof q.imageUrl === "string" ? q.imageUrl.slice(0, 2_000_000) : "",
      upiId: typeof q.upiId === "string" ? q.upiId.slice(0, 120) : "",
      note: typeof q.note === "string" ? q.note.slice(0, 400) : "",
      currency: typeof q.currency === "string" ? q.currency.slice(0, 8) : "₹",
    };
  }
  if (body.paymentGateway && typeof body.paymentGateway === "object") {
    const g = body.paymentGateway as Record<string, unknown>;
    const m = (g.methods && typeof g.methods === "object" ? g.methods : {}) as Record<string, unknown>;
    const prov = g.provider === "razorpay" || g.provider === "stripe" || g.provider === "test" ? g.provider : "stripe";
    patch.paymentGateway = {
      enabled: g.enabled !== false, // default ON; only an explicit false disables the card / online gateway
      provider: prov,
      keyId: typeof g.keyId === "string" ? g.keyId.slice(0, 200) : "",
      currency: typeof g.currency === "string" ? g.currency.slice(0, 8) : "SAR",
      methods: {
        cards: m.cards !== false, googlePay: m.googlePay !== false, applePay: m.applePay !== false,
        paypal: m.paypal !== false, local: m.local !== false,
      },
    };
  }
  if (Array.isArray(body.policies)) {
    const slugify = (s: string) => s.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40) || "policy";
    const now = new Date().toISOString();
    const seen = new Set<string>();
    patch.policies = (body.policies as unknown[])
      .filter((p): p is Record<string, unknown> => !!p && typeof p === "object")
      .slice(0, 100)
      .map((p, i) => {
        const title = String(p.title ?? "Policy").slice(0, 80);
        let slug = slugify(String(p.slug ?? title));
        while (seen.has(slug)) slug = `${slug}-${i}`;
        seen.add(slug);
        return {
          id: String(p.id ?? "").trim() || `pol_${i}_${slug}`,
          slug,
          title,
          body: String(p.body ?? "").slice(0, 20000),
          requiredAtSignup: p.requiredAtSignup !== false,
          updatedAt: typeof p.updatedAt === "string" ? p.updatedAt : now,
        };
      });
  }

  // Record the new-user-approval toggle change specifically (audit history).
  if (patch.settings && typeof (patch.settings as AppConfig["settings"]).signupApproval === "boolean") {
    const on = (patch.settings as AppConfig["settings"]).signupApproval;
    await addAdminLog(user.fullName, `New-user approval turned ${on ? "ON (new sign-ups need approval)" : "OFF (new sign-ups auto-approved)"}`);
  }
  // Record every feature ON/OFF change (Feature Management audit history).
  if (patch.features) {
    const prev = (await getConfig()).features ?? {};
    const LABEL: Record<string, string> = { registration: "Registration", voiceRooms: "Voice Rooms", privateRooms: "Private Rooms", paidZone: "Paid Zone", gifts: "Gift system", coins: "Coin system", levels: "Level/XP system", games: "Games section", coHost: "Host/Co-host system", chat: "Chat/Messages", business: "Business Module" };
    for (const [k, v] of Object.entries(patch.features as Record<string, boolean>)) {
      if ((prev as Record<string, boolean>)[k] !== v) await addAdminLog(user.fullName, `Feature "${LABEL[k] ?? k}" turned ${v ? "ON" : "OFF"}`);
    }
  }

  const config = await updateConfig(patch);
  await addAdminLog(user.fullName, `Updated settings: ${Object.keys(patch).join(", ")}`);
  if (shareChange) { await recordShareChange(user.fullName, shareChange.before, shareChange.after); await addAdminLog(user.fullName, `Share Distribution changed → User ${shareChange.after.user}% · Agency ${shareChange.after.agency}% · Company ${shareChange.after.company}% · Trust ${shareChange.after.trust}%`); }
  // Roll the new default seat count out to every existing room.
  if (seatsChangedTo !== null) {
    const { applyDefaultSeatsToAllRooms } = await import("@/server/repo");
    const n = await applyDefaultSeatsToAllRooms(seatsChangedTo);
    await addAdminLog(user.fullName, `Applied ${seatsChangedTo} seats to ${n} existing room${n === 1 ? "" : "s"}`);
  }
  return ok({ config });
}
