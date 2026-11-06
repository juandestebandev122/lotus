"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  Heart, MessageCircle, Bookmark, Share2, MoreVertical, Volume2, VolumeX,
  Play, Music2, UserPlus, UserCheck, Flag, Trash2, Pencil, X, Send, Eye, Store, Globe, Phone,
} from "lucide-react";
import { Avatar } from "@/components/ui/Avatar";
import { cn } from "@/lib/cn";
import { withBase } from "@/lib/base-path";
import { useToast } from "@/components/ui/Toast";
import { useVoice } from "@/lib/VoiceProvider";
import {
  type Reel, type ReelTab, type ReelComment,
  fetchReels, likeReel, saveReel, shareReel, viewReel, commentReel, reportWatch,
  reportReelContent, deleteReel, toggleFollowUser,
} from "@/lib/reels";
import { profileHrefOf } from "@/lib/profile-href";

function timeAgo(iso: string): string {
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return "just now";
  const m = Math.floor(s / 60); if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60); if (h < 24) return `${h}h`;
  const d = Math.floor(h / 24); if (d < 7) return `${d}d`;
  return new Date(iso).toLocaleDateString();
}
function compact(n: number): string {
  if (n < 1000) return String(n);
  if (n < 1_000_000) return `${(n / 1000).toFixed(n < 10_000 ? 1 : 0)}k`.replace(".0", "");
  return `${(n / 1_000_000).toFixed(1)}M`.replace(".0", "");
}

const TABS: { key: ReelTab; label: string }[] = [
  { key: "suggested", label: "For You" },
  { key: "trending", label: "Trending" },
  { key: "latest", label: "Latest" },
  { key: "following", label: "Following" },
  { key: "saved", label: "Saved" },
];

const REPORT_REASONS = ["Inappropriate content", "Spam or misleading", "Harassment", "Violence", "Nudity", "Other"];

export function ReelFeed({
  tab: fixedTab,
  showTabs = false,
  reels: externalReels,
  emptyHint = "No reels here yet.",
  kind,
  scope,
}: {
  tab?: ReelTab;
  showTabs?: boolean;
  reels?: Reel[]; // when provided, renders a fixed list (e.g. a profile grid opened full-screen) — no fetching
  emptyHint?: string;
  kind?: "reel" | "video";
  scope?: "user" | "business";
}) {
  const { toast } = useToast();
  const [tab, setTab] = useState<ReelTab>(fixedTab ?? "suggested");
  const [reels, setReels] = useState<Reel[]>(externalReels ?? []);
  const [loading, setLoading] = useState(!externalReels);
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(!externalReels);
  const [muted, setMuted] = useState(true);
  const [activeId, setActiveId] = useState<string>("");
  const [commentsFor, setCommentsFor] = useState<Reel | null>(null);
  const [reportFor, setReportFor] = useState<Reel | null>(null);
  const scrollerRef = useRef<HTMLDivElement | null>(null);
  const viewedRef = useRef<Set<string>>(new Set());
  const loadingRef = useRef(false);

  const external = !!externalReels;

  const load = useCallback(async (t: ReelTab, reset: boolean) => {
    if (external || loadingRef.current) return;
    loadingRef.current = true;
    setLoading(reset);
    const off = reset ? 0 : offset;
    const page = await fetchReels(t, { offset: off, limit: 5, kind, scope });
    setReels((prev) => (reset ? page.reels : [...prev, ...page.reels.filter((r) => !prev.some((p) => p.id === r.id))]));
    setOffset(page.nextOffset);
    setHasMore(page.hasMore);
    setLoading(false);
    loadingRef.current = false;
  }, [offset, external, kind, scope]);

  // (Re)load when the tab (or kind/scope filter) changes.
  useEffect(() => {
    if (external) return;
    viewedRef.current = new Set();
    setReels([]); setOffset(0); setHasMore(true);
    load(tab, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, external, kind, scope]);

  // Keep the external list in sync if the parent changes it.
  useEffect(() => { if (external && externalReels) setReels(externalReels); }, [external, externalReels]);

  const patchReel = useCallback((id: string, patch: Partial<Reel>) => {
    setReels((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)));
    setCommentsFor((c) => (c && c.id === id ? { ...c, ...patch } : c));
  }, []);

  // Count a view once per reel when it becomes the active one.
  useEffect(() => {
    if (!activeId || viewedRef.current.has(activeId)) return;
    viewedRef.current.add(activeId);
    viewReel(activeId).then((r) => patchReel(activeId, { views: r.views || 0 }));
  }, [activeId, patchReel]);

  const onLike = async (r: Reel) => {
    patchReel(r.id, { liked: !r.liked, likeCount: r.likeCount + (r.liked ? -1 : 1) });
    const res = await likeReel(r.id);
    patchReel(r.id, { liked: res.liked, likeCount: res.likeCount });
  };
  const onSave = async (r: Reel) => {
    patchReel(r.id, { saved: !r.saved, saveCount: r.saveCount + (r.saved ? -1 : 1) });
    const res = await saveReel(r.id);
    patchReel(r.id, { saved: res.saved, saveCount: res.saveCount });
    toast(res.saved ? "Saved to your collection" : "Removed from saved", "info");
  };
  const onShare = async (r: Reel) => {
    if (r.disableSharing) { toast("Sharing is turned off for this reel.", "info"); return; }
    const url = `${window.location.origin}${withBase(`/reels?r=${r.id}`)}`;
    try {
      if (navigator.share) await navigator.share({ title: `${r.ownerName} on Lotus Reels`, url });
      else { await navigator.clipboard.writeText(url); toast("Link copied to clipboard", "success"); }
    } catch { /* user cancelled */ }
    const res = await shareReel(r.id);
    patchReel(r.id, { shares: res.shares });
  };
  const onFollow = async (r: Reel) => {
    if (r.isOwner) return;
    patchReel(r.id, { following: !r.following });
    const res = await toggleFollowUser(r.ownerId);
    setReels((prev) => prev.map((x) => (x.ownerId === r.ownerId ? { ...x, following: res.following } : x)));
    toast(res.following ? `Following ${r.ownerName}` : `Unfollowed ${r.ownerName}`, "info");
  };
  const onDelete = async (r: Reel) => {
    if (!confirm("Delete this reel permanently?")) return;
    const res = await deleteReel(r.id);
    if (res.ok) { setReels((prev) => prev.filter((x) => x.id !== r.id)); toast("Reel deleted", "success"); }
    else toast(res.error ?? "Could not delete", "error");
  };

  return (
    <div className="mx-auto w-full max-w-[440px]">
      {showTabs && (
        <div className="mb-3 flex gap-1 overflow-x-auto rounded-full bg-ink-800/70 p-1">
          {TABS.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={cn(
                "flex-1 whitespace-nowrap rounded-full px-3 py-1.5 text-xs font-semibold transition",
                tab === t.key ? "bg-gradient-to-r from-lotus-500 to-petal-500 text-white shadow" : "text-mist-300 hover:text-mist-100",
              )}
            >
              {t.label}
            </button>
          ))}
        </div>
      )}

      <div
        ref={scrollerRef}
        className="hide-scrollbar relative h-[calc(100dvh-11rem)] max-h-[780px] snap-y snap-mandatory overflow-y-auto overscroll-contain rounded-2xl bg-black"
      >
        {reels.map((r) => (
          <ReelItem
            key={r.id}
            reel={r}
            muted={muted}
            onToggleMute={() => setMuted((m) => !m)}
            onActive={() => setActiveId(r.id)}
            onLike={() => onLike(r)}
            onSave={() => onSave(r)}
            onShare={() => onShare(r)}
            onFollow={() => onFollow(r)}
            onComments={() => setCommentsFor(r)}
            onReport={() => setReportFor(r)}
            onDelete={() => onDelete(r)}
          />
        ))}

        {/* Infinite-scroll sentinel */}
        {!external && hasMore && (
          <Sentinel onHit={() => !loading && load(tab, false)} />
        )}

        {loading && (
          <div className="grid h-full place-items-center text-mist-400">
            <div className="animate-pulse text-sm">Loading reels…</div>
          </div>
        )}
        {!loading && reels.length === 0 && (
          <div className="grid h-full place-items-center px-6 text-center">
            <div>
              <div className="mx-auto mb-3 grid size-14 place-items-center rounded-2xl bg-white/[0.06]"><Play className="size-7 text-mist-300" /></div>
              <p className="text-sm text-mist-300">{emptyHint}</p>
            </div>
          </div>
        )}
      </div>

      {commentsFor && (
        <CommentsSheet
          reel={commentsFor}
          onClose={() => setCommentsFor(null)}
          onAdded={(c) => patchReel(commentsFor.id, { comments: [...commentsFor.comments, c], commentCount: commentsFor.commentCount + 1 })}
        />
      )}
      {reportFor && (
        <ReportModal
          reel={reportFor}
          onClose={() => setReportFor(null)}
          onDone={() => { setReportFor(null); toast("Thanks — our team will review this reel.", "success"); }}
        />
      )}
    </div>
  );
}

function Sentinel({ onHit }: { onHit: () => void }) {
  const ref = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    const el = ref.current; if (!el) return;
    const io = new IntersectionObserver((es) => { if (es[0]?.isIntersecting) onHit(); }, { rootMargin: "600px" });
    io.observe(el);
    return () => io.disconnect();
  }, [onHit]);
  return <div ref={ref} className="h-2 w-full" />;
}

function ReelItem({
  reel, muted, onToggleMute, onActive, onLike, onSave, onShare, onFollow, onComments, onReport, onDelete,
}: {
  reel: Reel; muted: boolean; onToggleMute: () => void; onActive: () => void;
  onLike: () => void; onSave: () => void; onShare: () => void; onFollow: () => void;
  onComments: () => void; onReport: () => void; onDelete: () => void;
}) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const musicRef = useRef<HTMLAudioElement | null>(null);
  const sectionRef = useRef<HTMLElement | null>(null);
  const [paused, setPaused] = useState(false);
  // If the user is in a LIVE voice room, reels must NOT grab the audio session —
  // starting reel audio (esp. the music track) interrupts the WebRTC voice audio
  // on mobile and drops the call. So while in voice we force reels MUTED and never
  // play the music element. The user keeps hearing the voice room; their voice
  // stays connected while they browse reels.
  const inVoice = !!useVoice().roomId;
  const forceMuted = muted || inVoice;
  const [menu, setMenu] = useState(false);
  // Watch-time: accumulate wall-clock seconds this reel is the active one, and
  // report it (for the Videos leaderboard) when it scrolls away / unmounts.
  const watchStartRef = useRef<number>(0);
  const flushWatch = useCallback(() => {
    if (watchStartRef.current) {
      const secs = (Date.now() - watchStartRef.current) / 1000;
      watchStartRef.current = 0;
      reportWatch(reel.id, secs);
    }
  }, [reel.id]);

  // Autoplay the reel while it's the one in view; pause the rest.
  useEffect(() => {
    const el = sectionRef.current; const v = videoRef.current; if (!el || !v) return;
    const io = new IntersectionObserver(
      (es) => {
        const e = es[0];
        if (e.isIntersecting && e.intersectionRatio >= 0.6) {
          onActive();
          watchStartRef.current = Date.now();
          v.play().then(() => setPaused(false)).catch(() => { /* autoplay blocked until tap */ });
          const mu = musicRef.current; if (mu && !inVoice) mu.play().catch(() => {});
        } else {
          v.pause();
          musicRef.current?.pause();
          flushWatch();
        }
      },
      { threshold: [0, 0.6, 1] },
    );
    io.observe(el);
    return () => { io.disconnect(); flushWatch(); musicRef.current?.pause(); };
  }, [onActive, flushWatch, inVoice]);

  // Keep the music paused the moment the user enters a voice room, and mirror the
  // effective mute onto the media elements.
  useEffect(() => {
    if (videoRef.current) videoRef.current.muted = forceMuted;
    if (musicRef.current) { musicRef.current.muted = forceMuted; if (inVoice) musicRef.current.pause(); }
  }, [forceMuted, inVoice]);

  const togglePlay = () => {
    const v = videoRef.current; if (!v) return;
    const mu = musicRef.current;
    if (v.paused) { v.play().catch(() => {}); if (!inVoice) mu?.play().catch(() => {}); setPaused(false); } else { v.pause(); mu?.pause(); setPaused(true); }
  };

  const hashtags = reel.hashtags ?? [];

  return (
    <section ref={sectionRef} className="relative h-full w-full snap-start snap-always">
      {/* Video — an uploaded/direct file plays in <video>; a YouTube/Vimeo link
          plays in an embedded iframe. */}
      {reel.embedUrl ? (
        <iframe
          src={`${reel.embedUrl}${reel.embedUrl.includes("?") ? "&" : "?"}rel=0&playsinline=1`}
          title={reel.caption || "video"}
          className="absolute inset-0 size-full bg-black"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
        />
      ) : (
        <video
          ref={videoRef}
          src={withBase(reel.videoUrl)}
          poster={reel.thumbUrl ? withBase(reel.thumbUrl) : undefined}
          className="absolute inset-0 size-full bg-black object-contain"
          loop
          muted={forceMuted}
          playsInline
          preload="metadata"
          onClick={togglePlay}
        />
      )}

      {/* Background music track chosen by the creator — plays in sync with the reel. */}
      {reel.musicSrc && (
        // eslint-disable-next-line jsx-a11y/media-has-caption
        <audio ref={musicRef} src={withBase(reel.musicSrc)} loop muted={forceMuted} preload="none" />
      )}

      {/* Sticker/emoji overlays */}
      {(reel.stickers ?? []).length > 0 && (
        <div className="pointer-events-none absolute left-3 top-16 flex flex-wrap gap-2 pr-24 text-3xl drop-shadow-lg">
          {reel.stickers.map((s, i) => <span key={i}>{s}</span>)}
        </div>
      )}

      {/* Paused indicator (uploaded videos only — iframes manage their own controls) */}
      {paused && !reel.embedUrl && (
        <button onClick={togglePlay} className="absolute inset-0 grid place-items-center" aria-label="Play">
          <span className="grid size-16 place-items-center rounded-full bg-black/45 backdrop-blur"><Play className="size-8 text-white" /></span>
        </button>
      )}

      {/* Mute toggle */}
      <button
        onClick={onToggleMute}
        className="absolute right-3 top-3 z-20 grid size-9 place-items-center rounded-full bg-black/40 text-white backdrop-blur"
        aria-label={muted ? "Unmute" : "Mute"}
      >
        {muted ? <VolumeX className="size-4" /> : <Volume2 className="size-4" />}
      </button>

      {/* Bottom gradient + info */}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/85 via-black/40 to-transparent px-3 pb-4 pt-16">
        <div className="pointer-events-auto flex items-center gap-2">
          <Link href={profileHrefOf(reel.ownerUsername, undefined, reel.ownerId)}><Avatar name={reel.ownerName} src={reel.ownerAvatar ? withBase(reel.ownerAvatar) : undefined} size="sm" /></Link>
          <Link href={profileHrefOf(reel.ownerUsername, undefined, reel.ownerId)} className="min-w-0">
            <p className="truncate text-sm font-bold text-white">@{reel.ownerUsername}</p>
          </Link>
          {!reel.isOwner && (
            <button
              onClick={onFollow}
              className={cn("ml-1 rounded-full px-3 py-1 text-xs font-bold transition", reel.following ? "bg-white/15 text-white" : "bg-white text-ink-900")}
            >
              {reel.following ? <span className="flex items-center gap-1"><UserCheck className="size-3" /> Following</span> : <span className="flex items-center gap-1"><UserPlus className="size-3" /> Follow</span>}
            </button>
          )}
          {reel.businessName && (
            <span className="ml-auto flex items-center gap-1 rounded-full bg-lotus-500/30 px-2 py-0.5 text-[10px] font-semibold text-lotus-100"><Store className="size-3" /> {reel.businessName}</span>
          )}
        </div>

        {reel.caption && <p className="pointer-events-auto mt-2 line-clamp-3 text-sm text-white/95">{reel.caption}</p>}
        {hashtags.length > 0 && (
          <p className="pointer-events-auto mt-1 flex flex-wrap gap-x-2 text-xs font-semibold text-sky-300">
            {hashtags.map((h) => <span key={h}>#{h}</span>)}
          </p>
        )}

        {/* Business promo: product / contact / website */}
        {(reel.productDetail || reel.website || reel.contact) && (
          <div className="pointer-events-auto mt-2 space-y-1 rounded-xl bg-white/10 p-2 backdrop-blur">
            {reel.productDetail && <p className="text-xs text-white/90">🛍️ {reel.productDetail}</p>}
            <div className="flex flex-wrap gap-2">
              {reel.contact && <a href={`tel:${reel.contact}`} className="flex items-center gap-1 rounded-full bg-emerald-500 px-2.5 py-1 text-[11px] font-bold text-white"><Phone className="size-3" /> Contact</a>}
              {reel.website && <a href={/^https?:\/\//.test(reel.website) ? reel.website : `https://${reel.website}`} target="_blank" rel="noreferrer" className="flex items-center gap-1 rounded-full bg-sky-500 px-2.5 py-1 text-[11px] font-bold text-white"><Globe className="size-3" /> Website</a>}
            </div>
          </div>
        )}

        {reel.musicName && (
          <p className="pointer-events-auto mt-2 flex items-center gap-1.5 text-xs text-white/80"><Music2 className="size-3.5 animate-pulse" /> <span className="truncate">{reel.musicName}</span></p>
        )}
        <p className="mt-1 flex items-center gap-1 text-[11px] text-white/60"><Eye className="size-3" /> {compact(reel.views)} views · {timeAgo(reel.createdAt)}</p>
      </div>

      {/* Right action rail */}
      <div className="absolute bottom-24 right-2 z-20 flex flex-col items-center gap-4">
        <RailButton icon={<Heart className={cn("size-7", reel.liked && "fill-rose-500 text-rose-500")} />} label={compact(reel.likeCount)} onClick={onLike} />
        <RailButton icon={<MessageCircle className="size-7" />} label={compact(reel.commentCount)} onClick={onComments} />
        <RailButton icon={<Bookmark className={cn("size-7", reel.saved && "fill-gold-300 text-gold-300")} />} label={compact(reel.saveCount)} onClick={onSave} />
        <RailButton icon={<Share2 className="size-7" />} label={compact(reel.shares)} onClick={onShare} />
        <div className="relative">
          <RailButton icon={<MoreVertical className="size-6" />} label="" onClick={() => setMenu((m) => !m)} />
          {menu && (
            <div className="absolute bottom-9 right-0 z-30 w-40 overflow-hidden rounded-xl border border-line bg-ink-850 py-1 text-sm shadow-2xl" onMouseLeave={() => setMenu(false)}>
              {reel.isOwner ? (
                <>
                  <Link href={`/reels/create?edit=${reel.id}`} className="flex items-center gap-2 px-3 py-2 text-mist-100 hover:bg-white/5"><Pencil className="size-4" /> Edit</Link>
                  <button onClick={() => { setMenu(false); onDelete(); }} className="flex w-full items-center gap-2 px-3 py-2 text-rose-300 hover:bg-white/5"><Trash2 className="size-4" /> Delete</button>
                </>
              ) : (
                <button onClick={() => { setMenu(false); onReport(); }} className="flex w-full items-center gap-2 px-3 py-2 text-rose-300 hover:bg-white/5"><Flag className="size-4" /> Report</button>
              )}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

function RailButton({ icon, label, onClick }: { icon: React.ReactNode; label: string; onClick: () => void }) {
  return (
    <button onClick={onClick} className="flex flex-col items-center gap-1 text-white drop-shadow-lg transition active:scale-90">
      <span className="grid size-11 place-items-center rounded-full bg-black/25 backdrop-blur">{icon}</span>
      {label !== "" && <span className="text-[11px] font-semibold">{label}</span>}
    </button>
  );
}

function CommentsSheet({ reel, onClose, onAdded }: { reel: Reel; onClose: () => void; onAdded: (c: ReelComment) => void }) {
  const { toast } = useToast();
  const [text, setText] = useState("");
  const [comments, setComments] = useState<ReelComment[]>(reel.comments ?? []);
  const [busy, setBusy] = useState(false);

  const send = async () => {
    const t = text.trim(); if (!t || busy) return;
    setBusy(true);
    const res = await commentReel(reel.id, t);
    setBusy(false);
    if (res.ok && res.comment) { setComments((c) => [...c, res.comment!]); onAdded(res.comment); setText(""); }
    else toast(res.error ?? "Could not comment", "error");
  };

  return (
    <div className="fixed inset-0 z-[130] flex items-end justify-center bg-black/60" onClick={onClose}>
      <div className="max-h-[70dvh] w-full max-w-[440px] overflow-hidden rounded-t-2xl border border-line bg-ink-900" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-line px-4 py-3">
          <h3 className="text-sm font-bold text-mist-100">{comments.length} comment{comments.length === 1 ? "" : "s"}</h3>
          <button onClick={onClose} className="grid size-8 place-items-center rounded-full text-mist-400 hover:bg-white/5"><X className="size-4" /></button>
        </div>
        <div className="max-h-[45dvh] space-y-3 overflow-y-auto px-4 py-3">
          {comments.length === 0 && <p className="py-6 text-center text-sm text-mist-400">Be the first to comment.</p>}
          {comments.map((c) => (
            <div key={c.id} className="flex gap-2">
              <Avatar name={c.userName} src={c.userAvatar ? withBase(c.userAvatar) : undefined} size="xs" />
              <div className="min-w-0">
                <p className="text-xs font-semibold text-mist-100">{c.userName} <span className="ml-1 font-normal text-mist-500">{timeAgo(c.at)}</span></p>
                <p className="text-sm text-mist-200">{c.text}</p>
              </div>
            </div>
          ))}
        </div>
        {reel.disableComments ? (
          <p className="border-t border-line px-4 py-4 text-center text-sm text-mist-400">Comments are turned off for this reel.</p>
        ) : (
          <div className="flex items-center gap-2 border-t border-line p-3">
            <input
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") send(); }}
              placeholder="Add a comment…"
              className="h-10 flex-1 rounded-full border border-line bg-ink-800 px-4 text-sm text-mist-100 outline-none focus:border-lotus-400"
            />
            <button onClick={send} disabled={busy || !text.trim()} className="grid size-10 shrink-0 place-items-center rounded-full bg-gradient-to-r from-lotus-500 to-petal-500 text-white disabled:opacity-50"><Send className="size-4" /></button>
          </div>
        )}
      </div>
    </div>
  );
}

function ReportModal({ reel, onClose, onDone }: { reel: Reel; onClose: () => void; onDone: () => void }) {
  const [reason, setReason] = useState(REPORT_REASONS[0]);
  const [detail, setDetail] = useState("");
  const [busy, setBusy] = useState(false);
  const submit = async () => {
    setBusy(true);
    await reportReelContent(reel.id, reason, detail);
    setBusy(false);
    onDone();
  };
  return (
    <div className="fixed inset-0 z-[130] grid place-items-center bg-black/70 p-4" onClick={onClose}>
      <div className="w-full max-w-sm rounded-2xl border border-line bg-ink-900 p-5" onClick={(e) => e.stopPropagation()}>
        <h3 className="mb-1 text-base font-bold text-mist-100">Report this reel</h3>
        <p className="mb-3 text-xs text-mist-400">Tell us what&apos;s wrong. Our team reviews every report.</p>
        <div className="space-y-1.5">
          {REPORT_REASONS.map((r) => (
            <label key={r} className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-white/5">
              <input type="radio" name="reason" checked={reason === r} onChange={() => setReason(r)} className="accent-lotus-500" />
              <span className="text-sm text-mist-200">{r}</span>
            </label>
          ))}
        </div>
        <textarea value={detail} onChange={(e) => setDetail(e.target.value)} placeholder="Add details (optional)" rows={2} className="mt-2 w-full resize-none rounded-lg border border-line bg-ink-800 p-2 text-sm text-mist-100 outline-none focus:border-lotus-400" />
        <div className="mt-4 flex gap-2">
          <button onClick={onClose} className="flex-1 rounded-lg border border-line py-2 text-sm font-semibold text-mist-200 hover:bg-white/5">Cancel</button>
          <button onClick={submit} disabled={busy} className="flex-1 rounded-lg bg-gradient-to-r from-rose-600 to-rose-500 py-2 text-sm font-semibold text-white disabled:opacity-50">Submit report</button>
        </div>
      </div>
    </div>
  );
}
