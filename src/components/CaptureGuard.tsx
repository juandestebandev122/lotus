"use client";

// Best-effort screenshot / screen-recording protection for protected screens
// (Paid Zone, paid calls, wallet). A WEB app cannot hard-block OS captures the
// way a native app can (FLAG_SECURE) — this guard implements every layer the
// web platform allows, each controlled from Admin → Screenshot Protection and
// applied instantly through remote config (no app update needed):
//   • entry warning notice                     (captureProtection.warning)
//   • privacy shield while backgrounded — the OS app-switcher snapshot then
//     shows the shield instead of the content  (screenshot / recording)
//   • PrintScreen deterrent on desktop: the clipboard is overwritten and a
//     warning is shown                         (screenshot)
//   • identifying viewer watermark (name + member ID) so any capture that DOES
//     slip through is traceable to the account (screenshot)
//   • blocks in-page screen sharing (getDisplayMedia) from protected screens
//                                              (sharing)
// Admins are ALWAYS exempt (monitoring/support needs real captures).

import { useEffect, useRef, useState } from "react";
import { ShieldAlert } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { useConfig } from "@/lib/config";
import { useToast } from "@/components/ui/Toast";

export function CaptureGuard({ label = "Paid Zone" }: { label?: string }) {
  const { user } = useAuth();
  const { config } = useConfig();
  const { toast } = useToast();
  const cp = config.captureProtection ?? {};
  const isAdmin = user?.role === "admin";
  const shieldOn = !isAdmin && (cp.screenshot !== false || cp.recording !== false);
  const warnOn = !isAdmin && cp.warning !== false && (cp.screenshot !== false || cp.recording !== false);
  const shareBlockOn = !isAdmin && cp.sharing !== false;
  // Traceable watermark is now OPT-IN (default OFF) — the client asked to remove it;
  // an admin can turn it back on in Admin → Screenshot Protection.
  const watermarkOn = !isAdmin && cp.watermark === true;

  const [shield, setShield] = useState(false);
  const warned = useRef(false);

  // One-time entry warning.
  useEffect(() => {
    if (!warnOn || warned.current) return;
    warned.current = true;
    toast(`Screenshots & screen recording are not allowed in the ${label}.`, "info");
  }, [warnOn, label, toast]);

  // Privacy shield while the app is genuinely BACKGROUNDED — the app-switcher
  // preview (and many capture attempts made while switching apps) see the shield.
  //
  // IMPORTANT: it must key off real page VISIBILITY, not window focus. A plain
  // `blur` also fires for things that happen *inside* the app — opening the file
  // picker to choose an audio/video file, a permission prompt, the on-screen
  // keyboard — and shielding then covered the whole app with "Protected content"
  // while the user was simply picking a track. So `blur` now only arms a short
  // check: if the page is still visible a moment later, nothing was backgrounded
  // and no shield is shown.
  useEffect(() => {
    if (!shieldOn) return;
    let t: ReturnType<typeof setTimeout> | undefined;
    const hidden = () => typeof document !== "undefined" && document.visibilityState === "hidden";
    const sync = () => { if (t) clearTimeout(t); setShield(hidden()); };
    const onBlur = () => {
      if (t) clearTimeout(t);
      // Give the browser a beat to report a real background; an in-app dialog
      // (file picker / permission prompt) never flips visibility to hidden.
      t = setTimeout(() => setShield(hidden()), 400);
    };
    const onFocus = () => { if (t) clearTimeout(t); setShield(false); };
    document.addEventListener("visibilitychange", sync);
    window.addEventListener("blur", onBlur);
    window.addEventListener("focus", onFocus);
    window.addEventListener("pageshow", onFocus);
    return () => {
      if (t) clearTimeout(t);
      document.removeEventListener("visibilitychange", sync);
      window.removeEventListener("blur", onBlur);
      window.removeEventListener("focus", onFocus);
      window.removeEventListener("pageshow", onFocus);
      setShield(false);
    };
  }, [shieldOn]);

  // PrintScreen deterrent (desktop): the OS copies the shot to the clipboard —
  // immediately overwrite it and warn. (Best-effort; the key is only visible
  // to the page on keyup in most browsers.)
  useEffect(() => {
    if (!shieldOn) return;
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.key === "PrintScreen") {
        navigator.clipboard?.writeText(`Screenshots are not allowed in the ${label}.`).catch(() => {});
        toast("Screenshots are not allowed here.", "error");
      }
    };
    window.addEventListener("keyup", onKeyUp);
    return () => window.removeEventListener("keyup", onKeyUp);
  }, [shieldOn, label, toast]);

  // Block in-page screen sharing while a protected screen is open (our own
  // pages can then never publish a screen-share of protected content).
  useEffect(() => {
    if (!shareBlockOn || typeof navigator === "undefined" || !navigator.mediaDevices?.getDisplayMedia) return;
    const md = navigator.mediaDevices;
    const orig = md.getDisplayMedia.bind(md);
    md.getDisplayMedia = () =>
      Promise.reject(new DOMException(`Screen sharing is disabled in the ${label}.`, "NotAllowedError"));
    return () => { md.getDisplayMedia = orig; };
  }, [shareBlockOn, label]);

  if (isAdmin) return null;

  return (
    <>
      {/* Traceable viewer watermark — subtle on screen but legible in a capture, so any
          screenshot that slips through carries the viewer's name + ID (a browser can't
          BLOCK the OS screenshot; this makes leaks traceable back to the account). */}
      {watermarkOn && user && (
        <div aria-hidden className="pointer-events-none fixed inset-0 z-[90] select-none overflow-hidden" style={{ opacity: 0.1 }}>
          <div className="flex h-[200%] w-[200%] -translate-x-1/4 -translate-y-1/4 -rotate-12 flex-wrap content-start gap-x-16 gap-y-14">
            {Array.from({ length: 60 }).map((_, i) => (
              <span key={i} className="whitespace-nowrap text-sm font-bold text-white">
                {user.fullName} · {user.publicId ?? user.id}
              </span>
            ))}
          </div>
        </div>
      )}
      {/* Full-screen privacy shield while the app is backgrounded/unfocused. */}
      {shield && (
        <div className="fixed inset-0 z-[400] grid place-items-center bg-black">
          <div className="text-center">
            <ShieldAlert className="mx-auto size-10 text-lotus-300" />
            <p className="mt-3 text-sm font-bold text-white">Protected content</p>
            <p className="mt-1 text-xs text-white/60">Return to the app to continue.</p>
          </div>
        </div>
      )}
    </>
  );
}
