"use client";

import { useEffect, useRef, useState } from "react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Field, Input, Textarea } from "@/components/ui/Input";
import { useToast } from "@/components/ui/Toast";
import {
  fetchBusinessMedia, postBusinessMedia, deleteBusinessMedia, watchBusinessMedia,
  type MediaCard, type MediaInput, type MediaKind,
} from "@/lib/business";
import { Film, Video, Play, Plus, Trash2, X, Loader2, Send, ImagePlus, Eye, ExternalLink } from "lucide-react";

// Copy of the shared "read an image file to a capped data URL" helper used by
// the Products section — keeps the two sections behaving identically.
function readImage(file: File, maxMB: number): Promise<string> {
  return new Promise((resolve, reject) => {
    if (file.size > maxMB * 1024 * 1024) return reject(new Error(`Image too large (max ${maxMB}MB).`));
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = () => reject(new Error("Could not read image."));
    r.readAsDataURL(file);
  });
}

// Per-kind labels/icons so Shorts + Videos render from ONE component and stay
// pixel-for-pixel consistent — only the wording and icon differ.
const KIND: Record<MediaKind, { icon: typeof Film; noun: string; add: string; empty: string; hint: string }> = {
  reel: { icon: Film, noun: "reel", add: "Add reel / short", empty: "No reels or shorts yet.", hint: "Add your first short video above." },
  video: { icon: Video, noun: "video", add: "Add video", empty: "No videos yet.", hint: "Add your first video above." },
};

function isDirectVideo(url: string): boolean {
  return /\.(mp4|webm|ogg|mov|m4v)(\?.*)?$/i.test(url);
}

export function BusinessMedia({ businessId, kind, canManage }: { businessId: string; kind: MediaKind; canManage: boolean }) {
  const { toast } = useToast();
  const meta = KIND[kind];
  const [items, setItems] = useState<MediaCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [playing, setPlaying] = useState<MediaCard | null>(null);

  const reload = () => fetchBusinessMedia(businessId, kind).then((d) => { setItems(d.media); setLoading(false); });
  useEffect(() => { setLoading(true); reload(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [businessId, kind]);

  const remove = async (m: MediaCard) => {
    if (!window.confirm(`Delete "${m.title}"?`)) return;
    const r = await deleteBusinessMedia(m.id);
    if (r.ok) { toast(`${meta.noun[0].toUpperCase()}${meta.noun.slice(1)} deleted`, "success"); reload(); }
    else toast(r.error ?? "Could not delete", "error");
  };

  const watch = (m: MediaCard) => {
    watchBusinessMedia(m.id); // count the view (fire-and-forget)
    setItems((list) => list.map((x) => (x.id === m.id ? { ...x, views: x.views + 1 } : x)));
    if (isDirectVideo(m.videoUrl)) setPlaying(m); // play inline
    else window.open(m.videoUrl, "_blank", "noopener,noreferrer"); // external link (YouTube, etc.)
  };

  return (
    <div className="space-y-4">
      {canManage && (
        adding ? (
          <MediaForm businessId={businessId} kind={kind} onDone={() => { setAdding(false); reload(); }} onCancel={() => setAdding(false)} />
        ) : (
          <Button size="sm" onClick={() => setAdding(true)}><Plus className="size-4" /> {meta.add}</Button>
        )
      )}

      {loading ? (
        <Card className="p-6 text-center text-sm text-mist-500">Loading {meta.noun}s…</Card>
      ) : items.length === 0 ? (
        <Card className="p-8 text-center">
          <meta.icon className="mx-auto size-9 text-mist-500" />
          <p className="mt-2 text-sm text-mist-300">{meta.empty}</p>
          {canManage && <p className="text-xs text-mist-500">{meta.hint}</p>}
        </Card>
      ) : (
        <div className="space-y-3">
          {items.map((m) => (
            <Card key={m.id} className="p-4">
              <div className="flex items-start gap-3">
                {/* Thumbnail with a play overlay */}
                <button
                  onClick={() => watch(m)}
                  className="group relative aspect-video w-28 shrink-0 overflow-hidden rounded-lg border border-line bg-ink-800 sm:w-36"
                  style={m.thumbUrl ? { backgroundImage: `url(${m.thumbUrl})`, backgroundSize: "cover", backgroundPosition: "center" } : undefined}
                  title="Play"
                >
                  {!m.thumbUrl && <span className="grid size-full place-items-center text-mist-600"><meta.icon className="size-6" /></span>}
                  <span className="absolute inset-0 grid place-items-center bg-black/25 transition group-hover:bg-black/40">
                    <span className="grid size-9 place-items-center rounded-full bg-white/90 text-ink-900 shadow"><Play className="size-4 translate-x-0.5 fill-current" /></span>
                  </span>
                </button>

                {/* Details */}
                <div className="min-w-0 flex-1">
                  <p className="line-clamp-2 font-bold text-mist-100">{m.title}</p>
                  <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-mist-300">
                    <span className="flex items-center gap-1 rounded-md bg-lotus-500/10 px-2 py-0.5 text-lotus-200"><meta.icon className="size-3" />{kind === "reel" ? "Short" : "Video"}</span>
                    <span className="flex items-center gap-1"><Eye className="size-3.5" />{m.views.toLocaleString("en-SA")} views</span>
                  </div>
                  {m.description && <p className="mt-1.5 line-clamp-2 whitespace-pre-wrap text-sm text-mist-400">{m.description}</p>}
                </div>
              </div>

              {/* Action bar — mirrors the Jobs card footer */}
              <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-line pt-3">
                <span className="mr-auto text-xs text-mist-500">{new Date(m.createdAt).toLocaleDateString("en-SA", { day: "2-digit", month: "short", year: "numeric" })}</span>
                <Button size="sm" onClick={() => watch(m)}>{isDirectVideo(m.videoUrl) ? <Play className="size-4" /> : <ExternalLink className="size-4" />} Watch</Button>
                {canManage && <Button size="sm" variant="ghost" className="!text-rose-300 hover:!bg-rose-500/10" onClick={() => remove(m)}><Trash2 className="size-4" /></Button>}
              </div>
            </Card>
          ))}
        </div>
      )}

      {playing && <PlayerModal media={playing} onClose={() => setPlaying(null)} />}
    </div>
  );
}

function MediaForm({ businessId, kind, onDone, onCancel }: { businessId: string; kind: MediaKind; onDone: () => void; onCancel: () => void }) {
  const { toast } = useToast();
  const meta = KIND[kind];
  const [f, setF] = useState<MediaInput>({ title: "", videoUrl: "", description: "" });
  const [preview, setPreview] = useState("");
  const [saving, setSaving] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const set = (k: keyof MediaInput, v: string) => setF((s) => ({ ...s, [k]: v }));

  const pick = async (file?: File) => {
    if (!file) return;
    try { const url = await readImage(file, 3); setPreview(url); setF((s) => ({ ...s, thumb: url })); }
    catch (e) { toast(e instanceof Error ? e.message : "Bad image", "error"); }
  };

  const submit = async () => {
    if (!f.title.trim()) { toast("A title is required.", "error"); return; }
    if (!/^https?:\/\/\S+$/i.test(f.videoUrl.trim())) { toast("Enter a valid video link (https://…).", "error"); return; }
    setSaving(true);
    const res = await postBusinessMedia(businessId, kind, f);
    setSaving(false);
    if (!res.ok) { toast(res.error ?? "Could not add", "error"); return; }
    toast(`${meta.noun[0].toUpperCase()}${meta.noun.slice(1)} added`, "success");
    onDone();
  };

  return (
    <Card className="space-y-3 p-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-bold text-mist-100">{meta.add}</h3>
        <button onClick={onCancel} className="text-mist-500 hover:text-mist-200"><X className="size-4" /></button>
      </div>
      <div className="flex gap-3">
        <button type="button" onClick={() => fileRef.current?.click()} className="grid aspect-video w-24 shrink-0 place-items-center overflow-hidden rounded-xl border border-dashed border-line bg-ink-800 text-mist-400 hover:border-lotus-400/60" style={preview ? { backgroundImage: `url(${preview})`, backgroundSize: "cover", backgroundPosition: "center" } : undefined} title="Thumbnail (optional)">
          {!preview && <ImagePlus className="size-5" />}
        </button>
        <input ref={fileRef} type="file" accept="image/*" hidden onChange={(e) => pick(e.target.files?.[0])} />
        <div className="flex-1 space-y-2">
          <Input value={f.title} onChange={(e) => set("title", e.target.value)} placeholder={`${meta.noun[0].toUpperCase()}${meta.noun.slice(1)} title`} maxLength={120} className="!h-10" />
          <Input value={f.videoUrl} onChange={(e) => set("videoUrl", e.target.value)} placeholder="Video link (YouTube, Instagram, or .mp4 URL)" maxLength={600} className="!h-10" />
        </div>
      </div>
      <Field label="Description (optional)"><Textarea value={f.description ?? ""} onChange={(e) => set("description", e.target.value)} placeholder="What's this about?" maxLength={800} className="min-h-16" /></Field>
      <p className="rounded-lg border border-sky-400/20 bg-sky-500/5 px-3 py-2 text-xs text-sky-200">Paste a link to your video. A thumbnail is optional — add one so it looks great in the list.</p>
      <div className="flex justify-end gap-2">
        <Button size="sm" variant="secondary" onClick={onCancel}>Cancel</Button>
        <Button size="sm" onClick={submit} disabled={saving}>{saving ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />} Add</Button>
      </div>
    </Card>
  );
}

function PlayerModal({ media, onClose }: { media: MediaCard; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-[60] grid place-items-center bg-black/80 p-4" onClick={onClose}>
      <div className="w-full max-w-2xl space-y-3" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h3 className="truncate pr-2 font-bold text-white">{media.title}</h3>
          <button onClick={onClose} className="text-white/70 hover:text-white"><X className="size-5" /></button>
        </div>
        {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
        <video src={media.videoUrl} controls autoPlay playsInline className="max-h-[70vh] w-full rounded-xl bg-black" />
      </div>
    </div>
  );
}
