"use client";

import { useCallback, useEffect, useState } from "react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import { fetchDeletedAgencies, restoreDeletedAgency, purgeDeletedAgency, setIdRearrangement, type DeletedAgencyRow } from "@/lib/admin";
import { cn } from "@/lib/cn";
import { Landmark, RotateCcw, Trash2, Loader2, Search, RefreshCw, Power, ShieldAlert } from "lucide-react";

export default function DeletedAgenciesPage() {
  const { toast } = useToast();
  const [rows, setRows] = useState<DeletedAgencyRow[]>([]);
  const [idRearr, setIdRearr] = useState(false);
  const [superAdmin, setSuperAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState("");
  const [q, setQ] = useState("");

  const load = useCallback(() => fetchDeletedAgencies().then((d) => { setRows(d.deleted); setIdRearr(d.idRearrangement); setSuperAdmin(d.superAdmin); setLoading(false); }), []);
  useEffect(() => { load(); }, [load]);

  const toggleIdRearr = async () => {
    const next = !idRearr;
    if (next && !confirm("Turn serial-number re-arrangement ON? Agency IDs (AG…) and user IDs are renumbered into a continuous sequence (no gaps) now and after each future deletion.")) return;
    setBusy("toggle");
    const res = await setIdRearrangement(next);
    setBusy("");
    if (res.ok) { setIdRearr(next); toast(`Serial re-arrangement turned ${next ? "ON" : "OFF"}`, "success"); load(); } else toast(res.error ?? "Failed", "error");
  };

  const restore = async (r: DeletedAgencyRow) => {
    setBusy("r" + r.id);
    const res = await restoreDeletedAgency(r.id);
    setBusy("");
    if (res.ok) { toast(`${r.name} restored`, "success"); load(); } else toast(res.error ?? "Failed", "error");
  };
  const purge = async (r: DeletedAgencyRow) => {
    if (!confirm(`Permanently delete agency "${r.name}"? This CANNOT be undone.`)) return;
    setBusy("p" + r.id);
    const res = await purgeDeletedAgency(r.id);
    setBusy("");
    if (res.ok) { toast(`${r.name} permanently deleted`, "info"); load(); } else toast(res.error ?? "Failed", "error");
  };

  const filtered = rows.filter((r) => {
    const s = q.trim().toLowerCase();
    return !s || r.name.toLowerCase().includes(s) || r.agencyId.toLowerCase().includes(s) || (r.ownerName ?? "").toLowerCase().includes(s);
  });
  const fmt = (d: string) => new Date(d).toLocaleString("en-GB", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });

  return (
    <div className="mx-auto max-w-6xl">
      <div className="mb-4">
        <h1 className="flex items-center gap-2 font-display text-2xl font-extrabold text-mist-100"><Landmark className="size-6 text-rose-300" /> Deleted Agencies</h1>
        <p className="mt-0.5 text-sm text-mist-400">Archive of deleted agencies. Super Admin can restore or permanently delete them. Member accounts are never deleted — they simply lose the agency link.</p>
      </div>

      {/* Serial-number re-arrangement toggle (Super Admin) — same global setting as
          on the Deleted Users page, exposed here so agency serials can be managed
          right where you see them. */}
      <Card className={cn("mb-4 p-4", !superAdmin && "opacity-70")}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0">
            <h2 className="flex items-center gap-2 text-sm font-bold text-mist-100"><RefreshCw className="size-4 text-lotus-300" /> Agency serial re-arrangement</h2>
            <p className="mt-0.5 text-xs text-mist-400">OFF (default): agency IDs (AG…) stay fixed and deleting one leaves a gap. ON: deleting an agency renumbers the remaining IDs into a continuous serial sequence. (This is the global setting — it applies to user IDs too.)</p>
          </div>
          {superAdmin ? (
            <button onClick={toggleIdRearr} disabled={busy === "toggle"} className={cn("inline-flex shrink-0 items-center gap-1.5 rounded-full px-4 py-2 text-sm font-bold transition", idRearr ? "bg-emerald-500/20 text-emerald-300" : "bg-white/[0.06] text-mist-400")}>
              {busy === "toggle" ? <Loader2 className="size-4 animate-spin" /> : <Power className="size-4" />} {idRearr ? "ON" : "OFF"}
            </button>
          ) : (
            <span className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-amber-500/10 px-3 py-1.5 text-xs font-semibold text-amber-300"><ShieldAlert className="size-4" /> Super Admin only</span>
          )}
        </div>
      </Card>

      <div className="mb-4 flex items-center gap-2 rounded-xl border border-line bg-ink-800 px-3">
        <Search className="size-4 text-mist-500" />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search deleted agencies by name, AG ID or owner…" className="h-11 w-full bg-transparent text-sm text-mist-100 outline-none placeholder:text-mist-500" />
      </div>

      {loading ? (
        <div className="grid h-40 place-items-center text-mist-400"><Loader2 className="size-5 animate-spin" /></div>
      ) : filtered.length === 0 ? (
        <Card className="p-10 text-center text-sm text-mist-400"><Landmark className="mx-auto mb-2 size-9 text-mist-600" /> {rows.length === 0 ? "No deleted agencies." : "No deleted agencies match your search."}</Card>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-white/10">
          <table className="w-full text-left text-sm">
            <thead className="bg-white/[0.03] text-xs uppercase tracking-wide text-mist-400">
              <tr>
                <th className="px-4 py-3 font-semibold">Agency ID</th>
                <th className="px-4 py-3 font-semibold">Name</th>
                <th className="px-4 py-3 font-semibold">Owner</th>
                <th className="px-4 py-3 font-semibold">Members</th>
                <th className="px-4 py-3 font-semibold">Level</th>
                <th className="px-4 py-3 font-semibold">Deleted</th>
                <th className="px-4 py-3 font-semibold">Deleted By</th>
                <th className="px-4 py-3 font-semibold">Reason</th>
                <th className="px-4 py-3 text-right font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((r) => (
                <tr key={r.id} className="border-t border-white/5 hover:bg-white/[0.02]">
                  <td className="px-4 py-3 font-mono text-lotus-300">{r.agencyId || "—"}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <span className="grid size-8 shrink-0 place-items-center overflow-hidden rounded-lg border border-line bg-lotus-500/15 text-lotus-200" style={r.agency.logo ? { backgroundImage: `url(${r.agency.logo})`, backgroundSize: "cover", backgroundPosition: "center" } : undefined}>{!r.agency.logo && <Landmark className="size-4" />}</span>
                      <span className="font-semibold text-mist-100">{r.name}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-xs text-mist-300">{r.ownerName || "—"}</td>
                  <td className="px-4 py-3 text-xs text-mist-300">{r.memberCount}</td>
                  <td className="px-4 py-3 text-xs text-mist-300">Lv {r.level}</td>
                  <td className="px-4 py-3 text-xs text-mist-300">{fmt(r.deletedAt)}</td>
                  <td className="px-4 py-3 text-xs text-mist-300">{r.deletedBy}</td>
                  <td className="px-4 py-3 max-w-48 text-xs text-mist-300"><div className="truncate" title={r.reason}>{r.reason || "—"}</div></td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1">
                      {superAdmin ? (
                        <>
                          <Button size="sm" onClick={() => restore(r)} disabled={busy === "r" + r.id}>{busy === "r" + r.id ? <Loader2 className="size-4 animate-spin" /> : <RotateCcw className="size-4" />} Restore</Button>
                          <button title="Permanently delete" onClick={() => purge(r)} disabled={busy === "p" + r.id} className="grid size-8 place-items-center rounded-lg text-rose-300 hover:bg-rose-500/10"><Trash2 className="size-4" /></button>
                        </>
                      ) : <span className="text-[11px] text-mist-500">Super Admin only</span>}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
