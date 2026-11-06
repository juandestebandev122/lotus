"use client";

import { useState } from "react";
import { Palette, ChevronDown, Check } from "lucide-react";
import { Die } from "@/components/Die";
import { LudoToken } from "@/components/LudoToken";
import { useConfig } from "@/lib/config";
import { enabledTokenDesigns } from "@/lib/tokenDesigns";
import {
  BOARD_THEMES,
  DICE_SKINS,
  boardThemeById,
  diceSkinById,
  useCosmetics,
} from "@/lib/cosmetics";
import { cn } from "@/lib/cn";

/**
 * Pre-game customization surfaced in the game lobby: pick your BOARD design,
 * TOKEN design and DICE design with a LIVE PREVIEW before the match starts.
 * These are your personal choices (they apply to YOUR view of the board) and are
 * remembered for next time — the same picks the full Customize page saves.
 */
export function GameCustomizePanel({ defaultOpen = false }: { defaultOpen?: boolean }) {
  const { dice, token, board, setDice, setToken, setBoard } = useCosmetics();
  const { config } = useConfig();
  const tokens = enabledTokenDesigns(config.tokenDesigns);
  const [open, setOpen] = useState(defaultOpen);

  const theme = boardThemeById(board);
  const die = diceSkinById(dice);
  const tokenDesign = tokens.find((t) => t.id === token) ?? tokens[0];

  return (
    <div className="mt-5 rounded-xl border border-white/10 bg-ink-800/60">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center gap-2.5 px-3.5 py-3 text-left"
      >
        <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-lotus-500/15 text-lotus-300"><Palette className="size-4" /></span>
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-semibold text-mist-100">Customize your game</span>
          <span className="block truncate text-[11px] text-mist-400">Board, tokens &amp; dice — live preview before you play</span>
        </span>
        {/* Live mini-preview of the current picks */}
        <span className="flex shrink-0 items-center gap-1.5">
          <span className="size-6 rounded-md ring-1 ring-white/20" style={{ background: theme.preview }} title="Board" />
          <span className="block size-6" title="Token"><LudoToken color="red" skin={tokenDesign?.builtin ?? tokenDesign?.id ?? "royal-lotus"} image={tokenDesign?.image} /></span>
          <Die face={5} surface={die.surface} pipClass={die.pip} className="size-6" />
        </span>
        <ChevronDown className={cn("size-4 shrink-0 text-mist-400 transition", open && "rotate-180")} />
      </button>

      {open && (
        <div className="space-y-4 border-t border-white/8 px-3.5 py-3.5">
          {/* Board design */}
          <Section title="Board design">
            <div className="flex flex-wrap gap-2">
              {BOARD_THEMES.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setBoard(t.id)}
                  title={t.name}
                  className={cn("relative size-10 rounded-lg ring-1 transition hover:scale-105", board === t.id ? "ring-2 ring-lotus-400" : "ring-white/15")}
                  style={{ background: t.preview }}
                >
                  {board === t.id && <span className="absolute inset-0 grid place-items-center"><Check className="size-4 text-white drop-shadow" /></span>}
                </button>
              ))}
            </div>
          </Section>

          {/* Token design */}
          <Section title="Token design">
            <div className="flex flex-wrap gap-2">
              {tokens.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setToken(t.id)}
                  title={t.name}
                  className={cn("relative grid size-10 place-items-center rounded-lg border bg-ink-900 p-1 transition hover:scale-105", token === t.id ? "border-lotus-400 ring-1 ring-lotus-400/50" : "border-white/10")}
                >
                  <span className="block size-full"><LudoToken color="red" skin={t.builtin ?? t.id} image={t.image} /></span>
                  {t.category && t.category !== "Free" && <span className="absolute -right-1 -top-1 rounded bg-amber-400 px-1 text-[7px] font-black uppercase text-ink-900">{t.category[0]}</span>}
                </button>
              ))}
            </div>
          </Section>

          {/* Dice design */}
          <Section title="Dice design">
            <div className="flex flex-wrap gap-2">
              {DICE_SKINS.map((d) => (
                <button
                  key={d.id}
                  type="button"
                  onClick={() => setDice(d.id)}
                  title={d.name}
                  className={cn("rounded-lg p-1 transition hover:scale-105", dice === d.id ? "ring-2 ring-lotus-400" : "ring-1 ring-white/10")}
                >
                  <Die face={5} surface={d.surface} pipClass={d.pip} className="size-8" />
                </button>
              ))}
            </div>
          </Section>

          <p className="text-[11px] text-mist-500">These are your personal picks — they apply to your view and are saved for next time.</p>
        </div>
      )}
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="mb-1.5 text-xs font-semibold text-mist-300">{title}</p>
      {children}
    </div>
  );
}
