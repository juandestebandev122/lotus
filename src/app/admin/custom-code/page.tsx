"use client";

// ============================================================
// ADSENSE & CUSTOM CODE
//
// These three fields already existed, tucked inside
// Site Content → SEO. The owner could not find them, which in practice
// means they did not exist: a control nobody can locate is not a feature.
// This is the same three fields on their own page, with their own entry in
// the admin menu, named after the words the owner actually used —
// "AdSense code", "Header code", "Footer code".
//
// One source of truth: this page and the Site Content tab write the same
// config, so whichever is used, the result is identical.
// ============================================================

import { useEffect, useState } from "react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import { useConfig, saveConfig } from "@/lib/config";
import { DEFAULT_SITE_CONTENT, type SiteContent } from "@/lib/site-content-default";
import { Code2, Save, ExternalLink } from "lucide-react";

const inp = "w-full rounded-lg border border-line bg-ink-800 px-3 py-2 text-sm text-mist-100 outline-none focus:border-lotus-400";
const area = "w-full min-h-[150px] rounded-lg border border-line bg-ink-900 px-3 py-2 font-mono text-xs leading-relaxed text-mist-100 outline-none focus:border-lotus-400";

export default function CustomCodePage() {
  const { config, loading, reload } = useConfig();
  const { toast } = useToast();
  const [site, setSite] = useState<SiteContent>(DEFAULT_SITE_CONTENT);
  const [saving, setSaving] = useState(false);

  useEffect(() => { if (!loading) setSite(config.siteContent ?? DEFAULT_SITE_CONTENT); }, [loading, config.siteContent]);

  const cc = site.customCode ?? {};
  const set = (k: "adsenseClient" | "headCode" | "footerCode", v: string) =>
    setSite((p) => ({ ...p, customCode: { ...(p.customCode ?? {}), [k]: v } }));

  const save = async () => {
    setSaving(true);
    // The WHOLE siteContent object goes back, not just these three fields —
    // the config endpoint replaces siteContent wholesale, so sending a partial
    // object would wipe the blog, About page and SEO settings.
    const res = await saveConfig({ siteContent: site });
    setSaving(false);
    if (!res.ok) { toast(res.error ?? "Could not save", "error"); return; }
    await reload();
    toast("Saved — the code is live on the website now", "success");
  };

  const raw = (cc.adsenseClient ?? "").trim();
  const digits = raw.replace(/[^0-9]/g, "");

  if (loading) return <p className="text-sm text-mist-400">Loading…</p>;

  return (
    <div className="space-y-5">
      <div>
        <h1 className="flex items-center gap-2 font-display text-2xl font-extrabold text-mist-100">
          <Code2 className="size-6 text-lotus-300" /> AdSense &amp; Custom Code
        </h1>
        <p className="text-sm text-mist-400">
          Put advertising and tracking code on the website yourself. Anything saved here appears on
          every page immediately — no app update and no developer needed.
        </p>
      </div>

      {/* ---------- AdSense ---------- */}
      <Card className="p-5">
        <h2 className="font-semibold text-mist-100">Google AdSense</h2>
        <p className="mt-1 text-xs text-mist-400">
          Your AdSense publisher ID. This decides <b>which account earns the ad revenue</b> from this
          website.
        </p>

        <label className="mt-3 block text-xs font-semibold text-mist-400">Publisher ID</label>
        <input
          value={cc.adsenseClient ?? ""}
          onChange={(e) => set("adsenseClient", e.target.value.trim())}
          className={`${inp} mt-1 font-mono`}
          placeholder="ca-pub-1234567890123456"
        />

        {!raw && (
          <p className="mt-2 rounded-lg border border-amber-400/25 bg-amber-500/[0.07] px-3 py-2 text-xs text-mist-300">
            Empty — the site is still using the publisher ID it was built with.
            <b className="text-amber-200"> If that account is not yours, the ad income is going somewhere else.</b>{" "}
            Paste your own ID here to take it over.
          </p>
        )}
        {raw && digits.length < 10 && (
          <p className="mt-2 text-xs text-amber-300">
            ⚠ That does not look right. A publisher ID is <b>ca-pub-</b> followed by about 16 digits.
          </p>
        )}
        {raw && digits.length >= 10 && (
          <p className="mt-2 rounded-lg bg-emerald-500/10 px-3 py-2 text-xs text-emerald-200">
            ✓ Saves as <code>ca-pub-{digits}</code>. Both the ad script and your{" "}
            <code>ads.txt</code> file use this automatically.
          </p>
        )}

        <p className="mt-2 text-xs text-mist-500">
          Find it in AdSense → <b>Account</b> → <b>Settings</b>.{" "}
          <a href="https://www.google.com/adsense" target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-lotus-300 underline">
            Open AdSense <ExternalLink className="size-3" />
          </a>
        </p>
      </Card>

      {/* ---------- Header ---------- */}
      <Card className="p-5">
        <h2 className="font-semibold text-mist-100">Header code</h2>
        <p className="mt-1 text-xs text-mist-400">
          Added inside <code>&lt;head&gt;</code> on every page. For anything that must load early —
          Google Analytics, ad network tags, site-ownership tags.
        </p>
        <textarea
          value={cc.headCode ?? ""}
          onChange={(e) => set("headCode", e.target.value)}
          className={`${area} mt-3`}
          spellCheck={false}
          placeholder={"<!-- Paste code here, e.g. -->\n<script async src=\"https://example.com/tag.js\"></script>"}
        />
        <p className="mt-1.5 text-xs text-mist-500">
          {(cc.headCode ?? "").length} of 20,000 characters used.
        </p>
      </Card>

      {/* ---------- Footer ---------- */}
      <Card className="p-5">
        <h2 className="font-semibold text-mist-100">Footer code</h2>
        <p className="mt-1 text-xs text-mist-400">
          Added at the very end of every page. For anything that can load last — live chat widgets,
          tracking pixels. A slow script here cannot hold up the app.
        </p>
        <textarea
          value={cc.footerCode ?? ""}
          onChange={(e) => set("footerCode", e.target.value)}
          className={`${area} mt-3`}
          spellCheck={false}
          placeholder={"<!-- e.g. live chat widget, tracking pixel -->"}
        />
        <p className="mt-1.5 text-xs text-mist-500">
          {(cc.footerCode ?? "").length} of 20,000 characters used.
        </p>
      </Card>

      <Card className="border-amber-400/25 bg-amber-500/[0.05] p-4">
        <h3 className="text-sm font-semibold text-amber-200">Before you save</h3>
        <ul className="mt-1.5 space-y-1 pl-4 text-xs leading-relaxed text-mist-300" style={{ listStyle: "disc" }}>
          <li>Paste code <b>exactly</b> as the provider gave it. It is placed on the page word for word — that is what makes ad and analytics tags work.</li>
          <li>A missing <code>&lt;/script&gt;</code> can break every page. After saving, open the website in a new tab and check it still loads.</li>
          <li>If something goes wrong: clear the box, press Save, and the site recovers immediately.</li>
        </ul>
      </Card>

      <div className="sticky bottom-4 flex justify-end">
        <Button onClick={save} disabled={saving} className="shadow-lg">
          <Save className="size-4" /> {saving ? "Saving…" : "Save"}
        </Button>
      </div>
    </div>
  );
}
