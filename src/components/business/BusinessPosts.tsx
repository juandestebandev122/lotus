"use client";

import { useEffect, useRef, useState } from "react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Textarea, Input } from "@/components/ui/Input";
import { useToast } from "@/components/ui/Toast";
import { cn } from "@/lib/cn";
import {
  fetchBusinessPosts, createBusinessPost, deleteBusinessPost, togglePostLike, addPostComment,
  type BizPost, type BizInsights, type BizPostKind,
} from "@/lib/business";
import { Heart, MessageCircle, Share2, Megaphone, Tag, ImagePlus, Trash2, Send, Loader2, Newspaper, Users, Eye } from "lucide-react";

function readImage(file: File, maxMB: number): Promise<string> {
  return new Promise((resolve, reject) => {
    if (file.size > maxMB * 1024 * 1024) return reject(new Error(`Image too large (max ${maxMB}MB).`));
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = () => reject(new Error("Could not read image."));
    r.readAsDataURL(file);
  });
}

function timeAgo(iso: string): string {
  const d = Date.parse(iso);
  if (!d) return "";
  const s = Math.floor((Date.now() - d) / 1000);
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  if (s < 604800) return `${Math.floor(s / 86400)}d ago`;
  return new Date(d).toLocaleDateString();
}

const KIND_META: Record<BizPostKind, { label: string; icon: typeof Tag; cls: string } | null> = {
  post: null,
  announcement: { label: "Announcement", icon: Megaphone, cls: "bg-sky-500/15 text-sky-300" },
  offer: { label: "Offer", icon: Tag, cls: "bg-amber-500/15 text-amber-300" },
};

export function BusinessPosts({ businessId, canManage, filterKind }: { businessId: string; canManage: boolean; filterKind?: BizPostKind }) {
  const [posts, setPosts] = useState<BizPost[]>([]);
  const [insights, setInsights] = useState<BizInsights | null>(null);
  const [loading, setLoading] = useState(true);

  const reload = () => fetchBusinessPosts(businessId).then((d) => { setPosts(d.posts); setInsights(d.insights); setLoading(false); });
  useEffect(() => { reload(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [businessId]);

  const shown = filterKind ? posts.filter((p) => p.kind === filterKind) : posts;
  const emptyMsg = filterKind === "offer" ? "No offers yet." : "No posts yet.";

  return (
    <div className="space-y-4">
      {/* Insights + composer only on the main Posts tab (not the filtered Offers tab). */}
      {!filterKind && canManage && insights && (
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
          <Insight icon={Newspaper} label="Posts" value={insights.posts} />
          <Insight icon={Heart} label="Likes" value={insights.likes} />
          <Insight icon={MessageCircle} label="Comments" value={insights.comments} />
          <Insight icon={Users} label="Followers" value={insights.followers} />
          <Insight icon={Eye} label="Views" value={insights.views} />
        </div>
      )}

      {!filterKind && canManage && <Composer businessId={businessId} onPosted={reload} />}

      <div>
        {loading ? (
          <Card className="p-6 text-center text-sm text-mist-500">Loading…</Card>
        ) : shown.length === 0 ? (
          <Card className="p-8 text-center">
            <Newspaper className="mx-auto size-8 text-mist-500" />
            <p className="mt-2 text-sm text-mist-300">{emptyMsg}</p>
            {canManage && !filterKind && <p className="text-xs text-mist-500">Share an update, a photo, an announcement or an offer above.</p>}
          </Card>
        ) : (
          <div className="space-y-3">
            {shown.map((p) => (
              <PostCard key={p.id} post={p} businessId={businessId} canManage={canManage} onChanged={reload} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function Insight({ icon: Icon, label, value }: { icon: typeof Heart; label: string; value: number }) {
  return (
    <Card className="p-2.5 text-center">
      <Icon className="mx-auto size-4 text-lotus-300" />
      <div className="mt-1 font-display text-lg font-extrabold text-mist-100">{value}</div>
      <div className="text-[10px] text-mist-500">{label}</div>
    </Card>
  );
}

function Composer({ businessId, onPosted }: { businessId: string; onPosted: () => void }) {
  const { toast } = useToast();
  const [kind, setKind] = useState<BizPostKind>("post");
  const [text, setText] = useState("");
  const [offer, setOffer] = useState("");
  const [image, setImage] = useState("");
  const [saving, setSaving] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const pick = async (file?: File) => {
    if (!file) return;
    try { setImage(await readImage(file, 3)); } catch (e) { toast(e instanceof Error ? e.message : "Bad image", "error"); }
  };

  const submit = async () => {
    if (!text.trim() && !image) { toast("Write something or add a photo.", "error"); return; }
    setSaving(true);
    const res = await createBusinessPost(businessId, { kind, text, image: image || undefined, offer: kind === "offer" ? offer : undefined });
    setSaving(false);
    if (!res.ok) { toast(res.error ?? "Could not post", "error"); return; }
    setText(""); setOffer(""); setImage(""); setKind("post");
    toast("Posted!", "success");
    onPosted();
  };

  return (
    <Card className="space-y-3 p-4">
      <div className="flex gap-2">
        {(["post", "announcement", "offer"] as const).map((k) => {
          const meta = KIND_META[k];
          const Icon = meta?.icon ?? Newspaper;
          return (
            <button key={k} onClick={() => setKind(k)} className={cn("flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-semibold capitalize transition-colors", kind === k ? "border-lotus-400 bg-lotus-500/15 text-lotus-100" : "border-line bg-ink-800 text-mist-300 hover:bg-ink-700")}>
              <Icon className="size-3.5" /> {k}
            </button>
          );
        })}
      </div>
      <Textarea value={text} onChange={(e) => setText(e.target.value)} placeholder={kind === "offer" ? "Describe your offer…" : kind === "announcement" ? "Share an announcement…" : "Share an update with your followers…"} maxLength={2000} />
      {kind === "offer" && <Input value={offer} onChange={(e) => setOffer(e.target.value)} placeholder="Offer badge, e.g. 20% OFF" maxLength={60} />}
      {image && (
        <div className="relative">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={image} alt="" className="max-h-64 w-full rounded-xl object-cover" />
          <button onClick={() => setImage("")} className="absolute right-2 top-2 grid size-7 place-items-center rounded-full bg-black/60 text-white">✕</button>
        </div>
      )}
      <div className="flex items-center justify-between">
        <button type="button" onClick={() => fileRef.current?.click()} className="flex items-center gap-1.5 rounded-lg border border-line bg-ink-800 px-3 py-1.5 text-xs font-semibold text-mist-300 hover:bg-ink-700">
          <ImagePlus className="size-4" /> Photo
        </button>
        <input ref={fileRef} type="file" accept="image/*" hidden onChange={(e) => pick(e.target.files?.[0])} />
        <Button size="sm" onClick={submit} disabled={saving}>{saving ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />} Post</Button>
      </div>
    </Card>
  );
}

function PostCard({ post, businessId, canManage, onChanged }: { post: BizPost; businessId: string; canManage: boolean; onChanged: () => void }) {
  const { toast } = useToast();
  const [liked, setLiked] = useState(post.liked);
  const [likeCount, setLikeCount] = useState(post.likeCount);
  const [showComments, setShowComments] = useState(false);
  const [comments, setComments] = useState(post.comments);
  const [commentText, setCommentText] = useState("");
  const [sending, setSending] = useState(false);
  const meta = KIND_META[post.kind];

  const like = async () => {
    // optimistic
    setLiked((v) => !v); setLikeCount((n) => n + (liked ? -1 : 1));
    const r = await togglePostLike(post.id);
    setLiked(r.liked); setLikeCount(r.likeCount);
  };
  const share = async () => {
    const url = `${typeof window !== "undefined" ? window.location.origin : ""}/business/${businessId}`;
    try { await navigator.clipboard.writeText(url); toast("Link copied to clipboard", "success"); }
    catch { toast(url, "info"); }
  };
  const comment = async () => {
    if (!commentText.trim()) return;
    setSending(true);
    const r = await addPostComment(post.id, commentText);
    setSending(false);
    if (r.ok && r.comment) { setComments((c) => [...c, r.comment!]); setCommentText(""); }
    else toast(r.error ?? "Could not comment", "error");
  };
  const del = async () => {
    if (!window.confirm("Delete this post?")) return;
    const r = await deleteBusinessPost(post.id);
    if (r.ok) { toast("Post deleted", "success"); onChanged(); }
    else toast(r.error ?? "Could not delete", "error");
  };

  return (
    <Card className="p-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {meta && <span className={cn("flex items-center gap-1 rounded-md px-2 py-0.5 text-[10px] font-bold uppercase", meta.cls)}><meta.icon className="size-3" /> {meta.label}</span>}
          <span className="text-xs text-mist-500">{timeAgo(post.createdAt)}</span>
        </div>
        {canManage && <button onClick={del} className="text-mist-500 hover:text-rose-300"><Trash2 className="size-4" /></button>}
      </div>

      {post.offer && <div className="mt-2 inline-block rounded-lg bg-amber-500/15 px-2.5 py-1 text-sm font-bold text-amber-200">{post.offer}</div>}
      {post.text && <p className="mt-2 whitespace-pre-wrap text-sm text-mist-200">{post.text}</p>}
      {post.imageUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={post.imageUrl} alt="" className="mt-3 max-h-96 w-full rounded-xl object-cover" />
      )}

      <div className="mt-3 flex items-center gap-4 border-t border-line pt-3 text-sm">
        <button onClick={like} className={cn("flex items-center gap-1.5 font-medium transition-colors", liked ? "text-rose-400" : "text-mist-400 hover:text-mist-200")}>
          <Heart className={cn("size-4", liked && "fill-rose-400")} /> {likeCount > 0 && likeCount}
        </button>
        <button onClick={() => setShowComments((v) => !v)} className="flex items-center gap-1.5 font-medium text-mist-400 hover:text-mist-200">
          <MessageCircle className="size-4" /> {comments.length > 0 && comments.length}
        </button>
        <button onClick={share} className="flex items-center gap-1.5 font-medium text-mist-400 hover:text-mist-200">
          <Share2 className="size-4" /> Share
        </button>
      </div>

      {showComments && (
        <div className="mt-3 space-y-2">
          {comments.map((c) => (
            <div key={c.id} className="rounded-lg bg-ink-800 px-3 py-2">
              <p className="text-xs"><b className="text-mist-200">{c.userName}</b> <span className="text-mist-500">· {timeAgo(c.at)}</span></p>
              <p className="text-sm text-mist-300">{c.text}</p>
            </div>
          ))}
          <div className="flex gap-2">
            <Input value={commentText} onChange={(e) => setCommentText(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") comment(); }} placeholder="Write a comment…" maxLength={500} className="!h-10" />
            <Button size="sm" onClick={comment} disabled={sending} className="!h-10">{sending ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}</Button>
          </div>
        </div>
      )}
    </Card>
  );
}
