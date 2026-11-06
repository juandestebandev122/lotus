"use client";

import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import { useConfig, saveConfig, type AppConfig } from "@/lib/config";
import { cn } from "@/lib/cn";
import {
  Ticket, Plus, Play, Lock, Trash2, X, Loader2, Download, Trophy, Users, Hash,
  Dice5, Pencil, Ban, RotateCcw, Check as CheckIcon, Eye, EyeOff, Clock,
} from "lucide-react";
import { fetchLuckyGames, createLuckyGame, updateLuckyGame, deleteLuckyGame, drawLucky, type LuckyGame } from "@/lib/lucky-number-api";
import { LuckyGameManager } from "@/components/admin/LuckyGameManager";
import { fetchAdminRooms } from "@/lib/admin";

const n = (v: number) => (v ?? 0).toLocaleString("en-SA");
const fmt = (iso?: string) => (iso ? new Date(iso).toLocaleString("en-SA", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) : "—");
// <input type="datetime-local"> <-> ISO helpers
const toLocalInput = (iso?: string) => { if (!iso) return ""; const d = new Date(iso); const p = (x: number) => String(x).padStart(2, "0"); return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`; };
const fromLocalInput = (v: string) => (v ? new Date(v).toISOString() : undefined);

const RANGE_PRESETS = [
  { label: "0–9", min: 0, max: 9 },
  { label: "0–49", min: 0, max: 49 },
  { label: "0–99", min: 0, max: 99 },
];

/** §4 — the run-the-game controls an admin can hand to a Host / Co-Host.
 *  `manualPick` is deliberately OFF by default: letting whoever holds the room
 *  type the winning number is a different level of trust from spinning for it. */
type PermKey = "start" | "round" | "draw" | "manualPick" | "complete" | "joining";
const HOST_PERMS: { key: PermKey; label: string; hint: string; defaultOn: boolean }[] = [
  { key: "start", label: "Start the game", hint: "Begin play once enough players have joined — no admin needed.", defaultOn: true },
  { key: "round", label: "Start & close each round", hint: "Open number selection for a round, and close it early.", defaultOn: true },
  { key: "draw", label: "Spin / shuffle the number", hint: "Run the random draw that picks the lucky number.", defaultOn: true },
  { key: "manualPick", label: "Choose the number manually", hint: "Type the winning number instead of spinning for it. Off by default.", defaultOn: false },
  { key: "complete", label: "Complete a round", hint: "Finish a round and move on to the next one, or end the game.", defaultOn: true },
  { key: "joining", label: "Open & close joining", hint: "Let latecomers in, or close the doors before starting.", defaultOn: true },
];

const STATUS_STYLE: Record<string, string> = {
  scheduled: "bg-amber-500/15 text-amber-300",
  open: "bg-emerald-500/15 text-emerald-300",
  closed: "bg-sky-500/15 text-sky-300",
  drawn: "bg-lotus-500/20 text-lotus-200",
  cancelled: "bg-rose-500/15 text-rose-300",
};

interface Draft {
  name: string; presetMin: number; presetMax: number; minNumber: number; maxNumber: number;
  drawMethod: "auto" | "manual"; manualNumber: string;
  startAt: string; endAt: string; drawAt: string;
  entryFee: number; maxPicksPerUser: number; allowEditPick: boolean;
  prize: number; splitPrize: boolean; prizeDetail: string;
  roomId: string; roomName: string; status: "scheduled" | "open";
}
const emptyDraft = (): Draft => ({
  name: "", presetMin: 0, presetMax: 99, minNumber: 0, maxNumber: 99,
  drawMethod: "auto", manualNumber: "", startAt: "", endAt: "", drawAt: "",
  entryFee: 0, maxPicksPerUser: 1, allowEditPick: true,
  prize: 0, splitPrize: false, prizeDetail: "", roomId: "", roomName: "", status: "open",
});

export default function AdminLuckyNumberPage() {
  const { config, reload } = useConfig();
  const { toast } = useToast();
  const [games, setGames] = useState<LuckyGame[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [draft, setDraft] = useState<Draft>(emptyDraft());
  const [showForm, setShowForm] = useState(false);
  const [savingFeature, setSavingFeature] = useState(false);

  const featureOn = config.features?.luckyNumber !== false;
  // Groups an admin can tie a multi-round game to (§6 — members only can play).
  const [adminRooms, setAdminRooms] = useState<{ id: string; name: string }[]>([]);
  useEffect(() => { void fetchAdminRooms().then((rs) => setAdminRooms(rs.map((r) => ({ id: r.id, name: r.name })))); }, []);

  const load = useCallback(async () => { setGames(await fetchLuckyGames()); setLoading(false); }, []);
  useEffect(() => { void load(); }, [load]);

  const toggleFeature = async () => {
    setSavingFeature(true);
    const feats = { ...(config.features ?? {}), luckyNumber: !featureOn };
    const res = await saveConfig({ features: feats as AppConfig["features"] });
    setSavingFeature(false);
    if (res.ok) { await reload(); toast(`Lucky Number game ${!featureOn ? "enabled" : "disabled"} — live now.`, "success"); }
    else toast(res.error ?? "Could not save", "error");
  };

  // Host / Co-Host permissions. Every value is sent explicitly on save — the
  // config API reads a MISSING key as "leave unchanged", so a partial patch
  // would silently do nothing.
  const [savingPerms, setSavingPerms] = useState(false);
  const permOn = (k: PermKey) => {
    const cur = (config.luckyNumber ?? {}) as Partial<Record<PermKey, boolean>>;
    const def = HOST_PERMS.find((p) => p.key === k)?.defaultOn ?? false;
    return cur[k] ?? def;
  };
  const savePerms = async (next: Record<PermKey, boolean>, label: string) => {
    setSavingPerms(true);
    const res = await saveConfig({ luckyNumber: next as AppConfig["luckyNumber"] });
    setSavingPerms(false);
    if (res.ok) { await reload(); toast(label, "success"); }
    else toast(res.error ?? "Could not save", "error");
  };
  const currentPerms = (): Record<PermKey, boolean> =>
    HOST_PERMS.reduce((acc, p) => { acc[p.key] = permOn(p.key); return acc; }, {} as Record<PermKey, boolean>);
  const setPerm = (k: PermKey, on: boolean) => {
    const label = HOST_PERMS.find((p) => p.key === k)?.label ?? k;
    return savePerms({ ...currentPerms(), [k]: on }, `Host & Co-Host ${on ? "can now" : "can no longer"} ${label.toLowerCase()}`);
  };
  const resetPerms = () =>
    savePerms(
      HOST_PERMS.reduce((acc, p) => { acc[p.key] = p.defaultOn; return acc; }, {} as Record<PermKey, boolean>),
      "Host & Co-Host permissions reset to default",
    );

  const create = async () => {
    if (!draft.name.trim()) { toast("Give the game a name", "error"); return; }
    if (draft.maxNumber < draft.minNumber) { toast("Max number must be ≥ min number", "error"); return; }
    if (draft.drawMethod === "manual" && draft.manualNumber === "") { toast("Enter the winning number for manual mode", "error"); return; }
    setCreating(true);
    const res = await createLuckyGame({
      name: draft.name.trim(),
      minNumber: draft.minNumber, maxNumber: draft.maxNumber,
      drawMethod: draft.drawMethod,
      manualNumber: draft.drawMethod === "manual" && draft.manualNumber !== "" ? Number(draft.manualNumber) : undefined,
      startAt: fromLocalInput(draft.startAt), endAt: fromLocalInput(draft.endAt), drawAt: fromLocalInput(draft.drawAt),
      entryFee: draft.entryFee, maxPicksPerUser: draft.maxPicksPerUser, allowEditPick: draft.allowEditPick,
      prize: draft.prize, splitPrize: draft.splitPrize, prizeDetail: draft.prizeDetail.trim() || undefined,
      roomId: draft.roomId.trim() || undefined, roomName: draft.roomName.trim() || undefined,
      status: draft.status,
    });
    setCreating(false);
    if (res.ok) { toast("Lucky Number game created", "success"); setDraft(emptyDraft()); setShowForm(false); await load(); }
    else toast(res.error ?? "Could not create the game", "error");
  };

  const act = async (id: string, patch: Record<string, unknown>, label: string) => {
    setBusy(id); const res = await updateLuckyGame(id, patch); setBusy(null);
    if (res.ok) { toast(label, "success"); await load(); } else toast(res.error ?? "Failed", "error");
  };
  const runDraw = async (g: LuckyGame) => {
    if (!window.confirm(`Run the draw for “${g.name}” now? The winning number will be revealed and prizes paid. This can't be undone.`)) return;
    setBusy(g.id); const res = await drawLucky(g.id); setBusy(null);
    if (res.ok) { toast(`Winning number: ${res.winningNumber} · ${res.winnerCount} winner(s)`, "success"); await load(); }
    else toast(res.error ?? "Could not run the draw", "error");
  };
  const setManual = async (g: LuckyGame) => {
    const raw = window.prompt(`Set / change the winning number for “${g.name}” (${g.minNumber}–${g.maxNumber}). This is private to admins.`, g.manualNumber != null ? String(g.manualNumber) : "");
    if (raw === null) return;
    const num = Number(raw);
    if (!Number.isFinite(num) || num < g.minNumber || num > g.maxNumber) { toast(`Enter a number between ${g.minNumber} and ${g.maxNumber}`, "error"); return; }
    await act(g.id, { drawMethod: "manual", manualNumber: num }, "Winning number set (manual)");
  };
  const remove = async (g: LuckyGame) => {
    if (!window.confirm(`Delete “${g.name}”? Any held coins are refunded. This can't be undone.`)) return;
    setBusy(g.id); const res = await deleteLuckyGame(g.id); setBusy(null);
    if (res.ok) { toast("Game deleted", "success"); await load(); } else toast(res.error ?? "Failed", "error");
  };
  const cancel = async (g: LuckyGame) => {
    const reason = window.prompt(`Cancel “${g.name}”? Held coins are refunded. Optional reason:`, "");
    if (reason === null) return;
    await act(g.id, { status: "cancelled", cancelledReason: reason }, "Game cancelled");
  };

  // Reports
  const report = useMemo(() => {
    const participants = new Set<string>();
    let entries = 0, winners = 0;
    for (const g of games) { g.entries?.forEach((e) => participants.add(e.userId)); entries += g.entriesCount; winners += g.winners?.length ?? 0; }
    return { games: games.length, active: games.filter((g) => g.status === "open" || g.status === "scheduled").length, participants: participants.size, entries, winners, drawn: games.filter((g) => g.status === "drawn").length };
  }, [games]);

  const exportCsv = () => {
    const head = ["Game", "Status", "Range", "WinningNumber", "Participants", "Entries", "Winners", "Prize", "DrawnAt", "DrawnBy"];
    const rows = games.map((g) => [g.name, g.status, `${g.minNumber}-${g.maxNumber}`, g.winningNumber ?? "", g.participantsCount, g.entriesCount, g.winners?.length ?? "", g.prize, fmt(g.drawnAt), g.drawnBy ?? ""]);
    const csv = [head, ...rows].map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
    const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" })); a.download = "lucky-number-report.csv"; a.click();
  };
  const exportEntriesCsv = (g: LuckyGame) => {
    const head = ["Member", "UserID", "Numbers", "SubmittedAt", "FeePaid", "Won"];
    const rows = (g.entries ?? []).map((e) => [e.name, e.publicId ?? e.userId, e.numbers.join(" "), fmt(e.at), e.feeCharged ?? 0, g.winningNumber != null && e.numbers.includes(g.winningNumber) ? "YES" : ""]);
    const csv = [head, ...rows].map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
    const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" })); a.download = `lucky-${g.name.replace(/\W+/g, "-")}-entries.csv`; a.click();
  };

  const setPreset = (min: number, max: number) => setDraft((d) => ({ ...d, presetMin: min, presetMax: max, minNumber: min, maxNumber: max }));

  return (
    <div className="mx-auto max-w-5xl space-y-5 pb-24">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 font-display text-2xl font-extrabold text-mist-100"><Ticket className="size-6 text-lotus-300" /> Lucky Number Game</h1>
          <p className="mt-1 text-sm text-mist-400">Create number-draw events, control the range &amp; winning number, and run the draw. The draw method (manual/automatic) and any pre-set number are <b className="text-mist-200">visible only to admins</b> — never to users, hosts or co-hosts.</p>
        </div>
        <button onClick={toggleFeature} disabled={savingFeature} className={cn("inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-semibold transition", featureOn ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-300" : "border-line bg-ink-900 text-mist-400")}>
          {savingFeature ? <Loader2 className="size-4 animate-spin" /> : featureOn ? <Eye className="size-4" /> : <EyeOff className="size-4" />}
          {featureOn ? "Game is ON" : "Game is OFF"}
        </button>
      </div>

      {/* ── WHO MAY RUN A GAME ───────────────────────────────────────────
          The game must not stall waiting for an admin. These switches decide
          exactly how much of it the room's Host and Co-Host can run themselves;
          an Admin always keeps every control regardless of what is set here. */}
      <Card className="p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="flex items-center gap-2 font-display text-lg font-bold text-mist-100"><Users className="size-5 text-lotus-300" /> Host &amp; Co-Host permissions</h2>
            <p className="mt-1 text-sm text-mist-400">
              What the room Host and Co-Host may do inside a multi-round game, without an admin present.
              These controls appear on their game screen. <b className="text-mist-200">Admins always have all of them.</b>
            </p>
          </div>
          <Button size="sm" variant="secondary" disabled={savingPerms} onClick={() => void resetPerms()}>
            <RotateCcw className="mr-1.5 size-4" /> Reset to default
          </Button>
        </div>

        <div className="mt-4 grid gap-2 sm:grid-cols-2">
          {HOST_PERMS.map((p) => {
            const on = permOn(p.key);
            return (
              <button
                key={p.key}
                disabled={savingPerms}
                onClick={() => void setPerm(p.key, !on)}
                className={cn(
                  "flex items-start gap-3 rounded-xl border p-3 text-left transition disabled:opacity-60",
                  on ? "border-emerald-500/40 bg-emerald-500/[0.07]" : "border-line bg-ink-900",
                )}
              >
                <span className={cn("mt-0.5 grid size-5 shrink-0 place-items-center rounded-md border", on ? "border-emerald-400 bg-emerald-500/25 text-emerald-200" : "border-line text-transparent")}>
                  <CheckIcon className="size-3.5" />
                </span>
                <span className="min-w-0">
                  <span className="block text-sm font-semibold text-mist-100">{p.label}</span>
                  <span className="block text-xs text-mist-400">{p.hint}</span>
                </span>
              </button>
            );
          })}
        </div>
      </Card>

      {/* ── MULTI-ROUND GAMES (the client's Lucky Number specification) ──────
          Rounds, group-gated players, host/co-host, atomic number reservation,
          manual/auto draw and the audit log. The single-draw events below are
          unchanged and keep working alongside these. */}
      <LuckyGameManager rooms={adminRooms} />

      <div className="border-t border-line pt-4">
        <h2 className="font-display text-lg font-bold text-mist-100">Single draw events</h2>
        <p className="text-xs text-mist-400">The simple one-off draws — pick a number, one draw, one winner.</p>
      </div>

      {/* Reports */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <Tile icon={Ticket} label="Total games" value={n(report.games)} accent />
        <Tile icon={Clock} label="Active / scheduled" value={n(report.active)} />
        <Tile icon={Users} label="Participants" value={n(report.participants)} />
        <Tile icon={Hash} label="Total entries" value={n(report.entries)} />
        <Tile icon={Dice5} label="Draws done" value={n(report.drawn)} />
        <Tile icon={Trophy} label="Total winners" value={n(report.winners)} />
      </div>
      <div className="flex flex-wrap gap-2">
        <Button onClick={() => setShowForm((v) => !v)}><Plus className="size-4" /> New game</Button>
        <Button variant="secondary" onClick={exportCsv}><Download className="size-4" /> Export report (CSV)</Button>
      </div>

      {/* Create form */}
      {showForm && (
        <Card className="space-y-4 p-4 sm:p-5">
          <div className="flex items-center justify-between"><h2 className="font-display text-lg font-bold text-mist-100">Create a Lucky Number game</h2><button onClick={() => setShowForm(false)} className="text-mist-500 hover:text-mist-200"><X className="size-5" /></button></div>

          <Field label="Game name"><input value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} placeholder="e.g. Friday Mega Draw" className={inputCls} /></Field>

          <div>
            <div className="mb-1.5 text-xs font-semibold text-mist-300">Number range</div>
            <div className="flex flex-wrap items-center gap-2">
              {RANGE_PRESETS.map((p) => (
                <button key={p.label} onClick={() => setPreset(p.min, p.max)} className={cn("rounded-lg border px-3 py-1.5 text-sm font-semibold transition", draft.minNumber === p.min && draft.maxNumber === p.max ? "border-lotus-400/50 bg-lotus-500/15 text-lotus-200" : "border-line bg-ink-900 text-mist-400 hover:text-mist-100")}>{p.label}</button>
              ))}
              <div className="flex items-center gap-1.5 rounded-lg border border-line bg-ink-900 px-2 py-1">
                <span className="text-[11px] text-mist-500">Custom</span>
                <input type="number" value={draft.minNumber} onChange={(e) => setDraft({ ...draft, minNumber: Math.floor(Number(e.target.value) || 0) })} className="w-16 bg-transparent text-sm text-mist-100 outline-none" />
                <span className="text-mist-500">–</span>
                <input type="number" value={draft.maxNumber} onChange={(e) => setDraft({ ...draft, maxNumber: Math.floor(Number(e.target.value) || 0) })} className="w-16 bg-transparent text-sm text-mist-100 outline-none" />
              </div>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <div className="mb-1.5 text-xs font-semibold text-mist-300">Draw method <span className="text-mist-500">(hidden from users)</span></div>
              <div className="flex gap-2">
                {(["auto", "manual"] as const).map((m) => (
                  <button key={m} onClick={() => setDraft({ ...draft, drawMethod: m })} className={cn("flex-1 rounded-lg border px-3 py-2 text-sm font-semibold capitalize transition", draft.drawMethod === m ? "border-lotus-400/50 bg-lotus-500/15 text-lotus-200" : "border-line bg-ink-900 text-mist-400 hover:text-mist-100")}>{m === "auto" ? "Automatic (random)" : "Manual"}</button>
                ))}
              </div>
            </div>
            {draft.drawMethod === "manual" && (
              <Field label={`Winning number (${draft.minNumber}–${draft.maxNumber}) — private`}><input type="number" value={draft.manualNumber} onChange={(e) => setDraft({ ...draft, manualNumber: e.target.value })} placeholder="e.g. 7" className={inputCls} /></Field>
            )}
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <Field label="Entry opens"><input type="datetime-local" value={draft.startAt} onChange={(e) => setDraft({ ...draft, startAt: e.target.value })} className={inputCls} /></Field>
            <Field label="Entry closes"><input type="datetime-local" value={draft.endAt} onChange={(e) => setDraft({ ...draft, endAt: e.target.value })} className={inputCls} /></Field>
            <Field label="Draw time"><input type="datetime-local" value={draft.drawAt} onChange={(e) => setDraft({ ...draft, drawAt: e.target.value })} className={inputCls} /></Field>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <Field label="Coins to join (0 = free)"><input type="number" value={draft.entryFee} onChange={(e) => setDraft({ ...draft, entryFee: Math.max(0, Math.floor(Number(e.target.value) || 0)) })} className={inputCls} /></Field>
            <Field label="Numbers per user"><input type="number" value={draft.maxPicksPerUser} onChange={(e) => setDraft({ ...draft, maxPicksPerUser: Math.max(1, Math.floor(Number(e.target.value) || 1)) })} className={inputCls} /></Field>
            <Field label="Prize (per winner)"><input type="number" value={draft.prize} onChange={(e) => setDraft({ ...draft, prize: Math.max(0, Math.floor(Number(e.target.value) || 0)) })} className={inputCls} /></Field>
          </div>

          <Field label="Prize details (optional)"><input value={draft.prizeDetail} onChange={(e) => setDraft({ ...draft, prizeDetail: e.target.value })} placeholder="e.g. 500 coins + a badge" className={inputCls} /></Field>

          {/* LINK A VOICE ROOM — pick from the real room list. It used to be two
              free-text boxes, so the admin had to know a room's id by heart and a
              typo silently linked the game to nothing. */}
          <Field label="Link a voice room (optional — lets its host/co-host draw)">
            <div className="grid gap-2 sm:grid-cols-[1fr_auto]">
              <select
                value={draft.roomId}
                onChange={(e) => {
                  const id = e.target.value;
                  const r = adminRooms.find((x) => x.id === id);
                  setDraft({ ...draft, roomId: id, roomName: r?.name ?? "" });
                }}
                className={inputCls}
              >
                <option value="">— No room (admin draws) —</option>
                {adminRooms.map((r) => (
                  <option key={r.id} value={r.id}>{r.name} · {r.id}</option>
                ))}
              </select>
              {draft.roomId && (
                <button
                  type="button"
                  onClick={() => setDraft({ ...draft, roomId: "", roomName: "" })}
                  className="rounded-lg border border-line bg-ink-900 px-3 py-2 text-xs font-semibold text-mist-300 hover:text-mist-100"
                >
                  Clear
                </button>
              )}
            </div>
            <p className="mt-1 text-[11px] text-mist-500">
              {adminRooms.length
                ? `${adminRooms.length} room${adminRooms.length === 1 ? "" : "s"} available. Linking one lets its host and co-hosts run the draw.`
                : "No voice rooms exist yet — create one first, or leave this empty and draw from the admin panel."}
            </p>
          </Field>

          <div className="flex flex-wrap items-center gap-4">
            <Check label="Allow users to edit their pick before close" on={draft.allowEditPick} onToggle={() => setDraft({ ...draft, allowEditPick: !draft.allowEditPick })} />
            <Check label="Split the prize between multiple winners" on={draft.splitPrize} onToggle={() => setDraft({ ...draft, splitPrize: !draft.splitPrize })} />
            <Check label="Open for entries now" on={draft.status === "open"} onToggle={() => setDraft({ ...draft, status: draft.status === "open" ? "scheduled" : "open" })} />
          </div>

          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setShowForm(false)}>Cancel</Button>
            <Button onClick={create} disabled={creating}>{creating ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />} Create game</Button>
          </div>
        </Card>
      )}

      {/* Games list */}
      {loading ? <div className="grid h-24 place-items-center text-mist-500"><Loader2 className="size-5 animate-spin" /></div> :
        games.length === 0 ? <Card className="p-8 text-center text-sm text-mist-400">No Lucky Number games yet. Create your first one above.</Card> :
        games.map((g) => (
          <Card key={g.id} className="space-y-3 p-4 sm:p-5">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="font-display text-lg font-bold text-mist-100">{g.name}</h3>
                  <span className={cn("rounded-full px-2 py-0.5 text-[11px] font-bold uppercase", STATUS_STYLE[g.status])}>{g.status}</span>
                  {!g.enabled && <span className="rounded-full bg-white/[0.06] px-2 py-0.5 text-[10px] text-mist-400">disabled</span>}
                </div>
                <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-[11px] text-mist-500">
                  <span>Range {g.minNumber}–{g.maxNumber}</span>
                  <span>Method: <b className={g.drawMethod === "manual" ? "text-amber-300" : "text-mist-300"}>{g.drawMethod === "manual" ? "Manual" : "Automatic"}</b> (admin-only)</span>
                  {g.drawMethod === "manual" && <span>Pre-set: <b className="text-amber-300">{g.manualNumber ?? "—"}</b></span>}
                  <span>Join {g.entryFee || "free"}</span>
                  <span>Prize {n(g.prize)}{g.splitPrize ? " (split)" : ""}</span>
                  <span>{g.maxPicksPerUser} pick{g.maxPicksPerUser > 1 ? "s" : ""}/user</span>
                  {g.roomName && <span>Room: {g.roomName}</span>}
                </div>
                <div className="mt-1 flex flex-wrap gap-x-3 text-[11px] text-mist-500">
                  {g.startAt && <span>Opens {fmt(g.startAt)}</span>}
                  {g.endAt && <span>Closes {fmt(g.endAt)}</span>}
                  {g.drawAt && <span>Draw {fmt(g.drawAt)}</span>}
                  <span>{g.participantsCount} players · {g.entriesCount} entries</span>
                </div>
              </div>
              <div className="text-right">
                {g.status === "drawn" && g.winningNumber != null && (
                  <div className="rounded-xl border border-lotus-400/40 bg-lotus-500/10 px-4 py-2">
                    <div className="text-[10px] uppercase text-lotus-300/80">Winning number</div>
                    <div className="font-display text-3xl font-extrabold text-lotus-200">{g.winningNumber}</div>
                    <div className="text-[10px] text-mist-500">drawn {fmt(g.drawnAt)}{g.drawnBy ? ` · by ${g.drawnBy}` : ""}</div>
                  </div>
                )}
              </div>
            </div>

            {/* Winners */}
            {g.status === "drawn" && (
              <div className="rounded-xl border border-line bg-ink-900/50 p-3">
                <div className="mb-1.5 flex items-center gap-1.5 text-sm font-bold text-mist-100"><Trophy className="size-4 text-gold-300" /> Winners ({g.winners?.length ?? 0})</div>
                {(g.winners?.length ?? 0) === 0 ? <p className="text-[12px] text-mist-500">No entry matched {g.winningNumber} — no winner this round.</p> : (
                  <div className="flex flex-wrap gap-2">
                    {g.winners!.map((w) => (
                      <span key={w.userId} className="inline-flex items-center gap-1.5 rounded-full bg-white/[0.05] px-2.5 py-1 text-[12px] text-mist-200"><Trophy className="size-3 text-gold-300" /> {w.name} <span className="text-mist-500">{w.publicId}</span> {w.prize > 0 && <span className="text-emerald-300">+{n(w.prize)}</span>}</span>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Number tally + entries (admin) */}
            {(g.numberTally?.length ?? 0) > 0 && (
              <details className="rounded-xl border border-line bg-ink-900/40 p-3">
                <summary className="cursor-pointer text-sm font-semibold text-mist-200">Entries &amp; number tally ({g.entriesCount})</summary>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {g.numberTally!.map((t) => (
                    <span key={t.number} className={cn("rounded-md px-2 py-1 text-[11px] tabular-nums", g.winningNumber === t.number ? "bg-lotus-500/25 text-lotus-100" : "bg-white/[0.05] text-mist-300")}>{t.number}<span className="text-mist-500"> ×{t.count}</span></span>
                  ))}
                </div>
                {(g.entries?.length ?? 0) > 0 && (
                  <div className="mt-3 -mx-3 overflow-x-auto">
                    <table className="w-full min-w-[520px] text-sm">
                      <thead><tr className="border-b border-line text-left text-[11px] uppercase text-mist-500"><th className="px-3 py-1.5">Member</th><th className="px-3 py-1.5">Numbers</th><th className="px-3 py-1.5">When</th><th className="px-3 py-1.5">Fee</th></tr></thead>
                      <tbody>
                        {g.entries!.slice(0, 400).map((e) => (
                          <tr key={e.userId} className="border-b border-line/50">
                            <td className="px-3 py-1.5 text-mist-200">{e.name} <span className="text-[10px] text-mist-500">{e.publicId}</span></td>
                            <td className="px-3 py-1.5"><span className="flex flex-wrap gap-1">{e.numbers.map((num) => <span key={num} className={cn("rounded px-1.5 py-0.5 text-[11px] tabular-nums", g.winningNumber === num ? "bg-lotus-500/25 text-lotus-100" : "bg-white/[0.06] text-mist-300")}>{num}</span>)}</span></td>
                            <td className="px-3 py-1.5 text-[11px] text-mist-500">{fmt(e.at)}</td>
                            <td className="px-3 py-1.5 tabular-nums text-mist-400">{e.feeCharged || "—"}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
                <button onClick={() => exportEntriesCsv(g)} className="mt-2 inline-flex items-center gap-1 text-[11px] font-semibold text-lotus-300 hover:text-lotus-200"><Download className="size-3" /> Export entries CSV</button>
              </details>
            )}

            {/* Actions */}
            <div className="flex flex-wrap items-center gap-1.5 border-t border-line/60 pt-3">
              {g.status !== "drawn" && g.status !== "cancelled" && (
                <>
                  {g.status !== "open" && <Button size="sm" variant="secondary" onClick={() => act(g.id, { status: "open" }, "Entries opened")} disabled={busy === g.id}><Play className="size-3.5" /> Open</Button>}
                  {g.status === "open" && <Button size="sm" variant="ghost" onClick={() => act(g.id, { status: "closed" }, "Entries closed")} disabled={busy === g.id}><Lock className="size-3.5" /> Close entries</Button>}
                  <Button size="sm" variant="secondary" onClick={() => setManual(g)} disabled={busy === g.id}><Pencil className="size-3.5" /> Set winning number</Button>
                  <Button size="sm" onClick={() => runDraw(g)} disabled={busy === g.id}>{busy === g.id ? <Loader2 className="size-3.5 animate-spin" /> : <Dice5 className="size-3.5" />} Run draw</Button>
                  <Button size="sm" variant="ghost" onClick={() => cancel(g)} disabled={busy === g.id}><Ban className="size-3.5" /> Cancel</Button>
                  <Button size="sm" variant="ghost" onClick={() => act(g.id, { enabled: !g.enabled }, g.enabled ? "Game disabled" : "Game enabled")} disabled={busy === g.id}>{g.enabled ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />} {g.enabled ? "Disable" : "Enable"}</Button>
                </>
              )}
              {(g.status === "drawn" || g.status === "cancelled") && (
                <Button size="sm" variant="secondary" onClick={() => act(g.id, { status: "open" }, "Game reopened")} disabled={busy === g.id}><RotateCcw className="size-3.5" /> Reopen</Button>
              )}
              <Button size="sm" variant="ghost" onClick={() => remove(g)} disabled={busy === g.id}><Trash2 className="size-3.5" /> Delete</Button>
            </div>
            {g.cancelledReason && <p className="text-[11px] text-rose-300/80">Cancelled: {g.cancelledReason}</p>}
          </Card>
        ))}
    </div>
  );
}

const inputCls = "h-10 w-full rounded-lg border border-line bg-ink-800 px-3 text-sm text-mist-100 outline-none placeholder:text-mist-500 focus:border-lotus-400/50";

function Field({ label, children }: { label: string; children: ReactNode }) {
  return <label className="block"><span className="mb-1 block text-xs font-semibold text-mist-300">{label}</span>{children}</label>;
}
function Check({ label, on, onToggle }: { label: string; on: boolean; onToggle: () => void }) {
  return (
    <button onClick={onToggle} className="inline-flex items-center gap-2 text-sm text-mist-300">
      <span className={cn("grid size-5 place-items-center rounded border transition", on ? "border-lotus-400 bg-lotus-500/80 text-white" : "border-line bg-ink-900")}>{on && <CheckIcon className="size-3" />}</span>
      {label}
    </button>
  );
}
function Tile({ icon: Icon, label, value, accent }: { icon: typeof Ticket; label: string; value: string; accent?: boolean }) {
  return (
    <div className={cn("rounded-xl border p-3", accent ? "border-lotus-400/40 bg-lotus-500/[0.08]" : "border-line bg-ink-900")}>
      <Icon className={cn("size-4", accent ? "text-lotus-300" : "text-mist-400")} />
      <div className={cn("mt-1.5 font-display text-lg font-extrabold tabular-nums", accent ? "text-lotus-200" : "text-mist-100")}>{value}</div>
      <div className="text-[10px] leading-tight text-mist-500">{label}</div>
    </div>
  );
}
