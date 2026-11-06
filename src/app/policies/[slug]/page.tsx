"use client";

import { useEffect, useState, use } from "react";
import Link from "next/link";
import { ArrowLeft, FileText } from "lucide-react";
import { withBase } from "@/lib/base-path";

interface PolicyDoc {
  id: string;
  slug: string;
  title: string;
  body: string;
  requiredAtSignup: boolean;
  updatedAt: string;
}

// Public, read-only view of a single legal policy. Opened from the sign-up
// acceptance links and the /policies index. No login required.
export default function PolicyPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params);
  const [policy, setPolicy] = useState<PolicyDoc | null | undefined>(undefined);

  useEffect(() => {
    let on = true;
    fetch(withBase("/api/admin/config"), { credentials: "include" })
      .then((r) => r.json())
      .then((d) => {
        if (!on) return;
        const list: PolicyDoc[] = d?.config?.policies ?? [];
        setPolicy(list.find((p) => p.slug === slug) ?? null);
      })
      .catch(() => on && setPolicy(null));
    return () => { on = false; };
  }, [slug]);

  return (
    <div className="mx-auto min-h-dvh max-w-2xl px-4 py-8">
      <Link href="/policies" className="inline-flex items-center gap-2 text-sm text-lotus-300 hover:text-lotus-200">
        <ArrowLeft className="size-4" /> All policies
      </Link>

      {policy === undefined && <p className="mt-10 text-center text-sm text-mist-400">Loading…</p>}
      {policy === null && (
        <div className="mt-10 text-center">
          <h1 className="font-display text-2xl font-bold text-mist-100">Policy not found</h1>
          <Link href="/policies" className="mt-3 inline-block text-sm text-lotus-300">← Back to policies</Link>
        </div>
      )}

      {policy && (
        <article className="mt-5 rounded-2xl border border-white/10 bg-ink-850/60 p-5 sm:p-7">
          <div className="mb-4 flex items-center gap-2.5">
            <span className="grid size-9 place-items-center rounded-xl bg-lotus-500/15 text-lotus-300"><FileText className="size-5" /></span>
            <div>
              <h1 className="font-display text-2xl font-extrabold text-mist-100">{policy.title}</h1>
              <p className="text-xs text-mist-500">Last updated {new Date(policy.updatedAt).toLocaleDateString()}</p>
            </div>
          </div>
          <div className="space-y-3 text-sm leading-relaxed text-mist-200">
            {policy.body.split("\n").map((line, i) =>
              line.trim() === "" ? <div key={i} className="h-1" /> : <p key={i}>{line}</p>,
            )}
          </div>
        </article>
      )}
    </div>
  );
}
