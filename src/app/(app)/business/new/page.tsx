"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Card } from "@/components/ui/Card";
import { Button, ButtonLink } from "@/components/ui/Button";
import { Field, Input, Textarea, Select } from "@/components/ui/Input";
import { useToast } from "@/components/ui/Toast";
import { useConfig } from "@/lib/config";
import { useAuth } from "@/lib/auth";
import { cn } from "@/lib/cn";
import { registerBusiness, editBusiness, fetchBusiness, type BizInput } from "@/lib/business";
import { usePhotoEdit } from "@/components/usePhotoEdit";
import { Building2, ImagePlus, ArrowLeft, Loader2, BadgeCheck, Coins, Globe, Lock } from "lucide-react";

function BusinessForm() {
  const { toast } = useToast();
  const router = useRouter();
  const params = useSearchParams();
  const editId = params.get("id") ?? "";
  const { config } = useConfig();
  const { user } = useAuth();
  const categories = config.business?.categories ?? [];
  // Admin-defined EXTRA form fields — added from /admin/business with NO code change.
  const customFields = (config.business?.fields ?? []).filter((cf) => cf.enabled !== false);
  const registerCost = Math.max(0, Math.floor(config.business?.registerCost ?? 0));
  const coins = user?.coins ?? 0;
  const cantAfford = !editId && registerCost > 0 && coins < registerCost;

  const [loading, setLoading] = useState(!!editId);
  const [saving, setSaving] = useState(false);
  const [f, setF] = useState<BizInput>({ name: "", category: categories[0] ?? "Other", description: "", visibility: "everyone", fields: {} });
  const [logoPreview, setLogoPreview] = useState("");
  const [coverPreview, setCoverPreview] = useState("");
  const logoRef = useRef<HTMLInputElement>(null);
  const coverRef = useRef<HTMLInputElement>(null);

  // Prefill when editing.
  useEffect(() => {
    if (!editId) return;
    fetchBusiness(editId).then((b) => {
      if (b) {
        setF({ name: b.name, category: b.category, description: b.description, phone: b.phone, email: b.email, website: b.website, location: b.location, hours: b.hours, whatsapp: b.whatsapp, facebook: b.facebook, instagram: b.instagram, youtube: b.youtube, visibility: b.visibility, fields: b.fields ?? {} });
        setLogoPreview(b.logoUrl || "");
        setCoverPreview(b.coverUrl || "");
      } else {
        toast("Business not found.", "error");
        router.push("/business/mine");
      }
      setLoading(false);
    });
  }, [editId, router, toast]);

  // Default the category once config loads (create mode).
  useEffect(() => {
    if (!editId && categories.length && !f.category) setF((s) => ({ ...s, category: categories[0] }));
    /* eslint-disable-next-line react-hooks/exhaustive-deps */
  }, [categories.length]);

  const set = (k: keyof BizInput, v: string) => setF((s) => ({ ...s, [k]: v }));
  const setCustomField = (key: string, v: string) => setF((s) => ({ ...s, fields: { ...(s.fields ?? {}), [key]: v } }));
  const { pick: bizEdit, editor: bizEditor } = usePhotoEdit();

  // Logo + cover now go through the shared advanced editor (crop/zoom/rotate).
  const pickLogo = (file?: File) => bizEdit(file, (url) => { setLogoPreview(url); setF((s) => ({ ...s, logo: url })); }, "square");
  const pickCover = (file?: File) => bizEdit(file, (url) => { setCoverPreview(url); setF((s) => ({ ...s, cover: url })); }, "cover");

  const submit = async () => {
    if (!f.name.trim()) { toast("Please enter a business name.", "error"); return; }
    for (const cf of customFields) {
      if (cf.required && !(f.fields?.[cf.key] ?? "").trim()) { toast(`Please fill in "${cf.label}".`, "error"); return; }
    }
    if (cantAfford) { toast(`You need ${registerCost} coins to register a business. You have ${coins}.`, "error"); return; }
    setSaving(true);
    const res = editId ? await editBusiness(editId, f) : await registerBusiness(f);
    setSaving(false);
    if (!res.ok) { toast(res.error ?? "Something went wrong", "error"); return; }
    if (editId) { toast("Business updated.", "success"); router.push("/business/mine"); }
    else { toast("Submitted! An admin will review your business for the verified badge.", "success"); router.push("/business/mine"); }
  };

  if (loading) return <div className="grid min-h-[50vh] place-items-center text-mist-400">Loading…</div>;

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      {bizEditor}
      <ButtonLink href="/business/mine" variant="ghost" size="sm"><ArrowLeft className="size-4" /> My Business</ButtonLink>
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold text-mist-100">
          <Building2 className="size-6 text-lotus-300" /> {editId ? "Edit business" : "Register your business"}
        </h1>
        <p className="mt-0.5 text-sm text-mist-400">{editId ? "Update your business details." : "Create an official business account. An admin verifies it for the blue badge."}</p>
      </div>

      <Card className="space-y-4 p-5">
        {/* Logo + cover pickers — side by side, clearly labelled, no overlap. */}
        <div>
          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => logoRef.current?.click()}
              className="grid size-24 shrink-0 place-items-center overflow-hidden rounded-2xl border border-dashed border-line bg-ink-800 text-mist-400 transition-colors hover:border-lotus-400/60"
              style={logoPreview ? { backgroundImage: `url(${logoPreview})`, backgroundSize: "cover", backgroundPosition: "center" } : undefined}
            >
              {!logoPreview && <span className="flex flex-col items-center gap-1"><ImagePlus className="size-5" /><span className="text-[10px] font-medium">Logo</span></span>}
            </button>
            <input ref={logoRef} type="file" accept="image/*" hidden onChange={(e) => pickLogo(e.target.files?.[0])} />
            <button
              type="button"
              onClick={() => coverRef.current?.click()}
              className="grid h-24 flex-1 place-items-center overflow-hidden rounded-2xl border border-dashed border-line bg-ink-800 text-mist-400 transition-colors hover:border-lotus-400/60"
              style={coverPreview ? { backgroundImage: `url(${coverPreview})`, backgroundSize: "cover", backgroundPosition: "center" } : undefined}
            >
              {!coverPreview && <span className="flex items-center gap-2 text-sm"><ImagePlus className="size-4" /> Add cover image</span>}
            </button>
            <input ref={coverRef} type="file" accept="image/*" hidden onChange={(e) => pickCover(e.target.files?.[0])} />
          </div>
          <p className="mt-2 text-xs text-mist-500">Logo &amp; cover image are optional — tap a box to upload.</p>
        </div>

        <Field label="Business name *">
          <Input value={f.name} onChange={(e) => set("name", e.target.value)} placeholder="e.g. Lotus Cafe" maxLength={60} />
        </Field>

        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Category">
            <Select value={f.category} onChange={(e) => set("category", e.target.value)}>
              {categories.length === 0 && <option value="Other">Other</option>}
              {categories.map((c) => <option key={c} value={c}>{c}</option>)}
            </Select>
          </Field>
          <Field label="Location">
            <Input value={f.location ?? ""} onChange={(e) => set("location", e.target.value)} placeholder="City / area" maxLength={160} />
          </Field>
        </div>

        <Field label="Description">
          <Textarea value={f.description} onChange={(e) => set("description", e.target.value)} placeholder="Tell customers what your business does…" maxLength={1500} />
        </Field>

        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Phone"><Input value={f.phone ?? ""} onChange={(e) => set("phone", e.target.value)} placeholder="+966 …" maxLength={40} /></Field>
          <Field label="WhatsApp number"><Input value={f.whatsapp ?? ""} onChange={(e) => set("whatsapp", e.target.value)} placeholder="+966 … (opens WhatsApp chat)" maxLength={20} /></Field>
          <Field label="Email"><Input value={f.email ?? ""} onChange={(e) => set("email", e.target.value)} placeholder="hello@business.com" maxLength={120} /></Field>
          <Field label="Website"><Input value={f.website ?? ""} onChange={(e) => set("website", e.target.value)} placeholder="https://…" maxLength={200} /></Field>
          <Field label="Working hours"><Input value={f.hours ?? ""} onChange={(e) => set("hours", e.target.value)} placeholder="Mon–Sat 9am–8pm" maxLength={160} /></Field>
        </div>

        {/* Social media links */}
        <div>
          <p className="mb-1.5 text-sm font-medium text-mist-300">Social media (optional)</p>
          <div className="grid gap-3 sm:grid-cols-3">
            <Field label="Facebook"><Input value={f.facebook ?? ""} onChange={(e) => set("facebook", e.target.value)} placeholder="facebook.com/…" maxLength={200} /></Field>
            <Field label="Instagram"><Input value={f.instagram ?? ""} onChange={(e) => set("instagram", e.target.value)} placeholder="instagram.com/…" maxLength={200} /></Field>
            <Field label="YouTube"><Input value={f.youtube ?? ""} onChange={(e) => set("youtube", e.target.value)} placeholder="youtube.com/…" maxLength={200} /></Field>
          </div>
        </div>

        {/* Admin-defined custom fields — rendered from config.business.fields.
            The admin adds/edits these in /admin/business with no code change. */}
        {customFields.length > 0 && (
          <div>
            <p className="mb-1.5 text-sm font-medium text-mist-300">More details</p>
            <div className="grid gap-3">
              {customFields.map((cf) => (
                <Field key={cf.key} label={cf.required ? `${cf.label} *` : cf.label}>
                  {cf.type === "textarea" ? (
                    <Textarea value={f.fields?.[cf.key] ?? ""} onChange={(e) => setCustomField(cf.key, e.target.value)} placeholder={cf.placeholder ?? ""} maxLength={500} />
                  ) : cf.type === "select" ? (
                    <Select value={f.fields?.[cf.key] ?? ""} onChange={(e) => setCustomField(cf.key, e.target.value)}>
                      <option value="">Select…</option>
                      {(cf.options ?? []).map((o) => <option key={o} value={o}>{o}</option>)}
                    </Select>
                  ) : (
                    <Input
                      type={cf.type === "number" ? "number" : cf.type === "email" ? "email" : cf.type === "url" ? "url" : cf.type === "tel" ? "tel" : "text"}
                      value={f.fields?.[cf.key] ?? ""}
                      onChange={(e) => setCustomField(cf.key, e.target.value)}
                      placeholder={cf.placeholder ?? ""}
                      maxLength={500}
                    />
                  )}
                </Field>
              ))}
            </div>
          </div>
        )}

        {/* Privacy / visibility */}
        <div>
          <p className="mb-1.5 text-sm font-medium text-mist-300">Who can see this business?</p>
          <div className="grid gap-2 sm:grid-cols-2">
            {([
              { v: "everyone", icon: Globe, title: "Everyone", sub: "Anyone can view the profile" },
              { v: "businesses", icon: Lock, title: "Registered businesses only", sub: "Only people who registered a business" },
            ] as const).map((o) => {
              const active = (f.visibility ?? "everyone") === o.v;
              return (
                <button
                  key={o.v}
                  type="button"
                  onClick={() => setF((s) => ({ ...s, visibility: o.v }))}
                  className={cn("flex items-start gap-2.5 rounded-xl border p-3 text-left transition-colors", active ? "border-lotus-400 bg-lotus-500/10" : "border-line bg-ink-800 hover:bg-ink-700")}
                >
                  <o.icon className={cn("mt-0.5 size-4 shrink-0", active ? "text-lotus-300" : "text-mist-400")} />
                  <span>
                    <span className={cn("block text-sm font-semibold", active ? "text-mist-100" : "text-mist-200")}>{o.title}</span>
                    <span className="block text-[11px] text-mist-500">{o.sub}</span>
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {!editId && registerCost > 0 && (
          <div className="flex items-center justify-between rounded-xl border border-gold-400/25 bg-gold-400/5 px-3.5 py-2.5">
            <span className="flex items-center gap-2 text-sm text-gold-200"><Coins className="size-4" /> Registration costs <b className="text-gold-100">{registerCost}</b> coins</span>
            <span className={cn("text-xs font-semibold", coins >= registerCost ? "text-mist-400" : "text-rose-300")}>Balance: {coins}</span>
          </div>
        )}

        <div className="flex items-center gap-2 rounded-xl border border-sky-400/20 bg-sky-500/5 px-3 py-2 text-xs text-sky-200">
          <BadgeCheck className="size-4 shrink-0" /> {editId ? "Edits keep your current verification status." : `New businesses are reviewed by an admin before they go live.${registerCost > 0 ? " Your coins are refunded if it isn't approved." : ""}`}
        </div>

        <Button block size="lg" onClick={submit} disabled={saving || cantAfford}>
          {saving ? <Loader2 className="size-4 animate-spin" /> : null}
          {cantAfford ? `Need ${registerCost} coins` : editId ? "Save changes" : registerCost > 0 ? `Submit — ${registerCost} coins` : "Submit for verification"}
        </Button>
      </Card>
    </div>
  );
}

export default function BusinessNewPage() {
  return (
    <Suspense fallback={<div className="grid min-h-[50vh] place-items-center text-mist-400">Loading…</div>}>
      <BusinessForm />
    </Suspense>
  );
}
