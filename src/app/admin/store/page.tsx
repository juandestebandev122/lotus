"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import { useConfig, saveConfig } from "@/lib/config";
import { withBase } from "@/lib/base-path";
import { cn } from "@/lib/cn";
import { NAME_EFFECTS, saleActive, effectiveStorePrice, type StoreItem, type StoreKind } from "@/lib/store";
import { adminListAgenciesLite, type AgencyLite } from "@/lib/agency";
import { fetchAdminUsers, type AdminUser } from "@/lib/admin";
import { ShoppingBag, Plus, Save, Trash2, Upload, Inbox, ExternalLink, Check, X, Search, Copy, Download, BarChart3, SlidersHorizontal, Sparkles, Dices, LayoutGrid, CircleDot } from "lucide-react";

type Req = { id: string; userId: string; userName: string; kind: string; text: string; image?: string; status: string; at: string; note?: string; decidedBy?: string };
type Hist = { id: string; userName: string; frameName: string; price: number; validityDays: number; at: string; source: string; kind?: string };

const KINDS: { v: StoreKind; label: string }[] = [
  { v: "overlay", label: "Overlay" },
  { v: "background", label: "Profile Background" },
  { v: "nameEffect", label: "Name Effect" },
  { v: "badge", label: "Badge" },
];
const VALIDITY = [
  { v: 0, label: "Permanent" }, { v: 1, label: "1 day" }, { v: 3, label: "3 days" }, { v: 7, label: "7 days" }, { v: 15, label: "15 days" },
  { v: 30, label: "30 days" }, { v: 60, label: "60 days" }, { v: 90, label: "90 days" }, { v: 180, label: "180 days" }, { v: 365, label: "365 days" },
];
const PURCHASE_LIMITS: { v: StoreItem["purchaseLimit"] | ""; label: string }[] = [
  { v: "", label: "Unlimited" }, { v: "once", label: "One-time only" }, { v: "daily", label: "Once per day" },
  { v: "weekly", label: "Once per week" }, { v: "monthly", label: "Once per month" }, { v: "lifetime", label: "Once per lifetime" },
];
// The visibility/merchandising flags an admin can toggle on an item.
const FLAGS: { k: "featured" | "newArrival" | "trending" | "comingSoon" | "limitedEdition" | "displayOnly"; label: string; on: string }[] = [
  { k: "featured", label: "Featured", on: "bg-gold-500/20 text-gold-300" },
  { k: "newArrival", label: "New", on: "bg-emerald-500/20 text-emerald-300" },
  { k: "trending", label: "Trending", on: "bg-pink-500/20 text-pink-300" },
  { k: "limitedEdition", label: "Limited", on: "bg-fuchsia-500/20 text-fuchsia-300" },
  { k: "comingSoon", label: "Coming soon", on: "bg-sky-500/20 text-sky-300" },
  { k: "displayOnly", label: "Display only (not for sale)", on: "bg-white/15 text-mist-200" },
];

// Store Items admin — the catalog for backgrounds / name effects / badges,
// plus the user "request an item" queue and the purchase history.
// (Profile FRAMES have their own dedicated page: Admin → Avatar Frames.)
export default function AdminStorePage() {
  const { toast } = useToast();
  const { config, loading, reload } = useConfig();
  // Admin-managed store categories (config.categories, scope "store", enabled).
  const storeCats = ((config.categories ?? []) as { name: string; scope: string; enabled?: boolean; order?: number }[])
    .filter((c) => c.scope === "store" && c.enabled !== false).sort((a, b) => (a.order ?? 0) - (b.order ?? 0)).map((c) => c.name);
  const [items, setItems] = useState<StoreItem[]>([]);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);
  const uploadForRef = useRef<string>("");

  const [requests, setRequests] = useState<Req[]>([]);
  const [history, setHistory] = useState<Hist[]>([]);

  useEffect(() => {
    if (loading) return;
    setItems(((config.storeItems ?? []) as StoreItem[]).map((i) => ({ ...i })));
  }, [loading, config]);

  const loadAdmin = useCallback(async () => {
    try {
      const res = await fetch(withBase("/api/admin/store"), { credentials: "include", cache: "no-store" });
      const d = await res.json();
      if (res.ok) { setRequests(d.requests ?? []); setHistory(d.history ?? []); }
    } catch { /* keep old */ }
  }, []);
  useEffect(() => { void loadAdmin(); }, [loadAdmin]);

  const save = async (list = items) => {
    setSaving(true);
    const res = await saveConfig({ storeItems: list });
    setSaving(false);
    if (res.ok) { setItems(list); await reload(); toast("Store saved — live for all users.", "success"); }
    else toast(res.error ?? "Could not save", "error");
  };

  const upd = (id: string, patch: Partial<StoreItem>) => setItems((list) => list.map((i) => (i.id === id ? { ...i, ...patch } : i)));
  // Agency-scoped visibility: restrict an item to members of chosen agencies.
  const [agencies, setAgencies] = useState<AgencyLite[]>([]);
  useEffect(() => { adminListAgenciesLite().then(setAgencies).catch(() => {}); }, []);
  const toggleItemAgency = (item: StoreItem, agId: string) => {
    const cur = item.agencyIds ?? [];
    const next = cur.includes(agId) ? cur.filter((a) => a !== agId) : [...cur, agId];
    upd(item.id, { agencyIds: next.length ? next : undefined });
  };
  // Selected-user visibility: restrict an item to specific users (also drives "Invitation only").
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [userQuery, setUserQuery] = useState("");
  useEffect(() => { fetchAdminUsers().then(setUsers).catch(() => {}); }, []);
  const toggleItemUser = (item: StoreItem, uid: string) => {
    const cur = item.userIds ?? [];
    const next = cur.includes(uid) ? cur.filter((u) => u !== uid) : [...cur, uid];
    upd(item.id, { userIds: next.length ? next : undefined });
  };
  const remove = (id: string) => { if (confirm("Remove this item from the store? Members who bought it keep it until it expires.")) setItems((list) => list.filter((i) => i.id !== id)); };
  const newId = () => `st-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 5)}`;
  const addItem = (kind: StoreKind) => setItems((list) => [...list, {
    id: newId(),
    kind, name: KINDS.find((k) => k.v === kind)?.label ?? "Item",
    style: kind === "nameEffect" ? "gold" : undefined,
    // When the list is filtered to a real category, file the new item there so it stays
    // visible and lands "inside" that category straight away.
    category: catFilter !== "all" && catFilter !== "__none__" ? catFilter : undefined,
    price: 100, enabled: false, badge: "New", validityDays: 0, order: 0,
  }]);
  const duplicate = (id: string) => setItems((list) => {
    const src = list.find((i) => i.id === id);
    if (!src) return list;
    return [...list, { ...src, id: newId(), name: `${src.name} (copy)`, enabled: false }];
  });

  // Search / filter / bulk-select
  const [query, setQuery] = useState("");
  const [kindFilter, setKindFilter] = useState<StoreKind | "all">("all");
  const [statusFilter, setStatusFilter] = useState<"all" | "live" | "hidden" | "archived" | "sale">("all");
  // Category filter — "all", a category name, or "__none__" (items with no category).
  // A ?category=<name> link (e.g. from the Categories page) pre-selects it on load.
  const [catFilter, setCatFilter] = useState<string>("all");
  useEffect(() => {
    const p = new URLSearchParams(window.location.search).get("category");
    if (p) setCatFilter(p);
  }, []);
  const [sel, setSel] = useState<Set<string>>(new Set());
  const toggleSel = (id: string) => setSel((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const bulk = (patch: Partial<StoreItem>) => { setItems((list) => list.map((i) => (sel.has(i.id) ? { ...i, ...patch } : i))); };
  const bulkDelete = () => { if (!confirm(`Remove ${sel.size} selected item(s)? Members keep what they bought until it expires.`)) return; setItems((list) => list.filter((i) => !sel.has(i.id))); setSel(new Set()); };

  const uploadImage = async (files: FileList | null) => {
    const file = files?.[0];
    const forId = uploadForRef.current;
    if (!file || !forId) return;
    setUploading(forId);
    const fd = new FormData();
    fd.append("file", file);
    try {
      const res = await fetch(withBase("/api/admin/tokens"), { method: "POST", body: fd, credentials: "include" });
      const d = await res.json();
      if (res.ok && d.url) { upd(forId, { image: d.url as string }); toast("Image uploaded — press Save to make it live.", "success"); }
      else toast(d.error ?? "Upload failed", "error");
    } catch { toast("Upload failed", "error"); }
    setUploading("");
    if (fileRef.current) fileRef.current.value = "";
  };

  // Assign (grant) an item to a specific user or to everyone.
  const [assignItem, setAssignItem] = useState("");
  const [assignTarget, setAssignTarget] = useState("");
  const [assignAll, setAssignAll] = useState(false);
  const [assigning, setAssigning] = useState(false);
  const assign = async () => {
    if (!assignItem) { toast("Pick an item to assign", "error"); return; }
    if (!assignAll && !assignTarget.trim()) { toast("Enter a user ID / username, or choose All users", "error"); return; }
    setAssigning(true);
    try {
      const res = await fetch(withBase("/api/admin/store"), { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "assign", itemId: assignItem, target: assignAll ? "all" : assignTarget.trim() }) });
      const d = await res.json().catch(() => ({}));
      if (res.ok) { toast(`Granted to ${d.count ?? 0} user(s) — they were notified`, "success"); setAssignTarget(""); void loadAdmin(); }
      else toast(d.error ?? "Could not assign", "error");
    } catch { toast("Could not assign", "error"); }
    setAssigning(false);
  };

  const decide = async (requestId: string, decision: "approved" | "rejected" | "completed") => {
    const note = decision === "rejected" ? (window.prompt("Optional note to the user:", "") ?? "") : "";
    const res = await fetch(withBase("/api/admin/store"), { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ requestId, decision, note }) });
    const d = await res.json().catch(() => ({}));
    if (res.ok) { toast(`Request ${decision} — the user was notified`, "success"); void loadAdmin(); }
    else toast(d.error ?? "Could not decide", "error");
  };

  const field = "h-9 rounded-lg border border-line bg-ink-900 px-2.5 text-sm text-mist-100 outline-none focus:border-lotus-400";

  // Filtered + sorted view for the list.
  const shown = [...items]
    .filter((i) => kindFilter === "all" || i.kind === kindFilter)
    .filter((i) => catFilter === "all" || (catFilter === "__none__" ? !i.category : (i.category ?? "") === catFilter))
    .filter((i) => {
      if (statusFilter === "live") return i.enabled && !i.archived;
      if (statusFilter === "hidden") return !i.enabled && !i.archived;
      if (statusFilter === "archived") return !!i.archived;
      if (statusFilter === "sale") return saleActive(i);
      return true;
    })
    .filter((i) => { const q = query.trim().toLowerCase(); return !q || `${i.name} ${i.category ?? ""} ${i.badge ?? ""}`.toLowerCase().includes(q); })
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));

  // Sales statistics from the purchase history.
  const stats = (() => {
    const total = history.length;
    const revenue = history.reduce((s, h) => s + (h.price || 0), 0);
    const byItem = new Map<string, { name: string; count: number; coins: number }>();
    for (const h of history) { const e = byItem.get(h.frameName) ?? { name: h.frameName, count: 0, coins: 0 }; e.count++; e.coins += h.price || 0; byItem.set(h.frameName, e); }
    const top = [...byItem.values()].sort((a, b) => b.count - a.count).slice(0, 8);
    return { total, revenue, top };
  })();
  const exportCsv = () => {
    const rows = [["When", "User", "Item", "Kind", "Coins", "ValidityDays"], ...history.map((h) => [h.at, h.userName, h.frameName, h.kind ?? "", String(h.price), String(h.validityDays)])];
    const csv = rows.map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(",")).join("\n");
    const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8;" })); a.download = `store-sales-${new Date().toISOString().slice(0, 10)}.csv`; a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  };

  return (
    <div className="space-y-5 pb-24">
      <div>
        <h1 className="flex items-center gap-2 font-display text-2xl font-extrabold text-mist-100"><ShoppingBag className="size-6 text-lotus-300" /> Store Items</h1>
        <p className="mt-1 text-sm text-mist-400">
          Backgrounds, name effects and badges that members buy with coins in their profile Store. Prices, validity,
          VIP-only and visibility are all yours to set — changes apply instantly.
          Profile <b>frames</b> have their own page: <Link href="/admin/frames" className="font-semibold text-lotus-300 hover:underline">Avatar Frames <ExternalLink className="inline size-3" /></Link>.
          Manage the category names in <Link href="/admin/categories" className="font-semibold text-lotus-300 hover:underline">Categories <ExternalLink className="inline size-3" /></Link>, then use the <b>category filter</b> below to work inside one.
        </p>
      </div>

      <Card className="p-4">
        <h2 className="mb-2 text-sm font-semibold text-mist-100">Game cosmetics and frames are separate sections</h2>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { href: "/admin/frames", label: "Frames", icon: Sparkles },
            { href: "/admin/dice-models", label: "Dice", icon: Dices },
            { href: "/admin/game-board", label: "Boards", icon: LayoutGrid },
            { href: "/admin/tokens", label: "Tokens", icon: CircleDot },
          ].map((x) => (
            <Link key={x.href} href={x.href} className="group flex items-center gap-2 rounded-xl border border-line bg-ink-900/40 px-3 py-2.5 text-sm font-semibold text-mist-200 transition hover:border-lotus-400/30 hover:bg-white/[0.04]">
              <x.icon className="size-4 text-lotus-300" />
              <span className="flex-1">{x.label}</span>
              <ExternalLink className="size-3.5 text-mist-500 transition group-hover:text-lotus-300" />
            </Link>
          ))}
        </div>
      </Card>

      <input ref={fileRef} type="file" accept="image/png,image/webp,image/gif,image/jpeg" className="hidden" onChange={(e) => void uploadImage(e.target.files)} />

      <div className="flex flex-wrap gap-2">
        {KINDS.map((k) => (
          <Button key={k.v} variant="secondary" size="sm" onClick={() => addItem(k.v)}><Plus className="size-4" /> Add {k.label}</Button>
        ))}
        <Button size="sm" onClick={() => save()} disabled={saving}><Save className="size-4" /> {saving ? "Saving…" : "Save store"}</Button>
      </div>

      {/* Statistics */}
      {stats.total > 0 && (
        <Card className="p-4">
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
            <h2 className="flex items-center gap-2 font-semibold text-mist-100"><BarChart3 className="size-4 text-lotus-300" /> Sales &amp; revenue</h2>
            <Button size="sm" variant="secondary" onClick={exportCsv}><Download className="size-4" /> Export CSV</Button>
          </div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <div className="rounded-xl border border-line bg-ink-900/50 p-3"><div className="font-display text-2xl font-extrabold tabular-nums text-mist-100">{stats.total.toLocaleString("en-SA")}</div><div className="text-[11px] text-mist-500">Total purchases</div></div>
            <div className="rounded-xl border border-line bg-ink-900/50 p-3"><div className="font-display text-2xl font-extrabold tabular-nums text-gold-300">{stats.revenue.toLocaleString("en-SA")}</div><div className="text-[11px] text-mist-500">Coins revenue</div></div>
            <div className="col-span-2 rounded-xl border border-line bg-ink-900/50 p-3">
              <div className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-mist-500">Most purchased</div>
              <div className="space-y-0.5">{stats.top.slice(0, 4).map((t) => (
                <div key={t.name} className="flex items-center justify-between gap-2 text-xs"><span className="truncate text-mist-200">{t.name}</span><span className="shrink-0 text-mist-500">{t.count}× · {t.coins.toLocaleString("en-SA")} 🪙</span></div>
              ))}</div>
            </div>
          </div>
        </Card>
      )}

      {/* Search + filters + bulk */}
      <div className="space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex min-w-48 flex-1 items-center gap-2 rounded-xl border border-line bg-ink-900 px-3">
            <Search className="size-4 text-mist-500" />
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search items by name, category, label" className="w-full bg-transparent py-2 text-sm text-mist-100 outline-none" />
          </div>
          <select value={kindFilter} onChange={(e) => setKindFilter(e.target.value as StoreKind | "all")} className={cn(field, "w-40")}>
            <option value="all">All kinds</option>
            {KINDS.map((k) => <option key={k.v} value={k.v}>{k.label}</option>)}
          </select>
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)} className={cn(field, "w-36")}>
            <option value="all">All status</option>
            <option value="live">In store</option>
            <option value="hidden">Hidden</option>
            <option value="archived">Archived</option>
            <option value="sale">On sale</option>
          </select>
          {(storeCats.length > 0 || (catFilter !== "all" && catFilter !== "__none__")) && (
            <select value={catFilter} onChange={(e) => setCatFilter(e.target.value)} className={cn(field, "w-44")} title="Show only items in a category">
              <option value="all">All categories</option>
              {storeCats.map((c) => <option key={c} value={c}>{c}</option>)}
              {/* A deep-linked category that is disabled/removed still shows as a valid option. */}
              {catFilter !== "all" && catFilter !== "__none__" && !storeCats.includes(catFilter) && <option value={catFilter}>{catFilter}</option>}
              <option value="__none__">(Uncategorised)</option>
            </select>
          )}
        </div>
        {catFilter !== "all" && (
          <div className="flex items-center gap-2 text-xs text-mist-400">
            <span>Showing items in <b className="text-mist-200">{catFilter === "__none__" ? "no category" : catFilter}</b>.</span>
            <button onClick={() => setCatFilter("all")} className="font-semibold text-lotus-300 hover:text-lotus-200">Clear</button>
          </div>
        )}
        {sel.size > 0 && (
          <div className="flex flex-wrap items-center gap-2 rounded-xl border border-lotus-400/30 bg-lotus-500/[0.06] px-3 py-2 text-xs">
            <span className="font-semibold text-mist-100">{sel.size} selected</span>
            <button onClick={() => bulk({ enabled: true })} className="rounded-lg bg-emerald-500/15 px-2.5 py-1 font-semibold text-emerald-300 hover:bg-emerald-500/25">Publish</button>
            <button onClick={() => bulk({ enabled: false })} className="rounded-lg bg-white/8 px-2.5 py-1 font-semibold text-mist-300 hover:bg-white/12">Hide</button>
            <button onClick={() => bulk({ archived: true, enabled: false })} className="rounded-lg bg-white/8 px-2.5 py-1 font-semibold text-mist-300 hover:bg-white/12">Archive</button>
            <button onClick={() => bulk({ archived: false })} className="rounded-lg bg-white/8 px-2.5 py-1 font-semibold text-mist-300 hover:bg-white/12">Restore</button>
            <button onClick={bulkDelete} className="rounded-lg bg-rose-500/15 px-2.5 py-1 font-semibold text-rose-300 hover:bg-rose-500/25">Delete</button>
            <button onClick={() => setSel(new Set())} className="ml-auto text-mist-400 hover:text-mist-100">clear</button>
          </div>
        )}
      </div>

      {items.length === 0 ? (
        <Card className="p-10 text-center text-sm text-mist-500">No items yet — add a background, name effect or badge above.</Card>
      ) : shown.length === 0 ? (
        <Card className="p-8 text-center text-sm text-mist-500">No items match your search / filter.</Card>
      ) : (
        <div className="grid gap-3 lg:grid-cols-2">
          {shown.map((i) => (
            <Card key={i.id} className={cn("space-y-2.5 p-4", !i.enabled && "opacity-70")}>
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-full bg-lotus-500/15 px-2 py-0.5 text-[10px] font-bold uppercase text-lotus-300">{KINDS.find((k) => k.v === i.kind)?.label}</span>
                <input value={i.name} onChange={(e) => upd(i.id, { name: e.target.value.slice(0, 40) })} placeholder="Item name" className={cn(field, "w-44 flex-1")} />
                <label className="flex items-center gap-1 text-xs font-semibold text-mist-400">🪙
                  <input type="number" min={0} value={i.price} onChange={(e) => upd(i.id, { price: Math.max(0, Math.floor(Number(e.target.value) || 0)) })} className={cn(field, "w-20")} title="Coin price (0 = free)" />
                </label>
              </div>

              {/* Kind-specific content: image upload OR name-effect style. */}
              {i.kind === "nameEffect" ? (
                <div className="flex flex-wrap items-center gap-2">
                  <select value={i.style ?? "gold"} onChange={(e) => upd(i.id, { style: e.target.value })} className={cn(field, "w-40")}>
                    {Object.entries(NAME_EFFECTS).map(([key, fx]) => <option key={key} value={key}>{fx.label}</option>)}
                  </select>
                  <span className="rounded-lg bg-ink-900 px-3 py-1.5 text-base" style={i.style ? NAME_EFFECTS[i.style]?.css : undefined}>Player Name</span>
                </div>
              ) : (
                <div className="flex items-center gap-3">
                  {i.image ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={withBase(i.image)} alt="" className={cn("rounded-lg border border-line object-cover", i.kind === "badge" ? "size-12 object-contain" : "h-14 w-24")} />
                  ) : (
                    <span className="grid h-14 w-24 place-items-center rounded-lg border border-dashed border-line text-[10px] text-mist-500">no image</span>
                  )}
                  <Button size="sm" variant="secondary" onClick={() => { uploadForRef.current = i.id; fileRef.current?.click(); }} disabled={uploading === i.id}>
                    <Upload className="size-3.5" /> {uploading === i.id ? "Uploading…" : i.image ? "Replace image" : "Upload image"}
                  </Button>
                </div>
              )}

              <input value={i.description ?? ""} onChange={(e) => upd(i.id, { description: e.target.value.slice(0, 160) })} placeholder="Short description (optional)" className={cn(field, "w-full")} />

              {/* Category (admin-managed, config.categories → scope "store"). Groups
                  the item for members browsing the store by category. */}
              {storeCats.length > 0 && (
                <label className="flex items-center gap-1.5 text-xs text-mist-400">Category
                  <select value={i.category ?? ""} onChange={(e) => upd(i.id, { category: e.target.value || undefined })} className={cn(field, "w-44")}>
                    <option value="">— none —</option>
                    {storeCats.map((c) => <option key={c} value={c}>{c}</option>)}
                  </select>
                  <Link href="/admin/categories" className="text-[10px] text-lotus-300 underline underline-offset-2 hover:text-lotus-200">manage</Link>
                </label>
              )}

              <div className="flex flex-wrap items-center gap-2 text-xs text-mist-400">
                <label className="flex items-center gap-1">Validity
                  <select value={VALIDITY.some((v) => v.v === (i.validityDays ?? 0)) ? String(i.validityDays ?? 0) : "__custom"} onChange={(e) => upd(i.id, { validityDays: e.target.value === "__custom" ? 15 : Math.max(0, Math.floor(Number(e.target.value))) })} className={cn(field, "w-28")}>
                    {VALIDITY.map((v) => <option key={v.v} value={v.v}>{v.label}</option>)}
                    <option value="__custom">Custom…</option>
                  </select>
                </label>
                {!VALIDITY.some((v) => v.v === (i.validityDays ?? 0)) && (
                  <label className="flex items-center gap-1">
                    <input type="number" min={1} value={i.validityDays ?? 15} onChange={(e) => upd(i.id, { validityDays: Math.max(1, Math.floor(Number(e.target.value) || 1)) })} className={cn(field, "w-20")} /> days
                  </label>
                )}
                <label className="flex items-center gap-1">Label
                  <input value={i.badge ?? ""} onChange={(e) => upd(i.id, { badge: e.target.value.slice(0, 20) })} placeholder="New / Limited" className={cn(field, "w-24")} />
                </label>
                <label className="flex items-center gap-1">Order
                  <input type="number" min={0} value={i.order ?? 0} onChange={(e) => upd(i.id, { order: Math.max(0, Math.floor(Number(e.target.value) || 0)) })} className={cn(field, "w-16")} />
                </label>
              </div>

              {/* Sale / discount (flash sale, limited-time). */}
              <div className="flex flex-wrap items-center gap-2 rounded-lg bg-ink-900/40 px-2.5 py-2 text-xs text-mist-400">
                <span className="flex items-center gap-1 font-semibold"><SlidersHorizontal className="size-3.5" /> Sale</span>
                <label className="flex items-center gap-1">🔖
                  <input type="number" min={0} value={i.salePrice ?? ""} onChange={(e) => upd(i.id, { salePrice: e.target.value === "" ? undefined : Math.max(0, Math.floor(Number(e.target.value) || 0)) })} placeholder="price" className={cn(field, "w-20")} title="Sale price (leave blank = no sale)" />
                </label>
                <label className="flex items-center gap-1">from
                  <input type="date" value={(i.saleStart ?? "").slice(0, 10)} onChange={(e) => upd(i.id, { saleStart: e.target.value || undefined })} className={cn(field, "w-32")} />
                </label>
                <label className="flex items-center gap-1">to
                  <input type="date" value={(i.saleEnd ?? "").slice(0, 10)} onChange={(e) => upd(i.id, { saleEnd: e.target.value || undefined })} className={cn(field, "w-32")} />
                </label>
                {saleActive(i) && <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-bold text-emerald-300">ON SALE</span>}
              </div>

              {/* Inventory + purchase limit + level eligibility. */}
              <div className="flex flex-wrap items-center gap-2 text-xs text-mist-400">
                <label className="flex items-center gap-1">Stock
                  <input type="number" min={0} value={i.stock ?? ""} onChange={(e) => upd(i.id, { stock: e.target.value === "" ? undefined : Math.max(0, Math.floor(Number(e.target.value) || 0)) })} placeholder="∞" className={cn(field, "w-16")} title="Remaining stock (blank = unlimited)" />
                </label>
                <label className="flex items-center gap-1">Limit
                  <select value={i.purchaseLimit ?? ""} onChange={(e) => upd(i.id, { purchaseLimit: (e.target.value || undefined) as StoreItem["purchaseLimit"] })} className={cn(field, "w-36")}>
                    {PURCHASE_LIMITS.map((p) => <option key={p.v ?? "u"} value={p.v ?? ""}>{p.label}</option>)}
                  </select>
                </label>
                <label className="flex items-center gap-1">Lvl
                  <input type="number" min={0} value={i.minLevel ?? ""} onChange={(e) => upd(i.id, { minLevel: e.target.value === "" ? undefined : Math.max(1, Math.floor(Number(e.target.value) || 0)) })} placeholder="min" className={cn(field, "w-14")} />
                  <span>–</span>
                  <input type="number" min={0} value={i.maxLevel ?? ""} onChange={(e) => upd(i.id, { maxLevel: e.target.value === "" ? undefined : Math.max(1, Math.floor(Number(e.target.value) || 0)) })} placeholder="max" className={cn(field, "w-14")} />
                </label>
              </div>

              {/* Visibility / merchandising flags. */}
              <div className="flex flex-wrap gap-1.5">
                {FLAGS.map((f) => (
                  <button key={f.k} onClick={() => upd(i.id, { [f.k]: !i[f.k] })} className={cn("rounded-full px-2.5 py-1 text-[11px] font-bold transition", i[f.k] ? f.on : "bg-white/8 text-mist-400 hover:text-mist-100")}>{f.label}</button>
                ))}
              </div>

              {/* Agency-scoped visibility: restrict this item to specific agencies. */}
              {agencies.length > 0 && (
                <details className="rounded-lg border border-line bg-ink-900/40 p-2 text-xs">
                  <summary className="cursor-pointer text-mist-400">Agencies: <b className="text-mist-200">{i.agencyIds?.length ? `${i.agencyIds.length} selected` : "All users"}</b></summary>
                  <div className="mt-1.5 max-h-32 space-y-0.5 overflow-y-auto">
                    {agencies.map((a) => (
                      <label key={a.id} className="flex items-center gap-2 rounded px-1 py-0.5 hover:bg-white/[0.04]">
                        <input type="checkbox" checked={(i.agencyIds ?? []).includes(a.id)} onChange={() => toggleItemAgency(i, a.id)} className="size-3.5 accent-lotus-500" />
                        <span className="text-mist-200">{a.name}</span> <span className="text-[10px] text-mist-500">{a.agencyId}</span>
                      </label>
                    ))}
                  </div>
                  <p className="mt-1 text-[10px] text-mist-500">None checked = visible to everyone. Checked = <b>only</b> those agencies&apos; members can see &amp; buy it.</p>
                </details>
              )}

              {/* Selected-user visibility (also = "Invitation only"): restrict to specific users. */}
              {users.length > 0 && (
                <details className="rounded-lg border border-line bg-ink-900/40 p-2 text-xs">
                  <summary className="cursor-pointer text-mist-400">Selected users: <b className="text-mist-200">{i.userIds?.length ? `${i.userIds.length} selected` : "Everyone"}</b></summary>
                  <div className="mt-1.5">
                    <input value={userQuery} onChange={(e) => setUserQuery(e.target.value)} placeholder="Search name / username / ID…" className={cn(field, "mb-1.5 w-full py-1 text-[11px]")} />
                    <div className="max-h-40 space-y-0.5 overflow-y-auto">
                      {/* Always show already-selected users first, then search matches. */}
                      {users
                        .filter((u) => {
                          const q = userQuery.trim().toLowerCase();
                          if ((i.userIds ?? []).includes(u.id)) return true;
                          if (!q) return false;
                          return u.fullName?.toLowerCase().includes(q) || u.username?.toLowerCase().includes(q) || (u.publicId ?? "").toLowerCase().includes(q);
                        })
                        .slice(0, 60)
                        .map((u) => (
                          <label key={u.id} className="flex items-center gap-2 rounded px-1 py-0.5 hover:bg-white/[0.04]">
                            <input type="checkbox" checked={(i.userIds ?? []).includes(u.id)} onChange={() => toggleItemUser(i, u.id)} className="size-3.5 accent-lotus-500" />
                            <span className="text-mist-200">{u.fullName || u.username}</span> <span className="text-[10px] text-mist-500">@{u.username}{u.publicId ? ` · ${u.publicId}` : ""}</span>
                          </label>
                        ))}
                      {userQuery.trim() === "" && !(i.userIds?.length) && <p className="px-1 py-1 text-[10px] text-mist-500">Type above to find users to select.</p>}
                    </div>
                  </div>
                  <p className="mt-1 text-[10px] text-mist-500">None selected = everyone. Selected = <b>only</b> those users (use with <b>Show to all</b> below for &quot;invitation only&quot;).</p>
                </details>
              )}

              {/* Independent visibility-vs-purchase, gender, VIP-free & first-buy discount. */}
              <div className="grid gap-2 rounded-lg border border-line bg-ink-900/40 p-2 text-xs sm:grid-cols-2">
                <label className="flex flex-col gap-1">
                  <span className="text-[10px] font-semibold uppercase tracking-wide text-mist-500">When restricted</span>
                  <select value={i.restrictMode ?? "hide"} onChange={(e) => upd(i.id, { restrictMode: e.target.value === "show" ? "show" : undefined })} className={cn(field, "py-1 text-[11px]")}>
                    <option value="hide">Hide from non-eligible users</option>
                    <option value="show">Show to all (only eligible can buy)</option>
                  </select>
                </label>
                <label className="flex flex-col gap-1">
                  <span className="text-[10px] font-semibold uppercase tracking-wide text-mist-500">Gender</span>
                  <select value={i.gender ?? ""} onChange={(e) => upd(i.id, { gender: e.target.value === "male" || e.target.value === "female" ? e.target.value : undefined })} className={cn(field, "py-1 text-[11px]")}>
                    <option value="">Everyone</option>
                    <option value="male">Male only</option>
                    <option value="female">Female only</option>
                  </select>
                </label>
                <label className="flex items-center gap-2">
                  <input type="checkbox" checked={!!i.freeForVip} onChange={() => upd(i.id, { freeForVip: !i.freeForVip })} className="size-3.5 accent-lotus-500" />
                  <span className="text-mist-200">Free for VIP members</span>
                </label>
                <label className="flex items-center gap-2">
                  <span className="text-mist-200">First-purchase discount</span>
                  <input type="number" min={0} max={100} value={i.firstBuyDiscountPct ?? ""} onChange={(e) => { const n = parseInt(e.target.value, 10); upd(i.id, { firstBuyDiscountPct: isFinite(n) && n > 0 ? Math.min(100, n) : undefined }); }} className={cn(field, "w-16 py-1 text-[11px]")} placeholder="0" />
                  <span className="text-mist-500">%</span>
                </label>
              </div>

              <div className="flex items-center gap-2 border-t border-white/5 pt-2.5">
                <input type="checkbox" checked={sel.has(i.id)} onChange={() => toggleSel(i.id)} className="size-4 accent-lotus-500" title="Select for bulk actions" />
                <button onClick={() => upd(i.id, { enabled: !i.enabled })} className={cn("rounded-full px-2.5 py-1 text-[11px] font-bold transition", i.enabled ? "bg-emerald-500/15 text-emerald-300" : "bg-white/8 text-mist-400")}>
                  {i.enabled ? "In the store" : "Hidden"}
                </button>
                <button onClick={() => upd(i.id, { vipOnly: !i.vipOnly })} className={cn("rounded-full px-2.5 py-1 text-[11px] font-bold transition", i.vipOnly ? "bg-fuchsia-500/20 text-fuchsia-300" : "bg-white/8 text-mist-400")} title="Only VIP members (set on the user in Admin → Users) can buy">
                  {i.vipOnly ? "VIP only" : "All users"}
                </button>
                {i.archived && <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-bold text-amber-300">ARCHIVED</span>}
                <button onClick={() => duplicate(i.id)} className="ml-auto grid size-8 place-items-center rounded-lg text-mist-500 hover:bg-white/8 hover:text-mist-200" title="Duplicate"><Copy className="size-4" /></button>
                <button onClick={() => remove(i.id)} className="grid size-8 place-items-center rounded-lg text-mist-500 hover:bg-rose-500/10 hover:text-rose-300" title="Remove"><Trash2 className="size-4" /></button>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Assign / gift an item to a user or everyone */}
      <Card className="p-4">
        <h2 className="mb-2 flex items-center gap-2 font-semibold text-mist-100"><Plus className="size-4 text-lotus-300" /> Assign an item to users</h2>
        <p className="mb-3 text-xs text-mist-500">Grant any item free of charge to one member (by User ID / username) or to everyone — they&apos;re notified and it lands in their Store.</p>
        <div className="flex flex-wrap items-center gap-2">
          <select value={assignItem} onChange={(e) => setAssignItem(e.target.value)} className={cn(field, "min-w-48 flex-1")}>
            <option value="">— choose an item —</option>
            {[...items].sort((a, b) => (a.order ?? 0) - (b.order ?? 0)).map((i) => <option key={i.id} value={i.id}>{i.name} ({KINDS.find((k) => k.v === i.kind)?.label})</option>)}
          </select>
          <input value={assignTarget} onChange={(e) => setAssignTarget(e.target.value)} disabled={assignAll} placeholder="User ID / username" className={cn(field, "w-48", assignAll && "opacity-40")} />
          <button onClick={() => setAssignAll((v) => !v)} className={cn("rounded-full px-3 py-1.5 text-xs font-bold transition", assignAll ? "bg-lotus-500 text-white" : "border border-line bg-ink-800 text-mist-400 hover:text-mist-100")}>All users</button>
          <Button size="sm" onClick={assign} disabled={assigning}><Check className="size-4" /> {assigning ? "Assigning…" : "Assign"}</Button>
        </div>
      </Card>

      {/* User item requests */}
      <Card className="p-0">
        <div className="border-b border-white/5 px-5 py-4">
          <h2 className="flex items-center gap-2 font-display text-lg font-bold text-mist-100"><Inbox className="size-5 text-lotus-300" /> Item requests from members</h2>
          <p className="mt-0.5 text-xs text-mist-500">Members can ask for new stickers, frames or effects from their Store page. Approve = you plan to add it (they&apos;re notified); then create the item above or in the relevant section.</p>
        </div>
        {requests.length === 0 ? (
          <p className="px-5 py-6 text-center text-sm text-mist-500">No requests yet.</p>
        ) : (
          <div className="divide-y divide-white/5">
            {requests.map((r) => (
              <div key={r.id} className="flex flex-wrap items-center gap-2.5 px-5 py-3">
                <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-bold capitalize", r.status === "completed" ? "bg-sky-500/15 text-sky-300" : r.status === "approved" ? "bg-emerald-500/15 text-emerald-300" : r.status === "rejected" ? "bg-rose-500/15 text-rose-300" : r.status === "cancelled" ? "bg-white/[0.08] text-mist-400" : "bg-amber-500/15 text-amber-300")}>{r.status}</span>
                <span className="rounded-full bg-white/[0.06] px-2 py-0.5 text-[10px] capitalize text-mist-400">{r.kind}</span>
                {r.image && (
                  <a href={r.image} target="_blank" rel="noopener noreferrer" title="View attached reference">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={r.image} alt="" className="size-9 rounded border border-line object-cover" />
                  </a>
                )}
                <div className="min-w-0 flex-1">
                  <p className="text-sm text-mist-100">{r.text}</p>
                  <p className="text-[10px] text-mist-500">{r.userName} · {new Date(r.at).toLocaleString("en-SA", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</p>
                </div>
                {r.status === "pending" && (
                  <div className="flex gap-1.5">
                    <button onClick={() => void decide(r.id, "approved")} className="grid size-8 place-items-center rounded-lg bg-emerald-500/15 text-emerald-300 hover:bg-emerald-500/25" title="Approve"><Check className="size-4" /></button>
                    <button onClick={() => void decide(r.id, "rejected")} className="grid size-8 place-items-center rounded-lg bg-rose-500/10 text-rose-300 hover:bg-rose-500/20" title="Reject"><X className="size-4" /></button>
                  </div>
                )}
                {r.status === "approved" && (
                  <button onClick={() => void decide(r.id, "completed")} className="rounded-lg bg-sky-500/15 px-2.5 py-1.5 text-[11px] font-bold text-sky-300 hover:bg-sky-500/25" title="Mark the requested item as delivered — the user is notified">Mark completed</button>
                )}
                {r.note && <span className="w-full text-[10px] text-mist-500">Note: {r.note}</span>}
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Purchase history (non-frame items; frames history is on Avatar Frames) */}
      {history.length > 0 && (
        <Card className="p-0">
          <div className="border-b border-white/5 px-5 py-4">
            <h2 className="font-display text-lg font-bold text-mist-100">Purchases</h2>
          </div>
          <div className="max-h-80 overflow-y-auto">
            <table className="w-full text-xs">
              <thead className="sticky top-0 bg-ink-850"><tr className="text-left uppercase tracking-wide text-mist-500">
                <th className="px-5 py-2 font-semibold">When</th>
                <th className="px-5 py-2 font-semibold">User</th>
                <th className="px-5 py-2 font-semibold">Item</th>
                <th className="px-5 py-2 font-semibold">Kind</th>
                <th className="px-5 py-2 text-right font-semibold">Coins</th>
                <th className="px-5 py-2 font-semibold">Validity</th>
              </tr></thead>
              <tbody>
                {history.map((h) => (
                  <tr key={h.id} className="border-b border-white/5 last:border-0">
                    <td className="whitespace-nowrap px-5 py-2 text-mist-400">{new Date(h.at).toLocaleString("en-SA", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</td>
                    <td className="px-5 py-2 text-mist-100">{h.userName}</td>
                    <td className="px-5 py-2 text-mist-200">{h.frameName}</td>
                    <td className="px-5 py-2 capitalize text-mist-400">{h.kind}</td>
                    <td className="px-5 py-2 text-right tabular-nums text-gold-300">{h.price > 0 ? h.price.toLocaleString("en-SA") : "free"}</td>
                    <td className="px-5 py-2 text-mist-400">{h.validityDays > 0 ? `${h.validityDays}d` : "permanent"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}
