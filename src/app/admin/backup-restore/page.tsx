"use client";

import { useCallback, useEffect, useState } from "react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import { withBase } from "@/lib/base-path";
import { cn } from "@/lib/cn";
import { DatabaseBackup, Loader2, RotateCcw, Save, ShieldAlert, Info, Users, DoorOpen, Receipt, Clock } from "lucide-react";

// BACKUP & RESTORE — the recovery option.
//
// After the 29 Aug data loss, recovering depended on a backup that happened to
// have been taken by a deployment 39 hours earlier. The app now keeps its own
// restore points, and this page is where an admin uses them without needing a
// developer or server access.

interface Snapshot {
  name: string; at: string; sizeBytes: number;
  users: number; rooms: number; transactions: number;
  source: "automatic" | "before-restore" | "deployment";
}

const mb = (n: number) => `${(n / 1024 / 1024).toFixed(1)} MB`;
const when = (iso: string) => {
  const d = new Date(iso);
  const mins = Math.round((Date.now() - d.getTime()) / 60000);
  const ago = mins < 60 ? `${mins} min ago` : mins < 1440 ? `${Math.round(mins / 60)} hours ago` : `${Math.round(mins / 1440)} days ago`;
  return `${d.toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })} · ${ago}`;
};

export default function AdminBackupRestorePage() {
  const { toast } = useToast();
  const [snaps, setSnaps] = useState<Snapshot[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState("");
  const [chosen, setChosen] = useState<Snapshot | null>(null);
  const [confirm, setConfirm] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch(withBase("/api/admin/backups"), { credentials: "include", cache: "no-store" });
      const d = await r.json();
      setSnaps(d.snapshots ?? []);
    } catch { toast("Could not load the restore points", "error"); }
    setLoading(false);
  }, [toast]);

  useEffect(() => { load(); }, [load]);

  const saveNow = async () => {
    setBusy("snapshot");
    const r = await fetch(withBase("/api/admin/backups"), {
      method: "POST", credentials: "include", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "snapshot", label: "manual" }),
    });
    const d = await r.json().catch(() => ({}));
    setBusy("");
    if (r.ok) { toast("Restore point saved.", "success"); load(); }
    else toast(d.error ?? "Could not save a restore point", "error");
  };

  const doRestore = async () => {
    if (!chosen) return;
    setBusy("restore");
    const r = await fetch(withBase("/api/admin/backups"), {
      method: "POST", credentials: "include", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "restore", name: chosen.name, confirm }),
    });
    const d = await r.json().catch(() => ({}));
    setBusy("");
    if (r.ok) {
      toast(`Restored — ${d.users} accounts and ${d.rooms} groups are back.`, "success");
      setChosen(null); setConfirm("");
      load();
    } else toast(d.error ?? "Could not restore", "error");
  };

  return (
    <div className="space-y-5 pb-10">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 font-display text-2xl font-extrabold text-mist-100">
            <DatabaseBackup className="size-6 text-lotus-300" /> Backup &amp; Restore
          </h1>
          <p className="mt-1 max-w-2xl text-sm text-mist-400">
            Every account, group, message, transaction and setting, saved automatically <b className="text-mist-200">every 12 hours</b>.
            The most recent 14 are kept. If anything ever goes wrong, come here and go back to any of them.
          </p>
        </div>
        <Button onClick={saveNow} disabled={busy !== ""}>
          {busy === "snapshot" ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />} Save a restore point now
        </Button>
      </div>

      <div className="rounded-xl border border-sky-400/25 bg-sky-500/[0.07] px-4 py-3 text-xs leading-relaxed text-mist-300">
        <p className="flex items-start gap-2">
          <Info className="mt-0.5 size-4 shrink-0 text-sky-300" />
          <span>
            <b className="text-mist-100">Restoring is reversible.</b> Before anything is replaced, the data as it stands
            right now is saved as its own restore point — so if you go back to the wrong one, you can simply
            come here and return. Nothing is ever deleted.
          </span>
        </p>
      </div>

      <Card className="p-0">
        <div className="flex items-center justify-between border-b border-line px-5 py-3">
          <h2 className="font-semibold text-mist-100">Restore points</h2>
          <button onClick={load} className="text-xs font-semibold text-mist-400 hover:text-mist-100">Refresh</button>
        </div>

        {loading ? (
          <div className="grid place-items-center py-16 text-mist-500"><Loader2 className="size-6 animate-spin" /></div>
        ) : snaps.length === 0 ? (
          <div className="px-5 py-10 text-center">
            <p className="text-sm text-mist-400">No restore points yet.</p>
            <p className="mt-1 text-xs text-mist-500">
              The first is saved automatically within 12 hours — or press <b className="text-mist-300">Save a restore point now</b>.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-line">
            {snaps.map((s, i) => (
              <div key={s.name} className="flex flex-wrap items-center gap-3 px-5 py-3.5">
                <div className="min-w-0 flex-1">
                  <p className="flex flex-wrap items-center gap-2 text-sm font-semibold text-mist-100">
                    <Clock className="size-3.5 text-mist-500" /> {when(s.at)}
                    {i === 0 && <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-bold text-emerald-300">NEWEST</span>}
                    {s.source === "before-restore" && (
                      <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-bold text-amber-300" title="Saved automatically just before an earlier restore">
                        UNDO POINT
                      </span>
                    )}
                  </p>
                  <p className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-mist-400">
                    <span className="inline-flex items-center gap-1"><Users className="size-3.5" /> {s.users.toLocaleString("en-GB")} accounts</span>
                    <span className="inline-flex items-center gap-1"><DoorOpen className="size-3.5" /> {s.rooms.toLocaleString("en-GB")} groups</span>
                    <span className="inline-flex items-center gap-1"><Receipt className="size-3.5" /> {s.transactions.toLocaleString("en-GB")} transactions</span>
                    <span className="text-mist-600">{mb(s.sizeBytes)}</span>
                  </p>
                </div>
                <Button size="sm" variant="secondary" onClick={() => { setChosen(s); setConfirm(""); }} disabled={busy !== ""}>
                  <RotateCcw className="size-4" /> Go back to this
                </Button>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Confirmation — typing the word is deliberate friction. */}
      {chosen && (
        <div className="fixed inset-0 z-[100] grid place-items-center bg-black/70 p-4 backdrop-blur-sm" onClick={() => setChosen(null)}>
          <div onClick={(e) => e.stopPropagation()} className="w-full max-w-md rounded-2xl border border-amber-400/30 bg-ink-850 p-5">
            <h2 className="flex items-center gap-2 font-display text-lg font-bold text-amber-200">
              <ShieldAlert className="size-5" /> Replace all current data?
            </h2>
            <p className="mt-3 text-sm leading-relaxed text-mist-300">
              This replaces <b className="text-mist-100">everything</b> — every account, group, message, transaction
              and setting — with the data as it was on:
            </p>
            <div className="mt-3 rounded-xl border border-line bg-ink-900 p-3 text-sm">
              <p className="font-semibold text-mist-100">{when(chosen.at)}</p>
              <p className="mt-1 text-xs text-mist-400">
                {chosen.users.toLocaleString("en-GB")} accounts · {chosen.rooms.toLocaleString("en-GB")} groups · {chosen.transactions.toLocaleString("en-GB")} transactions
              </p>
            </div>
            <p className="mt-3 text-xs leading-relaxed text-mist-400">
              Anything that happened <b className="text-mist-200">after</b> that time will be gone from the live app.
              The data as it stands right now is saved first, so you can come back here and undo this.
            </p>
            <label className="mt-4 block">
              <span className="text-xs font-semibold text-mist-300">Type <b className="text-amber-200">RESTORE</b> to confirm</span>
              <input
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                placeholder="RESTORE"
                autoFocus
                className={cn(
                  "mt-1 block h-10 w-full rounded-lg border bg-ink-900 px-3 text-sm text-mist-100 outline-none",
                  confirm.trim().toUpperCase() === "RESTORE" ? "border-emerald-400/50" : "border-line focus:border-lotus-400",
                )}
              />
            </label>
            <div className="mt-4 flex gap-2">
              <Button variant="secondary" className="flex-1" onClick={() => setChosen(null)}>Cancel</Button>
              <Button
                className="flex-1 !bg-amber-500 hover:!bg-amber-400"
                disabled={confirm.trim().toUpperCase() !== "RESTORE" || busy !== ""}
                onClick={doRestore}
              >
                {busy === "restore" ? <Loader2 className="size-4 animate-spin" /> : <RotateCcw className="size-4" />} Restore
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
