"use client";

// Renders admin-managed Custom Uploads (banners / popups / marquee) to users.
// It fetches ONLY the items the server already decided this viewer should see
// (audience + schedule filtered server-side), so it's safe to drop anywhere —
// it renders nothing when there's nothing to show.

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { withBase } from "@/lib/base-path";
import { cn } from "@/lib/cn";
import { X, Download, FileText, ExternalLink } from "lucide-react";

interface Item {
  id: string; title: string; category: string; type: "image" | "video" | "pdf" | "audio" | "file"; url: string;
  thumbnail?: string; subtitle?: string; description?: string;
  buttonText?: string; buttonUrl?: string; bgColor?: string; textColor?: string; dismissible?: boolean;
}

const isInternal = (u?: string) => !!u && u.startsWith("/") && !u.startsWith("//");

/**
 * A machine file name is NOT a caption. When an admin uploads a picture without
 * typing a title, the form falls back to the file's own name — which for a photo
 * straight off a phone or an AI tool is something like
 * "file_00000000acec81f483c015812c1c5b20". Showing that to members looks broken,
 * so we treat those as "no title" and simply display the artwork on its own.
 */
function looksLikeRawFileName(title?: string): boolean {
  const t = (title ?? "").trim();
  if (!t) return true;
  return (
    /^(file|img|image|photo|pxl|dsc|screenshot|whatsapp|untitled|download)[-_ ]?/i.test(t) ||
    /^[a-f0-9]{16,}$/i.test(t) ||            // a bare hash
    /[a-f0-9]{12,}/i.test(t.replace(/[-_ ]/g, "")) // a hash buried in the name
  );
}
/** The caption to show — blank when the "title" is really just a file name. */
const displayTitle = (item: { title?: string }) => (looksLikeRawFileName(item.title) ? "" : (item.title ?? "").trim());
// Defence-in-depth: only ever put an allow-listed scheme in an <a href> (the
// server already strips javascript:/data: etc., this guards against any slip).
const isSafeExternal = (u?: string) => !!u && /^(https?:|mailto:|tel:)/i.test(u);

function track(id: string, kind: "view" | "click") {
  try {
    fetch(withBase("/api/uploads"), {
      method: "POST", credentials: "include", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, kind }), keepalive: true,
    }).catch(() => {});
  } catch { /* best-effort */ }
}

/** A tappable wrapper — internal Link, external anchor, or plain div (no link). */
function Clickable({ item, className, children }: { item: Item; className?: string; children: React.ReactNode }) {
  const onClick = () => track(item.id, "click");
  if (item.buttonUrl && isInternal(item.buttonUrl)) return <Link href={withBase(item.buttonUrl)} onClick={onClick} className={className}>{children}</Link>;
  if (item.buttonUrl && isSafeExternal(item.buttonUrl)) return <a href={item.buttonUrl} target="_blank" rel="noopener noreferrer" onClick={onClick} className={className}>{children}</a>;
  return <div className={className}>{children}</div>;
}

function Media({ item, whole = false }: { item: Item; whole?: boolean }) {
  // `whole` = show the ENTIRE picture (banners are designed artwork — cropping
  // them cuts off the text). Fixed-ratio surfaces like the popup still fill.
  if (item.type === "image") {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={withBase(item.url)} alt={displayTitle(item) || "Banner"} className={cn("w-full", whole ? "h-auto object-contain" : "h-full object-cover")} loading="lazy" />;
  }
  if (item.type === "video") {
    return <video src={withBase(item.url)} poster={item.thumbnail ? withBase(item.thumbnail) : undefined} controls playsInline className={cn("w-full", whole ? "h-auto" : "h-full object-cover")} />;
  }
  // pdf / audio / file → an icon tile with a download/open action.
  return (
    <div className="flex h-full w-full items-center gap-3 bg-ink-800 p-4">
      <span className="grid size-12 shrink-0 place-items-center rounded-xl bg-lotus-500/15 text-lotus-300"><FileText className="size-6" /></span>
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-semibold text-mist-100">{displayTitle(item) || item.category}</div>
        <div className="text-xs text-mist-400">{item.category}</div>
      </div>
      <a href={withBase(item.url)} target="_blank" rel="noopener noreferrer" onClick={() => track(item.id, "click")} className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-lotus-500 px-3 py-2 text-xs font-bold text-white hover:bg-lotus-400">
        {item.type === "pdf" ? "Open" : <>Download <Download className="size-3.5" /></>}
      </a>
    </div>
  );
}

function Caption({ item }: { item: Item }) {
  const title = displayTitle(item);
  // Nothing worth saying → don't draw an empty strip under the artwork.
  if (!title && !item.subtitle && !item.buttonText) return null;
  return (
    <div className="p-3" style={{ color: item.textColor || undefined }}>
      {title && <div className="font-display text-sm font-bold text-mist-100" style={{ color: item.textColor || undefined }}>{title}</div>}
      {item.subtitle && <div className="text-xs text-mist-400" style={{ color: item.textColor || undefined }}>{item.subtitle}</div>}
      {item.buttonText && item.buttonUrl && (
        <span className="mt-2 inline-flex items-center gap-1.5 rounded-lg bg-lotus-500 px-3 py-1.5 text-xs font-bold text-white">
          {item.buttonText} {!isInternal(item.buttonUrl) && <ExternalLink className="size-3" />}
        </span>
      )}
    </div>
  );
}

export function CustomUploads({ placement, variant = "banner", className }: { placement: string; variant?: "banner" | "popup" | "marquee"; className?: string }) {
  const [items, setItems] = useState<Item[]>([]);
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());

  const load = useCallback(async () => {
    try {
      const r = await fetch(withBase(`/api/uploads?placement=${encodeURIComponent(placement)}`), { credentials: "include", cache: "no-store" });
      const d = await r.json();
      if (Array.isArray(d?.uploads)) setItems(d.uploads as Item[]);
    } catch { /* ignore */ }
  }, [placement]);
  useEffect(() => { void load(); }, [load]);

  // Track a view once per item shown.
  useEffect(() => { items.forEach((it) => track(it.id, "view")); }, [items]);

  const visible = items.filter((it) => !dismissed.has(it.id));
  if (visible.length === 0) return null;

  if (variant === "marquee") {
    // The marquee is pure TEXT — an item with no real title/subtitle has nothing
    // to scroll, so it's skipped rather than ticking a file name across the screen.
    const withText = visible.filter((it) => displayTitle(it) || it.subtitle);
    if (withText.length === 0) return null;
    return (
      <div className={cn("overflow-hidden rounded-lg border border-line bg-ink-850", className)}>
        <div className="flex animate-[marquee_22s_linear_infinite] whitespace-nowrap py-2">
          {withText.concat(withText).map((it, i) => (
            <Clickable key={`${it.id}-${i}`} item={it} className="mx-6 text-sm font-semibold text-lotus-200 hover:text-lotus-100">
              {displayTitle(it)}{it.subtitle ? `${displayTitle(it) ? " — " : ""}${it.subtitle}` : ""}
            </Clickable>
          ))}
        </div>
        <style>{`@keyframes marquee{from{transform:translateX(0)}to{transform:translateX(-50%)}}`}</style>
      </div>
    );
  }

  if (variant === "popup") {
    // Show only the highest-priority popup once per browser session.
    const it = visible[0];
    const key = `lotus.popup.${it.id}`;
    if (typeof window !== "undefined" && sessionStorage.getItem(key)) return null;
    const close = () => { try { sessionStorage.setItem(key, "1"); } catch { /* ignore */ } setDismissed((s) => new Set(s).add(it.id)); };
    return (
      <div className="fixed inset-0 z-[130] grid place-items-center bg-black/60 p-4" onClick={() => it.dismissible !== false && close()}>
        <div className="relative w-full max-w-sm overflow-hidden rounded-2xl border border-white/10 bg-ink-850" style={{ background: it.bgColor || undefined }} onClick={(e) => e.stopPropagation()}>
          {it.dismissible !== false && (
            <button onClick={close} aria-label="Close" className="absolute right-2 top-2 z-10 grid size-8 place-items-center rounded-full bg-black/40 text-white hover:bg-black/60"><X className="size-4" /></button>
          )}
          <Clickable item={it} className="block">
            <div className="aspect-[4/3] w-full overflow-hidden"><Media item={it} /></div>
          </Clickable>
          {(displayTitle(it) || it.description || it.buttonText) && (
            <div className="p-4" style={{ color: it.textColor || undefined }}>
              {displayTitle(it) && <div className="font-display text-lg font-bold text-mist-100" style={{ color: it.textColor || undefined }}>{displayTitle(it)}</div>}
              {it.description && <p className="mt-1 text-sm text-mist-300" style={{ color: it.textColor || undefined }}>{it.description}</p>}
              {it.buttonText && it.buttonUrl && (
                <Clickable item={it} className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-lotus-500 px-4 py-2 text-sm font-bold text-white hover:bg-lotus-400">
                  {it.buttonText} {!isInternal(it.buttonUrl) && <ExternalLink className="size-3.5" />}
                </Clickable>
              )}
            </div>
          )}
        </div>
      </div>
    );
  }

  // Default: stacked banner cards.
  return (
    <div className={cn("space-y-3", className)}>
      {visible.map((it) => (
        <div key={it.id} className="relative overflow-hidden rounded-2xl border border-white/10 bg-ink-850" style={{ background: it.bgColor || undefined }}>
          {it.dismissible !== false && (
            <button onClick={() => setDismissed((s) => new Set(s).add(it.id))} aria-label="Dismiss" className="absolute right-2 top-2 z-10 grid size-7 place-items-center rounded-full bg-black/40 text-white hover:bg-black/60"><X className="size-3.5" /></button>
          )}
          <Clickable item={it} className="block">
            {/* A banner is designed artwork — show ALL of it (never crop the text
                off the edge), just capped so a very tall image can't take over. */}
            {(it.type === "image" || it.type === "video")
              ? <div className="w-full overflow-hidden [&>img]:max-h-[28rem] [&>video]:max-h-[28rem]"><Media item={it} whole /></div>
              : <Media item={it} />}
          </Clickable>
          {(it.type === "image" || it.type === "video") && <Caption item={it} />}
        </div>
      ))}
    </div>
  );
}
