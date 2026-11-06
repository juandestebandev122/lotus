import { cn } from "@/lib/cn";

type Tone = "lotus" | "petal" | "gold" | "green" | "neutral" | "live";

const tones: Record<Tone, string> = {
  lotus: "bg-lotus-500/18 text-lotus-200 border-lotus-400/30",
  petal: "bg-petal-500/18 text-petal-400 border-petal-400/30",
  gold: "bg-gold-400/18 text-gold-300 border-gold-400/40",
  green: "bg-emerald-500/18 text-emerald-200 border-emerald-400/30",
  neutral: "bg-white/[0.08] text-mist-300 border-line",
  live: "bg-rose-500/18 text-rose-200 border-rose-400/30",
};

export function Badge({
  tone = "neutral",
  className,
  children,
}: {
  tone?: Tone;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-semibold",
        tones[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

export function LiveDot() {
  return (
    <span className="relative flex size-2">
      <span className="absolute inline-flex size-full animate-ping rounded-full bg-rose-400 opacity-75" />
      <span className="relative inline-flex size-2 rounded-full bg-rose-500" />
    </span>
  );
}

export function CoinPill({ amount }: { amount: number }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-gold-400/25 bg-gold-400/10 px-2.5 py-1 text-xs font-semibold text-gold-300">
      <span className="grid size-4 place-items-center rounded-full bg-gold-400/20 text-[9px] text-gold-300">
        🪙
      </span>
      {amount.toLocaleString("en-SA")}
    </span>
  );
}
