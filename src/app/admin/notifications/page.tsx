"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import { broadcastNotification } from "@/lib/admin";
import { useConfig, saveConfig, type AppConfig } from "@/lib/config";
import { withBase } from "@/lib/base-path";
import { cn } from "@/lib/cn";
import { Bell, Send, Megaphone, ScrollText, RefreshCw, LogIn, LogOut, UserPlus, MessageSquare, Gamepad2, Info } from "lucide-react";

import { UserLink, TableSearch, SortSelect, applyFilterSort, type SortDir } from "@/components/admin/TableControls";

interface SentLog {
  text: string;
  count: number;
  at: string;
}
interface NotifLogRow { id: string; userId?: string; publicId?: string; userName: string; role: string; text: string; time: string; unread: boolean; href?: string }

type Alerts = NonNullable<AppConfig["gameAlerts"]>;
type AlertTypeKey = keyof NonNullable<Alerts["types"]>;
const ALERT_TYPES: { key: AlertTypeKey; label: string; desc: string; icon: typeof Bell }[] = [
  { key: "joins", label: "Someone entered the room", desc: "A user joins the voice room during a game.", icon: LogIn },
  { key: "leaves", label: "Someone left the room", desc: "A user leaves the voice room during a game.", icon: LogOut },
  { key: "seatRequests", label: "Join requests & approvals", desc: "A listener asks to join, and Approve/Reject results.", icon: UserPlus },
  { key: "messages", label: "Text messages", desc: "New chat messages sent in the room.", icon: MessageSquare },
  { key: "gameEvents", label: "Game events", desc: "A player left the game, or the game ended.", icon: Gamepad2 },
];
function normalizeAlerts(a: Alerts | undefined): Alerts {
  return {
    enabled: a?.enabled !== false,
    infoSeconds: a?.infoSeconds ?? 3,
    approvalSeconds: a?.approvalSeconds ?? 10,
    types: {
      joins: a?.types?.joins !== false,
      leaves: a?.types?.leaves !== false,
      seatRequests: a?.types?.seatRequests !== false,
      messages: a?.types?.messages !== false,
      gameEvents: a?.types?.gameEvents !== false,
    },
  };
}

export default function AdminNotificationsPage() {
  const { toast } = useToast();
  // ── In-game activity alert bar controls (config.gameAlerts) ──
  const { config, reload: reloadConfig } = useConfig();
  const [alerts, setAlerts] = useState<Alerts>(() => normalizeAlerts(config.gameAlerts));
  const [alertsDirty, setAlertsDirty] = useState(false);
  const [savingAlerts, setSavingAlerts] = useState(false);
  useEffect(() => { setAlerts(normalizeAlerts(config.gameAlerts)); setAlertsDirty(false); }, [config.gameAlerts]);
  const setAlert = (patch: Partial<Alerts>) => { setAlerts((a) => ({ ...a, ...patch })); setAlertsDirty(true); };
  const setAlertType = (k: AlertTypeKey, v: boolean) => { setAlerts((a) => ({ ...a, types: { ...a.types, [k]: v } })); setAlertsDirty(true); };
  const saveAlerts = async () => {
    setSavingAlerts(true);
    const res = await saveConfig({ gameAlerts: alerts });
    setSavingAlerts(false);
    if (res.ok) { await reloadConfig(); setAlertsDirty(false); toast("In-game alert settings saved — live now.", "success"); }
    else toast(res.error ?? "Could not save", "error");
  };
  const alertsMaster = alerts.enabled !== false;
  const AlertSwitch = ({ on, onClick }: { on: boolean; onClick: () => void }) => (
    <button onClick={onClick} className={cn("relative h-7 w-12 shrink-0 rounded-full transition", on ? "bg-emerald-500" : "bg-ink-700")} aria-pressed={on}>
      <span className={cn("absolute top-0.5 size-6 rounded-full bg-white shadow transition-all", on ? "left-[22px]" : "left-0.5")} />
    </button>
  );

  const [text, setText] = useState("");
  const [ctaLabel, setCtaLabel] = useState("");
  const [ctaHref, setCtaHref] = useState("");
  const [sending, setSending] = useState(false);
  const [log, setLog] = useState<SentLog[]>([]);
  // Persistent notification log (monitoring / troubleshooting) — from the server.
  const [notifLog, setNotifLog] = useState<NotifLogRow[]>([]);
  const [adminsOnly, setAdminsOnly] = useState(true);
  const [loadingLog, setLoadingLog] = useState(true);
  const [logQ, setLogQ] = useState("");
  const [logSort, setLogSort] = useState("time");
  const [logDir, setLogDir] = useState<SortDir>("desc");

  const loadLog = useCallback(async () => {
    setLoadingLog(true);
    try {
      const res = await fetch(withBase(`/api/admin/notify${adminsOnly ? "?adminsOnly=1" : ""}`), { credentials: "include", cache: "no-store" });
      const data = await res.json().catch(() => ({}));
      setNotifLog(Array.isArray(data.log) ? data.log : []);
    } catch { setNotifLog([]); }
    setLoadingLog(false);
  }, [adminsOnly]);
  useEffect(() => { loadLog(); }, [loadLog]);

  const shownNotifs = useMemo(() => applyFilterSort(notifLog, {
    q: logQ, sort: logSort, dir: logDir,
    searchText: (n) => `${n.userName} ${n.publicId ?? ""} ${n.userId ?? ""} ${n.text} ${n.role} ${new Date(n.time).toLocaleDateString("en-SA")}`,
    sortKeys: {
      time: (n) => new Date(n.time).getTime() || 0,
      user: (n) => n.userName ?? "",
      text: (n) => n.text ?? "",
    },
  }), [notifLog, logQ, logSort, logDir]);

  const send = async () => {
    if (!text.trim()) {
      toast("Please write a message first", "error");
      return;
    }
    setSending(true);
    const cta = ctaLabel.trim() ? { label: ctaLabel.trim(), href: ctaHref.trim() || undefined } : undefined;
    const count = await broadcastNotification(text.trim(), cta);
    setSending(false);
    if (count > 0) {
      toast(`Sent to ${count} ${count === 1 ? "member" : "members"}`, "success");
      setLog((l) => [{ text: text.trim(), count, at: new Date().toLocaleString("en-SA") }, ...l]);
      setText("");
      setCtaLabel("");
      setCtaHref("");
    } else {
      toast("Could not send the broadcast", "error");
    }
  };

  const field = "w-full rounded-xl border border-line bg-ink-800 px-3.5 py-2.5 text-sm text-mist-100 outline-none placeholder:text-mist-500 focus:border-lotus-400";

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-extrabold text-mist-100">Notifications</h1>
        <p className="text-sm text-mist-400">Send a push notification to every member&apos;s bell instantly, and control the in-game activity alert bar.</p>
      </div>

      {/* ── IN-GAME ACTIVITY ALERT BAR — full admin control ── */}
      <Card className="p-5">
        <h2 className="flex items-center gap-2 font-semibold text-mist-100">
          <Gamepad2 className="size-4 text-lotus-300" /> In-game activity alerts
        </h2>
        <p className="mt-1 text-xs text-mist-400">The single-line alert bar players see during a game (entered/left, join requests, messages, game events). It never covers the board, dice, tokens, profiles or controls, and never affects gameplay.</p>

        {/* Master ON/OFF */}
        <div className="mt-4 flex items-center gap-4 rounded-xl border border-line bg-ink-800 p-3.5">
          <span className={cn("grid size-10 shrink-0 place-items-center rounded-xl", alertsMaster ? "bg-lotus-500/15 text-lotus-300" : "bg-ink-700 text-mist-500")}><Bell className="size-5" /></span>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm font-semibold text-mist-100">All in-game notifications</span>
              <span className={cn("rounded-full px-2 py-0.5 text-[11px] font-bold", alertsMaster ? "bg-emerald-500/15 text-emerald-300" : "bg-rose-500/15 text-rose-300")}>{alertsMaster ? "ON" : "OFF"}</span>
            </div>
            <p className="text-xs text-mist-400">{alertsMaster ? "Players see the activity alert bar during games." : "The alert bar is completely hidden for all players."}</p>
          </div>
          <AlertSwitch on={alertsMaster} onClick={() => setAlert({ enabled: !alertsMaster })} />
        </div>

        <div className={cn("transition", !alertsMaster && "pointer-events-none opacity-50")}>
          {/* Timings */}
          <div className="mt-3 grid grid-cols-2 gap-3">
            <label className="block">
              <span className="mb-1 block text-xs text-mist-400">Normal alert (seconds)</span>
              <input type="number" min={1} max={15} value={alerts.infoSeconds ?? 3} onChange={(e) => setAlert({ infoSeconds: Math.max(1, Math.min(15, Number(e.target.value) || 3)) })} className="w-full rounded-lg border border-line bg-ink-800 px-3 py-2 text-sm text-mist-100" />
            </label>
            <label className="block">
              <span className="mb-1 block text-xs text-mist-400">Approval alert (seconds)</span>
              <input type="number" min={3} max={60} value={alerts.approvalSeconds ?? 10} onChange={(e) => setAlert({ approvalSeconds: Math.max(3, Math.min(60, Number(e.target.value) || 10)) })} className="w-full rounded-lg border border-line bg-ink-800 px-3 py-2 text-sm text-mist-100" />
            </label>
          </div>

          {/* Per-type toggles */}
          <div className="mt-3 divide-y divide-white/5 rounded-xl border border-line">
            {ALERT_TYPES.map((t) => {
              const on = alerts.types?.[t.key] !== false;
              return (
                <div key={t.key} className="flex items-center gap-3 p-3">
                  <span className={cn("grid size-9 shrink-0 place-items-center rounded-lg", on ? "bg-lotus-500/12 text-lotus-300" : "bg-ink-800 text-mist-500")}><t.icon className="size-4" /></span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-mist-100">{t.label}</p>
                    <p className="text-[11px] text-mist-400">{t.desc}</p>
                  </div>
                  <AlertSwitch on={on} onClick={() => setAlertType(t.key, !on)} />
                </div>
              );
            })}
          </div>
        </div>

        <div className="mt-3 flex items-center justify-between gap-2">
          <span className="flex items-start gap-1.5 text-[11px] text-mist-500"><Info className="mt-0.5 size-3 shrink-0" /> Lightweight animation — no FPS drop, no gameplay impact.</span>
          <Button size="sm" onClick={saveAlerts} disabled={savingAlerts || !alertsDirty}>{savingAlerts ? "Saving…" : alertsDirty ? "Save" : "Saved"}</Button>
        </div>
      </Card>

      <Card className="p-5">
        <h2 className="flex items-center gap-2 font-semibold text-mist-100">
          <Megaphone className="size-4 text-petal-400" /> Broadcast a message
        </h2>

        <label className="mt-4 block text-sm font-semibold text-mist-200">Message</label>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value.slice(0, 280))}
          rows={3}
          placeholder="e.g. 🎉 Weekend Ludo tournament starts Saturday 6 PM — join now!"
          className={cn(field, "mt-1.5 resize-none")}
        />
        <div className="mt-1 text-right text-[11px] text-mist-500">{text.length}/280</div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="block text-sm font-semibold text-mist-200">Button label <span className="font-normal text-mist-500">(optional)</span></label>
            <input value={ctaLabel} onChange={(e) => setCtaLabel(e.target.value)} placeholder="View tournament" className={cn(field, "mt-1.5")} />
          </div>
          <div>
            <label className="block text-sm font-semibold text-mist-200">Button link <span className="font-normal text-mist-500">(optional)</span></label>
            <input value={ctaHref} onChange={(e) => setCtaHref(e.target.value)} placeholder="/tournaments" className={cn(field, "mt-1.5")} />
          </div>
        </div>

        <Button size="lg" className="mt-5" onClick={send} disabled={sending}>
          <Send className="size-4" /> {sending ? "Sending…" : "Send to all members"}
        </Button>
      </Card>

      <Card className="p-5">
        <h2 className="flex items-center gap-2 font-semibold text-mist-100">
          <Bell className="size-4 text-lotus-300" /> Recent broadcasts
        </h2>
        {log.length === 0 ? (
          <p className="mt-3 rounded-lg bg-white/[0.04] px-3 py-4 text-sm text-mist-400">
            No broadcasts sent in this session yet.
          </p>
        ) : (
          <div className="mt-3 space-y-2">
            {log.map((l, i) => (
              <div key={i} className="rounded-lg border border-line bg-ink-800 px-3 py-2.5">
                <p className="text-sm text-mist-100">{l.text}</p>
                <p className="mt-1 text-xs text-mist-500">Sent to {l.count} members · {l.at}</p>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Notification LOG — every alert the system generated (monitoring). */}
      <Card className="p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="flex items-center gap-2 font-semibold text-mist-100">
            <ScrollText className="size-4 text-emerald-300" /> Notification log
          </h2>
          <div className="flex flex-wrap items-center gap-2">
            <TableSearch value={logQ} onChange={setLogQ} placeholder="Search member, ID, text…" className="w-52" />
            <SortSelect sort={logSort} dir={logDir} onSort={setLogSort} onDir={setLogDir}
              options={[{ key: "time", label: "Date" }, { key: "user", label: "Member" }, { key: "text", label: "Message" }]} />
            <div className="flex rounded-lg border border-line bg-ink-800 p-0.5 text-xs font-semibold">
              <button onClick={() => setAdminsOnly(true)} className={cn("rounded-md px-3 py-1.5 transition", adminsOnly ? "bg-lotus-600 text-white" : "text-mist-400")}>Admin alerts</button>
              <button onClick={() => setAdminsOnly(false)} className={cn("rounded-md px-3 py-1.5 transition", !adminsOnly ? "bg-lotus-600 text-white" : "text-mist-400")}>All</button>
            </div>
            <button onClick={loadLog} className="grid size-9 place-items-center rounded-lg border border-line text-mist-300 hover:text-mist-100" title="Refresh"><RefreshCw className="size-4" /></button>
          </div>
        </div>
        <p className="mt-1 text-xs text-mist-500">Recent alerts the system generated — use it to confirm notifications are firing (pending requests, approvals, KYC, withdrawals, join requests, etc.).</p>
        {loadingLog ? (
          <p className="mt-3 rounded-lg bg-white/[0.04] px-3 py-4 text-sm text-mist-400">Loading…</p>
        ) : shownNotifs.length === 0 ? (
          <p className="mt-3 rounded-lg bg-white/[0.04] px-3 py-4 text-sm text-mist-400">No notifications logged yet.</p>
        ) : (
          <div className="mt-3 max-h-[28rem] space-y-1.5 overflow-y-auto pr-1">
            {shownNotifs.map((n) => {
              const body = (
                <>
                  {n.unread && <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-lotus-400" title="Unread" />}
                  <div className="min-w-0 flex-1">
                    <p className="text-sm text-mist-100">{n.text}</p>
                    <p className="mt-0.5 text-[11px] text-mist-500">
                      → <UserLink name={n.userName} publicId={n.publicId} userId={n.userId} className="text-[11px]" />{n.role === "admin" && <span className="ml-1 rounded bg-lotus-500/15 px-1 text-[10px] text-lotus-300">admin</span>} · {new Date(n.time).toLocaleString("en-SA", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                    </p>
                  </div>
                  {n.href && <span className="mt-0.5 shrink-0 text-[10px] font-semibold text-lotus-300">Open →</span>}
                </>
              );
              // Clickable when the notification carries a target link (easy access).
              return n.href ? (
                <a key={n.id} href={withBase(n.href)} className="flex items-start gap-2 rounded-lg border border-line bg-ink-800 px-3 py-2 transition hover:border-lotus-400/50 hover:bg-ink-800/70">
                  {body}
                </a>
              ) : (
                <div key={n.id} className="flex items-start gap-2 rounded-lg border border-line bg-ink-800 px-3 py-2">
                  {body}
                </div>
              );
            })}
          </div>
        )}
      </Card>
    </div>
  );
}
