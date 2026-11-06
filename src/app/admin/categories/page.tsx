"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import { useConfig, saveConfig } from "@/lib/config";
import { cn } from "@/lib/cn";
import { Tag, Plus, Trash2, Mic, ShoppingBag, GripVertical, Copy, ArrowRight } from "lucide-react";
import type { StoreItem } from "@/lib/store";

type Cat = { id: string; name: string; scope: "store" | "room"; enabled?: boolean; order?: number };

function newId() { return `cat_${Math.random().toString(36).slice(2, 8)}${Date.now().toString(36).slice(-3)}`; }

export default function CategoriesPage() {
  const { config, loading, reload } = useConfig();
  const { toast } = useToast();
  const [cats, setCats] = useState<Cat[]>([]);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [dragId, setDragId] = useState<string | null>(null);

  useEffect(() => { if (!loading) { setCats((config.categories as Cat[]) ?? []); setDirty(false); } }, [loading, config]);

  const scopeCats = (scope: "store" | "room") =>
    cats.filter((c) => c.scope === scope).sort((a, b) => (a.order ?? 0) - (b.order ?? 0));

  // How many store items are currently filed under a given category name.
  const storeItemCount = (name: string) => ((config.storeItems ?? []) as StoreItem[]).filter((it) => (it.category ?? "") === name).length;

  const add = (scope: "store" | "room") => {
    const order = scopeCats(scope).length;
    setCats((cs) => [...cs, { id: newId(), name: "", scope, enabled: true, order }]);
    setDirty(true);
  };
  const patch = (id: string, p: Partial<Cat>) => { setCats((cs) => cs.map((c) => (c.id === id ? { ...c, ...p } : c))); setDirty(true); };
  const remove = (id: string) => { setCats((cs) => cs.filter((c) => c.id !== id)); setDirty(true); };
  const duplicate = (c: Cat) => {
    const order = scopeCats(c.scope).length;
    setCats((cs) => [...cs, { ...c, id: newId(), name: `${c.name} (copy)`, order }]);
    setDirty(true);
  };
  // Drag-to-reorder within a scope: move the dragged category to the target's slot and
  // re-number every category in that scope so the order persists.
  const reorder = (scope: "store" | "room", fromId: string, toId: string) => {
    if (fromId === toId) return;
    const list = scopeCats(scope);
    const fromIdx = list.findIndex((c) => c.id === fromId);
    const toIdx = list.findIndex((c) => c.id === toId);
    if (fromIdx < 0 || toIdx < 0) return;
    const next = [...list];
    const [moved] = next.splice(fromIdx, 1);
    next.splice(toIdx, 0, moved);
    const orderMap = new Map(next.map((c, i) => [c.id, i]));
    setCats((cs) => cs.map((c) => (c.scope === scope && orderMap.has(c.id) ? { ...c, order: orderMap.get(c.id) } : c)));
    setDirty(true);
  };

  const save = async () => {
    const clean = cats.map((c) => ({ ...c, name: c.name.trim() })).filter((c) => c.name);
    setSaving(true);
    const res = await saveConfig({ categories: clean });
    setSaving(false);
    if (res.ok) { await reload(); setDirty(false); toast("Categories saved — applied instantly.", "success"); }
    else toast(res.error ?? "Could not save", "error");
  };

  // NOTE: called as a plain function `{scopeSection(...)}` below, NOT as a JSX
  // element `<scopeSection/>` — rendering it as an element would give it a new
  // component identity every keystroke and REMOUNT the name <input> (focus loss).
  const scopeSection = ({ scope, title, hint, Icon }: { scope: "store" | "room"; title: string; hint: string; Icon: typeof Mic }) => {
    const list = scopeCats(scope);
    return (
      <Card className="p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="flex items-center gap-2 font-display text-lg font-bold text-mist-100"><Icon className="size-5 text-lotus-300" /> {title}</h2>
            <p className="mt-0.5 text-sm text-mist-400">{hint}</p>
          </div>
          <Button size="sm" variant="secondary" onClick={() => add(scope)}><Plus className="size-4" /> Add category</Button>
        </div>
        <div className="mt-4 space-y-2">
          {list.length === 0 && <p className="rounded-lg border border-line bg-ink-900 px-4 py-5 text-center text-sm text-mist-500">No categories yet — add one above.</p>}
          {list.map((c) => (
            <div
              key={c.id}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => { e.preventDefault(); if (dragId) reorder(scope, dragId, c.id); setDragId(null); }}
              className={cn("flex flex-wrap items-center gap-2 rounded-lg border px-2.5 py-2 transition", dragId === c.id ? "border-lotus-400/60 bg-lotus-500/10" : c.enabled === false ? "border-line bg-ink-900/50 opacity-70" : "border-line bg-ink-900")}
            >
              {/* Only the handle is draggable, so click-dragging to select the name text never starts a row drag. */}
              <span draggable onDragStart={() => setDragId(c.id)} onDragEnd={() => setDragId(null)} className="shrink-0 cursor-grab" title="Drag to reorder"><GripVertical className="size-4 text-mist-600" /></span>
              <input
                value={c.name}
                onChange={(e) => patch(c.id, { name: e.target.value.slice(0, 40) })}
                placeholder="Category name"
                className="h-9 min-w-0 flex-1 rounded-lg border border-line bg-ink-800 px-3 text-sm text-mist-100 outline-none focus:border-lotus-400"
              />
              {scope === "store" && c.name.trim() && (
                <Link href={`/admin/store?category=${encodeURIComponent(c.name.trim())}`} className="flex shrink-0 items-center gap-1 rounded-lg border border-line bg-ink-800 px-2.5 py-1.5 text-xs font-semibold text-lotus-300 transition hover:bg-lotus-500/10" title="Add / edit the items in this category">
                  {storeItemCount(c.name.trim())} item{storeItemCount(c.name.trim()) === 1 ? "" : "s"} <ArrowRight className="size-3.5" />
                </Link>
              )}
              <button
                onClick={() => patch(c.id, { enabled: c.enabled === false })}
                role="switch" aria-checked={c.enabled !== false}
                title={c.enabled !== false ? "Enabled — tap to disable" : "Disabled — tap to enable"}
                className={cn("relative h-6 w-11 shrink-0 rounded-full transition", c.enabled !== false ? "bg-emerald-500" : "bg-mist-600")}
              >
                <span className={cn("absolute top-0.5 size-5 rounded-full bg-white shadow transition-all", c.enabled !== false ? "left-[22px]" : "left-0.5")} />
              </button>
              <button onClick={() => duplicate(c)} title="Duplicate category" className="grid size-8 shrink-0 place-items-center rounded-lg bg-white/[0.06] text-mist-400 transition hover:bg-white/10 hover:text-mist-100"><Copy className="size-4" /></button>
              <button onClick={() => remove(c.id)} title="Delete category" className="grid size-8 shrink-0 place-items-center rounded-lg bg-rose-500/15 text-rose-300 transition hover:bg-rose-500/25"><Trash2 className="size-4" /></button>
            </div>
          ))}
        </div>
      </Card>
    );
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 font-display text-2xl font-extrabold text-mist-100"><Tag className="size-6 text-lotus-300" /> Categories</h1>
          <p className="text-sm text-mist-400">Add, rename, enable/disable, <b className="text-mist-300">drag to reorder</b>, duplicate or delete the categories used to group <b className="text-mist-300">Voice Rooms</b> and <b className="text-mist-300">Store items</b>. Changes apply instantly. Disabling a category hides it from the pickers/filters but keeps anything already using it. On a store category, use the <b className="text-mist-300">items →</b> button to add and edit the items inside it.</p>
        </div>
        <Button onClick={save} disabled={saving || !dirty}>{saving ? "Saving…" : dirty ? "Save changes" : "Saved ✓"}</Button>
      </div>

      {scopeSection({ scope: "room", title: "Voice Room categories", hint: "Shown when a member creates a room, and as filters on the Rooms page.", Icon: Mic })}
      {scopeSection({ scope: "store", title: "Store item categories", hint: "Group Store items (frames, backgrounds, effects, badges, overlays). Tap the items → button on a category to add/edit the items inside it.", Icon: ShoppingBag })}

      <Card className="flex flex-wrap items-center justify-between gap-3 p-4">
        <p className="text-sm text-mist-400">Manage the actual store items — add, edit, price, upload, publish and assign — on the Store Items page.</p>
        <Link href="/admin/store"><Button size="sm" variant="secondary"><ShoppingBag className="size-4" /> Open Store Items</Button></Link>
      </Card>
    </div>
  );
}
