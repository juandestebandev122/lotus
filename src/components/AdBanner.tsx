"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useConfig } from "@/lib/config";
import { withBase } from "@/lib/base-path";
import { X } from "lucide-react";

// Shows the ACTIVE advertisements the admin configured for a given position to
// real users. Rotates if there is more than one, tracks impressions/clicks, and
// links to the ad's target. Renders nothing when there are no active ads.
//
// The admin panel offers FIVE positions (top / sidebar / feed / interstitial /
// gameTop) — every one of them now has a real mount point in the app, so an ad
// created for any position actually appears somewhere. Previously only "top" on
// the home page was ever rendered, which is why banners looked like they only
// worked in one area.
type AdPosition = "top" | "sidebar" | "feed" | "interstitial" | "gameTop";

export function AdBanner({ position = "top", className }: { position?: AdPosition; className?: string }) {
  const { config } = useConfig();
  // Higher priority first, so the admin controls which ad leads a shared slot.
  const ads = (config.ads ?? [])
    .filter((a) => a.active && a.imageUrl && a.position === position)
    .sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0));
  const [i, setI] = useState(0);
  const [dismissed, setDismissed] = useState(false);
  const trackedRef = useRef<Set<string>>(new Set());

  // Rotate through multiple ads for the same slot.
  useEffect(() => {
    if (ads.length < 2) return;
    const t = setInterval(() => setI((n) => (n + 1) % ads.length), 7000);
    return () => clearInterval(t);
  }, [ads.length]);

  const ad = ads[i % Math.max(1, ads.length)];

  // An interstitial takes over the screen, so it shows ONCE per browser session
  // — the same rule the custom-upload popup uses. Checked in an effect (not
  // during render) so the server and first client render always agree.
  const [popupSeen, setPopupSeen] = useState(false);
  useEffect(() => {
    if (position !== "interstitial" || !ad) return;
    try { setPopupSeen(sessionStorage.getItem(`lotus.ad.${ad.id}`) === "1"); } catch { /* ignore */ }
  }, [position, ad?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Count one impression per ad shown.
  useEffect(() => {
    if (!ad || trackedRef.current.has(ad.id)) return;
    trackedRef.current.add(ad.id);
    fetch(withBase("/api/ads/track"), { method: "POST", headers: { "Content-Type": "application/json" }, credentials: "include", body: JSON.stringify({ adId: ad.id, type: "impression" }) }).catch(() => {});
  }, [ad?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!ad || dismissed) return null;

  const click = () => {
    fetch(withBase("/api/ads/track"), { method: "POST", headers: { "Content-Type": "application/json" }, credentials: "include", body: JSON.stringify({ adId: ad.id, type: "click" }) }).catch(() => {});
  };

  // The picture, wrapped in whatever link the ad points at (internal or external).
  const linked = (inner: React.ReactNode) => {
    if (!ad.linkUrl) return inner;
    return /^https?:\/\//.test(ad.linkUrl)
      ? <a href={ad.linkUrl} target="_blank" rel="noopener noreferrer" onClick={click}>{inner}</a>
      : <Link href={ad.linkUrl} onClick={click}>{inner}</Link>;
  };

  // ---- Interstitial: a full-screen card, once per session ----
  if (position === "interstitial") {
    if (popupSeen) return null;
    const close = () => {
      try { sessionStorage.setItem(`lotus.ad.${ad.id}`, "1"); } catch { /* ignore */ }
      setDismissed(true);
    };
    return (
      <div className="fixed inset-0 z-[125] grid place-items-center bg-black/60 p-4" onClick={close}>
        <div className="relative w-full max-w-sm overflow-hidden rounded-2xl border border-white/10 bg-ink-850" onClick={(e) => e.stopPropagation()}>
          <button onClick={close} aria-label="Close" className="absolute right-2 top-2 z-10 grid size-8 place-items-center rounded-full bg-black/50 text-white hover:bg-black/70"><X className="size-4" /></button>
          {linked(
            /* eslint-disable-next-line @next/next/no-img-element */
            <img src={withBase(ad.imageUrl)} alt={ad.title} className="h-auto w-full object-contain" />,
          )}
          {(ad.title || ad.text) && (
            <div className="p-4">
              {ad.title && <div className="font-display text-lg font-bold text-mist-100">{ad.title}</div>}
              {ad.text && <p className="mt-1 text-sm text-mist-300">{ad.text}</p>}
            </div>
          )}
          <span className="pointer-events-none absolute bottom-1 left-2 rounded bg-black/45 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-white/70">Ad</span>
        </div>
      </div>
    );
  }

  // ---- gameTop: a slim strip above a game board, with the optional ticker ----
  if (position === "gameTop") {
    return (
      <div className={`relative overflow-hidden rounded-xl border border-white/10 bg-ink-850 ${className ?? ""}`}>
        <button onClick={() => setDismissed(true)} aria-label="Dismiss" className="absolute right-2 top-2 z-10 grid size-6 place-items-center rounded-full bg-black/50 text-white/80 hover:bg-black/70"><X className="size-3.5" /></button>
        {linked(
          /* eslint-disable-next-line @next/next/no-img-element */
          <img src={withBase(ad.imageUrl)} alt={ad.title} className="h-auto max-h-24 w-full object-cover" />,
        )}
        {/* The admin's one-line running text, scrolling under the picture. */}
        {ad.text && (
          <div className="overflow-hidden border-t border-white/8 py-1">
            <div className="flex animate-[ad-ticker_18s_linear_infinite] whitespace-nowrap text-xs font-semibold text-lotus-200">
              <span className="mx-6">{ad.text}</span><span className="mx-6">{ad.text}</span>
            </div>
            <style>{`@keyframes ad-ticker{from{transform:translateX(0)}to{transform:translateX(-50%)}}`}</style>
          </div>
        )}
        <span className="pointer-events-none absolute bottom-1 left-2 rounded bg-black/45 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-white/70">Ad</span>
      </div>
    );
  }

  // ---- top / sidebar / feed: the standard banner card ----
  return (
    <div className={`relative overflow-hidden rounded-2xl border border-white/10 bg-ink-850 ${className ?? ""}`}>
      <button onClick={() => setDismissed(true)} aria-label="Dismiss" className="absolute right-2 top-2 z-10 grid size-6 place-items-center rounded-full bg-black/50 text-white/80 hover:bg-black/70"><X className="size-3.5" /></button>
      {linked(
        <span className="block">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={withBase(ad.imageUrl)} alt={ad.title} className="h-auto max-h-40 w-full object-cover" />
        </span>,
      )}
      <span className="pointer-events-none absolute bottom-1 left-2 rounded bg-black/45 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-white/70">Ad</span>
    </div>
  );
}
