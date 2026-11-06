"use client";

import { useCallback, useEffect, useState } from "react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import { cn } from "@/lib/cn";
import { fetchDeletedUsers, restoreDeletedUser, purgeDeletedUser, setIdRearrangement, type DeletedUserRow } from "@/lib/admin";
import { UserX, RotateCcw, Trash2, Loader2, Power, Search, ShieldAlert, RefreshCw } from "lucide-react";
import { UserLink, SortTh, applyFilterSort, type SortDir } from "@/components/admin/TableControls";

export default function DeletedUsersPage() {
  const { toast } = useToast();
  const [rows, setRows] = useState<DeletedUserRow[]>([]);
  const [idRearr, setIdRearr] = useState(false);
  const [superAdmin, setSuperAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState("");
  const [q, setQ] = useState("");
  const [sort, setSort] = useState("deleted");
  const [dir, setDir] = useState<SortDir>("desc");

  const load = useCallback(() => fetchDeletedUsers().then((d) => { setRows(d.deleted); setIdRearr(d.idRearrangement); setSuperAdmin(d.superAdmin); setLoading(false); }), []);
  useEffect(() => { load(); }, [load]);

  const toggleIdRearr = async () => {
    const next = !idRearr;
    if (next && !confirm("Turn ID re-arrangement ON? This renumbers ALL user IDs into a continuous sequence (no gaps) now and after each future deletion.")) return;
    setBusy("toggle");
    const res = await setIdRearrangement(next);
    setBusy("");
    if (res.ok) { setIdRearr(next); toast(`ID re-arrangement turned ${next ? "ON" : "OFF"}`, "success"); load(); } else toast(res.error ?? "Failed", "error");
  };
  const restore = async (r: DeletedUserRow) => {
    setBusy("r" + r.user.id);
    const res = await restoreDeletedUser(r.user.id);
    setBusy("");
    if (res.ok) { toast(`${r.fullName} restored`, "success"); load(); } else toast(res.error ?? "Failed", "error");
  };
  const purge = async (r: DeletedUserRow) => {
    if (!confirm(`Permanently delete ${r.fullName}? This CANNOT be undone.`)) return;
    setBusy("p" + r.user.id);
    const res = await purgeDeletedUser(r.user.id);
    setBusy("");
    if (res.ok) { toast(`${r.fullName} permanently deleted`, "info"); load(); } else toast(res.error ?? "Failed", "error");
  };

  const sortRows = (col: string) => { if (col === sort) setDir((d) => (d === "asc" ? "desc" : "asc")); else { setSort(col); setDir("desc"); } };
  const filtered = applyFilterSort(rows, {
    q, sort, dir,
    searchText: (r) => `${r.fullName} ${r.username} ${r.publicId} ${r.email ?? ""} ${r.phone ?? ""} ${r.deletedBy ?? ""} ${r.reason ?? ""} ${r.accountStatus ?? ""}`,
    sortKeys: {
      id: (r) => r.publicId || "",
      user: (r) => r.fullName ?? "",
      contact: (r) => r.phone || r.email || "",
      deleted: (r) => new Date(r.deletedAt ?? 0).getTime() || 0,
      by: (r) => r.deletedBy ?? "",
      reason: (r) => r.reason ?? "",
      status: (r) => r.accountStatus ?? "",
    },
  });
  const fmt = (d: string) => new Date(d).toLocaleString("en-GB", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });

  return (
    <div className="mx-auto max-w-6xl">
      <div className="mb-4">
        <h1 className="flex items-center gap-2 font-display text-2xl font-extrabold text-mist-100"><UserX className="size-6 text-rose-300" /> Deleted Users</h1>
        <p className="mt-0.5 text-sm text-mist-400">Archive of deleted accounts. Super Admin can restore or permanently delete them.</p>
      </div>

      {/* ID re-arrangement control (Super Admin only) */}
      <Card className={cn("mb-4 p-4", !superAdmin && "opacity-70")}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0">
            <h2 className="flex items-center gap-2 text-sm font-bold text-mist-100"><RefreshCw className="size-4 text-lotus-300" /> User ID re-arrangement</h2>
            <p className="mt-0.5 text-xs text-mist-400">OFF (default): IDs stay fixed and deleting a user leaves a gap. ON: deleting a user renumbers the remaining IDs into a continuous serial sequence.</p>
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

      {/* Search */}
      <div className="mb-4 flex items-center gap-2 rounded-xl border border-line bg-ink-800 px-3">
        <Search className="size-4 text-mist-500" />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search deleted users by name, @username, ID or email…" className="h-11 w-full bg-transparent text-sm text-mist-100 outline-none placeholder:text-mist-500" />
      </div>

      {loading ? (
        <div className="grid h-40 place-items-center text-mist-400"><Loader2 className="size-5 animate-spin" /></div>
      ) : filtered.length === 0 ? (
        <Card className="p-10 text-center text-sm text-mist-400"><UserX className="mx-auto mb-2 size-9 text-mist-600" /> {rows.length === 0 ? "No deleted users." : "No deleted users match your search."}</Card>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-white/10">
          <table className="w-full text-left text-sm">
            <thead className="bg-white/[0.03] text-xs uppercase tracking-wide text-mist-400">
              <tr>
                <SortTh col="id" sort={sort} dir={dir} onSort={sortRows} className="px-4 py-3">User ID</SortTh>
                <SortTh col="user" sort={sort} dir={dir} onSort={sortRows} className="px-4 py-3">Username</SortTh>
                <SortTh col="contact" sort={sort} dir={dir} onSort={sortRows} className="px-4 py-3">Mobile / Email</SortTh>
                <SortTh col="deleted" sort={sort} dir={dir} onSort={sortRows} className="px-4 py-3">Deleted</SortTh>
                <SortTh col="by" sort={sort} dir={dir} onSort={sortRows} className="px-4 py-3">Deleted By</SortTh>
                <SortTh col="reason" sort={sort} dir={dir} onSort={sortRows} className="px-4 py-3">Reason</SortTh>
                <SortTh col="status" sort={sort} dir={dir} onSort={sortRows} className="px-4 py-3">Status</SortTh>
                <th className="px-4 py-3 text-right font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((r) => (
                <tr key={r.user.id} className="border-t border-white/5 hover:bg-white/[0.02]">
                  <td className="px-4 py-3 font-mono text-lotus-300">{r.publicId || "—"}</td>
                  <td className="px-4 py-3"><UserLink name={r.fullName} publicId={r.publicId} userId={r.user.id} username={r.username} showId={false} /><div className="text-[11px] text-mist-500">@{r.username}</div></td>
                  <td className="px-4 py-3 text-xs text-mist-300">{r.phone || "—"}<div className="text-[11px] text-mist-500">{r.email || ""}</div></td>
                  <td className="px-4 py-3 text-xs text-mist-300">{fmt(r.deletedAt)}</td>
                  <td className="px-4 py-3 text-xs text-mist-300">{r.deletedBy}</td>
                  <td className="px-4 py-3 max-w-48 text-xs text-mist-300"><div className="truncate" title={r.reason}>{r.reason}</div></td>
                  <td className="px-4 py-3 text-xs capitalize text-mist-400">{r.accountStatus}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1">
                      {superAdmin ? (
                        <>
                          <Button size="sm" onClick={() => restore(r)} disabled={busy === "r" + r.user.id}>{busy === "r" + r.user.id ? <Loader2 className="size-4 animate-spin" /> : <RotateCcw className="size-4" />} Restore</Button>
                          <button title="Permanently delete" onClick={() => purge(r)} disabled={busy === "p" + r.user.id} className="grid size-8 place-items-center rounded-lg text-rose-300 hover:bg-rose-500/10"><Trash2 className="size-4" /></button>
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
