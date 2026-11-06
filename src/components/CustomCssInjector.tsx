"use client";

import { usePathname } from "next/navigation";
import { useConfig } from "@/lib/config";

// Injects the super-admin's custom CSS app-wide (Admin → Appearance → Custom CSS).
// This is the "restyle anything without touching source" escape hatch: the CSS lands in a
// single <style> element that applies to the whole app (admin panel + user app + login).
// The server sanitizer already neutralises any </style>/<script> break-out, and CSS cannot
// execute JavaScript, so a trusted super-admin can safely restyle backgrounds, borders,
// shadows, fonts, cards, tables, etc. Empty → nothing rendered.
//
// SAFETY: the CSS is NEVER applied on the Appearance page itself, so the Clear/Reset
// controls there always work — if a save ever breaks the UI, the admin just opens
// /admin/appearance (reloading clears any unsaved preview) and fixes or clears it.
export function CustomCssInjector() {
  const pathname = usePathname() || "";
  const { config } = useConfig();
  if (pathname === "/admin/appearance") return null; // always-safe recovery surface
  const css = (config.customCss ?? "").trim();
  if (!css) return null;
  // Defence-in-depth: also strip any tag break-out on the client before injecting.
  const safe = css.replace(/<\/?\s*(style|script)/gi, "/**/");
  return <style id="lotus-custom-css" dangerouslySetInnerHTML={{ __html: safe }} />;
}
