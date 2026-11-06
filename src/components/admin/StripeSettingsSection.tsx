"use client";

import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import { withBase } from "@/lib/base-path";
import { cn } from "@/lib/cn";
import { Check, Plug, Trash2 } from "lucide-react";

interface StripeView {
  saved: { secretSet: boolean; secretHint: string; mode: "test" | "live" | ""; updatedAt: string; updatedBy: string };
  active: { source: "settings" | "env" | "none"; mode: "test" | "live" | ""; keyHint: string };
  envConfigured: boolean;
  razorpayActive: boolean;
}

type TestResult = { ok: boolean; mode?: "test" | "live"; error?: string };

const field = "h-11 w-full rounded-xl border border-line bg-ink-800 px-3.5 text-sm text-mist-100 outline-none focus:border-lotus-400";

/** Optional Stripe secret key, shown inside the Razorpay card. Saved through
 *  /api/admin/stripe because it is a secret. */
export function StripeSettingsSection() {
  const { toast } = useToast();
  const [data, setData] = useState<StripeView | null>(null);
  const [loadError, setLoadError] = useState("");
  const [secretKey, setSecretKey] = useState("");
  const [busy, setBusy] = useState<"" | "save" | "test" | "clear">("");
  const [test, setTest] = useState<TestResult | null>(null);

  const apply = useCallback((v: StripeView) => {
    setData(v);
    setSecretKey("");
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(withBase("/api/admin/stripe"), { credentials: "include" });
        const d = await res.json().catch(() => ({}));
        if (!res.ok) { setLoadError(d.error ?? "Could not load the Stripe settings."); return; }
        apply(d as StripeView);
      } catch {
        setLoadError("Network error while loading the Stripe settings.");
      }
    })();
  }, [apply]);

  const call = async (method: "PATCH" | "POST", body: Record<string, unknown>) => {
    const res = await fetch(withBase("/api/admin/stripe"), {
      method,
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify(body),
    });
    const d = await res.json().catch(() => ({}));
    return { res, d };
  };

  const save = async () => {
    setBusy("save");
    try {
      const { res, d } = await call("PATCH", { secretKey: secretKey.trim() });
      if (!res.ok) { toast(d.error ?? "Could not save", "error"); return; }
      apply(d as StripeView);
      setTest(null);
      toast("Stripe secret key saved", "success");
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
      const { res, d } = await call("POST", { secretKey: secretKey.trim() });
      setTest(res.ok ? (d as TestResult) : { ok: false, error: d.error ?? "Test failed" });
    } catch {
      setTest({ ok: false, error: "Network error" });
    } finally {
      setBusy("");
    }
  };

  const clear = async () => {
    if (!window.confirm("Remove the Stripe secret key saved here? The site will go back to the server's built-in key (if any).")) return;
    setBusy("clear");
    try {
      const { res, d } = await call("PATCH", { clear: true });
      if (!res.ok) { toast(d.error ?? "Could not remove", "error"); return; }
      apply(d as StripeView);
      setTest(null);
      toast("Stripe secret key removed", "success");
    } catch {
      toast("Network error", "error");
    } finally {
      setBusy("");
    }
  };

  const typed = secretKey.trim();
  const looksWrong = typed !== "" && !/^sk_(test|live)_/.test(typed);
  const source = data?.active.source;
  const modeText = (m: string) => (m === "live" ? "LIVE — real money" : m === "test" ? "TEST mode — no real money" : "");

  return (
    <div className="mt-6 border-t border-line pt-5">
      <h3 className="text-sm font-semibold text-mist-100">Stripe — optional backup gateway</h3>
      <p className="mt-1 text-xs leading-relaxed text-mist-400">
        Only needed if you also have a Stripe account (card payments outside India). Stripe is used
        <b className="text-mist-200"> only when Razorpay is not set up</b> — while Razorpay keys exist, every purchase goes
        through Razorpay. Leave this empty if you only use Razorpay.
      </p>

      {loadError ? (
        <p className="mt-3 text-sm text-rose-300">{loadError}</p>
      ) : (
        <>
          <p
            className={cn(
              "mt-3 rounded-xl border px-3 py-2 text-xs",
              source && source !== "none" && "border-emerald-400/30 bg-emerald-500/[0.07] text-emerald-200",
              source === "none" && "border-line text-mist-400",
              !data && "border-line text-mist-500",
            )}
          >
            {!data && "Loading…"}
            {source === "settings" && <>✓ Stripe key saved on this page ({data!.active.keyHint}, {modeText(data!.active.mode)}).</>}
            {source === "env" && <>✓ Using the hosting server&apos;s built-in Stripe key ({data!.active.keyHint}, {modeText(data!.active.mode)}). Nothing is saved on this page.</>}
            {source === "none" && <>Stripe is not set up. That is fine if you only use Razorpay.</>}
            {data && source !== "none" && (
              <span className="mt-1 block text-mist-300">
                {data.razorpayActive
                  ? "Right now Razorpay is set up, so Stripe is on standby and not used for purchases."
                  : "Razorpay is not set up, so purchases currently go through Stripe."}
              </span>
            )}
          </p>

          <label className="mt-4 block text-xs font-semibold text-mist-300">Stripe Secret key (STRIPE_SECRET_KEY)</label>
          <input
            type="password"
            value={secretKey}
            onChange={(e) => setSecretKey(e.target.value)}
            placeholder={data?.saved.secretSet ? `Saved (${data.saved.secretHint}) — paste a new key to replace it` : "sk_live_…"}
            className={cn(field, "mt-1.5 font-mono text-xs")}
            autoComplete="new-password"
            spellCheck={false}
          />
          {looksWrong && (
            <p className="mt-1.5 text-xs text-amber-300">
              ⚠ The Secret key starts with <b>sk_test_</b> or <b>sk_live_</b>. Keys starting with <b>pk_</b> are the
              publishable key — that one is not needed here.
            </p>
          )}

          {test && (
            <p className={cn("mt-3 text-xs", test.ok ? "text-emerald-300" : "text-rose-300")}>
              {test.ok ? `✓ Connected. Stripe accepted this key (${modeText(test.mode ?? "")}).` : `✕ ${test.error ?? "The test failed."}`}
            </p>
          )}

          <div className="mt-3 flex flex-wrap gap-2">
            <Button onClick={save} disabled={!data || busy !== "" || !typed || looksWrong}>
              <Check className="size-4" /> {busy === "save" ? "Saving…" : "Save Stripe key"}
            </Button>
            <Button variant="secondary" onClick={runTest} disabled={!data || busy !== "" || looksWrong}>
              <Plug className="size-4" /> {busy === "test" ? "Testing…" : "Test connection"}
            </Button>
            {data?.saved.secretSet && (
              <Button variant="ghost" onClick={clear} disabled={busy !== ""}>
                <Trash2 className="size-4" /> {busy === "clear" ? "Removing…" : "Remove saved key"}
              </Button>
            )}
          </div>
          {data?.saved.updatedAt && (
            <p className="mt-2 text-xs text-mist-500">
              Last changed {new Date(data.saved.updatedAt).toLocaleString()}{data.saved.updatedBy ? ` by ${data.saved.updatedBy}` : ""}.
            </p>
          )}

          <p className="mt-3 text-xs leading-relaxed text-mist-500">
            Get it at <a href="https://dashboard.stripe.com/apikeys" target="_blank" rel="noreferrer" className="font-semibold text-lotus-300 underline">dashboard.stripe.com/apikeys</a> →
            <b className="text-mist-300"> Secret key</b> → Reveal, then copy. Use the <b className="text-mist-300">Test mode</b> switch
            in Stripe to get a test key first.
          </p>
        </>
      )}
    </div>
  );
}
