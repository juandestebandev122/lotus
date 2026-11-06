import { cn } from "@/lib/cn";

/** A glossy 3D rounded cube with a soft colour glow — floating décor. */
export function GlowCube({
  tone,
  className,
}: {
  tone: "yellow" | "pink" | "green" | "violet" | "blue";
  className?: string;
}) {
  const tones: Record<string, string> = {
    yellow:
      "from-amber-200 to-yellow-500 shadow-[0_0_55px_-2px_rgba(250,204,21,0.6),inset_0_7px_12px_rgba(255,255,255,0.6),inset_0_-12px_18px_rgba(0,0,0,0.22)]",
    pink: "from-rose-300 to-pink-600 shadow-[0_0_55px_-2px_rgba(244,63,94,0.55),inset_0_7px_12px_rgba(255,255,255,0.5),inset_0_-12px_18px_rgba(0,0,0,0.22)]",
    green:
      "from-emerald-300 to-green-600 shadow-[0_0_55px_-2px_rgba(16,185,129,0.55),inset_0_7px_12px_rgba(255,255,255,0.5),inset_0_-12px_18px_rgba(0,0,0,0.22)]",
    violet:
      "from-violet-300 to-purple-600 shadow-[0_0_55px_-2px_rgba(139,92,246,0.55),inset_0_7px_12px_rgba(255,255,255,0.5),inset_0_-12px_18px_rgba(0,0,0,0.22)]",
    blue: "from-sky-300 to-blue-600 shadow-[0_0_55px_-2px_rgba(56,189,248,0.55),inset_0_7px_12px_rgba(255,255,255,0.5),inset_0_-12px_18px_rgba(0,0,0,0.22)]",
  };
  return (
    <span
      className={cn("block aspect-square rounded-[30%] bg-gradient-to-br", tones[tone], className)}
    />
  );
}
