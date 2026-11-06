"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import { cn } from "@/lib/cn";
import { useConfig } from "@/lib/config";
import { lbl } from "@/lib/labels";
import {
  fetchCompetition, registerForCompetition, markSinger, giftSinger, competitionAction,
  assignCompetitionStaff, removeCompetitionStaff, editCompetition, searchUsersForStaff,
  manageCompetitionRound, moderateCompetition, adjustCompetitionScore,
  type CompetitionView, type CompetitionPrize, type CompModEvent,
} from "@/lib/competitions";
import { COMPETITION_PERMISSIONS, STAFF_ROLE_LABEL, defaultPermsForRole, type CompetitionStaffRole } from "@/lib/competition-perms";
import {
  Swords, Trophy, Gift, Radio, Crown, Mic, Play, SkipForward, Square, RotateCcw, Pause,
  Check, X, Clock, Users, Eye, EyeOff, Settings2, ListOrdered, Medal, Loader2, Shield, Gavel, UserCog, Search, Coins, Pencil,
  Layers, Plus, Trash2, Flag, Ban, AlertTriangle, ScrollText, Lock,
} from "lucide-react";

const GIFT_AMOUNTS = [10, 50, 100, 500];

function Report({ icon: Icon, label, value }: { icon: typeof Users; label: string; value: number }) {
  return (
    <div className="rounded-lg bg-black/20 px-1 py-2">
      <Icon className="mx-auto size-3.5 text-lotus-300" />
      <div className="font-display text-sm font-bold text-mist-100">{value}</div>
      <div className="text-[9px] text-mist-500">{label}</div>
    </div>
  );
}

function VStat({ label, value, suffix, tone }: { label: string; value: number; suffix?: string; tone?: string }) {
  return (
    <div className="rounded-lg bg-black/20 px-1 py-1.5">
      <div className={cn("font-display text-sm font-bold", tone ?? "text-mist-100")}>{value}{suffix ?? ""}</div>
      <div className="text-[9px] leading-tight text-mist-500">{label}</div>
    </div>
  );
}

/**
 * The full Singing-Competition layer shown inside a Competition Voice Room.
 * Self-fetching; renders NOTHING when the room has no competition, so it never
 * affects normal rooms. Role-aware: audience can't see live scores until results.
 */
export function CompetitionPanel({ roomId, myId }: { roomId: string; myId?: string }) {
  const { toast } = useToast();
  const [c, setC] = useState<CompetitionView | null>(null);
  const [busy, setBusy] = useState("");
  const [showCtrl, setShowCtrl] = useState(false);
  const [confirmNext, setConfirmNext] = useState(false);
  const [now, setNow] = useState(0);

  const load = useCallback(() => fetchCompetition(roomId).then(setC), [roomId]);
  useEffect(() => {
    load();
    const t = setInterval(() => { if (typeof document === "undefined" || !document.hidden) load(); }, 4000);
    const tick = setInterval(() => setNow((n) => n + 1), 1000);
    return () => { clearInterval(t); clearInterval(tick); };
  }, [load]);
  void now; // `now` ticks once a second purely to refresh the countdown timer

  if (!c) return null;

  const run = async (fn: () => Promise<{ ok: boolean; error?: string }>, key: string, okMsg?: string) => {
    setBusy(key);
    const res = await fn();
    setBusy("");
    if (res.ok) { if (okMsg) toast(okMsg, "success"); load(); } else toast(res.error ?? "Action failed", "error");
  };
  const act = (action: string, targetId?: string, value?: number, okMsg?: string) => run(() => competitionAction(roomId, action, targetId, value), action + (targetId ?? ""), okMsg);
  // Granular permission check — "*" = full control (admin / host / room co-admin).
  const can = (perm: string) => c.myPerms.includes("*") || c.myPerms.includes(perm);
  const isAdmin = c.role === "admin";
  const roleBadge: Record<string, { label: string; tone: string; icon: typeof Shield }> = {
    host: { label: "Host", tone: "bg-gold-500/15 text-gold-300", icon: Crown },
    cohost: { label: "Co-Host", tone: "bg-lotus-500/15 text-lotus-300", icon: Shield },
    moderator: { label: "Moderator", tone: "bg-sky-500/15 text-sky-300", icon: UserCog },
    judge: { label: "Judge", tone: "bg-emerald-500/15 text-emerald-300", icon: Gavel },
  };

  const current = c.participants.find((p) => p.isCurrent);
  // Countdown honours Pause (time frozen at what's left) and Resume (continues) via the
  // server-tracked turnPausedElapsedSec; Restart resets it. Paused → frozen remaining.
  const secsLeft = current && c.status === "live" && c.turnStartedAt
    ? Math.max(0, c.performanceSeconds - (c.turnPausedElapsedSec ?? 0) - Math.floor((Date.now() - new Date(c.turnStartedAt).getTime()) / 1000))
    : current && c.status === "paused"
    ? Math.max(0, c.performanceSeconds - (c.turnPausedElapsedSec ?? 0))
    : null;
  const iAmCurrent = current?.userId === myId;
  const canMark = c.votingEnabled && c.status === "live" && current && !iAmCurrent && current.myMark === undefined;

  const STATUS: Record<string, { label: string; tone: string }> = {
    setup: { label: c.registrationOpen ? "Registration OPEN" : "Registration closed", tone: "bg-amber-500/15 text-amber-300" },
    live: { label: "LIVE", tone: "bg-rose-500/20 text-rose-300" },
    paused: { label: "Paused", tone: "bg-amber-500/15 text-amber-300" },
    ended: { label: "Ended — awaiting results", tone: "bg-white/[0.08] text-mist-300" },
    results: { label: "Results published", tone: "bg-emerald-500/15 text-emerald-300" },
  };
  const st = STATUS[c.status];

  return (
    <div className="order-2 mt-3 rounded-2xl border border-lotus-400/30 bg-lotus-500/[0.07] p-4">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 font-display text-base font-extrabold text-mist-100"><Swords className="size-5 text-lotus-300" /> {c.title}</h2>
        <span className={cn("inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-bold", st.tone)}>
          {c.status === "live" && <Radio className="size-3" />} {st.label}
        </span>
      </div>
      <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs">
        {c.prize && <span className="inline-flex items-center gap-1 text-gold-300"><Gift className="size-3.5" /> {c.prize}</span>}
        {c.winnerPrizeCoins > 0 && <span className="inline-flex items-center gap-1 text-gold-300"><Trophy className="size-3.5" /> Winner: {c.winnerPrizeCoins}🪙</span>}
        {c.registrationFeeCoins > 0 && <span className="inline-flex items-center gap-1 text-mist-400"><Coins className="size-3.5" /> Entry: {c.registrationFeeCoins}🪙</span>}
        {c.myStaffRole && roleBadge[c.myStaffRole] && <span className={cn("inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-semibold", roleBadge[c.myStaffRole].tone)}>You: {roleBadge[c.myStaffRole].label}</span>}
      </div>

      {/* Assigned staff — Host / Co-Host / Moderator / Judge badges (everyone sees). */}
      {c.staff.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {c.staff.map((s) => { const R = roleBadge[s.role]; return R ? (
            <span key={s.userId} className={cn("inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold", R.tone)} title={`${s.name} — ${R.label}`}>
              <R.icon className="size-3" /> {s.name.split(" ")[0]} · {R.label}
            </span>) : null; })}
        </div>
      )}

      {/* My registration state — shown to EVERYONE, including the Host & Co-Hosts
          so they can also "Request to Sing" and join the singer queue (fairness).
          Their host/co-host role stays active. */}
      <div className="mt-2 text-xs">
        {c.iAmApproved ? <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-2 py-0.5 font-semibold text-emerald-300"><Mic className="size-3" /> You're a singer{current && iAmCurrent ? " — it's your turn! 🎤" : ""}</span>
          : c.myRegStatus === "pending" ? <span className="rounded-full bg-amber-500/15 px-2 py-0.5 font-semibold text-amber-300">Registration pending approval…</span>
          : c.myRegStatus === "rejected" ? <span className="rounded-full bg-white/[0.06] px-2 py-0.5 text-mist-400">Your registration wasn&apos;t approved.</span>
          : c.registrationOpen ? <Button size="sm" onClick={() => run(() => registerForCompetition(roomId), "register", "Registered! The admin/host will approve you.")} disabled={busy === "register"}><Mic className="size-4" /> Request to Sing{c.registrationFeeCoins > 0 ? ` · ${c.registrationFeeCoins}🪙` : ""}</Button>
          : <span className="text-mist-500">Registration is closed.</span>}
      </div>

      {/* Winners banner (results) */}
      {c.status === "results" && c.winners.length > 0 && (
        <div className="mt-3 rounded-xl border border-gold-400/40 bg-gold-500/10 p-3">
          <p className="mb-1.5 flex items-center gap-1.5 text-sm font-bold text-gold-200"><Trophy className="size-4" /> Winners</p>
          <div className="space-y-1.5">
            {c.winners.map((w) => (
              <div key={w.userId} className="flex items-center gap-2 text-sm">
                <Medal className={cn("size-4", w.rank === 1 ? "text-gold-300" : w.rank === 2 ? "text-mist-300" : "text-amber-600")} />
                <span className="font-bold text-mist-100">#{w.rank}</span>
                <Avatar name={w.name} src={w.avatar || undefined} size="xs" />
                <span className="flex-1 truncate text-mist-100">{w.name}</span>
                <span className="text-xs text-mist-300">{w.total} pts · avg {w.average}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Rounds — each round keeps its own permanently-saved results */}
      <RoundsManager c={c} roomId={roomId} onChanged={load} />

      {/* Current performer + marking */}
      {(c.status === "live" || c.status === "paused") && current && (
        <div className="mt-3 rounded-xl border border-white/10 bg-black/20 p-3">
          <div className="flex items-center gap-3">
            <div className="relative"><Avatar name={current.name} src={current.avatar || undefined} size="lg" ring /><span className="absolute -bottom-1 -right-1 grid size-6 place-items-center rounded-full bg-rose-500 text-white"><Mic className="size-3.5" /></span></div>
            <div className="min-w-0 flex-1">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-mist-400">Now singing — #{(c.currentIndex ?? 0) + 1} of {c.participants.length}</p>
              <p className="truncate font-display text-lg font-bold text-mist-100">{current.name}</p>
            </div>
            {secsLeft !== null && (
              <div className={cn("flex flex-col items-center rounded-lg px-3 py-1.5", secsLeft <= 10 ? "bg-rose-500/20 text-rose-200" : "bg-white/[0.06] text-mist-200")}>
                <Clock className="size-4" /><span className="font-mono text-sm font-bold">{Math.floor(secsLeft / 60)}:{String(secsLeft % 60).padStart(2, "0")}</span>
              </div>
            )}
          </div>

          {/* 0–10 marks */}
          {canMark ? (
            <div className="mt-3">
              <p className="mb-1.5 text-[11px] font-semibold text-mist-300">Give {current.name} a mark (0–10):</p>
              <div className="flex flex-wrap gap-1.5">
                {Array.from({ length: 11 }, (_, n) => (
                  <button key={n} onClick={() => run(() => markSinger(roomId, current.userId, n), "mark", "Mark submitted!")} disabled={busy === "mark"}
                    className="grid size-8 place-items-center rounded-lg border border-white/10 bg-ink-800 text-sm font-bold text-mist-100 transition hover:border-lotus-400 hover:bg-lotus-500/20">{n}</button>
                ))}
              </div>
            </div>
          ) : current.myMark !== undefined ? (
            <p className="mt-2 text-xs text-emerald-300">✓ You gave {current.name} a mark of {current.myMark}.</p>
          ) : !c.votingEnabled ? <p className="mt-2 text-xs text-mist-500">Voting is currently disabled by the host.</p> : null}

          {/* Gifts (live only — unchanged from before; the card now also shows while paused for the timer) */}
          {c.giftsEnabled && !iAmCurrent && c.status === "live" && (
            <div className="mt-2 flex flex-wrap items-center gap-1.5">
              <span className="text-[11px] font-semibold text-mist-400"><Gift className="mr-0.5 inline size-3.5 text-pink-400" /> Gift:</span>
              {GIFT_AMOUNTS.map((amt) => (
                <button key={amt} onClick={() => run(() => giftSinger(roomId, current.userId, amt), "gift", `Sent ${amt} coins to ${current.name}!`)} disabled={busy === "gift"}
                  className="rounded-full border border-pink-400/30 bg-pink-500/10 px-2.5 py-1 text-[11px] font-semibold text-pink-200 hover:bg-pink-500/20">{amt}🪙</button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Leaderboard / singer list */}
      <div className="mt-3">
        <p className="mb-1.5 flex items-center gap-1.5 text-[11px] font-semibold text-mist-400">
          <ListOrdered className="size-3.5" /> Singers ({c.participants.length})
          {!c.canSeeScores && c.status !== "results" && <span className="inline-flex items-center gap-1 text-mist-500"><EyeOff className="size-3" /> scores hidden until results</span>}
          {c.canSeeScores && c.status !== "results" && <span className="inline-flex items-center gap-1 text-lotus-300"><Eye className="size-3" /> live scores (host view)</span>}
        </p>
        {c.participants.length === 0 ? (
          <p className="rounded-lg bg-black/20 px-3 py-3 text-center text-sm text-mist-400">No approved singers yet.</p>
        ) : (
          <div className="space-y-1.5">
            {c.participants.map((p) => (
              <div key={p.userId} className={cn("flex items-center gap-2.5 rounded-lg border px-3 py-2", p.isCurrent ? "border-rose-400/40 bg-rose-500/10" : "border-white/10 bg-black/20")}>
                <span className="grid size-6 shrink-0 place-items-center rounded-full bg-white/10 text-[11px] font-bold text-mist-300">{p.order ?? "—"}</span>
                <Avatar name={p.name} src={p.avatar || undefined} size="sm" />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1 truncate text-sm font-semibold text-mist-100">{p.name} {p.isCurrent && <Mic className="size-3.5 text-rose-300" />}</div>
                  {p.total !== undefined && <div className="text-[11px] text-mist-400">{p.total} pts · avg {p.average} · {p.voteCount} votes{p.rank ? ` · rank #${p.rank}` : ""}{p.adjustment ? <span className="text-sky-300"> · admin {p.adjustment > 0 ? "+" : ""}{p.adjustment}</span> : ""}</div>}
                </div>
                {/* ADMIN score editing (add / deduct / set), audited. */}
                {isAdmin && p.status === "approved" && <ScoreEdit roomId={roomId} userId={p.userId} name={p.name} current={p.total} onChanged={load} />}
                {c.iAmController && c.status !== "results" && (
                  <ParticipantMod roomId={roomId} userId={p.userId} name={p.name} onChanged={load} />
                )}
              </div>
            ))}
          </div>
        )}
        {/* Disqualified singers — controllers can restore (accidental removals) */}
        {c.iAmController && c.disqualified.length > 0 && (
          <div className="mt-2 rounded-lg border border-rose-400/20 bg-rose-500/[0.06] p-2">
            <p className="mb-1.5 flex items-center gap-1.5 text-[11px] font-semibold text-rose-200"><Ban className="size-3.5" /> Disqualified ({c.disqualified.length})</p>
            <div className="space-y-1">
              {c.disqualified.map((p) => (
                <div key={p.userId} className="flex items-center gap-2 rounded-md bg-black/20 px-2 py-1 text-sm">
                  <Avatar name={p.name} src={p.avatar || undefined} size="xs" />
                  <span className="min-w-0 flex-1 truncate text-mist-300">{p.name}</span>
                  <Button size="sm" variant="secondary" onClick={() => run(() => moderateCompetition(roomId, "restore", p.userId), "restore" + p.userId, `${p.name} restored`)}><RotateCcw className="size-3.5" /> Restore</Button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Reports (controllers) */}
      {c.iAmController && (
        <div className="mt-3 grid grid-cols-4 gap-2 text-center">
          <Report icon={Users} label="Singers" value={c.reports.participants} />
          <Report icon={Eye} label="Audience" value={c.reports.audience} />
          <Report icon={Check} label="Votes" value={c.reports.votes} />
          <Report icon={Gift} label="Gifts" value={c.reports.gifts} />
        </div>
      )}

      {/* Live voting statistics — Admin / Host / Co-Host only. Refreshes with the 4s poll. */}
      {c.iAmController && c.votingStats && (c.status === "live" || c.status === "paused") && (
        <div className="mt-3 rounded-xl border border-lotus-400/20 bg-black/20 p-3">
          <p className="mb-2 flex items-center gap-1.5 text-[11px] font-semibold text-lotus-200"><Check className="size-3.5" /> Voting statistics — current singer {current ? `(${current.name})` : ""}</p>
          <div className="grid grid-cols-3 gap-2 text-center sm:grid-cols-6">
            <VStat label="In room" value={c.votingStats.inRoom} />
            <VStat label="Can vote" value={c.votingStats.eligible} />
            <VStat label="Voted" value={c.votingStats.voted} tone="text-emerald-300" />
            <VStat label="Not voted" value={c.votingStats.notVoted} tone="text-amber-300" />
            <VStat label="Total votes" value={c.votingStats.totalVotes} />
            <VStat label="Completed" value={c.votingStats.percent} suffix="%" tone="text-lotus-200" />
          </div>
          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/10"><div className="h-full rounded-full bg-lotus-500 transition-all" style={{ width: `${c.votingStats.percent}%` }} /></div>
        </div>
      )}

      {/* Confirm skip when the current singer's time isn't up yet (prevents accidental skips). */}
      {confirmNext && (
        <div className="fixed inset-0 z-[120] grid place-items-center bg-black/60 p-4" onClick={() => setConfirmNext(false)}>
          <div className="w-full max-w-sm rounded-2xl border border-line bg-ink-900 p-5 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center gap-2 text-amber-300"><AlertTriangle className="size-5" /><span className="font-display text-base font-bold">Time not finished</span></div>
            <p className="mt-2 text-sm text-mist-300">The current singer&apos;s allotted time has not yet completed. Are you sure you want to move to the next singer?</p>
            <div className="mt-4 flex justify-end gap-2">
              <Button size="sm" variant="secondary" onClick={() => setConfirmNext(false)}>Cancel</Button>
              <Button size="sm" onClick={() => { setConfirmNext(false); act("next"); }}>Continue</Button>
            </div>
          </div>
        </div>
      )}

      {/* Controller panel */}
      {c.iAmController && (
        <div className="mt-3 rounded-xl border border-lotus-400/20 bg-black/20 p-3">
          <button onClick={() => setShowCtrl((v) => !v)} className="flex w-full items-center justify-between text-xs font-bold text-lotus-200"><span className="inline-flex items-center gap-1.5"><Settings2 className="size-4" /> Host / Admin controls</span><span>{showCtrl ? "▲" : "▼"}</span></button>
          {showCtrl && (
            <div className="mt-3 space-y-3">
              {/* Waiting list — approve to add to the singer queue. A user who leaves and
                  asks to sing again returns here for re-approval (never auto-rejoins). */}
              {c.pending.length > 0 && can("approveJoin") && (
                <div>
                  <p className="mb-1.5 text-[11px] font-semibold text-mist-300">Waiting list — approve to add to the singer queue ({c.pending.length})</p>
                  <div className="space-y-1.5">
                    {c.pending.map((p) => (
                      <div key={p.userId} className="flex items-center gap-2 rounded-lg bg-ink-800/60 px-2.5 py-1.5">
                        <Avatar name={p.name} src={p.avatar || undefined} size="xs" />
                        <span className="min-w-0 flex-1 truncate text-sm text-mist-100">{p.name}</span>
                        <Button size="sm" onClick={() => act("approve", p.userId, undefined, "Approved")} disabled={busy === "approve" + p.userId}><Check className="size-4" /></Button>
                        {can("rejectJoin") && <Button size="sm" variant="ghost" className="!text-rose-300" onClick={() => act("reject", p.userId)}><X className="size-4" /></Button>}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Registration / voting / gifts toggles */}
              <div className="flex flex-wrap gap-2">
                {can("editDetails") && <Button size="sm" variant="secondary" onClick={() => act(c.registrationOpen ? "closeRegistration" : "openRegistration")}>{c.registrationOpen ? "Close registration" : "Open registration"}</Button>}
                {can("enableVoting") && <Button size="sm" variant="secondary" onClick={() => act("toggleVoting")} className={c.votingEnabled ? "!text-emerald-300" : "!text-rose-300"}>Voting: {c.votingEnabled ? "On" : "Off"}</Button>}
                {can("editDetails") && <Button size="sm" variant="secondary" onClick={() => act("toggleGifts")} className={c.giftsEnabled ? "!text-emerald-300" : "!text-rose-300"}>Gifts: {c.giftsEnabled ? "On" : "Off"}</Button>}
              </div>

              {/* Flow controls */}
              <div className="flex flex-wrap gap-2">
                {(c.status === "setup" || c.status === "results") && can("start") && <Button size="sm" onClick={() => act("start", undefined, undefined, "Competition started — everyone was notified!")}><Play className="size-4" /> Start competition</Button>}
                {c.status === "live" && can("manageQueue") && <Button size="sm" onClick={() => (secsLeft !== null && secsLeft > 0 ? setConfirmNext(true) : act("next"))}><SkipForward className="size-4" /> Next singer</Button>}
                {(c.status === "live" || c.status === "paused") && can("manageQueue") && current && <Button size="sm" variant="secondary" onClick={() => act("restartTimer", undefined, undefined, "Timer restarted for this singer")}><RotateCcw className="size-4" /> Restart timer</Button>}
                {c.status === "live" && can("pause") && <Button size="sm" variant="secondary" onClick={() => act("pause")}><Pause className="size-4" /> Pause</Button>}
                {c.status === "paused" && can("resume") && <Button size="sm" onClick={() => act("resume")}><Play className="size-4" /> Resume</Button>}
                {(c.status === "live" || c.status === "paused") && can("end") && <Button size="sm" variant="secondary" className="!text-rose-300" onClick={() => act("end", undefined, undefined, "Competition ended.")}><Square className="size-4" /> End competition</Button>}
                {c.status === "ended" && can("announceWinners") && <Button size="sm" className="!bg-emerald-500 hover:!bg-emerald-600" onClick={() => act("declareResults", undefined, undefined, "Results published for everyone!")}><Trophy className="size-4" /> Declare &amp; publish results</Button>}
                {c.status === "results" && can("editDetails") && <Button size="sm" variant="secondary" onClick={() => act("reset")}><RotateCcw className="size-4" /> Reset for a new round</Button>}
              </div>

              {/* Settings: speaking seats · performance time · edit details */}
              {can("editDetails") && <CompSettings c={c} roomId={roomId} onChanged={load} />}

              {/* Staff & permissions (ADMIN only) */}
              {isAdmin && <StaffManager c={c} roomId={roomId} onChanged={load} />}

              {/* Moderation & penalty log */}
              {c.modLog.length > 0 && <ModLog log={c.modLog} />}

              <p className="text-[10px] text-mist-500">Tip: use the room&apos;s seats for singers to go on the mic, the chat for announcements, and the member menu to mute/kick/ban.</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ---- Competition settings: speaking seats · performance time · edit details ----
function CompSettings({ c, roomId, onChanged }: { c: CompetitionView; roomId: string; onChanged: () => void }) {
  const { toast } = useToast();
  const { config } = useConfig();
  const term = lbl(config.labels, "term.prize"); // "Support Staff" (admin-configurable)
  const [open, setOpen] = useState(false);
  const [seats, setSeats] = useState(c.speakingSeats ?? 0);
  const [secs, setSecs] = useState(c.performanceSeconds);
  const [title, setTitle] = useState(c.title);
  const [prize, setPrize] = useState(c.prize ?? "");
  const [fee, setFee] = useState(c.registrationFeeCoins);
  const [wp, setWp] = useState(c.winnerPrizeCoins);
  const toLocal = (s?: string) => (s ? s.slice(0, 16) : "");
  const [totalSeats, setTotalSeats] = useState(c.totalSeats ?? 0);
  const [regOpens, setRegOpens] = useState(toLocal(c.registrationOpensAt));
  const [regCloses, setRegCloses] = useState(toLocal(c.registrationClosesAt));
  const [matchAt, setMatchAt] = useState(toLocal(c.matchAt));
  const ordinal = (n: number) => n === 1 ? "1st" : n === 2 ? "2nd" : n === 3 ? "3rd" : `${n}th`;
  const [prizes, setPrizes] = useState<CompetitionPrize[]>(() =>
    c.prizes && c.prizes.length ? c.prizes : [1, 2, 3, 4].map((position) => ({ position, coins: 0, enabled: position === 1 })));
  const [busy, setBusy] = useState(false);
  const num = "h-8 w-20 rounded-lg border border-line bg-ink-800 px-2 text-sm text-mist-100 outline-none focus:border-lotus-400";
  const wide = "h-9 w-full rounded-lg border border-line bg-ink-800 px-2.5 text-sm text-mist-100 outline-none focus:border-lotus-400";
  const setPrizePos = (i: number, patch: Partial<CompetitionPrize>) => setPrizes((ps) => ps.map((p, j) => j === i ? { ...p, ...patch } : p));
  const addPrize = () => setPrizes((ps) => [...ps, { position: ps.length + 1, coins: 0, enabled: true }]);
  const delPrize = (i: number) => setPrizes((ps) => ps.filter((_, j) => j !== i).map((p, k) => ({ ...p, position: k + 1 })));
  const save = async () => {
    setBusy(true);
    await competitionAction(roomId, "setSeats", undefined, Number(seats));
    await competitionAction(roomId, "setTime", undefined, Number(secs));
    const res = await editCompetition(roomId, { title: title.trim() || c.title, prize, registrationFeeCoins: Number(fee), winnerPrizeCoins: Number(wp), prizes, totalSeats: Number(totalSeats), registrationOpensAt: regOpens, registrationClosesAt: regCloses, matchAt });
    setBusy(false);
    if (res.ok) { toast("Competition settings saved", "success"); setOpen(false); onChanged(); } else toast(res.error ?? "Failed", "error");
  };
  return (
    <div className="rounded-lg border border-white/10 bg-ink-800/40 p-2.5">
      <button onClick={() => setOpen((v) => !v)} className="flex w-full items-center justify-between text-[11px] font-bold text-mist-200"><span className="inline-flex items-center gap-1.5"><Pencil className="size-3.5" /> Competition settings (seats · schedule · time · fees · support staff)</span><span>{open ? "▲" : "▼"}</span></button>
      {open && (
        <div className="mt-2 space-y-2">
          <div className="flex flex-wrap items-center gap-3 text-xs text-mist-300">
            <label className="inline-flex items-center gap-1.5">Total seats <input type="number" min={0} value={totalSeats} onChange={(e) => setTotalSeats(Number(e.target.value) || 0)} className={num} title="Max participants (0 = unlimited)" /></label>
            <label className="inline-flex items-center gap-1.5">Speaking seats <input type="number" min={0} value={seats} onChange={(e) => setSeats(Number(e.target.value) || 0)} className={num} /></label>
            <label className="inline-flex items-center gap-1.5">Time/singer (s) <input type="number" min={30} value={secs} onChange={(e) => setSecs(Number(e.target.value) || 120)} className={num} /></label>
          </div>
          {/* Schedule: registration window + match date/time */}
          <div className="rounded-lg border border-white/10 bg-black/20 p-2">
            <p className="mb-1.5 flex items-center gap-1.5 text-[11px] font-bold text-lotus-200"><Clock className="size-3.5" /> Schedule</p>
            <div className="grid gap-2 sm:grid-cols-3">
              <label className="text-[11px] text-mist-400">Registration opens<input type="datetime-local" value={regOpens} onChange={(e) => setRegOpens(e.target.value)} className={cn(wide, "mt-0.5")} /></label>
              <label className="text-[11px] text-mist-400">Registration closes<input type="datetime-local" value={regCloses} onChange={(e) => setRegCloses(e.target.value)} className={cn(wide, "mt-0.5")} /></label>
              <label className="text-[11px] text-mist-400">Match date &amp; time<input type="datetime-local" value={matchAt} onChange={(e) => setMatchAt(e.target.value)} className={cn(wide, "mt-0.5")} /></label>
            </div>
          </div>
          <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Title" className={wide} maxLength={80} />
          <input value={prize} onChange={(e) => setPrize(e.target.value)} placeholder="Reward note (text)" className={wide} maxLength={120} />
          <div className="flex flex-wrap items-center gap-3 text-xs text-mist-300">
            <label className="inline-flex items-center gap-1.5">Coins to join 🪙 <input type="number" min={0} value={fee} onChange={(e) => setFee(Number(e.target.value) || 0)} className={num} /></label>
            <label className="inline-flex items-center gap-1.5">Winner amount 🪙 <input type="number" min={0} value={wp} onChange={(e) => setWp(Number(e.target.value) || 0)} className={num} /></label>
          </div>
          {/* Prize positions — 1st / 2nd / … each with an amount + on/off */}
          <div className="rounded-lg border border-gold-400/20 bg-gold-500/[0.06] p-2">
            <p className="mb-1.5 flex items-center gap-1.5 text-[11px] font-bold text-gold-200"><Trophy className="size-3.5" /> {term} (paid when results are declared)</p>
            <div className="space-y-1.5">
              {prizes.map((p, i) => (
                <div key={i} className="flex items-center gap-2 text-xs">
                  <button onClick={() => setPrizePos(i, { enabled: !p.enabled })} title={p.enabled ? "Enabled" : "Disabled"}
                    className={cn("grid size-6 shrink-0 place-items-center rounded-md text-[10px] font-bold", p.enabled ? "bg-emerald-500/25 text-emerald-200" : "bg-white/[0.06] text-mist-500")}>{p.enabled ? "ON" : "off"}</button>
                  <span className="w-9 shrink-0 font-semibold text-mist-200">{ordinal(p.position)}</span>
                  <input type="number" min={0} value={p.coins} onChange={(e) => setPrizePos(i, { coins: Number(e.target.value) || 0 })} disabled={!p.enabled} className={cn(num, "!w-24", !p.enabled && "opacity-50")} />
                  <span className="text-mist-500">🪙</span>
                  <button onClick={() => delPrize(i)} className="ml-auto rounded-md p-1 text-mist-500 hover:bg-white/10 hover:text-rose-300"><Trash2 className="size-3.5" /></button>
                </div>
              ))}
            </div>
            <button onClick={addPrize} className="mt-1.5 inline-flex items-center gap-1 text-[11px] font-semibold text-lotus-300 hover:text-lotus-200"><Plus className="size-3.5" /> Add position</button>
          </div>
          <Button size="sm" onClick={save} disabled={busy}>{busy ? "Saving…" : "Save settings"}</Button>
        </div>
      )}
    </div>
  );
}

// ---- Staff & permissions (ADMIN only): assign Host/Co-Host/Moderator/Judge ----
function StaffManager({ c, roomId, onChanged }: { c: CompetitionView; roomId: string; onChanged: () => void }) {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [results, setResults] = useState<{ id: string; fullName: string; username: string; avatar?: string }[]>([]);
  const [picked, setPicked] = useState<{ id: string; fullName: string } | null>(null);
  const [role, setRole] = useState<CompetitionStaffRole>("cohost");
  const [perms, setPerms] = useState<string[]>(defaultPermsForRole("cohost"));
  const [busy, setBusy] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const onQ = (v: string) => {
    setQ(v);
    if (timer.current) clearTimeout(timer.current);
    if (v.trim().length < 2) { setResults([]); return; }
    timer.current = setTimeout(async () => setResults(await searchUsersForStaff(v.trim())), 300);
  };
  const chooseRole = (r: CompetitionStaffRole) => { setRole(r); setPerms(defaultPermsForRole(r)); };
  const togglePerm = (k: string) => setPerms((p) => (p.includes(k) ? p.filter((x) => x !== k) : [...p, k]));
  const assign = async () => {
    if (!picked) return;
    setBusy(true);
    const res = await assignCompetitionStaff(roomId, picked.id, role, perms);
    setBusy(false);
    if (res.ok) { toast(`${picked.fullName} assigned as ${STAFF_ROLE_LABEL[role]}`, "success"); setPicked(null); setQ(""); setResults([]); onChanged(); }
    else toast(res.error ?? "Failed", "error");
  };
  const remove = async (id: string) => { const res = await removeCompetitionStaff(roomId, id); if (res.ok) onChanged(); else toast(res.error ?? "Failed", "error"); };

  const grouped = COMPETITION_PERMISSIONS.reduce<Record<string, typeof COMPETITION_PERMISSIONS>>((acc, p) => { (acc[p.group] = acc[p.group] ?? []).push(p); return acc; }, {});

  return (
    <div className="rounded-lg border border-lotus-400/20 bg-ink-800/40 p-2.5">
      <button onClick={() => setOpen((v) => !v)} className="flex w-full items-center justify-between text-[11px] font-bold text-lotus-200"><span className="inline-flex items-center gap-1.5"><UserCog className="size-3.5" /> Manage staff &amp; permissions (Host / Co-Host / Moderator / Judge)</span><span>{open ? "▲" : "▼"}</span></button>
      {open && (
        <div className="mt-2 space-y-3">
          <p className="flex items-center gap-1.5 rounded-md bg-gold-500/10 px-2 py-1.5 text-[10px] text-gold-200"><Lock className="size-3" /> Assign a <b>Host / Co-Host / Moderator / Judge</b> — each gets only the permissions you grant. The <b>Admin</b> always stays the highest authority: score / vote / ranking / winner edits are admin-only.</p>
          {/* Current staff */}
          {c.staff.length > 0 && (
            <div className="space-y-1.5">
              {c.staff.map((s) => (
                <div key={s.userId} className="flex items-center gap-2 rounded-lg bg-ink-800/60 px-2.5 py-1.5">
                  <Avatar name={s.name} src={s.avatar || undefined} size="xs" />
                  <span className="min-w-0 flex-1 truncate text-sm text-mist-100">{s.name}</span>
                  <span className="rounded-full bg-white/[0.08] px-2 py-0.5 text-[10px] font-bold text-mist-300">{STAFF_ROLE_LABEL[s.role as CompetitionStaffRole] ?? s.role} · {s.permissions.length} perms</span>
                  <button title="Remove" onClick={() => remove(s.userId)} className="rounded-lg p-1 text-mist-500 hover:bg-white/10 hover:text-rose-300"><X className="size-4" /></button>
                </div>
              ))}
            </div>
          )}

          {/* Assign new staff */}
          {!picked ? (
            <div>
              <div className="flex items-center gap-1.5 rounded-lg border border-line bg-ink-800 px-2"><Search className="size-3.5 text-mist-500" /><input value={q} onChange={(e) => onQ(e.target.value)} placeholder="Search a user to assign…" className="h-9 w-full bg-transparent text-sm text-mist-100 outline-none placeholder:text-mist-500" /></div>
              {results.length > 0 && (
                <div className="mt-1.5 max-h-36 space-y-0.5 overflow-y-auto rounded-lg border border-line bg-ink-900/60 p-1">
                  {results.map((u) => (
                    <button key={u.id} onClick={() => setPicked({ id: u.id, fullName: u.fullName })} className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm text-mist-200 hover:bg-white/[0.06]">
                      <Avatar name={u.fullName} src={u.avatar || undefined} size="xs" /><span className="truncate">{u.fullName}</span><span className="text-xs text-mist-500">@{u.username}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-2 rounded-lg border border-line bg-ink-900/50 p-2.5">
              <div className="flex items-center justify-between"><span className="text-sm font-semibold text-mist-100">{picked.fullName}</span><button onClick={() => setPicked(null)} className="text-xs text-mist-400 hover:text-mist-200">change</button></div>
              <div className="flex flex-wrap gap-1.5">
                {(["host", "cohost", "moderator", "judge"] as CompetitionStaffRole[]).map((r) => (
                  <button key={r} onClick={() => chooseRole(r)} className={cn("rounded-full px-2.5 py-1 text-[11px] font-semibold transition", role === r ? "bg-lotus-500/25 text-white" : "bg-ink-800 text-mist-400")}>{STAFF_ROLE_LABEL[r]}</button>
                ))}
              </div>
              {/* Permission toggles by group */}
              <div className="max-h-52 space-y-2 overflow-y-auto pr-1">
                {Object.entries(grouped).map(([group, list]) => (
                  <div key={group}>
                    <p className="mb-1 text-[10px] font-bold uppercase tracking-wide text-mist-500">{group}</p>
                    <div className="flex flex-wrap gap-1">
                      {list.map((p) => (
                        <button key={p.key} onClick={() => togglePerm(p.key)} className={cn("rounded-md px-2 py-0.5 text-[10px] font-semibold transition", perms.includes(p.key) ? "bg-emerald-500/20 text-emerald-200" : "bg-ink-800 text-mist-500")}>{p.label}</button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
              <Button size="sm" block onClick={assign} disabled={busy}>{busy ? "Assigning…" : `Assign as ${STAFF_ROLE_LABEL[role]} (${perms.length} permissions)`}</Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ---- Rounds: named/custom rounds, each with its own PERMANENTLY-saved results ----
const ROUND_PRESETS = ["Round 1", "Round 2", "Round 3", "Quarter Final", "Pre-Semi Final", "Semi Final", "Final"];
function RoundsManager({ c, roomId, onChanged }: { c: CompetitionView; roomId: string; onChanged: () => void }) {
  const { toast } = useToast();
  const [busy, setBusy] = useState("");
  const [name, setName] = useState("");
  const [openId, setOpenId] = useState<string | null>(null);
  const canManage = c.iAmController && (c.myPerms.includes("*") || c.myPerms.includes("editDetails"));
  const rounds = c.rounds;
  const run = async (fn: () => Promise<{ ok: boolean; error?: string }>, key: string, okMsg?: string) => {
    setBusy(key); const res = await fn(); setBusy("");
    if (res.ok) { if (okMsg) toast(okMsg, "success"); onChanged(); } else toast(res.error ?? "Failed", "error");
  };
  const create = (n: string) => { const nm = n.trim() || `Round ${rounds.length + 1}`; run(() => manageCompetitionRound(roomId, "create", { name: nm }), "create", `${nm} added`); setName(""); };
  if (!canManage && rounds.length === 0) return null;

  return (
    <div className="mt-3 rounded-xl border border-lotus-400/20 bg-black/20 p-3">
      <p className="mb-2 flex items-center gap-1.5 text-[11px] font-bold text-lotus-200"><Layers className="size-4" /> Rounds{rounds.length > 0 ? ` (${rounds.length})` : ""} <span className="font-normal text-mist-500">· each round&apos;s results are saved permanently</span></p>
      {rounds.length === 0 ? (
        <p className="text-xs text-mist-500">No rounds yet.{canManage ? " Create rounds below — completing a round saves its results and never overwrites earlier rounds." : ""}</p>
      ) : (
        <div className="space-y-1.5">
          {rounds.map((r) => {
            const tone = r.status === "completed" ? "border-emerald-400/30 bg-emerald-500/[0.07]" : r.status === "active" ? "border-rose-400/40 bg-rose-500/10" : "border-white/10 bg-black/20";
            const open = openId === r.id;
            return (
              <div key={r.id} className={cn("rounded-lg border", tone)}>
                <div className="flex flex-wrap items-center gap-2 px-2.5 py-1.5">
                  <span className="min-w-0 flex-1 truncate text-sm font-semibold text-mist-100">{r.name}</span>
                  <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-bold", r.status === "completed" ? "bg-emerald-500/15 text-emerald-300" : r.status === "active" ? "bg-rose-500/20 text-rose-300" : "bg-white/[0.08] text-mist-400")}>{r.status === "completed" ? "✓ Saved" : r.status === "active" ? "LIVE" : "Pending"}</span>
                  {/* Qualification: how many advance to the next round. */}
                  {canManage && r.status !== "completed" ? (
                    <button onClick={() => { const v = window.prompt(`How many top scorers QUALIFY from "${r.name}" to the next round? (0 = all)`, String(r.qualifyCount ?? 0)); if (v === null) return; run(() => manageCompetitionRound(roomId, "setQualify", { roundId: r.id, qualifyCount: Math.max(0, Number(v) || 0) }), "q" + r.id, "Qualification set"); }} className="rounded-full bg-lotus-500/15 px-2 py-0.5 text-[10px] font-semibold text-lotus-200">Top {r.qualifyCount ?? 0} qualify ✎</button>
                  ) : (r.qualifyCount ?? 0) > 0 ? <span className="rounded-full bg-lotus-500/15 px-2 py-0.5 text-[10px] font-semibold text-lotus-200">Top {r.qualifyCount} qualified</span> : null}
                  {r.results && r.results.length > 0 && <button onClick={() => setOpenId(open ? null : r.id)} className="text-[11px] font-semibold text-lotus-300">{open ? "Hide" : "Results"}</button>}
                  {canManage && r.status === "pending" && <Button size="sm" onClick={() => run(() => manageCompetitionRound(roomId, "start", { roundId: r.id }), "s" + r.id, `${r.name} started`)}><Play className="size-3.5" /> Start</Button>}
                  {canManage && r.status === "active" && <Button size="sm" className="!bg-emerald-500 hover:!bg-emerald-600" onClick={() => run(() => manageCompetitionRound(roomId, "complete", { roundId: r.id }), "c" + r.id, `${r.name} results saved`)}><Check className="size-3.5" /> Complete &amp; save</Button>}
                  {canManage && r.status === "pending" && <button title="Delete round" onClick={() => run(() => manageCompetitionRound(roomId, "delete", { roundId: r.id }), "d" + r.id)} className="rounded-md p-1 text-mist-500 hover:bg-white/10 hover:text-rose-300"><Trash2 className="size-3.5" /></button>}
                </div>
                {open && r.results && (
                  <div className="space-y-1 border-t border-white/10 px-2.5 py-2">
                    {r.results.map((res) => (
                      <div key={res.userId} className="flex items-center gap-2 text-xs">
                        <span className="w-6 shrink-0 text-center font-bold text-mist-300">#{res.rank}</span>
                        <span className="min-w-0 flex-1 truncate text-mist-100">{res.name}</span>
                        {res.qualified && <span className="shrink-0 rounded-full bg-emerald-500/15 px-1.5 py-0.5 text-[9px] font-bold text-emerald-300">QUALIFIED ✓</span>}
                        <span className="shrink-0 text-mist-400">{res.total} pts · avg {res.average}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
      {canManage && (
        <div className="mt-2 space-y-1.5">
          <div className="flex items-center gap-1.5">
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Custom round name…" className="h-8 min-w-0 flex-1 rounded-lg border border-line bg-ink-800 px-2 text-sm text-mist-100 outline-none focus:border-lotus-400" maxLength={40} />
            <Button size="sm" onClick={() => create(name)} disabled={busy === "create"}><Plus className="size-4" /> Add</Button>
          </div>
          <div className="flex flex-wrap gap-1">
            {ROUND_PRESETS.filter((n) => !rounds.some((r) => r.name === n)).map((n) => (
              <button key={n} onClick={() => create(n)} className="rounded-full bg-ink-800 px-2 py-0.5 text-[10px] font-semibold text-mist-400 hover:bg-white/[0.08] hover:text-mist-200">+ {n}</button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ---- ADMIN score editing (Add / Deduct / Set) — every change is audited ----
function ScoreEdit({ roomId, userId, name, current, onChanged }: { roomId: string; userId: string; name: string; current?: number; onChanged: () => void }) {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const apply = async (opts: { delta?: number; setTo?: number; reason?: string }, okMsg: string) => {
    setBusy(true); const res = await adjustCompetitionScore(roomId, userId, opts); setBusy(false); setOpen(false);
    if (res.ok) { toast(okMsg, "success"); onChanged(); } else toast(res.error ?? "Failed", "error");
  };
  const add = () => { const v = window.prompt(`Add marks to ${name}:`, "5"); if (v === null || !Number(v)) return; const reason = window.prompt("Reason (recorded in the audit log):", "") ?? undefined; apply({ delta: Math.abs(Number(v)), reason }, `Added ${v} to ${name}`); };
  const deduct = () => { const v = window.prompt(`Deduct marks from ${name}:`, "5"); if (v === null || !Number(v)) return; const reason = window.prompt("Reason (recorded in the audit log):", "") ?? undefined; apply({ delta: -Math.abs(Number(v)), reason }, `Deducted ${v} from ${name}`); };
  const setExact = () => { const v = window.prompt(`Set ${name}'s total score to:`, String(current ?? 0)); if (v === null) return; const reason = window.prompt("Reason (recorded in the audit log):", "") ?? undefined; apply({ setTo: Number(v) || 0, reason }, `${name}'s score set to ${Number(v) || 0}`); };
  return (
    <div className="relative shrink-0">
      <button title="Edit score (admin)" onClick={() => setOpen((v) => !v)} className="rounded-lg p-1 text-sky-400/80 hover:bg-white/10 hover:text-sky-300"><Pencil className="size-4" /></button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-8 z-50 w-40 rounded-lg border border-white/10 bg-ink-850 p-1 shadow-xl">
            <MItem icon={Plus} label="Add marks" tone="text-emerald-300" onClick={add} disabled={busy} />
            <MItem icon={Trash2} label="Deduct marks" tone="text-amber-300" onClick={deduct} disabled={busy} />
            <MItem icon={Pencil} label="Set exact score" tone="text-sky-300" onClick={setExact} disabled={busy} />
          </div>
        </>
      )}
    </div>
  );
}

// ---- Per-participant moderation menu (Warn / Penalty / Disqualify / Remove) ----
function ParticipantMod({ roomId, userId, name, onChanged }: { roomId: string; userId: string; name: string; onChanged: () => void }) {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const doMod = async (action: string, opts: { reason?: string; note?: string; coins?: number }, okMsg: string) => {
    setBusy(true); const res = await moderateCompetition(roomId, action, userId, opts); setBusy(false); setOpen(false);
    if (res.ok) { toast(okMsg, "success"); onChanged(); } else toast(res.error ?? "Failed", "error");
  };
  const warn = () => { const reason = window.prompt(`Warn ${name} — reason (optional):`, "") ?? undefined; doMod("warn", { reason }, `${name} was warned`); };
  const penalty = () => { const reason = window.prompt(`Penalty for ${name} — reason:`, "") ?? undefined; const coins = window.prompt("Coins to deduct (0 for none):", "0"); if (coins === null) return; doMod("penalty", { reason, coins: Number(coins) || 0 }, `Penalty applied to ${name}`); };
  const disqualify = () => { if (!window.confirm(`Disqualify ${name}? They can be restored later.`)) return; const reason = window.prompt("Reason (optional):", "") ?? undefined; doMod("disqualify", { reason }, `${name} disqualified`); };
  const remove = async () => {
    if (!window.confirm(`Remove ${name} from the competition entirely?`)) return;
    setBusy(true); const res = await competitionAction(roomId, "removeParticipant", userId); setBusy(false); setOpen(false);
    if (res.ok) { toast(`${name} removed`, "success"); onChanged(); } else toast(res.error ?? "Failed", "error");
  };
  return (
    <div className="relative shrink-0">
      <button title="Moderate singer" onClick={() => setOpen((v) => !v)} className="rounded-lg p-1 text-mist-500 hover:bg-white/10 hover:text-lotus-300"><Shield className="size-4" /></button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-8 z-50 w-40 rounded-lg border border-white/10 bg-ink-850 p-1 shadow-xl">
            <MItem icon={Flag} label="Warn" onClick={warn} disabled={busy} />
            <MItem icon={AlertTriangle} label="Penalty" onClick={penalty} disabled={busy} />
            <MItem icon={Ban} label="Disqualify" tone="text-amber-300" onClick={disqualify} disabled={busy} />
            <MItem icon={X} label="Remove" tone="text-rose-300" onClick={remove} disabled={busy} />
          </div>
        </>
      )}
    </div>
  );
}
function MItem({ icon: Icon, label, onClick, tone, disabled }: { icon: typeof Flag; label: string; onClick: () => void; tone?: string; disabled?: boolean }) {
  return <button onClick={onClick} disabled={disabled} className={cn("flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-left text-xs font-medium hover:bg-white/[0.06] disabled:opacity-50", tone ?? "text-mist-200")}><Icon className="size-3.5" /> {label}</button>;
}

// ---- Moderation & penalty log (controllers only) ----
function ModLog({ log }: { log: CompModEvent[] }) {
  const [open, setOpen] = useState(false);
  const label: Record<string, string> = { warn: "Warning", penalty: "Penalty", disqualify: "Disqualified", restore: "Restored", remove: "Removed", ban: "Banned", score: "Score edit" };
  return (
    <div className="rounded-lg border border-white/10 bg-ink-800/40 p-2.5">
      <button onClick={() => setOpen((v) => !v)} className="flex w-full items-center justify-between text-[11px] font-bold text-mist-200"><span className="inline-flex items-center gap-1.5"><ScrollText className="size-3.5" /> Moderation, score &amp; penalty log ({log.length})</span><span>{open ? "▲" : "▼"}</span></button>
      {open && (
        <div className="mt-2 max-h-52 space-y-1 overflow-y-auto pr-1">
          {log.map((e) => (
            <div key={e.id} className="rounded-md bg-black/20 px-2 py-1.5 text-[11px]">
              <div className="flex items-center gap-1.5">
                <span className={cn("font-bold", e.action === "score" ? "text-sky-300" : "text-mist-100")}>{label[e.action] ?? e.action}</span>
                <span className="text-mist-400">→ {e.targetName}</span>
                {e.action === "score" && <span className="font-mono text-amber-300">{e.prevScore} → {e.newScore} pts</span>}
                {e.coins ? <span className="text-rose-300">−{e.coins}🪙</span> : null}
                <span className="ml-auto text-mist-600">{new Date(e.at).toLocaleString("en-SA", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}</span>
              </div>
              {(e.reason || e.note) && <div className="mt-0.5 text-mist-400">{e.reason}{e.note ? ` · ${e.note}` : ""}</div>}
              <div className="text-[10px] text-mist-600">by {e.actorName}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
