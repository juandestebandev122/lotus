"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import { useConfig, saveConfig, type GiftItem } from "@/lib/config";
import { fetchGiftLog, deleteGiftLogEntry, clearGiftLog, type GiftActivity, type GiftLogView } from "@/lib/admin";
import { ReportFilters, matchesReportFilter, emptyReportFilter, type ReportFilter } from "@/components/admin/ReportFilters";
import { cn } from "@/lib/cn";
import { Gift, Coins, ArrowRight, RefreshCw, Send, Inbox, Gamepad2, Plus, Trash2, Save, Percent, Landmark, Search, Download, Printer, ChevronDown, Building2, HandCoins, XCircle, FileSpreadsheet } from "lucide-react";

const CONTEXT_TONE: Record<string, string> = {
  "Ludo game": "bg-rose-500/15 text-rose-300",
  "Chess game": "bg-sky-500/15 text-sky-300",
  "Snake & Ladder game": "bg-emerald-500/15 text-emerald-300",
  "Voice room": "bg-lotus-500/15 text-lotus-300",
  Profile: "bg-amber-500/15 text-amber-300",
};

export default function AdminGiftsPage() {
  const { toast } = useToast();
  const [data, setData] = useState<GiftActivity>({ entries: [], totalGifts: 0, totalCoins: 0, topSenders: [], topReceivers: [] });
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState("");

  const load = () => fetchGiftLog().then((d) => { setData(d); setLoading(false); });

  // Remove a single gift-log row (audit view only — does not reverse coins).
  const del = async (id: string, label: string) => {
    if (!confirm(`Delete this gift log entry (${label})? This only removes the record — it does not reverse any coins.`)) return;
    setBusy(id);
    const res = await deleteGiftLogEntry(id);
    setBusy("");
    if (res.ok) { setData((d) => ({ ...d, entries: d.entries.filter((g) => g.id !== id) })); toast("Gift log entry deleted", "success"); }
    else toast(res.error ?? "Could not delete", "error");
  };
  const clearAll = async () => {
    if (!confirm(`Clear the ENTIRE gift log (${data.entries.length} entries)? This only clears the log view — it does not reverse any coins. This cannot be undone.`)) return;
    setBusy("all");
    const res = await clearGiftLog();
    setBusy("");
    if (res.ok) { toast("Gift log cleared", "success"); load(); }
    else toast(res.error ?? "Could not clear", "error");
  };
  useEffect(() => {
    load();
    const t = setInterval(load, 8000); // live refresh — monitor gifts as they happen
    return () => clearInterval(t);
  }, []);

  const stats = [
    { label: "Gifts sent", value: data.totalGifts.toLocaleString("en-SA"), icon: Gift, tile: "bg-lotus-500/15 text-lotus-300" },
    { label: "Coins gifted", value: data.totalCoins.toLocaleString("en-SA"), icon: Coins, tile: "bg-gold-500/15 text-gold-300" },
    { label: "Company profit", value: (data.totalCompany ?? 0).toLocaleString("en-SA"), icon: Building2, tile: "bg-fuchsia-500/15 text-fuchsia-300" },
    { label: "Agency profit", value: (data.totalAgency ?? 0).toLocaleString("en-SA"), icon: Landmark, tile: "bg-sky-500/15 text-sky-300" },
    { label: "Trust profit", value: (data.totalTrust ?? 0).toLocaleString("en-SA"), icon: HandCoins, tile: "bg-amber-500/15 text-amber-300" },
    { label: "Failed attempts", value: (data.failedCount ?? 0).toLocaleString("en-SA"), icon: XCircle, tile: "bg-rose-500/15 text-rose-300" },
  ];

  return (
    <div className="space-y-6">
      {/* ===== Gift earnings split (receiver % vs company revenue) ===== */}
      <GiftSplitControl />

      {/* ===== Manage gifts (admin CRUD) ===== */}
      <GiftManager />

      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-extrabold text-mist-100">Gift activity</h1>
          <p className="text-sm text-mist-400">Monitor every gift: who sent what to whom, where it happened, and how many coins moved.</p>
        </div>
        <Button variant="secondary" size="sm" onClick={load}><RefreshCw className="size-4" /> Refresh</Button>
      </div>

      {/* Summary */}
      <div className="grid gap-4 sm:grid-cols-3 xl:grid-cols-6">
        {stats.map((s) => (
          <Card key={s.label} className="flex items-center gap-3 p-5">
            <span className={`grid size-12 shrink-0 place-items-center rounded-full ${s.tile}`}><s.icon className="size-6" /></span>
            <div>
              <div className="font-display text-2xl font-extrabold text-mist-100">{s.value}</div>
              <div className="text-sm text-mist-400">{s.label}</div>
            </div>
          </Card>
        ))}
      </div>

      {/* Leaderboards */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="p-5">
          <h2 className="mb-3 flex items-center gap-2 font-semibold text-mist-100"><Send className="size-4 text-emerald-300" /> Top gift senders</h2>
          {data.topSenders.length === 0 ? (
            <p className="py-4 text-center text-sm text-mist-500">No gifts sent yet.</p>
          ) : (
            <div className="space-y-2">
              {data.topSenders.map((s, i) => (
                <div key={s.name + i} className="flex items-center gap-3 rounded-lg bg-white/[0.04] px-3 py-2">
                  <span className="grid size-6 place-items-center rounded-full bg-emerald-500/20 text-xs font-bold text-emerald-300">{i + 1}</span>
                  <span className="flex-1 truncate text-sm font-medium text-mist-100">{s.name}</span>
                  <span className="text-xs text-mist-400">{s.count} gifts</span>
                  <span className="inline-flex items-center gap-1 text-xs font-bold text-gold-300">🪙 {s.coins.toLocaleString("en-SA")}</span>
                </div>
              ))}
            </div>
          )}
        </Card>
        <Card className="p-5">
          <h2 className="mb-3 flex items-center gap-2 font-semibold text-mist-100"><Inbox className="size-4 text-lotus-300" /> Top gift receivers</h2>
          {data.topReceivers.length === 0 ? (
            <p className="py-4 text-center text-sm text-mist-500">No gifts received yet.</p>
          ) : (
            <div className="space-y-2">
              {data.topReceivers.map((r, i) => (
                <div key={r.name + i} className="flex items-center gap-3 rounded-lg bg-white/[0.04] px-3 py-2">
                  <span className="grid size-6 place-items-center rounded-full bg-lotus-500/20 text-xs font-bold text-lotus-300">{i + 1}</span>
                  <span className="flex-1 truncate text-sm font-medium text-mist-100">{r.name}</span>
                  <span className="text-xs text-mist-400">{r.count} gifts</span>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      {/* Complete gift history — search / filter / expandable audit rows / export */}
      <GiftAuditLog data={data} loading={loading} busy={busy} del={del} clearAll={clearAll} />
    </div>
  );
}

// ===== Complete gift history (audit) — every question answerable per gift:
// sender/receiver + User IDs, gift + value, group + type, who was present,
// transaction IDs, balances before/after both sides, company/agency/trust
// profit, and status. Search + filter + export (CSV / Excel / PDF).
function GiftAuditLog({ data, loading, busy, del, clearAll }: {
  data: GiftActivity;
  loading: boolean;
  busy: string;
  del: (id: string, label: string) => void;
  clearAll: () => void;
}) {
  const [repFilter, setRepFilter] = useState<ReportFilter>(emptyReportFilter);
  const [q, setQ] = useState("");
  const [fGroup, setFGroup] = useState("");
  const [fUser, setFUser] = useState("");
  const [fGift, setFGift] = useState("");
  const [fStatus, setFStatus] = useState("");
  const [open, setOpen] = useState<string | null>(null);

  // Filter options derived from the data itself (groups / users / gifts seen in the log).
  const groups = useMemo(() => {
    const m = new Map<string, string>();
    for (const g of data.entries) if (g.roomId) m.set(g.roomId, g.roomName || g.roomId);
    return [...m.entries()].sort((a, b) => a[1].localeCompare(b[1]));
  }, [data.entries]);
  const users = useMemo(() => {
    const m = new Map<string, string>();
    for (const g of data.entries) {
      if (g.fromId) m.set(g.fromId, `${g.fromName}${g.fromPublicId ? ` (${g.fromPublicId})` : ""}`);
      if (g.toId) m.set(g.toId, `${g.toName}${g.toPublicId ? ` (${g.toPublicId})` : ""}`);
    }
    return [...m.entries()].sort((a, b) => a[1].localeCompare(b[1]));
  }, [data.entries]);
  const giftKinds = useMemo(() => {
    const m = new Map<string, string>();
    for (const g of data.entries) m.set(g.giftId, `${g.emoji} ${g.giftName}`);
    return [...m.entries()].sort((a, b) => a[1].localeCompare(b[1]));
  }, [data.entries]);

  const shown = data.entries.filter((g) => {
    if (!matchesReportFilter(repFilter, g.at, `${g.fromName} ${g.toName} ${g.giftName ?? ""}`)) return false;
    if (fGroup && g.roomId !== fGroup) return false;
    if (fUser && g.fromId !== fUser && g.toId !== fUser) return false;
    if (fGift && g.giftId !== fGift) return false;
    if (fStatus && (g.status ?? "success") !== fStatus) return false;
    if (q.trim()) {
      const s = q.trim().toLowerCase();
      const hay = [g.fromName, g.fromPublicId, g.fromId, g.toName, g.toPublicId, g.toId, g.roomName, g.roomId, g.giftName, g.giftId, g.txId, g.receiverTxId, g.id, g.at.slice(0, 10), new Date(g.at).toLocaleDateString("en-GB")]
        .filter(Boolean).join(" ").toLowerCase();
      if (!hay.includes(s)) return false;
    }
    return true;
  });

  // ---- Export: one column set drives CSV, Excel and PDF, so they always match.
  const COLS: [string, (g: GiftLogView) => string][] = [
    ["Date & Time", (g) => new Date(g.at).toLocaleString("en-GB")],
    ["Transaction ID", (g) => g.txId ?? g.id],
    ["Receiver Tx ID", (g) => g.receiverTxId ?? ""],
    ["Gift", (g) => g.giftName],
    ["Gift ID", (g) => g.giftId],
    ["Value (coins)", (g) => String(g.cost)],
    ["Sender", (g) => g.fromName],
    ["Sender User ID", (g) => g.fromPublicId ?? g.fromId ?? ""],
    ["Receiver", (g) => g.toName],
    ["Receiver User ID", (g) => g.toPublicId ?? g.toId ?? ""],
    ["Group", (g) => g.roomName ?? g.context],
    ["Group ID", (g) => g.roomId ?? ""],
    ["Room Type", (g) => g.roomType ?? g.context],
    ["Users Present", (g) => (g.presentCount != null ? String(g.presentCount) : "")],
    ["Present List", (g) => (g.presentUsers ?? []).map((p) => `${p.name} (${p.publicId ?? p.id})`).join("; ")],
    ["Sender Balance Before", (g) => (g.senderBalanceBefore != null ? String(g.senderBalanceBefore) : "")],
    ["Sender Balance After", (g) => (g.senderBalanceAfter != null ? String(g.senderBalanceAfter) : "")],
    ["Receiver Balance Before", (g) => (g.receiverBalanceBefore != null ? String(g.receiverBalanceBefore) : "")],
    ["Receiver Balance After", (g) => (g.receiverBalanceAfter != null ? String(g.receiverBalanceAfter) : "")],
    ["Receiver Unit", (g) => g.receiverUnit ?? "coins"],
    ["Receiver Share", (g) => (g.receiverShare != null ? String(g.receiverShare) : "")],
    ["Company Profit", (g) => (g.companyShare != null ? String(g.companyShare) : "")],
    ["Agency Profit", (g) => (g.agencyShare != null ? String(g.agencyShare) : "")],
    ["Trust Profit", (g) => (g.trustShare != null ? String(g.trustShare) : "")],
    ["Status", (g) => g.status ?? "success"],
    ["Fail Reason", (g) => g.failReason ?? ""],
  ];
  const download = (name: string, blob: Blob) => {
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = name;
    a.click();
    URL.revokeObjectURL(a.href);
  };
  const stamp = () => new Date().toISOString().slice(0, 10);
  const exportCsv = () => {
    const rows = [COLS.map((c) => c[0]), ...shown.map((g) => COLS.map(([, f]) => f(g)))];
    const csv = "﻿" + rows.map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(",")).join("\r\n");
    download(`gift-history-${stamp()}.csv`, new Blob([csv], { type: "text/csv;charset=utf-8" }));
  };
  const tableHtml = () => {
    const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    const head = `<tr>${COLS.map((c) => `<th>${esc(c[0])}</th>`).join("")}</tr>`;
    const body = shown.map((g) => `<tr>${COLS.map(([, f]) => `<td>${esc(f(g))}</td>`).join("")}</tr>`).join("");
    return `<table border="1" cellspacing="0" cellpadding="4"><thead>${head}</thead><tbody>${body}</tbody></table>`;
  };
  const exportXls = () => {
    const html = `<html xmlns:x="urn:schemas-microsoft-com:office:excel"><head><meta charset="utf-8"></head><body>${tableHtml()}</body></html>`;
    download(`gift-history-${stamp()}.xls`, new Blob([html], { type: "application/vnd.ms-excel" }));
  };
  const exportPdf = () => {
    const w = window.open("", "_blank", "width=1200,height=800");
    if (!w) return;
    w.document.write(`<html><head><title>Gift History — ${stamp()}</title><style>
      body{font-family:Arial,sans-serif;font-size:10px;margin:16px}
      h1{font-size:16px;margin:0 0 2px} p{color:#555;margin:0 0 10px}
      table{border-collapse:collapse;width:100%} th,td{border:1px solid #999;padding:3px 5px;text-align:left;vertical-align:top}
      th{background:#eee} tr:nth-child(even) td{background:#f7f7f7}
    </style></head><body><h1>Gift History Report</h1><p>Generated ${new Date().toLocaleString("en-GB")} · ${shown.length} gifts</p>${tableHtml()}</body></html>`);
    w.document.close();
    w.focus();
    w.print(); // the browser's print dialog saves it as a PDF
  };

  const inp = "h-9 rounded-lg border border-line bg-ink-900 px-2.5 text-xs text-mist-100 outline-none focus:border-lotus-400";
  const n = (v?: number) => (v ?? 0).toLocaleString("en-SA");

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 font-semibold text-mist-100"><Gamepad2 className="size-4 text-petal-400" /> Complete gift history <span className="font-normal text-mist-500">({shown.length} of {data.entries.length})</span></h2>
        <div className="flex flex-wrap gap-1.5">
          <Button variant="secondary" size="sm" onClick={exportCsv} disabled={shown.length === 0}><Download className="size-4" /> CSV</Button>
          <Button variant="secondary" size="sm" onClick={exportXls} disabled={shown.length === 0}><FileSpreadsheet className="size-4" /> Excel</Button>
          <Button variant="secondary" size="sm" onClick={exportPdf} disabled={shown.length === 0}><Printer className="size-4" /> PDF</Button>
          {data.entries.length > 0 && (
            <Button variant="secondary" size="sm" onClick={clearAll} disabled={busy === "all"} className="!text-rose-300 hover:!bg-rose-500/10"><Trash2 className="size-4" /> Clear log</Button>
          )}
        </div>
      </div>

      {/* Search + filters — by User ID, Group, Gift, Transaction ID, Date, Status. */}
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <label className="relative">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-mist-500" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search user ID / group / gift / transaction ID / date…" className={cn(inp, "w-72 pl-8")} />
        </label>
        <select value={fGroup} onChange={(e) => setFGroup(e.target.value)} className={inp}>
          <option value="">All groups</option>
          {groups.map(([id, name]) => <option key={id} value={id}>{name}</option>)}
        </select>
        <select value={fUser} onChange={(e) => setFUser(e.target.value)} className={inp}>
          <option value="">All users</option>
          {users.map(([id, name]) => <option key={id} value={id}>{name}</option>)}
        </select>
        <select value={fGift} onChange={(e) => setFGift(e.target.value)} className={inp}>
          <option value="">All gifts</option>
          {giftKinds.map(([id, name]) => <option key={id} value={id}>{name}</option>)}
        </select>
        <select value={fStatus} onChange={(e) => setFStatus(e.target.value)} className={inp}>
          <option value="">All statuses</option>
          <option value="success">Success</option>
          <option value="failed">Failed</option>
          <option value="refunded">Refunded</option>
        </select>
      </div>
      <ReportFilters value={repFilter} onChange={setRepFilter} className="mb-3" />

      <Card className="overflow-hidden p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-white/[0.03] text-left text-xs uppercase tracking-wide text-mist-500">
              <tr>
                <th className="px-4 py-3">Gift</th>
                <th className="px-4 py-3">From</th>
                <th className="px-2 py-3"></th>
                <th className="px-4 py-3">To</th>
                <th className="px-4 py-3">Group</th>
                <th className="px-4 py-3">Value</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">When</th>
                <th className="px-4 py-3 text-right">Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.06]">
              {shown.map((g) => {
                const failed = (g.status ?? "success") === "failed";
                const isOpen = open === g.id;
                return (
                  <React.Fragment key={g.id}>
                    <tr className={cn("cursor-pointer hover:bg-white/[0.02]", failed && "opacity-70")} onClick={() => setOpen(isOpen ? null : g.id)}>
                      <td className="px-4 py-3">
                        <span className="inline-flex items-center gap-2">
                          <span className="text-xl leading-none">{g.emoji}</span>
                          <span>
                            <span className="block font-medium text-mist-100">{g.giftName}</span>
                            <span className="block font-mono text-[10px] text-mist-600">{g.giftId}</span>
                          </span>
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <Link href={`/admin/users?q=${encodeURIComponent(g.fromPublicId || g.fromId || g.fromName)}`} className="hover:underline">
                          <span className="block font-medium text-emerald-200 hover:text-lotus-300">{g.fromName}</span>
                          {(g.fromPublicId || g.fromId) && <span className="block font-mono text-[10px] text-mist-600">ID {g.fromPublicId ?? g.fromId}</span>}
                        </Link>
                      </td>
                      <td className="px-2 py-3 text-mist-600"><ArrowRight className="size-4" /></td>
                      <td className="px-4 py-3">
                        <Link href={`/admin/users?q=${encodeURIComponent(g.toPublicId || g.toId || g.toName || "")}`} className="hover:underline">
                          <span className="block font-medium text-lotus-200 hover:text-lotus-300">{g.toName || "—"}</span>
                          {(g.toPublicId || g.toId) && <span className="block font-mono text-[10px] text-mist-600">ID {g.toPublicId ?? g.toId}</span>}
                        </Link>
                      </td>
                      <td className="px-4 py-3">
                        {g.roomName ? (
                          <span>
                            <span className="block text-xs font-semibold text-mist-200">{g.roomName}</span>
                            <span className="block text-[10px] text-mist-500">{g.roomType}{g.roomLive ? " · live" : ""} · {g.presentCount ?? "?"} present</span>
                          </span>
                        ) : (
                          <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${CONTEXT_TONE[g.context] ?? "bg-white/[0.06] text-mist-300"}`}>{g.context}</span>
                        )}
                      </td>
                      <td className="px-4 py-3 font-semibold text-gold-300">🪙 {g.cost}</td>
                      <td className="px-4 py-3">
                        <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-bold capitalize", failed ? "bg-rose-500/15 text-rose-300" : g.status === "refunded" ? "bg-amber-500/15 text-amber-300" : "bg-emerald-500/15 text-emerald-300")}>{g.status ?? "success"}</span>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-mist-500">
                        {new Date(g.at).toLocaleString("en-SA", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <ChevronDown className={cn("ml-auto size-4 text-mist-500 transition", isOpen && "rotate-180")} />
                      </td>
                    </tr>
                    {isOpen && (
                      <tr className="bg-ink-900/50">
                        <td colSpan={9} className="px-5 py-4">
                          <div className="grid gap-3 text-xs sm:grid-cols-2 lg:grid-cols-4">
                            <AuditField label="Transaction ID" value={g.txId ?? g.id} mono />
                            <AuditField label="Receiver credit Tx" value={g.receiverTxId ?? "—"} mono />
                            <AuditField label="Group ID" value={g.roomId ?? "—"} mono />
                            <AuditField label="Room type" value={g.roomType ?? g.context} />
                            <AuditField label="Sender balance" value={g.senderBalanceBefore != null ? `${n(g.senderBalanceBefore)} → ${n(g.senderBalanceAfter)} coins` : "— (older entry)"} />
                            <AuditField label="Receiver balance" value={g.receiverBalanceBefore != null ? `${n(g.receiverBalanceBefore)} → ${n(g.receiverBalanceAfter)} ${g.receiverUnit ?? "coins"}` : "— (older entry)"} />
                            <AuditField label="Receiver share" value={g.receiverShare != null ? `${n(g.receiverShare)} ${g.receiverUnit ?? "coins"}` : "—"} />
                            <AuditField label="Profits (Company / Agency / Trust)" value={`${n(g.companyShare)} / ${n(g.agencyShare)} / ${n(g.trustShare)}`} />
                          </div>
                          {failed && g.failReason && <p className="mt-2 rounded-lg bg-rose-500/10 px-3 py-1.5 text-xs text-rose-300">Failed: {g.failReason}</p>}
                          <div className="mt-3">
                            <div className="mb-1 text-[10px] font-bold uppercase tracking-wide text-mist-500">Users present when this gift was sent {g.presentCount != null ? `(${g.presentCount})` : ""}</div>
                            {g.presentUsers && g.presentUsers.length > 0 ? (
                              <div className="flex flex-wrap gap-1.5">
                                {g.presentUsers.map((p) => (
                                  <span key={p.id} className="rounded-full bg-white/[0.06] px-2 py-0.5 text-[11px] text-mist-200">{p.name} <span className="font-mono text-[9px] text-mist-500">{p.publicId ?? p.id}</span></span>
                                ))}
                              </div>
                            ) : (
                              <p className="text-[11px] text-mist-600">{g.roomId ? "No presence snapshot (older entry — recorded from v292 onward)." : "Sent outside a group (profile / direct)."}</p>
                            )}
                          </div>
                          <div className="mt-3 text-right">
                            <button onClick={(e) => { e.stopPropagation(); del(g.id, `${g.giftName} · ${g.fromName} → ${g.toName}`); }} disabled={busy === g.id} className="inline-flex items-center gap-1 rounded-lg bg-rose-500/10 px-2.5 py-1.5 text-[11px] font-semibold text-rose-300 transition hover:bg-rose-500/20 disabled:opacity-50">
                              <Trash2 className="size-3.5" /> Delete this log entry
                            </button>
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}
              {!loading && shown.length === 0 && (
                <tr><td colSpan={9} className="px-4 py-10 text-center text-sm text-mist-500">{data.entries.length === 0 ? "No gifts have been sent yet. When a player gifts another, it shows up here instantly." : "No gifts match this search/filter."}</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>
      <p className="mt-2 text-[11px] text-mist-500">Live — refreshes every few seconds. Tap a row for the full audit (transaction IDs, balances before/after, profits, who was present). Exports include every column for the current filter.</p>
    </div>
  );
}

function AuditField({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="rounded-lg border border-line bg-ink-800/50 px-3 py-2">
      <div className="text-[10px] font-bold uppercase tracking-wide text-mist-500">{label}</div>
      <div className={cn("mt-0.5 text-mist-100", mono && "font-mono text-[11px]")}>{value}</div>
    </div>
  );
}

// ===== Admin gift catalog editor — add / edit / remove gifts & emojis =====
function GiftManager() {
  const { config, loading, reload } = useConfig();
  const { toast } = useToast();
  const [gifts, setGifts] = useState<GiftItem[]>(config.giftCatalog ?? []);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!loading) setGifts(config.giftCatalog ?? []);
  }, [loading, config.giftCatalog]);

  const [addedId, setAddedId] = useState<string | null>(null);

  const upd = (id: string, patch: Partial<GiftItem>) =>
    setGifts((g) => g.map((x) => (x.id === id ? { ...x, ...patch } : x)));
  const add = () => {
    const id = `g_${Date.now().toString(36)}`;
    // Prepend so the new row appears at the TOP, instantly visible — otherwise
    // it lands below a long list, off-screen, and looks like nothing happened.
    setGifts((g) => [{ id, emoji: "🎁", name: "New gift", cost: 100, category: "Popular", active: true }, ...g]);
    setAddedId(id);
    toast("New gift added — edit it, then press “Save gifts” 🎁", "success");
    setTimeout(() => setAddedId((cur) => (cur === id ? null : cur)), 2500);
  };
  const remove = (id: string) => setGifts((g) => g.filter((x) => x.id !== id));

  const save = async () => {
    setSaving(true);
    const res = await saveConfig({ giftCatalog: gifts });
    setSaving(false);
    if (res.ok) {
      await reload();
      toast("Gifts saved — live in the app now 🎁", "success");
    } else {
      toast(res.error ?? "Could not save gifts", "error");
    }
  };

  const field = "h-9 rounded-lg border border-line bg-ink-900 px-2.5 text-sm text-mist-100 outline-none focus:border-lotus-400";

  return (
    <Card className="p-5">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-display text-xl font-extrabold text-mist-100">Manage gifts</h2>
          <p className="text-sm text-mist-400">Add, edit, or remove gifts &amp; emojis. Changes go live in the app&apos;s gift picker after you save.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" size="sm" onClick={add}><Plus className="size-4" /> Add gift</Button>
          <Button size="sm" onClick={save} disabled={saving}><Save className="size-4" /> {saving ? "Saving…" : "Save gifts"}</Button>
        </div>
      </div>

      {/* Header row (desktop) */}
      <div className="hidden grid-cols-[3rem_1fr_6rem_8rem_5rem_2.5rem] gap-2 px-1 pb-1.5 text-[11px] font-semibold uppercase tracking-wide text-mist-500 sm:grid">
        <span>Emoji</span><span>Name</span><span>Cost</span><span>Category</span><span>Active</span><span></span>
      </div>

      <div className="space-y-2">
        {gifts.map((g) => (
          <div key={g.id} className={`grid grid-cols-2 items-center gap-2 rounded-xl border bg-ink-850 p-2 transition sm:grid-cols-[3rem_1fr_6rem_8rem_5rem_2.5rem] ${addedId === g.id ? "border-lotus-400 ring-2 ring-lotus-500/40" : "border-white/8"}`}>
            <input value={g.emoji} onChange={(e) => upd(g.id, { emoji: e.target.value.slice(0, 4) })} className={`${field} text-center text-lg`} placeholder="🎁" />
            <input value={g.name} autoFocus={addedId === g.id} onChange={(e) => upd(g.id, { name: e.target.value.slice(0, 30) })} className={field} placeholder="Gift name" />
            <input type="number" min={0} value={g.cost} onChange={(e) => upd(g.id, { cost: Math.max(0, Number(e.target.value) || 0) })} className={field} placeholder="Coins" />
            <input value={g.category ?? ""} onChange={(e) => upd(g.id, { category: e.target.value.slice(0, 20) })} className={field} placeholder="Category" />
            <label className="flex items-center gap-2 text-xs text-mist-300">
              <input type="checkbox" checked={g.active} onChange={(e) => upd(g.id, { active: e.target.checked })} className="size-4 accent-lotus-500" />
              <span className="sm:hidden">Active</span>
            </label>
            <button onClick={() => remove(g.id)} className="grid size-9 place-items-center rounded-lg text-rose-300 hover:bg-rose-500/10" title="Remove gift">
              <Trash2 className="size-4" />
            </button>
          </div>
        ))}
        {gifts.length === 0 && (
          <p className="rounded-xl border border-white/8 bg-ink-850 px-3 py-6 text-center text-sm text-mist-500">No gifts yet — tap “Add gift”.</p>
        )}
      </div>
      <p className="mt-2 text-[11px] text-mist-500">Tip: paste any emoji (e.g. 🪷 Lotus, 🦋 Butterfly). Inactive gifts are hidden from users but kept here.</p>
    </Card>
  );
}

// ===== Gift earnings split — how much of each gift the RECEIVER keeps =====
function GiftSplitControl() {
  const { config, loading, reload } = useConfig();
  const { toast } = useToast();
  const [pct, setPct] = useState<number>(config.giftReceiverSharePct ?? 70);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!loading) setPct(config.giftReceiverSharePct ?? 70);
  }, [loading, config.giftReceiverSharePct]);

  const applied = config.giftReceiverSharePct ?? 70;
  const save = async () => {
    setSaving(true);
    const v = Math.max(0, Math.min(100, Math.round(Number(pct) || 0)));
    const res = await saveConfig({ giftReceiverSharePct: v });
    setSaving(false);
    if (res.ok) {
      await reload();
      toast(`Saved — receivers now keep ${v}% of each gift 🎁`, "success");
    } else {
      toast(res.error ?? "Could not save the split", "error");
    }
  };

  return (
    <Card className="p-5">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 font-display text-xl font-extrabold text-mist-100">
            <Percent className="size-5 text-emerald-300" /> Gift earnings split
          </h2>
          <p className="text-sm text-mist-400">
            Set how much of every gift&apos;s value is credited to the <span className="font-semibold text-emerald-200">receiver&apos;s wallet</span>. The rest is kept as <span className="font-semibold text-gold-200">company revenue</span>. Applies everywhere gifts are sent (rooms, games, profiles, events).
          </p>
        </div>
      </div>

      <div className="flex flex-wrap items-end gap-4">
        <label className="block">
          <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-mist-500">Receiver keeps (%)</span>
          <input
            type="number"
            min={0}
            max={100}
            value={pct}
            onChange={(e) => setPct(Math.max(0, Math.min(100, Number(e.target.value) || 0)))}
            className="h-10 w-28 rounded-lg border border-line bg-ink-900 px-3 text-lg font-bold text-mist-100 outline-none focus:border-lotus-400"
          />
        </label>
        <Button onClick={save} disabled={saving}><Save className="size-4" /> {saving ? "Saving…" : "Save split"}</Button>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <div className="rounded-xl border border-emerald-400/20 bg-emerald-500/[0.06] p-3">
          <div className="text-xs text-mist-400">Receiver keeps</div>
          <div className="font-display text-2xl font-extrabold text-emerald-200">{applied}%</div>
        </div>
        <div className="rounded-xl border border-gold-400/20 bg-gold-500/[0.06] p-3">
          <div className="text-xs text-mist-400">Company revenue</div>
          <div className="font-display text-2xl font-extrabold text-gold-200">{100 - applied}%</div>
        </div>
      </div>
      <p className="mt-3 text-[11px] text-mist-500">
        Example: a {applied}% split on a 🪙100 gift → the receiver gets 🪙{Math.round(100 * applied / 100)} and company revenue is 🪙{100 - Math.round(100 * applied / 100)}. Set to 100% to give receivers the full value. Takes effect immediately for new gifts.
      </p>
      {/* Clarify how agency profit works — the #1 recurring question. */}
      <div className="mt-4 rounded-xl border border-lotus-400/25 bg-lotus-500/[0.07] p-3">
        <p className="flex items-center gap-1.5 text-xs font-bold text-lotus-200"><Landmark className="size-4" /> Agency commission (automatic)</p>
        <p className="mt-1 text-[11px] leading-relaxed text-mist-300">
          The split above is for gifts to <b>normal users</b>. When a gift is sent to a member of an <b>active agency</b>, that agency&apos;s own <b>3-way commission</b> applies instead — <span className="text-emerald-200">Receiver&nbsp;%</span> · <span className="text-lotus-200">Agency&nbsp;%</span> · <span className="text-gold-200">Company&nbsp;%</span> — set per agency in <b>Admin → Agencies → (agency) → Commission</b>. The agency&apos;s cut is credited to its wallet and logged in the <b>Agent Profit</b> report automatically. Agency profit only accrues when the gift <b>recipient</b> is in an active agency (the sender&apos;s agency is not paid).
        </p>
      </div>
    </Card>
  );
}
