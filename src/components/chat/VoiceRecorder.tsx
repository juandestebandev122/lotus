"use client";

// Voice-note recorder for private chat. Follows the same MediaRecorder lifecycle
// as RoomRecorder, but captures the MICROPHONE rather than the mixed room audio.

import { useEffect, useRef, useState } from "react";
import { Mic, Square, Trash2, Send } from "lucide-react";
import { cn } from "@/lib/cn";

/** Pick a container the browser can actually record. Chrome/Android give
 *  webm/opus; iOS Safari only offers mp4 — both are accepted by the uploader. */
function pickMime(): string {
  const candidates = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/ogg;codecs=opus"];
  for (const m of candidates) {
    if (typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported(m)) return m;
  }
  return "";
}

export function VoiceRecorder({ onSend, onCancel }: {
  onSend: (file: File, seconds: number) => void;
  onCancel: () => void;
}) {
  const [secs, setSecs] = useState(0);
  const [error, setError] = useState("");
  const recRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const secsRef = useRef(0);
  const sendingRef = useRef(false);

  // Start on mount; always release the microphone on unmount.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        if (cancelled) { stream.getTracks().forEach((t) => t.stop()); return; }
        streamRef.current = stream;
        const mimeType = pickMime();
        const rec = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
        recRef.current = rec;
        chunksRef.current = [];
        rec.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data); };
        rec.onstop = () => {
          streamRef.current?.getTracks().forEach((t) => t.stop());
          if (!sendingRef.current) return; // cancelled — throw the recording away
          const type = mimeType || "audio/webm";
          const ext = type.includes("mp4") ? "m4a" : type.includes("ogg") ? "ogg" : "webm";
          const blob = new Blob(chunksRef.current, { type });
          onSend(new File([blob], `voice_${Date.now()}.${ext}`, { type }), secsRef.current);
        };
        rec.start(1000);
      } catch {
        if (!cancelled) setError("Microphone permission is needed to record a voice message.");
      }
    })();
    return () => {
      cancelled = true;
      try { recRef.current?.state === "recording" && recRef.current.stop(); } catch { /* ignore */ }
      streamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, [onSend]);

  // Tick the visible timer (cap at 5 minutes so a forgotten recording can't run on).
  useEffect(() => {
    const t = setInterval(() => {
      setSecs((s) => {
        const next = s + 1;
        secsRef.current = next;
        if (next >= 300) finish();
        return next;
      });
    }, 1000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const finish = () => {
    sendingRef.current = true;
    try { if (recRef.current?.state === "recording") recRef.current.stop(); } catch { /* ignore */ }
  };
  const discard = () => {
    sendingRef.current = false;
    try { if (recRef.current?.state === "recording") recRef.current.stop(); } catch { /* ignore */ }
    onCancel();
  };

  if (error) {
    return (
      <div className="flex items-center gap-2 rounded-xl border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-xs text-rose-200">
        <span className="flex-1">{error}</span>
        <button onClick={onCancel} className="font-semibold hover:underline">Close</button>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2 rounded-xl border border-line bg-ink-800 px-3 py-2">
      <span className="relative flex size-2.5 shrink-0">
        <span className="absolute inline-flex size-full animate-ping rounded-full bg-rose-400 opacity-75" />
        <span className="relative inline-flex size-2.5 rounded-full bg-rose-500" />
      </span>
      <Mic className="size-4 shrink-0 text-rose-300" />
      <span className="flex-1 text-sm font-semibold tabular-nums text-mist-100">
        {Math.floor(secs / 60)}:{String(secs % 60).padStart(2, "0")}
      </span>
      <button onClick={discard} title="Delete recording" className="grid size-8 place-items-center rounded-lg text-mist-400 transition hover:bg-rose-500/15 hover:text-rose-300">
        <Trash2 className="size-4" />
      </button>
      <button onClick={finish} title="Send voice message" className={cn("grid size-8 place-items-center rounded-lg bg-lotus-500 text-white transition hover:bg-lotus-400")}>
        <Send className="size-4" />
      </button>
      <Square className="hidden" />
    </div>
  );
}
