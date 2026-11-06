"use client";

import { useEffect, useState } from "react";
import { withBase } from "@/lib/base-path";
import { cn } from "@/lib/cn";
import { X, Printer, Loader2, Crown, ShieldCheck, Users2, Ban, Flag, Gift, SlidersHorizontal, ScrollText } from "lucide-react";

// FULL GROUP REPORT — one screen answering every "complete group details"
// question: owner + contact + User ID, creator, admins/co-admins, live members,
// blocked/kicked (who/by whom/why), reports + outcomes, gift totals, features.
// Printable (browser print → save as PDF).

interface Person { id: string; publicId: string; name: string; email: string; phone: string; status: string }
interface ModPerson extends Person { by: string; at: string; reason: string }
interface Report {
  room: { id: string; name: string; category: string; createdAt: string; status: string; live: boolean; image?: string };
  owner: Person;
  createdBy: Person;
  coAdmins: Person[];
  adminCount: number;
  coAdminCount: number;
  present: Person[];
  presentCount: number;
  capacity: number;
  blocked: ModPerson[];
  removed: ModPerson[];
  modLog: { id: string; at: string; action: string; targetId: string; targetName?: string; byName: string; reason?: string }[];
  reports: { id: string; at: string; by: string; against: string; category: string; detail: string; status: string; outcome: string }[];
  giftStats: { count: number; coins: number; company: number; agency: number; trust: number };
  features: Record<string, boolean | number | string>;
}

const n = (v: number) => (v ?? 0).toLocaleString("en-SA");
const d = (iso?: string) => (iso ? new Date(iso).toLocaleString("en-GB", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "—");

export function GroupReportModal({ roomId, onClose }: { roomId: string; onClose: () => void }) {
  const [rep, setRep] = useState<Report | null>(null);
  const [err, setErr] = useState("");

  useEffect(() => {
    fetch(withBase(`/api/admin/rooms/${roomId}/report`), { credentials: "include", cache: "no-store" })
      .then(async (r) => {
        const j = await r.json().catch(() => ({}));
        if (r.ok && j.report) setRep(j.report as Report);
        else setErr(j.error ?? "Could not load the report");
      })
      .catch(() => setErr("Network error"));
  }, [roomId]);

  const print = () => {
    const el = document.getElementById("group-report-body");
    if (!el) return;
    const w = window.open("", "_blank", "width=1000,height=800");
    if (!w) return;
    w.document.write(`<html><head><title>Group Report — ${rep?.room.name ?? roomId}</title><style>
      body{font-family:Arial,sans-serif;font-size:12px;color:#111;margin:20px}
      h1{font-size:18px;margin:0 0 4px} h2{font-size:13px;margin:14px 0 6px;border-bottom:1px solid #ccc;padding-bottom:3px;text-transform:uppercase}
      table{border-collapse:collapse;width:100%;margin:4px 0} th,td{border:1px solid #aaa;padding:4px 6px;text-align:left;font-size:11px}
      th{background:#eee} .muted{color:#666}
    </style></head><body>${el.innerHTML.replace(/<button[\s\S]*?<\/button>/g, "")}</body></html>`);
    w.document.close();
    w.focus();
    w.print();
  };

  return (
    <div className="fixed inset-0 z-[80] grid place-items-center overflow-y-auto bg-black/60 p-4" onClick={onClose}>
      <div className="my-8 w-full max-w-3xl rounded-2xl border border-white/10 bg-ink-850 p-5" onClick={(e) => e.stopPropagation()}>
        <div className="mb-3 flex items-center justify-between gap-2">
          <h2 className="flex items-center gap-2 font-display text-lg font-bold text-mist-100"><ScrollText className="size-5 text-lotus-300" /> Full group report</h2>
          <div className="flex items-center gap-1.5">
            <button onClick={print} disabled={!rep} className="inline-flex items-center gap-1.5 rounded-lg bg-white/[0.06] px-3 py-1.5 text-xs font-semibold text-mist-200 transition hover:bg-white/[0.12] disabled:opacity-50"><Printer className="size-3.5" /> Print / PDF</button>
            <button onClick={onClose} className="text-mist-400 hover:text-mist-100"><X className="size-5" /></button>
          </div>
        </div>

        {!rep && !err && <div className="grid h-40 place-items-center text-mist-400"><Loader2 className="size-6 animate-spin" /></div>}
        {err && <p className="rounded-lg bg-rose-500/10 px-3 py-2 text-sm text-rose-300">{err}</p>}

        {rep && (
          <div id="group-report-body" className="space-y-4">
            {/* Group identity */}
            <div className="rounded-xl border border-line bg-ink-800/50 p-4">
              <h1 className="font-display text-xl font-extrabold text-mist-100">{rep.room.name}</h1>
              <p className="muted mt-0.5 text-xs text-mist-400">
                Group ID: <span className="font-mono">{rep.room.id}</span> · {String(rep.features.type)} · {rep.room.category} · Status: <b className="capitalize">{rep.room.status}</b>{rep.room.live ? " · LIVE now" : ""} · Created {d(rep.room.createdAt)}
              </p>
            </div>

            {/* Owner & creator */}
            <section>
              <h2 className="mb-1.5 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-mist-400"><Crown className="size-3.5 text-gold-300" /> Owner &amp; creator</h2>
              <div className="overflow-x-auto rounded-xl border border-line">
                <table className="w-full text-xs">
                  <thead><tr className="bg-ink-800/60 text-left text-[10px] uppercase text-mist-500"><th className="px-3 py-2">Role</th><th className="px-3 py-2">Name</th><th className="px-3 py-2">User ID</th><th className="px-3 py-2">Email</th><th className="px-3 py-2">Mobile</th></tr></thead>
                  <tbody>
                    <tr className="border-t border-white/5"><td className="px-3 py-2 font-semibold text-gold-300">Owner (creator)</td><td className="px-3 py-2 text-mist-100">{rep.owner.name}</td><td className="px-3 py-2 font-mono text-mist-200">{rep.owner.publicId || rep.owner.id}</td><td className="px-3 py-2 text-mist-300">{rep.owner.email || "—"}</td><td className="px-3 py-2 text-mist-300">{rep.owner.phone || "not added"}</td></tr>
                  </tbody>
                </table>
              </div>
            </section>

            {/* Admins & co-admins */}
            <section>
              <h2 className="mb-1.5 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-mist-400"><ShieldCheck className="size-3.5 text-lotus-300" /> Admins ({rep.adminCount}) &amp; co-admins ({rep.coAdminCount})</h2>
              <div className="overflow-x-auto rounded-xl border border-line">
                <table className="w-full text-xs">
                  <thead><tr className="bg-ink-800/60 text-left text-[10px] uppercase text-mist-500"><th className="px-3 py-2">Role</th><th className="px-3 py-2">Name</th><th className="px-3 py-2">User ID</th><th className="px-3 py-2">Email</th></tr></thead>
                  <tbody>
                    <tr className="border-t border-white/5"><td className="px-3 py-2 font-semibold text-gold-300">Admin (host)</td><td className="px-3 py-2 text-mist-100">{rep.owner.name}</td><td className="px-3 py-2 font-mono text-mist-200">{rep.owner.publicId || rep.owner.id}</td><td className="px-3 py-2 text-mist-300">{rep.owner.email || "—"}</td></tr>
                    {rep.coAdmins.map((c) => (
                      <tr key={c.id} className="border-t border-white/5"><td className="px-3 py-2 font-semibold text-lotus-300">Co-admin</td><td className="px-3 py-2 text-mist-100">{c.name}</td><td className="px-3 py-2 font-mono text-mist-200">{c.publicId || c.id}</td><td className="px-3 py-2 text-mist-300">{c.email || "—"}</td></tr>
                    ))}
                    {rep.coAdmins.length === 0 && <tr className="border-t border-white/5"><td colSpan={4} className="px-3 py-2 text-mist-500">No co-admins.</td></tr>}
                  </tbody>
                </table>
              </div>
            </section>

            {/* Members */}
            <section>
              <h2 className="mb-1.5 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-mist-400"><Users2 className="size-3.5 text-sky-300" /> Members in the group right now ({rep.presentCount}) · {rep.capacity} seats</h2>
              {rep.present.length > 0 ? (
                <div className="flex flex-wrap gap-1.5">
                  {rep.present.map((p) => <span key={p.id} className="rounded-full bg-white/[0.06] px-2.5 py-1 text-[11px] text-mist-200">{p.name} <span className="font-mono text-[9px] text-mist-500">{p.publicId || p.id}</span></span>)}
                </div>
              ) : (
                <p className="text-xs text-mist-500">Nobody is in the group at this moment. (Public groups have no fixed roster — any registered user may join; this shows the live members.)</p>
              )}
            </section>

            {/* Blocked & kicked */}
            <section>
              <h2 className="mb-1.5 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-mist-400"><Ban className="size-3.5 text-rose-300" /> Blocked ({rep.blocked.length}) &amp; kicked ({rep.removed.length})</h2>
              <div className="overflow-x-auto rounded-xl border border-line">
                <table className="w-full text-xs">
                  <thead><tr className="bg-ink-800/60 text-left text-[10px] uppercase text-mist-500"><th className="px-3 py-2">Type</th><th className="px-3 py-2">User</th><th className="px-3 py-2">User ID</th><th className="px-3 py-2">By</th><th className="px-3 py-2">When</th><th className="px-3 py-2">Reason</th></tr></thead>
                  <tbody>
                    {rep.blocked.map((b) => (
                      <tr key={"b" + b.id} className="border-t border-white/5"><td className="px-3 py-2 font-semibold text-rose-300">Blocked</td><td className="px-3 py-2 text-mist-100">{b.name}</td><td className="px-3 py-2 font-mono text-mist-200">{b.publicId || b.id}</td><td className="px-3 py-2 text-mist-300">{b.by || "not recorded"}</td><td className="px-3 py-2 text-mist-400">{b.at ? d(b.at) : "not recorded"}</td><td className="px-3 py-2 text-mist-300">{b.reason || "—"}</td></tr>
                    ))}
                    {rep.removed.map((k) => (
                      <tr key={"k" + k.id} className="border-t border-white/5"><td className="px-3 py-2 font-semibold text-amber-300">Kicked</td><td className="px-3 py-2 text-mist-100">{k.name}</td><td className="px-3 py-2 font-mono text-mist-200">{k.publicId || k.id}</td><td className="px-3 py-2 text-mist-300">{k.by || "not recorded"}</td><td className="px-3 py-2 text-mist-400">{k.at ? d(k.at) : "not recorded"}</td><td className="px-3 py-2 text-mist-300">{k.reason || "—"}</td></tr>
                    ))}
                    {rep.blocked.length === 0 && rep.removed.length === 0 && <tr className="border-t border-white/5"><td colSpan={6} className="px-3 py-2 text-mist-500">Nobody has been blocked or kicked from this group.</td></tr>}
                  </tbody>
                </table>
              </div>
              <p className="mt-1 text-[10px] text-mist-600">"Not recorded" = the action happened before the moderation log existed. All new blocks/kicks record who did it, when, and the reason.</p>
            </section>

            {/* Reports */}
            <section>
              <h2 className="mb-1.5 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-mist-400"><Flag className="size-3.5 text-petal-300" /> Reports in this group ({rep.reports.length})</h2>
              {rep.reports.length > 0 ? (
                <div className="overflow-x-auto rounded-xl border border-line">
                  <table className="w-full text-xs">
                    <thead><tr className="bg-ink-800/60 text-left text-[10px] uppercase text-mist-500"><th className="px-3 py-2">When</th><th className="px-3 py-2">Reported by</th><th className="px-3 py-2">Against</th><th className="px-3 py-2">About</th><th className="px-3 py-2">Status</th><th className="px-3 py-2">Action taken</th></tr></thead>
                    <tbody>
                      {rep.reports.map((r) => (
                        <tr key={r.id} className="border-t border-white/5">
                          <td className="px-3 py-2 whitespace-nowrap text-mist-400">{d(r.at)}</td>
                          <td className="px-3 py-2 text-mist-100">{r.by}</td>
                          <td className="px-3 py-2 text-mist-100">{r.against}</td>
                          <td className="px-3 py-2 text-mist-300">{r.category}{r.detail ? ` — ${r.detail}` : ""}</td>
                          <td className="px-3 py-2"><span className={cn("rounded-full px-2 py-0.5 text-[10px] font-bold", r.status === "Pending" ? "bg-amber-500/15 text-amber-300" : "bg-emerald-500/15 text-emerald-300")}>{r.status}</span></td>
                          <td className="px-3 py-2 text-mist-300">{r.outcome || "Awaiting review"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="text-xs text-mist-500">No reports have been raised in this group.</p>
              )}
            </section>

            {/* Gifts */}
            <section>
              <h2 className="mb-1.5 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-mist-400"><Gift className="size-3.5 text-gold-300" /> Gifts sent in this group</h2>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
                <div className="rounded-lg border border-line bg-ink-800/50 px-3 py-2 text-center"><div className="font-display text-lg font-extrabold text-mist-100">{n(rep.giftStats.count)}</div><div className="text-[10px] text-mist-500">Gifts</div></div>
                <div className="rounded-lg border border-line bg-ink-800/50 px-3 py-2 text-center"><div className="font-display text-lg font-extrabold text-gold-300">{n(rep.giftStats.coins)}</div><div className="text-[10px] text-mist-500">Coins value</div></div>
                <div className="rounded-lg border border-line bg-ink-800/50 px-3 py-2 text-center"><div className="font-display text-lg font-extrabold text-fuchsia-300">{n(rep.giftStats.company)}</div><div className="text-[10px] text-mist-500">Company profit</div></div>
                <div className="rounded-lg border border-line bg-ink-800/50 px-3 py-2 text-center"><div className="font-display text-lg font-extrabold text-sky-300">{n(rep.giftStats.agency)}</div><div className="text-[10px] text-mist-500">Agency profit</div></div>
                <div className="rounded-lg border border-line bg-ink-800/50 px-3 py-2 text-center"><div className="font-display text-lg font-extrabold text-amber-300">{n(rep.giftStats.trust)}</div><div className="text-[10px] text-mist-500">Trust profit</div></div>
              </div>
              <p className="mt-1 text-[10px] text-mist-600">Per-gift detail (sender/receiver IDs, who was present, balances, transaction IDs) is in Admin → Gift Activity — filter by this group.</p>
            </section>

            {/* Features */}
            <section>
              <h2 className="mb-1.5 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-mist-400"><SlidersHorizontal className="size-3.5 text-emerald-300" /> Features available in this group</h2>
              <div className="flex flex-wrap gap-1.5">
                {[
                  ["Voice seats", true, `${rep.capacity} seats`],
                  ["Seat approval", rep.features.autoSeatApproval === true, rep.features.autoSeatApproval ? "instant join" : "host approves"],
                  ["Video chat", rep.features.videoUnlocked === true, rep.features.videoUnlocked ? "unlocked" : "locked"],
                  ["Member mic", rep.features.memberMic === true, ""],
                  ["Member camera", rep.features.memberCamera === true, ""],
                  ["Member chat", rep.features.memberChat === true, ""],
                  ["Games", rep.features.memberGames === true, ""],
                  ["Media playback", true, rep.features.mediaPlaying ? "playing now" : "idle"],
                  ["Chat lock", rep.features.chatLocked === true, rep.features.chatLocked ? "locked" : "open"],
                ].map(([label, on, sub]) => (
                  <span key={String(label)} className={cn("rounded-full px-2.5 py-1 text-[11px] font-semibold", on ? "bg-emerald-500/15 text-emerald-300" : "bg-white/[0.06] text-mist-500")}>
                    {String(label)}{sub ? ` · ${sub}` : ""} {on ? "✓" : "✕"}
                  </span>
                ))}
              </div>
            </section>

            {/* Moderation log */}
            {rep.modLog.length > 0 && (
              <section>
                <h2 className="mb-1.5 text-xs font-bold uppercase tracking-wide text-mist-400">Moderation log (latest {rep.modLog.length})</h2>
                <div className="max-h-40 space-y-1 overflow-y-auto">
                  {rep.modLog.map((m) => (
                    <p key={m.id} className="rounded-lg bg-ink-800/50 px-3 py-1.5 text-[11px] text-mist-300">
                      <b className="capitalize text-mist-100">{m.action}</b> — {m.targetName ?? m.targetId} by <b>{m.byName}</b> · {d(m.at)}{m.reason ? <> · <i>“{m.reason}”</i></> : ""}
                    </p>
                  ))}
                </div>
              </section>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
