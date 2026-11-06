"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Card } from "@/components/ui/Card";
import { Button, ButtonLink } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import { useAuth } from "@/lib/auth";
import { useConfig } from "@/lib/config";
import { priceBreakdown, fmtMoney, type CoinFees } from "@/lib/coin-price";
import { fetchWallet, fetchMyWithdrawals, type WalletSummary, type WalletTransaction, type WithdrawalRow } from "@/lib/wallet";
import { fetchMyKyc, type KycStatus } from "@/lib/kyc";
import { money } from "@/lib/money";
import { uploadPaymentScreenshot, submitCoinPurchase, fetchMyCoinPurchases, type CoinPurchase } from "@/lib/coin-purchase";
import { WithdrawModal, WithdrawStatusPill } from "@/components/WithdrawModal";
import { CaptureGuard } from "@/components/CaptureGuard";
import { FreeCoinsClaim } from "@/components/FreeCoinsClaim";
import { CustomUploads } from "@/components/CustomUploads";
import { withBase } from "@/lib/base-path";
import { cn } from "@/lib/cn";
import { Coins, Plus, ArrowDownCircle, ArrowUpCircle, X, ShieldCheck, Wallet as WalletIcon, Check, Banknote, QrCode, Upload, Clock, Gift } from "lucide-react";

const STATUS: Record<string, string> = {
  success: "bg-emerald-500/15 text-emerald-300",
  pending: "bg-amber-500/15 text-amber-300",
  failed: "bg-rose-500/15 text-rose-300",
};

export default function WalletPage() {
  const { user, updateUser } = useAuth();
  const { config } = useConfig();
  const { toast } = useToast();
  const [wallet, setWallet] = useState<WalletSummary | null>(null);
  const [buying, setBuying] = useState<string | null>(null);
  const [withdrawals, setWithdrawals] = useState<WithdrawalRow[]>([]);
  const [withdrawOpen, setWithdrawOpen] = useState(false);
  const [kycStatus, setKycStatus] = useState<KycStatus>("unverified");
  const [myPurchases, setMyPurchases] = useState<CoinPurchase[]>([]);
  const [calcCoins, setCalcCoins] = useState<string>("");
  const packages = config.coinPackages.filter((p) => p.active);
  const cur = config.paymentQr?.currency || "₹";
  // Coin purchasing runs through the Payment QR (the working checkout). When the
  // admin turns the QR method OFF, buying is unavailable (until it's turned back on).
  const canBuy = config.paymentQr?.enabled !== false;
  // Admin-set tax + service charge added on top of every package price.
  const fees = config.coinFees ?? {};

  const load = () => {
    fetchWallet().then(setWallet);
    fetchMyWithdrawals().then(setWithdrawals);
    fetchMyKyc().then((k) => setKycStatus(k?.status ?? "unverified"));
    fetchMyCoinPurchases().then(setMyPurchases);
  };
  useEffect(() => { load(); }, []);

  const balance = wallet?.balance ?? user?.coins ?? 0;
  const pendingPurchases = myPurchases.filter((p) => p.status === "pending");

  return (
    <div className="mx-auto max-w-3xl">
      {/* Screenshot/recording protection (admin-controlled, admins exempt). */}
      {(config.captureProtection?.allScreens || config.captureProtection?.modules?.wallet !== false) && <CaptureGuard label="wallet" />}
      <h1 className="flex items-center gap-2 font-display text-2xl font-extrabold text-mist-100">
        <WalletIcon className="size-6 text-lotus-300" /> My Wallet
      </h1>
      <p className="mt-1 text-sm text-mist-400">Buy coins and use them for gifts and premium features.</p>

      {/* Timed free-coins claim (renders only when the admin turns it on). */}
      <FreeCoinsClaim className="mt-4" />

      {/* Admin custom uploads targeted at the Wallet page. */}
      <CustomUploads placement="wallet" className="mt-4" />

      <div className="mt-3 flex flex-wrap justify-end gap-2">
        <ButtonLink href="/refer" variant="secondary" size="sm">
          <Gift className="size-4" /> Refer a friend
        </ButtonLink>
        <ButtonLink href="/kyc" variant="secondary" size="sm">
          <ShieldCheck className="size-4" /> KYC &amp; Bank
          {kycStatus === "verified" && <span className="ml-1 rounded-full bg-emerald-500/20 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-300">Verified</span>}
          {(kycStatus === "pending") && <span className="ml-1 rounded-full bg-amber-500/20 px-1.5 py-0.5 text-[10px] font-semibold text-amber-300">Pending</span>}
        </ButtonLink>
        {kycStatus === "verified" ? (
          <Button variant="secondary" onClick={() => setWithdrawOpen(true)}><Banknote className="size-4" /> Social Gifts &amp; Withdrawals</Button>
        ) : (
          <ButtonLink href="/kyc" variant="secondary"><Banknote className="size-4" /> Social Gifts &amp; Withdrawals</ButtonLink>
        )}
      </div>

      {kycStatus !== "verified" && (
        <Card className="mt-3 flex flex-wrap items-center justify-between gap-3 border-amber-500/25 bg-amber-500/[0.06] p-4">
          <p className="flex items-center gap-2 text-sm text-mist-200">
            <ShieldCheck className="size-4 shrink-0 text-amber-300" />
            {kycStatus === "pending" ? "Your KYC is under review — withdrawals unlock once it's verified." : "Verify your identity & bank account to enable withdrawals."}
          </p>
          <Link href="/kyc" className="text-sm font-semibold text-amber-300 hover:text-amber-200">Go to KYC →</Link>
        </Card>
      )}

      {/* Lotus Flower earnings — the withdraw-only balance built up from gifts. */}
      {wallet?.lotusEnabled && (
        <Card className="mt-3 flex items-center gap-4 border-lotus-400/30 bg-gradient-to-r from-lotus-600/20 to-petal-500/10 p-5">
          <span className="grid size-12 shrink-0 place-items-center overflow-hidden rounded-2xl bg-lotus-500/20 text-2xl">
            {wallet.lotusIcon ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={withBase(wallet.lotusIcon)} alt="" className="size-10 object-contain" />
            ) : "🪷"}
          </span>
          <div className="min-w-0 flex-1">
            <div className="font-display text-2xl font-extrabold text-lotus-100">{(wallet.lotus ?? 0).toLocaleString("en-SA")} <span className="text-base font-bold text-lotus-300">{wallet.lotusName ?? "Lotus Flowers"}</span></div>
            <div className="text-xs text-mist-400">Your earnings from social gifts other members sent you. Social Gifts &amp; Withdrawals payouts are made from this balance.</div>
          </div>
          {kycStatus === "verified" && <Button size="sm" onClick={() => setWithdrawOpen(true)}><Banknote className="size-4" /> Withdraw</Button>}
        </Card>
      )}

      {/* Balance + totals — Coins, Lotus currency, and lifetime purchased / spent. */}
      <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="bg-gradient-to-br from-lotus-600/20 to-petal-500/10 p-5">
          <Coins className="size-6 text-gold-300" />
          <div className="mt-2 font-display text-3xl font-extrabold text-mist-100">{(wallet?.balance ?? user?.coins ?? 0).toLocaleString("en-SA")}</div>
          <div className="text-sm text-mist-400">Coin balance</div>
        </Card>
        {/* LOTUS CURRENCY — always shown so the Lotus balance is visible. It becomes
            spendable/withdrawable once the admin turns the Lotus economy ON. */}
        <Card className="bg-gradient-to-br from-lotus-500/15 to-petal-500/10 p-5">
          <span className="grid size-7 place-items-center overflow-hidden rounded-lg text-xl">
            {wallet?.lotusIcon ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={withBase(wallet.lotusIcon)} alt="" className="size-6 object-contain" />
            ) : "🪷"}
          </span>
          <div className="mt-2 font-display text-3xl font-extrabold text-lotus-100">{(wallet?.lotus ?? 0).toLocaleString("en-SA")}</div>
          <div className="text-sm text-mist-400">{wallet?.lotusName || "Lotus"} {!wallet?.lotusEnabled && <span className="text-[10px] text-mist-600">(economy off)</span>}</div>
        </Card>
        <Card className="p-5">
          <ArrowDownCircle className="size-6 text-emerald-300" />
          <div className="mt-2 font-display text-2xl font-extrabold text-mist-100">{(wallet?.totalPurchased ?? 0).toLocaleString("en-SA")}</div>
          <div className="text-sm text-mist-400">Total purchased</div>
        </Card>
        <Card className="p-5">
          <ArrowUpCircle className="size-6 text-petal-400" />
          <div className="mt-2 font-display text-2xl font-extrabold text-mist-100">{(wallet?.totalSpent ?? 0).toLocaleString("en-SA")}</div>
          <div className="text-sm text-mist-400">Total spent</div>
        </Card>
      </div>

      {/* My Lotus Wallet — full wallet-management dashboard: earned / converted /
          withdrawn / pending / processing / rejected + the admin's conversion table.
          All values come from the live server (admin-defined rates & slabs). */}
      {(() => {
        const w = wallet;
        if (!w) return null;
        const lname = w.lotusName || "Lotus";
        const ccy = w.lotusCurrency || "SAR";
        const n = (v?: number) => (v ?? 0).toLocaleString("en-SA");
        const m = (v?: number) => `${ccy} ${(v ?? 0).toLocaleString("en-SA", { maximumFractionDigits: 2 })}`;
        const tiers = w.conversionTiers ?? [];
        return (
          <Card className="mt-4 p-5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="flex items-center gap-2 font-semibold text-mist-100">
                <span className="text-lg">🪷</span> {lname} wallet
              </h2>
              {!w.lotusEnabled && <span className="rounded-full bg-white/[0.06] px-2.5 py-1 text-[10px] font-semibold text-mist-400">Economy off — earnings start once the admin turns it on</span>}
            </div>

            {/* Dashboard stats */}
            <div className="mt-3 grid grid-cols-2 gap-2.5 sm:grid-cols-4">
              <div className="rounded-xl border border-lotus-400/25 bg-lotus-500/[0.07] p-3">
                <div className="text-[11px] text-mist-400">Available {lname}</div>
                <div className="mt-0.5 font-display text-xl font-extrabold text-lotus-100">{n(w.lotus)}</div>
                <div className="text-[10px] text-mist-500">≈ {m(w.lotusValue)}</div>
              </div>
              <div className="rounded-xl border border-line bg-ink-800/50 p-3">
                <div className="text-[11px] text-mist-400">Total earned</div>
                <div className="mt-0.5 font-display text-xl font-extrabold text-mist-100">{n(w.totalEarnedLotus)}</div>
                <div className="text-[10px] text-mist-500">{lname} lifetime</div>
              </div>
              <div className="rounded-xl border border-line bg-ink-800/50 p-3">
                <div className="text-[11px] text-mist-400">Total converted</div>
                <div className="mt-0.5 font-display text-xl font-extrabold text-mist-100">{n(w.totalConvertedLotus)}</div>
                <div className="text-[10px] text-mist-500">{lname} → cash requests</div>
              </div>
              <div className="rounded-xl border border-emerald-400/25 bg-emerald-500/[0.06] p-3">
                <div className="text-[11px] text-emerald-300/80">Total withdrawn</div>
                <div className="mt-0.5 font-display text-xl font-extrabold text-emerald-200">{m(w.totalWithdrawn)}</div>
                <div className="text-[10px] text-mist-500">{n(w.totalWithdrawnLotus)} {lname} paid out</div>
              </div>
              <div className="rounded-xl border border-amber-400/25 bg-amber-500/[0.05] p-3">
                <div className="text-[11px] text-amber-300/90">Pending withdrawal</div>
                <div className="mt-0.5 font-display text-xl font-extrabold text-amber-200">{m(w.pendingWithdrawals?.value)}</div>
                <div className="text-[10px] text-mist-500">{w.pendingWithdrawals?.count ?? 0} request{(w.pendingWithdrawals?.count ?? 0) === 1 ? "" : "s"} · {n(w.pendingWithdrawals?.lotus)} {lname}</div>
              </div>
              <div className="rounded-xl border border-sky-400/25 bg-sky-500/[0.05] p-3">
                <div className="text-[11px] text-sky-300/90">Processing</div>
                <div className="mt-0.5 font-display text-xl font-extrabold text-sky-200">{m(w.processingWithdrawals?.value)}</div>
                <div className="text-[10px] text-mist-500">{w.processingWithdrawals?.count ?? 0} approved · being paid</div>
              </div>
              <div className="rounded-xl border border-rose-400/25 bg-rose-500/[0.05] p-3">
                <div className="text-[11px] text-rose-300/90">Rejected</div>
                <div className="mt-0.5 font-display text-xl font-extrabold text-rose-200">{w.rejectedWithdrawals?.count ?? 0}</div>
                <div className="text-[10px] text-mist-500">{n(w.rejectedWithdrawals?.lotus)} {lname} refunded</div>
              </div>
              <div className="rounded-xl border border-gold-400/30 bg-gold-500/[0.06] p-3">
                <div className="text-[11px] text-gold-300/90">Eligible withdrawal</div>
                <div className="mt-0.5 font-display text-xl font-extrabold text-gold-200">{m(w.eligibleAmount)}</div>
                <div className="text-[10px] text-mist-500">{w.eligibleTier ? `${n(w.eligibleTier.lotus)} ${lname} slab` : (w.eligibleAmount ?? 0) > 0 ? "at the current rate" : `need ${n(w.minWithdraw)} ${lname} min`}</div>
              </div>
            </div>

            {/* Conversion value table — the admin-defined slabs, live from the server. */}
            {tiers.length > 0 && (
              <div className="mt-4">
                <h3 className="text-xs font-bold uppercase tracking-wide text-mist-400">{lname} conversion values</h3>
                <div className="mt-2 overflow-x-auto rounded-xl border border-line">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-white/5 bg-ink-800/60 text-left text-[11px] uppercase tracking-wide text-mist-500">
                        <th className="px-4 py-2.5 font-semibold">{lname}</th>
                        <th className="px-4 py-2.5 text-right font-semibold">Withdrawal value</th>
                        <th className="px-4 py-2.5 text-right font-semibold">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {tiers.map((t) => {
                        const can = (w.lotus ?? 0) >= t.lotus;
                        return (
                          <tr key={t.id} className={cn("border-b border-white/5 last:border-0", can && "bg-emerald-500/[0.04]")}>
                            <td className="px-4 py-2.5 font-semibold text-lotus-200">🪷 {n(t.lotus)}</td>
                            <td className="px-4 py-2.5 text-right font-bold text-emerald-300">{m(t.value)}</td>
                            <td className="px-4 py-2.5 text-right">
                              {can
                                ? <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-bold text-emerald-300">Eligible ✓</span>
                                : <span className="text-[10px] text-mist-500">need {n(t.lotus - (w.lotus ?? 0))} more</span>}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                <p className="mt-1.5 text-[10px] text-mist-600">Values are set by the admin and may change. GST/service fee (if any) is shown before you confirm a withdrawal.</p>
              </div>
            )}
          </Card>
        );
      })()}

      {/* Withdrawal calculator — coins → Lotus → cash, using the admin's live rates. */}
      {wallet?.lotusEnabled && config.lotus && (() => {
        const l = config.lotus!;
        const rate = l.coinToLotus ?? 0; // Lotus per 1 coin
        // Example line, robust to either direction of the rate (e.g. "100 coins = 1
        // Lotus" when rate < 1, or "1 coin = 100 Lotus" when rate >= 1).
        const rateLine = rate <= 0 ? ""
          : rate < 1 ? `${Math.round(1 / rate).toLocaleString("en-SA")} coins = 1 ${l.name || "Lotus"}`
          : `1 coin = ${(Math.round(rate * 100) / 100).toLocaleString("en-SA")} ${l.name || "Lotus"}`;
        const coins = Math.max(0, Math.floor(Number(calcCoins) || 0));
        const lotus = Math.round(coins * rate * 100) / 100;
        const cash = Math.round(lotus * (l.lotusToCurrency ?? 0) * 100) / 100;
        const lname = wallet.lotusName || l.name || "Lotus";
        const ccy = l.currency || "SAR";
        return (
          <Card className="mt-4 p-5">
            <h2 className="flex items-center gap-2 font-semibold text-mist-100"><ArrowDownCircle className="size-4 text-emerald-300" /> Withdrawal calculator</h2>
            <p className="mt-0.5 text-xs text-mist-400">See exactly what your coins are worth before you withdraw. {rateLine}{(l.lotusToCurrency ?? 0) > 0 ? ` · 1 ${lname} = ${ccy} ${l.lotusToCurrency}` : ""}.</p>
            <div className="mt-3 flex flex-wrap items-end gap-3">
              <label className="block">
                <span className="mb-1 block text-xs font-semibold text-mist-300">Coins to convert</span>
                <input type="number" min={0} value={calcCoins} onChange={(e) => setCalcCoins(e.target.value)} placeholder={String(wallet?.balance ?? 0)} className="h-11 w-40 rounded-lg border border-line bg-ink-800 px-3 text-lg font-bold text-mist-100 outline-none focus:border-lotus-400" />
              </label>
              <button onClick={() => setCalcCoins(String(wallet?.balance ?? 0))} className="mb-0.5 rounded-lg bg-white/[0.06] px-3 py-2 text-xs font-semibold text-mist-300 hover:bg-white/[0.12]">Use my balance</button>
            </div>
            <div className="mt-3 grid grid-cols-3 gap-3 text-center">
              <div className="rounded-xl border border-line bg-ink-800/50 p-3"><div className="text-xs text-mist-500">Coins</div><div className="mt-0.5 font-display text-lg font-extrabold text-mist-100">{coins.toLocaleString("en-SA")}</div></div>
              <div className="rounded-xl border border-line bg-ink-800/50 p-3"><div className="text-xs text-mist-500">{lname} received</div><div className="mt-0.5 font-display text-lg font-extrabold text-lotus-200">{lotus.toLocaleString("en-SA")}</div></div>
              <div className="rounded-xl border border-emerald-400/30 bg-emerald-500/[0.08] p-3"><div className="text-xs text-emerald-300/80">Final amount</div><div className="mt-0.5 font-display text-lg font-extrabold text-emerald-200">{ccy} {cash.toLocaleString("en-SA")}</div></div>
            </div>
            <p className="mt-2 text-[11px] text-mist-600">Estimate before any withdrawal fee/GST set by the admin. Withdrawals are made from your {lname} balance once your KYC is verified.</p>
          </Card>
        );
      })()}

      {/* Pending purchases awaiting admin verification */}
      {pendingPurchases.length > 0 && (
        <Card className="mt-4 border-amber-500/25 bg-amber-500/[0.06] p-4">
          <p className="flex items-center gap-2 text-sm font-semibold text-amber-200"><Clock className="size-4 shrink-0" /> Awaiting verification</p>
          <div className="mt-2 space-y-1.5">
            {pendingPurchases.map((p) => (
              <p key={p.id} className="text-xs text-amber-100/90">
                {p.packageName} — <b>{(p.coins + (p.bonus ?? 0)).toLocaleString("en-SA")}</b> coins for {p.currency}{p.price}. An admin is verifying your payment; coins will be added once approved.
              </p>
            ))}
          </div>
        </Card>
      )}

      {/* Add coins */}
      <h2 className="mt-7 flex items-center gap-2 font-semibold text-mist-100"><Plus className="size-4 text-lotus-300" /> Buy coins</h2>
      {!canBuy ? (
        <Card className="mt-3 p-5 text-center text-sm text-mist-400">Buying coins is temporarily unavailable. Please check back soon.</Card>
      ) : (
      <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
        {packages.map((p) => (
          <button
            key={p.id}
            onClick={() => setBuying(p.id)}
            className="relative rounded-xl border border-line bg-ink-850 p-4 text-center transition hover:border-lotus-400/50 hover:bg-ink-800"
          >
            {p.badge === "popular" && <span className="absolute -top-2 left-1/2 -translate-x-1/2 rounded-full bg-lotus-500 px-2 py-0.5 text-[9px] font-bold uppercase text-white">Most popular</span>}
            {p.badge === "best_value" && <span className="absolute -top-2 left-1/2 -translate-x-1/2 rounded-full bg-gold-500 px-2 py-0.5 text-[9px] font-bold uppercase text-amber-950">Best value</span>}
            <Coins className="mx-auto size-7 text-gold-300" />
            <div className="mt-2 font-display text-lg font-bold text-mist-100">{p.coins.toLocaleString("en-SA")}</div>
            <div className="text-xs text-mist-400">coins</div>
            {p.bonus && p.bonus > 0 ? (
              <div className="mt-1 inline-flex items-center gap-0.5 rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-bold text-emerald-300"><Gift className="size-3" /> +{p.bonus.toLocaleString("en-SA")} bonus</div>
            ) : null}
            {/* Show the ALL-IN price so nobody is surprised at checkout. */}
            {(() => {
              const b = priceBreakdown(p.price, fees);
              return (
                <>
                  <div className="mt-2 inline-flex items-center gap-0.5 rounded-full bg-lotus-500/15 px-2.5 py-0.5 text-sm font-bold text-lotus-200">{fmtMoney(b.payable, cur)}</div>
                  {b.hasExtras && <div className="mt-0.5 text-[10px] text-mist-500">incl. {[b.tax > 0 && b.taxLabel, b.service > 0 && b.serviceLabel].filter(Boolean).join(" + ")}</div>}
                </>
              );
            })()}
          </button>
        ))}
        {packages.length === 0 && <p className="col-span-3 text-sm text-mist-500">No coin packages available right now.</p>}
      </div>
      )}

      {/* Transaction history */}
      <h2 className="mt-7 font-semibold text-mist-100">Transaction history</h2>
      <Card className="mt-3 overflow-hidden p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/5 text-left text-xs uppercase tracking-wide text-mist-500">
                <th className="px-4 py-3 font-semibold">Date</th>
                <th className="px-4 py-3 font-semibold">Transaction ID</th>
                <th className="px-4 py-3 font-semibold">Description</th>
                <th className="px-4 py-3 font-semibold">Coins</th>
                <th className="px-4 py-3 font-semibold">Amount</th>
                <th className="px-4 py-3 font-semibold">Status</th>
                <th className="px-4 py-3 font-semibold">Balance</th>
              </tr>
            </thead>
            <tbody>
              {(wallet?.transactions ?? []).map((t: WalletTransaction) => {
                const credit = t.type === "purchase" || t.type === "credit";
                return (
                  <tr key={t.id} className="border-b border-white/5 last:border-0">
                    <td className="px-4 py-3 text-xs text-mist-400">{new Date(t.createdAt).toLocaleString("en-SA", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</td>
                    <td className="px-4 py-3 font-mono text-[11px] text-mist-500">{t.id}</td>
                    <td className="px-4 py-3 text-mist-200">{t.description}</td>
                    <td className={cn("px-4 py-3 font-semibold tabular-nums", credit ? "text-emerald-300" : "text-petal-300")}>{credit ? "+" : "−"}{t.coins.toLocaleString("en-SA")}</td>
                    <td className="px-4 py-3 text-mist-400">{t.amount ? money(t.amount) : "—"}</td>
                    <td className="px-4 py-3"><span className={cn("rounded-full px-2 py-0.5 text-[11px] font-semibold capitalize", STATUS[t.status])}>{t.status}</span></td>
                    <td className="px-4 py-3 tabular-nums text-mist-300">{t.balanceAfter.toLocaleString("en-SA")}</td>
                  </tr>
                );
              })}
              {(!wallet || wallet.transactions.length === 0) && (
                <tr><td colSpan={7} className="px-4 py-8 text-center text-sm text-mist-500">No transactions yet — buy your first coins above.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Coin purchase requests (QR/UPI) + their status */}
      {myPurchases.length > 0 && (
        <>
          <h2 className="mt-7 flex items-center gap-2 font-semibold text-mist-100"><QrCode className="size-4 text-lotus-300" /> Coin purchase requests</h2>
          <Card className="mt-3 overflow-hidden p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-white/5 text-left text-xs uppercase tracking-wide text-mist-500">
                    <th className="px-4 py-3 font-semibold">Date</th>
                    <th className="px-4 py-3 font-semibold">Package</th>
                    <th className="px-4 py-3 font-semibold">Coins</th>
                    <th className="px-4 py-3 font-semibold">Paid</th>
                    <th className="px-4 py-3 font-semibold">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {myPurchases.map((p) => (
                    <tr key={p.id} className="border-b border-white/5 last:border-0">
                      <td className="px-4 py-3 text-xs text-mist-400">{new Date(p.at).toLocaleString("en-SA", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</td>
                      <td className="px-4 py-3 text-mist-200">{p.packageName}</td>
                      <td className="px-4 py-3 font-semibold tabular-nums text-emerald-300">+{(p.coins + (p.bonus ?? 0)).toLocaleString("en-SA")}</td>
                      <td className="px-4 py-3 text-mist-400">{p.currency}{p.price.toLocaleString("en-SA")}</td>
                      <td className="px-4 py-3">
                        <span className={cn("rounded-full px-2 py-0.5 text-[11px] font-semibold capitalize", p.status === "approved" ? "bg-emerald-500/15 text-emerald-300" : p.status === "rejected" ? "bg-rose-500/15 text-rose-300" : "bg-amber-500/15 text-amber-300")}>
                          {p.status === "pending" ? "Pending verification" : p.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </>
      )}

      {/* Withdrawal requests */}
      {withdrawals.length > 0 && (
        <>
          <h2 className="mt-7 flex items-center gap-2 font-semibold text-mist-100"><Banknote className="size-4 text-emerald-300" /> Withdrawal requests</h2>
          <Card className="mt-3 overflow-hidden p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-white/5 text-left text-xs uppercase tracking-wide text-mist-500">
                    <th className="px-4 py-3 font-semibold">Date</th>
                    <th className="px-4 py-3 font-semibold">Coins</th>
                    <th className="px-4 py-3 font-semibold">Amount</th>
                    <th className="px-4 py-3 font-semibold">Method</th>
                    <th className="px-4 py-3 font-semibold">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {withdrawals.map((w) => (
                    <tr key={w.id} className="border-b border-white/5 last:border-0">
                      <td className="px-4 py-3 text-xs text-mist-400">{new Date(w.at).toLocaleString("en-SA", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</td>
                      <td className="px-4 py-3 font-semibold tabular-nums text-petal-300">−{w.coins.toLocaleString("en-SA")}</td>
                      <td className="px-4 py-3 font-semibold text-emerald-300">{w.currency ? `${w.currency} ${(w.netAmount ?? w.amountINR).toLocaleString("en-SA")}` : money(w.netAmount ?? w.amountINR)}</td>
                      <td className="px-4 py-3 text-mist-300">{w.method}</td>
                      <td className="px-4 py-3"><WithdrawStatusPill status={w.status} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </>
      )}

      {buying && (
        <QrPayModal
          pkg={packages.find((p) => p.id === buying)!}
          qr={config.paymentQr}
          cur={cur}
          fees={fees}
          showBreakdown={config.coinFees?.showBreakdown !== false}
          myId={user?.publicId ?? ""}
          onClose={() => setBuying(null)}
          onDone={() => { setBuying(null); toast("Payment submitted — coins will be added after admin verification.", "success"); load(); }}
        />
      )}

      {withdrawOpen && (
        <WithdrawModal
          balance={balance}
          lotusBalance={wallet?.lotus ?? 0}
          onClose={() => setWithdrawOpen(false)}
          onDone={(nb) => { setWithdrawOpen(false); if (!wallet?.lotusEnabled && nb !== undefined) updateUser({ coins: nb }); load(); }}
        />
      )}
    </div>
  );
}

function QrPayModal({
  pkg,
  qr,
  cur,
  fees,
  showBreakdown,
  myId,
  onClose,
  onDone,
}: {
  pkg: { id: string; name: string; coins: number; price: number; bonus?: number };
  qr?: { imageUrl: string; upiId?: string; note?: string; currency?: string };
  cur: string;
  fees: CoinFees;
  showBreakdown: boolean;
  myId: string;
  onClose: () => void;
  onDone: () => void;
}) {
  const { toast } = useToast();
  const [ref, setRef] = useState("");
  const [idNum, setIdNum] = useState(myId);
  const [shotUrl, setShotUrl] = useState("");
  const [shotName, setShotName] = useState("");
  const [uploading, setUploading] = useState(false);
  const [busy, setBusy] = useState(false);
  const total = pkg.coins + (pkg.bonus ?? 0);
  // Tax + service charge come from admin config, via the one shared calculator,
  // so this is exactly what the server will record and the admin will verify.
  const bd = priceBreakdown(pkg.price, fees);

  const pickShot = async (file: File | undefined) => {
    if (!file) return;
    setUploading(true);
    const res = await uploadPaymentScreenshot(file);
    setUploading(false);
    if (res.ok && res.url) { setShotUrl(res.url); setShotName(res.name ?? ""); }
    else toast(res.error ?? "Could not upload the screenshot", "error");
  };

  const submit = async () => {
    if (!shotUrl) return toast("Please upload your payment screenshot first", "error");
    setBusy(true);
    const res = await submitCoinPurchase({ packageId: pkg.id, screenshotUrl: shotUrl, screenshotName: shotName, paymentRef: ref.trim() || undefined, userIdNumber: idNum.trim() || undefined });
    setBusy(false);
    if (res.ok) onDone();
    else toast(res.error ?? "Could not submit your purchase", "error");
  };

  return (
    <div className="fixed inset-0 z-[120] grid place-items-center overflow-y-auto bg-black/60 p-4" onClick={onClose}>
      <div className="my-8 w-full max-w-sm rounded-2xl border border-white/10 bg-ink-850 p-5" onClick={(e) => e.stopPropagation()}>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-display text-lg font-bold text-mist-100">Pay &amp; get coins</h2>
          <button onClick={onClose} className="text-mist-400 hover:text-mist-100"><X className="size-5" /></button>
        </div>

        {/* Package summary + what the amount is made up of */}
        <div className="rounded-xl border border-line bg-ink-800 p-4 text-center">
          <Coins className="mx-auto size-7 text-gold-300" />
          <div className="mt-1.5 font-display text-2xl font-extrabold text-mist-100">{total.toLocaleString("en-SA")} coins</div>
          {pkg.bonus && pkg.bonus > 0 ? <div className="text-[11px] font-semibold text-emerald-300">{pkg.coins.toLocaleString("en-SA")} + {pkg.bonus.toLocaleString("en-SA")} bonus</div> : null}
          {bd.hasExtras && showBreakdown && (
            <div className="mt-3 space-y-1 border-t border-line/70 pt-3 text-left text-xs text-mist-400">
              <div className="flex justify-between"><span>Package price</span><span className="tabular-nums">{fmtMoney(bd.base, cur)}</span></div>
              {bd.tax > 0 && <div className="flex justify-between"><span>{bd.taxLabel} ({bd.taxPct}%)</span><span className="tabular-nums">{fmtMoney(bd.tax, cur)}</span></div>}
              {bd.service > 0 && <div className="flex justify-between"><span>{bd.serviceLabel}</span><span className="tabular-nums">{fmtMoney(bd.service, cur)}</span></div>}
            </div>
          )}
          <div className="mt-2.5 inline-flex items-center rounded-full bg-lotus-500/15 px-3 py-0.5 text-sm font-bold text-lotus-200">Pay {fmtMoney(bd.payable, cur)}</div>
        </div>

        {/* Admin QR */}
        <div className="mt-4 flex flex-col items-center">
          {qr?.imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={qr.imageUrl} alt="Payment QR" className="size-48 rounded-xl border border-white/10 bg-white object-contain p-1.5" />
          ) : (
            <div className="grid size-48 place-items-center rounded-xl border border-dashed border-white/15 bg-ink-900 text-center text-xs text-mist-500">
              <span><QrCode className="mx-auto mb-1 size-7 text-mist-600" />Payment QR not set yet.<br />Please contact support.</span>
            </div>
          )}
          {qr?.upiId && <p className="mt-2 rounded-lg bg-ink-800 px-3 py-1 text-xs font-semibold text-mist-200">UPI: {qr.upiId}</p>}
        </div>
        {qr?.note && <p className="mt-2 text-center text-[11px] text-mist-400">{qr.note}</p>}

        {/* User ID — so the admin can match the payment to your account */}
        <label className="mt-4 block text-xs font-semibold text-mist-300">Your User ID</label>
        <input value={idNum} onChange={(e) => setIdNum(e.target.value)} placeholder="Your User ID (see your profile)" className="mt-1 h-10 w-full rounded-lg border border-line bg-ink-800 px-3 text-sm font-mono text-mist-100 outline-none focus:border-lotus-400" />

        {/* Payment reference (optional) */}
        <label className="mt-3 block text-xs font-semibold text-mist-300">Payment reference / UTR (optional)</label>
        <input value={ref} onChange={(e) => setRef(e.target.value)} placeholder="e.g. 4012xxxx" className="mt-1 h-10 w-full rounded-lg border border-line bg-ink-800 px-3 text-sm text-mist-100 outline-none focus:border-lotus-400" />

        {/* Screenshot upload (required) */}
        <label className="mt-3 block text-xs font-semibold text-mist-300">Upload payment screenshot <span className="text-rose-300">*</span></label>
        <label className={cn("mt-1 flex cursor-pointer items-center justify-center gap-2 rounded-xl border border-dashed px-3 py-3 text-sm transition", shotUrl ? "border-emerald-400/50 bg-emerald-500/10 text-emerald-200" : "border-line bg-ink-800 text-mist-300 hover:border-lotus-400/40")}>
          {uploading ? <>Uploading…</> : shotUrl ? <><Check className="size-4" /> Screenshot attached — tap to replace</> : <><Upload className="size-4" /> Choose screenshot</>}
          <input type="file" accept="image/*" className="hidden" onChange={(e) => pickShot(e.target.files?.[0])} />
        </label>
        {shotUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={shotUrl} alt="Payment proof" className="mt-2 max-h-40 w-full rounded-lg border border-white/10 object-contain" />
        )}

        <p className="mt-3 flex items-center gap-1.5 text-xs text-mist-400">
          <ShieldCheck className="size-3.5 text-emerald-300" /> Coins are added after an admin verifies your payment.
        </p>
        <Button block size="lg" className="mt-3" onClick={submit} disabled={busy || uploading || !shotUrl}>
          {busy ? "Submitting…" : "I've paid — submit for verification"}
        </Button>
      </div>
    </div>
  );
}
