"use client";

import { useEffect, useRef, useState } from "react";
import { LogIn, LogOut, Users } from "lucide-react";
import { fetchRoomEvents, type RoomEventView } from "@/lib/rooms";
import { useConfig } from "@/lib/config";
import { cn } from "@/lib/cn";

/**
 * WHO JOINED / WHO LEFT — the room's live come-and-go feed, shown on screens
 * OUTSIDE the room itself: the playing-game screen and the spectator screen.
 *
 * It reads the room's SHARED activity log from the server (the same one the room
 * page uses), so every player and spectator sees the same list. Read-only — it
 * never changes presence, and mounting it can't affect anyone's connection.
 *
 * Two looks:
 *  • "panel" (default) — the standing list. Right for the watch screen, which
 *    has room for it.
 *  • "flash"  — a transient pill that slides in when somebody comes or goes and
 *    fades out again. This is what a GAME screen uses: the standing panel sat
 *    over the top of the board and stayed there, which is exactly what the
 *    client asked us to replace.
 */
export function RoomJoinLeaveFeed({ roomId, className, limit = 6, variant = "panel" }: {
  roomId?: string; className?: string; limit?: number; variant?: "panel" | "flash";
}) {
  if (variant === "flash") return <RoomJoinLeaveFlash roomId={roomId} className={className} />;
  return <RoomJoinLeavePanel roomId={roomId} className={className} limit={limit} />;
}

function RoomJoinLeavePanel({ roomId, className, limit = 6 }: {
  roomId?: string; className?: string; limit?: number;
}) {
  const [events, setEvents] = useState<RoomEventView[]>([]);

  useEffect(() => {
    if (!roomId) { setEvents([]); return; }
    let on = true;
    const load = () => {
      // Pause while the tab is hidden — no point burning a poll in the background.
      if (typeof document !== "undefined" && document.hidden) return;
      fetchRoomEvents(roomId).then((list) => {
        if (!on) return;
        setEvents(list.filter((e) => e.type === "join" || e.type === "leave").slice(0, limit));
      });
    };
    load();
    const t = setInterval(load, 6000);
    return () => { on = false; clearInterval(t); };
  }, [roomId, limit]);

  if (!roomId || events.length === 0) return null;

  return (
    <div className={cn("rounded-xl border border-white/10 bg-black/30 px-3 py-2 backdrop-blur-sm", className)}>
      <p className="mb-1 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wide text-white/60">
        <Users className="size-3" /> Room activity
      </p>
      <ul className="space-y-0.5">
        {events.map((e) => (
          <li key={e.id} className="flex items-center gap-1.5 text-[11px] leading-tight">
            {e.type === "join"
              ? <LogIn className="size-3 shrink-0 text-emerald-300" />
              : <LogOut className="size-3 shrink-0 text-mist-400" />}
            <span className="min-w-0 flex-1 truncate text-white/85">
              <b className="font-semibold text-white">{e.target || e.actorName}</b>
              {e.type === "join" ? " joined the room" : " left the room"}
            </span>
            <span className="shrink-0 text-[10px] text-white/40">
              {new Date(e.at).toLocaleTimeString("en-SA", { hour: "2-digit", minute: "2-digit" })}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

type Flash = { id: string; name: string; joined: boolean };

/**
 * The game-screen version: nothing is on screen until somebody actually comes or
 * goes, and what appears is gone a few seconds later. Anchored under the top bar
 * and right-aligned so it never covers the board, the dice or the player cards,
 * and it sits BELOW the seat-approval bar (z-60 vs z-70) so a request the host
 * has to act on always wins.
 *
 * Honours Admin → Notifications: the master switch, the joins / leaves toggles
 * and the "info alert" duration.
 */
function RoomJoinLeaveFlash({ roomId, className }: { roomId?: string; className?: string }) {
  const { config } = useConfig();
  const ga = config.gameAlerts ?? {};
  const master = ga.enabled !== false;
  const joinsOn = ga.types?.joins !== false;
  const leavesOn = ga.types?.leaves !== false;
  const on = !!roomId && master && (joinsOn || leavesOn);
  const holdMs = Math.max(2, Math.min(30, ga.infoSeconds ?? 4)) * 1000;

  const [items, setItems] = useState<Flash[]>([]);
  const seen = useRef<Set<string>>(new Set());
  const seeded = useRef(false);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  // Keep the latest toggles/duration without restarting the poll every render.
  const cfg = useRef({ joinsOn, leavesOn, holdMs });
  cfg.current = { joinsOn, leavesOn, holdMs };

  useEffect(() => {
    if (!on || !roomId) { setItems([]); return; }
    let alive = true;
    const load = async () => {
      if (typeof document !== "undefined" && document.hidden) return;
      const list = await fetchRoomEvents(roomId);
      if (!alive) return;
      const comings = list.filter((e) => e.type === "join" || e.type === "leave");

      // First pass only remembers what already happened — arriving at a busy
      // room must not fire a burst of toasts for history.
      if (!seeded.current) {
        comings.forEach((e) => seen.current.add(e.id));
        seeded.current = true;
        return;
      }

      const fresh = [...comings].reverse().filter((e) => !seen.current.has(e.id));
      comings.forEach((e) => seen.current.add(e.id));
      const wanted = fresh.filter((e) => (e.type === "join" ? cfg.current.joinsOn : cfg.current.leavesOn));
      if (!wanted.length) return;

      setItems((prev) => [
        ...prev,
        ...wanted.map((e) => ({ id: e.id, name: e.target || e.actorName || "Someone", joined: e.type === "join" })),
      ].slice(-3));
      for (const e of wanted) {
        timers.current.push(setTimeout(() => {
          if (alive) setItems((p) => p.filter((x) => x.id !== e.id));
        }, cfg.current.holdMs));
      }
    };
    load();
    const t = setInterval(load, 5000);
    return () => { alive = false; clearInterval(t); };
  }, [roomId, on]);

  useEffect(() => () => { timers.current.forEach(clearTimeout); timers.current = []; }, []);

  if (!on || items.length === 0) return null;

  return (
    <div className={cn("pointer-events-none fixed right-2 top-14 z-[60] flex max-w-[62vw] flex-col items-end gap-1.5 sm:max-w-xs", className)}>
      {items.map((f) => (
        <div
          key={f.id}
          className={cn(
            "animate-rise flex items-center gap-1.5 rounded-full border py-1 pl-2 pr-3 text-[11px] shadow-lg backdrop-blur-sm",
            f.joined
              ? "border-emerald-400/40 bg-black/80 text-emerald-100"
              : "border-white/15 bg-black/75 text-white/80",
          )}
        >
          {f.joined
            ? <LogIn className="size-3 shrink-0 text-emerald-300" />
            : <LogOut className="size-3 shrink-0 text-white/50" />}
          <span className="min-w-0 truncate">
            <b className="font-semibold text-white">{f.name}</b>
            {f.joined ? " joined the room" : " left the room"}
          </span>
        </div>
      ))}
    </div>
  );
}
