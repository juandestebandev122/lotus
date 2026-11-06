"use client";

import { useCallback, useEffect, useState } from "react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import { withBase } from "@/lib/base-path";
import { Trophy, RotateCcw, Trash2, Loader2, Search, ShieldAlert } from "lucide-react";

interface Row {
  id: string; title: string; game: string; status: string; participants: number;
  deletedAt: string; deletedBy: string; reason?: string; roomsRemoved: number;
}

export default function DeletedTournamentsPage() {
  const { toast } = useToast();
  const [rows, setRows] = useState<Row[]>([]);
  const [superAdmin, setSuperAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState("");
  const [q, setQ] = useState("");

  const load = useCallback(async () => {
    try {
      const r = await fetch(withBase("/api/admin/deleted-tournaments"), { credentials: "include", cache: "no-store" });
      const d = await r.json().catch(() => ({}));
      setRows(Array.isArray(d?.deleted) ? d.deleted : []);
      setSuperAdmin(!!d?.superAdmin);
    } catch { toast("Could not load deleted tournaments", "error"); }
    setLoading(false);
  }, [toast]);
  useEffect(() => { void load(); }, [load]);

  const act = async (action: "restore" | "purge", r: Row) => {
    if (action === "purge" && !confirm(`Permanently delete tournament "${r.title}"? This CANNOT be undone.`)) return;
    setBusy(action + r.id);
    try {
      const res = await fetch(withBase("/api/admin/deleted-tournaments"), { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action, id: r.id }) });
      const d = await res.json().catch(() => ({}));
      if (res.ok) { toast(action === "restore" ? `${r.title} restored` : `${r.title} permanently deleted`, action === "restore" ? "success" : "info"); await load(); }
      else toast(d?.error ?? "Failed", "error");
    } catch { toast("Network error", "error"); }
    setBusy("");
  };

  const filtered = rows.filter((r) => { const s = q.trim().toLowerCase(); return !s || r.title.toLowerCase().includes(s) || (r.deletedBy ?? "").toLowerCase().includes(s); });
  const fmt = (d: string) => new Date(d).toLocaleString("en-GB", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });

  return (
    <div className="mx-auto max-w-6xl">
      <div className="mb-4">
        <h1 className="flex items-center gap-2 font-display text-2xl font-extrabold text-mist-100"><Trophy className="size-6 text-rose-300" /> Deleted Tournaments</h1>
        <p className="mt-0.5 text-sm text-mist-400">Every deleted tournament is archived here (with who deleted it, when, and why) so it can be <b className="text-mist-200">restored</b> or <b className="text-mist-200">permanently removed</b>. Deleting a tournament also removes its auto-created match rooms — no orphan rooms are left behind.</p>
      </div>

      {!superAdmin && (
        <Card className="mb-4 flex items-center gap-2 p-3 text-xs font-semibold text-amber-300"><ShieldAlert className="size-4" /> Restore &amp; permanent-delete are Super-Admin only. You can view the archive.</Card>
      )}

      <div className="mb-4 flex items-center gap-2 rounded-xl border border-line bg-ink-800 px-3">
        <Search className="size-4 text-mist-500" />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search deleted tournaments by title or who deleted it…" className="h-11 w-full bg-transparent text-sm text-mist-100 outline-none placeholder:text-mist-500" />
      </div>

      {loading ? (
        <div className="grid h-40 place-items-center text-mist-400"><Loader2 className="size-5 animate-spin" /></div>
      ) : filtered.length === 0 ? (
        <Card className="p-10 text-center text-sm text-mist-400"><Trophy className="mx-auto mb-2 size-9 text-mist-600" /> {rows.length === 0 ? "No deleted tournaments." : "No deleted tournaments match your search."}</Card>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-white/10">
          <table className="w-full text-left text-sm">
            <thead className="bg-white/[0.03] text-xs uppercase tracking-wide text-mist-400">
              <tr>
                <th className="px-4 py-3 font-semibold">Tournament</th>
                <th className="px-4 py-3 font-semibold">Game</th>
                <th className="px-4 py-3 font-semibold">Status</th>
                <th className="px-4 py-3 font-semibold">Players</th>
                <th className="px-4 py-3 font-semibold">Rooms removed</th>
                <th className="px-4 py-3 font-semibold">Deleted</th>
                <th className="px-4 py-3 font-semibold">Deleted By</th>
                <th className="px-4 py-3 font-semibold">Reason</th>
                <th className="px-4 py-3 text-right font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((r) => (
                <tr key={r.id} className="border-t border-white/5 hover:bg-white/[0.02]">
                  <td className="px-4 py-3 font-semibold text-mist-100">{r.title}</td>
                  <td className="px-4 py-3 text-xs text-mist-300">{r.game}</td>
                  <td className="px-4 py-3 text-xs capitalize text-mist-300">{r.status}</td>
                  <td className="px-4 py-3 text-xs text-mist-300">{r.participants}</td>
                  <td className="px-4 py-3 text-xs text-mist-300">{r.roomsRemoved}</td>
                  <td className="px-4 py-3 text-xs text-mist-300">{fmt(r.deletedAt)}</td>
                  <td className="px-4 py-3 text-xs text-mist-300">{r.deletedBy}</td>
                  <td className="px-4 py-3 max-w-48 text-xs text-mist-300"><div className="truncate" title={r.reason}>{r.reason || "—"}</div></td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1">
                      {superAdmin ? (
                        <>
                          <Button size="sm" onClick={() => act("restore", r)} disabled={busy === "restore" + r.id}>{busy === "restore" + r.id ? <Loader2 className="size-4 animate-spin" /> : <RotateCcw className="size-4" />} Restore</Button>
                          <button title="Permanently delete" onClick={() => act("purge", r)} disabled={busy === "purge" + r.id} className="grid size-8 place-items-center rounded-lg text-rose-300 hover:bg-rose-500/10"><Trash2 className="size-4" /></button>
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
