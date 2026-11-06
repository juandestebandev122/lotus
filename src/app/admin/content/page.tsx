"use client";

import { useEffect, useState } from "react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import { useConfig, saveConfig } from "@/lib/config";
import { cn } from "@/lib/cn";
import { Check, Megaphone, Type, Mail, FileText, Hand, Download, Play, Building2, Eye, RotateCcw } from "lucide-react";

export default function AdminContentPage() {
  const { config, loading, reload } = useConfig();
  const { toast } = useToast();

  const [companyName, setCompanyName] = useState(config.companyName ?? "");
  const [appName, setAppName] = useState(config.appName);
  const [showPreview, setShowPreview] = useState(false);
  const [announcement, setAnnouncement] = useState(config.announcement);
  const [welcome, setWelcome] = useState(config.content.welcome);
  const [supportEmail, setSupportEmail] = useState(config.content.supportEmail);
  const [termsUrl, setTermsUrl] = useState(config.content.termsUrl);
  const [playStoreUrl, setPlayStoreUrl] = useState(config.content.playStoreUrl ?? "");
  const [apkUrl, setApkUrl] = useState(config.content.apkUrl ?? "");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!loading) {
      setCompanyName(config.companyName ?? "");
      setAppName(config.appName);
      setAnnouncement(config.announcement);
      setWelcome(config.content.welcome);
      setSupportEmail(config.content.supportEmail);
      setTermsUrl(config.content.termsUrl);
      setPlayStoreUrl(config.content.playStoreUrl ?? "");
      setApkUrl(config.content.apkUrl ?? "");
    }
  }, [loading, config]);

  const save = async () => {
    setSaving(true);
    const res = await saveConfig({
      appName,
      companyName: companyName.trim(),
      announcement,
      content: { welcome, supportEmail, termsUrl, playStoreUrl: playStoreUrl.trim(), apkUrl: apkUrl.trim() },
    });
    setSaving(false);
    if (res.ok) {
      await reload();
      toast("Content saved — live across the app", "success");
    } else {
      toast(res.error ?? "Could not save", "error");
    }
  };

  // Restore the brand names to their app defaults (does NOT save until "Save").
  const restoreDefault = () => { setCompanyName(""); setAppName("LotusPlay Connect"); toast("Names reset to default — press Save to apply.", "info"); };

  const field = "w-full rounded-xl border border-line bg-ink-800 px-3.5 py-2.5 text-sm text-mist-100 outline-none placeholder:text-mist-500 focus:border-lotus-400";

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-extrabold text-mist-100">Content management</h1>
        <p className="text-sm text-mist-400">Edit the text members see across the app — saved live.</p>
      </div>

      {/* Brand names — Company + App, live across the whole app */}
      <Card className="p-5 space-y-4">
        <div>
          <h2 className="flex items-center gap-2 font-display text-base font-bold text-mist-100"><Type className="size-4 text-lotus-300" /> Brand name</h2>
          <p className="mt-0.5 text-sm text-mist-400">Set separately. The <b className="text-mist-200">Company name</b> shows in the brand colour, the <b className="text-mist-200">App name</b> beside it — everywhere the logo appears (leave Company blank to show the App name only).</p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field icon={Building2} label="Company name" hint="e.g. THAMARAI NETWORKS (optional).">
            <input value={companyName} onChange={(e) => setCompanyName(e.target.value)} placeholder="Company / brand" maxLength={60} className={field} />
          </Field>
          <Field icon={Type} label="App name" hint="e.g. LOTUS LUDO.">
            <input value={appName} onChange={(e) => setAppName(e.target.value)} placeholder="App name" maxLength={60} className={field} />
          </Field>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button size="sm" variant="secondary" onClick={() => setShowPreview((s) => !s)}><Eye className="size-4" /> {showPreview ? "Hide preview" : "Preview changes"}</Button>
          <Button size="sm" variant="ghost" onClick={restoreDefault}><RotateCcw className="size-4" /> Restore default</Button>
        </div>
        {showPreview && (
          <div className="rounded-xl border border-line bg-ink-900/60 p-4">
            <div className="text-[10px] font-semibold uppercase tracking-wide text-mist-500">Live preview</div>
            <div className="mt-2 font-display text-2xl font-extrabold leading-none">
              <span className="text-gradient">{(companyName.trim() || appName.trim().split(/\s+/)[0]) || "Lotus"}</span>
              {(companyName.trim() ? appName.trim() : appName.trim().split(/\s+/).slice(1).join(" ")) && (
                <> <span className="font-semibold tracking-wide text-mist-300">{companyName.trim() ? appName.trim() : appName.trim().split(/\s+/).slice(1).join(" ")}</span></>
              )}
            </div>
            <p className="mt-2 text-[11px] text-mist-500">This is how the header brand will look. Press <b className="text-mist-300">Save content</b> to apply it live across the entire app.</p>
          </div>
        )}

        <Field icon={Megaphone} label="Global announcement banner" hint="Shown to every member at the top of the app (leave blank for none).">
          <input value={announcement} onChange={(e) => setAnnouncement(e.target.value)} placeholder="e.g. Scheduled maintenance Sunday 2 AM" className={field} />
        </Field>

        <Field icon={Hand} label="Welcome message" hint="Greeting shown to new members.">
          <textarea value={welcome} onChange={(e) => setWelcome(e.target.value)} rows={2} className={cn(field, "resize-none")} />
        </Field>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field icon={Mail} label="Support email">
            <input value={supportEmail} onChange={(e) => setSupportEmail(e.target.value)} placeholder="support@lotus.com" className={field} />
          </Field>
          <Field icon={FileText} label="Terms & policy link">
            <input value={termsUrl} onChange={(e) => setTermsUrl(e.target.value)} placeholder="https://…" className={field} />
          </Field>
        </div>
      </Card>

      {/* "Install Now" button controls (Home page) */}
      <Card className="p-5 space-y-4">
        <div>
          <h2 className="flex items-center gap-2 font-display text-base font-bold text-mist-100"><Download className="size-4 text-lotus-300" /> “Install Now” button (Home page)</h2>
          <p className="mt-0.5 text-sm text-mist-400">If a Play Store link is set, the button opens the Play Store. If it&apos;s blank, the button downloads the APK instead. Leave both blank to hide the button.</p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field icon={Play} label="Google Play Store URL" hint="Priority — used first when set.">
            <input value={playStoreUrl} onChange={(e) => setPlayStoreUrl(e.target.value)} placeholder="https://play.google.com/store/apps/details?id=…" className={field} />
          </Field>
          <Field icon={Download} label="APK download URL" hint="Used when the Play Store link is blank (app not published yet).">
            <input value={apkUrl} onChange={(e) => setApkUrl(e.target.value)} placeholder="https://lotusplay.tech/app/lotus.apk" className={field} />
          </Field>
        </div>
        <p className="text-xs text-mist-500">
          {playStoreUrl.trim() ? "✅ Button will open the Play Store." : apkUrl.trim() ? "✅ Button will download the APK." : "⚠️ Button is hidden until you add a Play Store link or an APK URL."}
        </p>
      </Card>

      <Button size="lg" onClick={save} disabled={saving || loading}>
        <Check className="size-4" /> {saving ? "Saving…" : "Save content"}
      </Button>
    </div>
  );
}

function Field({
  icon: Icon,
  label,
  hint,
  children,
}: {
  icon: typeof Type;
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="flex items-center gap-1.5 text-sm font-semibold text-mist-200">
        <Icon className="size-4 text-lotus-300" /> {label}
      </label>
      {hint && <p className="mb-1.5 mt-0.5 text-xs text-mist-500">{hint}</p>}
      <div className={hint ? "" : "mt-1.5"}>{children}</div>
    </div>
  );
}
