"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import { withBase } from "@/lib/base-path";
import { useConfig, saveConfig, type AppConfig } from "@/lib/config";
import { cn } from "@/lib/cn";
import {
  LifeBuoy, Gamepad2, DoorClosed, UserCog, Radio, AlertTriangle, X, RefreshCw, Loader2, ShieldAlert,
  Timer, History, Check as CheckIcon, Bot, ChevronDown, DatabaseBackup,
} from "lucide-react";

type RunningGame = { kind: "session" | "lobby"; id: string; game: string; roomId: string; roomName: string; players: string[]; startedAt: string; status: string };
type RoomBrief = { id: string; name: string };
type UserBrief = { id: string; publicId: string; name: string; username?: string; stuck: boolean; roomName?: string };
type ResetEntry = {
  id: string; at: string; auto: boolean; by: string; kind: "lobby" | "session";
  game: string; roomId: string; roomName: string; reason: string; ageHours: number; players: string[];
};

// The presets the client asked for, plus a free-text custom box.
const HOUR_PRESETS: { label: string; hours: number }[] = [
  { label: "1 hour", hours: 1 },
  { label: "6 hours", hours: 6 },
  { label: "12 hours", hours: 12 },
  { label: "24 hours", hours: 24 },
];
type Pending = {
  title: string;
  description: string;
  confirmLabel: string;
  run: (reason: string) => Promise<{ ok: boolean; error?: string; note?: string }>;
  okMsg: string;
};

const GAME_LABEL: Record<string, string> = { ludo: "Ludo", snake: "Snake & Ladder", chess: "Chess" };

// The same picker, for PEOPLE. "Reset player status" asked for a User ID typed
// from memory, with no way to look anyone up — the client reported the name
// dropdown as not working because there was never one here at all.
function UserPicker({
  users, value, onChange, label,
}: {
  users: UserBrief[]; value: string; onChange: (v: string) => void; label: string;
}) {
  const [open, setOpen] = useState(false);
  const [hl, setHl] = useState(0);
  const boxRef = useRef<HTMLDivElement | null>(null);

  const typed = value.replace(/\s*\([^)]*\)\s*$/, "").trim().toLowerCase();
  const picked = /\([^)]+\)\s*$/.test(value.trim());
  const list = (!typed || picked)
    ? users
    : users.filter((u) =>
        u.name.toLowerCase().includes(typed) ||
        u.publicId.toLowerCase().includes(typed) ||
        u.id.toLowerCase().includes(typed) ||
        (u.username ?? "").toLowerCase().includes(typed));

  useEffect(() => {
    if (!open) return;
    const away = (e: MouseEvent) => { if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", away);
    return () => document.removeEventListener("mousedown", away);
  }, [open]);

  const choose = (u: UserBrief) => { onChange(`${u.name} (${u.publicId})`); setOpen(false); };
  const stuckCount = users.filter((u) => u.stuck).length;

  return (
    <div ref={boxRef} className="relative mt-3">
      <label className="block text-xs text-mist-400">{label}</label>
      <div className="relative">
        <input
          value={value}
          onChange={(e) => { onChange(e.target.value); setOpen(true); setHl(0); }}
          onFocus={() => setOpen(true)}
          onKeyDown={(e) => {
            if (e.key === "ArrowDown") { e.preventDefault(); setOpen(true); setHl((h) => Math.min(h + 1, list.length - 1)); }
            else if (e.key === "ArrowUp") { e.preventDefault(); setHl((h) => Math.max(h - 1, 0)); }
            else if (e.key === "Enter" && open && list[hl]) { e.preventDefault(); choose(list[hl]); }
            else if (e.key === "Escape") setOpen(false);
          }}
          placeholder="Type a player's name, or tap to see them all…"
          autoComplete="off"
          className="mt-1 block h-10 w-full rounded-lg border border-line bg-ink-800 pl-3 pr-9 text-sm text-mist-100 outline-none focus:border-lotus-400"
        />
        {value ? (
          <button type="button" onClick={() => { onChange(""); setOpen(true); }} aria-label="Clear" className="absolute right-1 top-1 grid size-8 place-items-center rounded-md text-mist-500 hover:bg-ink-700 hover:text-mist-200"><X className="size-4" /></button>
        ) : (
          <button type="button" onClick={() => setOpen((o) => !o)} aria-label="Show all players" className="absolute right-1 top-1 grid size-8 place-items-center rounded-md text-mist-500 hover:bg-ink-700 hover:text-mist-200"><ChevronDown className="size-4" /></button>
        )}
      </div>

      {open && (
        <div className="absolute z-40 mt-1 max-h-64 w-full overflow-y-auto rounded-lg border border-line bg-ink-850 py-1 shadow-2xl">
          {list.length === 0 ? (
            <p className="px-3 py-3 text-xs text-mist-500">Nobody matches “{typed}”.</p>
          ) : (
            <>
              <p className="px-3 pb-1 pt-1 text-[10px] font-semibold uppercase tracking-wide text-mist-600">
                {list.length} {list.length === 1 ? "player" : "players"}
                {stuckCount > 0 && <span className="ml-1 text-amber-300">· {stuckCount} currently shown as in a room</span>}
              </p>
              {list.slice(0, 200).map((u, i) => (
                <button
                  key={u.id}
                  type="button"
                  onMouseEnter={() => setHl(i)}
                  onClick={() => choose(u)}
                  className={cn("block w-full px-3 py-2 text-left text-sm text-mist-200 hover:bg-lotus-500/15", i === hl && "bg-lotus-500/15")}
                >
                  <span className="font-medium text-mist-100">{u.name}</span>
                  <span className="ml-2 text-[11px] text-mist-500">{u.publicId}</span>
                  {u.stuck && <span className="ml-2 rounded-full bg-amber-500/15 px-1.5 py-0.5 text-[10px] font-bold text-amber-300">in {u.roomName ?? "a room"}</span>}
                </button>
              ))}
              {list.length > 200 && <p className="px-3 py-2 text-[11px] text-mist-500">…and {list.length - 200} more — keep typing to narrow it down.</p>}
            </>
          )}
        </div>
      )}
    </div>
  );
}

// A real, visible room picker.
//
// This used to be a plain <input list="…"> (a native datalist). Browsers give no
// control over it: on several it only opens once the typed text already matches,
// it is silent on mobile, and it cannot be scrolled or clicked reliably — so the
// client could type a group name and never get a list to choose from. This draws
// the list itself: it opens on focus with EVERY room, filters as you type on both
// name and id, and each row is an ordinary button.
function RoomPicker({
  rooms, value, onChange, label, disabled,
}: {
  rooms: RoomBrief[]; value: string; onChange: (v: string) => void; label: string; disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [hl, setHl] = useState(0);
  const boxRef = useRef<HTMLDivElement | null>(null);

  // Text typed so far, ignoring a previously-picked "Name (id)" suffix.
  const typed = value.replace(/\s*\([^)]*\)\s*$/, "").trim().toLowerCase();
  const picked = /\([^)]+\)\s*$/.test(value.trim());
  const list = (!typed || picked)
    ? rooms
    : rooms.filter((r) => r.name.toLowerCase().includes(typed) || r.id.toLowerCase().includes(typed));

  // Click anywhere else closes it.
  useEffect(() => {
    if (!open) return;
    const away = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", away);
    return () => document.removeEventListener("mousedown", away);
  }, [open]);

  const choose = (r: RoomBrief) => { onChange(`${r.name} (${r.id})`); setOpen(false); };

  return (
    <div ref={boxRef} className="relative mt-3">
      <label className="block text-xs text-mist-400">{label}</label>
      <div className="relative">
        <input
          value={value}
          disabled={disabled}
          onChange={(e) => { onChange(e.target.value); setOpen(true); setHl(0); }}
          onFocus={() => !disabled && setOpen(true)}
          onKeyDown={(e) => {
            if (disabled) return;
            if (e.key === "ArrowDown") { e.preventDefault(); setOpen(true); setHl((h) => Math.min(h + 1, list.length - 1)); }
            else if (e.key === "ArrowUp") { e.preventDefault(); setHl((h) => Math.max(h - 1, 0)); }
            else if (e.key === "Enter" && open && list[hl]) { e.preventDefault(); choose(list[hl]); }
            else if (e.key === "Escape") setOpen(false);
          }}
          placeholder="Type a group name, or tap to see them all…"
          autoComplete="off"
          className="mt-1 block h-10 w-full rounded-lg border border-line bg-ink-800 pl-3 pr-9 text-sm text-mist-100 outline-none focus:border-lotus-400 disabled:opacity-50"
        />
        {value && !disabled ? (
          <button
            type="button"
            onClick={() => { onChange(""); setOpen(true); }}
            aria-label="Clear"
            className="absolute right-1 top-1 grid size-8 place-items-center rounded-md text-mist-500 hover:bg-ink-700 hover:text-mist-200"
          >
            <X className="size-4" />
          </button>
        ) : (
          <button
            type="button"
            onClick={() => !disabled && setOpen((o) => !o)}
            aria-label="Show all groups"
            disabled={disabled}
            className="absolute right-1 top-1 grid size-8 place-items-center rounded-md text-mist-500 hover:bg-ink-700 hover:text-mist-200 disabled:opacity-40"
          >
            <ChevronDown className="size-4" />
          </button>
        )}
      </div>

      {open && !disabled && (
        <div className="absolute z-40 mt-1 max-h-64 w-full overflow-y-auto rounded-lg border border-line bg-ink-850 py-1 shadow-2xl">
          {list.length === 0 ? (
            <p className="px-3 py-3 text-xs text-mist-500">No group matches “{typed}”.</p>
          ) : (
            <>
              <p className="px-3 pb-1 pt-1 text-[10px] font-semibold uppercase tracking-wide text-mist-600">
                {list.length} {list.length === 1 ? "group" : "groups"}
              </p>
              {list.slice(0, 200).map((r, i) => (
                <button
                  key={r.id}
                  type="button"
                  onMouseEnter={() => setHl(i)}
                  onClick={() => choose(r)}
                  className={cn(
                    "block w-full px-3 py-2 text-left text-sm text-mist-200 hover:bg-lotus-500/15",
                    i === hl && "bg-lotus-500/15",
                  )}
                >
                  <span className="font-medium text-mist-100">{r.name}</span>
                  <span className="ml-2 text-[11px] text-mist-500">{r.id}</span>
                </button>
              ))}
              {list.length > 200 && (
                <p className="px-3 py-2 text-[11px] text-mist-500">…and {list.length - 200} more — keep typing to narrow it down.</p>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}

export default function ResetRecoveryPage() {
  const { toast } = useToast();
  const { config, reload: reloadConfig } = useConfig();
  const [running, setRunning] = useState<RunningGame[]>([]);
  const [rooms, setRooms] = useState<RoomBrief[]>([]);
  const [users, setUsers] = useState<UserBrief[]>([]);
  const [history, setHistory] = useState<ResetEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [pending, setPending] = useState<Pending | null>(null);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [gameFilter, setGameFilter] = useState<string>("all"); // all | ludo | snake | chess

  // Form fields for the room / player / bulk actions.
  const [closeRoomId, setCloseRoomId] = useState("");
  const [closeAll, setCloseAll] = useState(false);
  const [resetRoomId, setResetRoomId] = useState("");
  const [resetUserId, setResetUserId] = useState("");

  // The room-name autocomplete lets the admin type a NAME; we resolve it to the
  // exact room id. Room names are NOT unique, so the dropdown lists each as
  // "Name (room_id)" — selecting one gives an unambiguous target. Returns "" when
  // the text can't be resolved to a SINGLE room (ambiguous or unknown), so the
  // caller refuses to run a destructive action on a guessed room.
  const resolveRoom = (typed: string): string => {
    const t = typed.trim();
    if (!t) return "";
    // "Name (room_id)" chosen from the dropdown → take the id in parentheses.
    const paren = t.match(/\(([^)]+)\)\s*$/);
    if (paren && rooms.some((r) => r.id === paren[1].trim())) return paren[1].trim();
    // An exact room id pasted directly.
    if (rooms.some((r) => r.id === t)) return t;
    // An exact, UNIQUE room name.
    const named = rooms.filter((r) => r.name.toLowerCase() === t.toLowerCase());
    if (named.length === 1) return named[0].id;
    // Ambiguous name (shared by >1 room) or unknown text → unresolved.
    return "";
  };

  // Same idea for a person. The server accepts either the internal id or the
  // public ID, so a pasted ID still works exactly as it did before.
  const resolveUser = (typed: string): string => {
    const t = typed.trim();
    if (!t) return "";
    const paren = t.match(/\(([^)]+)\)\s*$/);
    if (paren) {
      const pid = paren[1].trim();
      const hit = users.find((u) => u.publicId === pid || u.id === pid);
      if (hit) return hit.publicId;
    }
    const exact = users.find((u) => u.publicId === t || u.id === t || u.username === t);
    if (exact) return exact.publicId;
    const named = users.filter((u) => u.name.toLowerCase() === t.toLowerCase());
    if (named.length === 1) return named[0].publicId;
    // Unknown text: hand it to the server unchanged so a valid pasted ID we
    // don't have in the list still works, and anything else fails loudly there.
    return t;
  };

  const post = useCallback(async (body: Record<string, unknown>) => {
    const res = await fetch(withBase("/api/admin/reset"), {
      method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) return { ok: false as const, error: json.error ?? "Action failed" };
    return { ok: true as const, ...json };
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(withBase("/api/admin/reset"), { credentials: "include", cache: "no-store" });
      const json = await res.json().catch(() => ({}));
      if (res.ok) { setRunning(json.running ?? []); setRooms(json.rooms ?? []); setUsers(json.users ?? []); setHistory(json.history ?? []); }
    } catch { /* ignore */ }
    setLoading(false);
  }, []);
  useEffect(() => { load(); }, [load]);

  // ── Auto-reset settings (config.autoReset) ────────────────────────────────
  const ar = config.autoReset ?? {};
  const arOn = ar.enabled !== false;
  const afterHours = Number.isFinite(Number(ar.afterHours)) ? Number(ar.afterHours) : 24;
  const staleMins = Number.isFinite(Number(ar.staleStartingMinutes)) ? Number(ar.staleStartingMinutes) : 10;
  const emptyHours = Number.isFinite(Number(ar.emptyLobbyHours)) ? Number(ar.emptyLobbyHours) : 2;
  const notifyPlayers = ar.notifyPlayers !== false;
  const [savingAuto, setSavingAuto] = useState(false);
  const [customHours, setCustomHours] = useState("");
  const [cleaning, setCleaning] = useState(false);

  // Every value is sent explicitly: the config API reads a MISSING key as
  // "leave unchanged", so a partial patch would silently do nothing.
  const saveAuto = async (patch: Partial<NonNullable<AppConfig["autoReset"]>>, note: string) => {
    setSavingAuto(true);
    const next = {
      enabled: arOn, afterHours, staleStartingMinutes: staleMins,
      emptyLobbyHours: emptyHours, notifyPlayers, ...patch,
    };
    const res = await saveConfig({ autoReset: next });
    setSavingAuto(false);
    if (res.ok) { await reloadConfig(); toast(note, "success"); }
    else toast(res.error ?? "Could not save", "error");
  };

  const cleanupNow = async () => {
    setCleaning(true);
    const r = await post({ action: "cleanupNow", reason: "Manual cleanup from Reset & Recovery" });
    setCleaning(false);
    if (r.ok) {
      const n = (r as { cancelled?: number }).cancelled ?? 0;
      toast(n ? `Cleared ${n} stuck game${n === 1 ? "" : "s"}.` : "Nothing was stuck — no games needed clearing.", "success");
      await load();
    } else toast(r.error ?? "Cleanup failed", "error");
  };

  const ask = (p: Pending) => { setReason(""); setPending(p); };
  const confirmAction = async () => {
    if (!pending) return;
    const r = reason.trim();
    if (!r) { toast("Please enter a reason.", "error"); return; }
    setBusy(true);
    const res = await pending.run(r);
    setBusy(false);
    if (res.ok) {
      setPending(null); setReason("");
      toast(res.note || pending.okMsg, "success");
      await load();
    } else {
      toast(res.error ?? "Action failed", "error");
    }
  };

  return (
    <div className="space-y-5">
      {/* Header */}
      <div>
        <h1 className="flex items-center gap-2 font-display text-2xl font-extrabold text-mist-100">
          <LifeBuoy className="size-6 text-lotus-300" /> Reset &amp; Recovery
        </h1>
        <p className="text-sm text-mist-400">Emergency tools to un-stick a game, room or player. Every action needs a <b className="text-mist-300">reason</b> and is written to the Admin Audit Log with your Admin ID, the date &amp; time, and the Room / Match ID.</p>
      </div>

      <div className="flex items-start gap-2 rounded-xl border border-amber-400/25 bg-amber-500/[0.07] p-3 text-xs text-amber-200/90">
        <ShieldAlert className="mt-0.5 size-4 shrink-0" />
        <span>These actions take effect immediately for real players. Use them to recover a stuck match/room — not during normal play. Everything is logged and reversible only by starting a fresh game.</span>
      </div>

      {/* ── AUTO RESET / AUTO CLEANUP ─────────────────────────────────────── */}
      <Card className="p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="flex items-center gap-2 font-display text-lg font-bold text-mist-100">
              <Bot className="size-5 text-lotus-300" /> Automatic cleanup of stuck games
            </h2>
            <p className="mt-0.5 max-w-2xl text-sm text-mist-400">
              A game that never started used to sit in its room for ever and <b className="text-mist-300">block every later game in that room</b>.
              These settings clear such games on their own. Games that are genuinely being played are never touched.
            </p>
          </div>
          <button
            onClick={() => void saveAuto({ enabled: !arOn }, `Automatic cleanup ${!arOn ? "enabled" : "disabled"}.`)}
            disabled={savingAuto}
            role="switch"
            aria-checked={arOn}
            className={cn(
              "inline-flex shrink-0 items-center gap-2 rounded-lg border px-3 py-2 text-sm font-semibold transition disabled:opacity-60",
              arOn ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-300" : "border-line bg-ink-900 text-mist-400",
            )}
          >
            {savingAuto ? <Loader2 className="size-4 animate-spin" /> : arOn ? <CheckIcon className="size-4" /> : <X className="size-4" />}
            {arOn ? "Auto cleanup is ON" : "Auto cleanup is OFF"}
          </button>
        </div>

        <div className={cn("mt-4 space-y-4", !arOn && "pointer-events-none opacity-50")}>
          {/* Primary control — the client's 1 / 6 / 12 / 24 / custom */}
          <div>
            <p className="flex items-center gap-1.5 text-sm font-semibold text-mist-200">
              <Timer className="size-4 text-lotus-300" /> Reset games stuck for longer than
            </p>
            <p className="text-[11px] text-mist-500">Applies to any game that still hasn&apos;t started after this long.</p>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              {HOUR_PRESETS.map((p) => (
                <button
                  key={p.hours}
                  disabled={savingAuto}
                  onClick={() => void saveAuto({ afterHours: p.hours }, `Stuck games are now cleared after ${p.label}.`)}
                  className={cn(
                    "rounded-lg px-3 py-1.5 text-xs font-bold transition",
                    afterHours === p.hours ? "bg-lotus-600 text-white" : "bg-ink-800 text-mist-300 hover:text-mist-100",
                  )}
                >
                  {p.label}
                </button>
              ))}
              <span className="text-[11px] text-mist-500">or</span>
              <input
                value={customHours}
                onChange={(e) => setCustomHours(e.target.value.replace(/[^\d.]/g, "").slice(0, 6))}
                placeholder="custom"
                className="h-8 w-20 rounded-lg border border-line bg-ink-900 px-2 text-center text-xs text-mist-100 outline-none focus:border-lotus-400"
              />
              <span className="text-[11px] text-mist-400">hours</span>
              <Button
                size="sm" variant="secondary"
                disabled={savingAuto || !customHours || !(Number(customHours) >= 0.25 && Number(customHours) <= 720)}
                onClick={() => { void saveAuto({ afterHours: Number(customHours) }, `Stuck games are now cleared after ${customHours} hour(s).`); setCustomHours(""); }}
              >
                Set
              </Button>
              {!HOUR_PRESETS.some((p) => p.hours === afterHours) && (
                <span className="rounded-full bg-lotus-500/20 px-2 py-0.5 text-[11px] font-bold text-lotus-200">now: {afterHours}h</span>
              )}
            </div>
          </div>

          {/* The two root-cause thresholds. */}
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block rounded-xl border border-line bg-ink-900 p-3">
              <span className="block text-xs font-semibold text-mist-200">Frozen on &ldquo;Starting…&rdquo;</span>
              <span className="mt-0.5 block text-[11px] text-mist-500">
                Players joined and the match was announced, but it never opened — usually because the player whose device builds the board closed the app. This is the most common stuck game.
              </span>
              <span className="mt-2 flex items-center gap-2">
                <input
                  type="number" min={1} max={1440} defaultValue={staleMins} key={`stale-${staleMins}`}
                  onBlur={(e) => { const v = Number(e.target.value); if (v >= 1 && v <= 1440 && v !== staleMins) void saveAuto({ staleStartingMinutes: v }, `Frozen "Starting…" games are cleared after ${v} minute(s).`); }}
                  className="h-8 w-20 rounded-lg border border-line bg-ink-950 px-2 text-center text-xs text-mist-100 outline-none focus:border-lotus-400"
                />
                <span className="text-[11px] text-mist-400">minutes</span>
              </span>
            </label>
            <label className="block rounded-xl border border-line bg-ink-900 p-3">
              <span className="block text-xs font-semibold text-mist-200">Opened but nobody joined</span>
              <span className="mt-0.5 block text-[11px] text-mist-500">
                Somebody pressed Games, then walked away without inviting anyone. The empty lobby still blocks that room.
              </span>
              <span className="mt-2 flex items-center gap-2">
                <input
                  type="number" min={0.25} max={720} step={0.25} defaultValue={emptyHours} key={`empty-${emptyHours}`}
                  onBlur={(e) => { const v = Number(e.target.value); if (v >= 0.25 && v <= 720 && v !== emptyHours) void saveAuto({ emptyLobbyHours: v }, `Empty lobbies are cleared after ${v} hour(s).`); }}
                  className="h-8 w-20 rounded-lg border border-line bg-ink-950 px-2 text-center text-xs text-mist-100 outline-none focus:border-lotus-400"
                />
                <span className="text-[11px] text-mist-400">hours</span>
              </span>
            </label>
          </div>

          <button
            onClick={() => void saveAuto({ notifyPlayers: !notifyPlayers }, notifyPlayers ? "Players will no longer be told." : "Players will be told when their game is cleared.")}
            disabled={savingAuto}
            className="flex w-full items-start gap-3 rounded-xl border border-line bg-ink-900 p-3 text-left transition hover:border-lotus-400/40 disabled:opacity-60"
          >
            <span className={cn("mt-0.5 grid size-5 shrink-0 place-items-center rounded-md border", notifyPlayers ? "border-emerald-400 bg-emerald-500/25 text-emerald-200" : "border-line text-transparent")}>
              <CheckIcon className="size-3.5" />
            </span>
            <span className="min-w-0">
              <span className="block text-xs font-semibold text-mist-100">Tell the players when their game is cleared</span>
              <span className="block text-[11px] text-mist-500">Anyone who was sitting in the game gets a notification saying it didn&apos;t start and they can begin a new one.</span>
            </span>
          </button>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-line pt-3">
          <Button variant="secondary" size="sm" onClick={() => void cleanupNow()} disabled={cleaning}>
            {cleaning ? <Loader2 className="size-4 animate-spin" /> : <RefreshCw className="size-4" />} Clean up stuck games now
          </Button>
          <span className="text-[11px] text-mist-500">
            Runs the same check immediately — works even when automatic cleanup is switched off.
          </span>
        </div>
      </Card>

      {/* Running matches + stuck games — reset a specific one (per game) */}
      <Card className="p-5">
        <div className="flex items-center justify-between gap-3">
          <h2 className="flex items-center gap-2 font-display text-lg font-bold text-mist-100"><Gamepad2 className="size-5 text-lotus-300" /> Running &amp; stuck games</h2>
          <Button variant="secondary" size="sm" onClick={load} disabled={loading}><RefreshCw className={cn("size-4", loading && "animate-spin")} /> Refresh</Button>
        </div>
        <p className="mt-0.5 text-sm text-mist-400">Reset a specific game that is stuck — a running match frozen on a turn, <b className="text-mist-300">or a game frozen in the lobby (&ldquo;STARTING&hellip;&rdquo;) that never began</b>. Closes it for everyone in that game and frees the room.</p>

        {/* Per-game filter (Ludo / Snake & Ladder / Chess) */}
        <div className="mt-3 flex flex-wrap gap-1">
          {[["all", "All games"], ["ludo", "Ludo"], ["snake", "Snake & Ladder"], ["chess", "Chess"]].map(([k, lbl]) => {
            const count = k === "all" ? running.length : running.filter((g) => g.game === k).length;
            return (
              <button key={k} onClick={() => setGameFilter(k)} className={cn("rounded-lg px-3 py-1.5 text-xs font-semibold transition", gameFilter === k ? "bg-lotus-600/90 text-white" : "bg-ink-800 text-mist-400 hover:text-mist-100")}>
                {lbl} <span className="opacity-70">({count})</span>
              </button>
            );
          })}
        </div>

        <div className="mt-3 space-y-2">
          {loading && running.length === 0 && <p className="text-sm text-mist-500">Loading…</p>}
          {(() => {
            const shown = running.filter((g) => gameFilter === "all" || g.game === gameFilter);
            if (!loading && shown.length === 0) return <p className="rounded-lg border border-line bg-ink-900 px-4 py-6 text-center text-sm text-mist-500">No {gameFilter === "all" ? "" : `${GAME_LABEL[gameFilter] ?? gameFilter} `}games are running or stuck right now.</p>;
            return shown.map((g) => {
              const isLobby = g.kind === "lobby";
              return (
                <div key={g.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-line bg-ink-900 px-3.5 py-2.5">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2 text-sm font-semibold text-mist-100">
                      <span>{GAME_LABEL[g.game] ?? g.game}</span>
                      <span className="rounded bg-white/[0.06] px-1.5 py-0.5 text-[10px] text-mist-400">{g.roomName}</span>
                      <span className={cn("rounded-full px-1.5 py-0.5 text-[10px] font-bold uppercase", isLobby ? "bg-amber-500/15 text-amber-300" : "bg-emerald-500/15 text-emerald-300")}>{isLobby ? `stuck · ${g.status}` : "running"}</span>
                    </div>
                    <div className="mt-0.5 truncate text-[11px] text-mist-500">{isLobby ? "Lobby" : "Match"} {g.id} · {g.players.length ? g.players.join(", ") : "no players yet"}</div>
                  </div>
                  <Button
                    variant="danger" size="sm"
                    onClick={() => ask({
                      title: `Reset this ${GAME_LABEL[g.game] ?? g.game} game?`,
                      description: isLobby
                        ? `The stuck ${GAME_LABEL[g.game] ?? g.game} lobby in "${g.roomName}" will be cleared so the room can start a fresh game.`
                        : `Match ${g.id} in "${g.roomName}" will be closed immediately for all its players.`,
                      confirmLabel: "Reset game", okMsg: isLobby ? "Stuck game cleared — the room is free again." : "Match reset — closed for all players.",
                      run: (rsn) => isLobby ? post({ action: "resetLobby", lobbyId: g.id, reason: rsn }) : post({ action: "resetGame", sessionId: g.id, reason: rsn }),
                    })}
                  >Reset</Button>
                </div>
              );
            });
          })()}
        </div>
      </Card>

      {/* ── RESET HISTORY ─────────────────────────────────────────────────── */}
      <Card className="p-5">
        <h2 className="flex items-center gap-2 font-display text-lg font-bold text-mist-100">
          <History className="size-5 text-lotus-300" /> Reset history
          {history.length > 0 && <span className="rounded-full bg-white/[0.07] px-2 py-0.5 text-[11px] font-semibold text-mist-400">{history.length}</span>}
        </h2>
        <p className="mt-0.5 text-sm text-mist-400">Every stuck game that has been cleared — automatically or by an admin — with the reason, how long it had been stuck, and who was in it.</p>

        {history.length === 0 ? (
          <p className="mt-3 rounded-lg border border-line bg-ink-900 px-4 py-6 text-center text-sm text-mist-500">Nothing has been reset yet.</p>
        ) : (
          <div className="mt-3 max-h-[26rem] overflow-y-auto rounded-lg border border-line">
            <table className="w-full min-w-[640px] text-sm">
              <thead className="sticky top-0 bg-ink-900">
                <tr className="text-left text-xs text-mist-400">
                  <th className="px-3 py-2">When</th>
                  <th className="px-3 py-2">Game</th>
                  <th className="px-3 py-2">Room</th>
                  <th className="px-3 py-2">Why it was cleared</th>
                  <th className="px-3 py-2">Players</th>
                  <th className="px-3 py-2">By</th>
                </tr>
              </thead>
              <tbody>
                {history.map((h) => (
                  <tr key={h.id} className="border-t border-line/60 align-top">
                    <td className="whitespace-nowrap px-3 py-2 text-xs text-mist-400">
                      {new Date(h.at).toLocaleString("en-SA", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                    </td>
                    <td className="px-3 py-2 text-mist-200">{GAME_LABEL[h.game] ?? h.game}</td>
                    <td className="max-w-[10rem] truncate px-3 py-2 text-mist-300" title={h.roomId}>{h.roomName}</td>
                    <td className="px-3 py-2 text-xs text-mist-400">
                      {h.reason}
                      <span className="ml-1 text-mist-500">· stuck {h.ageHours}h</span>
                    </td>
                    <td className="max-w-[10rem] truncate px-3 py-2 text-xs text-mist-400">{h.players.length ? h.players.join(", ") : "—"}</td>
                    <td className="whitespace-nowrap px-3 py-2 text-xs">
                      <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-bold", h.auto ? "bg-lotus-500/15 text-lotus-300" : "bg-amber-500/15 text-amber-300")}>
                        {h.auto ? "AUTO" : "ADMIN"}
                      </span>
                      <span className="ml-1.5 text-mist-500">{h.by}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Bulk / room / player recovery */}
      <div className="grid gap-4 lg:grid-cols-2">
        {/* Force-close unfinished matches */}
        <Card className="p-5">
          <h2 className="flex items-center gap-2 font-display text-base font-bold text-mist-100"><AlertTriangle className="size-5 text-amber-300" /> Force-close unfinished matches</h2>
          <p className="mt-0.5 text-sm text-mist-400">End every running match at once — in one room, or across the whole platform.</p>
          <RoomPicker
            rooms={rooms}
            value={closeRoomId}
            onChange={setCloseRoomId}
            disabled={closeAll}
            label="Room name or ID (leave blank & tick below for all rooms)"
          />
          <label className="mt-2 flex items-center gap-2 text-xs text-mist-300">
            <input type="checkbox" checked={closeAll} onChange={(e) => setCloseAll(e.target.checked)} className="size-4 accent-rose-500" />
            Close matches in <b className="text-rose-300">ALL rooms</b>
          </label>
          <Button
            variant="danger" className="mt-3" block
            disabled={!closeAll && !closeRoomId.trim()}
            onClick={() => {
              const rid = closeAll ? undefined : resolveRoom(closeRoomId);
              ask({
                title: closeAll ? "Force-close ALL matches?" : "Force-close the room's matches?",
                description: closeAll ? "Every running match across the whole platform will be closed immediately."
                  : rid ? `Every running match in "${closeRoomId.trim()}" (${rid}) will be closed immediately.`
                  : `Could not identify a single room from "${closeRoomId.trim()}". Pick one from the dropdown.`,
                confirmLabel: "Force-close", okMsg: "Unfinished matches closed.",
                run: (rsn) => {
                  if (!closeAll && !rid) return Promise.resolve({ ok: false as const, error: "Pick a room from the dropdown, or paste the exact Room ID (room names may not be unique)." });
                  return post({ action: "forceCloseMatches", scope: closeAll ? "all" : undefined, roomId: closeAll ? undefined : rid, reason: rsn }).then((r) => ({ ...r, note: r.ok ? `Closed ${(r as { closed?: number }).closed ?? 0} match(es).` : undefined }));
                },
              });
            }}
          >Force-close matches</Button>
        </Card>

        {/* Reset a stuck room */}
        <Card className="p-5">
          <h2 className="flex items-center gap-2 font-display text-base font-bold text-mist-100"><DoorClosed className="size-5 text-lotus-300" /> Reset a stuck room</h2>
          <p className="mt-0.5 text-sm text-mist-400">Restart a room&apos;s services: <b className="text-mist-300">cancel any stuck lobby (&ldquo;STARTING&hellip;&rdquo;)</b>, close its matches, drop colour-pick locks, and clear stuck &quot;in this room&quot; presence so it returns clean. Anyone genuinely still inside simply re-opens the room to rejoin (voice keeps playing).</p>
          <RoomPicker rooms={rooms} value={resetRoomId} onChange={setResetRoomId} label="Room name or ID" />
          <Button
            className="mt-3" block
            disabled={!resetRoomId.trim()}
            onClick={() => {
              const rid = resolveRoom(resetRoomId);
              ask({
                title: "Reset this room?",
                description: rid
                  ? `Room "${resetRoomId.trim()}" (${rid}) will have any stuck lobby cancelled, its running matches closed, and stuck presence cleared.`
                  : `Could not identify a single room from "${resetRoomId.trim()}". Pick one from the dropdown.`,
                confirmLabel: "Reset room", okMsg: "Room reset.",
                run: (rsn) => {
                  if (!rid) return Promise.resolve({ ok: false as const, error: "Pick a room from the dropdown, or paste the exact Room ID (room names may not be unique)." });
                  return post({ action: "resetRoom", roomId: rid, reason: rsn }).then((r) => ({ ...r, note: r.ok ? `Room reset — cancelled ${(r as { lobbies?: number }).lobbies ?? 0} stuck lobby(ies), closed ${(r as { closed?: number }).closed ?? 0} match(es), cleared ${(r as { cleared?: number }).cleared ?? 0} stuck member(s).` : undefined }));
                },
              });
            }}
          >Reset room</Button>
        </Card>

        {/* Reset a player */}
        <Card className="p-5">
          <h2 className="flex items-center gap-2 font-display text-base font-bold text-mist-100"><UserCog className="size-5 text-lotus-300" /> Reset player status</h2>
          <p className="mt-0.5 text-sm text-mist-400">Clear a player who is stuck &quot;in a room / in a game&quot; so they can join fresh. Search by name — you don&apos;t need to know their ID. If they&apos;re actually online, they just re-open the room to rejoin.</p>
          <UserPicker users={users} value={resetUserId} onChange={setResetUserId} label="Player name or ID" />
          <Button
            className="mt-3" block
            disabled={!resetUserId.trim()}
            onClick={() => ask({
              title: "Reset this player's status?",
              description: `Player ${resetUserId.trim()} will be cleared from any room/game they're stuck in.`,
              confirmLabel: "Reset player", okMsg: "Player status reset.",
              run: (rsn) => post({ action: "resetPlayer", userId: resolveUser(resetUserId), reason: rsn }).then((r) => ({ ...r, note: r.ok && (r as { name?: string }).name ? `Reset status for ${(r as { name?: string }).name}.` : undefined })),
            })}
          >Reset player</Button>
        </Card>

        {/* Tournament resets live in the control center */}
        <Card className="p-5">
          <h2 className="flex items-center gap-2 font-display text-base font-bold text-mist-100"><Radio className="size-5 text-lotus-300" /> Tournament &amp; match rooms</h2>
          <p className="mt-0.5 text-sm text-mist-400">Reset a tournament match room (pause / end / close / re-seat waiting players) from the Rooms Control Center.</p>
          <Link href={withBase("/admin/tournament-rooms")} className="mt-3 inline-flex w-full items-center justify-center gap-1.5 rounded-lg bg-lotus-500 px-4 py-2 text-sm font-bold text-white transition hover:bg-lotus-400">
            <Radio className="size-4" /> Open Rooms Control Center
          </Link>
        </Card>

        {/* Recovery. Nothing on this page can reach accounts or settings — but
            this is where an admin comes when something has gone wrong, so the
            way back is put in front of them here too. */}
        <Card className="border-emerald-400/25 bg-emerald-500/[0.05] p-5">
          <h2 className="flex items-center gap-2 font-display text-base font-bold text-mist-100">
            <DatabaseBackup className="size-5 text-emerald-300" /> Recovery — go back in time
          </h2>
          <p className="mt-0.5 text-sm text-mist-400">
            Everything — accounts, groups, messages, coins and every manual setting — is saved automatically
            every 12 hours, and the last 14 saves are kept. If anything is ever lost or changed by mistake,
            you can put it all back exactly as it was.
          </p>
          <Link href={withBase("/admin/backup-restore")} className="mt-3 inline-flex w-full items-center justify-center gap-1.5 rounded-lg bg-emerald-500 px-4 py-2 text-sm font-bold text-white transition hover:bg-emerald-400">
            <DatabaseBackup className="size-4" /> Open Backup &amp; Restore
          </Link>
        </Card>
      </div>

      {/* Reason modal */}
      {pending && (
        <div className="fixed inset-0 z-[60] grid place-items-center bg-black/60 p-4" role="dialog" aria-modal="true" onClick={() => !busy && setPending(null)}>
          <div className="w-full max-w-md rounded-2xl border border-white/10 bg-ink-850 p-5 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <span className="grid size-10 shrink-0 place-items-center rounded-full bg-rose-500/15 text-rose-300"><AlertTriangle className="size-5" /></span>
                <h2 className="font-display text-lg font-bold text-mist-100">{pending.title}</h2>
              </div>
              <button onClick={() => !busy && setPending(null)} className="text-mist-400 hover:text-mist-100"><X className="size-5" /></button>
            </div>
            <p className="mt-3 text-sm text-mist-300">{pending.description}</p>
            <label className="mt-4 block text-xs font-semibold text-mist-300">Reason (required — recorded in the audit log)
              <textarea
                value={reason} onChange={(e) => setReason(e.target.value)} rows={3} autoFocus
                placeholder="Why is this reset needed? e.g. Match frozen on a player's turn and could not continue."
                className="mt-1 block w-full rounded-lg border border-line bg-ink-800 px-3 py-2 text-sm text-mist-100 outline-none focus:border-lotus-400"
              />
            </label>
            <div className="mt-5 flex justify-end gap-2">
              <Button variant="secondary" onClick={() => setPending(null)} disabled={busy}>Cancel</Button>
              <Button variant="danger" onClick={confirmAction} disabled={busy || !reason.trim()}>
                {busy ? <Loader2 className="size-4 animate-spin" /> : null} {pending.confirmLabel}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
