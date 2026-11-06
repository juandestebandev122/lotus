"use client";

import { useEffect, useRef, useState } from "react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import { useConfig, saveConfig } from "@/lib/config";
import { withBase } from "@/lib/base-path";
import { cn } from "@/lib/cn";
import {
  CHESS_THEMES, PIECE_STYLES, PIECE_NAMES, PIECE_ORDER, defaultChessCfg,
  glyphFor, pieceTextStyle,
  type ChessCfg, type ChessPieceStyle, type ChessThemeId,
} from "@/lib/chess-theme";
import type { Color, PieceType } from "@/lib/chess";
import { Swords, Check, RotateCcw, Upload, Trash2, Info, Palette, Sparkles, Eye } from "lucide-react";

// ---------------------------------------------------------------------------
// ADMIN → CHESS BOARD
// The same level of control the Ludo board has, applied to Chess: board themes
// and colours, an uploaded board picture, piece sets (including fully custom
// uploaded pieces), the on-board hints, animations and board orientation.
//
// APPEARANCE ONLY — no chess rule can be reached from this page.
// ---------------------------------------------------------------------------

// UPLOAD SPEC — the sizes an admin should actually use, and the real server
// limit (/api/admin/tokens rejects anything above 32 MB). Kept here in one place
// so the on-screen instructions and the checks can never drift apart.
const MAX_UPLOAD_MB = 32;
const MAX_UPLOAD_BYTES = MAX_UPLOAD_MB * 1024 * 1024;
/** The board is one square picture covering all 64 squares. */
const BOARD_SPEC = { what: "board picture", min: 512, ideal: 1024, max: 2048 };
/** Each piece is a small square picture with a transparent background. */
const PIECE_SPEC = { what: "piece picture", min: 128, ideal: 256, max: 1024 };

const START_ROWS: { type: PieceType; color: Color }[][] = [
  [{ type: "r", color: "b" }, { type: "n", color: "b" }, { type: "b", color: "b" }, { type: "q", color: "b" }, { type: "k", color: "b" }, { type: "b", color: "b" }, { type: "n", color: "b" }, { type: "r", color: "b" }],
  Array.from({ length: 8 }, () => ({ type: "p" as PieceType, color: "b" as Color })),
  [], [], [], [],
  Array.from({ length: 8 }, () => ({ type: "p" as PieceType, color: "w" as Color })),
  [{ type: "r", color: "w" }, { type: "n", color: "w" }, { type: "b", color: "w" }, { type: "q", color: "w" }, { type: "k", color: "w" }, { type: "b", color: "w" }, { type: "n", color: "w" }, { type: "r", color: "w" }],
];

export default function AdminChessBoardPage() {
  const { config, loading, reload } = useConfig();
  const { toast } = useToast();
  const [c, setC] = useState<ChessCfg>(defaultChessCfg());
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [showGrid, setShowGrid] = useState(true); // 8×8 alignment overlay on the preview
  const seeded = useRef(false);

  useEffect(() => {
    if (loading || seeded.current) return;
    seeded.current = true;
    setC({ ...defaultChessCfg(), ...(config.gameBoard?.chess ?? {}) });
  }, [loading, config.gameBoard?.chess]);

  const set = (patch: Partial<ChessCfg>) => setC((s) => ({ ...s, ...patch }));

  /** Read a picture's real pixel size before it goes anywhere. */
  const measure = (file: File) =>
    new Promise<{ w: number; h: number } | null>((resolve) => {
      const url = URL.createObjectURL(file);
      const img = new Image();
      img.onload = () => { URL.revokeObjectURL(url); resolve({ w: img.naturalWidth, h: img.naturalHeight }); };
      img.onerror = () => { URL.revokeObjectURL(url); resolve(null); };
      img.src = url;
    });

  /**
   * `kind` decides which size rules the picture is checked against — a board is
   * a square surface, a piece is a small square with transparency. The checks
   * only WARN: the upload still goes through, because an admin who knows what
   * they're doing shouldn't be blocked by a guideline.
   */
  const upload = (apply: (url: string) => void, kind: "board" | "piece" = "board") => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/png,image/jpeg,image/webp,image/gif,image/svg+xml";
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return;

      // Size + shape guidance, checked against the real file (SVG has no pixel
      // size, so it's exempt).
      if (file.size > MAX_UPLOAD_BYTES) {
        toast(`That file is ${(file.size / 1024 / 1024).toFixed(1)} MB — the limit is ${MAX_UPLOAD_MB} MB. Please save it smaller.`, "error");
        return;
      }
      if (!file.type.includes("svg")) {
        const dim = await measure(file);
        if (dim) {
          const spec = kind === "board" ? BOARD_SPEC : PIECE_SPEC;
          const ratio = dim.w / dim.h;
          if (ratio < 0.98 || ratio > 1.02) {
            toast(`This picture is ${dim.w}×${dim.h} — not square. A ${spec.what} must be square (1:1), e.g. ${spec.ideal}×${spec.ideal}. It will look stretched or cropped.`, "error");
          } else if (dim.w < spec.min) {
            toast(`${dim.w}×${dim.h} is smaller than the ${spec.min}×${spec.min} minimum — it will look blurry on a phone. ${spec.ideal}×${spec.ideal} is ideal.`, "error");
          } else if (dim.w > spec.max) {
            toast(`${dim.w}×${dim.h} is larger than needed — ${spec.ideal}×${spec.ideal} looks identical and loads faster.`, "info");
          }
        }
      }

      setUploading(true);
      const fd = new FormData();
      fd.append("file", file);
      try {
        const res = await fetch(withBase("/api/admin/tokens"), { method: "POST", body: fd, credentials: "include" });
        const d = await res.json();
        if (res.ok && d.url) { apply(d.url as string); toast("Uploaded — press Save to make it live.", "success"); }
        else toast(d.error ?? "Upload failed", "error");
      } catch { toast("Upload failed", "error"); }
      setUploading(false);
    };
    input.click();
  };

  const save = async () => {
    setSaving(true);
    const res = await saveConfig({ gameBoard: { ...(config.gameBoard ?? {}), chess: c } });
    setSaving(false);
    if (res.ok) { await reload(); toast("Chess board saved — live for every player.", "success"); }
    else toast(res.error ?? "Could not save", "error");
  };

  const theme = CHESS_THEMES.find((t) => t.id === c.themeId) ?? CHESS_THEMES[0];
  const light = (c.lightColor ?? "").trim() || theme.light;
  const dark = (c.darkColor ?? "").trim() || theme.dark;
  const setPieceImage = (color: Color, type: PieceType, url: string) =>
    setC((s) => {
      const imgs = { ...(s.pieceImages ?? {}) };
      if (url) imgs[`${color}-${type}`] = url; else delete imgs[`${color}-${type}`];
      return { ...s, pieceImages: imgs };
    });

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="flex items-center gap-2 font-display text-2xl font-extrabold text-mist-100">
            <Swords className="size-6 text-lotus-300" /> Chess Board
          </h1>
          <p className="max-w-3xl text-sm text-mist-400">
            The same control the Ludo board has, for Chess — board themes and colours, your own board picture, piece
            sets (or fully custom uploaded pieces), the on-board hints, animations and board orientation.
          </p>
        </div>
        <Button onClick={save} disabled={saving}><Check className="size-4" /> {saving ? "Saving…" : "Save changes"}</Button>
      </div>

      <div className="flex items-start gap-2 rounded-xl border border-sky-400/25 bg-sky-500/[0.06] px-4 py-3 text-xs text-mist-300">
        <Info className="mt-0.5 size-4 shrink-0 text-sky-300" />
        <p><b className="text-mist-100">Appearance only.</b> Nothing on this page can change a chess rule — legal moves, check, checkmate, stalemate, castling, en-passant and promotion all keep working exactly as they do now. Turning a hint off only hides the hint.</p>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_22rem]">
        <div className="space-y-4">
          {/* Board theme */}
          <Card className="p-4 sm:p-5">
            <h2 className="flex items-center gap-2 font-display text-lg font-bold text-mist-100"><Palette className="size-5 text-lotus-300" /> Board theme</h2>
            <p className="mt-0.5 text-sm text-mist-400">Pick a ready-made board, or set your own two square colours.</p>
            <div className="mt-3 grid gap-2 sm:grid-cols-3">
              {CHESS_THEMES.map((t) => (
                <button
                  key={t.id}
                  onClick={() => set({ themeId: t.id as ChessThemeId, lightColor: "", darkColor: "" })}
                  className={cn(
                    "flex items-center gap-2.5 rounded-xl border p-2.5 text-left transition",
                    c.themeId === t.id && !c.lightColor && !c.darkColor ? "border-lotus-400/60 bg-lotus-500/15" : "border-line bg-ink-900 hover:border-mist-600",
                  )}
                >
                  <span className="grid size-9 shrink-0 grid-cols-2 grid-rows-2 overflow-hidden rounded-md ring-1 ring-white/10">
                    <span style={{ background: t.light }} /><span style={{ background: t.dark }} />
                    <span style={{ background: t.dark }} /><span style={{ background: t.light }} />
                  </span>
                  <span className="min-w-0 text-sm font-semibold text-mist-100">{t.name}</span>
                </button>
              ))}
            </div>

            <div className="mt-4 flex flex-wrap items-center gap-4 border-t border-line/60 pt-4">
              <label className="flex items-center gap-2 text-sm text-mist-200">
                Light squares
                <input type="color" value={light.slice(0, 7)} onChange={(e) => set({ lightColor: e.target.value })} className="size-9 cursor-pointer rounded border border-line bg-transparent" />
              </label>
              <label className="flex items-center gap-2 text-sm text-mist-200">
                Dark squares
                <input type="color" value={dark.slice(0, 7)} onChange={(e) => set({ darkColor: e.target.value })} className="size-9 cursor-pointer rounded border border-line bg-transparent" />
              </label>
              {(c.lightColor || c.darkColor) && (
                <button onClick={() => set({ lightColor: "", darkColor: "" })} className="inline-flex items-center gap-1.5 text-sm font-semibold text-mist-400 hover:text-mist-100">
                  <RotateCcw className="size-4" /> Back to the theme colours
                </button>
              )}
            </div>

            {/* Board background picture */}
            <div className="mt-4 border-t border-line/60 pt-4">
              <div className="text-sm font-semibold text-mist-100">Board picture (optional)</div>
              <p className="text-xs text-mist-500">Your own artwork as the whole board surface. The squares become see-through so the picture reads underneath.</p>

              {/* HOW TO UPLOAD A CHESS BOARD — the exact size and the rules that
                  matter, right where the button is, so nobody has to guess. */}
              <div className="mt-2.5 rounded-xl border border-lotus-400/25 bg-lotus-500/[0.07] p-3">
                <div className="flex items-center gap-1.5 text-xs font-bold text-lotus-200">
                  <Info className="size-3.5" /> How to upload a board picture
                </div>
                <ul className="mt-1.5 space-y-1 text-[11px] leading-relaxed text-mist-300">
                  <li>
                    <b className="text-mist-100">Size:</b> {BOARD_SPEC.ideal} × {BOARD_SPEC.ideal} pixels is ideal.
                    Minimum {BOARD_SPEC.min} × {BOARD_SPEC.min}; anything above {BOARD_SPEC.max} × {BOARD_SPEC.max} only
                    makes the file heavier without looking better.
                  </li>
                  <li>
                    <b className="text-mist-100">Shape:</b> it must be a perfect <b>square (1:1)</b>. The board is
                    drawn as a square, so a rectangle gets stretched or cropped.
                  </li>
                  <li>
                    <b className="text-mist-100">Squares:</b> the picture is divided into 8 × 8. At {BOARD_SPEC.ideal} px
                    each square is <b>{BOARD_SPEC.ideal / 8} px</b> — draw your squares on that grid and the pieces land
                    dead centre.
                  </li>
                  <li>
                    <b className="text-mist-100">File:</b> PNG, JPG or WebP (SVG also works), up to <b>{MAX_UPLOAD_MB} MB</b>.
                    PNG is best for crisp lines, JPG for photographic wood/marble art.
                  </li>
                  <li>
                    <b className="text-mist-100">Safe area:</b> keep borders and decoration inside the outer 3&nbsp;% —
                    on a phone the very edge can be clipped by the rounded corners.
                  </li>
                  <li>
                    <b className="text-mist-100">After uploading:</b> turn <b>Grid ON</b> in the preview and use
                    Fit / Align / Zoom below until your squares sit exactly on the 8 × 8 lines, then press <b>Save</b>.
                  </li>
                </ul>
              </div>

              <div className="mt-2 flex flex-wrap items-center gap-3">
                <div className="grid size-16 shrink-0 place-items-center overflow-hidden rounded-lg border border-line bg-ink-900">
                  {c.boardImage ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={withBase(c.boardImage)} alt="" className="size-full object-cover" />
                  ) : <span className="text-[10px] text-mist-600">None</span>}
                </div>
                <Button size="sm" variant="secondary" onClick={() => upload((url) => set({ boardImage: url }), "board")} disabled={uploading}>
                  <Upload className="size-4" /> {uploading ? "Uploading…" : "Upload board"}
                </Button>
                {c.boardImage && <button onClick={() => set({ boardImage: "" })} className="inline-flex items-center gap-1 text-xs text-mist-500 hover:text-rose-300"><Trash2 className="size-3.5" /> Remove</button>}
              </div>
              {/* The same placement controls the Ludo board has, so an uploaded
                  chess board can be lined up exactly with the 8×8 grid. */}
              {c.boardImage && (
                <div className="mt-3 space-y-2.5 rounded-xl border border-line bg-ink-900/40 p-3">
                  <div className="grid gap-1.5 sm:grid-cols-3">
                    {([
                      { id: "contain", label: "Fit — keep shape", hint: "Shows the whole picture, no stretching." },
                      { id: "cover", label: "Fill — cover board", hint: "Fills the board edge to edge; may crop." },
                      { id: "fill", label: "Stretch to grid", hint: "Forces the exact board square." },
                    ] as const).map((f) => (
                      <button
                        key={f.id}
                        onClick={() => set({ boardImageFit: f.id })}
                        className={cn("rounded-lg border p-2 text-left transition", (c.boardImageFit ?? "cover") === f.id ? "border-lotus-400/60 bg-lotus-500/15" : "border-line bg-ink-900 hover:border-mist-600")}
                      >
                        <div className="text-xs font-semibold text-mist-100">{f.label}</div>
                        <div className="text-[10px] leading-snug text-mist-500">{f.hint}</div>
                      </button>
                    ))}
                  </div>
                  <Slider label="Opacity" value={c.boardImageOpacityPct ?? 100} min={10} max={100} suffix="%" onChange={(v) => set({ boardImageOpacityPct: v })} />
                  <Slider label="Align — left / right" value={c.boardImageOffsetXPct ?? 0} min={-40} max={40} suffix="%" onChange={(v) => set({ boardImageOffsetXPct: v })} />
                  <Slider label="Align — up / down" value={c.boardImageOffsetYPct ?? 0} min={-40} max={40} suffix="%" onChange={(v) => set({ boardImageOffsetYPct: v })} />
                  <Slider label="Zoom" value={c.boardImageScalePct ?? 100} min={50} max={150} suffix="%" onChange={(v) => set({ boardImageScalePct: v })} />
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] text-mist-500">Grid alignment preview</span>
                    <button
                      onClick={() => setShowGrid((g) => !g)}
                      className={cn("rounded-full px-2.5 py-1 text-[10px] font-bold transition", showGrid ? "bg-emerald-500/20 text-emerald-300" : "bg-white/[0.06] text-mist-400")}
                    >
                      Grid {showGrid ? "ON" : "OFF"}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </Card>

          {/* Pieces */}
          <Card className="p-4 sm:p-5">
            <h2 className="flex items-center gap-2 font-display text-lg font-bold text-mist-100"><Sparkles className="size-5 text-lotus-300" /> Chess pieces</h2>
            <p className="mt-0.5 text-sm text-mist-400">Choose a piece set, or upload your own picture for each of the twelve pieces.</p>

            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              {PIECE_STYLES.map((s) => (
                <button
                  key={s.id}
                  onClick={() => set({ pieceStyle: s.id as ChessPieceStyle })}
                  className={cn("rounded-xl border p-3 text-left transition", c.pieceStyle === s.id ? "border-lotus-400/60 bg-lotus-500/15" : "border-line bg-ink-900 hover:border-mist-600")}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-semibold text-mist-100">{s.name}</span>
                    <span className="flex items-center gap-0.5 text-lg leading-none">
                      {(["k", "q", "n"] as PieceType[]).map((t) => (
                        <span key={t} style={pieceTextStyle("w", s.id)}>{glyphFor(s.id, "w", t)}</span>
                      ))}
                    </span>
                  </div>
                  <div className="mt-0.5 text-[11px] text-mist-500">{s.desc}</div>
                </button>
              ))}
            </div>

            <div className="mt-3">
              <Slider label="Piece size" value={c.pieceScalePct ?? 100} min={50} max={160} suffix="%" onChange={(v) => set({ pieceScalePct: v })} />
            </div>

            {c.pieceStyle === "custom" && (
              <div className="mt-4 border-t border-line/60 pt-4">
                <div className="text-sm font-semibold text-mist-100">Custom piece pictures</div>
                <p className="text-xs text-mist-500">Upload a picture for each piece. Any you leave empty fall back to the built-in figure, so you can do them one at a time.</p>
                {/* Stated because a set of JPEGs was uploaded and every piece came
                    out inside a white box — JPEG cannot carry transparency. */}
                <div className="mt-2 rounded-lg border border-amber-400/25 bg-amber-500/[0.07] px-3 py-2 text-[11px] leading-relaxed text-mist-300">
                  <b className="text-amber-200">Required image format</b>
                  <ul className="mt-1 space-y-0.5">
                    <li>• <b className="text-mist-200">PNG with a transparent background.</b> A JPEG cannot be transparent, so the piece would show a white box on the dark squares.</li>
                    <li>• <b className="text-mist-200">256 × 256 px</b> recommended — 512 × 512 for extra sharpness on large screens.</li>
                    <li>• <b className="text-mist-200">Square picture</b>, piece centred, with roughly 5% empty margin so it never touches the edges.</li>
                    <li>• Keep each file under about 100 KB — all 12 pieces load together.</li>
                  </ul>
                </div>
                {(["w", "b"] as Color[]).map((color) => (
                  <div key={color} className="mt-3">
                    <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-mist-400">{color === "w" ? "White" : "Black"} pieces</div>
                    <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
                      {PIECE_ORDER.map((t) => {
                        const url = (c.pieceImages ?? {})[`${color}-${t}`] ?? "";
                        return (
                          <div key={t} className="rounded-lg border border-line bg-ink-900 p-2 text-center">
                            <div className="mx-auto grid size-10 place-items-center overflow-hidden rounded bg-ink-950">
                              {url ? (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img src={withBase(url)} alt="" className="size-full object-contain" />
                              ) : (
                                <span className="text-lg leading-none" style={pieceTextStyle(color, "solid")}>{glyphFor("solid", color, t)}</span>
                              )}
                            </div>
                            <div className="mt-1 text-[10px] text-mist-400">{PIECE_NAMES[t]}</div>
                            <div className="mt-1 flex items-center justify-center gap-1">
                              <button onClick={() => upload((u) => setPieceImage(color, t, u), "piece")} className="rounded px-1.5 py-0.5 text-[10px] font-semibold text-lotus-300 hover:bg-lotus-500/10">Upload</button>
                              {url && <button onClick={() => setPieceImage(color, t, "")} className="rounded px-1 py-0.5 text-[10px] text-mist-500 hover:text-rose-300">×</button>}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>

          {/* Play experience */}
          <Card className="p-4 sm:p-5">
            <h2 className="flex items-center gap-2 font-display text-lg font-bold text-mist-100"><Eye className="size-5 text-lotus-300" /> On-board hints, animation &amp; layout</h2>
            <p className="mt-0.5 text-sm text-mist-400">What players see while they play. Every one of these is a hint or an effect — the rules never change.</p>
            <div className="mt-3 divide-y divide-line/60">
              <ToggleRow label="Highlight legal moves" desc="Dots on quiet moves and a ring on captures for the selected piece" on={c.showLegalDots !== false} onToggle={() => set({ showLegalDots: c.showLegalDots === false })} />
              <ToggleRow label="Highlight the last move" desc="Marks the square a piece came from and went to" on={c.showLastMove !== false} onToggle={() => set({ showLastMove: c.showLastMove === false })} />
              <ToggleRow label="Check indication" desc="Red ring on a king that is in check or checkmated" on={c.showCheckHighlight !== false} onToggle={() => set({ showCheckHighlight: c.showCheckHighlight === false })} />
              <ToggleRow label="Board coordinates" desc="The a–h files and 1–8 ranks on the board edge" on={c.showCoords !== false} onToggle={() => set({ showCoords: c.showCoords === false })} />
              <ToggleRow label="Centre watermark" desc="The lotus mark in the middle of the board" on={c.showWatermark !== false} onToggle={() => set({ showWatermark: c.showWatermark === false })} />
              <ToggleRow label="Board border" desc="Outline around the whole board" on={c.boardBorder !== false} onToggle={() => set({ boardBorder: c.boardBorder === false })} />
              <ToggleRow label="Piece movement animation" desc="Pieces glide instead of jumping" on={c.animateMoves !== false} onToggle={() => set({ animateMoves: c.animateMoves === false })} />
              <ToggleRow label="Capture animation" desc="A short pulse on the square where a piece is taken" on={c.captureFlash !== false} onToggle={() => set({ captureFlash: c.captureFlash === false })} />
              <ToggleRow label="Turn the board for Black" desc="Each player sees their own pieces at the bottom" on={c.flipForBlack !== false} onToggle={() => set({ flipForBlack: c.flipForBlack === false })} />
              <ToggleRow label="Move history" desc="The list of moves in standard notation beside the board" on={c.showMoveHistory !== false} onToggle={() => set({ showMoveHistory: c.showMoveHistory === false })} />
              <ToggleRow label="Captured pieces tray" desc="Shows the pieces each side has taken" on={c.showCapturedTray !== false} onToggle={() => set({ showCapturedTray: c.showCapturedTray === false })} />
            </div>
            {c.animateMoves !== false && (
              <div className="mt-3"><Slider label="Animation speed" value={c.animMs ?? 220} min={0} max={800} suffix="ms" onChange={(v) => set({ animMs: v })} /></div>
            )}
            <button onClick={() => setC(defaultChessCfg())} className="mt-3 inline-flex items-center gap-1.5 text-sm font-semibold text-mist-400 transition hover:text-mist-100">
              <RotateCcw className="size-4" /> Reset everything to default
            </button>
          </Card>
        </div>

        {/* Live preview */}
        <div className="lg:sticky lg:top-4 lg:self-start">
          <Card className="p-4">
            <p className="mb-2 text-center text-[11px] font-semibold uppercase tracking-wide text-mist-500">Board preview</p>
            <ChessPreview cfg={c} light={light} dark={dark} coordLight={theme.coordLight} coordDark={theme.coordDark} showGrid={showGrid} />
            <p className="mt-2 text-center text-[10px] leading-snug text-mist-500">
              The opening position, drawn with your settings. Press <b className="text-mist-300">Save changes</b> to apply it for every player.
            </p>
          </Card>
        </div>
      </div>
    </div>
  );
}

function ChessPreview({ cfg, light, dark, coordLight, coordDark, showGrid = false }: {
  cfg: ChessCfg; light: string; dark: string; coordLight: string; coordDark: string; showGrid?: boolean;
}) {
  const style = cfg.pieceStyle ?? "solid";
  const scale = (cfg.pieceScalePct ?? 100) / 100;
  return (
    <div className={cn("relative aspect-square w-full overflow-hidden rounded-xl", cfg.boardBorder !== false && "border border-white/10")}>
      {cfg.boardImage && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={withBase(cfg.boardImage)} alt=""
          className="absolute inset-0 size-full"
          style={{
            opacity: (cfg.boardImageOpacityPct ?? 100) / 100,
            objectFit: cfg.boardImageFit ?? "cover",
            objectPosition: "center",
            transform: `translate(${cfg.boardImageOffsetXPct ?? 0}%, ${cfg.boardImageOffsetYPct ?? 0}%) scale(${(cfg.boardImageScalePct ?? 100) / 100})`,
          }}
        />
      )}
      {/* 8×8 alignment overlay — line your board art up with the real squares. */}
      {showGrid && cfg.boardImage && (
        <div
          className="pointer-events-none absolute inset-0 z-20"
          style={{
            backgroundImage: "linear-gradient(to right, rgba(255,255,255,0.35) 1px, transparent 1px), linear-gradient(to bottom, rgba(255,255,255,0.35) 1px, transparent 1px)",
            backgroundSize: "12.5% 12.5%",
          }}
        />
      )}
      <div className="relative grid size-full grid-cols-8">
        {Array.from({ length: 8 }, (_, r) =>
          Array.from({ length: 8 }, (_, c) => {
            const isLight = (r + c) % 2 === 0;
            const piece = START_ROWS[r]?.[c];
            return (
              <div
                key={`${r},${c}`}
                className={cn("relative grid place-items-center", cfg.boardImage && (isLight ? "bg-white/10" : "bg-black/20"))}
                style={{ backgroundColor: cfg.boardImage ? undefined : (isLight ? light : dark) }}
              >
                {cfg.showCoords !== false && c === 0 && (
                  <span className="absolute left-0.5 top-0.5 text-[7px] font-bold" style={{ color: isLight ? coordLight : coordDark }}>{8 - r}</span>
                )}
                {piece && (() => {
                  const url = style === "custom" ? (cfg.pieceImages ?? {})[`${piece.color}-${piece.type}`] : "";
                  if (url) {
                    // eslint-disable-next-line @next/next/no-img-element
                    return <img src={withBase(url)} alt="" className="object-contain" style={{ width: `${72 * scale}%`, height: `${72 * scale}%` }} />;
                  }
                  const t = pieceTextStyle(piece.color, style);
                  return (
                    <span className="leading-none" style={{ fontSize: `${1.15 * scale}rem`, color: t.color, textShadow: t.textShadow, fontWeight: style === "letters" ? 800 : undefined }}>
                      {glyphFor(style, piece.color, piece.type)}
                    </span>
                  );
                })()}
              </div>
            );
          }),
        )}
      </div>
    </div>
  );
}

function ToggleRow({ label, desc, on, onToggle }: { label: string; desc: string; on: boolean; onToggle: () => void }) {
  return (
    <div className="flex items-center justify-between gap-3 py-3">
      <div className="min-w-0">
        <div className="text-sm font-semibold text-mist-100">{label}</div>
        <div className="text-xs text-mist-500">{desc}</div>
      </div>
      <button onClick={onToggle} aria-pressed={on} className={cn("relative h-7 w-14 shrink-0 rounded-full transition", on ? "bg-emerald-500" : "bg-mist-600")}>
        <span className={cn("absolute top-0.5 grid size-6 place-items-center rounded-full bg-white text-[9px] font-bold transition-all", on ? "left-[calc(100%-1.625rem)] text-emerald-600" : "left-0.5 text-mist-500")}>{on ? "ON" : "OFF"}</span>
      </button>
    </div>
  );
}

function Slider({ label, value, min, max, suffix, onChange }: {
  label: string; value: number; min: number; max: number; suffix?: string; onChange: (v: number) => void;
}) {
  return (
    <label className="block">
      <div className="mb-1 flex items-center justify-between text-sm">
        <span className="font-semibold text-mist-200">{label}</span>
        <span className="tabular-nums text-mist-400">{value}{suffix}</span>
      </div>
      <input type="range" min={min} max={max} value={value} onChange={(e) => onChange(Number(e.target.value))} className="w-full accent-lotus-400" />
    </label>
  );
}
