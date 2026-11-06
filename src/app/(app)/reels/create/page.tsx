"use client";

import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  Upload, Square, Music2, Smile, Image as ImageIcon, Globe2, Lock, Users,
  X, Loader2, Camera, ArrowLeft, Check, Link2,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { useToast } from "@/components/ui/Toast";
import { useConfig } from "@/lib/config";
import { fetchMediaLibrary, uploadRoomMedia, type MediaItem } from "@/lib/media-library";
import { fetchBusinesses, type BusinessCard } from "@/lib/business";
import { uploadReelVideo, createReel, updateReel, fetchReel, type ReelPrivacy } from "@/lib/reels";
import { parseVideoLink, videoLinkLabel } from "@/lib/video-link";
import { usePhotoEdit } from "@/components/usePhotoEdit";
import { cn } from "@/lib/cn";

const STICKERS = ["😂", "❤️", "🔥", "😍", "👏", "🎉", "😮", "😎", "🥳", "💯", "🙌", "✨", "😭", "🤣", "👍", "🌟", "💃", "🕺", "🎶", "😱", "🤩", "💖", "🥰", "🎬"];
const PRIVACY: { key: ReelPrivacy; label: string; icon: typeof Globe2 }[] = [
  { key: "public", label: "Public", icon: Globe2 },
  { key: "friends", label: "Friends", icon: Users },
  { key: "private", label: "Private", icon: Lock },
];

function Composer() {
  const router = useRouter();
  const { toast } = useToast();
  const { config } = useConfig();
  const params = useSearchParams();
  const editId = params.get("edit");
  const isEdit = !!editId;

  const [kind, setKind] = useState<"reel" | "video">(params.get("kind") === "video" ? "video" : "reel");
  const [videoFile, setVideoFile] = useState("");        // stored filename on server
  const [videoLink, setVideoLink] = useState("");        // external link (YouTube / URL)
  const [previewUrl, setPreviewUrl] = useState("");      // object URL or /api/media url
  const [uploading, setUploading] = useState(false);
  const [caption, setCaption] = useState("");
  const [tags, setTags] = useState("");
  const [music, setMusic] = useState<{ id: string; name: string; src: string } | null>(null);
  const [stickers, setStickers] = useState<string[]>([]);
  const [thumb, setThumb] = useState<string>("");
  const [privacy, setPrivacy] = useState<ReelPrivacy>("public");
  const [disableComments, setDisableComments] = useState(false);
  const [disableSharing, setDisableSharing] = useState(false);
  const [bizId, setBizId] = useState("");
  const [productDetail, setProductDetail] = useState("");
  const [contact, setContact] = useState("");
  const [website, setWebsite] = useState("");
  const [busy, setBusy] = useState(false);

  const [musicOpen, setMusicOpen] = useState(false);
  const [tracks, setTracks] = useState<MediaItem[]>([]);
  const [myBiz, setMyBiz] = useState<BusinessCard[]>([]);
  const [recording, setRecording] = useState(false);
  const [recSecs, setRecSecs] = useState(0);
  const [uploadingMusic, setUploadingMusic] = useState(false);
  const musicFileRef = useRef<HTMLInputElement | null>(null);
  const coverFileRef = useRef<HTMLInputElement | null>(null);

  const previewVideoRef = useRef<HTMLVideoElement | null>(null);
  const liveVideoRef = useRef<HTMLVideoElement | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const recTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Load music tracks + my businesses; prefill in edit mode.
  useEffect(() => {
    fetchMediaLibrary().then(({ items }) => setTracks(items.filter((i) => i.kind === "audio")));
    fetchBusinesses().then((s) => setMyBiz(s.mine.filter((b) => b.status === "verified")));
    const bp = params.get("business"); if (bp) setBizId(bp);
    if (editId) {
      fetchReel(editId).then((r) => {
        if (!r) { toast("Reel not found", "error"); return; }
        if (r.embedUrl) setVideoLink(r.embedUrl); else setPreviewUrl(r.videoUrl);
        setVideoFile("edit"); // marker: metadata edit, video unchanged
        setCaption(r.caption); setTags((r.hashtags ?? []).map((h) => `#${h}`).join(" "));
        if (r.musicSrc) setMusic({ id: r.musicName ?? "", name: r.musicName ?? "Music", src: r.musicSrc });
        setStickers(r.stickers ?? []); setThumb(""); setPrivacy(r.privacy);
        setDisableComments(r.disableComments); setDisableSharing(r.disableSharing);
        setBizId(r.businessId ?? ""); setProductDetail(r.productDetail ?? "");
        setContact(r.contact ?? ""); setWebsite(r.website ?? "");
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editId]);

  // Grab a cover frame from the preview once it can render.
  const captureCover = useCallback(() => {
    const v = previewVideoRef.current;
    if (!v || !v.videoWidth) return;
    const w = 360, h = Math.round((v.videoHeight / v.videoWidth) * 360) || 640;
    const c = document.createElement("canvas");
    c.width = w; c.height = h;
    const ctx = c.getContext("2d");
    if (!ctx) return;
    try { ctx.drawImage(v, 0, 0, w, h); setThumb(c.toDataURL("image/jpeg", 0.72)); } catch { /* CORS-tainted */ }
  }, []);

  // Select your OWN music file from the device (in addition to the admin library).
  const pickMusicFile = async (file: File | undefined) => {
    if (!file) return;
    if (!file.type.startsWith("audio/")) { toast("Please choose an audio file.", "error"); return; }
    setUploadingMusic(true);
    const res = await uploadRoomMedia(file, "audio");
    setUploadingMusic(false);
    if (res.ok && res.url) { setMusic({ id: `upload_${Date.now()}`, name: res.name || file.name.replace(/\.[^.]+$/, ""), src: res.url }); setMusicOpen(false); toast("Music added", "success"); }
    else toast(res.error ?? "Upload failed", "error");
  };

  // Select your OWN cover image from the device (via the shared advanced editor).
  const { pick: reelCoverEdit, editor: reelCoverEditor } = usePhotoEdit({ aspect: "cover" });
  const pickCoverImage = (file: File | undefined) => reelCoverEdit(file, (url) => { setThumb(url); toast("Cover image set", "success"); });

  const handleFile = async (file: File | undefined) => {
    if (!file) return;
    if (!file.type.startsWith("video/")) { toast("Please choose a video file.", "error"); return; }
    setUploading(true);
    setPreviewUrl(URL.createObjectURL(file));
    const res = await uploadReelVideo(file);
    setUploading(false);
    if (res.ok && res.file) { setVideoFile(res.file); toast("Video uploaded — add the details below.", "success"); }
    else toast(res.error ?? "Upload failed", "error");
  };

  // Add a video by pasting a link — YouTube, TikTok, Instagram, Facebook, X,
  // Vimeo, Dailymotion, or a direct .mp4 URL. No upload needed (great on mobile).
  const applyLink = (raw: string) => {
    const p = parseVideoLink(raw);
    if (!p.ok) { toast("Please paste a valid video link (https://…).", "error"); return; }
    setVideoLink(raw.trim());
    toast("Video link added — add the details below.", "success");
  };

  // ---- Recording ----
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user" }, audio: true });
      streamRef.current = stream;
      if (liveVideoRef.current) { liveVideoRef.current.srcObject = stream; liveVideoRef.current.play().catch(() => {}); }
      const mime = MediaRecorder.isTypeSupported("video/webm;codecs=vp9") ? "video/webm;codecs=vp9" : "video/webm";
      const rec = new MediaRecorder(stream, { mimeType: mime });
      const chunks: BlobPart[] = [];
      rec.ondataavailable = (e) => { if (e.data.size) chunks.push(e.data); };
      rec.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        if (recTimerRef.current) clearInterval(recTimerRef.current);
        const blob = new Blob(chunks, { type: "video/webm" });
        const file = new File([blob], `recording_${Date.now()}.webm`, { type: "video/webm" });
        setRecording(false); setRecSecs(0);
        await handleFile(file);
      };
      recorderRef.current = rec;
      rec.start();
      setRecording(true); setRecSecs(0);
      recTimerRef.current = setInterval(() => setRecSecs((s) => {
        if (s >= 89) { stopRecording(); return 90; }
        return s + 1;
      }), 1000);
    } catch {
      toast("Couldn't access the camera. Please allow camera & microphone access.", "error");
    }
  };
  const stopRecording = () => { try { recorderRef.current?.stop(); } catch { /* ignore */ } };
  useEffect(() => () => { streamRef.current?.getTracks().forEach((t) => t.stop()); if (recTimerRef.current) clearInterval(recTimerRef.current); }, []);

  const toggleSticker = (s: string) => setStickers((prev) => prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s].slice(0, 12));

  const submit = async (status: "published" | "draft") => {
    if (!videoFile && !videoLink) { toast("Please upload, record, or paste a video link first.", "error"); return; }
    setBusy(true);
    const hashtags = tags.split(/[\s,]+/).map((t) => t.replace(/^#+/, "").trim()).filter(Boolean);
    const common = {
      kind,
      caption, hashtags,
      musicId: music?.id, musicName: music?.name, musicSrc: music?.src,
      stickers, privacy, disableComments, disableSharing, status,
      businessId: bizId || undefined, productDetail: bizId ? productDetail : undefined,
      contact: bizId ? contact : undefined, website: bizId ? website : undefined,
      ...(thumb ? { thumb } : {}),
    };
    let res;
    if (isEdit && editId) res = await updateReel(editId, common);
    else res = await createReel({ videoFile, videoUrl: videoLink || undefined, ...common });
    setBusy(false);
    if (res.ok) {
      toast(isEdit ? "Reel updated" : status === "draft" ? "Saved to drafts" : "Reel posted! 🎬", "success");
      router.push("/reels");
    } else toast(res.error ?? "Could not save the reel", "error");
  };

  if (config.features?.reels === false) {
    return <div className="mx-auto max-w-md py-16 text-center text-mist-300">Reels are currently turned off by the admin.</div>;
  }

  const linkParsed = videoLink ? parseVideoLink(videoLink) : null;
  const previewEmbed = linkParsed?.embedUrl;
  const previewVideoSrc = linkParsed?.directUrl || previewUrl;
  const hasVideo = !!videoFile || !!previewUrl || !!videoLink;
  const clearVideo = () => { setVideoFile(""); setPreviewUrl(""); setVideoLink(""); setThumb(""); };

  return (
    <div className="mx-auto w-full max-w-lg pb-10">
      {reelCoverEditor}
      <div className="mb-4 flex items-center gap-3">
        <Link href="/reels" className="grid size-9 place-items-center rounded-full bg-ink-800 text-mist-200 hover:bg-ink-700"><ArrowLeft className="size-4" /></Link>
        <h1 className="text-xl font-extrabold text-mist-100">{isEdit ? `Edit ${kind}` : `Create a ${kind}`}</h1>
      </div>

      {/* Reel (short) vs Video (longer) */}
      {!isEdit && (
        <div className="mb-4 grid grid-cols-2 gap-2 rounded-full bg-ink-800/70 p-1">
          {(["reel", "video"] as const).map((k) => (
            <button key={k} onClick={() => setKind(k)} className={cn("rounded-full py-2 text-sm font-semibold capitalize transition", kind === k ? "bg-gradient-to-r from-lotus-500 to-petal-500 text-white shadow" : "text-mist-300 hover:text-mist-100")}>
              {k === "reel" ? "🎬 Reel (short)" : "📹 Video"}
            </button>
          ))}
        </div>
      )}

      {/* Source / preview */}
      <Card className="p-4">
        {!hasVideo ? (
          <>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-mist-500">Add your video — choose any option</p>
            {/* Option 1 & 2: upload from device / record with the camera */}
            <div className="grid grid-cols-2 gap-3">
              <label className="flex cursor-pointer flex-col items-center gap-2 rounded-xl border border-dashed border-line bg-white/[0.02] py-6 text-center hover:border-lotus-400/60">
                <Upload className="size-6 text-lotus-300" />
                <span className="text-sm font-semibold text-mist-100">Upload video</span>
                <span className="text-[10px] text-mist-400">file from device</span>
                <input type="file" accept="video/*" className="hidden" onChange={(e) => handleFile(e.target.files?.[0])} />
              </label>
              <button onClick={startRecording} className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-line bg-white/[0.02] py-6 text-center hover:border-petal-400/60">
                <Camera className="size-6 text-petal-300" />
                <span className="text-sm font-semibold text-mist-100">Record now</span>
                <span className="text-[10px] text-mist-400">use the camera</span>
              </button>
            </div>

            <div className="my-3 flex items-center gap-3 text-[11px] font-semibold uppercase text-mist-600"><span className="h-px flex-1 bg-white/8" /> or <span className="h-px flex-1 bg-white/8" /></div>

            {/* Option 3: add by link — ALWAYS visible so it can't be missed */}
            <div className="rounded-xl border border-sky-400/40 bg-sky-500/[0.06] p-3">
              <p className="mb-1.5 flex items-center gap-1.5 text-sm font-semibold text-sky-200"><Link2 className="size-4" /> Add a video by link</p>
              <div className="flex gap-2">
                <input
                  value={videoLink}
                  onChange={(e) => setVideoLink(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") applyLink(videoLink); }}
                  placeholder="Paste a YouTube, TikTok, Instagram, Facebook, X, Vimeo or Dailymotion link…"
                  className="h-10 w-full rounded-lg border border-line bg-ink-850 px-2.5 text-sm text-mist-100 outline-none focus:border-sky-400"
                />
                <Button size="sm" onClick={() => applyLink(videoLink)} disabled={!videoLink.trim()}><Check className="size-4" /> Add</Button>
              </div>
              <p className="mt-1.5 text-[11px] text-mist-500">Works with <b className="text-mist-300">YouTube, TikTok, Instagram Reels, Facebook, X (Twitter), Vimeo, Dailymotion</b> or a direct video link — no upload needed (best for mobile).</p>
            </div>
          </>
        ) : previewEmbed ? (
          <div className="relative">
            <div className="relative aspect-video overflow-hidden rounded-xl bg-black">
              <iframe src={previewEmbed} title="preview" className="absolute inset-0 size-full" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowFullScreen />
            </div>
            {!isEdit && <button onClick={clearVideo} className="absolute right-2 top-2 grid size-8 place-items-center rounded-full bg-black/60 text-white"><X className="size-4" /></button>}
            <p className="mt-2 flex items-center gap-1.5 text-xs text-sky-200"><Link2 className="size-3.5" /> {videoLinkLabel(videoLink) || "Playing from link"} — <span className="truncate text-mist-400">{videoLink}</span></p>
          </div>
        ) : (
          <div className="relative overflow-hidden rounded-xl bg-black">
            <video
              ref={previewVideoRef}
              src={previewVideoSrc}
              className="mx-auto max-h-[420px] w-full object-contain"
              controls muted playsInline crossOrigin="anonymous"
              onLoadedData={captureCover}
            />
            {uploading && (
              <div className="absolute inset-0 grid place-items-center bg-black/60 text-white"><Loader2 className="mr-2 size-5 animate-spin" /> Uploading…</div>
            )}
            {!isEdit && (
              <button onClick={clearVideo} className="absolute right-2 top-2 grid size-8 place-items-center rounded-full bg-black/50 text-white"><X className="size-4" /></button>
            )}
          </div>
        )}

        {/* Recording overlay */}
        {recording && (
          <div className="fixed inset-0 z-[140] grid place-items-center bg-black/90 p-4">
            <div className="w-full max-w-sm">
              <video ref={liveVideoRef} className="mb-4 aspect-[9/16] w-full rounded-2xl bg-black object-cover" muted playsInline autoPlay />
              <div className="mb-3 text-center text-sm font-semibold text-white">● Recording {recSecs}s <span className="text-white/50">/ 90s max</span></div>
              <button onClick={stopRecording} className="mx-auto flex items-center gap-2 rounded-full bg-rose-600 px-6 py-3 font-bold text-white"><Square className="size-4 fill-white" /> Stop & use</button>
            </div>
          </div>
        )}
      </Card>

      {hasVideo && (
        <div className="mt-4 space-y-4">
          {/* Caption + hashtags */}
          <Card className="space-y-3 p-4">
            <div>
              <label className="mb-1 block text-xs font-semibold text-mist-300">Caption</label>
              <textarea value={caption} onChange={(e) => setCaption(e.target.value)} rows={2} maxLength={600} placeholder="Say something about your reel…" className="w-full resize-none rounded-lg border border-line bg-ink-800 p-2.5 text-sm text-mist-100 outline-none focus:border-lotus-400" />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-mist-300">Hashtags</label>
              <input value={tags} onChange={(e) => setTags(e.target.value)} placeholder="#fun #dance #lotus" className="w-full rounded-lg border border-line bg-ink-800 p-2.5 text-sm text-mist-100 outline-none focus:border-lotus-400" />
            </div>
          </Card>

          {/* Music + stickers + cover */}
          <Card className="space-y-3 p-4">
            <button onClick={() => setMusicOpen(true)} className="flex w-full items-center justify-between rounded-lg border border-line bg-ink-800 p-2.5 text-left hover:border-lotus-400/60">
              <span className="flex items-center gap-2 text-sm text-mist-100"><Music2 className="size-4 text-lotus-300" /> {music ? music.name : "Add music"}</span>
              {music && <span onClick={(e) => { e.stopPropagation(); setMusic(null); }} className="text-xs text-mist-400 hover:text-rose-300">Remove</span>}
            </button>

            <div>
              <p className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold text-mist-300"><Smile className="size-3.5" /> Stickers & emojis</p>
              <div className="flex flex-wrap gap-1.5">
                {STICKERS.map((s) => (
                  <button key={s} onClick={() => toggleSticker(s)} className={cn("grid size-9 place-items-center rounded-lg text-xl transition", stickers.includes(s) ? "bg-lotus-500/30 ring-2 ring-lotus-400" : "bg-white/[0.04] hover:bg-white/10")}>{s}</button>
                ))}
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-line bg-ink-800 p-2.5">
              <span className="flex items-center gap-2 text-sm text-mist-100"><ImageIcon className="size-4 text-lotus-300" /> Cover thumbnail</span>
              <div className="flex items-center gap-2">
                {thumb && <img src={thumb} alt="cover" className="h-10 w-7 rounded object-cover" />}
                <input ref={coverFileRef} type="file" accept="image/*" className="hidden" onChange={(e) => { pickCoverImage(e.target.files?.[0]); e.target.value = ""; }} />
                <Button size="sm" variant="secondary" onClick={() => coverFileRef.current?.click()}><Upload className="size-3.5" /> Select image</Button>
                <Button size="sm" variant="secondary" onClick={captureCover}>Use current frame</Button>
              </div>
            </div>
          </Card>

          {/* Privacy + toggles */}
          <Card className="space-y-3 p-4">
            <div>
              <p className="mb-1.5 text-xs font-semibold text-mist-300">Who can see this</p>
              <div className="grid grid-cols-3 gap-2">
                {PRIVACY.map((p) => (
                  <button key={p.key} onClick={() => setPrivacy(p.key)} className={cn("flex flex-col items-center gap-1 rounded-lg border py-2.5 text-xs font-semibold transition", privacy === p.key ? "border-lotus-400 bg-lotus-500/15 text-mist-100" : "border-line text-mist-300 hover:bg-white/5")}>
                    <p.icon className="size-4" /> {p.label}
                  </button>
                ))}
              </div>
            </div>
            <ToggleRow label="Turn off comments" checked={disableComments} onChange={setDisableComments} />
            <ToggleRow label="Turn off sharing" checked={disableSharing} onChange={setDisableSharing} />
          </Card>

          {/* Business promo (optional) */}
          {myBiz.length > 0 && (
            <Card className="space-y-3 p-4">
              <p className="text-xs font-semibold text-mist-300">Promote a business (optional)</p>
              <select value={bizId} onChange={(e) => setBizId(e.target.value)} className="w-full rounded-lg border border-line bg-ink-800 p-2.5 text-sm text-mist-100 outline-none focus:border-lotus-400">
                <option value="">Personal reel (no business)</option>
                {myBiz.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
              </select>
              {bizId && (
                <div className="space-y-2">
                  <input value={productDetail} onChange={(e) => setProductDetail(e.target.value)} placeholder="Product / offer details" className="w-full rounded-lg border border-line bg-ink-800 p-2.5 text-sm text-mist-100 outline-none focus:border-lotus-400" />
                  <input value={contact} onChange={(e) => setContact(e.target.value)} placeholder="Contact number (Call button)" className="w-full rounded-lg border border-line bg-ink-800 p-2.5 text-sm text-mist-100 outline-none focus:border-lotus-400" />
                  <input value={website} onChange={(e) => setWebsite(e.target.value)} placeholder="Website link" className="w-full rounded-lg border border-line bg-ink-800 p-2.5 text-sm text-mist-100 outline-none focus:border-lotus-400" />
                </div>
              )}
            </Card>
          )}

          {/* Actions */}
          <div className="flex gap-2">
            <Button variant="secondary" block disabled={busy || uploading} onClick={() => submit("draft")}>Save draft</Button>
            <Button block disabled={busy || uploading} onClick={() => submit("published")}>
              {busy ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />} {isEdit ? "Publish" : `Post ${kind}`}
            </Button>
          </div>
        </div>
      )}

      {/* Music picker */}
      {musicOpen && (
        <div className="fixed inset-0 z-[130] flex items-end justify-center bg-black/60" onClick={() => setMusicOpen(false)}>
          <div className="max-h-[70dvh] w-full max-w-lg overflow-hidden rounded-t-2xl border border-line bg-ink-900" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between border-b border-line px-4 py-3">
              <h3 className="text-sm font-bold text-mist-100">Choose music</h3>
              <button onClick={() => setMusicOpen(false)} className="grid size-8 place-items-center rounded-full text-mist-400 hover:bg-white/5"><X className="size-4" /></button>
            </div>
            <div className="max-h-[55dvh] space-y-1 overflow-y-auto p-3">
              {/* Select your own audio file from the device */}
              <input ref={musicFileRef} type="file" accept="audio/*" className="hidden" onChange={(e) => { pickMusicFile(e.target.files?.[0]); e.target.value = ""; }} />
              <button
                onClick={() => musicFileRef.current?.click()}
                disabled={uploadingMusic}
                className="mb-2 flex w-full items-center justify-center gap-1.5 rounded-lg border border-dashed border-lotus-400/50 bg-lotus-500/[0.06] py-2.5 text-sm font-semibold text-lotus-200 transition hover:bg-lotus-500/15 disabled:opacity-60"
              >
                {uploadingMusic ? <><Loader2 className="size-4 animate-spin" /> Uploading…</> : <><Upload className="size-4" /> Select an audio file</>}
              </button>
              <p className="mb-2 text-center text-[10px] text-mist-500">Upload your own track, or choose from the library below</p>
              {tracks.length === 0 && <p className="py-4 text-center text-sm text-mist-400">No library music yet — use “Select an audio file” above.</p>}
              {tracks.map((t) => (
                <button key={t.id} onClick={() => { setMusic({ id: t.id, name: t.name, src: t.src }); setMusicOpen(false); }} className="flex w-full items-center gap-3 rounded-lg p-2.5 text-left hover:bg-white/5">
                  <span className="grid size-9 place-items-center rounded-lg bg-lotus-500/20 text-lotus-300"><Music2 className="size-4" /></span>
                  <span className="min-w-0 flex-1 truncate text-sm text-mist-100">{t.name}</span>
                  {music?.id === t.id && <Check className="size-4 text-emerald-400" />}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function ToggleRow({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button onClick={() => onChange(!checked)} className="flex w-full items-center justify-between">
      <span className="text-sm text-mist-200">{label}</span>
      <span className={cn("relative h-6 w-11 rounded-full transition", checked ? "bg-lotus-500" : "bg-ink-700")}>
        <span className={cn("absolute top-0.5 size-5 rounded-full bg-white transition-all", checked ? "left-[22px]" : "left-0.5")} />
      </span>
    </button>
  );
}

export default function CreateReelPage() {
  return (
    <Suspense fallback={<div className="grid min-h-[50vh] place-items-center text-mist-400"><span className="animate-pulse text-sm">Loading…</span></div>}>
      <Composer />
    </Suspense>
  );
}
