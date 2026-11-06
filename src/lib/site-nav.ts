// ---------------------------------------------------------------------------
// SITE NAVIGATION — headers, footers, menus and submenus, all admin-managed.
//
// The public site's header and footer links used to be written into the page, so
// renaming "Contact Us" or adding a link meant a code change. They now come from
// config.siteNav, which the admin edits at /admin/navigation: add, rename,
// reorder, hide, group into columns, and set the tagline and copyright line.
//
// The in-app sidebar keeps its existing order/hide builder (config.menuLayout)
// and gains SUBMENUS — child links nested under a menu item.
//
// Everything here is navigation only: it changes what links exist and what they
// are called, never what a page does or who may open it. Permission and feature
// gating still happen on the pages themselves.
// ---------------------------------------------------------------------------

export interface SiteLink {
  id: string;
  label: string;
  href: string;
  enabled?: boolean;   // false = kept but not shown
  newTab?: boolean;
}

export interface FooterColumn {
  id: string;
  title: string;       // "" = an untitled row of links
  links: SiteLink[];
}

export interface SiteNav {
  header?: {
    links?: SiteLink[];      // extra links beside the logo
    showLogin?: boolean;     // the "Log in" action (default ON)
    ctaText?: string;        // the main call-to-action button
    ctaHref?: string;
  };
  footer?: {
    tagline?: string;        // the line beside the logo
    copyright?: string;      // {year} is replaced with the current year
    showLogin?: boolean;
    columns?: FooterColumn[]; // grouped links; a single untitled column = one row
  };
}

const uid = (p: string) => `${p}_${Math.random().toString(36).slice(2, 8)}`;

/** The links the site shipped with — used until an admin changes them. */
export function defaultSiteNav(): SiteNav {
  return {
    header: { links: [], showLogin: true, ctaText: "", ctaHref: "" },
    footer: {
      tagline: "Connect, Chat, Play & Grow Together",
      copyright: "© {year} Lotus Ludo. All rights reserved. Play responsibly — for players 18+.",
      showLogin: true,
      // Grouped so every published page is reachable from the footer of every
      // page — which is both good navigation and something ad networks and
      // search engines check for when they review a site.
      columns: [
        {
          id: "play",
          title: "Play & Learn",
          links: [
            { id: "how-to-play", label: "How to Play Ludo", href: "/guides/how-to-play-ludo", enabled: true },
            { id: "ludo-rules", label: "Ludo Rules Guide", href: "/guides/ludo-rules", enabled: true },
            { id: "tournament-rules", label: "Tournament Rules", href: "/guides/tournament-rules", enabled: true },
            { id: "guides", label: "All Guides", href: "/guides", enabled: true },
            { id: "blog", label: "Blog", href: "/blog", enabled: true },
          ],
        },
        {
          id: "safety",
          title: "Safety & Fair Play",
          links: [
            { id: "community", label: "Community Guidelines", href: "/legal/community", enabled: true },
            { id: "fair-play", label: "Fair Play Policy", href: "/legal/fair-play", enabled: true },
            { id: "safety-moderation", label: "Safety & Moderation", href: "/legal/safety-moderation", enabled: true },
            { id: "reporting", label: "User Reporting Policy", href: "/legal/reporting", enabled: true },
            { id: "responsible", label: "Responsible Gaming", href: "/legal/responsible-gaming", enabled: true },
          ],
        },
        {
          id: "legal",
          title: "Legal & Payments",
          links: [
            { id: "terms", label: "Terms & Conditions", href: "/legal/terms", enabled: true },
            { id: "rules", label: "Rules & Regulations", href: "/legal/rules", enabled: true },
            { id: "privacy", label: "Privacy Policy", href: "/legal/privacy", enabled: true },
            { id: "coin-purchase", label: "Coin Purchase Policy", href: "/legal/coin-purchase", enabled: true },
            { id: "refund", label: "Refund Policy", href: "/legal/refund", enabled: true },
            { id: "disclaimer", label: "Disclaimer", href: "/disclaimer", enabled: true },
          ],
        },
        {
          id: "company",
          title: "Company",
          links: [
            { id: "about", label: "About Us", href: "/about", enabled: true },
            { id: "faq", label: "FAQ", href: "/faq", enabled: true },
            { id: "contact", label: "Contact Us", href: "/legal/contact", enabled: true },
          ],
        },
      ],
    },
  };
}

/** Only allow an internal path or a safe external address in a nav link. */
function safeHref(v: unknown): string {
  const s = typeof v === "string" ? v.trim().slice(0, 300) : "";
  if (!s) return "";
  if (s.startsWith("/") && !s.startsWith("//")) return s;       // internal path
  if (/^https?:\/\//i.test(s)) return s;                         // plain web address
  if (/^(mailto:|tel:)/i.test(s)) return s;                      // contact links
  return ""; // anything else (javascript:, data:, …) is dropped
}

export function sanitizeSiteLink(raw: unknown): SiteLink | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const label = typeof r.label === "string" ? r.label.trim().slice(0, 60) : "";
  const href = safeHref(r.href);
  if (!label || !href) return null;
  return {
    id: typeof r.id === "string" && r.id ? r.id.slice(0, 40) : uid("ln"),
    label, href,
    enabled: r.enabled !== false,
    newTab: r.newTab === true,
  };
}

export function sanitizeSiteNav(raw: unknown): SiteNav {
  const d = defaultSiteNav();
  if (!raw || typeof raw !== "object") return d;
  const r = raw as Record<string, unknown>;
  const h = (r.header && typeof r.header === "object" ? r.header : {}) as Record<string, unknown>;
  const f = (r.footer && typeof r.footer === "object" ? r.footer : {}) as Record<string, unknown>;
  const links = (v: unknown, cap = 30) =>
    (Array.isArray(v) ? v : []).map(sanitizeSiteLink).filter((x): x is SiteLink => !!x).slice(0, cap);

  const columns = (Array.isArray(f.columns) ? f.columns : [])
    .filter((c): c is Record<string, unknown> => !!c && typeof c === "object")
    .slice(0, 6)
    .map((c) => ({
      id: typeof c.id === "string" && c.id ? c.id.slice(0, 40) : uid("col"),
      title: typeof c.title === "string" ? c.title.trim().slice(0, 40) : "",
      links: links(c.links),
    }));

  return {
    header: {
      links: links(h.links, 12),
      showLogin: h.showLogin !== false,
      ctaText: typeof h.ctaText === "string" ? h.ctaText.trim().slice(0, 40) : "",
      ctaHref: safeHref(h.ctaHref),
    },
    footer: {
      tagline: typeof f.tagline === "string" ? f.tagline.slice(0, 160) : d.footer!.tagline,
      copyright: typeof f.copyright === "string" ? f.copyright.slice(0, 300) : d.footer!.copyright,
      showLogin: f.showLogin !== false,
      columns: columns.length ? columns : d.footer!.columns,
    },
  };
}

/** Replace {year} in the copyright line with the current year. */
export function renderCopyright(text: string | undefined): string {
  return (text ?? "").replace(/\{year\}/gi, String(new Date().getFullYear()));
}

/** The footer columns an admin left switched on, with their disabled links dropped. */
export function visibleFooterColumns(nav: SiteNav | undefined): FooterColumn[] {
  const cols = nav?.footer?.columns ?? defaultSiteNav().footer!.columns!;
  return cols
    .map((c) => ({ ...c, links: c.links.filter((l) => l.enabled !== false) }))
    .filter((c) => c.links.length > 0);
}

export function visibleHeaderLinks(nav: SiteNav | undefined): SiteLink[] {
  return (nav?.header?.links ?? []).filter((l) => l.enabled !== false);
}

export const newSiteLink = (): SiteLink => ({ id: uid("ln"), label: "New link", href: "/", enabled: true });
export const newFooterColumn = (): FooterColumn => ({ id: uid("col"), title: "Section", links: [newSiteLink()] });
