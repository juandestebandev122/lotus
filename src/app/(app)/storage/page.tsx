"use client";

import { useCallback, useEffect, useState } from "react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/cn";
import { withBase } from "@/lib/base-path";
import { HardDrive, Image as ImageIcon, Film, Music, FileText, Layers, Trash2, RefreshCw, AlertTriangle, Eye } from "lucide-react";

type Cat = "photo" | "video" | "audio" | "document" | "other";
interface Cats { photo: number; video: number; audio: number; document: number; other: number }
interface FileRow { name: string; category: Cat; size: number; at: string; source: string }
interface MyStorage { usedBytes: number; limitBytes: number; availableBytes: number; pct: number; fileCount: number; byCategory: Cats; limitSource: string; files: FileRow[] }

const CAT_META: Record<Cat, { label: string; icon: typeof ImageIcon; tone: string }> = {
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
function barTone(p: number): string { return p >= 100 ? "bg-red-400" : p >= 90 ? "bg-orange-400" : p >= 80 ? "bg-amber-400" : "bg-lotus-400"; }

export default function MyStoragePage() {
  const [s, setS] = useState<MyStorage | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    fetch(withBase("/api/storage"), { credentials: "include", cache: "no-store" })
      .then((r) => r.json()).then((d) => { setS(d); setLoading(false); }).catch(() => setLoading(false));
  }, []);
  useEffect(() => { load(); }, [load]);

  const del = async (name: string) => {
    if (!confirm("Delete this file permanently? This cannot be undone.")) return;
    setBusy(true);
    await fetch(withBase("/api/storage"), { method: "POST", headers: { "Content-Type": "application/json" }, credentials: "include", body: JSON.stringify({ action: "delete", names: [name] }) });
    setBusy(false);
    load();
  };

  const catList: Cat[] = ["photo", "video", "audio", "document", "other"];
  const files = s?.files ?? [];

  return (
    <div className="mx-auto max-w-3xl space-y-5 p-4">
      <div className="flex items-center justify-between">
        <h1 className="flex items-center gap-2 font-display text-2xl font-extrabold text-mist-100"><HardDrive className="size-6 text-lotus-300" /> My Storage</h1>
        <Button variant="secondary" size="sm" onClick={load}><RefreshCw className="size-4" /> Refresh</Button>
      </div>

      {loading ? (
        <Card className="p-8 text-center text-mist-500">Loading…</Card>
      ) : !s ? (
        <Card className="p-8 text-center text-mist-500">Could not load your storage.</Card>
      ) : (
        <>
          {/* Usage ring / bar */}
          <Card className="p-5">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <div className="font-display text-3xl font-extrabold text-mist-100">{fmtBytes(s.usedBytes)} <span className="text-lg font-semibold text-mist-500">/ {fmtBytes(s.limitBytes)}</span></div>
                <div className="text-sm text-mist-400">Used storage · {fmtBytes(s.availableBytes)} available</div>
              </div>
              <div className={cn("font-display text-2xl font-extrabold", s.pct >= 90 ? "text-orange-300" : s.pct >= 80 ? "text-amber-300" : "text-lotus-300")}>{s.pct}%</div>
            </div>
            <div className="mt-3 h-2.5 w-full overflow-hidden rounded-full bg-white/10"><div className={cn("h-full rounded-full transition-all", barTone(s.pct))} style={{ width: `${Math.min(100, s.pct)}%` }} /></div>
            {s.pct >= 80 && (
              <div className="mt-3 flex items-center gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-200">
                <AlertTriangle className="size-4 shrink-0" /> Your storage is almost full. Please delete unnecessary files to continue uploading.
              </div>
            )}
          </Card>

          {/* Breakdown */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {catList.filter((c) => s.byCategory[c] > 0 || c !== "other").slice(0, 4).map((c) => {
              const M = CAT_META[c];
              return (
                <Card key={c} className="p-4">
                  <span className={cn("grid size-9 place-items-center rounded-lg", M.tone)}><M.icon className="size-4" /></span>
                  <div className="mt-3 text-lg font-bold text-mist-100">{fmtBytes(s.byCategory[c])}</div>
                  <div className="text-xs text-mist-500">{M.label}</div>
                </Card>
              );
            })}
          </div>

          {/* Files */}
          <Card className="overflow-hidden p-0">
            <div className="px-5 py-3 text-xs text-mist-500">My files ({files.length})</div>
            {files.length === 0 ? (
              <p className="px-5 pb-6 text-sm text-mist-500">You have no stored files yet.</p>
            ) : (
              <ul className="divide-y divide-white/5">
                {files.map((f) => {
                  const M = CAT_META[f.category];
                  return (
                    <li key={f.name} className="flex items-center gap-3 px-5 py-2.5 text-sm hover:bg-white/[0.03]">
                      <span className={cn("grid size-8 shrink-0 place-items-center rounded", M.tone)}><M.icon className="size-4" /></span>
                      <span className="min-w-0 flex-1 truncate text-mist-200">{f.source === "avatar" ? "Profile photo" : f.name}<span className="ml-1 text-[10px] text-mist-500">· {M.label}</span></span>
                      <b className="shrink-0 text-xs text-mist-100">{fmtBytes(f.size)}</b>
                      {f.source !== "avatar" && (
                        <a href={withBase(`/api/media/${encodeURIComponent(f.name)}`)} target="_blank" rel="noopener noreferrer" title="View / open file" className="shrink-0 text-lotus-300/80 hover:text-lotus-300"><Eye className="size-4" /></a>
                      )}
                      <button onClick={() => del(f.name)} disabled={busy} className="shrink-0 text-red-300/70 hover:text-red-300"><Trash2 className="size-4" /></button>
                    </li>
                  );
                })}
              </ul>
            )}
          </Card>
        </>
      )}
    </div>
  );
}
