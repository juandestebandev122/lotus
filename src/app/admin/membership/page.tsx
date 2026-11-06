"use client";

import { useEffect, useState } from "react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import { useConfig, saveConfig, type MembershipPlan } from "@/lib/config";
import { cn } from "@/lib/cn";
import { Check, Crown, Banknote } from "lucide-react";

type SubscriberFeatureKey =
  | "dice"
  | "boards"
  | "tokens"
  | "frames"
  | "profileStore"
  | "gameCosmetics"
  | "paidZone"
  | "paidZoneCalls"
  | "tournaments"
  | "competitions";

const SUBSCRIBER_FEATURES: { key: SubscriberFeatureKey; label: string; hint: string }[] = [
  { key: "dice", label: "Dice", hint: "Game dice purchases in store" },
  { key: "boards", label: "Boards", hint: "Game board purchases in store" },
  { key: "tokens", label: "Tokens", hint: "Game token purchases in store" },
  { key: "frames", label: "Frames", hint: "Profile frame purchases" },
  { key: "profileStore", label: "Profile store items", hint: "Backgrounds, name effects, overlays, badges" },
  { key: "gameCosmetics", label: "All game cosmetics", hint: "Master switch for Dice, Boards and Tokens" },
  { key: "paidZone", label: "Paid Zone", hint: "Paid Zone membership and profile access" },
  { key: "paidZoneCalls", label: "Paid Zone calls", hint: "1:1 call features inside Paid Zone" },
  { key: "tournaments", label: "Tournaments", hint: "Tournament join/request registration" },
  { key: "competitions", label: "Competitions", hint: "Competition registration for participants" },
];

export default function AdminMembershipPage() {
  const { config, loading, reload } = useConfig();
  const { toast } = useToast();
  const [paidEnabled, setPaidEnabled] = useState(config.membership.paidEnabled);
  const [plans, setPlans] = useState<MembershipPlan[]>(config.membership.plans);
  const [subscriberFeatures, setSubscriberFeatures] = useState({
    dice: !!config.membership.subscriberFeatures?.dice,
    boards: !!config.membership.subscriberFeatures?.boards,
    tokens: !!config.membership.subscriberFeatures?.tokens,
    frames: !!config.membership.subscriberFeatures?.frames,
    profileStore: !!config.membership.subscriberFeatures?.profileStore,
    gameCosmetics: !!config.membership.subscriberFeatures?.gameCosmetics,
    paidZone: !!config.membership.subscriberFeatures?.paidZone,
    paidZoneCalls: !!config.membership.subscriberFeatures?.paidZoneCalls,
    tournaments: !!config.membership.subscriberFeatures?.tournaments,
    competitions: !!config.membership.subscriberFeatures?.competitions,
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!loading) {
      setPaidEnabled(config.membership.paidEnabled);
      setPlans(config.membership.plans);
      setSubscriberFeatures({
        dice: !!config.membership.subscriberFeatures?.dice,
        boards: !!config.membership.subscriberFeatures?.boards,
        tokens: !!config.membership.subscriberFeatures?.tokens,
        frames: !!config.membership.subscriberFeatures?.frames,
        profileStore: !!config.membership.subscriberFeatures?.profileStore,
        gameCosmetics: !!config.membership.subscriberFeatures?.gameCosmetics,
        paidZone: !!config.membership.subscriberFeatures?.paidZone,
        paidZoneCalls: !!config.membership.subscriberFeatures?.paidZoneCalls,
        tournaments: !!config.membership.subscriberFeatures?.tournaments,
        competitions: !!config.membership.subscriberFeatures?.competitions,
      });
    }
  }, [loading, config]);

  const update = (id: string, patch: Partial<MembershipPlan>) =>
    setPlans((ps) => ps.map((p) => (p.id === id ? { ...p, ...patch } : p)));

  const save = async () => {
    setSaving(true);
    const res = await saveConfig({ membership: { paidEnabled, plans, subscriberFeatures } });
    setSaving(false);
    if (res.ok) {
      await reload();
      toast("Membership plans saved", "success");
    } else {
      toast(res.error ?? "Could not save", "error");
    }
  };

  const field = "rounded-lg border border-line bg-ink-900 px-3 py-2 text-sm text-mist-100 outline-none focus:border-lotus-400";

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-extrabold text-mist-100">Membership &amp; subscriptions</h1>
        <p className="text-sm text-mist-400">Define plans, pricing and perks. Sales activate once a payment gateway is connected.</p>
      </div>

      <Card className="flex items-center gap-3 p-4">
        <Crown className="size-5 text-gold-400" />
        <div className="min-w-0 flex-1">
          <div className="text-sm font-semibold text-mist-100">Paid subscriptions</div>
          <div className="text-xs text-mist-400">When on, members can see and upgrade to paid plans.</div>
        </div>
        <button
          onClick={() => setPaidEnabled((v) => !v)}
          className={cn("relative h-6 w-11 shrink-0 rounded-full transition-colors", paidEnabled ? "bg-emerald-500" : "bg-ink-700")}
          aria-label="Toggle paid subscriptions"
        >
          <span className={cn("absolute top-0.5 size-5 rounded-full bg-white transition-all", paidEnabled ? "left-[22px]" : "left-0.5")} />
        </button>
      </Card>

      <Card className="space-y-3 p-4">
        <div>
          <div className="text-sm font-semibold text-mist-100">Paid-subscriber feature access</div>
          <div className="text-xs text-mist-400">Enable any option below to make it paid-subscriber-only. Admins can still access everything.</div>
        </div>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {SUBSCRIBER_FEATURES.map((f) => (
            <button
              key={f.key}
              onClick={() => setSubscriberFeatures((s) => ({ ...s, [f.key]: !s[f.key] }))}
              className={cn(
                "rounded-xl border p-3 text-left transition",
                subscriberFeatures[f.key]
                  ? "border-emerald-400/35 bg-emerald-500/10"
                  : "border-line bg-ink-900/40",
              )}
            >
              <div className={cn("text-sm font-semibold", subscriberFeatures[f.key] ? "text-emerald-200" : "text-mist-100")}>{f.label}</div>
              <div className="mt-0.5 text-[11px] text-mist-400">{f.hint}</div>
            </button>
          ))}
        </div>
      </Card>

      <div className="grid gap-4 lg:grid-cols-3">
        {plans.map((p) => (
          <Card key={p.id} className={cn("p-5", !p.on && "opacity-60")}>
            <div className="flex items-center justify-between">
              <input
                value={p.name}
                onChange={(e) => update(p.id, { name: e.target.value })}
                className={cn(field, "font-display text-lg font-bold")}
              />
              <button
                onClick={() => update(p.id, { on: !p.on })}
                className={cn("relative h-6 w-11 shrink-0 rounded-full transition-colors", p.on ? "bg-emerald-500" : "bg-ink-700")}
                aria-label="Toggle plan"
              >
                <span className={cn("absolute top-0.5 size-5 rounded-full bg-white transition-all", p.on ? "left-[22px]" : "left-0.5")} />
              </button>
            </div>

            <div className="mt-3 flex items-center gap-2">
              <span className="flex items-center rounded-lg border border-line bg-ink-900 px-2">
                <Banknote className="size-3.5 text-gold-300" />
                <input
                  type="number"
                  min={0}
                  value={p.price}
                  onChange={(e) => update(p.id, { price: Math.max(0, Number(e.target.value) || 0) })}
                  className="w-20 bg-transparent px-1 py-2 text-sm text-mist-100 outline-none"
                />
              </span>
              <select
                value={p.period}
                onChange={(e) => update(p.id, { period: e.target.value as MembershipPlan["period"] })}
                className={field}
              >
                <option value="month">/ month</option>
                <option value="year">/ year</option>
              </select>
            </div>

            <label className="mt-3 block text-xs font-semibold text-mist-300">Perks (one per line)</label>
            <textarea
              value={p.perks.join("\n")}
              onChange={(e) => update(p.id, { perks: e.target.value.split("\n").map((s) => s.trim()).filter(Boolean) })}
              rows={4}
              className={cn(field, "mt-1 w-full resize-none")}
            />
          </Card>
        ))}
      </div>

      <Button size="lg" onClick={save} disabled={saving || loading}>
        <Check className="size-4" /> {saving ? "Saving…" : "Save plans"}
      </Button>
    </div>
  );
}
