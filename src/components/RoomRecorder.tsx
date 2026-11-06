"use client";

import { useEffect, useRef, useState } from "react";
import { useVoice } from "@/lib/VoiceProvider";
import { useConfig } from "@/lib/config";
import { useToast } from "@/components/ui/Toast";
import { withBase } from "@/lib/base-path";
import { cn } from "@/lib/cn";
import { Circle, Square, Loader2 } from "lucide-react";

/**
 * Host / co-host room recording control. Records the LIVE room audio (everyone
 * speaking, mixed via the voice layer) on this device, then uploads it so it
 * appears in Admin → Room Recordings — playable & downloadable. Shown only when the
 * admin has enabled room recording and the viewer can control the room.
 *
 * Note: capture runs in this browser tab, so it records what THIS host hears; the
 * tab must stay open while recording (a server-side recorder would be needed for
 * fully unattended capture).
 */
export function RoomRecorder({ roomId, canRecord }: { roomId: string; canRecord: boolean }) {
  const { config } = useConfig();
  const voice = useVoice();
  const { toast } = useToast();
  const [state, setState] = useState<"idle" | "recording" | "saving">("idle");
  const [secs, setSecs] = useState(0);
  const recRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const stopMixRef = useRef<(() => void) | null>(null);
  const recIdRef = useRef<string | null>(null);
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => () => { // cleanup on unmount — never leave a recorder running
    try { recRef.current?.state === "recording" && recRef.current.stop(); } catch { /* ignore */ }
    stopMixRef.current?.();
    if (tickRef.current) clearInterval(tickRef.current);
  }, []);

  const rec = config.recording;
  const recordingOn = rec?.master === true && (rec?.roomEnabled === true || rec?.modules?.voiceRoomVoice === true || rec?.modules?.privateRoomVoice === true);
  if (!canRecord || !recordingOn) return null;

  const start = async () => {
    const mix = voice.captureRoomAudio();
    if (!mix) { toast("No live audio to record yet — start talking / wait for members to join.", "info"); return; }
    if (typeof MediaRecorder === "undefined") { toast("Recording isn't supported on this browser.", "error"); return; }
    try {
      const res = await fetch(withBase(`/api/rooms/${roomId}/recording`), {
        method: "POST", credentials: "include", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "start" }),
      });
      const d = await res.json();
      if (!res.ok || !d.id) { mix.stop(); toast(d.error ?? "Could not start recording", "error"); return; }
      recIdRef.current = d.id as string;
      const mime = MediaRecorder.isTypeSupported("audio/webm;codecs=opus") ? "audio/webm;codecs=opus" : "audio/webm";
      const mr = new MediaRecorder(mix.stream, { mimeType: mime });
      chunksRef.current = [];
      mr.ondataavailable = (e) => { if (e.data && e.data.size) chunksRef.current.push(e.data); };
      mr.onstop = () => upload();
      mr.start(1000);
      recRef.current = mr;
      stopMixRef.current = mix.stop;
      setSecs(0);
      tickRef.current = setInterval(() => setSecs((s) => s + 1), 1000);
      setState("recording");
      toast("Recording started.", "success");
    } catch { mix.stop(); toast("Could not start recording", "error"); }
  };

  const stop = () => {
    if (recRef.current?.state === "recording") { setState("saving"); recRef.current.stop(); }
    if (tickRef.current) clearInterval(tickRef.current);
  };

  const upload = async () => {
    stopMixRef.current?.(); stopMixRef.current = null;
    const recId = recIdRef.current;
    const blob = new Blob(chunksRef.current, { type: "audio/webm" });
    chunksRef.current = [];
    // Always finalise the recording row (stop), then upload the audio if we got any.
    try { await fetch(withBase(`/api/rooms/${roomId}/recording`), { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "stop" }) }); } catch { /* ignore */ }
    if (recId && blob.size > 0) {
      try {
        const fd = new FormData();
        fd.append("recId", recId);
        fd.append("file", blob, "recording.webm");
        const res = await fetch(withBase(`/api/rooms/${roomId}/recording`), { method: "POST", credentials: "include", body: fd });
        if (res.ok) toast("Recording saved — find it in Admin → Room Recordings.", "success");
        else { const d = await res.json().catch(() => ({})); toast(d.error ?? "Could not save the recording", "error"); }
      } catch { toast("Could not upload the recording", "error"); }
    } else {
      toast("Recording stopped.", "info");
    }
    recIdRef.current = null;
    setState("idle");
    setSecs(0);
  };

  const mmss = `${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, "0")}`;

  return (
    <button
      onClick={state === "recording" ? stop : state === "idle" ? start : undefined}
      disabled={state === "saving"}
      title={state === "recording" ? "Stop recording" : "Record this room"}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold transition",
        state === "recording" ? "bg-rose-500 text-white hover:brightness-110" : "bg-white/10 text-white hover:bg-white/20",
      )}
    >
      {state === "saving" ? <><Loader2 className="size-3.5 animate-spin" /> Saving…</>
        : state === "recording" ? <><Square className="size-3.5 fill-current" /> Stop · {mmss}</>
        : <><Circle className="size-3.5 fill-rose-500 text-rose-500" /> Record</>}
    </button>
  );
}
