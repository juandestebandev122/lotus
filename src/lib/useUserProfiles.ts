"use client";

import { useEffect, useState } from "react";
import { withBase } from "./base-path";

export interface UserProfile { id: string; fullName: string; username: string; avatar: string; level?: number; tokenSkin?: string; equippedFrame?: string }

/**
 * Resolve real profile basics (name / username / avatar) for a set of user ids
 * from the server. Used by the voice room so every member sees each other's
 * real profile photo — avatars live on the account, not in the live-voice
 * metadata (which can't carry large data-URL images reliably).
 *
 * Returns a map keyed by user id. Re-fetches when the set of ids changes and
 * polls lightly so a freshly-changed photo propagates.
 */
export function useUserProfiles(ids: (string | undefined)[]): Record<string, UserProfile> {
  const [map, setMap] = useState<Record<string, UserProfile>>({});
  // Stable key so the effect only re-runs when the *set* of ids changes.
  const key = Array.from(new Set(ids.filter((x): x is string => !!x))).sort().join(",");

  useEffect(() => {
    const list = key ? key.split(",") : [];
    if (list.length === 0) { setMap({}); return; }
    let on = true;
    const load = async () => {
      try {
        const res = await fetch(withBase("/api/users/profiles"), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ ids: list }),
          cache: "no-store",
        });
        if (!res.ok) return;
        const data = await res.json();
        if (!on) return;
        const next: Record<string, UserProfile> = {};
        for (const p of (data.profiles as UserProfile[]) ?? []) next[p.id] = p;
        setMap(next);
      } catch {
        /* ignore */
      }
    };
    load();
    // Poll fairly often so each player's synced choices (token design, avatar,
    // level) appear for everyone quickly — the old 20s gap meant that on a slow
    // connection other players' chosen tokens showed the default for far too long
    // ("other players' tokens not displaying correctly"). Also refetch the moment
    // the tab regains focus / becomes visible, so switching back is instantly fresh.
    const t = setInterval(load, 7000);
    const onFocus = () => load();
    const onVis = () => { if (document.visibilityState === "visible") load(); };
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVis);
    return () => {
      on = false;
      clearInterval(t);
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [key]);

  return map;
}
