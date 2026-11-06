"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Dices, CircleDot, Sparkles, ArrowLeft, LayoutGrid, AlignHorizontalJustifyStart, AlignHorizontalJustifyEnd, Lock } from "lucide-react";
import { Die } from "@/components/Die";
import { LudoToken } from "@/components/LudoToken";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import { cn } from "@/lib/cn";
import {
  DICE_SKINS,
  BOARD_THEMES,
  diceSkinById,
  useCosmetics,
  useMyBoardImage,
  useMyDiceModel,
} from "@/lib/cosmetics";
import { useConfig } from "@/lib/config";
import { enabledDiceDesigns, dicePriceOf, canUseDice } from "@/lib/diceDesigns";
import { resolveDiceModels } from "@/lib/dice-model";
import { enabledTokenDesigns } from "@/lib/tokenDesigns";
import { useTurnSide } from "@/lib/turn-side";
import { useAuth } from "@/lib/auth";
import { Avatar } from "@/components/ui/Avatar";
import { withBase } from "@/lib/base-path";
import { storeFrames, buyFrame, equipFrame, myFrameState, validityLabel, type AvatarFrame } from "@/lib/frames";
import { cosmeticCatalog, canUse, buyCosmetic, fetchOwnedCosmetics, NO_COSMETICS, type OwnedCosmetics } from "@/lib/cosmetic-shop";

type CustomizeTab = "frames" | "dice" | "boards" | "tokens";

export default function CustomizePage() {
  const { dice, token, board, setDice, setToken, setBoard } = useCosmetics();
  const { config } = useConfig();
  const tokenDesigns = enabledTokenDesigns(config.tokenDesigns); // only admin-enabled
  const [turnSide, setTurnSide] = useTurnSide();
  const [previewFace, setPreviewFace] = useState<1 | 2 | 3 | 4 | 5 | 6>(5);
  const dieSkin = diceSkinById(dice);
  const [tab, setTab] = useState<CustomizeTab>("frames");
  const router = useRouter();
  const { toast } = useToast();

  // ---- PAID DICE ----------------------------------------------------------
  // Which paid dice this player owns, so a priced dice shows "buy" until it's
  // theirs. Admins are never gated.
  const { user, refresh: refreshUser } = useAuth();
  const isAdmin = user?.role === "admin";
  const [ownedDice, setOwnedDice] = useState<string[]>([]);
  const [buying, setBuying] = useState("");
  useEffect(() => {
    let on = true;
    fetch(withBase("/api/dice/purchase"), { credentials: "include" })
      .then((r) => r.json())
      .then((d) => { if (on && Array.isArray(d?.owned)) setOwnedDice(d.owned as string[]); })
      .catch(() => {});
    return () => { on = false; };
  }, []);

  const buyDice = async (id: string, name: string, price: number) => {
    if (buying) return;
    if (!window.confirm(`Buy the “${name}” dice for ${price.toLocaleString("en-SA")} coins?`)) return;
    setBuying(id);
    try {
      const res = await fetch(withBase("/api/dice/purchase"), {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ diceId: id }),
      });
      const d = await res.json();
      if (res.ok) {
        setOwnedDice(Array.isArray(d.owned) ? (d.owned as string[]) : [...ownedDice, id]);
        setDice(id as Parameters<typeof setDice>[0]); // bought → equip it straight away
        toast(`“${name}” is yours — equipped. Balance: ${Number(d.balance ?? 0).toLocaleString("en-SA")} coins`, "success");
        void refreshUser?.();
      } else {
        toast(d.error ?? "Could not complete the purchase", "error");
      }
    } catch {
      toast("Network error — please try again", "error");
    }
    setBuying("");
  };

  // ---- PAID BOARDS & TOKENS ------------------------------------------------
  // Exactly the same rule as paid dice: the price lives on the design, set in
  // the admin page where it was created. Price 0 = free for everyone (unchanged),
  // any price = buy it once here and it is yours permanently.
  const [myBoardImage, setMyBoardImage] = useMyBoardImage();
  const [myDiceModel, setMyDiceModel] = useMyDiceModel();
  const diceModels = resolveDiceModels(config.diceModels);
  const [ownedGame, setOwnedGame] = useState<OwnedCosmetics>(NO_COSMETICS);
  useEffect(() => { void fetchOwnedCosmetics().then(setOwnedGame); }, []);
  const boardCatalog = cosmeticCatalog(config, "board");
  const tokenCatalog = cosmeticCatalog(config, "token");
  const diceCatalog = cosmeticCatalog(config, "dice");
  const catalogFor = (kind: "board" | "token" | "dice") =>
    kind === "board" ? boardCatalog : kind === "token" ? tokenCatalog : diceCatalog;
  const priceOf = (kind: "board" | "token" | "dice", id: string) =>
    catalogFor(kind).find((x) => x.id === id)?.price ?? 0;
  const ownsDesign = (kind: "board" | "token" | "dice", id: string) =>
    canUse(catalogFor(kind).find((x) => x.id === id), ownedGame, isAdmin);

  const buyDesign = async (kind: "board" | "token" | "dice", id: string) => {
    const item = catalogFor(kind).find((x) => x.id === id);
    if (!item || buying) return;
    if (!window.confirm(`Buy “${item.name}” for ${item.price.toLocaleString("en-SA")} coins?`)) return;
    setBuying(id);
    const res = await buyCosmetic(kind, id);
    if (res.ok) {
      if (res.owned) setOwnedGame(res.owned);
      // bought → use it straight away
      if (kind === "board") { if (boardCatalog.some((x) => x.id === id)) setMyBoardImage(id); else setBoard(id as Parameters<typeof setBoard>[0]); }
      else if (kind === "dice") setMyDiceModel(id);
      else setToken(id);
      toast(`“${item.name}” is yours — now in use. Balance: ${Number(res.balance ?? 0).toLocaleString("en-SA")} coins`, "success");
      void refreshUser?.();
    } else {
      toast(res.error ?? "Could not complete the purchase", "error");
    }
    setBuying("");
  };

  const wearBoard = (id: string) => {
    if (!ownsDesign("board", id)) { void buyDesign("board", id); return; }
    setBoard(id as Parameters<typeof setBoard>[0]);
  };
  const wearToken = (id: string) => {
    if (!ownsDesign("token", id)) { void buyDesign("token", id); return; }
    setToken(id);
  };

  const goBack = () => {
    if (window.history.length > 1) router.back();
    else router.push("/home");
  };

  return (
    <div className="mx-auto max-w-3xl pb-24">
      <button
        onClick={goBack}
        className="mb-4 inline-flex items-center gap-2 text-sm text-mist-300 hover:text-mist-100"
      >
        <ArrowLeft className="size-4" /> Back
      </button>
      <div className="mb-5">
        <h1 className="font-display text-2xl font-extrabold text-mist-100 sm:text-3xl">
          Customize your style
        </h1>
        <p className="mt-1 text-sm text-mist-300">
          Pick your board theme, dice and token skins. Your choice is saved and used every time you play.
        </p>
      </div>

      <div className="mb-5 inline-flex flex-wrap items-center gap-1 rounded-xl border border-line bg-ink-900/50 p-1">
        {([
          { id: "frames", label: "Frames" },
          { id: "dice", label: "Dice" },
          { id: "boards", label: "Boards" },
          { id: "tokens", label: "Tokens" },
        ] as const).map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={cn(
              "rounded-lg px-3.5 py-1.5 text-sm font-semibold transition",
              tab === t.id ? "bg-lotus-600 text-white" : "text-mist-300 hover:bg-white/[0.06] hover:text-mist-100",
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Live preview */}
      <div className="mb-6 flex items-center justify-center gap-8 rounded-2xl border border-white/10 bg-ink-850/60 p-6">
        <button
          onClick={() => setPreviewFace((((previewFace % 6) + 1) as 1 | 2 | 3 | 4 | 5 | 6))}
          className="grid place-items-center"
          title="Tap to change the face"
        >
          <Die
            face={previewFace}
            surface={dieSkin.surface}
            pipClass={dieSkin.pip}
            className="size-20"
          />
          <span className="mt-2 text-xs text-mist-400">{dieSkin.name} dice</span>
        </button>
        <div className="flex items-end gap-2">
          {(["red", "green", "yellow", "blue"] as const).map((c) => (
            <span key={c} className="block size-9">
              <LudoToken color={c} skin={token} />
            </span>
          ))}
        </div>
      </div>

      {/* Board themes */}
      {tab === "boards" && (
      <section className="mb-7">
        <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-mist-200">
          <LayoutGrid className="size-4 text-emerald-300" /> Board theme
        </h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {BOARD_THEMES.map((b) => {
            const active = b.id === board;
            const bPrice = priceOf("board", b.id);
            const locked = bPrice > 0 && !ownsDesign("board", b.id);
            return (
              <button
                key={b.id}
                onClick={() => wearBoard(b.id)}
                disabled={buying === b.id}
                title={locked ? `Buy this board for ${bPrice} coins` : undefined}
                className={cn(
                  "relative flex flex-col items-center gap-2 rounded-xl border bg-ink-850 p-3 transition",
                  active ? "border-lotus-400 ring-1 ring-lotus-400/50" : "border-line hover:border-lotus-400/40",
                  locked && "opacity-90",
                )}
              >
                {active && !locked && (
                  <span className="absolute right-2 top-2 z-10 grid size-5 place-items-center rounded-full bg-lotus-500 text-white">
                    <Check className="size-3.5" />
                  </span>
                )}
                {locked && (
                  <span className="absolute right-1.5 top-1.5 z-10 inline-flex items-center gap-1 rounded-full bg-amber-500 px-1.5 py-0.5 text-[10px] font-bold text-white shadow">
                    <Lock className="size-3" /> {bPrice.toLocaleString("en-SA")}
                  </span>
                )}
                {/* Mini board preview */}
                <span className="grid size-16 place-items-center rounded-lg p-1.5" style={{ background: b.frame }}>
                  <span className="grid size-full grid-cols-3 grid-rows-3 gap-px rounded p-0.5" style={{ background: b.boardBg }}>
                    {["bg-red-500", "", "bg-green-600", "", "bg-yellow-400", "", "bg-blue-600", "", ""].map((c, i) => (
                      <span key={i} className={cn("rounded-[1px]", c || (b.dark ? "bg-slate-700" : "bg-stone-200"))} />
                    ))}
                  </span>
                </span>
                <span className="text-xs font-semibold text-mist-100">{b.name}</span>
              </button>
            );
          })}
        </div>

        {/* BOARD PICTURES from the admin's saved library. These are the boards
            the admin sells: a free one anybody can use, a priced one shows its
            price until it's bought. Choosing one replaces the playing surface
            for THIS player only; "Default" hands it back to the admin's board. */}
        {boardCatalog.filter((bd) => bd.enabled && bd.image).length > 0 && (
          <>
            <h3 className="mb-2 mt-5 text-xs font-semibold uppercase tracking-wide text-mist-400">Board pictures</h3>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              <button
                onClick={() => setMyBoardImage("")}
                className={cn(
                  "flex flex-col items-center gap-2 rounded-xl border bg-ink-850 p-3 transition",
                  !myBoardImage ? "border-lotus-400 ring-1 ring-lotus-400/50" : "border-line hover:border-lotus-400/40",
                )}
              >
                <span className="grid size-16 place-items-center rounded-lg border border-dashed border-line text-[10px] text-mist-500">Default</span>
                <span className="text-xs font-semibold text-mist-100">App board</span>
              </button>
              {boardCatalog.filter((bd) => bd.enabled && bd.image).map((bd) => {
                const locked = bd.price > 0 && !ownsDesign("board", bd.id);
                const picked = myBoardImage === bd.id;
                return (
                  <button
                    key={bd.id}
                    onClick={() => { if (locked) { void buyDesign("board", bd.id); return; } setMyBoardImage(bd.id); }}
                    disabled={buying === bd.id}
                    title={locked ? `Buy this board for ${bd.price} coins` : bd.name}
                    className={cn(
                      "relative flex flex-col items-center gap-2 rounded-xl border bg-ink-850 p-3 transition",
                      picked && !locked ? "border-lotus-400 ring-1 ring-lotus-400/50" : "border-line hover:border-lotus-400/40",
                    )}
                  >
                    {picked && !locked && (
                      <span className="absolute right-2 top-2 z-10 grid size-5 place-items-center rounded-full bg-lotus-500 text-white"><Check className="size-3.5" /></span>
                    )}
                    {locked && (
                      <span className="absolute right-1.5 top-1.5 z-10 inline-flex items-center gap-1 rounded-full bg-amber-500 px-1.5 py-0.5 text-[10px] font-bold text-white shadow">
                        <Lock className="size-3" /> {bd.price.toLocaleString("en-SA")}
                      </span>
                    )}
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={withBase(bd.image!)} alt="" className={cn("size-16 rounded-lg object-contain", locked && "opacity-70")} />
                    <span className="w-full truncate text-xs font-semibold text-mist-100">{bd.name}</span>
                  </button>
                );
              })}
            </div>
          </>
        )}
      </section>
      )}

      {/* COMPLETE DICE (Admin → Dice Models) — the ones that are actually sold.
          A dice with a price shows a padlock and its cost; tapping it buys it and
          puts it straight to use. "App dice" hands you back the one the admin has
          set for everybody. */}
      {tab === "dice" && (
      <section className="mb-7">
        <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-mist-200">
          <Dices className="size-4 text-gold-300" /> Your dice
        </h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <button
            onClick={() => setMyDiceModel("")}
            className={cn(
              "flex flex-col items-center gap-2 rounded-xl border bg-ink-850 p-4 transition",
              !myDiceModel ? "border-lotus-400 ring-1 ring-lotus-400/50" : "border-line hover:border-lotus-400/40",
            )}
          >
            <span className="grid size-14 place-items-center rounded-lg border border-dashed border-line text-[10px] text-mist-500">Default</span>
            <span className="text-xs font-semibold text-mist-100">App dice</span>
          </button>
          {diceModels.filter((m) => m.enabled !== false).map((m) => {
            const price = Math.max(0, Math.floor(m.priceCoins ?? 0));
            const locked = price > 0 && !ownsDesign("dice", m.id);
            const picked = myDiceModel === m.id;
            return (
              <button
                key={m.id}
                onClick={() => { if (locked) { void buyDesign("dice", m.id); return; } setMyDiceModel(m.id); }}
                disabled={buying === m.id}
                title={locked ? `Buy this dice for ${price} coins` : m.name}
                className={cn(
                  "relative flex flex-col items-center gap-2 rounded-xl border bg-ink-850 p-4 transition",
                  picked && !locked ? "border-lotus-400 ring-1 ring-lotus-400/50" : "border-line hover:border-lotus-400/40",
                  locked && "border-gold-400/40",
                )}
              >
                {picked && !locked && (
                  <span className="absolute right-2 top-2 grid size-5 place-items-center rounded-full bg-lotus-500 text-white"><Check className="size-3.5" /></span>
                )}
                {locked && (
                  <span className="absolute right-2 top-2 grid size-5 place-items-center rounded-full bg-gold-400 text-amber-950"><Lock className="size-3" /></span>
                )}
                <Die face={5} model={m} className={cn("size-14", locked && "opacity-60")} />
                <span className="w-full truncate text-xs font-semibold text-mist-100">{m.name}</span>
                {locked ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-gold-500/15 px-2 py-0.5 text-[11px] font-bold text-gold-200">
                    {buying === m.id ? "Buying…" : <>{price.toLocaleString("en-SA")} coins</>}
                  </span>
                ) : price > 0 ? (
                  <span className="text-[10px] font-semibold uppercase tracking-wide text-emerald-300">Owned</span>
                ) : null}
              </button>
            );
          })}
        </div>
      </section>
      )}

      {/* Dice face styles — how the drawn die LOOKS. Not sold; free to everyone. */}
      {tab === "dice" && (
      <section className="mb-7">
        <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-mist-200">
          <Dices className="size-4 text-petal-400" /> Dice face style
        </h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {/* The admin DICE LIBRARY, not the hard-coded skins: renamed, reordered,
              disabled or uploaded dice all appear here automatically. */}
          {enabledDiceDesigns(config.diceDesigns).map((s) => {
            const active = s.id === dice;
            // PAID DICE: the admin can put a coin price on any non-Free dice.
            // Until it's bought it shows the price and can't be equipped — the
            // server enforces the same rule, this is just the honest UI for it.
            const price = dicePriceOf(s);
            const owned = canUseDice(s, ownedDice, isAdmin);
            const locked = price > 0 && !owned;
            return (
              <button
                key={s.id}
                // A dice id can now be an admin-added one ("dice-xxxx"), not just a
                // built-in skin id, so the stored preference is a plain string.
                onClick={() => (locked ? buyDice(s.id, s.name, price) : setDice(s.id as Parameters<typeof setDice>[0]))}
                disabled={buying === s.id}
                className={cn(
                  "relative flex flex-col items-center gap-2 rounded-xl border bg-ink-850 p-4 transition",
                  active ? "border-lotus-400 ring-1 ring-lotus-400/50" : "border-line hover:border-lotus-400/40",
                  locked && "border-gold-400/40",
                )}
              >
                {active && (
                  <span className="absolute right-2 top-2 grid size-5 place-items-center rounded-full bg-lotus-500 text-white">
                    <Check className="size-3.5" />
                  </span>
                )}
                {locked && (
                  <span className="absolute right-2 top-2 grid size-5 place-items-center rounded-full bg-gold-400 text-amber-950">
                    <Lock className="size-3" />
                  </span>
                )}
                <Die face={5} surface={s.surface} pipClass={s.pip} faceImage={s.image} className={cn("size-14", locked && "opacity-60")} />
                <span className="text-xs font-semibold text-mist-100">{s.name}</span>
                {locked ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-gold-500/15 px-2 py-0.5 text-[11px] font-bold text-gold-200">
                    {buying === s.id ? "Buying…" : <>{price.toLocaleString("en-SA")} coins</>}
                  </span>
                ) : price > 0 ? (
                  <span className="text-[10px] font-semibold uppercase tracking-wide text-emerald-300">Owned</span>
                ) : null}
              </button>
            );
          })}
        </div>
      </section>
      )}

      {/* Token skins */}
      {tab === "tokens" && (
      <section>
        <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-mist-200">
          <CircleDot className="size-4 text-lotus-300" /> Tokens
        </h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {tokenDesigns.map((s) => {
            const active = s.id === token;
            const tPrice = priceOf("token", s.id);
            const locked = tPrice > 0 && !ownsDesign("token", s.id);
            return (
              <button
                key={s.id}
                onClick={() => wearToken(s.id)}
                disabled={buying === s.id}
                title={locked ? `Buy this token for ${tPrice} coins` : undefined}
                className={cn(
                  "relative flex flex-col items-center gap-2 rounded-xl border bg-ink-850 p-4 transition",
                  active ? "border-lotus-400 ring-1 ring-lotus-400/50" : "border-line hover:border-lotus-400/40",
                  locked && "opacity-90",
                )}
              >
                {active && !locked && (
                  <span className="absolute right-2 top-2 grid size-5 place-items-center rounded-full bg-lotus-500 text-white">
                    <Check className="size-3.5" />
                  </span>
                )}
                {locked && (
                  <span className="absolute right-1.5 top-1.5 z-10 inline-flex items-center gap-1 rounded-full bg-amber-500 px-1.5 py-0.5 text-[10px] font-bold text-white shadow">
                    <Lock className="size-3" /> {tPrice.toLocaleString("en-SA")}
                  </span>
                )}
                {s.category && s.category !== "Free" && (
                  <span className="absolute left-2 top-2 rounded-full bg-amber-400/90 px-1.5 py-0.5 text-[9px] font-black uppercase tracking-wide text-ink-900">{s.category}</span>
                )}
                <span className="block size-12">
                  <LudoToken color="red" skin={s.builtin ?? s.id} image={s.image} />
                </span>
                <span className="text-xs font-semibold text-mist-100">{s.name}</span>
              </button>
            );
          })}
        </div>
      </section>
      )}

      <section className="mt-8">
        <h2 className="mb-1 flex items-center gap-2 text-sm font-semibold text-mist-200">
          <LayoutGrid className="size-4 text-lotus-300" /> Turn indicator position
        </h2>
        <p className="mb-3 text-xs text-mist-400">
          Pick which bottom corner the “whose turn” badge floats in during a game — so you can play
          comfortably with one hand. This is your personal choice; other players are unaffected. (You
          can also tap the ⇄ button on the badge mid-game.)
        </p>
        <div className="grid grid-cols-2 gap-3">
          {([
            { id: "left" as const, name: "Bottom-left", Icon: AlignHorizontalJustifyStart },
            { id: "right" as const, name: "Bottom-right", Icon: AlignHorizontalJustifyEnd },
          ]).map(({ id, name, Icon }) => {
            const active = turnSide === id;
            return (
              <button
                key={id}
                onClick={() => setTurnSide(id)}
                className={cn(
                  "relative flex flex-col items-center gap-2 rounded-xl border bg-ink-850 p-4 transition",
                  active ? "border-lotus-400 ring-1 ring-lotus-400/50" : "border-line hover:border-lotus-400/40",
                )}
              >
                {active && (
                  <span className="absolute right-2 top-2 grid size-5 place-items-center rounded-full bg-lotus-500 text-white">
                    <Check className="size-3.5" />
                  </span>
                )}
                {/* mini phone mock-up showing where the badge sits */}
                <span className="relative block h-16 w-10 rounded-md border border-white/15 bg-ink-800">
                  <span className={cn("absolute bottom-1 grid h-3 place-items-center rounded-full bg-lotus-500 px-1 text-[6px] font-bold text-white", id === "left" ? "left-1" : "right-1")}>turn</span>
                </span>
                <span className="flex items-center gap-1.5 text-xs font-semibold text-mist-100"><Icon className="size-3.5 text-lotus-300" /> {name}</span>
              </button>
            );
          })}
        </div>
      </section>

      {/* Avatar FRAME shop — buy with coins, wear on the profile photo. */}
      {tab === "frames" && <FramesShop />}

      <p className="mt-6 flex items-center justify-center gap-1.5 text-xs text-mist-400">
        <Sparkles className="size-3.5 text-gold-300" /> More themed skins arrive as the platform grows.
      </p>

      {/* Sticky save/back bar */}
      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-white/10 bg-ink-900/90 backdrop-blur lg:left-64">
        <div className="mx-auto flex max-w-3xl items-center justify-end gap-3 px-4 py-3">
          <Button variant="secondary" onClick={goBack}>
            <ArrowLeft className="size-4" /> Back
          </Button>
          <Button
            onClick={() => {
              toast("Your board, dice & token style is saved 🎲", "success");
              goBack();
            }}
          >
            <Check className="size-4" /> Save &amp; Done
          </Button>
        </div>
      </div>
    </div>
  );
}

// ---- Profile FRAME STORE — admin catalog (config.avatarFrames), bought with
// coins, worn around the profile photo so EVERYONE sees it. Frames can be
// timed (auto-expire) or permanent; expired frames can be repurchased. ----
function FramesShop() {
  const { user, updateUser, refresh } = useAuth();
  const { config } = useConfig();
  const { toast } = useToast();
  const [busy, setBusy] = useState("");
  const [catFilter, setCatFilter] = useState("all");
  const [confirmBuy, setConfirmBuy] = useState<AvatarFrame | null>(null);
  const frames = storeFrames(config);
  if (!user || frames.length === 0) return null;
  const equipped = user.equippedFrame ?? "";
  const categories = [...new Set(frames.map((f) => f.category || "Normal"))];
  const shown = frames.filter((f) => catFilter === "all" || (f.category || "Normal") === catFilter);

  const buy = async (f: AvatarFrame) => {
    setConfirmBuy(null);
    setBusy(f.id);
    const res = await buyFrame(f.id);
    setBusy("");
    if (res.ok) {
      updateUser({
        ownedFrameIds: res.owned,
        equippedFrame: f.id,
        frames: { ...(user.frames ?? {}), [f.id]: { at: new Date().toISOString(), expiresAt: res.expiresAt ?? null } },
        ...(typeof res.balance === "number" ? { coins: res.balance } : {}),
      });
      void refresh(); // pull the server truth too, so every screen agrees instantly
      const until = res.expiresAt ? ` — valid until ${new Date(res.expiresAt).toLocaleDateString("en-SA", { day: "numeric", month: "short" })}` : "";
      toast(f.price > 0 ? `"${f.name}" is yours${until} — equipped! It's in My Collection now. (−${f.price} coins)` : `"${f.name}" equipped${until}!`, "success");
    } else toast(res.error ?? "Could not buy the frame", "error");
  };
  const wear = async (id: string) => {
    setBusy(id || "none");
    const res = await equipFrame(id);
    setBusy("");
    if (res.ok) { updateUser({ equippedFrame: id }); toast(id ? "Frame equipped ✓" : "Frame removed", "success"); }
    else toast(res.error ?? "Could not equip", "error");
  };

  return (
    <section className="mt-8">
      <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
        <div>
          <h2 className="font-display text-lg font-bold text-mist-100">Profile Frame Store</h2>
          <p className="text-sm text-mist-400">Buy a frame with coins and wear it around your profile photo — everyone sees it. Timed frames expire automatically and can be repurchased.</p>
        </div>
        <span className="inline-flex items-center gap-1.5 rounded-full bg-gold-500/10 px-3 py-1 text-sm font-bold text-gold-300">🪙 {(user.coins ?? 0).toLocaleString("en-SA")}</span>
      </div>
      {categories.length > 1 && (
        <div className="mb-3 flex flex-wrap gap-1.5">
          <button onClick={() => setCatFilter("all")} className={cn("rounded-full px-3 py-1 text-xs font-semibold transition", catFilter === "all" ? "bg-lotus-600 text-white" : "border border-line bg-ink-850 text-mist-400 hover:text-mist-100")}>All</button>
          {categories.map((c) => (
            <button key={c} onClick={() => setCatFilter(c)} className={cn("rounded-full px-3 py-1 text-xs font-semibold transition", catFilter === c ? "bg-lotus-600 text-white" : "border border-line bg-ink-850 text-mist-400 hover:text-mist-100")}>{c}</button>
          ))}
        </div>
      )}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {/* No frame */}
        <button
          onClick={() => wear("")}
          disabled={busy === "none"}
          className={cn("flex flex-col items-center gap-2 rounded-xl border bg-ink-850 p-4 transition", equipped === "" ? "border-lotus-400 ring-1 ring-lotus-400/50" : "border-line hover:border-lotus-400/40")}
        >
          <Avatar name={user.fullName} src={user.avatar} size="xl" />
          <span className="text-xs font-semibold text-mist-100">No frame</span>
          {equipped === "" && <span className="rounded-full bg-lotus-500/15 px-2 py-0.5 text-[10px] font-bold text-lotus-300">Wearing</span>}
        </button>
        {shown.map((f) => {
          const st = myFrameState(user, f.id);
          const isWearing = equipped === f.id && st.owned;
          return (
            <div key={f.id} className={cn("relative flex flex-col items-center gap-1.5 rounded-xl border bg-ink-850 p-4 transition", isWearing ? "border-lotus-400 ring-1 ring-lotus-400/50" : "border-line")}>
              {f.badge && <span className="absolute left-2 top-2 rounded-full bg-gold-500/20 px-2 py-0.5 text-[9px] font-extrabold uppercase tracking-wide text-gold-300">{f.badge}</span>}
              <Avatar name={user.fullName} src={user.avatar} size="xl" frameImage={withBase(f.image)} />
              <span className="text-xs font-semibold text-mist-100">{f.name}</span>
              {f.description && <span className="text-center text-[10px] leading-tight text-mist-500">{f.description}</span>}
              <span className="flex flex-wrap items-center justify-center gap-1 text-[10px] text-mist-500">
                <span className="rounded-full bg-white/[0.06] px-1.5 py-0.5">{f.category || "Normal"}</span>
                <span className="rounded-full bg-white/[0.06] px-1.5 py-0.5">{validityLabel(f)}</span>
              </span>
              {st.owned && st.expiresAt && (
                <span className="text-[10px] font-semibold text-amber-300" title={`Expires ${new Date(st.expiresAt).toLocaleString("en-SA")}`}>⏳ {st.label}</span>
              )}
              {isWearing ? (
                <span className="rounded-full bg-lotus-500/15 px-2 py-0.5 text-[10px] font-bold text-lotus-300">Wearing ✓</span>
              ) : st.owned ? (
                <Button size="sm" variant="secondary" onClick={() => wear(f.id)} disabled={busy === f.id}>Wear</Button>
              ) : (
                <Button size="sm" onClick={() => (f.price > 0 ? setConfirmBuy(f) : void buy(f))} disabled={busy === f.id}>
                  {busy === f.id ? "Buying…" : st.expired ? `Repurchase · 🪙 ${f.price.toLocaleString("en-SA")}` : f.price > 0 ? `Buy · 🪙 ${f.price.toLocaleString("en-SA")}` : "Get free"}
                </Button>
              )}
              {st.expired && !st.owned && <span className="text-[10px] text-rose-300">Expired</span>}
              {!st.owned && f.price > 0 && (user.coins ?? 0) < f.price && (
                <span className="text-[10px] text-rose-300">Not enough coins</span>
              )}
            </div>
          );
        })}
      </div>

      {/* Purchase confirmation — coins are only deducted after this. */}
      {confirmBuy && (
        <div className="fixed inset-0 z-[130] grid place-items-center bg-black/70 p-4" onClick={() => setConfirmBuy(null)}>
          <div className="w-full max-w-xs rounded-2xl border border-white/10 bg-ink-900 p-5 text-center" onClick={(e) => e.stopPropagation()}>
            <Avatar name={user.fullName} src={user.avatar} size="xl" frameImage={withBase(confirmBuy.image)} className="mx-auto" />
            <p className="mt-3 text-sm font-bold text-mist-100">Buy “{confirmBuy.name}”?</p>
            <p className="mt-1 text-xs text-mist-400">
              🪙 {confirmBuy.price.toLocaleString("en-SA")} coins · {validityLabel(confirmBuy)}
              {Math.max(0, Math.floor(confirmBuy.validityDays ?? 0)) > 0 && " — it expires automatically and can be repurchased."}
            </p>
            <div className="mt-4 flex justify-center gap-2">
              <Button variant="secondary" size="sm" onClick={() => setConfirmBuy(null)}>Cancel</Button>
              <Button size="sm" onClick={() => void buy(confirmBuy)}>Confirm — buy now</Button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
