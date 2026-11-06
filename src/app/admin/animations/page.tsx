"use client";

import { useEffect, useState, type ComponentType } from "react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import { useConfig, saveConfig } from "@/lib/config";
import { cn } from "@/lib/cn";
import { TURN_ANIM_STYLES, turnAnimClass, type TurnAnimStyle } from "@/lib/turn-anim";
import { DICE_ANIM_STYLES, diceAnimClass, type DiceAnimStyle } from "@/lib/dice-anim";
import { Sparkles, Check, RotateCcw, Dices, Move, Trophy, Zap, CircleDot, Volume2, Flower2, UserRound } from "lucide-react";

type Speed = "slow" | "normal" | "fast";
type Intensity = "low" | "normal" | "high";
type MoveStyle = "slide" | "jump" | "bounce" | "fly" | "spin" | "instant";
type Anim = {
  diceRoll: boolean; diceStyle: DiceAnimStyle; diceDisplaySeconds: number; turnDelaySeconds: number; tokenMove: boolean; moveStyle: MoveStyle; winCelebration: boolean; winIntensity: Intensity;
  captureFlash: boolean; coinGlow: boolean; soundEffects: boolean;
  turnAnim: boolean; turnAnimStyle: TurnAnimStyle;
  rollShake: boolean; rollShakeStyle: TurnAnimStyle;
  centerReach: { enabled: boolean; style: "bloom" | "sparkle" | "confetti" | "fireworks"; speed: Speed };
};

const MOVE_STYLES: { v: MoveStyle; label: string }[] = [
  { v: "slide", label: "Smooth slide" }, { v: "jump", label: "Jump" }, { v: "bounce", label: "Bounce" },
  { v: "fly", label: "Flying coin" }, { v: "spin", label: "Spin" }, { v: "instant", label: "Instant" },
];

const DEFAULTS: Anim = {
  diceRoll: true, diceStyle: "tumble", diceDisplaySeconds: 2, turnDelaySeconds: 1, tokenMove: true, moveStyle: "slide", winCelebration: true, winIntensity: "normal",
  captureFlash: true, coinGlow: true, soundEffects: true,
  turnAnim: true, turnAnimStyle: "glow",
  rollShake: false, rollShakeStyle: "shake",
  centerReach: { enabled: true, style: "bloom", speed: "normal" },
};

export default function AdminAnimationsPage() {
  const { config, loading, reload } = useConfig();
  const { toast } = useToast();
  const [a, setA] = useState<Anim>(DEFAULTS);
  const [diceSpeed, setDiceSpeed] = useState<Speed>("normal");
  const [moveSpeed, setMoveSpeed] = useState<Speed>("normal");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (loading) return;
    const g = config.gameAnim ?? {};
    const cr = g.centerReach ?? {};
    setA({
      diceRoll: g.diceRoll !== false,
      diceStyle: (g.diceStyle as DiceAnimStyle) ?? "tumble",
      diceDisplaySeconds: g.diceDisplaySeconds ?? 2,
      turnDelaySeconds: g.turnDelaySeconds ?? 1,
      tokenMove: g.tokenMove !== false,
      moveStyle: (g.moveStyle as MoveStyle) ?? "slide",
      winCelebration: g.winCelebration !== false,
      winIntensity: (g.winIntensity as Intensity) ?? "normal",
      captureFlash: g.captureFlash !== false,
      coinGlow: g.coinGlow !== false,
      soundEffects: g.soundEffects !== false,
      turnAnim: g.turnAnim !== false,
      turnAnimStyle: (g.turnAnimStyle as TurnAnimStyle) ?? "shake",
      rollShake: g.rollShake === true,
      rollShakeStyle: (g.rollShakeStyle as TurnAnimStyle) ?? "shake",
      centerReach: {
        enabled: cr.enabled !== false,
        style: (cr.style as "bloom" | "sparkle" | "confetti" | "fireworks") ?? "bloom",
        speed: (cr.speed as Speed) ?? "normal",
      },
    });
    setDiceSpeed((config.gameDiceSpeed as Speed) ?? "normal");
    setMoveSpeed((config.gameTokenSpeed as Speed) ?? "normal");
  }, [loading, config]);

  const save = async () => {
    setSaving(true);
    const res = await saveConfig({ gameAnim: a, gameDiceSpeed: diceSpeed, gameTokenSpeed: moveSpeed });
    setSaving(false);
    if (res.ok) { await reload(); toast("Animation settings saved — live for all players.", "success"); }
    else toast(res.error ?? "Could not save", "error");
  };

  const resetAll = () => {
    setA(DEFAULTS); setDiceSpeed("normal"); setMoveSpeed("normal");
    toast("Reset to defaults — press Save changes to apply.", "info");
  };

  return (
    <div className="mx-auto max-w-3xl space-y-5 pb-24">
      <div>
        <h1 className="flex items-center gap-2 font-display text-2xl font-extrabold text-mist-100">
          <Sparkles className="size-6 text-lotus-300" /> Animations
        </h1>
        <p className="mt-1 text-sm text-mist-400">
          Turn each game animation on or off and tune its speed — no app update needed. These are master
          switches for everyone; a player&apos;s own effects toggle still applies on top. Saved changes are live
          for all players.
        </p>
      </div>

      {/* Dice + movement */}
      <Card className="p-4 sm:p-5">
        <h2 className="mb-1 font-display text-lg font-bold text-mist-100">Dice &amp; movement</h2>
        <Toggle icon={Dices} label="Dice roll animation" hint="The dice animates from the moment Roll is tapped until the number lands. Off = the result shows instantly." on={a.diceRoll} onChange={(v) => setA({ ...a, diceRoll: v })} />
        {a.diceRoll && <Segmented label="Dice speed" value={diceSpeed} options={SPEEDS} onChange={(v) => setDiceSpeed(v as Speed)} indent />}
        {a.diceRoll && (
          <div className="pb-3 pl-8">
            <div className="mb-2 text-xs font-semibold text-mist-300">Dice roll style — tap one to choose (each box previews itself)</div>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {DICE_ANIM_STYLES.map((s) => {
                const picked = a.diceStyle === s.id;
                return (
                  <button
                    key={s.id}
                    onClick={() => setA({ ...a, diceStyle: s.id })}
                    title={s.hint}
                    aria-pressed={picked}
                    className={cn(
                      "flex flex-col items-center gap-2 rounded-xl border p-3 transition",
                      picked ? "border-lotus-400 bg-lotus-500/10" : "border-line bg-ink-800 hover:bg-white/[0.06]",
                    )}
                  >
                    {/* Live preview: the real dice-roll class on a stand-in die. */}
                    <span className={cn("grid size-9 place-items-center rounded-lg bg-white text-ink-900", diceAnimClass({ diceStyle: s.id }))}>
                      <Dices className="size-5" />
                    </span>
                    <span className={cn("text-[11px] font-semibold", picked ? "text-lotus-200" : "text-mist-300")}>{s.label}</span>
                  </button>
                );
              })}
            </div>
            <p className="mt-2 text-xs text-mist-500">Recommended: <b className="text-mist-300">3-D Tumble</b>. Every style runs on the GPU and does not change the roll result or game speed.</p>
          </div>
        )}
        {/* Dice-value display time + turn-change delay (client request). */}
        <NumRow
          label="Dice value display time"
          hint="How long the rolled number stays clearly on screen — for EVERY player & spectator — after the dice stops."
          value={a.diceDisplaySeconds} min={1} max={10} unit="sec"
          onChange={(v) => setA({ ...a, diceDisplaySeconds: v })}
        />
        <NumRow
          label="Turn change delay"
          hint="Extra pause after the dice shows, before the next player's turn begins (so the turn never changes too fast)."
          value={a.turnDelaySeconds} min={1} max={10} unit="sec"
          onChange={(v) => setA({ ...a, turnDelaySeconds: v })}
        />
        <div className="border-t border-line/60 pt-3 pl-8 text-[11px] text-mist-500">
          Every dice roll is <b className="text-mist-400">always shown to all players, spectators and listeners</b> and synchronised from the shared game state — no roll is missed. Only the DICE animates during a roll; the player&apos;s profile picture stays fixed.
        </div>
        <Toggle icon={Move} label="Token move animation" hint="The coin walks cell-by-cell. Off = it jumps straight to the square." on={a.tokenMove} onChange={(v) => setA({ ...a, tokenMove: v })} />
        {a.tokenMove && <Segmented label="Move speed" value={moveSpeed} options={SPEEDS} onChange={(v) => setMoveSpeed(v as Speed)} indent />}
        {a.tokenMove && (
          <div className="flex flex-wrap items-center justify-between gap-2 pb-3 pl-8">
            <span className="text-xs font-semibold text-mist-300">Coin movement style</span>
            <select value={a.moveStyle} onChange={(e) => setA({ ...a, moveStyle: e.target.value as MoveStyle })} className="h-9 rounded-lg border border-line bg-ink-800 px-2 text-xs font-semibold text-mist-100 outline-none focus:border-lotus-400">
              {MOVE_STYLES.map((m) => <option key={m.v} value={m.v}>{m.label}</option>)}
            </select>
          </div>
        )}
      </Card>

      {/* Player turn animation — the ACTIVE player's profile picture */}
      <Card className="p-4 sm:p-5">
        <h2 className="mb-1 flex items-center gap-2 font-display text-lg font-bold text-mist-100">
          <UserRound className="size-5 text-lotus-300" /> Player turn animation
        </h2>
        <p className="mb-1 text-sm text-mist-400">
          Shows whose turn it is by animating that player&apos;s profile picture. Only the active player&apos;s
          picture moves — everyone else stays still. It starts when their turn begins and stops as soon as
          they roll. The glowing border around the picture stays on for the whole turn either way.
        </p>
        <Toggle
          icon={UserRound}
          label="Turn animation"
          hint="Off = no picture movement at all. The game plays exactly the same."
          on={a.turnAnim}
          onChange={(v) => setA({ ...a, turnAnim: v })}
        />
        {a.turnAnim && (
          <div className="pb-1 pl-8">
            <div className="mb-2 text-xs font-semibold text-mist-300">Animation style — tap one to choose (each box previews itself)</div>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
              {TURN_ANIM_STYLES.map((s) => {
                const picked = a.turnAnimStyle === s.id;
                return (
                  <button
                    key={s.id}
                    onClick={() => setA({ ...a, turnAnimStyle: s.id })}
                    title={s.hint}
                    aria-pressed={picked}
                    className={cn(
                      "flex flex-col items-center gap-2 rounded-xl border p-3 transition",
                      picked ? "border-lotus-400 bg-lotus-500/10" : "border-line bg-ink-800 hover:bg-white/[0.06]",
                    )}
                  >
                    {/* Live preview: the real game class on a stand-in avatar. */}
                    <span className="relative flex size-9 items-center justify-center">
                      <span className={cn(
                        "relative flex size-9 items-center justify-center rounded-full bg-lotus-500/80 text-xs font-bold text-white ring-2 ring-sky-300",
                        turnAnimClass({ turnAnim: true, turnAnimStyle: s.id }, true),
                      )}>
                        <UserRound className="size-4" />
                      </span>
                    </span>
                    <span className={cn("text-[11px] font-semibold", picked ? "text-lotus-200" : "text-mist-300")}>{s.label}</span>
                  </button>
                );
              })}
            </div>
            <p className="mt-2 text-xs text-mist-500">
              Recommended: <b className="text-mist-300">Shake</b>. All styles are built to run smoothly and
              do not affect dice rolling, token movement or game speed.
            </p>
          </div>
        )}
      </Card>

      {/* WHILE THE DICE IS ROLLING — reported as "profile picture shakes while
          the dice rolls, need control". It used to be permanently on with no
          setting anywhere; now it is off by default and fully controllable. */}
      <Card className="p-4 sm:p-5">
        <h2 className="mb-1 flex items-center gap-2 font-display text-lg font-bold text-mist-100">
          <Dices className="size-5 text-lotus-300" /> Profile picture while the dice is rolling
        </h2>
        <p className="mb-1 text-sm text-mist-400">
          Separate from the setting above. That one runs while a player is <b className="text-mist-300">deciding</b>;
          this one runs during the few seconds the <b className="text-mist-300">dice is actually rolling</b>.
          Turn it off and the picture stays perfectly still while the dice spins — only the dice moves.
        </p>
        <Toggle
          icon={Dices}
          label="Move the picture while the dice rolls"
          hint="Off (recommended) = the rolling player's picture stays completely still."
          on={a.rollShake}
          onChange={(v) => setA({ ...a, rollShake: v })}
        />
        {a.rollShake && (
          <div className="pb-1 pl-8">
            <div className="mb-2 text-xs font-semibold text-mist-300">Style while rolling — tap one to choose (each box previews itself)</div>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
              {TURN_ANIM_STYLES.filter((s) => s.id !== "none").map((s) => {
                const picked = a.rollShakeStyle === s.id;
                return (
                  <button
                    key={s.id}
                    onClick={() => setA({ ...a, rollShakeStyle: s.id })}
                    title={s.hint}
                    aria-pressed={picked}
                    className={cn(
                      "flex flex-col items-center gap-2 rounded-xl border p-3 transition",
                      picked ? "border-lotus-400 bg-lotus-500/10" : "border-line bg-ink-800 hover:bg-white/[0.06]",
                    )}
                  >
                    <span className="relative flex size-9 items-center justify-center">
                      <span className={cn(
                        "relative flex size-9 items-center justify-center rounded-full bg-lotus-500/80 text-xs font-bold text-white ring-2 ring-sky-300",
                        turnAnimClass({ turnAnim: true, turnAnimStyle: s.id }, true),
                      )}>
                        <UserRound className="size-4" />
                      </span>
                    </span>
                    <span className={cn("text-[11px] font-semibold", picked ? "text-lotus-200" : "text-mist-300")}>{s.label}</span>
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </Card>

      {/* Win + capture + glow */}
      <Card className="p-4 sm:p-5">
        <h2 className="mb-1 font-display text-lg font-bold text-mist-100">Effects</h2>
        <Toggle icon={Trophy} label="Win celebration" hint="Sparkles + confetti when someone wins." on={a.winCelebration} onChange={(v) => setA({ ...a, winCelebration: v })} />
        {a.winCelebration && <Segmented label="Celebration amount" value={a.winIntensity} options={INTENSITIES} onChange={(v) => setA({ ...a, winIntensity: v as Intensity })} indent />}
        <Toggle icon={Zap} label="Capture flash" hint="The gold burst when a coin captures another." on={a.captureFlash} onChange={(v) => setA({ ...a, captureFlash: v })} />
        <Toggle icon={CircleDot} label="Coin glow hint" hint="The glow around a coin you can move." on={a.coinGlow} onChange={(v) => setA({ ...a, coinGlow: v })} />
        <Toggle icon={Volume2} label="Sound effects" hint="All game sounds (dice, steps, capture, win). Players can still mute their own." on={a.soundEffects} onChange={(v) => setA({ ...a, soundEffects: v })} />
      </Card>

      {/* Centre-reach (§4) */}
      <Card className="p-4 sm:p-5">
        <h2 className="mb-1 flex items-center gap-2 font-display text-lg font-bold text-mist-100"><Flower2 className="size-5 text-lotus-300" /> When a coin reaches the centre</h2>
        <p className="mb-1 text-sm text-mist-400">The animation played when a player brings a coin home to the centre.</p>
        <Toggle icon={Flower2} label="Centre-reach animation" hint="Off = the coin just lands with no burst." on={a.centerReach.enabled} onChange={(v) => setA({ ...a, centerReach: { ...a.centerReach, enabled: v } })} />
        {a.centerReach.enabled && (
          <>
            <Segmented label="Style" value={a.centerReach.style} options={[{ v: "bloom", label: "Lotus bloom 🪷" }, { v: "sparkle", label: "Sparkle burst ✨" }, { v: "confetti", label: "Confetti 🎊" }, { v: "fireworks", label: "Fireworks 🎆" }]} onChange={(v) => setA({ ...a, centerReach: { ...a.centerReach, style: v as "bloom" | "sparkle" | "confetti" | "fireworks" } })} indent />
            <Segmented label="Speed" value={a.centerReach.speed} options={SPEEDS} onChange={(v) => setA({ ...a, centerReach: { ...a.centerReach, speed: v as Speed } })} indent />
          </>
        )}
      </Card>

      <button onClick={resetAll} className="inline-flex items-center gap-1.5 text-sm font-semibold text-mist-400 transition hover:text-mist-100">
        <RotateCcw className="size-4" /> Reset everything to defaults
      </button>

      {/* Sticky save bar */}
      <div className="fixed inset-x-0 bottom-0 z-20 border-t border-line bg-ink-900/95 px-4 py-3 backdrop-blur">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-3">
          <span className="text-xs text-mist-400">Changes apply to every player after you save.</span>
          <Button onClick={save} disabled={saving}><Check className="size-4" /> {saving ? "Saving…" : "Save changes"}</Button>
        </div>
      </div>
    </div>
  );
}

const SPEEDS = [{ v: "slow", label: "Slow" }, { v: "normal", label: "Normal" }, { v: "fast", label: "Fast" }];
const INTENSITIES = [{ v: "low", label: "Low" }, { v: "normal", label: "Normal" }, { v: "high", label: "High" }];

/** An on/off row with an icon, label and hint. */
function Toggle({ icon: Icon, label, hint, on, onChange }: {
  icon: ComponentType<{ className?: string }>; label: string; hint: string; on: boolean; onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-center gap-3 border-t border-line/60 py-3 first:border-t-0">
      <Icon className="size-5 shrink-0 text-mist-400" />
      <div className="min-w-0 flex-1">
        <div className="text-sm font-semibold text-mist-100">{label}</div>
        <div className="text-xs text-mist-500">{hint}</div>
      </div>
      <button
        onClick={() => onChange(!on)}
        role="switch"
        aria-checked={on}
        title={on ? "On — tap to turn off" : "Off — tap to turn on"}
        className={cn("relative h-6 w-11 shrink-0 rounded-full transition", on ? "bg-emerald-500" : "bg-mist-600")}
      >
        <span className={cn("absolute top-0.5 size-5 rounded-full bg-white shadow transition-all", on ? "left-[22px]" : "left-0.5")} />
      </button>
    </div>
  );
}

/** A labelled number row with a bounded numeric input (seconds, counts, …). */
function NumRow({ label, hint, value, min, max, unit, onChange }: {
  label: string; hint: string; value: number; min: number; max: number; unit?: string; onChange: (v: number) => void;
}) {
  return (
    <div className="flex items-center gap-3 border-t border-line/60 py-3">
      <div className="min-w-0 flex-1 pl-8">
        <div className="text-sm font-semibold text-mist-100">{label}</div>
        <div className="text-xs text-mist-500">{hint}</div>
      </div>
      <div className="flex shrink-0 items-center gap-1.5">
        <input
          type="number" min={min} max={max} value={value}
          onChange={(e) => onChange(Math.max(min, Math.min(max, Math.round(Number(e.target.value) || min))))}
          className="h-9 w-16 rounded-lg border border-line bg-ink-800 px-2 text-sm font-semibold text-mist-100 outline-none focus:border-lotus-400"
        />
        {unit && <span className="text-xs text-mist-400">{unit}</span>}
      </div>
    </div>
  );
}

/** A small segmented button-group selector. */
function Segmented({ label, value, options, onChange, indent }: {
  label: string; value: string; options: { v: string; label: string }[]; onChange: (v: string) => void; indent?: boolean;
}) {
  return (
    <div className={cn("flex flex-wrap items-center justify-between gap-2 pb-3", indent && "pl-8")}>
      <span className="text-xs font-semibold text-mist-300">{label}</span>
      <div className="flex overflow-hidden rounded-lg border border-line">
        {options.map((o) => (
          <button
            key={o.v}
            onClick={() => onChange(o.v)}
            className={cn("px-3 py-1.5 text-xs font-semibold transition", value === o.v ? "bg-lotus-500 text-white" : "bg-ink-800 text-mist-300 hover:bg-white/[0.06]")}
          >
            {o.label}
          </button>
        ))}
      </div>
    </div>
  );
}
