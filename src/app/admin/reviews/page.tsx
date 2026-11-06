"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Avatar } from "@/components/ui/Avatar";
import { useToast } from "@/components/ui/Toast";
import { cn } from "@/lib/cn";
import { fetchAdminReviews, adminReviewAction, type ReviewCard } from "@/lib/business";
import { Star, Eye, EyeOff, Trash2, Search, MessageSquare, ExternalLink } from "lucide-react";

export default function AdminReviewsPage() {
  const { toast } = useToast();
  const [reviews, setReviews] = useState<ReviewCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<"all" | "visible" | "hidden">("all");

  const reload = () => fetchAdminReviews().then((r) => { setReviews(r); setLoading(false); });
  useEffect(() => { reload(); }, []);

  const act = async (r: ReviewCard, action: "hide" | "show" | "remove") => {
    if (action === "remove" && !window.confirm("Permanently remove this review?")) return;
    const ok = await adminReviewAction(r.id, action);
    if (ok) { toast(action === "remove" ? "Review removed" : action === "hide" ? "Review hidden" : "Review shown", "success"); reload(); }
    else toast("Action failed", "error");
  };

  const shown = useMemo(() => reviews.filter((r) => {
    if (filter !== "all" && r.status !== filter) return false;
    const s = q.trim().toLowerCase();
    return !s || r.userName.toLowerCase().includes(s) || (r.businessName ?? "").toLowerCase().includes(s) || r.text.toLowerCase().includes(s);
  }), [reviews, filter, q]);

  const stats = useMemo(() => ({
    total: reviews.length,
    visible: reviews.filter((r) => r.status === "visible").length,
    hidden: reviews.filter((r) => r.status === "hidden").length,
  }), [reviews]);

  if (loading) return <div className="grid min-h-[60vh] place-items-center text-mist-400">Loading reviews…</div>;

  return (
    <div className="space-y-5">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold text-mist-100"><Star className="size-6 text-gold-300" /> Reviews</h1>
        <p className="mt-0.5 text-sm text-mist-400">View, hide/show, or remove user reviews left on businesses.</p>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <Stat label="Total" value={stats.total} />
        <Stat label="Visible" value={stats.visible} tone="text-emerald-300" />
        <Stat label="Hidden" value={stats.hidden} tone="text-amber-300" />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="flex flex-1 items-center gap-2 rounded-xl border border-line bg-ink-800 px-3">
          <Search className="size-4 text-mist-500" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search reviewer, business or text…" className="h-10 w-full bg-transparent text-sm text-mist-100 outline-none placeholder:text-mist-500" />
        </div>
        {(["all", "visible", "hidden"] as const).map((f) => (
          <button key={f} onClick={() => setFilter(f)} className={cn("rounded-lg border px-3 py-1.5 text-sm font-semibold capitalize transition-colors", filter === f ? "border-lotus-400 bg-lotus-500/15 text-lotus-100" : "border-line bg-ink-800 text-mist-300 hover:bg-ink-700")}>{f}</button>
        ))}
      </div>

      {shown.length === 0 ? (
        <Card className="p-10 text-center text-sm text-mist-400"><MessageSquare className="mx-auto mb-2 size-8 text-mist-600" /> No reviews {reviews.length ? "match your filter" : "yet"}.</Card>
      ) : (
        <div className="space-y-2">
          {shown.map((r) => (
            <Card key={r.id} className="p-4">
              <div className="flex gap-3">
                <Avatar name={r.userName} src={r.userAvatar || undefined} size="md" />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-semibold text-mist-100">{r.userName}</span>
                    <span className="flex items-center gap-0.5">{Array.from({ length: 5 }).map((_, i) => <Star key={i} className={cn("size-3.5", i < r.rating ? "fill-gold-300 text-gold-300" : "text-mist-600")} />)}</span>
                    {r.status === "hidden" && <span className="rounded-md bg-amber-500/15 px-2 py-0.5 text-[10px] font-bold uppercase text-amber-300">Hidden</span>}
                  </div>
                  <p className="mt-0.5 text-[11px] text-mist-500">on <Link href={`/business/${r.businessId}`} className="text-lotus-300 hover:underline">{r.businessName ?? "business"} <ExternalLink className="inline size-3" /></Link> · {new Date(r.createdAt).toLocaleString()}</p>
                  <p className="mt-1.5 whitespace-pre-wrap text-sm text-mist-300">{r.text}</p>
                </div>
              </div>
              <div className="mt-3 flex flex-wrap gap-2 border-t border-line pt-3">
                {r.status === "visible"
                  ? <Button size="sm" variant="secondary" onClick={() => act(r, "hide")}><EyeOff className="size-4" /> Hide</Button>
                  : <Button size="sm" onClick={() => act(r, "show")}><Eye className="size-4" /> Show</Button>}
                <Button size="sm" variant="ghost" className="!text-rose-300 hover:!bg-rose-500/10" onClick={() => act(r, "remove")}><Trash2 className="size-4" /> Remove</Button>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: number; tone?: string }) {
  return (
    <Card className="p-4 text-center">
      <div className={cn("font-display text-2xl font-extrabold", tone ?? "text-mist-100")}>{value}</div>
      <div className="text-xs text-mist-400">{label}</div>
    </Card>
  );
}
