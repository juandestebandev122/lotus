"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import { cn } from "@/lib/cn";
import { fetchCompetitions, createCompetition, type CompetitionCard } from "@/lib/competitions";
import { deleteRoom } from "@/lib/rooms";
import { useConfig, saveConfig } from "@/lib/config";
import { lbl } from "@/lib/labels";
import { Swords, Plus, Trophy, Users, Radio, X, Loader2, ExternalLink, Trash2, Gift, Coins, Medal, Power, Save } from "lucide-react";

const STATUS: Record<string, { label: string; tone: string }> = {
  setup: { label: "Registration open", tone: "bg-amber-500/15 text-amber-300" },
  live: { label: "LIVE", tone: "bg-rose-500/15 text-rose-300" },
  paused: { label: "Paused", tone: "bg-amber-500/15 text-amber-300" },
  ended: { label: "Awaiting results", tone: "bg-white/[0.06] text-mist-300" },
  results: { label: "Results published", tone: "bg-emerald-500/15 text-emerald-300" },
};

export default function AdminCompetitionsPage() {
  const { toast } = useToast();
  const [comps, setComps] = useState<CompetitionCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState("");

  const load = useCallback(() => fetchCompetitions().then((c) => { setComps(c); setLoading(false); }), []);
  useEffect(() => { load(); }, [load]);

  const remove = async (c: CompetitionCard) => {
    if (!confirm(`Delete the competition "${c.title}"? This removes its room too.`)) return;
    setBusy(c.roomId);
    const ok = await deleteRoom(c.roomId);
    setBusy("");
    if (ok) { toast("Competition deleted", "info"); load(); } else toast("Could not delete", "error");
  };

  return (
    <div className="mx-auto max-w-5xl">
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 font-display text-2xl font-extrabold text-mist-100"><Swords className="size-6 text-lotus-300" /> Competitions</h1>
          <p className="mt-0.5 text-sm text-mist-400">Create and manage singing competitions. Only admins can create — you have full control inside each room (registration, staff & permissions, voting, results).</p>
        </div>
        <Button onClick={() => setOpen(true)}><Plus className="size-4" /> Create competition</Button>
      </div>

      <PrizeControls />

      {loading ? (
        <div className="grid h-40 place-items-center text-mist-400"><Loader2 className="size-5 animate-spin" /></div>
      ) : comps.length === 0 ? (
        <Card className="p-10 text-center">
          <Swords className="mx-auto size-9 text-mist-600" />
          <p className="mt-2 text-sm text-mist-400">No competitions yet — tap “Create competition”.</p>
        </Card>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-white/10">
          <table className="w-full text-left text-sm">
            <thead className="bg-white/[0.03] text-xs uppercase tracking-wide text-mist-400">
              <tr>
                <th className="px-4 py-3 font-semibold">Competition</th>
                <th className="px-4 py-3 font-semibold">Status</th>
                <th className="px-4 py-3 font-semibold">Singers</th>
                <th className="px-4 py-3 font-semibold">Voted</th>
                <th className="px-4 py-3 text-right font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody>
              {comps.map((c) => (
                <tr key={c.roomId} className="border-t border-white/5 hover:bg-white/[0.02]">
                  <td className="px-4 py-3">
                    <div className="font-semibold text-mist-100">{c.title}</div>
                    <div className="text-[11px] text-mist-500">Host: {c.hostName}{c.prize ? ` · 🎁 ${c.prize}` : ""}</div>
                  </td>
                  <td className="px-4 py-3"><span className={cn("rounded-full px-2 py-0.5 text-[11px] font-semibold", (STATUS[c.status] ?? STATUS.setup).tone)}>{(STATUS[c.status] ?? STATUS.setup).label}</span></td>
                  <td className="px-4 py-3 text-mist-300"><span className="inline-flex items-center gap-1"><Users className="size-3.5" /> {c.participantCount}</span></td>
                  <td className="px-4 py-3 text-mist-300"><span className="inline-flex items-center gap-1"><Trophy className="size-3.5" /> {c.audience}</span></td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1">
                      <Link href={`/rooms/${c.roomId}`} target="_blank" title="Open & manage" className="inline-flex items-center gap-1 rounded-lg bg-lotus-500/15 px-2.5 py-1.5 text-xs font-semibold text-lotus-200 hover:bg-lotus-500/25"><ExternalLink className="size-3.5" /> Open &amp; manage</Link>
                      <button title="Delete" onClick={() => remove(c)} disabled={busy === c.roomId} className="grid size-8 place-items-center rounded-lg text-rose-300 hover:bg-rose-500/10">{busy === c.roomId ? <Loader2 className="size-4 animate-spin" /> : <Trash2 className="size-4" />}</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <p className="mt-4 text-xs text-mist-500">Tip: “Open &amp; manage” opens the competition room where you (Admin/Super Admin) have full control — open/close registration, approve singers, assign Host/Co-Host/Moderator/Judge with per-permission toggles, start/pause/end, declare results, and set fees/seats/support staff.</p>

      {open && <CreateModal onClose={() => setOpen(false)} onCreated={() => { setOpen(false); load(); }} />}
    </div>
  );
}

const DEFAULT_PRIZES = [
  { coins: 1000, enabled: true }, { coins: 500, enabled: true }, { coins: 250, enabled: true }, { coins: 100, enabled: false },
];

// Admin control for the 4 competition prize positions — each with a coin amount
// and an individual ON/OFF toggle. When results are declared, each ENABLED
// position pays its coins to that rank's singer.
function PrizeControls() {
  const { toast } = useToast();
  const { config, reload } = useConfig();
  const term = lbl(config.labels, "term.prize"); // "Support Staff" (admin-configurable)
  const [prizes, setPrizes] = useState<{ coins: number; enabled: boolean }[]>(DEFAULT_PRIZES);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const p = config.competitionPrizes;
    setPrizes(Array.from({ length: 4 }, (_, i) => p?.[i] ?? DEFAULT_PRIZES[i]));
  }, [config.competitionPrizes]);

  const setCoins = (i: number, v: number) => setPrizes((p) => p.map((x, j) => (j === i ? { ...x, coins: Math.max(0, v) } : x)));
  const toggle = (i: number) => setPrizes((p) => p.map((x, j) => (j === i ? { ...x, enabled: !x.enabled } : x)));
  const save = async () => {
    setBusy(true);
    const res = await saveConfig({ competitionPrizes: prizes });
    setBusy(false);
    if (res.ok) { toast(`${term} saved`, "success"); reload(); } else toast(res.error ?? "Could not save", "error");
  };

  return (
    <Card className="mb-5 p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 text-sm font-bold text-mist-100"><Medal className="size-4 text-gold-300" /> {term}</h2>
        <span className="text-[11px] text-mist-500">Enable/disable each position independently. Enabled positions pay their coins to that rank when results are declared.</span>
      </div>
      <div className="grid gap-2.5 sm:grid-cols-2">
        {prizes.map((p, i) => (
          <div key={i} className={cn("flex items-center gap-3 rounded-xl border px-3 py-2.5", p.enabled ? "border-gold-400/30 bg-gold-500/[0.06]" : "border-white/10 bg-ink-800/40 opacity-70")}>
            <Medal className={cn("size-5 shrink-0", i === 0 ? "text-gold-300" : i === 1 ? "text-mist-300" : i === 2 ? "text-amber-600" : "text-mist-500")} />
            <div className="min-w-0 flex-1">
              <div className="text-sm font-semibold text-mist-100">{term} {i + 1}</div>
              <div className="mt-1 flex items-center gap-1.5">
                <input type="number" min={0} value={p.coins} onChange={(e) => setCoins(i, Number(e.target.value) || 0)} className="h-8 w-24 rounded-lg border border-line bg-ink-800 px-2 text-sm text-mist-100 outline-none focus:border-lotus-400" />
                <span className="text-xs text-gold-300">🪙 coins</span>
              </div>
            </div>
            <button onClick={() => toggle(i)} className={cn("inline-flex shrink-0 items-center gap-1 rounded-full px-3 py-1.5 text-xs font-bold transition", p.enabled ? "bg-emerald-500/20 text-emerald-300" : "bg-white/[0.06] text-mist-400")}>
              <Power className="size-3.5" /> {p.enabled ? "ON" : "OFF"}
            </button>
          </div>
        ))}
      </div>
      <div className="mt-3 flex justify-end"><Button size="sm" onClick={save} disabled={busy}><Save className="size-4" /> {busy ? "Saving…" : "Save"}</Button></div>
    </Card>
  );
}

function CreateModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const { toast } = useToast();
  const [title, setTitle] = useState("");
  const [prize, setPrize] = useState("");
  const [regFee, setRegFee] = useState(0);
  const [winnerPrize, setWinnerPrize] = useState(0);
  const [busy, setBusy] = useState(false);
  const field = "h-10 w-full rounded-lg border border-line bg-ink-800 px-3 text-sm text-mist-100 outline-none placeholder:text-mist-500 focus:border-lotus-400";
  const submit = async () => {
    if (!title.trim()) return toast("Enter a competition title", "error");
    setBusy(true);
    const res = await createCompetition(title.trim(), prize.trim() || undefined, { registrationFeeCoins: regFee, winnerPrizeCoins: winnerPrize });
    setBusy(false);
    if (res.ok) { toast("Competition created! Open it to manage.", "success"); onCreated(); }
    else toast(res.error ?? "Could not create", "error");
  };
  return (
    <div className="fixed inset-0 z-[70] grid place-items-center overflow-y-auto bg-black/60 p-4" onClick={onClose}>
      <div className="my-8 w-full max-w-md rounded-2xl border border-white/10 bg-ink-850 p-5" onClick={(e) => e.stopPropagation()}>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="flex items-center gap-2 font-display text-lg font-bold text-mist-100"><Swords className="size-5 text-lotus-300" /> Create competition</h2>
          <button onClick={onClose} className="text-mist-400 hover:text-mist-100"><X className="size-5" /></button>
        </div>
        <label className="text-xs font-semibold text-mist-300">Title</label>
        <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Friday Singing Battle" autoFocus className={cn(field, "mt-1")} maxLength={80} />
        <label className="mt-3 block text-xs font-semibold text-mist-300">Reward note (text, optional)</label>
        <input value={prize} onChange={(e) => setPrize(e.target.value)} placeholder="e.g. Trophy + winner badge" className={cn(field, "mt-1")} maxLength={120} />
        <div className="mt-3 grid grid-cols-2 gap-3">
          <div><label className="flex items-center gap-1 text-xs font-semibold text-mist-300"><Coins className="size-3.5" /> Registration fee</label><input type="number" min={0} value={regFee} onChange={(e) => setRegFee(Number(e.target.value) || 0)} className={cn(field, "mt-1")} /></div>
          <div><label className="flex items-center gap-1 text-xs font-semibold text-mist-300"><Gift className="size-3.5" /> Winner amount</label><input type="number" min={0} value={winnerPrize} onChange={(e) => setWinnerPrize(Number(e.target.value) || 0)} className={cn(field, "mt-1")} /></div>
        </div>
        <Button block className="mt-5" onClick={submit} disabled={busy || !title.trim()}>{busy ? "Creating…" : "Create competition"}</Button>
      </div>
    </div>
  );
}
