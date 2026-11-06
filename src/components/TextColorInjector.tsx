"use client";

import { useEffect } from "react";
import { useConfig } from "@/lib/config";
import { buildTextColorCss } from "@/lib/text-colors";

/**
 * Applies Admin → Text Colours to the live app.
 *
 * The rules are appended to <head> LAST, after the theme's variables and after
 * Tailwind's utilities, which is what makes the admin's text choices survive a
 * theme change instead of being washed out by it. Renders nothing; when the
 * system is off (the default) it removes its stylesheet entirely, so the app
 * keeps its built-in colours.
 */
export function TextColorInjector() {
  const { config } = useConfig();
  const css = buildTextColorCss(config.textColors);

  useEffect(() => {
    const ID = "lotus-text-colors";
    let el = document.getElementById(ID) as HTMLStyleElement | null;
    if (!css) {
      el?.remove();
      return;
    }
    if (!el) {
      el = document.createElement("style");
      el.id = ID;
      document.head.appendChild(el);
    }
    el.textContent = css;
    // Keep it last in <head> so nothing loaded afterwards can outrank it.
    document.head.appendChild(el);
    return () => { document.getElementById(ID)?.remove(); };
  }, [css]);

  return null;
}
