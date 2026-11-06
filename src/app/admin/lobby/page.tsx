"use client";

import { useCallback, useEffect, useState } from "react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import { useConfig, saveConfig, type AppConfig } from "@/lib/config";
import { withBase } from "@/lib/base-path";
import { cn } from "@/lib/cn";
import { Gamepad2, Save, ScrollText, RefreshCw, LayoutGrid, ArrowLeftRight, RotateCcw, Info } from "lucide-react";

interface LobbyLogRow { at: string; event: string; actor?: string; detail?: string }
interface LobbyRec {
  id: string; roomName: string; gameName: string; hostName: string; startedByRole: string;
  mode: string | null; status: string; createdAt: string; startedAt?: string;
  seats: { color: string; name?: string; joinedAt?: string }[]; log: LobbyLogRow[];
}
const fmt = (s?: string) => (s ? new Date(s).toLocaleString("en-SA", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "—");
const DOTHEX: Record<string, string> = { red: "#ef4444", green: "#16a34a", yellow: "#eab308", blue: "#2563eb", w: "#f8fafc", b: "#111827" };
const EVENT_LABEL: Record<string, string> = {
  opened: "Opened", mode: "Mode chosen", join: "Player joined", leave: "Player left", forceStart: "Force-started",
  autostart: "Auto-started", cancel: "Cancelled", remove: "Removed player", ban: "Banned player", unban: "Unbanned",
  lock: "Locked", unlock: "Unlocked", public: "Public toggled", color: "Colour changed", pause: "Timer paused",
  resume: "Timer resumed", restart: "Lobby restarted",
};

type Lobby = NonNullable<AppConfig["lobby"]>;
const DEF: Lobby = { enabled: false, hostOnlyStart: true, autoJoin: true, manualInvite: true, countdownSeconds: 20, startingSeconds: 3, minPlayers: 2, maxPlayers: 4, seatOrder: ["red", "green", "yellow", "blue"] };
const SEAT_COLORS = ["red", "green", "yellow", "blue"] as const;
const SEAT_NAME: Record<string, string> = { red: "Red", green: "Green", yellow: "Yellow", blue: "Blue" };
const POSITION_NAME = ["Position 1 (top-left)", "Position 2 (top-right)", "Position 3 (bottom-left)", "Position 4 (bottom-right)"];

export default function AdminLobbyPage() {
  const { config, reload } = useConfig();
  const { toast } = useToast();
  const [f, setF] = useState<Lobby>(DEF);
  const [busy, setBusy] = useState(false);
  useEffect(() => { if (config.lobby) setF({ ...DEF, ...config.lobby }); }, [config.lobby]);

  const save = async () => {
    setBusy(true);
    const res = await saveConfig({ lobby: f });
    setBusy(false);
    if (res.ok) { await reload(); toast("Lobby settings saved", "success"); }
    else toast(res.error ?? "Could not save", "error");
  };

  // Lobby logs (every game's full event history).
  const [lobbies, setLobbies] = useState<LobbyRec[]>([]);
  const [logsBusy, setLogsBusy] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);
  const loadLogs = useCallback(async () => {
    setLogsBusy(true);
    try { const res = await fetch(withBase("/api/admin/lobbies"), { credentials: "include" }); const d = await res.json().catch(() => ({})); setLobbies((d.lobbies as LobbyRec[]) ?? []); } catch { /* ignore */ }
    setLogsBusy(false);
  }, []);
  useEffect(() => { loadLogs(); }, [loadLogs]);

  // Reset a game stuck in the lobby (e.g. frozen on "STARTING…"). Clears the lobby
  // + the room's session/locks so the room can start a fresh game — no server restart.
  const [resetting, setResetting] = useState<string | null>(null);
  const resetLobby = async (lb: LobbyRec) => {
    if (!window.confirm(`Reset the stuck ${lb.gameName} game in "${lb.roomName}"? This clears it so the room can start a fresh game.`)) return;
    setResetting(lb.id);
    try {
      const res = await fetch(withBase("/api/admin/reset"), {
        method: "POST", credentials: "include", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "resetLobby", lobbyId: lb.id, reason: "Cleared stuck game from the Game Lobby page" }),
      });
      const d = await res.json().catch(() => ({}));
      if (res.ok) { toast("Stuck game cleared — the room is free again.", "success"); await loadLogs(); }
      else toast(d?.error ?? "Could not reset this game", "error");
    } catch { toast("Network error — please try again", "error"); }
    setResetting(null);
  };

  const Toggle = ({ k, label, desc }: { k: keyof Lobby; label: string; desc: string }) => {
    const on = f[k] !== false;
    return (
      <div className="flex items-center gap-4 border-b border-white/5 p-4 last:border-0">
        <div className="min-w-0 flex-1">
          <div className="font-semibold text-mist-100">{label}</div>
          <p className="text-xs text-mist-400">{desc}</p>
        </div>
        <button onClick={() => setF((p) => ({ ...p, [k]: !on }))} className={cn("relative h-7 w-12 shrink-0 rounded-full transition", on ? "bg-emerald-500" : "bg-ink-700")} aria-pressed={on}>
          <span className={cn("absolute top-0.5 size-6 rounded-full bg-white shadow transition-all", on ? "left-[22px]" : "left-0.5")} />
        </button>
      </div>
    );
  };
  const Num = ({ k, label, min, max, suffix }: { k: keyof Lobby; label: string; min: number; max: number; suffix?: string }) => (
    <div className="flex items-center justify-between gap-3 border-b border-white/5 p-4 last:border-0">
      <label className="text-sm font-medium text-mist-200">{label}</label>
      <div className="flex items-center gap-2">
        <input type="number" min={min} max={max} value={Number(f[k] ?? 0)} onChange={(e) => setF((p) => ({ ...p, [k]: Math.max(min, Math.min(max, Math.floor(Number(e.target.value) || 0))) }))} className="h-9 w-20 rounded-lg border border-line bg-ink-800 px-2 text-right text-sm text-mist-100 outline-none focus:border-lotus-400" />
        {suffix && <span className="text-xs text-mist-500">{suffix}</span>}
      </div>
    </div>
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="flex items-center gap-2 font-display text-2xl font-extrabold text-mist-100"><Gamepad2 className="size-6 text-lotus-300" /> Game Lobby & Match Start</h1>
        <p className="text-sm text-mist-400">The new Host-controlled match-start flow: only the Host/Co-Host opens a game, then chooses <b>Manual Invitation</b> or <b>Automatic Join</b> (a seat lobby with a countdown). Changes apply instantly. <b>When the master switch is OFF, the classic game-start flow is used</b> (nothing changes).</p>
      </div>

      <Card className="p-0">
        <Toggle k="enabled" label="Enable the new lobby flow (master)" desc="OFF = classic flow (any player can create & start a game). ON = Host/Co-Host opens a game and picks a mode." />
        <Toggle k="hostOnlyStart" label="Only Host / Co-Host can start a game" desc="Normal members cannot initiate a game; they wait for the host to open one." />
        <Toggle k="autoJoin" label="Allow Automatic-Join mode" desc="Opens a seat lobby — any member taps Join to take a seat; auto-starts on a countdown." />
        <Toggle k="manualInvite" label="Allow Manual-Invitation mode" desc="The classic invite flow — the host invites specific players." />
      </Card>

      <Card className="p-0">
        <Num k="countdownSeconds" label="Auto-join countdown" min={5} max={120} suffix="seconds" />
        <Num k="startingSeconds" label="&ldquo;Game Starting…&rdquo; countdown" min={0} max={15} suffix="seconds" />
        <Num k="minPlayers" label="Minimum players to start" min={2} max={4} suffix="players" />
        <Num k="maxPlayers" label="Lobby size (max players)" min={2} max={4} suffix="seats" />
      </Card>

      {/* ── SEAT POSITIONS — which colour sits where in the lobby grid ── */}
      <Card className="p-4 sm:p-5">
        <h2 className="flex items-center gap-2 font-display text-lg font-bold text-mist-100"><LayoutGrid className="size-5 text-lotus-300" /> Seat positions</h2>
        <p className="mt-0.5 text-sm text-mist-400">
          Choose which colour appears in each position of the lobby seat grid — for example, putting Blue where Yellow
          normally sits. Each position is set independently, so any arrangement is possible.
        </p>
        <div className="mt-2 flex items-start gap-2 rounded-lg border border-sky-400/25 bg-sky-500/[0.06] px-3 py-2 text-[11px] text-mist-300">
          <Info className="mt-0.5 size-3.5 shrink-0 text-sky-300" />
          <p><b className="text-mist-100">Display only.</b> A seat keeps its colour, its player and everything the game uses — only the position it is drawn in changes. Nothing about how the game is played is affected.</p>
        </div>

        <div className="mt-4 grid gap-4 sm:grid-cols-[1fr_auto]">
          <div className="space-y-2">
            {POSITION_NAME.map((label, i) => {
              const cur = (f.seatOrder ?? DEF.seatOrder!)[i];
              return (
                <label key={i} className="flex flex-wrap items-center gap-3">
                  <span className="min-w-44 text-sm font-semibold text-mist-200">{label}</span>
                  <select
                    value={cur}
                    onChange={(e) => {
                      const picked = e.target.value;
                      setF((s) => {
                        const order = [...(s.seatOrder ?? DEF.seatOrder!)];
                        const at = order.indexOf(picked);
                        // Swap with wherever that colour currently is, so the four
                        // colours are always each used exactly once.
                        if (at !== -1) { order[at] = order[i]; }
                        order[i] = picked;
                        return { ...s, seatOrder: order };
                      });
                    }}
                    className="h-9 rounded-lg border border-line bg-ink-900 px-2.5 text-sm text-mist-100 outline-none focus:border-lotus-400"
                  >
                    {SEAT_COLORS.map((c) => <option key={c} value={c}>{SEAT_NAME[c]}</option>)}
                  </select>
                  <span className="size-4 rounded-full ring-2 ring-white/20" style={{ background: DOTHEX[cur] }} />
                </label>
              );
            })}

            <div className="flex flex-wrap gap-3 pt-2">
              <button
                onClick={() => setF((s) => {
                  const order = [...(s.seatOrder ?? DEF.seatOrder!)];
                  const y = order.indexOf("yellow"); const b = order.indexOf("blue");
                  if (y !== -1 && b !== -1) { order[y] = "blue"; order[b] = "yellow"; }
                  return { ...s, seatOrder: order };
                })}
                className="inline-flex items-center gap-1.5 rounded-lg border border-lotus-400/40 bg-lotus-500/10 px-3 py-1.5 text-sm font-semibold text-lotus-200 transition hover:bg-lotus-500/20"
              >
                <ArrowLeftRight className="size-4" /> Swap Yellow &amp; Blue
              </button>
              <button
                onClick={() => setF((s) => ({ ...s, seatOrder: [...DEF.seatOrder!] }))}
                className="inline-flex items-center gap-1.5 text-sm font-semibold text-mist-400 transition hover:text-mist-100"
              >
                <RotateCcw className="size-4" /> Reset to default order
              </button>
            </div>
          </div>

          {/* Live preview of the seat grid */}
          <div className="sm:w-48">
            <p className="mb-1.5 text-center text-[11px] font-semibold uppercase tracking-wide text-mist-500">Lobby preview</p>
            <div className="grid grid-cols-2 gap-2">
              {(f.seatOrder ?? DEF.seatOrder!).map((c, i) => (
                <div key={`${c}-${i}`} className="rounded-xl border border-line bg-ink-900 p-2.5">
                  <div className="flex items-center gap-1.5">
                    <span className="size-3 rounded-full ring-2 ring-white/25" style={{ background: DOTHEX[c] }} />
                    <span className="text-[11px] font-semibold text-mist-300">{SEAT_NAME[c]}</span>
                  </div>
                  <div className="mt-2 h-5 rounded-md bg-emerald-500/20" />
                </div>
              ))}
            </div>
          </div>
        </div>
      </Card>

      <div className="flex justify-end">
        <Button onClick={save} disabled={busy}><Save className="size-4" /> {busy ? "Saving…" : "Save lobby settings"}</Button>
      </div>

      {/* ── Lobby logs (every game's full event history) ── */}
      <div className="flex items-center justify-between pt-2">
        <h2 className="flex items-center gap-2 font-display text-lg font-bold text-mist-100"><ScrollText className="size-5 text-lotus-300" /> Recent games &amp; lobby logs</h2>
        <Button size="sm" variant="secondary" onClick={loadLogs} disabled={logsBusy}><RefreshCw className={cn("size-3.5", logsBusy && "animate-spin")} /> Refresh</Button>
      </div>
      <Card className="p-0">
        {lobbies.length === 0 ? (
          <p className="p-6 text-center text-sm text-mist-500">No games have been started through the lobby yet.</p>
        ) : (
          <div className="divide-y divide-white/5">
            {lobbies.map((lb) => {
              const players = lb.seats.filter((s) => s.name);
              const open = openId === lb.id;
              const stuck = lb.status === "open" || lb.status === "starting" || lb.status === "choosing";
              return (
                <div key={lb.id}>
                  <div className="flex w-full items-center gap-3 p-4 transition hover:bg-white/[0.03]">
                    <button onClick={() => setOpenId(open ? null : lb.id)} className="flex min-w-0 flex-1 items-center gap-3 text-left">
                      <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-bold uppercase", lb.status === "started" ? "bg-emerald-500/15 text-emerald-300" : lb.status === "cancelled" ? "bg-rose-500/15 text-rose-300" : "bg-amber-500/15 text-amber-300")}>{lb.status}</span>
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm font-semibold text-mist-100">{lb.gameName} · {lb.roomName}</div>
                        <div className="truncate text-xs text-mist-400">Opened by {lb.hostName} ({lb.startedByRole}) · {lb.mode ?? "no mode"} · {players.length} players · {fmt(lb.createdAt)}</div>
                      </div>
                      <span className="text-xs text-mist-500">{lb.log.length} events</span>
                    </button>
                    {/* Reset a game stuck in the lobby (frozen before it began). */}
                    {stuck && (
                      <Button size="sm" variant="danger" onClick={() => resetLobby(lb)} disabled={resetting === lb.id}>
                        <RefreshCw className={cn("size-3.5", resetting === lb.id && "animate-spin")} /> {resetting === lb.id ? "Resetting…" : "Reset"}
                      </Button>
                    )}
                  </div>
                  {open && (
                    <div className="border-t border-white/5 bg-ink-900/40 px-4 py-3">
                      <div className="mb-2 flex flex-wrap gap-1.5">
                        {players.map((s) => (
                          <span key={s.color} className="inline-flex items-center gap-1.5 rounded-full bg-ink-800 px-2 py-0.5 text-[11px] text-mist-200"><span className="size-2.5 rounded-full ring-1 ring-white/20" style={{ background: DOTHEX[s.color] ?? s.color }} />{s.name} · {s.color} · {fmt(s.joinedAt)}</span>
                        ))}
                      </div>
                      {lb.startedAt && <p className="mb-2 text-[11px] text-emerald-300">Match started: {fmt(lb.startedAt)}</p>}
                      <div className="max-h-64 space-y-1 overflow-y-auto">
                        {lb.log.map((e, i) => (
                          <div key={i} className="flex items-start gap-2 text-[11px]">
                            <span className="shrink-0 text-mist-600">{fmt(e.at)}</span>
                            <span className="font-semibold text-mist-200">{EVENT_LABEL[e.event] ?? e.event}</span>
                            {e.actor && <span className="text-mist-400">· {e.actor}</span>}
                            {e.detail && <span className="text-mist-500">({e.detail})</span>}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </Card>

      <p className="text-xs text-mist-500">Every lobby stores a complete event log (who opened it, joins with seat &amp; colour, timer resets, host actions and the match start time). Lobby events also generate in-app notifications for members present in the room.</p>
    </div>
  );
}
