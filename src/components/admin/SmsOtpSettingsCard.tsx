"use client";

import { useCallback, useEffect, useState } from "react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import { withBase } from "@/lib/base-path";
import { cn } from "@/lib/cn";
import { Check, Plug, Trash2 } from "lucide-react";

type Provider = "generic" | "msg91" | "twilio" | "twilio-verify";

interface SmsView {
  saved: {
    provider: Provider;
    apiKey: string;
    senderId: string;
    templateId: string;
    apiUrl: string;
    countryCode: string;
    otpLength: number;
    expiryMinutes: number;
    resendSeconds: number;
    maxAttempts: number;
    loginEnabled: boolean;
    registrationEnabled: boolean;
    secretSet: boolean;
    secretHint: string;
    updatedAt: string;
    updatedBy: string;
  };
  active: { source: "settings" | "env" | "none"; provider: Provider; ready: boolean; loginEnabled: boolean; registrationEnabled: boolean };
  envConfigured: boolean;
}

type TestResult = { ok: boolean; error?: string; detail?: string };

const field = "h-11 w-full rounded-xl border border-line bg-ink-800 px-3.5 text-sm text-mist-100 outline-none focus:border-lotus-400";

const PROVIDERS: { id: Provider; label: string }[] = [
  { id: "generic", label: "Generic HTTP API" },
  { id: "msg91", label: "MSG91" },
  { id: "twilio", label: "Twilio (text message)" },
  { id: "twilio-verify", label: "Twilio Verify" },
];

/** Admin → Settings: mobile OTP / SMS. Saved through /api/admin/sms, separately
 *  from the main settings, because it holds a secret. */
export function SmsOtpSettingsCard() {
  const { toast } = useToast();
  const [data, setData] = useState<SmsView | null>(null);
  const [loadError, setLoadError] = useState("");
  const [provider, setProvider] = useState<Provider>("generic");
  const [apiKey, setApiKey] = useState("");
  const [apiSecret, setApiSecret] = useState("");
  const [senderId, setSenderId] = useState("");
  const [templateId, setTemplateId] = useState("");
  const [apiUrl, setApiUrl] = useState("");
  const [countryCode, setCountryCode] = useState("+966");
  const [otpLength, setOtpLength] = useState("6");
  const [expiryMinutes, setExpiryMinutes] = useState("5");
  const [resendSeconds, setResendSeconds] = useState("30");
  const [maxAttempts, setMaxAttempts] = useState("5");
  const [loginEnabled, setLoginEnabled] = useState(true);
  const [registrationEnabled, setRegistrationEnabled] = useState(false);
  const [testPhone, setTestPhone] = useState("");
  const [busy, setBusy] = useState<"" | "save" | "test" | "clear">("");
  const [test, setTest] = useState<TestResult | null>(null);

  const apply = useCallback((v: SmsView) => {
    setData(v);
    setProvider(v.saved.provider);
    setApiKey(v.saved.apiKey);
    setSenderId(v.saved.senderId);
    setTemplateId(v.saved.templateId);
    setApiUrl(v.saved.apiUrl);
    setCountryCode(v.saved.countryCode || "+966");
    setOtpLength(String(v.saved.otpLength));
    setExpiryMinutes(String(v.saved.expiryMinutes));
    setResendSeconds(String(v.saved.resendSeconds));
    setMaxAttempts(String(v.saved.maxAttempts));
    setLoginEnabled(v.saved.loginEnabled);
    setRegistrationEnabled(v.saved.registrationEnabled);
    setApiSecret("");
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(withBase("/api/admin/sms"), { credentials: "include" });
        const d = await res.json().catch(() => ({}));
        if (!res.ok) { setLoadError(d.error ?? "Could not load the SMS settings."); return; }
        apply(d as SmsView);
      } catch {
        setLoadError("Network error while loading the SMS settings.");
      }
    })();
  }, [apply]);

  const form = () => ({
    provider,
    apiKey: apiKey.trim(),
    apiSecret: apiSecret.trim(),
    senderId: senderId.trim(),
    templateId: templateId.trim(),
    apiUrl: apiUrl.trim(),
    countryCode: countryCode.trim(),
    otpLength: Number(otpLength),
    expiryMinutes: Number(expiryMinutes),
    resendSeconds: Number(resendSeconds),
    maxAttempts: Number(maxAttempts),
    loginEnabled,
    registrationEnabled,
  });

  const call = async (method: "PATCH" | "POST", body: Record<string, unknown>) => {
    const res = await fetch(withBase("/api/admin/sms"), {
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
      const { res, d } = await call("PATCH", form());
      if (!res.ok) { toast(d.error ?? "Could not save", "error"); return; }
      apply(d as SmsView);
      setTest(null);
      toast("Mobile OTP settings saved", "success");
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
      const { res, d } = await call("POST", { ...form(), testPhone: testPhone.trim() });
      setTest(res.ok ? (d as TestResult) : { ok: false, error: d.error ?? "Test failed" });
    } catch {
      setTest({ ok: false, error: "Network error" });
    } finally {
      setBusy("");
    }
  };

  const clear = async () => {
    if (!window.confirm("Remove the mobile OTP settings saved here? The site will go back to the server's built-in SMS settings.")) return;
    setBusy("clear");
    try {
      const { res, d } = await call("PATCH", { clear: true });
      if (!res.ok) { toast(d.error ?? "Could not remove", "error"); return; }
      apply(d as SmsView);
      setTest(null);
      toast("Mobile OTP settings removed", "success");
    } catch {
      toast("Network error", "error");
    } finally {
      setBusy("");
    }
  };

  const source = data?.active.source;
  const secretNeeded = provider === "twilio" || provider === "twilio-verify";

  return (
    <Card className="p-5">
      <h2 className="font-semibold text-mist-100">Mobile OTP / SMS</h2>

      <div className="mt-2 rounded-xl border border-sky-400/25 bg-sky-500/[0.07] p-3 text-xs leading-relaxed text-mist-300">
        <p className="font-semibold text-mist-100">What is this setting for?</p>
        <p className="mt-1">
          These values send the <b className="text-mist-100">text-message code</b> used for mobile login, and for
          registration when that switch is on. The site uses whatever you save here. Nothing is hard-coded in the app.
        </p>
        <p className="mt-2">
          <b className="text-mist-100">Do I have to fill this in?</b> Only to send real texts. If you leave it empty
          and the hosting server has no SMS keys either, mobile login stays in demo mode (the code is shown on screen).
        </p>
        <p className="mt-2">
          <b className="text-mist-100">Is it secret?</b> The <b className="text-mist-100">API secret</b> is a password —
          never share it. Once saved, it is never shown again, not even here; only its last 4 characters.
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
            {source === "settings" && <>✓ SMS is ON, using the keys saved on this page ({data!.active.provider}).</>}
            {source === "env" && <>✓ SMS is ON, using the hosting server&apos;s built-in Twilio settings. Nothing complete is saved on this page.</>}
            {source === "none" && <>⚠ SMS is OFF — no provider is set up. Mobile login uses a demo code until you fill this in.</>}
          </p>

          <label className="mt-4 block text-xs font-semibold text-mist-300">SMS / OTP provider</label>
          <select value={provider} onChange={(e) => setProvider(e.target.value as Provider)} className={cn(field, "mt-1.5")}>
            {PROVIDERS.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
          </select>
          <p className="mt-1.5 text-xs text-mist-500">
            {provider === "generic" && "POST JSON to your API URL with the code, sender, and template id. The key is sent as a Bearer token."}
            {provider === "msg91" && "MSG91 OTP API. The API key is the auth key. The template ID is your approved OTP template."}
            {provider === "twilio" && "Twilio Messages. API key is the Account SID, API secret is the Auth Token, Sender ID is the From number."}
            {provider === "twilio-verify" && "Twilio Verify generates the code. API key is the Account SID, API secret is the Auth Token, Template ID is the Verify Service SID."}
          </p>

          <label className="mt-4 block text-xs font-semibold text-mist-300">API key</label>
          <input value={apiKey} onChange={(e) => setApiKey(e.target.value)} placeholder="API key or Account SID" className={cn(field, "mt-1.5 font-mono text-xs")} autoComplete="off" spellCheck={false} />

          <label className="mt-4 block text-xs font-semibold text-mist-300">API secret {secretNeeded ? "" : "(optional)"}</label>
          <input
            type="password"
            value={apiSecret}
            onChange={(e) => setApiSecret(e.target.value)}
            placeholder={data?.saved.secretSet ? `Saved (${data.saved.secretHint}) — leave empty to keep it` : "Paste the API secret"}
            className={cn(field, "mt-1.5 font-mono text-xs")}
            autoComplete="new-password"
            spellCheck={false}
          />

          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-xs font-semibold text-mist-300">Sender ID</label>
              <input value={senderId} onChange={(e) => setSenderId(e.target.value)} placeholder={provider === "twilio" ? "+15551234567" : "LOTUS"} className={cn(field, "mt-1.5 font-mono text-xs")} autoComplete="off" spellCheck={false} />
            </div>
            <div>
              <label className="block text-xs font-semibold text-mist-300">OTP template ID</label>
              <input value={templateId} onChange={(e) => setTemplateId(e.target.value)} placeholder={provider === "twilio-verify" ? "VAxxxxxxxx" : "Template id"} className={cn(field, "mt-1.5 font-mono text-xs")} autoComplete="off" spellCheck={false} />
            </div>
          </div>

          <label className="mt-4 block text-xs font-semibold text-mist-300">API URL / endpoint {provider === "generic" ? "" : "(optional)"}</label>
          <input
            value={apiUrl}
            onChange={(e) => setApiUrl(e.target.value)}
            placeholder={provider === "msg91" ? "https://control.msg91.com/api/v5/otp" : provider === "generic" ? "https://sms.example.com/send" : "Leave empty to use the provider's default"}
            className={cn(field, "mt-1.5 font-mono text-xs")}
            autoComplete="off"
            spellCheck={false}
          />

          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-xs font-semibold text-mist-300">Country code / default country</label>
              <input value={countryCode} onChange={(e) => setCountryCode(e.target.value)} placeholder="+966" className={cn(field, "mt-1.5 font-mono text-xs")} autoComplete="off" spellCheck={false} />
            </div>
            <div>
              <label className="block text-xs font-semibold text-mist-300">OTP length (4–8)</label>
              <input value={otpLength} onChange={(e) => setOtpLength(e.target.value.replace(/\D/g, "").slice(0, 2))} inputMode="numeric" className={cn(field, "mt-1.5")} />
            </div>
            <div>
              <label className="block text-xs font-semibold text-mist-300">OTP expiry (minutes, 1–30)</label>
              <input value={expiryMinutes} onChange={(e) => setExpiryMinutes(e.target.value.replace(/\D/g, "").slice(0, 2))} inputMode="numeric" className={cn(field, "mt-1.5")} />
            </div>
            <div>
              <label className="block text-xs font-semibold text-mist-300">Resend wait (seconds, 15–300)</label>
              <input value={resendSeconds} onChange={(e) => setResendSeconds(e.target.value.replace(/\D/g, "").slice(0, 3))} inputMode="numeric" className={cn(field, "mt-1.5")} />
            </div>
            <div>
              <label className="block text-xs font-semibold text-mist-300">Maximum OTP attempts (1–10)</label>
              <input value={maxAttempts} onChange={(e) => setMaxAttempts(e.target.value.replace(/\D/g, "").slice(0, 2))} inputMode="numeric" className={cn(field, "mt-1.5")} />
            </div>
          </div>
          {provider === "twilio-verify" && (
            <p className="mt-2 text-xs text-mist-500">Twilio Verify chooses the code itself. Length and expiry here are stored, but Twilio&apos;s own service settings decide the text.</p>
          )}

          <div className="mt-4 space-y-2">
            <label className="flex items-center gap-2 text-sm text-mist-200">
              <input type="checkbox" checked={loginEnabled} onChange={(e) => setLoginEnabled(e.target.checked)} className="size-4 accent-lotus-500" />
              Enable OTP login
            </label>
            <label className="flex items-center gap-2 text-sm text-mist-200">
              <input type="checkbox" checked={registrationEnabled} onChange={(e) => setRegistrationEnabled(e.target.checked)} className="size-4 accent-lotus-500" />
              Enable OTP registration
            </label>
            <p className="text-xs text-mist-500">
              OTP login shows the Mobile tab on the login page. OTP registration asks for a text code before a new account request is submitted. Email verification still happens after that.
            </p>
          </div>

          <label className="mt-4 block text-xs font-semibold text-mist-300">Test mobile number (optional)</label>
          <input
            value={testPhone}
            onChange={(e) => setTestPhone(e.target.value)}
            placeholder="+966 50 123 4567"
            className={cn(field, "mt-1.5 font-mono text-xs")}
            autoComplete="off"
            spellCheck={false}
          />
          <p className="mt-1.5 text-xs text-mist-500">Test connection checks the keys. If you enter a number, a test text is sent there. The test is not saved as a login code, except Twilio Verify, which sends a real code.</p>

          {test && (
            <p className={cn("mt-4 text-xs", test.ok ? "text-emerald-300" : "text-rose-300")}>
              {test.ok ? `✓ ${test.detail ?? "The provider accepted these settings."}` : `✕ ${test.error ?? "The test failed."}`}
            </p>
          )}

          <div className="mt-4 flex flex-wrap gap-2">
            <Button onClick={save} disabled={!data || busy !== ""}>
              <Check className="size-4" /> {busy === "save" ? "Saving…" : "Save SMS settings"}
            </Button>
            <Button variant="secondary" onClick={runTest} disabled={!data || busy !== ""}>
              <Plug className="size-4" /> {busy === "test" ? "Testing…" : "Test connection"}
            </Button>
            {(data?.saved.apiKey || data?.saved.secretSet || data?.saved.updatedAt) && (
              <Button variant="ghost" onClick={clear} disabled={busy !== ""}>
                <Trash2 className="size-4" /> {busy === "clear" ? "Removing…" : "Remove saved settings"}
              </Button>
            )}
          </div>
          {data?.saved.updatedAt && (
            <p className="mt-2 text-xs text-mist-500">
              Last changed {new Date(data.saved.updatedAt).toLocaleString()}{data.saved.updatedBy ? ` by ${data.saved.updatedBy}` : ""}.
            </p>
          )}
          {data?.envConfigured && source !== "settings" && (
            <p className="mt-1 text-xs text-mist-500">The hosting server already has Twilio keys. Saving a complete set here replaces them.</p>
          )}
        </>
      )}
    </Card>
  );
}
