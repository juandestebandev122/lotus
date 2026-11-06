"use client";

// Admin → Dice Styles. The dice equivalent of Admin → Tokens: one catalogue the
// admin fully controls — rename, reorder, enable/disable, replace a built-in die's
// look with uploaded art, or add brand-new dice. Players pick from the ENABLED
// entries in Customize.

import { useEffect, useState } from "react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import { useConfig, saveConfig } from "@/lib/config";
import { resolveDiceDesigns, DICE_CATEGORIES, type DiceDesignCfg } from "@/lib/diceDesigns";
import { Die } from "@/components/Die";
import { withBase } from "@/lib/base-path";
import { cn } from "@/lib/cn";
import { Dices, Plus, Trash2, Check, ArrowUp, ArrowDown, ImageUp, Eye, EyeOff, Coins } from "lucide-react";

export default function AdminDicePage() {
  const { config, loading, reload } = useConfig();
  const { toast } = useToast();
  const [designs, setDesigns] = useState<DiceDesignCfg[]>([]);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [replaceId, setReplaceId] = useState<string | null>(null);
  const [fileEl, setFileEl] = useState<HTMLInputElement | null>(null);

  useEffect(() => { if (!loading) setDesigns(resolveDiceDesigns(config.diceDesigns)); }, [loading, config.diceDesigns]);

  const patch = (id: string, p: Partial<DiceDesignCfg>) =>
    setDesigns((ds) => ds.map((d) => (d.id === id ? { ...d, ...p } : d)));

  const doUpload = async (file: File): Promise<string | null> => {
    try {
      const fd = new FormData();
      fd.append("file", file);
      const r = await fetch(withBase("/api/admin/upload-media"), { method: "POST", credentials: "include", body: fd });
      const d = await r.json().catch(() => ({}));
      if (r.ok && d.url) return d.url as string;
      toast((d as { error?: string }).error ?? "Upload failed", "error");
    } catch { toast("Upload failed", "error"); }
    return null;
  };

  const onFile = async (file?: File) => {
    if (!file || !replaceId) return;
    setUploading(true);
    const url = await doUpload(file);
    setUploading(false);
    if (url) { patch(replaceId, { image: url }); toast("Dice face uploaded — press Save to make it live.", "success"); }
    setReplaceId(null);
    if (fileEl) fileEl.value = "";
  };

  const addDesign = () =>
    setDesigns((ds) => [
      ...ds,
      {
        id: `dice-${Math.random().toString(36).slice(2, 8)}`,
        name: `New dice ${ds.length + 1}`,
        enabled: false, // off until the admin gives it art and turns it on
        surface: "bg-gradient-to-br from-white to-zinc-200",
        pip: "bg-zinc-900",
        category: "Free",
        order: ds.length,
      },
    ]);

  const move = (id: string, dir: -1 | 1) =>
    setDesigns((ds) => {
      const i = ds.findIndex((d) => d.id === id);
      const j = i + dir;
      if (i < 0 || j < 0 || j >= ds.length) return ds;
      const next = [...ds];
      [next[i], next[j]] = [next[j], next[i]];
      return next.map((d, k) => ({ ...d, order: k }));
    });

  const save = async () => {
    setSaving(true);
    const res = await saveConfig({ diceDesigns: designs.map((d, i) => ({ ...d, order: i })) });
    setSaving(false);
    if (res.ok) { await reload(); toast("Dice styles saved — live for every player.", "success"); }
    else toast(res.error ?? "Could not save", "error");
  };

  const enabledCount = designs.filter((d) => d.enabled).length;

  return (
    <div className="space-y-5 pb-24">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 font-display text-2xl font-extrabold text-mist-100"><Dices className="size-6 text-lotus-300" /> Dice Styles</h1>
          <p className="mt-1 text-sm text-mist-400">
            Every dice players can choose. Rename, reorder, turn one off, replace its face with your own picture, or add new ones.
            Players pick from the <b className="text-mist-200">{enabledCount}</b> enabled style{enabledCount === 1 ? "" : "s"} in Frames &amp; Appearance.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={addDesign}><Plus className="size-4" /> Add dice</Button>
          <Button onClick={save} disabled={saving || loading}><Check className="size-4" /> {saving ? "Saving…" : "Save changes"}</Button>
        </div>
      </div>

      <input ref={setFileEl} type="file" accept="image/*" hidden onChange={(e) => void onFile(e.target.files?.[0])} />

      <Card className="p-3 text-[11px] leading-relaxed text-mist-400">
        <b className="text-mist-200">Uploading a dice face:</b> use a <b className="text-mist-200">square PNG with a transparent background</b>,
        about <b className="text-mist-200">256 × 256 px</b>. The picture replaces the drawn pips completely, so the number must be
        readable in the art itself — or leave it empty and just set the colours below.
      </Card>

      <div className="space-y-2">
        {designs.map((d, i) => (
          <Card key={d.id} className={cn("flex flex-wrap items-center gap-3 p-3", !d.enabled && "opacity-60")}>
            {/* Live preview of exactly what a player will see */}
            <span className="shrink-0">
              <Die face={5} surface={d.surface} pipClass={d.pip} faceImage={d.image} className="size-12" />
            </span>

            <input
              value={d.name}
              onChange={(e) => patch(d.id, { name: e.target.value })}
              className="h-9 min-w-[8rem] flex-1 rounded-lg border border-line bg-ink-900 px-2.5 text-sm text-mist-100 outline-none focus:border-lotus-400"
            />

            <select
              value={d.category ?? "Free"}
              onChange={(e) => {
                const category = e.target.value;
                // Moving a dice to Free clears its price so it can't stay locked
                // behind a payment it no longer advertises.
                patch(d.id, category === "Free" ? { category, priceCoins: 0 } : { category });
              }}
              className="h-9 rounded-lg border border-line bg-ink-900 px-2 text-xs font-semibold text-mist-100 outline-none focus:border-lotus-400"
            >
              {DICE_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>

            {/* NO PRICE HERE, deliberately. This page is the simple face
                library — it decides how a die LOOKS, nothing more. Dice are sold
                on Admin → Dice Models, which is the complete dice (body, pips,
                per-number artwork and the roll animation), so there is exactly
                one place to price a dice and no chance of two prices for one
                thing. */}

            <button
              onClick={() => { setReplaceId(d.id); fileEl?.click(); }}
              disabled={uploading}
              title="Upload a picture for this dice face"
              className="grid size-9 shrink-0 place-items-center rounded-lg bg-white/[0.06] text-mist-200 transition hover:bg-white/[0.12]"
            >
              <ImageUp className="size-4" />
            </button>
            {d.image && (
              <button onClick={() => patch(d.id, { image: "" })} title="Remove the uploaded picture (back to drawn pips)" className="text-xs font-semibold text-rose-300 hover:text-rose-200">
                Clear art
              </button>
            )}

            <button
              onClick={() => patch(d.id, { enabled: !d.enabled })}
              title={d.enabled ? "Enabled — tap to hide from players" : "Disabled — tap to show to players"}
              className={cn("grid size-9 shrink-0 place-items-center rounded-lg text-white transition", d.enabled ? "bg-emerald-500 hover:brightness-110" : "bg-mist-600 hover:brightness-110")}
            >
              {d.enabled ? <Eye className="size-4" /> : <EyeOff className="size-4" />}
            </button>

            <div className="flex shrink-0 items-center gap-1">
              <button onClick={() => move(d.id, -1)} disabled={i === 0} className="grid size-8 place-items-center rounded-lg bg-white/[0.06] text-mist-300 disabled:opacity-30"><ArrowUp className="size-4" /></button>
              <button onClick={() => move(d.id, 1)} disabled={i === designs.length - 1} className="grid size-8 place-items-center rounded-lg bg-white/[0.06] text-mist-300 disabled:opacity-30"><ArrowDown className="size-4" /></button>
            </div>

            {/* Only an admin-added dice can be deleted — a built-in is disabled instead,
                so a player who already picked it never ends up with a missing style. */}
            {!d.builtin && (
              <button
                onClick={() => setDesigns((ds) => ds.filter((x) => x.id !== d.id))}
                title="Delete this dice"
                className="grid size-9 shrink-0 place-items-center rounded-lg bg-rose-500/15 text-rose-300 transition hover:bg-rose-500/25"
              >
                <Trash2 className="size-4" />
              </button>
            )}
          </Card>
        ))}
      </div>

      <div className="flex justify-end">
        <Button size="lg" onClick={save} disabled={saving || loading}><Check className="size-4" /> {saving ? "Saving…" : "Save changes"}</Button>
      </div>
    </div>
  );
}
