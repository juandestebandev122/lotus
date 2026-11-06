"use client";

// Read media metadata (duration, size, a small video thumbnail) in the BROWSER —
// used both when the admin uploads a file and, lazily, for older library items that
// were stored before we captured this. Same-origin media (/api/media/…) decodes into
// a canvas without tainting it, so thumbnails work for existing videos too.

export interface MediaMeta { durationSec?: number; sizeBytes?: number; thumb?: string }

const finite = (n: number) => Number.isFinite(n) && n > 0;

/** Duration + size (+ a video thumbnail) from a File chosen for upload. */
export async function readFileMeta(file: File, kind: "audio" | "video"): Promise<MediaMeta> {
  const meta: MediaMeta = { sizeBytes: file.size };
  const url = URL.createObjectURL(file);
  try {
    const probe = await probeElement(url, kind);
    if (probe.durationSec) meta.durationSec = probe.durationSec;
    if (probe.thumb) meta.thumb = probe.thumb;
  } finally {
    URL.revokeObjectURL(url);
  }
  return meta;
}

/** Probe an existing (same-origin) library URL for duration + a video thumbnail. */
export async function probeUrlMeta(src: string, kind: "audio" | "video"): Promise<MediaMeta> {
  try { return await probeElement(src, kind); } catch { return {}; }
}

function probeElement(url: string, kind: "audio" | "video"): Promise<MediaMeta> {
  return new Promise((resolve) => {
    const out: MediaMeta = {};
    let done = false;
    const el = document.createElement(kind === "video" ? "video" : "audio") as HTMLMediaElement;
    const finish = () => { if (done) return; done = true; try { el.src = ""; el.remove(); } catch { /* ignore */ } resolve(out); };
    const timer = setTimeout(finish, 8000);
    const end = () => { clearTimeout(timer); finish(); };
    el.preload = "metadata"; el.muted = true;
    try { (el as HTMLVideoElement).crossOrigin = "anonymous"; } catch { /* ignore */ }
    el.addEventListener("error", end, { once: true });
    el.addEventListener("loadedmetadata", () => {
      if (finite(el.duration)) out.durationSec = Math.round(el.duration);
      if (kind !== "video") return end();
      const v = el as HTMLVideoElement;
      const grab = () => {
        try {
          const scale = Math.min(1, 200 / (v.videoWidth || 200));
          const c = document.createElement("canvas");
          c.width = Math.max(1, Math.round((v.videoWidth || 200) * scale));
          c.height = Math.max(1, Math.round((v.videoHeight || 112) * scale));
          const ctx = c.getContext("2d");
          if (ctx) { ctx.drawImage(v, 0, 0, c.width, c.height); out.thumb = c.toDataURL("image/jpeg", 0.6); }
        } catch { /* decode/taint fail — no thumb */ }
        end();
      };
      v.addEventListener("seeked", grab, { once: true });
      try { v.currentTime = Math.min(1, (el.duration || 2) / 2); } catch { grab(); }
    }, { once: true });
    el.src = url;
  });
}

export function fmtDuration(sec?: number): string {
  if (!sec || sec <= 0) return "";
  const s = Math.round(sec);
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), r = s % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  return h > 0 ? `${h}:${pad(m)}:${pad(r)}` : `${m}:${pad(r)}`;
}

export function fmtSize(bytes?: number): string {
  if (!bytes || bytes <= 0) return "";
  if (bytes < 1024) return `${bytes} B`;
  const kb = bytes / 1024; if (kb < 1024) return `${Math.round(kb)} KB`;
  const mb = kb / 1024; if (mb < 1024) return `${mb.toFixed(mb < 10 ? 1 : 0)} MB`;
  return `${(mb / 1024).toFixed(1)} GB`;
}
