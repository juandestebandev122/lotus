"use client";

import { useEffect, useState } from "react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import { useConfig, saveConfig } from "@/lib/config";
import { cn } from "@/lib/cn";
import { Check, Coins, Pencil, Video, Users, Gamepad2, Mic } from "lucide-react";

export default function AdminFeaturePricingPage() {
  const { config, loading, reload } = useConfig();
  const { toast } = useToast();
  const [nameCost, setNameCost] = useState(0);
  const [videoCost, setVideoCost] = useState(0);
  const [extraRoomCost, setExtraRoomCost] = useState(1000);
  const [coHostLimit, setCoHostLimit] = useState(3);
  const [coHostSlotCost, setCoHostSlotCost] = useState(500);
  const [videoEnabled, setVideoEnabled] = useState(true);
  const [games, setGames] = useState(config.games);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!loading) {
      setNameCost(config.featurePricing?.roomNameChange ?? 500);
      setVideoCost(config.featurePricing?.videoUnlock ?? 1000);
      setExtraRoomCost(config.featurePricing?.extraPublicRoom ?? 1000);
      setCoHostSlotCost(config.featurePricing?.coHostSlot ?? 500);
      setCoHostLimit(config.coHostLimit ?? 3);
      setVideoEnabled(config.roomControls?.videoEnabled ?? true);
      setGames(config.games.map((g) => ({ ...g })));
    }
  }, [loading, config]);

  const save = async () => {
    setSaving(true);
    const res = await saveConfig({
      featurePricing: { roomNameChange: Math.max(0, nameCost), videoUnlock: Math.max(0, videoCost), coHostSlot: Math.max(0, coHostSlotCost), extraPublicRoom: Math.max(0, extraRoomCost) },
      coHostLimit: Math.max(0, Math.min(20, coHostLimit)),
      roomControls: { ...config.roomControls, videoEnabled },
      games,
    });
    setSaving(false);
    if (res.ok) {
      await reload();
      toast("Feature settings saved — live now", "success");
    } else {
      toast(res.error ?? "Could not save", "error");
    }
  };

  const numField = "w-32 rounded-xl border border-line bg-ink-800 px-3 py-2 text-sm text-mist-100 outline-none focus:border-lotus-400";

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-extrabold text-mist-100">Feature Pricing &amp; Limits</h1>
        <p className="text-sm text-mist-400">Control the coin cost of paid features, co-host limits, and which games cost coins. Changes go live immediately.</p>
      </div>

      {/* Coin-priced features */}
      <Card className="space-y-4 p-5">
        <h2 className="flex items-center gap-2 font-semibold text-mist-100"><Coins className="size-4 text-gold-300" /> Coin cost of features</h2>
        <Row icon={Pencil} label="Room name change" hint="Coins a host pays to request a room rename (admin approves).">
          <input type="number" min={0} value={nameCost} onChange={(e) => setNameCost(Number(e.target.value))} className={numField} />
        </Row>
        <Row icon={Video} label="Video unlock" hint="Coins a host pays to request video for a room (admin approves).">
          <input type="number" min={0} value={videoCost} onChange={(e) => setVideoCost(Number(e.target.value))} className={numField} />
        </Row>
        <Row icon={Mic} label="Extra public room" hint="Every user gets 1 free public voice room. Coins they pay to request an ADDITIONAL public room (you approve each request; coins are refunded if you reject).">
          <input type="number" min={0} value={extraRoomCost} onChange={(e) => setExtraRoomCost(Number(e.target.value))} className={numField} />
        </Row>
      </Card>

      {/* Co-host limit + extra-slot pricing */}
      <Card className="space-y-4 p-5">
        <h2 className="flex items-center gap-2 font-semibold text-mist-100"><Users className="size-4 text-lotus-300" /> Co-hosts</h2>
        <Row icon={Users} label="Base co-hosts per room" hint="The default number of co-hosts every host can assign. Hosts can pay for MORE slots on top of this.">
          <input type="number" min={0} max={20} value={coHostLimit} onChange={(e) => setCoHostLimit(Number(e.target.value))} className={numField} />
        </Row>
        <Row icon={Coins} label="Coins per extra co-host slot" hint="What a host pays to request ONE additional co-host slot for their room (you approve each request).">
          <input type="number" min={0} value={coHostSlotCost} onChange={(e) => setCoHostSlotCost(Number(e.target.value))} className={numField} />
        </Row>
      </Card>

      {/* Video availability */}
      <Card className="space-y-3 p-5">
        <h2 className="flex items-center gap-2 font-semibold text-mist-100"><Video className="size-4 text-lotus-300" /> Video feature</h2>
        <label className="flex items-center justify-between gap-3">
          <span className="text-sm text-mist-300">Video feature available to rooms</span>
          <button
            type="button"
            onClick={() => setVideoEnabled((v) => !v)}
            className={cn("relative h-6 w-11 shrink-0 rounded-full transition", videoEnabled ? "bg-emerald-500" : "bg-ink-700")}
          >
            <span className={cn("absolute top-0.5 size-5 rounded-full bg-white transition-all", videoEnabled ? "left-[22px]" : "left-0.5")} />
          </button>
        </label>
        <p className="text-xs text-mist-500">When off, rooms can&apos;t request or use video at all. When on, hosts pay the video-unlock cost and you approve each request.</p>
      </Card>

      {/* Per-game coin cost + enable */}
      <Card className="space-y-4 p-5">
        <h2 className="flex items-center gap-2 font-semibold text-mist-100"><Gamepad2 className="size-4 text-petal-400" /> Game coin requirements</h2>
        <p className="-mt-2 text-xs text-mist-500">Set the coins required to start each game (0 = free). Turn a game off to disable it for everyone.</p>
        <div className="space-y-2.5">
          {games.map((g, i) => (
            <div key={g.id} className="flex flex-wrap items-center gap-3 rounded-xl border border-line bg-ink-800/50 px-3 py-2.5">
              <span className="min-w-24 flex-1 text-sm font-semibold text-mist-100">{g.name}</span>
              <label className="flex items-center gap-2 text-xs text-mist-400">
                <Coins className="size-3.5 text-gold-300" /> cost
                <input
                  type="number"
                  min={0}
                  value={g.coinCost ?? 0}
                  onChange={(e) => setGames((prev) => prev.map((x, idx) => (idx === i ? { ...x, coinCost: Math.max(0, Number(e.target.value)) } : x)))}
                  className="w-24 rounded-lg border border-line bg-ink-900 px-2.5 py-1.5 text-sm text-mist-100 outline-none focus:border-lotus-400"
                />
              </label>
              <button
                type="button"
                onClick={() => setGames((prev) => prev.map((x, idx) => (idx === i ? { ...x, enabled: !x.enabled } : x)))}
                className={cn("relative h-6 w-11 shrink-0 rounded-full transition", g.enabled ? "bg-emerald-500" : "bg-ink-700")}
                title={g.enabled ? "Enabled" : "Disabled"}
              >
                <span className={cn("absolute top-0.5 size-5 rounded-full bg-white transition-all", g.enabled ? "left-[22px]" : "left-0.5")} />
              </button>
            </div>
          ))}
        </div>
        <p className="text-xs text-mist-500">Tip: keep <b className="text-mist-300">Ludo</b> at 0 coins (free).</p>
      </Card>

      <Button size="lg" onClick={save} disabled={saving || loading}>
        <Check className="size-4" /> {saving ? "Saving…" : "Save settings"}
      </Button>
    </div>
  );
}

function Row({ icon: Icon, label, hint, children }: { icon: typeof Coins; label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div>
        <p className="flex items-center gap-1.5 text-sm font-semibold text-mist-200"><Icon className="size-4 text-mist-400" /> {label}</p>
        {hint && <p className="mt-0.5 text-xs text-mist-500">{hint}</p>}
      </div>
      {children}
    </div>
  );
}
