"use client";

import { useEffect, useState } from "react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import { useConfig, saveConfig } from "@/lib/config";
import { cn } from "@/lib/cn";
import { Mic, Save, Loader2, Info, RotateCcw, Gauge } from "lucide-react";

// VOICE ROOM AUDIO QUALITY.
//
// These were fixed in the code at LiveKit's LOWEST settings — 12 kbps, silence
// skipping on, packet-loss protection off — chosen to save mobile data. That is
// what made voice sound thin and drop out. They are settings now, so quality and
// data cost can be balanced without a code change.

const QUALITY = {
  bitrateKbps: 32, dtx: false, red: true,
  noiseSuppression: true, echoCancellation: true, autoGainControl: true,
  voiceIsolation: true, stereo: false,
};
type VQ = typeof QUALITY;

// Data figures are for a person who is ACTUALLY TALKING; listening costs the
// same per speaker you can hear. Rounded, and deliberately on the high side.
const LEVELS: { kbps: number; name: string; blurb: string; mbPerHour: string }[] = [
  { kbps: 12, name: "Telephone", blurb: "Thin and muffled. Cheapest on data.", mbPerHour: "~5 MB" },
  { kbps: 20, name: "Speech", blurb: "Clear enough for talking.", mbPerHour: "~9 MB" },
  { kbps: 32, name: "Clear (recommended)", blurb: "Natural, full-sounding voice.", mbPerHour: "~14 MB" },
  { kbps: 48, name: "High", blurb: "Very close to being in the room.", mbPerHour: "~22 MB" },
  { kbps: 64, name: "Music", blurb: "Best for singing and shared music.", mbPerHour: "~29 MB" },
];

export default function AdminVoiceQualityPage() {
  const { config, loading, reload } = useConfig();
  const { toast } = useToast();
  const [v, setV] = useState<VQ>(QUALITY);
  const [saving, setSaving] = useState(false);

  useEffect(() => { if (!loading) setV({ ...QUALITY, ...(config.voiceQuality ?? {}) }); }, [loading, config.voiceQuality]);

  const set = (patch: Partial<VQ>) => setV((s) => ({ ...s, ...patch }));

  const save = async () => {
    setSaving(true);
    const res = await saveConfig({ voiceQuality: v });
    setSaving(false);
    if (res.ok) { await reload(); toast("Voice quality saved. It applies the next time someone joins a room.", "success"); }
    else toast(res.error ?? "Could not save", "error");
  };

  const Toggle = ({ label, hint, k, warn }: { label: string; hint: string; k: keyof VQ; warn?: string }) => (
    <div className="flex items-start gap-3 rounded-xl border border-line bg-ink-900/50 p-3">
      <div className="min-w-0 flex-1">
        <div className="text-sm font-semibold text-mist-100">{label}</div>
        <div className="mt-0.5 text-xs leading-relaxed text-mist-400">{hint}</div>
        {warn && !!v[k] === false && <div className="mt-1 text-[11px] text-amber-300">{warn}</div>}
      </div>
      <button
        onClick={() => set({ [k]: !v[k] } as Partial<VQ>)}
        role="switch" aria-checked={!!v[k]} aria-label={label}
        className={cn("relative mt-0.5 h-6 w-11 shrink-0 rounded-full transition", v[k] ? "bg-emerald-500" : "bg-mist-600")}
      >
        <span className={cn("absolute top-0.5 size-5 rounded-full bg-white shadow transition-all", v[k] ? "left-[22px]" : "left-0.5")} />
      </button>
    </div>
  );

  const current = LEVELS.reduce((best, l) => (Math.abs(l.kbps - v.bitrateKbps) < Math.abs(best.kbps - v.bitrateKbps) ? l : best), LEVELS[0]);

  return (
    <div className="space-y-5 pb-8">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 font-display text-2xl font-extrabold text-mist-100"><Mic className="size-6 text-lotus-300" /> Voice Quality</h1>
          <p className="mt-1 max-w-2xl text-sm text-mist-400">
            How voice rooms sound. These were previously fixed in the app at the lowest quality setting to
            save mobile data — which is what made voices sound thin. Changes apply the next time someone
            joins a room; nobody already talking is interrupted.
          </p>
        </div>
        <Button onClick={save} disabled={saving || loading}>{saving ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />} Save</Button>
      </div>

      {loading ? <div className="grid place-items-center py-16 text-mist-500"><Loader2 className="size-6 animate-spin" /></div> : (
        <>
          <Card className="p-5">
            <h2 className="flex items-center gap-2 font-semibold text-mist-100"><Gauge className="size-4 text-lotus-300" /> Sound quality</h2>
            <p className="mt-1 text-xs text-mist-400">Higher is clearer and uses more mobile data. Most rooms should sit on <b className="text-mist-200">Clear</b>.</p>
            <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
              {LEVELS.map((l) => (
                <button
                  key={l.kbps}
                  onClick={() => set({ bitrateKbps: l.kbps })}
                  className={cn(
                    "rounded-xl border p-3 text-left transition",
                    v.bitrateKbps === l.kbps ? "border-lotus-400/60 bg-lotus-500/10" : "border-line bg-ink-900 hover:border-lotus-400/30",
                  )}
                >
                  <div className={cn("text-sm font-bold", v.bitrateKbps === l.kbps ? "text-lotus-200" : "text-mist-200")}>{l.name}</div>
                  <div className="mt-0.5 text-[11px] leading-snug text-mist-400">{l.blurb}</div>
                  <div className="mt-1.5 font-mono text-[11px] text-mist-500">{l.kbps} kbps · {l.mbPerHour}/hour</div>
                </button>
              ))}
            </div>
            <label className="mt-4 block">
              <span className="text-xs font-semibold text-mist-300">Or set it exactly — {v.bitrateKbps} kbps ({current.name})</span>
              <input
                type="range" min={8} max={64} step={1} value={v.bitrateKbps}
                onChange={(e) => set({ bitrateKbps: Number(e.target.value) })}
                className="mt-2 w-full accent-lotus-500"
              />
              <span className="mt-1 flex justify-between text-[10px] text-mist-600"><span>8 — cheapest</span><span>64 — best</span></span>
            </label>
          </Card>

          <Card className="p-5">
            <h2 className="font-semibold text-mist-100">Microphone</h2>
            <p className="mt-1 text-xs text-mist-400">What the phone does to the sound before it is sent. Leave all three on unless you are chasing a specific problem.</p>
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              <Toggle k="noiseSuppression" label="Remove background noise" hint="Filters out fans, traffic, TV and room hum so only the voice comes through." warn="Off means every background sound is transmitted." />
              <Toggle k="echoCancellation" label="Cancel echo" hint="Stops the sound coming out of the speaker being picked up again by the microphone — the usual cause of echo when someone isn't wearing headphones." warn="Off will cause echo for anyone not using headphones." />
              <Toggle k="autoGainControl" label="Even out loudness" hint="Lifts quiet speakers and holds back loud ones, so everyone is heard at a similar level." warn="Off means quiet speakers stay quiet." />
              <Toggle k="voiceIsolation" label="Extra voice focus" hint="A stronger voice-only filter on browsers that support it (mainly Chrome on Android). Ignored elsewhere." />
            </div>
          </Card>

          <Card className="p-5">
            <h2 className="font-semibold text-mist-100">Connection</h2>
            <p className="mt-1 text-xs text-mist-400">How the sound is sent. These two decide whether a weak signal turns into a dropout.</p>
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              <Toggle
                k="red"
                label="Protect against dropouts"
                hint="Sends each piece of sound more than once, so losing one on a weak mobile signal doesn't create an audible gap. Costs a little extra data."
                warn="Off means a weak signal will produce gaps and broken words."
              />
              <Toggle
                k="dtx"
                label="Save data during silence"
                hint="Sends nothing at all while someone isn't talking. Saves a lot of data on long calls, but can clip the first moment of a word and make speech sound gated."
              />
              <Toggle k="stereo" label="Stereo" hint="Two channels instead of one. Doubles the data and makes no difference to speech — only worth it for shared music." />
            </div>
          </Card>

          <div className="flex flex-wrap items-center gap-3">
            <Button variant="secondary" onClick={() => setV(QUALITY)}><RotateCcw className="size-4" /> Back to recommended</Button>
            <p className="flex items-start gap-1.5 text-[11px] text-mist-500">
              <Info className="mt-0.5 size-3.5 shrink-0 text-sky-300" />
              Recommended = Clear (32 kbps), dropout protection on, silence-saving off, all three microphone
              filters on.
            </p>
          </div>

          <Card className="p-5">
            <h2 className="font-semibold text-mist-100">If someone still reports poor voice</h2>
            <ul className="mt-2 space-y-1.5 text-xs leading-relaxed text-mist-400">
              <li><b className="text-mist-200">Echo</b> — almost always someone in the room not wearing headphones. Echo cancellation helps, but it cannot fully remove a phone speaker pointed at its own microphone.</li>
              <li><b className="text-mist-200">Robotic or breaking up</b> — a weak connection, not the settings. Check &ldquo;Protect against dropouts&rdquo; is on; lowering the quality can also help on a very poor signal.</li>
              <li><b className="text-mist-200">Too quiet</b> — turn on &ldquo;Even out loudness&rdquo;, and check the member isn&rsquo;t half-covering the microphone.</li>
              <li><b className="text-mist-200">Words getting clipped</b> — turn &ldquo;Save data during silence&rdquo; off.</li>
              <li><b className="text-mist-200">Delay</b> — distance to the server and the member&rsquo;s connection. Not something these settings change.</li>
            </ul>
          </Card>
        </>
      )}
    </div>
  );
}
