"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { UserPlus, Check, X } from "lucide-react";
import { Avatar } from "@/components/ui/Avatar";
import { fetchRoom, decideSeat, type SeatRequest } from "@/lib/rooms";
import { useConfig } from "@/lib/config";
import { cn } from "@/lib/cn";

// Relative "3s ago" label.
function timeAgo(iso: string): string {
  const s = Math.max(0, Math.floor((Date.now() - Date.parse(iso)) / 1000));
  if (s < 10) return "just now";
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  return m < 60 ? `${m}m ago` : `${Math.floor(m / 60)}h ago`;
}

type Alert = { id: string; request: SeatRequest };

/**
 * In-game listener JOIN-APPROVAL bar (single line, top-centre, auto-hide).
 *
 * This is the ONLY in-game notification we show — the informational pop-ups
 * (roll announcements, entered/left, messages, game events) were removed at the
 * client's request. This bar is functional, not just a message: it lets a Host
 * or Co-Host who is PLAYING approve/reject a listener asking to join.
 *
 *  • Shows only when I'm a Host/Co-Host AND a Host/Co-Host is actually playing.
 *  • One request at a time; stays `approvalSeconds` (admin-set, default 10s) with
 *    Approve / Reject; auto-hides if not acted on (the request stays pending and
 *    re-appears later). Transform/opacity only → GPU, no gameplay impact.
 *  • Master ON/OFF + the seatRequests toggle + the duration live in
 *    config.gameAlerts (Admin → Notifications). Polls ONLY the room (light).
 */
export function GameActivityPanel({ roomId, myId, playerIds = [] }: { roomId: string; myId: string; playerIds?: string[] }) {
  const { config } = useConfig();
  const ga = config.gameAlerts ?? {};
  const enabled = ga.enabled !== false;
  const seatOn = ga.types?.seatRequests !== false;
  const on = enabled && seatOn;
  const approvalSecs = Math.max(3, Math.min(60, ga.approvalSeconds ?? 10));
  const durRef = useRef(approvalSecs);
  durRef.current = approvalSecs;
  const onRef = useRef(on);
  onRef.current = on;

  const [active, setActive] = useState<Alert | null>(null);
  const [shown, setShown] = useState(false); // slide-in/out transform
  const activeRef = useRef<Alert | null>(null);
  const queueRef = useRef<Alert[]>([]);
  const timersRef = useRef<ReturnType<typeof setTimeout>[]>([]);
  const snoozeRef = useRef<Map<string, number>>(new Map()); // userId → don't re-show before this time
  const finishingRef = useRef(false);
  const seededRef = useRef(false);

  const pumpRef = useRef<() => void>(() => {});
  const finish = useCallback((a: Alert, reason: "timeout" | "action") => {
    if (activeRef.current !== a || finishingRef.current) return; // stale/duplicate → no-op
    finishingRef.current = true;
    setShown(false);
    timersRef.current.push(setTimeout(() => {
      if (reason === "timeout") snoozeRef.current.set(a.request.userId, Date.now() + 45_000);
      activeRef.current = null;
      finishingRef.current = false;
      setActive(null);
      pumpRef.current();
    }, 280));
  }, []);
  const pump = useCallback(() => {
    if (activeRef.current) return;
    const next = queueRef.current.shift();
    if (!next) return;
    activeRef.current = next;
    setActive(next);
    setShown(false);
    timersRef.current.push(setTimeout(() => setShown(true), 30));
    timersRef.current.push(setTimeout(() => finish(next, "timeout"), 30 + durRef.current * 1000));
  }, [finish]);
  pumpRef.current = pump;

  const enqueue = useCallback((a: Alert) => {
    queueRef.current.push(a);
    if (queueRef.current.length > 10) queueRef.current = queueRef.current.slice(-10);
    pump();
  }, [pump]);

  const poll = useCallback(async () => {
    if (!onRef.current) return;
    if (typeof document !== "undefined" && document.hidden) return;
    const room = await fetchRoom(roomId);
    if (!room) return;

    const isMod = room.ownerId === myId || (room.coAdminIds ?? []).includes(myId) || room.host?.id === myId;
    // Only offer approval when a Host or Co-Host is actually PLAYING this game.
    const pids = new Set(playerIds);
    const hostOrCoHostPlaying =
      (!!room.ownerId && pids.has(room.ownerId)) ||
      (!!room.host?.id && pids.has(room.host.id)) ||
      (room.coAdminIds ?? []).some((c) => pids.has(c));
    const reqs = room.seatRequests ?? [];

    if (!seededRef.current) { seededRef.current = true; reqs.forEach((r) => snoozeRef.current.set(r.userId, 0)); }

    if (isMod && hostOrCoHostPlaying) {
      const shownIds = new Set(queueRef.current.map((a) => a.request.userId));
      if (activeRef.current) shownIds.add(activeRef.current.request.userId);
      for (const r of reqs) {
        if (shownIds.has(r.userId)) continue;
        const snz = snoozeRef.current.get(r.userId);
        if (snz && Date.now() < snz) continue;
        enqueue({ id: `req-${r.userId}`, request: r });
      }
    }
    // Forget snoozes for requests that are no longer pending (handled elsewhere).
    const pendingIds = new Set(reqs.map((r) => r.userId));
    for (const uid of Array.from(snoozeRef.current.keys())) if (!pendingIds.has(uid)) snoozeRef.current.delete(uid);
  }, [roomId, myId, enqueue, playerIds]);

  useEffect(() => {
    if (!on) return;
    poll();
    const t = setInterval(poll, 4000);
    const onVis = () => { if (typeof document !== "undefined" && !document.hidden) poll(); };
    document.addEventListener("visibilitychange", onVis);
    return () => { clearInterval(t); document.removeEventListener("visibilitychange", onVis); };
  }, [poll, on]);

  useEffect(() => () => { timersRef.current.forEach(clearTimeout); timersRef.current = []; }, []);

  const decide = async (a: Alert, approve: boolean) => {
    snoozeRef.current.set(a.request.userId, Number.MAX_SAFE_INTEGER); // never re-show a handled request
    finish(a, "action");
    await decideSeat(roomId, a.request.userId, approve);
    poll();
  };

  if (!on || !active) return null;

  return (
    // Anchored BELOW the game's top-bar controls (top-14) and centred — clear of
    // the Leave button, the toggles, the board, dice, tokens and player profiles.
    <div className={cn("pointer-events-none fixed inset-x-0 top-14 z-[70] flex justify-center px-3 transition-all duration-300 ease-out", shown ? "translate-y-0 opacity-100" : "-translate-y-[140%] opacity-0")}>
      <div className="pointer-events-auto flex max-w-[92vw] items-center gap-2 rounded-full border border-amber-400/40 bg-black/85 py-1.5 pl-2 pr-1.5 shadow-[0_8px_24px_rgba(0,0,0,0.5)] backdrop-blur-sm">
        <UserPlus className="size-4 shrink-0 text-amber-300" />
        <Avatar name={active.request.userName} src={active.request.avatar} size="xs" />
        <span className="min-w-0 max-w-[36vw] truncate text-xs font-semibold text-white">
          {active.request.userName}
          {active.request.username ? <span className="text-mist-300"> @{active.request.username}</span> : null}
          {active.request.publicId ? <span className="text-mist-400"> · #{active.request.publicId}</span> : null}
          <span className="text-mist-400"> · {timeAgo(active.request.at)}</span>
        </span>
        <button onClick={() => decide(active, true)} className="ml-0.5 inline-flex shrink-0 items-center gap-1 rounded-full bg-emerald-500 px-2.5 py-1 text-[11px] font-bold text-white transition hover:bg-emerald-400"><Check className="size-3" />Approve</button>
        <button onClick={() => decide(active, false)} className="inline-flex shrink-0 items-center gap-1 rounded-full bg-white/10 px-2.5 py-1 text-[11px] font-bold text-rose-200 ring-1 ring-rose-400/30 transition hover:bg-rose-500/20"><X className="size-3" />Reject</button>
      </div>
    </div>
  );
}
