"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth, DEMO_OTP } from "@/lib/auth";
import { useToast } from "@/components/ui/Toast";
import { Button } from "@/components/ui/Button";
import { withBase } from "@/lib/base-path";
import { ArrowLeft } from "lucide-react";

export default function VerifyPage() {
  const [len, setLen] = useState(6);
  const [digits, setDigits] = useState<string[]>(Array(6).fill(""));
  const [identifier, setIdentifier] = useState("");
  const [seconds, setSeconds] = useState(30);
  const [resendWait, setResendWait] = useState(30);
  const [busy, setBusy] = useState(false);
  const [demoMode, setDemoMode] = useState(false);
  const [demoCode, setDemoCode] = useState(DEMO_OTP);
  const inputs = useRef<Array<HTMLInputElement | null>>([]);
  const { verifyOtp, sendOtp } = useAuth();
  const { toast } = useToast();
  const router = useRouter();

  useEffect(() => {
    const id = sessionStorage.getItem("lotus.otp.identifier");
    if (id) setIdentifier(id);
    const n = Number(sessionStorage.getItem("lotus.otp.length") || "6");
    const length = n >= 4 && n <= 8 ? n : 6;
    setLen(length);
    setDigits(Array(length).fill(""));
    const wait = Number(sessionStorage.getItem("lotus.otp.resend") || "30");
    const secondsWait = wait >= 15 && wait <= 300 ? wait : 30;
    setResendWait(secondsWait);
    setSeconds(secondsWait);
    setDemoMode(sessionStorage.getItem("lotus.otp.demo") === "1");
    const stored = sessionStorage.getItem("lotus.otp.demoCode");
    if (stored) setDemoCode(stored);
    inputs.current[0]?.focus();
  }, []);

  useEffect(() => {
    if (seconds <= 0) return;
    const t = setTimeout(() => setSeconds((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [seconds]);

  function setDigit(i: number, val: string) {
    const v = val.replace(/\D/g, "").slice(-1);
    setDigits((d) => {
      const next = [...d];
      next[i] = v;
      return next;
    });
    if (v && i < len - 1) inputs.current[i + 1]?.focus();
  }

  function onKeyDown(i: number, e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Backspace" && !digits[i] && i > 0) {
      inputs.current[i - 1]?.focus();
    }
  }

  function onPaste(e: React.ClipboardEvent) {
    const text = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, len);
    if (text.length) {
      e.preventDefault();
      setDigits(text.padEnd(len, "").split("").slice(0, len).map((c) => c || ""));
      inputs.current[Math.min(text.length, len - 1)]?.focus();
    }
  }

  async function handleVerify(e?: React.FormEvent) {
    e?.preventDefault();
    const code = digits.join("");
    if (code.length < len) {
      toast(`Enter the full ${len}-digit code`, "error");
      return;
    }
    setBusy(true);
    const res = await verifyOtp(code);
    setBusy(false);
    if (res.ok) {
      toast("Verified! Welcome to LotusPlay Connect 🎉", "success");
      // Return to the shared-link destination (e.g. a room) if one was carried
      // through from the login page; otherwise Home.
      let dest = "";
      try {
        const n = new URLSearchParams(window.location.search).get("next");
        if (n && n.startsWith("/") && !n.startsWith("//") && !n.startsWith("/login")) dest = n;
      } catch { /* ignore */ }
      window.location.assign(dest || withBase("/home"));
    } else {
      toast(res.error ?? "Incorrect code. Try the demo code shown below.", "error");
    }
  }

  async function resend() {
    const r = await sendOtp(identifier);
    setSeconds(resendWait);
    setDemoMode(sessionStorage.getItem("lotus.otp.demo") === "1");
    const stored = sessionStorage.getItem("lotus.otp.demoCode");
    if (stored) setDemoCode(stored);
    toast(r?.demoCode ? `OTP resent. Demo code: ${r.demoCode}` : "OTP resent to your phone", "info");
  }

  function useDemoCode() {
    setDigits(demoCode.split("").slice(0, len));
    inputs.current[Math.max(0, Math.min(demoCode.length, len) - 1)]?.focus();
  }

  return (
    <div className="animate-rise">
      <Link href="/login" className="mb-6 inline-flex items-center gap-2 text-sm text-mist-400 hover:text-mist-100">
        <ArrowLeft className="size-4" /> Back
      </Link>
      <h1 className="font-display text-3xl font-extrabold text-mist-100">Verify your number</h1>
      <p className="mt-2 text-mist-400">
        Enter the {len}-digit code sent to{" "}
        <span className="font-semibold text-mist-200">{identifier}</span>
      </p>

      <form onSubmit={handleVerify} className="mt-8">
        <div className="flex justify-between gap-2" onPaste={onPaste}>
          {digits.map((d, i) => (
            <input
              key={i}
              ref={(el) => {
                inputs.current[i] = el;
              }}
              inputMode="numeric"
              maxLength={1}
              value={d}
              onChange={(e) => setDigit(i, e.target.value)}
              onKeyDown={(e) => onKeyDown(i, e)}
              className="size-12 rounded-xl border border-line bg-ink-800 text-center text-xl font-bold text-mist-100 outline-none transition focus:border-lotus-400 focus:ring-2 focus:ring-lotus-500/25 sm:size-14"
            />
          ))}
        </div>

        <div className="mt-5 text-center text-sm text-mist-400">
          {seconds > 0 ? (
            <>Resend code in <span className="font-semibold text-mist-200">0:{seconds.toString().padStart(2, "0")}</span></>
          ) : (
            <button type="button" onClick={resend} className="font-semibold text-lotus-300 hover:text-lotus-200">
              Resend OTP
            </button>
          )}
        </div>

        <Button type="submit" block size="lg" className="mt-6" disabled={busy}>
          {busy ? "Verifying…" : "Verify & Continue"}
        </Button>
      </form>

      {demoMode && (
        <div className="mt-6 rounded-xl border border-gold-400/25 bg-gold-400/10 px-4 py-3 text-center text-xs text-gold-300">
          Demo mode — use code <span className="font-mono font-bold">{demoCode}</span>. Connect an SMS
          provider in Admin → Settings to text real codes.
          <button
            type="button"
            onClick={useDemoCode}
            className="mt-2 block w-full rounded-lg bg-gold-400/20 py-2 text-sm font-semibold text-gold-200 transition hover:bg-gold-400/30"
          >
            Tap to fill demo code
          </button>
        </div>
      )}
    </div>
  );
}
