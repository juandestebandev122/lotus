"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Avatar } from "@/components/ui/Avatar";
import { useToast } from "@/components/ui/Toast";
import { useAuth } from "@/lib/auth";
import { useConfig } from "@/lib/config";
import { withBase } from "@/lib/base-path";
import { cn } from "@/lib/cn";
import { frameImageOf } from "@/lib/frames";
import {
  storeItemsOf, myStoreState, buyStoreItem, equipStore, sendStoreRequest, cancelStoreRequest, effectiveStorePrice,
  NAME_EFFECTS, type StoreItem, type StoreKind,
} from "@/lib/store";
import { fileToDataUrl } from "@/lib/image";
import { fetchMyAgency } from "@/lib/agency";
import {
  shopItems, buyCosmetic, fetchOwnedCosmetics, NO_COSMETICS, ownedLabel,
  validityLabel as gameValidityLabel,
  type CosmeticKind, type OwnedCosmetics, type ShopItem,
} from "@/lib/cosmetic-shop";
import { ArrowLeft, ShoppingBag, Sparkles, Image as ImageIcon, Award, Type, Send, Package, Layers, Paperclip, X, Clock, Check, CheckCheck, Ban, Dices, LayoutGrid, CircleDot } from "lucide-react";

// Grouped request types the user can ask the admin for (kind is a free string on the
// backend, so adding options here needs no backend change).
const REQUEST_GROUPS: { group: string; options: { v: string; label: string }[] }[] = [
  { group: "Profile", options: [{ v: "frame", label: "Profile Frame" }, { v: "profileTheme", label: "Profile Theme" }, { v: "badge", label: "Badge" }, { v: "nameStyle", label: "Username Style" }, { v: "nameEffect", label: "Name Effect / Colour" }, { v: "verifyBadge", label: "Verification Badge" }] },
  { group: "Overlay & Effects", options: [{ v: "overlay", label: "Overlay" }, { v: "entryAnim", label: "Entry Animation" }, { v: "exitAnim", label: "Exit Animation" }, { v: "profileAnim", label: "Profile Animation" }, { v: "roomJoinFx", label: "Room Join Effect" }, { v: "voiceFx", label: "Voice Effect" }] },
  { group: "Chat", options: [{ v: "chatBubble", label: "Chat Bubble" }, { v: "chatBg", label: "Chat Background" }, { v: "chatFont", label: "Chat Font Style" }, { v: "emojiPack", label: "Emoji Pack" }, { v: "stickerPack", label: "Sticker Pack" }, { v: "gifPack", label: "GIF Pack" }] },
  { group: "Gifts", options: [{ v: "gift", label: "New Gift" }, { v: "animatedGift", label: "Animated Gift" }, { v: "festivalGift", label: "Festival Gift" }, { v: "customGift", label: "Custom Gift" }, { v: "luxuryGift", label: "Luxury Gift" }] },
  { group: "Room", options: [{ v: "roomTheme", label: "Room Theme" }, { v: "roomBg", label: "Room Background" }, { v: "roomDecor", label: "Room Decoration" }, { v: "roomBanner", label: "Room Banner" }, { v: "roomMusic", label: "Room Music" }, { v: "roomAnim", label: "Room Animation" }] },
  { group: "Group / Agency", options: [{ v: "groupTheme", label: "Group Theme" }, { v: "groupBanner", label: "Group Banner" }, { v: "agencyBadge", label: "Agency Badge" }, { v: "agencyTheme", label: "Agency Theme" }, { v: "agencyOverlay", label: "Agency Overlay" }] },
  { group: "VIP & Coins", options: [{ v: "vip", label: "VIP Membership" }, { v: "vipBadge", label: "VIP Badge" }, { v: "coinPackage", label: "Coin Package" }, { v: "discountOffer", label: "Discount / Offer" }, { v: "coupon", label: "Coupon Code" }] },
  { group: "Events", options: [{ v: "birthdayTheme", label: "Birthday Theme" }, { v: "festivalTheme", label: "Festival Theme" }, { v: "tournamentTheme", label: "Tournament Theme" }, { v: "eventTheme", label: "Special Event Theme" }] },
  { group: "Store & Custom", options: [{ v: "storeItem", label: "New Store Item" }, { v: "limitedItem", label: "Limited Edition Item" }, { v: "exclusiveItem", label: "Exclusive Item" }, { v: "background", label: "Profile Background" }, { v: "sticker", label: "Sticker" }, { v: "other", label: "Something else" }] },
];
const REQUEST_LABEL: Record<string, string> = Object.fromEntries(REQUEST_GROUPS.flatMap((g) => g.options.map((o) => [o.v, o.label])));
const REQ_STATUS: Record<string, { label: string; tone: string; icon: typeof Clock }> = {
  pending: { label: "Pending", tone: "bg-amber-500/15 text-amber-300", icon: Clock },
  approved: { label: "Approved", tone: "bg-emerald-500/15 text-emerald-300", icon: Check },
  completed: { label: "Ready", tone: "bg-sky-500/15 text-sky-300", icon: CheckCheck },
  rejected: { label: "Rejected", tone: "bg-rose-500/15 text-rose-300", icon: X },
  cancelled: { label: "Cancelled", tone: "bg-white/[0.08] text-mist-400", icon: Ban },
};

const KIND_META: { kind: StoreKind; icon: typeof ImageIcon; title: string; blurb: string }[] = [
  { kind: "overlay", icon: Layers, title: "Overlays", blurb: "Decorative overlays for your profile — buy with coins, yours until they expire." },
  { kind: "background", icon: ImageIcon, title: "Profile Backgrounds", blurb: "A custom picture behind your profile header — everyone sees it." },
  { kind: "nameEffect", icon: Type, title: "Name Effects", blurb: "Your name in gold, rainbow, neon and more, on your profile." },
  { kind: "badge", icon: Award, title: "Badges", blurb: "A special badge next to your name." },
];

// GAME ITEMS — dice, boards and tokens. These come straight from the admin's own
// design pages: the moment a design there is given a coin price it appears here,
// with nothing else to set up. Buying one is permanent and it can be used in the
// game immediately.
const GAME_META: { kind: CosmeticKind; icon: typeof ImageIcon; title: string; blurb: string }[] = [
  { kind: "dice", icon: Dices, title: "Dice", blurb: "Your own dice design — every player at the table sees it when you roll." },
  { kind: "board", icon: LayoutGrid, title: "Game Boards", blurb: "Change the whole look of the Ludo board when you play." },
  { kind: "token", icon: CircleDot, title: "Tokens", blurb: "Your playing pieces — everyone on the board sees your token design." },
];

const validityLabel = (i: StoreItem) => {
  const d = Math.max(0, Math.floor(i.validityDays ?? 0));
  return d === 0 ? "Permanent" : `${d} day${d === 1 ? "" : "s"}`;
};
type GameFilter = "frame" | CosmeticKind | "profile";

export default function StorePage() {
  const { user, updateUser, refresh } = useAuth();
  const { config } = useConfig();
  const { toast } = useToast();
  const router = useRouter();
  const [busy, setBusy] = useState("");
  const [confirmBuy, setConfirmBuy] = useState<StoreItem | null>(null);
  const [gameFilter, setGameFilter] = useState<GameFilter>("frame");
  // Admin-managed store categories (config.categories, scope "store") + the member's filter.
  const [catFilter, setCatFilter] = useState("all");
  const storeCats = ((config.categories ?? []) as { name: string; scope: string; enabled?: boolean; order?: number }[])
    .filter((c) => c.scope === "store" && c.enabled !== false).sort((a, b) => (a.order ?? 0) - (b.order ?? 0)).map((c) => c.name);

  // Request-an-item form
  const [reqKind, setReqKind] = useState("frame");
  const [reqText, setReqText] = useState("");
  const [reqImage, setReqImage] = useState("");
  const [reqBusy, setReqBusy] = useState(false);
  const [showAllReq, setShowAllReq] = useState(false);
  const [myRequests, setMyRequests] = useState<{ id: string; kind: string; text: string; image?: string; status: string; at: string; decidedBy?: string; note?: string }[]>([]);
  const loadRequests = () =>
    fetch(withBase("/api/store/requests"), { credentials: "include", cache: "no-store" })
      .then((r) => r.json()).then((d) => setMyRequests(d.requests ?? [])).catch(() => {});
  useEffect(() => { void loadRequests(); }, []);

  // Audience restrictions (agency / selected users / gender) + how they behave (hide vs
  // show). "restrictMode: show" = everyone SEES the item but only eligible users can BUY it.
  const [myAgencyId, setMyAgencyId] = useState<string>("");
  useEffect(() => { fetchMyAgency().then((a) => setMyAgencyId(a?.id ?? "")).catch(() => {}); }, []);
  // Does the current user meet an item's audience restriction (agency / users / gender)?
  const audienceOk = (it: StoreItem) => {
    if (user?.role === "admin") return true;
    if (it.agencyIds?.length && !(myAgencyId && it.agencyIds.includes(myAgencyId))) return false;
    if (it.userIds?.length && !(user && it.userIds.includes(user.id))) return false;
    if (it.gender && user?.gender !== it.gender) return false;
    return true;
  };
  const visibleToMe = (it: StoreItem) => audienceOk(it) || it.restrictMode === "show";
  const restrictLabel = (it: StoreItem) => (it.userIds?.length ? "Invited members only" : it.agencyIds?.length ? "Agency members only" : it.gender ? "Not available for you" : "Restricted");
  // The price this user actually pays — sale window, then VIP-free, then a first-purchase
  // discount (only on an item they don't already own). The card button AND the confirm
  // modal both read this, so the two can never disagree (matches the server in repo.ts).
  const priceFor = (it: StoreItem) => {
    const base = effectiveStorePrice(it);
    const st = myStoreState(user, it.id);
    const vipFree = !!it.freeForVip && !!user?.vip;
    const firstPct = it.firstBuyDiscountPct && it.firstBuyDiscountPct > 0 && !st.owned && !st.expired ? it.firstBuyDiscountPct : 0;
    const price = vipFree ? 0 : firstPct ? Math.max(0, Math.floor(base.price * (1 - firstPct / 100))) : base.price;
    return { base, price, onSale: base.onSale, vipFree, firstPct };
  };

  if (!user) return null;
  const equipped = user.equipped ?? {};

  const buy = async (item: StoreItem) => {
    setConfirmBuy(null);
    setBusy(item.id);
    const res = await buyStoreItem(item.id);
    setBusy("");
    if (res.ok) {
      updateUser({
        storeOwned: { ...(user.storeOwned ?? {}), [item.id]: { at: new Date().toISOString(), expiresAt: res.expiresAt ?? null } },
        equipped: { ...(user.equipped ?? {}), [item.kind]: item.id },
        ...(typeof res.balance === "number" ? { coins: res.balance } : {}),
      });
      void refresh(); // server truth everywhere, instantly
      const until = res.expiresAt ? ` — valid until ${new Date(res.expiresAt).toLocaleDateString("en-SA", { day: "numeric", month: "short" })}` : "";
      toast(`"${item.name}" is yours${until} — equipped!`, "success");
    } else toast(res.error ?? "Could not buy the item", "error");
  };

  // GAME ITEMS — what I already own, and buying one.
  const [ownedCosmetics, setOwnedCosmetics] = useState<OwnedCosmetics>(NO_COSMETICS);
  useEffect(() => { void fetchOwnedCosmetics().then(setOwnedCosmetics); }, []);
  const buyGameItem = async (kind: CosmeticKind, it: ShopItem) => {
    if (busy) return;
    if (!window.confirm(`Buy “${it.name}” for ${it.price.toLocaleString("en-SA")} coins?`)) return;
    setBusy(`${kind}:${it.id}`);
    const res = await buyCosmetic(kind, it.id);
    setBusy("");
    if (res.ok) {
      if (res.owned) setOwnedCosmetics(res.owned);
      if (typeof res.balance === "number") updateUser({ coins: res.balance });
      toast(`“${it.name}” is yours — open Customize your style to use it.`, "success");
    } else toast(res.error ?? "Could not complete the purchase", "error");
  };

  const wear = async (kind: StoreKind, id: string) => {
    setBusy(id || `none-${kind}`);
    const res = await equipStore(kind, id);
    setBusy("");
    if (res.ok) { updateUser({ equipped: { ...(user.equipped ?? {}), [kind]: id } }); toast(id ? "Equipped ✓" : "Removed", "success"); }
    else toast(res.error ?? "Could not equip", "error");
  };

  const submitRequest = async () => {
    if (!reqText.trim()) { toast("Describe what you'd like", "error"); return; }
    setReqBusy(true);
    const res = await sendStoreRequest(reqKind, reqText, reqImage || undefined);
    setReqBusy(false);
    if (res.ok) { setReqText(""); setReqImage(""); toast("Request sent to the admin 📨", "success"); loadRequests(); }
    else toast(res.error ?? "Could not send", "error");
  };
  const pickReqImage = async (f?: File) => {
    if (!f) return;
    if (f.size > 2_400_000) { toast("Image too large (max ~2 MB)", "error"); return; }
    try { setReqImage(await fileToDataUrl(f, 1024)); } catch { toast("Could not read that image", "error"); }
  };
  const cancelRequest = async (id: string) => {
    const res = await cancelStoreRequest(id);
    if (res.ok) { toast("Request cancelled", "info"); loadRequests(); }
    else toast(res.error ?? "Could not cancel", "error");
  };

  // Preview per kind, on MY real profile identity.
  const preview = (item: StoreItem) => {
    if (item.kind === "background") {
      return (
        <div className="relative h-20 w-full overflow-hidden rounded-lg border border-line">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          {item.image && <img src={withBase(item.image)} alt="" className="absolute inset-0 size-full object-cover" />}
          <div className="absolute inset-0 bg-black/25" />
          <div className="absolute bottom-1.5 left-1.5 flex items-center gap-1.5">
            <Avatar name={user.fullName} src={user.avatar} size="xs" />
            <span className="text-[11px] font-bold text-white drop-shadow">{user.fullName}</span>
          </div>
        </div>
      );
    }
    if (item.kind === "nameEffect") {
      const css = item.style ? NAME_EFFECTS[item.style]?.css : undefined;
      return (
        <div className="grid h-20 w-full place-items-center rounded-lg border border-line bg-ink-900">
          <span className="text-lg" style={css}>{user.fullName}</span>
        </div>
      );
    }
    if (item.kind === "overlay") {
      return (
        <div className="relative grid h-20 w-full place-items-center overflow-hidden rounded-lg border border-line bg-ink-900">
          <Avatar name={user.fullName} src={user.avatar} size="md" />
          {/* eslint-disable-next-line @next/next/no-img-element */}
          {item.image && <img src={withBase(item.image)} alt="" className="pointer-events-none absolute inset-0 size-full object-contain" />}
        </div>
      );
    }
    return (
      <div className="flex h-20 w-full items-center justify-center gap-2 rounded-lg border border-line bg-ink-900">
        <span className="text-sm font-bold text-mist-100">{user.fullName}</span>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        {item.image && <img src={withBase(item.image)} alt="" className="size-8 object-contain" />}
      </div>
    );
  };

  // My Collection: everything I own across kinds (incl. frames).
  const ownedItems = ((config.storeItems ?? []) as StoreItem[]).filter((i) => myStoreState(user, i.id).owned);
  // Items I bought that have EXPIRED — shown with a "Buy again" button.
  const expiredItems = ((config.storeItems ?? []) as StoreItem[]).filter((i) => myStoreState(user, i.id).expired && !i.archived);
  const ownedFrames = (config.avatarFrames ?? []).filter((f) => (user.frames?.[f.id] && myStoreState({ storeOwned: user.frames }, f.id).owned) || (user.ownedFrameIds ?? []).includes(f.id));

  return (
    <div className="mx-auto max-w-3xl space-y-6 pb-24">
      <button onClick={() => (window.history.length > 1 ? router.back() : router.push("/profile"))} className="inline-flex items-center gap-2 text-sm text-mist-300 hover:text-mist-100">
        <ArrowLeft className="size-4" /> Back
      </button>

      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 font-display text-2xl font-extrabold text-mist-100 sm:text-3xl">
            <ShoppingBag className="size-7 text-lotus-300" /> Store
          </h1>
          <p className="mt-1 text-sm text-mist-300">Premium items for your profile — buy with coins, equip instantly, change anytime.</p>
        </div>
        <span className="inline-flex items-center gap-1.5 rounded-full bg-gold-500/10 px-3.5 py-1.5 text-sm font-bold text-gold-300">🪙 {(user.coins ?? 0).toLocaleString("en-SA")}</span>
      </div>

      <div className="inline-flex flex-wrap items-center gap-1 rounded-xl border border-line bg-ink-900/50 p-1">
        {([
          { id: "frame", label: "Frames" },
          { id: "dice", label: "Dice" },
          { id: "board", label: "Boards" },
          { id: "token", label: "Tokens" },
          { id: "profile", label: "Profile Items" },
        ] as const).map((g) => (
          <button
            key={g.id}
            onClick={() => setGameFilter(g.id)}
            className={cn(
              "rounded-lg px-3.5 py-1.5 text-sm font-semibold transition",
              gameFilter === g.id ? "bg-lotus-600 text-white" : "text-mist-300 hover:bg-white/[0.06] hover:text-mist-100",
            )}
          >
            {g.label}
          </button>
        ))}
      </div>

      {/* Profile frames live in their own section (full store) */}
      {gameFilter === "frame" && (
      <Link href="/customize" className="flex items-center gap-3 rounded-2xl border border-lotus-400/25 bg-lotus-500/[0.06] p-4 transition hover:bg-lotus-500/10">
        <Avatar name={user.fullName} src={user.avatar} size="lg" frameImage={frameImageOf(config, user.equippedFrame)} />
        <div className="min-w-0 flex-1">
          <p className="font-display text-base font-bold text-mist-100">Profile Frames</p>
          <p className="text-xs text-mist-400">Frames around your photo — shown everywhere. Open the frame store →</p>
        </div>
        <Sparkles className="size-5 shrink-0 text-lotus-300" />
      </Link>
      )}

      {/* Category filter (admin-managed) */}
      {storeCats.length > 0 && gameFilter === "profile" && (
        <div className="flex gap-2 overflow-x-auto pb-1">
          {["all", ...storeCats].map((c) => (
            <button key={c} onClick={() => setCatFilter(c)}
              className={cn("shrink-0 rounded-full px-3.5 py-1.5 text-sm font-semibold transition", catFilter === c ? "bg-lotus-600 text-white" : "bg-ink-800 text-mist-300 hover:text-mist-100")}>
              {c === "all" ? "All" : c}
            </button>
          ))}
        </div>
      )}

      {/* The three item sections */}
      {/* GAME ITEMS — dice, boards and tokens. Straight from the admin's own
          design pages: a design given a coin price appears here by itself.
          Buying one is permanent and it can be used in the game right away. */}
      {GAME_META.map(({ kind, icon: Icon, title, blurb }) => {
        if (gameFilter !== kind) return null;
        const items = shopItems(config, kind);
        if (items.length === 0) return null;
        return (
          <section key={`game-${kind}`} id={`store-${kind}`}>
            <div className="mb-2">
              <h2 className="flex items-center gap-2 font-display text-lg font-bold text-mist-100"><Icon className="size-5 text-lotus-300" /> {title}</h2>
              <p className="text-xs text-mist-400">{blurb}</p>
            </div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {items.map((it) => {
                const mine = ownedCosmetics[kind].includes(it.id);
                return (
                  <Card key={it.id} className={cn("space-y-2 p-3", mine && "ring-1 ring-emerald-400/50")}>
                    <div className="grid h-20 w-full place-items-center overflow-hidden rounded-lg border border-line bg-ink-900">
                      {it.image ? (
                        /* eslint-disable-next-line @next/next/no-img-element */
                        <img src={withBase(it.image)} alt="" className="size-full object-contain" />
                      ) : (
                        <Icon className="size-8 text-mist-500" />
                      )}
                    </div>
                    <div className="flex items-center gap-1.5">
                      <p className="min-w-0 flex-1 truncate text-sm font-semibold text-mist-100" title={it.name}>{it.name}</p>
                      {/* How long it lasts — shown exactly like the Frame Store. */}
                      <span className="shrink-0 rounded-full bg-white/[0.06] px-1.5 py-0.5 text-[10px] text-mist-400">{gameValidityLabel(it)}</span>
                    </div>
                    {mine && ownedLabel(ownedCosmetics, kind, it.id) !== "Permanent" && (
                      <p className="text-[10px] font-semibold text-amber-300">⏳ {ownedLabel(ownedCosmetics, kind, it.id)}</p>
                    )}
                    {mine ? (
                      <Button size="sm" block variant="secondary" onClick={() => router.push("/customize")}>
                        <Check className="size-4 text-emerald-300" /> Owned — use it
                      </Button>
                    ) : (
                      <Button size="sm" block disabled={busy === `${kind}:${it.id}`} onClick={() => void buyGameItem(kind, it)}>
                        {busy === `${kind}:${it.id}` ? "Buying…" : <>🪙 {it.price.toLocaleString("en-SA")} · Buy</>}
                      </Button>
                    )}
                  </Card>
                );
              })}
            </div>
          </section>
        );
      })}

      {gameFilter === "profile" && KIND_META.map(({ kind, icon: Icon, title, blurb }) => {
        const items = storeItemsOf(config, kind).filter((it) => visibleToMe(it) && (catFilter === "all" || (it.category ?? "") === catFilter));
        if (items.length === 0) return null;
        const worn = (equipped as Record<string, string | undefined>)[kind] ?? "";
        return (
          <section key={kind}>
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
              <div>
                <h2 className="flex items-center gap-2 font-display text-lg font-bold text-mist-100"><Icon className="size-5 text-lotus-300" /> {title}</h2>
                <p className="text-xs text-mist-400">{blurb}</p>
              </div>
              {worn && (
                <button onClick={() => void wear(kind, "")} disabled={busy === `none-${kind}`} className="rounded-full bg-white/[0.06] px-3 py-1 text-xs font-semibold text-mist-300 hover:bg-white/10">
                  Remove current
                </button>
              )}
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {items.map((item) => {
                const st = myStoreState(user, item.id);
                const isWearing = worn === item.id && st.owned;
                const vipLocked = item.vipOnly && !user.vip && user.role !== "admin";
                const { onSale, vipFree, firstPct: firstBuyPct, price: effPrice } = priceFor(item);
                // Reachable only when restrictMode="show" (hide mode filters the item out): the
                // user sees the item but isn't in its audience, so purchase is blocked.
                const audienceLocked = !audienceOk(item);
                const soldOut = typeof item.stock === "number" && item.stock <= 0;
                const teaser = !!item.comingSoon;
                const displayOnly = !!item.displayOnly;
                const myLvl = user.level ?? 1;
                const levelLocked = (!!item.minLevel && myLvl < item.minLevel) || (!!item.maxLevel && myLvl > item.maxLevel);
                // A one-time / lifetime item already bought can never be re-bought — so
                // don't show a Repurchase button that would just error.
                const limitLock = (item.purchaseLimit === "once" || item.purchaseLimit === "lifetime") && (st.owned || st.expired);
                return (
                  <Card key={item.id} className={cn("space-y-2 p-3", isWearing && "ring-1 ring-lotus-400")}>
                    {preview(item)}
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="text-sm font-semibold text-mist-100">{item.name}</span>
                      {item.badge && <span className="rounded-full bg-gold-500/20 px-1.5 py-0.5 text-[9px] font-extrabold uppercase text-gold-300">{item.badge}</span>}
                      {item.featured && <span className="rounded-full bg-gold-500/20 px-1.5 py-0.5 text-[9px] font-extrabold uppercase text-gold-300">★ Featured</span>}
                      {item.newArrival && <span className="rounded-full bg-emerald-500/20 px-1.5 py-0.5 text-[9px] font-extrabold uppercase text-emerald-300">New</span>}
                      {item.trending && <span className="rounded-full bg-pink-500/20 px-1.5 py-0.5 text-[9px] font-extrabold uppercase text-pink-300">🔥 Trending</span>}
                      {item.limitedEdition && <span className="rounded-full bg-fuchsia-500/20 px-1.5 py-0.5 text-[9px] font-extrabold uppercase text-fuchsia-300">Limited</span>}
                      {item.vipOnly && <span className="rounded-full bg-fuchsia-500/20 px-1.5 py-0.5 text-[9px] font-extrabold uppercase text-fuchsia-300">VIP</span>}
                      <span className="ml-auto rounded-full bg-white/[0.06] px-1.5 py-0.5 text-[10px] text-mist-400">{validityLabel(item)}</span>
                    </div>
                    {item.description && <p className="text-[11px] text-mist-500">{item.description}</p>}
                    {st.owned && st.expiresAt && <p className="text-[10px] font-semibold text-amber-300">⏳ {st.label}</p>}
                    {!st.owned && typeof item.stock === "number" && item.stock > 0 && item.stock <= 20 && <p className="text-[10px] font-semibold text-amber-300">Only {item.stock} left</p>}
                    <div className="flex items-center gap-2">
                      {isWearing ? (
                        <span className="rounded-full bg-lotus-500/15 px-2.5 py-1 text-[11px] font-bold text-lotus-300">Equipped ✓</span>
                      ) : st.owned ? (
                        <Button size="sm" variant="secondary" onClick={() => void wear(kind, item.id)} disabled={busy === item.id}>Equip</Button>
                      ) : limitLock && st.expired ? (
                        <span className="rounded-full bg-white/8 px-2.5 py-1 text-[11px] font-bold text-mist-400">One-time item · used</span>
                      ) : teaser ? (
                        <span className="rounded-full bg-sky-500/15 px-2.5 py-1 text-[11px] font-bold text-sky-300">Coming soon</span>
                      ) : audienceLocked ? (
                        <span className="text-[11px] font-semibold text-fuchsia-300">{restrictLabel(item)}</span>
                      ) : displayOnly ? (
                        <span className="rounded-full bg-white/8 px-2.5 py-1 text-[11px] font-bold text-mist-400">Display only</span>
                      ) : soldOut ? (
                        <span className="rounded-full bg-white/8 px-2.5 py-1 text-[11px] font-bold text-mist-400">Sold out</span>
                      ) : levelLocked ? (
                        <span className="text-[11px] font-semibold text-amber-300">{item.minLevel && myLvl < item.minLevel ? `Level ${item.minLevel}+ required` : `Up to level ${item.maxLevel} only`}</span>
                      ) : vipLocked ? (
                        <span className="text-[11px] font-semibold text-fuchsia-300">VIP members only</span>
                      ) : (
                        <Button size="sm" onClick={() => (effPrice > 0 ? setConfirmBuy(item) : void buy(item))} disabled={busy === item.id}>
                          {busy === item.id ? "Buying…" : st.expired ? `Repurchase · 🪙 ${effPrice.toLocaleString("en-SA")}` : effPrice > 0 ? `Buy · 🪙 ${effPrice.toLocaleString("en-SA")}` : vipFree ? "Get free (VIP)" : "Get free"}
                        </Button>
                      )}
                      {!st.owned && !audienceLocked && !teaser && !soldOut && !displayOnly && firstBuyPct > 0 && effPrice > 0 && (
                        <span className="rounded-full bg-emerald-500/15 px-1.5 py-0.5 text-[10px] font-bold text-emerald-300">First buy −{firstBuyPct}%</span>
                      )}
                      {onSale && !st.owned && !teaser && !soldOut && (
                        <span className="text-[11px] font-semibold text-emerald-300">SALE <span className="text-mist-500 line-through">🪙 {item.price.toLocaleString("en-SA")}</span></span>
                      )}
                      {!st.owned && !vipLocked && !teaser && !soldOut && effPrice > 0 && (user.coins ?? 0) < effPrice && (
                        <span className="text-[10px] text-rose-300">Not enough coins</span>
                      )}
                    </div>
                  </Card>
                );
              })}
            </div>
          </section>
        );
      })}

      {/* My Collection */}
      {(ownedItems.length > 0 || ownedFrames.length > 0 || expiredItems.length > 0) && (
        <section>
          <h2 className="mb-2 flex items-center gap-2 font-display text-lg font-bold text-mist-100"><Package className="size-5 text-lotus-300" /> My Collection</h2>
          <Card className="divide-y divide-white/5 p-0">
            {ownedFrames.map((f) => (
              <div key={f.id} className="flex items-center gap-3 px-4 py-2.5">
                <Avatar name={user.fullName} src={user.avatar} size="sm" frameImage={withBase(f.image)} />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-mist-100">{f.name}</p>
                  <p className="text-[10px] text-mist-500">Profile frame · {myStoreState({ storeOwned: user.frames }, f.id).label || "Permanent"}</p>
                </div>
                {user.equippedFrame === f.id && <span className="rounded-full bg-lotus-500/15 px-2 py-0.5 text-[10px] font-bold text-lotus-300">Equipped</span>}
              </div>
            ))}
            {ownedItems.map((i) => (
              <div key={i.id} className="flex items-center gap-3 px-4 py-2.5">
                {i.kind === "nameEffect" ? (
                  <span className="text-sm" style={i.style ? NAME_EFFECTS[i.style]?.css : undefined}>Aa</span>
                ) : (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={i.image ? withBase(i.image) : ""} alt="" className="size-8 rounded object-cover" />
                )}
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-mist-100">{i.name}</p>
                  <p className="text-[10px] text-mist-500">{KIND_META.find((k) => k.kind === i.kind)?.title} · {myStoreState(user, i.id).label}</p>
                </div>
                {(equipped as Record<string, string | undefined>)[i.kind] === i.id && <span className="rounded-full bg-lotus-500/15 px-2 py-0.5 text-[10px] font-bold text-lotus-300">Equipped</span>}
              </div>
            ))}
            {expiredItems.map((i) => (
              <div key={`exp-${i.id}`} className="flex items-center gap-3 px-4 py-2.5 opacity-70">
                {i.kind === "nameEffect" ? (
                  <span className="text-sm" style={i.style ? NAME_EFFECTS[i.style]?.css : undefined}>Aa</span>
                ) : (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={i.image ? withBase(i.image) : ""} alt="" className="size-8 rounded object-cover grayscale" />
                )}
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-mist-300">{i.name}</p>
                  <p className="text-[10px] text-rose-300/80">{KIND_META.find((k) => k.kind === i.kind)?.title} · Expired</p>
                </div>
                {i.purchaseLimit === "once" || i.purchaseLimit === "lifetime" ? (
                  <span className="text-[10px] text-mist-500">One-time only</span>
                ) : (
                  <Button size="sm" variant="secondary" onClick={() => setConfirmBuy(i)}>Buy again</Button>
                )}
              </div>
            ))}
          </Card>
        </section>
      )}

      {/* Request Center — ask the admin for any new item, and track your requests */}
      <section>
        <h2 className="mb-2 flex items-center gap-2 font-display text-lg font-bold text-mist-100"><Send className="size-5 text-lotus-300" /> Request Center</h2>
        <Card className="space-y-3 p-4">
          <p className="text-xs text-mist-400">Want a frame, overlay, theme, gift, chat style or anything else that isn&apos;t in the store? Pick a type, describe it (attach a picture if you have one) and the admin will review it — you&apos;ll be notified.</p>
          <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
            <select value={reqKind} onChange={(e) => setReqKind(e.target.value)} className="h-9 rounded-lg border border-line bg-ink-800 px-2.5 text-sm text-mist-100 outline-none focus:border-lotus-400 sm:w-52">
              {REQUEST_GROUPS.map((g) => (
                <optgroup key={g.group} label={g.group}>
                  {g.options.map((o) => <option key={o.v} value={o.v}>{o.label}</option>)}
                </optgroup>
              ))}
            </select>
            <textarea
              value={reqText}
              onChange={(e) => setReqText(e.target.value.slice(0, 500))}
              rows={3}
              placeholder="Describe it in detail: what it is, colours, style, and a link to an example if you have one. e.g. “A golden dragon profile frame — gold + red, with animated flames.”"
              className="min-w-52 flex-1 rounded-lg border border-line bg-ink-800 px-3 py-2 text-sm text-mist-100 outline-none focus:border-lotus-400"
            />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {reqImage ? (
              <span className="inline-flex items-center gap-1.5 rounded-lg border border-line bg-ink-800 px-2 py-1 text-[11px] text-mist-300">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={reqImage} alt="" className="size-6 rounded object-cover" /> Reference attached
                <button onClick={() => setReqImage("")} className="text-mist-500 hover:text-rose-300"><X className="size-3.5" /></button>
              </span>
            ) : (
              <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-line bg-ink-800 px-2.5 py-1.5 text-[11px] font-semibold text-mist-300 hover:border-lotus-400/40">
                <Paperclip className="size-3.5" /> Attach a picture
                <input type="file" accept="image/*" className="hidden" onChange={(e) => void pickReqImage(e.target.files?.[0])} />
              </label>
            )}
            <Button size="sm" onClick={() => void submitRequest()} disabled={reqBusy} className="ml-auto shrink-0"><Send className="size-3.5" /> {reqBusy ? "Sending…" : "Send request"}</Button>
          </div>

          {/* My Requests — status tracking */}
          {myRequests.length > 0 && (
            <div className="border-t border-white/5 pt-3">
              <div className="mb-1.5 flex items-center justify-between">
                <div className="text-[11px] font-semibold uppercase tracking-wide text-mist-500">My requests ({myRequests.length})</div>
                {myRequests.length > 4 && <button onClick={() => setShowAllReq((s) => !s)} className="text-[11px] font-semibold text-lotus-300 hover:text-lotus-200">{showAllReq ? "Show less" : "Show all"}</button>}
              </div>
              <div className="space-y-1.5">
                {(showAllReq ? myRequests : myRequests.slice(0, 4)).map((r) => {
                  const s = REQ_STATUS[r.status] ?? REQ_STATUS.pending;
                  return (
                    <div key={r.id} className="flex items-start gap-2 rounded-lg border border-line bg-ink-900/40 px-2.5 py-2">
                      {r.image && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={r.image} alt="" className="size-9 shrink-0 rounded object-cover" />
                      )}
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className={cn("inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[10px] font-bold", s.tone)}><s.icon className="size-2.5" /> {s.label}</span>
                          <span className="text-[10px] font-semibold text-mist-400">{REQUEST_LABEL[r.kind] ?? r.kind}</span>
                          <span className="text-[10px] text-mist-600">{new Date(r.at).toLocaleDateString("en-GB", { day: "2-digit", month: "short" })}</span>
                        </div>
                        <p className="mt-0.5 truncate text-[11px] text-mist-300">{r.text}</p>
                        {r.note && <p className="text-[10px] text-mist-500">Admin: “{r.note}”{r.decidedBy ? ` — ${r.decidedBy}` : ""}</p>}
                      </div>
                      {r.status === "pending" && (
                        <button onClick={() => void cancelRequest(r.id)} title="Cancel request" className="shrink-0 rounded-lg border border-line px-2 py-1 text-[10px] font-semibold text-mist-400 hover:border-rose-400/40 hover:text-rose-300">Cancel</button>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </Card>
      </section>

      {/* Purchase confirmation */}
      {confirmBuy && (
        <div className="fixed inset-0 z-[130] grid place-items-center bg-black/70 p-4" onClick={() => setConfirmBuy(null)}>
          <div className="w-full max-w-xs rounded-2xl border border-white/10 bg-ink-900 p-5 text-center" onClick={(e) => e.stopPropagation()}>
            {preview(confirmBuy)}
            <p className="mt-3 text-sm font-bold text-mist-100">Buy “{confirmBuy.name}”?</p>
            <p className="mt-1 text-xs text-mist-400">
              🪙 {priceFor(confirmBuy).price.toLocaleString("en-SA")} coins
              {priceFor(confirmBuy).price < confirmBuy.price && <span className="ml-1 text-mist-500 line-through">{confirmBuy.price.toLocaleString("en-SA")}</span>}
              {priceFor(confirmBuy).firstPct > 0 && <span className="ml-1 font-semibold text-emerald-300">First buy −{priceFor(confirmBuy).firstPct}%</span>}
              {" "}· {validityLabel(confirmBuy)}
            </p>
            <div className="mt-4 flex justify-center gap-2">
              <Button variant="secondary" size="sm" onClick={() => setConfirmBuy(null)}>Cancel</Button>
              <Button size="sm" onClick={() => void buy(confirmBuy)}>Confirm — buy now</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
