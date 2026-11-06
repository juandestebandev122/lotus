"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import { withBase } from "@/lib/base-path";
import { UPLOAD_PLACEMENT_LIST, UPLOAD_PLACEMENT_GROUPS } from "@/lib/upload-placements";
import { cn } from "@/lib/cn";
import {
  UploadCloud, Plus, Search, X, Check, Loader2, Copy, Trash2, Pencil, Eye, MousePointerClick,
  FileText, Archive, Send,
} from "lucide-react";

interface Upload {
  id: string; title: string; category: string; type: "image" | "video" | "pdf" | "audio" | "file"; url: string; fileName?: string;
  thumbnail?: string; subtitle?: string; description?: string; buttonText?: string; buttonUrl?: string;
  bgColor?: string; textColor?: string; placements: string[]; priority: number;
  status: "draft" | "published" | "archived"; startAt?: string; endAt?: string; dismissible?: boolean;
  audience: { groups?: string[]; minLevel?: number; countries?: string[]; userIds?: string[] };
  views?: number; clicks?: number; createdAt?: string; createdBy?: string; updatedAt?: string;
}

// The placement list comes from ONE shared module that the SERVER also uses to
// validate a save. They used to be two hand-written lists that drifted apart, so
// the newer placements were accepted here and silently dropped on save.
const PLACEMENTS = UPLOAD_PLACEMENT_LIST;

/** Group the pills by area so a 14-item wall reads as four short rows and it's
 *  obvious which areas exist — the old flat list made it easy to tick Home and
 *  assume everything else was covered. */
const PLACEMENT_GROUPS = UPLOAD_PLACEMENT_GROUPS;
const GROUPS: { key: string; label: string }[] = [
  { key: "all", label: "Everyone" },
  { key: "new", label: "New users (7 days)" },
  { key: "existing", label: "Existing users" },
  { key: "vip", label: "VIP members" },
  { key: "agency", label: "Agency members" },
];
const STATUS_STYLE: Record<string, string> = {
  published: "bg-emerald-500/15 text-emerald-300",
  draft: "bg-amber-500/15 text-amber-300",
  archived: "bg-white/10 text-mist-400",
};

const blank = (): Upload => ({
  id: "", title: "", category: "General", type: "image", url: "", placements: ["home-top"], priority: 0,
  status: "draft", dismissible: true, audience: { groups: ["all"] },
});

export default function AdminUploadsPage() {
  const { toast } = useToast();
  const [items, setItems] = useState<Upload[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [cat, setCat] = useState("");
  const [statusF, setStatusF] = useState("");
  const [sort, setSort] = useState<"priority" | "date">("priority");
  const [editing, setEditing] = useState<Upload | null>(null);
  const [busyId, setBusyId] = useState<string>("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch(withBase("/api/admin/uploads"), { credentials: "include", cache: "no-store" });
      const d = await r.json();
      if (Array.isArray(d?.uploads)) setItems(d.uploads as Upload[]);
    } catch { /* ignore */ }
    setLoading(false);
  }, []);
  useEffect(() => { void load(); }, [load]);

  const categories = useMemo(() => Array.from(new Set(items.map((i) => i.category).filter(Boolean))).sort(), [items]);
  const shown = useMemo(() => {
    let list = items.filter((i) =>
      (!cat || i.category === cat) && (!statusF || i.status === statusF) &&
      (!q || `${i.title} ${i.category} ${i.subtitle ?? ""}`.toLowerCase().includes(q.toLowerCase())));
    const byDate = (a: Upload, b: Upload) => ((a.createdAt ?? "") < (b.createdAt ?? "") ? 1 : -1);
    list = [...list].sort((a, b) => sort === "priority" ? (b.priority - a.priority || byDate(a, b)) : byDate(a, b));
    return list;
  }, [items, cat, statusF, q, sort]);

  const act = async (body: Record<string, unknown>, okMsg: string) => {
    setBusyId(String(body.id ?? "new"));
    try {
      const r = await fetch(withBase("/api/admin/uploads"), { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const d = await r.json().catch(() => ({}));
      if (r.ok) { toast(okMsg, "success"); await load(); }
      else toast(d?.error ?? "Action failed", "error");
    } catch { toast("Network error", "error"); }
    setBusyId("");
  };
  const del = async (it: Upload) => {
    if (!window.confirm(`Delete "${it.title}" permanently?`)) return;
    setBusyId(it.id);
    try {
      const r = await fetch(withBase(`/api/admin/uploads?id=${encodeURIComponent(it.id)}`), { method: "DELETE", credentials: "include" });
      if (r.ok) { toast("Deleted", "success"); await load(); } else toast("Could not delete", "error");
    } catch { toast("Network error", "error"); }
    setBusyId("");
  };

  const totalViews = items.reduce((a, i) => a + (i.views ?? 0), 0);
  const published = items.filter((i) => i.status === "published").length;

  return (
    <div className="mx-auto max-w-5xl space-y-5 pb-24">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 font-display text-2xl font-extrabold text-mist-100">
            <UploadCloud className="size-6 text-lotus-300" /> Custom Uploads &amp; Banners
          </h1>
          <p className="mt-1 text-sm text-mist-400">Upload any file into your own categories, then choose where it shows, to whom, and when. Published items appear to users instantly — no app update.</p>
        </div>
        <Button onClick={() => setEditing(blank())}><Plus className="size-4" /> New upload</Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        <Stat label="Total uploads" value={items.length} />
        <Stat label="Published (live)" value={published} accent />
        <Stat label="Total views" value={totalViews} />
      </div>

      {/* Filters */}
      <Card className="flex flex-wrap items-center gap-2 p-3">
        <div className="flex items-center gap-2 rounded-lg border border-line bg-ink-800 px-2.5">
          <Search className="size-4 text-mist-500" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search title / category…" className="h-9 w-52 bg-transparent text-sm text-mist-100 outline-none placeholder:text-mist-500" />
        </div>
        <select value={cat} onChange={(e) => setCat(e.target.value)} className="h-9 rounded-lg border border-line bg-ink-800 px-2 text-sm text-mist-100 outline-none">
          <option value="">All categories</option>
          {categories.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
        <select value={statusF} onChange={(e) => setStatusF(e.target.value)} className="h-9 rounded-lg border border-line bg-ink-800 px-2 text-sm text-mist-100 outline-none">
          <option value="">All statuses</option>
          <option value="published">Published</option>
          <option value="draft">Draft</option>
          <option value="archived">Archived</option>
        </select>
        <select value={sort} onChange={(e) => setSort(e.target.value as "priority" | "date")} className="ml-auto h-9 rounded-lg border border-line bg-ink-800 px-2 text-sm text-mist-100 outline-none">
          <option value="priority">Sort: Priority</option>
          <option value="date">Sort: Newest</option>
        </select>
      </Card>

      {/* List */}
      {loading ? (
        <div className="grid h-40 place-items-center text-mist-500"><Loader2 className="size-5 animate-spin" /></div>
      ) : shown.length === 0 ? (
        <Card className="p-10 text-center text-sm text-mist-400">No uploads yet. Click <b className="text-mist-200">New upload</b> to add your first banner, popup or file.</Card>
      ) : (
        <div className="space-y-2">
          {shown.map((it) => (
            <Card key={it.id} className="flex flex-wrap items-center gap-3 p-3">
              <div className="grid size-14 shrink-0 place-items-center overflow-hidden rounded-lg border border-line bg-ink-900">
                {it.type === "image" ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={withBase(it.thumbnail || it.url)} alt="" className="size-full object-cover" />
                ) : <FileText className="size-6 text-mist-500" />}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="truncate text-sm font-semibold text-mist-100">{it.title}</span>
                  <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-bold capitalize", STATUS_STYLE[it.status])}>{it.status}</span>
                  <span className="rounded bg-lotus-500/12 px-1.5 py-0.5 text-[10px] text-lotus-300">{it.category}</span>
                </div>
                <div className="mt-0.5 truncate text-xs text-mist-500">
                  {it.placements.map((p) => PLACEMENTS.find((x) => x.key === p)?.label ?? p).join(" · ") || "no placement"}
                  {" · "}<Eye className="inline size-3" /> {it.views ?? 0} · <MousePointerClick className="inline size-3" /> {it.clicks ?? 0}
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-1">
                {it.status !== "published"
                  ? <button title="Publish" onClick={() => act({ action: "status", id: it.id, status: "published" }, "Published — now live")} disabled={busyId === it.id} className="rounded-lg bg-emerald-500/15 p-2 text-emerald-300 hover:bg-emerald-500/25"><Send className="size-4" /></button>
                  : <button title="Unpublish (draft)" onClick={() => act({ action: "status", id: it.id, status: "draft" }, "Moved to draft")} disabled={busyId === it.id} className="rounded-lg bg-amber-500/15 p-2 text-amber-300 hover:bg-amber-500/25"><Archive className="size-4" /></button>}
                <button title="Edit" onClick={() => setEditing(it)} className="rounded-lg bg-white/5 p-2 text-mist-300 hover:bg-white/10"><Pencil className="size-4" /></button>
                <button title="Duplicate" onClick={() => act({ action: "duplicate", id: it.id }, "Duplicated as draft")} disabled={busyId === it.id} className="rounded-lg bg-white/5 p-2 text-mist-300 hover:bg-white/10"><Copy className="size-4" /></button>
                <button title="Delete" onClick={() => del(it)} disabled={busyId === it.id} className="rounded-lg bg-rose-500/10 p-2 text-rose-300 hover:bg-rose-500/20"><Trash2 className="size-4" /></button>
              </div>
            </Card>
          ))}
        </div>
      )}

      <p className="text-center text-[11px] text-mist-600">
        Live placements: Home (banner, popup, scrolling notice), Login, Wallet. More positions, geo-targeting, repeat schedules, version-history &amp; virus-scan are planned for the next phase.
      </p>

      {editing && (
        <UploadEditor
          initial={editing}
          categories={categories}
          onClose={() => setEditing(null)}
          onSaved={() => { setEditing(null); load(); }}
          toast={toast}
        />
      )}
    </div>
  );
}

function Stat({ label, value, accent }: { label: string; value: number; accent?: boolean }) {
  return (
    <div className={cn("rounded-xl border p-3", accent ? "border-lotus-400/40 bg-lotus-500/[0.08]" : "border-line bg-ink-900")}>
      <div className={cn("font-display text-2xl font-extrabold tabular-nums", accent ? "text-lotus-200" : "text-mist-100")}>{value.toLocaleString("en-SA")}</div>
      <div className="text-[11px] text-mist-500">{label}</div>
    </div>
  );
}

// ---------------- Editor modal ----------------
function UploadEditor({ initial, categories, onClose, onSaved, toast }: {
  initial: Upload; categories: string[]; onClose: () => void; onSaved: () => void; toast: (m: string, t?: "success" | "error" | "info") => void;
}) {
  const [f, setF] = useState<Upload>(initial);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const set = <K extends keyof Upload>(k: K, v: Upload[K]) => setF((p) => ({ ...p, [k]: v }));
  const setAud = (patch: Partial<Upload["audience"]>) => setF((p) => ({ ...p, audience: { ...p.audience, ...patch } }));

  const upload = async (file: File | undefined) => {
    if (!file) return;
    setUploading(true);
    try {
      const fd = new FormData(); fd.append("file", file);
      const r = await fetch(withBase("/api/admin/upload-media"), { method: "POST", credentials: "include", body: fd });
      const d = await r.json().catch(() => ({}));
      if (r.ok && d.url) {
        // Suggest a title from the file name ONLY when it reads like a real name.
        // A camera / AI file such as "file_00000000acec81f4…" is meaningless to
        // members and used to end up as the banner's public caption.
        const base = (d.fileName ?? "").replace(/\.[^.]+$/, "");
        const usable = base && !/^(file|img|image|photo|pxl|dsc|screenshot|whatsapp|untitled|download)[-_ ]?/i.test(base) && !/[a-f0-9]{12,}/i.test(base.replace(/[-_ ]/g, ""));
        setF((p) => ({ ...p, url: d.url, type: d.type ?? p.type, fileName: d.fileName ?? p.fileName, title: p.title || (usable ? base : "") }));
        toast("File uploaded ✓ — add a title so members see a proper caption.", "success");
      } else toast(d.error ?? "Upload failed", "error");
    } catch { toast("Upload failed — please try again", "error"); }
    setUploading(false);
  };

  const togglePlacement = (key: string) => set("placements", f.placements.includes(key) ? f.placements.filter((p) => p !== key) : [...f.placements, key]);
  const toggleGroup = (key: string) => {
    const g = f.audience.groups ?? [];
    setAud({ groups: g.includes(key) ? g.filter((x) => x !== key) : [...g.filter((x) => key === "all" ? true : x !== "all"), key] });
  };

  const save = async () => {
    if (!f.title.trim()) { toast("Please enter a title", "error"); return; }
    if (!f.url) { toast("Please upload a file first", "error"); return; }
    setSaving(true);
    try {
      const r = await fetch(withBase("/api/admin/uploads"), { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify(f) });
      const d = await r.json().catch(() => ({}));
      if (r.ok) { toast("Saved", "success"); onSaved(); } else toast(d?.error ?? "Could not save", "error");
    } catch { toast("Network error", "error"); }
    setSaving(false);
  };

  const field = "h-10 w-full rounded-lg border border-line bg-ink-800 px-3 text-sm text-mist-100 outline-none focus:border-lotus-400";
  const idsText = (f.audience.userIds ?? []).join(", ");
  const countriesText = (f.audience.countries ?? []).join(", ");

  return (
    <div className="fixed inset-0 z-[90] grid place-items-center overflow-y-auto bg-black/60 p-4" onClick={onClose}>
      <div className="my-8 w-full max-w-2xl rounded-2xl border border-white/10 bg-ink-850" onClick={(e) => e.stopPropagation()}>
        <div className="sticky top-0 z-10 flex items-center justify-between gap-2 border-b border-white/8 bg-ink-850 p-4">
          <h2 className="font-display text-lg font-bold text-mist-100">{initial.id ? "Edit upload" : "New upload"}</h2>
          <button onClick={onClose} className="text-mist-400 hover:text-mist-100"><X className="size-5" /></button>
        </div>

        <div className="space-y-4 p-4">
          {/* File */}
          <div>
            <label className="mb-1 block text-xs font-semibold text-mist-300">File <span className="text-rose-300">*</span></label>
            <div
              onClick={() => fileRef.current?.click()}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => { e.preventDefault(); upload(e.dataTransfer.files?.[0]); }}
              className="flex cursor-pointer items-center justify-center gap-2 rounded-xl border border-dashed border-line bg-ink-900 px-3 py-5 text-sm text-mist-300 transition hover:border-lotus-400/50"
            >
              {uploading ? <><Loader2 className="size-4 animate-spin" /> Uploading…</> : f.url ? <><Check className="size-4 text-emerald-300" /> {f.fileName || "File attached"} — tap to replace</> : <><UploadCloud className="size-4" /> Click or drag a file (image, video, PDF, doc, audio, zip, apk — max 25 MB)</>}
              <input ref={fileRef} type="file" className="hidden" onChange={(e) => { upload(e.target.files?.[0]); e.currentTarget.value = ""; }} />
            </div>
            {f.url && f.type === "image" && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={withBase(f.url)} alt="" className="mt-2 max-h-40 rounded-lg border border-white/10 object-contain" />
            )}
          </div>

          {/* Basics */}
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block"><span className="text-xs font-semibold text-mist-300">Title</span>
              <input value={f.title} onChange={(e) => set("title", e.target.value)} className={cn(field, "mt-1")} placeholder="e.g. Diwali Offer" />
            </label>
            <label className="block"><span className="text-xs font-semibold text-mist-300">Category</span>
              <input value={f.category} onChange={(e) => set("category", e.target.value)} list="upload-cats" className={cn(field, "mt-1")} placeholder="e.g. Festival Wishes" />
              <datalist id="upload-cats">{categories.map((c) => <option key={c} value={c} />)}</datalist>
            </label>
            <label className="block"><span className="text-xs font-semibold text-mist-300">Subtitle</span>
              <input value={f.subtitle ?? ""} onChange={(e) => set("subtitle", e.target.value)} className={cn(field, "mt-1")} />
            </label>
            <label className="block"><span className="text-xs font-semibold text-mist-300">Priority (higher shows first)</span>
              <input type="number" min={0} value={f.priority} onChange={(e) => set("priority", Math.max(0, Math.floor(Number(e.target.value) || 0)))} className={cn(field, "mt-1")} />
            </label>
          </div>
          <label className="block"><span className="text-xs font-semibold text-mist-300">Description (for popups)</span>
            <textarea value={f.description ?? ""} onChange={(e) => set("description", e.target.value)} rows={2} className="mt-1 w-full rounded-lg border border-line bg-ink-800 px-3 py-2 text-sm text-mist-100 outline-none focus:border-lotus-400" />
          </label>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block"><span className="text-xs font-semibold text-mist-300">Button text</span>
              <input value={f.buttonText ?? ""} onChange={(e) => set("buttonText", e.target.value)} className={cn(field, "mt-1")} placeholder="e.g. Play now" />
            </label>
            <label className="block"><span className="text-xs font-semibold text-mist-300">Button link (/wallet or https://…)</span>
              <input value={f.buttonUrl ?? ""} onChange={(e) => set("buttonUrl", e.target.value)} className={cn(field, "mt-1")} placeholder="/tournaments" />
            </label>
          </div>

          {/* Placements */}
          <div>
            <div className="mb-1 flex flex-wrap items-baseline justify-between gap-2">
              <span className="text-xs font-semibold text-mist-300">Show on</span>
              <span className={cn("text-[11px]", f.placements.length ? "text-mist-500" : "font-semibold text-amber-300")}>
                {f.placements.length
                  ? `${f.placements.length} area${f.placements.length === 1 ? "" : "s"} selected`
                  : "Nothing selected — this won't appear anywhere"}
              </span>
            </div>
            <div className="space-y-2">
              {PLACEMENT_GROUPS.map((g) => (
                <div key={g.group}>
                  <div className="mb-1 text-[10px] font-bold uppercase tracking-wide text-mist-500">{g.group}</div>
                  <div className="flex flex-wrap gap-1.5">
                    {g.items.map((p) => (
                      <button key={p.key} onClick={() => togglePlacement(p.key)} className={cn("rounded-full px-3 py-1 text-xs font-semibold transition", f.placements.includes(p.key) ? "bg-lotus-500/20 text-lotus-200 ring-1 ring-lotus-400/50" : "bg-white/5 text-mist-400 hover:text-mist-200")}>{p.label}</button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
            <p className="mt-2 text-[11px] text-mist-500">
              A banner appears <b className="text-mist-400">only</b> in the areas ticked above. Tick every area you want it in.
            </p>
          </div>

          {/* Audience */}
          <div className="rounded-xl border border-line bg-ink-900/50 p-3">
            <div className="mb-2 text-xs font-semibold text-mist-300">Audience</div>
            <div className="flex flex-wrap gap-1.5">
              {GROUPS.map((g) => (
                <button key={g.key} onClick={() => toggleGroup(g.key)} className={cn("rounded-full px-3 py-1 text-xs font-semibold transition", (f.audience.groups ?? []).includes(g.key) ? "bg-emerald-500/15 text-emerald-300 ring-1 ring-emerald-400/40" : "bg-white/5 text-mist-400 hover:text-mist-200")}>{g.label}</button>
              ))}
            </div>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <label className="block"><span className="text-[11px] text-mist-400">Minimum level (0 = any)</span>
                <input type="number" min={0} value={f.audience.minLevel ?? 0} onChange={(e) => setAud({ minLevel: Math.max(0, Math.floor(Number(e.target.value) || 0)) })} className={cn(field, "mt-1")} />
              </label>
              <label className="block"><span className="text-[11px] text-mist-400">Countries (comma-separated, optional)</span>
                <input value={countriesText} onChange={(e) => setAud({ countries: e.target.value.split(",").map((s) => s.trim()).filter(Boolean) })} className={cn(field, "mt-1")} placeholder="Saudi Arabia, India" />
              </label>
            </div>
            <label className="mt-3 block"><span className="text-[11px] text-mist-400">Specific user IDs only (comma-separated — overrides the groups above)</span>
              <input value={idsText} onChange={(e) => setAud({ userIds: e.target.value.split(",").map((s) => s.trim()).filter(Boolean) })} className={cn(field, "mt-1")} placeholder="LC-10234, LC-10567" />
            </label>
          </div>

          {/* Schedule + appearance */}
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block"><span className="text-xs font-semibold text-mist-300">Show from (optional)</span>
              <input type="datetime-local" value={f.startAt ? f.startAt.slice(0, 16) : ""} onChange={(e) => set("startAt", e.target.value ? new Date(e.target.value).toISOString() : undefined)} className={cn(field, "mt-1")} />
            </label>
            <label className="block"><span className="text-xs font-semibold text-mist-300">Hide after (optional)</span>
              <input type="datetime-local" value={f.endAt ? f.endAt.slice(0, 16) : ""} onChange={(e) => set("endAt", e.target.value ? new Date(e.target.value).toISOString() : undefined)} className={cn(field, "mt-1")} />
            </label>
            <label className="block"><span className="text-xs font-semibold text-mist-300">Background colour (optional)</span>
              <input value={f.bgColor ?? ""} onChange={(e) => set("bgColor", e.target.value)} className={cn(field, "mt-1")} placeholder="#1a1030" />
            </label>
            <label className="block"><span className="text-xs font-semibold text-mist-300">Text colour (optional)</span>
              <input value={f.textColor ?? ""} onChange={(e) => set("textColor", e.target.value)} className={cn(field, "mt-1")} placeholder="#ffffff" />
            </label>
          </div>

          <div className="flex flex-wrap items-center gap-4">
            <label className="flex items-center gap-2 text-sm text-mist-300">
              <input type="checkbox" checked={f.dismissible !== false} onChange={(e) => set("dismissible", e.target.checked)} className="size-4 accent-lotus-500" /> Users can close it
            </label>
            <label className="flex items-center gap-2 text-sm text-mist-300">Status
              <select value={f.status} onChange={(e) => set("status", e.target.value as Upload["status"])} className="h-9 rounded-lg border border-line bg-ink-800 px-2 text-sm text-mist-100 outline-none">
                <option value="draft">Draft (hidden)</option>
                <option value="published">Published (live)</option>
                <option value="archived">Archived</option>
              </select>
            </label>
          </div>
        </div>

        <div className="sticky bottom-0 flex justify-end gap-2 border-t border-white/8 bg-ink-850 p-4">
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button onClick={save} disabled={saving || uploading}>{saving ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />} {initial.id ? "Save changes" : "Create"}</Button>
        </div>
      </div>
    </div>
  );
}
