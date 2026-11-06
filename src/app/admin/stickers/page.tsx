"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import { cn } from "@/lib/cn";
import { withBase } from "@/lib/base-path";
import { fetchAdminStickers, uploadGlobalSticker, editGlobalSticker, removeGlobalSticker, type GlobalSticker } from "@/lib/stickers";
import { Upload, FolderOpen, Trash2, Pencil, Check, X, Search, Eye, EyeOff, BarChart3 } from "lucide-react";

// Suggested categories (admin can also type a custom one).
const SUGGESTED = ["Funny", "Love", "Emoji", "Greetings", "Festival"];

export default function AdminStickersPage() {
  const { toast } = useToast();
  const [stickers, setStickers] = useState<GlobalSticker[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("all");

  // Upload state
  const fileRef = useRef<HTMLInputElement>(null);
  const [upName, setUpName] = useState("");
  const [upCat, setUpCat] = useState("Emoji");
  const [upCatCustom, setUpCatCustom] = useState("");
  const [uploading, setUploading] = useState(false);

  // Inline edit state
  const [editing, setEditing] = useState<string>("");
  const [editName, setEditName] = useState("");
  const [editCat, setEditCat] = useState("");

  // Bulk selection — tick several stickers, then enable/disable/delete at once.
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkBusy, setBulkBusy] = useState(false);
  const toggleSel = (id: string) => setSelected((prev) => { const n = new Set(prev); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const bulk = async (action: "enable" | "disable" | "delete") => {
    const ids = [...selected];
    if (ids.length === 0) return;
    if (action === "delete" && !confirm(`Delete ${ids.length} sticker${ids.length === 1 ? "" : "s"} from the library? This cannot be undone.`)) return;
    setBulkBusy(true);
    let ok = 0;
    for (const id of ids) {
      const res = action === "delete" ? await removeGlobalSticker(id) : await editGlobalSticker(id, { enabled: action === "enable" });
      if (res) ok++;
    }
    setBulkBusy(false);
    setSelected(new Set());
    load();
    toast(`${ok} sticker${ok === 1 ? "" : "s"} ${action === "delete" ? "deleted" : action === "enable" ? "enabled" : "disabled"}`, "success");
  };

  const load = useCallback(async () => { setStickers(await fetchAdminStickers()); setLoading(false); }, []);
  useEffect(() => { load(); }, [load]);

  const onPickFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    if (files.length === 0) return;
    const category = (upCat === "__custom" ? upCatCustom.trim() : upCat.trim()) || "Emoji";
    setUploading(true);
    let ok = 0; const fails: string[] = [];
    for (const file of files) {
      const title = files.length === 1 ? upName.trim() : file.name.replace(/\.[^.]+$/, "").slice(0, 40);
      const res = await uploadGlobalSticker(file, title, category);
      if (res.ok) ok++; else fails.push(`${file.name}: ${res.error ?? "failed"}`);
    }
    setUploading(false);
    if (fileRef.current) fileRef.current.value = "";
    load();
    if (ok > 0) { setUpName(""); toast(`${ok} sticker${ok === 1 ? "" : "s"} added${fails.length ? ` · ${fails.length} failed` : ""}`, fails.length ? "info" : "success"); }
    if (fails.length && ok === 0) toast(fails[0], "error");
  };

  const toggleEnabled = async (s: GlobalSticker) => {
    const okRes = await editGlobalSticker(s.id, { enabled: !s.enabled });
    if (okRes) { setStickers((list) => list.map((x) => (x.id === s.id ? { ...x, enabled: !x.enabled } : x))); }
    else toast("Could not update", "error");
  };

  const saveEdit = async (id: string) => {
    const okRes = await editGlobalSticker(id, { name: editName.trim(), category: editCat.trim() });
    if (okRes) { setEditing(""); toast("Saved", "success"); load(); }
    else toast("Could not save", "error");
  };

  const remove = async (s: GlobalSticker) => {
    if (!confirm(`Delete "${s.name}" from the sticker library?`)) return;
    const okRes = await removeGlobalSticker(s.id);
    if (okRes) { toast("Deleted", "success"); load(); }
    else toast("Could not delete", "error");
  };

  // Distinct categories present, for the filter tabs.
  const categories = useMemo(() => {
    const set = new Set<string>();
    for (const s of stickers) set.add(s.category || "Other");
    return [...set].sort();
  }, [stickers]);

  const q = query.trim().toLowerCase();
  const shown = useMemo(
    () => stickers.filter((s) => (filter === "all" || (s.category || "Other") === filter) && (!q || s.name.toLowerCase().includes(q) || (s.category ?? "").toLowerCase().includes(q))),
    [stickers, filter, q],
  );

  const stats = useMemo(() => {
    const total = stickers.length;
    const enabled = stickers.filter((s) => s.enabled).length;
    const totalUses = stickers.reduce((a, s) => a + (s.usageCount || 0), 0);
    const top = [...stickers].filter((s) => (s.usageCount || 0) > 0).sort((a, b) => b.usageCount - a.usageCount).slice(0, 5);
    return { total, enabled, disabled: total - enabled, totalUses, top };
  }, [stickers]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-extrabold text-mist-100">Sticker Library</h1>
        <p className="text-sm text-mist-400">Add and manage the stickers everyone can send in group chats. Upload images, organise them into categories, enable/disable, and see how often each one is used. Only admins manage this library; users can only pick and send from it.</p>
      </div>

      {/* Usage stats */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label="Total stickers" value={stats.total} />
        <StatCard label="Enabled (live)" value={stats.enabled} tone="text-emerald-300" />
        <StatCard label="Disabled" value={stats.disabled} tone="text-mist-400" />
        <StatCard label="Total sends" value={stats.totalUses} tone="text-lotus-300" />
      </div>
      {stats.top.length > 0 && (
        <Card className="space-y-2 p-4">
          <h2 className="flex items-center gap-2 text-sm font-semibold text-mist-100"><BarChart3 className="size-4 text-lotus-300" /> Most used</h2>
          <div className="flex flex-wrap gap-2">
            {stats.top.map((s) => (
              <span key={s.id} className="inline-flex items-center gap-2 rounded-lg border border-line bg-ink-800 px-2 py-1">
                <img src={withBase(s.url)} alt="" className="size-6 object-contain" />
                <span className="text-xs font-semibold text-mist-200">{s.name}</span>
                <span className="rounded-full bg-lotus-600/20 px-1.5 text-[10px] font-bold text-lotus-200">{s.usageCount}</span>
              </span>
            ))}
          </div>
        </Card>
      )}

      {/* Upload */}
      <Card className="space-y-3 p-5">
        <h2 className="flex items-center gap-2 font-semibold text-mist-100"><Upload className="size-4 text-lotus-300" /> Add stickers</h2>
        <div className="flex flex-wrap items-end gap-3">
          <label className="text-sm">
            <span className="mb-1 block font-semibold text-mist-300">Name (optional)</span>
            <input value={upName} onChange={(e) => setUpName(e.target.value)} placeholder="e.g. Happy Cat" className="h-9 w-48 rounded-lg border border-line bg-ink-800 px-3 text-sm text-mist-100 outline-none focus:border-lotus-400" />
          </label>
          <label className="text-sm">
            <span className="mb-1 block font-semibold text-mist-300">Category</span>
            <select value={upCat} onChange={(e) => setUpCat(e.target.value)} className="h-9 w-40 rounded-lg border border-line bg-ink-800 px-2 text-sm text-mist-100 outline-none focus:border-lotus-400">
              {SUGGESTED.map((c) => <option key={c} value={c}>{c}</option>)}
              <option value="__custom">Custom…</option>
            </select>
          </label>
          {upCat === "__custom" && (
            <label className="text-sm">
              <span className="mb-1 block font-semibold text-mist-300">Custom category</span>
              <input value={upCatCustom} onChange={(e) => setUpCatCustom(e.target.value)} placeholder="e.g. Sports" className="h-9 w-40 rounded-lg border border-line bg-ink-800 px-3 text-sm text-mist-100 outline-none focus:border-lotus-400" />
            </label>
          )}
          <input ref={fileRef} type="file" accept="image/png,image/webp,image/gif,image/jpeg" multiple onChange={onPickFile} className="hidden" />
          <Button onClick={() => fileRef.current?.click()} disabled={uploading}><FolderOpen className="size-4" /> {uploading ? "Uploading…" : "Select images"}</Button>
        </div>
        <p className="text-xs text-mist-500">PNG, WEBP, GIF (animated works) or JPG, up to 5 MB each. You can select several at once — they all go into the chosen category.</p>
      </Card>

      {/* Filters + search */}
      <div className="flex flex-wrap items-center gap-2">
        <button onClick={() => setFilter("all")} className={cn("rounded-full px-3.5 py-1.5 text-sm font-semibold transition", filter === "all" ? "bg-lotus-600 text-white" : "border border-line bg-ink-800 text-mist-400 hover:text-mist-100")}>
          All ({stickers.length})
        </button>
        {categories.map((c) => (
          <button key={c} onClick={() => setFilter(c)} className={cn("rounded-full px-3.5 py-1.5 text-sm font-semibold transition", filter === c ? "bg-lotus-600 text-white" : "border border-line bg-ink-800 text-mist-400 hover:text-mist-100")}>
            {c} ({stickers.filter((s) => (s.category || "Other") === c).length})
          </button>
        ))}
        <div className="ml-auto flex items-center gap-1.5 rounded-lg border border-line bg-ink-800 px-2.5">
          <Search className="size-4 text-mist-500" />
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search…" className="h-9 w-44 bg-transparent text-sm text-mist-100 outline-none placeholder:text-mist-500" />
        </div>
      </div>

      {/* Bulk select + actions */}
      <div className="flex flex-wrap items-center gap-3 rounded-xl border border-line bg-ink-850 px-3 py-2">
        <label className="flex items-center gap-2 text-xs font-semibold text-mist-300">
          <input
            type="checkbox"
            checked={shown.length > 0 && shown.every((s) => selected.has(s.id))}
            onChange={(e) => setSelected(e.target.checked ? new Set(shown.map((s) => s.id)) : new Set())}
            className="size-4 accent-lotus-500"
          />
          Select all shown ({shown.length})
        </label>
        <span className="text-xs text-mist-500">{selected.size} selected</span>
        <div className="ml-auto flex flex-wrap items-center gap-1.5">
          <button onClick={() => bulk("enable")} disabled={bulkBusy || selected.size === 0} className="rounded-lg bg-emerald-500/15 px-2.5 py-1.5 text-xs font-semibold text-emerald-300 transition hover:bg-emerald-500/25 disabled:opacity-50">
            <span className="inline-flex items-center gap-1"><Eye className="size-3.5" /> Enable</span>
          </button>
          <button onClick={() => bulk("disable")} disabled={bulkBusy || selected.size === 0} className="rounded-lg bg-white/[0.06] px-2.5 py-1.5 text-xs font-semibold text-mist-300 transition hover:bg-white/10 disabled:opacity-50">
            <span className="inline-flex items-center gap-1"><EyeOff className="size-3.5" /> Disable</span>
          </button>
          <button onClick={() => bulk("delete")} disabled={bulkBusy || selected.size === 0} className="rounded-lg bg-rose-500/15 px-2.5 py-1.5 text-xs font-semibold text-rose-300 transition hover:bg-rose-500/25 disabled:opacity-50">
            <span className="inline-flex items-center gap-1"><Trash2 className="size-3.5" /> {bulkBusy ? "Working…" : "Delete"}</span>
          </button>
        </div>
      </div>

      {/* Grid */}
      {loading ? (
        <Card className="py-10 text-center text-sm text-mist-400">Loading…</Card>
      ) : shown.length === 0 ? (
        <Card className="py-12 text-center text-sm text-mist-500">No stickers yet. Upload images above to build the library.</Card>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {shown.map((s) => {
            const isEditing = editing === s.id;
            return (
              <Card key={s.id} className={cn("space-y-3 p-3", !s.enabled && "opacity-60", selected.has(s.id) && "ring-1 ring-lotus-400")}>
                <div className="flex items-start gap-3">
                  <input type="checkbox" checked={selected.has(s.id)} onChange={() => toggleSel(s.id)} className="mt-1 size-4 shrink-0 accent-lotus-500" title="Select for bulk actions" />
                  {/* checkerboard behind so transparent PNG / GIF read clearly */}
                  <div className="grid size-20 shrink-0 place-items-center rounded-lg border border-line" style={{ backgroundColor: "#1c2333", backgroundImage: "linear-gradient(45deg,#2a3346 25%,transparent 25%),linear-gradient(-45deg,#2a3346 25%,transparent 25%),linear-gradient(45deg,transparent 75%,#2a3346 75%),linear-gradient(-45deg,transparent 75%,#2a3346 75%)", backgroundSize: "12px 12px", backgroundPosition: "0 0,0 6px,6px -6px,-6px 0" }}>
                    <img src={withBase(s.url)} alt={s.name} className="max-h-16 max-w-16 object-contain" />
                  </div>
                  <div className="min-w-0 flex-1">
                    {isEditing ? (
                      <div className="space-y-2">
                        <input value={editName} onChange={(e) => setEditName(e.target.value)} className="h-8 w-full rounded-lg border border-line bg-ink-900 px-2.5 text-sm text-mist-100 outline-none focus:border-lotus-400" placeholder="Name" />
                        <input value={editCat} onChange={(e) => setEditCat(e.target.value)} className="h-8 w-full rounded-lg border border-line bg-ink-900 px-2.5 text-sm text-mist-100 outline-none focus:border-lotus-400" placeholder="Category" />
                        <div className="flex gap-2">
                          <button onClick={() => saveEdit(s.id)} className="grid size-8 place-items-center rounded-lg bg-emerald-500/15 text-emerald-300 hover:bg-emerald-500/25"><Check className="size-4" /></button>
                          <button onClick={() => setEditing("")} className="grid size-8 place-items-center rounded-lg bg-ink-800 text-mist-400 hover:text-mist-200"><X className="size-4" /></button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <div className="truncate text-sm font-semibold text-mist-100">{s.name}</div>
                        <div className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-mist-500">
                          <span className="rounded-full bg-white/[0.06] px-1.5 py-0.5 text-[10px] font-semibold text-mist-300">{s.category || "Other"}</span>
                          <span className="rounded-full bg-lotus-600/15 px-1.5 py-0.5 text-[10px] font-semibold text-lotus-200">{s.usageCount || 0} sends</span>
                          {!s.enabled && <span className="rounded-full bg-white/[0.06] px-1.5 py-0.5 text-[10px] text-mist-400">Hidden</span>}
                        </div>
                      </>
                    )}
                  </div>
                </div>
                {!isEditing && (
                  <div className="flex items-center gap-1.5">
                    <button onClick={() => toggleEnabled(s)} title={s.enabled ? "Disable (hide from users)" : "Enable"} className={cn("inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-semibold transition", s.enabled ? "bg-emerald-500/15 text-emerald-300 hover:bg-emerald-500/25" : "bg-ink-800 text-mist-400 hover:text-mist-100")}>
                      {s.enabled ? <><Eye className="size-3.5" /> Enabled</> : <><EyeOff className="size-3.5" /> Disabled</>}
                    </button>
                    <button onClick={() => { setEditing(s.id); setEditName(s.name); setEditCat(s.category ?? ""); }} title="Edit" className="ml-auto grid size-8 place-items-center rounded-lg text-mist-500 hover:bg-white/[0.06] hover:text-mist-200"><Pencil className="size-4" /></button>
                    <button onClick={() => remove(s)} title="Delete" className="grid size-8 place-items-center rounded-lg text-mist-500 hover:bg-rose-500/10 hover:text-rose-300"><Trash2 className="size-4" /></button>
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

function StatCard({ label, value, tone = "text-mist-100" }: { label: string; value: number; tone?: string }) {
  return (
    <Card className="p-4">
      <div className={cn("font-display text-2xl font-extrabold", tone)}>{value}</div>
      <div className="text-xs text-mist-500">{label}</div>
    </Card>
  );
}
