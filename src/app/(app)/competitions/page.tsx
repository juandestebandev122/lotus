"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Avatar } from "@/components/ui/Avatar";
import { useToast } from "@/components/ui/Toast";
import { cn } from "@/lib/cn";
import { useAuth } from "@/lib/auth";
import { fetchCompetitions, createCompetition, type CompetitionCard } from "@/lib/competitions";
import { Swords, Plus, Trophy, Users, Radio, X, Loader2, Gift } from "lucide-react";

const STATUS: Record<string, { label: string; tone: string }> = {
  setup: { label: "Registration open", tone: "bg-amber-500/15 text-amber-300" },
  live: { label: "LIVE", tone: "bg-rose-500/15 text-rose-300" },
  paused: { label: "Paused", tone: "bg-amber-500/15 text-amber-300" },
  ended: { label: "Awaiting results", tone: "bg-white/[0.06] text-mist-400" },
  results: { label: "Results out", tone: "bg-emerald-500/15 text-emerald-300" },
};

export default function CompetitionsPage() {
  const { toast } = useToast();
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  const [comps, setComps] = useState<CompetitionCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);

  const load = useCallback(() => fetchCompetitions().then((c) => { setComps(c); setLoading(false); }), []);
  useEffect(() => { load(); const t = setInterval(load, 15000); return () => clearInterval(t); }, [load]);

  return (
    <div className="mx-auto max-w-4xl">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 font-display text-3xl font-extrabold text-mist-100"><Swords className="size-7 text-lotus-300" /> Competitions</h1>
          <p className="mt-1 text-mist-300">Join a live competition — singers perform, the audience votes 0–10, and a winner is crowned.</p>
        </div>
        {/* Only an ADMIN can create/announce a competition (per the workflow). */}
        {isAdmin && <Button onClick={() => setOpen(true)}><Plus className="size-4" /> Start a competition</Button>}
      </div>

      {loading ? (
        <div className="grid h-40 place-items-center text-mist-400"><Loader2 className="size-5 animate-spin" /></div>
      ) : comps.length === 0 ? (
        <Card className="px-4 py-14 text-center">
          <Swords className="mx-auto size-9 text-mist-600" />
          <p className="mt-3 font-semibold text-mist-200">No competitions yet</p>
          <p className="mt-1 text-sm text-mist-400">{isAdmin ? "Tap “Start a competition” to announce one." : "Check back soon — an admin will announce the next competition."}</p>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {comps.map((c) => (
            <Link key={c.roomId} href={`/rooms/${c.roomId}`} className="group block overflow-hidden rounded-2xl border border-white/10 bg-ink-850/60 p-5 transition hover:border-lotus-400/50 hover:bg-ink-850">
              <div className="flex items-start gap-3">
                <Avatar name={c.title} src={c.image || undefined} size="lg" ring />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <h2 className="truncate font-display text-lg font-bold text-mist-100">{c.title}</h2>
                    {c.status === "live" && <span className="inline-flex items-center gap-1 rounded-full bg-rose-500/20 px-2 py-0.5 text-[10px] font-bold uppercase text-rose-300"><Radio className="size-3" /> Live</span>}
                  </div>
                  <p className="mt-0.5 truncate text-sm text-mist-300">Hosted by {c.hostName}</p>
                  {c.prize && <p className="mt-0.5 inline-flex items-center gap-1 text-xs text-gold-300"><Gift className="size-3.5" /> Prize: {c.prize}</p>}
                  <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-mist-400">
                    <span className={cn("rounded-full px-2 py-0.5 font-semibold", (STATUS[c.status] ?? STATUS.setup).tone)}>{(STATUS[c.status] ?? STATUS.setup).label}</span>
                    <span className="inline-flex items-center gap-1"><Users className="size-3.5" /> {c.participantCount} singers</span>
                    <span className="inline-flex items-center gap-1"><Trophy className="size-3.5" /> {c.audience} voted</span>
                  </div>
                </div>
              </div>
              <div className="mt-4 text-right">
                <span className="inline-flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-lotus-500 to-petal-500 px-4 py-2 text-sm font-semibold text-white shadow-sm transition group-hover:brightness-110">Enter room</span>
              </div>
            </Link>
          ))}
        </div>
      )}

      {open && <CreateModal onClose={() => setOpen(false)} />}
    </div>
  );

  function CreateModal({ onClose }: { onClose: () => void }) {
    const router = useRouter();
    const [title, setTitle] = useState("");
    const [prize, setPrize] = useState("");
    const [regFee, setRegFee] = useState(0);
    const [winnerPrize, setWinnerPrize] = useState(0);
    const [busy, setBusy] = useState(false);
    const field = "h-11 w-full rounded-xl border border-line bg-ink-800 px-3.5 text-sm text-mist-100 outline-none placeholder:text-mist-500 focus:border-lotus-400";
    const submit = async () => {
      if (!title.trim()) return toast("Enter a competition title", "error");
      setBusy(true);
      const res = await createCompetition(title.trim(), prize.trim() || undefined, { registrationFeeCoins: regFee, winnerPrizeCoins: winnerPrize });
      setBusy(false);
      if (res.ok && res.roomId) { toast("Competition room created! 🎤", "success"); router.push(`/rooms/${res.roomId}`); }
      else toast(res.error ?? "Could not create", "error");
    };
    return (
      <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4" onClick={onClose}>
        <div className="w-full max-w-md rounded-2xl border border-white/10 bg-ink-850 p-6" onClick={(e) => e.stopPropagation()}>
          <div className="flex items-center justify-between">
            <h2 className="flex items-center gap-2 font-display text-xl font-bold text-mist-100"><Swords className="size-5 text-lotus-300" /> Start a competition</h2>
            <button onClick={onClose} className="text-mist-400 hover:text-mist-100"><X className="size-5" /></button>
          </div>
          <label className="mt-5 block text-sm font-semibold text-mist-200">Competition title</label>
          <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Friday Singing Battle" autoFocus className={cn(field, "mt-1.5")} maxLength={80} />
          <label className="mt-4 block text-sm font-semibold text-mist-200">Reward note (optional, text)</label>
          <input value={prize} onChange={(e) => setPrize(e.target.value)} placeholder="e.g. Trophy + winner badge" className={cn(field, "mt-1.5")} maxLength={120} />
          <div className="mt-4 grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-semibold text-mist-200">Registration fee 🪙</label>
              <input type="number" min={0} value={regFee} onChange={(e) => setRegFee(Number(e.target.value) || 0)} className={cn(field, "mt-1.5")} />
              <p className="mt-1 text-[10px] text-mist-500">0 = free / unlimited</p>
            </div>
            <div>
              <label className="block text-sm font-semibold text-mist-200">Winner amount 🪙</label>
              <input type="number" min={0} value={winnerPrize} onChange={(e) => setWinnerPrize(Number(e.target.value) || 0)} className={cn(field, "mt-1.5")} />
              <p className="mt-1 text-[10px] text-mist-500">coins to the winner</p>
            </div>
          </div>
          <p className="mt-2 text-[11px] text-mist-500">A voice room opens for the competition. Users register, you approve singers, start the round, the audience votes 0–10, and you publish results (the winner gets the reward coins). You can also set fees, seats, and assign Hosts/Judges inside the room.</p>
          <Button block size="lg" className="mt-6" onClick={submit} disabled={busy || !title.trim()}>{busy ? "Creating…" : "Create & go live"}</Button>
        </div>
      </div>
    );
  }
}
