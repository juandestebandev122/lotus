"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { Card } from "@/components/ui/Card";
import { Button, ButtonLink } from "@/components/ui/Button";
import { Avatar } from "@/components/ui/Avatar";
import { Badge } from "@/components/ui/Badge";
import { useToast } from "@/components/ui/Toast";
import { useAuth } from "@/lib/auth";
import { useConfig } from "@/lib/config";
import { withBase } from "@/lib/base-path";
import { cn } from "@/lib/cn";
import { BusinessPosts } from "@/components/business/BusinessPosts";
import { BusinessProducts } from "@/components/business/BusinessProducts";
import { BusinessJobs } from "@/components/business/BusinessJobs";
import { BusinessReviews } from "@/components/business/BusinessReviews";
import { ProfileReels } from "@/components/reels/ProfileReels";
import { fetchBusiness, fetchBusinessProducts, fetchBusinessMedia, toggleFollowBusiness, productEnquiry, reportBusiness, type BusinessCard, type BizProduct, type MediaCard } from "@/lib/business";
import {
  BadgeCheck, MapPin, Phone, Mail, Globe, Clock, Users, ArrowLeft, MessageCircle, Pencil, Lock,
  ShoppingBag, Tag, Info, Film, Video, Briefcase, Star, Image as ImageIcon, Wrench, ChevronRight,
  Share2, Bookmark, Flag, Store, Play, Loader2,
} from "lucide-react";

type Tab = "page" | "reels" | "videos" | "products" | "offers" | "jobs" | "reviews";

const SECTION_ICON: Record<string, typeof Store> = { page: Store, reels: Film, videos: Video, products: ShoppingBag, offers: Tag, jobs: Briefcase, reviews: Star };
const DEFAULT_SECTIONS: { key: Tab; label: string; enabled: boolean }[] = [
  { key: "page", label: "Business Page", enabled: true },
  { key: "reels", label: "Reels / Shorts", enabled: true },
  { key: "videos", label: "Videos", enabled: true },
  { key: "products", label: "Products", enabled: true },
  { key: "offers", label: "Offers", enabled: true },
  { key: "jobs", label: "Jobs", enabled: true },
  { key: "reviews", label: "Reviews", enabled: true },
];

function formatK(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1).replace(/\.0$/, "") + "M";
  if (n >= 1_000) return (n / 1_000).toFixed(1).replace(/\.0$/, "") + "K";
  return String(n);
}

export default function BusinessProfilePage() {
  const { id } = useParams<{ id: string }>();
  const { toast } = useToast();
  const { user } = useAuth();
  const { config } = useConfig();
  const [biz, setBiz] = useState<BusinessCard | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [tab, setTab] = useState<Tab>("page");
  const [saved, setSaved] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);

  useEffect(() => {
    fetchBusiness(id).then((b) => { if (b) setBiz(b); else setNotFound(true); });
  }, [id]);
  useEffect(() => {
    try { setSaved((JSON.parse(localStorage.getItem("lotus.savedBiz") || "[]") as string[]).includes(id)); } catch { /* ignore */ }
  }, [id]);

  if (notFound) return (
    <div className="mx-auto max-w-2xl">
      <Card className="p-8 text-center">
        <p className="text-sm text-mist-300">This business isn&apos;t available.</p>
        <ButtonLink href="/business" size="sm" className="mt-4"><ArrowLeft className="size-4" /> Back to Businesses</ButtonLink>
      </Card>
    </div>
  );
  if (!biz) return <div className="grid min-h-[60vh] place-items-center text-mist-400">Loading…</div>;

  const isOwner = user?.id === biz.ownerId;
  const canManage = isOwner || user?.role === "admin";
  const waNumber = (biz.whatsapp ?? "").replace(/[^\d]/g, "");

  const follow = async () => {
    const r = await toggleFollowBusiness(biz.id);
    setBiz({ ...biz, following: r.following, followers: r.followers });
    toast(r.following ? `Following ${biz.name}` : `Unfollowed ${biz.name}`, "success");
  };
  const share = async () => {
    const url = `${typeof window !== "undefined" ? window.location.origin : ""}/business/${biz.id}`;
    try { await navigator.clipboard.writeText(url); toast("Link copied to clipboard", "success"); }
    catch { toast(url, "info"); }
  };
  const toggleSave = () => {
    try {
      const list = JSON.parse(localStorage.getItem("lotus.savedBiz") || "[]") as string[];
      const next = list.includes(biz.id) ? list.filter((x) => x !== biz.id) : [...list, biz.id];
      localStorage.setItem("lotus.savedBiz", JSON.stringify(next));
      const now = next.includes(biz.id);
      setSaved(now);
      toast(now ? `Saved ${biz.name}` : "Removed from saved", now ? "success" : "info");
    } catch { toast("Could not save", "error"); }
  };
  // Report now requires a REASON — it goes into the real admin report queue.

  // Sections (tabs) are admin-controlled: rename / hide-show / reorder via
  // config.business.profileSections. Fall back to the full default set.
  const sectionDefs = (config.business?.profileSections?.length ? config.business.profileSections : DEFAULT_SECTIONS);
  const TABS: { key: Tab; label: string; icon: typeof Store }[] = sectionDefs
    .filter((s) => s.enabled !== false && SECTION_ICON[s.key])
    .map((s) => ({ key: s.key as Tab, label: s.label, icon: SECTION_ICON[s.key] }));
  // Keep the active tab valid even if the admin hid the current one.
  const activeTab: Tab = TABS.some((t) => t.key === tab) ? tab : (TABS[0]?.key ?? "page");

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <ButtonLink href="/business" variant="ghost" size="sm"><ArrowLeft className="size-4" /> Businesses</ButtonLink>

      {/* ===== Header ===== */}
      <Card className="overflow-hidden p-0">
        <div
          className="h-32 w-full bg-gradient-to-r from-lotus-600/40 to-petal-600/30 sm:h-40"
          style={biz.coverUrl ? { backgroundImage: `url(${biz.coverUrl})`, backgroundSize: "cover", backgroundPosition: "center" } : undefined}
        />
        <div className="px-5 pb-5">
          {/* Logo overlaps the cover */}
          <div className="-mt-10">
            <Avatar name={biz.name} src={biz.logoUrl || undefined} size="2xl" />
          </div>

          {/* Name (left) + action buttons & stats (right, beside the name — moved
              up from the bottom, still clear of the cover). */}
          <div className="mt-3 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <h1 className="truncate text-xl font-bold text-mist-100">{biz.name}</h1>
                {biz.verified && <BadgeCheck className="size-5 shrink-0 text-sky-400" aria-label="Verified business" />}
              </div>
              <div className="mt-1.5 flex flex-wrap items-center gap-2">
                <Badge tone="lotus">{biz.category}</Badge>
                {biz.verified && <Badge tone="green"><BadgeCheck className="size-3" /> Verified</Badge>}
                {!biz.verified && isOwner && <Badge tone="gold">Pending review</Badge>}
                {biz.visibility === "businesses" && <Badge tone="neutral"><Lock className="size-3" /> Businesses only</Badge>}
              </div>
              {biz.location && <p className="mt-1 flex items-center gap-1 text-xs uppercase tracking-wide text-mist-400"><MapPin className="size-3" />{biz.location}</p>}
              <div className="mt-2 flex items-center gap-3 text-xs text-mist-300">
                <span className="flex items-center gap-1"><Users className="size-3.5 text-lotus-300" /><b className="text-mist-100">{formatK(biz.followers)}</b> Followers</span>
                <span className="text-mist-500">·</span>
                <span><b className="text-mist-100">0</b> Following</span>
              </div>
            </div>
            <div className="space-y-2.5 sm:w-72 sm:shrink-0">
              <div className="flex gap-2">
                {isOwner ? (
                  <ButtonLink href={`/business/new?id=${biz.id}`} size="sm" variant="secondary" className="flex-1"><Pencil className="size-4" /> Edit Profile</ButtonLink>
                ) : (
                  <>
                    <Button size="sm" variant={biz.following ? "secondary" : "primary"} onClick={follow} className="flex-1">{biz.following ? "Following" : "Follow"}</Button>
                    {waNumber && <IconAction href={`https://wa.me/${waNumber}`} title="WhatsApp" tone="emerald" className="flex-1"><MessageCircle className="size-4" /></IconAction>}
                    {biz.phone && <IconAction href={`tel:${biz.phone}`} title="Call" tone="emerald" className="flex-1"><Phone className="size-4" /></IconAction>}
                    {biz.email && <IconAction href={`mailto:${biz.email}`} title="Email" tone="neutral" className="flex-1"><Mail className="size-4" /></IconAction>}
                  </>
                )}
              </div>
              <div className="flex justify-between gap-4">
                <HeaderStat n={biz.views} label="Profile Views" />
                <HeaderStat n={0} label="Reel Views" />
                <HeaderStat n={0} label="Video Views" />
              </div>
            </div>
          </div>
        </div>
      </Card>

      {/* ===== Tabs (evenly fill the width — admin controls which show & order) ===== */}
      {TABS.length > 0 && (
        <div className="grid gap-1.5" style={{ gridTemplateColumns: `repeat(${TABS.length}, minmax(0, 1fr))` }}>
          {TABS.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={cn("flex flex-col items-center gap-1 rounded-xl border px-1 py-2 text-center text-[10px] font-semibold leading-tight transition-colors", activeTab === t.key ? "border-lotus-400 bg-lotus-500/15 text-lotus-100" : "border-line bg-ink-800 text-mist-400 hover:bg-ink-700")}
            >
              <t.icon className="size-4 shrink-0" /> <span>{t.label}</span>
            </button>
          ))}
        </div>
      )}

      {/* ===== Tab content ===== */}
      {activeTab === "page" && <BusinessPageLanding biz={biz} canManage={canManage} onTab={setTab} />}
      {activeTab === "reels" && <ProfileReels businessId={biz.id} kind="reel" canManage={canManage} createHref={canManage ? `/reels/create?business=${biz.id}&kind=reel` : undefined} />}
      {activeTab === "videos" && <ProfileReels businessId={biz.id} kind="video" canManage={canManage} createHref={canManage ? `/reels/create?business=${biz.id}&kind=video` : undefined} />}
      {activeTab === "products" && <BusinessProducts businessId={biz.id} canManage={canManage} />}
      {activeTab === "offers" && <BusinessPosts businessId={biz.id} canManage={canManage} filterKind="offer" />}
      {activeTab === "jobs" && <BusinessJobs businessId={biz.id} canManage={canManage} />}
      {activeTab === "reviews" && <BusinessReviews businessId={biz.id} isOwner={isOwner} />}

      {/* ===== Viewer action bar ===== */}
      {!isOwner && (
        <Card className="grid grid-cols-3 gap-1 p-1">
          <BottomAction icon={Share2} label="Share" onClick={share} />
          <BottomAction icon={Bookmark} label={saved ? "Saved" : "Save"} active={saved} onClick={toggleSave} />
          <BottomAction icon={Flag} label="Report" onClick={() => setReportOpen(true)} />
        </Card>
      )}

      {reportOpen && <ReportBusinessModal name={biz.name} onClose={() => setReportOpen(false)} onSubmit={async (category, detail) => {
        const res = await reportBusiness(biz.id, category, detail);
        if (res.ok) { toast("Thanks — our team will review this business.", "success"); setReportOpen(false); }
        else toast(res.error ?? "Could not submit the report", "error");
      }} />}
    </div>
  );
}

function ReportBusinessModal({ name, onClose, onSubmit }: { name: string; onClose: () => void; onSubmit: (category: string, detail: string) => Promise<void> }) {
  const REASONS = ["Spam or scam", "Inappropriate content", "Fake business", "Harassment or hate", "Fraudulent / misleading", "Other"];
  const [category, setCategory] = useState(REASONS[0]);
  const [detail, setDetail] = useState("");
  const [busy, setBusy] = useState(false);
  return (
    <div className="fixed inset-0 z-[130] grid place-items-center bg-black/60 p-4" onClick={onClose}>
      <div className="w-full max-w-md space-y-3 rounded-2xl border border-white/10 bg-ink-900 p-5" onClick={(e) => e.stopPropagation()}>
        <h3 className="text-base font-bold text-mist-100">Report {name}</h3>
        <div>
          <label className="mb-1 block text-xs font-semibold text-mist-300">Reason *</label>
          <select value={category} onChange={(e) => setCategory(e.target.value)} className="w-full rounded-lg border border-line bg-ink-800 p-2.5 text-sm text-mist-100 outline-none focus:border-lotus-400">
            {REASONS.map((r) => <option key={r} value={r}>{r}</option>)}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs font-semibold text-mist-300">Details (optional)</label>
          <textarea value={detail} onChange={(e) => setDetail(e.target.value)} rows={3} maxLength={300} placeholder="Tell us what's wrong…" className="w-full resize-none rounded-lg border border-line bg-ink-800 p-2.5 text-sm text-mist-100 outline-none focus:border-lotus-400" />
        </div>
        <div className="flex justify-end gap-2">
          <Button size="sm" variant="secondary" onClick={onClose}>Cancel</Button>
          <Button size="sm" onClick={async () => { setBusy(true); await onSubmit(category, detail.trim()); setBusy(false); }} disabled={busy}>{busy ? <Loader2 className="size-4 animate-spin" /> : <Flag className="size-4" />} Submit report</Button>
        </div>
      </div>
    </div>
  );
}

function HeaderStat({ n, label }: { n: number; label: string }) {
  return (
    <div className="text-center">
      <div className="font-display text-base font-extrabold text-mist-100">{formatK(n)}</div>
      <div className="text-[10px] text-mist-500">{label}</div>
    </div>
  );
}

function IconAction({ href, title, tone, className, children }: { href: string; title: string; tone: "emerald" | "neutral"; className?: string; children: React.ReactNode }) {
  return (
    <a
      href={href}
      target={href.startsWith("http") ? "_blank" : undefined}
      rel="noopener noreferrer"
      title={title}
      aria-label={title}
      className={cn("grid h-9 min-w-9 place-items-center rounded-lg border transition-colors", tone === "emerald" ? "border-emerald-400/30 bg-emerald-500/15 text-emerald-300 hover:bg-emerald-500/25" : "border-line bg-ink-800 text-mist-200 hover:bg-ink-700", className)}
    >
      {children}
    </a>
  );
}

function BottomAction({ icon: Icon, label, onClick, active }: { icon: typeof Share2; label: string; onClick: () => void; active?: boolean }) {
  return (
    <button onClick={onClick} className={cn("flex flex-col items-center gap-1 rounded-lg py-2 text-[11px] font-semibold transition-colors hover:bg-white/[0.04]", active ? "text-gold-300" : "text-mist-300")}>
      <Icon className={cn("size-4", active ? "fill-gold-300 text-gold-300" : "text-lotus-300")} /> {label}
    </button>
  );
}

function BusinessPageLanding({ biz, canManage, onTab }: { biz: BusinessCard; canManage: boolean; onTab: (t: Tab) => void }) {
  const { toast } = useToast();
  const { config } = useConfig();
  // Admin-defined custom fields that this business actually filled in.
  const customFields = (config.business?.fields ?? [])
    .map((cf) => ({ label: cf.label, value: (biz.fields ?? {})[cf.key] ?? "" }))
    .filter((x) => x.value.trim());
  const [products, setProducts] = useState<BizProduct[]>([]);
  const [reels, setReels] = useState<MediaCard[]>([]);
  useEffect(() => {
    fetchBusinessProducts(biz.id).then((d) => setProducts(d.products));
    fetchBusinessMedia(biz.id, "reel").then((d) => setReels(d.media));
  }, [biz.id]);

  const scrollAbout = () => document.getElementById("biz-about")?.scrollIntoView({ behavior: "smooth", block: "start" });
  const quickLinks: { icon: typeof Info; label: string; onClick: () => void }[] = [
    { icon: Info, label: "About Us", onClick: scrollAbout },
    { icon: ShoppingBag, label: "Products", onClick: () => onTab("products") },
    { icon: Wrench, label: "Services", onClick: () => onTab("products") },
    { icon: ImageIcon, label: "Reels", onClick: () => onTab("reels") },
    { icon: Tag, label: "Offers", onClick: () => onTab("offers") },
  ];

  const enquire = async (p: BizProduct) => {
    const res = await productEnquiry(p.id);
    toast(res.ok ? `Enquiry sent about "${p.name}".` : (res.error ?? "Could not send"), res.ok ? "success" : "error");
  };

  const socials = [
    biz.whatsapp && { label: "WhatsApp", href: `https://wa.me/${biz.whatsapp.replace(/[^\d]/g, "")}`, emoji: "💬" },
    biz.facebook && { label: "Facebook", href: linkify(biz.facebook), emoji: "📘" },
    biz.instagram && { label: "Instagram", href: linkify(biz.instagram), emoji: "📷" },
    biz.youtube && { label: "YouTube", href: linkify(biz.youtube), emoji: "▶️" },
  ].filter(Boolean) as { label: string; href: string; emoji: string }[];

  return (
    <div className="space-y-5">
      {/* Quick links */}
      <Card className="p-4">
        <div className="grid grid-cols-5 gap-1">
          {quickLinks.map((q) => (
            <button key={q.label} onClick={q.onClick} className="flex flex-col items-center gap-1.5 rounded-xl py-1.5 text-[10px] font-medium text-mist-300 transition-colors hover:bg-white/[0.04]">
              <span className="grid size-11 place-items-center rounded-full border border-lotus-400/25 bg-lotus-500/10 text-lotus-300"><q.icon className="size-4" /></span>
              {q.label}
            </button>
          ))}
        </div>
      </Card>

      {/* Reels / Shorts preview */}
      <Section title="Reels / Shorts" onViewAll={() => onTab("reels")}>
        {reels.length === 0 ? (
          <Card className="p-6 text-center text-sm text-mist-500"><Film className="mx-auto mb-1.5 size-6" /> No reels yet.{canManage && " Add short videos in the Reels / Shorts tab."}</Card>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {reels.slice(0, 4).map((m) => (
              <button key={m.id} onClick={() => onTab("reels")} className="group overflow-hidden rounded-xl border border-line bg-ink-800 text-left">
                <div className="relative aspect-[9/16] w-full" style={m.thumbUrl ? { backgroundImage: `url(${m.thumbUrl})`, backgroundSize: "cover", backgroundPosition: "center" } : undefined}>
                  {!m.thumbUrl && <span className="grid size-full place-items-center text-mist-600"><Film className="size-6" /></span>}
                  <span className="absolute inset-0 grid place-items-center bg-black/20 transition group-hover:bg-black/35">
                    <span className="grid size-8 place-items-center rounded-full bg-white/90 text-ink-900"><Play className="size-4 translate-x-0.5 fill-current" /></span>
                  </span>
                </div>
                <p className="truncate px-2 py-1.5 text-[11px] font-semibold text-mist-200">{m.title}</p>
              </button>
            ))}
          </div>
        )}
      </Section>

      {/* Products preview */}
      <Section title="Products" onViewAll={() => onTab("products")}>
        {products.length === 0 ? (
          <Card className="p-6 text-center text-sm text-mist-500">
            <ShoppingBag className="mx-auto mb-1.5 size-6" /> No products yet.{canManage && " Add them in the Products tab."}
          </Card>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {products.slice(0, 4).map((p) => (
              <Card key={p.id} className="overflow-hidden p-0">
                <div className="aspect-square w-full bg-ink-800">
                  {p.imageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={p.imageUrl} alt={p.name} className="size-full object-cover" />
                  ) : (
                    <div className="grid size-full place-items-center text-mist-600"><ShoppingBag className="size-7" /></div>
                  )}
                </div>
                <div className="p-2">
                  <p className="truncate text-xs font-semibold text-mist-100">{p.name}</p>
                  {p.price && <p className="text-xs font-bold text-lotus-300">{p.price}</p>}
                  {!canManage && <button onClick={() => enquire(p)} className="mt-1 w-full rounded-md bg-lotus-500/15 py-1 text-[10px] font-semibold text-lotus-200 hover:bg-lotus-500/25">Contact seller</button>}
                </div>
              </Card>
            ))}
          </div>
        )}
      </Section>

      {/* Posts feed */}
      <div>
        <h2 className="mb-2 px-1 text-sm font-bold text-mist-200">Latest updates</h2>
        <BusinessPosts businessId={biz.id} canManage={canManage} />
      </div>

      {/* About + contact + social */}
      <div id="biz-about" className="space-y-4 scroll-mt-4">
        {biz.description && (
          <Card className="p-4">
            <h3 className="mb-1.5 text-sm font-bold text-mist-100">About Us</h3>
            <p className="whitespace-pre-wrap text-sm text-mist-300">{biz.description}</p>
          </Card>
        )}
        <Card className="space-y-1 p-2">
          {biz.location && <DetailRow icon={<MapPin className="size-4" />} label="Location" value={biz.location} />}
          {biz.hours && <DetailRow icon={<Clock className="size-4" />} label="Working hours" value={biz.hours} />}
          {biz.phone && <DetailRow icon={<Phone className="size-4" />} label="Phone" value={biz.phone} href={`tel:${biz.phone}`} />}
          {biz.email && <DetailRow icon={<Mail className="size-4" />} label="Email" value={biz.email} href={`mailto:${biz.email}`} />}
          {biz.website && <DetailRow icon={<Globe className="size-4" />} label="Website" value={biz.website.replace(/^https?:\/\//, "")} href={linkify(biz.website)} external />}
          {customFields.map((cf) => <DetailRow key={cf.label} icon={<Info className="size-4" />} label={cf.label} value={cf.value} />)}
          {!biz.location && !biz.hours && !biz.phone && !biz.email && !biz.website && customFields.length === 0 && (
            <p className="px-3 py-2 text-xs text-mist-500">No contact details added yet.</p>
          )}
        </Card>
        {socials.length > 0 && (
          <Card className="p-4">
            <h3 className="mb-2 text-sm font-bold text-mist-100">Social media</h3>
            <div className="flex flex-wrap gap-2">
              {socials.map((s) => (
                <a key={s.label} href={s.href} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 rounded-lg border border-line bg-ink-800 px-3 py-1.5 text-xs font-semibold text-mist-200 hover:bg-ink-700"><span>{s.emoji}</span> {s.label}</a>
              ))}
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}

function Section({ title, onViewAll, children }: { title: string; onViewAll: () => void; children: React.ReactNode }) {
  return (
    <div>
      <div className="mb-2 flex items-center justify-between px-1">
        <h2 className="text-sm font-bold text-mist-200">{title}</h2>
        <button onClick={onViewAll} className="flex items-center gap-0.5 text-xs font-semibold text-lotus-300 hover:text-lotus-200">View All <ChevronRight className="size-3.5" /></button>
      </div>
      {children}
    </div>
  );
}

function linkify(u: string): string {
  return u.startsWith("http") ? u : `https://${u}`;
}

function DetailRow({ icon, label, value, href, external }: { icon: React.ReactNode; label: string; value: string; href?: string; external?: boolean }) {
  const inner = (
    <div className="flex items-center gap-3 rounded-xl px-3 py-2.5 transition-colors hover:bg-white/[0.04]">
      <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-lotus-500/10 text-lotus-300">{icon}</span>
      <div className="min-w-0">
        <p className="text-[11px] text-mist-500">{label}</p>
        <p className="truncate text-sm text-mist-100">{value}</p>
      </div>
    </div>
  );
  if (!href) return inner;
  return external
    ? <a href={href} target="_blank" rel="noopener noreferrer" className="block">{inner}</a>
    : <a href={href} className="block">{inner}</a>;
}
