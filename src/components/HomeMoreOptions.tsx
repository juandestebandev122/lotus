"use client";

import Link from "next/link";
import { useAuth } from "@/lib/auth";
import { useConfig } from "@/lib/config";
import { cn } from "@/lib/cn";
import { User, Settings, Wallet, Gift, Crown, ShieldCheck, LifeBuoy, Flag, LogOut, LayoutGrid } from "lucide-react";

// The "More Options" bar at the bottom of the Home screen. Logout is a real
// action (needs the client), so the whole bar is a client component.
const ITEMS: { label: string; sub: string; href: string; icon: typeof User; tone: string }[] = [
  { label: "All Pages", sub: "Every screen in the app", href: "/all-pages", icon: LayoutGrid, tone: "bg-lotus-500/15 text-lotus-300" },
  { label: "Profile", sub: "View & edit profile", href: "/profile", icon: User, tone: "bg-emerald-500/15 text-emerald-300" },
  { label: "Settings", sub: "App preferences", href: "/customize", icon: Settings, tone: "bg-white/[0.06] text-mist-200" },
  { label: "Wallet", sub: "Manage coins", href: "/wallet", icon: Wallet, tone: "bg-gold-500/15 text-gold-300" },
  { label: "Rewards", sub: "Earn & redeem", href: "/refer", icon: Gift, tone: "bg-sky-500/15 text-sky-300" },
  { label: "VIP Membership", sub: "Exclusive benefits", href: "/paid-zone", icon: Crown, tone: "bg-fuchsia-500/15 text-fuchsia-300" },
  { label: "Verify Account", sub: "Get verified", href: "/kyc", icon: ShieldCheck, tone: "bg-emerald-500/15 text-emerald-300" },
  { label: "Help & Support", sub: "FAQs & contact", href: "/support", icon: LifeBuoy, tone: "bg-violet-500/15 text-violet-300" },
  { label: "Report", sub: "Report an issue", href: "/support?type=report", icon: Flag, tone: "bg-rose-500/15 text-rose-300" },
];

const tile = "flex items-center gap-2.5 rounded-xl border border-white/8 bg-ink-850 p-3 transition-colors hover:border-white/15 hover:bg-ink-800";

export function HomeMoreOptions() {
  const { logout } = useAuth();
  const { config } = useConfig();
  // The All Pages tile disappears when the admin switches the directory off.
  const items = config.allPages?.enabled === false ? ITEMS.filter((it) => it.href !== "/all-pages") : ITEMS;
  return (
    <div className="rounded-2xl border border-white/8 bg-ink-900/40 p-4">
      <h2 className="mb-3 font-display text-lg font-bold text-mist-100">More Options</h2>
      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
        {items.map((it) => (
          <Link key={it.label} href={it.href} className={tile}>
            <span className={cn("grid size-9 shrink-0 place-items-center rounded-lg", it.tone)}><it.icon className="size-4" /></span>
            <span className="min-w-0">
              <span className="block text-sm font-semibold leading-tight text-mist-100">{it.label}</span>
              <span className="block truncate text-[11px] text-mist-500">{it.sub}</span>
            </span>
          </Link>
        ))}
        <button type="button" onClick={() => logout()} className={cn(tile, "text-left")}>
          <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-rose-500/15 text-rose-300"><LogOut className="size-4" /></span>
          <span className="min-w-0">
            <span className="block text-sm font-semibold leading-tight text-mist-100">Logout</span>
            <span className="block truncate text-[11px] text-mist-500">Sign out</span>
          </span>
        </button>
      </div>
    </div>
  );
}
