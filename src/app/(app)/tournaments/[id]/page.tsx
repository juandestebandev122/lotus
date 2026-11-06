"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Coins, Users, Trophy, Crown, Dices, Radio, Clock, Check, Maximize2, X } from "lucide-react";
import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import { cn } from "@/lib/cn";
import { useAuth } from "@/lib/auth";
import { useConfig } from "@/lib/config";
import { lbl } from "@/lib/labels";
import {
  fetchTournament,
  requestJoin,
  pressReady,
  type TournamentView,
  type TMatch,
} from "@/lib/tournaments-api";
import { fetchRooms } from "@/lib/rooms";

const STATUS_STYLE: Record<TournamentView["status"], string> = {
  live: "bg-rose-500/20 text-rose-300",
  upcoming: "bg-lotus-500/20 text-lotus-200",
  completed: "bg-emerald-500/15 text-emerald-300",
  cancelled: "bg-white/10 text-mist-400",
};

export default function TournamentDetailPage() {
  const params = useParams<{ id: string }>();
  const id = params?.id ? String(params.id) : "";
  const { toast } = useToast();
  const { config } = useConfig();
  const { user } = useAuth();
  const term = lbl(config.labels, "term.prize"); // "Support Staff" (admin-configurable)
  const [t, setT] = useState<TournamentView | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [posterOpen, setPosterOpen] = useState(false); // full-screen poster preview
  // Deep-link to my match's VOICE room. It is now AUTO-CREATED with the match
  // room (server sends its id as voiceRoomId) → one tap to enter, no manual
  // search. Fallback to a name-match for any old tournament made before this.
  const [matchRoomId, setMatchRoomId] = useState<string | null>(null);
  useEffect(() => {
    const myRoom = (t?.rooms ?? []).find((r) => r.players.some((p) => p.id === user?.id));
    if (!myRoom) { setMatchRoomId(null); return; }
    if (myRoom.voiceRoomId) { setMatchRoomId(myRoom.voiceRoomId); return; } // auto-created — direct
    if (!myRoom.name) { setMatchRoomId(null); return; }
    let on = true;
    fetchRooms()
      .then((rooms) => {
        if (!on) return;
        const found = rooms.find((r) => r.name.trim().toLowerCase() === myRoom.name.trim().toLowerCase());
        setMatchRoomId(found?.id ?? null);
      })
      .catch(() => {});
    return () => { on = false; };
  }, [t, user?.id]);

  const load = () => fetchTournament(id).then((x) => { setT(x); setLoading(false); });
  useEffect(() => {
    if (!id) return;
    load();
    // Light auto-refresh so rooms / READY states / replacements appear without
    // a manual reload (paused while the tab is backgrounded to save data).
    const iv = setInterval(() => { if (!document.hidden) load(); }, 10000);
    return () => clearInterval(iv);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  if (loading) return <p className="py-16 text-center text-sm text-mist-400">Loading…</p>;
  if (!t) {
    return (
      <div className="mx-auto max-w-lg py-16 text-center">
        <h1 className="font-display text-2xl font-bold text-mist-100">Tournament not found</h1>
        <Link href="/tournaments" className="mt-4 inline-block text-sm text-lotus-300">← Back to tournaments</Link>
      </div>
    );
  }

  const GameIcon = t.game === "Ludo" ? Dices : Crown;
  const canRequest = t.myStatus === "none" && t.regOpen && t.status !== "completed";

  const join = async () => {
    setBusy(true);
    const res = await requestJoin(t.id);
    setBusy(false);
    if (res.ok) { toast("Join request submitted — awaiting approval", "success"); load(); }
    else toast(res.error ?? "Could not request to join", "error");
  };

  return (
    <div className="mx-auto max-w-4xl">
      <Link href="/tournaments" className="mb-4 inline-flex items-center gap-2 text-sm text-mist-400 hover:text-mist-100">
        <ArrowLeft className="size-4" /> Tournaments
      </Link>

      <div className="rounded-2xl border border-white/10 bg-[linear-gradient(120deg,rgba(245,158,11,0.14),rgba(124,58,237,0.18))] p-5 sm:p-6">
        {/* Poster — shown in FULL (no cropping); tap to open a full-screen preview. */}
        {t.poster && (
          <button type="button" onClick={() => setPosterOpen(true)} className="group relative mb-5 block w-full overflow-hidden rounded-xl border border-white/10 bg-black/30" title="Tap to view full screen">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={t.poster} alt={`${t.title} poster`} className="max-h-[28rem] w-full object-contain" />
            <span className="absolute right-2 top-2 inline-flex items-center gap-1 rounded-lg bg-black/55 px-2 py-1 text-[11px] font-semibold text-white opacity-80 transition group-hover:opacity-100">
              <Maximize2 className="size-3.5" /> Full screen
            </span>
          </button>
        )}
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="grid size-12 place-items-center rounded-xl bg-gold-400/15 text-gold-300"><GameIcon className="size-6" /></span>
            <div>
              <h1 className="font-display text-2xl font-extrabold text-mist-100">{t.title}</h1>
              <p className="text-sm text-mist-300">{t.game} · Knockout</p>
            </div>
          </div>
          <span className={cn("inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-bold uppercase", STATUS_STYLE[t.status])}>
            {t.status === "live" && <Radio className="size-3" />} {t.status}
          </span>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm">
          <span className="inline-flex items-center gap-1.5 font-semibold text-gold-300"><Coins className="size-4" /> {t.prize.toLocaleString("en-SA")} pool</span>
          <span className="inline-flex items-center gap-1.5 text-mist-300"><Users className="size-4" /> {t.stats.joined}/{t.capacity} joined</span>
          {t.entry > 0 && <span className="text-mist-400">Entry {t.entry} coins (charged when you request; refunded if declined or cancelled)</span>}
          {t.startAt && t.status === "upcoming" && (
            <span className="inline-flex items-center gap-1.5 text-mist-300">
              <Clock className="size-4" /> Starts {new Date(t.startAt).toLocaleString("en-SA", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
            </span>
          )}
        </div>

        {/* Prize breakdown (1st–4th) */}
        {t.prizes.length > 0 && (
          <div className="mt-4 grid gap-2 sm:grid-cols-2">
            {t.prizes.map((p) => (
              <div key={p.place} className="flex items-center gap-2 rounded-xl border border-gold-400/20 bg-gold-400/[0.06] px-3 py-2">
                <Trophy className="size-4 shrink-0 text-gold-300" />
                <span className="text-sm font-semibold text-gold-200">{p.place === 1 ? "1st" : p.place === 2 ? "2nd" : p.place === 3 ? "3rd" : "4th"} {term}</span>
                <span className="ml-auto text-sm font-bold text-mist-100">{p.amount.toLocaleString("en-SA")}</span>
                {p.detail && <span className="w-full text-xs text-mist-400">{p.detail}</span>}
              </div>
            ))}
          </div>
        )}

        {/* Tournament details / rules */}
        {t.description && (
          <div className="mt-4 rounded-xl border border-line bg-ink-900/40 p-4">
            <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-mist-500">Tournament details</p>
            <p className="whitespace-pre-wrap text-sm text-mist-200">{t.description}</p>
          </div>
        )}

        <div className="mt-4 flex flex-wrap items-center gap-2">
          {t.myStatus === "joined" && <span className="rounded-lg bg-emerald-500/15 px-3 py-1.5 text-sm font-semibold text-emerald-300">✓ You&apos;re a participant</span>}
          {t.myStatus === "pending" && <span className="rounded-lg bg-amber-500/15 px-3 py-1.5 text-sm font-semibold text-amber-300">Request pending approval</span>}
          {t.myStatus === "rejected" && <span className="rounded-lg bg-rose-500/15 px-3 py-1.5 text-sm font-semibold text-rose-300">Request declined</span>}
          {t.isFull && t.myStatus === "none" && <span className="rounded-lg bg-rose-500/15 px-3 py-1.5 text-sm font-semibold text-rose-300">Tournament Full</span>}
          {!t.isFull && !t.regOpen && t.myStatus === "none" && t.status !== "completed" && (
            <span className="inline-flex items-center gap-1.5 rounded-lg bg-white/[0.06] px-3 py-1.5 text-sm font-semibold text-mist-400"><Clock className="size-4" /> Registration closed</span>
          )}
          {canRequest && <Button onClick={join} disabled={busy}><Check className="size-4" /> {busy ? "Sending…" : "Request to join"}</Button>}
        </div>

        {/* Cancellation reason — shown so participants know WHY it was called off. */}
        {t.status === "cancelled" && t.cancelledReason && (
          <p className="mt-3 rounded-xl border border-rose-400/20 bg-rose-500/[0.06] px-3 py-2 text-sm text-rose-200">
            Cancelled: {t.cancelledReason}
          </p>
        )}
      </div>

      {/* Participants */}
      <div className="mt-5">
        <h2 className="mb-2 font-semibold text-mist-100">Participants ({t.joinedNames.length}/{t.capacity})</h2>
        {t.joinedNames.length === 0 ? (
          <p className="rounded-xl border border-white/8 bg-ink-850 px-4 py-6 text-center text-sm text-mist-500">No participants yet — be the first to join!</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {t.joinedNames.map((n) => (
              <span key={n} className="inline-flex items-center gap-1.5 rounded-full bg-ink-800 px-3 py-1.5 text-sm text-mist-100">
                <Avatar name={n} size="xs" /> {n}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Your match room (room-based tournaments) — the room you're assigned to */}
      {(() => {
        const myRoom = (t.rooms ?? []).find((r) => r.players.some((p) => p.id === user?.id));
        if (!myRoom) return null;
        const me = myRoom.players.find((p) => p.id === user?.id)!;
        return (
          <div className="mt-5 rounded-2xl border border-lotus-400/25 bg-lotus-500/[0.06] p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="flex items-center gap-2 font-semibold text-mist-100">🎮 Your match room — Room {myRoom.roomNumber}</h2>
              <span className={cn("rounded-full px-2.5 py-1 text-[11px] font-bold capitalize", me.qualified ? "bg-emerald-500/15 text-emerald-300" : me.eliminated ? "bg-rose-500/15 text-rose-300" : "bg-amber-500/15 text-amber-300")}>{me.qualified ? "Qualified ✓" : me.eliminated ? "Eliminated" : myRoom.status === "qualifying" ? "In progress" : "Ready"}</span>
            </div>
            <div className="mt-2 flex flex-wrap gap-2 text-xs text-mist-300">
              <span className="rounded-lg bg-ink-900/60 px-2.5 py-1">Round {myRoom.roundNumber}</span>
              <span className="rounded-lg bg-ink-900/60 px-2.5 py-1 font-mono">Room ID: {myRoom.id.replace("trm_", "")}</span>
              <span className="rounded-lg bg-ink-900/60 px-2.5 py-1">🔑 Password: <b className="text-mist-100">{myRoom.password}</b></span>
              <span className="rounded-lg bg-ink-900/60 px-2.5 py-1">Qualify: {myRoom.qualifiedCount}/{myRoom.winnersRequired}</span>
            </div>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {myRoom.players.map((p) => (
                <span key={p.id} className={cn("inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px]", p.qualified ? "bg-emerald-500/15 font-semibold text-emerald-300" : p.eliminated ? "bg-white/[0.04] text-mist-500 line-through" : "bg-white/[0.06] text-mist-200")}>
                  <span className={cn("inline-block size-1.5 rounded-full", p.online ? "bg-emerald-400" : "bg-mist-600")} />
                  {p.name}{p.id === user?.id ? " (you)" : ""}
                  {myRoom.status === "waiting" && t.readyCheck !== false && !p.eliminated && (
                    p.ready ? <b className="text-emerald-300">✓</b> : p.absent ? <b className="text-rose-300">absent</b> : null
                  )}
                </span>
              ))}
            </div>
            {/* READY check — press READY before the deadline; when everyone is
                ready the match starts by itself (admin-controlled). */}
            {myRoom.status === "waiting" && t.readyCheck !== false && !me.eliminated && (
              <div className="mt-3 flex flex-wrap items-center gap-2.5">
                {me.ready ? (
                  <span className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-500/15 px-4 py-2 text-sm font-bold text-emerald-300">✓ You are READY — waiting for the others…</span>
                ) : (
                  <button
                    onClick={async () => {
                      const r = await pressReady(t.id, myRoom.id);
                      if (r.ok) { toast(r.allReady ? "Everyone is ready — the match is starting! 🎲" : "You're READY ✓ Waiting for the other players…", "success"); load(); }
                      else toast(r.error ?? "Could not set READY", "error");
                    }}
                    className="inline-flex items-center gap-2 rounded-xl bg-emerald-500 px-5 py-2 text-sm font-extrabold text-white transition hover:bg-emerald-400"
                  >
                    ✔ I&apos;M READY
                  </button>
                )}
                {myRoom.joinDeadline && new Date(myRoom.joinDeadline).getTime() > Date.now() && (
                  <span className="text-xs font-semibold text-amber-300">
                    ⏰ Press READY before {new Date(myRoom.joinDeadline).toLocaleTimeString("en-SA", { hour: "2-digit", minute: "2-digit" })} or you may be replaced
                  </span>
                )}
                {me.absent && <span className="text-xs font-semibold text-rose-300">You were marked absent — press READY to come back before you are replaced.</span>}
              </div>
            )}
            {/* One-tap entry to the match's voice room (found by its name). */}
            {matchRoomId ? (
              <Link href={`/rooms/${matchRoomId}`} className="mt-3 inline-flex items-center gap-2 rounded-xl bg-lotus-500 px-4 py-2 text-sm font-bold text-white transition hover:bg-lotus-400">
                🎮 Enter my match room
              </Link>
            ) : (
              <p className="mt-3 text-xs text-mist-500">
                Look for the room named <b className="text-mist-200">{myRoom.name}</b> in Voice Rooms and enter with the password above.
              </p>
            )}
          </div>
        );
      })()}

      {/* Champion / standings (once the admin has decided the final) */}
      {t.championName && (
        <div className="mt-5 rounded-2xl border border-gold-400/25 bg-gold-400/[0.06] p-4">
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-gold-500/20 px-3 py-1 font-bold text-gold-200"><Trophy className="size-4" /> Champion: {t.championName}</span>
            {t.runnerUpName && <span className="rounded-full bg-white/[0.06] px-3 py-1 text-mist-200">🥈 Runner-up: {t.runnerUpName}</span>}
            {(t.thirdNames ?? []).map((n, i) => <span key={i} className="rounded-full bg-white/[0.06] px-3 py-1 text-mist-300">{i === 0 ? "🥉 3rd" : "4th"}: {n}</span>)}
          </div>
        </div>
      )}

      {/* Bracket — ONLY the real admin-recorded bracket is ever shown. (The old
          page invented a placeholder bracket with made-up winners when none was
          recorded — that misled players, so now an honest empty state shows.) */}
      {t.bracketRounds?.length ? (
        <div className="mt-6">
          <h2 className="mb-3 font-semibold text-mist-100">Bracket</h2>
          <div className="flex gap-4 overflow-x-auto pb-2">
            {t.bracketRounds
              .map((rd) => ({ name: rd.name, matches: rd.matches.map((m) => ({ a: m.aName, b: m.bName, winner: (m.winnerId ? (m.winnerId === m.aId ? "a" : "b") : undefined) as "a" | "b" | undefined })) }))
              .map((round, ri) => (
                <div key={ri} className="min-w-44 shrink-0">
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-mist-500">{round.name}</p>
                  <div className="flex flex-col justify-around gap-3" style={{ minHeight: `${round.matches.length * 64}px` }}>
                    {round.matches.map((m, mi) => <MatchCard key={mi} m={m} />)}
                  </div>
                </div>
              ))}
          </div>
        </div>
      ) : t.joinedNames.length >= 2 && t.status !== "cancelled" ? (
        <div className="mt-6">
          <h2 className="mb-3 font-semibold text-mist-100">Bracket</h2>
          <p className="rounded-xl border border-white/8 bg-ink-850 px-4 py-6 text-center text-sm text-mist-500">
            The bracket appears here once the admin generates it{t.status === "upcoming" ? " (after registration closes)" : ""}.
          </p>
        </div>
      ) : null}

      {/* Full-screen poster preview — the WHOLE poster, no cropping. */}
      {posterOpen && t.poster && (
        <div className="fixed inset-0 z-[140] grid place-items-center bg-black/85 p-4" onClick={() => setPosterOpen(false)}>
          <button onClick={() => setPosterOpen(false)} className="absolute right-4 top-4 grid size-10 place-items-center rounded-full bg-white/10 text-white transition hover:bg-white/20" aria-label="Close">
            <X className="size-5" />
          </button>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={t.poster} alt={`${t.title} poster`} className="max-h-[92vh] max-w-full rounded-xl object-contain" onClick={(e) => e.stopPropagation()} />
        </div>
      )}
    </div>
  );
}

function MatchCard({ m }: { m: TMatch }) {
  const side = (name: string | null, which: "a" | "b") => (
    <div className={cn("flex items-center gap-2 rounded-md px-2 py-1.5 text-sm", m.winner === which ? "bg-emerald-500/15 font-semibold text-emerald-200" : "text-mist-300")}>
      {name ? <><Avatar name={name} size="xs" /> <span className="truncate">{name}</span></> : <span className="text-mist-600">TBD</span>}
      {m.winner === which && <Trophy className="ml-auto size-3.5 text-gold-300" />}
    </div>
  );
  return (
    <div className="rounded-lg border border-white/8 bg-ink-850 p-1.5">
      {side(m.a, "a")}
      <div className="my-1 h-px bg-white/5" />
      {side(m.b, "b")}
    </div>
  );
}
