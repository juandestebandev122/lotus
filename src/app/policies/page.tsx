"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, FileText, ChevronRight } from "lucide-react";
import { withBase } from "@/lib/base-path";

interface PolicyDoc {
  id: string;
  slug: string;
  title: string;
  body: string;
  requiredAtSignup: boolean;
  updatedAt: string;
}

// Public index of all legal policies. No login required.
export default function PoliciesIndex() {
  const [policies, setPolicies] = useState<PolicyDoc[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let on = true;
    fetch(withBase("/api/admin/config"), { credentials: "include" })
      .then((r) => r.json())
      .then((d) => { if (on) setPolicies(d?.config?.policies ?? []); })
      .catch(() => {})
      .finally(() => on && setLoading(false));
    return () => { on = false; };
  }, []);

  return (
    <div className="mx-auto min-h-dvh max-w-2xl px-4 py-8">
      <Link href="/login" className="inline-flex items-center gap-2 text-sm text-lotus-300 hover:text-lotus-200">
        <ArrowLeft className="size-4" /> Back
      </Link>
      <h1 className="mt-4 font-display text-3xl font-extrabold text-mist-100">Policies & Terms</h1>
      <p className="mt-1 text-sm text-mist-400">Please review the documents below. You accept these when you create an account.</p>

      {loading ? (
        <p className="mt-8 text-center text-sm text-mist-400">Loading…</p>
      ) : (
        <div className="mt-6 space-y-2">
          {policies.map((p) => (
            <Link
              key={p.id}
              href={`/policies/${p.slug}`}
              className="flex items-center gap-3 rounded-xl border border-white/10 bg-ink-850/60 px-4 py-3.5 transition hover:border-lotus-400/40 hover:bg-ink-800"
            >
              <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-lotus-500/15 text-lotus-300"><FileText className="size-4.5" /></span>
              <span className="min-w-0 flex-1">
                <span className="block truncate font-semibold text-mist-100">{p.title}</span>
                <span className="block truncate text-xs text-mist-500">{p.body.split("\n").find((l) => l.trim())?.slice(0, 70)}…</span>
              </span>
              {p.requiredAtSignup && <span className="shrink-0 rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-semibold text-amber-300">Required</span>}
              <ChevronRight className="size-4 shrink-0 text-mist-500" />
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
