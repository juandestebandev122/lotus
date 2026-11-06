"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import { cn } from "@/lib/cn";
import { fetchAdminMedia, uploadMediaFile, addMediaLink, editMediaItem, deleteMediaItem, type MediaItem } from "@/lib/media-library";
import { readFileMeta } from "@/lib/media-meta";
import { useConfig, saveConfig } from "@/lib/config";
import { Music, Video, Film, Image as ImageIcon, Upload, Link2, Trash2, Pencil, Check, X, FolderOpen, Search, SlidersHorizontal, Coins } from "lucide-react";

const KIND_META: Record<MediaItem["kind"], { label: string; icon: typeof Music; tone: string }> = {
  audio: { label: "Music / Audio", icon: Music, tone: "text-lotus-300" },
  video: { label: "Video", icon: Video, tone: "text-fuchsia-300" },
  youtube: { label: "YouTube", icon: Film, tone: "text-rose-300" },
  image: { label: "Image", icon: ImageIcon, tone: "text-emerald-300" },
};

export default function AdminMediaPage() {
  const { toast } = useToast();
  const [items, setItems] = useState<MediaItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<"all" | MediaItem["kind"]>("all");

  // Upload / add state
  const fileRef = useRef<HTMLInputElement>(null);
  const [upName, setUpName] = useState("");
  const [upCat, setUpCat] = useState("");
  const [uploading, setUploading] = useState(false);
  const [linkUrl, setLinkUrl] = useState("");
  const [linkName, setLinkName] = useState("");
  const [linkKind, setLinkKind] = useState<"audio" | "video">("audio");
  const [editing, setEditing] = useState<string>("");
  const [editName, setEditName] = useState("");
  const [editCat, setEditCat] = useState("");

  const load = useCallback(async () => { setItems(await fetchAdminMedia()); setLoading(false); }, []);
  useEffect(() => { load(); }, [load]);

  const onPickFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    if (files.length === 0) return;
    setUploading(true);
    let ok = 0; const fails: string[] = [];
    // Upload every selected file. For a single file the Title applies; for a batch,
    // each keeps its own filename (a shared title across many files makes no sense).
    for (const file of files) {
      const title = files.length === 1 ? upName.trim() : "";
      // Read duration + a video thumbnail in the browser so the picker can show them
      // (size comes from the file on the server). Best-effort — never blocks the upload.
      const isVid = file.type.startsWith("video") || /\.(mp4|mkv|mov|avi|webm)$/i.test(file.name);
      const isAud = file.type.startsWith("audio") || /\.(mp3|wav|aac|m4a|ogg)$/i.test(file.name);
      let meta: { durationSec?: number; sizeBytes?: number; thumb?: string } | undefined;
      if (isVid || isAud) { try { meta = await readFileMeta(file, isVid ? "video" : "audio"); } catch { /* ignore */ } }
      const res = await uploadMediaFile(file, title, upCat.trim(), meta);
      if (res.ok) ok++; else fails.push(`${file.name}: ${res.error ?? "failed"}`);
    }
    setUploading(false);
    if (fileRef.current) fileRef.current.value = "";
    load();
    if (ok > 0) { setUpName(""); setUpCat(""); toast(`${ok} file${ok === 1 ? "" : "s"} uploaded to the library${fails.length ? ` · ${fails.length} failed` : ""}`, fails.length ? "info" : "success"); }
    if (fails.length && ok === 0) toast(fails[0], "error");
  };

  const addLink = async () => {
    if (!linkUrl.trim()) return toast("Paste a link first", "error");
    const res = await addMediaLink(linkKind, linkName.trim(), linkUrl.trim());
    if (res.ok) { setLinkUrl(""); setLinkName(""); toast("Added to the library", "success"); load(); }
    else toast(res.error ?? "Could not add", "error");
  };

  const saveEdit = async (id: string) => {
    const okRes = await editMediaItem(id, editName.trim(), editCat.trim());
    if (okRes) { setEditing(""); toast("Saved", "success"); load(); }
    else toast("Could not save", "error");
  };

  const remove = async (it: MediaItem) => {
    if (!confirm(`Delete "${it.name}" from the library?`)) return;
    const okRes = await deleteMediaItem(it.id);
    if (okRes) { toast("Deleted", "success"); load(); }
    else toast("Could not delete", "error");
  };

  const q = query.trim().toLowerCase();
  const shown = useMemo(
    () => items.filter((it) => (filter === "all" || it.kind === filter) && (!q || it.name.toLowerCase().includes(q) || (it.category ?? "").toLowerCase().includes(q))),
    [items, filter, q],
  );
  const counts = useMemo(() => ({ all: items.length, audio: items.filter((i) => i.kind === "audio").length, video: items.filter((i) => i.kind === "video").length, youtube: items.filter((i) => i.kind === "youtube").length }), [items]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-extrabold text-mist-100">Media Library</h1>
        <p className="text-sm text-mist-400">Upload and manage the audio, video &amp; images that hosts can play in their rooms. Only admins can add or remove media; hosts &amp; co-hosts can only select and play from here.</p>
      </div>

      {/* Media system controls: enable/disable + free/paid pricing per type */}
      <MediaControls />

      {/* Upload a file */}
      <Card className="space-y-3 p-5">
        <h2 className="flex items-center gap-2 font-semibold text-mist-100"><Upload className="size-4 text-lotus-300" /> Upload music or video</h2>
        <div className="flex flex-wrap items-end gap-3">
          <label className="text-sm">
            <span className="mb-1 block font-semibold text-mist-300">Title (optional)</span>
            <input value={upName} onChange={(e) => setUpName(e.target.value)} placeholder="e.g. Chill Beats" className="h-9 w-52 rounded-lg border border-line bg-ink-800 px-3 text-sm text-mist-100 outline-none focus:border-lotus-400" />
          </label>
          <label className="text-sm">
            <span className="mb-1 block font-semibold text-mist-300">Category (optional)</span>
            <input value={upCat} onChange={(e) => setUpCat(e.target.value)} placeholder="e.g. Lofi" className="h-9 w-40 rounded-lg border border-line bg-ink-800 px-3 text-sm text-mist-100 outline-none focus:border-lotus-400" />
          </label>
          <input ref={fileRef} type="file" accept="audio/*,video/*,image/*" multiple onChange={onPickFile} className="hidden" />
          <Button onClick={() => fileRef.current?.click()} disabled={uploading}><FolderOpen className="size-4" /> {uploading ? "Uploading…" : "Select files"}</Button>
        </div>
        <p className="text-xs text-mist-500">Audio (MP3/WAV/AAC/M4A/OGG), video (MP4/MKV/MOV/AVI/WEBM) or image (JPG/PNG/GIF/WEBP), up to 1 GB. Turn each type on/off &amp; set pricing in <strong className="text-mist-300">Media system controls</strong> above.</p>
      </Card>

      {/* Add a YouTube / link */}
      <Card className="space-y-3 p-5">
        <h2 className="flex items-center gap-2 font-semibold text-mist-100"><Link2 className="size-4 text-rose-300" /> Add a YouTube or direct link</h2>
        <div className="flex flex-wrap items-end gap-3">
          <label className="text-sm">
            <span className="mb-1 block font-semibold text-mist-300">Title</span>
            <input value={linkName} onChange={(e) => setLinkName(e.target.value)} placeholder="Track / video name" className="h-9 w-52 rounded-lg border border-line bg-ink-800 px-3 text-sm text-mist-100 outline-none focus:border-lotus-400" />
          </label>
          <label className="text-sm flex-1 min-w-56">
            <span className="mb-1 block font-semibold text-mist-300">Link (YouTube or a direct .mp3/.mp4 URL)</span>
            <input value={linkUrl} onChange={(e) => setLinkUrl(e.target.value)} placeholder="https://youtube.com/…  or  https://…/song.mp3" className="h-9 w-full rounded-lg border border-line bg-ink-800 px-3 text-sm text-mist-100 outline-none focus:border-lotus-400" />
          </label>
          <select value={linkKind} onChange={(e) => setLinkKind(e.target.value as "audio" | "video")} className="h-9 rounded-lg border border-line bg-ink-800 px-2 text-sm text-mist-100" title="Type for direct links (ignored for YouTube)">
            <option value="audio">Audio link</option>
            <option value="video">Video link</option>
          </select>
          <Button variant="secondary" onClick={addLink}><Link2 className="size-4" /> Add link</Button>
        </div>
      </Card>

      {/* Filters + search */}
      <div className="flex flex-wrap items-center gap-2">
        {(["all", "audio", "video", "youtube"] as const).map((k) => (
          <button key={k} onClick={() => setFilter(k)} className={cn("rounded-full px-3.5 py-1.5 text-sm font-semibold capitalize transition", filter === k ? "bg-lotus-600 text-white" : "border border-line bg-ink-800 text-mist-400 hover:text-mist-100")}>
            {k === "all" ? "All" : k === "audio" ? "Music/Audio" : k} ({counts[k]})
          </button>
        ))}
        <div className="ml-auto flex items-center gap-1.5 rounded-lg border border-line bg-ink-800 px-2.5">
          <Search className="size-4 text-mist-500" />
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search…" className="h-9 w-44 bg-transparent text-sm text-mist-100 outline-none placeholder:text-mist-500" />
        </div>
      </div>

      {/* Library list */}
      <Card className="overflow-hidden p-0">
        {loading ? (
          <p className="py-10 text-center text-sm text-mist-400">Loading…</p>
        ) : shown.length === 0 ? (
          <p className="py-12 text-center text-sm text-mist-500">No media yet. Upload a file or add a link above.</p>
        ) : (
          <div className="divide-y divide-white/5">
            {shown.map((it) => {
              const M = KIND_META[it.kind];
              const isEditing = editing === it.id;
              return (
                <div key={it.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
                  <span className={cn("grid size-10 shrink-0 place-items-center rounded-lg bg-ink-800", M.tone)}><M.icon className="size-5" /></span>
                  {isEditing ? (
                    <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
                      <input value={editName} onChange={(e) => setEditName(e.target.value)} className="h-9 min-w-40 flex-1 rounded-lg border border-line bg-ink-900 px-2.5 text-sm text-mist-100 outline-none focus:border-lotus-400" />
                      <input value={editCat} onChange={(e) => setEditCat(e.target.value)} placeholder="Category" className="h-9 w-32 rounded-lg border border-line bg-ink-900 px-2.5 text-sm text-mist-100 outline-none focus:border-lotus-400" />
                      <button onClick={() => saveEdit(it.id)} className="grid size-9 place-items-center rounded-lg bg-emerald-500/15 text-emerald-300 hover:bg-emerald-500/25"><Check className="size-4" /></button>
                      <button onClick={() => setEditing("")} className="grid size-9 place-items-center rounded-lg bg-ink-800 text-mist-400 hover:text-mist-200"><X className="size-4" /></button>
                    </div>
                  ) : (
                    <>
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm font-semibold text-mist-100">{it.name}</div>
                        <div className="flex flex-wrap items-center gap-1.5 text-xs text-mist-500">
                          <span className="rounded-full bg-white/[0.06] px-1.5 py-0.5 text-[10px] font-semibold text-mist-300">{M.label}</span>
                          {it.category && <span className="rounded-full bg-white/[0.06] px-1.5 py-0.5 text-[10px] text-mist-400">{it.category}</span>}
                          <span>{new Date(it.addedAt).toLocaleDateString("en-SA", { day: "numeric", month: "short" })}</span>
                        </div>
                      </div>
                      <button onClick={() => { setEditing(it.id); setEditName(it.name); setEditCat(it.category ?? ""); }} title="Edit" className="grid size-9 place-items-center rounded-lg text-mist-500 hover:bg-white/[0.06] hover:text-mist-200"><Pencil className="size-4" /></button>
                      <button onClick={() => remove(it)} title="Delete" className="grid size-9 place-items-center rounded-lg text-mist-500 hover:bg-rose-500/10 hover:text-rose-300"><Trash2 className="size-4" /></button>
                    </>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </Card>
    </div>
  );
}

// ===== Admin: enable/disable each media type + set free/paid pricing =====
type MediaCfg = {
  libraryAccess: boolean;
  audioEnabled: boolean; videoEnabled: boolean; imageEnabled: boolean;
  audioPaid: boolean; audioPrice: number;
  videoPaid: boolean; videoPrice: number;
  imagePaid: boolean; imagePrice: number;
};
const DEFAULT_MEDIA_CFG: MediaCfg = {
  libraryAccess: true, audioEnabled: true, videoEnabled: true, imageEnabled: true,
  audioPaid: false, audioPrice: 0, videoPaid: false, videoPrice: 0, imagePaid: false, imagePrice: 0,
};

function MediaControls() {
  const { config, loading, reload } = useConfig();
  const { toast } = useToast();
  const [m, setM] = useState<MediaCfg>(DEFAULT_MEDIA_CFG);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (loading) return;
    const c = config.media ?? {};
    setM({
      libraryAccess: c.libraryAccess !== false,
      audioEnabled: c.audioEnabled !== false, videoEnabled: c.videoEnabled !== false, imageEnabled: c.imageEnabled !== false,
      audioPaid: !!c.audioPaid, audioPrice: c.audioPrice ?? 0,
      videoPaid: !!c.videoPaid, videoPrice: c.videoPrice ?? 0,
      imagePaid: !!c.imagePaid, imagePrice: c.imagePrice ?? 0,
    });
  }, [loading, config.media]);

  const save = async () => {
    setSaving(true);
    const res = await saveConfig({ media: m });
    setSaving(false);
    if (res.ok) { await reload(); toast("Media controls saved — live now", "success"); }
    else toast(res.error ?? "Could not save", "error");
  };

  const TYPES: { key: string; label: string; icon: typeof Music; enabledKey: keyof MediaCfg; paidKey: keyof MediaCfg; priceKey: keyof MediaCfg }[] = [
    { key: "audio", label: "Audio", icon: Music, enabledKey: "audioEnabled", paidKey: "audioPaid", priceKey: "audioPrice" },
    { key: "video", label: "Video", icon: Video, enabledKey: "videoEnabled", paidKey: "videoPaid", priceKey: "videoPrice" },
    { key: "image", label: "Image", icon: ImageIcon, enabledKey: "imageEnabled", paidKey: "imagePaid", priceKey: "imagePrice" },
  ];

  return (
    <Card className="space-y-4 p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 font-semibold text-mist-100"><SlidersHorizontal className="size-4 text-lotus-300" /> Media system controls</h2>
        <Button size="sm" onClick={save} disabled={saving}>{saving ? "Saving…" : "Save controls"}</Button>
      </div>

      {/* Master: media library access */}
      <label className="flex items-center justify-between gap-3 rounded-xl border border-line bg-ink-800 px-4 py-3">
        <span>
          <span className="block text-sm font-semibold text-mist-100">Media Library Access</span>
          <span className="block text-xs text-mist-500">Master switch — when OFF, the Media panel is hidden in every room.</span>
        </span>
        <Toggle on={m.libraryAccess} onChange={(v) => setM((s) => ({ ...s, libraryAccess: v }))} />
      </label>

      {/* Per-type: enable + free/paid + price */}
      <div className="space-y-2.5">
        {TYPES.map(({ key, label, icon: Icon, enabledKey, paidKey, priceKey }) => {
          const enabled = m[enabledKey] as boolean;
          const paid = m[paidKey] as boolean;
          const price = m[priceKey] as number;
          return (
            <div key={key} className={cn("rounded-xl border px-4 py-3 transition", enabled ? "border-line bg-ink-800" : "border-line bg-ink-800/40 opacity-70")}>
              <div className="flex items-center justify-between gap-3">
                <span className="flex items-center gap-2 text-sm font-semibold text-mist-100"><Icon className="size-4 text-lotus-300" /> {label} upload</span>
                <Toggle on={enabled} onChange={(v) => setM((s) => ({ ...s, [enabledKey]: v }))} />
              </div>
              {enabled && (
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <div className="inline-flex overflow-hidden rounded-lg border border-line">
                    <button onClick={() => setM((s) => ({ ...s, [paidKey]: false }))} className={cn("px-3 py-1.5 text-xs font-semibold transition", !paid ? "bg-emerald-600 text-white" : "bg-ink-900 text-mist-400 hover:text-mist-100")}>Free for all</button>
                    <button onClick={() => setM((s) => ({ ...s, [paidKey]: true }))} className={cn("px-3 py-1.5 text-xs font-semibold transition", paid ? "bg-lotus-600 text-white" : "bg-ink-900 text-mist-400 hover:text-mist-100")}>Paid with coins</button>
                  </div>
                  {paid && (
                    <label className="inline-flex items-center gap-1.5 rounded-lg border border-line bg-ink-900 px-2.5">
                      <Coins className="size-3.5 text-gold-300" />
                      <input
                        type="number" min={0} value={price}
                        onChange={(e) => setM((s) => ({ ...s, [priceKey]: Math.max(0, Number(e.target.value) || 0) }))}
                        className="h-8 w-24 bg-transparent text-sm text-mist-100 outline-none"
                        placeholder="Coins"
                      />
                      <span className="pr-1 text-xs text-mist-500">coins</span>
                    </label>
                  )}
                  <span className="text-[11px] text-mist-500">{paid ? `Users pay ${price || 0} coins once to unlock ${label.toLowerCase()}.` : `${label} is free for everyone.`}</span>
                </div>
              )}
            </div>
          );
        })}
      </div>
      <p className="text-[11px] text-mist-500">Turning a type OFF hides its uploads &amp; its tab in rooms. Paid types stay unlocked for a user once they buy them; every purchase is recorded in their wallet history.</p>
    </Card>
  );
}

function Toggle({ on, onChange }: { on: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      onClick={() => onChange(!on)}
      className={cn("relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors", on ? "bg-emerald-500" : "bg-ink-700")}
    >
      <span className={cn("inline-block size-5 transform rounded-full bg-white shadow transition-transform", on ? "translate-x-5" : "translate-x-0.5")} />
    </button>
  );
}
