"use client";

// The global sticker library (curated by admins in /admin/stickers).
//   • Every chat-allowed member can view and send.
//   • Users cannot add or remove — the library is managed centrally by admins.
//   • Stickers are grouped by category, with a "Recent" row kept per-device.

import { useCallback, useEffect, useState, type ReactNode } from "react";
import { withBase } from "@/lib/base-path";
import { cn } from "@/lib/cn";
import { useToast } from "@/components/ui/Toast";
import { fetchGlobalStickers, sendSticker, type GlobalSticker } from "@/lib/stickers";
import { X, Sticker as StickerIcon, Clock } from "lucide-react";

const RECENT_KEY = "lotus.stickers.recent";
type RecentSticker = { id: string; url: string; name: string };

function readRecent(): RecentSticker[] {
  try {
    const raw = localStorage.getItem(RECENT_KEY);
    const arr = raw ? JSON.parse(raw) : [];
    return Array.isArray(arr) ? arr.filter((r) => r && typeof r.url === "string") : [];
  } catch {
    return [];
  }
}

export function StickerPanel({ roomId, onClose, onSent }: {
  roomId: string;
  canManage?: boolean; // accepted for backwards-compat; the library is global (admins manage it)
  onClose: () => void;
  onSent?: () => void;
}) {
  const { toast } = useToast();
  const [groups, setGroups] = useState<{ category: string; stickers: GlobalSticker[] }[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [recent, setRecent] = useState<RecentSticker[]>([]);
  const [activeCat, setActiveCat] = useState("all"); // "all" | "recent" | a category name

  const load = useCallback(async () => {
    setGroups(await fetchGlobalStickers());
    setLoading(false);
  }, []);
  useEffect(() => { void load(); setRecent(readRecent()); }, [load]);

  // Only show Recent entries that still exist and are enabled (drop deleted/disabled).
  const liveUrls = new Set(groups.flatMap((g) => g.stickers.map((s) => s.url)));
  const recentLive = recent.filter((r) => liveUrls.has(r.url));

  const pushRecent = (s: RecentSticker) => {
    const next = [s, ...readRecent().filter((r) => r.id !== s.id)].slice(0, 16);
    try { localStorage.setItem(RECENT_KEY, JSON.stringify(next)); } catch { /* private mode */ }
    setRecent(next);
  };

  const onSend = async (s: { id: string; url: string; name: string }) => {
    if (busy) return;
    setBusy(true);
    const okSent = await sendSticker(roomId, s.url);
    setBusy(false);
    if (okSent) { pushRecent({ id: s.id, url: s.url, name: s.name }); onSent?.(); onClose(); }
    else toast("Could not send the sticker", "error");
  };

  const isEmpty = !loading && groups.length === 0;

  return (
    <div className="fixed inset-0 z-[130] flex items-end justify-center bg-black/60 sm:items-center" onClick={onClose}>
      <div
        className="max-h-[80vh] w-full max-w-md overflow-hidden rounded-t-2xl border border-white/10 bg-ink-850 sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
          <h2 className="flex items-center gap-2 font-display text-base font-bold text-mist-100">
            <StickerIcon className="size-5 text-lotus-300" /> Stickers
          </h2>
          <button onClick={onClose} className="grid size-8 place-items-center rounded-lg text-mist-400 transition hover:bg-white/[0.06] hover:text-mist-100">
            <X className="size-4" />
          </button>
        </div>

        {/* Category tabs (client request): pick a category to see only its stickers. */}
        {!loading && !isEmpty && (
          <div className="flex gap-1.5 overflow-x-auto border-b border-white/10 px-3 py-2">
            {recentLive.length > 0 && <CatTab active={activeCat === "recent"} onClick={() => setActiveCat("recent")}><Clock className="size-3" /> Recent</CatTab>}
            <CatTab active={activeCat === "all"} onClick={() => setActiveCat("all")}>All</CatTab>
            {groups.map((g) => <CatTab key={g.category} active={activeCat === g.category} onClick={() => setActiveCat(g.category)}>{g.category}</CatTab>)}
          </div>
        )}

        <div className="max-h-[calc(80vh-6.5rem)] overflow-y-auto p-3">
          {loading ? (
            <p className="py-10 text-center text-sm text-mist-500">Loading stickers…</p>
          ) : isEmpty ? (
            <div className="py-10 text-center">
              <StickerIcon className="mx-auto size-10 text-mist-600" />
              <p className="mt-2 text-sm text-mist-400">No stickers available yet.</p>
              <p className="mt-1 text-xs text-mist-500">Stickers will appear here once an admin adds them.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {activeCat === "recent" ? (
                <div className="grid grid-cols-4 gap-2 sm:grid-cols-5">
                  {recentLive.map((s) => (
                    <StickerButton key={`recent-${s.id}`} url={s.url} name={s.name} disabled={busy} onClick={() => onSend(s)} />
                  ))}
                </div>
              ) : activeCat === "all" ? (
                groups.map((g) => (
                  <section key={g.category}>
                    <h3 className="mb-1.5 px-1 text-xs font-semibold uppercase tracking-wide text-mist-500">{g.category}</h3>
                    <div className="grid grid-cols-4 gap-2 sm:grid-cols-5">
                      {g.stickers.map((s) => (
                        <StickerButton key={s.id} url={s.url} name={s.name} disabled={busy} onClick={() => onSend({ id: s.id, url: s.url, name: s.name })} />
                      ))}
                    </div>
                  </section>
                ))
              ) : (
                <div className="grid grid-cols-4 gap-2 sm:grid-cols-5">
                  {(groups.find((g) => g.category === activeCat)?.stickers ?? []).map((s) => (
                    <StickerButton key={s.id} url={s.url} name={s.name} disabled={busy} onClick={() => onSend({ id: s.id, url: s.url, name: s.name })} />
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function CatTab({ active, onClick, children }: { active: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={cn("inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-full px-3 py-1 text-xs font-semibold capitalize transition", active ? "bg-lotus-500/90 text-white" : "bg-white/[0.06] text-mist-300 hover:bg-white/[0.1] hover:text-mist-100")}
    >
      {children}
    </button>
  );
}

function StickerButton({ url, name, disabled, onClick }: { url: string; name: string; disabled: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={name || "Send sticker"}
      className="aspect-square w-full rounded-xl border border-line bg-ink-900 p-1.5 transition hover:border-lotus-400/60 hover:bg-white/[0.05] active:scale-95 disabled:opacity-50"
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={withBase(url)} alt={name || "Sticker"} loading="lazy" className="size-full object-contain" />
    </button>
  );
}
