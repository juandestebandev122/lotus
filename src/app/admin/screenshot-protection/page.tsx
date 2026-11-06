"use client";

import { useEffect, useState } from "react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import { useConfig, saveConfig } from "@/lib/config";
import { cn } from "@/lib/cn";
import { CameraOff, Save, ShieldCheck, Info, MonitorOff, Video, Cast, ScanEye, PhoneOff, MessageSquareWarning, Mic, LayoutGrid, Fingerprint } from "lucide-react";

type CP = { screenshot: boolean; recording: boolean; sharing: boolean; thirdParty: boolean; autoEndCall: boolean; warning: boolean; watermark: boolean; audioRecording: boolean; videoRecording: boolean; mirroring: boolean; allScreens: boolean };
type Mods = { home: boolean; profile: boolean; chat: boolean; voiceRoom: boolean; wallet: boolean; paidZone: boolean; reels: boolean; tournaments: boolean; competitions: boolean };

const MODULES: { key: keyof Mods; label: string; note: string }[] = [
  { key: "home", label: "Home", note: "/home" },
  { key: "profile", label: "Profile", note: "your profile + other users' profiles" },
  { key: "chat", label: "Chat / Messages", note: "private + group DMs" },
  { key: "voiceRoom", label: "Voice & Video Rooms", note: "all rooms (Paid Zone always protected)" },
  { key: "wallet", label: "Wallet & Payment", note: "wallet + top-up screens" },
  { key: "paidZone", label: "Paid Zone", note: "directory + private calls" },
  { key: "reels", label: "Reels", note: "reels feed + player" },
  { key: "tournaments", label: "Tournaments", note: "tournament screens" },
  { key: "competitions", label: "Competitions", note: "competition screens" },
];

const ROWS: { key: keyof CP; icon: typeof Video; label: string; desc: string; does: string }[] = [
  { key: "screenshot", icon: MonitorOff, label: "Screenshot Protection",
    desc: "Protects Paid Zone screens, private calls and the wallet against screenshots.",
    does: "Privacy shield when the app goes to the background (the phone's app-switcher preview shows a black shield, not the content) · PrintScreen on computers is answered with a warning and the copied image is cleared from the clipboard where the browser allows. (The traceable name+ID watermark is now a SEPARATE switch below — off by default.)" },
  { key: "recording", icon: Video, label: "Screen Recording Protection",
    desc: "Counter-measures against screen recording on protected screens.",
    does: "Keeps the privacy shield active while the app is backgrounded (recordings made while switching apps show the shield) and applies the same watermark. Where the operating system reports an active capture to the app, the warning / auto-end actions below are triggered." },
  { key: "sharing", icon: Cast, label: "Screen Sharing Protection",
    desc: "Blocks screen-sharing from inside protected screens.",
    does: "Any attempt to start a screen share from a protected page is refused instantly — a Paid Zone call can never be screen-shared from within the app." },
  { key: "thirdParty", icon: ScanEye, label: "Third-Party Capture Detection",
    desc: "Detect third-party capture tools where the platform allows it.",
    does: "Applies wherever the device reports capture activity to the app (mainly the future Android app — see the note below). The switch is live now so it works there the moment that app ships." },
  { key: "autoEndCall", icon: PhoneOff, label: "Auto End Call if Recording Detected",
    desc: "If a recording IS detected during a call, end the call automatically.",
    does: "When a capture is detected (where the platform reports it), the call is ended instead of only warning. OFF = warn only." },
  { key: "warning", icon: MessageSquareWarning, label: "Show Warning Message",
    desc: "Tell users that screenshots/recording are not allowed when they enter.",
    does: "Shows a clear \"Screenshots & screen recording are not allowed here\" notice on entering any protected screen. (A web browser can't actually block the phone's screenshot button — this is a deterrent notice; true blocking arrives with the native app.)" },
  { key: "watermark", icon: Fingerprint, label: "Traceable Watermark",
    desc: "Overlay the viewer's name + member ID faintly across protected screens. OFF by default.",
    does: "When ON, any screenshot that IS taken carries the viewer's name + ID, so a leaked capture is traceable to the exact account. OFF = no overlay (a cleaner screen). This is the tiled \"name · ID\" text some users found intrusive — leave it OFF to remove it." },
  { key: "audioRecording", icon: Mic, label: "Audio Recording Protection",
    desc: "Protect voice rooms and audio/video calls from audio recording.",
    does: "NATIVE-APP feature. No web browser can block microphone/audio capture — this switch is saved now and will drive the native app the moment it ships." },
  { key: "videoRecording", icon: Video, label: "Video Recording Protection",
    desc: "Protect private / group video calls and live video from recording.",
    does: "NATIVE-APP feature — the same background shield + watermark apply on the web; a true recorder block needs the native app." },
  { key: "mirroring", icon: Cast, label: "Screen Mirroring / Casting Protection",
    desc: "Block casting / screen-mirroring on protected screens.",
    does: "NATIVE-APP feature — the in-app screen-share block above is the web equivalent; full cast/mirror blocking needs the native app." },
];

export default function AdminScreenshotProtectionPage() {
  const { toast } = useToast();
  const { config, loading, reload } = useConfig();
  const [cp, setCp] = useState<CP>({ screenshot: true, recording: true, sharing: true, thirdParty: true, autoEndCall: false, warning: true, watermark: false, audioRecording: true, videoRecording: true, mirroring: true, allScreens: false });
  const [mods, setMods] = useState<Mods>({ home: false, profile: false, chat: false, voiceRoom: false, wallet: true, paidZone: true, reels: false, tournaments: false, competitions: false });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (loading) return;
    const c = config.captureProtection ?? {};
    setCp({
      screenshot: c.screenshot !== false,
      recording: c.recording !== false,
      sharing: c.sharing !== false,
      thirdParty: c.thirdParty !== false,
      autoEndCall: c.autoEndCall === true,
      warning: c.warning !== false,
      watermark: c.watermark === true,
      audioRecording: c.audioRecording !== false,
      videoRecording: c.videoRecording !== false,
      mirroring: c.mirroring !== false,
      allScreens: c.allScreens === true,
    });
    const m = c.modules ?? {};
    setMods({
      home: m.home === true, profile: m.profile === true, chat: m.chat === true, voiceRoom: m.voiceRoom === true,
      wallet: m.wallet !== false, paidZone: m.paidZone !== false,
      reels: m.reels === true, tournaments: m.tournaments === true, competitions: m.competitions === true,
    });
  }, [loading, config]);

  const save = async () => {
    setSaving(true);
    const res = await saveConfig({ captureProtection: { ...cp, modules: mods } });
    setSaving(false);
    if (res.ok) { await reload(); toast("Screenshot protection saved — live for all users immediately.", "success"); }
    else toast(res.error ?? "Could not save", "error");
  };

  return (
    <div className="mx-auto max-w-3xl space-y-5 pb-24">
      <div>
        <h1 className="flex items-center gap-2 font-display text-2xl font-extrabold text-mist-100">
          <CameraOff className="size-6 text-lotus-300" /> Screenshot Protection
        </h1>
        <p className="mt-1 text-sm text-mist-400">
          Applies every screenshot / recording deterrent the web platform allows. Use the master switch below to
          protect the <span className="font-semibold text-mist-200">entire app</span>, or pick individual screens.
          Changes apply <span className="font-semibold text-mist-200">instantly to all users</span> — no app update needed.
        </p>
      </div>

      {/* READ-FIRST honest capability note — kept at the TOP so expectations are clear. */}
      <Card className="flex items-start gap-3 border-amber-400/25 bg-amber-500/[0.05] p-4">
        <Info className="mt-0.5 size-5 shrink-0 text-amber-300" />
        <div className="space-y-1.5 text-xs leading-relaxed text-mist-400">
          <p className="text-sm font-bold text-amber-200">Please read first — what a website can and cannot block</p>
          <p>
            Lotus currently runs as a <b className="text-mist-200">web app in the phone&apos;s browser</b>. No website —
            not WhatsApp Web, not any bank — can block the phone&apos;s own screenshot button or screen recorder. That power
            belongs only to an <b className="text-mist-200">installed native app</b> (Android&apos;s <i>FLAG_SECURE</i>, which turns
            screenshots &amp; recordings completely black). So on the website, a determined user can still capture the screen.
          </p>
          <p>
            What this page gives you is the <b className="text-mist-200">maximum a browser allows</b>: a black privacy shield when
            the app is backgrounded, a traceable name+ID watermark, a PrintScreen counter-measure, entry warnings, and a hard block
            on in-app screen sharing. <b className="text-mist-200">To truly block screenshots &amp; recording you need the native
            Android/iOS app</b> — these same switches will drive its FLAG_SECURE protection the moment it ships. (On iOS, even native
            apps can only <i>detect</i> recording, never fully prevent it — an Apple limit that applies to every app.)
          </p>
        </div>
      </Card>

      {/* Master switch — protect the ENTIRE app in one click. */}
      <Card className="flex items-center gap-3 p-4">
        <ShieldCheck className="size-6 shrink-0 text-lotus-300" />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-bold text-mist-100">Protect the entire app (all screens)</p>
          <p className="mt-0.5 text-xs text-mist-400">One switch turns on every web deterrent above across <b className="text-mist-200">every screen</b> — home, chat, profiles, rooms, wallet, everything. When ON, the per-module list below is ignored (all screens are covered).</p>
        </div>
        <button
          onClick={() => setCp((c) => ({ ...c, allScreens: !c.allScreens }))}
          className={cn("relative h-7 w-12 shrink-0 rounded-full transition", cp.allScreens ? "bg-emerald-500" : "bg-white/10")}
          aria-pressed={cp.allScreens} title={cp.allScreens ? "Turn off" : "Turn on"}
        >
          <span className={cn("absolute top-0.5 size-6 rounded-full bg-white transition-all", cp.allScreens ? "left-[22px]" : "left-0.5")} />
        </button>
      </Card>

      {/* Who it applies to */}
      <Card className="flex items-start gap-3 p-4">
        <ShieldCheck className="mt-0.5 size-5 shrink-0 text-emerald-300" />
        <p className="text-sm text-mist-300">
          <span className="font-semibold text-mist-100">Users only.</span> Admin accounts are always exempt — admins can
          capture anything for monitoring and support.
        </p>
      </Card>

      {/* The six switches */}
      <Card className="divide-y divide-white/5 p-0">
        {ROWS.map((r) => (
          <div key={r.key} className="flex items-start gap-3 px-5 py-4">
            <r.icon className="mt-0.5 size-5 shrink-0 text-lotus-300" />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-bold text-mist-100">{r.label}</p>
              <p className="mt-0.5 text-xs text-mist-400">{r.desc}</p>
              <p className="mt-1.5 text-[11px] leading-relaxed text-mist-500">{r.does}</p>
            </div>
            <button
              onClick={() => setCp((c) => ({ ...c, [r.key]: !c[r.key] }))}
              className={cn(
                "relative mt-1 h-6 w-11 shrink-0 rounded-full transition",
                cp[r.key] ? "bg-emerald-500" : "bg-white/10",
              )}
              aria-pressed={cp[r.key]}
              title={cp[r.key] ? "Turn off" : "Turn on"}
            >
              <span className={cn("absolute top-0.5 size-5 rounded-full bg-white transition-all", cp[r.key] ? "left-[22px]" : "left-0.5")} />
            </button>
          </div>
        ))}
      </Card>

      {/* Per-module: which screens the web deterrent is applied to */}
      <Card className={cn("p-5", cp.allScreens && "opacity-50")}>
        <h2 className="flex items-center gap-2 font-semibold text-mist-100"><LayoutGrid className="size-4 text-lotus-300" /> Protect by module</h2>
        <p className="mt-1 text-xs text-mist-400">{cp.allScreens ? "The master switch above is ON — every screen is already protected, so these per-module choices are ignored. Turn the master switch off to pick individual screens." : "Choose exactly which screens get the protection above. Wallet & Paid Zone are on by default."}</p>
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          {MODULES.map((m) => (
            <div key={m.key} className="flex items-center gap-3 rounded-lg border border-line bg-ink-900/50 p-2.5">
              <div className="min-w-0 flex-1"><div className="text-sm text-mist-100">{m.label}</div><div className="text-[11px] text-mist-500">{m.note}</div></div>
              <button
                onClick={() => setMods((s) => ({ ...s, [m.key]: !s[m.key] }))}
                className={cn("relative h-6 w-11 shrink-0 rounded-full transition", mods[m.key] ? "bg-emerald-500" : "bg-white/10")}
                aria-pressed={mods[m.key]} title={mods[m.key] ? "Turn off" : "Turn on"}
              >
                <span className={cn("absolute top-0.5 size-5 rounded-full bg-white transition-all", mods[m.key] ? "left-[22px]" : "left-0.5")} />
              </button>
            </div>
          ))}
        </div>
      </Card>

      <Button onClick={save} disabled={saving}><Save className="size-4" /> {saving ? "Saving…" : "Save protection settings"}</Button>
    </div>
  );
}
