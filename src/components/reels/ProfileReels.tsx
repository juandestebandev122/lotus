"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Eye, Heart, Film, Play, Lock, Link2, Share2, Trash2, Pencil, Plus, Upload } from "lucide-react";
import { withBase } from "@/lib/base-path";
import { cn } from "@/lib/cn";
import { useConfig } from "@/lib/config";
import { useToast } from "@/components/ui/Toast";
import { ButtonLink } from "@/components/ui/Button";
import { fetchUserReels, fetchReels, deleteReel, shareReel as bumpShare, type Reel } from "@/lib/reels";

const compact = (n: number) => (n < 1000 ? String(n) : n < 1_000_000 ? `${(n / 1000).toFixed(1)}k`.replace(".0", "") : `${(n / 1_000_000).toFixed(1)}M`);

/** Grid of a creator's (or a business's) reels/videos. Tapping a thumbnail opens
 *  the full-screen viewer. Owners get Edit/Delete; everyone gets Copy/Share link. */
export function ProfileReels({
  username,
  businessId,
  kind = "reel",
  canManage = false,
  createHref,
}: {
  username?: string;
  businessId?: string;
  kind?: "reel" | "video";
  canManage?: boolean;
  createHref?: string; // show a "Post" button (business/own profile)
}) {
  const { config } = useConfig();
  const { toast } = useToast();
  const [reels, setReels] = useState<Reel[]>([]);
  const [stats, setStats] = useState({ totalViews: 0, totalLikes: 0 });
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    if (businessId) {
      const page = await fetchReels("latest", { businessId, kind, limit: 60 });
      setReels(page.reels);
      setStats({ totalViews: page.reels.reduce((s, r) => s + r.views, 0), totalLikes: page.reels.reduce((s, r) => s + r.likeCount, 0) });
    } else if (username) {
      const d = await fetchUserReels(username, kind);
      setReels(d.reels); setStats({ totalViews: d.totalViews, totalLikes: d.totalLikes });
    }
    setLoading(false);
  }, [businessId, username, kind]);
  useEffect(() => { load(); }, [load]);

  const label = kind === "video" ? "Videos" : "Reels";

  const linkFor = (r: Reel) => `${typeof window !== "undefined" ? window.location.origin : ""}${withBase(`/reels?r=${r.id}`)}`;
  const copyLink = async (r: Reel) => {
    try { await navigator.clipboard.writeText(linkFor(r)); toast("Link copied to clipboard", "success"); } catch { toast(linkFor(r), "info"); }
  };
  const share = async (r: Reel) => {
    const url = linkFor(r);
    try { if (navigator.share) { await navigator.share({ title: `${r.ownerName} on Lotus`, url }); } else { await navigator.clipboard.writeText(url); toast("Link copied to clipboard", "success"); } } catch { /* cancelled */ }
    bumpShare(r.id);
  };
  const remove = async (r: Reel) => {
    if (!confirm(`Delete this ${kind}?`)) return;
    const res = await deleteReel(r.id);
    if (res.ok) { setReels((prev) => prev.filter((x) => x.id !== r.id)); toast("Deleted", "success"); }
    else toast(res.error ?? "Could not delete", "error");
  };

  if (config.features?.reels === false) return <p className="py-10 text-center text-sm text-mist-400">This feature is currently unavailable.</p>;
  if (loading) return <div className="grid h-32 place-items-center text-mist-400"><span className="animate-pulse text-sm">Loading {label.toLowerCase()}…</span></div>;

  return (
    <div>
      <div className="mb-4 flex items-center gap-3">
        <div className="grid flex-1 grid-cols-3 gap-3">
          <Stat value={reels.length} label={label} />
          <Stat value={compact(stats.totalViews)} label="Views" icon={<Eye className="size-4 text-sky-300" />} />
          <Stat value={compact(stats.totalLikes)} label="Likes" icon={<Heart className="size-4 fill-rose-500 text-rose-500" />} />
        </div>
        {createHref && (
          <ButtonLink href={createHref} size="sm"><Plus className="size-4" /> Upload {kind}</ButtonLink>
        )}
      </div>

      {reels.length === 0 ? (
        <div className="grid h-44 place-items-center rounded-2xl border border-white/8 bg-ink-850/40 px-6 text-center">
          <div>
            <Film className="mx-auto mb-2 size-8 text-mist-500" />
            <p className="text-sm text-mist-400">No {label.toLowerCase()} yet.</p>
            {createHref && (
              <ButtonLink href={createHref} size="sm" className="mt-3"><Upload className="size-4" /> Select a file &amp; upload</ButtonLink>
            )}
          </div>
        </div>
      ) : (
        <div className={cn("grid gap-2", kind === "video" ? "grid-cols-2 sm:grid-cols-3" : "grid-cols-3 sm:grid-cols-4")}>
          {reels.map((r) => {
            const mine = canManage || r.isOwner;
            return (
              <div key={r.id} className={cn("group relative overflow-hidden rounded-xl bg-black", kind === "video" ? "aspect-video" : "aspect-[9/16]")}>
                <Link href={`/reels?r=${r.id}`} className="block size-full">
                  {r.thumbUrl ? <img src={withBase(r.thumbUrl)} alt={r.caption} className="size-full object-cover transition group-hover:scale-105" /> : <div className="grid size-full place-items-center"><Film className="size-6 text-mist-600" /></div>}
                  <div className="absolute inset-x-0 bottom-0 flex items-center justify-between bg-gradient-to-t from-black/80 to-transparent px-2 py-1.5 text-[11px] font-semibold text-white">
                    <span className="flex items-center gap-1"><Play className="size-3 fill-white" /> {compact(r.views)}</span>
                    <span className="flex items-center gap-1"><Heart className="size-3 fill-white" /> {compact(r.likeCount)}</span>
                  </div>
                </Link>
                {r.status === "draft" && <span className="absolute left-1.5 top-1.5 rounded-full bg-amber-500/90 px-1.5 py-0.5 text-[9px] font-bold text-ink-900">DRAFT</span>}
                {r.status !== "draft" && r.privacy !== "public" && <span className="absolute left-1.5 top-1.5 grid size-5 place-items-center rounded-full bg-black/50 text-white"><Lock className="size-3" /></span>}
                {/* Action buttons */}
                <div className="absolute right-1 top-1 flex flex-col gap-1 opacity-0 transition group-hover:opacity-100">
                  <IconBtn title="Copy link" onClick={() => copyLink(r)}><Link2 className="size-3.5" /></IconBtn>
                  <IconBtn title="Share" onClick={() => share(r)}><Share2 className="size-3.5" /></IconBtn>
                  {mine && <IconBtn title="Edit" href={`/reels/create?edit=${r.id}`}><Pencil className="size-3.5" /></IconBtn>}
                  {mine && <IconBtn title="Delete" onClick={() => remove(r)} danger><Trash2 className="size-3.5" /></IconBtn>}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function Stat({ value, label, icon }: { value: React.ReactNode; label: string; icon?: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-white/8 bg-ink-850/70 p-3 text-center">
      <p className="flex items-center justify-center gap-1 font-display text-xl font-extrabold text-mist-100">{icon} {value}</p>
      <p className="text-[11px] text-mist-400">{label}</p>
    </div>
  );
}

function IconBtn({ children, onClick, href, title, danger }: { children: React.ReactNode; onClick?: () => void; href?: string; title: string; danger?: boolean }) {
  const cls = cn("grid size-7 place-items-center rounded-full bg-black/55 text-white backdrop-blur transition hover:bg-black/75", danger && "hover:bg-rose-600");
  if (href) return <Link href={href} title={title} className={cls} onClick={(e) => e.stopPropagation()}>{children}</Link>;
  return <button type="button" title={title} className={cls} onClick={(e) => { e.preventDefault(); e.stopPropagation(); onClick?.(); }}>{children}</button>;
}
