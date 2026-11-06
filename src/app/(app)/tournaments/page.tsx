"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Trophy, Plus, Coins, Users, Dices, Crown, Radio, X, Clock, Check, ScrollText } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import { BrandImg } from "@/components/BrandImg";
import { cn } from "@/lib/cn";
import { useAuth } from "@/lib/auth";
import {
  fetchTournaments,
  createTournament,
  requestJoin,
  type TournamentView,
  type TGame,
  type MyStatus,
} from "@/lib/tournaments-api";

const STATUS_STYLE: Record<TournamentView["status"], string> = {
  live: "bg-rose-500/20 text-rose-300",
  upcoming: "bg-lotus-500/20 text-lotus-200",
  completed: "bg-emerald-500/15 text-emerald-300",
  cancelled: "bg-white/10 text-mist-400",
};

const MY: Record<MyStatus, { label: string; cls: string } | null> = {
  none: null,
  pending: { label: "Request pending", cls: "bg-amber-500/15 text-amber-300" },
  approved: { label: "✓ Approved", cls: "bg-emerald-500/15 text-emerald-300" },
  rejected: { label: "Request declined", cls: "bg-rose-500/15 text-rose-300" },
  joined: { label: "✓ You're in", cls: "bg-emerald-500/15 text-emerald-300" },
};

export default function TournamentsPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const isAdmin = user?.role === "admin";
  const [list, setList] = useState<TournamentView[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);

  const load = () => fetchTournaments().then((t) => { setList(t); setLoading(false); });
  useEffect(() => { load(); }, []);

  const join = async (t: TournamentView) => {
    setBusy(t.id);
    const res = await requestJoin(t.id);
    setBusy(null);
    if (res.ok) {
      toast("Join request submitted — awaiting admin approval", "success");
      load();
    } else {
      toast(res.error ?? "Could not request to join", "error");
    }
  };

  return (
    <div className="mx-auto max-w-5xl">
      <div className="relative mb-6 overflow-hidden rounded-2xl border border-white/10 bg-[linear-gradient(120deg,rgba(245,158,11,0.18),rgba(124,58,237,0.22))] p-5 sm:p-6">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h1 className="font-display text-3xl font-extrabold text-mist-100">Tournaments</h1>
            <p className="mt-1 max-w-md text-mist-300">Compete in Ludo &amp; Chess brackets.</p>
            <div className="mt-4 flex flex-wrap items-center gap-2">
              {isAdmin && (
                <Button onClick={() => setOpen(true)}>
                  <Plus className="size-4" /> Create tournament
                </Button>
              )}
              <Link href="/tournaments/my-requests" className="inline-flex items-center gap-1.5 rounded-lg bg-white/[0.08] px-3 py-2 text-sm font-semibold text-mist-200 hover:bg-white/[0.14]">
                <ScrollText className="size-4 text-lotus-300" /> My requests
              </Link>
            </div>
          </div>
          <BrandImg slot="tourneyTrophy" className="hidden w-32 shrink-0 animate-float drop-shadow-xl sm:block" />
        </div>
      </div>

      {loading ? (
        <p className="py-10 text-center text-sm text-mist-400">Loading tournaments…</p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {list.map((t) => {
            const GameIcon = t.game === "Ludo" ? Dices : Crown;
            const my = MY[t.myStatus];
            const canRequest = t.myStatus === "none" && t.regOpen && t.status !== "completed";
            return (
              <div key={t.id} className="relative overflow-hidden rounded-xl border border-white/8 bg-ink-850 p-5">
                <Link href={`/tournaments/${t.id}`} className="block">
                  {/* Poster (when set) — members see it before joining */}
                  {t.poster && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={t.poster} alt={`${t.title} poster`} className="mb-4 h-36 w-full rounded-lg object-cover" />
                  )}
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <span className="grid size-11 place-items-center rounded-lg bg-gold-400/12 text-gold-300">
                        <GameIcon className="size-5" />
                      </span>
                      <div>
                        <h2 className="font-display text-lg font-bold text-mist-100">{t.title}</h2>
                        <p className="text-xs text-mist-400">{t.game} · Knockout</p>
                      </div>
                    </div>
                    <span className={cn("inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide", STATUS_STYLE[t.status])}>
                      {t.status === "live" && <Radio className="size-3" />}
                      {t.status}
                    </span>
                  </div>

                  <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-mist-300">
                    <span className="inline-flex items-center gap-1 font-semibold text-gold-300"><Coins className="size-4" /> {t.prize.toLocaleString("en-SA")}</span>
                    <span className="inline-flex items-center gap-1 text-mist-400"><Users className="size-4" /> {t.stats.joined}/{t.capacity} joined</span>
                    {t.entry > 0 && <span className="text-xs text-mist-400">Entry {t.entry}</span>}
                  </div>

                  {/* Prize breakdown (1st–4th) */}
                  {t.prizes.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {t.prizes.map((p) => (
                        <span key={p.place} className="rounded-full bg-gold-400/10 px-2 py-0.5 text-[11px] text-gold-200">
                          {p.place === 1 ? "1st" : p.place === 2 ? "2nd" : p.place === 3 ? "3rd" : "4th"}: {p.amount.toLocaleString("en-SA")}
                        </span>
                      ))}
                    </div>
                  )}

                  {t.description && <p className="mt-2 line-clamp-2 text-xs text-mist-400">{t.description}</p>}
                </Link>

                {/* Registration / join */}
                <div className="mt-4 flex items-center gap-2">
                  {my && <span className={cn("rounded-lg px-2.5 py-1 text-xs font-semibold", my.cls)}>{my.label}</span>}
                  {t.isFull && t.myStatus === "none" && (
                    <span className="rounded-lg bg-rose-500/15 px-2.5 py-1 text-xs font-semibold text-rose-300">Tournament Full</span>
                  )}
                  {!t.isFull && !t.regOpen && t.myStatus === "none" && t.status !== "completed" && (
                    <span className="inline-flex items-center gap-1 rounded-lg bg-white/[0.06] px-2.5 py-1 text-xs font-semibold text-mist-400"><Clock className="size-3.5" /> Registration closed</span>
                  )}
                  {canRequest && (
                    <Button size="sm" className="ml-auto" disabled={busy === t.id} onClick={() => join(t)}>
                      <Check className="size-4" /> {busy === t.id ? "Sending…" : "Request to join"}
                    </Button>
                  )}
                  <span className="ml-auto text-[11px] text-mist-500">{t.stats.remaining} slots left</span>
                </div>
              </div>
            );
          })}
          {list.length === 0 && <p className="col-span-2 py-8 text-center text-sm text-mist-500">No tournaments yet.</p>}
        </div>
      )}

      {open && (
        <CreateModal onClose={() => setOpen(false)} onCreated={() => { load(); setOpen(false); toast("Tournament created", "success"); }} />
      )}
    </div>
  );
}

function CreateModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const { toast } = useToast();
  const [title, setTitle] = useState("");
  const [game, setGame] = useState<TGame>("Ludo");
  const [prize, setPrize] = useState(2000);
  const [entry, setEntry] = useState(50);
  const [capacity, setCapacity] = useState(16);
  const [busy, setBusy] = useState(false);
  const field = "mt-1.5 h-11 w-full rounded-xl border border-line bg-ink-800 px-3.5 text-sm text-mist-100 outline-none focus:border-lotus-400";

  const submit = async () => {
    if (!title.trim()) { toast("Please enter a title", "error"); return; }
    setBusy(true);
    const ok = await createTournament({ title, game, prize, entry, capacity, regOpen: true });
    setBusy(false);
    if (ok) onCreated();
    else toast("Could not create tournament", "error");
  };

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4" onClick={onClose}>
      <div className="w-full max-w-md rounded-2xl border border-white/10 bg-ink-850 p-6" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h2 className="font-display text-xl font-bold text-mist-100">Create Tournament</h2>
          <button onClick={onClose} className="text-mist-400 hover:text-mist-100"><X className="size-5" /></button>
        </div>
        <label className="mt-5 block text-sm font-semibold text-mist-200">Title</label>
        <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Friday Night Cup" autoFocus className={field} />
        <label className="mt-4 block text-sm font-semibold text-mist-200">Game</label>
        <div className="mt-1.5 grid grid-cols-2 gap-2">
          {(["Ludo", "Chess"] as TGame[]).map((g) => (
            <button key={g} onClick={() => setGame(g)} className={cn("flex h-11 items-center justify-center gap-2 rounded-xl border text-sm font-semibold transition", game === g ? "border-lotus-400 bg-lotus-500/20 text-white" : "border-line bg-ink-800 text-mist-300 hover:border-lotus-400/40")}>
              {g === "Ludo" ? <Dices className="size-4" /> : <Crown className="size-4" />} {g}
            </button>
          ))}
        </div>
        <div className="mt-4 grid grid-cols-3 gap-3">
          <div>
            <label className="block text-sm font-semibold text-mist-200">Total pool</label>
            <input type="number" value={prize} min={0} onChange={(e) => setPrize(Math.max(0, Number(e.target.value)))} className={field} />
          </div>
          <div>
            <label className="block text-sm font-semibold text-mist-200">Entry</label>
            <input type="number" value={entry} min={0} onChange={(e) => setEntry(Math.max(0, Number(e.target.value)))} className={field} />
          </div>
          <div>
            <label className="block text-sm font-semibold text-mist-200">Max players</label>
            <input type="number" value={capacity} min={2} onChange={(e) => setCapacity(Math.max(2, Number(e.target.value)))} className={field} />
          </div>
        </div>
        <Button block size="lg" className="mt-6" onClick={submit} disabled={busy}>
          <Trophy className="size-5" /> {busy ? "Creating…" : "Create tournament"}
        </Button>
      </div>
    </div>
  );
}
