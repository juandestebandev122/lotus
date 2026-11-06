"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/ui/Toast";
import { useConfig } from "@/lib/config";
import { useVoice } from "@/lib/VoiceProvider";
import { callTick, endPaidZoneCall, fetchCallState } from "@/lib/paid-zone";
import { Phone, Video, Coins, Clock, Loader2, PhoneOff } from "lucide-react";

// A live MM:SS (or H:MM:SS) call-duration label.
function fmtDuration(totalSec: number): string {
  const s = Math.max(0, Math.floor(totalSec));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const ss = s % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  return h > 0 ? `${h}:${pad(m)}:${pad(ss)}` : `${m}:${pad(ss)}`;
}

// Mounted in a Paid Zone call room. Drives the call lifecycle for both parties:
//  • RINGING — waiting for the receiver to join (no billing).
//  • ACTIVE  — both connected; the CALLER is billed per minute; a live timer runs.
//  • ENDED   — declined / no-answer / hung up / out-of-coins → leave the room.
// Identical for audio AND video calls (only the per-minute rate differs).
export function PaidZoneCallBilling({ roomId, isCaller, videoCall }: { roomId: string; isCaller: boolean; videoCall: boolean }) {
  const router = useRouter();
  const { toast } = useToast();
  const { config } = useConfig();
  const voice = useVoice();
  const perMin = (videoCall ? config.paidZone?.videoPerMin : config.paidZone?.audioPerMin) ?? (videoCall ? 20 : 10);

  // HARD-DISCONNECT the voice when the call ends. Navigating away is NOT enough —
  // the app-level VoiceProvider keeps the mic/audio alive across navigation, so we
  // must explicitly leave the room (clears roomId → disconnect + release mic +
  // no auto-reconnect). Complements the server closing the SFU room.
  const killVoice = () => { try { if (voice.roomId === roomId) voice.leave(); } catch { /* ignore */ } };
  const [phase, setPhase] = useState<"ringing" | "active" | "ended">("ringing");
  const [balance, setBalance] = useState<number | null>(null);
  const [otherName, setOtherName] = useState("");
  const [startTs, setStartTs] = useState<number | null>(null); // when the call connected (ms)
  const [elapsed, setElapsed] = useState(0); // seconds since connect (live timer)
  const [showLowWarning, setShowLowWarning] = useState(false); // half-screen "coins running low" popup
  const endedRef = useRef(false);
  const leftRef = useRef(false);
  const warnedRef = useRef(false); // low-balance heads-up shown once (reset if they recharge)
  // Warn while there's still ~this many minutes of coins left, so the user has
  // time to recharge BEFORE the call is cut off.
  const LOW_WARNING_MINUTES = 3;

  const leave = (msg: string, to: string = "/paid-zone") => {
    if (leftRef.current) return;
    leftRef.current = true;
    endedRef.current = true;
    killVoice();
    toast(msg, "info");
    setTimeout(() => router.push(to), 1300);
  };

  // The receiver runs out → end-of-coins warning, then leave (matches the caller's).
  const outOfCoins = (to: string = "/paid-zone") => {
    if (leftRef.current) return;
    leftRef.current = true;
    endedRef.current = true;
    killVoice();
    toast("Insufficient coins. The call will end now.", "error");
    setTimeout(() => router.push(to), 1500);
  };

  // Remember the server's call-start time so BOTH sides show the same timer.
  const noteStart = (iso?: string) => {
    if (!iso) return;
    const ts = Date.parse(iso);
    if (!Number.isNaN(ts)) setStartTs((prev) => prev ?? ts);
  };

  // Explicit hang-up button → end the call for both, then leave.
  const hangUp = async () => {
    if (leftRef.current) return;
    leftRef.current = true;
    endedRef.current = true;
    killVoice();
    await endPaidZoneCall(roomId);
    toast("Call ended", "info");
    router.push("/paid-zone");
  };

  // Hang up cleanly if this screen unmounts (browser back / minimise away) — end
  // the call for both AND disconnect the voice so audio never lingers.
  useEffect(() => () => { if (!endedRef.current) { killVoice(); endPaidZoneCall(roomId); } }, [roomId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Live call timer — ticks every second once the call is active (both parties).
  useEffect(() => {
    if (phase !== "active" || startTs == null) return;
    const tick = () => setElapsed(Math.max(0, Math.floor((Date.now() - startTs) / 1000)));
    tick();
    const iv = setInterval(tick, 1000);
    return () => clearInterval(iv);
  }, [phase, startTs]);

  // Poll the call state (both parties) for the banner + auto-leave when it ends.
  useEffect(() => {
    let on = true;
    const poll = async () => {
      const s = await fetchCallState(roomId);
      if (!on || leftRef.current) return;
      if (s.otherName) setOtherName(s.otherName);
      noteStart(s.startedAt);
      if (s.status === "active") setPhase("active");
      else if (s.status === "ringing") setPhase("ringing");
      else {
        const r = s.reason;
        if (r === "no_coins") outOfCoins();
        else leave(r === "rejected" ? `${s.otherName || "They"} declined the call.`
          : r === "missed" ? "No answer — they didn't pick up."
          : "Call ended.");
      }
    };
    poll();
    const t = setInterval(poll, 2500);
    const onVis = () => { if (!document.hidden) poll(); };
    document.addEventListener("visibilitychange", onVis);
    return () => { on = false; clearInterval(t); document.removeEventListener("visibilitychange", onVis); };
  }, [roomId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Caller-only billing — runs CONTINUOUSLY so the call activates + starts billing
  // the moment the receiver is in the room (server decides; idempotent per minute).
  useEffect(() => {
    if (!isCaller) return;
    let on = true;
    const doTick = async () => {
      if (leftRef.current) return;
      const t = await callTick(roomId);
      if (!on) return;
      if (typeof t.balance === "number") setBalance(t.balance);
      noteStart(t.startedAt);
      if (t.active) setPhase("active");
      // LOW-BALANCE WARNING — show a half-screen "coins running low" popup while
      // there are still a few minutes left (so they can recharge in time). Reset
      // if they recharge above the threshold, so they'd be warned again later.
      if (typeof t.balance === "number" && !t.disconnect) {
        if (t.balance >= perMin * LOW_WARNING_MINUTES) {
          warnedRef.current = false;
        } else if (t.balance > 0 && (t.lowBalance || t.balance < perMin * LOW_WARNING_MINUTES) && !warnedRef.current) {
          warnedRef.current = true;
          setShowLowWarning(true);
        }
      }
      if (t.disconnect) {
        endedRef.current = true; leftRef.current = true; on = false;
        killVoice(); // out of coins → disconnect the voice immediately, then go to wallet
        setTimeout(() => router.push("/wallet"), 1600);
      }
    };
    doTick();
    const iv = setInterval(doTick, 5_000); // frequent + idempotent (bills on whole-minute boundaries)
    return () => { on = false; clearInterval(iv); };
  }, [isCaller, roomId]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="mx-auto mb-2 flex flex-col items-center gap-2">
      {phase === "ringing" ? (
        <div className="flex items-center justify-center gap-2 rounded-full border border-fuchsia-400/20 bg-fuchsia-500/10 px-4 py-1.5 text-xs font-semibold text-fuchsia-100">
          <Loader2 className="size-3.5 animate-spin" /> Ringing… waiting for {otherName || "them"} to answer
        </div>
      ) : (
        <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 rounded-full border border-fuchsia-400/20 bg-fuchsia-500/10 px-4 py-1.5 text-xs font-semibold text-fuchsia-100">
          <span className="inline-flex items-center gap-1.5">{videoCall ? <Video className="size-3.5" /> : <Phone className="size-3.5" />} {videoCall ? "Video" : "Audio"} call · {perMin}/min</span>
          {/* Live call duration — shown to BOTH parties for audio AND video. */}
          <span className="inline-flex items-center gap-1 text-mist-100"><Clock className="size-3.5" /> {fmtDuration(elapsed)}</span>
          {isCaller ? (
            <span className={`inline-flex items-center gap-1 ${balance !== null && balance < perMin ? "text-rose-300" : "text-gold-200"}`}><Coins className="size-3.5" /> {balance === null ? "…" : balance.toLocaleString("en-SA")} left</span>
          ) : (
            <span className="text-mist-300">the caller is billed</span>
          )}
        </div>
      )}
      {/* Always-available hang-up — either side can end the call. */}
      <button onClick={hangUp} className="inline-flex items-center gap-2 rounded-full bg-rose-500 px-5 py-2 text-sm font-bold text-white shadow-lg transition hover:bg-rose-600 active:scale-95">
        <PhoneOff className="size-4" /> End Call
      </button>

      {/* LOW-COIN WARNING — a half-screen popup shown to the CALLER while a few
          minutes of coins remain, so they can recharge before the call is cut. */}
      {showLowWarning && (
        <div className="fixed inset-0 z-[130] flex items-end justify-center bg-black/60 p-3 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-t-3xl border border-amber-400/30 bg-ink-900 p-6 pb-8 text-center shadow-2xl sm:rounded-3xl">
            <span className="mx-auto mb-3 grid size-14 place-items-center rounded-full bg-amber-500/15 text-amber-300">
              <Coins className="size-7" />
            </span>
            <h2 className="font-display text-xl font-extrabold text-mist-50">Your coins are running low.</h2>
            <p className="mt-2 text-sm text-mist-300">
              Your paid call will end soon.
              {balance !== null && <> You have <span className="font-semibold text-gold-200">{balance.toLocaleString("en-SA")}</span> coins (~{Math.max(0, Math.floor(balance / perMin))} min) left.</>}
            </p>
            <p className="mt-1 text-sm font-semibold text-mist-100">Recharge now to continue your call without interruption.</p>
            <div className="mt-5 flex gap-3">
              <button
                onClick={() => setShowLowWarning(false)}
                className="flex-1 rounded-xl border border-line bg-ink-800 px-4 py-3 text-sm font-bold text-mist-200 transition hover:bg-ink-700"
              >
                Continue
              </button>
              <button
                onClick={() => router.push("/wallet")}
                className="flex-1 rounded-xl bg-gradient-to-r from-amber-500 to-amber-400 px-4 py-3 text-sm font-bold text-amber-950 shadow-lg transition hover:brightness-110"
              >
                Recharge Now
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
