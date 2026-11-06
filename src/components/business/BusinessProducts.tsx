"use client";

import { useEffect, useRef, useState } from "react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input, Textarea } from "@/components/ui/Input";
import { useToast } from "@/components/ui/Toast";
import { cn } from "@/lib/cn";
import {
  fetchBusinessProducts, createBusinessProduct, updateBusinessProduct, deleteBusinessProduct, productEnquiry,
  type BizProduct, type BizProductInput,
} from "@/lib/business";
import { usePhotoEdit } from "@/components/usePhotoEdit";
import { ShoppingBag, Plus, ImagePlus, Trash2, Pencil, Loader2, Store, MessageCircleMore, X } from "lucide-react";

// eslint-disable-next-line @typescript-eslint/no-unused-vars
function readImage(file: File, maxMB: number): Promise<string> {
  return new Promise((resolve, reject) => {
    if (file.size > maxMB * 1024 * 1024) return reject(new Error(`Image too large (max ${maxMB}MB).`));
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = () => reject(new Error("Could not read image."));
    r.readAsDataURL(file);
  });
}

export function BusinessProducts({ businessId, canManage }: { businessId: string; canManage: boolean }) {
  const { toast } = useToast();
  const [products, setProducts] = useState<BizProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<BizProduct | null>(null);
  const [adding, setAdding] = useState(false);

  const reload = () => fetchBusinessProducts(businessId).then((d) => { setProducts(d.products); setLoading(false); });
  useEffect(() => { reload(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [businessId]);

  const enquire = async (p: BizProduct) => {
    const res = await productEnquiry(p.id);
    if (res.ok) toast(`Enquiry sent to the seller about "${p.name}".`, "success");
    else toast(res.error ?? "Could not send enquiry", "error");
  };
  const remove = async (p: BizProduct) => {
    if (!window.confirm(`Delete "${p.name}"?`)) return;
    const res = await deleteBusinessProduct(p.id);
    if (res.ok) { toast("Product deleted", "success"); reload(); }
    else toast(res.error ?? "Could not delete", "error");
  };

  return (
    <div className="space-y-4">
      {canManage && (
        <>
          {adding || editing ? (
            <ProductForm
              businessId={businessId}
              product={editing}
              onDone={() => { setAdding(false); setEditing(null); reload(); }}
              onCancel={() => { setAdding(false); setEditing(null); }}
            />
          ) : (
            <Button size="sm" onClick={() => setAdding(true)}><Plus className="size-4" /> Add product / service</Button>
          )}
        </>
      )}

      {loading ? (
        <Card className="p-6 text-center text-sm text-mist-500">Loading products…</Card>
      ) : products.length === 0 ? (
        <Card className="p-8 text-center">
          <Store className="mx-auto size-8 text-mist-500" />
          <p className="mt-2 text-sm text-mist-300">No products listed yet.</p>
          {canManage && <p className="text-xs text-mist-500">Add your first product or service above.</p>}
        </Card>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {products.map((p) => (
            <Card key={p.id} className="overflow-hidden p-0">
              <div className="aspect-square w-full bg-ink-800">
                {p.imageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={p.imageUrl} alt={p.name} className="size-full object-cover" />
                ) : (
                  <div className="grid size-full place-items-center text-mist-600"><ShoppingBag className="size-8" /></div>
                )}
              </div>
              <div className="p-2.5">
                <p className="truncate text-sm font-semibold text-mist-100">{p.name}</p>
                {p.price && <p className="text-sm font-bold text-lotus-300">{p.price}</p>}
                {p.description && <p className="mt-0.5 line-clamp-2 text-[11px] text-mist-500">{p.description}</p>}
                <div className="mt-2 flex gap-1.5">
                  {canManage ? (
                    <>
                      <button onClick={() => setEditing(p)} className="flex flex-1 items-center justify-center gap-1 rounded-lg border border-line bg-ink-800 py-1.5 text-[11px] font-semibold text-mist-300 hover:bg-ink-700"><Pencil className="size-3" /> Edit</button>
                      <button onClick={() => remove(p)} className="grid size-7 place-items-center rounded-lg border border-line bg-ink-800 text-rose-300 hover:bg-rose-500/10"><Trash2 className="size-3.5" /></button>
                    </>
                  ) : (
                    <button onClick={() => enquire(p)} className="flex w-full items-center justify-center gap-1 rounded-lg bg-lotus-500/15 py-1.5 text-[11px] font-semibold text-lotus-200 hover:bg-lotus-500/25"><MessageCircleMore className="size-3.5" /> Contact seller</button>
                  )}
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

function ProductForm({ businessId, product, onDone, onCancel }: { businessId: string; product: BizProduct | null; onDone: () => void; onCancel: () => void }) {
  const { toast } = useToast();
  const [f, setF] = useState<BizProductInput>({ name: product?.name ?? "", description: product?.description ?? "", price: product?.price ?? "" });
  const [preview, setPreview] = useState(product?.imageUrl ?? "");
  const [saving, setSaving] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const { pick: imgEdit, editor: imgEditor } = usePhotoEdit({ aspect: "free" });

  // Product image now goes through the shared advanced editor (crop/zoom/rotate).
  const pick = (file?: File) => imgEdit(file, (url) => { setPreview(url); setF((s) => ({ ...s, image: url })); });
  const save = async () => {
    if (!f.name.trim()) { toast("Product name is required.", "error"); return; }
    setSaving(true);
    const res = product ? await updateBusinessProduct(product.id, f) : await createBusinessProduct(businessId, f);
    setSaving(false);
    if (!res.ok) { toast(res.error ?? "Could not save", "error"); return; }
    toast(product ? "Product updated" : "Product added", "success");
    onDone();
  };

  return (
    <Card className="space-y-3 p-4">
      {imgEditor}
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-bold text-mist-100">{product ? "Edit product" : "Add product / service"}</h3>
        <button onClick={onCancel} className="text-mist-500 hover:text-mist-200"><X className="size-4" /></button>
      </div>
      <div className="flex gap-3">
        <button type="button" onClick={() => fileRef.current?.click()} className="grid size-20 shrink-0 place-items-center overflow-hidden rounded-xl border border-dashed border-line bg-ink-800 text-mist-400 hover:border-lotus-400/60" style={preview ? { backgroundImage: `url(${preview})`, backgroundSize: "cover", backgroundPosition: "center" } : undefined}>
          {!preview && <ImagePlus className="size-5" />}
        </button>
        <input ref={fileRef} type="file" accept="image/*" hidden onChange={(e) => pick(e.target.files?.[0])} />
        <div className="flex-1 space-y-2">
          <Input value={f.name} onChange={(e) => setF((s) => ({ ...s, name: e.target.value }))} placeholder="Product / service name" maxLength={80} className="!h-10" />
          <Input value={f.price ?? ""} onChange={(e) => setF((s) => ({ ...s, price: e.target.value }))} placeholder="Price (e.g. ₹1,299)" maxLength={40} className="!h-10" />
        </div>
      </div>
      <Textarea value={f.description ?? ""} onChange={(e) => setF((s) => ({ ...s, description: e.target.value }))} placeholder="Short description (optional)" maxLength={800} className="min-h-16" />
      <div className="flex justify-end gap-2">
        <Button size="sm" variant="secondary" onClick={onCancel}>Cancel</Button>
        <Button size="sm" onClick={save} disabled={saving}>{saving ? <Loader2 className="size-4 animate-spin" /> : null} {product ? "Save" : "Add"}</Button>
      </div>
    </Card>
  );
}
