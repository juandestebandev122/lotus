"use client";

/**
 * Inactivity Detection & Auto Logout — the user-facing half.
 *
 * ⚠ READ THIS BEFORE CHANGING ANYTHING HERE.
 * Version v160 removed an earlier 3-minute idle auto-logout because it counted
 * time while the app was merely in the BACKGROUND, so people came back to the app
 * signed out. That was a serious, much-complained-about bug.
 *
 * This implementation therefore:
 *   • ships DISABLED (config.inactivity.enabled defaults to false);
 *   • ignores background time unless an admin explicitly turns on
 *     `backgroundMonitor`, and even then only counts it while the app is open;
 *   • resets the idle clock the moment the user returns to the app;
 *   • never signs anyone out without first showing a warning they can cancel;
 *   • exempts admins by default.
 */

import { useEffect, useRef, useState } from "react";
import { useConfig } from "@/lib/config";
import { useAuth } from "@/lib/auth";
import { withBase } from "@/lib/base-path";
import { idleMs, isBackgrounded, markActive } from "@/lib/use-activity";
import { AlertTriangle } from "lucide-react";

export function InactivityGuard() {
  const { config } = useConfig();
  const { user, isAuthed } = useAuth();
  const cfg = config.inactivity ?? {};
  const [warnLeft, setWarnLeft] = useState<number | null>(null);
  const loggingOut = useRef(false);

  const enabled = cfg.enabled === true;
  const timeoutMs = Math.max(1, cfg.timeoutMinutes ?? 15) * 60_000;
  const warnSecs = Math.max(10, cfg.warningSeconds ?? 30);

  // Exemptions: admins (by default) and any admin-listed role.
  const exempt =
    (cfg.exemptAdmins !== false && user?.role === "admin") ||
    (!!user && (cfg.exemptRoles ?? []).some((r) => r && (user.role === r || user.adminRole === r)));

  useEffect(() => {
    if (!enabled || !isAuthed || exempt) { setWarnLeft(null); return; }
    let stopped = false;

    const tick = () => {
      if (stopped || loggingOut.current) return;
      // BACKGROUND SAFETY (the v160 bug). Unless the admin has deliberately turned
      // on background monitoring, idle time only accrues while the app is actually
      // on screen. Returning to the app also resets the clock (see use-activity).
      if (isBackgrounded() && cfg.backgroundMonitor !== true) { setWarnLeft(null); return; }
      const idle = idleMs();
      if (idle < timeoutMs) { setWarnLeft(null); return; }
      // Past the timeout — count down, then sign out.
      const overBy = idle - timeoutMs;
      const left = Math.ceil((warnSecs * 1000 - overBy) / 1000);
      if (left > 0) { setWarnLeft(left); return; }
      loggingOut.current = true;
      setWarnLeft(0);
      void doLogout(Math.round(idle / 60_000));
    };

    const t = setInterval(tick, 1000);
    tick();
    return () => { stopped = true; clearInterval(t); };
  }, [enabled, isAuthed, exempt, timeoutMs, warnSecs, cfg.backgroundMonitor]);

  // Tell the server WHY, so it lands in the audit trail as
  // "Auto Logout - Inactive User.", then clear the session locally.
  const doLogout = async (idleMinutes: number) => {
    try {
      await fetch(withBase("/api/auth/logout"), {
        method: "POST",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ reason: "inactive", idleMinutes }),
      });
    } catch { /* sign out locally regardless */ }
    try { sessionStorage.setItem("lotus.autoLogout", "1"); } catch { /* ignore */ }
    if (typeof window !== "undefined") window.location.assign(withBase("/login?reason=inactive"));
  };

  const stay = () => {
    markActive();
    setWarnLeft(null);
  };

  if (warnLeft === null) return null;

  return (
    <div className="fixed inset-0 z-[200] grid place-items-center bg-ink-950/80 p-4 backdrop-blur-sm" role="alertdialog" aria-modal="true" aria-labelledby="inactive-title">
      <div className="w-full max-w-sm rounded-2xl border border-line bg-ink-900 p-5 text-center shadow-2xl">
        <span className="mx-auto mb-3 grid size-12 place-items-center rounded-full bg-amber-500/15">
          <AlertTriangle className="size-6 text-amber-400" />
        </span>
        <h2 id="inactive-title" className="font-display text-lg font-bold text-mist-100">Are you still there?</h2>
        <p className="mt-2 text-sm text-mist-400">
          No activity detected. You will be logged out in{" "}
          <b className="tabular-nums text-amber-300">{Math.max(0, warnLeft)} seconds</b>{" "}
          unless you continue using the app.
        </p>
        <button
          onClick={stay}
          autoFocus
          className="mt-4 w-full rounded-xl bg-lotus-500 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-lotus-400"
        >
          I&apos;m still here
        </button>
      </div>
    </div>
  );
}
