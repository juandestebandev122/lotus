"use client";

import { useCallback, useEffect, useState } from "react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/cn";
import {
  fetchStorageOverview, fetchUserStorageFiles, saveStorageSettings, setStorageUserLimit,
  setStorageVip, setStorageAgencyLimit, deleteStorageFiles, cleanupOrphanStorage,
  type StorageOverview, type StorageUserRow, type StorageFileRow, type StorageSettings, type StorageCats,
} from "@/lib/admin";
import {
  HardDrive, RefreshCw, Download, Search, Trash2, Image as ImageIcon, Film, Music, FileText, Layers,
  Crown, Building2, Settings2, AlertTriangle, Sparkles, X, ShieldAlert, Eye, ExternalLink,
} from "lucide-react";
import { withBase } from "@/lib/base-path";

const CAT_META: Record<keyof StorageCats, { label: string; icon: typeof ImageIcon; tone: string }> = {
  photo: { label: "Photos", icon: ImageIcon, tone: "text-sky-300 bg-sky-500/15" },
  video: { label: "Videos", icon: Film, tone: "text-fuchsia-300 bg-fuchsia-500/15" },
  audio: { label: "Audio", icon: Music, tone: "text-emerald-300 bg-emerald-500/15" },
  document: { label: "Documents", icon: FileText, tone: "text-amber-300 bg-amber-500/15" },
  other: { label: "Other", icon: Layers, tone: "text-mist-300 bg-white/[0.06]" },
};
const MB = 1024 * 1024;
function fmtBytes(n: number): string {
  if (!n) return "0 MB";
  if (n < MB) return `${(n / 1024).toFixed(0)} KB`;
  if (n < 1024 * MB) return `${(n / MB).toFixed(n < 10 * MB ? 1 : 0)} MB`;
  return `${(n / (1024 * MB)).toFixed(2)} GB`;
}
const num = (n: number) => (n ?? 0).toLocaleString("en-SA");
function pctTone(p: number): string { return p >= 100 ? "text-red-300" : p >= 90 ? "text-orange-300" : p >= 80 ? "text-amber-300" : "text-emerald-300"; }
function barTone(p: number): string { return p >= 100 ? "bg-red-400" : p >= 90 ? "bg-orange-400" : p >= 80 ? "bg-amber-400" : "bg-emerald-400"; }

export default function StoragePage() {
  const [ov, setOv] = useState<StorageOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [sort, setSort] = useState<"used" | "pct" | "name">("used");
  const [draft, setDraft] = useState<StorageSettings | null>(null);
  const [savingSettings, setSavingSettings] = useState(false);
  const [timeTab, setTimeTab] = useState<"daily" | "weekly" | "monthly">("daily");
  const [modalUser, setModalUser] = useState<StorageUserRow | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    fetchStorageOverview({ q, sort }).then((r) => { setOv(r); setDraft(r.settings); setLoading(false); });
  }, [q, sort]);
  useEffect(() => { load(); }, [sort]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { const t = setTimeout(load, 400); return () => clearTimeout(t); }, [q]); // eslint-disable-line react-hooks/exhaustive-deps

  const users = ov?.users ?? [];

  const saveSettings = async () => {
    if (!draft) return;
    setSavingSettings(true);
    await saveStorageSettings(draft);
    setSavingSettings(false);
    load();
  };

  const runCleanup = async () => {
    if (!ov?.settings.autoCleanupEnabled) { alert("Turn on 'Admin auto-cleanup' in settings first."); return; }
    if (!confirm(`Permanently delete ${num(ov.orphans.count)} orphaned file(s) and free ${fmtBytes(ov.orphans.bytes)}?`)) return;
    const r = await cleanupOrphanStorage();
    alert(r.ok ? `Removed ${num(r.count ?? 0)} file(s), freed ${fmtBytes(r.bytesFreed ?? 0)}.` : (r.error ?? "Failed"));
    load();
  };

  const setLimit = async (u: StorageUserRow) => {
    const cur = u.limitSource === "user" ? Math.round(u.limitBytes / MB) : "";
    const val = prompt(`Storage limit for ${u.userName} in MB (blank = use default/agency/VIP rule):`, String(cur));
    if (val === null) return;
    const mb = val.trim() === "" ? null : Math.max(0, Number(val));
    if (mb !== null && isNaN(mb)) { alert("Enter a number."); return; }
    await setStorageUserLimit(u.userId, mb);
    load();
  };
  const toggleVip = async (u: StorageUserRow) => { await setStorageVip(u.userId, !u.vip); load(); };
  const setAgencyLimit = async (agencyId: string, name: string, curBytes: number) => {
    const val = prompt(`Storage limit for agency "${name}" members, in MB (blank = default agency limit):`, String(Math.round(curBytes / MB)));
    if (val === null) return;
    const mb = val.trim() === "" ? null : Math.max(0, Number(val));
    if (mb !== null && isNaN(mb)) { alert("Enter a number."); return; }
    await setStorageAgencyLimit(agencyId, mb);
    load();
  };

  const exportCsv = () => {
    const cols = ["User ID", "Name", "Username", "Agency", "VIP", "Used", "Limit", "Usage %", "Photos", "Videos", "Audio", "Documents", "Files"];
    const rows = users.map((u) => [u.publicId, u.userName, u.username, u.agencyName ?? "", u.vip ? "Yes" : "", fmtBytes(u.usedBytes), fmtBytes(u.limitBytes), `${u.pct}%`, fmtBytes(u.byCategory.photo), fmtBytes(u.byCategory.video), fmtBytes(u.byCategory.audio), fmtBytes(u.byCategory.document), String(u.fileCount)]);
    const esc = (v: string) => `"${String(v).replace(/"/g, '""')}"`;
    const csv = [cols, ...rows].map((r) => r.map(esc).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob); a.download = `storage-report-${Date.now()}.csv`; a.click(); URL.revokeObjectURL(a.href);
  };

  const plat = ov?.platform;
  const catList = (["photo", "video", "audio", "document", "other"] as (keyof StorageCats)[]);
  const timeRows = ov?.time[timeTab] ?? [];

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3 print:hidden">
        <div>
          <h1 className="flex items-center gap-2 font-display text-2xl font-extrabold text-mist-100"><HardDrive className="size-6 text-lotus-300" /> Storage Management</h1>
          <p className="mt-1 text-sm text-mist-400">Track every user&apos;s storage (Photos, Videos, Audio, Documents), set limits, send warnings, clean up files and pull reports.</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="secondary" size="sm" onClick={load}><RefreshCw className="size-4" /> Refresh</Button>
          <Button variant="secondary" size="sm" onClick={exportCsv} disabled={users.length === 0}><Download className="size-4" /> Download report</Button>
        </div>
      </div>

      {/* Platform totals */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="p-5">
          <span className="grid size-11 place-items-center rounded-lg bg-lotus-500/12 text-lotus-300"><HardDrive className="size-5" /></span>
          <div className="mt-4 font-display text-3xl font-extrabold text-mist-100">{fmtBytes(plat?.totalBytes ?? 0)}</div>
          <div className="text-sm text-mist-400">Total platform storage</div>
        </Card>
        <Card className="p-5">
          <span className="grid size-11 place-items-center rounded-lg bg-sky-500/12 text-sky-300"><Layers className="size-5" /></span>
          <div className="mt-4 font-display text-3xl font-extrabold text-mist-100">{num(plat?.fileCount ?? 0)}</div>
          <div className="text-sm text-mist-400">Files stored · {num(plat?.userCount ?? 0)} users</div>
        </Card>
        <Card className="p-5">
          <span className="grid size-11 place-items-center rounded-lg bg-amber-500/12 text-amber-300"><AlertTriangle className="size-5" /></span>
          <div className="mt-4 font-display text-3xl font-extrabold text-mist-100">{fmtBytes(ov?.orphans.bytes ?? 0)}</div>
          <div className="text-sm text-mist-400">Orphaned / unused ({num(ov?.orphans.count ?? 0)} files)</div>
        </Card>
        <Card className="p-5">
          <div className="text-xs font-semibold uppercase tracking-wide text-mist-500">By type</div>
          <div className="mt-2 space-y-1.5">
            {catList.filter((c) => (plat?.byCategory[c] ?? 0) > 0).map((c) => {
              const M = CAT_META[c];
              return <div key={c} className="flex items-center justify-between text-xs"><span className={cn("inline-flex items-center gap-1 rounded px-1.5 py-0.5 font-semibold", M.tone)}><M.icon className="size-3" /> {M.label}</span><b className="text-mist-200">{fmtBytes(plat?.byCategory[c] ?? 0)}</b></div>;
            })}
            {catList.every((c) => (plat?.byCategory[c] ?? 0) === 0) && <div className="text-xs text-mist-500">No files yet.</div>}
          </div>
        </Card>
      </div>

      {/* Settings + On/Off controls */}
      {draft && (
        <Card className="p-5">
          <h2 className="flex items-center gap-2 text-sm font-bold text-mist-100"><Settings2 className="size-4 text-lotus-300" /> Storage settings &amp; controls</h2>
          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            <Toggle label="Enable storage limits" hint="Block uploads over the limit" on={draft.enabled} onChange={(v) => setDraft({ ...draft, enabled: v })} />
            <Toggle label="Automatic warning messages" hint="Notify users at 80 / 90 / 100%" on={draft.warningsEnabled} onChange={(v) => setDraft({ ...draft, warningsEnabled: v })} />
            <Toggle label="Admin auto-cleanup" hint="Allow one-click orphan cleanup" on={draft.autoCleanupEnabled} onChange={(v) => setDraft({ ...draft, autoCleanupEnabled: v })} />
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            <LimitInput label="All Users limit (MB)" value={draft.defaultLimitMB} onChange={(v) => setDraft({ ...draft, defaultLimitMB: v })} />
            <LimitInput label="VIP Users limit (MB)" value={draft.vipLimitMB} onChange={(v) => setDraft({ ...draft, vipLimitMB: v })} icon={<Crown className="size-3.5 text-gold-300" />} />
            <LimitInput label="Agency members limit (MB)" value={draft.agencyLimitMB} onChange={(v) => setDraft({ ...draft, agencyLimitMB: v })} icon={<Building2 className="size-3.5 text-fuchsia-300" />} />
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <Button size="sm" onClick={saveSettings} disabled={savingSettings}>{savingSettings ? "Saving…" : "Save settings"}</Button>
            <Button variant="secondary" size="sm" onClick={runCleanup} disabled={!ov?.orphans.count}><Sparkles className="size-4" /> Clean up orphaned files ({num(ov?.orphans.count ?? 0)})</Button>
            {!draft.enabled && <span className="inline-flex items-center gap-1 text-xs text-mist-500"><ShieldAlert className="size-3.5" /> Limits are OFF — uploads are never blocked until you enable them.</span>}
          </div>
        </Card>
      )}

      {/* Agency-wise report */}
      {(ov?.agencies?.length ?? 0) > 0 && (
        <Card className="p-5">
          <h2 className="flex items-center gap-2 text-sm font-bold text-mist-100"><Building2 className="size-4 text-fuchsia-300" /> Agency-wise storage</h2>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            {(ov?.agencies ?? []).map((a) => (
              <div key={a.agencyId} className="flex items-center justify-between rounded-lg border border-line bg-ink-800 px-3 py-2 text-sm">
                <span className="min-w-0"><b className="text-mist-100">{a.agencyName}</b> <span className="font-mono text-[10px] text-mist-500">{a.agencyPublicId}</span><span className="text-xs text-mist-500"> · {a.memberCount} members · {a.fileCount} files</span></span>
                <span className="flex items-center gap-2">
                  <b className="text-mist-200">{fmtBytes(a.bytes)}</b>
                  <Button variant="ghost" size="sm" onClick={() => setAgencyLimit(a.agencyId, a.agencyName, a.limitBytes)}>Limit: {fmtBytes(a.limitBytes)}</Button>
                </span>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Time reports */}
      <Card className="p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-sm font-bold text-mist-100">Storage added over time</h2>
          <div className="flex gap-1 rounded-lg border border-line bg-ink-800 p-1">
            {(["daily", "weekly", "monthly"] as const).map((t) => (
              <button key={t} onClick={() => setTimeTab(t)} className={cn("rounded-md px-3 py-1 text-xs font-semibold capitalize transition", timeTab === t ? "bg-lotus-500/20 text-lotus-200" : "text-mist-400 hover:text-mist-200")}>{t}</button>
            ))}
          </div>
        </div>
        <div className="mt-3 overflow-x-auto">
          {timeRows.length === 0 ? <p className="text-sm text-mist-500">No data for this period.</p> : (
            <div className="flex min-w-max gap-2">
              {timeRows.slice(0, 14).map((b) => (
                <div key={b.key} className="w-24 shrink-0 rounded-lg border border-line bg-ink-800 p-2 text-center">
                  <div className="text-[10px] text-mist-500">{b.key}</div>
                  <div className="mt-1 text-sm font-bold text-mist-100">{fmtBytes(b.bytes)}</div>
                  <div className="text-[10px] text-mist-500">{b.count} files</div>
                </div>
              ))}
            </div>
          )}
        </div>
      </Card>

      {/* Filters */}
      <div className="grid gap-2 sm:grid-cols-[1fr_auto] print:hidden">
        <div className="flex items-center gap-2 rounded-xl border border-line bg-ink-800 px-3">
          <Search className="size-4 text-mist-500" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search user by name, username, ID or agency…" className="h-10 w-full bg-transparent text-sm text-mist-100 outline-none placeholder:text-mist-500" />
        </div>
        <select value={sort} onChange={(e) => setSort(e.target.value as "used" | "pct" | "name")} className="h-10 rounded-xl border border-line bg-ink-800 px-3 text-sm text-mist-100 outline-none focus:border-lotus-400">
          <option value="used">Sort: Highest storage first</option>
          <option value="pct">Sort: Highest usage % first</option>
          <option value="name">Sort: Name (A–Z)</option>
        </select>
      </div>

      {/* User table */}
      <Card className="overflow-hidden p-0">
        <div className="px-5 py-3 text-xs text-mist-500">User storage {ov ? `(${num(ov.totalUsers)} users with files)` : ""}</div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-y border-white/5 text-left text-xs uppercase tracking-wide text-mist-500">
                <th className="px-5 py-3 font-semibold">User</th>
                <th className="px-5 py-3 font-semibold">Breakdown</th>
                <th className="px-5 py-3 font-semibold">Used / Limit</th>
                <th className="px-5 py-3 font-semibold">Usage</th>
                <th className="px-5 py-3 font-semibold">Files</th>
                <th className="px-5 py-3 font-semibold text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={6} className="px-5 py-10 text-center text-mist-500">Loading…</td></tr>
              ) : users.length === 0 ? (
                <tr><td colSpan={6} className="px-5 py-10 text-center text-mist-500">No user storage found.</td></tr>
              ) : users.map((u) => (
                <tr key={u.userId} className="border-b border-white/5 last:border-0 hover:bg-white/[0.03]">
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-1.5 font-semibold text-mist-100">{u.userName}{u.vip && <span title="VIP"><Crown className="size-3.5 text-gold-300" /></span>}</div>
                    <div className="text-[11px] text-mist-500">@{u.username} · {u.publicId}{u.agencyName && <span className="ml-1 text-fuchsia-300/80">🏛 {u.agencyName}</span>}</div>
                  </td>
                  <td className="px-5 py-3">
                    <div className="flex flex-wrap gap-1">
                      {(["photo", "video", "audio", "document"] as (keyof StorageCats)[]).filter((c) => u.byCategory[c] > 0).map((c) => {
                        const M = CAT_META[c];
                        return <span key={c} className={cn("inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-semibold", M.tone)}><M.icon className="size-2.5" /> {fmtBytes(u.byCategory[c])}</span>;
                      })}
                    </div>
                  </td>
                  <td className="px-5 py-3 whitespace-nowrap text-xs">
                    <b className="text-mist-100">{fmtBytes(u.usedBytes)}</b> <span className="text-mist-500">/ {fmtBytes(u.limitBytes)}</span>
                    <div className="text-[10px] text-mist-600">limit: {u.limitSource}</div>
                  </td>
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-2">
                      <div className="h-1.5 w-16 overflow-hidden rounded-full bg-white/10"><div className={cn("h-full rounded-full", barTone(u.pct))} style={{ width: `${Math.min(100, u.pct)}%` }} /></div>
                      <b className={cn("text-xs", pctTone(u.pct))}>{u.pct}%</b>
                    </div>
                  </td>
                  <td className="px-5 py-3 text-xs text-mist-300">{u.fileCount}</td>
                  <td className="px-5 py-3">
                    <div className="flex items-center justify-end gap-1">
                      <Button variant="ghost" size="sm" onClick={() => setModalUser(u)}>Files</Button>
                      <Button variant="ghost" size="sm" onClick={() => setLimit(u)}>Limit</Button>
                      <Button variant="ghost" size="sm" onClick={() => toggleVip(u)} className={u.vip ? "text-gold-300" : ""}>{u.vip ? "VIP ✓" : "VIP"}</Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
      <p className="text-[11px] text-mist-600 print:hidden">🔒 Storage figures are measured live from real uploaded files. Deleting a file here permanently removes it from the server.</p>

      {modalUser && <FilesModal user={modalUser} onClose={() => setModalUser(null)} onChanged={load} />}
    </div>
  );
}

function Toggle({ label, hint, on, onChange }: { label: string; hint: string; on: boolean; onChange: (v: boolean) => void }) {
  return (
    <button onClick={() => onChange(!on)} className={cn("flex items-center justify-between rounded-lg border px-3 py-2.5 text-left transition", on ? "border-lotus-400/50 bg-lotus-500/10" : "border-line bg-ink-800 hover:border-white/20")}>
      <span><div className="text-sm font-semibold text-mist-100">{label}</div><div className="text-[11px] text-mist-500">{hint}</div></span>
      <span className={cn("relative h-5 w-9 shrink-0 rounded-full transition", on ? "bg-lotus-500" : "bg-white/15")}><span className={cn("absolute top-0.5 size-4 rounded-full bg-white transition-all", on ? "left-[18px]" : "left-0.5")} /></span>
    </button>
  );
}
function LimitInput({ label, value, onChange, icon }: { label: string; value: number; onChange: (v: number) => void; icon?: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 flex items-center gap-1 text-[11px] font-semibold text-mist-400">{icon}{label}</span>
      <input type="number" min={0} value={value} onChange={(e) => onChange(Math.max(0, Number(e.target.value)))} className="h-10 w-full rounded-xl border border-line bg-ink-800 px-3 text-sm text-mist-100 outline-none focus:border-lotus-400" />
    </label>
  );
}

function FilesModal({ user, onClose, onChanged }: { user: StorageUserRow; onClose: () => void; onChanged: () => void }) {
  const [files, setFiles] = useState<StorageFileRow[] | null>(null);
  const [sel, setSel] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  // Search, type filter and an inline preview so the admin can actually look at
  // (and play) a file instead of only seeing its name and size.
  const [fq, setFq] = useState("");
  const [fcat, setFcat] = useState<"all" | keyof StorageCats>("all");
  const [preview, setPreview] = useState<string>("");
  useEffect(() => { fetchUserStorageFiles(user.userId).then(setFiles); }, [user.userId]);
  const toggle = (n: string) => setSel((s) => { const x = new Set(s); x.has(n) ? x.delete(n) : x.add(n); return x; });
  const every = files ?? [];
  const all = every.filter((f) => {
    if (fcat !== "all" && f.category !== fcat) return false;
    const s = fq.trim().toLowerCase();
    return !s || f.name.toLowerCase().includes(s);
  });
  const fileUrl = (n: string) => withBase(`/api/media/${encodeURIComponent(n)}`);
  const extOf = (n: string) => (n.split(".").pop() ?? "").toLowerCase();
  const kindOf = (f: StorageFileRow): "image" | "video" | "audio" | "other" => {
    if (f.category === "photo") return "image";
    if (f.category === "video") return "video";
    if (f.category === "audio") return "audio";
    const e = extOf(f.name);
    if (["png", "jpg", "jpeg", "webp", "gif", "bmp", "svg"].includes(e)) return "image";
    if (["mp4", "webm", "mov", "m4v", "mkv"].includes(e)) return "video";
    if (["mp3", "m4a", "ogg", "wav", "opus", "flac"].includes(e)) return "audio";
    return "other";
  };
  const del = async (names: string[]) => {
    if (!names.length) return;
    if (!confirm(`Permanently delete ${names.length} file(s) from ${user.userName}? This cannot be undone.`)) return;
    setBusy(true);
    const r = await deleteStorageFiles(names);
    setBusy(false);
    if (!r.ok) { alert(r.error ?? "Failed"); return; }
    setSel(new Set());
    setFiles((f) => (f ?? []).filter((x) => !names.includes(x.name)));
    onChanged();
  };
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={onClose}>
      <Card className="max-h-[85vh] w-full max-w-2xl overflow-hidden p-0" onClick={(e: React.MouseEvent) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-white/5 px-5 py-3">
          <div><h3 className="font-bold text-mist-100">{user.userName}&apos;s files</h3><p className="text-[11px] text-mist-500">{fmtBytes(user.usedBytes)} used · {all.length} of {every.length} files</p></div>
          <button onClick={onClose} className="text-mist-400 hover:text-mist-100"><X className="size-5" /></button>
        </div>
        {/* Search + type filter */}
        <div className="flex flex-wrap items-center gap-2 border-b border-white/5 px-5 py-2">
          <input value={fq} onChange={(e) => setFq(e.target.value)} placeholder="Search by file name…" className="h-8 min-w-[10rem] flex-1 rounded-lg border border-line bg-ink-900 px-2.5 text-xs text-mist-100 outline-none focus:border-lotus-400" />
          <div className="flex flex-wrap gap-1">
            {(["all", "photo", "video", "audio", "document", "other"] as const).map((c) => {
              const n = c === "all" ? every.length : every.filter((f) => f.category === c).length;
              return (
                <button key={c} onClick={() => setFcat(c)} className={cn("rounded-full px-2.5 py-1 text-[11px] font-semibold capitalize transition", fcat === c ? "bg-lotus-600 text-white" : "bg-white/[0.06] text-mist-300 hover:bg-white/[0.1]")}>
                  {c === "photo" ? "Photos" : c} {n > 0 && <span className="opacity-70">{n}</span>}
                </button>
              );
            })}
          </div>
        </div>
        <div className="flex items-center justify-between px-5 py-2 text-xs">
          <button onClick={() => setSel(sel.size === all.length ? new Set() : new Set(all.map((f) => f.name)))} className="text-lotus-300 hover:underline">{sel.size === all.length && all.length > 0 ? "Clear selection" : "Select all"}</button>
          <Button variant="secondary" size="sm" onClick={() => del([...sel])} disabled={busy || sel.size === 0}><Trash2 className="size-4" /> Delete selected ({sel.size})</Button>
        </div>
        <div className="max-h-[55vh] overflow-y-auto px-5 pb-5">
          {files === null ? <p className="py-8 text-center text-sm text-mist-500">Loading…</p> : all.length === 0 ? <p className="py-8 text-center text-sm text-mist-500">No files.</p> : (
            <ul className="space-y-1.5">
              {all.map((f) => {
                const M = CAT_META[f.category];
                return (
                  <li key={f.name} className="rounded-lg border border-line bg-ink-800 px-3 py-2 text-xs">
                    <div className="flex items-center gap-2">
                      <input type="checkbox" checked={sel.has(f.name)} onChange={() => toggle(f.name)} className="size-4 accent-lotus-500" />
                      <span className={cn("grid size-6 shrink-0 place-items-center rounded", M.tone)}><M.icon className="size-3" /></span>
                      <span className="min-w-0 flex-1 truncate text-mist-200">{f.source === "avatar" ? "Profile photo" : f.name}<span className="ml-1 text-[10px] text-mist-500">· {f.source}</span></span>
                      <b className="shrink-0 text-mist-100">{fmtBytes(f.size)}</b>
                      {f.source !== "avatar" && (
                        <>
                          {kindOf(f) !== "other" && (
                            <button onClick={() => setPreview((p) => (p === f.name ? "" : f.name))} title={preview === f.name ? "Hide preview" : "Preview / play here"} className={cn("shrink-0", preview === f.name ? "text-lotus-200" : "text-lotus-300/80 hover:text-lotus-300")}><Eye className="size-3.5" /></button>
                          )}
                          <a href={fileUrl(f.name)} target="_blank" rel="noopener noreferrer" title="Open in a new tab" className="shrink-0 text-sky-300/80 hover:text-sky-300"><ExternalLink className="size-3.5" /></a>
                          <a href={fileUrl(f.name)} download={f.name} title="Download this file" className="shrink-0 text-emerald-300/80 hover:text-emerald-300"><Download className="size-3.5" /></a>
                        </>
                      )}
                      <button onClick={() => del([f.name])} disabled={busy} className="shrink-0 text-red-300/80 hover:text-red-300"><Trash2 className="size-3.5" /></button>
                    </div>
                    {/* Inline preview — images show, audio and video play right here. */}
                    {preview === f.name && (
                      <div className="mt-2 rounded-lg border border-line bg-ink-900 p-2">
                        {kindOf(f) === "image" && <img src={fileUrl(f.name)} alt={f.name} className="mx-auto max-h-64 rounded-md object-contain" />}
                        {kindOf(f) === "video" && <video src={fileUrl(f.name)} controls className="mx-auto max-h-64 w-full rounded-md" />}
                        {kindOf(f) === "audio" && <audio src={fileUrl(f.name)} controls className="w-full" />}
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </Card>
    </div>
  );
}
