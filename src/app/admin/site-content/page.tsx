"use client";

import { useEffect, useState } from "react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import { useConfig, saveConfig } from "@/lib/config";
import { DEFAULT_SITE_CONTENT, DEFAULT_HOME_PAGE, type SiteContent, type BlogArticle, type HomePageContent, type HomeFeatureItem } from "@/lib/site-content-default";
import { cn } from "@/lib/cn";
import { FileText, Save, Plus, Trash2, Eye, EyeOff, Newspaper, HelpCircle, Info, Shield, Search, Loader2, Mail, ImagePlus, Home, Film } from "lucide-react";

function applyHomeSelection(f: SiteContent["homeFeature"], selectedId: string): NonNullable<SiteContent["homeFeature"]> {
  const items = f?.items ?? [];
  const selected = items.find((i) => i.id === selectedId);
  return { ...(f ?? {}), items, selectedId: selected?.id ?? "", image: selected?.url ?? "", kind: selected?.kind ?? "image" };
}

/** A picture saved before the list existed is shown as the first list item,
 *  already selected, so it keeps appearing on the home page. */
function withHomeMedia(s: SiteContent): SiteContent {
  const f = s.homeFeature;
  if (!f || (f.items ?? []).length > 0 || !f.image) return s;
  const item: HomeFeatureItem = { id: "current", url: f.image, kind: f.kind === "video" ? "video" : "image", name: "Current" };
  return { ...s, homeFeature: applyHomeSelection({ ...f, items: [item] }, "current") };
}

// Full CMS for the public marketing site — About / FAQ / Disclaimer / Blog / SEO,
// all editable here so no content ever needs a code change (AdSense requirement).
export default function AdminSiteContentPage() {
  const { config, loading, reload } = useConfig();
  const { toast } = useToast();
  const [s, setS] = useState<SiteContent>(DEFAULT_SITE_CONTENT);
  const [saving, setSaving] = useState(false);
  const [uploadingHome, setUploadingHome] = useState(false);
  const [tab, setTab] = useState<"seo" | "about" | "faq" | "disclaimer" | "blog" | "contact" | "home">("blog");

  useEffect(() => { if (!loading) setS(withHomeMedia(config.siteContent ?? DEFAULT_SITE_CONTENT)); }, [loading, config.siteContent]);

  const save = async () => {
    setSaving(true);
    const res = await saveConfig({ siteContent: s });
    setSaving(false);
    if (res.ok) { await reload(); toast("Site content saved — live now.", "success"); }
    else toast(res.error ?? "Could not save", "error");
  };

  // Upload pictures and MP4s through the shared admin uploader, so the config
  // stores short URLs rather than multi-megabyte files (the config is fetched
  // by every client on every load).
  const uploadHomeFeature = async (list?: FileList | null) => {
    const files = list ? Array.from(list) : [];
    if (!files.length) return;
    setUploadingHome(true);
    const added: HomeFeatureItem[] = [];
    for (const file of files) {
      const isVideo = file.type === "video/mp4" || file.name.toLowerCase().endsWith(".mp4");
      if (!isVideo && !file.type.startsWith("image/")) {
        toast(`${file.name} was skipped — use a picture or an MP4 video.`, "error");
        continue;
      }
      try {
        const fd = new FormData();
        fd.append("file", file);
        fd.append("purpose", "home");
        const res = await fetch("/api/admin/tokens", { method: "POST", body: fd, credentials: "include" });
        const d = await res.json().catch(() => ({}));
        if (res.ok && d.url) {
          added.push({ id: `hf_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`, url: d.url as string, kind: isVideo ? "video" : "image", name: file.name });
        } else toast(d.error ?? `Could not upload ${file.name}`, "error");
      } catch { toast(`Could not upload ${file.name}`, "error"); }
    }
    if (added.length) {
      setS((p) => {
        const cur = withHomeMedia(p).homeFeature ?? {};
        const items = [...(cur.items ?? []), ...added];
        return { ...p, homeFeature: applyHomeSelection({ ...cur, items }, items[0]?.id ?? "") };
      });
      toast(added.length === 1 ? "1 file added — press Save content to publish it." : `${added.length} files added — press Save content to publish them.`, "success");
    }
    setUploadingHome(false);
  };

  const removeHomeMedia = (id: string) => {
    setS((p) => {
      const items = (p.homeFeature?.items ?? []).filter((i) => i.id !== id);
      const selectedId = p.homeFeature?.selectedId === id ? "" : (p.homeFeature?.selectedId ?? "");
      return { ...p, homeFeature: applyHomeSelection({ ...p.homeFeature, items }, selectedId) };
    });
  };

  const setPage = (key: "about" | "disclaimer", patch: Record<string, unknown>) =>
    setS((p) => ({ ...p, [key]: { ...(p[key] ?? { title: "", body: "" }), ...patch } }));

  const inp = "w-full rounded-lg border border-line bg-ink-900 px-3 py-2 text-sm text-mist-100 outline-none focus:border-lotus-400";
  const area = cn(inp, "min-h-[16rem] font-mono text-xs leading-relaxed");

  const TABS = [
    { k: "blog" as const, label: "Blog", icon: Newspaper },
    { k: "faq" as const, label: "FAQ", icon: HelpCircle },
    { k: "about" as const, label: "About", icon: Info },
    { k: "disclaimer" as const, label: "Disclaimer", icon: Shield },
    { k: "home" as const, label: "Home Page", icon: Home },
    { k: "seo" as const, label: "SEO & Home", icon: Search },
    { k: "contact" as const, label: "Contact", icon: Mail },
  ];

  return (
    <div className="space-y-5 pb-24">
      <div>
        <h1 className="flex items-center gap-2 font-display text-2xl font-extrabold text-mist-100"><FileText className="size-6 text-lotus-300" /> Site Content</h1>
        <p className="mt-1 text-sm text-mist-400">Manage the public website — <b>Blog articles, FAQ, About, Disclaimer</b> and <b>SEO</b> — with no code changes. Everything here is live on the public pages (linked in the footer) and the sitemap for Google/AdSense. Content bodies accept simple HTML (<code className="text-mist-300">h2, p, ul, li, strong, a</code>).</p>
      </div>

      <div className="flex flex-wrap gap-1.5">
        {TABS.map((t) => (
          <button key={t.k} onClick={() => setTab(t.k)} className={cn("inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold transition", tab === t.k ? "bg-lotus-600 text-white" : "bg-white/[0.05] text-mist-400 hover:bg-white/[0.1]")}>
            <t.icon className="size-3.5" /> {t.label}
          </button>
        ))}
      </div>

      {/* ---------- Blog ---------- */}
      {tab === "blog" && <BlogEditor blog={s.blog ?? []} onChange={(blog) => setS((p) => ({ ...p, blog }))} inp={inp} area={area} />}

      {/* ---------- FAQ ---------- */}
      {tab === "faq" && (
        <Card className="p-5">
          <h2 className="mb-3 font-semibold text-mist-100">FAQ</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block"><span className="mb-1 block text-xs font-semibold text-mist-400">Page title</span><input value={s.faq?.title ?? ""} onChange={(e) => setS((p) => ({ ...p, faq: { ...(p.faq ?? { items: [] }), title: e.target.value } }))} className={inp} /></label>
            <label className="block"><span className="mb-1 block text-xs font-semibold text-mist-400">SEO description</span><input value={s.faq?.seoDesc ?? ""} onChange={(e) => setS((p) => ({ ...p, faq: { ...(p.faq ?? { items: [] }), seoDesc: e.target.value } }))} className={inp} /></label>
          </div>
          <div className="mt-4 space-y-2">
            {(s.faq?.items ?? []).map((it, i) => (
              <div key={i} className="rounded-xl border border-line bg-ink-800/50 p-3">
                <div className="mb-1.5 flex items-center gap-2">
                  <input value={it.q} onChange={(e) => setS((p) => ({ ...p, faq: { ...(p.faq ?? { items: [] }), items: (p.faq?.items ?? []).map((x, j) => j === i ? { ...x, q: e.target.value } : x) } }))} placeholder="Question" className={cn(inp, "font-semibold")} />
                  <button onClick={() => setS((p) => ({ ...p, faq: { ...(p.faq ?? { items: [] }), items: (p.faq?.items ?? []).filter((_, j) => j !== i) } }))} className="grid size-8 shrink-0 place-items-center rounded-lg text-rose-300 hover:bg-rose-500/10"><Trash2 className="size-4" /></button>
                </div>
                <textarea value={it.a} onChange={(e) => setS((p) => ({ ...p, faq: { ...(p.faq ?? { items: [] }), items: (p.faq?.items ?? []).map((x, j) => j === i ? { ...x, a: e.target.value } : x) } }))} placeholder="Answer (HTML allowed)" rows={2} className={cn(inp, "resize-y")} />
              </div>
            ))}
          </div>
          <Button variant="secondary" size="sm" className="mt-3" onClick={() => setS((p) => ({ ...p, faq: { ...(p.faq ?? { items: [] }), items: [...(p.faq?.items ?? []), { q: "New question", a: "Answer" }] } }))}><Plus className="size-4" /> Add question</Button>
        </Card>
      )}

      {/* ---------- About ---------- */}
      {tab === "about" && <PageEditor title="About page" page={s.about} onChange={(patch) => setPage("about", patch)} inp={inp} area={area} />}

      {/* ---------- Disclaimer ---------- */}
      {tab === "disclaimer" && <PageEditor title="Disclaimer page" page={s.disclaimer} onChange={(patch) => setPage("disclaimer", patch)} inp={inp} area={area} />}

      {/* ---------- Home Page ---------- */}
      {tab === "home" && <HomePageEditor value={s.homePage} onChange={(homePage) => setS((p) => ({ ...p, homePage }))} inp={inp} />}

      {/* ---------- SEO & Home ---------- */}
      {tab === "seo" && (
        <Card className="p-5 space-y-3">
          <h2 className="font-semibold text-mist-100">Site SEO</h2>
          <label className="block"><span className="mb-1 block text-xs font-semibold text-mist-400">Site title</span><input value={s.seo?.siteTitle ?? ""} onChange={(e) => setS((p) => ({ ...p, seo: { ...(p.seo ?? {}), siteTitle: e.target.value } }))} className={inp} /></label>
          <label className="block"><span className="mb-1 block text-xs font-semibold text-mist-400">Meta description</span><textarea value={s.seo?.description ?? ""} onChange={(e) => setS((p) => ({ ...p, seo: { ...(p.seo ?? {}), description: e.target.value } }))} rows={2} className={cn(inp, "resize-y")} /></label>
          <label className="block"><span className="mb-1 block text-xs font-semibold text-mist-400">Keywords (comma separated)</span><input value={s.seo?.keywords ?? ""} onChange={(e) => setS((p) => ({ ...p, seo: { ...(p.seo ?? {}), keywords: e.target.value } }))} className={inp} /></label>
          {/* Every picture and MP4 in this list is shown on the user home page. */}
          <div className="border-t border-line/60 pt-3">
            <h3 className="font-semibold text-mist-100">Home page feature media</h3>
            <p className="mt-1 text-xs text-mist-400">
              Upload as many pictures and MP4 videos as you like. All of them are shown, in this order, on the
              home page users see after they sign in. Press <b>Save content</b> to publish the list.
            </p>
            <div className="mt-3 flex flex-wrap items-center gap-3">
              <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-line bg-ink-800 px-3 py-1.5 text-xs font-semibold text-mist-200 hover:border-lotus-400/40">
                {uploadingHome ? <Loader2 className="size-3.5 animate-spin" /> : <ImagePlus className="size-3.5" />}
                Upload pictures or MP4
                <input type="file" accept="image/*,video/mp4" multiple className="hidden" disabled={uploadingHome} onChange={(e) => { uploadHomeFeature(e.target.files); e.target.value = ""; }} />
              </label>
              <p className="text-[11px] text-mist-500">Pictures up to 32 MB. MP4 videos up to 64 MB. A wide picture (about 3:2) works best.</p>
            </div>
            <div className="mt-3 space-y-2">
              {(s.homeFeature?.items ?? []).length === 0 ? (
                <div className="rounded-lg border border-dashed border-line bg-ink-900 px-3 py-6 text-center text-xs text-mist-500">No pictures or videos yet.</div>
              ) : (
                (s.homeFeature?.items ?? []).map((item) => (
                    <div key={item.id} className="flex flex-wrap items-center gap-3 rounded-xl border border-line bg-ink-900/50 p-2.5">
                      {item.kind === "video" ? (
                        <video src={item.url} muted playsInline className="h-16 w-28 shrink-0 rounded-lg bg-black object-cover" />
                      ) : (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={item.url} alt="" className="h-16 w-28 shrink-0 rounded-lg border border-line object-cover" />
                      )}
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5 text-xs font-semibold text-mist-100">
                          {item.kind === "video" ? <Film className="size-3.5 text-sky-300" /> : <ImagePlus className="size-3.5 text-lotus-300" />}
                          <span className="truncate">{item.name || (item.kind === "video" ? "Video" : "Picture")}</span>
                        </div>
                        <p className="mt-0.5 text-[11px] text-mist-500">{item.kind === "video" ? "MP4 video — shown on the user home page" : "Picture — shown on the user home page"}</p>
                      </div>
                      <button type="button" onClick={() => removeHomeMedia(item.id)} className="grid size-8 place-items-center rounded-lg text-rose-300 hover:bg-rose-500/10" title="Remove"><Trash2 className="size-4" /></button>
                    </div>
                  ))
              )}
            </div>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <label className="block">
                <span className="mb-1 block text-xs font-semibold text-mist-400">Description of the picture <span className="text-mist-600">(read aloud by screen readers, and by Google)</span></span>
                <input value={s.homeFeature?.alt ?? ""} onChange={(e) => setS((p) => ({ ...p, homeFeature: { ...(p.homeFeature ?? {}), alt: e.target.value } }))} className={inp} placeholder="e.g. Lotus Ludo is 100% free to play — no betting, no cash prizes" />
              </label>
              <label className="block">
                <span className="mb-1 block text-xs font-semibold text-mist-400">Caption under the picture <span className="text-mist-600">(optional)</span></span>
                <input value={s.homeFeature?.caption ?? ""} onChange={(e) => setS((p) => ({ ...p, homeFeature: { ...(p.homeFeature ?? {}), caption: e.target.value } }))} className={inp} />
              </label>
              <label className="block sm:col-span-2">
                <span className="mb-1 block text-xs font-semibold text-mist-400">Open this page when the picture is tapped <span className="text-mist-600">(optional — e.g. /legal/rules)</span></span>
                <input value={s.homeFeature?.href ?? ""} onChange={(e) => setS((p) => ({ ...p, homeFeature: { ...(p.homeFeature ?? {}), href: e.target.value } }))} className={inp} placeholder="/about" />
              </label>
            </div>
          </div>

          <div className="border-t border-line/60 pt-3">
            <span className="mb-1 block text-xs font-semibold text-mist-400">Homepage intro (extra text shown on the landing page — HTML allowed)</span>
            <textarea value={s.homeIntro ?? ""} onChange={(e) => setS((p) => ({ ...p, homeIntro: e.target.value }))} className={area} />
          </div>

          {/* Search-console ownership. Paste the code, press Save, then press
              Verify in Search Console — no deploy needed. */}
          <div className="border-t border-line/60 pt-3">
            <h3 className="font-semibold text-mist-100">Search engine verification</h3>
            <p className="mt-1 text-xs text-mist-400">
              To connect <b>Google Search Console</b>: open <span className="text-mist-300">search.google.com/search-console</span>, add
              the property <span className="text-mist-300">https://lotusplay.tech</span>, choose <b>HTML tag</b>, and paste ONLY the
              <span className="text-mist-300"> content=&quot;…&quot;</span> value here. Save, then press <b>Verify</b>. Afterwards submit
              <span className="text-mist-300"> https://lotusplay.tech/sitemap.xml</span> under Sitemaps.
            </p>
            <div className="mt-2 grid gap-3 sm:grid-cols-2">
              <label className="block"><span className="mb-1 block text-xs font-semibold text-mist-400">Google verification code</span><input value={s.seo?.googleVerification ?? ""} onChange={(e) => setS((p) => ({ ...p, seo: { ...(p.seo ?? {}), googleVerification: e.target.value.trim() } }))} className={inp} placeholder="e.g. AbCdEf123…" /></label>
              <label className="block"><span className="mb-1 block text-xs font-semibold text-mist-400">Bing verification code (optional)</span><input value={s.seo?.bingVerification ?? ""} onChange={(e) => setS((p) => ({ ...p, seo: { ...(p.seo ?? {}), bingVerification: e.target.value.trim() } }))} className={inp} /></label>
            </div>
            {(s.seo?.googleVerification ?? "").trim() && (
              <p className="mt-2 rounded-lg bg-emerald-500/10 px-3 py-2 text-[11px] text-emerald-200">
                Live on every page as <code>&lt;meta name=&quot;google-site-verification&quot; content=&quot;{(s.seo?.googleVerification ?? "").trim()}&quot;&gt;</code> once saved.
              </p>
            )}
          </div>

          {/* ADSENSE + CUSTOM CODE. Previously the AdSense publisher ID was
              hard-coded in the app, so changing advertising account meant a
              code change and a deploy. All three fields are live config now. */}
          <div className="border-t border-line/60 pt-3">
            <h3 className="font-semibold text-mist-100">Advertising &amp; custom code</h3>
            <p className="mt-1 text-xs text-mist-400">
              Code entered here goes onto <b>every page of the website</b> as soon as you press Save.
              No app update and no developer needed.
            </p>

            {/* --- AdSense --- */}
            <div className="mt-3">
              <span className="mb-1 block text-xs font-semibold text-mist-400">
                Google AdSense publisher ID
              </span>
              <input
                value={s.customCode?.adsenseClient ?? ""}
                onChange={(e) => setS((p) => ({ ...p, customCode: { ...(p.customCode ?? {}), adsenseClient: e.target.value.trim() } }))}
                className={inp}
                placeholder="ca-pub-1234567890123456"
              />
              {(() => {
                const raw = (s.customCode?.adsenseClient ?? "").trim();
                const digits = raw.replace(/[^0-9]/g, "");
                if (!raw) {
                  return (
                    <p className="mt-1.5 text-[11px] text-mist-500">
                      Empty means the site keeps using the publisher ID it shipped with. Enter your own
                      ID here to serve ads under <b>your</b> AdSense account instead.
                    </p>
                  );
                }
                if (digits.length < 10) {
                  return (
                    <p className="mt-1.5 text-[11px] text-amber-300">
                      ⚠ That doesn&apos;t look right. An AdSense publisher ID is <b>ca-pub-</b> followed by
                      about 16 digits. Copy it from AdSense → Account → Settings.
                    </p>
                  );
                }
                return (
                  <p className="mt-1.5 rounded-lg bg-emerald-500/10 px-3 py-2 text-[11px] text-emerald-200">
                    ✓ Will be saved as <code>ca-pub-{digits}</code> and loaded on every page.
                  </p>
                );
              })()}
              <p className="mt-1.5 text-[11px] text-mist-500">
                Remember to update <span className="text-mist-300">/public/ads.txt</span> to match, or AdSense
                will report unauthorised inventory.
              </p>
            </div>

            {/* --- Header code --- */}
            <div className="mt-4">
              <span className="mb-1 block text-xs font-semibold text-mist-400">
                Header code <span className="text-mist-600">— goes inside &lt;head&gt; on every page</span>
              </span>
              <textarea
                value={s.customCode?.headCode ?? ""}
                onChange={(e) => setS((p) => ({ ...p, customCode: { ...(p.customCode ?? {}), headCode: e.target.value } }))}
                className={area}
                spellCheck={false}
                placeholder={"<!-- e.g. Google Analytics, ad network tags, ownership meta tags -->"}
              />
              <p className="mt-1 text-[11px] text-mist-500">
                For anything that must load early: analytics, ad networks, verification tags.
              </p>
            </div>

            {/* --- Footer code --- */}
            <div className="mt-4">
              <span className="mb-1 block text-xs font-semibold text-mist-400">
                Footer code <span className="text-mist-600">— goes at the end of every page</span>
              </span>
              <textarea
                value={s.customCode?.footerCode ?? ""}
                onChange={(e) => setS((p) => ({ ...p, customCode: { ...(p.customCode ?? {}), footerCode: e.target.value } }))}
                className={area}
                spellCheck={false}
                placeholder={"<!-- e.g. live chat widget, tracking pixel -->"}
              />
              <p className="mt-1 text-[11px] text-mist-500">
                For anything that can load last: chat widgets, tracking pixels. Slow scripts here cannot
                hold up the app.
              </p>
            </div>

            <div className="mt-3 rounded-lg border border-amber-400/25 bg-amber-500/[0.07] px-3 py-2.5 text-[11px] leading-relaxed text-mist-300">
              <b className="text-amber-200">Paste code exactly as the provider gave it.</b> These two boxes are
              placed on the page word for word — that is what makes ad and analytics tags work, and it also
              means a missing <code>&lt;/script&gt;</code> can break every page on the site. Paste, Save, then
              open the website in a new tab and check it still loads. If something goes wrong, clear the box
              and Save again — the site recovers immediately.
            </div>
          </div>
        </Card>
      )}

      {/* ---------- Contact & business details ---------- */}
      {tab === "contact" && (
        <Card className="p-5 space-y-3">
          <h2 className="font-semibold text-mist-100">Contact &amp; business details</h2>
          <p className="text-xs text-mist-400">
            These appear on the public <b>Contact</b> page and in the <b>Privacy Policy</b>.
            <b className="text-amber-300"> They must be genuine</b> — the IT Rules 2021 require a named
            grievance officer with a working address, and ad networks check these details when they
            review a site. Leave a field blank and it is simply not shown (better than a placeholder).
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block"><span className="mb-1 block text-xs font-semibold text-mist-400">Brand name (shown to users)</span><input value={s.contact?.brandName ?? ""} onChange={(e) => setS((p) => ({ ...p, contact: { ...(p.contact ?? {}), brandName: e.target.value } }))} className={inp} placeholder="Lotus Ludo" /></label>
            <label className="block"><span className="mb-1 block text-xs font-semibold text-mist-400">Registered / legal name</span><input value={s.contact?.legalName ?? ""} onChange={(e) => setS((p) => ({ ...p, contact: { ...(p.contact ?? {}), legalName: e.target.value } }))} className={inp} placeholder="e.g. Lotus Networks LLC" /></label>
          </div>
          <label className="block"><span className="mb-1 block text-xs font-semibold text-mist-400">Registered business address</span><textarea rows={3} value={s.contact?.address ?? ""} onChange={(e) => setS((p) => ({ ...p, contact: { ...(p.contact ?? {}), address: e.target.value } }))} className={cn(inp, "resize-y")} placeholder="Street, city, region, postcode, country" /></label>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block"><span className="mb-1 block text-xs font-semibold text-mist-400">Support email</span><input value={s.contact?.supportEmail ?? ""} onChange={(e) => setS((p) => ({ ...p, contact: { ...(p.contact ?? {}), supportEmail: e.target.value.trim() } }))} className={inp} /></label>
            <label className="block"><span className="mb-1 block text-xs font-semibold text-mist-400">Privacy / data-request email</span><input value={s.contact?.privacyEmail ?? ""} onChange={(e) => setS((p) => ({ ...p, contact: { ...(p.contact ?? {}), privacyEmail: e.target.value.trim() } }))} className={inp} /></label>
            <label className="block"><span className="mb-1 block text-xs font-semibold text-mist-400">Grievance officer name</span><input value={s.contact?.grievanceName ?? ""} onChange={(e) => setS((p) => ({ ...p, contact: { ...(p.contact ?? {}), grievanceName: e.target.value } }))} className={inp} placeholder="A real named person" /></label>
            <label className="block"><span className="mb-1 block text-xs font-semibold text-mist-400">Grievance email</span><input value={s.contact?.grievanceEmail ?? ""} onChange={(e) => setS((p) => ({ ...p, contact: { ...(p.contact ?? {}), grievanceEmail: e.target.value.trim() } }))} className={inp} /></label>
            <label className="block"><span className="mb-1 block text-xs font-semibold text-mist-400">Phone (optional)</span><input value={s.contact?.phone ?? ""} onChange={(e) => setS((p) => ({ ...p, contact: { ...(p.contact ?? {}), phone: e.target.value } }))} className={inp} /></label>
            <label className="block"><span className="mb-1 block text-xs font-semibold text-mist-400">Support hours (optional)</span><input value={s.contact?.hours ?? ""} onChange={(e) => setS((p) => ({ ...p, contact: { ...(p.contact ?? {}), hours: e.target.value } }))} className={inp} placeholder="Sunday–Thursday, 9am–6pm (AST)" /></label>
            <label className="block"><span className="mb-1 block text-xs font-semibold text-mist-400">Acknowledge within (hours)</span><input type="number" min={1} max={720} value={s.contact?.ackHours ?? 24} onChange={(e) => setS((p) => ({ ...p, contact: { ...(p.contact ?? {}), ackHours: Math.max(1, Math.min(720, Math.floor(Number(e.target.value) || 24))) } }))} className={inp} /></label>
            <label className="block"><span className="mb-1 block text-xs font-semibold text-mist-400">Aim to resolve within (days)</span><input type="number" min={1} max={365} value={s.contact?.resolveDays ?? 15} onChange={(e) => setS((p) => ({ ...p, contact: { ...(p.contact ?? {}), resolveDays: Math.max(1, Math.min(365, Math.floor(Number(e.target.value) || 15))) } }))} className={inp} /></label>
          </div>
          {(!(s.contact?.grievanceName ?? "").trim() || !(s.contact?.address ?? "").trim()) && (
            <p className="rounded-lg bg-amber-500/10 px-3 py-2 text-[11px] text-amber-200">
              <b>Still to fill in:</b>{" "}
              {[!(s.contact?.grievanceName ?? "").trim() && "grievance officer name", !(s.contact?.address ?? "").trim() && "registered business address"].filter(Boolean).join(" and ")}.
              Until these are set they are hidden from the public pages rather than shown as placeholders — but they are legally required, so please add them.
            </p>
          )}
          <p className="text-[11px] text-mist-500">Messages sent through the public contact form arrive in <b>Admin → Support</b>.</p>
        </Card>
      )}

      {/* Sticky save */}
      <div className="fixed inset-x-0 bottom-0 z-20 border-t border-line bg-ink-900/95 px-4 py-3 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3">
          <span className="text-xs text-mist-400">Changes go live on the public site + sitemap after you save.</span>
          <Button onClick={save} disabled={saving || loading}>{saving ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />} Save content</Button>
        </div>
      </div>
    </div>
  );
}

/**
 * EVERY BLOCK OF WORDS ON THE PUBLIC HOME PAGE, top to bottom in the order a
 * visitor meets them, so the form reads like the page it edits.
 *
 * Only text is exposed. Icons, colours, the animated dice and the layout stay in
 * code — those are design, and a text box is the wrong place to change them.
 * Every field left blank falls back to the original wording, so it is impossible
 * to accidentally empty a heading.
 */
function HomePageEditor({ value, onChange, inp }: { value?: HomePageContent; onChange: (v: HomePageContent) => void; inp: string }) {
  const D = DEFAULT_HOME_PAGE;
  const v = value ?? {};
  // Patch one section without disturbing the others.
  const set = <K extends keyof HomePageContent>(k: K, patch: Partial<NonNullable<HomePageContent[K]>>) =>
    onChange({ ...v, [k]: { ...(v[k] ?? {}), ...patch } } as HomePageContent);

  const F = ({ label, val, ph, on, wide = false, rows = 0 }: { label: string; val?: string; ph?: string; on: (s: string) => void; wide?: boolean; rows?: number }) => (
    <label className={cn("block", wide && "sm:col-span-2")}>
      <span className="mb-1 block text-xs font-semibold text-mist-400">{label}</span>
      {rows > 0
        ? <textarea value={val ?? ""} onChange={(e) => on(e.target.value)} rows={rows} placeholder={ph} className={cn(inp, "resize-y")} />
        : <input value={val ?? ""} onChange={(e) => on(e.target.value)} placeholder={ph} className={inp} />}
    </label>
  );

  const Section = ({ n, title, hint, children }: { n: string; title: string; hint: string; children: React.ReactNode }) => (
    <Card className="p-5">
      <div className="mb-3 flex items-baseline gap-2.5">
        <span className="rounded-md bg-lotus-500/15 px-2 py-0.5 font-mono text-[11px] font-bold text-lotus-300">{n}</span>
        <div>
          <h2 className="font-semibold text-mist-100">{title}</h2>
          <p className="text-xs text-mist-500">{hint}</p>
        </div>
      </div>
      {children}
    </Card>
  );

  /** A repeating list of cards / stats / steps, with add + remove. */
  const List = <T,>({ items, fallback, onSet, cap, blank, render, addLabel }: {
    items?: T[]; fallback: T[]; onSet: (rows: T[]) => void; cap: number; blank: T;
    render: (row: T, upd: (patch: Partial<T>) => void) => React.ReactNode; addLabel: string;
  }) => {
    const rows = (items && items.length ? items : fallback) as T[];
    return (
      <>
        <div className="space-y-2">
          {rows.map((row, i) => (
            <div key={i} className="flex items-start gap-2 rounded-xl border border-line bg-ink-800/40 p-3">
              <span className="mt-2 w-5 shrink-0 text-center font-mono text-[11px] text-mist-600">{i + 1}</span>
              <div className="min-w-0 flex-1">{render(row, (patch) => onSet(rows.map((r, j) => (j === i ? { ...r, ...patch } : r))))}</div>
              <button
                onClick={() => onSet(rows.filter((_, j) => j !== i))}
                title="Remove"
                className="mt-1 grid size-8 shrink-0 place-items-center rounded-lg text-rose-300 hover:bg-rose-500/10"
              >
                <Trash2 className="size-4" />
              </button>
            </div>
          ))}
        </div>
        {rows.length < cap && (
          <Button variant="secondary" size="sm" className="mt-3" onClick={() => onSet([...rows, blank])}>
            <Plus className="size-4" /> {addLabel}
          </Button>
        )}
      </>
    );
  };

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-lotus-400/25 bg-lotus-500/[0.07] px-4 py-3 text-xs text-mist-300">
        This edits <b className="text-mist-100">every word on lotusplay.tech</b>, from the headline down to the
        last button — top to bottom, in the order visitors see them. Pictures, icons and colours are part of
        the design and stay as they are. <b className="text-mist-100">Leave any box empty and the original
        wording comes back</b>, so nothing can end up blank. Press <b className="text-mist-100">Save content</b> at the
        bottom, then reload the home page.
      </div>

      <Section n="01" title="Headline (the first screen)" hint="The badge, the big title and the buttons a visitor sees before scrolling.">
        <div className="grid gap-3 sm:grid-cols-2">
          <F label="Small badge above the title" val={v.hero?.badge} ph={D.hero.badge} on={(x) => set("hero", { badge: x })} wide />
          <F label="Title — first line (purple/pink)" val={v.hero?.titleA} ph={D.hero.titleA} on={(x) => set("hero", { titleA: x })} />
          <F label="Title — second line (white)" val={v.hero?.titleB} ph={D.hero.titleB} on={(x) => set("hero", { titleB: x })} />
          <F label="Title — last words (gold)" val={v.hero?.titleC} ph={D.hero.titleC} on={(x) => set("hero", { titleC: x })} />
          <div className="hidden sm:block" />
          <F label="Paragraph under the title" val={v.hero?.subtitle} ph={D.hero.subtitle} on={(x) => set("hero", { subtitle: x })} wide rows={3} />
          <F label="Main button — text" val={v.hero?.primaryLabel} ph={D.hero.primaryLabel} on={(x) => set("hero", { primaryLabel: x })} />
          <F label="Main button — page it opens" val={v.hero?.primaryHref} ph={D.hero.primaryHref} on={(x) => set("hero", { primaryHref: x })} />
          <F label="Second button — text" val={v.hero?.secondaryLabel} ph={D.hero.secondaryLabel} on={(x) => set("hero", { secondaryLabel: x })} />
          <F label="Second button — page it opens" val={v.hero?.secondaryHref} ph={D.hero.secondaryHref} on={(x) => set("hero", { secondaryHref: x })} />
          <F label="Install button — text" val={v.hero?.installLabel} ph={D.hero.installLabel} on={(x) => set("hero", { installLabel: x })} />
        </div>
        <p className="mb-2 mt-4 text-xs font-semibold text-mist-400">The four numbers under the buttons</p>
        <List
          items={v.hero?.stats} fallback={D.hero.stats!} cap={8} blank={{ value: "0", label: "New" }}
          onSet={(stats) => set("hero", { stats })} addLabel="Add a number"
          render={(row, upd) => (
            <div className="grid gap-2 sm:grid-cols-2">
              <input value={row.value ?? ""} onChange={(e) => upd({ value: e.target.value })} placeholder="12K+" className={cn(inp, "font-bold")} />
              <input value={row.label ?? ""} onChange={(e) => upd({ label: e.target.value })} placeholder="Players" className={inp} />
            </div>
          )}
        />
      </Section>

      <Section n="02" title="“Everything you love, in one place”" hint="The four cards under the headline.">
        <div className="grid gap-3 sm:grid-cols-2">
          <F label="Small line above the title" val={v.pillars?.eyebrow} ph={D.pillars.eyebrow} on={(x) => set("pillars", { eyebrow: x })} />
          <F label="Section title" val={v.pillars?.title} ph={D.pillars.title} on={(x) => set("pillars", { title: x })} />
          <F label="Line under the title" val={v.pillars?.subtitle} ph={D.pillars.subtitle} on={(x) => set("pillars", { subtitle: x })} wide rows={2} />
        </div>
        <p className="mb-2 mt-4 text-xs font-semibold text-mist-400">The cards</p>
        <List
          items={v.pillars?.cards} fallback={D.pillars.cards!} cap={12} blank={{ title: "New card", text: "Describe it here." }}
          onSet={(cards) => set("pillars", { cards })} addLabel="Add a card"
          render={(row, upd) => (
            <div className="space-y-2">
              <input value={row.title ?? ""} onChange={(e) => upd({ title: e.target.value })} placeholder="Card title" className={cn(inp, "font-semibold")} />
              <textarea value={row.text ?? ""} onChange={(e) => upd({ text: e.target.value })} rows={2} placeholder="Card text" className={cn(inp, "resize-y")} />
            </div>
          )}
        />
      </Section>

      <Section n="03" title="“Ludo &amp; Chess, better with friends”" hint="The games panel, with its tick-list.">
        <div className="grid gap-3 sm:grid-cols-2">
          <F label="Small badge" val={v.games?.badge} ph={D.games.badge} on={(x) => set("games", { badge: x })} />
          <div className="hidden sm:block" />
          <F label="Title — first line" val={v.games?.titleA} ph={D.games.titleA} on={(x) => set("games", { titleA: x })} />
          <F label="Title — second line" val={v.games?.titleB} ph={D.games.titleB} on={(x) => set("games", { titleB: x })} />
          <F label="Paragraph" val={v.games?.text} ph={D.games.text} on={(x) => set("games", { text: x })} wide rows={3} />
          <F label="Button — text" val={v.games?.buttonLabel} ph={D.games.buttonLabel} on={(x) => set("games", { buttonLabel: x })} />
          <F label="Button — page it opens" val={v.games?.buttonHref} ph={D.games.buttonHref} on={(x) => set("games", { buttonHref: x })} />
        </div>
        {/* Plain strings, not cards — so this one has its own small editor
            rather than bending the object-based list above out of shape. */}
        <p className="mb-2 mt-4 text-xs font-semibold text-mist-400">The tick-list</p>
        {(() => {
          const rows = v.games?.bullets?.length ? v.games.bullets : D.games.bullets!;
          return (
            <>
              <div className="space-y-2">
                {rows.map((b, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <span className="w-5 shrink-0 text-center font-mono text-[11px] text-mist-600">{i + 1}</span>
                    <input
                      value={b}
                      onChange={(e) => set("games", { bullets: rows.map((r, j) => (j === i ? e.target.value : r)) })}
                      placeholder="A short point"
                      className={inp}
                    />
                    <button
                      onClick={() => set("games", { bullets: rows.filter((_, j) => j !== i) })}
                      title="Remove"
                      className="grid size-8 shrink-0 place-items-center rounded-lg text-rose-300 hover:bg-rose-500/10"
                    >
                      <Trash2 className="size-4" />
                    </button>
                  </div>
                ))}
              </div>
              {rows.length < 12 && (
                <Button variant="secondary" size="sm" className="mt-3" onClick={() => set("games", { bullets: [...rows, "New point"] })}>
                  <Plus className="size-4" /> Add a point
                </Button>
              )}
            </>
          );
        })()}
      </Section>

      <Section n="04" title="“Powerful features, beautifully simple”" hint="The six feature cards.">
        <div className="grid gap-3 sm:grid-cols-2">
          <F label="Small line above the title" val={v.features?.eyebrow} ph={D.features.eyebrow} on={(x) => set("features", { eyebrow: x })} />
          <F label="Section title" val={v.features?.title} ph={D.features.title} on={(x) => set("features", { title: x })} />
          <F label="Line under the title" val={v.features?.subtitle} ph={D.features.subtitle} on={(x) => set("features", { subtitle: x })} wide rows={2} />
        </div>
        <p className="mb-2 mt-4 text-xs font-semibold text-mist-400">The cards</p>
        <List
          items={v.features?.cards} fallback={D.features.cards!} cap={12} blank={{ title: "New feature", text: "Describe it here." }}
          onSet={(cards) => set("features", { cards })} addLabel="Add a feature"
          render={(row, upd) => (
            <div className="space-y-2">
              <input value={row.title ?? ""} onChange={(e) => upd({ title: e.target.value })} placeholder="Feature title" className={cn(inp, "font-semibold")} />
              <textarea value={row.text ?? ""} onChange={(e) => upd({ text: e.target.value })} rows={2} placeholder="Feature text" className={cn(inp, "resize-y")} />
            </div>
          )}
        />
      </Section>

      <Section n="05" title="“Your journey” steps" hint="The numbered how-it-works steps.">
        <div className="grid gap-3 sm:grid-cols-2">
          <F label="Small line above the title" val={v.journey?.eyebrow} ph={D.journey.eyebrow} on={(x) => set("journey", { eyebrow: x })} />
          <F label="Section title" val={v.journey?.title} ph={D.journey.title} on={(x) => set("journey", { title: x })} />
        </div>
        <p className="mb-2 mt-4 text-xs font-semibold text-mist-400">The steps</p>
        <List
          items={v.journey?.steps} fallback={D.journey.steps!} cap={8} blank={{ num: "05", title: "New step", text: "What happens here." }}
          onSet={(steps) => set("journey", { steps })} addLabel="Add a step"
          render={(row, upd) => (
            <div className="space-y-2">
              <div className="grid gap-2 sm:grid-cols-[5rem_1fr]">
                <input value={row.num ?? ""} onChange={(e) => upd({ num: e.target.value })} placeholder="01" className={cn(inp, "text-center font-mono")} />
                <input value={row.title ?? ""} onChange={(e) => upd({ title: e.target.value })} placeholder="Step title" className={cn(inp, "font-semibold")} />
              </div>
              <textarea value={row.text ?? ""} onChange={(e) => upd({ text: e.target.value })} rows={2} placeholder="Step text" className={cn(inp, "resize-y")} />
            </div>
          )}
        />
      </Section>

      <Section n="06" title="“Ready to join the community?”" hint="The last panel before the footer.">
        <div className="grid gap-3 sm:grid-cols-2">
          <F label="Title" val={v.cta?.title} ph={D.cta.title} on={(x) => set("cta", { title: x })} wide />
          <F label="Paragraph" val={v.cta?.text} ph={D.cta.text} on={(x) => set("cta", { text: x })} wide rows={2} />
          <F label="Button — text" val={v.cta?.buttonLabel} ph={D.cta.buttonLabel} on={(x) => set("cta", { buttonLabel: x })} />
          <F label="Button — page it opens" val={v.cta?.buttonHref} ph={D.cta.buttonHref} on={(x) => set("cta", { buttonHref: x })} />
        </div>
      </Section>

      <div className="rounded-xl border border-line bg-ink-800/40 px-4 py-3 text-xs text-mist-400">
        Want to start over? Clear a box to bring back its original wording, or clear a whole list and press
        Save to restore the built-in cards.
      </div>
    </div>
  );
}

function PageEditor({ title, page, onChange, inp, area }: { title: string; page?: { title: string; body: string; seoTitle?: string; seoDesc?: string; published?: boolean }; onChange: (patch: Record<string, unknown>) => void; inp: string; area: string }) {
  const p = page ?? { title: "", body: "", published: true };
  return (
    <Card className="p-5 space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold text-mist-100">{title}</h2>
        <button onClick={() => onChange({ published: p.published === false })} className={cn("inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-white", p.published !== false ? "bg-emerald-500" : "bg-mist-600")}>{p.published !== false ? <><Eye className="size-4" /> Published</> : <><EyeOff className="size-4" /> Hidden</>}</button>
      </div>
      <label className="block"><span className="mb-1 block text-xs font-semibold text-mist-400">Title</span><input value={p.title} onChange={(e) => onChange({ title: e.target.value })} className={inp} /></label>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block"><span className="mb-1 block text-xs font-semibold text-mist-400">SEO title</span><input value={p.seoTitle ?? ""} onChange={(e) => onChange({ seoTitle: e.target.value })} className={inp} /></label>
        <label className="block"><span className="mb-1 block text-xs font-semibold text-mist-400">SEO description</span><input value={p.seoDesc ?? ""} onChange={(e) => onChange({ seoDesc: e.target.value })} className={inp} /></label>
      </div>
      <label className="block"><span className="mb-1 block text-xs font-semibold text-mist-400">Body (HTML — h1/h2/p/ul/li/strong/a)</span><textarea value={p.body} onChange={(e) => onChange({ body: e.target.value })} className={area} /></label>
    </Card>
  );
}

function BlogEditor({ blog, onChange, inp, area }: { blog: BlogArticle[]; onChange: (b: BlogArticle[]) => void; inp: string; area: string }) {
  const [open, setOpen] = useState<string | null>(blog[0]?.id ?? null);
  const upd = (id: string, patch: Partial<BlogArticle>) => onChange(blog.map((b) => (b.id === id ? { ...b, ...patch } : b)));
  const add = () => {
    const id = `b_${Date.now().toString(36)}`;
    onChange([{ id, slug: "", title: "New article", excerpt: "", body: "<p>Write your article here…</p>", author: "Lotus Ludo Team", date: new Date().toISOString(), published: false }, ...blog]);
    setOpen(id);
  };
  const slugify = (t: string) => t.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 80);
  return (
    <Card className="p-5">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="font-semibold text-mist-100">Blog articles <span className="font-normal text-mist-500">({blog.length})</span></h2>
        <Button variant="secondary" size="sm" onClick={add}><Plus className="size-4" /> New article</Button>
      </div>
      <div className="space-y-2">
        {blog.map((b) => (
          <div key={b.id} className="rounded-xl border border-line bg-ink-800/50">
            <button onClick={() => setOpen(open === b.id ? null : b.id)} className="flex w-full items-center gap-2 px-3 py-2.5 text-left">
              <span className={cn("size-2 shrink-0 rounded-full", b.published ? "bg-emerald-400" : "bg-mist-500")} />
              <span className="min-w-0 flex-1 truncate text-sm font-semibold text-mist-100">{b.title}</span>
              <span className="shrink-0 font-mono text-[10px] text-mist-500">/blog/{b.slug || slugify(b.title)}</span>
            </button>
            {open === b.id && (
              <div className="space-y-3 border-t border-line/60 p-3">
                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="block"><span className="mb-1 block text-xs font-semibold text-mist-400">Title</span><input value={b.title} onChange={(e) => upd(b.id, { title: e.target.value })} className={inp} /></label>
                  <label className="block"><span className="mb-1 block text-xs font-semibold text-mist-400">Slug (URL)</span><input value={b.slug} onChange={(e) => upd(b.id, { slug: slugify(e.target.value) })} placeholder={slugify(b.title)} className={cn(inp, "font-mono")} /></label>
                </div>
                <label className="block"><span className="mb-1 block text-xs font-semibold text-mist-400">Excerpt (shown on the blog list)</span><input value={b.excerpt} onChange={(e) => upd(b.id, { excerpt: e.target.value })} className={inp} /></label>
                <div className="grid gap-3 sm:grid-cols-3">
                  <label className="block"><span className="mb-1 block text-xs font-semibold text-mist-400">Author</span><input value={b.author ?? ""} onChange={(e) => upd(b.id, { author: e.target.value })} className={inp} /></label>
                  <label className="block"><span className="mb-1 block text-xs font-semibold text-mist-400">Date</span><input type="date" value={(b.date || "").slice(0, 10)} onChange={(e) => upd(b.id, { date: e.target.value ? new Date(e.target.value).toISOString() : b.date })} className={inp} /></label>
                  <label className="block"><span className="mb-1 block text-xs font-semibold text-mist-400">Cover image URL</span><input value={b.cover ?? ""} onChange={(e) => upd(b.id, { cover: e.target.value })} className={inp} /></label>
                </div>
                <label className="block"><span className="mb-1 block text-xs font-semibold text-mist-400">Body (HTML)</span><textarea value={b.body} onChange={(e) => upd(b.id, { body: e.target.value })} className={area} /></label>
                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="block"><span className="mb-1 block text-xs font-semibold text-mist-400">SEO title</span><input value={b.seoTitle ?? ""} onChange={(e) => upd(b.id, { seoTitle: e.target.value })} className={inp} /></label>
                  <label className="block"><span className="mb-1 block text-xs font-semibold text-mist-400">SEO description</span><input value={b.seoDesc ?? ""} onChange={(e) => upd(b.id, { seoDesc: e.target.value })} className={inp} /></label>
                </div>
                <div className="flex items-center justify-between">
                  <button onClick={() => upd(b.id, { published: !b.published })} className={cn("inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-white", b.published ? "bg-emerald-500" : "bg-mist-600")}>{b.published ? <><Eye className="size-4" /> Published</> : <><EyeOff className="size-4" /> Draft</>}</button>
                  <button onClick={() => { if (confirm("Delete this article?")) onChange(blog.filter((x) => x.id !== b.id)); }} className="inline-flex items-center gap-1 rounded-lg bg-rose-500/10 px-2.5 py-1.5 text-xs font-semibold text-rose-300 hover:bg-rose-500/20"><Trash2 className="size-3.5" /> Delete</button>
                </div>
              </div>
            )}
          </div>
        ))}
        {blog.length === 0 && <p className="rounded-xl border border-line bg-ink-800/50 px-3 py-6 text-center text-sm text-mist-500">No articles yet — add one.</p>}
      </div>
    </Card>
  );
}
