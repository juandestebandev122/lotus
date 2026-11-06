"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/components/ui/Toast";
import { Button } from "@/components/ui/Button";
import { Field, Input } from "@/components/ui/Input";
import { ageFromDob, MIN_AGE, UNDERAGE_MESSAGE } from "@/lib/age";
import { withBase } from "@/lib/base-path";
import { User, Smartphone, Calendar, Mail, AtSign, Lock, MailCheck, Clock, ShieldCheck, Check, Gift } from "lucide-react";

interface RequiredPolicy { slug: string; title: string }

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

type Stage = "form" | "verify" | "waiting";

export default function SignupPage() {
  const [stage, setStage] = useState<Stage>("form");
  const [name, setName] = useState("");
  const [dob, setDob] = useState("");
  const [gender, setGender] = useState<"male" | "female" | "">("");
  const [countryIdx, setCountryIdx] = useState(0);
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  // Live username availability — checked as the user types (debounced), so a
  // "Username already exists" message shows BEFORE they submit.
  const [unameStatus, setUnameStatus] = useState<"idle" | "checking" | "available" | "taken" | "invalid">("idle");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [otpBusy, setOtpBusy] = useState(false);
  const [otpOn, setOtpOn] = useState(false);
  const [otpLen, setOtpLen] = useState(6);
  const [otpCode, setOtpCode] = useState("");
  const [otpDemo, setOtpDemo] = useState("");
  const [otpWait, setOtpWait] = useState(0);

  // Referral code ("Refer a friend") — prefilled from ?ref= in the invite link.
  const [ref, setRef] = useState("");
  useEffect(() => {
    if (typeof window === "undefined") return;
    const r = (new URLSearchParams(window.location.search).get("ref") || "").trim().replace(/^@/, "").toLowerCase();
    if (r) setRef(r);
  }, []);

  // Required legal policies the user must accept to register (admin-managed).
  const [policies, setPolicies] = useState<RequiredPolicy[]>([]);
  const [agreed, setAgreed] = useState(false);
  useEffect(() => {
    let on = true;
    fetch(withBase("/api/admin/config"), { credentials: "include" })
      .then((r) => r.json())
      .then((d) => {
        if (!on) return;
        const list = (d?.config?.policies ?? []) as { slug: string; title: string; requiredAtSignup?: boolean }[];
        setPolicies(list.filter((p) => p.requiredAtSignup !== false).map((p) => ({ slug: p.slug, title: p.title })));
      })
      .catch(() => {});
    return () => { on = false; };
  }, []);

  useEffect(() => {
    fetch(withBase("/api/auth/otp/options"), { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => {
        setOtpOn(d?.registrationEnabled === true);
        const n = Number(d?.otpLength);
        if (n >= 4 && n <= 8) setOtpLen(n);
        const dial = typeof d?.countryCode === "string" ? d.countryCode : "";
        const i = COUNTRIES.findIndex((c) => c.dial === dial);
        if (i >= 0) setCountryIdx(i);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (otpWait <= 0) return;
    const t = setTimeout(() => setOtpWait((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [otpWait]);

  // verification stage
  const [userId, setUserId] = useState("");
  const [demoCode, setDemoCode] = useState<string | undefined>();
  const [code, setCode] = useState("");

  const { requestAccount, verifyEmail, sendOtp } = useAuth();
  const { toast } = useToast();

  // Debounced live username availability check.
  useEffect(() => {
    const u = username.trim().toLowerCase();
    if (!u) { setUnameStatus("idle"); return; }
    if (!/^[a-z0-9._]{3,20}$/.test(u)) { setUnameStatus("invalid"); return; }
    setUnameStatus("checking");
    let alive = true;
    const t = setTimeout(async () => {
      try {
        const res = await fetch(withBase(`/api/auth/username-available?u=${encodeURIComponent(u)}`), { cache: "no-store" });
        const d = await res.json();
        if (!alive) return;
        setUnameStatus(d?.valid === false ? "invalid" : d?.available ? "available" : "taken");
      } catch { if (alive) setUnameStatus("idle"); }
    }, 400);
    return () => { alive = false; clearTimeout(t); };
  }, [username]);

  const DUPLICATE_MSG = "Username already exists. Please choose a different username.";

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return toast("Please enter your name", "error");
    if (!dob) return toast("Please enter your date of birth", "error");
    const age = ageFromDob(dob);
    if (age === null) return toast("Please enter a valid date of birth", "error");
    if (age < MIN_AGE) return toast(UNDERAGE_MESSAGE, "error");
    if (!gender) return toast("Please select your gender", "error");
    if (phone.replace(/\D/g, "").length < 10) return toast("Enter a valid mobile number", "error");
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email.trim())) return toast("Enter a valid email address", "error");
    if (!/^[a-z0-9._]{3,20}$/.test(username.trim())) return toast("Username must be 3–20 characters (letters, numbers, . or _)", "error");
    if (unameStatus === "taken") return toast(DUPLICATE_MSG, "error");
    if (password.length < 8) return toast("Password must be at least 8 characters", "error");
    if (password !== confirm) return toast("Passwords do not match", "error");
    if (policies.length > 0 && !agreed) return toast("Please accept the Terms & policies to continue", "error");
    if (otpOn && otpCode.trim().length < otpLen) return toast("Enter the code sent to your mobile number", "error");

    setBusy(true);
    const r = await requestAccount({
      name: name.trim(), dob, gender, phone: `${COUNTRIES[countryIdx].dial} ${phone}`,
      email: email.trim(), username: username.trim().toLowerCase(), password,
      acceptedPolicies: policies.map((p) => p.slug),
      ref: ref.trim() || undefined,
      otp: otpOn ? otpCode.trim() : undefined,
    });
    setBusy(false);
    if (r.ok) {
      setUserId(r.userId ?? "");
      setDemoCode(r.demoCode);
      setStage("verify");
    } else {
      // Server-side final guard (in case the username was taken between the live
      // check and submit) — show the same clear duplicate message.
      const err = r.error ?? "Could not submit your request";
      if (/username/i.test(err) && /taken|exist/i.test(err)) { setUnameStatus("taken"); toast(DUPLICATE_MSG, "error"); }
      else toast(err, "error");
    }
  }

  async function handleVerify(e: React.FormEvent) {
    e.preventDefault();
    if (code.trim().length < 4) return toast("Enter the verification code", "error");
    setBusy(true);
    const r = await verifyEmail(userId, code.trim());
    setBusy(false);
    if (r.ok) setStage("waiting");
    else toast(r.error ?? "Verification failed", "error");
  }

  // ── Stage 3: waiting for admin approval ──
  if (stage === "waiting") {
    return (
      <div className="animate-rise text-center">
        <span className="mx-auto grid size-16 place-items-center rounded-2xl bg-amber-500/15 text-amber-300"><Clock className="size-9" /></span>
        <h1 className="mt-5 font-display text-2xl font-extrabold text-mist-100">Waiting for Admin Approval</h1>
        <p className="mt-2 text-mist-300">
          Thanks, {name.trim().split(" ")[0]}! Your email is verified and your account request has been sent to our team.
          You&apos;ll be able to sign in <span className="font-semibold text-mist-100">once an administrator approves your account</span>.
        </p>
        <div className="mt-4 flex items-start gap-2 rounded-xl border border-lotus-400/20 bg-lotus-500/10 px-3 py-2.5 text-left text-xs text-lotus-100">
          <ShieldCheck className="mt-0.5 size-4 shrink-0 text-lotus-300" />
          <span>You signed up as <b>@{username.trim().toLowerCase()}</b>. After approval, log in with your username &amp; password (or Mobile / Google).</span>
        </div>
        <Link href="/login" className="mt-6 inline-flex items-center justify-center rounded-xl bg-lotus-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-lotus-500">
          Back to login
        </Link>
      </div>
    );
  }

  // ── Stage 2: verify email ──
  if (stage === "verify") {
    return (
      <div className="animate-rise text-center">
        <span className="mx-auto grid size-16 place-items-center rounded-2xl bg-lotus-500/15 text-lotus-300"><MailCheck className="size-9" /></span>
        <h1 className="mt-5 font-display text-2xl font-extrabold text-mist-100">Verify your email</h1>
        <p className="mt-2 text-mist-300">
          We&apos;ve sent a verification code to <span className="font-semibold text-mist-100">{email.trim()}</span>.
          Enter it below to confirm your email before admin review.
        </p>
        {demoCode && (
          <p className="mt-3 rounded-xl border border-amber-400/20 bg-amber-500/10 px-3 py-2 text-sm text-amber-200">
            Demo code (email delivery not yet configured): <span className="font-mono font-bold">{demoCode}</span>
          </p>
        )}
        <form onSubmit={handleVerify} className="mt-5 space-y-3 text-left">
          <Field label="Verification code">
            <Input inputMode="numeric" placeholder="6-digit code" value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))} icon={<MailCheck className="size-4" />} />
          </Field>
          <Button type="submit" block size="lg" disabled={busy}>{busy ? "Verifying…" : "Verify email"}</Button>
        </form>
      </div>
    );
  }

  // ── Stage 1: sign-up form ──
  return (
    <div className="animate-rise">
      <h1 className="font-display text-3xl font-extrabold text-mist-100">Create your account</h1>
      <p className="mt-2 text-mist-400">Verify your email, then an admin reviews &amp; approves your account.</p>

      <div className="mt-4 flex items-start gap-2 rounded-xl border border-lotus-400/20 bg-lotus-500/10 px-3 py-2.5 text-xs text-lotus-100">
        <ShieldCheck className="mt-0.5 size-4 shrink-0 text-lotus-300" />
        <span>New accounts need admin approval. You&apos;ll see &ldquo;Waiting for Admin Approval&rdquo; until an administrator activates your account.</span>
      </div>

      <form onSubmit={handleSubmit} className="mt-6 space-y-4">
        <Field label="Full name">
          <Input placeholder="Your full name" icon={<User className="size-4" />} value={name} onChange={(e) => setName(e.target.value)} />
        </Field>

        <Field label="Date of birth" hint="You must be at least 18 years old to join.">
          <Input type="date" icon={<Calendar className="size-4" />} value={dob} max={new Date().toISOString().slice(0, 10)} onChange={(e) => setDob(e.target.value)} />
        </Field>

        <div>
          <label className="mb-1.5 block text-sm font-semibold text-mist-200">Gender</label>
          <div className="grid grid-cols-2 gap-2">
            {(["male", "female"] as const).map((g) => (
              <button key={g} type="button" onClick={() => setGender(g)} className={`h-11 rounded-xl border text-sm font-semibold capitalize transition ${gender === g ? "border-lotus-400 bg-lotus-500/15 text-lotus-100" : "border-line bg-ink-800 text-mist-300 hover:text-mist-100"}`}>{g}</button>
            ))}
          </div>
        </div>

        <Field label="Mobile number">
          <div className="flex gap-2">
            <select value={countryIdx} onChange={(e) => setCountryIdx(Number(e.target.value))} aria-label="Country code" className="h-12 shrink-0 rounded-xl border border-line bg-ink-800 px-2 text-sm font-medium text-mist-100 outline-none focus:border-lotus-400">
              {COUNTRIES.map((c, i) => (<option key={`${c.name}-${i}`} value={i}>{c.flag} {c.dial}</option>))}
            </select>
            <Input inputMode="numeric" placeholder="50 123 4567" icon={<Smartphone className="size-4" />} value={phone} onChange={(e) => setPhone(e.target.value.replace(/[^\d ]/g, ""))} maxLength={11} />
          </div>
        </Field>

        {otpOn && (
          <Field label="Mobile code" hint="We text this code before your account request is sent.">
            <div className="flex gap-2">
              <Input inputMode="numeric" placeholder={`${otpLen}-digit code`} value={otpCode} onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, "").slice(0, otpLen))} />
              <button
                type="button"
                disabled={otpBusy || otpWait > 0}
                onClick={async () => {
                  if (phone.replace(/\D/g, "").length < 10) { toast("Enter a valid mobile number first", "error"); return; }
                  setOtpBusy(true);
                  const r = await sendOtp(`${COUNTRIES[countryIdx].dial} ${phone}`, "register");
                  setOtpBusy(false);
                  if (!r.ok) { toast(r.error ?? "Could not send the code", "error"); return; }
                  setOtpDemo(r.demoCode ?? "");
                  const wait = Number(sessionStorage.getItem("lotus.otp.resend") || "30");
                  setOtpWait(wait > 0 ? wait : 30);
                  toast(r.demoCode ? `Code sent. Demo code: ${r.demoCode}` : "Code sent to your mobile number", "success");
                }}
                className="h-12 shrink-0 rounded-xl bg-ink-700 px-3 text-sm font-semibold text-mist-100 disabled:opacity-50"
              >
                {otpWait > 0 ? `${otpWait}s` : otpBusy ? "Sending…" : "Send code"}
              </button>
            </div>
            {otpDemo && (
              <p className="mt-2 text-xs text-amber-200">SMS is not connected yet. Demo code: <span className="font-mono font-bold">{otpDemo}</span></p>
            )}
          </Field>
        )}

        <Field label="Email ID" hint="Required — we'll send a verification code here.">
          <Input type="email" placeholder="you@example.com" icon={<Mail className="size-4" />} value={email} onChange={(e) => setEmail(e.target.value)} />
        </Field>

        <Field label="Username" hint="You'll use this to log in.">
          <Input placeholder="your-username" icon={<AtSign className="size-4" />} value={username} onChange={(e) => setUsername(e.target.value.replace(/\s/g, "").toLowerCase())} autoCapitalize="none" />
          {unameStatus === "checking" && <p className="mt-1 text-[11px] text-mist-400">Checking availability…</p>}
          {unameStatus === "taken" && <p className="mt-1 flex items-center gap-1 text-[11px] font-semibold text-rose-300">⚠ Username already exists. Please choose a different username.</p>}
          {unameStatus === "available" && <p className="mt-1 flex items-center gap-1 text-[11px] font-semibold text-emerald-300">✓ Username is available.</p>}
          {unameStatus === "invalid" && username.trim().length > 0 && <p className="mt-1 text-[11px] text-mist-400">3–20 characters — letters, numbers, . or _</p>}
        </Field>

        <Field label="Password" hint="At least 8 characters.">
          <Input type="password" placeholder="Create a password" icon={<Lock className="size-4" />} value={password} onChange={(e) => setPassword(e.target.value)} />
        </Field>

        <Field label="Confirm password">
          <Input type="password" placeholder="Re-enter password" icon={<Lock className="size-4" />} value={confirm} onChange={(e) => setConfirm(e.target.value)} />
        </Field>

        <Field label="Referral code (optional)" hint="Got an invite from a friend? Enter their code so they earn their reward.">
          <Input placeholder="Friend's username" icon={<Gift className="size-4" />} value={ref} onChange={(e) => setRef(e.target.value.replace(/\s/g, "").toLowerCase())} autoCapitalize="none" />
        </Field>

        {/* Required legal acceptance — admin-managed policies */}
        {policies.length > 0 && (
          <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-line bg-ink-800/60 p-3.5">
            <button
              type="button"
              onClick={() => setAgreed((a) => !a)}
              aria-pressed={agreed}
              className={`mt-0.5 grid size-5 shrink-0 place-items-center rounded-md border transition ${agreed ? "border-lotus-400 bg-lotus-500 text-white" : "border-line bg-ink-900 text-transparent"}`}
            >
              <Check className="size-3.5" />
            </button>
            <span className="text-xs leading-relaxed text-mist-300">
              I confirm I am 18+ and I have read and agree to the{" "}
              {policies.map((p, i) => (
                <span key={p.slug}>
                  <Link href={`/policies/${p.slug}`} target="_blank" className="font-semibold text-lotus-300 underline-offset-2 hover:underline">
                    {p.title}
                  </Link>
                  {i < policies.length - 2 ? ", " : i === policies.length - 2 ? " and " : ""}
                </span>
              ))}
              .
            </span>
          </label>
        )}

        <Button type="submit" block size="lg" disabled={busy || (policies.length > 0 && !agreed)}>{busy ? "Submitting…" : "Create account"}</Button>
      </form>

      <p className="mt-5 text-center text-sm text-mist-400">
        Already have an account?{" "}
        <Link href="/login" className="font-semibold text-lotus-300 hover:text-lotus-200">Log in</Link>
      </p>
    </div>
  );
}
