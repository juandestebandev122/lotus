"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Coins, Dices, Crown, ScrollText } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { cn } from "@/lib/cn";
import { fetchMyRequests, type MyTournamentRequest } from "@/lib/tournaments-api";

const PILL: Record<string, string> = {
  pending: "bg-amber-500/15 text-amber-300",
  approved: "bg-emerald-500/15 text-emerald-300",
  rejected: "bg-rose-500/15 text-rose-300",
};
const LABEL: Record<string, string> = { pending: "Pending", approved: "Approved", rejected: "Rejected" };

export default function MyRequestsPage() {
  const [items, setItems] = useState<MyTournamentRequest[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchMyRequests().then((r) => { setItems(r); setLoading(false); });
  }, []);

  return (
    <div className="mx-auto max-w-2xl">
      <Link href="/tournaments" className="mb-4 inline-flex items-center gap-2 text-sm text-mist-400 hover:text-mist-100">
        <ArrowLeft className="size-4" /> Tournaments
      </Link>
      <h1 className="flex items-center gap-2 font-display text-2xl font-extrabold text-mist-100">
        <ScrollText className="size-6 text-lotus-300" /> My tournament requests
      </h1>
      <p className="mt-1 text-sm text-mist-400">Track the status of every tournament you&apos;ve requested to join.</p>

      <div className="mt-5 space-y-3">
        {loading && <p className="text-sm text-mist-400">Loading…</p>}
        {!loading && items.length === 0 && (
          <Card className="p-10 text-center text-sm text-mist-500">
            You haven&apos;t requested to join any tournaments yet.
          </Card>
        )}
        {items.map((r) => {
          const GameIcon = r.game === "Ludo" ? Dices : Crown;
          return (
            <Card key={r.tournamentId} className="flex flex-wrap items-center gap-3 p-4">
              <span className="grid size-10 place-items-center rounded-lg bg-gold-400/12 text-gold-300">
                <GameIcon className="size-5" />
              </span>
              <div className="min-w-0 flex-1">
                <Link href={`/tournaments/${r.tournamentId}`} className="font-semibold text-mist-100 hover:text-lotus-200">{r.title}</Link>
                <p className="text-xs text-mist-500">
                  Requested {new Date(r.at).toLocaleDateString("en-SA", { day: "numeric", month: "short", year: "numeric" })}
                  {" · "}
                  <span className="inline-flex items-center gap-1 text-gold-300"><Coins className="size-3" /> {r.prize.toLocaleString("en-SA")}</span>
                </p>
                {r.joined && <p className="mt-1 text-xs font-semibold text-emerald-300">You&apos;re a confirmed participant 🎉</p>}
              </div>
              <span className={cn("rounded-full px-2.5 py-1 text-xs font-semibold", PILL[r.status])}>{LABEL[r.status]}</span>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
