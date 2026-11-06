"use client";

import { useEffect, useState } from "react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { useToast } from "@/components/ui/Toast";
import { useConfig, saveConfig, type GameItem } from "@/lib/config";
import { gameIcon, GAME_ICON_KEYS } from "@/lib/game-icons";
import { cn } from "@/lib/cn";
import { Gamepad2, Plus, Trash2, Check, Pencil, Eye, Timer, Dices, ScrollText, RefreshCw } from "lucide-react";

const BUILTIN = ["ludo", "chess", "snake"];

export default function AdminGamesPage() {
  const { config, loading, reload } = useConfig();
  const { toast } = useToast();
  const [games, setGames] = useState<GameItem[]>(config.games);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState<GameItem | null>(null);
  const [adding, setAdding] = useState(false);
  const [confirmDel, setConfirmDel] = useState<GameItem | null>(null);
  const [turnSecs, setTurnSecs] = useState<number>(config.gameTurnSeconds ?? 10);
  const [savingTimer, setSavingTimer] = useState(false);
  const [diceSpeed, setDiceSpeed] = useState<"slow" | "normal" | "fast">(config.gameDiceSpeed ?? "normal");
  const [savingDice, setSavingDice] = useState(false);
  const [tokenSpeed, setTokenSpeed] = useState<"slow" | "normal" | "fast">(config.gameTokenSpeed ?? "normal");
  const [savingToken, setSavingToken] = useState(false);
  const [returnChances, setReturnChances] = useState<boolean>(config.gameRules?.returnChancesOnRejoin !== false);
  const [savingChances, setSavingChances] = useState(false);
  // OPTIONAL Fair Dice pity system (config.fairDice). Ships OFF → dice stay pure-random.
  const fd = config.fairDice ?? {};
  const [fdOn, setFdOn] = useState<boolean>(fd.enabled === true);
  const [fdThreshold, setFdThreshold] = useState<number>(fd.threshold ?? 12);
  const [fdBoost, setFdBoost] = useState<number>(fd.boostPercent ?? 50);
  const [fdGuarantee, setFdGuarantee] = useState<number>(fd.guaranteeAfter ?? 20);
  const [savingFd, setSavingFd] = useState(false);
  // PER-GAME overrides (ludo/snake/chess): each field unset = "use the global value above".
  type PerGame = { turnSeconds?: number; diceSpeed?: "slow" | "normal" | "fast"; tokenSpeed?: "slow" | "normal" | "fast"; returnChancesOnRejoin?: boolean };
  const [perGame, setPerGame] = useState<Record<string, PerGame>>(config.perGameSettings ?? {});
  const [pgGame, setPgGame] = useState<"ludo" | "snake" | "chess">("ludo");
  const [savingPg, setSavingPg] = useState(false);
  const savePerGame = async (next: Record<string, PerGame>) => {
    // Drop empty per-game entries so "use global" everywhere = no override stored.
    const clean: Record<string, PerGame> = {};
    for (const [g, s] of Object.entries(next)) { const e: PerGame = {}; if (typeof s.turnSeconds === "number") e.turnSeconds = s.turnSeconds; if (s.diceSpeed) e.diceSpeed = s.diceSpeed; if (s.tokenSpeed) e.tokenSpeed = s.tokenSpeed; if (typeof s.returnChancesOnRejoin === "boolean") e.returnChancesOnRejoin = s.returnChancesOnRejoin; if (Object.keys(e).length) clean[g] = e; }
    setPerGame(clean);
    setSavingPg(true);
    const res = await saveConfig({ perGameSettings: clean });
    setSavingPg(false);
    if (res.ok) { await reload(); toast("Per-game settings saved.", "success"); }
    else toast(res.error ?? "Could not save", "error");
  };
  const setPg = (field: keyof PerGame, value: PerGame[keyof PerGame]) => {
    setPerGame((prev) => {
      const next = { ...prev, [pgGame]: { ...(prev[pgGame] ?? {}), [field]: value } };
      if (value === undefined) delete (next[pgGame] as Record<string, unknown>)[field];
      return next;
    });
  };

  useEffect(() => {
    if (!loading) {
      setGames(config.games); setTurnSecs(config.gameTurnSeconds ?? 10); setDiceSpeed(config.gameDiceSpeed ?? "normal"); setTokenSpeed(config.gameTokenSpeed ?? "normal"); setReturnChances(config.gameRules?.returnChancesOnRejoin !== false); setPerGame(config.perGameSettings ?? {});
      const f = config.fairDice ?? {};
      setFdOn(f.enabled === true); setFdThreshold(f.threshold ?? 12); setFdBoost(f.boostPercent ?? 50); setFdGuarantee(f.guaranteeAfter ?? 20);
    }
  }, [loading, config]);

  const saveFairDice = async (patch: { enabled?: boolean; threshold?: number; boostPercent?: number; guaranteeAfter?: number }) => {
    const next = {
      enabled: patch.enabled ?? fdOn,
      threshold: Math.max(3, Math.min(40, Math.round(patch.threshold ?? fdThreshold) || 12)),
      boostPercent: Math.max(0, Math.min(100, Math.round(patch.boostPercent ?? fdBoost))),
      guaranteeAfter: Math.max(0, Math.min(60, Math.round(patch.guaranteeAfter ?? fdGuarantee))),
    };
    setSavingFd(true);
    const res = await saveConfig({ fairDice: next });
    setSavingFd(false);
    if (res.ok) { await reload(); toast(next.enabled ? "Fair Dice system saved." : "Fair Dice turned OFF — dice are 100% pure-random.", "success"); }
    else toast(res.error ?? "Could not save", "error");
  };

  const saveChances = async (v: boolean) => {
    setReturnChances(v);
    setSavingChances(true);
    const res = await saveConfig({ gameRules: { returnChancesOnRejoin: v } });
    setSavingChances(false);
    if (res.ok) { await reload(); toast(v ? "Rejoin will now RESTORE remaining chances." : "Rejoin is now FIXED — used chances stay used.", "success"); }
    else { setReturnChances(!v); toast(res.error ?? "Could not save", "error"); }
  };

  const saveTimer = async () => {
    const v = Math.max(5, Math.min(120, Math.round(turnSecs) || 10));
    setSavingTimer(true);
    const res = await saveConfig({ gameTurnSeconds: v });
    setSavingTimer(false);
    if (res.ok) { await reload(); toast(`Chance-missing timer set to ${v}s`, "success"); }
    else toast(res.error ?? "Could not save", "error");
  };

  const saveDiceSpeed = async () => {
    setSavingDice(true);
    const res = await saveConfig({ gameDiceSpeed: diceSpeed });
    setSavingDice(false);
    if (res.ok) { await reload(); toast(`Dice speed set to ${diceSpeed}`, "success"); }
    else toast(res.error ?? "Could not save", "error");
  };

  const saveTokenSpeed = async () => {
    setSavingToken(true);
    const res = await saveConfig({ gameTokenSpeed: tokenSpeed });
    setSavingToken(false);
    if (res.ok) { await reload(); toast(`Token move speed set to ${tokenSpeed}`, "success"); }
    else toast(res.error ?? "Could not save", "error");
  };

  // Dice Log (read-only audit) — loaded on demand from the recorded move history.
  type DiceRow = { matchId: string; game: string; roomName: string; turn: number; player: string; playerId: string; value: number; passed: boolean; at: string; live: boolean };
  type DiceSummary = { value: number; count: number; pct: number };
  const [diceRows, setDiceRows] = useState<DiceRow[] | null>(null);
  const [diceSummary, setDiceSummary] = useState<DiceSummary[]>([]);
  const [diceTotal, setDiceTotal] = useState(0);
  const [diceLoading, setDiceLoading] = useState(false);
  const loadDiceLog = async () => {
    setDiceLoading(true);
    try {
      const res = await fetch("/api/admin/dice-log?limit=800", { cache: "no-store" });
      const json = await res.json();
      if (res.ok) { setDiceRows(json.rows ?? []); setDiceSummary(json.summary ?? []); setDiceTotal(json.total ?? 0); }
      else toast(json.error ?? "Could not load dice log", "error");
    } catch { toast("Could not load dice log", "error"); }
    setDiceLoading(false);
  };

  const persist = async (next: GameItem[], msg: string) => {
    setGames(next);
    setSaving(true);
    const res = await saveConfig({ games: next });
    setSaving(false);
    if (res.ok) {
      await reload();
      toast(msg, "success");
    } else {
      toast(res.error ?? "Could not save", "error");
      await reload();
    }
  };

  const toggle = (g: GameItem) =>
    persist(games.map((x) => (x.id === g.id ? { ...x, enabled: !x.enabled } : x)), `${g.name} ${g.enabled ? "disabled" : "enabled"}`);

  const toggleSpectator = (g: GameItem) => {
    const next = g.spectator === false;
    persist(games.map((x) => (x.id === g.id ? { ...x, spectator: next } : x)), `${g.name} spectator mode ${next ? "enabled" : "disabled"}`);
  };

  const upsert = (game: GameItem) => {
    const exists = games.some((x) => x.id === game.id);
    persist(exists ? games.map((x) => (x.id === game.id ? game : x)) : [...games, game], exists ? `${game.name} updated` : `${game.name} added`);
    setEditing(null);
    setAdding(false);
  };

  const remove = (g: GameItem) => {
    persist(games.filter((x) => x.id !== g.id), `${g.name} removed`);
    setConfirmDel(null);
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-extrabold text-mist-100">Game management</h1>
          <p className="text-sm text-mist-400">Enable, disable, edit or add games. Disabled games are hidden from members&apos; rooms instantly.</p>
        </div>
        <Button onClick={() => setAdding(true)}>
          <Plus className="size-4" /> Add game
        </Button>
      </div>

      {/* Chance-missing timer — how long a player has per turn before it counts
          as a missed turn (loses a heart). Applies to Ludo, Snake & Chess. */}
      <Card className="p-5">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="flex items-center gap-2 font-display text-lg font-bold text-mist-100"><Timer className="size-5 text-lotus-300" /> Chance-missing timer</h2>
            <p className="mt-0.5 text-sm text-mist-400">Seconds each player gets per turn before it counts as a missed turn (a heart is lost). Applies to Ludo, Snake &amp; Chess.</p>
          </div>
          <div className="flex items-end gap-2">
            <label className="text-xs text-mist-400">
              Seconds
              <input type="number" min={5} max={120} value={turnSecs} onChange={(e) => setTurnSecs(Number(e.target.value) || 0)} className="mt-1 block h-10 w-24 rounded-lg border border-line bg-ink-800 px-3 text-sm text-mist-100 outline-none focus:border-lotus-400" />
            </label>
            <Button onClick={saveTimer} disabled={savingTimer}>{savingTimer ? "Saving…" : "Save timer"}</Button>
          </div>
        </div>
        <p className="mt-2 text-[11px] text-mist-500">Allowed range: 5–120 seconds. Currently applied: <b className="text-mist-300">{config.gameTurnSeconds ?? 10}s</b>.</p>

        {/* Dice animation speed — how fast the dice tumbles before showing the result. */}
        <div className="mt-4 flex flex-wrap items-end justify-between gap-3 border-t border-white/5 pt-4">
          <div>
            <h3 className="flex items-center gap-2 font-display text-base font-bold text-mist-100"><Timer className="size-4 text-lotus-300" /> Dice animation speed</h3>
            <p className="mt-0.5 text-sm text-mist-400">How fast the dice spins before it lands. Applies to Ludo &amp; Snake.</p>
          </div>
          <div className="flex items-end gap-2">
            <label className="text-xs text-mist-400">
              Speed
              <select value={diceSpeed} onChange={(e) => setDiceSpeed(e.target.value as "slow" | "normal" | "fast")} className="mt-1 block h-10 w-32 rounded-lg border border-line bg-ink-800 px-3 text-sm text-mist-100 outline-none focus:border-lotus-400">
                <option value="slow">Slow</option>
                <option value="normal">Normal</option>
                <option value="fast">Fast</option>
              </select>
            </label>
            <Button onClick={saveDiceSpeed} disabled={savingDice}>{savingDice ? "Saving…" : "Save speed"}</Button>
          </div>
        </div>
        <p className="mt-2 text-[11px] text-mist-500">Currently applied: <b className="text-mist-300 capitalize">{config.gameDiceSpeed ?? "normal"}</b>.</p>

        {/* Ludo token MOVE speed — how fast a coin walks cell-by-cell to its new square. */}
        <div className="mt-4 flex flex-wrap items-end justify-between gap-3 border-t border-white/5 pt-4">
          <div>
            <h3 className="flex items-center gap-2 font-display text-base font-bold text-mist-100"><Timer className="size-4 text-lotus-300" /> Ludo token move speed</h3>
            <p className="mt-0.5 text-sm text-mist-400">How fast a Ludo coin walks step-by-step to its new square. Slower reads as a smoother glide; faster is snappier.</p>
          </div>
          <div className="flex items-end gap-2">
            <label className="text-xs text-mist-400">
              Speed
              <select value={tokenSpeed} onChange={(e) => setTokenSpeed(e.target.value as "slow" | "normal" | "fast")} className="mt-1 block h-10 w-32 rounded-lg border border-line bg-ink-800 px-3 text-sm text-mist-100 outline-none focus:border-lotus-400">
                <option value="slow">Slow (smooth)</option>
                <option value="normal">Normal</option>
                <option value="fast">Fast</option>
              </select>
            </label>
            <Button onClick={saveTokenSpeed} disabled={savingToken}>{savingToken ? "Saving…" : "Save speed"}</Button>
          </div>
        </div>
        <p className="mt-2 text-[11px] text-mist-500">Currently applied: <b className="text-mist-300 capitalize">{config.gameTokenSpeed ?? "normal"}</b>.</p>
      </Card>

      {/* Player chances on rejoin — restore remaining chances, or keep them fixed. */}
      <Card className="p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="flex items-center gap-2 font-display text-lg font-bold text-mist-100"><Timer className="size-5 text-lotus-300" /> Player chances on rejoin</h2>
            <p className="mt-0.5 text-sm text-mist-400">
              Every player starts with 3 chances (hearts). This controls what happens if a player <b className="text-mist-200">leaves and rejoins</b> a game.
            </p>
          </div>
          <button
            onClick={() => saveChances(!returnChances)}
            role="switch" aria-checked={returnChances} disabled={savingChances}
            title={returnChances ? "On — tap to switch to Fixed" : "Off — tap to Return chances"}
            className={cn("relative mt-1 h-6 w-11 shrink-0 rounded-full transition", returnChances ? "bg-emerald-500" : "bg-mist-600")}
          >
            <span className={cn("absolute top-0.5 size-5 rounded-full bg-white shadow transition-all", returnChances ? "left-[22px]" : "left-0.5")} />
          </button>
        </div>
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          <div className={cn("rounded-xl border p-3 text-xs", returnChances ? "border-emerald-400/40 bg-emerald-500/[0.07]" : "border-line bg-ink-900")}>
            <div className="font-semibold text-mist-100">Return chances {returnChances && <span className="text-emerald-300">· ACTIVE</span>}</div>
            <p className="mt-1 text-mist-400">Gentler: a player who leaves loses just <b className="text-mist-300">one</b> chance rather than all three.</p>
          </div>
          <div className={cn("rounded-xl border p-3 text-xs", !returnChances ? "border-amber-400/40 bg-amber-500/[0.07]" : "border-line bg-ink-900")}>
            <div className="font-semibold text-mist-100">Fixed chances {!returnChances && <span className="text-amber-300">· ACTIVE</span>}</div>
            <p className="mt-1 text-mist-400">A player who leaves forfeits <b className="text-mist-300">all</b> chances. <span className="text-emerald-300">Recommended for tournaments.</span></p>
          </div>
        </div>
        <p className="mt-2 text-[11px] text-mist-500">Either way, when a player leaves the game <b className="text-mist-400">always ends promptly</b> for everyone else — the remaining player wins immediately and a game can never hang. Applies to Ludo and Snake &amp; Ladder; takes effect on the next game.</p>
      </Card>

      {/* PER-GAME settings: Ludo / Chess / Snake & Ladder each independent. */}
      <Card className="p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="min-w-0">
            <h2 className="flex items-center gap-2 font-display text-lg font-bold text-mist-100"><Gamepad2 className="size-5 text-lotus-300" /> Per-game settings — Ludo · Chess · Snake &amp; Ladder</h2>
            <p className="mt-0.5 text-sm text-mist-400">Each game has its <b className="text-mist-200">own independent settings</b>. Pick a game below to open its section. Leave a control on <b className="text-mist-200">Use global</b> to inherit the values above; changing one game never affects another.</p>
          </div>
          <div className="flex gap-1 rounded-lg border border-line bg-ink-900 p-1">
            {(["ludo", "chess", "snake"] as const).map((g) => (
              <button key={g} onClick={() => setPgGame(g)} className={cn("rounded-md px-3 py-1.5 text-xs font-semibold transition", pgGame === g ? "bg-lotus-600/90 text-white" : "text-mist-400 hover:text-mist-100")}>{g === "snake" ? "Snake & Ladder" : g === "chess" ? "Chess" : "Ludo"}</button>
            ))}
          </div>
        </div>
        {(() => {
          const s = perGame[pgGame] ?? {};
          const gName = pgGame === "snake" ? "Snake & Ladder" : pgGame === "chess" ? "Chess" : "Ludo";
          const isChess = pgGame === "chess";
          return (
            <div className="mt-4 rounded-xl border border-lotus-400/25 bg-lotus-500/[0.05] p-4">
              <h3 className="mb-3 font-display text-base font-bold text-lotus-200">{gName} Settings</h3>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <div className="rounded-xl border border-line bg-ink-900/60 p-3">
                  <div className="text-xs font-semibold text-mist-200">Chance-missing timer</div>
                  <div className="mt-1.5 flex items-center gap-2">
                    <select value={s.turnSeconds === undefined ? "" : "custom"} onChange={(e) => setPg("turnSeconds", e.target.value === "" ? undefined : (config.gameTurnSeconds ?? 15))} className="h-8 flex-1 rounded-lg border border-line bg-ink-800 px-2 text-xs text-mist-100 outline-none">
                      <option value="">Use global ({config.gameTurnSeconds ?? 10}s)</option>
                      <option value="custom">Custom…</option>
                    </select>
                    {s.turnSeconds !== undefined && <input type="number" min={5} max={120} value={s.turnSeconds} onChange={(e) => setPg("turnSeconds", Math.max(5, Math.min(120, Math.floor(Number(e.target.value) || 15))))} className="h-8 w-14 rounded-lg border border-line bg-ink-800 px-2 text-xs text-mist-100 outline-none" />}
                  </div>
                </div>
                <div className={cn("rounded-xl border border-line bg-ink-900/60 p-3", isChess && "opacity-60")}>
                  <div className="text-xs font-semibold text-mist-200">Dice animation speed</div>
                  <select value={s.diceSpeed ?? ""} onChange={(e) => setPg("diceSpeed", (e.target.value || undefined) as "slow" | "normal" | "fast" | undefined)} className="mt-1.5 h-8 w-full rounded-lg border border-line bg-ink-800 px-2 text-xs text-mist-100 outline-none" disabled={isChess}>
                    <option value="">Use global ({config.gameDiceSpeed ?? "normal"})</option>
                    <option value="slow">Slow</option><option value="normal">Normal</option><option value="fast">Fast</option>
                  </select>
                  {isChess && <p className="mt-1 text-[10px] text-mist-500">Chess has no dice.</p>}
                </div>
                <div className={cn("rounded-xl border border-line bg-ink-900/60 p-3", isChess && "opacity-60")}>
                  <div className="text-xs font-semibold text-mist-200">Token move speed</div>
                  <select value={s.tokenSpeed ?? ""} onChange={(e) => setPg("tokenSpeed", (e.target.value || undefined) as "slow" | "normal" | "fast" | undefined)} className="mt-1.5 h-8 w-full rounded-lg border border-line bg-ink-800 px-2 text-xs text-mist-100 outline-none" disabled={isChess}>
                    <option value="">Use global ({config.gameTokenSpeed ?? "normal"})</option>
                    <option value="slow">Slow</option><option value="normal">Normal</option><option value="fast">Fast</option>
                  </select>
                  {isChess ? <p className="mt-1 text-[10px] text-mist-500">Chess pieces move instantly.</p> : <p className="mt-1 text-[10px] text-mist-500">How fast the coin glides to its new square.</p>}
                </div>
                <div className={cn("rounded-xl border border-line bg-ink-900/60 p-3", isChess && "opacity-60")}>
                  <div className="text-xs font-semibold text-mist-200">Rejoin chances</div>
                  <select value={s.returnChancesOnRejoin === undefined ? "" : (s.returnChancesOnRejoin ? "on" : "off")} onChange={(e) => setPg("returnChancesOnRejoin", e.target.value === "" ? undefined : e.target.value === "on")} className="mt-1.5 h-8 w-full rounded-lg border border-line bg-ink-800 px-2 text-xs text-mist-100 outline-none" disabled={isChess}>
                    <option value="">Use global</option>
                    <option value="on">Return chances</option>
                    <option value="off">Fixed chances</option>
                  </select>
                  {isChess && <p className="mt-1 text-[10px] text-mist-500">Chess uses its own miss rule.</p>}
                </div>
              </div>
              <Button size="sm" className="mt-3" onClick={() => void savePerGame(perGame)} disabled={savingPg}><Check className="size-4" /> {savingPg ? "Saving…" : `Save ${gName} settings`}</Button>
            </div>
          );
        })()}
      </Card>

      {/* Fair Dice — OPTIONAL pity system. OFF by default: the dice are always a
          perfectly uniform, pure-random 1–6 with no colour/seat advantage. When ON,
          a player who has gone many turns WITHOUT a 6 is gradually helped. */}
      <Card className="p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="flex items-center gap-2 font-display text-lg font-bold text-mist-100"><Dices className="size-5 text-lotus-300" /> Fair Dice system <span className="rounded-full bg-white/[0.06] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-mist-400">Optional</span></h2>
            <p className="mt-0.5 text-sm text-mist-400">
              The dice are <b className="text-mist-200">already 100% pure-random</b> (every value 1–6 equally likely for every colour and seat — verified over millions of rolls). This optional aid only helps a player who has had a genuinely unlucky streak of <b className="text-mist-200">no 6</b>. Leave it OFF to keep classic pure-random dice.
            </p>
          </div>
          <button
            onClick={() => { const v = !fdOn; setFdOn(v); saveFairDice({ enabled: v }); }}
            role="switch" aria-checked={fdOn} disabled={savingFd}
            title={fdOn ? "On — tap to turn OFF (pure random)" : "Off — tap to enable Fair Dice"}
            className={cn("relative mt-1 h-6 w-11 shrink-0 rounded-full transition", fdOn ? "bg-emerald-500" : "bg-mist-600")}
          >
            <span className={cn("absolute top-0.5 size-5 rounded-full bg-white shadow transition-all", fdOn ? "left-[22px]" : "left-0.5")} />
          </button>
        </div>
        <div className={cn("mt-4 grid gap-3 sm:grid-cols-3", !fdOn && "pointer-events-none opacity-45")}>
          <label className="text-xs text-mist-400">
            Help starts after (rolls with no 6)
            <input type="number" min={3} max={40} value={fdThreshold} disabled={!fdOn} onChange={(e) => setFdThreshold(Number(e.target.value) || 0)} className="mt-1 block h-10 w-full rounded-lg border border-line bg-ink-800 px-3 text-sm text-mist-100 outline-none focus:border-lotus-400" />
            <span className="mt-1 block text-[10px] text-mist-500">Recommended 10–15.</span>
          </label>
          <label className="text-xs text-mist-400">
            Extra chance of a 6 (%)
            <input type="number" min={0} max={100} value={fdBoost} disabled={!fdOn} onChange={(e) => setFdBoost(Number(e.target.value) || 0)} className="mt-1 block h-10 w-full rounded-lg border border-line bg-ink-800 px-3 text-sm text-mist-100 outline-none focus:border-lotus-400" />
            <span className="mt-1 block text-[10px] text-mist-500">Chance a roll becomes a 6 once past the streak.</span>
          </label>
          <label className="text-xs text-mist-400">
            Guarantee a 6 after (0 = never)
            <input type="number" min={0} max={60} value={fdGuarantee} disabled={!fdOn} onChange={(e) => setFdGuarantee(Number(e.target.value) || 0)} className="mt-1 block h-10 w-full rounded-lg border border-line bg-ink-800 px-3 text-sm text-mist-100 outline-none focus:border-lotus-400" />
            <span className="mt-1 block text-[10px] text-mist-500">A hard safety net so no one is ever stuck.</span>
          </label>
        </div>
        <div className="mt-3 flex items-center justify-between gap-3">
          <p className="text-[11px] text-mist-500">
            {fdOn
              ? <>ON — after <b className="text-mist-300">{fdThreshold}</b> rolls with no 6, each roll has a <b className="text-mist-300">{fdBoost}%</b> extra chance to be a 6{fdGuarantee > 0 ? <>, and a <b className="text-mist-300">guaranteed 6</b> after {fdGuarantee} rolls</> : ""}. Applies to Ludo only; takes effect next game.</>
              : <>OFF — dice are pure-random. This is the classic, fully fair behaviour.</>}
          </p>
          <Button onClick={() => saveFairDice({})} disabled={savingFd || !fdOn}>{savingFd ? "Saving…" : "Save settings"}</Button>
        </div>
      </Card>

      {/* Dice Log — read-only audit of every recorded roll (Match ID, Player, Turn,
          Value, Timestamp) so fairness can be verified from real games. */}
      <Card className="p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="flex items-center gap-2 font-display text-lg font-bold text-mist-100"><ScrollText className="size-5 text-lotus-300" /> Dice Log</h2>
            <p className="mt-0.5 text-sm text-mist-400">Every recorded dice roll from live and finished matches — Match ID, Player, Turn, Value and Timestamp. Use it to verify the dice are fair.</p>
          </div>
          <Button variant="secondary" onClick={loadDiceLog} disabled={diceLoading}>
            <RefreshCw className={cn("size-4", diceLoading && "animate-spin")} /> {diceRows === null ? "Load dice log" : "Refresh"}
          </Button>
        </div>

        {diceRows !== null && (
          <>
            {/* Distribution summary — how often each value came up across the shown rows. */}
            <div className="mt-4 grid grid-cols-3 gap-2 sm:grid-cols-6">
              {diceSummary.map((s) => (
                <div key={s.value} className="rounded-lg border border-line bg-ink-900 px-3 py-2 text-center">
                  <div className="font-display text-lg font-bold text-mist-100">{s.value}</div>
                  <div className="text-[11px] text-mist-300">{s.pct}%</div>
                  <div className="text-[10px] text-mist-500">{s.count.toLocaleString("en-SA")}×</div>
                </div>
              ))}
            </div>
            <p className="mt-2 text-[11px] text-mist-500">A fair die sits near <b className="text-mist-400">16.67%</b> per value. Showing {diceRows.length.toLocaleString("en-SA")} of {diceTotal.toLocaleString("en-SA")} recorded rolls (newest first).</p>

            <div className="mt-3 max-h-[420px] overflow-auto rounded-xl border border-line">
              <table className="w-full text-left text-xs">
                <thead className="sticky top-0 bg-ink-800 text-mist-400">
                  <tr>
                    <th className="px-3 py-2 font-semibold">Time</th>
                    <th className="px-3 py-2 font-semibold">Match ID</th>
                    <th className="px-3 py-2 font-semibold">Game</th>
                    <th className="px-3 py-2 font-semibold">Player</th>
                    <th className="px-3 py-2 font-semibold">Turn</th>
                    <th className="px-3 py-2 text-center font-semibold">Value</th>
                  </tr>
                </thead>
                <tbody>
                  {diceRows.length === 0 && (
                    <tr><td colSpan={6} className="px-3 py-6 text-center text-mist-500">No dice rolls recorded yet.</td></tr>
                  )}
                  {diceRows.map((r, i) => (
                    <tr key={`${r.matchId}-${r.turn}-${i}`} className="border-t border-white/5">
                      <td className="whitespace-nowrap px-3 py-1.5 text-mist-400">{new Date(r.at).toLocaleString("en-SA")}</td>
                      <td className="whitespace-nowrap px-3 py-1.5 font-mono text-[11px] text-mist-400" title={r.playerId ? `Player ID: ${r.playerId}` : undefined}>{r.matchId}</td>
                      <td className="px-3 py-1.5 capitalize text-mist-300">{r.game}{r.live && <span className="ml-1 rounded bg-emerald-500/15 px-1 text-[9px] font-semibold uppercase text-emerald-300">live</span>}</td>
                      <td className="px-3 py-1.5 text-mist-200">{r.player || "—"}</td>
                      <td className="px-3 py-1.5 text-mist-400">#{r.turn}</td>
                      <td className="px-3 py-1.5 text-center">
                        <span className={cn("inline-block min-w-6 rounded px-1.5 py-0.5 font-bold", r.value === 6 ? "bg-lotus-500/20 text-lotus-200" : "bg-white/[0.06] text-mist-200")}>{r.value}</span>
                        {r.passed && <span className="ml-1 text-[10px] text-mist-500">no move</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </Card>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {games.map((g) => {
          const Icon = gameIcon(g.icon);
          return (
          <Card key={g.id} className={cn("p-5", !g.enabled && "opacity-70")}>
            <div className="flex items-center justify-between">
              <span className="grid size-12 place-items-center rounded-xl bg-lotus-500/12 text-lotus-300">
                <Icon className="size-6" />
              </span>
              <button
                onClick={() => toggle(g)}
                disabled={loading || saving}
                className={cn("relative h-6 w-11 rounded-full transition-colors disabled:opacity-50", g.enabled ? "bg-emerald-500" : "bg-ink-700")}
                aria-label="Toggle game"
              >
                <span className={cn("absolute top-0.5 size-5 rounded-full bg-white transition-all", g.enabled ? "left-[22px]" : "left-0.5")} />
              </button>
            </div>
            <h2 className="mt-4 font-display text-lg font-bold text-mist-100">{g.name}</h2>
            <p className={cn("text-xs font-semibold", !g.enabled ? "text-mist-500" : g.route ? "text-emerald-300" : "text-amber-300")}>
              {!g.enabled ? "Disabled" : g.route ? "Live" : "Coming soon"}
            </p>
            <div className="mt-4 grid grid-cols-2 gap-2 text-sm">
              <div className="rounded-lg bg-white/[0.04] px-3 py-2">
                <div className="font-display text-lg font-bold text-mist-100">{g.players.toLocaleString("en-SA")}</div>
                <div className="text-[11px] text-mist-500">Players</div>
              </div>
              <div className="rounded-lg bg-white/[0.04] px-3 py-2">
                <div className="font-display text-lg font-bold text-mist-100">{g.matchesToday}</div>
                <div className="text-[11px] text-mist-500">Matches today</div>
              </div>
            </div>
            <button
              type="button"
              onClick={() => toggleSpectator(g)}
              className="mt-3 flex w-full items-center gap-2 rounded-lg bg-white/[0.04] px-3 py-2 text-left transition hover:bg-white/[0.07]"
            >
              <Eye className="size-4 text-mist-400" />
              <span className="text-xs font-medium text-mist-200">Spectator mode</span>
              <span
                className={cn(
                  "relative ml-auto h-5 w-9 rounded-full transition-colors",
                  g.spectator !== false ? "bg-emerald-500" : "bg-ink-700",
                )}
              >
                <span className={cn("absolute top-0.5 size-4 rounded-full bg-white transition-all", g.spectator !== false ? "left-[18px]" : "left-0.5")} />
              </span>
            </button>
            <div className="mt-3 flex gap-2">
              <Button size="sm" variant="secondary" block onClick={() => setEditing(g)}>
                <Pencil className="size-3.5" /> Edit
              </Button>
              {!BUILTIN.includes(g.id) && (
                <Button size="sm" variant="danger" onClick={() => setConfirmDel(g)}>
                  <Trash2 className="size-3.5" />
                </Button>
              )}
            </div>
          </Card>
          );
        })}
      </div>

      <p className="text-xs text-mist-500">
        <Gamepad2 className="mr-1 inline size-3.5" />
        Built-in games (Ludo, Chess, Snake &amp; Ladder) are playable now. New games you add appear as “Coming soon”
        until the gameplay is shipped — then they go live for everyone.
      </p>

      {(adding || editing) && (
        <GameModal
          game={editing}
          existingIds={games.map((g) => g.id)}
          onClose={() => {
            setAdding(false);
            setEditing(null);
          }}
          onSave={upsert}
        />
      )}

      {confirmDel && (
        <ConfirmDialog
          danger
          title="Are you sure you want to delete this game?"
          message="This action cannot be undone."
          confirmLabel="Delete"
          cancelLabel="Cancel"
          onConfirm={() => remove(confirmDel)}
          onCancel={() => setConfirmDel(null)}
        />
      )}
    </div>
  );
}

function GameModal({
  game,
  existingIds,
  onClose,
  onSave,
}: {
  game: GameItem | null;
  existingIds: string[];
  onClose: () => void;
  onSave: (g: GameItem) => void;
}) {
  const { toast } = useToast();
  const isEdit = !!game;
  const builtin = !!game && ["ludo", "chess", "snake"].includes(game.id);
  const [name, setName] = useState(game?.name ?? "");
  const [icon, setIcon] = useState(game?.icon ?? "gamepad");
  const [route, setRoute] = useState(game?.route ?? "");
  const [enabled, setEnabled] = useState(game?.enabled ?? true);
  const field = "w-full rounded-lg border border-line bg-ink-900 px-3 py-2 text-sm text-mist-100 outline-none focus:border-lotus-400";

  const submit = () => {
    if (!name.trim()) {
      toast("Please enter a game name", "error");
      return;
    }
    const id = game?.id ?? (name.trim().toLowerCase().replace(/[^a-z0-9]/g, "") || `game${Date.now().toString(36)}`);
    if (!game && existingIds.includes(id)) {
      toast("A game with this name already exists", "error");
      return;
    }
    onSave({
      id,
      name: name.trim(),
      icon: icon || "gamepad",
      route: route.trim(),
      enabled,
      players: game?.players ?? 0,
      matchesToday: game?.matchesToday ?? 0,
      spectator: game?.spectator ?? true,
      coinCost: game?.coinCost ?? 0,
    });
  };

  return (
    <div className="fixed inset-0 z-[70] grid place-items-center bg-black/60 p-4" onClick={onClose}>
      <div className="w-full max-w-sm rounded-2xl border border-white/10 bg-ink-850 p-5" onClick={(e) => e.stopPropagation()}>
        <h2 className="mb-4 font-display text-lg font-bold text-mist-100">{isEdit ? "Edit game" : "Add a new game"}</h2>

        <label className="block text-xs font-semibold text-mist-300">Game name</label>
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Carrom" autoFocus className={cn(field, "mt-1")} />

        <label className="mt-3 block text-xs font-semibold text-mist-300">Icon</label>
        <div className="mt-1 flex flex-wrap gap-1.5">
          {GAME_ICON_KEYS.map((key) => {
            const Ic = gameIcon(key);
            return (
              <button
                key={key}
                onClick={() => setIcon(key)}
                className={cn(
                  "grid size-9 place-items-center rounded-lg border transition",
                  icon === key ? "border-lotus-400 bg-lotus-500/15 text-lotus-200" : "border-line bg-ink-900 text-mist-400 hover:text-mist-100",
                )}
              >
                <Ic className="size-4" />
              </button>
            );
          })}
        </div>

        <label className="mt-3 block text-xs font-semibold text-mist-300">
          Play route <span className="font-normal text-mist-500">(leave blank for “coming soon”)</span>
        </label>
        <input
          value={route}
          onChange={(e) => setRoute(e.target.value)}
          placeholder="/games/carrom"
          disabled={builtin}
          className={cn(field, "mt-1", builtin && "opacity-60")}
        />
        {builtin && <p className="mt-1 text-[11px] text-mist-500">Built-in game — route is fixed.</p>}

        <label className="mt-4 flex items-center gap-2 text-sm text-mist-200">
          <input type="checkbox" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} className="size-4 accent-lotus-500" />
          Enabled (visible to members)
        </label>

        <div className="mt-5 flex gap-2">
          <Button variant="secondary" block onClick={onClose}>Cancel</Button>
          <Button block onClick={submit}>
            <Check className="size-4" /> {isEdit ? "Save" : "Add game"}
          </Button>
        </div>
      </div>
    </div>
  );
}
