"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { cn } from "@/lib/cn";
import {
  RotateCcw, RotateCw, FlipHorizontal, FlipVertical, ZoomIn, ZoomOut, Maximize,
  Minimize, Crop, Circle as CircleIcon, Sun, Moon, X, Check, RefreshCw, Loader2,
} from "lucide-react";

// A WhatsApp/Instagram-style profile-photo editor: crop shape (square / circle /
// free / custom aspect), one-finger drag, pinch + slider + double-tap zoom, rotate
// (90° + free), flip, auto-center/fit/fill, live circular preview on a dark/light
// background, and quality-controlled output. Every capability can be turned off by
// the admin (config.photoEditor); this component just reads the flags it's given.

export interface PhotoEditorConfig {
  mode?: "full" | "cropOnly";
  maxRes?: number; minRes?: number; autoCompress?: boolean; quality?: number;
  forceSquare?: boolean; forceCircle?: boolean;
  allowRotate?: boolean; allowZoom?: boolean; allowDrag?: boolean; allowFlip?: boolean;
  autoCenter?: boolean;
}

const ASPECTS: { key: string; label: string; ratio: number | null }[] = [
  { key: "1:1", label: "Square", ratio: 1 },
  { key: "4:5", label: "4:5", ratio: 4 / 5 },
  { key: "16:9", label: "16:9", ratio: 16 / 9 },
  { key: "free", label: "Free", ratio: null },
];
const FRAME = 300; // logical crop box (longest side), px
const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n));

export function PhotoEditor({
  file, config, onSave, onCancel,
}: {
  file: File;
  config: PhotoEditorConfig;
  onSave: (dataUrl: string) => void;
  onCancel: () => void;
}) {
  const cfg = config;
  const cropOnly = cfg.mode === "cropOnly";
  const allowRotate = !cropOnly && cfg.allowRotate !== false;
  const allowZoom = cfg.allowZoom !== false;
  const allowDrag = cfg.allowDrag !== false;
  const allowFlip = !cropOnly && cfg.allowFlip !== false;

  const [img, setImg] = useState<HTMLImageElement | null>(null);
  const [loadErr, setLoadErr] = useState("");
  const [aspectKey, setAspectKey] = useState(cfg.forceSquare ? "1:1" : "1:1");
  const [circle, setCircle] = useState(cfg.forceCircle !== false);
  const [zoom, setZoom] = useState(1);
  const [rot, setRot] = useState(0);
  const [flipH, setFlipH] = useState(false);
  const [flipV, setFlipV] = useState(false);
  const [off, setOff] = useState({ x: 0, y: 0 });
  const [darkBg, setDarkBg] = useState(true);
  const [quality, setQuality] = useState<"original" | "high" | "medium">("high");
  const [saving, setSaving] = useState(false);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const previewRef = useRef<HTMLCanvasElement>(null);
  const pointers = useRef<Map<number, { x: number; y: number }>>(new Map());
  const pinchRef = useRef<{ dist: number; zoom: number } | null>(null);

  const ratio = ASPECTS.find((a) => a.key === aspectKey)?.ratio ?? null;
  const { frameW, frameH } = useMemo(() => {
    const r = cfg.forceSquare ? 1 : ratio ?? 1;
    return r >= 1 ? { frameW: FRAME, frameH: Math.round(FRAME / r) } : { frameW: Math.round(FRAME * r), frameH: FRAME };
  }, [ratio, cfg.forceSquare]);

  // Load the picked file into an <img>.
  useEffect(() => {
    let url = "";
    try { url = URL.createObjectURL(file); } catch { setLoadErr("Could not read this image."); return; }
    const i = new Image();
    i.onload = () => {
      const min = cfg.minRes ?? 0;
      if (min > 0 && (i.width < min || i.height < min)) { setLoadErr(`This image is too small — it must be at least ${min}×${min} pixels. Please choose a larger photo.`); return; }
      setImg(i);
    };
    i.onerror = () => setLoadErr("This image format can't be shown in the editor (HEIC/HEIF from some iPhones isn't supported by the browser — please choose a JPG or PNG).");
    i.src = url;
    return () => { try { URL.revokeObjectURL(url); } catch { /* ignore */ } };
  }, [file]);

  // "Cover" base scale so the frame is always filled.
  const baseScale = useMemo(() => (img ? Math.max(frameW / img.width, frameH / img.height) : 1), [img, frameW, frameH]);
  const effScale = baseScale * zoom;

  const center = useCallback(() => { setOff({ x: 0, y: 0 }); }, []);
  const reset = useCallback(() => { setZoom(1); setRot(0); setFlipH(false); setFlipV(false); setOff({ x: 0, y: 0 }); }, []);
  const fill = useCallback(() => { setZoom(1); setOff({ x: 0, y: 0 }); }, []);
  const fit = useCallback(() => { if (img) setZoom(Math.min(frameW / img.width, frameH / img.height) / baseScale); setOff({ x: 0, y: 0 }); }, [img, frameW, frameH, baseScale]);

  // Auto-center on load / aspect change.
  useEffect(() => { if (img && cfg.autoCenter !== false) { setOff({ x: 0, y: 0 }); setZoom(1); } }, [img, frameW, frameH, cfg.autoCenter]);

  // Draw the crop viewport (+ the live circular preview).
  useEffect(() => {
    const c = canvasRef.current; if (!c || !img) return;
    const dpr = Math.min(2, typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1);
    c.width = frameW * dpr; c.height = frameH * dpr;
    c.style.width = `${frameW}px`; c.style.height = `${frameH}px`;
    const ctx = c.getContext("2d"); if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, frameW, frameH);
    ctx.save();
    ctx.translate(frameW / 2 + off.x, frameH / 2 + off.y);
    ctx.rotate((rot * Math.PI) / 180);
    ctx.scale((flipH ? -1 : 1) * effScale, (flipV ? -1 : 1) * effScale);
    ctx.drawImage(img, -img.width / 2, -img.height / 2);
    ctx.restore();
    // Live circular preview (72px).
    const p = previewRef.current;
    if (p) {
      const S = 72; p.width = S; p.height = S;
      const pctx = p.getContext("2d");
      if (pctx) {
        pctx.clearRect(0, 0, S, S);
        pctx.save();
        if (circle) { pctx.beginPath(); pctx.arc(S / 2, S / 2, S / 2, 0, Math.PI * 2); pctx.clip(); }
        const k = S / Math.max(frameW, frameH);
        pctx.translate((S - frameW * k) / 2, (S - frameH * k) / 2);
        pctx.drawImage(c, 0, 0, frameW * k, frameH * k);
        pctx.restore();
      }
    }
  }, [img, off, rot, flipH, flipV, effScale, frameW, frameH, circle]);

  // ---- Gestures ----
  const onPointerDown = (e: React.PointerEvent) => {
    if (!allowDrag && !allowZoom) return;
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.current.size === 2 && allowZoom) {
      const [a, b] = [...pointers.current.values()];
      const dist = Math.hypot(a.x - b.x, a.y - b.y);
      if (dist > 0) pinchRef.current = { dist, zoom };
    }
  };
  const onPointerMove = (e: React.PointerEvent) => {
    const prev = pointers.current.get(e.pointerId); if (!prev) return;
    const cur = { x: e.clientX, y: e.clientY };
    if (pointers.current.size >= 2 && pinchRef.current && allowZoom) {
      pointers.current.set(e.pointerId, cur);
      const [a, b] = [...pointers.current.values()];
      const dist = Math.hypot(a.x - b.x, a.y - b.y);
      setZoom(clamp((pinchRef.current.zoom * dist) / pinchRef.current.dist, 0.2, 8));
    } else if (allowDrag) {
      setOff((o) => ({ x: o.x + (cur.x - prev.x), y: o.y + (cur.y - prev.y) }));
      pointers.current.set(e.pointerId, cur);
    }
  };
  const onPointerUp = (e: React.PointerEvent) => {
    pointers.current.delete(e.pointerId);
    if (pointers.current.size < 2) pinchRef.current = null;
  };
  const onWheel = (e: React.WheelEvent) => { if (allowZoom) setZoom((z) => clamp(z * (e.deltaY < 0 ? 1.08 : 0.93), 0.2, 8)); };
  const lastTap = useRef(0);
  const onDblClick = () => { if (allowZoom) setZoom((z) => (z > 1.6 ? 1 : 2)); };
  const onTouchTap = () => { const now = Date.now(); if (now - lastTap.current < 300) onDblClick(); lastTap.current = now; };

  // ---- Save: render the frame at output resolution + quality ----
  const doSave = async () => {
    if (!img) return;
    setSaving(true);
    try {
      const maxRes = clamp(cfg.maxRes ?? 512, 64, 4000);
      const outScale = maxRes / Math.max(frameW, frameH);
      const OW = Math.round(frameW * outScale), OH = Math.round(frameH * outScale);
      const oc = document.createElement("canvas"); oc.width = OW; oc.height = OH;
      const octx = oc.getContext("2d"); if (!octx) throw new Error("no ctx");
      octx.imageSmoothingQuality = "high";
      octx.save();
      octx.translate(OW / 2 + off.x * outScale, OH / 2 + off.y * outScale);
      octx.rotate((rot * Math.PI) / 180);
      octx.scale((flipH ? -1 : 1) * effScale * outScale, (flipV ? -1 : 1) * effScale * outScale);
      octx.drawImage(img, -img.width / 2, -img.height / 2);
      octx.restore();
      const compress = cfg.autoCompress !== false && quality !== "original";
      const q = quality === "medium" ? 0.6 : quality === "high" ? (cfg.quality ?? 82) / 100 : 0.95;
      const url = compress ? oc.toDataURL("image/jpeg", q) : oc.toDataURL("image/png");
      onSave(url);
    } catch { setSaving(false); }
  };

  const CtrlBtn = ({ onClick, title, children, active }: { onClick: () => void; title: string; children: React.ReactNode; active?: boolean }) => (
    <button type="button" onClick={onClick} title={title}
      className={cn("grid size-9 place-items-center rounded-lg border transition", active ? "border-lotus-400 bg-lotus-500/20 text-lotus-200" : "border-line bg-ink-800 text-mist-300 hover:text-mist-100")}>
      {children}
    </button>
  );

  return (
    <div className="fixed inset-0 z-[120] grid place-items-center bg-black/70 p-3" onClick={onCancel}>
      <div className="w-full max-w-md rounded-2xl border border-line bg-ink-900 p-4" onClick={(e) => e.stopPropagation()}>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="flex items-center gap-2 font-display text-base font-bold text-mist-100"><Crop className="size-4 text-lotus-300" /> Edit photo</h2>
          <button onClick={onCancel} className="text-mist-400 hover:text-mist-100"><X className="size-5" /></button>
        </div>

        {loadErr ? (
          <p className="rounded-lg bg-rose-500/10 px-3 py-4 text-center text-sm text-rose-200">{loadErr}</p>
        ) : !img ? (
          <div className="grid h-64 place-items-center text-mist-500"><Loader2 className="size-6 animate-spin" /></div>
        ) : (
          <>
            {/* Crop viewport */}
            <div className={cn("relative mx-auto select-none overflow-hidden rounded-xl", darkBg ? "bg-ink-950" : "bg-white")} style={{ width: frameW, height: frameH, touchAction: "none" }}
              onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp} onPointerCancel={onPointerUp} onWheel={onWheel} onDoubleClick={onDblClick} onTouchStart={onTouchTap}>
              <canvas ref={canvasRef} className="absolute left-0 top-0" />
              {/* Crop guide overlay (square grid or circle) */}
              <div className={cn("pointer-events-none absolute inset-0 border-2 border-white/70", circle && "rounded-full")} />
            </div>

            {/* Zoom slider */}
            {allowZoom && (
              <div className="mt-3 flex items-center gap-2">
                <ZoomOut className="size-4 text-mist-400" />
                <input type="range" min={0.2} max={8} step={0.01} value={zoom} onChange={(e) => setZoom(Number(e.target.value))} className="flex-1 accent-lotus-500" />
                <ZoomIn className="size-4 text-mist-400" />
              </div>
            )}
            {/* Free rotation slider */}
            {allowRotate && (
              <div className="mt-2 flex items-center gap-2">
                <RotateCcw className="size-4 text-mist-400" />
                <input type="range" min={-180} max={180} step={1} value={rot} onChange={(e) => setRot(Number(e.target.value))} className="flex-1 accent-lotus-500" />
                <span className="w-10 text-right text-[11px] tabular-nums text-mist-400">{rot}°</span>
              </div>
            )}

            {/* Tool buttons */}
            <div className="mt-3 flex flex-wrap items-center gap-1.5">
              {allowRotate && <CtrlBtn onClick={() => setRot((r) => r - 90)} title="Rotate left"><RotateCcw className="size-4" /></CtrlBtn>}
              {allowRotate && <CtrlBtn onClick={() => setRot((r) => r + 90)} title="Rotate right"><RotateCw className="size-4" /></CtrlBtn>}
              {allowFlip && <CtrlBtn onClick={() => setFlipH((f) => !f)} title="Flip horizontal" active={flipH}><FlipHorizontal className="size-4" /></CtrlBtn>}
              {allowFlip && <CtrlBtn onClick={() => setFlipV((f) => !f)} title="Flip vertical" active={flipV}><FlipVertical className="size-4" /></CtrlBtn>}
              <CtrlBtn onClick={fill} title="Fill frame"><Maximize className="size-4" /></CtrlBtn>
              <CtrlBtn onClick={fit} title="Fit to frame"><Minimize className="size-4" /></CtrlBtn>
              <CtrlBtn onClick={center} title="Center"><Crop className="size-4" /></CtrlBtn>
              {!cfg.forceCircle && <CtrlBtn onClick={() => setCircle((v) => !v)} title="Circle preview" active={circle}><CircleIcon className="size-4" /></CtrlBtn>}
              <CtrlBtn onClick={() => setDarkBg((v) => !v)} title="Preview background">{darkBg ? <Sun className="size-4" /> : <Moon className="size-4" />}</CtrlBtn>
            </div>

            {/* Aspect + preview + quality */}
            <div className="mt-3 flex items-center gap-3">
              {!cfg.forceSquare && !cropOnly && (
                <select value={aspectKey} onChange={(e) => setAspectKey(e.target.value)} className="h-8 rounded-lg border border-line bg-ink-800 px-2 text-xs text-mist-200 outline-none">
                  {ASPECTS.map((a) => <option key={a.key} value={a.key}>{a.label}</option>)}
                </select>
              )}
              <select value={quality} onChange={(e) => setQuality(e.target.value as typeof quality)} className="h-8 rounded-lg border border-line bg-ink-800 px-2 text-xs text-mist-200 outline-none" title="Output quality">
                <option value="original">Original quality</option>
                <option value="high">High</option>
                <option value="medium">Medium (smaller)</option>
              </select>
              <div className="ml-auto flex items-center gap-1.5">
                <span className="text-[10px] uppercase tracking-wide text-mist-500">Preview</span>
                <canvas ref={previewRef} className={cn("size-[52px] border border-white/15", circle ? "rounded-full" : "rounded-md")} style={{ width: 52, height: 52 }} />
              </div>
            </div>

            {/* Save / Cancel / Reset */}
            <div className="mt-4 flex gap-2">
              <button onClick={onCancel} className="flex-1 rounded-lg border border-line bg-ink-800 py-2 text-sm font-semibold text-mist-300 hover:text-mist-100">Cancel</button>
              <button onClick={reset} className="rounded-lg border border-line bg-ink-800 px-3 py-2 text-sm font-semibold text-mist-300 hover:text-mist-100" title="Reset edits"><RefreshCw className="size-4" /></button>
              <button onClick={doSave} disabled={saving} className="flex-[2] rounded-lg bg-lotus-600 py-2 text-sm font-bold text-white hover:bg-lotus-500 disabled:opacity-60">{saving ? "Saving…" : <span className="inline-flex items-center justify-center gap-1.5"><Check className="size-4" /> Use photo</span>}</button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
