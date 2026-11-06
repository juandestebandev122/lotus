"use client";

import { useEffect, useMemo, useState } from "react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import { cn } from "@/lib/cn";
import { useConfig, saveConfig, type ProductFieldDef } from "@/lib/config";
import { LayoutList, Plus, Trash2, Save, Loader2, ChevronUp, ChevronDown, Asterisk } from "lucide-react";

const TYPES: { v: ProductFieldDef["type"]; label: string }[] = [
  { v: "text", label: "Text Box" }, { v: "textarea", label: "Text Area" }, { v: "number", label: "Number" },
  { v: "select", label: "Dropdown List" }, { v: "radio", label: "Radio Button" }, { v: "checkbox", label: "Checkbox" },
  { v: "date", label: "Date Picker" }, { v: "file", label: "File Upload" }, { v: "image", label: "Image Upload" }, { v: "url", label: "URL / Link" },
];
const HAS_OPTIONS = (t: ProductFieldDef["type"]) => ["select", "radio", "checkbox"].includes(t);
const typeLabel = (t: ProductFieldDef["type"]) => TYPES.find((x) => x.v === t)?.label ?? t;
// A few ready-made category presets from the client's brief (one-click add).
const PRESETS: Record<string, { label: string; type: ProductFieldDef["type"]; options?: string }[]> = {
  "Car Rental": [{ label: "Vehicle Type", type: "text" }, { label: "Seating Capacity", type: "number" }, { label: "Fuel Type", type: "select", options: "Petrol, Diesel, Electric, Hybrid" }, { label: "Transmission", type: "select", options: "Manual, Automatic" }, { label: "Rental Price", type: "number" }],
  "Equipment Rental": [{ label: "Equipment Capacity", type: "text" }, { label: "Operating Hours", type: "number" }, { label: "Rental Period", type: "text" }, { label: "Safety Certificate", type: "file" }],
  "Textiles / Clothing": [{ label: "Fabric Type", type: "text" }, { label: "Size", type: "select", options: "S, M, L, XL, XXL" }, { label: "Color", type: "text" }, { label: "Pattern", type: "text" }, { label: "Wash Instructions", type: "textarea" }],
  "Cashew Products": [{ label: "Grade", type: "text" }, { label: "Weight", type: "text" }, { label: "Packaging Type", type: "text" }, { label: "Shelf Life", type: "text" }],
};

export default function ProductFieldsPage() {
  const { toast } = useToast();
  const { config, reload } = useConfig();
  const [fields, setFields] = useState<ProductFieldDef[]>([]);
  const [saving, setSaving] = useState(false);
  const [cat, setCat] = useState(""); // active category filter ("" = all)
  const [draft, setDraft] = useState<{ label: string; type: ProductFieldDef["type"]; category: string; options: string; required: boolean }>({ label: "", type: "text", category: "", options: "", required: false });

  useEffect(() => {
    setFields((config.productCategoryFields ?? []).map((f, i) => ({ ...f, order: f.order ?? i })).sort((a, b) => (a.order ?? 0) - (b.order ?? 0)));
  }, [config.productCategoryFields]);

  const categories = useMemo(() => {
    const set = new Set<string>(config.business?.categories ?? []);
    fields.forEach((f) => { if (f.category && f.category !== "*") set.add(f.category); });
    return [...set].sort();
  }, [config.business, fields]);

  const norm = (c?: string) => (c && c !== "*" ? c : "");
  const shown = fields.filter((f) => !cat || norm(f.category) === cat || norm(f.category) === "");

  const addField = () => {
    if (!draft.label.trim()) return toast("Enter a field label", "error");
    const key = draft.label.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "").slice(0, 60) || "field";
    const f: ProductFieldDef = { id: `pf_${Date.now().toString(36)}${Math.floor(Math.random() * 1e4)}`, category: draft.category.trim(), key, label: draft.label.trim(), type: draft.type, options: HAS_OPTIONS(draft.type) ? draft.options.split(",").map((s) => s.trim()).filter(Boolean) : undefined, required: draft.required, enabled: true, order: fields.length };
    setFields([...fields, f]);
    setDraft({ label: "", type: "text", category: draft.category, options: "", required: false });
  };
  const upd = (id: string, patch: Partial<ProductFieldDef>) => setFields((fs) => fs.map((f) => (f.id === id ? { ...f, ...patch } : f)));
  const del = (id: string) => { if (confirm("Delete this field?")) setFields((fs) => fs.filter((f) => f.id !== id)); };
  const move = (id: string, dir: -1 | 1) => setFields((fs) => {
    const arr = [...fs].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
    const i = arr.findIndex((f) => f.id === id); const j = i + dir;
    if (i < 0 || j < 0 || j >= arr.length) return fs;
    [arr[i], arr[j]] = [arr[j], arr[i]];
    return arr.map((f, k) => ({ ...f, order: k }));
  });
  const addPreset = (category: string) => {
    const items = PRESETS[category] ?? [];
    const next: ProductFieldDef[] = items.map((it, k) => ({ id: `pf_${Date.now().toString(36)}${k}${Math.floor(Math.random() * 1e4)}`, category, key: it.label.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, ""), label: it.label, type: it.type, options: it.options ? it.options.split(",").map((s) => s.trim()) : undefined, required: false, enabled: true, order: fields.length + k }));
    setFields([...fields, ...next]); setCat(category);
    toast(`Added ${next.length} ${category} fields — review & Save`, "success");
  };

  const save = async () => {
    setSaving(true);
    const res = await saveConfig({ productCategoryFields: fields });
    setSaving(false);
    if (res.ok) { toast("Product fields saved", "success"); reload(); } else toast(res.error ?? "Save failed", "error");
  };

  const fld = "h-10 w-full rounded-lg border border-line bg-ink-800 px-3 text-sm text-mist-100 outline-none focus:border-lotus-400";

  return (
    <div className="mx-auto max-w-4xl space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 font-display text-2xl font-extrabold text-mist-100"><LayoutList className="size-6 text-lotus-300" /> Product Custom Fields</h1>
          <p className="mt-1 text-sm text-mist-400">Create custom fields for products — per category or for all. No coding needed; businesses fill them when adding a product and they show on the product page.</p>
        </div>
        <Button onClick={save} disabled={saving}>{saving ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />} Save changes</Button>
      </div>

      {/* Add a new field */}
      <Card className="p-5">
        <h2 className="mb-3 flex items-center gap-2 text-sm font-bold text-mist-100"><Plus className="size-4 text-lotus-300" /> Add new field</h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div><label className="mb-1 block text-[11px] font-semibold text-mist-400">Field label</label><input value={draft.label} onChange={(e) => setDraft({ ...draft, label: e.target.value })} placeholder="e.g. Brand" className={fld} /></div>
          <div><label className="mb-1 block text-[11px] font-semibold text-mist-400">Field type</label><select value={draft.type} onChange={(e) => setDraft({ ...draft, type: e.target.value as ProductFieldDef["type"] })} className={fld}>{TYPES.map((t) => <option key={t.v} value={t.v}>{t.label}</option>)}</select></div>
          <div><label className="mb-1 block text-[11px] font-semibold text-mist-400">Category</label><input list="prod-cats" value={draft.category} onChange={(e) => setDraft({ ...draft, category: e.target.value })} placeholder="All categories" className={fld} /><datalist id="prod-cats">{categories.map((c) => <option key={c} value={c} />)}</datalist></div>
          <div className="flex items-end gap-2">
            <label className="flex items-center gap-1.5 text-xs text-mist-300"><input type="checkbox" checked={draft.required} onChange={(e) => setDraft({ ...draft, required: e.target.checked })} className="size-4 accent-lotus-500" /> Required</label>
            <Button size="sm" onClick={addField} className="ml-auto"><Plus className="size-4" /> Add</Button>
          </div>
          {HAS_OPTIONS(draft.type) && <div className="sm:col-span-2 lg:col-span-4"><label className="mb-1 block text-[11px] font-semibold text-mist-400">Options (comma-separated)</label><input value={draft.options} onChange={(e) => setDraft({ ...draft, options: e.target.value })} placeholder="e.g. Small, Medium, Large" className={fld} /></div>}
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-white/5 pt-3">
          <span className="text-[11px] text-mist-500">Quick presets:</span>
          {Object.keys(PRESETS).map((p) => <button key={p} onClick={() => addPreset(p)} className="rounded-full bg-white/[0.06] px-2.5 py-1 text-[11px] font-semibold text-mist-300 hover:bg-white/[0.12]">+ {p}</button>)}
        </div>
      </Card>

      {/* Category filter + list */}
      <Card className="p-5">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-sm font-bold text-mist-100">Fields ({fields.length})</h2>
          <select value={cat} onChange={(e) => setCat(e.target.value)} className="h-9 rounded-lg border border-line bg-ink-800 px-2 text-sm text-mist-100"><option value="">All categories</option>{categories.map((c) => <option key={c} value={c}>{c}</option>)}</select>
        </div>
        {shown.length === 0 ? (
          <p className="py-8 text-center text-sm text-mist-500">No fields yet. Add one above, or use a preset.</p>
        ) : (
          <div className="space-y-2">
            {shown.map((f) => (
              <div key={f.id} className={cn("rounded-xl border p-3", f.enabled === false ? "border-line/50 bg-ink-800/30 opacity-60" : "border-line bg-ink-800/50")}>
                <div className="flex flex-wrap items-center gap-2">
                  <div className="flex flex-col">
                    <button onClick={() => move(f.id, -1)} className="text-mist-500 hover:text-mist-200"><ChevronUp className="size-3.5" /></button>
                    <button onClick={() => move(f.id, 1)} className="text-mist-500 hover:text-mist-200"><ChevronDown className="size-3.5" /></button>
                  </div>
                  <input value={f.label} onChange={(e) => upd(f.id, { label: e.target.value })} className="h-9 min-w-32 flex-1 rounded-lg border border-line bg-ink-900 px-2.5 text-sm font-semibold text-mist-100 outline-none focus:border-lotus-400" />
                  <select value={f.type} onChange={(e) => upd(f.id, { type: e.target.value as ProductFieldDef["type"] })} className="h-9 rounded-lg border border-line bg-ink-900 px-2 text-xs text-mist-200">{TYPES.map((t) => <option key={t.v} value={t.v}>{t.label}</option>)}</select>
                  <span className="rounded-full bg-white/[0.06] px-2 py-0.5 text-[10px] text-mist-400">{norm(f.category) || "All"}</span>
                  <button onClick={() => upd(f.id, { required: !f.required })} title="Required / optional" className={cn("inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold", f.required ? "bg-rose-500/15 text-rose-300" : "bg-white/[0.06] text-mist-400")}><Asterisk className="size-3" /> {f.required ? "Required" : "Optional"}</button>
                  <button onClick={() => upd(f.id, { enabled: f.enabled === false })} className={cn("rounded-full px-2 py-0.5 text-[10px] font-bold", f.enabled === false ? "bg-white/[0.06] text-mist-400" : "bg-emerald-500/15 text-emerald-300")}>{f.enabled === false ? "Disabled" : "Enabled"}</button>
                  <button onClick={() => del(f.id)} className="grid size-8 place-items-center rounded-lg text-rose-300 hover:bg-rose-500/10"><Trash2 className="size-4" /></button>
                </div>
                {HAS_OPTIONS(f.type) && <input value={(f.options ?? []).join(", ")} onChange={(e) => upd(f.id, { options: e.target.value.split(",").map((s) => s.trim()).filter(Boolean) })} placeholder="Options (comma-separated)" className="mt-2 h-9 w-full rounded-lg border border-line bg-ink-900 px-2.5 text-xs text-mist-200 outline-none focus:border-lotus-400" />}
                <p className="mt-1 text-[10px] text-mist-600">{typeLabel(f.type)} · key: {f.key}</p>
              </div>
            ))}
          </div>
        )}
        <p className="mt-3 text-[11px] text-mist-500">Remember to <b>Save changes</b> after adding, editing or reordering. Fields marked <b>All</b> apply to every category.</p>
      </Card>
    </div>
  );
}
