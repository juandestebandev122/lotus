"use client";

import { useCallback, useEffect, useState } from "react";
import { Mic, MicOff, Check } from "lucide-react";
import { cn } from "@/lib/cn";
import { useVoice } from "@/lib/VoiceProvider";
import { useToast } from "@/components/ui/Toast";
import { checkMicPermission } from "@/lib/mic-permission";

type MicState = "unknown" | "prompt" | "granted" | "denied";

// A clear, tappable "Enable Microphone" button. Tapping it asks the DEVICE for
// microphone permission (must happen on a real user gesture, which is exactly
// what this is). If the user denies / has blocked it, they can tap again later
// to try once more (and we point them to Settings if the browser won't re-prompt).
export function EnableMicButton({
  className,
  block = true,
  hideWhenGranted = false,
}: {
  className?: string;
  block?: boolean;
  // When true, the button disappears once permission is granted (keeps the UI
  // clean for users whose mic already works, while staying visible for anyone
  // who still needs to grant / was denied).
  hideWhenGranted?: boolean;
}) {
  const voice = useVoice();
  const { toast } = useToast();
  const [state, setState] = useState<MicState>("unknown");
  const [busy, setBusy] = useState(false);

  // Reflect the current OS/browser permission when the Permissions API supports
  // it, so the button can already show "enabled" without re-prompting. Not all
  // browsers support querying "microphone" (e.g. iOS Safari) — then we stay
  // "unknown" and just show "Enable Microphone".
  useEffect(() => {
    let cancelled = false;
    const perms = (typeof navigator !== "undefined" ? navigator : undefined)?.permissions;
    if (!perms?.query) return;
    const map = (s: PermissionState): MicState => (s === "granted" ? "granted" : s === "denied" ? "denied" : "prompt");
    perms
      .query({ name: "microphone" as PermissionName })
      .then((status) => {
        if (cancelled) return;
        setState(map(status.state));
        status.onchange = () => setState(map(status.state));
      })
      .catch(() => { /* query unsupported — leave as unknown */ });
    return () => { cancelled = true; };
  }, []);

  const requestMic = useCallback(async () => {
    if (busy) return;
    if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
      toast("This device or browser can't access the microphone here.", "error");
      return;
    }
    setBusy(true);
    try {
      // checkMicPermission separates a genuine denial from a mic that is merely
      // BUSY (another app/tab, or our own live voice track). Reporting "busy" as
      // "denied" is what sent users to Settings to fix a permission that was
      // already granted.
      const v = await checkMicPermission();
      if (v.ok) {
        setState("granted");
        try { voice.startAudio(); } catch { /* ignore */ }
        toast("Microphone enabled ✓ You can now unmute your mic to talk.", "success");
      } else if (v.kind === "denied" || v.kind === "insecure") {
        setState("denied");
        toast(v.message, "error");
      } else {
        // Busy / missing / unknown — permission itself is fine, so don't mark it
        // denied and don't send them off to change a setting that isn't wrong.
        toast(v.message, "info");
      }
    } finally {
      setBusy(false);
    }
  }, [busy, toast, voice]);

  const granted = state === "granted";
  const denied = state === "denied";

  if (hideWhenGranted && granted && !busy) return null;

  return (
    <button
      type="button"
      onClick={requestMic}
      disabled={busy}
      aria-label="Enable microphone"
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-bold transition disabled:opacity-60",
        block && "w-full",
        granted
          ? "bg-emerald-500/15 text-emerald-200 ring-1 ring-emerald-400/30 hover:bg-emerald-500/25"
          : denied
            ? "bg-amber-500/15 text-amber-200 ring-1 ring-amber-400/30 hover:bg-amber-500/25"
            : "bg-lotus-600 text-white hover:bg-lotus-500",
        className,
      )}
    >
      {granted ? <Check className="size-4" /> : denied ? <MicOff className="size-4" /> : <Mic className="size-4" />}
      {busy
        ? "Requesting…"
        : granted
          ? "Microphone enabled"
          : denied
            ? "Microphone blocked — tap to allow"
            : "Enable Microphone"}
    </button>
  );
}
