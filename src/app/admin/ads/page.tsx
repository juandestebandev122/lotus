"use client";

import { useEffect, useRef, useState } from "react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import { useConfig, saveConfig, type AdItem } from "@/lib/config";
import { withBase } from "@/lib/base-path";
import { cn } from "@/lib/cn";
import { Megaphone, Plus, Trash2, Check, Eye, MousePointerClick, Upload, Loader2, AlertTriangle } from "lucide-react";

const POSITIONS: AdItem["position"][] = ["top", "sidebar", "feed", "interstitial", "gameTop"];
const POSITION_LABEL: Record<AdItem["position"], string> = { top: "Top banner", sidebar: "Sidebar", feed: "In feed", interstitial: "Interstitial (full)", gameTop: "Game screen — top" };

export default function AdminAdsPage() {
  const { config, loading, reload } = useConfig();
  const { toast } = useToast();
  const [ads, setAds] = useState<AdItem[]>(config.ads);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!loading) setAds(config.ads);
  }, [loading, config]);

  const update = (id: string, patch: Partial<AdItem>) =>
    setAds((a) => a.map((x) => (x.id === id ? { ...x, ...patch } : x)));

  // Upload a banner image (reuses the admin image-upload endpoint). The returned
  // URL is stored as the ad's imageUrl.
  const [uploadingId, setUploadingId] = useState<string | null>(null);
  const fileRefs = useRef<Record<string, HTMLInputElement | null>>({});
  const uploadImage = async (id: string, file: File) => {
    if (!file.type.startsWith("image/")) { toast("Please choose an image file", "error"); return; }
    setUploadingId(id);
    const fd = new FormData();
    fd.append("file", file);
    try {
      const res = await fetch(withBase("/api/admin/tokens"), { method: "POST", body: fd, credentials: "include" });
      const d = await res.json();
      if (res.ok && d.url) { update(id, { imageUrl: d.url as string }); toast("Image uploaded — press Save to apply.", "success"); }
      else toast(d.error ?? "Upload failed", "error");
    } catch { toast("Upload failed", "error"); }
    setUploadingId(null);
  };

  const add = () =>
    setAds((a) => [
      ...a,
      // Starts SWITCHED OFF on purpose. An advertisement with no picture cannot
      // render, so creating it "active" produced an ad that looked live in the
      // panel while showing nothing to anyone. Add a picture, then switch it on.
      { id: `ad_${a.length + 1}_${Date.now().toString(36)}`, title: "New advertisement", imageUrl: "", linkUrl: "", position: "top", active: false, impressions: 0, clicks: 0 },
    ]);

  const remove = (id: string) => setAds((a) => a.filter((x) => x.id !== id));

  /** Ads switched ON that have no picture — they cannot render, so they would
   *  sit "active" while showing nothing at all. */
  const activeWithoutImage = ads.filter((a) => a.active && !(a.imageUrl ?? "").trim());

  const save = async () => {
    // Say it plainly instead of saving something that silently does nothing.
    if (activeWithoutImage.length) {
      toast(
        `“${activeWithoutImage[0].title}” is switched ON but has no picture, so it cannot appear anywhere. Upload an image or switch it off.`,
        "error",
      );
      return;
    }
    setSaving(true);
    const res = await saveConfig({ ads });
    setSaving(false);
    if (res.ok) {
      await reload();
      toast("Advertisements saved", "success");
    } else {
      toast(res.error ?? "Could not save", "error");
    }
  };

  const field = "w-full rounded-lg border border-line bg-ink-900 px-3 py-2 text-sm text-mist-100 outline-none focus:border-lotus-400";
  const ctr = (a: AdItem) => (a.impressions ? Math.round((a.clicks / a.impressions) * 100) : 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-extrabold text-mist-100">Advertisement management</h1>
          <p className="text-sm text-mist-400">Add banners, choose where they appear, and track performance.</p>
        </div>
        <Button variant="secondary" onClick={add}>
          <Plus className="size-4" /> New advert
        </Button>
      </div>

      <div className="space-y-4">
        {ads.map((a) => (
          <Card key={a.id} className={cn("p-5", !a.active && "opacity-60")}>
            {/* An ad switched ON with no picture renders NOTHING. Say so on the
                card, so it can't quietly look like it is running. */}
            {a.active && !(a.imageUrl ?? "").trim() && (
              <div className="mb-3 flex flex-wrap items-center gap-2 rounded-lg border border-rose-400/40 bg-rose-500/10 px-3 py-2 text-xs text-rose-100">
                <AlertTriangle className="size-4 shrink-0 text-rose-300" />
                <span className="min-w-0 flex-1">
                  <b>Switched on, but nothing will show.</b> This advert has no picture, so members see nothing. Upload an image, or switch it off.
                </span>
                <button
                  onClick={() => fileRefs.current[a.id]?.click()}
                  className="shrink-0 rounded-lg bg-rose-500/25 px-2.5 py-1 font-bold text-rose-50 hover:bg-rose-500/40"
                >
                  Upload image
                </button>
              </div>
            )}
            <div className="flex flex-wrap gap-4">
              {/* Preview + upload */}
              <div className="shrink-0">
                <div className="grid h-24 w-40 place-items-center overflow-hidden rounded-xl border border-line bg-ink-900">
                  {a.imageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={withBase(a.imageUrl)} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <span className="flex flex-col items-center gap-1 text-mist-500">
                      <Megaphone className="size-6" />
                      <span className="text-[10px]">No image</span>
                    </span>
                  )}
                </div>
                <input ref={(el) => { fileRefs.current[a.id] = el; }} type="file" accept="image/*" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadImage(a.id, f); e.target.value = ""; }} />
                <button onClick={() => fileRefs.current[a.id]?.click()} disabled={uploadingId === a.id} className="mt-1.5 inline-flex w-40 items-center justify-center gap-1.5 rounded-lg border border-line bg-ink-800 px-2 py-1.5 text-xs font-semibold text-mist-200 hover:border-lotus-400/50 disabled:opacity-50">
                  {uploadingId === a.id ? <Loader2 className="size-3.5 animate-spin" /> : <Upload className="size-3.5" />} {a.imageUrl ? "Change image" : "Upload image"}
                </button>
              </div>

              {/* Fields */}
              <div className="min-w-0 flex-1 space-y-2">
                <input value={a.title} onChange={(e) => update(a.id, { title: e.target.value })} placeholder="Advert title" className={field} />
                <div className="grid gap-2 sm:grid-cols-2">
                  <input value={a.imageUrl} onChange={(e) => update(a.id, { imageUrl: e.target.value })} placeholder="Image URL or upload →" className={field} />
                  <input value={a.linkUrl} onChange={(e) => update(a.id, { linkUrl: e.target.value })} placeholder="Click link (/rewards or https://…)" className={field} />
                </div>
                <div className="grid gap-2 sm:grid-cols-2">
                  <input value={a.text ?? ""} onChange={(e) => update(a.id, { text: e.target.value })} placeholder="Running text — scrolls on the game screen (optional)" className={field} />
                  <input type="number" value={a.priority ?? 0} onChange={(e) => update(a.id, { priority: Math.floor(Number(e.target.value) || 0) })} placeholder="Priority (higher shows first)" className={field} />
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <select value={a.position} onChange={(e) => update(a.id, { position: e.target.value as AdItem["position"] })} className={cn(field, "w-auto")}>
                    {POSITIONS.map((p) => (
                      <option key={p} value={p}>{POSITION_LABEL[p]}</option>
                    ))}
                  </select>
                  <button
                    onClick={() => update(a.id, { active: !a.active })}
                    className={cn("inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold", a.active ? "bg-emerald-500/15 text-emerald-300" : "bg-white/[0.06] text-mist-400")}
                  >
                    {a.active ? "Active" : "Paused"}
                  </button>
                  <span className="inline-flex items-center gap-1 text-xs text-mist-400"><Eye className="size-3.5" /> {a.impressions.toLocaleString("en-SA")}</span>
                  <span className="inline-flex items-center gap-1 text-xs text-mist-400"><MousePointerClick className="size-3.5" /> {a.clicks.toLocaleString("en-SA")} ({ctr(a)}% CTR)</span>
                  <button onClick={() => remove(a.id)} className="ml-auto grid size-8 place-items-center rounded-lg text-mist-400 hover:bg-rose-500/15 hover:text-rose-300">
                    <Trash2 className="size-4" />
                  </button>
                </div>
              </div>
            </div>
          </Card>
        ))}
        {ads.length === 0 && (
          <Card className="p-10 text-center text-sm text-mist-500">No advertisements yet — add one above.</Card>
        )}
      </div>

      <Button size="lg" onClick={save} disabled={saving || loading}>
        <Check className="size-4" /> {saving ? "Saving…" : "Save advertisements"}
      </Button>
    </div>
  );
}
