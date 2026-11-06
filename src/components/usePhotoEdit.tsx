"use client";

import { useState } from "react";
import { useConfig } from "@/lib/config";
import { useToast } from "@/components/ui/Toast";
import { fileToDataUrl } from "@/lib/image";
import { PhotoEditor, type PhotoEditorConfig } from "@/components/PhotoEditor";

export type EditAspect = "square" | "cover" | "free";

// Per-aspect editor tuning. Avatars lock to a circular 1:1; covers/banners open the
// wider aspect presets and keep more resolution; products/free let the user choose.
const ASPECT_CFG: Record<EditAspect, Partial<PhotoEditorConfig>> = {
  square: { forceSquare: true, forceCircle: true },
  cover: { forceSquare: false, forceCircle: false, maxRes: 1280 },
  free: { forceSquare: false, forceCircle: false, maxRes: 1280 },
};

/**
 * Shared advanced-image-editor flow used EVERYWHERE an image is uploaded, so the
 * crop / zoom / rotate / flip experience is identical to the profile-photo editor.
 * Validates the picked file against the admin's Photo Editor limits, opens the
 * editor, and hands back the edited image as a data-URL.
 *
 *   const { pick, editor } = usePhotoEdit({ aspect: "cover" });
 *   <input type="file" accept="image/*" onChange={e => {
 *      pick(e.target.files?.[0], url => setCover(url)); e.target.value = "";
 *   }} />
 *   {editor}
 *
 * `pick` takes an optional per-call aspect so one hook can serve both an avatar and
 * a cover on the same screen.
 */
export function usePhotoEdit(defaults?: { aspect?: EditAspect }) {
  const { config } = useConfig();
  const { toast } = useToast();
  const pe = config.photoEditor ?? {};
  const [pending, setPending] = useState<{ file: File; aspect: EditAspect; onDone: (url: string) => void } | null>(null);

  const pick = (file: File | undefined | null, onDone: (url: string) => void, aspect: EditAspect = defaults?.aspect ?? "square") => {
    if (!file) return;
    // Format + size validation (mirrors the profile editor).
    const formats = pe.formats ?? ["jpg", "png", "webp"];
    const ext = (file.name.split(".").pop() || "").toLowerCase().replace("jpeg", "jpg");
    const okType = formats.some((f) => f === ext) || /^image\//.test(file.type);
    if (!okType) { toast(`Please choose a ${formats.map((f) => f.toUpperCase()).join(" / ")} image.`, "error"); return; }
    const maxMB = pe.maxSizeMB ?? 10;
    if (file.size > maxMB * 1024 * 1024) { toast(`Image is too large (max ${maxMB} MB).`, "error"); return; }
    // Admin master-switch OFF → skip the editor, just downscale (keeps behaviour consistent).
    if (pe.enabled === false) {
      const w = aspect === "square" ? (pe.maxRes ?? 512) : 1280;
      fileToDataUrl(file, w, (pe.quality ?? 82) / 100).then(onDone).catch(() => toast("Could not read that image", "error"));
      return;
    }
    setPending({ file, aspect, onDone });
  };

  const cfg: PhotoEditorConfig = pending ? { ...pe, ...ASPECT_CFG[pending.aspect] } : pe;
  const editor = pending ? (
    <PhotoEditor
      file={pending.file}
      config={cfg}
      onCancel={() => setPending(null)}
      onSave={(url) => { const done = pending.onDone; setPending(null); done(url); }}
    />
  ) : null;

  return { pick, editor };
}
