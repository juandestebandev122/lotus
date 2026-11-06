"use client";

import { useEffect, useRef, useState } from "react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { useToast } from "@/components/ui/Toast";
import { useConfig, saveConfig } from "@/lib/config";
import { resolveTokenDesigns, TOKEN_CATEGORIES, TOKEN_COLORS, type TokenDesignCfg, type TokenColor } from "@/lib/tokenDesigns";

// The four Ludo player colours, for the per-colour upload chips.
const COLOR_DOT: Record<TokenColor, string> = {
  red: "bg-rose-500", green: "bg-emerald-500", yellow: "bg-amber-400", blue: "bg-sky-500",
};
import { LudoToken } from "@/components/LudoToken";
import { withBase } from "@/lib/base-path";
import { cn } from "@/lib/cn";
import { CircleDot, Plus, Trash2, Upload, Eye, EyeOff, Check, ArrowUp, ArrowDown, ImageUp } from "lucide-react";
import { CosmeticPriceControl } from "@/components/admin/CosmeticPriceControl";

export default function AdminTokensPage() {
  const { config, loading, reload } = useConfig();
  const { toast } = useToast();
  const [designs, setDesigns] = useState<TokenDesignCfg[]>([]);
  const [saving, setSaving] = useState(false);
  const [confirmDel, setConfirmDel] = useState<TokenDesignCfg | null>(null);
  // New custom design draft
  const [newName, setNewName] = useState("");
  const [newImage, setNewImage] = useState<string | null>(null);
  const [newCategory, setNewCategory] = useState<string>("Free");
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  // Which colour the pending upload belongs to (null = the shared image).
  const [replaceColor, setReplaceColor] = useState<TokenColor | null>(null);
  // Replace-image flow: which design we're replacing the art of.
  const [replaceId, setReplaceId] = useState<string | null>(null);
  const replaceRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!loading) setDesigns(resolveTokenDesigns(config.tokenDesigns));
  }, [loading, config]);

  const enabledCount = designs.filter((d) => d.enabled).length;

  const patch = (id: string, next: Partial<TokenDesignCfg>) =>
    setDesigns((ds) => ds.map((d) => (d.id === id ? { ...d, ...next } : d)));

  const save = async () => {
    if (enabledCount === 0) { toast("Keep at least one design enabled so players have a token.", "error"); return; }
    setSaving(true);
    // Persist the current display order (Customize shows them in this exact order).
    const ordered = designs.map((d, i) => ({ ...d, order: i }));
    const res = await saveConfig({ tokenDesigns: ordered });
    setSaving(false);
    if (res.ok) { await reload(); toast("Token designs saved — live for all players.", "success"); }
    else toast(res.error ?? "Could not save", "error");
  };

  const upload = async (file: File) => {
    setUploading(true);
    const url = await doUpload(file);
    setUploading(false);
    if (url) { setNewImage(url); toast("Image uploaded — now name it and add.", "success"); }
  };

  const addCustom = () => {
    if (!newName.trim()) { toast("Give the design a name.", "error"); return; }
    if (!newImage) { toast("Upload an image for the design first.", "error"); return; }
    const id = `custom-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`;
    setDesigns((ds) => [...ds, { id, name: newName.trim().slice(0, 60), enabled: true, image: newImage, category: newCategory, order: ds.length }]);
    setNewName(""); setNewImage(null); setNewCategory("Free");
    if (fileRef.current) fileRef.current.value = "";
    toast("Custom design added — press Save changes to make it live.", "success");
  };

  const remove = (d: TokenDesignCfg) => {
    setDesigns((ds) => ds.filter((x) => x.id !== d.id));
    setConfirmDel(null);
  };

  // Upload a REPLACEMENT image for an existing design (built-in or custom). The new
  // image overrides that design's art everywhere — how the admin fixes/updates a token.
  const doUpload = async (file: File): Promise<string | null> => {
    const fd = new FormData();
    fd.append("file", file);
    try {
      const res = await fetch(withBase("/api/admin/tokens"), { method: "POST", body: fd, credentials: "include" });
      const d = await res.json();
      if (res.ok && d.url) return d.url as string;
      toast(d.error ?? "Upload failed", "error");
    } catch { toast("Upload failed", "error"); }
    return null;
  };

  const replaceImage = async (file: File) => {
    if (!replaceId) return;
    setUploading(true);
    const url = await doUpload(file);
    setUploading(false);
    if (url) {
      if (replaceColor) {
        // One colour's own artwork — merged so the other three are untouched.
        const cur = designs.find((x) => x.id === replaceId)?.images ?? {};
        patch(replaceId, { images: { ...cur, [replaceColor]: url } });
        toast(`${replaceColor} coin image set — press Save changes to make it live.`, "success");
      } else {
        patch(replaceId, { image: url });
        toast("Image replaced — press Save changes to make it live.", "success");
      }
    }
    setReplaceId(null);
    setReplaceColor(null);
    if (replaceRef.current) replaceRef.current.value = "";
  };

  // Move a design up/down in the display order (Customize shows them in this order).
  const move = (id: string, dir: -1 | 1) => {
    setDesigns((ds) => {
      const i = ds.findIndex((d) => d.id === id);
      const j = i + dir;
      if (i < 0 || j < 0 || j >= ds.length) return ds;
      const next = [...ds];
      [next[i], next[j]] = [next[j], next[i]];
      return next.map((d, k) => ({ ...d, order: k })); // re-number so the order sticks
    });
  };

  return (
    <div className="mx-auto max-w-4xl space-y-5 pb-24">
      <div>
        <h1 className="flex items-center gap-2 font-display text-2xl font-extrabold text-mist-100">
          <CircleDot className="size-6 text-lotus-300" /> Token Management
        </h1>
        <p className="mt-1 text-sm text-mist-400">
          Control every game token design. Rename designs, turn them on/off for players, upload your own
          custom tokens, and delete ones you added. Players only see the <b>enabled</b> designs in Customize.
        </p>
      </div>

      {/* Add a custom design */}
      <Card className="p-4 sm:p-5">
        <h2 className="flex items-center gap-2 font-display text-lg font-bold text-mist-100"><Plus className="size-5 text-lotus-300" /> Add a custom token</h2>
        <p className="mt-0.5 text-sm text-mist-400">Upload an image (PNG with transparent background looks best), give it a name, and add it. The same image is used for all four players in their colour.</p>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <div className="grid size-16 shrink-0 place-items-center rounded-xl border border-line bg-ink-800">
            {newImage ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={withBase(newImage)} alt="" className="size-14 object-contain" />
            ) : (
              <CircleDot className="size-7 text-mist-600" />
            )}
          </div>
          <div className="flex flex-1 flex-wrap items-center gap-2">
            <input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Design name (e.g. Diamond)"
              className="h-10 min-w-40 flex-1 rounded-lg border border-line bg-ink-800 px-3 text-sm text-mist-100 outline-none focus:border-lotus-400"
            />
            <select
              value={newCategory}
              onChange={(e) => setNewCategory(e.target.value)}
              title="Category"
              className="h-10 rounded-lg border border-line bg-ink-800 px-2 text-sm font-semibold text-mist-100 outline-none focus:border-lotus-400"
            >
              {TOKEN_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
            <input ref={fileRef} type="file" accept="image/*" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) upload(f); }} />
            <Button variant="secondary" onClick={() => fileRef.current?.click()} disabled={uploading}>
              <Upload className="size-4" /> {uploading ? "Uploading…" : newImage ? "Change image" : "Upload image"}
            </Button>
            <Button onClick={addCustom} disabled={!newImage || !newName.trim()}><Plus className="size-4" /> Add</Button>
          </div>
        </div>
      </Card>

      {/* Design list */}
      <Card className="p-4 sm:p-5">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-display text-lg font-bold text-mist-100">All token designs</h2>
          {/* Read as a LIMIT once ("16 of 19 enabled" looked like a cap of 19),
              so it now says plainly that there isn't one. */}
          <span className="text-xs text-mist-400">
            {designs.length} design{designs.length === 1 ? "" : "s"} · {enabledCount} shown to players
            <span className="ml-1.5 text-mist-500">· no limit, add as many as you like</span>
          </span>
        </div>
        {/* Hidden input for the per-design "Replace image" action. */}
        <input ref={replaceRef} type="file" accept="image/*" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) replaceImage(f); }} />
        <div className="space-y-2.5">
          {designs.map((d, i) => (
            <div key={d.id} className={cn("flex flex-wrap items-center gap-2.5 rounded-xl border p-2.5", d.enabled ? "border-line bg-ink-800" : "border-line/60 bg-ink-850 opacity-70")}>
              {/* reorder */}
              <div className="flex flex-col gap-0.5">
                <button onClick={() => move(d.id, -1)} disabled={i === 0} title="Move up" className="grid size-5 place-items-center rounded text-mist-400 transition hover:bg-white/[0.06] hover:text-mist-100 disabled:opacity-25"><ArrowUp className="size-3.5" /></button>
                <button onClick={() => move(d.id, 1)} disabled={i === designs.length - 1} title="Move down" className="grid size-5 place-items-center rounded text-mist-400 transition hover:bg-white/[0.06] hover:text-mist-100 disabled:opacity-25"><ArrowDown className="size-3.5" /></button>
              </div>
              <span className="block size-11 shrink-0"><LudoToken color="red" skin={d.builtin ?? d.id} image={d.image} /></span>
              <div className="min-w-32 flex-1">
                <input
                  value={d.name}
                  onChange={(e) => patch(d.id, { name: e.target.value })}
                  className="h-8 w-full rounded-md border border-transparent bg-transparent px-1 text-sm font-semibold text-mist-100 outline-none hover:border-line focus:border-lotus-400"
                />
                <span className={cn("ml-1 text-[10px] font-semibold uppercase tracking-wide", d.builtin ? "text-mist-500" : "text-lotus-300")}>
                  {d.builtin ? "Built-in" : "Custom"}{d.image && d.builtin ? " · replaced" : ""}
                </span>
              </div>
              {/* category */}
              <select
                value={d.category ?? "Free"}
                onChange={(e) => patch(d.id, { category: e.target.value })}
                title="Category"
                className="h-9 rounded-lg border border-line bg-ink-900 px-2 text-xs font-semibold text-mist-100 outline-none focus:border-lotus-400"
              >
                {TOKEN_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
              {/* PRICE — set a coin price and this token appears in the Store's
                  Tokens category on its own. 0 keeps it free for everyone. */}
              <CosmeticPriceControl
                kind="token"
                id={d.id}
                price={d.priceCoins ?? 0}
                onPrice={(v) => patch(d.id, { priceCoins: v })}
                validityDays={d.validityDays ?? 0}
                onValidity={(v) => patch(d.id, { validityDays: v })}
                saved={!saving}
                className="basis-full"
              />
              {/* replace image — the SHARED picture, used for any colour that
                  has no dedicated art of its own */}
              <button
                onClick={() => { setReplaceColor(null); setReplaceId(d.id); replaceRef.current?.click(); }}
                disabled={uploading}
                title="Upload the shared image for this token (used for any colour without its own picture)"
                className="grid size-9 shrink-0 place-items-center rounded-lg bg-white/[0.06] text-mist-200 transition hover:bg-white/[0.12]"
              >
                <ImageUp className="size-4" />
              </button>
              {/* PER-COLOUR art. Without this every player's coin looked identical,
                  so in a 4-player game you could not tell whose coin was whose. */}
              <div className="flex shrink-0 items-center gap-1" title="Upload a different picture for each player colour">
                {TOKEN_COLORS.map((c) => {
                  const has = !!d.images?.[c];
                  return (
                    <button
                      key={c}
                      onClick={() => { setReplaceColor(c); setReplaceId(d.id); replaceRef.current?.click(); }}
                      disabled={uploading}
                      title={`${c[0].toUpperCase()}${c.slice(1)} coin — ${has ? "replace its picture" : "upload its own picture"}`}
                      className={cn(
                        "size-6 rounded-full ring-2 transition hover:brightness-125",
                        COLOR_DOT[c],
                        has ? "ring-white" : "ring-white/25 opacity-60",
                      )}
                    />
                  );
                })}
              </div>
              {/* enable */}
              <button
                onClick={() => patch(d.id, { enabled: !d.enabled })}
                title={d.enabled ? "Enabled — tap to hide from players" : "Disabled — tap to show to players"}
                className={cn("grid size-9 shrink-0 place-items-center rounded-lg text-white transition", d.enabled ? "bg-emerald-500 hover:brightness-110" : "bg-mist-600 hover:brightness-110")}
              >
                {d.enabled ? <Eye className="size-4" /> : <EyeOff className="size-4" />}
              </button>
              {/* delete (custom only) */}
              {!d.builtin && (
                <button onClick={() => setConfirmDel(d)} title="Delete custom design" className="grid size-9 shrink-0 place-items-center rounded-lg bg-rose-500/15 text-rose-300 transition hover:bg-rose-500/25">
                  <Trash2 className="size-4" />
                </button>
              )}
            </div>
          ))}
        </div>
      </Card>

      {/* Sticky save bar */}
      <div className="fixed inset-x-0 bottom-0 z-20 border-t border-line bg-ink-900/95 px-4 py-3 backdrop-blur">
        <div className="mx-auto flex max-w-4xl items-center justify-between gap-3">
          <span className="text-xs text-mist-400">Changes apply to every player after you save.</span>
          <Button onClick={save} disabled={saving}><Check className="size-4" /> {saving ? "Saving…" : "Save changes"}</Button>
        </div>
      </div>

      {confirmDel && (
        <ConfirmDialog
          danger
          title="Delete this token design?"
          message={`"${confirmDel.name}" will be removed. Players currently using it will fall back to the default token.`}
          confirmLabel="Delete"
          cancelLabel="Keep"
          onConfirm={() => remove(confirmDel)}
          onCancel={() => setConfirmDel(null)}
        />
      )}
    </div>
  );
}
