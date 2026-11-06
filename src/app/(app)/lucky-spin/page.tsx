"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import { useAuth } from "@/lib/auth";
import { withBase } from "@/lib/base-path";
import { cn } from "@/lib/cn";
import { Sparkles, Coins, Clock, History, PlayCircle } from "lucide-react";

interface Seg { label: string; coins: number }
interface SpinHistory { id: string; label: string; coins: number; at: string }
interface SpinState {
  enabled: boolean; cooldownHours: number; segments: Seg[];
  canSpin: boolean; freeReady: boolean; nextFreeSpinAt: string | null;
  chances: number; extraChancesEnabled: boolean; buyCostCoins: number; adRemaining: number; spinDisabled: boolean;
  history: SpinHistory[];
}

// Bright, distinct wheel-slice colours (cycled).
const COLORS = ["#f43f5e", "#f59e0b", "#22c55e", "#3b82f6", "#a855f7", "#ec4899", "#14b8a6", "#eab308", "#8b5cf6", "#ef4444", "#10b981", "#f97316"];
const SPIN_MS = 4200;

const CX = 100, CY = 100, R = 96;
function point(angleDeg: number, r = R): [number, number] {
  const rad = ((angleDeg - 90) * Math.PI) / 180; // 0° = top, clockwise
  return [CX + r * Math.cos(rad), CY + r * Math.sin(rad)];
}

function countdown(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60;
  return `${h > 0 ? `${h}h ` : ""}${m}m ${sec}s`;
}

export default function LuckySpinPage() {
  const { toast } = useToast();
  const { refresh } = useAuth();
  const [state, setState] = useState<SpinState | null>(null);
  const [rotation, setRotation] = useState(0);
  const [spinning, setSpinning] = useState(false);
  const [result, setResult] = useState<{ coins: number; label: string } | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const load = useCallback(() => {
    fetch(withBase("/api/lucky-spin"), { credentials: "include" })
      .then((r) => r.json())
      .then((d) => setState(d as SpinState))
      .catch(() => {});
  }, []);
  useEffect(() => { load(); }, [load]);
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(t); }, []);
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  const segs = state?.segments ?? [];
  const n = segs.length || 1;
  const seg = 360 / n;

  const nextMs = state?.nextFreeSpinAt ? new Date(state.nextFreeSpinAt).getTime() : 0;
  const freeReady = !!state && state.enabled && (state.freeReady || (!!state.nextFreeSpinAt && now >= nextMs) || (!state.nextFreeSpinAt && state.freeReady));
  const chances = state?.chances ?? 0;
  const canSpin = !!state && state.enabled && (freeReady || chances > 0);

  const [earning, setEarning] = useState("");
  const earn = async (action: "buy" | "ad") => {
    if (earning) return;
    setEarning(action);
    try {
      const res = await fetch(withBase("/api/lucky-spin/earn"), { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action }) });
      const d = await res.json().catch(() => ({}));
      if (res.ok) { toast(action === "buy" ? "Extra chance added ✓" : "You earned an extra chance ✨", "success"); if (action === "buy") refresh(); load(); }
      else toast(d?.error ?? "Could not earn a chance", "error");
    } catch { toast("Network error", "error"); }
    setEarning("");
  };

  const doSpin = async () => {
    if (spinning || !state?.enabled || !canSpin) return;
    setSpinning(true);
    setResult(null);
    try {
      const res = await fetch(withBase("/api/lucky-spin"), { method: "POST", credentials: "include" });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) { setSpinning(false); toast(d?.error ?? "Could not spin", "error"); load(); return; }
      const index: number = d.index ?? 0;
      // Rotate so the winning slice's centre lands under the top pointer.
      const centerAngle = index * seg + seg / 2;
      setRotation((prev) => {
        const target = (360 - centerAngle + 360) % 360;
        const prevMod = ((prev % 360) + 360) % 360;
        const delta = (target - prevMod + 360) % 360;
        return prev + 360 * 6 + delta; // 6 full spins, then settle on the winner
      });
      timer.current = setTimeout(() => {
        setSpinning(false);
        setResult({ coins: d.coins ?? 0, label: d.label ?? "" });
        if ((d.coins ?? 0) > 0) refresh(); // update the header coin balance
        load();
      }, SPIN_MS + 150);
    } catch {
      setSpinning(false);
      toast("Network error — try again", "error");
    }
  };

  if (!state) return <div className="grid min-h-[60vh] place-items-center text-mist-400">Loading Lucky Spin…</div>;

  return (
    <div className="mx-auto max-w-lg">
      <div className="mb-5 flex items-center gap-3">
        <span className="grid size-11 place-items-center rounded-2xl bg-gradient-to-br from-amber-400 to-orange-500 text-white"><Sparkles className="size-6" /></span>
        <div>
          <h1 className="font-display text-2xl font-extrabold text-mist-100">Lucky Spin</h1>
          <p className="text-sm text-mist-400">Spin the wheel to win free coins — one free spin every {state.cooldownHours}h.</p>
        </div>
      </div>

      {!state.enabled ? (
        <Card className="p-8 text-center text-sm text-mist-400">Lucky Spin is currently turned off. Please check back later.</Card>
      ) : (
        <Card className="p-5">
          {/* The wheel */}
          <div className="relative mx-auto aspect-square w-full max-w-[340px]">
            {/* Top pointer */}
            <div className="absolute left-1/2 top-[-6px] z-20 -translate-x-1/2">
              <div className="size-0 border-x-[14px] border-t-[24px] border-x-transparent border-t-amber-400 drop-shadow" />
            </div>
            <svg viewBox="0 0 200 200" className="size-full drop-shadow-[0_20px_40px_-12px_rgba(0,0,0,0.7)]">
              <circle cx={CX} cy={CY} r={R + 3} fill="#1e1b2e" stroke="#f59e0b" strokeWidth="3" />
              <g style={{ transform: `rotate(${rotation}deg)`, transformOrigin: "100px 100px", transition: spinning ? `transform ${SPIN_MS}ms cubic-bezier(0.16, 1, 0.3, 1)` : "none" }}>
                {segs.map((s, i) => {
                  const a0 = i * seg, a1 = (i + 1) * seg;
                  const [x0, y0] = point(a0), [x1, y1] = point(a1);
                  const large = a1 - a0 > 180 ? 1 : 0;
                  const [lx, ly] = point(a0 + seg / 2, R * 0.62);
                  return (
                    <g key={i}>
                      <path d={`M ${CX} ${CY} L ${x0} ${y0} A ${R} ${R} 0 ${large} 1 ${x1} ${y1} Z`} fill={COLORS[i % COLORS.length]} stroke="rgba(0,0,0,0.25)" strokeWidth="0.6" />
                      <text x={lx} y={ly} transform={`rotate(${a0 + seg / 2} ${lx} ${ly})`} textAnchor="middle" dominantBaseline="middle" fontSize={s.label.length > 4 ? 7 : 11} fontWeight="800" fill="#fff" style={{ paintOrder: "stroke", stroke: "rgba(0,0,0,0.35)", strokeWidth: 0.5 }}>
                        {s.label}
                      </text>
                    </g>
                  );
                })}
              </g>
              {/* Hub */}
              <circle cx={CX} cy={CY} r="13" fill="#fff" stroke="#f59e0b" strokeWidth="3" />
              <circle cx={CX} cy={CY} r="4" fill="#f59e0b" />
            </svg>
          </div>

          {/* Extra chances balance */}
          {state.extraChancesEnabled && (
            <div className="mt-4 flex items-center justify-center gap-2 rounded-xl border border-amber-400/20 bg-amber-500/10 px-4 py-2 text-sm">
              <Sparkles className="size-4 text-amber-300" />
              <span className="text-mist-200">Extra chances:</span>
              <span className="font-display text-lg font-extrabold text-amber-300 tabular-nums">{chances}</span>
            </div>
          )}

          {/* Spin button */}
          <div className="mt-3 text-center">
            {canSpin ? (
              <Button size="lg" block onClick={doSpin} disabled={spinning} className="!bg-gradient-to-r !from-amber-400 !to-orange-500 !text-white">
                <Sparkles className="size-5" /> {spinning ? "Spinning…" : freeReady ? "SPIN & WIN (free)" : `SPIN (uses 1 chance)`}
              </Button>
            ) : (
              <div className="rounded-xl border border-line bg-ink-800 px-4 py-3 text-sm text-mist-300">
                <p className="flex items-center justify-center gap-1.5 font-semibold text-mist-200"><Clock className="size-4 text-amber-300" /> Next free spin in</p>
                <p className="mt-0.5 font-display text-lg font-extrabold text-amber-300 tabular-nums">{countdown(nextMs - now)}</p>
                {state.extraChancesEnabled && <p className="mt-1 text-[11px] text-mist-500">…or earn/buy an extra chance below to spin now.</p>}
              </div>
            )}
          </div>

          {/* Earn extra chances: watch & buy */}
          {state.extraChancesEnabled && !state.spinDisabled && (state.adRemaining > 0 || state.buyCostCoins > 0) && (
            <div className="mt-2 grid grid-cols-2 gap-2">
              {state.adRemaining > 0 && (
                <button onClick={() => earn("ad")} disabled={!!earning} className="flex items-center justify-center gap-1.5 rounded-xl border border-white/10 bg-ink-800 px-3 py-2.5 text-xs font-bold text-mist-100 transition hover:bg-ink-700 disabled:opacity-60">
                  <PlayCircle className="size-4 text-sky-300" /> {earning === "ad" ? "…" : `Watch & earn (${state.adRemaining} left)`}
                </button>
              )}
              {state.buyCostCoins > 0 && (
                <button onClick={() => earn("buy")} disabled={!!earning} className="flex items-center justify-center gap-1.5 rounded-xl border border-white/10 bg-ink-800 px-3 py-2.5 text-xs font-bold text-mist-100 transition hover:bg-ink-700 disabled:opacity-60">
                  <Coins className="size-4 text-gold-300" /> {earning === "buy" ? "…" : `Buy a spin · ${state.buyCostCoins}`}
                </button>
              )}
            </div>
          )}
          {state.spinDisabled && <p className="mt-2 text-center text-[11px] text-rose-300">Extra chances are disabled for your account by an admin.</p>}

          {/* Prizes legend */}
          <div className="mt-4 flex flex-wrap justify-center gap-1.5">
            {segs.map((s, i) => (
              <span key={i} className="inline-flex items-center gap-1 rounded-full border border-white/10 px-2 py-0.5 text-[11px] text-mist-300">
                <span className="size-2 rounded-full" style={{ background: COLORS[i % COLORS.length] }} />
                {s.coins > 0 ? <><Coins className="size-3 text-gold-300" />{s.label}</> : s.label}
              </span>
            ))}
          </div>
        </Card>
      )}

      {/* History */}
      {state.history.length > 0 && (
        <Card className="mt-4 p-4">
          <p className="mb-2 flex items-center gap-1.5 text-sm font-semibold text-mist-200"><History className="size-4 text-lotus-300" /> Your recent spins</p>
          <div className="space-y-1">
            {state.history.slice(0, 8).map((h) => (
              <div key={h.id} className="flex items-center justify-between rounded-lg bg-ink-800/50 px-3 py-1.5 text-xs">
                <span className="text-mist-400">{new Date(h.at).toLocaleString("en-SA", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</span>
                <span className={cn("font-bold", h.coins > 0 ? "text-emerald-300" : "text-mist-500")}>{h.coins > 0 ? `+${h.coins} coins` : "Try again"}</span>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Result popup */}
      {result && (
        <div className="fixed inset-0 z-[200] grid place-items-center bg-black/70 p-4" onClick={() => setResult(null)}>
          <div className="w-full max-w-xs rounded-2xl border border-amber-400/30 bg-ink-900 p-6 text-center shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <span className="mx-auto grid size-16 place-items-center rounded-2xl bg-gradient-to-br from-amber-400 to-orange-500 text-white"><Sparkles className="size-9" /></span>
            {result.coins > 0 ? (
              <>
                <h2 className="mt-4 font-display text-2xl font-extrabold text-mist-100">You won!</h2>
                <p className="mt-1 flex items-center justify-center gap-1.5 font-display text-3xl font-black text-gold-300"><Coins className="size-7" /> {result.coins}</p>
                <p className="mt-1 text-sm text-mist-400">coins added to your wallet 🎉</p>
              </>
            ) : (
              <>
                <h2 className="mt-4 font-display text-xl font-extrabold text-mist-100">So close!</h2>
                <p className="mt-1 text-sm text-mist-400">No coins this time — come back for your next free spin.</p>
              </>
            )}
            <Button block className="mt-5" onClick={() => setResult(null)}>Awesome</Button>
          </div>
        </div>
      )}
    </div>
  );
}
