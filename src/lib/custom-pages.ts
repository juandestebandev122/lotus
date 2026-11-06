// ============================================================================
// CUSTOM CONTENT PAGES — the "Add Content" system.
//
// The navigation editor could only ever add a LINK: a menu entry pointing at a
// screen that already existed. There was no way to create the thing being linked
// to, so "Add Content" was missing and only "Add sub-item" existed.
//
// A custom page is real content the admin writes in the panel — heading, body
// text, an optional picture and buttons — served at /p/<slug>. Once it exists it
// can be linked from any menu, the footer, or anywhere else, exactly like a
// built-in screen.
// ============================================================================

export interface CustomPageBlock {
  id: string;
  /** What this block is: a paragraph of text, a picture, a heading, or a button. */
  kind: "heading" | "text" | "image" | "button" | "divider";
  /** Heading / paragraph text, the button's label, or the image's alt text. */
  text?: string;
  /** Picture URL (an /api/media path from the uploader). */
  image?: string;
  /** Where a button goes. Internal paths and https/mailto/tel only. */
  href?: string;
  /** Heading level for "heading" blocks. */
  level?: 2 | 3;
  /** Image width as a % of the page column (20–100). */
  widthPct?: number;
  align?: "left" | "center";
}

export interface CustomPage {
  id: string;
  /** The address: /p/<slug>. Lower-case letters, digits and dashes. */
  slug: string;
  /** Shown in the browser tab, the menu, and as the page's main title. */
  title: string;
  /** One line under the title. */
  subtitle?: string;
  /** The page content, in order. */
  blocks?: CustomPageBlock[];
  enabled: boolean;
  /** Members must be signed in to read it. */
  requireLogin?: boolean;
  /** Search-engine description for the public page. */
  seoDescription?: string;
  createdAt?: string;
  updatedAt?: string;
}

/** Turn any title into a safe, readable address. */
export function slugify(input: string): string {
  return (input ?? "")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 60) || "page";
}

/** A slug that isn't already taken by another page. */
export function uniqueSlug(base: string, pages: CustomPage[], ignoreId?: string): string {
  const root = slugify(base);
  let slug = root;
  let n = 2;
  while (pages.some((p) => p.slug === slug && p.id !== ignoreId)) slug = `${root}-${n++}`;
  return slug;
}

/** Only ever put an allow-listed scheme in an href (no javascript:/data:). */
export function safePageHref(href?: string): string {
  const s = (href ?? "").trim();
  if (!s) return "";
  if (s.startsWith("/") && !s.startsWith("//")) return s;
  return /^(https?:|mailto:|tel:)/i.test(s) ? s : "";
}

/** The address a custom page lives at. */
export const customPageHref = (p: { slug: string }) => `/p/${p.slug}`;

/** Pages a member may actually open. */
export function livePages(pages?: CustomPage[] | null): CustomPage[] {
  return (pages ?? []).filter((p) => p.enabled !== false && !!p.slug);
}

export function findPageBySlug(pages: CustomPage[] | undefined | null, slug: string): CustomPage | undefined {
  return (pages ?? []).find((p) => p.slug === slug && p.enabled !== false);
}

export function newBlock(kind: CustomPageBlock["kind"]): CustomPageBlock {
  const id = `b_${Math.random().toString(36).slice(2, 9)}`;
  switch (kind) {
    case "heading": return { id, kind, text: "Section heading", level: 2 };
    case "image": return { id, kind, image: "", widthPct: 100, align: "center" };
    case "button": return { id, kind, text: "Open", href: "/home", align: "left" };
    case "divider": return { id, kind };
    case "text":
    default: return { id, kind: "text", text: "Write your text here." };
  }
}

export function newCustomPage(existing: CustomPage[], title = "New page"): CustomPage {
  const now = new Date().toISOString();
  return {
    id: `pg_${Math.random().toString(36).slice(2, 9)}`,
    slug: uniqueSlug(title, existing),
    title,
    subtitle: "",
    blocks: [newBlock("text")],
    enabled: true,
    requireLogin: false,
    createdAt: now,
    updatedAt: now,
  };
}
