"use client";

import { KycPanel } from "@/components/admin/KycPanel";
import { ShieldCheck } from "lucide-react";

/** Dedicated KYC Management page (the same review panel also shown under
 *  Financial → KYC Verification) — surfaced as its own admin menu so it's easy to find. */
export default function AdminKycPage() {
  return (
    <div className="space-y-4">
      <div>
        <h1 className="flex items-center gap-2 font-display text-2xl font-extrabold text-mist-100"><ShieldCheck className="size-6 text-lotus-300" /> KYC Management</h1>
        <p className="mt-1 text-sm text-mist-400">Review, approve, reject or request re-submission of user identity (KYC) verifications and bank details. Withdrawals are gated on approved KYC.</p>
      </div>
      <KycPanel />
    </div>
  );
}
