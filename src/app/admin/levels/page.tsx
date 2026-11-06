"use client";

import { useEffect, useMemo, useState } from "react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import { useConfig, saveConfig, type AppConfig } from "@/lib/config";
import { fetchAdminUsers, type AdminUser } from "@/lib/admin";
import { TIERS, tierForLevel, xpToReach } from "@/lib/levels";
import { Trophy, Sparkles, Gamepad2, Crown, Gift, LogIn, Coins, Save, Loader2 } from "lucide-react";

type LevelRewardsCfg = NonNullable<AppConfig["levelRewards"]>;
const LR_DEFAULT: LevelRewardsCfg = { enabled: true, base: 20, perLevel: 10, cap: 500, xpPlay: 12, xpWin: 30, xpGift: 6, xpDailyLogin: 25, xpPurchase: 15 };

export default function AdminLevelsPage() {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => { fetchAdminUsers().then((u) => { setUsers(u); setLoading(false); }); }, []);

  // Live distribution of players across the tiers.
  const counts = useMemo(() => {
    const m = new Map<string, number>();
    for (const u of users) { const t = tierForLevel(u.level || 1).name; m.set(t, (m.get(t) ?? 0) + 1); }
    return m;
  }, [users]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-extrabold text-mist-100">User Levels &amp; Rewards</h1>
        <p className="text-sm text-mist-400">Levels rise <span className="text-mist-200">automatically</span> from in-app activity. Every level-up pays bonus coins; each tier unlocks a badge, an avatar frame &amp; perks. <span className="text-mist-200">Every number below is yours to change.</span></p>
      </div>

      {/* ADMIN REWARD CONTROLS — XP per activity + the level-up bonus formula. */}
      <RewardControls />

      {/* Tier ladder */}
      <div>
        <h2 className="mb-3 flex items-center gap-2 font-semibold text-mist-100"><Trophy className="size-4 text-gold-300" /> Tiers, badges, frames &amp; perks</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          {TIERS.map((t, i) => {
            const next = TIERS[i + 1];
            const range = next ? `Lv ${t.minLevel}–${next.minLevel - 1}` : `Lv ${t.minLevel}+`;
            return (
              <Card key={t.name} className="p-4">
                <div className="flex items-center gap-3">
                  <span className="grid size-12 shrink-0 place-items-center rounded-2xl text-2xl" style={{ background: t.frame }}>{t.emoji}</span>
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-display text-lg font-extrabold text-mist-100">{t.name}</span>
                      <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${t.badgeClass}`}>{range}</span>
                    </div>
                    <div className="text-xs text-mist-500">Reach at {xpToReach(t.minLevel).toLocaleString("en-SA")} total XP · {loading ? "…" : `${counts.get(t.name) ?? 0} player${(counts.get(t.name) ?? 0) === 1 ? "" : "s"}`}</div>
                  </div>
                </div>
                <ul className="mt-3 space-y-1">
                  {t.perks.map((p) => <li key={p} className="flex items-center gap-1.5 text-sm text-mist-300">✓ {p}</li>)}
                </ul>
              </Card>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ===== Admin reward controls — set XP per activity + the level-up bonus coins.
// Answers the client's "how does admin control the reward system": everything is
// editable here and takes effect immediately for all future activity.
function RewardControls() {
  const { config, loading, reload } = useConfig();
  const { toast } = useToast();
  const [f, setF] = useState<LevelRewardsCfg>({ ...LR_DEFAULT, ...(config.levelRewards ?? {}) });
  const [saving, setSaving] = useState(false);

  useEffect(() => { if (!loading) setF({ ...LR_DEFAULT, ...(config.levelRewards ?? {}) }); }, [loading, config.levelRewards]);

  const set = <K extends keyof LevelRewardsCfg>(k: K, v: LevelRewardsCfg[K]) => setF((s) => ({ ...s, [k]: v }));
  const bonusAt = (lvl: number) => Math.min(f.cap, f.base + Math.max(2, lvl) * f.perLevel);

  const save = async () => {
    setSaving(true);
    const res = await saveConfig({ levelRewards: f });
    setSaving(false);
    if (res.ok) { await reload(); toast("Reward settings saved — live for all future activity 🎁", "success"); }
    else toast(res.error ?? "Could not save", "error");
  };

  const fld = "h-10 w-full rounded-lg border border-line bg-ink-900 px-3 text-sm font-bold text-mist-100 outline-none focus:border-lotus-400";
  const XP_FIELDS: { key: keyof LevelRewardsCfg; icon: typeof Gamepad2; label: string }[] = [
    { key: "xpPlay", icon: Gamepad2, label: "Finish a game (every player)" },
    { key: "xpWin", icon: Crown, label: "Win a game (extra)" },
    { key: "xpGift", icon: Gift, label: "Send a gift" },
    { key: "xpDailyLogin", icon: LogIn, label: "Daily login (first of the day)" },
    { key: "xpPurchase", icon: Coins, label: "Approved coin purchase" },
  ];

  return (
    <Card className="p-5">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 font-semibold text-mist-100"><Sparkles className="size-4 text-lotus-300" /> Reward controls — how the admin controls the reward system</h2>
        <button onClick={() => set("enabled", !f.enabled)} className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-bold transition ${f.enabled ? "bg-emerald-500/20 text-emerald-300" : "bg-white/[0.06] text-mist-400"}`}>
          <span className={`size-2 rounded-full ${f.enabled ? "bg-emerald-400" : "bg-mist-500"}`} /> Level-up bonus {f.enabled ? "ON" : "OFF"}
        </button>
      </div>

      {/* XP per activity */}
      <h3 className="mb-2 text-xs font-bold uppercase tracking-wide text-mist-400">XP earned per activity</h3>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {XP_FIELDS.map((x) => (
          <div key={x.key}>
            <label className="mb-1 flex items-center gap-1.5 text-[11px] font-semibold text-mist-400"><x.icon className="size-3.5 text-lotus-300" /> {x.label}</label>
            <input type="number" min={0} value={f[x.key] as number} onChange={(e) => set(x.key, (Math.max(0, Math.round(Number(e.target.value) || 0))) as LevelRewardsCfg[typeof x.key])} className={fld} />
          </div>
        ))}
      </div>

      {/* Level-up bonus formula */}
      <h3 className="mb-2 mt-4 text-xs font-bold uppercase tracking-wide text-mist-400">Level-up bonus coins — formula: min(cap, base + level × per-level)</h3>
      <div className="grid gap-3 sm:grid-cols-3">
        <div><label className="mb-1 block text-[11px] font-semibold text-mist-400">Base coins</label><input type="number" min={0} value={f.base} onChange={(e) => set("base", Math.max(0, Math.round(Number(e.target.value) || 0)))} className={fld} /></div>
        <div><label className="mb-1 block text-[11px] font-semibold text-mist-400">Coins added per level</label><input type="number" min={0} value={f.perLevel} onChange={(e) => set("perLevel", Math.max(0, Math.round(Number(e.target.value) || 0)))} className={fld} /></div>
        <div><label className="mb-1 block text-[11px] font-semibold text-mist-400">Maximum bonus (cap)</label><input type="number" min={0} value={f.cap} onChange={(e) => set("cap", Math.max(0, Math.round(Number(e.target.value) || 0)))} className={fld} /></div>
      </div>
      <div className="mt-3 rounded-lg bg-ink-800/60 px-3 py-2 text-[11px] text-mist-400">
        <b className="text-mist-200">Preview</b> — with these settings a player earns: Level 2 = <b className="text-emerald-200">{bonusAt(2)}</b> · Level 5 = <b className="text-emerald-200">{bonusAt(5)}</b> · Level 10 = <b className="text-emerald-200">{bonusAt(10)}</b> · Level 50 = <b className="text-emerald-200">{bonusAt(50)}</b> coins. {!f.enabled && <span className="text-amber-300">Bonus is currently OFF — level-ups pay 0 coins (XP still accrues).</span>}
      </div>
      <p className="mt-2 text-[11px] text-mist-500">Level bonuses flow through the same 4-way split when the Lotus economy is ON. To turn the whole Level/XP system off, use Admin → Feature Management → Levels.</p>
      <Button className="mt-4" onClick={save} disabled={saving}>{saving ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />} Save reward settings</Button>
    </Card>
  );
}
