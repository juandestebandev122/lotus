"use client";

// Timed Free-Coins claim widget.
//
// Drop it anywhere (wallet, home). It renders NOTHING unless the admin has turned
// the timed reward ON, so it's always safe to mount. Everything it shows — the
// interval, the amount, the countdown — comes straight from the server:
//   • it NEVER hard-codes an interval (fixes the "stuck at 30 minutes" bug),
//   • the countdown follows the SERVER clock (we store serverNow − deviceNow as an
//     offset), so changing the device time can't shorten the wait,
//   • it re-fetches every 30s, so an admin change to the interval/amount/enable
//     appears live without a refresh,
//   • the button only enables when the server says the reward is ready, and the
//     claim itself is re-verified server-side (a too-early tap is rejected).

import { useCallback, useEffect, useRef, useState } from "react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import { useAuth } from "@/lib/auth";
import { withBase } from "@/lib/base-path";
import { cn } from "@/lib/cn";
import { Gift, Clock, Coins, Lock } from "lucide-react";

interface Status {
  enabled: boolean; intervalMinutes: number; amount: number; dailyLimit: number; minLevel: number;
  eligible: boolean; ready: boolean; reason?: string;
  nextAt: string | null; serverNow: string;
  claimsToday: number; remainingToday: number | null;
  history: { amount: number; at: string }[];
}

function fmt(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60;
  if (h > 0) return `${h}h ${m}m ${sec.toString().padStart(2, "0")}s`;
  return `${m}m ${sec.toString().padStart(2, "0")}s`;
}

export function FreeCoinsClaim({ className }: { className?: string }) {
  const { toast } = useToast();
  const { refresh } = useAuth();
  const [st, setSt] = useState<Status | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [claiming, setClaiming] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const offsetRef = useRef(0); // serverNow − deviceNow → countdown tracks the SERVER clock

  const load = useCallback(async () => {
    try {
      const r = await fetch(withBase("/api/free-coins"), { credentials: "include", cache: "no-store" });
      const d = await r.json();
      if (d && typeof d === "object" && "enabled" in d) {
        if (typeof d.serverNow === "string") offsetRef.current = new Date(d.serverNow).getTime() - Date.now();
        setSt(d as Status);
      }
    } catch { /* best-effort */ }
    setLoaded(true);
  }, []);

  useEffect(() => { void load(); }, [load]);
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(t); }, []);
  useEffect(() => { const t = setInterval(() => void load(), 30_000); return () => clearInterval(t); }, [load]);

  if (!loaded || !st || !st.enabled) return null; // feature off (or not loaded) → show nothing

  const serverNow = now + offsetRef.current;
  const nextMs = st.nextAt ? new Date(st.nextAt).getTime() : 0;
  const remaining = nextMs - serverNow;
  const canClaim = st.eligible && remaining <= 0 && !claiming;
  const locked = !st.eligible; // below the required level

  const claim = async () => {
    if (!canClaim) return;
    setClaiming(true);
    try {
      const r = await fetch(withBase("/api/free-coins"), { method: "POST", credentials: "include" });
      const d = await r.json().catch(() => ({}));
      if (r.ok) { toast(`🎁 You claimed ${d.amount ?? st.amount} free ${d.unit ?? "coins"}!`, "success"); refresh(); }
      else toast(d?.error ?? "Could not claim right now", "error");
    } catch { toast("Network error — please try again", "error"); }
    setClaiming(false);
    void load(); // resync to the server (updates the countdown either way)
  };

  return (
    <Card className={cn("p-4 sm:p-5", className)}>
      <div className="flex items-center gap-3">
        <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-lotus-500/15 text-lotus-300">
          <Gift className="size-5" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 font-display text-base font-bold text-mist-100">
            Free Coins
            <span className="inline-flex items-center gap-1 rounded-full bg-gold-400/15 px-2 py-0.5 text-xs font-bold text-gold-300">
              <Coins className="size-3" /> {st.amount.toLocaleString("en-SA")}
            </span>
          </div>
          <div className="text-xs text-mist-400">
            {locked
              ? st.reason ?? `Reach level ${st.minLevel} to unlock.`
              : canClaim
                ? "Your reward is ready — claim it now!"
                : <>Next reward in <span className="font-semibold tabular-nums text-mist-200">{fmt(remaining)}</span></>}
          </div>
        </div>
        {locked ? (
          <span className="grid size-10 shrink-0 place-items-center rounded-full bg-white/5 text-mist-500"><Lock className="size-4" /></span>
        ) : canClaim ? (
          <Button onClick={claim} disabled={claiming} className="shrink-0">
            <Gift className="size-4" /> {claiming ? "Claiming…" : "Claim"}
          </Button>
        ) : (
          <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-white/5 px-3 py-1.5 text-xs font-semibold text-mist-400">
            <Clock className="size-3.5" /> Waiting
          </span>
        )}
      </div>
      {(st.dailyLimit > 0 || st.intervalMinutes > 0) && !locked && (
        <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-line/60 pt-3 text-[11px] text-mist-500">
          <span>Every {st.intervalMinutes} min</span>
          {st.dailyLimit > 0 && (
            <span>{st.remainingToday ?? 0} of {st.dailyLimit} left today</span>
          )}
        </div>
      )}
    </Card>
  );
}
