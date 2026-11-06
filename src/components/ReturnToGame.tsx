"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Gamepad2 } from "lucide-react";

// "Return to game".
//
// The game screen has a few shortcuts that lead somewhere else — Settings
// (Customize), Tournaments and Rewards. They used to be one-way trips: once a
// player tapped one there was no way back to the match, and they had to find the
// room and re-enter. Those shortcuts now carry the game's own address, and this
// bar reads it and offers the way back.
//
// It shows ONLY when that address is present, so no other screen is affected.
// The match itself lives on the server, so returning drops the player straight
// back into the same game with the same turn and positions.
const KEY = "lotus.returnToGame";

export function ReturnToGame() {
  const router = useRouter();
  const [href, setHref] = useState("");

  useEffect(() => {
    const read = () => {
      try {
        const p = new URLSearchParams(window.location.search).get("backToGame");
        if (p) {
          // Only ever an in-app path — never an address somewhere else.
          const clean = p.startsWith("/") && !p.startsWith("//") ? p : "";
          if (clean) { sessionStorage.setItem(KEY, clean); setHref(clean); return; }
        }
        // Kept for the rest of the visit, so a second hop (Customize → Store)
        // still offers the way back to the match.
        setHref(sessionStorage.getItem(KEY) ?? "");
      } catch { /* ignore */ }
    };
    read();
    window.addEventListener("popstate", read);
    return () => window.removeEventListener("popstate", read);
  }, []);

  if (!href) return null;

  const go = () => {
    try { sessionStorage.removeItem(KEY); } catch { /* ignore */ }
    router.push(href);
  };
  const dismiss = () => {
    try { sessionStorage.removeItem(KEY); } catch { /* ignore */ }
    setHref("");
  };

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-20 z-[95] flex justify-center px-4 sm:bottom-6">
      <div className="pointer-events-auto flex items-center gap-2 rounded-full border border-lotus-400/40 bg-ink-900/95 py-1.5 pl-2 pr-1.5 shadow-2xl backdrop-blur">
        <button
          onClick={go}
          className="inline-flex items-center gap-1.5 rounded-full bg-lotus-500 px-3.5 py-1.5 text-sm font-bold text-white transition hover:bg-lotus-400"
        >
          <ArrowLeft className="size-4" /> <Gamepad2 className="size-4" /> Return to game
        </button>
        <button
          onClick={dismiss}
          title="Hide this"
          aria-label="Hide"
          className="grid size-7 place-items-center rounded-full text-mist-500 transition hover:bg-white/10 hover:text-mist-200"
        >
          ✕
        </button>
      </div>
    </div>
  );
}
