"use client";

import { useEffect, useMemo, useState } from "react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import { useConfig, saveConfig } from "@/lib/config";
import { LABEL_DEFS, pageLabelKey, type LabelDef } from "@/lib/labels";
import { APP_SECTIONS } from "@/lib/app-pages";
import { cn } from "@/lib/cn";
import { Type, Check, RotateCcw, Search } from "lucide-react";

const field = "rounded-lg border border-line bg-ink-900 px-3 py-2 text-sm text-mist-100 outline-none focus:border-lotus-400";

export default function AdminLabelsPage() {
  const { config, loading, reload } = useConfig();
  const { toast } = useToast();
  const [labels, setLabels] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [q, setQ] = useState("");

  useEffect(() => { setLabels({ ...(config.labels ?? {}) }); }, [config.labels]);

  // Every tile in the All Pages directory (title + description) plus each
  // section heading, generated from the real page list so this editor always
  // matches what users actually see — no hand-maintained duplicate.
  const allDefs = useMemo(() => {
    const gen: LabelDef[] = [];
    for (const s of APP_SECTIONS) {
      const section = `App page: ${s.title}`;
      gen.push({ section, key: `page.${s.key}.__title`, default: s.title, hint: "Section heading in All Pages" });
      gen.push({ section, key: `page.${s.key}.__blurb`, default: s.blurb, hint: "Section description" });
      for (const p of s.pages) {
        gen.push({ section, key: pageLabelKey(s.key, p.label), default: p.label });
        gen.push({ section, key: pageLabelKey(s.key, p.label, "desc"), default: p.desc, hint: "Description under the title" });
      }
    }
    // Drop any duplicate keys (two tiles in one section sharing a title).
    const seen = new Set<string>();
    return [...LABEL_DEFS, ...gen].filter((d) => (seen.has(d.key) ? false : (seen.add(d.key), true)));
  }, []);

  const sections = useMemo(() => {
    const term = q.trim().toLowerCase();
    const bySection = new Map<string, LabelDef[]>();
    for (const def of allDefs) {
      if (term && !`${def.default} ${def.key} ${def.section}`.toLowerCase().includes(term)) continue;
      (bySection.get(def.section) ?? bySection.set(def.section, []).get(def.section)!).push(def);
    }
    return [...bySection.entries()];
  }, [q, allDefs]);

  const overrideCount = Object.values(labels).filter((v) => v && v.trim()).length;

  const set = (key: string, v: string) => setLabels((l) => ({ ...l, [key]: v }));
  const resetOne = (key: string) => setLabels((l) => { const n = { ...l }; delete n[key]; return n; });

  const save = async () => {
    setSaving(true);
    const clean: Record<string, string> = {};
    for (const [k, v] of Object.entries(labels)) if (v && v.trim()) clean[k] = v.trim();
    const res = await saveConfig({ labels: clean });
    setSaving(false);
    if (res.ok) { await reload(); toast("Text labels saved — the changes are now live in the app", "success"); }
    else toast(res.error ?? "Could not save", "error");
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 font-display text-2xl font-extrabold text-mist-100"><Type className="size-6 text-lotus-300" /> Text &amp; Labels</h1>
          <p className="mt-1 text-sm text-mist-400">Rename any of the app&apos;s text labels — every menu entry, every page name and every page description. Leave a box empty to keep the default (shown faintly). {allDefs.length} labels available. {overrideCount > 0 && <span className="text-mist-300">{overrideCount} custom label{overrideCount === 1 ? "" : "s"} set.</span>}</p>
        </div>
        <Button onClick={save} disabled={saving || loading}><Check className="size-4" /> {saving ? "Saving…" : "Save changes"}</Button>
      </div>

      <div className="flex items-center gap-2 rounded-xl border border-line bg-ink-900 px-3">
        <Search className="size-4 text-mist-500" />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search a label (e.g. Home, Voice Rooms, Play games)…" className="w-full bg-transparent py-2.5 text-sm text-mist-100 outline-none" />
      </div>

      {sections.map(([section, defs]) => (
        <Card key={section} className="p-5">
          <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-mist-400">{section}</h2>
          <div className="space-y-2.5">
            {defs.map((def) => {
              const cur = labels[def.key] ?? "";
              const changed = !!cur.trim() && cur.trim() !== def.default;
              return (
                <div key={def.key} className="grid grid-cols-1 gap-1.5 sm:grid-cols-[180px_1fr] sm:items-center">
                  <div className="min-w-0">
                    <div className="truncate text-sm font-semibold text-mist-200" title={def.default}>{def.default}</div>
                    {def.hint && <div className="text-[11px] text-mist-500">{def.hint}</div>}
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      value={cur}
                      onChange={(e) => set(def.key, e.target.value)}
                      placeholder={def.default}
                      className={cn(field, "w-full", changed && "border-lotus-400/50")}
                    />
                    {cur.trim() && (
                      <button onClick={() => resetOne(def.key)} title="Reset to default" className="grid size-9 shrink-0 place-items-center rounded-lg text-mist-400 hover:bg-white/[0.06] hover:text-mist-100"><RotateCcw className="size-4" /></button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      ))}

      {sections.length === 0 && <Card className="p-10 text-center text-sm text-mist-500">No labels match your search.</Card>}

      <div className="flex justify-end">
        <Button size="lg" onClick={save} disabled={saving || loading}><Check className="size-4" /> {saving ? "Saving…" : "Save changes"}</Button>
      </div>
    </div>
  );
}
