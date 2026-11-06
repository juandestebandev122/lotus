"use client";

import { useRef, useState } from "react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import { useConfig } from "@/lib/config";
import { withBase } from "@/lib/base-path";
import { brandSrc, BRAND_SLOTS, type BrandSlot, type BrandSlotDef } from "@/lib/brand-images";
import { ImageIcon, Upload, RotateCcw, Loader2, Check } from "lucide-react";

const GROUPS = ["Branding", "Home", "Decorations", "Illustrations"] as const;

export default function AdminBrandingPage() {
  const { config, reload } = useConfig();
  const { toast } = useToast();
  const [busy, setBusy] = useState<string>("");

  const images = config.images ?? {};

  const upload = async (slot: BrandSlot, file: File) => {
    if (!file.type.startsWith("image/")) { toast("Please choose an image file.", "error"); return; }
    setBusy(slot);
    try {
      const fd = new FormData();
      fd.append("slot", slot);
      fd.append("file", file);
      const res = await fetch(withBase("/api/admin/branding"), { method: "POST", credentials: "include", body: fd });
      const d = await res.json().catch(() => ({}));
      if (res.ok) { await reload(); toast("Image updated ✓", "success"); }
      else toast(d.error ?? "Upload failed", "error");
    } catch { toast("Network error during upload", "error"); }
    setBusy("");
  };

  const reset = async (slot: BrandSlot) => {
    if (!confirm("Reset this image back to the built-in default?")) return;
    setBusy(slot);
    try {
      const res = await fetch(withBase("/api/admin/branding"), { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "reset", slot }) });
      if (res.ok) { await reload(); toast("Reset to default", "success"); }
      else toast("Could not reset", "error");
    } catch { toast("Network error", "error"); }
    setBusy("");
  };

  return (
    <div className="mx-auto max-w-5xl">
      <div className="mb-2 flex items-center gap-2">
        <ImageIcon className="size-6 text-lotus-300" />
        <h1 className="text-2xl font-extrabold text-mist-100">App Images</h1>
      </div>
      <p className="mb-5 text-sm text-mist-400">
        Change any image used across the app. Upload a new picture for a slot to replace it everywhere instantly, or reset it back to the built-in default. Transparent PNGs work best for logos & decorations.
      </p>

      {GROUPS.map((group) => {
        const slots = BRAND_SLOTS.filter((s) => s.group === group);
        if (slots.length === 0) return null;
        return (
          <div key={group} className="mb-6">
            <h2 className="mb-2.5 text-sm font-bold uppercase tracking-wide text-mist-400">{group}</h2>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {slots.map((s) => (
                <SlotCard
                  key={s.key}
                  slot={s}
                  src={brandSrc(images, s.key)}
                  custom={!!images[s.key]}
                  busy={busy === s.key}
                  onUpload={(f) => upload(s.key, f)}
                  onReset={() => reset(s.key)}
                />
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function SlotCard({
  slot, src, custom, busy, onUpload, onReset,
}: {
  slot: BrandSlotDef; src: string; custom: boolean; busy: boolean;
  onUpload: (f: File) => void; onReset: () => void;
}) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  return (
    <Card className="p-3">
      <div className="flex items-start gap-3">
        <span className="grid size-16 shrink-0 place-items-center overflow-hidden rounded-xl border border-white/10 bg-[repeating-conic-gradient(#2a2440_0%_25%,#221d38_0%_50%)] bg-[length:14px_14px]">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={src} alt={slot.label} className="max-h-full max-w-full object-contain" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <p className="truncate text-sm font-semibold text-mist-100">{slot.label}</p>
            {custom ? (
              <span className="inline-flex items-center gap-0.5 rounded-full bg-emerald-500/15 px-1.5 py-0.5 text-[9px] font-bold text-emerald-300"><Check className="size-2.5" /> custom</span>
            ) : (
              <span className="rounded-full bg-white/[0.06] px-1.5 py-0.5 text-[9px] text-mist-400">default</span>
            )}
          </div>
          <p className="mt-0.5 line-clamp-2 text-[11px] text-mist-500">{slot.desc}</p>
          <p className="mt-0.5 text-[10px] text-mist-600">{slot.ratio}</p>
        </div>
      </div>
      <div className="mt-3 flex gap-2">
        <input ref={inputRef} type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) onUpload(f); e.target.value = ""; }} />
        <Button size="sm" block disabled={busy} onClick={() => inputRef.current?.click()}>
          {busy ? <Loader2 className="size-4 animate-spin" /> : <Upload className="size-4" />} Change
        </Button>
        {custom && (
          <Button size="sm" variant="secondary" disabled={busy} onClick={onReset} title="Reset to default"><RotateCcw className="size-4" /></Button>
        )}
      </div>
    </Card>
  );
}
