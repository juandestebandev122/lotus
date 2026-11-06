"use client";

import { useEffect, useState } from "react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import { useConfig, saveConfig, type RewardRule } from "@/lib/config";
import { cn } from "@/lib/cn";
import { Gift, Coins, Check } from "lucide-react";

const PACKAGES = [
  { coins: 500, price: "₹49" },
  { coins: 1200, price: "₹99" },
  { coins: 3000, price: "₹199" },
  { coins: 8000, price: "₹499" },
];

export default function AdminRewardsPage() {
  const { config, loading, reload } = useConfig();
  const { toast } = useToast();
  const [rewards, setRewards] = useState<RewardRule[]>(config.rewards);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!loading) setRewards(config.rewards);
  }, [loading, config]);

  const toggle = (id: string) => setRewards((rs) => rs.map((r) => (r.id === id ? { ...r, on: !r.on } : r)));
  const setCoins = (id: string, coins: number) =>
    setRewards((rs) => rs.map((r) => (r.id === id ? { ...r, coins } : r)));

  const save = async () => {
    setSaving(true);
    const res = await saveConfig({ rewards });
    setSaving(false);
    if (!res.ok) {
      toast(res.error ?? "Could not save", "error");
      return;
    }
    await reload();
    toast("Reward settings saved", "success");
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-extrabold text-mist-100">Rewards &amp; coins</h1>
        <p className="text-sm text-mist-400">Configure daily rewards, bonuses and coin packages.</p>
      </div>

      <Card className="p-5">
        <h2 className="flex items-center gap-2 font-semibold text-mist-100">
          <Gift className="size-4 text-petal-400" /> Reward rules
        </h2>
        <div className="mt-4 space-y-2">
          {rewards.map((r) => (
            <div key={r.id} className="flex flex-wrap items-center gap-3 rounded-xl border border-line bg-ink-800 px-3 py-2.5">
              <span className="text-sm font-semibold text-mist-100">{r.label}</span>
              <div className="ml-auto flex items-center gap-3">
                <div className="flex items-center gap-1.5 rounded-lg bg-gold-400/12 px-2.5 py-1 text-sm font-semibold text-gold-300">
                  <Coins className="size-3.5" />
                  <input
                    type="number"
                    value={r.coins}
                    min={0}
                    onChange={(e) => setCoins(r.id, Math.max(0, Number(e.target.value)))}
                    className="w-16 bg-transparent text-right outline-none"
                  />
                </div>
                <button
                  onClick={() => toggle(r.id)}
                  className={cn("relative h-6 w-11 rounded-full transition-colors", r.on ? "bg-emerald-500" : "bg-ink-700")}
                  aria-label="Toggle reward"
                >
                  <span className={cn("absolute top-0.5 size-5 rounded-full bg-white transition-all", r.on ? "left-[22px]" : "left-0.5")} />
                </button>
              </div>
            </div>
          ))}
        </div>
        <Button className="mt-4" onClick={save} disabled={saving || loading}>
          <Check className="size-4" /> {saving ? "Saving…" : "Save rewards"}
        </Button>
      </Card>

      <Card className="p-5">
        <h2 className="flex items-center gap-2 font-semibold text-mist-100">
          <Coins className="size-4 text-gold-300" /> Coin packages
        </h2>
        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {PACKAGES.map((p) => (
            <div key={p.coins} className="rounded-xl border border-line bg-ink-800 p-4 text-center">
              <Coins className="mx-auto size-6 text-gold-300" />
              <div className="mt-2 font-display text-lg font-bold text-mist-100">{p.coins.toLocaleString("en-SA")}</div>
              <div className="text-xs text-mist-400">coins</div>
              <div className="mt-2 inline-flex items-center gap-1 rounded-full bg-lotus-500/15 px-2.5 py-0.5 text-xs font-semibold text-lotus-200">
                {p.price}
              </div>
            </div>
          ))}
        </div>
        <p className="mt-3 text-xs text-mist-500">Coin purchasing is display-only until a payment gateway is connected.</p>
      </Card>
    </div>
  );
}
