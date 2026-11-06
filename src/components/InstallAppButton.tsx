"use client";

import { useEffect, useState } from "react";
import { Download, X } from "lucide-react";
import { cn } from "@/lib/cn";

// The browser's install-prompt event (Chromium). Typed loosely — it's not in the
// standard TS DOM lib.
type BIPEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> };

/**
 * "Install Now" button that ALWAYS appears (until the app is already installed):
 *  • If the admin set a Play Store / APK link → opens it.
 *  • Else on Android/desktop Chromium → fires the native PWA install prompt.
 *  • Else (e.g. iOS Safari) → shows a short "Add to Home screen" instruction.
 */
export function InstallAppButton({ storeUrl, apkUrl, label, className }: { storeUrl?: string; apkUrl?: string; label: string; className?: string }) {
  const [deferred, setDeferred] = useState<BIPEvent | null>(null);
  const [installed, setInstalled] = useState(false);
  const [showHint, setShowHint] = useState(false);

  useEffect(() => {
    const onBIP = (e: Event) => { e.preventDefault(); setDeferred(e as BIPEvent); };
    const onInstalled = () => setInstalled(true);
    window.addEventListener("beforeinstallprompt", onBIP);
    window.addEventListener("appinstalled", onInstalled);
    try { if (window.matchMedia("(display-mode: standalone)").matches || (navigator as unknown as { standalone?: boolean }).standalone) setInstalled(true); } catch { /* ignore */ }
    return () => { window.removeEventListener("beforeinstallprompt", onBIP); window.removeEventListener("appinstalled", onInstalled); };
  }, []);

  const url = (storeUrl || apkUrl || "").trim();
  if (installed) return null; // already installed — nothing to do

  // Base look (colour/shape/centring) always applies; the caller's `className`
  // ADDS to it (size / visibility / spacing) instead of replacing it — so the
  // button never renders unstyled. When no className is given, use the standard size.
  const cls = cn(
    "items-center justify-center gap-2 whitespace-nowrap rounded-xl bg-emerald-500 font-bold text-white shadow-sm transition hover:bg-emerald-600",
    className || "inline-flex h-11 px-5 text-sm",
  );

  // A configured link always wins.
  if (url) {
    return (
      <a href={url} {...(storeUrl ? { target: "_blank", rel: "noopener noreferrer" } : { download: "" })} className={cls}>
        <Download className="size-4" /> {label}
      </a>
    );
  }

  const onClick = async () => {
    if (deferred) {
      try { await deferred.prompt(); await deferred.userChoice; } catch { /* ignore */ }
      setDeferred(null);
    } else {
      setShowHint(true);
    }
  };

  return (
    <>
      <button onClick={onClick} className={cls}>
        <Download className="size-4" /> {label}
      </button>
      {showHint && (
        <div className="fixed inset-0 z-[120] grid place-items-center bg-black/60 p-4" onClick={() => setShowHint(false)}>
          <div className="w-full max-w-sm rounded-2xl border border-line bg-ink-850 p-5 text-center" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h2 className="font-display text-base font-bold text-mist-100">Install LotusPlay Connect</h2>
              <button onClick={() => setShowHint(false)} className="text-mist-400 hover:text-mist-100"><X className="size-5" /></button>
            </div>
            <p className="mt-3 text-sm text-mist-300">Add the app to your home screen for a full-screen, app-like experience:</p>
            <ul className="mt-3 space-y-2 text-left text-sm text-mist-200">
              <li><span className="font-semibold text-lotus-300">Android (Chrome):</span> tap the ⋮ menu → <b>Add to Home screen</b> / <b>Install app</b>.</li>
              <li><span className="font-semibold text-lotus-300">iPhone (Safari):</span> tap the Share icon → <b>Add to Home Screen</b>.</li>
            </ul>
            <button onClick={() => setShowHint(false)} className="mt-4 w-full rounded-xl bg-lotus-600 py-2.5 text-sm font-bold text-white hover:bg-lotus-500">Got it</button>
          </div>
        </div>
      )}
    </>
  );
}
