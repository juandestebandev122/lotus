"use client";

import { useCallback, useEffect, useState } from "react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Avatar } from "@/components/ui/Avatar";
import { useToast } from "@/components/ui/Toast";
import { cn } from "@/lib/cn";
import { fetchBusinessReviews, postReview, deleteReview, type ReviewCard, type ReviewSummary } from "@/lib/business";
import { Star, Loader2, Trash2, Pencil, MessageSquare } from "lucide-react";

/** User reviews + star ratings on a business, visible to everyone. The owner
 *  can't review their own business; each user has one (editable) review. */
export function BusinessReviews({ businessId, isOwner }: { businessId: string; isOwner: boolean }) {
  const { toast } = useToast();
  const [reviews, setReviews] = useState<ReviewCard[]>([]);
  const [summary, setSummary] = useState<ReviewSummary>({ count: 0, average: 0, breakdown: {} });
  const [mine, setMine] = useState<ReviewCard | undefined>();
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [rating, setRating] = useState(5);
  const [text, setText] = useState("");
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    const d = await fetchBusinessReviews(businessId);
    setReviews(d.reviews); setSummary(d.summary); setMine(d.mine);
    if (d.mine) { setRating(d.mine.rating); setText(d.mine.text); }
    setLoading(false);
  }, [businessId]);
  useEffect(() => { load(); }, [load]);

  const submit = async () => {
    if (!text.trim()) { toast("Please write a short review.", "error"); return; }
    setSaving(true);
    const res = await postReview(businessId, rating, text.trim());
    setSaving(false);
    if (res.ok) { toast(mine ? "Review updated" : "Review posted — thank you!", "success"); setEditing(false); load(); }
    else toast(res.error ?? "Could not post review", "error");
  };
  const removeMine = async () => {
    if (!mine || !window.confirm("Delete your review?")) return;
    const res = await deleteReview(businessId, mine.id);
    if (res.ok) { toast("Review deleted", "info"); setMine(undefined); setText(""); setRating(5); load(); }
    else toast(res.error ?? "Could not delete", "error");
  };

  if (loading) return <div className="grid h-24 place-items-center text-mist-400"><Loader2 className="size-5 animate-spin" /></div>;

  const others = reviews.filter((r) => !r.isMine);

  return (
    <div className="space-y-4">
      {/* Summary */}
      <Card className="flex items-center gap-4 p-4">
        <div className="text-center">
          <div className="font-display text-3xl font-extrabold text-mist-100">{summary.average || "—"}</div>
          <Stars value={Math.round(summary.average)} size="sm" />
          <div className="mt-0.5 text-[11px] text-mist-500">{summary.count} review{summary.count === 1 ? "" : "s"}</div>
        </div>
        <div className="flex-1 space-y-0.5">
          {[5, 4, 3, 2, 1].map((n) => {
            const c = summary.breakdown[n] ?? 0;
            const pct = summary.count ? Math.round((c / summary.count) * 100) : 0;
            return (
              <div key={n} className="flex items-center gap-2 text-[11px] text-mist-400">
                <span className="w-3">{n}</span><Star className="size-3 fill-gold-300 text-gold-300" />
                <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/[0.06]"><span className="block h-full rounded-full bg-gold-400" style={{ width: `${pct}%` }} /></span>
                <span className="w-5 text-right">{c}</span>
              </div>
            );
          })}
        </div>
      </Card>

      {/* Write / edit your review (not the owner) */}
      {!isOwner && (
        <Card className="p-4">
          {mine && !editing ? (
            <div>
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold text-mist-100">Your review</p>
                <div className="flex gap-1.5">
                  <button onClick={() => setEditing(true)} className="grid size-8 place-items-center rounded-lg text-mist-300 hover:bg-white/5" title="Edit"><Pencil className="size-4" /></button>
                  <button onClick={removeMine} className="grid size-8 place-items-center rounded-lg text-rose-300 hover:bg-rose-500/10" title="Delete"><Trash2 className="size-4" /></button>
                </div>
              </div>
              <Stars value={mine.rating} size="sm" />
              <p className="mt-1 whitespace-pre-wrap text-sm text-mist-300">{mine.text}</p>
              {mine.status === "hidden" && <p className="mt-1 text-[11px] text-amber-300">Hidden by admin — only you can see it.</p>}
            </div>
          ) : (
            <div>
              <p className="mb-1.5 text-sm font-semibold text-mist-100">{mine ? "Edit your review" : "Write a review"}</p>
              <Stars value={rating} onChange={setRating} />
              <textarea value={text} onChange={(e) => setText(e.target.value)} rows={3} maxLength={1000} placeholder="Share your experience with this business…" className="mt-2 w-full resize-none rounded-lg border border-line bg-ink-800 p-2.5 text-sm text-mist-100 outline-none focus:border-lotus-400" />
              <div className="mt-2 flex justify-end gap-2">
                {mine && <Button size="sm" variant="secondary" onClick={() => { setEditing(false); setRating(mine.rating); setText(mine.text); }}>Cancel</Button>}
                <Button size="sm" onClick={submit} disabled={saving}>{saving ? <Loader2 className="size-4 animate-spin" /> : <Star className="size-4" />} {mine ? "Update review" : "Post review"}</Button>
              </div>
            </div>
          )}
        </Card>
      )}

      {/* Everyone else's reviews */}
      {others.length === 0 ? (
        <Card className="p-8 text-center text-sm text-mist-500"><MessageSquare className="mx-auto mb-1.5 size-6" /> No reviews yet.{!isOwner && !mine && " Be the first to review this business."}</Card>
      ) : (
        <div className="space-y-2">
          {others.map((r) => (
            <Card key={r.id} className="p-3">
              <div className="flex items-center gap-2">
                <Avatar name={r.userName} src={r.userAvatar || undefined} size="sm" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-mist-100">{r.userName}</p>
                  <Stars value={r.rating} size="sm" />
                </div>
                <span className="shrink-0 text-[10px] text-mist-500">{new Date(r.createdAt).toLocaleDateString(undefined, { day: "2-digit", month: "short", year: "numeric" })}</span>
              </div>
              <p className="mt-1.5 whitespace-pre-wrap text-sm text-mist-300">{r.text}</p>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

function Stars({ value, onChange, size = "md" }: { value: number; onChange?: (v: number) => void; size?: "sm" | "md" }) {
  const cls = size === "sm" ? "size-3.5" : "size-6";
  return (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map((n) => (
        <button key={n} type="button" disabled={!onChange} onClick={() => onChange?.(n)} className={cn(onChange && "transition hover:scale-110")}>
          <Star className={cn(cls, n <= value ? "fill-gold-300 text-gold-300" : "text-mist-600")} />
        </button>
      ))}
    </div>
  );
}
