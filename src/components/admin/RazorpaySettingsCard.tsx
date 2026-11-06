"use client";

import { useCallback, useEffect, useState } from "react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import { withBase } from "@/lib/base-path";
import { cn } from "@/lib/cn";
import { Check, Plug, Trash2 } from "lucide-react";
import { StripeSettingsSection } from "./StripeSettingsSection";

interface RazorpayView {
  saved: { keyId: string; secretSet: boolean; secretHint: string; updatedAt: string; updatedBy: string };
  active: { source: "settings" | "env" | "none"; keyId: string; mode: "test" | "live" | "" };
  envConfigured: boolean;
}

type TestResult = { ok: boolean; mode?: "test" | "live"; error?: string };

const field = "h-11 w-full rounded-xl border border-line bg-ink-800 px-3.5 text-sm text-mist-100 outline-none focus:border-lotus-400";

function Step({ n, children }: { n: number; children: React.ReactNode }) {
  return (
    <li className="flex gap-2.5">
      <span className="grid size-5 shrink-0 place-items-center rounded-full bg-lotus-500/20 text-[11px] font-bold text-lotus-200">{n}</span>
      <span>{children}</span>
    </li>
  );
}

function ModeBadge({ mode }: { mode: "test" | "live" | "" }) {
  if (!mode) return null;
  return (
    <span
      className={cn(
        "ml-1.5 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase",
        mode === "live" ? "bg-emerald-500/20 text-emerald-200" : "bg-amber-500/20 text-amber-200",
      )}
    >
      {mode === "live" ? "Live — real money" : "Test mode — no real money"}
    </span>
  );
}

/** Admin → Settings: the Razorpay API keys used for coin purchases. Saved
 *  through /api/admin/razorpay, separately from the main settings, because it
 *  holds a secret. */
export function RazorpaySettingsCard() {
  const { toast } = useToast();
  const [data, setData] = useState<RazorpayView | null>(null);
  const [loadError, setLoadError] = useState("");
  const [keyId, setKeyId] = useState("");
  const [keySecret, setKeySecret] = useState("");
  const [busy, setBusy] = useState<"" | "save" | "test" | "clear">("");
  const [test, setTest] = useState<TestResult | null>(null);

  const apply = useCallback((v: RazorpayView) => {
    setData(v);
    setKeyId(v.saved.keyId);
    setKeySecret("");
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(withBase("/api/admin/razorpay"), { credentials: "include" });
        const d = await res.json().catch(() => ({}));
        if (!res.ok) { setLoadError(d.error ?? "Could not load the Razorpay settings."); return; }
        apply(d as RazorpayView);
      } catch {
        setLoadError("Network error while loading the Razorpay settings.");
      }
    })();
  }, [apply]);

  const call = async (method: "PATCH" | "POST", body: Record<string, unknown>) => {
    const res = await fetch(withBase("/api/admin/razorpay"), {
      method,
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify(body),
    });
    const d = await res.json().catch(() => ({}));
    return { res, d };
  };

  const form = () => ({ keyId: keyId.trim(), keySecret: keySecret.trim() });

  const save = async () => {
    setBusy("save");
    try {
      const { res, d } = await call("PATCH", form());
      if (!res.ok) { toast(d.error ?? "Could not save", "error"); return; }
      apply(d as RazorpayView);
      setTest(null);
      toast("Razorpay keys saved", "success");
    } catch {
      toast("Network error", "error");
    } finally {
      setBusy("");
    }
  };

  const runTest = async () => {
    setBusy("test");
    setTest(null);
    try {
      const { res, d } = await call("POST", form());
      setTest(res.ok ? (d as TestResult) : { ok: false, error: d.error ?? "Test failed" });
    } catch {
      setTest({ ok: false, error: "Network error" });
    } finally {
      setBusy("");
    }
  };

  const clear = async () => {
    if (!window.confirm("Remove the Razorpay keys saved here? The site will go back to the server's built-in keys (if any).")) return;
    setBusy("clear");
    try {
      const { res, d } = await call("PATCH", { clear: true });
      if (!res.ok) { toast(d.error ?? "Could not remove", "error"); return; }
      apply(d as RazorpayView);
      setTest(null);
      toast("Razorpay keys removed", "success");
    } catch {
      toast("Network error", "error");
    } finally {
      setBusy("");
    }
  };

  const typedId = keyId.trim();
  const idLooksWrong = typedId !== "" && !/^rzp_(test|live)_/.test(typedId);
  const source = data?.active.source;

  return (
    <Card className="p-5">
      <h2 className="font-semibold text-mist-100">Coin payments — Razorpay (and optional Stripe)</h2>

      <div className="mt-2 rounded-xl border border-sky-400/25 bg-sky-500/[0.07] p-3 text-xs leading-relaxed text-mist-300">
        <p className="font-semibold text-mist-100">What is this setting for?</p>
        <p className="mt-1">
          Razorpay is the payment service that lets members <b className="text-mist-100">buy coins</b> with UPI, cards,
          net banking and wallets. The money goes straight to your Razorpay account. These two keys connect the site to it.
        </p>
        <p className="mt-2">
          <b className="text-mist-100">Test or Live?</b> Keys starting with <span className="font-mono">rzp_test_</span> are for
          trying things out — no real money moves. Keys starting with <span className="font-mono">rzp_live_</span> take real payments.
        </p>
        <p className="mt-2">
          <b className="text-mist-100">Is it secret?</b> The <b className="text-mist-100">Key ID</b> is not secret. The
          <b className="text-mist-100"> Key Secret</b> is a password — never share it. Once saved, it is never shown again,
          not even here; only its last 4 characters.
        </p>
      </div>

      {loadError ? (
        <p className="mt-4 text-sm text-rose-300">{loadError}</p>
      ) : (
        <>
          <p
            className={cn(
              "mt-4 rounded-xl border px-3 py-2 text-xs",
              source === "settings" && "border-emerald-400/30 bg-emerald-500/[0.07] text-emerald-200",
              source === "env" && "border-sky-400/30 bg-sky-500/[0.07] text-sky-200",
              source === "none" && "border-amber-400/30 bg-amber-500/[0.07] text-amber-200",
              !data && "border-line text-mist-500",
            )}
          >
            {!data && "Loading…"}
            {source === "settings" && <>✓ Razorpay is ON, using the keys saved on this page: <b className="font-mono">{data!.active.keyId}</b><ModeBadge mode={data!.active.mode} /></>}
            {source === "env" && <>✓ Razorpay is ON, using the hosting server&apos;s built-in keys: <b className="font-mono">{data!.active.keyId}</b><ModeBadge mode={data!.active.mode} /> Nothing is saved on this page.</>}
            {source === "none" && <>⚠ Razorpay is OFF — no keys are set up. Coin purchases use another gateway if one is set up, otherwise the test checkout.</>}
          </p>

          <label className="mt-4 block text-xs font-semibold text-mist-300">Key ID</label>
          <input
            value={keyId}
            onChange={(e) => setKeyId(e.target.value)}
            placeholder="rzp_live_xxxxxxxxxxxxxx"
            className={cn(field, "mt-1.5 font-mono text-xs")}
            autoComplete="off"
            spellCheck={false}
          />
          {idLooksWrong && (
            <p className="mt-1.5 text-xs text-amber-300">⚠ A Razorpay Key ID always starts with <b>rzp_test_</b> or <b>rzp_live_</b>.</p>
          )}
          {!idLooksWrong && typedId.startsWith("rzp_test_") && (
            <p className="mt-1.5 text-xs text-amber-300">This is a TEST key — members can &ldquo;pay&rdquo; but no real money is collected.</p>
          )}

          <label className="mt-4 block text-xs font-semibold text-mist-300">Key Secret</label>
          <input
            type="password"
            value={keySecret}
            onChange={(e) => setKeySecret(e.target.value)}
            placeholder={data?.saved.secretSet ? `Saved (${data.saved.secretHint}) — leave empty to keep it` : "Paste the Key Secret"}
            className={cn(field, "mt-1.5 font-mono text-xs")}
            autoComplete="new-password"
            spellCheck={false}
          />

          {test && (
            <p className={cn("mt-4 text-xs", test.ok ? "text-emerald-300" : "text-rose-300")}>
              {test.ok
                ? `✓ Connected. Razorpay accepted these keys (${test.mode === "live" ? "LIVE — real payments" : "TEST mode"}).`
                : `✕ ${test.error ?? "The test failed."}`}
            </p>
          )}

          <div className="mt-4 flex flex-wrap gap-2">
            <Button onClick={save} disabled={!data || busy !== ""}>
              <Check className="size-4" /> {busy === "save" ? "Saving…" : "Save Razorpay keys"}
            </Button>
            <Button variant="secondary" onClick={runTest} disabled={!data || busy !== ""}>
              <Plug className="size-4" /> {busy === "test" ? "Testing…" : "Test connection"}
            </Button>
            {(data?.saved.keyId || data?.saved.secretSet) && (
              <Button variant="ghost" onClick={clear} disabled={busy !== ""}>
                <Trash2 className="size-4" /> {busy === "clear" ? "Removing…" : "Remove saved keys"}
              </Button>
            )}
          </div>
          <p className="mt-2 text-xs text-mist-500">
            Press <b className="text-mist-300">Test connection</b> before saving. New keys apply to the next purchase straight
            away. Change keys at a quiet time — a payment that is open in someone&apos;s popup at that moment may fail to confirm.
          </p>
          {data?.saved.updatedAt && (
            <p className="mt-1 text-xs text-mist-500">
              Last changed {new Date(data.saved.updatedAt).toLocaleString()}{data.saved.updatedBy ? ` by ${data.saved.updatedBy}` : ""}.
            </p>
          )}

          <div className="mt-4 rounded-xl border border-line bg-ink-800/60 p-3 text-xs leading-relaxed text-mist-400">
            <p className="font-semibold text-mist-200">Where to get these keys</p>
            <ol className="mt-2 space-y-2.5 pl-0">
              <Step n={1}>
                Go to <a href="https://dashboard.razorpay.com" target="_blank" rel="noreferrer" className="font-semibold text-lotus-300 underline">dashboard.razorpay.com</a> and
                sign in with your business&apos;s Razorpay account.
              </Step>
              <Step n={2}>
                Use the switch at the top to choose <b className="text-mist-200">Test Mode</b> (to try it out) or
                <b className="text-mist-200"> Live Mode</b> (real payments — your account must be activated/KYC-approved first).
              </Step>
              <Step n={3}>
                Open <b className="text-mist-200">Account &amp; Settings → API Keys</b> and click
                <b className="text-mist-200"> Generate Key</b> (or <b className="text-mist-200">Regenerate</b>).
              </Step>
              <Step n={4}>
                Copy the <b className="text-mist-200">Key ID</b> and the <b className="text-mist-200">Key Secret</b> into the boxes above.
                The secret is shown only once — copy it before closing the window.
              </Step>
              <Step n={5}>
                Press <b className="text-mist-200">Test connection</b>. When it says Connected, press <b className="text-mist-200">Save Razorpay keys</b>.
              </Step>
            </ol>
            <p className="mt-3 border-t border-line pt-2 text-mist-500">
              <b className="text-mist-300">Important:</b> use the Razorpay account of <b>your own</b> business, so payments
              always go to you. The currency charged is set in <b className="text-mist-300">Admin → Coins → Payment gateway</b>.
            </p>
          </div>
        </>
      )}

      <StripeSettingsSection />
    </Card>
  );
}
