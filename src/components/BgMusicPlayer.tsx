"use client";

// Per-screen BACKGROUND MUSIC (Admin → Sound & Music). Maps the current route
// to a screen key, plays the admin-chosen Media-Library track on loop, and
// switches/stops on navigation. The LUDO screen is EXCLUDED on purpose — the
// Ludo board has its own in-game player (which also handles the admin's Ludo
// + Result-screen tracks), so the two can never double-play.
import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { useConfig } from "@/lib/config";
import { withBase } from "@/lib/base-path";
import { isSoundMuted } from "@/lib/sound";

type ScreenKey = "home" | "lobby" | "voiceRoom" | "snake" | "tournament" | "waiting";

function screenOf(path: string): ScreenKey | null {
  if (path === "/" || path === "/home") return "home";
  if (path.startsWith("/rooms/")) return "voiceRoom";
  if (path.startsWith("/games/ludo")) return null; // Ludo plays its own music
  if (path.startsWith("/games/snake")) return "snake";
  if (path.startsWith("/games/lobby") || path.startsWith("/lobby")) return "waiting";
  if (path.startsWith("/games")) return "lobby";
  if (path.startsWith("/tournaments")) return "tournament";
  return null;
}

export function BgMusicPlayer() {
  const { config } = useConfig();
  const pathname = usePathname() ?? "";
  const elRef = useRef<HTMLAudioElement | null>(null);
  const curUrlRef = useRef("");

  const bm = config.bgMusic;
  const screen = screenOf(pathname);
  const scr = screen ? bm?.screens?.[screen] : null;
  const url = bm?.enabled && scr?.enabled && scr.url ? scr.url : "";
  const vol = Math.max(0, Math.min(1, (bm?.volumePct ?? 35) / 100));

  useEffect(() => {
    if (!url || isSoundMuted()) {
      elRef.current?.pause();
      curUrlRef.current = "";
      return;
    }
    let el = elRef.current;
    if (!el) { el = new Audio(); el.loop = true; el.preload = "auto"; elRef.current = el; }
    if (curUrlRef.current !== url) { el.src = withBase(url); curUrlRef.current = url; }
    el.volume = vol;
    // Browsers block autoplay-with-sound until the user interacts — retry on the
    // first tap/click if the initial play() is refused.
    void el.play().catch(() => {
      const kick = () => { void elRef.current?.play().catch(() => { /* still blocked */ }); };
      window.addEventListener("pointerdown", kick, { once: true });
    });
    return () => { el?.pause(); };
  }, [url, vol]);

  // Full teardown when the app shell unmounts.
  useEffect(() => () => { elRef.current?.pause(); elRef.current = null; }, []);

  return null;
}
