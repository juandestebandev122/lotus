"use client";

import { useEffect, useRef, useState } from "react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import { useConfig, saveConfig } from "@/lib/config";
import { cn } from "@/lib/cn";
import { NAV_ITEMS } from "@/components/app-shell/nav-items";
import {
  defaultSiteNav, newSiteLink, newFooterColumn,
  type SiteNav, type SiteLink, type FooterColumn,
} from "@/lib/site-nav";
import {
  PanelTop, PanelBottom, Menu as MenuIcon, Plus, Trash2, Check, ArrowUp, ArrowDown,
  Eye, EyeOff, Info, RotateCcw, CornerDownRight, FilePlus,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { newCustomPage, customPageHref, type CustomPage } from "@/lib/custom-pages";

// ---------------------------------------------------------------------------
// ADMIN → NAVIGATION
// Headers, footers, menus and submenus, all editable here:
//   • Public HEADER  — extra links, the Log-in action and the main button.
//   • Public FOOTER  — tagline, link columns and the copyright line.
//   • App MENU       — submenus (child links) under any sidebar item.
// Navigation only: this changes what links exist and what they're called, never
// what a page does or who is allowed to open it.
// ---------------------------------------------------------------------------

type SubMenus = Record<string, { label: string; href: string }[]>;
const inp = "h-9 w-full rounded-lg border border-line bg-ink-900 px-2.5 text-sm text-mist-100 outline-none focus:border-lotus-400";

export default function AdminNavigationPage() {
  const { config, reload, loading } = useConfig();
  const { toast } = useToast();
  const router = useRouter();
  const [nav, setNav] = useState<SiteNav>(defaultSiteNav());
  const [subs, setSubs] = useState<SubMenus>({});
  const [saving, setSaving] = useState(false);
  const seeded = useRef(false);

  useEffect(() => {
    if (loading || seeded.current) return;
    seeded.current = true;
    const d = defaultSiteNav();
    const c = config.siteNav ?? d;
    setNav({
      header: { ...d.header, ...(c.header ?? {}) },
      footer: { ...d.footer, ...(c.footer ?? {}), columns: c.footer?.columns?.length ? c.footer.columns : d.footer!.columns },
    });
    setSubs({ ...(config.menuLayout?.submenus ?? {}) });
  }, [loading, config.siteNav, config.menuLayout?.submenus]);

  const save = async () => {
    setSaving(true);
    const res = await saveConfig({
      siteNav: nav,
      menuLayout: { ...(config.menuLayout ?? {}), submenus: subs },
      ...(pages !== null ? { customPages: pages } : {}),
    });
    setSaving(false);
    if (res.ok) { await reload(); toast("Navigation saved — live on every page.", "success"); }
    else toast(res.error ?? "Could not save", "error");
  };

  // ---- ADD CONTENT ---------------------------------------------------------
  // Creates a real content page AND the menu link that opens it, in one action,
  // then saves both immediately so the admin can go and write it. `pages` stays
  // null until something is actually added, so a plain navigation save never
  // touches the content pages.
  const [pages, setPages] = useState<CustomPage[] | null>(null);
  const addContentUnder = async (parentHref: string, parentLabel: string) => {
    const title = window.prompt(`New page under “${parentLabel}” — what is it called?`, "New page");
    if (title === null) return;
    const clean = title.trim() || "New page";
    const list = pages ?? config.customPages ?? [];
    const page = newCustomPage(list, clean);
    const nextPages = [...list, page];
    const nextSubs: SubMenus = { ...subs, [parentHref]: [...(subs[parentHref] ?? []), { label: clean, href: customPageHref(page) }] };
    setPages(nextPages);
    setSubs(nextSubs);

    // Save straight away — a page that exists only in this tab would be lost if
    // the admin navigated to the editor before pressing Save.
    setSaving(true);
    const res = await saveConfig({
      siteNav: nav,
      menuLayout: { ...(config.menuLayout ?? {}), submenus: nextSubs },
      customPages: nextPages,
    });
    setSaving(false);
    if (res.ok) {
      await reload();
      toast(`“${clean}” created and linked under ${parentLabel}. Opening the editor…`, "success");
      router.push("/admin/content-pages");
    } else {
      toast(res.error ?? "Could not create the page", "error");
    }
  };

  /** Add Content from a FOOTER section — creates the page and the footer link. */
  const addContentToFooter = async (colIndex: number, colTitle: string) => {
    const title = window.prompt(`New page in the “${colTitle}” footer section — what is it called?`, "New page");
    if (title === null) return;
    const clean = title.trim() || "New page";
    const list = pages ?? config.customPages ?? [];
    const page = newCustomPage(list, clean);
    const nextPages = [...list, page];
    const nextCols = cols.map((c, i) => (i === colIndex ? { ...c, links: [...c.links, { ...newSiteLink(), label: clean, href: customPageHref(page) }] } : c));
    const nextNav: SiteNav = { ...nav, footer: { ...nav.footer, columns: nextCols } };
    setPages(nextPages);
    setNav(nextNav);

    setSaving(true);
    const res = await saveConfig({
      siteNav: nextNav,
      menuLayout: { ...(config.menuLayout ?? {}), submenus: subs },
      customPages: nextPages,
    });
    setSaving(false);
    if (res.ok) {
      await reload();
      toast(`“${clean}” created and linked in the footer. Opening the editor…`, "success");
      router.push("/admin/content-pages");
    } else {
      toast(res.error ?? "Could not create the page", "error");
    }
  };

  // ---- footer helpers ------------------------------------------------------
  const cols = nav.footer?.columns ?? [];
  const setCols = (next: FooterColumn[]) => setNav((s) => ({ ...s, footer: { ...s.footer, columns: next } }));
  const setCol = (ci: number, patch: Partial<FooterColumn>) => setCols(cols.map((c, i) => (i === ci ? { ...c, ...patch } : c)));
  const setLink = (ci: number, li: number, patch: Partial<SiteLink>) =>
    setCol(ci, { links: cols[ci].links.map((l, i) => (i === li ? { ...l, ...patch } : l)) });
  const moveLink = (ci: number, li: number, dir: -1 | 1) => {
    const links = [...cols[ci].links];
    const to = li + dir;
    if (to < 0 || to >= links.length) return;
    [links[li], links[to]] = [links[to], links[li]];
    setCol(ci, { links });
  };

  // ---- header helpers ------------------------------------------------------
  const hLinks = nav.header?.links ?? [];
  const setHeader = (patch: Partial<NonNullable<SiteNav["header"]>>) => setNav((s) => ({ ...s, header: { ...s.header, ...patch } }));

  return (
    <div className="space-y-5 pb-24">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="flex items-center gap-2 font-display text-2xl font-extrabold text-mist-100">
            <MenuIcon className="size-6 text-lotus-300" /> Navigation
          </h1>
          <p className="max-w-3xl text-sm text-mist-400">
            Manage the site&apos;s <b className="text-mist-200">header</b>, <b className="text-mist-200">footer</b> and the app&apos;s
            <b className="text-mist-200"> menus &amp; submenus</b> — rename, reorder, add, remove or hide any link, with no code change.
          </p>
        </div>
        <Button onClick={save} disabled={saving}><Check className="size-4" /> {saving ? "Saving…" : "Save navigation"}</Button>
      </div>

      <div className="flex items-start gap-2 rounded-xl border border-sky-400/25 bg-sky-500/[0.06] px-4 py-3 text-xs text-mist-300">
        <Info className="mt-0.5 size-4 shrink-0 text-sky-300" />
        <p>
          <b className="text-mist-100">Links only.</b> This page decides which links exist and what they are called. It never changes
          what a page does, and it can&apos;t give anyone access they don&apos;t already have — each page still checks permissions itself.
          Only internal paths and normal web/email/phone addresses are accepted.
        </p>
      </div>

      {/* ---------------- PUBLIC HEADER ---------------- */}
      <Card className="p-4 sm:p-5">
        <h2 className="flex items-center gap-2 font-display text-lg font-bold text-mist-100"><PanelTop className="size-5 text-lotus-300" /> Public header</h2>
        <p className="mt-0.5 text-sm text-mist-400">The top bar of the public website (home, About, Blog, FAQ and the legal pages).</p>

        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <label className="block">
            <span className="mb-1 block text-xs font-semibold text-mist-300">Main button text</span>
            <input value={nav.header?.ctaText ?? ""} onChange={(e) => setHeader({ ctaText: e.target.value })} placeholder="Get started" className={inp} />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-semibold text-mist-300">Main button link</span>
            <input value={nav.header?.ctaHref ?? ""} onChange={(e) => setHeader({ ctaHref: e.target.value })} placeholder="/login" className={inp} />
          </label>
        </div>
        <label className="mt-3 flex items-center gap-2 text-sm text-mist-300">
          <input type="checkbox" checked={nav.header?.showLogin !== false} onChange={(e) => setHeader({ showLogin: e.target.checked })} className="size-4 accent-lotus-500" />
          Show the &ldquo;Log in&rdquo; link in the header
        </label>

        <div className="mt-4">
          <div className="mb-2 flex items-center justify-between">
            <p className="text-xs font-semibold uppercase tracking-wide text-mist-400">Extra header links</p>
            <button onClick={() => setHeader({ links: [...hLinks, newSiteLink()] })} className="inline-flex items-center gap-1 text-xs font-semibold text-lotus-300 hover:text-lotus-200"><Plus className="size-3.5" /> Add link</button>
          </div>
          <LinkRows
            links={hLinks}
            onChange={(li, patch) => setHeader({ links: hLinks.map((l, i) => (i === li ? { ...l, ...patch } : l)) })}
            onRemove={(li) => setHeader({ links: hLinks.filter((_, i) => i !== li) })}
            onMove={(li, dir) => {
              const next = [...hLinks]; const to = li + dir;
              if (to < 0 || to >= next.length) return;
              [next[li], next[to]] = [next[to], next[li]];
              setHeader({ links: next });
            }}
            empty="No extra header links. The built-in Features / Games / Tournaments anchors always show."
          />
        </div>
      </Card>

      {/* ---------------- PUBLIC FOOTER ---------------- */}
      <Card className="p-4 sm:p-5">
        <h2 className="flex items-center gap-2 font-display text-lg font-bold text-mist-100"><PanelBottom className="size-5 text-lotus-300" /> Public footer</h2>
        <p className="mt-0.5 text-sm text-mist-400">The links, tagline and copyright at the bottom of every public page.</p>

        <div className="mt-4 grid gap-3">
          <label className="block">
            <span className="mb-1 block text-xs font-semibold text-mist-300">Tagline (beside the logo)</span>
            <input value={nav.footer?.tagline ?? ""} onChange={(e) => setNav((s) => ({ ...s, footer: { ...s.footer, tagline: e.target.value } }))} className={inp} />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-semibold text-mist-300">Copyright line</span>
            <input value={nav.footer?.copyright ?? ""} onChange={(e) => setNav((s) => ({ ...s, footer: { ...s.footer, copyright: e.target.value } }))} className={inp} />
            <span className="mt-0.5 block text-[11px] text-mist-500">Write <code className="text-mist-300">{"{year}"}</code> and it becomes the current year automatically.</span>
          </label>
        </div>

        <div className="mt-4 space-y-4">
          {cols.map((col, ci) => (
            <div key={col.id} className="rounded-xl border border-line bg-ink-900/40 p-3">
              <div className="mb-2 flex flex-wrap items-center gap-2">
                <input
                  value={col.title}
                  onChange={(e) => setCol(ci, { title: e.target.value })}
                  placeholder="Section title (leave blank for one plain row)"
                  className={cn(inp, "max-w-xs")}
                />
                {/* Same one-step "create the page AND link it" action as the app
                    menu, so a footer section can carry new content too. */}
                <button onClick={() => addContentToFooter(ci, col.title || "Footer")} className="inline-flex items-center gap-1 rounded-lg bg-lotus-500/15 px-2.5 py-1 text-xs font-bold text-lotus-200 transition hover:bg-lotus-500/25" title="Create a new content page and link it here">
                  <FilePlus className="size-3.5" /> Add Content
                </button>
                <button onClick={() => setCol(ci, { links: [...col.links, newSiteLink()] })} className="inline-flex items-center gap-1 text-xs font-semibold text-lotus-300 hover:text-lotus-200"><Plus className="size-3.5" /> Add link</button>
                {cols.length > 1 && (
                  <button onClick={() => setCols(cols.filter((_, i) => i !== ci))} className="ml-auto inline-flex items-center gap-1 text-xs text-rose-300 hover:text-rose-200"><Trash2 className="size-3.5" /> Remove section</button>
                )}
              </div>
              <LinkRows
                links={col.links}
                onChange={(li, patch) => setLink(ci, li, patch)}
                onRemove={(li) => setCol(ci, { links: col.links.filter((_, i) => i !== li) })}
                onMove={(li, dir) => moveLink(ci, li, dir)}
                empty="No links in this section yet."
              />
            </div>
          ))}
          <div className="flex flex-wrap gap-4">
            <button onClick={() => setCols([...cols, newFooterColumn()])} className="inline-flex items-center gap-1.5 text-sm font-semibold text-lotus-300 hover:text-lotus-200"><Plus className="size-4" /> Add a footer section</button>
            <button onClick={() => setNav(defaultSiteNav())} className="inline-flex items-center gap-1.5 text-sm font-semibold text-mist-400 hover:text-mist-100"><RotateCcw className="size-4" /> Reset header &amp; footer to default</button>
          </div>
          <p className="text-[11px] text-mist-500">
            One untitled section shows as a single row of links (the current look). Two or more sections show as titled columns.
          </p>
        </div>
      </Card>

      {/* ---------------- APP MENUS & SUBMENUS ---------------- */}
      <Card className="p-4 sm:p-5">
        <h2 className="flex items-center gap-2 font-display text-lg font-bold text-mist-100"><MenuIcon className="size-5 text-lotus-300" /> App menu &amp; submenus</h2>
        <p className="mt-0.5 text-sm text-mist-400">
          Add child links under any sidebar item. To <b className="text-mist-200">reorder or hide</b> the main menu items, and to
          <b className="text-mist-200"> rename</b> them, use <b className="text-mist-200">Appearance &amp; Menu</b> and <b className="text-mist-200">Labels</b>.
        </p>

        <div className="mt-4 space-y-2">
          {NAV_ITEMS.map((item) => {
            const kids = subs[item.href] ?? [];
            return (
              <div key={item.href} className="rounded-xl border border-line bg-ink-900/40 p-3">
                <div className="flex flex-wrap items-center gap-2">
                  <item.icon className="size-4 shrink-0 text-lotus-300" />
                  <span className="text-sm font-semibold text-mist-100">{item.label}</span>
                  <span className="font-mono text-[10px] text-mist-500">{item.href}</span>
                  {/* ADD CONTENT — creates a real page AND the menu link to it in
                      one step. "Add sub-item" only ever made a link to something
                      that already existed, which is why there was no way to add
                      new content from here. */}
                  <button
                    onClick={() => addContentUnder(item.href, item.label)}
                    className="ml-auto inline-flex items-center gap-1 rounded-lg bg-lotus-500/15 px-2.5 py-1 text-xs font-bold text-lotus-200 transition hover:bg-lotus-500/25"
                    title="Create a new content page and link it here"
                  >
                    <FilePlus className="size-3.5" /> Add Content
                  </button>
                  <button
                    onClick={() => setSubs((s) => ({ ...s, [item.href]: [...kids, { label: "New sub-item", href: item.href }] }))}
                    className="inline-flex items-center gap-1 text-xs font-semibold text-lotus-300 hover:text-lotus-200"
                    title="Link to a screen that already exists"
                  >
                    <Plus className="size-3.5" /> Add sub-item
                  </button>
                </div>
                {kids.length > 0 && (
                  <div className="mt-2 space-y-1.5">
                    {kids.map((k, ki) => (
                      <div key={ki} className="flex flex-wrap items-center gap-2 pl-5">
                        <CornerDownRight className="size-3.5 shrink-0 text-mist-600" />
                        <input
                          value={k.label}
                          onChange={(e) => setSubs((s) => ({ ...s, [item.href]: kids.map((x, i) => (i === ki ? { ...x, label: e.target.value } : x)) }))}
                          placeholder="Label"
                          className={cn(inp, "max-w-[12rem]")}
                        />
                        <input
                          value={k.href}
                          onChange={(e) => setSubs((s) => ({ ...s, [item.href]: kids.map((x, i) => (i === ki ? { ...x, href: e.target.value } : x)) }))}
                          placeholder="/path"
                          className={cn(inp, "max-w-[14rem] font-mono text-xs")}
                        />
                        <button
                          onClick={() => setSubs((s) => {
                            const next = kids.filter((_, i) => i !== ki);
                            const out = { ...s };
                            if (next.length) out[item.href] = next; else delete out[item.href];
                            return out;
                          })}
                          className="grid size-8 place-items-center rounded-lg text-rose-300 hover:bg-rose-500/10"
                        >
                          <Trash2 className="size-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </Card>

      <div className="flex justify-end">
        <Button onClick={save} disabled={saving}><Check className="size-4" /> {saving ? "Saving…" : "Save navigation"}</Button>
      </div>
    </div>
  );
}

/** A reorderable list of links with label, address, show/hide and remove. */
function LinkRows({ links, onChange, onRemove, onMove, empty }: {
  links: SiteLink[];
  onChange: (i: number, patch: Partial<SiteLink>) => void;
  onRemove: (i: number) => void;
  onMove: (i: number, dir: -1 | 1) => void;
  empty: string;
}) {
  if (links.length === 0) return <p className="py-2 text-xs text-mist-500">{empty}</p>;
  return (
    <div className="space-y-1.5">
      {links.map((l, i) => (
        <div key={l.id} className={cn("flex flex-wrap items-center gap-2 rounded-lg border border-line bg-ink-900 px-2 py-1.5", l.enabled === false && "opacity-50")}>
          <input value={l.label} onChange={(e) => onChange(i, { label: e.target.value })} placeholder="Label" className={cn(inp, "max-w-[12rem] border-0 bg-transparent px-1")} />
          <input value={l.href} onChange={(e) => onChange(i, { href: e.target.value })} placeholder="/path or https://…" className={cn(inp, "max-w-[16rem] border-0 bg-transparent px-1 font-mono text-xs")} />
          <label className="flex items-center gap-1 text-[11px] text-mist-500">
            <input type="checkbox" checked={l.newTab === true} onChange={(e) => onChange(i, { newTab: e.target.checked })} className="size-3.5 accent-lotus-500" /> new tab
          </label>
          <div className="ml-auto flex items-center gap-0.5">
            <button onClick={() => onMove(i, -1)} title="Move up" className="grid size-7 place-items-center rounded-lg text-mist-500 hover:bg-white/10 hover:text-mist-100"><ArrowUp className="size-3.5" /></button>
            <button onClick={() => onMove(i, 1)} title="Move down" className="grid size-7 place-items-center rounded-lg text-mist-500 hover:bg-white/10 hover:text-mist-100"><ArrowDown className="size-3.5" /></button>
            <button
              onClick={() => onChange(i, { enabled: l.enabled === false })}
              title={l.enabled === false ? "Hidden — click to show" : "Shown — click to hide"}
              className="grid size-7 place-items-center rounded-lg text-mist-500 hover:bg-white/10 hover:text-mist-100"
            >
              {l.enabled === false ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
            </button>
            <button onClick={() => onRemove(i)} title="Remove" className="grid size-7 place-items-center rounded-lg text-rose-300 hover:bg-rose-500/10"><Trash2 className="size-3.5" /></button>
          </div>
        </div>
      ))}
    </div>
  );
}
