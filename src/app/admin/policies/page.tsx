"use client";

import { useEffect, useState } from "react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import { useConfig, saveConfig } from "@/lib/config";
import { cn } from "@/lib/cn";
import { withBase } from "@/lib/base-path";
import { LEGAL_DOCS, LEGAL_FORMAT_HELP } from "@/lib/legal-docs";
import { Check, Plus, Trash2, FileText, ExternalLink, GripVertical, ImagePlus, Info, Loader2 } from "lucide-react";

interface PolicyDoc {
  id: string;
  slug: string;
  title: string;
  body: string;
  requiredAtSignup: boolean;
  updatedAt: string;
}

const slugify = (s: string) =>
  s.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40) || "policy";

export default function AdminPoliciesPage() {
  const { config, loading, reload } = useConfig();
  const { toast } = useToast();
  const [policies, setPolicies] = useState<PolicyDoc[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!loading) setPolicies((config.policies ?? []).map((p) => ({ ...p })));
  }, [loading, config]);

  const update = (i: number, patch: Partial<PolicyDoc>) =>
    setPolicies((prev) => prev.map((p, idx) => (idx === i ? { ...p, ...patch } : p)));

  const remove = (i: number) => setPolicies((prev) => prev.filter((_, idx) => idx !== i));

  const add = () =>
    setPolicies((prev) => [
      ...prev,
      {
        id: `pol_${Math.random().toString(36).slice(2, 8)}`,
        slug: "",
        title: "New Policy",
        body: "",
        requiredAtSignup: true,
        updatedAt: new Date().toISOString(),
      },
    ]);

  /** Take over a built-in legal page: create it here, prefilled and ready to edit. */
  const takeOver = (doc: (typeof LEGAL_DOCS)[number]) => {
    setPolicies((prev) => [
      ...prev,
      {
        id: `pol_${Math.random().toString(36).slice(2, 8)}`,
        slug: doc.slug,
        title: doc.title,
        body: doc.starter,
        // These are informational pages, not sign-up consents.
        requiredAtSignup: doc.slug === "terms" || doc.slug === "privacy" || doc.slug === "refund",
        updatedAt: new Date().toISOString(),
      },
    ]);
    toast(`“${doc.title}” is now editable below — change the text, then Save.`, "success");
  };

  /** Upload a picture and drop an [img] tag into that policy's text. */
  const [uploadingFor, setUploadingFor] = useState<number | null>(null);
  const addImage = (i: number) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/png,image/jpeg,image/webp,image/gif";
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return;
      if (file.size > 32 * 1024 * 1024) { toast("That image is over 32 MB — please use a smaller one.", "error"); return; }
      setUploadingFor(i);
      const fd = new FormData();
      fd.append("file", file);
      try {
        const res = await fetch(withBase("/api/admin/tokens"), { method: "POST", body: fd, credentials: "include" });
        const d = await res.json();
        if (res.ok && d.url) {
          setPolicies((prev) => prev.map((p, idx) => (idx === i ? { ...p, body: `${p.body}${p.body.endsWith("\n") || !p.body ? "" : "\n"}\n[img]${d.url}[/img]\n` } : p)));
          toast("Picture added to the end of the text — press Save to publish.", "success");
        } else toast(d.error ?? "Upload failed", "error");
      } catch { toast("Upload failed", "error"); }
      setUploadingFor(null);
    };
    input.click();
  };

  // Which of the standard legal pages are still using their built-in text?
  const takenSlugs = new Set(policies.map((p) => p.slug));
  const notYetEditable = LEGAL_DOCS.filter((d) => !takenSlugs.has(d.slug));

  const save = async () => {
    // Auto-fill slugs from titles where blank, and require a title.
    const cleaned = policies.map((p) => ({ ...p, slug: p.slug?.trim() || slugify(p.title) }));
    if (cleaned.some((p) => !p.title.trim())) {
      toast("Every policy needs a title", "error");
      return;
    }
    setSaving(true);
    const res = await saveConfig({ policies: cleaned });
    setSaving(false);
    if (res.ok) {
      await reload();
      toast("Policies saved — live now", "success");
    } else {
      toast(res.error ?? "Could not save", "error");
    }
  };

  const field =
    "w-full rounded-xl border border-line bg-ink-800 px-3.5 py-2.5 text-sm text-mist-100 outline-none placeholder:text-mist-500 focus:border-lotus-400";

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-extrabold text-mist-100">Policies & Terms</h1>
          <p className="text-sm text-mist-400">
            Edit the legal documents users must accept when they register. Add as many conditions as you need — changes go live immediately.
          </p>
        </div>
        <a href="/policies" target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 rounded-lg border border-line bg-ink-800 px-3 py-2 text-xs font-semibold text-mist-200 hover:border-lotus-400/40">
          <ExternalLink className="size-3.5" /> Preview public page
        </a>
      </div>

      <div className="space-y-4">
        {policies.map((p, i) => (
          <Card key={p.id} className="space-y-3 p-5">
            <div className="flex items-center gap-2">
              <GripVertical className="size-4 shrink-0 text-mist-600" />
              <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-lotus-500/15 text-lotus-300"><FileText className="size-4" /></span>
              <input
                value={p.title}
                onChange={(e) => update(i, { title: e.target.value })}
                placeholder="Policy title (e.g. Terms & Conditions)"
                className={cn(field, "flex-1 font-semibold")}
              />
              <button
                onClick={() => remove(i)}
                title="Delete policy"
                className="grid size-9 shrink-0 place-items-center rounded-lg border border-rose-500/30 text-rose-300 transition hover:bg-rose-500/10"
              >
                <Trash2 className="size-4" />
              </button>
            </div>

            <div className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-center">
              <label className="flex items-center gap-2 text-xs text-mist-400">
                <span className="shrink-0">URL slug:</span>
                <span className="shrink-0 text-mist-500">/policies/</span>
                <input
                  value={p.slug}
                  onChange={(e) => update(i, { slug: slugify(e.target.value) })}
                  placeholder={slugify(p.title)}
                  className={cn(field, "py-1.5 text-xs")}
                />
              </label>
              <label className="flex cursor-pointer items-center gap-2 justify-self-start sm:justify-self-end">
                <button
                  type="button"
                  onClick={() => update(i, { requiredAtSignup: !p.requiredAtSignup })}
                  className={cn(
                    "relative h-6 w-11 shrink-0 rounded-full transition",
                    p.requiredAtSignup ? "bg-emerald-500" : "bg-ink-700",
                  )}
                >
                  <span className={cn("absolute top-0.5 size-5 rounded-full bg-white transition-all", p.requiredAtSignup ? "left-[22px]" : "left-0.5")} />
                </button>
                <span className="text-xs font-semibold text-mist-200">Required at sign-up</span>
              </label>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Button size="sm" variant="secondary" onClick={() => addImage(i)} disabled={uploadingFor === i}>
                {uploadingFor === i ? <Loader2 className="size-4 animate-spin" /> : <ImagePlus className="size-4" />} Add image
              </Button>
              {LEGAL_DOCS.some((d) => d.slug === p.slug) && (
                <a href={LEGAL_DOCS.find((d) => d.slug === p.slug)!.href} target="_blank" rel="noreferrer"
                   className="inline-flex items-center gap-1.5 rounded-lg border border-line bg-ink-800 px-2.5 py-1.5 text-xs font-semibold text-mist-300 hover:text-mist-100">
                  <ExternalLink className="size-3.5" /> View the live page
                </a>
              )}
              <span className="text-[11px] text-mist-500">This text replaces the built-in page.</span>
            </div>

            <textarea
              value={p.body}
              onChange={(e) => update(i, { body: e.target.value })}
              rows={12}
              placeholder="Full policy text…"
              className={cn(field, "resize-y font-mono text-xs leading-relaxed")}
            />

            <details className="rounded-lg border border-line bg-ink-900/60 px-3 py-2">
              <summary className="cursor-pointer text-[11px] font-semibold text-mist-300">Formatting help</summary>
              <pre className="mt-2 whitespace-pre-wrap text-[11px] leading-relaxed text-mist-400">{LEGAL_FORMAT_HELP}</pre>
            </details>
          </Card>
        ))}

        {policies.length === 0 && !loading && (
          <Card className="p-8 text-center text-sm text-mist-400">No policies yet. Add the first one below.</Card>
        )}

        {/* THE PUBLIC LEGAL PAGES that still show their built-in text. Taking one
            over copies the current wording in here so it can be edited rather
            than retyped — this is how Contact Us, Refund Policy and the rest
            become editable. */}
        {notYetEditable.length > 0 && (
          <Card className="p-5">
            <h2 className="flex items-center gap-2 text-sm font-bold text-mist-100">
              <Info className="size-4 text-sky-300" /> Public pages you can take control of
            </h2>
            <p className="mt-1 text-xs text-mist-400">
              These pages are live on the website but still show their built-in text, so nothing on them can be
              edited yet. Take one over and its current wording is copied here — then you can change the words,
              add or delete sections, and add pictures.
            </p>
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              {notYetEditable.map((d) => (
                <div key={d.slug} className="flex items-center gap-2 rounded-xl border border-line bg-ink-900 px-3 py-2">
                  <FileText className="size-4 shrink-0 text-mist-400" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-xs font-semibold text-mist-100">{d.title}</span>
                    <span className="block truncate font-mono text-[10px] text-mist-500">{d.href}</span>
                  </span>
                  <a href={d.href} target="_blank" rel="noreferrer" title="View the live page"
                     className="grid size-7 shrink-0 place-items-center rounded-lg border border-line text-mist-400 hover:text-mist-100">
                    <ExternalLink className="size-3.5" />
                  </a>
                  <Button size="sm" onClick={() => takeOver(d)}>Take control</Button>
                </div>
              ))}
            </div>
          </Card>
        )}
      </div>

      <div className="flex flex-wrap gap-3">
        <Button variant="outline" onClick={add}>
          <Plus className="size-4" /> Add policy / condition
        </Button>
        <Button size="lg" onClick={save} disabled={saving || loading}>
          <Check className="size-4" /> {saving ? "Saving…" : "Save policies"}
        </Button>
      </div>
    </div>
  );
}
