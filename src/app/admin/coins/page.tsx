"use client";

import { useEffect, useState } from "react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { useToast } from "@/components/ui/Toast";
import { useConfig, saveConfig, type CoinPackage, type CoinOffer } from "@/lib/config";
import { PAYMENT_METHODS, DEFAULT_METHODS } from "@/lib/payments";
import { fileToDataUrl } from "@/lib/image";
import { fetchAdminUsers, type AdminUser } from "@/lib/admin";
import { adjustUserCoins } from "@/lib/coin-purchase";
import { cn } from "@/lib/cn";
import { priceBreakdown, fmtMoney } from "@/lib/coin-price";
import { Coins, Plus, Trash2, Check, Star, Tag, Banknote, Gift, QrCode, Upload, Search, Percent } from "lucide-react";

export default function AdminCoinsPage() {
  const { config, loading, reload } = useConfig();
  const { toast } = useToast();
  const [packages, setPackages] = useState<CoinPackage[]>(config.coinPackages);
  const [offers, setOffers] = useState<CoinOffer[]>(config.coinOffers);
  const [gateway, setGateway] = useState(config.paymentGateway ?? { provider: "test" as const, keyId: "", currency: "INR", methods: DEFAULT_METHODS });
  const [savingGw, setSavingGw] = useState(false);
  const [saving, setSaving] = useState(false);
  const [confirmDel, setConfirmDel] = useState<CoinPackage | null>(null);

  // QR/UPI payment collection
  const [qr, setQr] = useState({ enabled: true, imageUrl: "", upiId: "", note: "", currency: "₹" });
  const [savingQr, setSavingQr] = useState(false);

  // Tax + service charge added on top of every package price.
  const [fees, setFees] = useState({
    taxEnabled: false, taxLabel: "VAT", taxPct: 15,
    serviceEnabled: false, serviceLabel: "Service charge", servicePct: 0, serviceFixed: 0,
    showBreakdown: true,
  });
  const [savingFees, setSavingFees] = useState(false);

  // Manual coin adjustment
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [userQuery, setUserQuery] = useState("");
  const [pickedUser, setPickedUser] = useState<AdminUser | null>(null);
  const [adjAmount, setAdjAmount] = useState(0);
  const [adjReason, setAdjReason] = useState("");
  const [adjBusy, setAdjBusy] = useState(false);
  const [adjCurrency, setAdjCurrency] = useState<"coins" | "lotus">("coins");

  // Coin transfer (move coins between two users in one atomic action)
  const [xferFromQ, setXferFromQ] = useState("");
  const [xferFrom, setXferFrom] = useState<AdminUser | null>(null);
  const [xferToQ, setXferToQ] = useState("");
  const [xferTo, setXferTo] = useState<AdminUser | null>(null);
  const [xferAmount, setXferAmount] = useState(0);
  const [xferReason, setXferReason] = useState("");
  const [xferBusy, setXferBusy] = useState(false);

  useEffect(() => {
    if (!loading) {
      setPackages(config.coinPackages);
      setOffers(config.coinOffers);
      if (config.paymentGateway) setGateway(config.paymentGateway);
      if (config.paymentQr) setQr({ enabled: config.paymentQr.enabled !== false, imageUrl: config.paymentQr.imageUrl ?? "", upiId: config.paymentQr.upiId ?? "", note: config.paymentQr.note ?? "", currency: config.paymentQr.currency ?? "₹" });
      const f = config.coinFees ?? {};
      setFees({
        taxEnabled: f.taxEnabled === true,
        taxLabel: f.taxLabel ?? "VAT",
        taxPct: f.taxPct ?? 15,
        serviceEnabled: f.serviceEnabled === true,
        serviceLabel: f.serviceLabel ?? "Service charge",
        servicePct: f.servicePct ?? 0,
        serviceFixed: f.serviceFixed ?? 0,
        showBreakdown: f.showBreakdown !== false,
      });
    }
  }, [loading, config]);

  const saveFees = async () => {
    setSavingFees(true);
    const res = await saveConfig({ coinFees: fees });
    setSavingFees(false);
    if (res.ok) { await reload(); toast("Tax & service charge saved — live for all users.", "success"); }
    else toast(res.error ?? "Could not save", "error");
  };

  useEffect(() => { fetchAdminUsers().then(setUsers).catch(() => {}); }, []);

  const saveQr = async () => {
    setSavingQr(true);
    const res = await saveConfig({ paymentQr: qr });
    setSavingQr(false);
    if (res.ok) { await reload(); toast("Payment QR saved — live now", "success"); }
    else toast(res.error ?? "Could not save", "error");
  };

  const onQrFile = async (file: File | undefined) => {
    if (!file) return;
    try { setQr((q) => ({ ...q, imageUrl: "" })); const url = await fileToDataUrl(file, 600, 0.85); setQr((q) => ({ ...q, imageUrl: url })); }
    catch { toast("Could not read that image", "error"); }
  };

  const applyAdjust = async () => {
    if (!pickedUser) return toast("Pick a user first", "error");
    if (!adjAmount) return toast("Enter a non-zero amount", "error");
    setAdjBusy(true);
    const res = await adjustUserCoins(pickedUser.id, adjAmount, adjReason.trim() || undefined, adjCurrency);
    setAdjBusy(false);
    if (res.ok) {
      const unit = adjCurrency === "lotus" ? "Lotus" : "coins";
      const bal = adjCurrency === "lotus" ? res.lotus : res.balance;
      toast(`${adjAmount >= 0 ? "Added" : "Removed"} ${Math.abs(adjAmount).toLocaleString()} ${unit} — new balance ${bal?.toLocaleString()}`, "success");
      setAdjAmount(0); setAdjReason("");
      fetchAdminUsers().then(setUsers).catch(() => {});
      setPickedUser((u) => (u ? { ...u, coins: res.balance ?? u.coins } : u));
    } else toast(res.error ?? "Could not adjust", "error");
  };

  const matchUsers = (q: string, excludeId?: string) =>
    q.trim()
      ? users.filter((u) => u.id !== excludeId && `${u.fullName} ${u.username ?? ""} ${u.email ?? ""} ${u.publicId ?? ""}`.toLowerCase().includes(q.trim().toLowerCase())).slice(0, 6)
      : [];
  const userMatches = pickedUser ? [] : matchUsers(userQuery);
  const xferFromMatches = xferFrom ? [] : matchUsers(xferFromQ, xferTo?.id);
  const xferToMatches = xferTo ? [] : matchUsers(xferToQ, xferFrom?.id);

  const applyTransfer = async () => {
    if (!xferFrom || !xferTo) return toast("Pick both users first", "error");
    if (xferFrom.id === xferTo.id) return toast("Pick two different users", "error");
    if (!xferAmount || xferAmount <= 0) return toast("Enter an amount greater than 0", "error");
    setXferBusy(true);
    try {
      const res = await fetch("/api/admin/coin-transfer", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fromId: xferFrom.id, toId: xferTo.id, amount: xferAmount, reason: xferReason.trim() || undefined }),
      });
      const data = await res.json();
      if (res.ok && data.ok) {
        toast(`Moved ${xferAmount.toLocaleString()} coins: ${xferFrom.fullName} → ${xferTo.fullName}`, "success");
        setXferAmount(0); setXferReason(""); setXferFrom(null); setXferTo(null); setXferFromQ(""); setXferToQ("");
        fetchAdminUsers().then(setUsers).catch(() => {});
      } else toast(data.error ?? "Could not transfer coins", "error");
    } catch { toast("Could not transfer coins", "error"); }
    setXferBusy(false);
  };

  const saveGateway = async () => {
    setSavingGw(true);
    const res = await saveConfig({ paymentGateway: gateway });
    setSavingGw(false);
    if (res.ok) { await reload(); toast("Payment gateway saved", "success"); }
    else toast(res.error ?? "Could not save", "error");
  };

  const upd = (id: string, patch: Partial<CoinPackage>) => setPackages((p) => p.map((x) => (x.id === id ? { ...x, ...patch } : x)));
  const updOffer = (id: string, patch: Partial<CoinOffer>) => setOffers((o) => o.map((x) => (x.id === id ? { ...x, ...patch } : x)));

  // Upload an image FROM the device for a package (so admins don't need a URL).
  const onPackageIcon = async (id: string, file: File | undefined) => {
    if (!file) return;
    try { const url = await fileToDataUrl(file, 600, 0.85); upd(id, { iconUrl: url }); toast("Image added — remember to Save changes", "success"); }
    catch { toast("Could not read that image", "error"); }
  };

  const addPackage = () =>
    setPackages((p) => [...p, { id: `cp_${Date.now().toString(36)}`, name: "New package", coins: 1000, price: 99, iconUrl: "", active: true, featured: false, badge: "" }]);
  const addOffer = () =>
    setOffers((o) => [...o, { id: `of_${Date.now().toString(36)}`, name: "New offer", type: "bonus", amount: 100, from: "", until: "", active: true }]);

  // Only one package can hold each highlight badge.
  const setBadge = (id: string, badge: CoinPackage["badge"]) =>
    setPackages((p) => p.map((x) => (x.id === id ? { ...x, badge } : badge && x.badge === badge ? { ...x, badge: "" } : x)));

  const save = async () => {
    setSaving(true);
    const res = await saveConfig({ coinPackages: packages, coinOffers: offers });
    setSaving(false);
    if (res.ok) {
      await reload();
      toast("Coin store saved", "success");
    } else {
      toast(res.error ?? "Could not save", "error");
    }
  };

  const field = "rounded-lg border border-line bg-ink-900 px-3 py-2 text-sm text-mist-100 outline-none focus:border-lotus-400";

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-extrabold text-mist-100">Coin package management</h1>
        <p className="text-sm text-mist-400">Create packages, run promotional offers, and highlight the best deals.</p>
      </div>

      {/* Payment gateway */}
      <Card className="p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="flex items-center gap-2 font-semibold text-mist-100"><Banknote className="size-4 text-emerald-300" /> Payment gateway</h2>
            <p className="mt-1 text-sm text-mist-400">Choose how users pay for coins. Use Test mode for demos; switch to a real provider once your account is ready.</p>
          </div>
          <label className="flex shrink-0 items-center gap-2 rounded-lg border border-line bg-ink-900/60 px-3 py-2">
            <span className="text-xs font-semibold text-mist-300">{gateway.enabled === false ? "Gateway OFF" : "Gateway ON"}</span>
            <button
              onClick={() => setGateway((g) => ({ ...g, enabled: g.enabled === false }))}
              role="switch" aria-checked={gateway.enabled !== false}
              className={cn("relative h-6 w-11 shrink-0 rounded-full transition", gateway.enabled !== false ? "bg-emerald-500" : "bg-mist-600")}
            >
              <span className={cn("absolute top-0.5 size-5 rounded-full bg-white shadow transition-all", gateway.enabled !== false ? "left-[22px]" : "left-0.5")} />
            </button>
          </label>
        </div>
        {gateway.enabled === false && (
          <p className="mt-3 rounded-lg bg-rose-500/10 px-3 py-2 text-xs text-rose-200">The card / online gateway is <b>turned off</b>. Coin buying currently runs through the <b>Payment QR</b> below; this switch also hides the card option once live card payments are enabled.</p>
        )}
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          <div>
            <label className="block text-xs font-semibold text-mist-300">Provider</label>
            <select value={gateway.provider} onChange={(e) => setGateway((g) => ({ ...g, provider: e.target.value as typeof g.provider }))} className={cn(field, "mt-1 w-full")}>
              <option value="test">Test mode (simulated)</option>
              <option value="razorpay">Razorpay</option>
              <option value="stripe">Stripe</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-mist-300">Publishable / Key ID</label>
            <input value={gateway.keyId ?? ""} onChange={(e) => setGateway((g) => ({ ...g, keyId: e.target.value }))} placeholder={gateway.provider === "test" ? "Not needed in test mode" : "rzp_live_… / pk_live_…"} disabled={gateway.provider === "test"} className={cn(field, "mt-1 w-full disabled:opacity-50")} />
          </div>
          <div>
            <label className="block text-xs font-semibold text-mist-300">Currency</label>
            <input value={gateway.currency ?? "INR"} onChange={(e) => setGateway((g) => ({ ...g, currency: e.target.value.toUpperCase().slice(0, 3) }))} className={cn(field, "mt-1 w-full")} />
          </div>
        </div>
        {/* Enable / disable each payment method */}
        <div className="mt-4">
          <label className="block text-xs font-semibold text-mist-300">Payment methods offered to users</label>
          <div className="mt-1.5 grid gap-1.5 sm:grid-cols-2">
            {PAYMENT_METHODS.map((m) => {
              const on = (gateway.methods ?? DEFAULT_METHODS)[m.key] !== false;
              return (
                <button
                  key={m.key}
                  onClick={() => setGateway((g) => ({ ...g, methods: { ...DEFAULT_METHODS, ...(g.methods ?? {}), [m.key]: !on } }))}
                  className={cn("flex items-center gap-2 rounded-lg border px-3 py-2 text-left text-sm transition", on ? "border-emerald-400/40 bg-emerald-500/10 text-mist-100" : "border-line bg-ink-900 text-mist-400 hover:text-mist-100")}
                >
                  <span className="text-base leading-none">{m.emoji || "💠"}</span>
                  <span className="flex-1">{m.label}{m.hint && <span className="ml-1 text-[11px] text-mist-500">({m.hint})</span>}</span>
                  <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-bold", on ? "bg-emerald-500/20 text-emerald-300" : "bg-ink-700 text-mist-500")}>{on ? "ON" : "OFF"}</span>
                </button>
              );
            })}
          </div>
        </div>

        {gateway.provider !== "test" && (
          <p className="mt-3 rounded-lg bg-amber-500/10 px-3 py-2 text-xs text-amber-200">
            ⚠️ To take real payments, your <b>secret key</b> must be added on the server (never here). Until then, checkout stays in safe test mode. Share the secret key privately so it can be installed.
          </p>
        )}
        <Button size="sm" className="mt-4" onClick={saveGateway} disabled={savingGw}><Check className="size-4" /> {savingGw ? "Saving…" : "Save gateway"}</Button>
      </Card>

      {/* QR / UPI payment collection */}
      <Card className="p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="flex items-center gap-2 font-semibold text-mist-100"><QrCode className="size-4 text-lotus-300" /> Payment QR (Buy Coins)</h2>
            <p className="mt-1 text-sm text-mist-400">Users scan this to pay, then upload a screenshot you verify in <b className="text-mist-200">Coin Purchases</b>. No gateway needed.</p>
          </div>
          <label className="flex shrink-0 items-center gap-2 rounded-lg border border-line bg-ink-900/60 px-3 py-2">
            <span className="text-xs font-semibold text-mist-300">{qr.enabled === false ? "QR OFF" : "QR ON"}</span>
            <button
              onClick={() => setQr((q) => ({ ...q, enabled: q.enabled === false }))}
              role="switch" aria-checked={qr.enabled !== false}
              className={cn("relative h-6 w-11 shrink-0 rounded-full transition", qr.enabled !== false ? "bg-emerald-500" : "bg-mist-600")}
            >
              <span className={cn("absolute top-0.5 size-5 rounded-full bg-white shadow transition-all", qr.enabled !== false ? "left-[22px]" : "left-0.5")} />
            </button>
          </label>
        </div>
        {qr.enabled === false && (
          <p className="mt-3 rounded-lg bg-rose-500/10 px-3 py-2 text-xs text-rose-200">The Payment QR is <b>turned off</b> — the &quot;Pay by QR&quot; option is hidden from users.</p>
        )}
        <div className="mt-4 flex flex-wrap gap-5">
          <div className="flex flex-col items-center gap-2">
            <div className="grid size-40 place-items-center overflow-hidden rounded-xl border border-line bg-white">
              {qr.imageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={qr.imageUrl} alt="QR" className="h-full w-full object-contain p-1.5" />
              ) : (
                <QrCode className="size-10 text-ink-700" />
              )}
            </div>
            <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-line bg-ink-800 px-3 py-1.5 text-xs font-semibold text-mist-200 hover:border-lotus-400/40">
              <Upload className="size-3.5" /> {qr.imageUrl ? "Replace QR" : "Upload QR"}
              <input type="file" accept="image/*" className="hidden" onChange={(e) => onQrFile(e.target.files?.[0])} />
            </label>
            {qr.imageUrl && <button onClick={() => setQr((q) => ({ ...q, imageUrl: "" }))} className="text-[11px] text-rose-300 hover:underline">Remove</button>}
          </div>
          <div className="min-w-48 flex-1 space-y-2">
            <div>
              <label className="block text-xs font-semibold text-mist-300">UPI ID / Pay handle (optional)</label>
              <input value={qr.upiId} onChange={(e) => setQr((q) => ({ ...q, upiId: e.target.value }))} placeholder="name@bank / 98xxxxxx@upi" className={cn(field, "mt-1 w-full")} />
            </div>
            <div className="grid grid-cols-3 gap-2">
              <div className="col-span-1">
                <label className="block text-xs font-semibold text-mist-300">Currency</label>
                <input value={qr.currency} onChange={(e) => setQr((q) => ({ ...q, currency: e.target.value.slice(0, 4) }))} placeholder="₹" className={cn(field, "mt-1 w-full")} />
              </div>
            </div>
            <div>
              <label className="block text-xs font-semibold text-mist-300">Instructions shown to users</label>
              <textarea value={qr.note} onChange={(e) => setQr((q) => ({ ...q, note: e.target.value }))} rows={2} placeholder="Scan, pay the exact amount, then upload your screenshot." className={cn(field, "mt-1 w-full resize-none")} />
            </div>
          </div>
        </div>
        <Button size="sm" className="mt-4" onClick={saveQr} disabled={savingQr}><Check className="size-4" /> {savingQr ? "Saving…" : "Save QR"}</Button>
      </Card>

      {/* Manual coin / Lotus adjustment */}
      <Card className="p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="flex items-center gap-2 font-semibold text-mist-100"><Coins className="size-4 text-gold-300" /> Manual balance adjustment</h2>
          <div className="flex overflow-hidden rounded-lg border border-line text-xs font-semibold">
            {(["coins", "lotus"] as const).map((c) => (
              <button key={c} onClick={() => setAdjCurrency(c)} className={cn("px-3 py-1.5 capitalize transition", adjCurrency === c ? "bg-lotus-500 text-white" : "bg-ink-800 text-mist-300 hover:bg-white/[0.06]")}>{c === "lotus" ? "Lotus" : "Coins"}</button>
            ))}
          </div>
        </div>
        <p className="mt-1 text-sm text-mist-400">Add or remove <b>{adjCurrency === "lotus" ? "Lotus currency" : "coins"}</b> from any user&apos;s wallet (e.g. compensation or correction). It&apos;s logged + the user is notified.</p>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <div className="relative">
            <label className="block text-xs font-semibold text-mist-300">User</label>
            <div className="mt-1 flex items-center gap-2 rounded-lg border border-line bg-ink-900 px-3">
              <Search className="size-4 text-mist-500" />
              <input value={pickedUser ? `${pickedUser.fullName}${pickedUser.publicId ? ` · ID ${pickedUser.publicId}` : ""} (${pickedUser.coins.toLocaleString()} coins)` : userQuery} onChange={(e) => { setPickedUser(null); setUserQuery(e.target.value); }} placeholder="Search by User ID / name / username / email" className="w-full bg-transparent py-2 text-sm text-mist-100 outline-none" />
              {pickedUser && <button onClick={() => { setPickedUser(null); setUserQuery(""); }} className="text-mist-400 hover:text-mist-100"><Trash2 className="size-3.5" /></button>}
            </div>
            {userMatches.length > 0 && !pickedUser && (
              <div className="absolute z-20 mt-1 w-full overflow-hidden rounded-lg border border-white/10 bg-ink-850 shadow-xl">
                {userMatches.map((u) => (
                  <button key={u.id} onClick={() => { setPickedUser(u); setUserQuery(""); }} className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm hover:bg-white/[0.05]">
                    <span className="min-w-0 truncate text-mist-100">{u.fullName} <span className="text-xs text-mist-500">@{u.username}</span>{u.publicId && <span className="ml-1 font-mono text-[11px] text-lotus-300">ID {u.publicId}</span>}</span>
                    <span className="shrink-0 text-xs text-gold-300">🪙 {u.coins.toLocaleString()}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
          <div>
            <label className="block text-xs font-semibold text-mist-300">Amount (use − to remove)</label>
            <input type="number" value={adjAmount || ""} onChange={(e) => setAdjAmount(Math.floor(Number(e.target.value) || 0))} placeholder="e.g. 500 or -200" className={cn(field, "mt-1 w-full")} />
          </div>
        </div>
        <input value={adjReason} onChange={(e) => setAdjReason(e.target.value)} placeholder="Reason (optional) — shown in the log & to the user" className={cn(field, "mt-3 w-full")} />
        <Button size="sm" className="mt-3" onClick={applyAdjust} disabled={adjBusy || !pickedUser || !adjAmount}>
          <Check className="size-4" /> {adjBusy ? "Applying…" : `${adjAmount >= 0 ? "Add" : "Remove"} ${Math.abs(adjAmount || 0).toLocaleString()} ${adjCurrency === "lotus" ? "Lotus" : "coins"}`}
        </Button>
      </Card>

      {/* Coin transfer — move coins from one user to another in one action */}
      <Card className="p-5">
        <h2 className="flex items-center gap-2 font-semibold text-mist-100"><Coins className="size-4 text-lotus-300" /> Transfer coins between users</h2>
        <p className="mt-1 text-sm text-mist-400">Move coins from one wallet to another in a single, recorded action. Both users are notified and it appears in the audit log &amp; both transaction histories.</p>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {/* From */}
          <div className="relative">
            <label className="block text-xs font-semibold text-mist-300">From (sender)</label>
            <div className="mt-1 flex items-center gap-2 rounded-lg border border-line bg-ink-900 px-3">
              <Search className="size-4 text-mist-500" />
              <input value={xferFrom ? `${xferFrom.fullName}${xferFrom.publicId ? ` · ID ${xferFrom.publicId}` : ""} (${xferFrom.coins.toLocaleString()} coins)` : xferFromQ} onChange={(e) => { setXferFrom(null); setXferFromQ(e.target.value); }} placeholder="Search user to take coins FROM" className="w-full bg-transparent py-2 text-sm text-mist-100 outline-none" />
              {xferFrom && <button onClick={() => { setXferFrom(null); setXferFromQ(""); }} className="text-mist-400 hover:text-mist-100"><Trash2 className="size-3.5" /></button>}
            </div>
            {xferFromMatches.length > 0 && (
              <div className="absolute z-20 mt-1 w-full overflow-hidden rounded-lg border border-white/10 bg-ink-850 shadow-xl">
                {xferFromMatches.map((u) => (
                  <button key={u.id} onClick={() => { setXferFrom(u); setXferFromQ(""); }} className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm hover:bg-white/[0.05]">
                    <span className="min-w-0 truncate text-mist-100">{u.fullName} <span className="text-xs text-mist-500">@{u.username}</span>{u.publicId && <span className="ml-1 font-mono text-[11px] text-lotus-300">ID {u.publicId}</span>}</span>
                    <span className="shrink-0 text-xs text-gold-300">🪙 {u.coins.toLocaleString()}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
          {/* To */}
          <div className="relative">
            <label className="block text-xs font-semibold text-mist-300">To (receiver)</label>
            <div className="mt-1 flex items-center gap-2 rounded-lg border border-line bg-ink-900 px-3">
              <Search className="size-4 text-mist-500" />
              <input value={xferTo ? `${xferTo.fullName}${xferTo.publicId ? ` · ID ${xferTo.publicId}` : ""} (${xferTo.coins.toLocaleString()} coins)` : xferToQ} onChange={(e) => { setXferTo(null); setXferToQ(e.target.value); }} placeholder="Search user to give coins TO" className="w-full bg-transparent py-2 text-sm text-mist-100 outline-none" />
              {xferTo && <button onClick={() => { setXferTo(null); setXferToQ(""); }} className="text-mist-400 hover:text-mist-100"><Trash2 className="size-3.5" /></button>}
            </div>
            {xferToMatches.length > 0 && (
              <div className="absolute z-20 mt-1 w-full overflow-hidden rounded-lg border border-white/10 bg-ink-850 shadow-xl">
                {xferToMatches.map((u) => (
                  <button key={u.id} onClick={() => { setXferTo(u); setXferToQ(""); }} className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm hover:bg-white/[0.05]">
                    <span className="min-w-0 truncate text-mist-100">{u.fullName} <span className="text-xs text-mist-500">@{u.username}</span>{u.publicId && <span className="ml-1 font-mono text-[11px] text-lotus-300">ID {u.publicId}</span>}</span>
                    <span className="shrink-0 text-xs text-gold-300">🪙 {u.coins.toLocaleString()}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <div>
            <label className="block text-xs font-semibold text-mist-300">Amount (coins)</label>
            <input type="number" min={1} value={xferAmount || ""} onChange={(e) => setXferAmount(Math.max(0, Math.floor(Number(e.target.value) || 0)))} placeholder="e.g. 500" className={cn(field, "mt-1 w-full")} />
          </div>
          <div>
            <label className="block text-xs font-semibold text-mist-300">Reason (optional)</label>
            <input value={xferReason} onChange={(e) => setXferReason(e.target.value)} placeholder="Shown in the log & to both users" className={cn(field, "mt-1 w-full")} />
          </div>
        </div>
        <Button size="sm" className="mt-3" onClick={applyTransfer} disabled={xferBusy || !xferFrom || !xferTo || !xferAmount}>
          <Check className="size-4" /> {xferBusy ? "Transferring…" : `Transfer ${Math.abs(xferAmount || 0).toLocaleString()} coins`}
        </Button>
      </Card>

      {/* Tax & service charge — one global rate for every package */}
      <Card className="p-5">
        <h2 className="flex items-center gap-2 font-semibold text-mist-100">
          <Percent className="size-4 text-emerald-300" /> Tax &amp; service charge
        </h2>
        <p className="mt-1 text-xs text-mist-400">
          Added on top of every coin package price. Both are worked out from the package price (they are not
          charged on each other). Users see the final amount before they pay. Leave both off to charge exactly
          the package price, as before.
        </p>

        <div className="mt-4 space-y-3">
          {/* Tax */}
          <div className="rounded-xl border border-line bg-ink-900/60 p-3">
            <div className="flex items-center gap-3">
              <div className="min-w-0 flex-1">
                <div className="text-sm font-semibold text-mist-100">Tax</div>
                <div className="text-xs text-mist-500">e.g. VAT at 15%. Applied to every package.</div>
              </div>
              <button
                onClick={() => setFees({ ...fees, taxEnabled: !fees.taxEnabled })}
                role="switch" aria-checked={fees.taxEnabled}
                className={cn("relative h-6 w-11 shrink-0 rounded-full transition", fees.taxEnabled ? "bg-emerald-500" : "bg-mist-600")}
              >
                <span className={cn("absolute top-0.5 size-5 rounded-full bg-white shadow transition-all", fees.taxEnabled ? "left-[22px]" : "left-0.5")} />
              </button>
            </div>
            {fees.taxEnabled && (
              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                <label className="block">
                  <span className="text-[11px] font-semibold text-mist-400">Name shown to users</span>
                  <input value={fees.taxLabel} onChange={(e) => setFees({ ...fees, taxLabel: e.target.value })} placeholder="VAT" className={cn(field, "mt-1 w-full")} />
                </label>
                <label className="block">
                  <span className="text-[11px] font-semibold text-mist-400">Tax percentage (%)</span>
                  <input type="number" min={0} max={100} step="0.01" value={fees.taxPct}
                    onChange={(e) => setFees({ ...fees, taxPct: Math.max(0, Math.min(100, Number(e.target.value) || 0)) })}
                    className={cn(field, "mt-1 w-full")} />
                </label>
              </div>
            )}
          </div>

          {/* Service charge */}
          <div className="rounded-xl border border-line bg-ink-900/60 p-3">
            <div className="flex items-center gap-3">
              <div className="min-w-0 flex-1">
                <div className="text-sm font-semibold text-mist-100">Service charge</div>
                <div className="text-xs text-mist-500">A percentage, a flat amount, or both together.</div>
              </div>
              <button
                onClick={() => setFees({ ...fees, serviceEnabled: !fees.serviceEnabled })}
                role="switch" aria-checked={fees.serviceEnabled}
                className={cn("relative h-6 w-11 shrink-0 rounded-full transition", fees.serviceEnabled ? "bg-emerald-500" : "bg-mist-600")}
              >
                <span className={cn("absolute top-0.5 size-5 rounded-full bg-white shadow transition-all", fees.serviceEnabled ? "left-[22px]" : "left-0.5")} />
              </button>
            </div>
            {fees.serviceEnabled && (
              <div className="mt-3 grid gap-2 sm:grid-cols-3">
                <label className="block">
                  <span className="text-[11px] font-semibold text-mist-400">Name shown to users</span>
                  <input value={fees.serviceLabel} onChange={(e) => setFees({ ...fees, serviceLabel: e.target.value })} placeholder="Service charge" className={cn(field, "mt-1 w-full")} />
                </label>
                <label className="block">
                  <span className="text-[11px] font-semibold text-mist-400">Percentage (%)</span>
                  <input type="number" min={0} max={100} step="0.01" value={fees.servicePct}
                    onChange={(e) => setFees({ ...fees, servicePct: Math.max(0, Math.min(100, Number(e.target.value) || 0)) })}
                    className={cn(field, "mt-1 w-full")} />
                </label>
                <label className="block">
                  <span className="text-[11px] font-semibold text-mist-400">Flat amount ({qr.currency})</span>
                  <input type="number" min={0} step="0.01" value={fees.serviceFixed}
                    onChange={(e) => setFees({ ...fees, serviceFixed: Math.max(0, Number(e.target.value) || 0) })}
                    className={cn(field, "mt-1 w-full")} />
                </label>
              </div>
            )}
          </div>

          <label className="flex items-center gap-2.5 rounded-xl border border-line bg-ink-900/60 p-3">
            <input type="checkbox" checked={fees.showBreakdown} onChange={(e) => setFees({ ...fees, showBreakdown: e.target.checked })} className="size-4 accent-lotus-500" />
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-semibold text-mist-100">Show the breakdown to users</span>
              <span className="block text-xs text-mist-500">At checkout, list the price, tax and service charge separately before the total.</span>
            </span>
          </label>

          {/* Live worked example so the admin sees the effect immediately */}
          {(fees.taxEnabled || fees.serviceEnabled) && (
            <div className="rounded-xl border border-emerald-500/25 bg-emerald-500/[0.06] p-3">
              <div className="text-xs font-semibold text-emerald-300">Example — a {qr.currency}100 package</div>
              {(() => {
                const ex = priceBreakdown(100, fees);
                return (
                  <div className="mt-2 space-y-1 text-xs text-mist-300">
                    <Row label="Package price" value={fmtMoney(ex.base, qr.currency)} />
                    {ex.tax > 0 && <Row label={`${ex.taxLabel} (${ex.taxPct}%)`} value={fmtMoney(ex.tax, qr.currency)} />}
                    {ex.service > 0 && <Row label={ex.serviceLabel} value={fmtMoney(ex.service, qr.currency)} />}
                    <div className="flex justify-between border-t border-emerald-500/25 pt-1 font-bold text-emerald-200">
                      <span>User pays</span><span>{fmtMoney(ex.payable, qr.currency)}</span>
                    </div>
                  </div>
                );
              })()}
            </div>
          )}
        </div>

        <Button size="sm" className="mt-4" onClick={saveFees} disabled={savingFees}>
          <Check className="size-4" /> {savingFees ? "Saving…" : "Save tax & service charge"}
        </Button>
      </Card>

      {/* Packages */}
      <div className="flex items-center justify-between">
        <h2 className="flex items-center gap-2 font-semibold text-mist-100"><Coins className="size-4 text-gold-300" /> Coin packages</h2>
        <Button variant="secondary" size="sm" onClick={addPackage}><Plus className="size-4" /> Add package</Button>
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        {packages.map((p) => (
          <Card key={p.id} className={cn("p-5", !p.active && "opacity-60")}>
            <div className="flex items-start gap-4">
              <div className="grid size-16 shrink-0 place-items-center overflow-hidden rounded-xl border border-line bg-ink-900">
                {p.iconUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={p.iconUrl} alt="" className="h-full w-full object-cover" />
                ) : (
                  <Coins className="size-7 text-gold-300" />
                )}
              </div>
              <div className="min-w-0 flex-1 space-y-2">
                <input value={p.name} onChange={(e) => upd(p.id, { name: e.target.value })} placeholder="Package name" className={cn(field, "w-full font-semibold")} />
                <div className="grid grid-cols-3 gap-2">
                  <label className="flex items-center gap-1 rounded-lg border border-line bg-ink-900 px-2" title="Coins">
                    <Coins className="size-3.5 text-gold-300" />
                    <input type="number" min={0} value={p.coins} onChange={(e) => upd(p.id, { coins: Math.max(0, Number(e.target.value) || 0) })} className="w-full bg-transparent py-2 text-sm text-mist-100 outline-none" placeholder="Coins" />
                  </label>
                  <label className="flex items-center gap-1 rounded-lg border border-line bg-ink-900 px-2" title="Bonus coins">
                    <Gift className="size-3.5 text-petal-400" />
                    <input type="number" min={0} value={p.bonus ?? 0} onChange={(e) => upd(p.id, { bonus: Math.max(0, Number(e.target.value) || 0) })} className="w-full bg-transparent py-2 text-sm text-mist-100 outline-none" placeholder="Bonus" />
                  </label>
                  <label className="flex items-center gap-1 rounded-lg border border-line bg-ink-900 px-2" title="Price">
                    <Banknote className="size-3.5 text-emerald-300" />
                    <input type="number" min={0} value={p.price} onChange={(e) => upd(p.id, { price: Math.max(0, Number(e.target.value) || 0) })} className="w-full bg-transparent py-2 text-sm text-mist-100 outline-none" placeholder="Price" />
                  </label>
                </div>
                {/* What the user actually pays once tax + service charge are applied. */}
                {(fees.taxEnabled || fees.serviceEnabled) && (() => {
                  const b = priceBreakdown(p.price, fees);
                  return (
                    <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5 rounded-lg border border-emerald-500/25 bg-emerald-500/[0.06] px-2.5 py-1.5 text-[11px]">
                      <span className="text-mist-400">{fmtMoney(b.base, qr.currency)}</span>
                      {b.tax > 0 && <span className="text-mist-400">+ {b.taxLabel} {fmtMoney(b.tax, qr.currency)}</span>}
                      {b.service > 0 && <span className="text-mist-400">+ {b.serviceLabel} {fmtMoney(b.service, qr.currency)}</span>}
                      <span className="ml-auto font-bold text-emerald-200">User pays {fmtMoney(b.payable, qr.currency)}</span>
                    </div>
                  );
                })()}
                <div>
                  <div className="flex items-center gap-2">
                    <input value={p.iconUrl} onChange={(e) => upd(p.id, { iconUrl: e.target.value })} placeholder="Paste an image link — or upload →" className={cn(field, "w-full")} />
                    <label className="inline-flex shrink-0 cursor-pointer items-center gap-1.5 rounded-lg border border-line bg-ink-800 px-3 py-2 text-xs font-semibold text-mist-200 hover:text-mist-100" title="Upload a picture from your device">
                      <Upload className="size-3.5" /> Upload
                      <input type="file" accept="image/*" className="hidden" onChange={(e) => onPackageIcon(p.id, e.target.files?.[0])} />
                    </label>
                    {p.iconUrl && (
                      <button onClick={() => upd(p.id, { iconUrl: "" })} title="Remove image" className="grid size-9 shrink-0 place-items-center rounded-lg text-mist-400 hover:bg-rose-500/15 hover:text-rose-300"><Trash2 className="size-4" /></button>
                    )}
                  </div>
                  <p className="mt-1 text-[11px] text-mist-500">Optional picture for this package (e.g. a coin pile or banner). Upload from your device, or paste an image link. Leave empty to use the default coin icon.</p>
                </div>
                <div className="flex flex-wrap items-center gap-1.5">
                  <BadgeBtn label="Most Popular" active={p.badge === "popular"} icon={Star} onClick={() => setBadge(p.id, p.badge === "popular" ? "" : "popular")} />
                  <BadgeBtn label="Best Value" active={p.badge === "best_value"} icon={Tag} onClick={() => setBadge(p.id, p.badge === "best_value" ? "" : "best_value")} />
                  <button onClick={() => upd(p.id, { featured: !p.featured })} className={cn("rounded-md px-2 py-1 text-xs font-semibold", p.featured ? "bg-lotus-500/15 text-lotus-300" : "bg-white/[0.06] text-mist-400")}>Featured</button>
                  <button onClick={() => upd(p.id, { active: !p.active })} className={cn("rounded-md px-2 py-1 text-xs font-semibold", p.active ? "bg-emerald-500/15 text-emerald-300" : "bg-white/[0.06] text-mist-400")}>{p.active ? "Active" : "Inactive"}</button>
                  <button onClick={() => setConfirmDel(p)} className="ml-auto grid size-7 place-items-center rounded-md text-mist-400 hover:bg-rose-500/15 hover:text-rose-300"><Trash2 className="size-4" /></button>
                </div>
              </div>
            </div>
          </Card>
        ))}
      </div>

      {/* Offers */}
      <div className="flex items-center justify-between pt-2">
        <h2 className="flex items-center gap-2 font-semibold text-mist-100"><Gift className="size-4 text-petal-400" /> Promotional offers</h2>
        <Button variant="secondary" size="sm" onClick={addOffer}><Plus className="size-4" /> Add offer</Button>
      </div>
      <div className="space-y-3">
        {offers.map((o) => (
          <Card key={o.id} className={cn("p-4", !o.active && "opacity-60")}>
            <div className="flex flex-wrap items-center gap-2">
              <input value={o.name} onChange={(e) => updOffer(o.id, { name: e.target.value })} placeholder="Offer name (e.g. Diwali bonus)" className={cn(field, "min-w-40 flex-1")} />
              <select value={o.type} onChange={(e) => updOffer(o.id, { type: e.target.value as CoinOffer["type"] })} className={field}>
                <option value="bonus">Bonus coins</option>
                <option value="discount">% discount</option>
              </select>
              <label className="flex items-center gap-1 rounded-lg border border-line bg-ink-900 px-2">
                <input type="number" min={0} value={o.amount} onChange={(e) => updOffer(o.id, { amount: Math.max(0, Number(e.target.value) || 0) })} className="w-16 bg-transparent py-2 text-sm text-mist-100 outline-none" />
                <span className="text-xs text-mist-500">{o.type === "bonus" ? "coins" : "%"}</span>
              </label>
              <button onClick={() => updOffer(o.id, { active: !o.active })} className={cn("rounded-md px-2 py-1.5 text-xs font-semibold", o.active ? "bg-emerald-500/15 text-emerald-300" : "bg-white/[0.06] text-mist-400")}>{o.active ? "Active" : "Inactive"}</button>
              <button onClick={() => setOffers((os) => os.filter((x) => x.id !== o.id))} className="grid size-8 place-items-center rounded-md text-mist-400 hover:bg-rose-500/15 hover:text-rose-300"><Trash2 className="size-4" /></button>
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-mist-400">
              <label className="flex items-center gap-1.5">From <input type="datetime-local" value={o.from ? o.from.slice(0, 16) : ""} onChange={(e) => updOffer(o.id, { from: e.target.value ? new Date(e.target.value).toISOString() : "" })} className={cn(field, "py-1")} /></label>
              <label className="flex items-center gap-1.5">To <input type="datetime-local" value={o.until ? o.until.slice(0, 16) : ""} onChange={(e) => updOffer(o.id, { until: e.target.value ? new Date(e.target.value).toISOString() : "" })} className={cn(field, "py-1")} /></label>
              <span className="text-mist-500">Limited-time &amp; festival offers — leave blank for always-on.</span>
            </div>
          </Card>
        ))}
      </div>

      <Button size="lg" onClick={save} disabled={saving || loading}>
        <Check className="size-4" /> {saving ? "Saving…" : "Save coin store"}
      </Button>
      <p className="text-xs text-mist-500">Selling coins activates once a payment gateway is connected. Every save is recorded in the admin activity log.</p>

      {confirmDel && (
        <ConfirmDialog
          danger
          title="Are you sure you want to delete this coin package?"
          message="This action cannot be undone."
          confirmLabel="Delete Package"
          cancelLabel="Cancel"
          onConfirm={() => {
            setPackages((p) => p.filter((x) => x.id !== confirmDel.id));
            setConfirmDel(null);
            toast("Package removed — remember to Save", "info");
          }}
          onCancel={() => setConfirmDel(null)}
        />
      )}
    </div>
  );
}

/** One line of a price breakdown. */
function Row({ label, value }: { label: string; value: string }) {
  return <div className="flex justify-between"><span>{label}</span><span className="tabular-nums">{value}</span></div>;
}

function BadgeBtn({ label, active, icon: Icon, onClick }: { label: string; active: boolean; icon: typeof Star; onClick: () => void }) {
  return (
    <button onClick={onClick} className={cn("inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-semibold", active ? "bg-gold-400/15 text-gold-300" : "bg-white/[0.06] text-mist-400")}>
      <Icon className="size-3.5" /> {label}
    </button>
  );
}
