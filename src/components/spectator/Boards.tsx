"use client";

import { useEffect } from "react";
import { Star, ArrowRight } from "lucide-react";
import { cn } from "@/lib/cn";
import { withBase } from "@/lib/base-path";
import { useConfig } from "@/lib/config";
import { activeDiceModel } from "@/lib/dice-model";
import { customTokenImage } from "@/lib/tokenDesigns";
import { resolveSafeStar, safeStarStyle, elementVis } from "@/lib/board-elements";
import { resolveHomeArea, homeAreaBoxStyle, usesDefaultWhiteBox, slotWrapperStyle, slotTokenStyle, slotPlateStyle, type HomeColor } from "@/lib/home-areas";
import { configureSafeCells } from "@/lib/ludo";
import { LudoToken } from "@/components/LudoToken";
import { BrandImg } from "@/components/BrandImg";
import { Die } from "@/components/Die";
import { LotusMark } from "@/components/Logo";
import { RING, HOME, START, isSafeCell, HOME_END, cellOf, currentColor, LABEL, type GameState, type Color as LColor } from "@/lib/ludo";
import { currentPlayer, type SLState, type Color as SColor } from "@/lib/snakeladder";
import type { ChessState, Color as CColor } from "@/lib/chess";
import { BOARD_THEMES, diceSkinById, type BoardTheme } from "@/lib/cosmetics";

// Spectators have no equipped cosmetics of their own, so the watch boards use the
// DEFAULT dice skin. Its surface/pip pair is what makes the pips visible — see the
// note on the <Die> calls below.
const WATCH_DIE = diceSkinById("classic");

// ============================================================
// Read-only board renderers for Spectator Mode. They take the
// live game state (polled from the server) and draw the board —
// no controls, no interaction.
// ============================================================

// These maps MIRROR the real play board (src/app/(app)/games/ludo/page.tsx) EXACTLY
// so spectator view looks identical to playing. Keep them in sync with that file.
const TOKEN: Record<LColor, string> = {
  red: "from-red-400 to-red-600 ring-red-200/80",
  green: "from-green-400 to-green-600 ring-green-200/80",
  yellow: "from-yellow-300 to-yellow-500 ring-yellow-100/80",
  blue: "from-blue-400 to-blue-600 ring-blue-200/80",
};
const YARD_BG: Record<LColor, string> = {
  red: "bg-red-500 border-red-700",
  green: "bg-green-600 border-green-800",
  yellow: "bg-yellow-400 border-yellow-600",
  blue: "bg-blue-600 border-blue-800",
};
const HOME_TINT: Record<LColor, string> = {
  red: "bg-red-500", green: "bg-green-600", yellow: "bg-yellow-400", blue: "bg-blue-600",
};
const STACK_BADGE: Record<LColor, string> = {
  red: "text-red-600 ring-red-500",
  green: "text-green-700 ring-green-600",
  yellow: "text-yellow-600 ring-yellow-500",
  blue: "text-blue-600 ring-blue-600",
};
const L_CORNER: Record<LColor, { row: string; col: string }> = {
  red: { row: "1 / 7", col: "1 / 7" }, green: { row: "1 / 7", col: "10 / 16" },
  yellow: { row: "10 / 16", col: "10 / 16" }, blue: { row: "10 / 16", col: "1 / 7" },
};
// Direction of the "coins start here" arrow per colour (matches the play board).
const START_DIR: Record<LColor, number> = (() => {
  const dirs = {} as Record<LColor, number>;
  (Object.keys(START) as LColor[]).forEach((c) => {
    const [r0] = RING[START[c]];
    const [r1, c1] = RING[(START[c] + 1) % RING.length];
    const c0 = RING[START[c]][1];
    dirs[c] = r1 > r0 ? 90 : r1 < r0 ? 270 : c1 < c0 ? 180 : 0;
  });
  return dirs;
})();
const RING_AT = new Map<string, number>();
RING.forEach(([r, c], i) => RING_AT.set(`${r},${c}`, i));
const START_COLOR = new Map<string, LColor>();
(Object.keys(START) as LColor[]).forEach((c) => { const [r, cc] = RING[START[c]]; START_COLOR.set(`${r},${cc}`, c); });
const HOME_CELL = new Map<string, LColor>();
(Object.keys(HOME) as LColor[]).forEach((c) => HOME[c].forEach(([r, cc]) => HOME_CELL.set(`${r},${cc}`, c)));
// Steps-to-home numbers on the coloured home path (5→1) — MIRRORS the play board
// (added there in v227), so Watch Mode looks identical to Play Mode.
const HOME_STEP = new Map<string, number>();
(Object.keys(HOME) as LColor[]).forEach((c) =>
  HOME[c].forEach(([r, cc], i) => { const steps = HOME_END - (51 + i); if (steps >= 1 && steps <= 5) HOME_STEP.set(`${r},${cc}`, steps); }),
);
const L_PATH: [number, number][] = [...RING, ...(Object.values(HOME).flat() as [number, number][])];

export function LudoWatch({ game, names, theme }: { game: GameState; names: Record<string, string>; theme?: BoardTheme }) {
  const boardTheme = theme ?? BOARD_THEMES[0];
  const turn = currentColor(game);
  // WATCH MODE USES THE SAME ADMIN BOARD SETTINGS AS THE REAL GAME, so a spectator
  // sees exactly the board the players see: the uploaded custom board, the token
  // placement areas ("hide white token area" included), the safe-zone star editor,
  // the element Show/Hide/Transparent table, the home symbol and the frame colour.
  // Everything below mirrors src/app/(app)/games/ludo/page.tsx — read-only.
  const { config: cfg } = useConfig();
  // The admin's active dice model, so the watch board draws the players' die.
  const watchDiceModel = activeDiceModel(cfg.diceModels, cfg.activeDiceModelId);
  const gb = cfg.gameBoard ?? {};
  const decor = gb.decor ?? {};
  const homeSymbol = (decor.homeSymbolShow !== false && (decor.homeSymbol ?? "").trim()) ? decor.homeSymbol! : "";
  const frameColor = (decor.frameColor ?? "").trim();
  const boxBorder = decor.boxBorder !== false;
  const borderColor = (decor.borderColor ?? "").trim();
  const boxHighlight = decor.boxHighlight !== false;
  const showArrow = decor.showArrow !== false;
  // Custom board picture — the saved library board wins, else the legacy single one.
  const gbBoards = Array.isArray(gb.boards) ? gb.boards : [];
  const activeBoard = gb.activeBoardId
    ? gbBoards.find((x) => x && x.id === gb.activeBoardId && x.enabled !== false && x.image && x.image.trim())
    : undefined;
  const legacyFull = (decor.fullImageShow !== false && (decor.fullImage ?? "").trim()) ? decor.fullImage! : "";
  const fullBoard = activeBoard ? activeBoard.image : legacyFull;
  const fullBoardOpacity = ((activeBoard ? activeBoard.opacityPct : decor.fullImageOpacityPct) ?? 100) / 100;
  const fullBoardFit = (activeBoard ? activeBoard.fit : decor.fullImageFit) ?? "contain";
  const fullBoardOffX = (activeBoard ? activeBoard.offsetXPct : decor.fullImageOffsetXPct) ?? 0;
  const fullBoardOffY = (activeBoard ? activeBoard.offsetYPct : decor.fullImageOffsetYPct) ?? 0;
  const fullBoardScale = ((activeBoard ? activeBoard.scalePct : decor.fullImageScalePct) ?? 100) / 100;
  // Safe-zone star + the element table, resolved exactly as the play board does.
  const safeStar = resolveSafeStar(cfg);
  const visGrid = elementVis(cfg, "grid");
  const visBoard = elementVis(cfg, "board");
  const visCellBorder = elementVis(cfg, "cellBorder");
  const visArrow = elementVis(cfg, "startArrow");
  const visNumbers = elementVis(cfg, "pathNumbers");
  const visHomeArea = elementVis(cfg, "homeArea");
  const visSlot = elementVis(cfg, "tokenSlot");
  const visTokenBg = elementVis(cfg, "tokenAreaBg");
  // Which squares are safe is served from the same admin config as the engine.
  const adminSafeCells = gb.safeCells;
  useEffect(() => { configureSafeCells(adminSafeCells); }, [adminSafeCells]);
  // Tokens use the admin's designs, defaulting to the same fallback the play board
  // uses for a player whose own pick hasn't loaded.
  const tokenSkin = "royal-lotus";
  // Resolved PER COLOUR so spectators see the same four distinct coins the
  // players do (a design may carry different art for red/green/yellow/blue).
  const tokenImgFor = (c: string) => customTokenImage(tokenSkin, cfg.tokenDesigns, c);
  // The admin's centre image / lotus watermark, same values as the play board.
  const center = gb.center ?? {};
  const centerShow = center.show !== false;
  const centerImage = (center.image ?? "").trim();
  const centerSize = center.sizePct ?? 84;
  const centerOpacity = (center.opacityPct ?? 40) / 100;
  const centerRotate = center.rotateDeg ?? 0;
  const centerOffX = center.offsetXPct ?? 0;
  const centerOffY = center.offsetYPct ?? 0;
  const byCell = new Map<string, GameState["tokens"]>();
  for (const tk of game.tokens) {
    const [r, c] = cellOf(tk);
    const k = `${r},${c}`;
    (byCell.get(k) ?? byCell.set(k, []).get(k)!).push(tk);
  }
  const homeCounts = Object.fromEntries(game.players.map((p) => [p, game.tokens.filter((t) => t.color === p && t.pos === HOME_END).length])) as Record<LColor, number>;

  // PLAYER CARDS LAID OUT LIKE THE PLAY SCREEN — one in each corner around the
  // board (top-left / top-right above it, bottom-left / bottom-right below), with
  // the dice beside whoever's turn it is. The old spectator view put a row of
  // chips and one big dice banner above the board, which is why watching looked
  // nothing like playing.
  const cornerOf: Record<LColor, "tl" | "tr" | "bl" | "br"> = { red: "tl", green: "tr", blue: "bl", yellow: "br" };
  const PlayerCard = ({ p, side }: { p: LColor; side: "left" | "right" }) => {
    const isTurn = p === turn && !game.winner;
    const out = game.removed?.includes(p);
    const dice = isTurn ? (
      <Die
        face={(game.die ?? 1) as 1 | 2 | 3 | 4 | 5 | 6}
        color={p}
        showNumber={game.die != null}
        // The play board passes the dice skin's surface + pip colours. Without
        // them the die took the PLAYER colour as its face and the pips had no
        // contrast against it — the die rendered as a flat coloured square with
        // only the corner number, which is what admins saw in watch mode.
        surface={WATCH_DIE.surface}
        pipClass={WATCH_DIE.pip}
        // The SAME dice model the players see — a watcher must never be shown a
        // different die from the one on the play board.
        model={watchDiceModel}
        // Idle → LOTUS face, never a pip "1" (matches the play board).
        faceImage={game.die == null ? withBase("/tokens/lotus-red.png") : undefined}
        className={cn("size-9 shrink-0", game.die == null && "opacity-50")}
      />
    ) : <span className="size-9 shrink-0" aria-hidden />;
    return (
      <div className={cn("flex min-w-0 flex-1 flex-col gap-1", out && "opacity-50")}>
        <div className={cn("flex items-center gap-1.5", side === "right" && "flex-row-reverse")}>
          {dice}
          <span className={cn("relative shrink-0 rounded-full p-[3px]", isTurn && "ring-2 ring-white/70")}>
            <span className="block size-10"><LudoToken color={p} skin={tokenSkin} image={tokenImgFor(p)} /></span>
          </span>
          <div className={cn("min-w-0 leading-tight", side === "right" && "text-right")}>
            <div className={cn("truncate text-xs font-bold", isTurn ? "text-mist-100" : "text-mist-300")}>{names[p] ?? p}</div>
            <div className="text-[10px] text-mist-500">{homeCounts[p] ?? 0}/4 home{isTurn ? " · turn" : ""}</div>
          </div>
        </div>
      </div>
    );
  };
  const at = (corner: "tl" | "tr" | "bl" | "br") => game.players.find((p) => cornerOf[p] === corner);
  const tl = at("tl"), tr = at("tr"), bl = at("bl"), br = at("br");

  return (
    <div>
      {/* Top-corner players — above the board, exactly like the play screen. */}
      <div className="mx-auto mb-2 flex w-full max-w-[440px] items-start justify-between gap-3">
        {tl ? <PlayerCard p={tl} side="left" /> : <span className="flex-1" />}
        {tr ? <PlayerCard p={tr} side="right" /> : <span className="flex-1" />}
      </div>


      {/* Board — the SAME admin-configured board the players are looking at. */}
      <div className="mx-auto w-full max-w-[440px]">
        <div className="relative aspect-square w-full rounded-2xl p-2 shadow-[0_24px_60px_-18px_rgba(0,0,0,0.85),inset_0_2px_8px_rgba(255,255,255,0.15)]" style={{ background: frameColor || boardTheme.frame }}>
          <div className="relative grid size-full gap-px rounded-lg p-1" style={{ background: fullBoard ? "transparent" : boardTheme.boardBg, gridTemplateColumns: "repeat(15,minmax(0,1fr))", gridTemplateRows: "repeat(15,minmax(0,1fr))" }}>
            {/* The admin's uploaded board picture — the playing surface. */}
            {fullBoard && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={withBase(fullBoard)} alt="" draggable={false} className="pointer-events-none absolute inset-0 z-0 size-full select-none rounded-lg" style={{ opacity: fullBoardOpacity, objectFit: fullBoardFit, objectPosition: "center", transform: `translate(${fullBoardOffX}%, ${fullBoardOffY}%) scale(${fullBoardScale})` }} />
            )}
            {/* Corner yards — honouring the Token Placement Area settings. */}
            {game.players.map((p) => {
              const ha = resolveHomeArea(cfg, p as HomeColor);
              const homeHidden = visHomeArea === "hide";
              const bgHidden = visTokenBg === "hide";
              const bgFaded = visTokenBg === "transparent";
              const boxStyle = bgHidden ? null : homeAreaBoxStyle(ha);
              const whiteBox = !bgHidden && !bgFaded && usesDefaultWhiteBox(ha);
              return (
                <div
                  key={`yard-${p}`}
                  className={cn(
                    "relative flex flex-col gap-1 rounded-xl border-2 p-1.5",
                    ha.showBorder && !homeHidden ? YARD_BG[p] : "border-transparent",
                    p === turn && !game.winner && "ring-2 ring-white/70",
                  )}
                  style={{
                    gridRow: L_CORNER[p].row, gridColumn: L_CORNER[p].col,
                    ...(visHomeArea === "transparent" ? { opacity: 0.25 } : {}),
                  }}
                >
                  <span className={cn("flex items-center justify-center gap-1 truncate rounded-md px-1.5 py-0.5 text-center text-[10px] font-bold text-white sm:text-xs", `bg-gradient-to-r ${TOKEN[p]}`)}>
                    <span className="truncate">{names[p] ?? p}</span>
                  </span>
                  <div
                    className={cn("relative grid flex-1 grid-cols-2 grid-rows-2 place-items-center gap-1.5 overflow-hidden rounded-lg p-2", whiteBox && "bg-white shadow-inner")}
                    style={boxStyle ?? undefined}
                  >
                    {homeSymbol && visHomeArea !== "hide" && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={withBase(homeSymbol)} alt="" draggable={false} className="pointer-events-none absolute inset-[12%] size-[76%] select-none object-contain opacity-60" />
                    )}
                    {[0, 1, 2, 3].map((i) => {
                      const tok = game.tokens.find((t) => t.color === p && t.index === i);
                      const inYard = !!tok && tok.pos === -1;
                      const s = ha.slots[i];
                      const plate = slotPlateStyle(s);
                      const slotOn = s.visible && s.layer !== "hidden" && visSlot !== "hide";
                      return (
                        <div key={i} className="grid size-full place-items-center" style={ha.on ? slotWrapperStyle(s) : undefined}>
                          {inYard ? (
                            <span className="relative grid size-4/5 place-items-center" style={ha.on ? slotTokenStyle(s) : undefined}>
                              <LudoToken color={p} skin={tokenSkin} image={tokenImgFor(p)} />
                            </span>
                          ) : slotOn ? (
                            <span
                              className={cn("grid size-3/4 place-items-center rounded-full", !plate && "border-2 border-dashed", !plate && (boardTheme.dark ? "border-black/20" : "border-black/15"))}
                              style={plate ?? undefined}
                            />
                          ) : null}
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}

            {/* Path cells (ring + home columns) with START arrows + safe-cell stars */}
            {L_PATH.map(([r, c]) => {
              const key = `${r},${c}`;
              const ringIdx = RING_AT.get(key);
              const startColor = START_COLOR.get(key);
              const homeColor = HOME_CELL.get(key);
              const homeStep = HOME_STEP.get(key);
              const isSafe = ringIdx !== undefined && isSafeCell(ringIdx);
              const showBorderHere = boxBorder && visCellBorder !== "hide" && visGrid !== "hide";
              const borderFaded = visCellBorder === "transparent" || visGrid === "transparent";
              const surfaceOff = !!fullBoard || visBoard === "hide" || visBoard === "transparent";
              return (
                <div
                  key={`cell-${key}`}
                  style={{
                    gridRow: r + 1, gridColumn: c + 1,
                    ...(showBorderHere && borderColor && !borderFaded ? { borderColor } : {}),
                    ...(borderFaded ? { borderColor: "rgba(255,255,255,0.08)" } : {}),
                  }}
                  className={cn(
                    "relative z-[1] grid place-items-center rounded-[2px]",
                    surfaceOff ? "" : cn(
                      showBorderHere && (borderColor || borderFaded ? "border" : cn("border", boardTheme.dark ? "border-white/10" : "border-black/15")),
                      boxHighlight
                        ? (homeColor ? HOME_TINT[homeColor] : startColor ? `bg-gradient-to-br ${TOKEN[startColor]}` : boardTheme.cell)
                        : boardTheme.cell,
                    ),
                    surfaceOff && showBorderHere && "border",
                  )}
                >
                  {isSafe && !startColor && (safeStar.show || safeStar.showTint) && (
                    <span className="relative grid size-full place-items-center">
                      {safeStar.showTint && (
                        <span className="pointer-events-none absolute inset-[6%] rounded-[3px]" style={{ backgroundColor: safeStar.color, opacity: 0.16, boxShadow: `inset 0 0 0 1.5px ${safeStar.color}` }} />
                      )}
                      {safeStar.show && (safeStar.iconMode === "custom" && safeStar.icon ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={withBase(safeStar.icon)} alt="" draggable={false} className="relative size-3/4 select-none object-contain" style={safeStarStyle(safeStar, true)} />
                      ) : (
                        <Star className="relative size-2/3" style={safeStarStyle(safeStar, false)} fill="currentColor" />
                      ))}
                    </span>
                  )}
                  {homeStep !== undefined && visNumbers !== "hide" && (
                    <span
                      style={visNumbers === "transparent" ? { opacity: 0.15 } : undefined}
                      className={cn(
                        "pointer-events-none grid size-3/4 select-none place-items-center rounded-full text-[8px] font-black leading-none text-white shadow-[inset_0_1px_2px_rgba(255,255,255,0.4),0_1px_2px_rgba(0,0,0,0.45)] sm:text-[11px]",
                        homeColor ? `bg-gradient-to-br ${TOKEN[homeColor]}` : "bg-black/40",
                      )}
                    >
                      {homeStep}
                    </span>
                  )}
                  {startColor && showArrow && visArrow !== "hide" && (
                    <span
                      style={visArrow === "transparent" ? { opacity: 0.15 } : undefined}
                      className="grid size-4/5 place-items-center rounded-full bg-black/35 ring-1 ring-white/80 shadow-[0_1px_3px_rgba(0,0,0,0.45)]"
                    >
                      <ArrowRight className="size-2/3 text-white drop-shadow-[0_1px_1px_rgba(0,0,0,0.6)]" strokeWidth={3} style={{ transform: `rotate(${START_DIR[startColor]}deg)` }} />
                    </span>
                  )}
                </div>
              );
            })}

            {/* Centre = the FINAL HOME, drawn exactly as the play board draws it —
                four coloured triangles pointing at their own arm, with the admin's
                centre image (or the built-in lotus) faded on top. */}
            <div
              className="relative z-[1] grid place-items-center overflow-hidden rounded-lg ring-1 ring-white/50 shadow-[inset_0_1px_6px_rgba(0,0,0,0.3)]"
              style={{
                gridRow: "7 / 10",
                gridColumn: "7 / 10",
                background: "conic-gradient(from -45deg, #16a34a 0deg 90deg, #facc15 90deg 180deg, #2563eb 180deg 270deg, #ef4444 270deg 360deg)",
              }}
            >
              {centerShow && (centerImage ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={withBase(centerImage)} alt="" draggable={false}
                  className="pointer-events-none absolute select-none object-contain"
                  style={{
                    width: `${centerSize}%`, height: `${centerSize}%`, opacity: centerOpacity,
                    transform: `translate(${centerOffX}%, ${centerOffY}%) rotate(${centerRotate}deg)`,
                  }}
                />
              ) : (
                <span className="pointer-events-none absolute grid place-items-center" style={{ width: `${centerSize}%`, height: `${centerSize}%`, opacity: centerOpacity }}>
                  <LotusMark className="size-full" />
                </span>
              ))}
            </div>

            {/* On-board tokens — grouped by colour with a count badge (read-only) */}
            {[...byCell.entries()].flatMap(([key, toks]) => {
              const [r, c] = key.split(",").map(Number);
              const onBoard = toks.filter((t) => t.pos !== -1);
              if (onBoard.length === 0) return [];
              const groups = new Map<LColor, GameState["tokens"]>();
              for (const t of onBoard) (groups.get(t.color) ?? groups.set(t.color, []).get(t.color)!).push(t);
              const entries = [...groups.entries()];
              return entries.map(([gc, gToks], i) => {
                const fan = entries.length > 1;
                const off = fan ? (i - (entries.length - 1) / 2) * 26 : 0;
                const count = gToks.length;
                return (
                  <span
                    key={`${gc}-${key}`}
                    style={{ gridRow: r + 1, gridColumn: c + 1, transform: fan ? `translateX(${off}%)` : undefined }}
                    className="relative z-20 m-[8%] sm:m-[12%]"
                  >
                    <LudoToken color={gc} skin={tokenSkin} image={tokenImgFor(gc)} />
                    {count > 1 && (
                      <span className={cn("absolute -right-1 -top-1 z-40 grid size-[1.05rem] place-items-center rounded-full bg-white text-[10px] font-extrabold leading-none shadow-md ring-2", STACK_BADGE[gc])}>
                        {count}
                      </span>
                    )}
                  </span>
                );
              });
            })}
          </div>
        </div>
      </div>

      {/* Bottom-corner players — below the board, exactly like the play screen. */}
      <div className="mx-auto mt-2 flex w-full max-w-[440px] items-start justify-between gap-3">
        {bl ? <PlayerCard p={bl} side="left" /> : <span className="flex-1" />}
        {br ? <PlayerCard p={br} side="right" /> : <span className="flex-1" />}
      </div>

      <p className="mt-3 text-center text-sm text-mist-300">
        {game.winner ? <>Winner: <span className="font-bold text-gold-300">{names[game.winner]}</span></> : <>Dice: <span className="font-bold text-mist-100">{game.die ?? "—"}</span> · {names[turn]}&apos;s turn</>}
      </p>
    </div>
  );
}

const S_DOT: Record<SColor, string> = { red: "bg-rose-500", green: "bg-emerald-500", yellow: "bg-amber-400", blue: "bg-sky-500" };
export function SnakeWatch({ game, names, theme }: { game: SLState; names: Record<string, string>; theme?: BoardTheme }) {
  const t = theme ?? BOARD_THEMES[0];
  const turn = currentPlayer(game);
  const tokensOn = (sq: number) => game.players.filter((p) => !(game.left ?? []).includes(p) && game.pos[p] === sq);
  // Same board picture + same playable-grid alignment the players see, so the
  // spectator view can never drift away from the real game.
  const { config } = useConfig();
  const snakeWatchDiceModel = activeDiceModel(config.diceModels, config.activeDiceModelId);
  const g = config.gameBoard?.snakeGrid ?? {};
  const grid = {
    topPct: Math.max(0, Math.min(45, g.topPct ?? 0)),
    leftPct: Math.max(0, Math.min(45, g.leftPct ?? 0)),
    widthPct: Math.max(10, Math.min(100, g.widthPct ?? 100)),
    heightPct: Math.max(10, Math.min(100, g.heightPct ?? 100)),
  };
  const tokenScale = Math.max(70, Math.min(140, config.gameBoard?.tokenScalePct ?? 100)) / 100;
  return (
    <div>
      <div className="mb-3 flex flex-wrap justify-center gap-2 text-xs">
        {game.players.map((p) => (
          <span key={p} className={cn("inline-flex items-center gap-1.5 rounded-full px-2.5 py-1", p === turn && !game.winner ? "bg-white/10 font-semibold text-mist-100 ring-1 ring-white/15" : "text-mist-400")}>
            <span className={cn("size-2.5 rounded-full", S_DOT[p])} /> {names[p] ?? p} <span className="tabular-nums text-mist-300">{game.pos[p]}</span>
          </span>
        ))}
      </div>

      {/* Live dice banner so spectators clearly see the current roll. */}
      {!game.winner && (
        <div className="mb-3 flex items-center justify-center gap-2.5">
          {/* Idle → LOTUS face, never a pip "1" (matches the play board). */}
          <Die face={(game.dice ?? 1) as 1 | 2 | 3 | 4 | 5 | 6} color={turn} showNumber={game.dice != null} surface={WATCH_DIE.surface} pipClass={WATCH_DIE.pip} model={snakeWatchDiceModel} faceImage={game.dice == null ? withBase("/tokens/lotus-red.png") : undefined} className={cn("size-10", game.dice == null && "opacity-60")} />
          <span className="text-sm text-mist-200"><b className="text-mist-100">{names[turn] ?? turn}</b>{game.dice != null ? <> rolled a <b className="text-mist-100">{game.dice}</b></> : " is rolling…"}</span>
        </div>
      )}
      {/* THE REAL BOARD — the same picture, the same admin grid alignment and
          the same coins the players see. This used to be a hand-drawn 10x10 of
          numbered CSS cells, which is why watch mode looked nothing like the
          game. Read-only: no dice, no tapping. */}
      <div className="mx-auto w-full max-w-[440px] rounded-2xl p-1.5" style={{ background: t.frame }}>
        <div className="relative overflow-hidden rounded-xl">
          <BrandImg slot="snakeBoard" alt="Snakes & Ladders board" className="block w-full select-none" draggable={false} />
          {game.players.map((p) => {
            if ((game.left ?? []).includes(p)) return null;
            const pos = game.pos[p];
            if (pos === 0) return null; // still in the base
            const idx = pos - 1;
            const row = Math.floor(idx / 10);
            const col = row % 2 === 0 ? idx % 10 : 9 - (idx % 10);
            const cw = grid.widthPct / 10, ch = grid.heightPct / 10;
            const mates = tokensOn(pos);
            const n = mates.length, mi = mates.indexOf(p);
            const SLOTS: Record<number, [number, number][]> = {
              2: [[-2.6, -2.6], [2.6, 2.6]],
              3: [[0, -2.8], [-2.8, 2.2], [2.8, 2.2]],
              4: [[-2.6, -2.6], [2.6, -2.6], [-2.6, 2.6], [2.6, 2.6]],
            };
            const [dx, dy] = n > 1 ? (SLOTS[Math.min(n, 4)]?.[mi] ?? [0, 0]) : [0, 0];
            const base = n <= 1 ? 0.85 : n === 2 ? 0.6 : n === 3 ? 0.52 : 0.46;
            return (
              <span
                key={`w-tok-${p}`}
                className="absolute z-20 block -translate-x-1/2 -translate-y-1/2 transition-[left,top] duration-300 ease-in-out"
                style={{
                  left: `${grid.leftPct + (col + 0.5) * cw + dx}%`,
                  top: `${grid.topPct + (9 - row + 0.5) * ch + dy}%`,
                  width: `${cw * base * tokenScale}%`,
                  height: `${cw * base * tokenScale}%`,
                }}
              >
                <LudoToken color={p} skin="royal-lotus" className="rounded-full" />
              </span>
            );
          })}
        </div>
      </div>
      <p className="mt-3 text-center text-sm text-mist-300">
        {game.winner ? <>Winner: <span className="font-bold text-gold-300">{names[game.winner]}</span></> : <>Dice: <span className="font-bold text-mist-100">{game.dice ?? "—"}</span> · {names[turn]}&apos;s turn</>}
      </p>
    </div>
  );
}

const GLYPH: Record<string, string> = { p: "♟", n: "♞", b: "♝", r: "♜", q: "♛", k: "♚" };
export function ChessWatch({ state, names }: { state: ChessState; names: Record<string, string> }) {
  const turnName = state.turn === "w" ? names.w : names.b;
  return (
    <div>
      <div className="mb-3 flex flex-wrap justify-center gap-3 text-xs">
        <span className={cn("inline-flex items-center gap-1.5 rounded-full px-2.5 py-1", state.turn === "w" ? "bg-white/10 font-semibold text-mist-100 ring-1 ring-white/15" : "text-mist-400")}><span className="size-2.5 rounded-full bg-white" /> {names.w} (White)</span>
        <span className={cn("inline-flex items-center gap-1.5 rounded-full px-2.5 py-1", state.turn === "b" ? "bg-white/10 font-semibold text-mist-100 ring-1 ring-white/15" : "text-mist-400")}><span className="size-2.5 rounded-full bg-ink-950 ring-1 ring-white/30" /> {names.b} (Black)</span>
      </div>
      <div className="mx-auto grid w-full max-w-[420px] grid-cols-8 overflow-hidden rounded-2xl border border-white/10">
        {state.board.map((rowArr, r) => rowArr.map((piece, c) => {
          const light = (r + c) % 2 === 0;
          return (
            <div key={`${r}-${c}`} className={cn("grid aspect-square place-items-center text-2xl sm:text-3xl", light ? "bg-mist-100/85" : "bg-lotus-800/70")}>
              {piece && <span className={piece.color === "w" ? "text-white drop-shadow-[0_1px_1px_rgba(0,0,0,0.6)]" : "text-ink-950"}>{GLYPH[piece.type]}</span>}
            </div>
          );
        }))}
      </div>
      <p className="mt-3 text-center text-sm text-mist-300">
        {state.winner ? <>Winner: <span className="font-bold text-gold-300">{state.winner === "w" ? names.w : names.b}</span></> : <>{turnName}&apos;s move{state.status === "check" ? " — check!" : ""}</>}
      </p>
    </div>
  );
}
