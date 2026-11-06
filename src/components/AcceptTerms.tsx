"use client";

import { useState } from "react";
import Link from "next/link";
import { LotusMark } from "@/components/Logo";
import { Button } from "@/components/ui/Button";
import { withBase } from "@/lib/base-path";
import { ShieldCheck, FileText, Check } from "lucide-react";

// Shown once after a user's first login. They must accept the Terms &
// Conditions and the Privacy Policy before reaching the Home page.
export function AcceptTerms({
  onAccepted,
  onDecline,
}: {
  onAccepted: () => void;
  onDecline: () => void;
}) {
  const [terms, setTerms] = useState(false);
  const [privacy, setPrivacy] = useState(false);
  const [busy, setBusy] = useState(false);
  const both = terms && privacy;

  const accept = async () => {
    if (!both) return;
    setBusy(true);
    try {
      await fetch(withBase("/api/users/accept-terms"), { method: "POST", credentials: "include" });
      onAccepted();
    } catch {
      setBusy(false);
    }
  };

  const Row = ({
    checked,
    onToggle,
    children,
  }: {
    checked: boolean;
    onToggle: () => void;
    children: React.ReactNode;
  }) => (
    <button
      type="button"
      onClick={onToggle}
      className="flex w-full items-start gap-3 rounded-xl border border-line bg-ink-800 px-3.5 py-3 text-left transition hover:border-lotus-400/40"
    >
      <span
        className={
          "mt-0.5 grid size-5 shrink-0 place-items-center rounded-md border " +
          (checked ? "border-lotus-400 bg-lotus-500 text-white" : "border-mist-500")
        }
      >
        {checked && <Check className="size-3.5" />}
      </span>
      <span className="text-sm text-mist-200">{children}</span>
    </button>
  );

  return (
    <div className="grid min-h-dvh place-items-center bg-ink-900 px-4 py-10">
      <div className="w-full max-w-md rounded-2xl border border-white/12 bg-ink-850 p-6 shadow-[0_24px_60px_-20px_rgba(0,0,0,0.8)] sm:p-8">
        <div className="flex flex-col items-center text-center">
          <LotusMark className="size-14" />
          <h1 className="mt-4 font-display text-xl font-extrabold text-mist-100">Before you continue</h1>
          <p className="mt-2 text-sm text-mist-400">
            Please review and accept our Terms &amp; Conditions and Privacy Policy to use LotusPlay Connect.
          </p>
        </div>

        <div className="mt-6 space-y-2.5">
          <Row checked={terms} onToggle={() => setTerms((v) => !v)}>
            I have read and agree to the{" "}
            <Link href="/legal/terms" target="_blank" className="font-semibold text-lotus-300 underline">
              Terms &amp; Conditions
            </Link>
            .
          </Row>
          <Row checked={privacy} onToggle={() => setPrivacy((v) => !v)}>
            I have read and agree to the{" "}
            <Link href="/legal/privacy" target="_blank" className="font-semibold text-lotus-300 underline">
              Privacy Policy
            </Link>
            .
          </Row>
        </div>

        <div className="mt-5 flex items-start gap-2 rounded-xl bg-lotus-500/10 px-3.5 py-2.5 text-xs text-lotus-200/90">
          <ShieldCheck className="mt-0.5 size-4 shrink-0 text-lotus-300" />
          You can read the full documents anytime from the menu. By accepting, you agree to use the
          platform responsibly and follow our Community Guidelines.
        </div>

        <Button block size="lg" className="mt-5" disabled={!both || busy} onClick={accept}>
          <FileText className="size-4" /> {busy ? "Please wait…" : "Accept & Continue"}
        </Button>
        <button
          onClick={onDecline}
          className="mt-3 w-full text-center text-xs text-mist-500 hover:text-mist-300"
        >
          Decline and log out
        </button>
      </div>
    </div>
  );
}
