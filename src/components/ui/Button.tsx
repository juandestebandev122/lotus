import Link from "next/link";
import { cn } from "@/lib/cn";

type Variant = "primary" | "secondary" | "ghost" | "outline" | "danger" | "gold";
type Size = "sm" | "md" | "lg";

// Corner radius reads the admin UI-style token (--btn-radius) with a fallback of 0.5rem
// (= the previous `rounded-lg`), so buttons look identical until an admin picks a shape.
const base =
  "inline-flex items-center justify-center gap-2 font-medium rounded-[var(--btn-radius,0.5rem)] transition-colors duration-150 active:scale-[0.99] disabled:opacity-50 disabled:pointer-events-none select-none whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lotus-400/60 focus-visible:ring-offset-2 focus-visible:ring-offset-ink-900";

const variants: Record<Variant, string> = {
  primary:
    "text-white bg-gradient-to-r from-lotus-500 to-petal-500 shadow-[0_8px_22px_-8px_rgba(124,92,252,0.7)] hover:brightness-110",
  secondary: "text-mist-100 bg-ink-800 border border-line hover:bg-ink-700",
  ghost: "text-mist-300 hover:text-mist-100 hover:bg-white/[0.05]",
  outline: "text-mist-100 border border-lotus-400/40 bg-lotus-500/5 hover:bg-lotus-500/15 hover:border-lotus-400",
  danger: "text-white bg-gradient-to-r from-rose-600 to-rose-500 shadow-[0_8px_22px_-8px_rgba(244,63,94,0.6)] hover:brightness-110",
  gold: "text-amber-950 bg-gradient-to-r from-gold-300 to-gold-500 shadow-[0_8px_22px_-8px_rgba(245,158,11,0.6)] hover:brightness-105",
};

const sizes: Record<Size, string> = {
  sm: "h-9 px-3.5 text-sm",
  md: "h-10 px-4 text-sm",
  lg: "h-12 px-6 text-[15px]",
};

type CommonProps = {
  variant?: Variant;
  size?: Size;
  block?: boolean;
  className?: string;
  children: React.ReactNode;
};

export function Button({
  variant = "primary",
  size = "md",
  block,
  className,
  children,
  ...props
}: CommonProps & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      className={cn(base, variants[variant], sizes[size], block && "w-full", className)}
      {...props}
    >
      {children}
    </button>
  );
}

export function ButtonLink({
  variant = "primary",
  size = "md",
  block,
  className,
  children,
  href,
  ...props
}: CommonProps & { href: string } & React.AnchorHTMLAttributes<HTMLAnchorElement>) {
  return (
    <Link
      href={href}
      className={cn(base, variants[variant], sizes[size], block && "w-full", className)}
      {...props}
    >
      {children}
    </Link>
  );
}
