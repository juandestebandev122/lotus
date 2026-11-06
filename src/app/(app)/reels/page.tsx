"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { Plus, Trophy, Film } from "lucide-react";
import { useConfig } from "@/lib/config";
import { ButtonLink } from "@/components/ui/Button";
import { ReelFeed } from "@/components/reels/ReelFeed";
import { fetchReel, type Reel } from "@/lib/reels";

function ReelsInner() {
  const { config } = useConfig();
  const params = useSearchParams();
  const focusId = params.get("r");
  const kind = params.get("kind") === "video" ? "video" : undefined;
  const scope = params.get("scope") === "business" ? "business" : params.get("scope") === "user" ? "user" : undefined;
  const [single, setSingle] = useState<Reel | null>(null);
  const [loadingSingle, setLoadingSingle] = useState(!!focusId);

  useEffect(() => {
    let alive = true;
    if (focusId) {
      setLoadingSingle(true);
      fetchReel(focusId).then((r) => { if (alive) { setSingle(r); setLoadingSingle(false); } });
    } else {
      setSingle(null);
    }
    return () => { alive = false; };
  }, [focusId]);

  if (config.features?.reels === false) {
    return (
      <div className="grid min-h-[60vh] place-items-center px-6 text-center">
        <div>
          <div className="mx-auto mb-3 grid size-14 place-items-center rounded-2xl bg-white/[0.06]"><Film className="size-7 text-mist-300" /></div>
          <h1 className="text-lg font-bold text-mist-100">Reels are currently unavailable</h1>
          <p className="mt-1 text-sm text-mist-400">This feature has been turned off by the admin.</p>
        </div>
      </div>
    );
  }

  const title = `${scope === "user" ? "User " : scope === "business" ? "Business " : ""}${kind === "video" ? "Videos" : "Reels"}`;

  return (
    <div className="mx-auto w-full max-w-[440px]">
      <div className="mb-3 flex items-center justify-between">
        <h1 className="flex items-center gap-2 text-xl font-extrabold text-mist-100"><Film className="size-5 text-lotus-300" /> {title}</h1>
        <div className="flex items-center gap-2">
          <Link href="/reels/leaderboard" title="Reel leaderboards" className="grid size-9 place-items-center rounded-full bg-ink-800 text-gold-300 hover:bg-ink-700"><Trophy className="size-4" /></Link>
          <ButtonLink href={`/reels/create${kind === "video" ? "?kind=video" : ""}`} size="sm"><Plus className="size-4" /> Create</ButtonLink>
        </div>
      </div>

      {focusId ? (
        loadingSingle ? (
          <div className="grid h-[60vh] place-items-center text-mist-400"><span className="animate-pulse text-sm">Loading reel…</span></div>
        ) : single ? (
          <div>
            <ReelFeed reels={[single]} />
            <div className="mt-3 text-center">
              <Link href="/reels" className="text-sm font-semibold text-lotus-300 hover:underline">← Browse all reels</Link>
            </div>
          </div>
        ) : (
          <div className="grid h-[50vh] place-items-center px-6 text-center">
            <div>
              <p className="text-sm text-mist-300">This reel isn&apos;t available.</p>
              <Link href="/reels" className="mt-2 inline-block text-sm font-semibold text-lotus-300 hover:underline">Browse all reels</Link>
            </div>
          </div>
        )
      ) : (
        <ReelFeed showTabs kind={kind} scope={scope} emptyHint={`No ${title.toLowerCase()} yet — be the first to post one!`} />
      )}
    </div>
  );
}

export default function ReelsPage() {
  return (
    <Suspense fallback={<div className="grid min-h-[50vh] place-items-center text-mist-400"><span className="animate-pulse text-sm">Loading…</span></div>}>
      <ReelsInner />
    </Suspense>
  );
}
