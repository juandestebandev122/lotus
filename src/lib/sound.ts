// ============================================================
// Game sound engine. Sounds are synthesized with WebAudio (no
// asset files) unless the admin uploaded a CUSTOM sound for an
// effect — then that file plays instead. Every effect has its
// own admin ON/OFF switch and the whole set can switch between
// SOUND PACKS (different synthesis characters; "silent" = off).
// Configured via configureSounds(config.gameSound) from the
// game pages; safe to call from anywhere; no-ops without audio.
// ============================================================

export type SoundEffectKey =
  | "diceRoll" | "tokenMove" | "capture" | "home" | "win"
  | "lose" | "countdown" | "notification" | "click";
export type SoundPack = "classic" | "modern" | "premium" | "casino" | "arcade" | "fantasy" | "silent";

// Per-pack synthesis character: waveform, pitch/duration multipliers, and an
// optional detuned twin oscillator ("detune" cents) for a richer chorus sound.
const PACKS: Record<Exclude<SoundPack, "silent">, { wave: OscillatorType; pitch: number; dur: number; detune: number; gain: number }> = {
  classic: { wave: "triangle", pitch: 1, dur: 1, detune: 0, gain: 1 },
  modern: { wave: "sine", pitch: 1.35, dur: 0.8, detune: 0, gain: 1 },
  premium: { wave: "triangle", pitch: 1, dur: 1.3, detune: 8, gain: 1.1 },
  casino: { wave: "square", pitch: 1.2, dur: 1.1, detune: 0, gain: 0.85 },
  arcade: { wave: "square", pitch: 1.6, dur: 0.7, detune: 0, gain: 0.75 },
  fantasy: { wave: "triangle", pitch: 0.85, dur: 1.7, detune: 5, gain: 1 },
};

type EffectCfg = { enabled?: boolean; url?: string };
let soundCfg: { pack: SoundPack; effects: Partial<Record<SoundEffectKey, EffectCfg>> } = { pack: "classic", effects: {} };

/** Apply the admin Sound Management config (config.gameSound). */
export function configureSounds(cfg?: { pack?: string; effects?: Partial<Record<SoundEffectKey, EffectCfg>> } | null): void {
  const pack = (cfg?.pack && (cfg.pack === "silent" || cfg.pack in PACKS) ? cfg.pack : "classic") as SoundPack;
  soundCfg = { pack, effects: cfg?.effects ?? {} };
}

/** Whether an effect should play, and its custom URL if the admin uploaded one. */
function fx(key: SoundEffectKey): { on: boolean; url?: string } {
  if (soundCfg.pack === "silent") return { on: false };
  const e = soundCfg.effects[key] ?? {};
  return { on: e.enabled !== false, url: e.url || undefined };
}

function pack() {
  return PACKS[(soundCfg.pack === "silent" ? "classic" : soundCfg.pack) as Exclude<SoundPack, "silent">];
}

let ctx: AudioContext | null = null;

// User preference: mute the in-game sound effects (dice roll, pop). Persisted so
// the choice sticks. Read once on load; toggled from the game's sound control.
let soundMuted = (() => { try { return typeof localStorage !== "undefined" && localStorage.getItem("lotus.sound.muted") === "1"; } catch { return false; } })();
export function isSoundMuted(): boolean { return soundMuted; }
export function setSoundMuted(muted: boolean): void {
  soundMuted = muted;
  try { localStorage.setItem("lotus.sound.muted", muted ? "1" : "0"); } catch { /* ignore */ }
}

function getCtx(): AudioContext | null {
  if (typeof window === "undefined") return null;
  try {
    const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AC) return null;
    ctx = ctx ?? new AC();
    if (ctx.state === "suspended") void ctx.resume();
    return ctx;
  } catch {
    return null;
  }
}

// Admin-uploaded custom sounds — cached audio elements per URL.
const customCache = new Map<string, HTMLAudioElement>();
function playCustom(url: string): void {
  try {
    let el = customCache.get(url);
    if (!el) { el = new Audio(url); el.preload = "auto"; customCache.set(url, el); }
    el.currentTime = 0;
    el.volume = 0.6;
    void el.play().catch(() => { /* needs a user gesture first — fine */ });
  } catch { /* ignore */ }
}

/** One synthesized tone (plus a detuned twin on richer packs). */
function tone(ac: AudioContext, o: { t: number; f0: number; f1?: number; dur: number; vol: number; wave?: OscillatorType }): void {
  const p = pack();
  const make = (detune: number) => {
    const osc = ac.createOscillator();
    const gain = ac.createGain();
    osc.type = o.wave ?? p.wave;
    osc.detune.setValueAtTime(detune, o.t);
    osc.frequency.setValueAtTime(o.f0 * p.pitch, o.t);
    if (o.f1) osc.frequency.exponentialRampToValueAtTime(Math.max(1, o.f1 * p.pitch), o.t + o.dur * p.dur);
    gain.gain.setValueAtTime(0.0001, o.t);
    gain.gain.exponentialRampToValueAtTime(o.vol * p.gain * (detune ? 0.5 : 1), o.t + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, o.t + o.dur * p.dur);
    osc.connect(gain).connect(ac.destination);
    osc.start(o.t);
    osc.stop(o.t + o.dur * p.dur + 0.03);
  };
  make(0);
  if (p.detune > 0) make(p.detune);
}

/** A short series of dice "clacks" — used when rolling dice. */
export function playDiceRoll() {
  if (soundMuted) return;
  const g = fx("diceRoll");
  if (!g.on) return;
  if (g.url) return playCustom(g.url);
  const ac = getCtx();
  if (!ac) return;
  try {
    const now = ac.currentTime;
    for (let i = 0; i < 5; i++) {
      tone(ac, { t: now + i * 0.075, f0: 160 + Math.random() * 160, dur: 0.06, vol: 0.1, wave: "square" });
    }
  } catch { /* ignore */ }
}

/** Haptic feedback (vibration) where supported. The caller decides WHEN to fire
 *  it (only when premium effects are enabled). Respects the sound-mute switch so
 *  "silent" also means "no buzzing". */
export function vibrate(pattern: number | number[]) {
  if (soundMuted) return;
  try { if (typeof navigator !== "undefined" && navigator.vibrate) navigator.vibrate(pattern); } catch { /* ignore */ }
}

/** A short soft "tick" as a coin steps one cell forward (per-cell move sound). */
export function playStep() {
  if (soundMuted) return;
  const g = fx("tokenMove");
  if (!g.on) return;
  if (g.url) return playCustom(g.url);
  const ac = getCtx();
  if (!ac) return;
  try {
    tone(ac, { t: ac.currentTime, f0: 520, f1: 660, dur: 0.09, vol: 0.07 });
  } catch { /* ignore */ }
}

/** A punchy descending "zap" when a coin is captured/killed. */
export function playCapture() {
  if (soundMuted) return;
  const g = fx("capture");
  if (!g.on) return;
  if (g.url) return playCustom(g.url);
  const ac = getCtx();
  if (!ac) return;
  try {
    tone(ac, { t: ac.currentTime, f0: 680, f1: 120, dur: 0.26, vol: 0.16, wave: "sawtooth" });
  } catch { /* ignore */ }
}

/** A pleasant two-note chime when a coin reaches home. */
export function playHome() {
  if (soundMuted) return;
  const g = fx("home");
  if (!g.on) return;
  if (g.url) return playCustom(g.url);
  const ac = getCtx();
  if (!ac) return;
  try {
    const now = ac.currentTime;
    [660, 990].forEach((f, i) => tone(ac, { t: now + i * 0.12, f0: f, dur: 0.3, vol: 0.13, wave: "sine" }));
  } catch { /* ignore */ }
}

/** A short victory fanfare (ascending arpeggio) when a player wins. */
export function playWin() {
  if (soundMuted) return;
  const g = fx("win");
  if (!g.on) return;
  if (g.url) return playCustom(g.url);
  const ac = getCtx();
  if (!ac) return;
  try {
    const now = ac.currentTime;
    [523, 659, 784, 1047].forEach((f, i) => tone(ac, { t: now + i * 0.11, f0: f, dur: 0.34, vol: 0.15 }));
  } catch { /* ignore */ }
}

/** A gentle descending "aww" for the players who did NOT win. */
export function playLose() {
  if (soundMuted) return;
  const g = fx("lose");
  if (!g.on) return;
  if (g.url) return playCustom(g.url);
  const ac = getCtx();
  if (!ac) return;
  try {
    const now = ac.currentTime;
    [523, 440, 349, 262].forEach((f, i) => tone(ac, { t: now + i * 0.16, f0: f, dur: 0.3, vol: 0.09 }));
  } catch { /* ignore */ }
}

/** A short high tick for the last seconds of the turn countdown. */
export function playTick() {
  if (soundMuted) return;
  const g = fx("countdown");
  if (!g.on) return;
  if (g.url) return playCustom(g.url);
  const ac = getCtx();
  if (!ac) return;
  try {
    tone(ac, { t: ac.currentTime, f0: 880, dur: 0.06, vol: 0.08, wave: "sine" });
  } catch { /* ignore */ }
}

/** A friendly two-tone ping — "it's your turn" and similar notices. */
export function playNotify() {
  if (soundMuted) return;
  const g = fx("notification");
  if (!g.on) return;
  if (g.url) return playCustom(g.url);
  const ac = getCtx();
  if (!ac) return;
  try {
    const now = ac.currentTime;
    [740, 1108].forEach((f, i) => tone(ac, { t: now + i * 0.09, f0: f, dur: 0.18, vol: 0.1, wave: "sine" }));
  } catch { /* ignore */ }
}

/** A soft confirming "pop" — used for landing a result / button feedback. */
export function playPop() {
  if (soundMuted) return;
  const g = fx("click");
  if (!g.on) return;
  if (g.url) return playCustom(g.url);
  const ac = getCtx();
  if (!ac) return;
  try {
    tone(ac, { t: ac.currentTime, f0: 440, f1: 720, dur: 0.16, vol: 0.12, wave: "sine" });
  } catch { /* ignore */ }
}

/** Preview any effect from the admin panel — bypasses the player's mute AND the
 *  effect's own OFF switch so the admin can hear a sound before enabling it. */
export function previewEffect(key: SoundEffectKey, url?: string): void {
  if (url) return playCustom(url);
  const was = soundMuted;
  const wasCfg = soundCfg;
  soundMuted = false;
  soundCfg = {
    pack: soundCfg.pack === "silent" ? "classic" : soundCfg.pack,
    effects: { ...soundCfg.effects, [key]: { enabled: true } },
  };
  try {
    switch (key) {
      case "diceRoll": playDiceRoll(); break;
      case "tokenMove": playStep(); break;
      case "capture": playCapture(); break;
      case "home": playHome(); break;
      case "win": playWin(); break;
      case "lose": playLose(); break;
      case "countdown": playTick(); break;
      case "notification": playNotify(); break;
      case "click": playPop(); break;
    }
  } finally {
    soundMuted = was;
    soundCfg = wasCfg;
  }
}
