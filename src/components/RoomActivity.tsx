"use client";

import { useCallback, useEffect, useState } from "react";
import { Activity, LogIn, LogOut, MicOff, Mic, UserX, ShieldAlert, Flag, Crown } from "lucide-react";
import { cn } from "@/lib/cn";

export type RoomEventKind = "join" | "leave" | "mute" | "unmute" | "remove" | "suspend" | "ban" | "report" | "cohost";

export interface RoomEvent {
  id: string;
  kind: RoomEventKind;
  text: string;
  at: number;
}

const ICON: Record<RoomEventKind, typeof Activity> = {
  join: LogIn,
  leave: LogOut,
  mute: MicOff,
  unmute: Mic,
  remove: UserX,
  suspend: ShieldAlert,
  ban: ShieldAlert,
  report: Flag,
  cohost: Crown,
};
const TONE: Record<RoomEventKind, string> = {
  join: "text-emerald-300",
  leave: "text-mist-400",
  mute: "text-amber-300",
  unmute: "text-emerald-300",
  remove: "text-rose-300",
  suspend: "text-rose-300",
  ban: "text-rose-400",
  report: "text-rose-300",
  cohost: "text-gold-300",
};

// Live, timestamped room activity log. Persists per-room so moderators keep
// the history across reloads. (Cross-device realtime needs a socket server.)
export function useRoomActivity(roomId?: string) {
  const [events, setEvents] = useState<RoomEvent[]>([]);
  const key = roomId ? `lotus.roomlog.${roomId}` : null;

  useEffect(() => {
    if (!key) return;
    try {
      const raw = localStorage.getItem(key);
      if (raw) setEvents(JSON.parse(raw));
    } catch {
      /* ignore */
    }
  }, [key]);

  const log = useCallback(
    (kind: RoomEventKind, text: string) => {
      setEvents((prev) => {
        const next = [{ id: `ev_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`, kind, text, at: Date.now() }, ...prev].slice(0, 100);
        if (key) {
          try {
            localStorage.setItem(key, JSON.stringify(next));
          } catch {
            /* ignore */
          }
        }
        return next;
      });
    },
    [key],
  );

  return { events, log };
}

export function RoomActivity({ events }: { events: RoomEvent[] }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-ink-850/60 p-4">
      <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-mist-200">
        <Activity className="size-4 text-lotus-300" /> Room activity
      </div>
      {events.length === 0 ? (
        <p className="py-4 text-center text-xs text-mist-500">No activity yet. Joins, mutes, removals and reports appear here.</p>
      ) : (
        <ul className="max-h-72 space-y-2 overflow-y-auto pr-1">
          {events.map((e) => {
            const Icon = ICON[e.kind];
            return (
              <li key={e.id} className="flex items-start gap-2.5 text-sm">
                <Icon className={cn("mt-0.5 size-4 shrink-0", TONE[e.kind])} />
                <span className="min-w-0 flex-1 text-mist-200">{e.text}</span>
                <span className="shrink-0 text-[11px] text-mist-500">
                  {new Date(e.at).toLocaleTimeString("en-SA", { hour: "2-digit", minute: "2-digit" })}
                </span>
              </li>
            );
          })}
        </ul>
      )}
      <p className="mt-3 border-t border-white/[0.06] pt-2 text-[11px] text-mist-500">
        🔒 This room may be monitored by moderators for safety. Be respectful — abusive behaviour can be reported.
      </p>
    </div>
  );
}
