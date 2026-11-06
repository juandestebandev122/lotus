"use client";

import { usePathname } from "next/navigation";
import { useConfig } from "@/lib/config";
import { CaptureGuard } from "@/components/CaptureGuard";

// Maps the current route to a capture-protection "module". The admin turns each
// module on in Admin → Screenshot Protection. /rooms, /wallet and /paid-zone are
// NOT listed here — those screens carry their own guard (so paid rooms/wallet stay
// protected regardless), avoiding a double guard.
const MODULE_FOR_PATH: { prefix: string; module: string; label: string }[] = [
  { prefix: "/messages", module: "chat", label: "chat" },
  { prefix: "/reels", module: "reels", label: "Reels" },
  { prefix: "/tournaments", module: "tournaments", label: "tournament" },
  { prefix: "/competitions", module: "competitions", label: "competition" },
  { prefix: "/profile", module: "profile", label: "profile" },
  { prefix: "/u", module: "profile", label: "profile" },
  { prefix: "/home", module: "home", label: "app" },
];

// Routes that mount their OWN CaptureGuard, so the master "all screens" switch skips
// them to avoid a double guard. NOTE: only the room DETAIL page (/rooms/<id>) self-guards
// — the /rooms LIST page does NOT, so the master switch must still cover the bare /rooms.
function isSelfGuarded(pathname: string): boolean {
  if (pathname === "/wallet" || pathname.startsWith("/wallet/")) return true;
  if (pathname === "/paid-zone" || pathname.startsWith("/paid-zone/")) return true;
  if (pathname.startsWith("/rooms/")) return true; // room detail only; NOT the "/rooms" list
  return false;
}

/** App-wide, config-driven capture deterrent. Mounted once in the app shell. When the
 *  admin turns on the master "Protect entire app" switch it applies to EVERY screen;
 *  otherwise it applies only to the per-module screens the admin enabled. Renders nothing
 *  (and adds no overhead) where it's off. Admins are exempt inside CaptureGuard itself. */
export function GlobalCaptureGuard() {
  const pathname = usePathname() || "";
  const { config } = useConfig();
  const cp = config.captureProtection ?? {};
  // Master switch: protect the whole app. Skip the self-guarded routes (they guard themselves).
  if (cp.allScreens) {
    return isSelfGuarded(pathname) ? null : <CaptureGuard label="app" />;
  }
  const mods = (cp.modules ?? {}) as Record<string, boolean | undefined>;
  const hit = MODULE_FOR_PATH.find((m) => pathname === m.prefix || pathname.startsWith(m.prefix + "/"));
  if (!hit || !mods[hit.module]) return null; // default off → only when the admin turns it on
  return <CaptureGuard label={hit.label} />;
}
