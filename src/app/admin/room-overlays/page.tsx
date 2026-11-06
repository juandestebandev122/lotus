"use client";

import { useEffect, useRef, useState } from "react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import { cn } from "@/lib/cn";
import { useConfig, saveConfig } from "@/lib/config";
import { fileToDataUrl } from "@/lib/image";
import { withBase } from "@/lib/base-path";
import { Plus, Trash2, Check, Loader2, Image as ImageIcon, Move, Info } from "lucide-react";

type Vis = "all" | "hosts" | "vip";
type Zone = "free" | "aboveSeats" | "belowChat" | "roomList" | "gameTop";
interface Overlay { id: string; name: string; image: string; mediaType?: "image" | "video" | "audio" | "pdf" | "file"; fileName?: string; enabled: boolean; xPct: number; yPct: number; widthPct: number; opacity: number; visibility: Vis; scope: "all" | "specific"; roomIds?: string[]; link?: string; coverSeats?: boolean; zone?: Zone; closable?: boolean }
type RoomLite = { id: string; name: string; category: string };

const ZONE_LABEL: Record<Zone, string> = { free: "Free position (float anywhere)", aboveSeats: "Above the seats", belowChat: "Below the group chat", roomList: "Voice-room list screen", gameTop: "Game screen — top" };
const field = "rounded-lg border border-line bg-ink-900 px-3 py-2 text-sm text-mist-100 outline-none focus:border-lotus-400";
const newOverlay = (): Overlay => ({ id: `ov_${Math.random().toString(36).slice(2, 10)}`, name: "New overlay", image: "", enabled: true, xPct: 50, yPct: 30, widthPct: 30, opacity: 100, visibility: "all", scope: "all", roomIds: [], link: "", zone: "free", closable: false });

export default function AdminRoomOverlaysPage() {
  const { config, reload } = useConfig();
  const { toast } = useToast();
  const [list, setList] = useState<Overlay[]>([]);
  const [saving, setSaving] = useState(false);
  const [rooms, setRooms] = useState<RoomLite[]>([]);

  useEffect(() => { setList((config.roomOverlays ?? []).map((o) => ({ ...o }))); }, [config.roomOverlays]);
  useEffect(() => { fetch("/api/admin/rooms").then((r) => r.json()).then((d) => setRooms((d.rooms ?? []).map((r: RoomLite) => ({ id: r.id, name: r.name, category: r.category })))).catch(() => {}); }, []);

  const upd = (i: number, patch: Partial<Overlay>) => setList((l) => l.map((o, idx) => (idx === i ? { ...o, ...patch } : o)));
  const remove = (i: number) => setList((l) => l.filter((_, idx) => idx !== i));
  const add = () => setList((l) => [...l, newOverlay()]);

  const save = async () => {
    setSaving(true);
    const clean = list.filter((o) => o.image);
    const res = await saveConfig({ roomOverlays: clean });
    setSaving(false);
    if (res.ok) { await reload(); toast(`Saved — ${clean.length} overlay${clean.length === 1 ? "" : "s"} live now.`, "success"); }
    else toast(res.error ?? "Could not save", "error");
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-extrabold text-mist-100">Room overlays</h1>
          <p className="text-sm text-mist-400">Place a custom image, banner or logo anywhere on the voice-room screen. Drag to move, resize, turn on/off, and choose who sees it — all live, no app update.</p>
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="secondary" onClick={add}><Plus className="size-4" /> Add overlay</Button>
          <Button size="sm" onClick={save} disabled={saving}>{saving ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />} Save</Button>
        </div>
      </div>

      <div className="flex items-start gap-2 rounded-xl border border-sky-400/20 bg-sky-500/5 px-4 py-3 text-xs text-mist-400">
        <Info className="mt-0.5 size-4 shrink-0 text-sky-300" /> Positions are a percentage of the room screen, so an overlay sits in the same relative spot on every phone. Use a transparent PNG for logos/decorations.
      </div>

      {list.length === 0 ? (
        <Card className="p-8 text-center text-sm text-mist-500">No overlays yet — tap “Add overlay” to place an image on the room screen.</Card>
      ) : (
        <div className="space-y-4">
          {list.map((o, i) => <OverlayEditor key={o.id} o={o} rooms={rooms} onChange={(p) => upd(i, p)} onRemove={() => remove(i)} toast={toast} />)}
        </div>
      )}
      {list.length > 0 && <div className="pb-4"><Button onClick={save} disabled={saving} block>{saving ? "Saving…" : "Save all overlays"}</Button></div>}
    </div>
  );
}

function OverlayEditor({ o, rooms, onChange, onRemove, toast }: { o: Overlay; rooms: RoomLite[]; onChange: (p: Partial<Overlay>) => void; onRemove: () => void; toast: (m: string, t?: "success" | "error" | "info") => void }) {
  const boxRef = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);

  // An overlay can be a picture, a VIDEO, or any other file. Only small pictures are
  // inlined; everything else is uploaded and stored as a served URL, so a video never
  // bloats the config (and can stream with Range requests).
  const [uploadingFile, setUploadingFile] = useState(false);
  const onFile = async (file?: File) => {
    if (!file) return;
    const ext = (file.name.split(".").pop() || "").toLowerCase();
    const isImage = /^(png|jpe?g|webp|gif|svg|bmp)$/.test(ext);
    // A small picture keeps the instant inline preview it always had.
    if (isImage && file.size <= 1.5 * 1024 * 1024) {
      try { const url = await fileToDataUrl(file, 1000, 0.85); onChange({ image: url, mediaType: "image", fileName: file.name }); return; }
      catch { /* fall through to a real upload */ }
    }
    setUploadingFile(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const r = await fetch(withBase("/api/admin/upload-media"), { method: "POST", credentials: "include", body: fd });
      const d = await r.json().catch(() => ({}));
      if (r.ok && d.url) {
        onChange({ image: d.url as string, mediaType: (d.type as Overlay["mediaType"]) ?? "file", fileName: (d.fileName as string) ?? file.name });
        toast(`${String(d.type ?? "file")} uploaded ✓`, "success");
      } else toast((d as { error?: string }).error ?? "Upload failed", "error");
    } catch { toast("Upload failed — please try again", "error"); }
    setUploadingFile(false);
  };
  const setPos = (clientX: number, clientY: number) => {
    const box = boxRef.current?.getBoundingClientRect(); if (!box) return;
    onChange({ xPct: Math.max(0, Math.min(100, Math.round(((clientX - box.left) / box.width) * 100))), yPct: Math.max(0, Math.min(100, Math.round(((clientY - box.top) / box.height) * 100))) });
  };
  const roomToggle = (id: string) => { const cur = o.roomIds ?? []; onChange({ roomIds: cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id] }); };

  return (
    <Card className="p-4">
      <div className="flex flex-col gap-4 sm:flex-row">
        {/* Drag preview */}
        <div className="shrink-0">
          <div ref={boxRef} className="relative mx-auto h-64 w-36 overflow-hidden rounded-xl border border-line bg-gradient-to-b from-ink-800 to-ink-950"
            onPointerMove={(e) => { if (dragging.current) setPos(e.clientX, e.clientY); }}
            onPointerUp={() => { dragging.current = false; }} onPointerLeave={() => { dragging.current = false; }}>
            <div className="pointer-events-none absolute inset-x-0 top-2 text-center text-[9px] uppercase tracking-wide text-mist-600">room screen</div>
            {/* The preview drew EVERYTHING as an <img>, so an uploaded video
                showed as a blank box and looked like it hadn't worked. Each
                media kind is now previewed the way the room really renders it. */}
            {o.image ? (() => {
              const src = o.image.startsWith("data:") ? o.image : withBase(o.image);
              const grab = (e: React.PointerEvent) => { dragging.current = true; (e.target as HTMLElement).setPointerCapture?.(e.pointerId); setPos(e.clientX, e.clientY); };
              const pos = { left: `${o.xPct}%`, top: `${o.yPct}%`, width: `${o.widthPct}%`, opacity: o.opacity / 100 } as React.CSSProperties;
              const cls = "absolute -translate-x-1/2 -translate-y-1/2 cursor-move select-none";
              if (o.mediaType === "video") return <video src={src} autoPlay muted loop playsInline onPointerDown={grab} className={cls} style={pos} />;
              if (o.mediaType === "audio") return <span onPointerDown={grab} className={cn(cls, "rounded bg-black/60 px-1.5 py-1 text-[8px] font-bold text-white")} style={pos}>♪ AUDIO</span>;
              if (o.mediaType === "pdf" || o.mediaType === "file") return <span onPointerDown={grab} className={cn(cls, "truncate rounded bg-black/60 px-1.5 py-1 text-[8px] font-bold text-white")} style={pos}>{o.fileName || "FILE"}</span>;
              // eslint-disable-next-line @next/next/no-img-element
              return <img src={src} alt="" draggable={false} onPointerDown={grab} className={cls} style={pos} />;
            })() : (
              <div className="absolute inset-0 grid place-items-center text-mist-600"><ImageIcon className="size-8" /></div>
            )}
          </div>
          <p className="mt-1 text-center text-[10px] text-mist-500"><Move className="mr-0.5 inline size-3" /> drag it to move</p>
        </div>

        {/* Controls */}
        <div className="min-w-0 flex-1 space-y-2.5">
          <div className="flex items-center gap-2">
            <input value={o.name} onChange={(e) => onChange({ name: e.target.value })} placeholder="Overlay name" className={cn(field, "flex-1")} />
            <button onClick={() => onChange({ enabled: !o.enabled })} role="switch" aria-checked={o.enabled} className={cn("relative h-6 w-11 shrink-0 rounded-full transition", o.enabled ? "bg-emerald-500" : "bg-mist-600")} title={o.enabled ? "On" : "Off"}>
              <span className={cn("absolute top-0.5 size-5 rounded-full bg-white shadow transition-all", o.enabled ? "left-[22px]" : "left-0.5")} />
            </button>
            <button onClick={onRemove} className="grid size-9 shrink-0 place-items-center rounded-lg border border-rose-400/30 bg-rose-500/10 text-rose-300 hover:bg-rose-500/20"><Trash2 className="size-4" /></button>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-line bg-ink-800 px-3 py-1.5 text-xs font-semibold text-mist-200 hover:border-lotus-400/40">
              <ImageIcon className="size-3.5" /> {uploadingFile ? "Uploading…" : o.image ? "Replace file" : "Upload image / video / file"}
              {/* TRULY any file type. The old accept="…" list meant plenty of real
                  files (.mkv, .avi, .flv and anything unusual) could not even be
                  picked in the file dialog — the server does the safety check. */}
              <input type="file" className="hidden" onChange={(e) => onFile(e.target.files?.[0])} />
            </label>
            {o.image && (
              <>
                <span className="rounded-full bg-white/[0.06] px-2 py-0.5 text-[10px] font-semibold uppercase text-mist-400">{o.mediaType ?? "image"}</span>
                {o.fileName && <span className="max-w-[14rem] truncate text-[11px] text-mist-500" title={o.fileName}>{o.fileName}</span>}
                <a href={o.image.startsWith("data:") ? o.image : withBase(o.image)} target="_blank" rel="noopener noreferrer" className="text-xs text-sky-300 hover:underline">Open</a>
                <button onClick={() => onChange({ image: "", mediaType: "image", fileName: "" })} className="text-xs text-rose-300 hover:underline">Remove file</button>
              </>
            )}
          </div>
          <p className="mt-1 text-[11px] text-mist-500">
            Any file type — pictures, <b className="text-mist-400">videos</b>, audio, PDFs, documents and archives. Programs and app installers are refused.
            Videos play automatically, silently and on a loop. The size limit is set in <b className="text-mist-400">Admin → File Storage</b>.
          </p>

          {/* What was uploaded, shown exactly as the room will show it. */}
          {o.image && (o.mediaType === "video" || o.mediaType === "audio") && (
            <div className="mt-2 rounded-lg border border-line bg-ink-900 p-2">
              {o.mediaType === "video"
                ? <video src={o.image.startsWith("data:") ? o.image : withBase(o.image)} autoPlay muted loop playsInline className="mx-auto max-h-40 rounded-md" />
                : <audio src={o.image.startsWith("data:") ? o.image : withBase(o.image)} controls className="w-full" />}
            </div>
          )}

          {/* Placement — where this overlay is shown. "Free position" is the ORIGINAL
              behaviour (float anywhere). The other zones are fixed bands on a section. */}
          <label className="block"><span className="text-[11px] font-semibold text-mist-400">Placement (display section)</span>
            <select value={o.zone ?? "free"} onChange={(e) => onChange({ zone: e.target.value as Zone })} className={cn(field, "mt-1 w-full")}>
              {(Object.keys(ZONE_LABEL) as Zone[]).map((z) => <option key={z} value={z}>{ZONE_LABEL[z]}</option>)}
            </select>
          </label>

          {/* Users-can-close (X) — a separate dismiss control for this display section. */}
          <label className="flex items-start gap-2 rounded-lg border border-line bg-ink-900/50 p-2.5">
            <input type="checkbox" checked={o.closable === true} onChange={(e) => onChange({ closable: e.target.checked })} className="mt-0.5 size-4 accent-lotus-500" />
            <span className="text-xs text-mist-300"><b className="text-mist-100">Let users close it</b> — shows a small ✕ so a viewer can dismiss this overlay on their device (kept separate per section).</span>
          </label>

          {/* Cover-seats mode (free placement only): the image fills the ENTIRE seat area. */}
          {(o.zone ?? "free") === "free" && (
            <label className="flex items-start gap-2 rounded-lg border border-line bg-ink-900/50 p-2.5">
              <input type="checkbox" checked={o.coverSeats === true} onChange={(e) => onChange({ coverSeats: e.target.checked })} className="mt-0.5 size-4 accent-lotus-500" />
              <span className="text-xs text-mist-300"><b className="text-mist-100">Cover the whole seat area</b> — the image fills the entire seat section (behind the seats). Use Opacity below to control how strong it looks. When on, the size &amp; position sliders don&apos;t apply.</span>
            </label>
          )}

          <div className="grid gap-2 sm:grid-cols-2">
            {!o.coverSeats && (
              <label className="block text-xs text-mist-400">Size ({o.widthPct}%)
                <input type="range" min={5} max={100} value={o.widthPct} onChange={(e) => onChange({ widthPct: Number(e.target.value) })} className="mt-1 w-full accent-lotus-500" />
              </label>
            )}
            <label className="block text-xs text-mist-400">Opacity ({o.opacity}%)
              <input type="range" min={10} max={100} value={o.opacity} onChange={(e) => onChange({ opacity: Number(e.target.value) })} className="mt-1 w-full accent-lotus-500" />
            </label>
            {!o.coverSeats && (o.zone ?? "free") === "free" && (
              <label className="block text-xs text-mist-400">Horizontal ({o.xPct}%)
                <input type="range" min={0} max={100} value={o.xPct} onChange={(e) => onChange({ xPct: Number(e.target.value) })} className="mt-1 w-full accent-lotus-500" />
              </label>
            )}
            {!o.coverSeats && (o.zone ?? "free") === "free" && (
              <label className="block text-xs text-mist-400">Vertical ({o.yPct}%)
                <input type="range" min={0} max={100} value={o.yPct} onChange={(e) => onChange({ yPct: Number(e.target.value) })} className="mt-1 w-full accent-lotus-500" />
              </label>
            )}
          </div>

          <div className="grid gap-2 sm:grid-cols-2">
            <label className="block"><span className="text-[11px] font-semibold text-mist-400">Who sees it</span>
              <select value={o.visibility} onChange={(e) => onChange({ visibility: e.target.value as Vis })} className={cn(field, "mt-1 w-full")}>
                <option value="all">Everyone</option><option value="hosts">Hosts &amp; co-hosts only</option><option value="vip">VIP members (+ hosts)</option>
              </select>
            </label>
            <label className="block"><span className="text-[11px] font-semibold text-mist-400">Where</span>
              <select value={o.scope} onChange={(e) => onChange({ scope: e.target.value as "all" | "specific" })} className={cn(field, "mt-1 w-full")}>
                <option value="all">All rooms</option><option value="specific">Specific rooms</option>
              </select>
            </label>
          </div>

          {o.scope === "specific" && (
            <div className="rounded-lg border border-line bg-ink-900/50 p-2">
              <div className="mb-1 text-[11px] font-semibold text-mist-400">Rooms ({(o.roomIds ?? []).length} selected)</div>
              <div className="max-h-28 space-y-0.5 overflow-y-auto">
                {rooms.length === 0 ? <div className="text-xs text-mist-600">No rooms found.</div> : rooms.map((r) => (
                  <label key={r.id} className="flex items-center gap-2 rounded px-1 py-0.5 text-xs text-mist-200 hover:bg-white/[0.04]">
                    <input type="checkbox" checked={(o.roomIds ?? []).includes(r.id)} onChange={() => roomToggle(r.id)} className="accent-lotus-500" />
                    <span className="truncate">{r.name} <span className="text-mist-500">· {r.category}</span></span>
                  </label>
                ))}
              </div>
            </div>
          )}

          <input value={o.link ?? ""} onChange={(e) => onChange({ link: e.target.value })} placeholder="Optional tap link (https://…) — leave blank for a plain image" className={cn(field, "w-full")} />
        </div>
      </div>
    </Card>
  );
}
