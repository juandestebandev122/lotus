"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import { useConfig, saveConfig } from "@/lib/config";
import { withBase } from "@/lib/base-path";
import { cn } from "@/lib/cn";
import { Avatar } from "@/components/ui/Avatar";
import { UserPicker } from "@/components/admin/UserPicker";
import { CircleUserRound, Plus, Save, Trash2, Upload, Gift, Megaphone, BarChart3, RefreshCw } from "lucide-react";

type Frame = {
  id: string; name: string; image: string; price: number; enabled: boolean;
  category?: string; badge?: string; description?: string;
  validityDays?: number; order?: number; launchAt?: string; endAt?: string;
};
type Report = {
  totalFrames: number; enabledFrames: number; totalPurchases: number; totalCoins: number; adminGifts: number;
  topFrames: { frameId: string; name: string; purchases: number; coins: number; activeWearers: number }[];
  history: { id: string; userId: string; userName: string; frameId: string; frameName: string; price: number; validityDays: number; at: string; expiresAt?: string | null; source: string }[];
};

const CATEGORIES = ["Normal", "Premium", "VIP", "Animated", "Festival", "Event", "Ranked", "Limited Time", "Seasonal", "Exclusive"];
const BADGES = ["", "New", "Limited", "VIP", "Premium", "Festival", "Popular"];
const VALIDITY: { v: number; label: string }[] = [
  { v: 0, label: "Permanent" }, { v: 1, label: "1 day" }, { v: 7, label: "7 days" }, { v: 15, label: "15 days" },
  { v: 30, label: "30 days" }, { v: 90, label: "90 days" }, { v: 365, label: "1 year" },
];

// Profile Frame Store — full admin control: upload/replace/delete, enable/hide,
// name/category/price, validity (auto-expiry), launch & end dates, display
// order, labels, assign-to-user, announce, and purchase reports.
export default function AdminFramesPage() {
  const { toast } = useToast();
  const { config, loading, reload } = useConfig();
  const [frames, setFrames] = useState<Frame[]>([]);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const replaceRef = useRef<HTMLInputElement>(null);
  const [replacing, setReplacing] = useState("");

  // Assign-to-user tool
  const [aTarget, setATarget] = useState("");
  const [aFrame, setAFrame] = useState("");
  const [aBusy, setABusy] = useState(false);

  // Reports
  const [report, setReport] = useState<Report | null>(null);
  const [rFrom, setRFrom] = useState("");
  const [rTo, setRTo] = useState("");

  useEffect(() => {
    if (loading) return;
    setFrames((config.avatarFrames ?? []).map((f) => ({ ...f })));
  }, [loading, config]);

  const loadReport = useCallback(async () => {
    const qs = new URLSearchParams();
    if (rFrom) qs.set("from", rFrom);
    if (rTo) qs.set("to", rTo);
    try {
      const res = await fetch(withBase(`/api/admin/frames?${qs}`), { credentials: "include", cache: "no-store" });
      const d = await res.json();
      if (res.ok) setReport(d as Report);
    } catch { /* keep old */ }
  }, [rFrom, rTo]);
  useEffect(() => { void loadReport(); }, [loadReport]);

  const save = async (list = frames) => {
    setSaving(true);
    const res = await saveConfig({ avatarFrames: list });
    setSaving(false);
    if (res.ok) { setFrames(list); await reload(); toast("Frame store saved — live for all users.", "success"); }
    else toast(res.error ?? "Could not save", "error");
  };

  const uploadFiles = async (files: FileList | null, replaceId?: string) => {
    const list = Array.from(files ?? []);
    if (list.length === 0) return;
    setUploading(true);
    for (const file of list) {
      const fd = new FormData();
      fd.append("file", file);
      try {
        const res = await fetch(withBase("/api/admin/tokens"), { method: "POST", body: fd, credentials: "include" });
        const d = await res.json();
        if (res.ok && d.url) {
          if (replaceId) {
            setFrames((f) => f.map((x) => (x.id === replaceId ? { ...x, image: d.url as string } : x)));
            toast("Image replaced — press Save to make it live.", "success");
            break; // replace uses only the first file
          }
          setFrames((f) => [...f, {
            id: `frame-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
            name: file.name.replace(/\.[^.]+$/, "").slice(0, 40) || "Frame",
            image: d.url as string, price: 100, enabled: true, category: "Normal", badge: "New", validityDays: 0, order: 0,
          }]);
        } else toast(d.error ?? `Upload failed: ${file.name}`, "error");
      } catch { toast(`Upload failed: ${file.name}`, "error"); }
    }
    setUploading(false);
    if (fileRef.current) fileRef.current.value = "";
    if (replaceRef.current) replaceRef.current.value = "";
    setReplacing("");
  };

  const upd = (id: string, patch: Partial<Frame>) => setFrames((list) => list.map((f) => (f.id === id ? { ...f, ...patch } : f)));
  const remove = (id: string) => { if (confirm("Remove this frame from the store? Members who own it keep it until it expires.")) setFrames((list) => list.filter((f) => f.id !== id)); };

  const assign = async () => {
    if (!aTarget.trim() || !aFrame) { toast("Pick a frame and enter a username / member ID", "error"); return; }
    setABusy(true);
    const res = await fetch(withBase("/api/admin/frames"), { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "assign", target: aTarget.trim(), frameId: aFrame }) });
    const d = await res.json().catch(() => ({}));
    setABusy(false);
    if (res.ok) { toast(`Frame assigned to ${d.userName} 🎁 (they were notified)`, "success"); setATarget(""); void loadReport(); }
    else toast(d.error ?? "Could not assign", "error");
  };

  const announce = async (frameId: string) => {
    if (!confirm("Send an in-app notification about this frame to EVERY active member?")) return;
    const res = await fetch(withBase("/api/admin/frames"), { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "announce", frameId }) });
    const d = await res.json().catch(() => ({}));
    if (res.ok) toast(`Announced to ${d.notified} members 📣`, "success");
    else toast(d.error ?? "Could not announce", "error");
  };

  const field = "h-9 rounded-lg border border-line bg-ink-900 px-2.5 text-sm text-mist-100 outline-none focus:border-lotus-400";
  const isoToLocal = (v?: string) => (v ? new Date(v).toISOString().slice(0, 10) : "");

  return (
    <div className="space-y-5 pb-24">
      <div>
        <h1 className="flex items-center gap-2 font-display text-2xl font-extrabold text-mist-100"><CircleUserRound className="size-6 text-lotus-300" /> Profile Frame Store</h1>
        <p className="mt-1 text-sm text-mist-400">
          Full control of the frame store: upload/replace, price, category, labels, validity (auto-expiry),
          launch/end dates, display order, assign to users, announcements and purchase reports. Users buy &amp; wear
          frames at <span className="font-semibold text-mist-200">Customize your style → Profile Frame Store</span>.
        </p>
      </div>

      {/* Upload */}
      <Card className="flex flex-wrap items-center gap-3 p-4">
        <input ref={fileRef} type="file" accept="image/png,image/webp,image/gif" multiple className="hidden" onChange={(e) => void uploadFiles(e.target.files)} />
        <input ref={replaceRef} type="file" accept="image/png,image/webp,image/gif" className="hidden" onChange={(e) => void uploadFiles(e.target.files, replacing)} />
        <Button onClick={() => fileRef.current?.click()} disabled={uploading}><Upload className="size-4" /> {uploading ? "Uploading…" : "Upload frame images"}</Button>
        <span className="text-xs text-mist-500">Transparent PNG / WEBP / animated GIF, up to 32 MB, several at once. New frames arrive with the “New” label — adjust and Save.</span>
      </Card>

      {/* How duration works — clears up the common "everyone expires on the same date" confusion. */}
      <div className="rounded-xl border border-sky-400/20 bg-sky-500/5 px-4 py-3 text-xs text-mist-300">
        <b className="text-sky-200">How expiry works (per user, automatic):</b> <b className="text-mist-100">Validity</b> is how long <i>each buyer</i> keeps the frame, counted from <b>their own purchase date &amp; time</b> — so someone who buys a 30-day frame on the 1st keeps it until the 31st, and someone who buys on the 15th keeps it until the 14th of next month. Each purchase expires on its own date, automatically, and then the store shows them <b>Buy Again</b>. <b className="text-mist-100">Permanent</b> never expires. The <b>Launch</b> / <b>Ends</b> dates are only the <i>sale window</i> (when the frame is available to buy) — they do <b>NOT</b> change the expiry of anyone who already owns it.
      </div>

      {/* Catalog */}
      {frames.length === 0 ? (
        <Card className="p-10 text-center text-sm text-mist-500">No frames yet — upload the first frame image above.</Card>
      ) : (
        <div className="grid gap-3 lg:grid-cols-2">
          {[...frames].sort((a, b) => (a.order ?? 0) - (b.order ?? 0)).map((f) => (
            <Card key={f.id} className={cn("space-y-2.5 p-4", !f.enabled && "opacity-70")}>
              <div className="flex items-start gap-3">
                <div className="flex shrink-0 flex-col items-center gap-1.5">
                  <Avatar name="Preview" size="xl" frameImage={f.image ? withBase(f.image) : undefined} />
                  <button onClick={() => { setReplacing(f.id); replaceRef.current?.click(); }} className="text-[10px] font-semibold text-lotus-300 hover:underline">Replace image</button>
                </div>
                <div className="min-w-0 flex-1 space-y-2">
                  <div className="flex flex-wrap gap-2">
                    <input value={f.name} onChange={(e) => upd(f.id, { name: e.target.value.slice(0, 40) })} placeholder="Frame name" className={cn(field, "w-40 flex-1")} />
                    <label className="flex items-center gap-1 text-xs font-semibold text-mist-400">🪙
                      <input type="number" min={0} value={f.price} onChange={(e) => upd(f.id, { price: Math.max(0, Math.floor(Number(e.target.value) || 0)) })} className={cn(field, "w-20")} title="Coin price (0 = free)" />
                    </label>
                  </div>
                  <input value={f.description ?? ""} onChange={(e) => upd(f.id, { description: e.target.value.slice(0, 160) })} placeholder="Short promo text (optional)" className={cn(field, "w-full")} />
                  <div className="flex flex-wrap items-center gap-2">
                    <select value={CATEGORIES.includes(f.category ?? "") ? f.category : "__custom"} onChange={(e) => upd(f.id, { category: e.target.value === "__custom" ? (f.category && !CATEGORIES.includes(f.category) ? f.category : "Custom") : e.target.value })} className={cn(field, "w-32")} title="Category">
                      {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
                      <option value="__custom">Custom…</option>
                    </select>
                    {!CATEGORIES.includes(f.category ?? "Normal") && (
                      <input value={f.category ?? ""} onChange={(e) => upd(f.id, { category: e.target.value.slice(0, 30) })} placeholder="Custom category" className={cn(field, "w-28")} />
                    )}
                    <select value={BADGES.includes(f.badge ?? "") ? (f.badge ?? "") : "__custom"} onChange={(e) => upd(f.id, { badge: e.target.value === "__custom" ? (f.badge && !BADGES.includes(f.badge) ? f.badge : "Special") : e.target.value })} className={cn(field, "w-28")} title="Label shown on the store card">
                      {BADGES.map((b) => <option key={b} value={b}>{b || "— no label —"}</option>)}
                      <option value="__custom">Custom…</option>
                    </select>
                    {!!f.badge && !BADGES.includes(f.badge) && (
                      <input value={f.badge} onChange={(e) => upd(f.id, { badge: e.target.value.slice(0, 20) })} placeholder="Custom label" className={cn(field, "w-24")} />
                    )}
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <label className="flex items-center gap-1 text-xs font-semibold text-mist-400">Validity
                      <select value={VALIDITY.some((v) => v.v === (f.validityDays ?? 0)) ? String(f.validityDays ?? 0) : "__custom"} onChange={(e) => upd(f.id, { validityDays: e.target.value === "__custom" ? 45 : Math.max(0, Math.floor(Number(e.target.value))) })} className={cn(field, "w-28")}>
                        {VALIDITY.map((v) => <option key={v.v} value={v.v}>{v.label}</option>)}
                        <option value="__custom">Custom…</option>
                      </select>
                    </label>
                    {!VALIDITY.some((v) => v.v === (f.validityDays ?? 0)) && (
                      <label className="flex items-center gap-1 text-xs text-mist-400">
                        <input type="number" min={1} value={f.validityDays ?? 45} onChange={(e) => upd(f.id, { validityDays: Math.max(1, Math.floor(Number(e.target.value) || 1)) })} className={cn(field, "w-20")} /> days
                      </label>
                    )}
                    <label className="flex items-center gap-1 text-xs font-semibold text-mist-400">Order
                      <input type="number" min={0} value={f.order ?? 0} onChange={(e) => upd(f.id, { order: Math.max(0, Math.floor(Number(e.target.value) || 0)) })} className={cn(field, "w-16")} title="Display order (lower shows first)" />
                    </label>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 text-xs text-mist-400">
                    <label className="flex items-center gap-1">Launch
                      <input type="date" value={isoToLocal(f.launchAt)} onChange={(e) => upd(f.id, { launchAt: e.target.value ? new Date(e.target.value).toISOString() : undefined })} className={cn(field, "w-36")} title="Hidden from the store before this date" />
                    </label>
                    <label className="flex items-center gap-1">Ends
                      <input type="date" value={isoToLocal(f.endAt)} onChange={(e) => upd(f.id, { endAt: e.target.value ? new Date(e.target.value).toISOString() : undefined })} className={cn(field, "w-36")} title="Hidden from the store after this date (owners keep theirs)" />
                    </label>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2 border-t border-white/5 pt-2.5">
                <button onClick={() => upd(f.id, { enabled: !f.enabled })} className={cn("rounded-full px-2.5 py-1 text-[11px] font-bold transition", f.enabled ? "bg-emerald-500/15 text-emerald-300" : "bg-white/8 text-mist-400")}>
                  {f.enabled ? "In the store" : "Hidden"}
                </button>
                <button onClick={() => void announce(f.id)} className="inline-flex items-center gap-1 rounded-full bg-lotus-500/10 px-2.5 py-1 text-[11px] font-bold text-lotus-300 transition hover:bg-lotus-500/20" title="Notify every member about this frame">
                  <Megaphone className="size-3" /> Announce
                </button>
                <button onClick={() => remove(f.id)} className="ml-auto grid size-8 place-items-center rounded-lg text-mist-500 hover:bg-rose-500/10 hover:text-rose-300" title="Remove"><Trash2 className="size-4" /></button>
              </div>
            </Card>
          ))}
        </div>
      )}
      <div className="flex flex-wrap gap-2">
        <Button onClick={() => save()} disabled={saving}><Save className="size-4" /> {saving ? "Saving…" : "Save frame store"}</Button>
        <Button variant="secondary" onClick={() => setFrames((f) => [...f, { id: `frame-${Date.now().toString(36)}`, name: "New frame", image: "", price: 100, enabled: false, category: "Normal", validityDays: 0, order: 0 }])}>
          <Plus className="size-4" /> Add empty row
        </Button>
      </div>

      {/* Assign to a specific user */}
      <Card className="space-y-3 p-5">
        <h2 className="flex items-center gap-2 font-display text-lg font-bold text-mist-100"><Gift className="size-5 text-lotus-300" /> Assign a frame to a user</h2>
        <p className="text-sm text-mist-400">Gives the frame for free (its validity still applies) — the member is notified. Great for VIPs, winners and events.</p>
        <div className="flex flex-wrap items-end gap-3">
          <label className="text-sm"><span className="mb-1 block text-xs font-semibold text-mist-400">Username or member ID</span>
            <UserPicker value={aTarget} onPick={(v) => setATarget(v)} placeholder="Type a name, @username or ID…" className="w-64" />
          </label>
          <label className="text-sm"><span className="mb-1 block text-xs font-semibold text-mist-400">Frame</span>
            <select value={aFrame} onChange={(e) => setAFrame(e.target.value)} className={cn(field, "w-48")}>
              <option value="">— choose a frame —</option>
              {frames.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
            </select>
          </label>
          <Button size="sm" onClick={() => void assign()} disabled={aBusy}><Gift className="size-4" /> {aBusy ? "Assigning…" : "Assign frame"}</Button>
        </div>
      </Card>

      {/* Reports */}
      <Card className="p-0">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/5 px-5 py-4">
          <h2 className="flex items-center gap-2 font-display text-lg font-bold text-mist-100"><BarChart3 className="size-5 text-lotus-300" /> Frame sales report</h2>
          <div className="flex flex-wrap items-center gap-2 text-xs text-mist-400">
            <label className="flex items-center gap-1">From <input type="date" value={rFrom} onChange={(e) => setRFrom(e.target.value)} className={cn(field, "w-36")} /></label>
            <label className="flex items-center gap-1">To <input type="date" value={rTo} onChange={(e) => setRTo(e.target.value)} className={cn(field, "w-36")} /></label>
            <button onClick={() => void loadReport()} className="inline-flex items-center gap-1 font-semibold text-lotus-300 hover:text-lotus-200"><RefreshCw className="size-3.5" /> Refresh</button>
          </div>
        </div>
        {report && (
          <>
            <div className="grid grid-cols-2 gap-3 p-5 sm:grid-cols-5">
              {[
                ["Frames", report.totalFrames], ["In the store", report.enabledFrames],
                ["Purchases", report.totalPurchases], ["Coins earned", report.totalCoins], ["Admin gifts", report.adminGifts],
              ].map(([label, v]) => (
                <div key={label as string} className="rounded-xl border border-white/5 bg-white/[0.03] px-3 py-2.5">
                  <div className="text-lg font-extrabold tabular-nums text-mist-50">{(v as number).toLocaleString("en-SA")}</div>
                  <div className="text-[11px] text-mist-500">{label as string}</div>
                </div>
              ))}
            </div>
            {report.topFrames.length > 0 && (
              <div className="overflow-x-auto border-t border-white/5">
                <table className="w-full text-sm">
                  <thead><tr className="border-b border-white/5 text-left text-xs uppercase tracking-wide text-mist-500">
                    <th className="px-5 py-2.5 font-semibold">Frame</th>
                    <th className="px-5 py-2.5 text-right font-semibold">Purchases</th>
                    <th className="px-5 py-2.5 text-right font-semibold">Coins</th>
                    <th className="px-5 py-2.5 text-right font-semibold">Wearing now</th>
                  </tr></thead>
                  <tbody>
                    {report.topFrames.map((f) => (
                      <tr key={f.frameId} className="border-b border-white/5 last:border-0">
                        <td className="px-5 py-2.5 text-mist-100">{f.name}</td>
                        <td className="px-5 py-2.5 text-right tabular-nums text-mist-300">{f.purchases}</td>
                        <td className="px-5 py-2.5 text-right font-semibold tabular-nums text-gold-300">{f.coins.toLocaleString("en-SA")}</td>
                        <td className="px-5 py-2.5 text-right tabular-nums text-emerald-300">{f.activeWearers}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            {report.history.length > 0 && (
              <div className="max-h-80 overflow-y-auto border-t border-white/5">
                <table className="w-full text-xs">
                  <thead className="sticky top-0 bg-ink-850"><tr className="text-left uppercase tracking-wide text-mist-500">
                    <th className="px-5 py-2 font-semibold">When</th>
                    <th className="px-5 py-2 font-semibold">User</th>
                    <th className="px-5 py-2 font-semibold">Frame</th>
                    <th className="px-5 py-2 text-right font-semibold">Coins</th>
                    <th className="px-5 py-2 font-semibold">Validity</th>
                    <th className="px-5 py-2 font-semibold">Source</th>
                  </tr></thead>
                  <tbody>
                    {report.history.map((h) => (
                      <tr key={h.id} className="border-b border-white/5 last:border-0">
                        <td className="whitespace-nowrap px-5 py-2 text-mist-400">{new Date(h.at).toLocaleString("en-SA", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</td>
                        <td className="px-5 py-2 text-mist-100">{h.userName}</td>
                        <td className="px-5 py-2 text-mist-200">{h.frameName}</td>
                        <td className="px-5 py-2 text-right tabular-nums text-gold-300">{h.price > 0 ? h.price.toLocaleString("en-SA") : "free"}</td>
                        <td className="px-5 py-2 text-mist-400">{h.validityDays > 0 ? `${h.validityDays}d` : "permanent"}</td>
                        <td className="px-5 py-2">{h.source === "admin" ? <span className="rounded-full bg-lotus-500/15 px-1.5 py-0.5 text-[10px] font-semibold text-lotus-300">gift</span> : <span className="text-mist-500">purchase</span>}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
      </Card>
    </div>
  );
}
