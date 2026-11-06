"use client";

import { useEffect } from "react";
import { useConfig } from "@/lib/config";
import {
  buildAccentRamp, buildSecondaryRamp, buildSurfaceRamp, buildBodyBackground, surfaceLineColor,
  SHADES, PETAL_SHADES, SURFACE_SHADES,
} from "@/lib/theme-color";

// Applies the admin-chosen accent colours live: overrides the `--color-lotus-*` (primary)
// and `--color-petal-*` (secondary) CSS variables on the document root so every matching
// Tailwind class re-colours instantly. Renders nothing. Blank/invalid → removes overrides.
export function ThemeColorInjector() {
  const { config } = useConfig();
  const themeColor = config.themeColor ?? "";
  const themeColor2 = config.themeColor2 ?? "";
  useEffect(() => {
    const root = document.documentElement;
    const ramp = themeColor ? buildAccentRamp(themeColor) : null;
    if (ramp) for (const shade of SHADES) root.style.setProperty(`--color-lotus-${shade}`, ramp[shade]);
    else for (const shade of SHADES) root.style.removeProperty(`--color-lotus-${shade}`);
    return () => { for (const shade of SHADES) root.style.removeProperty(`--color-lotus-${shade}`); };
  }, [themeColor]);
  useEffect(() => {
    const root = document.documentElement;
    const ramp = themeColor2 ? buildSecondaryRamp(themeColor2) : null;
    if (ramp) for (const shade of PETAL_SHADES) root.style.setProperty(`--color-petal-${shade}`, ramp[shade]);
    else for (const shade of PETAL_SHADES) root.style.removeProperty(`--color-petal-${shade}`);
    return () => { for (const shade of PETAL_SHADES) root.style.removeProperty(`--color-petal-${shade}`); };
  }, [themeColor2]);

  // ---- SURFACES: the page canvas, cards, inputs, borders and the background ----
  // This is the part that decides how dark the app feels. The admin picks a
  // surface tint + brightness and it re-colours every panel at once, so the whole
  // app changes together instead of page by page.
  const surface = config.themeSurface ?? "";
  const brightness = config.themeSurfaceBrightness ?? 0;
  const glow = config.themeGlow ?? 100;
  const bgImage = config.themeBgImage ?? "";
  useEffect(() => {
    const root = document.documentElement;
    const body = document.body;
    const ramp = surface ? buildSurfaceRamp(surface, brightness) : null;
    if (ramp) {
      for (const shade of SURFACE_SHADES) root.style.setProperty(`--color-ink-${shade}`, ramp[shade]);
      root.style.setProperty("--app-line", surfaceLineColor(brightness));
      const bg = buildBodyBackground(ramp[900], glow, themeColor || undefined, themeColor2 || undefined);
      body.style.setProperty("background", bgImage ? `url("${bgImage.replace(/["\\)]/g, "")}") center / cover fixed no-repeat, ${bg}` : bg);
      body.style.setProperty("background-attachment", "fixed");
    } else {
      for (const shade of SURFACE_SHADES) root.style.removeProperty(`--color-ink-${shade}`);
      root.style.removeProperty("--app-line");
      body.style.removeProperty("background");
      body.style.removeProperty("background-attachment");
    }
    return () => {
      for (const shade of SURFACE_SHADES) root.style.removeProperty(`--color-ink-${shade}`);
      root.style.removeProperty("--app-line");
      body.style.removeProperty("background");
      body.style.removeProperty("background-attachment");
    };
  }, [surface, brightness, glow, bgImage, themeColor, themeColor2]);

  return null;
}
