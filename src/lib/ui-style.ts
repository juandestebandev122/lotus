// Admin UI-style tokens. The admin picks safe, global "shape" options (never free
// positioning), and we apply them at runtime as CSS custom properties on the document
// root — exactly like the accent-colour injector. Buttons and chat bubbles read these
// vars (with a fallback that equals the current default), so nothing shifts until an
// admin actually chooses a non-default value. No layout engine, no overlap risk.

export type UiStyle = {
  buttonShape?: "sharp" | "rounded" | "pill";
  chatBubbleShape?: "sharp" | "rounded" | "round";
  chatFontSize?: "small" | "normal" | "large";
};

// Each option maps to a concrete CSS value. The "rounded"/"normal" defaults equal the
// values hard-coded in the components today, so an unset config looks identical.
export const BTN_RADIUS: Record<NonNullable<UiStyle["buttonShape"]>, string> = { sharp: "0.25rem", rounded: "0.5rem", pill: "9999px" };
export const BUBBLE_RADIUS: Record<NonNullable<UiStyle["chatBubbleShape"]>, string> = { sharp: "0.35rem", rounded: "1rem", round: "1.5rem" };
export const BUBBLE_FONT: Record<NonNullable<UiStyle["chatFontSize"]>, string> = { small: "0.8125rem", normal: "0.875rem", large: "1rem" };

const VARS = ["--btn-radius", "--bubble-radius", "--bubble-font"] as const;

/** Apply UI-style tokens to a root element (default = <html>). Pass null/undefined to
 *  remove the overrides so the components fall back to their built-in defaults. */
export function applyUiStyle(ui: UiStyle | null | undefined, root: HTMLElement = document.documentElement): void {
  if (!ui || (!ui.buttonShape && !ui.chatBubbleShape && !ui.chatFontSize)) {
    for (const v of VARS) root.style.removeProperty(v);
    return;
  }
  root.style.setProperty("--btn-radius", BTN_RADIUS[ui.buttonShape ?? "rounded"]);
  root.style.setProperty("--bubble-radius", BUBBLE_RADIUS[ui.chatBubbleShape ?? "rounded"]);
  root.style.setProperty("--bubble-font", BUBBLE_FONT[ui.chatFontSize ?? "normal"]);
}
