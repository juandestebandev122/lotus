"use client";

import { useEffect, useMemo, useState } from "react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import { useConfig, saveConfig } from "@/lib/config";
import { cn } from "@/lib/cn";
import { APP_SECTIONS } from "@/lib/app-pages";
import { allPagesTileKey, type AllPagesConfig, type AllPagesCustomTile } from "@/lib/all-pages-config";
import { newCustomPage, customPageHref } from "@/lib/custom-pages";
import { lbl, pageLabelKey } from "@/lib/labels";
import { useRouter } from "next/navigation";
import { LayoutGrid, Eye, EyeOff, RotateCcw, Loader2, Save, ArrowUp, ArrowDown, ExternalLink, FilePlus, FileText, Trash2 } from "lucide-react";

/**
 * ADMIN CONTROL FOR THE "ALL PAGES" DIRECTORY.
 *
 * The directory used to be purely user-side: it listed whatever the catalog held
 * and the only lever was Feature Management. This page hands the admin the whole
 * thing — switch the screen on or off, rename its heading, choose which parts of
 * it appear, and show/hide/reorder every section and every tile inside it.
 *
 * Anything the admin does NOT touch keeps its built-in behaviour, so an untouched
 * install looks exactly as it did before.
 */
export default function AllPagesAdminPage() {
  const { config, reload } = useConfig();
  const { toast } = useToast();
  const router = useRouter();

  const [ap, setAp] = useState<AllPagesConfig>({});
  const [saving, setSaving] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (loaded) return;
    setAp(config.allPages ?? {});
    setLoaded(true);
  }, [config.allPages, loaded]);

  const on = ap.enabled !== false;
  const set = <K extends keyof AllPagesConfig>(k: K, v: AllPagesConfig[K]) => setAp((p) => ({ ...p, [k]: v }));

  const sectionRule = (key: string) => ap.sections?.[key] ?? {};
  const tileRule = (key: string) => ap.pages?.[key] ?? {};

  const setSectionRule = (key: string, patch: { hidden?: boolean; order?: number }) =>
    setAp((p) => ({ ...p, sections: { ...(p.sections ?? {}), [key]: { ...(p.sections?.[key] ?? {}), ...patch } } }));
  const setTileRule = (key: string, patch: { hidden?: boolean; order?: number }) =>
    setAp((p) => ({ ...p, pages: { ...(p.pages ?? {}), [key]: { ...(p.pages?.[key] ?? {}), ...patch } } }));

  // Sections in the order members will actually see them.
  const ordered = useMemo(() => {
    return APP_SECTIONS
      .map((s, i) => ({ s, i, order: ap.sections?.[s.key]?.order }))
      .sort((a, b) => (a.order ?? a.i + 1000) - (b.order ?? b.i + 1000) || a.i - b.i)
      .map((x) => x.s);
  }, [ap.sections]);

  /** Move a section one place up or down by rewriting every section's order. */
  const moveSection = (key: string, dir: -1 | 1) => {
    const list = ordered.map((s) => s.key);
    const at = list.indexOf(key);
    const to = at + dir;
    if (at < 0 || to < 0 || to >= list.length) return;
    [list[at], list[to]] = [list[to], list[at]];
    setAp((p) => {
      const sections = { ...(p.sections ?? {}) };
      list.forEach((k, i) => { sections[k] = { ...(sections[k] ?? {}), order: i }; });
      return { ...p, sections };
    });
  };

  // ---- EDIT (renames go through the label system, same as Text & Labels) ----
  const [labels, setLabels] = useState<Record<string, string>>({});
  useEffect(() => { if (loaded) setLabels({ ...(config.labels ?? {}) }); }, [loaded, config.labels]);
  const setLabel = (key: string, value: string) => setLabels((l) => ({ ...l, [key]: value }));

  // ---- ADMIN-ADDED TILES ----
  const tilesFor = (section: string) => (ap.customTiles ?? []).filter((t) => t.section === section);
  const patchTile = (id: string, p: Partial<AllPagesCustomTile>) =>
    setAp((s) => ({ ...s, customTiles: (s.customTiles ?? []).map((t) => (t.id === id ? { ...t, ...p } : t)) }));
  const deleteTile = (t: AllPagesCustomTile) => {
    if (!window.confirm(`Remove “${t.label}” from this directory?\n\nThe page itself stays — delete it in Content Pages if you want it gone for good.`)) return;
    setAp((s) => ({ ...s, customTiles: (s.customTiles ?? []).filter((x) => x.id !== t.id) }));
    toast("Tile removed — press Save to apply.", "info");
  };

  const save = async () => {
    setSaving(true);
    const res = await saveConfig({ allPages: ap, labels });
    setSaving(false);
    if (res.ok) { toast("All Pages settings saved", "success"); void reload(); }
    else toast(res.error ?? "Could not save", "error");
  };

  /**
   * ADD CONTENT — creates a real page AND the tile that opens it, then saves
   * immediately so nothing is lost when the admin walks off to write it.
   */
  const addContentTo = async (sectionKey: string, sectionTitle: string) => {
    const title = window.prompt(`New page in “${sectionTitle}” — what is it called?`, "New page");
    if (title === null) return;
    const clean = title.trim() || "New page";
    const existing = config.customPages ?? [];
    const page = newCustomPage(existing, clean);
    const tile: AllPagesCustomTile = {
      id: `t_${Math.random().toString(36).slice(2, 9)}`,
      section: sectionKey,
      label: clean,
      desc: "Read more",
      href: customPageHref(page),
    };
    const nextAp: AllPagesConfig = { ...ap, customTiles: [...(ap.customTiles ?? []), tile] };
    setAp(nextAp);

    setSaving(true);
    const res = await saveConfig({ allPages: nextAp, labels, customPages: [...existing, page] });
    setSaving(false);
    if (res.ok) {
      void reload();
      toast(`“${clean}” created and added to ${sectionTitle}. Opening the editor…`, "success");
      router.push("/admin/content-pages");
    } else {
      toast(res.error ?? "Could not create the page", "error");
    }
  };

  const resetAll = () => {
    // State EVERY field explicitly. The config API reads a missing key as "leave
    // it alone", so a reset that merely dropped the keys was saved as "change
    // nothing" — the display toggles came back exactly as they were. Spelling
    // them out is what makes Reset actually reset.
    setAp({
      enabled: ap.enabled,
      title: "",
      subtitle: "",
      showSearch: true,
      showJumpLinks: true,
      showCounts: true,
      showDescriptions: true,
      showFooterNote: true,
      sections: {},
      pages: {},
      customTiles: [],
    });
    toast("Layout reset to defaults — press Save to apply", "info");
  };

  const hiddenSections = ordered.filter((s) => sectionRule(s.key).hidden).length;
  const hiddenTiles = Object.values(ap.pages ?? {}).filter((r) => r.hidden).length;

  return (
    <div className="mx-auto max-w-5xl space-y-5">
      {/* ===== Header ===== */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="flex items-center gap-2 font-display text-2xl font-extrabold text-mist-100">
            <LayoutGrid className="size-6 text-lotus-300" /> All Pages
          </h1>
          <p className="mt-1 max-w-2xl text-sm text-mist-400">
            Full admin control over the members&rsquo; <b className="text-mist-200">All Pages</b> directory —
            switch the whole screen on or off, rename its heading, choose which parts show, and
            show, hide or reorder every section and tile inside it.
          </p>
        </div>
        <div className="flex shrink-0 flex-wrap gap-2">
          <a href="/all-pages" target="_blank" rel="noopener noreferrer">
            <Button variant="secondary"><ExternalLink className="size-4" /> View as member</Button>
          </a>
          <Button variant="secondary" onClick={resetAll}><RotateCcw className="size-4" /> Reset layout</Button>
          <Button onClick={save} disabled={saving}>
            {saving ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />} Save
          </Button>
        </div>
      </div>

      {/* ===== Master switch ===== */}
      <Card className="p-4">
        <label className="flex cursor-pointer items-start gap-3">
          <input type="checkbox" checked={on} onChange={(e) => set("enabled", e.target.checked)} className="mt-0.5 size-4 accent-[var(--color-lotus-500)]" />
          <span className="min-w-0">
            <span className="block text-sm font-bold text-mist-100">Show the All Pages directory to members</span>
            <span className="mt-0.5 block text-xs text-mist-400">
              When off, the page is closed and its entries disappear from the sidebar, the phone
              bottom bar and the More Options list. Nothing else in the app changes — every screen
              stays reachable from its own menu entry.
            </span>
          </span>
        </label>
      </Card>

      {!on && (
        <div className="rounded-xl border border-amber-400/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
          The directory is switched <b>off</b>. The settings below are kept and take effect again the moment you switch it back on.
        </div>
      )}

      {/* ===== Screen settings ===== */}
      <Card className="p-4">
        <h2 className="text-sm font-bold text-mist-100">Screen settings</h2>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <label className="block">
            <span className="mb-1 block text-xs font-semibold text-mist-300">Heading</span>
            <input
              value={ap.title ?? ""}
              onChange={(e) => set("title", e.target.value)}
              placeholder="All Pages (default)"
              className="h-10 w-full rounded-lg border border-line bg-ink-800 px-3 text-sm text-mist-100 outline-none focus:border-lotus-400/50"
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-semibold text-mist-300">Description under the heading</span>
            <input
              value={ap.subtitle ?? ""}
              onChange={(e) => set("subtitle", e.target.value)}
              placeholder="Every screen you can open, organised by section (default)"
              className="h-10 w-full rounded-lg border border-line bg-ink-800 px-3 text-sm text-mist-100 outline-none focus:border-lotus-400/50"
            />
          </label>
        </div>
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          <Toggle label="Search box" desc="Let members search the directory." on={ap.showSearch !== false} onToggle={() => set("showSearch", ap.showSearch === false)} />
          <Toggle label="Jump-to-section chips" desc="The row of section shortcuts at the top." on={ap.showJumpLinks !== false} onToggle={() => set("showJumpLinks", ap.showJumpLinks === false)} />
          <Toggle label="Page counts" desc="The little number badge on each section." on={ap.showCounts !== false} onToggle={() => set("showCounts", ap.showCounts === false)} />
          <Toggle label="Tile descriptions" desc="The one-line explanation under each tile's name." on={ap.showDescriptions !== false} onToggle={() => set("showDescriptions", ap.showDescriptions === false)} />
          <Toggle label="Closing note" desc="The footer line about pages this account can't open." on={ap.showFooterNote !== false} onToggle={() => set("showFooterNote", ap.showFooterNote === false)} />
        </div>
      </Card>

      {/* ===== Sections & tiles ===== */}
      <Card className="p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-sm font-bold text-mist-100">Sections &amp; tiles</h2>
            <p className="mt-0.5 text-xs text-mist-400">
              Show, hide and reorder what members see. Hidden right now:{" "}
              <b className="text-mist-200">{hiddenSections} section{hiddenSections === 1 ? "" : "s"}</b> and{" "}
              <b className="text-mist-200">{hiddenTiles} tile{hiddenTiles === 1 ? "" : "s"}</b>.
            </p>
          </div>
        </div>

        <div className="mt-3 space-y-3">
          {ordered.map((s, idx) => {
            const sr = sectionRule(s.key);
            const sHidden = sr.hidden === true;
            return (
              <div key={s.key} className={cn("rounded-xl border border-line bg-ink-900 p-3", sHidden && "opacity-60")}>
                <div className="flex flex-wrap items-center gap-2">
                  <s.icon className="size-[18px] shrink-0 text-lotus-300" />
                  {/* EDIT the section's heading — saved as a label override, the
                      same mechanism Text & Labels uses, so nothing is duplicated. */}
                  <input
                    value={lbl(labels, `page.${s.key}.__title`, s.title)}
                    onChange={(e) => setLabel(`page.${s.key}.__title`, e.target.value)}
                    className="h-8 min-w-0 flex-1 rounded-lg border border-line bg-ink-800 px-2 text-sm font-bold text-mist-100 outline-none focus:border-lotus-400/50"
                  />
                  <span className="rounded-full bg-white/[0.06] px-2 py-0.5 text-[10px] font-semibold text-mist-400">{s.pages.length + tilesFor(s.key).length}</span>
                  <button onClick={() => addContentTo(s.key, lbl(labels, `page.${s.key}.__title`, s.title))} title="Create a page and add it to this section" className="inline-flex h-8 items-center gap-1 rounded-lg bg-lotus-500/15 px-2.5 text-[11px] font-bold text-lotus-200 hover:bg-lotus-500/25">
                    <FilePlus className="size-3.5" /> Add Content
                  </button>
                  <button onClick={() => moveSection(s.key, -1)} disabled={idx === 0} title="Move up" className="grid size-8 place-items-center rounded-lg border border-line bg-ink-800 text-mist-300 hover:text-mist-100 disabled:opacity-40"><ArrowUp className="size-4" /></button>
                  <button onClick={() => moveSection(s.key, 1)} disabled={idx === ordered.length - 1} title="Move down" className="grid size-8 place-items-center rounded-lg border border-line bg-ink-800 text-mist-300 hover:text-mist-100 disabled:opacity-40"><ArrowDown className="size-4" /></button>
                  <button
                    onClick={() => setSectionRule(s.key, { hidden: !sHidden })}
                    className={cn(
                      "inline-flex h-8 items-center gap-1.5 rounded-lg border px-2.5 text-[11px] font-semibold",
                      sHidden ? "border-rose-400/40 bg-rose-500/10 text-rose-200" : "border-line bg-ink-800 text-mist-300 hover:text-mist-100",
                    )}
                  >
                    {sHidden ? <><EyeOff className="size-3.5" /> Hidden</> : <><Eye className="size-3.5" /> Visible</>}
                  </button>
                </div>

                {/* Tiles inside this section */}
                <div className="mt-2.5 grid gap-1.5 sm:grid-cols-2">
                  {s.pages.map((p) => {
                    const key = allPagesTileKey(s.key, p.label);
                    const hidden = tileRule(key).hidden === true;
                    return (
                      <div key={key} className={cn("flex items-center gap-2 rounded-lg border border-line bg-ink-800 px-2.5 py-2", hidden && "opacity-55")}>
                        <p.icon className="size-4 shrink-0 text-mist-400" />
                        <span className="min-w-0 flex-1">
                          {/* EDIT the tile's name and its one-line description. */}
                          <input
                            value={lbl(labels, pageLabelKey(s.key, p.label), p.label)}
                            onChange={(e) => setLabel(pageLabelKey(s.key, p.label), e.target.value)}
                            className="h-6 w-full rounded border border-transparent bg-transparent px-1 text-xs font-semibold text-mist-100 outline-none hover:border-line focus:border-lotus-400/50 focus:bg-ink-900"
                          />
                          <input
                            value={lbl(labels, pageLabelKey(s.key, p.label, "desc"), p.desc)}
                            onChange={(e) => setLabel(pageLabelKey(s.key, p.label, "desc"), e.target.value)}
                            className="h-5 w-full rounded border border-transparent bg-transparent px-1 text-[10px] text-mist-500 outline-none hover:border-line focus:border-lotus-400/50 focus:bg-ink-900"
                          />
                          <span className="block truncate px-1 font-mono text-[9px] text-mist-600">{p.href}</span>
                        </span>
                        <a href={p.href} target="_blank" rel="noopener noreferrer" title="View this screen" className="grid size-7 shrink-0 place-items-center rounded-lg border border-line bg-ink-900 text-mist-400 hover:text-mist-100"><ExternalLink className="size-3.5" /></a>
                        <button
                          onClick={() => setTileRule(key, { hidden: !hidden })}
                          title={hidden ? "Show this tile" : "Hide this tile (built-in screens can be hidden, not deleted)"}
                          className={cn(
                            "grid size-7 shrink-0 place-items-center rounded-lg border",
                            hidden ? "border-rose-400/40 bg-rose-500/10 text-rose-200" : "border-line bg-ink-900 text-mist-300 hover:text-mist-100",
                          )}
                        >
                          {hidden ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
                        </button>
                      </div>
                    );
                  })}

                  {/* ADMIN-ADDED TILES — fully editable and deletable, unlike the
                      app's own screens above (which can only be hidden). */}
                  {tilesFor(s.key).map((t) => (
                    <div key={t.id} className={cn("flex items-center gap-2 rounded-lg border border-lotus-400/40 bg-lotus-500/[0.07] px-2.5 py-2", t.hidden && "opacity-55")}>
                      <FileText className="size-4 shrink-0 text-lotus-300" />
                      <span className="min-w-0 flex-1">
                        <input
                          value={t.label}
                          onChange={(e) => patchTile(t.id, { label: e.target.value })}
                          className="h-6 w-full rounded border border-transparent bg-transparent px-1 text-xs font-semibold text-mist-100 outline-none hover:border-line focus:border-lotus-400/50 focus:bg-ink-900"
                        />
                        <input
                          value={t.desc ?? ""}
                          onChange={(e) => patchTile(t.id, { desc: e.target.value })}
                          placeholder="One-line description"
                          className="h-5 w-full rounded border border-transparent bg-transparent px-1 text-[10px] text-mist-500 outline-none hover:border-line focus:border-lotus-400/50 focus:bg-ink-900"
                        />
                        <input
                          value={t.href}
                          onChange={(e) => patchTile(t.id, { href: e.target.value })}
                          className="h-5 w-full rounded border border-transparent bg-transparent px-1 font-mono text-[9px] text-mist-600 outline-none hover:border-line focus:border-lotus-400/50 focus:bg-ink-900"
                        />
                      </span>
                      <a href={t.href} target="_blank" rel="noopener noreferrer" title="View" className="grid size-7 shrink-0 place-items-center rounded-lg border border-line bg-ink-900 text-mist-400 hover:text-mist-100"><ExternalLink className="size-3.5" /></a>
                      <button onClick={() => patchTile(t.id, { hidden: !t.hidden })} title={t.hidden ? "Show" : "Hide"} className={cn("grid size-7 shrink-0 place-items-center rounded-lg border", t.hidden ? "border-rose-400/40 bg-rose-500/10 text-rose-200" : "border-line bg-ink-900 text-mist-300 hover:text-mist-100")}>
                        {t.hidden ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
                      </button>
                      <button onClick={() => deleteTile(t)} title="Delete this tile" className="grid size-7 shrink-0 place-items-center rounded-lg border border-rose-400/40 bg-rose-500/10 text-rose-300 hover:bg-rose-500/20"><Trash2 className="size-3.5" /></button>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>

        <p className="mt-3 text-[11px] text-mist-500">
          Modules switched off in <b className="text-mist-400">Feature Management</b> are already removed from
          this directory for members — these controls are for everything that is still switched on.
        </p>
      </Card>

      <Card className="flex flex-wrap items-center justify-end gap-2 p-4">
        <Button variant="secondary" onClick={resetAll}><RotateCcw className="size-4" /> Reset layout</Button>
        <Button onClick={save} disabled={saving}>
          {saving ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />} Save
        </Button>
      </Card>
    </div>
  );
}

function Toggle({ label, desc, on, onToggle }: { label: string; desc: string; on: boolean; onToggle: () => void }) {
  return (
    <label className="flex cursor-pointer items-start gap-2.5 rounded-lg border border-line bg-ink-800 px-3 py-2.5">
      <input type="checkbox" checked={on} onChange={onToggle} className="mt-0.5 size-4 accent-[var(--color-lotus-500)]" />
      <span className="min-w-0">
        <span className="block text-xs font-bold text-mist-100">{label}</span>
        <span className="mt-0.5 block text-[11px] text-mist-400">{desc}</span>
      </span>
    </label>
  );
}
