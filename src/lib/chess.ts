// ============================================================
// LotusPlay Connect — Chess engine (pure logic, no UI)
// Full legal-move rules: castling, en passant, promotion, check,
// checkmate and stalemate detection, plus a small alpha-beta bot.
// Board is board[r][c], r=0 is rank 8 (black side), r=7 is rank 1
// (white side). White moves up the board (r decreasing).
// ============================================================

export type Color = "w" | "b";
export type PieceType = "p" | "n" | "b" | "r" | "q" | "k";

export interface Piece {
  type: PieceType;
  color: Color;
}
export interface Sq {
  r: number;
  c: number;
}
export interface Move {
  from: Sq;
  to: Sq;
  piece: PieceType;
  capture?: PieceType;
  promotion?: PieceType;
  castle?: "K" | "Q";
  enPassant?: boolean;
  double?: boolean;
}
export interface Castling {
  wK: boolean;
  wQ: boolean;
  bK: boolean;
  bQ: boolean;
}
export type Status = "playing" | "check" | "checkmate" | "stalemate" | "draw";

export interface ChessState {
  board: (Piece | null)[][];
  turn: Color;
  castling: Castling;
  enPassant: Sq | null;
  halfmove: number;
  status: Status;
  winner: Color | null;
  lastMove: Move | null;
  forfeitedBy?: Color | null; // a player who left / timed out — the OTHER side wins
}

const opp = (c: Color): Color => (c === "w" ? "b" : "w");
const inB = (r: number, c: number): boolean => r >= 0 && r < 8 && c >= 0 && c < 8;

const KNIGHT = [[-2, -1], [-2, 1], [-1, -2], [-1, 2], [1, -2], [1, 2], [2, -1], [2, 1]];
const KING = [[-1, -1], [-1, 0], [-1, 1], [0, -1], [0, 1], [1, -1], [1, 0], [1, 1]];
const DIAG = [[-1, -1], [-1, 1], [1, -1], [1, 1]];
const ORTHO = [[-1, 0], [1, 0], [0, -1], [0, 1]];

export function initialState(): ChessState {
  const back: PieceType[] = ["r", "n", "b", "q", "k", "b", "n", "r"];
  const board: (Piece | null)[][] = Array.from({ length: 8 }, () => Array<Piece | null>(8).fill(null));
  for (let c = 0; c < 8; c++) {
    board[0][c] = { type: back[c], color: "b" };
    board[1][c] = { type: "p", color: "b" };
    board[6][c] = { type: "p", color: "w" };
    board[7][c] = { type: back[c], color: "w" };
  }
  return {
    board,
    turn: "w",
    castling: { wK: true, wQ: true, bK: true, bQ: true },
    enPassant: null,
    halfmove: 0,
    status: "playing",
    winner: null,
    lastMove: null,
  };
}

function cloneState(s: ChessState): ChessState {
  return {
    board: s.board.map((row) => row.map((p) => (p ? { ...p } : null))),
    turn: s.turn,
    castling: { ...s.castling },
    enPassant: s.enPassant ? { ...s.enPassant } : null,
    halfmove: s.halfmove,
    status: s.status,
    winner: s.winner,
    lastMove: s.lastMove ? { ...s.lastMove } : null,
  };
}

function findKing(board: (Piece | null)[][], color: Color): Sq | null {
  for (let r = 0; r < 8; r++)
    for (let c = 0; c < 8; c++) {
      const p = board[r][c];
      if (p && p.type === "k" && p.color === color) return { r, c };
    }
  return null;
}

/** Is square (r,c) attacked by any piece of color `by`? */
export function isAttacked(board: (Piece | null)[][], r: number, c: number, by: Color): boolean {
  const dir = by === "w" ? -1 : 1; // a `by` pawn at (r-dir, c±1) attacks (r,c)
  for (const dc of [-1, 1]) {
    const pr = r - dir;
    const pc = c + dc;
    if (inB(pr, pc)) {
      const p = board[pr][pc];
      if (p && p.color === by && p.type === "p") return true;
    }
  }
  for (const [dr, dc] of KNIGHT) {
    const pr = r + dr;
    const pc = c + dc;
    if (inB(pr, pc)) {
      const p = board[pr][pc];
      if (p && p.color === by && p.type === "n") return true;
    }
  }
  for (const [dr, dc] of KING) {
    const pr = r + dr;
    const pc = c + dc;
    if (inB(pr, pc)) {
      const p = board[pr][pc];
      if (p && p.color === by && p.type === "k") return true;
    }
  }
  for (const [dr, dc] of DIAG) {
    let pr = r + dr;
    let pc = c + dc;
    while (inB(pr, pc)) {
      const p = board[pr][pc];
      if (p) {
        if (p.color === by && (p.type === "b" || p.type === "q")) return true;
        break;
      }
      pr += dr;
      pc += dc;
    }
  }
  for (const [dr, dc] of ORTHO) {
    let pr = r + dr;
    let pc = c + dc;
    while (inB(pr, pc)) {
      const p = board[pr][pc];
      if (p) {
        if (p.color === by && (p.type === "r" || p.type === "q")) return true;
        break;
      }
      pr += dr;
      pc += dc;
    }
  }
  return false;
}

function stepMoves(
  board: (Piece | null)[][],
  r: number,
  c: number,
  color: Color,
  offsets: number[][],
  piece: PieceType,
  out: Move[],
): void {
  for (const [dr, dc] of offsets) {
    const tr = r + dr;
    const tc = c + dc;
    if (!inB(tr, tc)) continue;
    const target = board[tr][tc];
    if (!target) out.push({ from: { r, c }, to: { r: tr, c: tc }, piece });
    else if (target.color !== color)
      out.push({ from: { r, c }, to: { r: tr, c: tc }, piece, capture: target.type });
  }
}

function slideMoves(
  board: (Piece | null)[][],
  r: number,
  c: number,
  color: Color,
  dirs: number[][],
  piece: PieceType,
  out: Move[],
): void {
  for (const [dr, dc] of dirs) {
    let tr = r + dr;
    let tc = c + dc;
    while (inB(tr, tc)) {
      const target = board[tr][tc];
      if (!target) out.push({ from: { r, c }, to: { r: tr, c: tc }, piece });
      else {
        if (target.color !== color)
          out.push({ from: { r, c }, to: { r: tr, c: tc }, piece, capture: target.type });
        break;
      }
      tr += dr;
      tc += dc;
    }
  }
}

function pushPromos(out: Move[], from: Sq, to: Sq, capture?: PieceType): void {
  for (const promotion of ["q", "r", "b", "n"] as PieceType[])
    out.push({ from, to, piece: "p", capture, promotion });
}

function pawnMoves(s: ChessState, r: number, c: number, color: Color, out: Move[]): void {
  const b = s.board;
  const dir = color === "w" ? -1 : 1;
  const startRow = color === "w" ? 6 : 1;
  const promoRow = color === "w" ? 0 : 7;
  const one = r + dir;
  if (inB(one, c) && !b[one][c]) {
    if (one === promoRow) pushPromos(out, { r, c }, { r: one, c });
    else out.push({ from: { r, c }, to: { r: one, c }, piece: "p" });
    const two = r + 2 * dir;
    if (r === startRow && !b[two][c]) out.push({ from: { r, c }, to: { r: two, c }, piece: "p", double: true });
  }
  for (const dc of [-1, 1]) {
    const tr = r + dir;
    const tc = c + dc;
    if (!inB(tr, tc)) continue;
    const target = b[tr][tc];
    if (target && target.color !== color) {
      if (tr === promoRow) pushPromos(out, { r, c }, { r: tr, c: tc }, target.type);
      else out.push({ from: { r, c }, to: { r: tr, c: tc }, piece: "p", capture: target.type });
    } else if (!target && s.enPassant && s.enPassant.r === tr && s.enPassant.c === tc) {
      out.push({ from: { r, c }, to: { r: tr, c: tc }, piece: "p", capture: "p", enPassant: true });
    }
  }
}

function castleMoves(s: ChessState, color: Color, out: Move[]): void {
  const b = s.board;
  const row = color === "w" ? 7 : 0;
  const enemy = opp(color);
  if (b[row][4]?.type !== "k") return;
  if (isAttacked(b, row, 4, enemy)) return; // cannot castle out of check
  const kRight = color === "w" ? s.castling.wK : s.castling.bK;
  const qRight = color === "w" ? s.castling.wQ : s.castling.bQ;
  if (kRight && !b[row][5] && !b[row][6] && b[row][7]?.type === "r" && b[row][7]?.color === color) {
    if (!isAttacked(b, row, 5, enemy) && !isAttacked(b, row, 6, enemy))
      out.push({ from: { r: row, c: 4 }, to: { r: row, c: 6 }, piece: "k", castle: "K" });
  }
  if (qRight && !b[row][1] && !b[row][2] && !b[row][3] && b[row][0]?.type === "r" && b[row][0]?.color === color) {
    if (!isAttacked(b, row, 3, enemy) && !isAttacked(b, row, 2, enemy))
      out.push({ from: { r: row, c: 4 }, to: { r: row, c: 2 }, piece: "k", castle: "Q" });
  }
}

function pseudoMoves(s: ChessState, color: Color): Move[] {
  const out: Move[] = [];
  const b = s.board;
  for (let r = 0; r < 8; r++)
    for (let c = 0; c < 8; c++) {
      const p = b[r][c];
      if (!p || p.color !== color) continue;
      switch (p.type) {
        case "p":
          pawnMoves(s, r, c, color, out);
          break;
        case "n":
          stepMoves(b, r, c, color, KNIGHT, "n", out);
          break;
        case "k":
          stepMoves(b, r, c, color, KING, "k", out);
          castleMoves(s, color, out);
          break;
        case "b":
          slideMoves(b, r, c, color, DIAG, "b", out);
          break;
        case "r":
          slideMoves(b, r, c, color, ORTHO, "r", out);
          break;
        case "q":
          slideMoves(b, r, c, color, [...DIAG, ...ORTHO], "q", out);
          break;
      }
    }
  return out;
}

/** Apply a move and return a new state (status NOT recomputed — use play()). */
export function makeMove(s: ChessState, m: Move): ChessState {
  const st = cloneState(s);
  const b = st.board;
  const piece = b[m.from.r][m.from.c]!;
  const color = piece.color;

  b[m.to.r][m.to.c] = piece;
  b[m.from.r][m.from.c] = null;

  if (m.enPassant) b[m.from.r][m.to.c] = null;
  if (m.promotion) b[m.to.r][m.to.c] = { type: m.promotion, color };
  if (m.castle === "K") {
    b[m.to.r][5] = b[m.to.r][7];
    b[m.to.r][7] = null;
  }
  if (m.castle === "Q") {
    b[m.to.r][3] = b[m.to.r][0];
    b[m.to.r][0] = null;
  }

  if (piece.type === "k") {
    if (color === "w") {
      st.castling.wK = false;
      st.castling.wQ = false;
    } else {
      st.castling.bK = false;
      st.castling.bQ = false;
    }
  }
  const loseRook = (r: number, c: number) => {
    if (r === 7 && c === 0) st.castling.wQ = false;
    if (r === 7 && c === 7) st.castling.wK = false;
    if (r === 0 && c === 0) st.castling.bQ = false;
    if (r === 0 && c === 7) st.castling.bK = false;
  };
  if (piece.type === "r") loseRook(m.from.r, m.from.c);
  if (m.capture === "r") loseRook(m.to.r, m.to.c);

  st.enPassant = m.double ? { r: (m.from.r + m.to.r) / 2, c: m.from.c } : null;
  st.halfmove = m.piece === "p" || m.capture ? 0 : st.halfmove + 1;
  st.turn = opp(color);
  st.lastMove = m;
  return st;
}

/** All fully legal moves for the side to move (or a given color). */
export function legalMoves(s: ChessState, color?: Color): Move[] {
  const side = color ?? s.turn;
  const enemy = opp(side);
  const legal: Move[] = [];
  for (const m of pseudoMoves(s, side)) {
    const ns = makeMove(s, m);
    const k = findKing(ns.board, side);
    if (k && !isAttacked(ns.board, k.r, k.c, enemy)) legal.push(m);
  }
  return legal;
}

function statusFor(s: ChessState): { status: Status; winner: Color | null } {
  const side = s.turn;
  const legal = legalMoves(s, side);
  const k = findKing(s.board, side);
  const inCheck = k ? isAttacked(s.board, k.r, k.c, opp(side)) : false;
  if (legal.length === 0) {
    if (inCheck) return { status: "checkmate", winner: opp(side) };
    return { status: "stalemate", winner: null };
  }
  if (insufficientMaterial(s.board)) return { status: "draw", winner: null };
  return { status: inCheck ? "check" : "playing", winner: null };
}

function insufficientMaterial(board: (Piece | null)[][]): boolean {
  const pieces: Piece[] = [];
  for (const row of board) for (const p of row) if (p) pieces.push(p);
  if (pieces.length <= 2) return true; // K vs K
  if (pieces.length === 3)
    return pieces.some((p) => p.type === "n" || p.type === "b"); // K+minor vs K
  return false;
}

/** Apply a move and recompute game status. This is what the UI calls. */
export function play(s: ChessState, m: Move): ChessState {
  const ns = makeMove(s, m);
  const { status, winner } = statusFor(ns);
  ns.status = status;
  ns.winner = winner;
  return ns;
}

// ---------- Bot: alpha-beta negamax ----------

const VALUE: Record<PieceType, number> = { p: 100, n: 320, b: 330, r: 500, q: 900, k: 0 };

// Tiny center incentive for knights and pawns.
function centerBonus(p: Piece, r: number, c: number): number {
  if (p.type !== "n" && p.type !== "p") return 0;
  const d = Math.abs(3.5 - r) + Math.abs(3.5 - c);
  return Math.round((6 - d) * (p.type === "n" ? 3 : 1.5));
}

function evaluate(s: ChessState, forColor: Color): number {
  let score = 0;
  for (let r = 0; r < 8; r++)
    for (let c = 0; c < 8; c++) {
      const p = s.board[r][c];
      if (!p) continue;
      const v = VALUE[p.type] + centerBonus(p, r, c);
      score += p.color === forColor ? v : -v;
    }
  return score;
}

function orderMoves(moves: Move[]): Move[] {
  return [...moves].sort((a, b) => (b.capture ? VALUE[b.capture] : 0) - (a.capture ? VALUE[a.capture] : 0));
}

function negamax(s: ChessState, depth: number, alpha: number, beta: number): number {
  const moves = orderMoves(legalMoves(s, s.turn));
  if (moves.length === 0) {
    const k = findKing(s.board, s.turn);
    const inCheck = k ? isAttacked(s.board, k.r, k.c, opp(s.turn)) : false;
    return inCheck ? -100000 - depth : 0; // mated: prefer slower loss / faster mate
  }
  if (depth === 0) return evaluate(s, s.turn);
  let best = -Infinity;
  for (const m of moves) {
    const val = -negamax(makeMove(s, m), depth - 1, -beta, -alpha);
    if (val > best) best = val;
    if (best > alpha) alpha = best;
    if (alpha >= beta) break;
  }
  return best;
}

/** Best move for the side to move. depth 2 = casual, 3 = stronger. */
export function bestMove(s: ChessState, depth = 3): Move | null {
  const moves = orderMoves(legalMoves(s, s.turn));
  if (moves.length === 0) return null;
  let best = moves[0];
  let bestVal = -Infinity;
  let alpha = -Infinity;
  const beta = Infinity;
  for (const m of moves) {
    const val = -negamax(makeMove(s, m), depth - 1, -beta, -alpha);
    if (val > bestVal) {
      bestVal = val;
      best = m;
    }
    if (bestVal > alpha) alpha = bestVal;
  }
  return best;
}
