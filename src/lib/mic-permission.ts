// MICROPHONE PERMISSION — one honest check, used everywhere.
//
// THE BUG THIS REPLACES: the old check was `try { getUserMedia() } catch { "your
// microphone is blocked" }`. Every possible failure was reported as a permission
// denial and blocked the user from taking a seat. But getUserMedia fails for
// several reasons that have NOTHING to do with permission — and the most common
// one on Android is the mic being BUSY, which happens precisely because our own
// LiveKit connection is already holding it. That is why users saw
// "Microphone access is blocked" on a phone whose settings clearly said
// "Microphone: Allowed", and why enabling the permission again changed nothing.
//
// This module separates the cases, so we only tell somebody their mic is blocked
// when it genuinely is, and never block a seat over a temporary hardware clash.

export type MicVerdict =
  | { ok: true; reason: "granted" | "already-live" | "unsupported" }
  | { ok: false; kind: "denied" | "missing" | "busy" | "insecure" | "unknown"; message: string; canRetry: boolean };

/** Chrome on Android will not re-prompt once blocked, and a permission changed in
 *  Settings does not reach a page that is already open — it has to be reloaded.
 *  That is the missing half of "I enabled it and it still doesn't work". */
export const MIC_DENIED_MESSAGE =
  "Microphone is blocked for this site. Open your browser's site settings, set Microphone to Allow, then RELOAD this page — a permission change doesn't reach a page that's already open.";

const MIC_BUSY_MESSAGE =
  "Your microphone is busy — another app or tab is using it. Close it (or end any other call) and try again.";

const MIC_MISSING_MESSAGE =
  "No microphone was found on this device. Connect a microphone or headset and try again.";

const MIC_INSECURE_MESSAGE =
  "Microphones only work on a secure (https) connection. Please open the site over https.";

/**
 * Work out whether we can use the microphone.
 *
 * `alreadyLive` — pass true when the voice connection is already up and
 * publishing audio. Permission is self-evidently granted in that case, and
 * grabbing the hardware a second time just to "check" is what triggers the
 * spurious busy error. So we skip the probe entirely.
 */
export async function checkMicPermission(opts?: { alreadyLive?: boolean }): Promise<MicVerdict> {
  if (opts?.alreadyLive) return { ok: true, reason: "already-live" };
  if (typeof navigator === "undefined") return { ok: true, reason: "unsupported" };

  // A page served over plain http has no media devices at all. Say so plainly
  // rather than blaming the user's settings.
  if (typeof window !== "undefined" && window.isSecureContext === false) {
    return { ok: false, kind: "insecure", message: MIC_INSECURE_MESSAGE, canRetry: false };
  }
  if (!navigator.mediaDevices?.getUserMedia) {
    // Old or unusual browser — don't stand in the user's way; the voice layer
    // will report a real problem if there is one.
    return { ok: true, reason: "unsupported" };
  }

  // 1. ASK, don't grab. Where the Permissions API works this settles it without
  //    touching the microphone hardware — which is the whole problem above.
  try {
    const perms = (navigator as Navigator & { permissions?: Permissions }).permissions;
    if (perms?.query) {
      const st = await perms.query({ name: "microphone" as PermissionName });
      if (st.state === "granted") return { ok: true, reason: "granted" };
      if (st.state === "denied") return { ok: false, kind: "denied", message: MIC_DENIED_MESSAGE, canRetry: false };
      // "prompt" → fall through and actually ask, which shows the browser dialog.
    }
  } catch {
    // Safari and some Android builds don't support querying "microphone".
    // Fall through to the real request.
  }

  // 2. Genuinely request it. This is what shows the permission prompt, so it has
  //    to happen inside a real user gesture.
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    stream.getTracks().forEach((t) => t.stop()); // release at once; voice re-acquires
    return { ok: true, reason: "granted" };
  } catch (err) {
    const name = (err as { name?: string })?.name ?? "";
    switch (name) {
      case "NotAllowedError":
      case "PermissionDeniedError":
      case "SecurityError":
        return { ok: false, kind: "denied", message: MIC_DENIED_MESSAGE, canRetry: false };
      case "NotFoundError":
      case "DevicesNotFoundError":
        return { ok: false, kind: "missing", message: MIC_MISSING_MESSAGE, canRetry: true };
      case "NotReadableError":
      case "TrackStartError":
      case "AbortError":
        // The mic exists and we're allowed to use it — it's just occupied right
        // now. NEVER call this "blocked", and never stop the user over it.
        return { ok: false, kind: "busy", message: MIC_BUSY_MESSAGE, canRetry: true };
      default:
        return {
          ok: false, kind: "unknown", canRetry: true,
          message: "Couldn't start the microphone. Please try again — if it keeps happening, reload the page.",
        };
    }
  }
}

/** Should a failed check actually STOP the user from taking a seat?
 *  Only a real denial or a missing device does. A busy mic or an unknown blip
 *  is worth a warning, but they should still be seated — the voice layer retries
 *  and in practice succeeds. */
export function micFailureShouldBlock(v: MicVerdict): boolean {
  return !v.ok && (v.kind === "denied" || v.kind === "missing" || v.kind === "insecure");
}
