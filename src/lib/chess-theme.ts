import type { AppConfig } from "./config";
import type { Color, PieceType } from "./chess";

/**
 * CHESS BOARD & PIECE CUSTOMIZATION.
 *
 * The Ludo board is fully admin-controlled; this brings the same idea to Chess —
 * board themes and colours, an optional uploaded board picture, several piece
 * sets (plus fully custom uploaded pieces), coordinates, highlights, and the
 * movement/capture animations.
 *
 * APPEARANCE ONLY. Nothing here can change a chess rule: legality, check,
 * checkmate, stalemate and turn order all stay in lib/chess.ts. Turning a
 * highlight off only removes the hint — the move is still legal or still illegal.
 */

export type ChessPieceStyle = "classic" | "solid" | "outline" | "letters" | "custom";
export type ChessThemeId = "green" | "brown" | "blue" | "grey" | "midnight" | "lotus" | "custom";

export interface ChessTheme {
  id: ChessThemeId;
  name: string;
  light: string;
  dark: string;
  /** colour used for the rank/file coordinates on each square */
  coordLight: string;
  coordDark: string;
}

export const CHESS_THEMES: ChessTheme[] = [
  { id: "green", name: "Tournament Green", light: "#eeeed2", dark: "#6f9c5a", coordLight: "#6f9c5a", coordDark: "#eeeed2" },
  { id: "brown", name: "Classic Wood", light: "#f0d9b5", dark: "#b58863", coordLight: "#b58863", coordDark: "#f0d9b5" },
  { id: "blue", name: "Ocean Blue", light: "#dee3e6", dark: "#788a9e", coordLight: "#788a9e", coordDark: "#dee3e6" },
  { id: "grey", name: "Slate", light: "#e8e8e8", dark: "#8f8f8f", coordLight: "#8f8f8f", coordDark: "#e8e8e8" },
  { id: "midnight", name: "Midnight", light: "#5a6478", dark: "#2b3243", coordLight: "#2b3243", coordDark: "#9aa6bd" },
  { id: "lotus", name: "Lotus Violet", light: "#efe6f7", dark: "#7c5cb0", coordLight: "#7c5cb0", coordDark: "#efe6f7" },
];

export const PIECE_STYLES: { id: ChessPieceStyle; name: string; desc: string }[] = [
  { id: "classic", name: "Classic", desc: "Traditional outlined chess figures." },
  { id: "solid", name: "Solid", desc: "Bold filled figures — the clearest on a phone." },
  { id: "outline", name: "Outline", desc: "Light, open figures for a modern look." },
  { id: "letters", name: "Letters", desc: "K Q R B N P — maximum clarity on tiny screens." },
  { id: "custom", name: "Custom images", desc: "Your own uploaded picture for each piece." },
];

/** Filled glyphs — coloured by CSS, so they work for both sides. */
const SOLID: Record<PieceType, string> = { k: "♚", q: "♛", r: "♜", b: "♝", n: "♞", p: "♟" };
/** Outlined glyphs. */
const OUTLINE: Record<PieceType, string> = { k: "♔", q: "♕", r: "♖", b: "♗", n: "♘", p: "♙" };
const LETTERS: Record<PieceType, string> = { k: "K", q: "Q", r: "R", b: "B", n: "N", p: "P" };

export const PIECE_NAMES: Record<PieceType, string> = { k: "King", q: "Queen", r: "Rook", b: "Bishop", n: "Knight", p: "Pawn" };
export const PIECE_ORDER: PieceType[] = ["k", "q", "r", "b", "n", "p"];

export interface ChessCfg {
  themeId?: ChessThemeId;
  lightColor?: string;
  darkColor?: string;
  boardImage?: string;        // an uploaded picture used as the whole board surface
  boardImageOpacityPct?: number;
  // The same placement controls the Ludo board has, so an uploaded chess board can
  // be lined up exactly with the 8×8 grid.
  boardImageFit?: "contain" | "cover" | "fill"; // keep shape / cover board / stretch to grid
  boardImageOffsetXPct?: number;  // align left / right, -40..40
  boardImageOffsetYPct?: number;  // align up / down, -40..40
  boardImageScalePct?: number;    // zoom, 50..150
  pieceStyle?: ChessPieceStyle;
  /** custom piece images, keyed "w-k", "b-q", … (only used by the "custom" style) */
  pieceImages?: Record<string, string>;
  pieceScalePct?: number;
  showCoords?: boolean;
  showLegalDots?: boolean;
  showLastMove?: boolean;
  showCheckHighlight?: boolean;
  showWatermark?: boolean;
  animateMoves?: boolean;
  animMs?: number;
  captureFlash?: boolean;
  flipForBlack?: boolean;     // black sees the board from their own side
  showMoveHistory?: boolean;
  showCapturedTray?: boolean;
  boardBorder?: boolean;
}

export interface ResolvedChess {
  light: string;
  dark: string;
  coordLight: string;
  coordDark: string;
  boardImage: string;
  boardImageOpacity: number;
  boardImageFit: "contain" | "cover" | "fill";
  boardImageOffsetX: number;
  boardImageOffsetY: number;
  boardImageScale: number;
  pieceStyle: ChessPieceStyle;
  pieceImages: Record<string, string>;
  pieceScale: number;         // multiplier
  showCoords: boolean;
  showLegalDots: boolean;
  showLastMove: boolean;
  showCheckHighlight: boolean;
  showWatermark: boolean;
  animate: boolean;
  animMs: number;
  captureFlash: boolean;
  flipForBlack: boolean;
  showMoveHistory: boolean;
  showCapturedTray: boolean;
  boardBorder: boolean;
}

export function defaultChessCfg(): ChessCfg {
  return {
    themeId: "green", lightColor: "", darkColor: "", boardImage: "", boardImageOpacityPct: 100,
    boardImageFit: "cover", boardImageOffsetXPct: 0, boardImageOffsetYPct: 0, boardImageScalePct: 100,
    pieceStyle: "solid", pieceImages: {}, pieceScalePct: 100,
    showCoords: true, showLegalDots: true, showLastMove: true, showCheckHighlight: true,
    showWatermark: true, animateMoves: true, animMs: 220, captureFlash: true,
    flipForBlack: true, showMoveHistory: true, showCapturedTray: true, boardBorder: true,
  };
}

export function resolveChess(config: AppConfig): ResolvedChess {
  const c = config.gameBoard?.chess ?? {};
  const theme = CHESS_THEMES.find((t) => t.id === c.themeId) ?? CHESS_THEMES[0];
  const light = (c.lightColor ?? "").trim() || theme.light;
  const dark = (c.darkColor ?? "").trim() || theme.dark;
  return {
    light,
    dark,
    coordLight: theme.coordLight,
    coordDark: theme.coordDark,
    boardImage: (c.boardImage ?? "").trim(),
    boardImageOpacity: Math.max(0, Math.min(100, c.boardImageOpacityPct ?? 100)) / 100,
    boardImageFit: c.boardImageFit ?? "cover",
    boardImageOffsetX: Math.max(-40, Math.min(40, c.boardImageOffsetXPct ?? 0)),
    boardImageOffsetY: Math.max(-40, Math.min(40, c.boardImageOffsetYPct ?? 0)),
    boardImageScale: Math.max(50, Math.min(150, c.boardImageScalePct ?? 100)) / 100,
    pieceStyle: c.pieceStyle ?? "solid",
    pieceImages: c.pieceImages ?? {},
    pieceScale: Math.max(50, Math.min(160, c.pieceScalePct ?? 100)) / 100,
    showCoords: c.showCoords !== false,
    showLegalDots: c.showLegalDots !== false,
    showLastMove: c.showLastMove !== false,
    showCheckHighlight: c.showCheckHighlight !== false,
    showWatermark: c.showWatermark !== false,
    animate: c.animateMoves !== false,
    animMs: Math.max(0, Math.min(1200, c.animMs ?? 220)),
    captureFlash: c.captureFlash !== false,
    flipForBlack: c.flipForBlack !== false,
    showMoveHistory: c.showMoveHistory !== false,
    showCapturedTray: c.showCapturedTray !== false,
    boardBorder: c.boardBorder !== false,
  };
}

/** The glyph for a piece in the chosen style ("" when a custom image is used). */
export function pieceGlyph(style: ChessPieceStyle, type: PieceType): string {
  if (style === "letters") return LETTERS[type];
  if (style === "outline") return OUTLINE[type];
  if (style === "classic") return OUTLINE[type];
  return SOLID[type];
}

/** The uploaded image for one piece, if the admin set one. */
export function pieceImage(r: ResolvedChess, color: Color, type: PieceType): string {
  if (r.pieceStyle !== "custom") return "";
  return (r.pieceImages[`${color}-${type}`] ?? "").trim();
}

/**
 * "Classic" draws WHITE with outline glyphs and BLACK with solid ones, which is
 * how printed chess diagrams read. Every other style uses one glyph set and
 * colours it, so the two sides stay clearly distinguishable.
 */
export function glyphFor(style: ChessPieceStyle, color: Color, type: PieceType): string {
  if (style === "classic") return color === "w" ? OUTLINE[type] : SOLID[type];
  return pieceGlyph(style, type);
}

/** Text colour + outline so a piece stays readable on any square colour. */
export function pieceTextStyle(color: Color, style: ChessPieceStyle): { color: string; textShadow: string } {
  const white = color === "w";
  if (style === "letters") {
    return {
      color: white ? "#ffffff" : "#141414",
      textShadow: white ? "0 1px 2px rgba(0,0,0,0.75)" : "0 1px 2px rgba(255,255,255,0.45)",
    };
  }
  return {
    color: white ? "#ffffff" : "#202020",
    textShadow: white
      ? "0 0 1px #000, 0 0 2px #000, 0 1px 2px rgba(0,0,0,0.55)"
      : "0 0 1px rgba(255,255,255,0.55), 0 1px 2px rgba(0,0,0,0.4)",
  };
}

/** Algebraic name of a square, e.g. (0,0) → "a8". */
export function squareName(r: number, c: number): string {
  return `${"abcdefgh"[c]}${8 - r}`;
}

/** Short algebraic-ish notation for the move list (e.g. "Nf3", "exd5", "O-O"). */
export function moveNotation(piece: PieceType, from: { r: number; c: number }, to: { r: number; c: number }, captured: boolean, promo?: PieceType): string {
  // Castling — the king moving two files.
  if (piece === "k" && Math.abs(to.c - from.c) === 2) return to.c > from.c ? "O-O" : "O-O-O";
  const letter = piece === "p" ? "" : PIECE_ORDER.includes(piece) ? piece.toUpperCase() : "";
  const cap = captured ? (piece === "p" ? `${"abcdefgh"[from.c]}x` : "x") : "";
  return `${letter}${cap}${squareName(to.r, to.c)}${promo ? `=${promo.toUpperCase()}` : ""}`;
}
