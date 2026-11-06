// Admin control for the user-facing "All Pages" directory (/all-pages).
//
// The directory itself is generated from the app catalog (lib/app-pages.ts), so
// nothing is ever unreachable. This is the admin's control over it: whether the
// screen exists at all, which parts of it are shown, and which sections/tiles
// members see and in what order.
//
// Deliberately kept free of icon imports so the SERVER config types can use it
// without pulling React components into the server bundle.

/** Per-section overrides, keyed by the section key ("gaming", "voice", …). */
export interface AllPagesSectionRule {
  hidden?: boolean;
  /** Lower sorts first. Sections with no order keep their catalog position. */
  order?: number;
}

/** Per-tile overrides, keyed by `${sectionKey}::${page label}`. */
export interface AllPagesPageRule {
  hidden?: boolean;
  order?: number;
}

export interface AllPagesConfig {
  /** Master switch. Off = the page and its menu entries disappear for members. */
  enabled?: boolean;
  /** Heading shown at the top of the directory ("" = the built-in title). */
  title?: string;
  /** One-line description under the heading ("" = the built-in one). */
  subtitle?: string;
  /** Show the search box. */
  showSearch?: boolean;
  /** Show the "jump to section" chips. */
  showJumpLinks?: boolean;
  /** Show the per-section page counts. */
  showCounts?: boolean;
  /** Show each tile's one-line description. */
  showDescriptions?: boolean;
  /** Show the closing note about hidden pages. */
  showFooterNote?: boolean;
  sections?: Record<string, AllPagesSectionRule>;
  pages?: Record<string, AllPagesPageRule>;
  /**
   * Tiles the ADMIN added themselves, on top of the app's own screens. Created by
   * "Add Content" (which also creates the page they point at), and — unlike the
   * built-in tiles, which are real app screens and can only be hidden — these can
   * be edited and deleted outright.
   */
  customTiles?: AllPagesCustomTile[];
}

export interface AllPagesCustomTile {
  id: string;
  /** Which section it appears in (an APP_SECTIONS key). */
  section: string;
  label: string;
  desc?: string;
  href: string;
  hidden?: boolean;
  order?: number;
}

/** The stable key for one tile's rule. */
export const allPagesTileKey = (sectionKey: string, label: string) => `${sectionKey}::${label}`;

/** Defaults — what the directory does when the admin has never touched it.
 *  Only the on/off switches: the list-shaped fields (sections, pages,
 *  customTiles) and the free-text ones start empty, not "defaulted". */
export const ALL_PAGES_DEFAULTS: Required<Omit<AllPagesConfig, "sections" | "pages" | "title" | "subtitle" | "customTiles">> = {
  enabled: true,
  showSearch: true,
  showJumpLinks: true,
  showCounts: true,
  showDescriptions: true,
  showFooterNote: true,
};

/** True when members can open the All Pages directory. */
export function allPagesOn(cfg?: AllPagesConfig | null): boolean {
  return cfg?.enabled !== false;
}
