"use client";

import { useCallback, useEffect, useState } from "react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import { cn } from "@/lib/cn";
import { withBase } from "@/lib/base-path";
import { useConfig, saveConfig } from "@/lib/config";
import { ScrollText, Trash2, Loader2, Search, Download, ShieldAlert, Clock, Save, History } from "lucide-react";

interface Mod { key: string; label: string; count: number; superOnly: boolean }
interface Row { id: string; at: string; summary: string }
interface Audit { id: string; at: string; by: string; moduleLabel: string; scope: string; count: number; note?: string }

const CLEAN_OPTS = [30, 60, 90, 180, 365];

export default function LogManagementPage() {
  const { toast } = useToast();
  const { config, reload } = useConfig();
  const [mods, setMods] = useState<Mod[]>([]);
  const [audit, setAudit] = useState<Audit[]>([]);
  const [superAdmin, setSuperAdmin] = useState(false);
  const [active, setActive] = useState("");
  const [rows, setRows] = useState<Row[]>([]);
  const [total, setTotal] = useState(0);
  const [sel, setSel] = useState<Set<string>>(new Set());
  const [q, setQ] = useState(""); const [from, setFrom] = useState(""); const [to, setTo] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState("");
  const [cleanEnabled, setCleanEnabled] = useState(false);
  const [cleanDays, setCleanDays] = useState(90);

  const loadModules = useCallback(async () => {
    try {
      const res = await fetch(withBase("/api/admin/log-management"), { credentials: "include", cache: "no-store" });
      const d = await res.json().catch(() => ({}));
      setMods(d.modules ?? []); setAudit(d.audit ?? []); setSuperAdmin(!!d.superAdmin);
      setActive((a) => a || (d.modules?.[0]?.key ?? ""));
    } catch { /* ignore */ }
    setLoading(false);
  }, []);
  useEffect(() => { loadModules(); }, [loadModules]);
  useEffect(() => { if (config.logCleanup) { setCleanEnabled(!!config.logCleanup.enabled); setCleanDays(config.logCleanup.days ?? 90); } }, [config.logCleanup]);

  const loadRows = useCallback(async () => {
    if (!active) return;
    const qs = new URLSearchParams({ module: active });
    if (q) qs.set("q", q); if (from) qs.set("from", from); if (to) qs.set("to", to);
    try {
      const res = await fetch(withBase(`/api/admin/log-management?${qs}`), { credentials: "include", cache: "no-store" });
      const d = await res.json().catch(() => ({}));
      setRows(d.rows ?? []); setTotal(d.total ?? 0); setSel(new Set());
    } catch { /* ignore */ }
  }, [active, q, from, to]);
  useEffect(() => { loadRows(); }, [loadRows]);

  const activeMod = mods.find((m) => m.key === active);

  const del = async (scope: "single" | "selected" | "all" | "filtered", ids?: string[]) => {
    const label = activeMod?.label ?? "logs";
    const msg = scope === "single" ? "Are you sure you want to delete this log entry?"
      : scope === "selected" ? `Delete ${ids?.length ?? 0} selected log entr${(ids?.length ?? 0) === 1 ? "y" : "ies"}?`
      : scope === "all" ? `⚠️ DELETE ALL "${label}"?\n\nThis permanently removes every record in this module and cannot be undone.`
      : `Delete all "${label}" that match the current search/date filter?`;
    if (!confirm(msg)) return;
    setBusy(scope + (ids?.[0] ?? ""));
    try {
      const res = await fetch(withBase("/api/admin/log-management"), { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ key: active, scope, ids, q: scope === "filtered" ? q : undefined, from: scope === "filtered" ? from : undefined, to: scope === "filtered" ? to : undefined }) });
      const d = await res.json().catch(() => ({}));
      if (res.ok) { toast(`Deleted ${d.deleted ?? 0} log${d.deleted === 1 ? "" : "s"}`, "success"); await loadModules(); await loadRows(); }
      else toast((d as { error?: string }).error ?? "Delete failed", "error");
    } catch { toast("Delete failed", "error"); }
    setBusy("");
  };

  const saveCleanup = async () => {
    setBusy("clean");
    const res = await saveConfig({ logCleanup: { enabled: cleanEnabled, days: cleanDays } });
    setBusy("");
    if (res.ok) { toast("Auto-cleanup settings saved", "success"); reload(); } else toast(res.error ?? "Failed", "error");
  };

  const exportCsv = () => {
    const data = [["Reference", "Date & Time", "Detail"], ...rows.map((r) => [r.id, r.at ? new Date(r.at).toLocaleString("en-GB") : "", r.summary.replace(/[\r\n,]+/g, " ")])];
    const csv = data.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\r\n");
    const url = URL.createObjectURL(new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a"); a.href = url; a.download = `${active}-logs-${new Date().toISOString().slice(0, 10)}.csv`; a.click(); URL.revokeObjectURL(url);
  };

  const toggleSel = (id: string) => setSel((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const allShownSelected = rows.length > 0 && rows.every((r) => sel.has(r.id));

  return (
    <div className="space-y-4">
      <div>
        <h1 className="flex items-center gap-2 font-display text-2xl font-extrabold text-mist-100"><ScrollText className="size-6 text-lotus-300" /> Log Management</h1>
        <p className="mt-1 text-sm text-mist-400">View, search, export and delete activity logs across every module. Deletions are permanent and recorded in a secure audit trail below.</p>
      </div>

      {/* Auto-cleanup settings */}
      <Card className="flex flex-wrap items-center justify-between gap-3 p-4">
        <div className="flex items-center gap-2">
          <Clock className="size-4 text-lotus-300" />
          <span className="text-sm font-semibold text-mist-100">Auto log cleanup</span>
          <button onClick={() => setCleanEnabled((v) => !v)} className={cn("rounded-full px-3 py-1 text-xs font-bold", cleanEnabled ? "bg-emerald-500/20 text-emerald-300" : "bg-white/[0.06] text-mist-400")}>{cleanEnabled ? "ON" : "OFF"}</button>
          <span className="text-xs text-mist-400">delete logs older than</span>
          <select value={cleanDays} onChange={(e) => setCleanDays(Number(e.target.value))} className="h-9 rounded-lg border border-line bg-ink-800 px-2 text-sm text-mist-100">{CLEAN_OPTS.map((d) => <option key={d} value={d}>{d === 365 ? "1 Year" : `${d} Days`}</option>)}</select>
        </div>
        <Button size="sm" onClick={saveCleanup} disabled={busy === "clean"}>{busy === "clean" ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />} Save</Button>
      </Card>

      {loading ? <div className="grid h-24 place-items-center text-mist-400"><Loader2 className="size-5 animate-spin" /></div> : (
        <div className="grid gap-4 lg:grid-cols-[240px_1fr]">
          {/* Module list */}
          <Card className="h-max overflow-hidden p-0">
            <div className="border-b border-white/5 px-4 py-2.5 text-xs font-bold text-mist-400">MODULES</div>
            <div className="max-h-[70vh] overflow-y-auto">
              {mods.map((m) => (
                <button key={m.key} onClick={() => setActive(m.key)} className={cn("flex w-full items-center justify-between gap-2 border-b border-white/5 px-4 py-2.5 text-left text-sm transition last:border-0", active === m.key ? "bg-lotus-500/10 text-lotus-200" : "text-mist-300 hover:bg-white/[0.03]")}>
                  <span className="min-w-0 flex-1 truncate">{m.label}{m.superOnly && <ShieldAlert className="ml-1 inline size-3 text-amber-300" />}</span>
                  <span className="shrink-0 rounded-full bg-white/[0.06] px-1.5 text-[10px] font-bold text-mist-400">{m.count}</span>
                </button>
              ))}
            </div>
          </Card>

          {/* Log table */}
          <div className="min-w-0 space-y-3">
            <Card className="p-3">
              <div className="flex flex-wrap items-center gap-2">
                <div className="flex items-center gap-1.5 rounded-lg border border-line bg-ink-800 px-2"><Search className="size-3.5 text-mist-500" /><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search logs…" className="h-9 w-40 bg-transparent text-sm text-mist-100 outline-none" /></div>
                <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="h-9 rounded-lg border border-line bg-ink-800 px-2 text-xs text-mist-100" />
                <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="h-9 rounded-lg border border-line bg-ink-800 px-2 text-xs text-mist-100" />
                <div className="ml-auto flex flex-wrap gap-2">
                  <Button size="sm" variant="secondary" onClick={exportCsv}><Download className="size-4" /> Export</Button>
                  <Button size="sm" variant="secondary" disabled={sel.size === 0 || !!busy} onClick={() => del("selected", [...sel])}><Trash2 className="size-4" /> Delete selected ({sel.size})</Button>
                  {(q || from || to) && <Button size="sm" variant="secondary" disabled={!!busy} onClick={() => del("filtered")}><Trash2 className="size-4" /> Delete filtered</Button>}
                  {superAdmin && <button onClick={() => del("all")} disabled={!!busy} className="inline-flex items-center gap-1 rounded-lg bg-rose-500/15 px-3 py-1.5 text-xs font-bold text-rose-300 transition hover:bg-rose-500/25 disabled:opacity-50"><ShieldAlert className="size-4" /> Delete ALL</button>}
                </div>
              </div>
            </Card>

            <Card className="overflow-hidden p-0">
              <div className="flex items-center justify-between border-b border-white/5 px-4 py-2 text-xs text-mist-400">
                <span>{activeMod?.label} — {total} record{total === 1 ? "" : "s"}{total > rows.length ? ` (showing ${rows.length})` : ""}</span>
                {rows.length > 0 && <button onClick={() => setSel(allShownSelected ? new Set() : new Set(rows.map((r) => r.id)))} className="text-lotus-300 hover:text-lotus-200">{allShownSelected ? "Clear" : "Select all shown"}</button>}
              </div>
              <div className="max-h-[60vh] overflow-auto">
                <table className="w-full text-left text-xs">
                  <thead className="sticky top-0 bg-ink-900 text-mist-400"><tr><th className="w-8 px-3 py-2"></th><th className="px-3 py-2 font-semibold">Date &amp; Time</th><th className="px-3 py-2 font-semibold">Detail</th><th className="w-10 px-3 py-2"></th></tr></thead>
                  <tbody>
                    {rows.length === 0 ? <tr><td colSpan={4} className="px-4 py-10 text-center text-mist-500">No log records{q || from || to ? " match the filter" : ""}.</td></tr> : rows.map((r) => (
                      <tr key={r.id} className={cn("border-t border-white/5 hover:bg-white/[0.02]", sel.has(r.id) && "bg-lotus-500/[0.06]")}>
                        <td className="px-3 py-2"><input type="checkbox" checked={sel.has(r.id)} onChange={() => toggleSel(r.id)} className="size-4 accent-lotus-500" /></td>
                        <td className="whitespace-nowrap px-3 py-2 text-mist-400">{r.at ? new Date(r.at).toLocaleString("en-GB") : "—"}</td>
                        <td className="px-3 py-2 text-mist-200"><span className="line-clamp-2">{r.summary}</span></td>
                        <td className="px-3 py-2"><button title="Delete this entry" onClick={() => del("single", [r.id])} disabled={!!busy} className="grid size-7 place-items-center rounded-lg text-rose-300 hover:bg-rose-500/10 disabled:opacity-40"><Trash2 className="size-3.5" /></button></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          </div>
        </div>
      )}

      {/* Deletion audit trail */}
      <Card className="overflow-hidden p-0">
        <div className="border-b border-white/5 px-5 py-3"><h2 className="flex items-center gap-2 text-sm font-bold text-mist-100"><History className="size-4 text-amber-300" /> Deletion audit trail (who deleted what &amp; when)</h2></div>
        <div className="max-h-72 overflow-y-auto">
          {audit.length === 0 ? <p className="px-5 py-6 text-center text-sm text-mist-500">No deletions recorded.</p> : audit.map((a) => (
            <div key={a.id} className="flex flex-wrap items-center gap-2 border-b border-white/5 px-5 py-2 text-xs last:border-0">
              <span className="font-semibold text-mist-200">{a.by}</span>
              <span className="rounded-full bg-rose-500/15 px-1.5 py-0.5 text-[10px] font-bold text-rose-300">−{a.count}</span>
              <span className="text-mist-400">{a.moduleLabel} · <span className="capitalize">{a.scope}</span>{a.note ? ` · ${a.note}` : ""}</span>
              <span className="ml-auto text-[10px] text-mist-600">{new Date(a.at).toLocaleString("en-GB")}</span>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
