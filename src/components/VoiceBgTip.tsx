"use client";

import { useEffect, useState } from "react";
import { X, Smartphone } from "lucide-react";
import { InstallAppButton } from "@/components/InstallAppButton";
import { useConfig } from "@/lib/config";

// A dismissible in-voice-room tip for MOBILE-BROWSER users (not the installed app):
// mobile browsers pause the mic in the background, so installing the app (Add to Home
// Screen) is the real fix for "voice stops when I switch apps / lock the screen".
// Shown once until dismissed; hidden entirely in the installed PWA and on desktop.
export function VoiceBgTip() {
  const { config } = useConfig();
  const [show, setShow] = useState(false);
  useEffect(() => {
    try {
      const standalone = window.matchMedia("(display-mode: standalone)").matches || (navigator as unknown as { standalone?: boolean }).standalone === true;
      const dismissed = localStorage.getItem("lotus.voiceBgTip") === "1";
      const mobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent) || (navigator.maxTouchPoints ?? 0) > 0;
      if (!standalone && !dismissed && mobile) setShow(true);
    } catch { /* ignore */ }
  }, []);
  if (!show) return null;
  const dismiss = () => { try { localStorage.setItem("lotus.voiceBgTip", "1"); } catch { /* ignore */ } setShow(false); };
  return (
    <div className="rounded-2xl border border-amber-400/25 bg-amber-500/[0.06] p-3">
      <div className="flex items-start gap-2.5">
        <Smartphone className="mt-0.5 size-5 shrink-0 text-amber-300" />
        <div className="min-w-0 flex-1 text-xs text-mist-300">
          <p className="text-sm font-bold text-amber-200">Keep talking in the background</p>
          <p className="mt-0.5">Phone browsers pause the microphone when you switch apps or lock the screen — that&apos;s a browser limit. <b className="text-mist-200">Install the app</b> (Add to Home Screen) so your voice keeps working in the background.</p>
          <div className="mt-2 flex items-center gap-3">
            <InstallAppButton storeUrl={config.content?.playStoreUrl} apkUrl={config.content?.apkUrl} label="Install app" className="inline-flex h-9 px-3.5 text-xs" />
            <button onClick={dismiss} className="text-[11px] font-semibold text-mist-400 hover:text-mist-200">Not now</button>
          </div>
        </div>
        <button onClick={dismiss} title="Dismiss" className="shrink-0 text-mist-500 hover:text-mist-200"><X className="size-4" /></button>
      </div>
    </div>
  );
}
