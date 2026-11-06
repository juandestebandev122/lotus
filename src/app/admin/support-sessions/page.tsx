"use client";

// SUPPORT SESSIONS — the admin side of Screen Share & Remote Support.
//
// Support can ASK for guided control and send one step at a time. It can never
// grant itself control, never see anything the user hasn't sent, and every
// action is written to the session's audit trail below.

import { useCallback, useEffect, useRef, useState } from "react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import { withBase } from "@/lib/base-path";
import { cn } from "@/lib/cn";
import {
  MonitorUp, Hand, Square, RefreshCw, Loader2, ShieldCheck, ShieldAlert,
  Video, Camera, Clock, History, Send, CircleDot, Cpu, MonitorPlay, ScreenShareOff,
} from "lucide-react";

type Session = {
  id: string; userId: string; userName: string; userPublicId?: string;
  status: "active" | "ended"; mode: "live" | "recording";
  liveSharing?: boolean;
  startedAt: string; endedAt?: string; endedBy?: string;
  consent: { at: string; text: string };
  control: { state: string; requestedBy?: string; requestedAt?: string; decidedAt?: string };
  attachments: { id: string; kind: string; url: string; name: string; at: string }[];
  diagnostics?: Record<string, string | number | boolean | null>;
  guidance: { id: string; at: string; by: string; text: string }[];
  events: { at: string; who: string; what: string }[];
  adminName?: string;
};

const CONTROL_TONE: Record<string, string> = {
  none: "bg-white/[0.06] text-mist-400",
  requested: "bg-amber-500/15 text-amber-300",
  granted: "bg-emerald-500/15 text-emerald-300",
  denied: "bg-rose-500/15 text-rose-300",
  revoked: "bg-rose-500/15 text-rose-300",
};

export default function SupportSessionsPage() {
  const { toast } = useToast();
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [openId, setOpenId] = useState<string | null>(null);
  const [step, setStep] = useState("");
  const [busy, setBusy] = useState(false);
  // ---- live viewer --------------------------------------------------------
  const [watching, setWatching] = useState<string | null>(null);   // session id
  const [watchState, setWatchState] = useState<"connecting" | "waiting" | "live" | "error">("connecting");
  const videoRef = useRef<HTMLVideoElement>(null);
  const roomRef = useRef<import("livekit-client").Room | null>(null);

  const stopWatching = useCallback(async () => {
    try { await roomRef.current?.disconnect(); } catch { /* already gone */ }
    roomRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    setWatching(null);
  }, []);

  /** Subscribe to a session's screen. Support can ONLY receive here — the token
   *  it gets carries no permission to publish, so nothing can be sent AT the user. */
  const watchLive = useCallback(async (sessionId: string) => {
    await stopWatching();
    setWatching(sessionId);
    setWatchState("connecting");
    try {
      const r = await fetch(withBase(`/api/support/session/token?id=${encodeURIComponent(sessionId)}`), { credentials: "include", cache: "no-store" });
      const j = await r.json();
      if (!r.ok || !j.token || !j.url) throw new Error(j.error ?? "no token");

      const { Room, RoomEvent } = await import("livekit-client");
      const room = new Room();
      const attach = (track: { kind: string; attach: (el: HTMLVideoElement) => void }) => {
        if (track.kind !== "video" || !videoRef.current) return;
        track.attach(videoRef.current);
        setWatchState("live");
      };
      room.on(RoomEvent.TrackSubscribed, (track) => attach(track as never));
      room.on(RoomEvent.TrackUnsubscribed, () => setWatchState("waiting"));
      room.on(RoomEvent.Disconnected, () => setWatchState("waiting"));
      await room.connect(j.url as string, j.token as string);
      roomRef.current = room;

      // Anything already being published when we arrive.
      let found = false;
      room.remoteParticipants.forEach((p) => {
        p.trackPublications.forEach((pub) => {
          if (pub.track) { attach(pub.track as never); found = true; }
        });
      });
      if (!found) setWatchState("waiting");
    } catch {
      setWatchState("error");
    }
  }, [stopWatching]);

  useEffect(() => () => { try { void roomRef.current?.disconnect(); } catch { /* ignore */ } }, []);

  const load = useCallback(async () => {
    try {
      const res = await fetch(withBase("/api/admin/support-sessions"), { credentials: "include", cache: "no-store" });
      const json = await res.json().catch(() => ({}));
      if (res.ok) setSessions(json.sessions ?? []);
    } catch { /* ignore */ }
    setLoading(false);
  }, []);
  useEffect(() => { void load(); }, [load]);
  // Live sessions move quickly — keep the list fresh while any is open.
  useEffect(() => {
    if (!sessions.some((s) => s.status === "active")) return;
    const t = setInterval(() => { void load(); }, 5000);
    return () => clearInterval(t);
  }, [sessions, load]);

  const act = async (body: Record<string, unknown>, okMsg: string) => {
    setBusy(true);
    const res = await fetch(withBase("/api/admin/support-sessions"), {
      method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
    });
    const json = await res.json().catch(() => ({}));
    setBusy(false);
    if (res.ok) { toast(okMsg, "success"); await load(); }
    else toast((json as { error?: string }).error ?? "Action failed", "error");
  };

  const active = sessions.filter((s) => s.status === "active");
  const past = sessions.filter((s) => s.status !== "active");
  const open = sessions.find((s) => s.id === openId) ?? null;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 font-display text-2xl font-extrabold text-mist-100">
            <MonitorUp className="size-6 text-lotus-300" /> Support Sessions
          </h1>
          <p className="text-sm text-mist-400">Screen sharing and guided support, with the user&apos;s consent recorded on every session.</p>
        </div>
        <Button variant="secondary" size="sm" onClick={() => void load()} disabled={loading}>
          <RefreshCw className={cn("size-4", loading && "animate-spin")} /> Refresh
        </Button>
      </div>

      <div className="flex items-start gap-2 rounded-xl border border-sky-400/25 bg-sky-500/[0.07] p-3 text-xs text-sky-200/90">
        <ShieldAlert className="mt-0.5 size-4 shrink-0" />
        <span>
          You can only see what a user has chosen to send. <b>Nobody can control a user&apos;s phone</b> — a web page cannot do that.
          &ldquo;Request guided control&rdquo; asks permission to send the user one step at a time, which <b>they</b> carry out. Every request and answer is logged.
        </span>
      </div>

      {/* ── LIVE NOW ─────────────────────────────────────────────────────── */}
      <Card className="p-5">
        <h2 className="flex items-center gap-2 font-display text-lg font-bold text-mist-100">
          <CircleDot className={cn("size-5", active.length ? "animate-pulse text-emerald-300" : "text-mist-500")} /> Live now
          {active.length > 0 && <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-[11px] font-bold text-emerald-300">{active.length}</span>}
        </h2>
        {active.length === 0 ? (
          <p className="mt-3 rounded-lg border border-line bg-ink-900 px-4 py-6 text-center text-sm text-mist-500">No screen-sharing sessions are open right now.</p>
        ) : (
          <div className="mt-3 space-y-2">
            {active.map((s) => (
              <div key={s.id} className="rounded-lg border border-emerald-400/25 bg-emerald-500/[0.05] px-3.5 py-2.5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-mist-100">
                      {s.userName}{s.userPublicId ? <span className="ml-1.5 font-mono text-[11px] text-mist-500">ID {s.userPublicId}</span> : null}
                    </p>
                    <p className="text-[11px] text-mist-500">
                      {s.mode === "live" ? "Live screen share" : "Screen recordings"} · started {new Date(s.startedAt).toLocaleTimeString("en-SA", { hour: "2-digit", minute: "2-digit" })}
                      <span className={cn("ml-2 rounded-full px-1.5 py-0.5 text-[10px] font-bold uppercase", CONTROL_TONE[s.control.state] ?? "")}>control: {s.control.state}</span>
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {/* Only offered when the user's screen is genuinely being
                        published — otherwise "Watch" would open an empty box. */}
                    {s.liveSharing && (
                      watching === s.id
                        ? <Button size="sm" variant="secondary" onClick={() => void stopWatching()}><ScreenShareOff className="mr-1.5 size-3.5" /> Stop watching</Button>
                        : <Button size="sm" onClick={() => void watchLive(s.id)}><MonitorPlay className="mr-1.5 size-3.5" /> Watch live</Button>
                    )}
                    <Button size="sm" variant="secondary" onClick={() => setOpenId(openId === s.id ? null : s.id)}>
                      {openId === s.id ? "Hide" : "Open"}
                    </Button>
                    {s.control.state !== "granted" && s.control.state !== "requested" && (
                      <Button size="sm" disabled={busy} onClick={() => void act({ action: "requestControl", sessionId: s.id }, "Request sent — waiting for the user to accept.")}>
                        <Hand className="mr-1.5 size-3.5" /> Request guided control
                      </Button>
                    )}
                    <Button size="sm" variant="danger" disabled={busy} onClick={() => void act({ action: "end", sessionId: s.id }, "Session ended.")}>
                      <Square className="mr-1.5 size-3.5" /> End
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* ── LIVE VIEWER ──────────────────────────────────────────────────── */}
      {watching && (
        <Card className="p-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="flex items-center gap-2 font-display text-lg font-bold text-mist-100">
              <MonitorPlay className="size-5 text-lotus-300" />
              Watching {sessions.find((s) => s.id === watching)?.userName ?? "user"}&apos;s screen
              <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-bold uppercase",
                watchState === "live" ? "bg-emerald-500/15 text-emerald-300"
                  : watchState === "error" ? "bg-rose-500/15 text-rose-300"
                  : "bg-amber-500/15 text-amber-300")}>
                {watchState === "live" ? "live" : watchState === "error" ? "failed" : watchState}
              </span>
            </h2>
            <Button size="sm" variant="secondary" onClick={() => void stopWatching()}>
              <ScreenShareOff className="mr-1.5 size-3.5" /> Stop watching
            </Button>
          </div>

          <div className="relative mt-3 overflow-hidden rounded-xl border border-line bg-black">
            {/* muted + playsInline so it starts without a gesture; there is no
                audio in a screen share anyway. */}
            <video ref={videoRef} autoPlay muted playsInline className="max-h-[70vh] w-full bg-black object-contain" />
            {watchState !== "live" && (
              <div className="absolute inset-0 grid place-items-center bg-black/70 p-6 text-center">
                {watchState === "error" ? (
                  <p className="text-sm text-rose-200">
                    Couldn&apos;t connect to the live share. The user may have stopped sharing, or the session has ended.
                  </p>
                ) : (
                  <p className="flex items-center gap-2 text-sm text-mist-300">
                    <Loader2 className="size-4 animate-spin" />
                    {watchState === "connecting" ? "Connecting…" : "Waiting for the user's screen…"}
                  </p>
                )}
              </div>
            )}
          </div>
          <p className="mt-2 text-[11px] text-mist-500">
            You are <b className="text-mist-400">receiving only</b> — support has no permission to send anything into
            this session, and the user can stop sharing at any moment.
          </p>
        </Card>
      )}

      {/* ── OPEN SESSION DETAIL ──────────────────────────────────────────── */}
      {open && (
        <Card className="p-5">
          <h2 className="font-display text-lg font-bold text-mist-100">{open.userName} — session detail</h2>

          {/* What the user actually agreed to */}
          <div className="mt-3 rounded-xl border border-line bg-ink-900 p-3">
            <p className="flex items-center gap-1.5 text-xs font-bold text-mist-200"><ShieldCheck className="size-3.5 text-emerald-300" /> Consent given {new Date(open.consent.at).toLocaleString("en-SA")}</p>
            <p className="mt-1 text-[11px] italic text-mist-400">&ldquo;{open.consent.text}&rdquo;</p>
          </div>

          {/* Files the user sent */}
          <div className="mt-3">
            <p className="mb-1.5 text-xs font-bold text-mist-200">Shared by the user ({open.attachments.length})</p>
            {open.attachments.length === 0 ? (
              <p className="rounded-lg border border-line bg-ink-900 px-3 py-3 text-center text-[11px] text-mist-500">Nothing sent yet.</p>
            ) : (
              <div className="grid gap-2 sm:grid-cols-2">
                {open.attachments.map((a) => (
                  <a key={a.id} href={withBase(a.url)} target="_blank" rel="noopener noreferrer"
                    className="flex items-center gap-2 rounded-lg border border-line bg-ink-900 px-3 py-2 text-xs text-mist-200 transition hover:border-lotus-400/50">
                    {a.kind === "recording" ? <Video className="size-4 shrink-0 text-lotus-300" /> : <Camera className="size-4 shrink-0 text-lotus-300" />}
                    <span className="min-w-0 flex-1 truncate">{a.name}</span>
                    <span className="shrink-0 text-[10px] text-mist-500">{new Date(a.at).toLocaleTimeString("en-SA", { hour: "2-digit", minute: "2-digit" })}</span>
                  </a>
                ))}
              </div>
            )}
          </div>

          {/* Device facts — the fastest route to a diagnosis */}
          {open.diagnostics && (
            <div className="mt-3">
              <p className="mb-1.5 flex items-center gap-1.5 text-xs font-bold text-mist-200"><Cpu className="size-3.5 text-lotus-300" /> Device &amp; app</p>
              <div className="grid gap-x-4 gap-y-1 rounded-lg border border-line bg-ink-900 p-3 text-[11px] sm:grid-cols-2">
                {Object.entries(open.diagnostics).map(([k, v]) => (
                  <div key={k} className="flex justify-between gap-2">
                    <span className="text-mist-500">{k}</span>
                    <span className="truncate text-right font-mono text-mist-300" title={String(v)}>{String(v)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Guided steps — only once the user has accepted */}
          <div className="mt-3">
            <p className="mb-1.5 text-xs font-bold text-mist-200">Guided steps</p>
            {open.control.state === "granted" ? (
              <div className="flex gap-2">
                <input
                  value={step}
                  onChange={(e) => setStep(e.target.value.slice(0, 300))}
                  placeholder="e.g. Tap the ⚙ icon at the top right, then choose Microphone"
                  className="h-10 min-w-0 flex-1 rounded-lg border border-line bg-ink-900 px-3 text-sm text-mist-100 outline-none focus:border-lotus-400"
                />
                <Button size="sm" disabled={busy || !step.trim()}
                  onClick={() => { void act({ action: "guide", sessionId: open.id, text: step }, "Step sent."); setStep(""); }}>
                  <Send className="mr-1.5 size-3.5" /> Send
                </Button>
              </div>
            ) : (
              <p className="rounded-lg border border-line bg-ink-900 px-3 py-2.5 text-[11px] text-mist-400">
                The user hasn&apos;t accepted guided control{open.control.state === "requested" ? " yet — the request is waiting on their screen." : ". Send a request first."}
              </p>
            )}
            {open.guidance.length > 0 && (
              <ol className="mt-2 space-y-1">
                {open.guidance.map((g) => (
                  <li key={g.id} className="flex gap-2 rounded-lg bg-white/[0.04] px-2.5 py-1.5 text-xs text-mist-200">
                    <span className="shrink-0 text-mist-500">{new Date(g.at).toLocaleTimeString("en-SA", { hour: "2-digit", minute: "2-digit" })}</span>
                    <span className="min-w-0">{g.text}</span>
                  </li>
                ))}
              </ol>
            )}
          </div>

          {/* Audit trail */}
          <div className="mt-3">
            <p className="mb-1.5 flex items-center gap-1.5 text-xs font-bold text-mist-200"><History className="size-3.5 text-lotus-300" /> Session log</p>
            <div className="max-h-56 space-y-1 overflow-y-auto rounded-lg border border-line bg-ink-900 p-2.5">
              {open.events.map((e, i) => (
                <div key={i} className="flex gap-2 text-[11px]">
                  <span className="shrink-0 text-mist-500">{new Date(e.at).toLocaleString("en-SA", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</span>
                  <span className="shrink-0 font-semibold text-mist-300">{e.who}</span>
                  <span className="min-w-0 text-mist-400">{e.what}</span>
                </div>
              ))}
            </div>
          </div>
        </Card>
      )}

      {/* ── HISTORY ──────────────────────────────────────────────────────── */}
      <Card className="p-5">
        <h2 className="flex items-center gap-2 font-display text-lg font-bold text-mist-100">
          <Clock className="size-5 text-lotus-300" /> Session history
          {past.length > 0 && <span className="rounded-full bg-white/[0.07] px-2 py-0.5 text-[11px] font-semibold text-mist-400">{past.length}</span>}
        </h2>
        {past.length === 0 ? (
          <p className="mt-3 rounded-lg border border-line bg-ink-900 px-4 py-6 text-center text-sm text-mist-500">No past sessions yet.</p>
        ) : (
          <div className="mt-3 max-h-[26rem] overflow-y-auto rounded-lg border border-line">
            <table className="w-full min-w-[640px] text-sm">
              <thead className="sticky top-0 bg-ink-900">
                <tr className="text-left text-xs text-mist-400">
                  <th className="px-3 py-2">Started</th>
                  <th className="px-3 py-2">User</th>
                  <th className="px-3 py-2">Type</th>
                  <th className="px-3 py-2">Control</th>
                  <th className="px-3 py-2">Shared</th>
                  <th className="px-3 py-2">Ended by</th>
                  <th className="px-3 py-2"></th>
                </tr>
              </thead>
              <tbody>
                {past.map((s) => (
                  <tr key={s.id} className="border-t border-line/60">
                    <td className="whitespace-nowrap px-3 py-2 text-xs text-mist-400">{new Date(s.startedAt).toLocaleString("en-SA", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</td>
                    <td className="px-3 py-2 text-mist-200">{s.userName}{s.userPublicId ? <span className="ml-1 font-mono text-[10px] text-mist-500">#{s.userPublicId}</span> : null}</td>
                    <td className="px-3 py-2 text-xs text-mist-400">{s.mode === "live" ? "Live share" : "Recording"}</td>
                    <td className="px-3 py-2"><span className={cn("rounded-full px-1.5 py-0.5 text-[10px] font-bold uppercase", CONTROL_TONE[s.control.state] ?? "")}>{s.control.state}</span></td>
                    <td className="px-3 py-2 text-xs text-mist-400">{s.attachments.length}</td>
                    <td className="px-3 py-2 text-xs text-mist-400">{s.endedBy ?? "—"}</td>
                    <td className="px-3 py-2"><Button size="sm" variant="ghost" onClick={() => setOpenId(openId === s.id ? null : s.id)}>{openId === s.id ? "Hide" : "View"}</Button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
