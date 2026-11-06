"use client";

import { useEffect, useRef, useState } from "react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import { useConfig, saveConfig } from "@/lib/config";
import { withBase } from "@/lib/base-path";
import { cn } from "@/lib/cn";
import {
  newCustomPage, newBlock, slugify, uniqueSlug, customPageHref,
  type CustomPage, type CustomPageBlock,
} from "@/lib/custom-pages";
import {
  FileText, Plus, Trash2, Save, Loader2, Eye, EyeOff, ExternalLink, Upload,
  ArrowUp, ArrowDown, Copy, Type as TypeIcon, Image as ImageIcon, MousePointerClick, Minus, Heading, Lock, Info,
} from "lucide-react";

/**
 * ADMIN → CONTENT PAGES ("Add Content").
 *
 * Create real content — headings, paragraphs, pictures and buttons — and publish
 * it at /p/<slug>. Once a page exists it can be linked from any menu, submenu or
 * footer column, exactly like a built-in screen.
 *
 * Before this, the navigation editor could only add a LINK to something that
 * already existed; there was no way to create the content being linked to.
 */

const MAX_UPLOAD_MB = 8;

export default function ContentPagesAdminPage() {
  const { config, loading, reload } = useConfig();
  const { toast } = useToast();

  const [pages, setPages] = useState<CustomPage[]>([]);
  const [editingId, setEditingId] = useState("");
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const seeded = useRef(false);

  useEffect(() => {
    if (loading || seeded.current) return;
    seeded.current = true;
    const list = config.customPages ?? [];
    setPages(list);
    setEditingId(list[0]?.id ?? "");
  }, [loading, config.customPages]);

  const editing = pages.find((p) => p.id === editingId);

  const patch = (p: Partial<CustomPage>) =>
    setPages((l) => l.map((x) => (x.id === editingId ? { ...x, ...p } : x)));
  const patchBlock = (bid: string, b: Partial<CustomPageBlock>) =>
    setPages((l) => l.map((x) => (x.id === editingId ? { ...x, blocks: (x.blocks ?? []).map((y) => (y.id === bid ? { ...y, ...b } : y)) } : x)));
  const addBlock = (kind: CustomPageBlock["kind"]) =>
    setPages((l) => l.map((x) => (x.id === editingId ? { ...x, blocks: [...(x.blocks ?? []), newBlock(kind)] } : x)));
  const removeBlock = (bid: string) =>
    setPages((l) => l.map((x) => (x.id === editingId ? { ...x, blocks: (x.blocks ?? []).filter((y) => y.id !== bid) } : x)));
  const moveBlock = (bid: string, dir: -1 | 1) =>
    setPages((l) => l.map((x) => {
      if (x.id !== editingId) return x;
      const blocks = [...(x.blocks ?? [])];
      const at = blocks.findIndex((y) => y.id === bid);
      const to = at + dir;
      if (at < 0 || to < 0 || to >= blocks.length) return x;
      [blocks[at], blocks[to]] = [blocks[to], blocks[at]];
      return { ...x, blocks };
    }));

  const upload = (apply: (url: string) => void) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/png,image/jpeg,image/webp,image/gif,image/svg+xml";
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return;
      if (file.size > MAX_UPLOAD_MB * 1024 * 1024) {
        toast(`That file is ${(file.size / 1024 / 1024).toFixed(1)} MB — the limit is ${MAX_UPLOAD_MB} MB.`, "error");
        return;
      }
      setUploading(true);
      const fd = new FormData();
      fd.append("file", file);
      try {
        const res = await fetch(withBase("/api/admin/tokens"), { method: "POST", body: fd, credentials: "include" });
        const d = await res.json();
        if (res.ok && d.url) { apply(d.url as string); toast("Picture uploaded — press Save to publish.", "success"); }
        else toast(d.error ?? "Upload failed", "error");
      } catch { toast("Upload failed", "error"); }
      setUploading(false);
    };
    input.click();
  };

  const addPage = () => {
    const p = newCustomPage(pages);
    setPages((l) => [...l, p]);
    setEditingId(p.id);
    toast("Page created — write your content, then Save.", "success");
  };
  const duplicate = (p: CustomPage) => {
    const copy: CustomPage = { ...p, id: `pg_${Math.random().toString(36).slice(2, 9)}`, slug: uniqueSlug(`${p.slug}-copy`, pages), title: `${p.title} copy` };
    setPages((l) => [...l, copy]);
    setEditingId(copy.id);
  };
  const removePage = (p: CustomPage) => {
    if (!window.confirm(`Delete “${p.title}”? Any menu link pointing at it will stop working.`)) return;
    setPages((l) => l.filter((x) => x.id !== p.id));
    if (editingId === p.id) setEditingId("");
  };

  const save = async () => {
    setSaving(true);
    const res = await saveConfig({ customPages: pages });
    setSaving(false);
    if (res.ok) { await reload(); toast("Content pages saved — live now.", "success"); }
    else toast(res.error ?? "Could not save", "error");
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="flex items-center gap-2 font-display text-2xl font-extrabold text-mist-100">
            <FileText className="size-6 text-lotus-300" /> Content Pages
          </h1>
          <p className="mt-1 max-w-3xl text-sm text-mist-400">
            Write your own pages — headings, text, pictures and buttons — and publish them at
            <b className="text-mist-200"> /p/your-page</b>. Once a page exists you can link it from any
            menu, submenu or footer column in <b className="text-mist-200">Header, Footer &amp; Menus</b>.
          </p>
        </div>
        <div className="flex shrink-0 flex-wrap gap-2">
          <Button variant="secondary" onClick={addPage}><Plus className="size-4" /> Add content</Button>
          <Button onClick={save} disabled={saving}>
            {saving ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />} Save
          </Button>
        </div>
      </div>

      {pages.length === 0 ? (
        <Card className="px-4 py-14 text-center">
          <FileText className="mx-auto size-8 text-mist-600" />
          <p className="mt-3 font-semibold text-mist-200">No content pages yet</p>
          <p className="mx-auto mt-1 max-w-md text-sm text-mist-400">
            Tap <b className="text-mist-200">Add content</b> to write your first page. You can put anything on it —
            an announcement, rules, an offer, a help article — and link it from any menu.
          </p>
          <Button className="mt-5" onClick={addPage}><Plus className="size-4" /> Add content</Button>
        </Card>
      ) : (
        <div className="grid gap-4 lg:grid-cols-[300px_1fr]">
          {/* ===== Page list ===== */}
          <Card className="p-3">
            <h2 className="mb-2 px-1 text-sm font-bold text-mist-100">Your pages</h2>
            <div className="space-y-1.5">
              {pages.map((p) => (
                <div key={p.id} className={cn("rounded-xl border p-2", p.id === editingId ? "border-lotus-400/60 bg-lotus-500/10" : "border-line bg-ink-900", p.enabled === false && "opacity-55")}>
                  <button onClick={() => setEditingId(p.id)} className="block w-full text-left">
                    <span className="block truncate text-sm font-semibold text-mist-100">{p.title}</span>
                    <span className="block truncate font-mono text-[10px] text-mist-500">/p/{p.slug}</span>
                  </button>
                  <div className="mt-1.5 flex flex-wrap items-center gap-1">
                    <button onClick={() => setPages((l) => l.map((x) => (x.id === p.id ? { ...x, enabled: x.enabled === false } : x)))} className="rounded-lg px-2 py-1 text-[10px] font-semibold text-mist-400 hover:text-mist-100">
                      {p.enabled === false ? <><EyeOff className="mr-0.5 inline size-3" /> Hidden</> : <><Eye className="mr-0.5 inline size-3" /> Live</>}
                    </button>
                    <a href={customPageHref(p)} target="_blank" rel="noopener noreferrer" className="rounded-lg px-1.5 py-1 text-mist-400 hover:text-mist-100" title="Open the page"><ExternalLink className="size-3.5" /></a>
                    <button onClick={() => duplicate(p)} className="rounded-lg px-1.5 py-1 text-mist-400 hover:text-mist-100" title="Duplicate"><Copy className="size-3.5" /></button>
                    <button onClick={() => removePage(p)} className="ml-auto rounded-lg px-1.5 py-1 text-rose-300 hover:bg-rose-500/10" title="Delete"><Trash2 className="size-3.5" /></button>
                  </div>
                </div>
              ))}
            </div>
          </Card>

          {/* ===== Editor ===== */}
          {editing ? (
            <div className="space-y-4">
              <Card className="p-4">
                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="block">
                    <span className="mb-1 block text-xs font-semibold text-mist-300">Page title</span>
                    <input value={editing.title} onChange={(e) => patch({ title: e.target.value })} className={inp} />
                  </label>
                  <label className="block">
                    <span className="mb-1 block text-xs font-semibold text-mist-300">Address</span>
                    <span className="flex items-center gap-1.5">
                      <span className="shrink-0 font-mono text-xs text-mist-500">/p/</span>
                      <input
                        value={editing.slug}
                        onChange={(e) => patch({ slug: slugify(e.target.value) })}
                        onBlur={(e) => patch({ slug: uniqueSlug(e.target.value || editing.title, pages, editing.id) })}
                        className={cn(inp, "font-mono text-xs")}
                      />
                    </span>
                  </label>
                </div>
                <label className="mt-3 block">
                  <span className="mb-1 block text-xs font-semibold text-mist-300">One line under the title (optional)</span>
                  <input value={editing.subtitle ?? ""} onChange={(e) => patch({ subtitle: e.target.value })} className={inp} />
                </label>
                <label className="mt-3 block">
                  <span className="mb-1 block text-xs font-semibold text-mist-300">Search-engine description (optional)</span>
                  <input value={editing.seoDescription ?? ""} onChange={(e) => patch({ seoDescription: e.target.value })} placeholder="A short summary shown in Google results." className={inp} />
                </label>
                <div className="mt-3 flex flex-wrap gap-4">
                  <label className="flex cursor-pointer items-center gap-2 text-sm text-mist-300">
                    <input type="checkbox" checked={editing.enabled !== false} onChange={(e) => patch({ enabled: e.target.checked })} className="size-4 accent-[var(--color-lotus-500)]" />
                    Published (members can open it)
                  </label>
                  <label className="flex cursor-pointer items-center gap-2 text-sm text-mist-300">
                    <input type="checkbox" checked={editing.requireLogin === true} onChange={(e) => patch({ requireLogin: e.target.checked })} className="size-4 accent-[var(--color-lotus-500)]" />
                    <Lock className="size-3.5" /> Members only
                  </label>
                </div>
                <div className="mt-3 flex items-start gap-2 rounded-lg border border-sky-400/25 bg-sky-500/[0.06] px-3 py-2 text-[11px] text-mist-300">
                  <Info className="mt-0.5 size-3.5 shrink-0 text-sky-300" />
                  <p>To put this page in a menu, open <b className="text-mist-100">Header, Footer &amp; Menus</b> and add a link to <b className="font-mono text-mist-100">/p/{editing.slug}</b> — or use the <b className="text-mist-100">Add Content</b> button there, which creates the page and the link together.</p>
                </div>
              </Card>

              {/* Blocks */}
              <Card className="p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h2 className="text-sm font-bold text-mist-100">Page content</h2>
                  <div className="flex flex-wrap gap-1.5">
                    <AddBtn icon={Heading} label="Heading" onClick={() => addBlock("heading")} />
                    <AddBtn icon={TypeIcon} label="Text" onClick={() => addBlock("text")} />
                    <AddBtn icon={ImageIcon} label="Picture" onClick={() => addBlock("image")} />
                    <AddBtn icon={MousePointerClick} label="Button" onClick={() => addBlock("button")} />
                    <AddBtn icon={Minus} label="Divider" onClick={() => addBlock("divider")} />
                  </div>
                </div>

                <div className="mt-3 space-y-2">
                  {(editing.blocks ?? []).length === 0 && (
                    <p className="rounded-xl border border-line bg-ink-900 px-4 py-8 text-center text-sm text-mist-500">
                      Nothing on this page yet — add a heading, some text or a picture above.
                    </p>
                  )}
                  {(editing.blocks ?? []).map((b, i, arr) => (
                    <div key={b.id} className="rounded-xl border border-line bg-ink-900 p-3">
                      <div className="mb-2 flex items-center gap-2">
                        <span className="rounded-full bg-white/[0.06] px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-mist-400">
                          {b.kind === "text" ? "Text" : b.kind === "heading" ? "Heading" : b.kind === "image" ? "Picture" : b.kind === "button" ? "Button" : "Divider"}
                        </span>
                        <div className="ml-auto flex items-center gap-1">
                          <button onClick={() => moveBlock(b.id, -1)} disabled={i === 0} className="rounded px-1 py-1 text-mist-400 hover:text-mist-100 disabled:opacity-30"><ArrowUp className="size-3.5" /></button>
                          <button onClick={() => moveBlock(b.id, 1)} disabled={i === arr.length - 1} className="rounded px-1 py-1 text-mist-400 hover:text-mist-100 disabled:opacity-30"><ArrowDown className="size-3.5" /></button>
                          <button onClick={() => removeBlock(b.id)} className="rounded px-1 py-1 text-rose-300 hover:bg-rose-500/10"><Trash2 className="size-3.5" /></button>
                        </div>
                      </div>

                      {b.kind === "heading" && (
                        <div className="flex flex-wrap items-center gap-2">
                          <input value={b.text ?? ""} onChange={(e) => patchBlock(b.id, { text: e.target.value })} placeholder="Section heading" className={cn(inp, "flex-1")} />
                          <select value={b.level ?? 2} onChange={(e) => patchBlock(b.id, { level: Number(e.target.value) === 3 ? 3 : 2 })} className={cn(inp, "w-28")}>
                            <option value={2}>Large</option>
                            <option value={3}>Small</option>
                          </select>
                        </div>
                      )}

                      {b.kind === "text" && (
                        <textarea
                          value={b.text ?? ""}
                          onChange={(e) => patchBlock(b.id, { text: e.target.value })}
                          rows={5}
                          placeholder="Write your text here. Leave a blank line to start a new paragraph."
                          className="w-full rounded-lg border border-line bg-ink-800 p-3 text-sm leading-relaxed text-mist-100 outline-none focus:border-lotus-400/50"
                        />
                      )}

                      {b.kind === "image" && (
                        <div className="space-y-2">
                          <div className="flex flex-wrap items-center gap-3">
                            <span className="grid size-16 shrink-0 place-items-center overflow-hidden rounded-lg border border-line bg-ink-950">
                              {b.image
                                // eslint-disable-next-line @next/next/no-img-element
                                ? <img src={withBase(b.image)} alt="" className="size-full object-contain" />
                                : <span className="text-[10px] text-mist-600">None</span>}
                            </span>
                            <Button size="sm" variant="secondary" onClick={() => upload((url) => patchBlock(b.id, { image: url }))} disabled={uploading}>
                              <Upload className="size-4" /> {uploading ? "Uploading…" : "Upload picture"}
                            </Button>
                            {b.image && <button onClick={() => patchBlock(b.id, { image: "" })} className="text-xs text-mist-500 hover:text-rose-300">Remove</button>}
                          </div>
                          <input value={b.text ?? ""} onChange={(e) => patchBlock(b.id, { text: e.target.value })} placeholder="Caption (optional)" className={inp} />
                          <div className="flex flex-wrap items-center gap-3">
                            <label className="flex-1">
                              <span className="mb-1 flex items-center justify-between text-xs"><span className="font-semibold text-mist-300">Width</span><span className="font-mono text-mist-400">{b.widthPct ?? 100}%</span></span>
                              <input type="range" min={20} max={100} value={b.widthPct ?? 100} onChange={(e) => patchBlock(b.id, { widthPct: Number(e.target.value) })} className="w-full accent-[var(--color-lotus-500)]" />
                            </label>
                            <AlignPicker value={b.align ?? "center"} onChange={(v) => patchBlock(b.id, { align: v })} />
                          </div>
                        </div>
                      )}

                      {b.kind === "button" && (
                        <div className="space-y-2">
                          <div className="grid gap-2 sm:grid-cols-2">
                            <input value={b.text ?? ""} onChange={(e) => patchBlock(b.id, { text: e.target.value })} placeholder="Button text" className={inp} />
                            <input value={b.href ?? ""} onChange={(e) => patchBlock(b.id, { href: e.target.value })} placeholder="/rooms  or  https://…" className={cn(inp, "font-mono text-xs")} />
                          </div>
                          <AlignPicker value={b.align ?? "left"} onChange={(v) => patchBlock(b.id, { align: v })} />
                          <p className="text-[10px] text-mist-500">Internal paths (starting with /) and https, mailto or tel links only.</p>
                        </div>
                      )}

                      {b.kind === "divider" && <p className="text-xs text-mist-500">A horizontal line separating sections.</p>}
                    </div>
                  ))}
                </div>
              </Card>

              <Card className="flex flex-wrap items-center justify-between gap-3 p-4">
                <a href={customPageHref(editing)} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-sm font-semibold text-lotus-300 hover:text-lotus-200">
                  <ExternalLink className="size-4" /> Open /p/{editing.slug}
                </a>
                <Button onClick={save} disabled={saving}>
                  {saving ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />} Save
                </Button>
              </Card>
            </div>
          ) : (
            <Card className="grid place-items-center px-4 py-16 text-sm text-mist-500">Pick a page on the left, or add a new one.</Card>
          )}
        </div>
      )}
    </div>
  );
}

const inp = "h-10 w-full rounded-lg border border-line bg-ink-800 px-3 text-sm text-mist-100 outline-none focus:border-lotus-400/50";

function AddBtn({ icon: Icon, label, onClick }: { icon: typeof FileText; label: string; onClick: () => void }) {
  return (
    <button onClick={onClick} className="inline-flex items-center gap-1.5 rounded-lg border border-line bg-ink-800 px-2.5 py-1.5 text-xs font-semibold text-mist-300 transition hover:border-lotus-400/40 hover:text-mist-100">
      <Icon className="size-3.5" /> {label}
    </button>
  );
}

function AlignPicker({ value, onChange }: { value: "left" | "center"; onChange: (v: "left" | "center") => void }) {
  return (
    <span className="flex shrink-0 gap-1">
      {(["left", "center"] as const).map((a) => (
        <button key={a} onClick={() => onChange(a)} className={cn("rounded-lg border px-2.5 py-1.5 text-xs font-semibold capitalize transition", value === a ? "border-lotus-400/60 bg-lotus-500/15 text-lotus-100" : "border-line bg-ink-800 text-mist-300 hover:text-mist-100")}>
          {a}
        </button>
      ))}
    </span>
  );
}
