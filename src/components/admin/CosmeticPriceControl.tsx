"use client";

import { useState } from "react";
import { useToast } from "@/components/ui/Toast";
import { cn } from "@/lib/cn";
import { grantCosmetic, KIND_LABEL, type CosmeticKind } from "@/lib/cosmetic-shop";
import { Coins, Gift, Loader2, Check, Clock } from "lucide-react";

// ONE control, used on Dice Styles, the Game Board library and Token Management,
// so pricing works identically wherever a design is created.
//
//   • set a coin price   → the design appears in the Store on its own
//   • leave it at 0      → it stays FREE for everyone, exactly as before
//   • "Give it free"     → hand it to one member, or to everyone, at no charge
//
// The price is part of the design, so the admin never has to create a separate
// store entry or keep two things in step.
// The same validity choices the Frame Store offers, so both read identically.
const VALIDITY = [
  { v: 0, label: "Permanent" }, { v: 1, label: "1 day" }, { v: 3, label: "3 days" }, { v: 7, label: "7 days" },
  { v: 15, label: "15 days" }, { v: 30, label: "30 days" }, { v: 60, label: "60 days" }, { v: 90, label: "90 days" },
  { v: 180, label: "180 days" }, { v: 365, label: "365 days" },
];

export function CosmeticPriceControl({
  kind, id, price, onPrice, validityDays, onValidity, saved, className,
}: {
  kind: CosmeticKind;
  id: string;
  price: number;
  onPrice: (v: number) => void;
  validityDays?: number;
  onValidity?: (v: number) => void;
  /** false while the page has unsaved changes — giving it away needs the
   *  design (and its price) to exist on the server first. */
  saved?: boolean;
  className?: string;
}) {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [target, setTarget] = useState("");
  const [busy, setBusy] = useState(false);
  const paid = price > 0;

  const give = async () => {
    const who = target.trim();
    if (!who) { toast("Enter a member's name, User ID, or type all", "error"); return; }
    setBusy(true);
    const res = await grantCosmetic(kind, id, who);
    setBusy(false);
    if (res.ok) {
      toast(res.count === 0 ? "They already have it — nothing to do." : `Given free to ${res.count} member${res.count === 1 ? "" : "s"} ✓`, "success");
      setTarget(""); setOpen(false);
    } else toast(res.error ?? "Could not give the item", "error");
  };

  return (
    <div className={cn("flex flex-wrap items-center gap-2", className)}>
      <label className="inline-flex items-center gap-1.5 text-xs font-semibold text-mist-400" title="0 = free for everyone. Any price puts it in the Store.">
        <Coins className={cn("size-3.5", paid ? "text-amber-300" : "text-mist-500")} />
        <input
          type="number"
          min={0}
          value={price || 0}
          onChange={(e) => onPrice(Math.max(0, Math.floor(Number(e.target.value) || 0)))}
          className="h-8 w-24 rounded-lg border border-line bg-ink-900 px-2 text-sm text-mist-100 outline-none focus:border-lotus-400"
        />
        <span className={cn("text-[11px]", paid ? "text-amber-300" : "text-mist-500")}>
          {paid ? "coins — in the Store" : "Free for everyone"}
        </span>
      </label>

      {/* HOW LONG IT LASTS — same choices as the Frame Store. */}
      {paid && onValidity && (
        <label className="inline-flex items-center gap-1.5 text-xs font-semibold text-mist-400" title="How long the purchase lasts. Permanent = it never expires.">
          <Clock className="size-3.5 text-mist-500" />
          <select
            value={validityDays ?? 0}
            onChange={(e) => onValidity(Math.max(0, Math.floor(Number(e.target.value) || 0)))}
            className="h-8 rounded-lg border border-line bg-ink-900 px-2 text-xs font-semibold text-mist-100 outline-none focus:border-lotus-400"
          >
            {VALIDITY.map((v) => <option key={v.v} value={v.v}>{v.label}</option>)}
          </select>
        </label>
      )}

      {paid && (
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          disabled={saved === false}
          title={saved === false ? "Save your changes first, then you can give it away" : `Give this ${KIND_LABEL[kind].toLowerCase()} to someone free`}
          className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-emerald-400/30 bg-emerald-500/10 px-2.5 text-xs font-semibold text-emerald-200 transition hover:bg-emerald-500/20 disabled:opacity-40"
        >
          <Gift className="size-3.5" /> Give free
        </button>
      )}

      {open && paid && (
        <div className="flex w-full flex-wrap items-center gap-2 rounded-lg border border-emerald-400/25 bg-emerald-500/[0.06] p-2">
          <input
            value={target}
            onChange={(e) => setTarget(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") void give(); }}
            placeholder="Member name, User ID, or “all” for everyone"
            className="h-8 min-w-[16rem] flex-1 rounded-lg border border-line bg-ink-900 px-2 text-sm text-mist-100 outline-none focus:border-emerald-400/60"
          />
          <button
            type="button"
            onClick={give}
            disabled={busy}
            className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-emerald-500 px-3 text-xs font-bold text-white transition hover:bg-emerald-400 disabled:opacity-50"
          >
            {busy ? <Loader2 className="size-3.5 animate-spin" /> : <Check className="size-3.5" />} Give it
          </button>
          <button type="button" onClick={() => { setOpen(false); setTarget(""); }} className="text-xs font-semibold text-mist-400 hover:text-mist-100">Cancel</button>
          <p className="w-full text-[11px] text-mist-500">
            They get it free of charge and are notified. Nobody is charged and no coins move.
            {(validityDays ?? 0) > 0
              ? ` It lasts ${validityDays} day${validityDays === 1 ? "" : "s"}, the same as buying it.`
              : " It is theirs permanently."}
          </p>
        </div>
      )}
    </div>
  );
}
