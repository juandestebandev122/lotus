"use client";

import Link from "next/link";
import { useState } from "react";
import { cn } from "@/lib/cn";
import { useConfig } from "@/lib/config";
import { brandSrc } from "@/lib/brand-images";

// Brand mark. Uses the admin-set App Logo (Admin → App Images) or /logo.png,
// and falls back to the built-in lotus SVG if the image can't load.
export function LotusMark({ className = "size-9" }: { className?: string }) {
  const { config } = useConfig();
  const [failed, setFailed] = useState(false);
  if (!failed) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={brandSrc(config.images, "logo")}
        alt={config.appName || "Lotus"}
        onError={() => setFailed(true)}
        className={cn("shrink-0 aspect-square rounded-full object-cover", className)}
      />
    );
  }
  return (
    <svg viewBox="0 0 64 64" className={cn("shrink-0 aspect-square", className)} aria-hidden="true">
      <defs>
        <linearGradient id="lotusPetal" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#f9a8d4" />
          <stop offset="55%" stopColor="#ec4899" />
          <stop offset="100%" stopColor="#a855f7" />
        </linearGradient>
        <linearGradient id="lotusPetalLight" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#fde7f3" />
          <stop offset="100%" stopColor="#f472b6" />
        </linearGradient>
      </defs>
      {/* outer petals */}
      <path d="M32 58 C12 50 6 34 10 24 C20 30 28 40 32 58Z" fill="url(#lotusPetal)" opacity="0.9" />
      <path d="M32 58 C52 50 58 34 54 24 C44 30 36 40 32 58Z" fill="url(#lotusPetal)" opacity="0.9" />
      <path d="M32 58 C18 46 16 30 22 18 C28 28 31 42 32 58Z" fill="url(#lotusPetalLight)" />
      <path d="M32 58 C46 46 48 30 42 18 C36 28 33 42 32 58Z" fill="url(#lotusPetalLight)" />
      {/* center petal */}
      <path d="M32 58 C26 44 26 24 32 8 C38 24 38 44 32 58Z" fill="url(#lotusPetal)" />
      <circle cx="32" cy="50" r="3" fill="#fcd34d" />
    </svg>
  );
}

export function Logo({
  href = "/",
  showText = true,
  size = "md",
  light = false,
}: {
  href?: string | null;
  showText?: boolean;
  size?: "sm" | "md" | "lg";
  light?: boolean;
}) {
  const markSize =
    size === "sm" ? "size-9" : size === "lg" ? "size-14" : "size-11";
  const textSize =
    size === "sm" ? "text-lg" : size === "lg" ? "text-3xl" : "text-xl";

  // The brand text is the admin-set names (Admin → Content management). Two-tone:
  // when a Company name is set it's the gradient part and the App name is the muted
  // part (e.g. "THAMARAI NETWORKS" · "LOTUS LUDO"). With no company name we keep the
  // old behaviour — the App name's first word in the gradient, the rest muted.
  const { config } = useConfig();
  const companyName = (config.companyName || "").trim();
  const appName = (config.appName || "LotusPlay Connect").trim();
  let firstWord: string, restText: string;
  if (companyName) {
    firstWord = companyName;
    restText = appName;
  } else {
    const parts = appName.split(/\s+/);
    firstWord = parts[0];
    restText = parts.slice(1).join(" ");
  }

  const inner = (
    <span className="flex items-center gap-2.5">
      <span className="relative grid shrink-0 place-items-center">
        <span className="absolute inset-0 -z-10 rounded-full bg-petal-500/30 blur-md" />
        <LotusMark className={markSize} />
      </span>
      {showText && (
        <span className={`font-display font-extrabold leading-none ${textSize}`}>
          <span className={light ? "text-gradient-light" : "text-gradient"}>{firstWord}</span>
          {restText && (
            <>
              {" "}
              <span className={`font-semibold tracking-wide ${light ? "text-white/85" : "text-mist-300"}`}>
                {restText}
              </span>
            </>
          )}
        </span>
      )}
    </span>
  );

  if (href === null) return inner;
  return (
    <Link href={href} className="inline-flex">
      {inner}
    </Link>
  );
}
