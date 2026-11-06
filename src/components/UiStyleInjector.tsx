"use client";

import { useEffect } from "react";
import { useConfig } from "@/lib/config";
import { applyUiStyle } from "@/lib/ui-style";

// Applies the admin-chosen UI-style tokens (button shape, chat bubble shape, chat font
// size) live by setting CSS variables on the document root. Renders nothing. When the
// config is empty it removes the overrides → components use their built-in defaults.
export function UiStyleInjector() {
  const { config } = useConfig();
  const key = JSON.stringify(config.uiStyle ?? {});
  useEffect(() => {
    applyUiStyle(config.uiStyle);
    // Re-run only when the token values actually change (key is their JSON).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  return null;
}
