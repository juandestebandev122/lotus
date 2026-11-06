"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/lib/auth";
import { withBase } from "@/lib/base-path";
import { useToast } from "@/components/ui/Toast";
import { Button } from "@/components/ui/Button";
import { Field, Input } from "@/components/ui/Input";
import { GoogleSignIn, useGoogleClientId } from "@/components/GoogleSignIn";
import { CustomUploads } from "@/components/CustomUploads";
import { Smartphone, Lock, ArrowRight, AtSign, Eye, EyeOff } from "lucide-react";

type Tab = "username" | "mobile";

const COUNTRIES = [
  { flag: "🇸🇦", dial: "+966", name: "Saudi Arabia" },
  { flag: "🇮🇳", dial: "+91", name: "India" },
  { flag: "🇺🇸", dial: "+1", name: "USA" },
  { flag: "🇬🇧", dial: "+44", name: "UK" },
  { flag: "🇦🇪", dial: "+971", name: "UAE" },
  { flag: "🇨🇦", dial: "+1", name: "Canada" },
  { flag: "🇦🇺", dial: "+61", name: "Australia" },
  { flag: "🇸🇬", dial: "+65", name: "Singapore" },
  { flag: "🇲🇾", dial: "+60", name: "Malaysia" },
  { flag: "🇵🇰", dial: "+92", name: "Pakistan" },
  { flag: "🇧🇩", dial: "+880", name: "Bangladesh" },
  { flag: "🇱🇰", dial: "+94", name: "Sri Lanka" },
  { flag: "🇳🇵", dial: "+977", name: "Nepal" },
  { flag: "🇿🇦", dial: "+27", name: "South Africa" },
  { flag: "🇳🇬", dial: "+234", name: "Nigeria" },
  { flag: "🇩🇪", dial: "+49", name: "Germany" },
  { flag: "🇫🇷", dial: "+33", name: "France" },
];

export default function LoginPage() {
  // Google sign-in activates the moment the admin saves a Client ID in
  // Admin → Settings (live config — no app update needed).
  const googleConfigured = useGoogleClientId().length > 0;
  const [tab, setTab] = useState<Tab>("username");
  const [otpLogin, setOtpLogin] = useState(true);
  const [phone, setPhone] = useState("");
  const [countryIdx, setCountryIdx] = useState(0);
  const [identifier, setIdentifier] = useState(""); // username (or email)
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false); // show/hide password (eye toggle)
  const [busy, setBusy] = useState(false);
  const { sendOtp, loginWithUsername, loginWithGoogle } = useAuth();
  const { toast } = useToast();
  const router = useRouter();

  // When arriving from "Switch account", pre-fill the chosen identifier and
  // open the username/password tab so the user just types their password.
  useEffect(() => {
    const e = new URLSearchParams(window.location.search).get("email");
    if (e) { setIdentifier(e); setTab("username"); }
  }, []);

  useEffect(() => {
    fetch(withBase("/api/auth/otp/options"), { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => {
        if (d?.loginEnabled === false) { setOtpLogin(false); setTab("username"); }
        const dial = typeof d?.countryCode === "string" ? d.countryCode : "";
        const i = COUNTRIES.findIndex((c) => c.dial === dial);
        if (i >= 0) setCountryIdx(i);
      })
      .catch(() => {});
  }, []);

  // Session was ended by an admin (Logout / Suspend / Ban / Deactivate) → show a
  // clear notice so the user understands why they're back at the login screen.
  const [endedNotice, setEndedNotice] = useState("");
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    // Signed out by the Inactivity Detection system — say so plainly, otherwise
    // it looks like the app logged them out for no reason.
    if (params.get("reason") === "inactive") {
      setEndedNotice("You were logged out because no activity was detected. Please log in again to continue.");
      return;
    }
    const ended = params.get("ended");
    if (!ended) return;
    setEndedNotice(
      ended === "device"
        ? "Your account has been logged in on another device. You have been signed out for security reasons."
        : ended === "password"
          ? "Your password was changed. Please log in again."
          : ended === "admin"
            ? "You have been signed out by an administrator. Please log in again."
            : "Your session has ended. Please log in again.",
    );
  }, []);

  // A shared room/page link sends a logged-out visitor here with ?next=<path>.
  // Read it once so we can send them THERE after they sign in (not to Home).
  const [nextTarget, setNextTarget] = useState("");
  useEffect(() => {
    try {
      const n = new URLSearchParams(window.location.search).get("next");
      if (n && n.startsWith("/") && !n.startsWith("//") && !n.startsWith("/login")) setNextTarget(n);
    } catch { /* ignore */ }
  }, []);
  // The stored `next` already includes any base path (it came from the browser
  // URL), so use it as-is; otherwise fall back to Home.
  const afterLogin = () => window.location.assign(nextTarget || withBase("/home"));

  async function handleSendOtp(e: React.FormEvent) {
    e.preventDefault();
    if (phone.replace(/\D/g, "").length < 10) {
      toast("Enter a valid 10-digit mobile number", "error");
      return;
    }
    setBusy(true);
    const res = await sendOtp(`${COUNTRIES[countryIdx].dial} ${phone}`);
    setBusy(false);
    if (res.ok) {
      toast(res.demoCode ? `OTP sent! Demo code: ${res.demoCode}` : "OTP sent!", "success");
      // Carry the shared-link destination through OTP verification.
      router.push(nextTarget ? `/verify?next=${encodeURIComponent(nextTarget)}` : "/verify");
    } else {
      toast(res.error ?? "Couldn't send OTP", "error");
    }
  }

  async function handleUsernameLogin(e: React.FormEvent) {
    e.preventDefault();
    if (identifier.trim().length < 3 || password.length < 4) {
      toast("Enter your username and password", "error");
      return;
    }
    setBusy(true);
    const r = await loginWithUsername(identifier.trim(), password);
    setBusy(false);
    if (r.ok) {
      toast("Welcome back! 🎉", "success");
      // Full reload so the new account starts with a completely clean state.
      // Lands on the shared link's destination (e.g. the room) when present.
      afterLogin();
    } else {
      toast(r.error ?? "Login failed", "error");
    }
  }

  async function handleGoogle(credential: string) {
    setBusy(true);
    const r = await loginWithGoogle(credential);
    setBusy(false);
    if (r.ok) {
      toast("Signed in with Google 🎉", "success");
      afterLogin();
    } else if (r.pending) {
      toast(r.error ?? "Your account is awaiting admin approval.", "info");
    } else {
      toast(r.error ?? "Google sign-in failed", "error");
    }
  }

  return (
    <div className="animate-rise">
      <h1 className="font-display text-3xl font-extrabold text-mist-100">Welcome back!</h1>
      <p className="mt-2 text-mist-300">Log in to continue to LotusPlay Connect</p>

      {endedNotice && (
        <div className="mt-5 rounded-xl border border-amber-500/25 bg-amber-500/[0.08] px-4 py-3 text-sm text-amber-200">
          {endedNotice}
        </div>
      )}

      {/* Admin custom uploads targeted at the login screen (public — no account). */}
      <CustomUploads placement="login" className="mt-5" />

      {/* Tabs — Username (admin-provided) or Mobile OTP */}
      {otpLogin && (
      <div className="mt-7 grid grid-cols-2 gap-1 rounded-xl bg-ink-800/80 p-1">
        {(["username", "mobile"] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={
              "flex items-center justify-center gap-2 rounded-lg py-2.5 text-sm font-semibold capitalize transition " +
              (tab === t ? "bg-lotus-600 text-white" : "text-mist-400 hover:text-mist-100")
            }
          >
            {t === "mobile" ? <Smartphone className="size-4" /> : <AtSign className="size-4" />}
            {t === "mobile" ? "Mobile" : "Username"}
          </button>
        ))}
      </div>
      )}

      {otpLogin && tab === "mobile" ? (
        <form onSubmit={handleSendOtp} className="mt-6 space-y-4">
          <Field label="Mobile number">
            <div className="flex gap-2">
              <select
                value={countryIdx}
                onChange={(e) => setCountryIdx(Number(e.target.value))}
                aria-label="Country code"
                className="h-12 shrink-0 rounded-xl border border-line bg-ink-800 px-2 text-sm font-medium text-mist-100 outline-none focus:border-lotus-400"
              >
                {COUNTRIES.map((c, i) => (
                  <option key={`${c.name}-${i}`} value={i}>{c.flag} {c.dial}</option>
                ))}
              </select>
              <Input
                inputMode="numeric"
                placeholder="50 123 4567"
                value={phone}
                onChange={(e) => setPhone(e.target.value.replace(/[^\d ]/g, ""))}
                maxLength={11}
              />
            </div>
          </Field>
          <Button type="submit" block size="lg" disabled={busy}>
            {busy ? "Sending…" : "Send OTP"} <ArrowRight className="size-4" />
          </Button>
        </form>
      ) : (
        <form onSubmit={handleUsernameLogin} className="mt-6 space-y-4">
          <Field label="Username" hint="Use the username your administrator gave you.">
            <Input
              placeholder="your-username"
              icon={<AtSign className="size-4" />}
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value.replace(/\s/g, ""))}
              autoCapitalize="none"
            />
          </Field>
          <Field label="Password">
            <div className="relative">
              <Input
                type={showPw ? "text" : "password"}
                placeholder="••••••••"
                icon={<Lock className="size-4" />}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="pr-11"
              />
              <button
                type="button"
                onClick={() => setShowPw((s) => !s)}
                aria-label={showPw ? "Hide password" : "Show password"}
                title={showPw ? "Hide password" : "Show password"}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-mist-400 transition hover:text-mist-100"
              >
                {showPw ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
              </button>
            </div>
          </Field>
          <div className="flex justify-end">
            <Link href="/forgot" className="text-sm text-lotus-300 hover:text-lotus-200">
              Forgot password?
            </Link>
          </div>
          <Button type="submit" block size="lg" disabled={busy}>
            {busy ? "Logging in…" : "Log in"}
          </Button>
        </form>
      )}

      {/* Divider */}
      <div className="my-6 flex items-center gap-3 text-xs text-mist-500">
        <span className="h-px flex-1 bg-black/10" /> OR <span className="h-px flex-1 bg-black/10" />
      </div>

      {/* Google account login */}
      {googleConfigured ? (
        <GoogleSignIn onCredential={handleGoogle} />
      ) : (
        <p className="rounded-xl border border-line bg-ink-800/60 px-3 py-2.5 text-center text-xs text-mist-400">
          Google sign-in will appear here once configured.
        </p>
      )}

      <p className="mt-7 text-center text-sm text-mist-400">
        Don&apos;t have an account?{" "}
        <Link href={nextTarget ? `/signup?next=${encodeURIComponent(nextTarget)}` : "/signup"} className="font-semibold text-lotus-300 hover:text-lotus-200">
          Request an account
        </Link>
      </p>
    </div>
  );
}
