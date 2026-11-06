"use client";

import { passwordChecks } from "@/lib/password";
import { Check, X } from "lucide-react";

// Live requirement checklist shown under a new-password field.
export function PasswordChecklist({ value }: { value: string }) {
  if (!value) return null;
  return (
    <ul className="mt-2 grid gap-1 sm:grid-cols-2">
      {passwordChecks(value).map((c) => (
        <li key={c.label} className={`flex items-center gap-1.5 text-[11px] ${c.met ? "text-emerald-300" : "text-mist-500"}`}>
          {c.met ? <Check className="size-3.5 shrink-0" /> : <X className="size-3.5 shrink-0" />}
          {c.label}
        </li>
      ))}
    </ul>
  );
}
