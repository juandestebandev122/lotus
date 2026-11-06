"use client";

// SCREEN SHARE & REMOTE SUPPORT — the user's side.
//
// WHAT A WEB PAGE CAN AND CANNOT DO (please read before "improving" this):
//   • Live screen capture (getDisplayMedia) exists on DESKTOP browsers only.
//     Android Chrome and iOS Safari do not implement it at all — there is no
//     flag, polyfill or permission that turns it on.
//   • No web page can remote-CONTROL another device. Not the phone, not the
//     desktop. So "remote control" here is a GUIDED session: support asks, the
//     user accepts, support sends one step at a time, and the USER performs it.
//
// So on a phone we do the thing that actually works: the user records their
// screen with the phone's own recorder (or takes a screenshot) and sends it
// here. Support gets what it needs; nothing is captured behind the user's back.

import { useCallback, useEffect, useRef, useState } from "react";
import {
  MonitorUp, ShieldCheck, ShieldAlert, Square, Video, Camera, Loader2,
  Check, X, Hand, Info, CircleDot,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import { withBase } from "@/lib/base-path";
import { uploadFile } from "@/lib/upload";
import { cn } from "@/lib/cn";

export interface SupportSessionView {
  id: string;
  status: "active" | "ended";
  mode: "live" | "recording";
  startedAt: string;
  control: { state: "none" | "requested" | "granted" | "denied" | "revoked"; requestedBy?: string };
  attachments: { id: string; kind: string; url: string; name: string; at: string }[];
  guidance: { id: string; at: string; by: string; text: string }[];
}

const CONSENT_TEXT =
  "I agree to share my screen and device information with Lotus Customer Support for this session. " +
  "I understand support can only see what I choose to send, that they must ask before guiding me, " +
  "and that I can stop sharing at any time.";

/** Live screen capture only exists on desktop browsers. */
function canShareLive(): boolean {
  if (typeof navigator === "undefined") return false;
  const md = navigator.mediaDevices as MediaDevices & { getDisplayMedia?: unknown };
  if (typeof md?.getDisplayMedia !== "function") return false;
  // Android Chrome exposes the function but rejects it — treat mobile as no.
  return !/Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
}

export function ScreenShareSupport() {
  const { toast } = useToast();
  const [session, setSession] = useState<SupportSessionView | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [agreed, setAgreed] = useState(false);
  const [live, setLive] = useState(false);          // a live capture is running
  const streamRef = useRef<MediaStream | null>(null);
  // The LiveKit room carrying the screen to support (null when not sharing).
  const roomRef = useRef<import("livekit-client").Room | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const supportsLive = typeof window !== "undefined" && canShareLive();

  const post = useCallback(async (body: Record<string, unknown>) => {
    const res = await fetch(withBase("/api/support/session"), {
      method: "POST", headers: { "Content-Type": "application/json" },
      credentials: "include", body: JSON.stringify(body),
    });
    const json = await res.json().catch(() => ({}));
    return res.ok ? { ok: true as const, ...json } : { ok: false as const, error: (json as { error?: string }).error };
  }, []);

  const load = useCallback(async () => {
    try {
      const res = await fetch(withBase("/api/support/session"), { credentials: "include", cache: "no-store" });
      const json = await res.json().catch(() => ({}));
      if (res.ok) setSession(json.session ?? null);
    } catch { /* ignore */ }
    setLoading(false);
  }, []);

  useEffect(() => { void load(); }, [load]);
  // Poll while a session is open so a control request appears promptly.
  useEffect(() => {
    if (!session || session.status !== "active") return;
    const t = setInterval(() => { void load(); }, 4000);
    return () => clearInterval(t);
  }, [session, load]);

  /** Facts support actually needs — and nothing that identifies anyone else. */
  const collectDiagnostics = useCallback(async () => {
    const d: Record<string, string | number | boolean | null> = {};
    try {
      d.appVersion = (window as unknown as { __lotusVersion?: string }).__lotusVersion ?? "unknown";
      d.userAgent = navigator.userAgent;
      d.platform = navigator.platform ?? "";
      d.language = navigator.language;
      d.screen = `${window.screen.width}×${window.screen.height}`;
      d.viewport = `${window.innerWidth}×${window.innerHeight}`;
      d.online = navigator.onLine;
      d.secureContext = window.isSecureContext;
      d.timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
      d.liveShareSupported = canShareLive();
      // Permission states are the single most useful thing for the mic reports.
      const perms = navigator.permissions;
      for (const name of ["microphone", "camera", "notifications"] as const) {
        try { d[`perm_${name}`] = (await perms?.query({ name: name as PermissionName }))?.state ?? "unknown"; }
        catch { d[`perm_${name}`] = "unsupported"; }
      }
      try {
        const devs = await navigator.mediaDevices?.enumerateDevices();
        d.microphones = (devs ?? []).filter((x) => x.kind === "audioinput").length;
      } catch { d.microphones = -1; }
    } catch { /* best effort */ }
    await post({ action: "diagnostics", diagnostics: d });
  }, [post]);

  const start = async (mode: "live" | "recording") => {
    if (!agreed) { toast("Please tick the consent box first.", "error"); return; }
    setBusy(true);
    const r = await post({ action: "start", mode, consentText: CONSENT_TEXT });
    setBusy(false);
    if (!r.ok) { toast(r.error ?? "Could not start the session", "error"); return; }
    const fresh = (r as { session?: SupportSessionView }).session ?? null;
    setSession(fresh);
    toast("Support session started. You can stop it at any time.", "success");
    void collectDiagnostics();
    // Pass the id explicitly: React state has not updated yet at this point, so
    // reading `session` inside the capture would still see null and bail out.
    if (mode === "live" && fresh) void startLiveCapture(fresh.id);
  };

  /**
   * Desktop only. Capture the screen AND PUBLISH IT so support can actually see
   * it — the first version stopped at the capture, so the browser showed its
   * "sharing" bar while nothing ever reached support. The picture now goes into
   * the session's own LiveKit room, which support subscribes to.
   */
  const startLiveCapture = async (sessionId?: string) => {
    const sid = sessionId ?? session?.id;
    if (!sid) return;
    let stream: MediaStream | null = null;
    try {
      const md = navigator.mediaDevices as MediaDevices & { getDisplayMedia: (c: DisplayMediaStreamOptions) => Promise<MediaStream> };
      stream = await md.getDisplayMedia({ video: { frameRate: 12 }, audio: false });
    } catch {
      setLive(false);
      toast("Screen sharing was not started. You can still send a screen recording instead.", "info");
      return;
    }
    try {
      const r = await fetch(withBase(`/api/support/session/token?id=${encodeURIComponent(sid)}`), { credentials: "include", cache: "no-store" });
      const j = await r.json();
      if (!r.ok || !j.token || !j.url) throw new Error(j.error ?? "no token");

      const { Room } = await import("livekit-client");
      const room = new Room();
      await room.connect(j.url as string, j.token as string);
      const track = stream.getVideoTracks()[0];
      if (!track) throw new Error("no video track");
      await room.localParticipant.publishTrack(track, { name: "screen", source: "screen_share" as never });

      roomRef.current = room;
      streamRef.current = stream;
      setLive(true);
      await post({ action: "live", live: true });
      toast("Your screen is now visible to Support.", "success");

      // Stopping from the browser's own bar must tear the whole thing down.
      track.addEventListener("ended", () => { void stopLiveCapture(); });
    } catch {
      stream.getTracks().forEach((t) => t.stop());
      setLive(false);
      toast("Couldn't connect the live share. Please try again, or send a screen recording instead.", "error");
    }
  };

  const stopLiveCapture = useCallback(async () => {
    try { await roomRef.current?.disconnect(); } catch { /* already gone */ }
    roomRef.current = null;
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setLive(false);
    await post({ action: "live", live: false });
  }, [post]);

  const endSession = async () => {
    await stopLiveCapture();
    setBusy(true);
    await post({ action: "end" });
    setBusy(false);
    setSession(null);
    setAgreed(false);
    toast("Sharing stopped. Support can no longer see anything.", "success");
  };

  const answerControl = async (accept: boolean) => {
    setBusy(true);
    const r = await post({ action: "control", accept });
    setBusy(false);
    if (r.ok) { toast(accept ? "Support may now guide you step by step." : "Request declined.", accept ? "success" : "info"); void load(); }
    else toast(r.error ?? "Could not save your answer", "error");
  };

  const withdrawControl = async () => {
    setBusy(true);
    await post({ action: "revokeControl" });
    setBusy(false);
    toast("Guided control withdrawn.", "info");
    void load();
  };

  const sendFile = async (file?: File) => {
    if (!file || !session) return;
    setUploading(true);
    try {
      const up = await uploadFile(file, "support");
      if (!up.ok || !up.file?.url) { toast(up.error ?? "Upload failed", "error"); return; }
      const kind = file.type.startsWith("video/") ? "recording" : "screenshot";
      const r = await post({ action: "attach", kind, url: up.file.url, name: file.name, sizeBytes: file.size });
      if (r.ok) { toast("Sent to Support ✓", "success"); void load(); }
      else toast(r.error ?? "Could not send that file", "error");
    } finally { setUploading(false); }
  };

  // Clean up any live capture if this screen goes away.
  useEffect(() => () => {
    try { void roomRef.current?.disconnect(); } catch { /* ignore */ }
    streamRef.current?.getTracks().forEach((t) => t.stop());
  }, []);

  if (loading) return <div className="grid h-24 place-items-center text-mist-500"><Loader2 className="size-5 animate-spin" /></div>;

  const active = session?.status === "active";
  const controlState = session?.control.state ?? "none";

  return (
    <div className="rounded-2xl border border-white/10 bg-ink-850/60 p-4">
      <h2 className="flex items-center gap-2 font-display text-lg font-bold text-mist-100">
        <MonitorUp className="size-5 text-lotus-300" /> Screen Share &amp; Remote Support
      </h2>
      <p className="mt-0.5 text-sm text-mist-400">
        Show Customer Support what&apos;s happening on your screen so they can help you faster.
      </p>

      {/* ── ACTIVE INDICATOR ────────────────────────────────────────────── */}
      {active && (
        <div className="mt-3 flex flex-wrap items-center gap-2 rounded-xl border border-emerald-400/40 bg-emerald-500/[0.12] px-3.5 py-3">
          <CircleDot className="size-4 shrink-0 animate-pulse text-emerald-300" />
          <span className="min-w-0 flex-1 text-sm font-bold text-emerald-100">
            Screen Sharing Active
            <span className="block text-[11px] font-normal text-emerald-200/80">
              {live ? "Your screen is being shared live." : "Support can see only what you send below."}
              {" "}Started {new Date(session!.startedAt).toLocaleTimeString("en-SA", { hour: "2-digit", minute: "2-digit" })}.
            </span>
          </span>
          <Button size="sm" variant="danger" disabled={busy} onClick={() => void endSession()}>
            <Square className="mr-1.5 size-3.5" /> Stop sharing
          </Button>
        </div>
      )}

      {/* ── CONTROL REQUEST — the user's explicit Accept ─────────────────── */}
      {active && controlState === "requested" && (
        <div className="mt-3 rounded-xl border border-amber-400/40 bg-amber-500/[0.12] p-3.5">
          <p className="flex items-center gap-2 text-sm font-bold text-amber-100">
            <Hand className="size-4" /> {session!.control.requestedBy ?? "Support"} is asking to guide you
          </p>
          <p className="mt-1 text-[11px] text-amber-200/80">
            If you accept, support can send you one step at a time to follow. <b>They still cannot touch your phone</b> —
            you tap everything yourself, and you can withdraw this at any time.
          </p>
          <div className="mt-2.5 flex gap-2">
            <Button size="sm" disabled={busy} onClick={() => void answerControl(true)}><Check className="mr-1.5 size-3.5" /> Accept</Button>
            <Button size="sm" variant="secondary" disabled={busy} onClick={() => void answerControl(false)}><X className="mr-1.5 size-3.5" /> Decline</Button>
          </div>
        </div>
      )}

      {active && controlState === "granted" && (
        <div className="mt-3 flex flex-wrap items-center gap-2 rounded-xl border border-line bg-ink-900 px-3.5 py-2.5">
          <ShieldCheck className="size-4 shrink-0 text-emerald-300" />
          <span className="min-w-0 flex-1 text-xs text-mist-300">Guided support is on — you still tap everything yourself.</span>
          <Button size="sm" variant="secondary" disabled={busy} onClick={() => void withdrawControl()}>Withdraw</Button>
        </div>
      )}

      {/* ── STEPS FROM SUPPORT ───────────────────────────────────────────── */}
      {active && (session!.guidance ?? []).length > 0 && (
        <div className="mt-3 rounded-xl border border-lotus-400/30 bg-lotus-500/[0.07] p-3.5">
          <p className="mb-1.5 text-xs font-bold text-lotus-200">Steps from Support</p>
          <ol className="space-y-1.5">
            {session!.guidance.map((g, i) => (
              <li key={g.id} className="flex gap-2 text-sm text-mist-100">
                <span className="grid size-5 shrink-0 place-items-center rounded-full bg-lotus-500/25 text-[11px] font-bold text-lotus-100">{session!.guidance.length - i}</span>
                <span className="min-w-0">{g.text}</span>
              </li>
            ))}
          </ol>
        </div>
      )}

      {/* ── SENDING YOUR SCREEN ──────────────────────────────────────────── */}
      {active && (
        <div className="mt-3 space-y-2">
          <input
            ref={fileRef} type="file" accept="video/*,image/*" hidden
            onChange={(e) => { void sendFile(e.target.files?.[0]); e.target.value = ""; }}
          />
          <div className="flex flex-wrap gap-2">
            {supportsLive && !live && (
              <Button size="sm" onClick={() => void startLiveCapture()}><MonitorUp className="mr-1.5 size-4" /> Share my screen live</Button>
            )}
            {supportsLive && live && (
              <Button size="sm" variant="secondary" onClick={() => void stopLiveCapture()}><Square className="mr-1.5 size-3.5" /> Stop live share</Button>
            )}
            <Button size="sm" variant="secondary" disabled={uploading} onClick={() => fileRef.current?.click()}>
              {uploading ? <Loader2 className="mr-1.5 size-4 animate-spin" /> : <Video className="mr-1.5 size-4" />}
              Send a screen recording
            </Button>
            <Button size="sm" variant="secondary" disabled={uploading} onClick={() => fileRef.current?.click()}>
              <Camera className="mr-1.5 size-4" /> Send a screenshot
            </Button>
          </div>

          {!supportsLive && (
            <p className="flex items-start gap-2 rounded-lg border border-line bg-ink-900 px-3 py-2 text-[11px] text-mist-400">
              <Info className="mt-0.5 size-3.5 shrink-0 text-lotus-300" />
              <span>
                Phone browsers can&apos;t stream their screen live — that&apos;s a limitation of the phone, not this app.
                Use your phone&apos;s own <b>Screen recorder</b> (swipe down from the top to find it), record the problem,
                then tap <b>Send a screen recording</b> above. Support sees exactly what you send and nothing else.
              </span>
            </p>
          )}

          {session!.attachments.length > 0 && (
            <p className="text-[11px] text-mist-500">Sent: {session!.attachments.map((a) => a.name).join(", ")}</p>
          )}
        </div>
      )}

      {/* ── START (with consent) ─────────────────────────────────────────── */}
      {!active && (
        <div className="mt-3 space-y-3">
          <div className="rounded-xl border border-line bg-ink-900 p-3.5">
            <p className="flex items-center gap-1.5 text-xs font-bold text-mist-200"><ShieldAlert className="size-3.5 text-amber-300" /> Before you start — what support can and can&apos;t see</p>
            <ul className="mt-1.5 space-y-1 text-[11px] text-mist-400">
              <li>• They see <b>only what you choose to send</b> — a live share you start, or a recording/screenshot you upload.</li>
              <li>• Nothing is captured in the background, and nothing starts without you.</li>
              <li>• <b>Nobody can control your phone.</b> If support asks to guide you, you must Accept, and you still tap everything yourself.</li>
              <li>• Basic device details (browser, screen size, microphone permission) are shared to help diagnose faults.</li>
              <li>• You can press <b>Stop sharing</b> at any moment, and the session closes automatically after 4 hours.</li>
            </ul>
            <label className="mt-2.5 flex cursor-pointer items-start gap-2 text-[11px] text-mist-300">
              <input type="checkbox" checked={agreed} onChange={(e) => setAgreed(e.target.checked)} className="mt-0.5 size-4 shrink-0 accent-lotus-500" />
              <span>{CONSENT_TEXT}</span>
            </label>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button disabled={!agreed || busy} onClick={() => void start(supportsLive ? "live" : "recording")}>
              {busy ? <Loader2 className="mr-1.5 size-4 animate-spin" /> : <MonitorUp className="mr-1.5 size-4" />}
              Start screen sharing
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
