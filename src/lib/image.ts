// Read an image File, downscale it on a canvas, and return a compressed
// JPEG data URL. Keeps stored images small enough for the JSON DB while
// staying crisp. Client-only (uses document/FileReader/Image).
export async function fileToDataUrl(file: File, maxW: number, quality = 0.82): Promise<string> {
  const dataUrl: string = await new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result as string);
    r.onerror = () => reject(new Error("read failed"));
    r.readAsDataURL(file);
  });

  const img: HTMLImageElement = await new Promise((resolve, reject) => {
    const i = new Image();
    i.onload = () => resolve(i);
    i.onerror = () => reject(new Error("decode failed"));
    i.src = dataUrl;
  });

  const scale = Math.min(1, maxW / (img.width || maxW));
  const w = Math.max(1, Math.round((img.width || maxW) * scale));
  const h = Math.max(1, Math.round((img.height || maxW) * scale));
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) return dataUrl;
  ctx.drawImage(img, 0, 0, w, h);
  return canvas.toDataURL("image/jpeg", quality);
}
