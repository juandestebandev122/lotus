"use client";

import { type ReactNode, useEffect, useRef, useState } from "react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import { useConfig, saveConfig } from "@/lib/config";
import { LudoToken } from "@/components/LudoToken";
import { withBase } from "@/lib/base-path";
import { cn } from "@/lib/cn";
import { SlidersHorizontal, Upload, RotateCcw, Check, Eye, EyeOff, Trash2, Image as ImageIcon, Star, LayoutGrid, Info } from "lucide-react";
import { CosmeticPriceControl } from "@/components/admin/CosmeticPriceControl";
import {
  BOARD_ELEMENTS, SAFE_VISIBILITY, SAFE_ICON_MODES,
  type BoardElement, type ElementVis, type SafeIconMode, type SafeVisibility,
} from "@/lib/board-elements";
import { DEFAULT_SAFE, RING, START, LABEL, type Color as LudoColor } from "@/lib/ludo";

// The admin-managed Ludo board look. Mirrors config.gameBoard on the server; the
// game reads the same values each render, so a save here reflects in every player's
// game with no app update (§8 live config). Defaults match the built-in faded lotus.
type Center = {
  image: string; show: boolean; sizePct: number; opacityPct: number;
  rotateDeg: number; offsetXPct: number; offsetYPct: number;
};
type Fit = "contain" | "cover" | "fill";
type Decor = { homeSymbol: string; homeSymbolShow: boolean; safeIcon: string; safeIconShow: boolean; safeHighlight: boolean; safeColor: string; frameColor: string; fullImage: string; fullImageShow: boolean; fullImageOpacityPct: number; fullImageFit: Fit; fullImageOffsetXPct: number; fullImageOffsetYPct: number; fullImageScalePct: number; boxBorder: boolean; borderColor: string; boxHighlight: boolean; showArrow: boolean; hideHomeBg: boolean; homeBgColor: string; safeSizePct: number; safeOpacityPct: number; safeGlow: boolean; safeRotateDeg: number;
  // Full safe-star editor
  safeIconMode: SafeIconMode; safeBorder: boolean; safeBorderColor: string; safeGlowPx: number;
  safeShadow: boolean; safeShadowOpacityPct: number; safePosXPct: number; safePosYPct: number; safeVisibility: SafeVisibility };
type SavedBoard = { id: string; name: string; image: string; fit: Fit; opacityPct: number; offsetXPct: number; offsetYPct: number; scalePct: number; enabled: boolean; createdAt: string; priceCoins: number; validityDays: number };
type CenterSnake = { image: string; show: boolean; sizePct: number; opacityPct: number };
type ShareStyle = "corners" | "diagonal" | "row" | "stack";
type TokenSlot = { dxPct: number; dyPct: number; sizePct: number; rotateDeg: number };
type TokenSlots = { enabled: boolean; slots: TokenSlot[] };
type Elements = Partial<Record<BoardElement, ElementVis>>;
import { BrandImg } from "@/components/BrandImg";

type SnakeGrid = { topPct: number; leftPct: number; widthPct: number; heightPct: number };
type Board = { center: Center; centerSnake: CenterSnake; snakeGrid: SnakeGrid; ludoGrid: SnakeGrid; snakeMyPosition: "bottom" | "top"; tokenScalePct: number; tokenFanPct: number; shareStyle: ShareStyle; decor: Decor; boards: SavedBoard[]; activeBoardId: string; tokenSlots: TokenSlots; elements: Elements; safeCells: number[] };

const DEFAULT_SLOT: TokenSlot = { dxPct: 0, dyPct: 0, sizePct: 100, rotateDeg: 0 };
const DEFAULT_SLOTS: TokenSlot[] = [DEFAULT_SLOT, DEFAULT_SLOT, DEFAULT_SLOT, DEFAULT_SLOT].map((s) => ({ ...s }));

const FIT_OPTIONS: { id: Fit; label: string; hint: string }[] = [
  { id: "contain", label: "Fit — keep shape", hint: "Recommended. Shows the whole picture without stretching or cropping, centred." },
  { id: "cover", label: "Fill — cover board", hint: "Fills the whole board edge-to-edge. May crop the outer edges of the picture." },
  { id: "fill", label: "Stretch to grid", hint: "Forces the picture to the exact board square. Can distort a non-square picture." },
];

const SHARE_STYLES: { id: ShareStyle; label: string }[] = [
  { id: "corners", label: "Corners" },
  { id: "diagonal", label: "Diagonal" },
  { id: "row", label: "Side by side" },
  { id: "stack", label: "Stack" },
];

const DEFAULTS: Board = {
  center: { image: "", show: true, sizePct: 84, opacityPct: 40, rotateDeg: 0, offsetXPct: 0, offsetYPct: 0 },
  centerSnake: { image: "", show: false, sizePct: 50, opacityPct: 25 },
  snakeGrid: { topPct: 0, leftPct: 0, widthPct: 100, heightPct: 100 },
  ludoGrid: { topPct: 0, leftPct: 0, widthPct: 100, heightPct: 100 },
  snakeMyPosition: "bottom",
  tokenScalePct: 100,
  tokenFanPct: 100,
  shareStyle: "corners",
  decor: { homeSymbol: "", homeSymbolShow: true, safeIcon: "", safeIconShow: true, safeHighlight: true, safeColor: "#10b981", frameColor: "", fullImage: "", fullImageShow: true, fullImageOpacityPct: 100, fullImageFit: "contain", fullImageOffsetXPct: 0, fullImageOffsetYPct: 0, fullImageScalePct: 100, boxBorder: true, borderColor: "", boxHighlight: true, showArrow: true, hideHomeBg: false, homeBgColor: "", safeSizePct: 100, safeOpacityPct: 100, safeGlow: false, safeRotateDeg: 0,
    safeIconMode: "default", safeBorder: false, safeBorderColor: "", safeGlowPx: 4, safeShadow: true, safeShadowOpacityPct: 55, safePosXPct: 0, safePosYPct: 0, safeVisibility: "visible" },
  boards: [],
  activeBoardId: "",
  tokenSlots: { enabled: false, slots: DEFAULT_SLOTS.map((s) => ({ ...s })) },
  elements: {},
  safeCells: [],
};

/** A tiny live preview of an arrangement style — three dots placed the same way
 *  the real board places sharing coins. */
function SharePreview({ style }: { style: ShareStyle }) {
  const K = 26;
  const pts = (style === "row"
    ? [[-K, 0], [0, 0], [K, 0]]
    : style === "stack"
    ? [[-K / 2, -K / 2], [0, 0], [K / 2, K / 2]]
    : style === "diagonal"
    ? [[-K, -K], [0, 0], [K, K]]
    : [[0, -K], [-K, K], [K, K]]) as [number, number][];
  const colors = ["#ef4444", "#22c55e", "#eab308"];
  return (
    <span className="relative block size-9 rounded-md bg-ink-950 ring-1 ring-white/10">
      {pts.map(([x, y], i) => (
        <span
          key={i}
          className="absolute left-1/2 top-1/2 size-3 rounded-full ring-1 ring-white/40"
          style={{ background: colors[i], transform: `translate(-50%,-50%) translate(${x * 0.5}%, ${y * 0.5}%)` }}
        />
      ))}
    </span>
  );
}

export default function AdminGameBoardPage() {
  const { config, loading, reload } = useConfig();
  const { toast } = useToast();
  const [b, setB] = useState<Board>(DEFAULTS);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [showGrid, setShowGrid] = useState(true); // grid-alignment overlay on the board preview
  const fileRef = useRef<HTMLInputElement>(null);
  const homeSymRef = useRef<HTMLInputElement>(null);
  const safeIconRef = useRef<HTMLInputElement>(null);
  const fullBoardRef = useRef<HTMLInputElement>(null);
  const diceFaceRef = useRef<HTMLInputElement>(null);
  // Dice look: the idle face shown BEFORE a roll (never a "1") + the last-rolled chip.
  const [dice, setDice] = useState<{ customFace: boolean; faceImage: string; showLastRolled: boolean }>({ customFace: false, faceImage: "", showLastRolled: true });

  useEffect(() => {
    if (loading) return;
    const gd = config.gameDice ?? {};
    setDice({ customFace: gd.customFace === true, faceImage: gd.faceImage ?? "", showLastRolled: gd.showLastRolled !== false });
  }, [loading, config.gameDice]);

  useEffect(() => {
    if (loading) return;
    const g = config.gameBoard ?? {};
    const c = g.center ?? {};
    setB({
      center: {
        image: c.image ?? "",
        show: c.show !== false,
        sizePct: c.sizePct ?? 84,
        opacityPct: c.opacityPct ?? 40,
        rotateDeg: c.rotateDeg ?? 0,
        offsetXPct: c.offsetXPct ?? 0,
        offsetYPct: c.offsetYPct ?? 0,
      },
      centerSnake: {
        image: g.centerSnake?.image ?? "",
        show: g.centerSnake?.show === true,
        sizePct: g.centerSnake?.sizePct ?? 50,
        opacityPct: g.centerSnake?.opacityPct ?? 25,
      },
      snakeGrid: {
        topPct: g.snakeGrid?.topPct ?? 0,
        leftPct: g.snakeGrid?.leftPct ?? 0,
        widthPct: g.snakeGrid?.widthPct ?? 100,
        heightPct: g.snakeGrid?.heightPct ?? 100,
      },
      ludoGrid: {
        topPct: g.ludoGrid?.topPct ?? 0,
        leftPct: g.ludoGrid?.leftPct ?? 0,
        widthPct: g.ludoGrid?.widthPct ?? 100,
        heightPct: g.ludoGrid?.heightPct ?? 100,
      },
      snakeMyPosition: g.snakeMyPosition === "top" ? "top" : "bottom",
      tokenScalePct: g.tokenScalePct ?? 100,
      tokenFanPct: g.tokenFanPct ?? 100,
      shareStyle: (g.shareStyle as ShareStyle) ?? "corners",
      decor: {
        homeSymbol: g.decor?.homeSymbol ?? "",
        homeSymbolShow: g.decor?.homeSymbolShow !== false,
        safeIcon: g.decor?.safeIcon ?? "",
        safeIconShow: g.decor?.safeIconShow !== false,
        safeHighlight: g.decor?.safeHighlight !== false,
        safeColor: g.decor?.safeColor ?? "#10b981",
        frameColor: g.decor?.frameColor ?? "",
        fullImage: g.decor?.fullImage ?? "",
        fullImageShow: g.decor?.fullImageShow !== false,
        fullImageOpacityPct: g.decor?.fullImageOpacityPct ?? 100,
        fullImageFit: (g.decor?.fullImageFit as Fit) ?? "contain",
        fullImageOffsetXPct: g.decor?.fullImageOffsetXPct ?? 0,
        fullImageOffsetYPct: g.decor?.fullImageOffsetYPct ?? 0,
        fullImageScalePct: g.decor?.fullImageScalePct ?? 100,
        boxBorder: g.decor?.boxBorder !== false,
        borderColor: g.decor?.borderColor ?? "",
        boxHighlight: g.decor?.boxHighlight !== false,
        showArrow: g.decor?.showArrow !== false,
        hideHomeBg: g.decor?.hideHomeBg === true,
        homeBgColor: g.decor?.homeBgColor ?? "",
        safeSizePct: g.decor?.safeSizePct ?? 100,
        safeOpacityPct: g.decor?.safeOpacityPct ?? 100,
        safeGlow: g.decor?.safeGlow === true,
        safeRotateDeg: g.decor?.safeRotateDeg ?? 0,
        safeIconMode: (g.decor?.safeIconMode as SafeIconMode) ?? ((g.decor?.safeIcon ?? "").trim() ? "custom" : "default"),
        safeBorder: g.decor?.safeBorder === true,
        safeBorderColor: g.decor?.safeBorderColor ?? "",
        safeGlowPx: g.decor?.safeGlowPx ?? 4,
        safeShadow: g.decor?.safeShadow !== false,
        safeShadowOpacityPct: g.decor?.safeShadowOpacityPct ?? 55,
        safePosXPct: g.decor?.safePosXPct ?? 0,
        safePosYPct: g.decor?.safePosYPct ?? 0,
        safeVisibility: (g.decor?.safeVisibility as SafeVisibility) ?? "visible",
      },
      elements: { ...(g.elements ?? {}) },
      safeCells: Array.isArray(g.safeCells) ? [...g.safeCells] : [],
      boards: Array.isArray(g.boards)
        ? g.boards.map((x) => ({
            id: x.id, name: x.name ?? "", image: x.image ?? "",
            fit: (x.fit as Fit) ?? "contain", opacityPct: x.opacityPct ?? 100,
            offsetXPct: x.offsetXPct ?? 0, offsetYPct: x.offsetYPct ?? 0, scalePct: x.scalePct ?? 100,
            enabled: x.enabled !== false, createdAt: x.createdAt ?? "",
            // The price and validity MUST be carried through. This mapping
            // rebuilds each board field by field, so anything missed here is
            // silently reset to 0 the moment the page reloads — which is
            // exactly why a saved coin price kept coming back as 0.
            priceCoins: x.priceCoins ?? 0,
            validityDays: x.validityDays ?? 0,
          }))
        : [],
      activeBoardId: g.activeBoardId ?? "",
      tokenSlots: {
        enabled: g.tokenSlots?.enabled === true,
        slots: DEFAULT_SLOTS.map((d, i) => {
          const s = g.tokenSlots?.slots?.[i];
          return { dxPct: s?.dxPct ?? d.dxPct, dyPct: s?.dyPct ?? d.dyPct, sizePct: s?.sizePct ?? d.sizePct, rotateDeg: s?.rotateDeg ?? d.rotateDeg };
        }),
      },
    });
  }, [loading, config]);

  const setC = (next: Partial<Center>) => setB((p) => ({ ...p, center: { ...p.center, ...next } }));
  const setD = (next: Partial<Decor>) => setB((p) => ({ ...p, decor: { ...p.decor, ...next } }));
  // Per-slot token layout helpers.
  const setSlotEnabled = (on: boolean) => setB((p) => ({ ...p, tokenSlots: { ...p.tokenSlots, enabled: on } }));
  const setSlot = (i: number, next: Partial<TokenSlot>) => setB((p) => ({ ...p, tokenSlots: { ...p.tokenSlots, slots: p.tokenSlots.slots.map((s, j) => (j === i ? { ...s, ...next } : s)) } }));
  const resetSlots = () => setB((p) => ({ ...p, tokenSlots: { ...p.tokenSlots, slots: DEFAULT_SLOTS.map((s) => ({ ...s })) } }));

  // ── Custom Board LIBRARY helpers (multiple saved boards; pick one active) ──
  const updateBoard = (id: string, next: Partial<SavedBoard>) =>
    setB((p) => ({ ...p, boards: p.boards.map((bd) => (bd.id === id ? { ...bd, ...next } : bd)) }));
  const removeBoard = (id: string) =>
    setB((p) => ({ ...p, boards: p.boards.filter((bd) => bd.id !== id), activeBoardId: p.activeBoardId === id ? "" : p.activeBoardId }));
  const addBoardFromUrl = (url: string) =>
    setB((p) => {
      const id = `board-${Date.now().toString(36)}-${Math.floor(Math.random() * 1e4).toString(36)}`;
      const nb: SavedBoard = { id, name: `Board ${p.boards.length + 1}`, image: url, fit: p.decor.fullImageFit ?? "contain", opacityPct: 100, offsetXPct: 0, offsetYPct: 0, scalePct: 100, enabled: true, createdAt: new Date().toISOString(), priceCoins: 0, validityDays: 0 };
      return { ...p, boards: [...p.boards, nb], activeBoardId: id };
    });
  const libraryRef = useRef<HTMLInputElement>(null);
  // Which board is the LIVE surface right now (for the admin's awareness).
  const activeLibBoard = b.boards.find((bd) => bd.id === b.activeBoardId && bd.enabled !== false && bd.image);

  // Upload an image and hand the returned URL to a setter (home symbol / safe icon).
  const uploadTo = async (file: File, apply: (url: string) => void, done?: () => void) => {
    setUploading(true);
    const fd = new FormData();
    fd.append("file", file);
    try {
      const res = await fetch(withBase("/api/admin/tokens"), { method: "POST", body: fd, credentials: "include" });
      const d = await res.json();
      if (res.ok && d.url) { apply(d.url as string); toast("Image uploaded — press Save changes to make it live.", "success"); }
      else toast(d.error ?? "Upload failed", "error");
    } catch { toast("Upload failed", "error"); }
    setUploading(false);
    done?.();
  };

  const upload = async (file: File) => {
    setUploading(true);
    const fd = new FormData();
    fd.append("file", file);
    try {
      const res = await fetch(withBase("/api/admin/tokens"), { method: "POST", body: fd, credentials: "include" });
      const d = await res.json();
      if (res.ok && d.url) { setC({ image: d.url as string }); toast("Image uploaded — press Save changes to make it live.", "success"); }
      else toast(d.error ?? "Upload failed", "error");
    } catch { toast("Upload failed", "error"); }
    setUploading(false);
    if (fileRef.current) fileRef.current.value = "";
  };

  const save = async () => {
    setSaving(true);
    const res = await saveConfig({ gameBoard: b, gameDice: dice });
    setSaving(false);
    if (res.ok) { await reload(); toast("Board & dice settings saved — live for all players.", "success"); }
    else toast(res.error ?? "Could not save", "error");
  };

  const resetAll = () => { setB(DEFAULTS); toast("Reset to defaults — press Save changes to apply.", "info"); };

  const { center: c } = b;
  const centerSrc = c.image && c.image.trim() ? withBase(c.image) : withBase("/tokens/lotus-red.png");
  const centerInset = Math.max(0, (100 - c.sizePct) / 2);
  const scale = b.tokenScalePct / 100;
  const fanUnit = 26 * (b.tokenFanPct / 100);

  // The picture the alignment editor previews against: the ACTIVE library board
  // wins (that is what the game shows), else the legacy single upload.
  const ludoPreviewImg =
    (b.boards.find((x) => x.id === b.activeBoardId && x.enabled !== false && (x.image ?? "").trim())?.image ?? "")
    || (b.decor.fullImage ?? "");

  return (
    <div className="mx-auto max-w-4xl space-y-5 pb-24">
      <div>
        <h1 className="flex items-center gap-2 font-display text-2xl font-extrabold text-mist-100">
          <SlidersHorizontal className="size-6 text-lotus-300" /> Game Board
        </h1>
        <p className="mt-1 text-sm text-mist-400">
          Customise the Ludo board without an app update: the <b>centre image</b>, the <b>coin size &amp; spacing</b>,
          and the <b>board design</b> — a home-area symbol (e.g. a lotus), the safe-square icon, and the frame colour.
          Everything shows in a live preview and applies to every player after you save.
        </p>
      </div>

      <div className="grid gap-5 lg:grid-cols-[1fr_theme(width.72)]">
        {/* ---------- Controls ---------- */}
        <div className="space-y-5">
          {/* Centre image */}
          <Card className="p-4 sm:p-5">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="flex items-center gap-2 font-display text-lg font-bold text-mist-100"><ImageIcon className="size-5 text-lotus-300" /> Centre image</h2>
              <button
                onClick={() => setC({ show: !c.show })}
                title={c.show ? "Visible — tap to hide the centre image" : "Hidden — tap to show the centre image"}
                className={cn("inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-white transition", c.show ? "bg-emerald-500 hover:brightness-110" : "bg-mist-600 hover:brightness-110")}
              >
                {c.show ? <><Eye className="size-4" /> Shown</> : <><EyeOff className="size-4" /> Hidden</>}
              </button>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <div className="grid size-16 shrink-0 place-items-center overflow-hidden rounded-xl border border-line bg-ink-800">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={centerSrc} alt="" className="size-14 object-contain" />
              </div>
              <input ref={fileRef} type="file" accept="image/*" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) upload(f); }} />
              <Button variant="secondary" onClick={() => fileRef.current?.click()} disabled={uploading}>
                <Upload className="size-4" /> {uploading ? "Uploading…" : c.image ? "Change image" : "Upload image"}
              </Button>
              {c.image ? (
                <Button variant="ghost" onClick={() => setC({ image: "" })}>
                  <Trash2 className="size-4" /> Remove (use default lotus)
                </Button>
              ) : (
                <span className="text-xs text-mist-500">Using the default lotus.</span>
              )}
            </div>

            <div className="mt-4 space-y-3">
              <Slider label="Size" value={c.sizePct} min={30} max={100} suffix="%" onChange={(v) => setC({ sizePct: v })} />
              <Slider label="Opacity (lower = fainter, coins stay clear)" value={c.opacityPct} min={0} max={100} suffix="%" onChange={(v) => setC({ opacityPct: v })} />
              <Slider label="Rotate" value={c.rotateDeg} min={-180} max={180} suffix="°" onChange={(v) => setC({ rotateDeg: v })} />
              <Slider label="Position — left / right" value={c.offsetXPct} min={-40} max={40} suffix="%" onChange={(v) => setC({ offsetXPct: v })} />
              <Slider label="Position — up / down" value={c.offsetYPct} min={-40} max={40} suffix="%" onChange={(v) => setC({ offsetYPct: v })} />
            </div>
          </Card>

          {/* Snake & Ladder centre image — a separate, per-game centre picture
              shown as a faint watermark over the middle of the Snake board. */}
          <Card className="p-4 sm:p-5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="font-display text-lg font-bold text-mist-100">🐍 Snake &amp; Ladder centre image</h2>
              <button
                onClick={() => setB((p) => ({ ...p, centerSnake: { ...p.centerSnake, show: !p.centerSnake.show } }))}
                className={b.centerSnake.show ? "rounded-full bg-emerald-500/15 px-3 py-1 text-xs font-bold text-emerald-300" : "rounded-full bg-white/8 px-3 py-1 text-xs font-bold text-mist-400"}
              >
                {b.centerSnake.show ? "Shown" : "Hidden"}
              </button>
            </div>
            <p className="mt-0.5 text-sm text-mist-400">A separate centre picture for the Snake board (faint watermark so cells and numbers stay readable). Animated GIFs work too.</p>
            <div className="mt-3 flex flex-wrap items-center gap-3">
              {b.centerSnake.image ? (
                <img src={withBase(b.centerSnake.image)} alt="Snake centre" className="size-16 rounded-lg border border-line object-contain" />
              ) : (
                <span className="grid size-16 place-items-center rounded-lg border border-dashed border-line text-[10px] text-mist-500">none</span>
              )}
              <input
                type="file"
                accept="image/*"
                className="hidden"
                id="snake-center-file"
                onChange={(e) => { const f = e.target.files?.[0]; if (f) void uploadTo(f, (url) => setB((p) => ({ ...p, centerSnake: { ...p.centerSnake, image: url, show: true } }))); e.target.value = ""; }}
              />
              <Button size="sm" variant="secondary" onClick={() => document.getElementById("snake-center-file")?.click()} disabled={uploading}>
                {uploading ? "Uploading…" : b.centerSnake.image ? "Replace image" : "Upload image"}
              </Button>
              {b.centerSnake.image && (
                <button onClick={() => setB((p) => ({ ...p, centerSnake: { ...p.centerSnake, image: "" } }))} className="text-xs font-semibold text-rose-300 hover:text-rose-200">
                  Remove
                </button>
              )}
            </div>
            <div className="mt-4 space-y-3">
              <Slider label="Size (of the board width)" value={b.centerSnake.sizePct} min={20} max={100} suffix="%" onChange={(v) => setB((p) => ({ ...p, centerSnake: { ...p.centerSnake, sizePct: v } }))} />
              <Slider label="Opacity" value={b.centerSnake.opacityPct} min={0} max={100} suffix="%" onChange={(v) => setB((p) => ({ ...p, centerSnake: { ...p.centerSnake, opacityPct: v } }))} />
            </div>
          </Card>

          {/* LUDO grid alignment. Same idea as the Snake editor below, and the
              reason the client saw grid lines sitting over their artwork: the
              app draws its own 15x15 grid across the WHOLE image, which never
              matches the squares painted into a custom board. Because the coins
              live inside this grid, aligning it aligns the coins too. */}
          <Card className="p-4 sm:p-5">
            <h2 className="font-display text-lg font-bold text-mist-100">🎯 Ludo grid alignment</h2>
            <p className="mt-0.5 text-sm text-mist-400">
              Tells the game where the 15×15 squares actually sit inside your board picture. Drag the sliders until the purple grid below
              sits exactly on the squares of your artwork — the coins follow the grid automatically, so there is nothing else to line up.
            </p>
            <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,320px)_1fr]">
              <div className="relative aspect-square w-full overflow-hidden rounded-xl border border-line bg-ink-900">
                {ludoPreviewImg ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={withBase(ludoPreviewImg)} alt="Ludo board" className="block size-full object-contain" draggable={false} />
                ) : (
                  <div className="grid size-full place-items-center px-6 text-center text-xs text-mist-500">Upload a board picture above to align against it.</div>
                )}
                <div
                  className="pointer-events-none absolute border-2 border-lotus-400"
                  style={{
                    left: `${b.ludoGrid.leftPct}%`, top: `${b.ludoGrid.topPct}%`,
                    width: `${b.ludoGrid.widthPct}%`, height: `${b.ludoGrid.heightPct}%`,
                    backgroundImage:
                      "repeating-linear-gradient(to right, rgba(168,130,255,0.75) 0 1px, transparent 1px 6.6667%), repeating-linear-gradient(to bottom, rgba(168,130,255,0.75) 0 1px, transparent 1px 6.6667%)",
                  }}
                />
              </div>
              <div className="space-y-3">
                <Slider label="Grid starts from the left" value={b.ludoGrid.leftPct} min={0} max={45} suffix="%" onChange={(v) => setB((p) => ({ ...p, ludoGrid: { ...p.ludoGrid, leftPct: v } }))} />
                <Slider label="Grid starts from the top" value={b.ludoGrid.topPct} min={0} max={45} suffix="%" onChange={(v) => setB((p) => ({ ...p, ludoGrid: { ...p.ludoGrid, topPct: v } }))} />
                <Slider label="Grid width" value={b.ludoGrid.widthPct} min={20} max={100} suffix="%" onChange={(v) => setB((p) => ({ ...p, ludoGrid: { ...p.ludoGrid, widthPct: v } }))} />
                <Slider label="Grid height" value={b.ludoGrid.heightPct} min={20} max={100} suffix="%" onChange={(v) => setB((p) => ({ ...p, ludoGrid: { ...p.ludoGrid, heightPct: v } }))} />
                <div className="flex flex-wrap gap-2 pt-1">
                  <Button size="sm" variant="secondary" onClick={() => setB((p) => ({ ...p, ludoGrid: { topPct: 0, leftPct: 0, widthPct: 100, heightPct: 100 } }))}>Reset to whole image</Button>
                  <Button size="sm" variant="secondary" onClick={() => setB((p) => ({ ...p, ludoGrid: { topPct: 8, leftPct: 8, widthPct: 84, heightPct: 84 } }))}>Typical framed board</Button>
                </div>
                <p className="text-[11px] text-mist-500">
                  Tip: to hide the app&apos;s own lines entirely and show only your artwork, set <b className="text-mist-400">Default Board</b>,
                  <b className="text-mist-400"> Grid</b>, <b className="text-mist-400">Cell Border</b> and <b className="text-mist-400">Path Numbers</b> to
                  <b className="text-mist-400"> Hide</b> in the element table below. That is appearance only — every rule still applies.
                </p>
              </div>
            </div>
          </Card>

          {/* Snake coin alignment — the fix for "change the board and the coins
              stop working". Shows the real board picture with the 10x10 grid
              drawn on top, so it is aligned by eye. */}
          <Card className="p-4 sm:p-5">
            <h2 className="font-display text-lg font-bold text-mist-100">🎯 Snake &amp; Ladder coin alignment</h2>
            <p className="mt-0.5 text-sm text-mist-400">
              Tells the game where the numbered squares actually sit inside the board picture. Most custom boards have a decorative frame around the
              squares — without this the coins land on the frame instead of on the numbers. Drag the four sliders until the grid below sits exactly on the squares.
            </p>
            <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,320px)_1fr]">
              {/* Live preview: the real board + the grid it will use */}
              <div className="relative aspect-square w-full overflow-hidden rounded-xl border border-line bg-ink-900">
                <BrandImg slot="snakeBoard" alt="Snake board" className="block size-full object-contain" draggable={false} />
                <div
                  className="pointer-events-none absolute border-2 border-lotus-400"
                  style={{
                    left: `${b.snakeGrid.leftPct}%`, top: `${b.snakeGrid.topPct}%`,
                    width: `${b.snakeGrid.widthPct}%`, height: `${b.snakeGrid.heightPct}%`,
                    backgroundImage:
                      "repeating-linear-gradient(to right, rgba(168,130,255,0.85) 0 1px, transparent 1px 10%), repeating-linear-gradient(to bottom, rgba(168,130,255,0.85) 0 1px, transparent 1px 10%)",
                  }}
                />
                {/* Sample coins on squares 1, 41 and 100 so alignment is obvious. */}
                {[{ sq: 1, c: "#f43f5e" }, { sq: 41, c: "#10b981" }, { sq: 100, c: "#facc15" }].map(({ sq, c }) => {
                  const idx = sq - 1;
                  const row = Math.floor(idx / 10);
                  const col = row % 2 === 0 ? idx % 10 : 9 - (idx % 10);
                  const cw = b.snakeGrid.widthPct / 10, ch = b.snakeGrid.heightPct / 10;
                  return (
                    <span
                      key={sq}
                      className="pointer-events-none absolute -translate-x-1/2 -translate-y-1/2 rounded-full ring-2 ring-white"
                      style={{
                        left: `${b.snakeGrid.leftPct + (col + 0.5) * cw}%`,
                        top: `${b.snakeGrid.topPct + (9 - row + 0.5) * ch}%`,
                        width: `${cw * 0.7}%`, height: `${ch * 0.7}%`, background: c,
                      }}
                    />
                  );
                })}
              </div>
              <div className="space-y-3">
                <Slider label="Grid starts from the left" value={b.snakeGrid.leftPct} min={0} max={45} suffix="%" onChange={(v) => setB((p) => ({ ...p, snakeGrid: { ...p.snakeGrid, leftPct: v } }))} />
                <Slider label="Grid starts from the top" value={b.snakeGrid.topPct} min={0} max={45} suffix="%" onChange={(v) => setB((p) => ({ ...p, snakeGrid: { ...p.snakeGrid, topPct: v } }))} />
                <Slider label="Grid width" value={b.snakeGrid.widthPct} min={10} max={100} suffix="%" onChange={(v) => setB((p) => ({ ...p, snakeGrid: { ...p.snakeGrid, widthPct: v } }))} />
                <Slider label="Grid height" value={b.snakeGrid.heightPct} min={10} max={100} suffix="%" onChange={(v) => setB((p) => ({ ...p, snakeGrid: { ...p.snakeGrid, heightPct: v } }))} />
                <div className="flex flex-wrap gap-2 pt-1">
                  <Button size="sm" variant="secondary" onClick={() => setB((p) => ({ ...p, snakeGrid: { topPct: 0, leftPct: 0, widthPct: 100, heightPct: 100 } }))}>Reset to whole image</Button>
                  <Button size="sm" variant="secondary" onClick={() => setB((p) => ({ ...p, snakeGrid: { topPct: 8, leftPct: 8, widthPct: 84, heightPct: 84 } }))}>Typical framed board</Button>
                </div>
                <div className="rounded-lg border border-line bg-ink-900 p-3">
                  <p className="text-xs font-semibold text-mist-200">Where the player&apos;s own seat sits</p>
                  <p className="mt-0.5 text-[11px] text-mist-500">Each player always sees their own coin and profile on this side, the same way Ludo works.</p>
                  <div className="mt-2 flex overflow-hidden rounded-lg border border-line text-xs">
                    {(["bottom", "top"] as const).map((v) => (
                      <button key={v} onClick={() => setB((p) => ({ ...p, snakeMyPosition: v }))} className={cn("px-3 py-1.5 font-semibold capitalize transition", b.snakeMyPosition === v ? "bg-lotus-600 text-white" : "text-mist-300 hover:bg-white/[0.05]")}>{v}</button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </Card>

          {/* Coin size & spacing */}
          <Card className="p-4 sm:p-5">
            <h2 className="flex items-center gap-2 font-display text-lg font-bold text-mist-100"><SlidersHorizontal className="size-5 text-lotus-300" /> Coin size &amp; spacing</h2>
            <p className="mt-0.5 text-sm text-mist-400">Controls the coins on the board — how big they are, and how far apart different players&apos; coins spread when they share the same square.</p>
            <div className="mt-4 space-y-3">
              <Slider label="Coin size" value={b.tokenScalePct} min={70} max={140} suffix="%" onChange={(v) => setB((p) => ({ ...p, tokenScalePct: v }))} />
              <Slider label="Spread when coins share a square" value={b.tokenFanPct} min={0} max={200} suffix="%" onChange={(v) => setB((p) => ({ ...p, tokenFanPct: v }))} />
            </div>
            {/* Arrangement STYLE — the current look is "Corners" (unchanged). The
                others are extra styles the admin can pick. */}
            <div className="mt-4">
              <div className="mb-1.5 text-xs font-semibold text-mist-300">Style when coins share a square</div>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                {SHARE_STYLES.map((s) => {
                  const picked = (b.shareStyle ?? "corners") === s.id;
                  return (
                    <button
                      key={s.id}
                      onClick={() => setB((p) => ({ ...p, shareStyle: s.id }))}
                      className={cn("flex flex-col items-center gap-2 rounded-xl border p-3 transition", picked ? "border-lotus-400 bg-lotus-500/10" : "border-line bg-ink-800 hover:bg-white/[0.06]")}
                    >
                      <SharePreview style={s.id} />
                      <span className={cn("text-[11px] font-semibold", picked ? "text-lotus-200" : "text-mist-300")}>{s.label}{s.id === "corners" ? " (default)" : ""}</span>
                    </button>
                  );
                })}
              </div>
              <p className="mt-2 text-[11px] text-mist-500">Only affects how coins look when two or more players land on the same square. Gameplay is unchanged.</p>
            </div>
          </Card>

          {/* Board Settings — quick ON/OFF toggles for the board look (client request) */}
          <Card className="p-4 sm:p-5">
            <h2 className="flex items-center gap-2 font-display text-lg font-bold text-mist-100"><SlidersHorizontal className="size-5 text-lotus-300" /> Board settings</h2>
            <p className="mt-0.5 text-sm text-mist-400">Turn the board&apos;s cell borders, colour highlights, safe stars and start arrows on or off — live on every player&apos;s board.</p>
            <div className="mt-4 divide-y divide-line/60">
              <ToggleRow label="Box Border" desc="Outline around each board square" on={b.decor.boxBorder} onToggle={() => setD({ boxBorder: !b.decor.boxBorder })} />
              <div className="flex items-center justify-between gap-3 py-3">
                <div><div className="text-sm font-semibold text-mist-100">Border Color</div><div className="text-xs text-mist-500">Colour of the square outlines</div></div>
                <div className="flex items-center gap-2">
                  <input type="color" value={(b.decor.borderColor || "#000000").slice(0, 7)} onChange={(e) => setD({ borderColor: e.target.value })} disabled={!b.decor.boxBorder} className={cn("size-9 cursor-pointer rounded border border-line bg-transparent", !b.decor.boxBorder && "opacity-40")} />
                  {b.decor.borderColor && <button onClick={() => setD({ borderColor: "" })} className="text-xs font-semibold text-mist-400 hover:text-mist-100">Default</button>}
                </div>
              </div>
              <ToggleRow label="Box Highlight" desc="Coloured path & home-column squares" on={b.decor.boxHighlight} onToggle={() => setD({ boxHighlight: !b.decor.boxHighlight })} />
              <ToggleRow label="Safe Star" desc="Star markers on protected squares" on={b.decor.safeIconShow} onToggle={() => setD({ safeIconShow: !b.decor.safeIconShow })} />
              <ToggleRow label="Safe-zone Highlight" desc="Distinct tint + ring so safe squares stand out clearly" on={b.decor.safeHighlight} onToggle={() => setD({ safeHighlight: !b.decor.safeHighlight })} />
              <div className="flex items-center justify-between gap-3 py-3">
                <div><div className="text-sm font-semibold text-mist-100">Safe-zone Colour</div><div className="text-xs text-mist-500">Colour of the safe tint, ring &amp; star</div></div>
                <div className="flex items-center gap-2">
                  <input type="color" value={(b.decor.safeColor || "#10b981").slice(0, 7)} onChange={(e) => setD({ safeColor: e.target.value })} className="size-9 cursor-pointer rounded border border-line bg-transparent" />
                  {b.decor.safeColor && b.decor.safeColor.toLowerCase() !== "#10b981" && <button onClick={() => setD({ safeColor: "#10b981" })} className="text-xs font-semibold text-mist-400 hover:text-mist-100">Default</button>}
                </div>
              </div>
              <ToggleRow label="Show Arrow" desc="Entry arrows where each colour starts" on={b.decor.showArrow} onToggle={() => setD({ showArrow: !b.decor.showArrow })} />
            </div>
            {/* Mini board preview reflecting the toggles */}
            <div className="mt-4 border-t border-line/60 pt-4">
              <p className="mb-2 text-center text-[11px] font-semibold uppercase tracking-wide text-mist-500">Board preview</p>
              <BoardMiniPreview decor={b.decor} />
            </div>
          </Card>

          {/* ── Token home area + Safe-zone star editor (client spec) ── */}
          <Card className="p-4 sm:p-5">
            <h2 className="flex items-center gap-2 font-display text-lg font-bold text-mist-100"><ImageIcon className="size-5 text-lotus-300" /> Token home &amp; safe-zone star</h2>
            <p className="mt-0.5 text-sm text-mist-400">Stop the white token boxes from covering a custom board, and style the safe-zone star. Applies live to every player&apos;s board.</p>

            <div className="mt-4 divide-y divide-line/60">
              <ToggleRow label="Hide white token area" desc="Make the four home boxes transparent so a custom board's own home art shows through (the tokens stay on top)" on={b.decor.hideHomeBg} onToggle={() => setD({ hideHomeBg: !b.decor.hideHomeBg })} />
              <div className="flex items-center justify-between gap-3 py-3">
                <div><div className="text-sm font-semibold text-mist-100">Home background colour</div><div className="text-xs text-mist-500">Custom colour behind the four tokens. Ignored while &ldquo;Hide white token area&rdquo; is on. Default = white.</div></div>
                <div className="flex items-center gap-2">
                  <input type="color" value={(b.decor.homeBgColor || "#ffffff").slice(0, 7)} onChange={(e) => setD({ homeBgColor: e.target.value })} disabled={b.decor.hideHomeBg} className={cn("size-9 cursor-pointer rounded border border-line bg-transparent", b.decor.hideHomeBg && "opacity-40")} />
                  {b.decor.homeBgColor && <button onClick={() => setD({ homeBgColor: "" })} className="text-xs font-semibold text-mist-400 hover:text-mist-100">White</button>}
                </div>
              </div>
            </div>

          </Card>

          {/* ── ELEMENT VISIBILITY TABLE — Show / Hide / Transparent per element ── */}
          <Card className="p-4 sm:p-5">
            <h2 className="flex items-center gap-2 font-display text-lg font-bold text-mist-100"><LayoutGrid className="size-5 text-lotus-300" /> Board elements — Show / Hide / Transparent</h2>
            <p className="mt-0.5 text-sm text-mist-400">
              Decide how every part of the board is drawn. <b>Hide</b> removes it completely; <b>Transparent</b> keeps its place but paints
              almost nothing, so your uploaded board design shows through instead.
            </p>
            <div className="mt-3 flex items-start gap-2 rounded-lg border border-sky-400/25 bg-sky-500/[0.06] px-3 py-2 text-[11px] text-mist-300">
              <Info className="mt-0.5 size-3.5 shrink-0 text-sky-300" />
              <p><b className="text-mist-100">Appearance only.</b> Hiding a symbol never disables its game function — a hidden safe star still protects its square, hidden slots still hold their coins, and every rule keeps working exactly as before.</p>
            </div>

            <div className="mt-4 overflow-x-auto">
              <table className="w-full min-w-[30rem] text-sm">
                <thead>
                  <tr className="border-b border-line text-left text-[11px] uppercase tracking-wide text-mist-500">
                    <th className="py-2 pr-3 font-semibold">Element</th>
                    <th className="w-24 py-2 text-center font-semibold">Show</th>
                    <th className="w-24 py-2 text-center font-semibold">Hide</th>
                    <th className="w-28 py-2 text-center font-semibold">Transparent</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line/60">
                  {BOARD_ELEMENTS.map((el) => {
                    const cur = b.elements[el.key] ?? "show";
                    return (
                      <tr key={el.key}>
                        <td className="py-2.5 pr-3">
                          <div className="font-semibold text-mist-100">{el.label}</div>
                          <div className="text-[11px] leading-snug text-mist-500">{el.desc}</div>
                        </td>
                        {(["show", "hide", "transparent"] as ElementVis[]).map((mode) => (
                          <td key={mode} className="py-2.5 text-center">
                            <button
                              onClick={() => setB((s) => ({ ...s, elements: { ...s.elements, [el.key]: mode } }))}
                              aria-label={`${el.label}: ${mode}`}
                              className={cn(
                                "mx-auto grid size-7 place-items-center rounded-full border transition",
                                cur === mode
                                  ? mode === "hide" ? "border-rose-400/50 bg-rose-500/20 text-rose-200" : mode === "transparent" ? "border-sky-400/50 bg-sky-500/20 text-sky-200" : "border-emerald-400/50 bg-emerald-500/20 text-emerald-200"
                                  : "border-line text-mist-600 hover:border-mist-500 hover:text-mist-300",
                              )}
                            >
                              {cur === mode ? <Check className="size-4" /> : <span className="size-2 rounded-full bg-current opacity-30" />}
                            </button>
                          </td>
                        ))}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <button onClick={() => setB((s) => ({ ...s, elements: {} }))} className="mt-3 inline-flex items-center gap-1.5 text-sm font-semibold text-mist-400 transition hover:text-mist-100">
              <RotateCcw className="size-4" /> Show everything again
            </button>
          </Card>

          {/* ── SAFE-ZONE STAR EDITOR (full) ── */}
          <Card className="p-4 sm:p-5">
            <h2 className="flex items-center gap-2 font-display text-lg font-bold text-mist-100"><Star className="size-5 text-lotus-300" /> Safe-zone star editor</h2>
            <p className="mt-0.5 text-sm text-mist-400">Complete control of the marker on the protected squares — icon, colour, size, opacity, border, glow, shadow, rotation and position.</p>

            <div className="mt-4 grid gap-4 lg:grid-cols-[1fr_13rem]">
              <div className="space-y-4">
                {/* Icon source */}
                <div>
                  <div className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-mist-400">Star / icon</div>
                  <div className="flex flex-wrap gap-1.5">
                    {SAFE_ICON_MODES.map((m) => (
                      <button
                        key={m.value}
                        onClick={() => setD({ safeIconMode: m.value })}
                        className={cn("rounded-lg border px-3 py-1.5 text-xs font-semibold transition", b.decor.safeIconMode === m.value ? "border-lotus-400/60 bg-lotus-500/15 text-mist-100" : "border-line bg-ink-900 text-mist-400 hover:text-mist-100")}
                      >
                        {m.label}
                      </button>
                    ))}
                  </div>
                  {b.decor.safeIconMode === "custom" && (
                    <div className="mt-2.5 flex flex-wrap items-center gap-3">
                      <div className="grid size-14 shrink-0 place-items-center overflow-hidden rounded-lg border border-line bg-ink-900">
                        {b.decor.safeIcon ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={withBase(b.decor.safeIcon)} alt="" className="size-full object-contain" />
                        ) : <Star className="size-6 text-mist-600" />}
                      </div>
                      <Button size="sm" variant="secondary" onClick={() => safeIconRef.current?.click()} disabled={uploading}>
                        <Upload className="size-4" /> {uploading ? "Uploading…" : "Upload icon"}
                      </Button>
                      {b.decor.safeIcon && <button onClick={() => setD({ safeIcon: "" })} className="inline-flex items-center gap-1 text-xs text-mist-500 hover:text-rose-300"><Trash2 className="size-3.5" /> Remove</button>}
                    </div>
                  )}
                </div>

                {/* Visibility */}
                <div>
                  <div className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-mist-400">Visibility</div>
                  <div className="grid gap-1.5 sm:grid-cols-2">
                    {SAFE_VISIBILITY.map((v) => (
                      <button
                        key={v.value}
                        onClick={() => setD({ safeVisibility: v.value })}
                        className={cn("rounded-lg border px-3 py-2 text-left transition", b.decor.safeVisibility === v.value ? "border-lotus-400/60 bg-lotus-500/15" : "border-line bg-ink-900 hover:border-mist-600")}
                      >
                        <div className="text-xs font-semibold text-mist-100">{v.label}</div>
                        <div className="text-[10px] leading-snug text-mist-500">{v.desc}</div>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Appearance */}
                <div className="space-y-2.5 border-t border-line/60 pt-4">
                  <div className="text-xs font-semibold uppercase tracking-wide text-mist-400">Appearance</div>
                  <div className="flex flex-wrap items-center gap-4">
                    <label className="flex items-center gap-2 text-sm text-mist-200">
                      Star colour
                      <input type="color" value={(b.decor.safeColor || "#10b981").slice(0, 7)} onChange={(e) => setD({ safeColor: e.target.value })} className="size-9 cursor-pointer rounded border border-line bg-transparent" />
                    </label>
                    <label className="flex items-center gap-2 text-sm text-mist-200">
                      Border colour
                      <input type="color" value={(b.decor.safeBorderColor || b.decor.safeColor || "#10b981").slice(0, 7)} onChange={(e) => setD({ safeBorderColor: e.target.value })} disabled={!b.decor.safeBorder} className={cn("size-9 cursor-pointer rounded border border-line bg-transparent", !b.decor.safeBorder && "opacity-40")} />
                    </label>
                  </div>
                  <Slider label="Star size" value={b.decor.safeSizePct} min={20} max={200} suffix="%" onChange={(v) => setD({ safeSizePct: v })} />
                  <Slider label="Star opacity" value={b.decor.safeOpacityPct} min={0} max={100} suffix="%" onChange={(v) => setD({ safeOpacityPct: v })} />
                  <Slider label="Rotation" value={b.decor.safeRotateDeg} min={-180} max={180} suffix="°" onChange={(v) => setD({ safeRotateDeg: v })} />
                  <Slider label="Position X" value={b.decor.safePosXPct} min={-50} max={50} suffix="%" onChange={(v) => setD({ safePosXPct: v })} />
                  <Slider label="Position Y" value={b.decor.safePosYPct} min={-50} max={50} suffix="%" onChange={(v) => setD({ safePosYPct: v })} />
                  <div className="divide-y divide-line/60">
                    <ToggleRow label="Star border" desc="Ring outline around the star" on={b.decor.safeBorder} onToggle={() => setD({ safeBorder: !b.decor.safeBorder })} />
                    <ToggleRow label="Glow" desc="Soft glow around the star, in the star's colour" on={b.decor.safeGlow} onToggle={() => setD({ safeGlow: !b.decor.safeGlow })} />
                  </div>
                  {b.decor.safeGlow && <Slider label="Glow intensity" value={b.decor.safeGlowPx} min={1} max={24} suffix="px" onChange={(v) => setD({ safeGlowPx: v })} />}
                  <div className="divide-y divide-line/60">
                    <ToggleRow label="Shadow" desc="Drop shadow so the star stays readable on a busy board" on={b.decor.safeShadow} onToggle={() => setD({ safeShadow: !b.decor.safeShadow })} />
                  </div>
                  {b.decor.safeShadow && <Slider label="Shadow opacity" value={b.decor.safeShadowOpacityPct} min={0} max={100} suffix="%" onChange={(v) => setD({ safeShadowOpacityPct: v })} />}
                </div>
              </div>

              {/* Live star preview */}
              <div className="lg:sticky lg:top-4 lg:self-start">
                <p className="mb-1.5 text-center text-[11px] font-semibold uppercase tracking-wide text-mist-500">Star preview</p>
                <SafeStarPreview decor={b.decor} />
              </div>
            </div>
          </Card>

          {/* ── SAFE-ZONE CELLS — move the protected squares ── */}
          <Card className="p-4 sm:p-5">
            <h2 className="flex items-center gap-2 font-display text-lg font-bold text-mist-100"><Star className="size-5 text-lotus-300" /> Safe-zone cells</h2>
            <p className="mt-0.5 text-sm text-mist-400">
              Choose exactly which squares on the 52-square track are protected. Tap any square on the ring below to make it safe or unsafe.
            </p>
            <div className="mt-3 flex items-start gap-2 rounded-lg border border-amber-400/30 bg-amber-500/[0.06] px-3 py-2 text-[11px] text-mist-300">
              <Info className="mt-0.5 size-3.5 shrink-0 text-amber-300" />
              <p>
                <b className="text-amber-200">This one changes how the game plays</b> — coins can&apos;t be captured on a safe square. The
                setting comes from the server, so every player uses the same squares. Leave it empty to keep the classic 8
                (the four start squares plus the four guard stars).
              </p>
            </div>

            <SafeCellPicker
              selected={b.safeCells}
              onToggle={(ri) => setB((s) => ({ ...s, safeCells: s.safeCells.includes(ri) ? s.safeCells.filter((x) => x !== ri) : [...s.safeCells, ri].sort((a, z) => a - z) }))}
            />

            <div className="mt-3 flex flex-wrap items-center gap-4">
              <button onClick={() => setB((s) => ({ ...s, safeCells: [] }))} className="inline-flex items-center gap-1.5 text-sm font-semibold text-mist-400 transition hover:text-mist-100">
                <RotateCcw className="size-4" /> Back to the classic 8
              </button>
              <button onClick={() => setB((s) => ({ ...s, safeCells: [...DEFAULT_SAFE] }))} className="text-sm font-semibold text-lotus-300 transition hover:text-lotus-200">
                Start from the classic 8 and edit
              </button>
              <span className="text-xs text-mist-500">
                {b.safeCells.length === 0 ? "Using the classic 8 squares." : `${b.safeCells.length} square${b.safeCells.length === 1 ? "" : "s"} selected.`}
              </span>
            </div>
          </Card>

          {/* ── Per-slot token layout (client spec §6) — position each of the 4 home tokens ── */}
          <Card className="p-4 sm:p-5">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="min-w-0">
                <h2 className="flex items-center gap-2 font-display text-lg font-bold text-mist-100"><SlidersHorizontal className="size-5 text-lotus-300" /> Token slot layout</h2>
                <p className="mt-0.5 text-sm text-mist-400">Fine-tune where each of the four parked tokens sits inside every home yard — to line them up with a custom board&apos;s own home circles. Move, resize and rotate each slot independently.</p>
              </div>
              <button onClick={() => setSlotEnabled(!b.tokenSlots.enabled)} aria-pressed={b.tokenSlots.enabled} className={cn("relative h-7 w-14 shrink-0 rounded-full transition", b.tokenSlots.enabled ? "bg-emerald-500" : "bg-mist-600")}>
                <span className={cn("absolute top-0.5 grid size-6 place-items-center rounded-full bg-white text-[9px] font-bold transition-all", b.tokenSlots.enabled ? "left-[calc(100%-1.625rem)] text-emerald-600" : "left-0.5 text-mist-500")}>{b.tokenSlots.enabled ? "ON" : "OFF"}</span>
              </button>
            </div>
            {b.tokenSlots.enabled ? (
              <div className="mt-4 grid gap-4 lg:grid-cols-[1fr_theme(width.44)]">
                <div className="space-y-3">
                  {b.tokenSlots.slots.map((s, i) => (
                    <div key={i} className="rounded-xl border border-line bg-ink-800/50 p-3">
                      <div className="mb-2 text-xs font-bold uppercase tracking-wide text-lotus-200">Token slot {i + 1}</div>
                      <div className="space-y-2.5">
                        <Slider label="Move left / right" value={s.dxPct} min={-150} max={150} suffix="%" onChange={(v) => setSlot(i, { dxPct: v })} />
                        <Slider label="Move up / down" value={s.dyPct} min={-150} max={150} suffix="%" onChange={(v) => setSlot(i, { dyPct: v })} />
                        <Slider label="Token size" value={s.sizePct} min={40} max={200} suffix="%" onChange={(v) => setSlot(i, { sizePct: v })} />
                        <Slider label="Rotation" value={s.rotateDeg} min={-180} max={180} suffix="°" onChange={(v) => setSlot(i, { rotateDeg: v })} />
                      </div>
                    </div>
                  ))}
                  <button onClick={resetSlots} className="inline-flex items-center gap-1.5 text-sm font-semibold text-mist-400 transition hover:text-mist-100"><RotateCcw className="size-4" /> Reset slots to default</button>
                </div>
                <div className="lg:sticky lg:top-4 lg:self-start">
                  <p className="mb-1.5 text-center text-[11px] font-semibold uppercase tracking-wide text-mist-500">Home preview</p>
                  <SlotPreview slots={b.tokenSlots.slots} />
                  <p className="mt-1.5 text-center text-[10px] text-mist-500">Same placement each player sees. Tip: turn on &ldquo;Hide white token area&rdquo; above and line these up with your board&apos;s home circles.</p>
                </div>
              </div>
            ) : (
              <p className="mt-3 rounded-lg bg-ink-800/60 px-3 py-2 text-xs text-mist-500">Off — tokens use the standard 2×2 home layout. Turn on to place each of the four tokens yourself.</p>
            )}
            <p className="mt-3 rounded-lg border border-lotus-400/25 bg-lotus-500/[0.05] px-3 py-2 text-xs text-mist-400">
              Need each home controlled <b className="text-mist-200">separately</b> — Red, Green, Yellow and Blue with their own background,
              &ldquo;Hide White Token Area&rdquo; switch and per-slot settings? Open{" "}
              <a href={withBase("/admin/token-areas")} className="font-semibold text-lotus-300 hover:text-lotus-200">Token Placement Areas</a>.
            </p>
          </Card>

          {/* Board decorations — home symbol + safe-cell icon + frame colour */}
          <Card className="p-4 sm:p-5">
            <h2 className="flex items-center gap-2 font-display text-lg font-bold text-mist-100"><ImageIcon className="size-5 text-lotus-300" /> Board design</h2>
            <p className="mt-0.5 text-sm text-mist-400">Decorate the board: upload a full custom board, or set a home-area picture (e.g. a lotus), the safe-square icon, and the frame colour. Applies live to all players.</p>

            {/* Full custom board image */}
            <div className="mt-4 rounded-xl border border-lotus-400/25 bg-lotus-500/[0.05] p-3">
              <div className="flex flex-wrap items-center gap-3">
                <div className="grid size-16 shrink-0 place-items-center overflow-hidden rounded-lg border border-line bg-ink-900">
                  {b.decor.fullImage ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={withBase(b.decor.fullImage)} alt="" className="size-full object-contain" />
                  ) : <span className="text-[10px] text-mist-600">None</span>}
                </div>
                <div className="min-w-36 flex-1">
                  <div className="text-sm font-semibold text-mist-100">Full board image</div>
                  <div className="text-xs text-mist-500">Upload a complete Ludo board picture — it becomes the playing surface. Use a square, standard 15×15 layout so coins land on the right squares.</div>
                </div>
                {b.decor.fullImage && (
                  <button onClick={() => setD({ fullImageShow: !b.decor.fullImageShow })} title={b.decor.fullImageShow ? "Shown" : "Hidden"} className={cn("inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-white transition", b.decor.fullImageShow ? "bg-emerald-500 hover:brightness-110" : "bg-mist-600 hover:brightness-110")}>{b.decor.fullImageShow ? <><Eye className="size-4" /> Shown</> : <><EyeOff className="size-4" /> Hidden</>}</button>
                )}
                <input ref={fullBoardRef} type="file" accept="image/*" hidden onChange={(e) => { const file = e.target.files?.[0]; if (file) uploadTo(file, (u) => setD({ fullImage: u }), () => { if (fullBoardRef.current) fullBoardRef.current.value = ""; }); }} />
                <Button variant="secondary" onClick={() => fullBoardRef.current?.click()} disabled={uploading}><Upload className="size-4" /> {b.decor.fullImage ? "Change" : "Upload board"}</Button>
                {b.decor.fullImage && <Button variant="ghost" onClick={() => setD({ fullImage: "" })}><Trash2 className="size-4" /> Remove</Button>}
              </div>
              {activeLibBoard && (
                <p className="mt-2 rounded-lg bg-amber-500/10 px-2.5 py-1.5 text-[11px] font-semibold text-amber-300">A saved board (&ldquo;{activeLibBoard.name || "Board"}&rdquo;) is active below and is the LIVE surface — this single board is used only when no saved board is active.</p>
              )}
              {b.decor.fullImage && (
                <div className="mt-3 space-y-3">
                  {/* Fit mode — the fix for stretched/distorted boards */}
                  <div>
                    <div className="mb-1.5 text-xs font-semibold text-mist-300">How the picture fills the board</div>
                    <div className="grid gap-2 sm:grid-cols-3">
                      {FIT_OPTIONS.map((f) => {
                        const picked = (b.decor.fullImageFit ?? "contain") === f.id;
                        return (
                          <button key={f.id} onClick={() => setD({ fullImageFit: f.id })} title={f.hint}
                            className={cn("rounded-xl border p-2.5 text-left transition", picked ? "border-lotus-400 bg-lotus-500/10" : "border-line bg-ink-800 hover:bg-white/[0.06]")}>
                            <div className={cn("text-[12px] font-bold", picked ? "text-lotus-200" : "text-mist-200")}>{f.label}</div>
                            <div className="mt-0.5 text-[10px] leading-tight text-mist-500">{f.hint}</div>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                  <Slider label="Board image opacity" value={b.decor.fullImageOpacityPct} min={30} max={100} suffix="%" onChange={(v) => setD({ fullImageOpacityPct: v })} />
                  {/* Fine alignment nudges so a not-perfectly-square board lines up with the grid */}
                  <Slider label="Align — left / right" value={b.decor.fullImageOffsetXPct} min={-40} max={40} suffix="%" onChange={(v) => setD({ fullImageOffsetXPct: v })} />
                  <Slider label="Align — up / down" value={b.decor.fullImageOffsetYPct} min={-40} max={40} suffix="%" onChange={(v) => setD({ fullImageOffsetYPct: v })} />
                  <Slider label="Zoom" value={b.decor.fullImageScalePct} min={50} max={150} suffix="%" onChange={(v) => setD({ fullImageScalePct: v })} />
                  <p className="text-[11px] text-mist-500">With a full board set, the built-in path squares turn transparent so your art shows through; the home yards, centre and coins still appear on top. <b>Tip:</b> use a <b>square</b> picture (same width &amp; height) for a perfect fit with no empty edges.</p>
                  {/* GRID-ALIGNMENT PREVIEW — verify the 15×15 grid & token zones line up before publishing */}
                  <div className="border-t border-line/60 pt-3">
                    <div className="mb-1.5 flex items-center gap-2 text-xs font-semibold text-mist-300">
                      <ImageIcon className="size-4 text-lotus-300" /> Grid alignment preview
                      <button onClick={() => setShowGrid((s) => !s)} className={cn("ml-auto rounded-full px-2 py-0.5 text-[10px] font-bold", showGrid ? "bg-emerald-500/15 text-emerald-300" : "bg-white/8 text-mist-400")}>{showGrid ? "Grid ON" : "Grid OFF"}</button>
                    </div>
                    <BoardFitPreview
                      image={withBase(b.decor.fullImage)}
                      fit={b.decor.fullImageFit ?? "contain"}
                      opacityPct={b.decor.fullImageOpacityPct}
                      offsetXPct={b.decor.fullImageOffsetXPct}
                      offsetYPct={b.decor.fullImageOffsetYPct}
                      scalePct={b.decor.fullImageScalePct}
                      frame={b.decor.frameColor || "#8a6d54"}
                      showGrid={showGrid}
                    />
                    <p className="mt-1.5 text-center text-[10px] text-mist-500">The coloured corners are the four home yards and the centre; check your board&apos;s own homes line up with them.</p>
                  </div>
                </div>
              )}
            </div>

            {/* Home-area symbol */}
            <div className="mt-4 flex flex-wrap items-center gap-3 border-t border-line/60 pt-4">
              <div className="grid size-14 shrink-0 place-items-center overflow-hidden rounded-xl border border-line bg-white">
                {b.decor.homeSymbol ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={withBase(b.decor.homeSymbol)} alt="" className="size-12 object-contain" />
                ) : <span className="text-[10px] text-mist-500">None</span>}
              </div>
              <div className="min-w-36 flex-1">
                <div className="text-sm font-semibold text-mist-100">Home-area symbol</div>
                <div className="text-xs text-mist-500">Shown behind the four coin slots in each home.</div>
              </div>
              <input ref={homeSymRef} type="file" accept="image/*" hidden onChange={(e) => { const file = e.target.files?.[0]; if (file) uploadTo(file, (u) => setD({ homeSymbol: u }), () => { if (homeSymRef.current) homeSymRef.current.value = ""; }); }} />
              <button onClick={() => setD({ homeSymbolShow: !b.decor.homeSymbolShow })} title={b.decor.homeSymbolShow ? "Shown" : "Hidden"} className={cn("inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-white transition", b.decor.homeSymbolShow ? "bg-emerald-500 hover:brightness-110" : "bg-mist-600 hover:brightness-110")}>{b.decor.homeSymbolShow ? <><Eye className="size-4" /> Shown</> : <><EyeOff className="size-4" /> Hidden</>}</button>
              <Button variant="secondary" onClick={() => homeSymRef.current?.click()} disabled={uploading}><Upload className="size-4" /> {b.decor.homeSymbol ? "Change" : "Upload"}</Button>
              {b.decor.homeSymbol && <Button variant="ghost" onClick={() => setD({ homeSymbol: "" })}><Trash2 className="size-4" /></Button>}
            </div>

            {/* Safe-cell icon */}
            <div className="mt-4 flex flex-wrap items-center gap-3 border-t border-line/60 pt-4">
              <div className="grid size-14 shrink-0 place-items-center overflow-hidden rounded-xl border border-line bg-white">
                {b.decor.safeIcon ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={withBase(b.decor.safeIcon)} alt="" className="size-10 object-contain" />
                ) : <span className="text-lg">⭐</span>}
              </div>
              <div className="min-w-36 flex-1">
                <div className="text-sm font-semibold text-mist-100">Safe-square icon</div>
                <div className="text-xs text-mist-500">Marks the protected squares. Default is a star.</div>
              </div>
              <input ref={safeIconRef} type="file" accept="image/*" hidden onChange={(e) => { const file = e.target.files?.[0]; if (file) uploadTo(file, (u) => setD({ safeIcon: u }), () => { if (safeIconRef.current) safeIconRef.current.value = ""; }); }} />
              <button onClick={() => setD({ safeIconShow: !b.decor.safeIconShow })} title={b.decor.safeIconShow ? "Shown" : "Hidden"} className={cn("inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-white transition", b.decor.safeIconShow ? "bg-emerald-500 hover:brightness-110" : "bg-mist-600 hover:brightness-110")}>{b.decor.safeIconShow ? <><Eye className="size-4" /> Shown</> : <><EyeOff className="size-4" /> Hidden</>}</button>
              <Button variant="secondary" onClick={() => safeIconRef.current?.click()} disabled={uploading}><Upload className="size-4" /> {b.decor.safeIcon ? "Change" : "Upload"}</Button>
              {b.decor.safeIcon && <Button variant="ghost" onClick={() => setD({ safeIcon: "" })}><Trash2 className="size-4" /></Button>}
            </div>

            {/* Frame colour */}
            <div className="mt-4 flex flex-wrap items-center gap-4 border-t border-line/60 pt-4">
              <label className="flex items-center gap-2 text-sm font-semibold text-mist-200">
                Frame colour
                <input type="color" value={(b.decor.frameColor || "#8a6d54").slice(0, 7)} onChange={(e) => setD({ frameColor: e.target.value })} className="size-9 cursor-pointer rounded border border-line bg-transparent" />
              </label>
              {b.decor.frameColor
                ? <Button variant="ghost" onClick={() => setD({ frameColor: "" })}><Trash2 className="size-4" /> Use theme default</Button>
                : <span className="text-xs text-mist-500">Using the board theme&apos;s default frame.</span>}
            </div>

            {/* Mini preview: framed home corner + a safe cell */}
            <div className="mt-4 flex items-center gap-4 border-t border-line/60 pt-4">
              <div className="rounded-xl p-2" style={{ background: b.decor.frameColor || "#8a6d54" }}>
                <div className="relative grid size-24 grid-cols-2 grid-rows-2 place-items-center gap-1 overflow-hidden rounded-md border-2 border-blue-500 bg-white p-1">
                  {b.decor.homeSymbolShow && b.decor.homeSymbol && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={withBase(b.decor.homeSymbol)} alt="" className="pointer-events-none absolute inset-[12%] size-[76%] object-contain opacity-60" />
                  )}
                  {[0, 1, 2, 3].map((i) => <span key={i} className="relative size-4 rounded-full bg-blue-500 ring-2 ring-blue-300" />)}
                </div>
              </div>
              <div className="text-center">
                <div className="grid size-10 place-items-center rounded border border-black/15 bg-white">
                  {b.decor.safeIconShow ? (
                    b.decor.safeIcon ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={withBase(b.decor.safeIcon)} alt="" className="size-7 object-contain" />
                    ) : <span className="text-lg text-emerald-500">★</span>
                  ) : null}
                </div>
                <span className="mt-1 block text-[10px] text-mist-500">safe cell</span>
              </div>
            </div>
          </Card>

          {/* ── Custom Board LIBRARY — save multiple boards, pick which is active ── */}
          <Card className="p-4 sm:p-5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="flex items-center gap-2 font-display text-lg font-bold text-mist-100"><ImageIcon className="size-5 text-lotus-300" /> Saved boards (library)</h2>
              <input ref={libraryRef} type="file" accept="image/png,image/jpeg,image/webp,image/*" hidden onChange={(e) => { const file = e.target.files?.[0]; if (file) uploadTo(file, (u) => addBoardFromUrl(u), () => { if (libraryRef.current) libraryRef.current.value = ""; }); }} />
              <Button size="sm" variant="secondary" onClick={() => libraryRef.current?.click()} disabled={uploading}><Upload className="size-4" /> {uploading ? "Uploading…" : "Add board"}</Button>
            </div>
            <p className="mt-0.5 text-sm text-mist-400">Upload and keep several complete board pictures. Pick <b>one</b> to be the live surface — the others stay saved and untouched. PNG (transparent OK), JPG or WebP; square 15×15 recommended. This is a visual layer only — gameplay is unchanged.</p>

            {b.boards.length === 0 ? (
              <div className="mt-4 rounded-xl border border-dashed border-line p-6 text-center text-sm text-mist-500">No saved boards yet. Press <b>Add board</b> to upload one.</div>
            ) : (
              <div className="mt-4 space-y-3">
                {/* "Use single board" / none-active option */}
                <button onClick={() => setB((p) => ({ ...p, activeBoardId: "" }))} className={cn("flex w-full items-center gap-2 rounded-lg border px-3 py-2 text-left text-xs font-semibold transition", !b.activeBoardId ? "border-lotus-400 bg-lotus-500/10 text-lotus-200" : "border-line bg-ink-800 text-mist-300 hover:bg-white/[0.06]")}>
                  <span className={cn("grid size-4 place-items-center rounded-full border", !b.activeBoardId ? "border-lotus-300 bg-lotus-400" : "border-mist-500")}>{!b.activeBoardId && <Check className="size-3 text-ink-900" />}</span>
                  No saved board active — use the single board / default above
                </button>
                {b.boards.map((bd) => {
                  const active = bd.id === b.activeBoardId;
                  return (
                    <div key={bd.id} className={cn("rounded-xl border p-3 transition", active ? "border-lotus-400 bg-lotus-500/[0.06]" : "border-line bg-ink-800")}>
                      <div className="flex flex-wrap items-center gap-3">
                        <div className="grid size-16 shrink-0 place-items-center overflow-hidden rounded-lg border border-line bg-ink-900" style={{ background: bd.image ? "#0b1120" : undefined }}>
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={withBase(bd.image)} alt="" className="size-full" style={{ objectFit: bd.fit }} />
                        </div>
                        <div className="min-w-40 flex-1">
                          <input value={bd.name} onChange={(e) => updateBoard(bd.id, { name: e.target.value })} placeholder="Board name" className="w-full rounded-lg border border-line bg-ink-900 px-2.5 py-1.5 text-sm font-semibold text-mist-100 outline-none focus:border-lotus-400" />
                          <div className="mt-1 flex items-center gap-2 text-[10px] text-mist-500">
                            {active ? <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 font-bold text-emerald-300">● LIVE surface</span> : <span className="rounded-full bg-white/8 px-2 py-0.5 font-semibold">saved</span>}
                            {bd.enabled === false && <span className="rounded-full bg-rose-500/15 px-2 py-0.5 font-bold text-rose-300">disabled</span>}
                          </div>
                        </div>
                        <div className="flex shrink-0 flex-col items-end gap-1.5">
                          <button onClick={() => setB((p) => ({ ...p, activeBoardId: active ? "" : bd.id }))} disabled={bd.enabled === false} className={cn("inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-bold text-white transition disabled:opacity-40", active ? "bg-emerald-500" : "bg-lotus-500 hover:brightness-110")}>
                            {active ? <><Check className="size-3.5" /> Active</> : "Make active"}
                          </button>
                          <div className="flex items-center gap-1.5">
                            <button onClick={() => updateBoard(bd.id, { enabled: bd.enabled === false })} title={bd.enabled === false ? "Enable" : "Disable"} className="rounded-md bg-white/8 p-1.5 text-mist-300 hover:text-mist-100">{bd.enabled === false ? <EyeOff className="size-4" /> : <Eye className="size-4" />}</button>
                            <button onClick={() => removeBoard(bd.id)} title="Delete board" className="rounded-md bg-white/8 p-1.5 text-rose-300 hover:bg-rose-500/20"><Trash2 className="size-4" /></button>
                          </div>
                        </div>
                      </div>
                      {/* PRICE — give the board a coin price and it appears in
                          the Store's Boards category on its own. 0 keeps it
                          free for everyone, exactly as before. */}
                      <CosmeticPriceControl
                        kind="board"
                        id={bd.id}
                        price={bd.priceCoins ?? 0}
                        onPrice={(v) => updateBoard(bd.id, { priceCoins: v })}
                        validityDays={bd.validityDays ?? 0}
                        onValidity={(v) => updateBoard(bd.id, { validityDays: v })}
                        saved={!saving}
                        className="mt-2.5 border-t border-line/60 pt-2.5"
                      />
                      {/* Per-board fit + alignment (only worth showing for the active board) */}
                      {active && (
                        <div className="mt-3 space-y-2.5 border-t border-line/60 pt-3">
                          <div className="grid gap-1.5 sm:grid-cols-3">
                            {FIT_OPTIONS.map((f) => {
                              const picked = (bd.fit ?? "contain") === f.id;
                              return (
                                <button key={f.id} onClick={() => updateBoard(bd.id, { fit: f.id })} title={f.hint} className={cn("rounded-lg border px-2 py-1.5 text-[11px] font-bold transition", picked ? "border-lotus-400 bg-lotus-500/10 text-lotus-200" : "border-line bg-ink-900 text-mist-300 hover:bg-white/[0.06]")}>{f.label}</button>
                              );
                            })}
                          </div>
                          <Slider label="Opacity" value={bd.opacityPct} min={30} max={100} suffix="%" onChange={(v) => updateBoard(bd.id, { opacityPct: v })} />
                          <Slider label="Align — left / right" value={bd.offsetXPct} min={-40} max={40} suffix="%" onChange={(v) => updateBoard(bd.id, { offsetXPct: v })} />
                          <Slider label="Align — up / down" value={bd.offsetYPct} min={-40} max={40} suffix="%" onChange={(v) => updateBoard(bd.id, { offsetYPct: v })} />
                          <Slider label="Zoom" value={bd.scalePct} min={50} max={150} suffix="%" onChange={(v) => updateBoard(bd.id, { scalePct: v })} />
                          <div className="flex items-center justify-between">
                            <span className="text-[11px] font-semibold text-mist-400">Grid alignment preview</span>
                            <button onClick={() => setShowGrid((s) => !s)} className={cn("rounded-full px-2 py-0.5 text-[10px] font-bold", showGrid ? "bg-emerald-500/15 text-emerald-300" : "bg-white/8 text-mist-400")}>{showGrid ? "Grid ON" : "Grid OFF"}</button>
                          </div>
                          <BoardFitPreview image={withBase(bd.image)} fit={bd.fit} opacityPct={bd.opacityPct} offsetXPct={bd.offsetXPct} offsetYPct={bd.offsetYPct} scalePct={bd.scalePct} frame={b.decor.frameColor || "#8a6d54"} showGrid={showGrid} />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </Card>

          <button onClick={resetAll} className="inline-flex items-center gap-1.5 text-sm font-semibold text-mist-400 transition hover:text-mist-100">
            <RotateCcw className="size-4" /> Reset everything to defaults
          </button>
        </div>

        {/* ---------- Live preview ---------- */}
        <div className="lg:sticky lg:top-4 lg:self-start">
          <Card className="p-4">
            <h3 className="mb-2 text-center text-xs font-bold uppercase tracking-wide text-mist-400">Live preview</h3>
            {/* Centre home (the four arms meet here) */}
            <div
              className="relative mx-auto grid aspect-square w-full max-w-56 place-items-center overflow-hidden rounded-lg"
              style={{ background: "conic-gradient(from 45deg, #16a34a 0deg 90deg, #facc15 90deg 180deg, #2563eb 180deg 270deg, #ef4444 270deg 360deg)" }}
            >
              {c.show && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={centerSrc}
                  alt=""
                  className="pointer-events-none absolute select-none object-contain drop-shadow-[0_1px_3px_rgba(0,0,0,0.45)]"
                  style={{
                    inset: `${centerInset}%`,
                    opacity: c.opacityPct / 100,
                    transform: `translate(${c.offsetXPct}%, ${c.offsetYPct}%) rotate(${c.rotateDeg}deg)`,
                  }}
                />
              )}
              <span className="relative z-[1] grid size-[22%] rotate-45 place-items-center rounded-md bg-white/85 shadow ring-1 ring-white">
                <span className="-rotate-45 text-center text-[10px] leading-none">🏁</span>
              </span>
            </div>

            {/* A shared square: three colours fanned + scaled, exactly like the board */}
            <div className="mt-4">
              <p className="mb-1.5 text-center text-[11px] font-semibold text-mist-500">Coins sharing one square</p>
              <div className="relative mx-auto grid size-16 place-items-center rounded-md bg-ink-800 ring-1 ring-line">
                {(["red", "green", "blue"] as const).map((col, i) => {
                  const off = (i - 1) * fanUnit;
                  return (
                    <span
                      key={col}
                      className="absolute block size-9"
                      style={{ transform: `translateX(${off}%) scale(${scale})` }}
                    >
                      <LudoToken color={col} skin="royal-lotus" />
                    </span>
                  );
                })}
              </div>
            </div>
          </Card>

          {/* ── DICE ─────────────────────────────────────────────────────── */}
          <Card className="p-5">
            <h2 className="font-display text-lg font-bold text-mist-100">Dice</h2>
            <p className="mt-0.5 text-sm text-mist-400">Before anyone rolls, the die never shows a &ldquo;1&rdquo; any more — it stays <b>blank</b>, or shows a picture you upload. You can also keep the <b>last rolled number</b> on screen so every player sees what the previous player rolled.</p>

            {/* Custom idle face */}
            <div className="mt-4 flex items-center justify-between gap-4 rounded-xl border border-line bg-ink-800 p-3">
              <div className="min-w-0">
                <div className="text-sm font-semibold text-mist-100">Custom dice face (before a roll)</div>
                <p className="text-xs text-mist-400">OFF = clean blank die. ON = show your uploaded picture.</p>
              </div>
              <button onClick={() => setDice((p) => ({ ...p, customFace: !p.customFace }))} className={cn("relative h-7 w-12 shrink-0 rounded-full transition", dice.customFace ? "bg-emerald-500" : "bg-ink-700")} aria-pressed={dice.customFace}>
                <span className={cn("absolute top-0.5 size-6 rounded-full bg-white shadow transition-all", dice.customFace ? "left-[22px]" : "left-0.5")} />
              </button>
            </div>

            <div className="mt-3 flex items-center gap-3 rounded-xl border border-line bg-ink-800 p-3">
              <div className="grid size-16 shrink-0 place-items-center rounded-xl border border-line bg-ink-900">
                {dice.faceImage
                  // eslint-disable-next-line @next/next/no-img-element
                  ? <img src={dice.faceImage} alt="Dice face" className="size-14 rounded-lg object-contain" />
                  : <span className="text-[10px] text-mist-500">Blank</span>}
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-sm font-semibold text-mist-100">Dice face image</div>
                <p className="text-xs text-mist-400">Square PNG/JPG works best (e.g. a logo or lotus).</p>
              </div>
              <input ref={diceFaceRef} type="file" accept="image/*" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadTo(f, (u) => setDice((p) => ({ ...p, faceImage: u, customFace: true })), () => { if (diceFaceRef.current) diceFaceRef.current.value = ""; }); }} />
              <div className="flex shrink-0 gap-2">
                <Button variant="secondary" onClick={() => diceFaceRef.current?.click()} disabled={uploading}><Upload className="size-4" /> {uploading ? "Uploading…" : dice.faceImage ? "Change" : "Upload"}</Button>
                {dice.faceImage && <Button variant="secondary" onClick={() => setDice((p) => ({ ...p, faceImage: "" }))}>Remove</Button>}
              </div>
            </div>

            {/* Last rolled */}
            <div className="mt-3 flex items-center justify-between gap-4 rounded-xl border border-line bg-ink-800 p-3">
              <div className="min-w-0">
                <div className="text-sm font-semibold text-mist-100">Show &ldquo;last rolled&rdquo; number</div>
                <p className="text-xs text-mist-400">Keeps the previous roll visible beside the dice until the next player rolls — so nobody misses a result.</p>
              </div>
              <button onClick={() => setDice((p) => ({ ...p, showLastRolled: !p.showLastRolled }))} className={cn("relative h-7 w-12 shrink-0 rounded-full transition", dice.showLastRolled ? "bg-emerald-500" : "bg-ink-700")} aria-pressed={dice.showLastRolled}>
                <span className={cn("absolute top-0.5 size-6 rounded-full bg-white shadow transition-all", dice.showLastRolled ? "left-[22px]" : "left-0.5")} />
              </button>
            </div>
          </Card>
        </div>
      </div>

      {/* Sticky save bar */}
      <div className="fixed inset-x-0 bottom-0 z-20 border-t border-line bg-ink-900/95 px-4 py-3 backdrop-blur">
        <div className="mx-auto flex max-w-4xl items-center justify-between gap-3">
          <span className="text-xs text-mist-400">Changes apply to every player after you save.</span>
          <Button onClick={save} disabled={saving}><Check className="size-4" /> {saving ? "Saving…" : "Save changes"}</Button>
        </div>
      </div>
    </div>
  );
}

/** A live preview of the safe star exactly as the board will draw it, on a
 *  checkerboard so "transparent" is obvious. */
function SafeStarPreview({ decor }: { decor: Decor }) {
  const hidden = decor.safeVisibility === "hidden" || decor.safeVisibility === "gameplayOnly" || decor.safeIconMode === "none" || !decor.safeIconShow;
  const faded = decor.safeVisibility === "transparent";
  const color = decor.safeColor || "#10b981";
  const opacity = faded ? Math.min(decor.safeOpacityPct / 100, 0.2) : decor.safeOpacityPct / 100;
  const filters: string[] = [];
  if (decor.safeGlow) filters.push(`drop-shadow(0 0 ${decor.safeGlowPx}px ${color})`);
  if (decor.safeShadow) filters.push(`drop-shadow(0 1px 2px rgba(0,0,0,${decor.safeShadowOpacityPct / 100}))`);
  const style: React.CSSProperties = {
    opacity,
    color,
    transform: `translate(${decor.safePosXPct}%, ${decor.safePosYPct}%) scale(${decor.safeSizePct / 100}) rotate(${decor.safeRotateDeg}deg)`,
    ...(filters.length ? { filter: filters.join(" ") } : {}),
    ...(decor.safeBorder ? { borderRadius: "9999px", boxShadow: `0 0 0 1.5px ${decor.safeBorderColor || color}` } : {}),
  };
  return (
    <div
      className="relative mx-auto grid aspect-square w-full max-w-[11rem] place-items-center rounded-xl border border-line"
      style={{
        backgroundImage:
          "linear-gradient(45deg,#2a2a3a 25%,transparent 25%),linear-gradient(-45deg,#2a2a3a 25%,transparent 25%),linear-gradient(45deg,transparent 75%,#2a2a3a 75%),linear-gradient(-45deg,transparent 75%,#2a2a3a 75%)",
        backgroundSize: "16px 16px",
        backgroundPosition: "0 0,0 8px,8px -8px,-8px 0",
      }}
    >
      {/* the safe-square tint (kept by "Gameplay only") */}
      {decor.safeHighlight && (
        <span className="pointer-events-none absolute inset-[14%] rounded" style={{ backgroundColor: color, opacity: 0.16, boxShadow: `inset 0 0 0 1.5px ${color}` }} />
      )}
      {!hidden && (
        decor.safeIconMode === "custom" && decor.safeIcon ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={withBase(decor.safeIcon)} alt="" className="relative size-1/2 object-contain" style={{ ...style, color: undefined }} />
        ) : (
          <Star className="relative size-1/2" style={style} fill="currentColor" />
        )
      )}
      {hidden && <span className="relative text-[10px] font-semibold text-mist-500">star hidden</span>}
    </div>
  );
}

/** The 52-square ring laid out as the real board, so an admin can SEE which cell
 *  they're making safe. Start squares are labelled with their colour. */
function SafeCellPicker({ selected, onToggle }: { selected: number[]; onToggle: (ringIndex: number) => void }) {
  const chosen = new Set(selected.length ? selected : DEFAULT_SAFE);
  const usingDefault = selected.length === 0;
  // ring index → its [row, col] on the 15×15 board, and which colour starts there.
  const startAt = new Map<number, LudoColor>();
  (Object.keys(START) as LudoColor[]).forEach((c) => startAt.set(START[c], c));

  return (
    <div className="mt-4">
      <div
        className="mx-auto grid aspect-square w-full max-w-[26rem] gap-[2px] rounded-xl border border-line bg-ink-950 p-2"
        style={{ gridTemplateColumns: "repeat(15,minmax(0,1fr))", gridTemplateRows: "repeat(15,minmax(0,1fr))" }}
      >
        {RING.map(([r, c], ri) => {
          const isSafe = chosen.has(ri);
          const startColor = startAt.get(ri);
          return (
            <button
              key={ri}
              onClick={() => onToggle(ri)}
              title={`Square ${ri}${startColor ? ` — ${LABEL[startColor]} start` : ""}${isSafe ? " · SAFE" : ""}`}
              style={{ gridRow: r + 1, gridColumn: c + 1 }}
              className={cn(
                "grid place-items-center rounded-[2px] border text-[7px] font-bold leading-none transition",
                isSafe
                  ? usingDefault ? "border-emerald-400/40 bg-emerald-500/25 text-emerald-100" : "border-emerald-400/70 bg-emerald-500/40 text-white"
                  : "border-white/10 bg-white/[0.04] text-mist-600 hover:border-lotus-400/50 hover:bg-lotus-500/15",
              )}
            >
              {isSafe ? "★" : startColor ? "▶" : ""}
            </button>
          );
        })}
      </div>
      <p className="mt-2 text-center text-[10px] text-mist-500">
        The 52 squares of the shared track. ★ = safe · ▶ = a colour&apos;s start square.
        {usingDefault && " (Showing the classic 8 — tap any square to start your own set.)"}
      </p>
    </div>
  );
}

/** An ON/OFF toggle row (matches the client's Board Settings mockup). */
function ToggleRow({ label, desc, on, onToggle }: { label: string; desc: string; on: boolean; onToggle: () => void }) {
  return (
    <div className="flex items-center justify-between gap-3 py-3">
      <div><div className="text-sm font-semibold text-mist-100">{label}</div><div className="text-xs text-mist-500">{desc}</div></div>
      <button onClick={onToggle} className={cn("relative h-7 w-14 shrink-0 rounded-full transition", on ? "bg-emerald-500" : "bg-mist-600")} aria-pressed={on}>
        <span className={cn("absolute top-0.5 grid size-6 place-items-center rounded-full bg-white text-[9px] font-bold transition-all", on ? "left-[calc(100%-1.625rem)] text-emerald-600" : "left-0.5 text-mist-500")}>{on ? "ON" : "OFF"}</span>
      </button>
    </div>
  );
}

/** A small Ludo board that reflects the Board-Settings toggles live. */
function BoardMiniPreview({ decor }: { decor: Decor }) {
  const border = decor.boxBorder ? { border: "1.5px solid", borderColor: decor.borderColor || "#00000026" } : { border: "1.5px solid transparent" };
  const cell = (bg: string, extra?: ReactNode) => (
    <span className="grid size-5 place-items-center bg-white" style={border}>{decor.boxHighlight && bg ? <span className="grid size-full place-items-center" style={{ background: bg }}>{extra}</span> : extra}</span>
  );
  const star = decor.safeIconShow ? <span className="text-[9px] leading-none text-emerald-500">★</span> : null;
  const arrow = decor.showArrow ? <span className="grid size-3.5 place-items-center rounded-full bg-black/40 text-[8px] text-white ring-1 ring-white/80">➜</span> : null;
  return (
    <div className="mx-auto grid w-max grid-cols-6 gap-0.5 rounded-lg p-2" style={{ background: decor.frameColor || "#0e1626" }}>
      {cell("")}{cell("#ef4444")}{cell("#ef4444", arrow)}{cell("#ef4444")}{cell("", star)}{cell("")}
      {cell("#22c55e")}{cell("")}{cell("")}{cell("")}{cell("")}{cell("#eab308")}
      {cell("#22c55e", arrow)}{cell("")}{cell("#334155")}{cell("#334155")}{cell("")}{cell("#eab308", arrow)}
      {cell("#22c55e")}{cell("")}{cell("#334155")}{cell("#334155")}{cell("")}{cell("#eab308")}
      {cell("#3b82f6")}{cell("")}{cell("")}{cell("")}{cell("")}{cell("#eab308")}
      {cell("")}{cell("", star)}{cell("#3b82f6")}{cell("#3b82f6", arrow)}{cell("#3b82f6")}{cell("")}
    </div>
  );
}

/** A square board preview: the uploaded art rendered EXACTLY as it will appear
 *  in-game (fit + opacity + align), with an optional 15×15 grid + home/centre
 *  overlay so the admin can confirm token positions line up before publishing. */
function BoardFitPreview({ image, fit, opacityPct, offsetXPct, offsetYPct, scalePct, frame, showGrid }: {
  image: string; fit: Fit; opacityPct: number; offsetXPct: number; offsetYPct: number; scalePct: number; frame: string; showGrid: boolean;
}) {
  // Ludo 15×15 zones (grid line numbers): the four 6×6 home yards + the 3×3 centre.
  const zones: { r: string; c: string; color: string }[] = [
    { r: "1 / 7", c: "1 / 7", color: "#ef4444" },     // top-left home
    { r: "1 / 7", c: "10 / 16", color: "#22c55e" },   // top-right home
    { r: "10 / 16", c: "1 / 7", color: "#3b82f6" },   // bottom-left home
    { r: "10 / 16", c: "10 / 16", color: "#eab308" }, // bottom-right home
    { r: "7 / 10", c: "7 / 10", color: "#ffffff" },   // centre
  ];
  return (
    <div className="mx-auto w-full max-w-64 rounded-xl p-1.5" style={{ background: frame }}>
      <div className="relative aspect-square w-full overflow-hidden rounded-lg bg-ink-950">
        {image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={image} alt="" draggable={false} className="pointer-events-none absolute inset-0 size-full select-none" style={{ objectFit: fit, objectPosition: "center", opacity: opacityPct / 100, transform: `translate(${offsetXPct}%, ${offsetYPct}%) scale(${scalePct / 100})` }} />
        ) : null}
        {showGrid && (
          <>
            {/* faint 15×15 grid lines */}
            <div className="pointer-events-none absolute inset-0" style={{
              backgroundImage: "linear-gradient(to right, rgba(255,255,255,0.18) 1px, transparent 1px), linear-gradient(to bottom, rgba(255,255,255,0.18) 1px, transparent 1px)",
              backgroundSize: `${100 / 15}% ${100 / 15}%`,
            }} />
            {/* home + centre alignment zones */}
            <div className="pointer-events-none absolute inset-0 grid" style={{ gridTemplateColumns: "repeat(15,1fr)", gridTemplateRows: "repeat(15,1fr)" }}>
              {zones.map((z, i) => (
                <span key={i} style={{ gridRow: z.r, gridColumn: z.c, background: `${z.color}22`, boxShadow: `inset 0 0 0 2px ${z.color}` }} />
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

/** A home-yard preview showing the 4 token slots placed per the admin's layout —
 *  mirrors the real game render (2×2 grid + a per-slot transform wrapper). */
function SlotPreview({ slots }: { slots: TokenSlot[] }) {
  const colors = ["#ef4444", "#22c55e", "#eab308", "#3b82f6"];
  return (
    <div className="mx-auto aspect-square w-full max-w-44 overflow-hidden rounded-xl border-2 border-lotus-400/30 bg-white p-2 shadow-inner">
      <div className="grid size-full grid-cols-2 grid-rows-2 place-items-center gap-1.5">
        {slots.map((s, i) => (
          <div key={i} className="grid size-full place-items-center" style={{ transform: `translate(${s.dxPct}%, ${s.dyPct}%) scale(${s.sizePct / 100}) rotate(${s.rotateDeg}deg)` }}>
            <span className="grid size-3/5 place-items-center rounded-full text-[10px] font-bold text-white shadow ring-2 ring-white/70" style={{ background: colors[i] }}>{i + 1}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/** A labelled range slider with its live numeric value. */
function Slider({ label, value, min, max, suffix, onChange }: {
  label: string; value: number; min: number; max: number; suffix?: string; onChange: (v: number) => void;
}) {
  return (
    <label className="block">
      <div className="mb-1 flex items-center justify-between text-sm">
        <span className="font-semibold text-mist-200">{label}</span>
        <span className="font-mono text-xs text-lotus-300">{value}{suffix}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="h-2 w-full cursor-pointer appearance-none rounded-full bg-ink-700 accent-lotus-400"
      />
    </label>
  );
}
