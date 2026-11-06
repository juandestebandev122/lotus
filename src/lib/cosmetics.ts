"use client";

import { useEffect, useState } from "react";
import { withBase } from "./base-path";

// ============================================================
// Dice & token cosmetics. Players pick a skin; the choice is
// saved per browser (localStorage) and applied to the Ludo board.
// (Swaps for a backend "owned skins" inventory later.)
// ============================================================

export type DiceSkinId =
  | "classic"
  | "gold"
  | "neon"
  | "ocean"
  | "candy"
  | "ruby"
  | "emerald"
  | "midnight";
export type TokenSkinId =
  | "royal-lotus"
  | "lotus-bloom"
  | "animal-lotus"
  | "butterfly-lotus"
  | "peacock-lotus"
  | "shiva-lotus"
  | "coin"
  | "classic"
  | "glossy"
  | "ring"
  | "gem"
  | "star"
  | "pin"
  | "pawn"
  | "crown"
  | "pearl";

export interface DiceSkin {
  id: DiceSkinId;
  name: string;
  /** Tailwind classes for the die surface. */
  surface: string;
  /** Tailwind classes for the pips. */
  pip: string;
}

export const DICE_SKINS: DiceSkin[] = [
  { id: "classic", name: "Classic", surface: "bg-gradient-to-br from-white to-zinc-200", pip: "bg-zinc-900" },
  { id: "gold", name: "Royal Gold", surface: "bg-gradient-to-br from-amber-300 to-yellow-500", pip: "bg-amber-900" },
  { id: "neon", name: "Neon", surface: "bg-gradient-to-br from-slate-800 to-slate-950", pip: "bg-cyan-300 shadow-[0_0_6px_#22d3ee]" },
  { id: "ocean", name: "Ocean", surface: "bg-gradient-to-br from-sky-400 to-blue-600", pip: "bg-white" },
  { id: "candy", name: "Candy", surface: "bg-gradient-to-br from-pink-400 to-fuchsia-600", pip: "bg-white" },
  { id: "ruby", name: "Ruby", surface: "bg-gradient-to-br from-rose-500 to-red-700", pip: "bg-white" },
  { id: "emerald", name: "Emerald", surface: "bg-gradient-to-br from-emerald-300 to-green-600", pip: "bg-white" },
  { id: "midnight", name: "Midnight", surface: "bg-gradient-to-br from-slate-700 to-slate-900", pip: "bg-gold-300 shadow-[0_0_4px_#fcd34d]" },
];

export interface TokenSkin {
  id: TokenSkinId;
  name: string;
}

export const TOKEN_SKINS: TokenSkin[] = [
  { id: "royal-lotus", name: "Royal Lotus 🪷" },
  { id: "lotus-bloom", name: "Lotus Bloom 🌸" },
  { id: "animal-lotus", name: "Animal Lotus 🦁" },
  { id: "butterfly-lotus", name: "Butterfly Lotus 🦋" },
  { id: "peacock-lotus", name: "Peacock Lotus 🦚" },
  { id: "shiva-lotus", name: "Shiva Lotus 🕉️" },
  { id: "coin", name: "Royal Coin" },
  { id: "classic", name: "Classic" },
  { id: "glossy", name: "Glossy" },
  { id: "ring", name: "Ring" },
  { id: "gem", name: "Gem" },
  { id: "star", name: "Star" },
  { id: "pin", name: "Pin" },
  { id: "pawn", name: "Pawn" },
  { id: "crown", name: "Crown" },
  { id: "pearl", name: "Pearl" },
];

export function diceSkinById(id: DiceSkinId): DiceSkin {
  return DICE_SKINS.find((s) => s.id === id) ?? DICE_SKINS[0];
}

// ---- Board themes (changes the whole board look) -------------------------
export type BoardThemeId = "classic" | "midnight" | "royal" | "emerald" | "rose" | "ocean";

export interface BoardTheme {
  id: BoardThemeId;
  name: string;
  frame: string; // CSS background for the outer frame
  boardBg: string; // CSS color for the inner board surface
  cell: string; // Tailwind class for the default path cells
  dark?: boolean; // dark surface — flips border/star contrast
  preview: string; // swatch gradient for the picker
}

export const BOARD_THEMES: BoardTheme[] = [
  { id: "classic", name: "Classic", frame: "linear-gradient(135deg,#ef4444,#f59e0b,#fbbf24)", boardBg: "#ffffff", cell: "bg-stone-100", preview: "linear-gradient(135deg,#ef4444,#fbbf24)" },
  { id: "midnight", name: "Midnight", frame: "linear-gradient(135deg,#334155,#0f172a)", boardBg: "#0b1220", cell: "bg-slate-800", dark: true, preview: "linear-gradient(135deg,#475569,#0f172a)" },
  { id: "royal", name: "Royal Purple", frame: "linear-gradient(135deg,#7c3aed,#a855f7,#f0abfc)", boardBg: "#fdf4ff", cell: "bg-fuchsia-100", preview: "linear-gradient(135deg,#7c3aed,#f0abfc)" },
  { id: "emerald", name: "Emerald", frame: "linear-gradient(135deg,#047857,#10b981,#a7f3d0)", boardBg: "#f0fdf4", cell: "bg-emerald-100", preview: "linear-gradient(135deg,#047857,#a7f3d0)" },
  { id: "rose", name: "Rose Gold", frame: "linear-gradient(135deg,#e11d48,#fb7185,#fbcfe8)", boardBg: "#fff1f2", cell: "bg-rose-100", preview: "linear-gradient(135deg,#e11d48,#fbcfe8)" },
  { id: "ocean", name: "Ocean", frame: "linear-gradient(135deg,#0369a1,#0ea5e9,#bae6fd)", boardBg: "#f0f9ff", cell: "bg-sky-100", preview: "linear-gradient(135deg,#0369a1,#bae6fd)" },
];

export function boardThemeById(id: BoardThemeId): BoardTheme {
  return BOARD_THEMES.find((t) => t.id === id) ?? BOARD_THEMES[0];
}

const DICE_KEY = "lotus.skin.dice";
const TOKEN_KEY = "lotus.skin.token";
const BOARD_KEY = "lotus.skin.board";
// A board picture from the admin's SAVED BOARD LIBRARY that this player bought
// and chose. Separate from BOARD_KEY, which is the built-in colour theme.
const BOARD_IMG_KEY = "lotus.skin.boardImage";

// The complete DICE MODEL this player has chosen (Admin → Dice Models). Separate
// from DICE_KEY, which is the older face-style pick.
const DICE_MODEL_KEY = "lotus.skin.diceModel";

/** The dice model this player has chosen ("" = use the admin's active dice). */
export function useMyDiceModel(): [string, (id: string) => void] {
  const [id, setId] = useState("");
  useEffect(() => {
    try { setId(localStorage.getItem(DICE_MODEL_KEY) ?? ""); } catch { /* ignore */ }
  }, []);
  const set = (next: string) => {
    setId(next);
    try { localStorage.setItem(DICE_MODEL_KEY, next); } catch { /* ignore */ }
  };
  return [id, set];
}

/** The saved-library board this player has chosen ("" = use the admin default). */
export function useMyBoardImage(): [string, (id: string) => void] {
  const [id, setId] = useState("");
  useEffect(() => {
    try { setId(localStorage.getItem(BOARD_IMG_KEY) ?? ""); } catch { /* ignore */ }
  }, []);
  const set = (next: string) => {
    setId(next);
    try { localStorage.setItem(BOARD_IMG_KEY, next); } catch { /* ignore */ }
  };
  return [id, set];
}

export function useCosmetics() {
  const [dice, setDiceState] = useState<DiceSkinId>("classic");
  // Default token is the premium "Royal Lotus" 3D artwork (client's design), so
  // every player sees the lotus tokens out of the box. A player can still pick a
  // different style in Customize (their saved choice always wins). The token id is
  // a string so admin-added CUSTOM designs (non-built-in ids) can be selected too.
  const [token, setTokenState] = useState<string>("royal-lotus");
  const [board, setBoardState] = useState<BoardThemeId>("classic");

  useEffect(() => {
    let stored = "";
    try {
      const d = localStorage.getItem(DICE_KEY) as DiceSkinId | null;
      const t = localStorage.getItem(TOKEN_KEY);
      const b = localStorage.getItem(BOARD_KEY) as BoardThemeId | null;
      if (d && DICE_SKINS.some((s) => s.id === d)) setDiceState(d);
      if (t) { stored = t; setTokenState(t); } // any saved id (built-in or custom); unknown → default art
      if (b && BOARD_THEMES.some((s) => s.id === b)) setBoardState(b);
    } catch {
      /* ignore */
    }
    // THE LAST TOKEN A PLAYER USED MUST COME BACK.
    //
    // The choice was only ever kept in this browser, so a new phone, a cleared
    // browser or a private window silently dropped the player back to the
    // default token and they had to pick it again. The token is also saved on
    // the ACCOUNT (setToken below already does that), so read it back and use it
    // whenever this device has nothing stored. That makes the last-used token
    // follow the player everywhere, until they choose a different one.
    if (stored) return;
    let on = true;
    fetch(withBase("/api/users/cosmetics"), { credentials: "include", cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        const saved = typeof d?.tokenSkin === "string" ? d.tokenSkin : "";
        if (!on || !saved) return;
        setTokenState(saved);
        try { localStorage.setItem(TOKEN_KEY, saved); } catch { /* ignore */ }
      })
      .catch(() => {});
    return () => { on = false; };
  }, []);

  const setDice = (id: DiceSkinId) => {
    setDiceState(id);
    try { localStorage.setItem(DICE_KEY, id); } catch { /* ignore */ }
  };
  const setToken = (id: string) => {
    setTokenState(id);
    try { localStorage.setItem(TOKEN_KEY, id); } catch { /* ignore */ }
    // Persist to the account so EVERY player sees this token design on the board
    // (token picks are shared in real time, not just local to me). Fire-and-forget.
    try {
      fetch(withBase("/api/users/cosmetics"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ tokenSkin: id }),
        keepalive: true,
      }).catch(() => {});
    } catch { /* ignore */ }
  };
  const setBoard = (id: BoardThemeId) => {
    setBoardState(id);
    try { localStorage.setItem(BOARD_KEY, id); } catch { /* ignore */ }
  };

  return { dice, token, board, setDice, setToken, setBoard };
}
