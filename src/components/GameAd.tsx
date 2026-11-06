"use client";

import { useConfig } from "@/lib/config";
import { withBase } from "@/lib/base-path";

// A small, NON-INTRUSIVE advertisement strip for the game-playing screen (Admin →
// Advertisements, position "Game screen — top"). Shows the highest-priority active
// gameTop ad as a thin bar: an optional small banner image + an optional one-line
// running/scrolling text ticker. It sits above the board and never overlaps the dice,
// tokens or controls. Renders nothing when there's no active game ad.
export function GameAd() {
  const { config } = useConfig();
  const ads = (config.ads ?? [])
    .filter((a) => a.active && a.position === "gameTop" && (a.imageUrl || a.text || a.title))
    .sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0));
  if (ads.length === 0) return null;
  const ad = ads[0];

  const body = (
    <div className="flex items-center gap-2 overflow-hidden rounded-lg border border-line bg-ink-800/80 px-2 py-1">
      <span className="shrink-0 rounded bg-lotus-500/20 px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-wide text-lotus-200">Ad</span>
      {ad.imageUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={ad.imageUrl.startsWith("data:") ? ad.imageUrl : withBase(ad.imageUrl)} alt={ad.title} className="h-6 w-auto max-w-[40%] shrink-0 rounded object-contain" draggable={false} />
      )}
      {ad.text ? (
        <div className="min-w-0 flex-1 overflow-hidden">
          <span className="game-ad-track inline-block whitespace-nowrap text-[11px] text-mist-200">{ad.text}</span>
        </div>
      ) : (
        <span className="min-w-0 flex-1 truncate text-[11px] text-mist-200">{ad.title}</span>
      )}
    </div>
  );

  const href = ad.linkUrl ? (ad.linkUrl.startsWith("http") ? ad.linkUrl : withBase(ad.linkUrl)) : "";
  return (
    <>
      <style>{"@keyframes gameAdScroll{0%{transform:translateX(100%)}100%{transform:translateX(-100%)}}.game-ad-track{animation:gameAdScroll 15s linear infinite}@media(prefers-reduced-motion:reduce){.game-ad-track{animation:none}}"}</style>
      {href ? <a href={href} target="_blank" rel="noopener noreferrer" className="block">{body}</a> : body}
    </>
  );
}
