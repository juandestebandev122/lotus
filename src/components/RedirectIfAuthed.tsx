"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth";
import { withBase } from "@/lib/base-path";

/**
 * Bounces a SIGNED-IN user away from public/auth pages (landing, login, signup)
 * to /home. Without this, navigating BACK to the marketing landing shows the
 * "Log in" buttons and looks like a logout even though the session is intact.
 */
export function RedirectIfAuthed({ to = "/home" }: { to?: string }) {
  const { isAuthed, loading } = useAuth();
  const router = useRouter();
  useEffect(() => {
    if (!loading && isAuthed) router.replace(withBase(to));
  }, [isAuthed, loading, router, to]);
  return null;
}
