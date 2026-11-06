"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useUserProfiles } from "@/lib/useUserProfiles";
import { useToast } from "@/components/ui/Toast";
import { Avatar } from "@/components/ui/Avatar";
import { withBase } from "@/lib/base-path";
import { cn } from "@/lib/cn";
import { ShieldAlert, X, AlertTriangle, Ban, UserX, Check, RotateCcw, Flag } from "lucide-react";

type Report = {
  id: string; reportedId: string; reportedName: string; byId: string; byName: string;
  category: string; detail: string; status: "open" | "actioned" | "dismissed"; at: string;
};

export function RoomModerationPanel({
  roomId, open, onClose, blockedIds, kickedIds, onBlock, onKick, onUnblock,
}: {
  roomId: string; open: boolean; onClose: () => void;
  blockedIds: string[]; kickedIds: string[];
  onBlock: (id: string, name: string) => void;
  onKick: (id: string, name: string) => void;
  onUnblock: (id: string, name: string) => void;
}) {
  const { toast } = useToast();
  const [tab, setTab] = useState<"reports" | "blocked">("reports");
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(withBase(`/api/rooms/${roomId}/reports`), { credentials: "include", cache: "no-store" });
      const d = await res.json();
      if (res.ok) setReports((d?.reports ?? []) as Report[]);
    } catch { /* ignore */ }
    setLoading(false);
  }, [roomId]);
  useEffect(() => { if (open) load(); }, [open, load]);

  // Names/avatars for the blocked + banned lists (they may have left the room).
  const manageIds = useMemo(() => [...new Set([...blockedIds, ...kickedIds])], [blockedIds, kickedIds]);
  const profiles = useUserProfiles(manageIds);

  const act = async (body: { action: "warn" | "resolve" | "dismiss"; targetUserId?: string; reportId?: string; note?: string }, key: string) => {
    setBusy(key);
    try {
      const res = await fetch(withBase(`/api/rooms/${roomId}/reports`), { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      if (res.ok) { toast(body.action === "warn" ? "Warning sent." : body.action === "resolve" ? "Marked resolved." : "Dismissed.", "success"); await load(); }
      else { const d = await res.json().catch(() => ({})); toast(d.error ?? "Action failed", "error"); }
    } catch { toast("Action failed", "error"); }
    setBusy(null);
  };

  const warn = (r: Report) => {
    const note = window.prompt(`Warn ${r.reportedName}? Optional message:`, "") ?? undefined;
    act({ action: "warn", targetUserId: r.reportedId, reportId: r.id, note }, `w${r.id}`);
  };

  if (!open) return null;
  const openReports = reports.filter((r) => r.status === "open");

  return (
    <div className="fixed inset-0 z-[80] grid place-items-end sm:place-items-center bg-black/60 p-0 sm:p-4" onClick={onClose}>
      <div className="flex max-h-[85vh] w-full max-w-lg flex-col overflow-hidden rounded-t-2xl sm:rounded-2xl border border-white/10 bg-ink-900 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-line px-4 py-3">
          <span className="flex items-center gap-2 font-display text-base font-bold text-mist-100"><ShieldAlert className="size-5 text-lotus-300" /> Reports &amp; Moderation</span>
          <button onClick={onClose} className="grid size-8 place-items-center rounded-full bg-white/10 text-mist-300 hover:bg-white/20"><X className="size-4" /></button>
        </div>

        <div className="flex gap-2 border-b border-line px-4 py-2">
          {([["reports", `Reports${openReports.length ? ` (${openReports.length})` : ""}`], ["blocked", `Blocked / Banned (${manageIds.length})`]] as const).map(([t, label]) => (
            <button key={t} onClick={() => setTab(t)} className={cn("rounded-full px-3 py-1.5 text-xs font-semibold transition", tab === t ? "bg-lotus-500 text-white" : "bg-ink-800 text-mist-300 hover:bg-white/[0.06]")}>{label}</button>
          ))}
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-3">
          {tab === "reports" ? (
            loading ? <div className="grid place-items-center p-8 text-mist-400">Loading…</div>
              : reports.length === 0 ? <div className="grid place-items-center gap-2 p-8 text-center text-mist-400"><Flag className="size-8 text-mist-600" /> No reports in this room.</div>
              : (
                <div className="space-y-2">
                  {reports.map((r) => (
                    <div key={r.id} className={cn("rounded-xl border p-3", r.status === "open" ? "border-amber-400/30 bg-amber-500/[0.05]" : "border-line bg-ink-800/40 opacity-80")}>
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <div className="text-sm font-semibold text-mist-100">{r.reportedName} <span className="text-xs font-normal text-mist-500">reported by {r.byName}</span></div>
                          <div className="mt-0.5 text-xs font-semibold text-amber-300">{r.category}</div>
                          {r.detail && <div className="mt-0.5 text-xs text-mist-400">{r.detail}</div>}
                          <div className="mt-0.5 text-[11px] text-mist-600">{new Date(r.at).toLocaleString("en-GB", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}{r.status !== "open" ? ` · ${r.status}` : ""}</div>
                        </div>
                      </div>
                      {r.status === "open" && (
                        <div className="mt-2 flex flex-wrap gap-1.5">
                          <button onClick={() => warn(r)} disabled={busy === `w${r.id}`} className="inline-flex items-center gap-1 rounded-lg bg-amber-500/15 px-2.5 py-1 text-xs font-semibold text-amber-300 hover:bg-amber-500/25"><AlertTriangle className="size-3.5" /> Warn</button>
                          <button onClick={() => { onKick(r.reportedId, r.reportedName); act({ action: "resolve", reportId: r.id }, `k${r.id}`); }} className="inline-flex items-center gap-1 rounded-lg bg-white/[0.06] px-2.5 py-1 text-xs font-semibold text-mist-200 hover:bg-white/[0.12]"><UserX className="size-3.5" /> Kick</button>
                          <button onClick={() => { onBlock(r.reportedId, r.reportedName); act({ action: "resolve", reportId: r.id }, `b${r.id}`); }} className="inline-flex items-center gap-1 rounded-lg bg-rose-500/15 px-2.5 py-1 text-xs font-semibold text-rose-300 hover:bg-rose-500/25"><Ban className="size-3.5" /> Block / Ban</button>
                          <button onClick={() => act({ action: "resolve", reportId: r.id }, `r${r.id}`)} className="inline-flex items-center gap-1 rounded-lg bg-emerald-500/15 px-2.5 py-1 text-xs font-semibold text-emerald-300 hover:bg-emerald-500/25"><Check className="size-3.5" /> Resolve</button>
                          <button onClick={() => act({ action: "dismiss", reportId: r.id }, `d${r.id}`)} className="inline-flex items-center gap-1 rounded-lg bg-white/[0.06] px-2.5 py-1 text-xs font-semibold text-mist-400 hover:bg-white/[0.12]">Dismiss</button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )
          ) : (
            manageIds.length === 0 ? <div className="grid place-items-center gap-2 p-8 text-center text-mist-400"><Ban className="size-8 text-mist-600" /> No blocked or banned users.</div>
              : (
                <div className="space-y-2">
                  {manageIds.map((id) => {
                    const p = profiles[id];
                    const name = p?.fullName ?? "Member";
                    const banned = blockedIds.includes(id);
                    return (
                      <div key={id} className="flex items-center gap-2.5 rounded-xl border border-line bg-ink-800/40 p-2.5">
                        <Avatar name={name} src={p?.avatar} size="sm" />
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-sm font-semibold text-mist-100">{name}</div>
                          <span className={cn("text-[11px] font-semibold", banned ? "text-rose-300" : "text-amber-300")}>{banned ? "Banned" : "Kicked"}</span>
                        </div>
                        <button onClick={() => onUnblock(id, name)} className="inline-flex items-center gap-1 rounded-lg bg-emerald-500/15 px-3 py-1.5 text-xs font-semibold text-emerald-300 hover:bg-emerald-500/25"><RotateCcw className="size-3.5" /> Unblock</button>
                      </div>
                    );
                  })}
                </div>
              )
          )}
        </div>
      </div>
    </div>
  );
}
