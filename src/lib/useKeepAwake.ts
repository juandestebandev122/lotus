"use client";

import { useEffect } from "react";

interface WakeLockSentinelLike {
  release: () => Promise<void>;
  addEventListener?: (type: "release", cb: () => void) => void;
}
interface WakeLockLike {
  request: (type: "screen") => Promise<WakeLockSentinelLike>;
}

/**
 * Keep the screen awake while `active` (e.g. inside a live voice room).
 * Uses the Screen Wake Lock API and RE-ACQUIRES the lock whenever the OS
 * releases it — on tab focus, taps, the lock's own release event, and a
 * periodic check — so the screen never sleeps during an active session.
 * Falls back to a tiny looping muted video where Wake Lock isn't supported.
 */
export function useKeepAwake(active: boolean) {
  useEffect(() => {
    if (!active || typeof navigator === "undefined") return;
    const wl = (navigator as Navigator & { wakeLock?: WakeLockLike }).wakeLock;
    let lock: WakeLockSentinelLike | null = null;
    let stopped = false;

    const acquire = async () => {
      if (stopped || !wl || lock) return;
      try {
        lock = await wl.request("screen");
        lock.addEventListener?.("release", () => { lock = null; });
      } catch {
        lock = null;
      }
    };

    // Fallback: a hidden looping muted video keeps the screen awake on
    // browsers without the Wake Lock API (older / some iOS).
    let video: HTMLVideoElement | null = null;
    const startVideoFallback = () => {
      if (wl || video) return;
      try {
        const canvas = document.createElement("canvas");
        canvas.width = canvas.height = 2;
        const ctx = canvas.getContext("2d");
        let on = false;
        const draw = () => { if (ctx) { ctx.fillStyle = (on = !on) ? "#000001" : "#000002"; ctx.fillRect(0, 0, 2, 2); } };
        draw();
        const stream = (canvas as HTMLCanvasElement & { captureStream?: (fps: number) => MediaStream }).captureStream?.(1);
        if (!stream) return;
        video = document.createElement("video");
        video.muted = true;
        video.setAttribute("muted", "");
        video.setAttribute("playsinline", "");
        (video as HTMLVideoElement & { playsInline?: boolean }).playsInline = true;
        video.style.cssText = "position:fixed;width:1px;height:1px;opacity:0;pointer-events:none;left:0;top:0;";
        video.srcObject = stream;
        document.body.appendChild(video);
        video.play().catch(() => {});
        const di = window.setInterval(draw, 1000);
        (video as HTMLVideoElement & { _di?: number })._di = di;
      } catch {
        /* ignore */
      }
    };

    acquire();
    startVideoFallback();

    const reacquire = () => { if (document.visibilityState === "visible") acquire(); };
    document.addEventListener("visibilitychange", reacquire);
    window.addEventListener("focus", reacquire);
    document.addEventListener("click", reacquire);
    document.addEventListener("touchstart", reacquire, { passive: true });
    const iv = window.setInterval(reacquire, 15000);

    return () => {
      stopped = true;
      clearInterval(iv);
      document.removeEventListener("visibilitychange", reacquire);
      window.removeEventListener("focus", reacquire);
      document.removeEventListener("click", reacquire);
      document.removeEventListener("touchstart", reacquire);
      try { lock?.release(); } catch { /* ignore */ }
      if (video) {
        try {
          clearInterval((video as HTMLVideoElement & { _di?: number })._di);
          video.pause();
          video.remove();
        } catch { /* ignore */ }
      }
    };
  }, [active]);
}
