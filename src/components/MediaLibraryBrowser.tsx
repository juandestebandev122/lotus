"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { cn } from "@/lib/cn";
import type { MediaItem } from "@/lib/media-library";
import { withBase } from "@/lib/base-path";
import { probeUrlMeta, fmtDuration, fmtSize, type MediaMeta } from "@/lib/media-meta";
import { Search, Play, Star, List, LayoutGrid, Music, Video, Film, Image as ImageIcon, Clock, Folder } from "lucide-react";

// ============================================================
// MediaLibraryBrowser — the in-app media picker used inside a voice room.
// Fast to scan: compact List OR Grid view, full names, search, category "folders",
// sort (Name / Newest / Size / Recently played), Favourites and Recent sections, and
// one-tap playback. NOW also shows per-item DURATION, SIZE and a real VIDEO THUMBNAIL:
// new uploads carry this from the admin panel; older items are probed in the browser
// on the fly (duration + size cached per device; thumbnails generated per session).
// Preferences persist per-device in localStorage, so it remembers where the user was.
// ============================================================

type SortKey = "added" | "oldest" | "name" | "recent" | "size";
const LS = { fav: "lotus.media.fav", recent: "lotus.media.recent", view: "lotus.media.view", sort: "lotus.media.sort", cat: "lotus.media.cat", meta: "lotus.media.meta" };

function lsGet(k: string, d: string): string { try { return (typeof window !== "undefined" && localStorage.getItem(k)) || d; } catch { return d; } }
function lsSet(k: string, v: string) { try { localStorage.setItem(k, v); } catch { /* private mode / quota */ } }
function readJson<T>(k: string, d: T): T { try { const v = localStorage.getItem(k); return v ? (JSON.parse(v) as T) : d; } catch { return d; } }

function ytThumb(src: string): string | null {
  const m = src.match(/(?:embed\/|v=|youtu\.be\/)([\w-]{11})/);
  return m ? `https://img.youtube.com/vi/${m[1]}/mqdefault.jpg` : null;
}

function Thumb({ it, thumb, size = 40 }: { it: MediaItem; thumb?: string; size?: number }) {
  const Icon = it.kind === "youtube" ? Film : it.kind === "video" ? Video : it.kind === "image" ? ImageIcon : Music;
  const img = thumb || (it.kind === "image" ? withBase(it.src) : it.kind === "youtube" ? ytThumb(it.src) : null);
  if (img) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={img} alt="" loading="lazy" className="shrink-0 rounded-md object-cover" style={{ width: size, height: size }} />;
  }
  return <span className="grid shrink-0 place-items-center rounded-md bg-lotus-500/12 text-lotus-300" style={{ width: size, height: size }}><Icon className="size-1/2" /></span>;
}

export function MediaLibraryBrowser({
  items, tab, currentSrc, onPlay,
}: {
  items: MediaItem[];
  tab: "audio" | "video" | "image";
  currentSrc?: string;
  onPlay: (it: MediaItem) => void;
}) {
  const [query, setQuery] = useState("");
  const [view, setView] = useState<"list" | "grid">(() => (lsGet(LS.view, "list") === "grid" ? "grid" : "list"));
  const [sort, setSort] = useState<SortKey>(() => { const s = lsGet(LS.sort, "added"); return s === "name" || s === "recent" || s === "size" || s === "oldest" ? s : "added"; });
  const [cat, setCat] = useState<string>(() => lsGet(LS.cat, "all"));
  const [favOnly, setFavOnly] = useState(false);
  const [favs, setFavs] = useState<string[]>(() => readJson<string[]>(LS.fav, []));
  const [recent, setRecent] = useState<string[]>(() => readJson<string[]>(LS.recent, []));
  // Lazily-probed metadata for older items (keyed by item id). Duration/size persist
  // per device; thumbnails stay in memory for the session (too big for localStorage).
  const [probed, setProbed] = useState<Record<string, MediaMeta>>(() => readJson<Record<string, MediaMeta>>(LS.meta, {}));
  const probingRef = useRef<Set<string>>(new Set());

  useEffect(() => lsSet(LS.view, view), [view]);
  useEffect(() => lsSet(LS.sort, sort), [sort]);
  useEffect(() => lsSet(LS.cat, cat), [cat]);

  const metaOf = (it: MediaItem): MediaMeta => ({
    durationSec: it.durationSec ?? probed[it.id]?.durationSec,
    sizeBytes: it.sizeBytes ?? probed[it.id]?.sizeBytes,
    thumb: it.thumb ?? probed[it.id]?.thumb,
  });

  const isFav = (id: string) => favs.includes(id);
  const toggleFav = (id: string) => setFavs((prev) => { const n = prev.includes(id) ? prev.filter((x) => x !== id) : [id, ...prev]; lsSet(LS.fav, JSON.stringify(n)); return n; });
  const play = (it: MediaItem) => {
    setRecent((prev) => { const n = [it.id, ...prev.filter((x) => x !== it.id)].slice(0, 40); lsSet(LS.recent, JSON.stringify(n)); return n; });
    onPlay(it);
  };

  // Categories present for this tab become "folder" chips.
  const categories = useMemo(() => {
    const s = new Set<string>();
    for (const it of items) if (it.category) s.add(it.category);
    return ["all", ...[...s].sort((a, b) => a.localeCompare(b))];
  }, [items]);
  useEffect(() => { if (cat !== "all" && !categories.includes(cat)) setCat("all"); }, [categories, cat]);

  const q = query.trim().toLowerCase();
  const filtered = useMemo(() => {
    let arr = items.filter((it) => {
      if (favOnly && !favs.includes(it.id)) return false;
      if (cat !== "all" && (it.category ?? "") !== cat) return false;
      if (q && !`${it.name} ${it.fileName ?? ""} ${it.category ?? ""}`.toLowerCase().includes(q)) return false;
      return true;
    });
    if (sort === "name") arr = [...arr].sort((a, b) => a.name.localeCompare(b.name));
    else if (sort === "added") arr = [...arr].sort((a, b) => (a.addedAt < b.addedAt ? 1 : a.addedAt > b.addedAt ? -1 : 0));
    else if (sort === "oldest") arr = [...arr].sort((a, b) => (a.addedAt > b.addedAt ? 1 : a.addedAt < b.addedAt ? -1 : 0));
    else if (sort === "size") arr = [...arr].sort((a, b) => ((metaOf(b).sizeBytes ?? -1) - (metaOf(a).sizeBytes ?? -1)));
    else if (sort === "recent") { const ri = (id: string) => { const i = recent.indexOf(id); return i < 0 ? 99999 : i; }; arr = [...arr].sort((a, b) => ri(a.id) - ri(b.id)); }
    return arr;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items, favOnly, favs, cat, q, sort, recent, probed]);

  // Lazily probe duration + (video) thumbnail for the items on screen that don't have
  // them yet. Guarded so each item is probed at most once; capped so a huge library
  // never hammers the network. Runs a couple at a time.
  useEffect(() => {
    let cancelled = false;
    const need = filtered.filter((it) =>
      (it.kind === "audio" || it.kind === "video") &&
      !probingRef.current.has(it.id) &&
      (!(it.durationSec ?? probed[it.id]?.durationSec) || (it.kind === "video" && !(it.thumb ?? probed[it.id]?.thumb))),
    ).slice(0, 24);
    if (need.length === 0) return;
    need.forEach((it) => probingRef.current.add(it.id));
    (async () => {
      for (const it of need) {
        if (cancelled) return;
        const m = await probeUrlMeta(withBase(it.src), it.kind === "video" ? "video" : "audio");
        if (cancelled) return;
        if (m.durationSec || m.sizeBytes || m.thumb) {
          setProbed((prev) => {
            const next = { ...prev, [it.id]: { ...prev[it.id], ...m } };
            // Persist only the tiny fields (duration/size) — thumbnails are too big.
            try { const lean: Record<string, MediaMeta> = {}; for (const [k, v] of Object.entries(next)) lean[k] = { durationSec: v.durationSec, sizeBytes: v.sizeBytes }; lsSet(LS.meta, JSON.stringify(lean)); } catch { /* quota */ }
            return next;
          });
        }
      }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filtered]);

  // Favourites + Recently-played strips (only when not actively filtering, so they
  // don't get in the way of a search/folder view).
  const showStrips = !q && !favOnly && cat === "all";
  const favItems = useMemo(
    () => (showStrips ? (favs.map((id) => items.find((it) => it.id === id)).filter(Boolean).slice(0, 12) as MediaItem[]) : []),
    [favs, items, showStrips],
  );
  const recentItems = useMemo(
    () => (showStrips ? (recent.map((id) => items.find((it) => it.id === id)).filter(Boolean).slice(0, 10) as MediaItem[]) : []),
    [recent, items, showStrips],
  );

  const noun = tab === "image" ? "images" : tab === "video" ? "videos" : "audio";
  const metaLine = (it: MediaItem) => {
    const m = metaOf(it);
    return [fmtDuration(m.durationSec), fmtSize(m.sizeBytes), it.category].filter(Boolean).join(" · ");
  };

  const PlayBtn = ({ it }: { it: MediaItem }) => {
    const playing = currentSrc === it.src;
    return (
      <button onClick={() => play(it)} disabled={playing}
        className="inline-flex shrink-0 items-center gap-1 rounded-lg bg-lotus-600 px-2.5 py-1 text-[11px] font-semibold text-white hover:bg-lotus-500 disabled:opacity-50">
        {playing ? (tab === "image" ? "Showing" : "Playing") : <><Play className="size-3" /> {tab === "image" ? "Show" : "Play"}</>}
      </button>
    );
  };
  const FavBtn = ({ id }: { id: string }) => (
    <button onClick={() => toggleFav(id)} title={isFav(id) ? "Remove favourite" : "Add to favourites"}
      className={cn("grid size-6 shrink-0 place-items-center rounded-md transition", isFav(id) ? "text-gold-300" : "text-mist-500 hover:text-mist-200")}>
      <Star className={cn("size-3.5", isFav(id) && "fill-current")} />
    </button>
  );

  return (
    <div>
      {/* Toolbar: search + view toggle + sort + favourites filter */}
      <div className="mb-2 flex items-center gap-1.5">
        <div className="flex min-w-0 flex-1 items-center gap-1.5 rounded-lg border border-line bg-ink-800 px-2.5">
          <Search className="size-3.5 shrink-0 text-mist-500" />
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder={`Search ${noun}, folders…`}
            className="h-8 w-full bg-transparent text-xs text-mist-100 outline-none placeholder:text-mist-500" />
        </div>
        <select value={sort} onChange={(e) => setSort(e.target.value as SortKey)} title="Sort"
          className="h-8 shrink-0 rounded-lg border border-line bg-ink-800 px-2 text-[11px] text-mist-200 outline-none focus:border-lotus-400">
          <option value="added">Newest</option>
          <option value="oldest">Oldest</option>
          <option value="name">Name A–Z</option>
          <option value="size">Size</option>
          <option value="recent">Recently played</option>
        </select>
        <button onClick={() => setView((v) => (v === "list" ? "grid" : "list"))} title={view === "list" ? "Grid view" : "List view"}
          className="grid size-8 shrink-0 place-items-center rounded-lg border border-line bg-ink-800 text-mist-300 hover:text-mist-100">
          {view === "list" ? <LayoutGrid className="size-4" /> : <List className="size-4" />}
        </button>
        <button onClick={() => setFavOnly((f) => !f)} title="Favourites only"
          className={cn("grid size-8 shrink-0 place-items-center rounded-lg border transition", favOnly ? "border-gold-400/50 bg-gold-500/15 text-gold-300" : "border-line bg-ink-800 text-mist-400 hover:text-mist-200")}>
          <Star className={cn("size-4", favOnly && "fill-current")} />
        </button>
      </div>

      {/* Folder (category) chips */}
      {categories.length > 1 && (
        <div className="mb-2 flex gap-1.5 overflow-x-auto pb-1">
          {categories.map((c) => (
            <button key={c} onClick={() => setCat(c)}
              className={cn("inline-flex shrink-0 items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold transition",
                cat === c ? "bg-lotus-600 text-white" : "bg-ink-800 text-mist-300 hover:text-mist-100")}>
              {c !== "all" && <Folder className="size-3" />} {c === "all" ? "All" : c}
            </button>
          ))}
        </div>
      )}

      {/* Favourites strip */}
      {favItems.length > 0 && (
        <div className="mb-2">
          <div className="mb-1 flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide text-gold-300"><Star className="size-3 fill-current" /> Favourites</div>
          <div className="flex gap-1.5 overflow-x-auto pb-1">
            {favItems.map((it) => (
              <button key={it.id} onClick={() => play(it)} title={it.name}
                className={cn("flex w-24 shrink-0 flex-col items-center gap-1 rounded-lg border p-1.5 text-center", currentSrc === it.src ? "border-lotus-400 bg-lotus-500/10" : "border-line bg-ink-800/60 hover:border-white/20")}>
                <Thumb it={it} thumb={metaOf(it).thumb} size={40} />
                <span className="line-clamp-2 text-[10px] leading-tight text-mist-200">{it.name}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Recently played strip */}
      {recentItems.length > 0 && (
        <div className="mb-2">
          <div className="mb-1 flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide text-mist-500"><Clock className="size-3" /> Recently played</div>
          <div className="flex gap-1.5 overflow-x-auto pb-1">
            {recentItems.map((it) => (
              <button key={it.id} onClick={() => play(it)} title={it.name}
                className={cn("flex w-24 shrink-0 flex-col items-center gap-1 rounded-lg border p-1.5 text-center", currentSrc === it.src ? "border-lotus-400 bg-lotus-500/10" : "border-line bg-ink-800/60 hover:border-white/20")}>
                <Thumb it={it} thumb={metaOf(it).thumb} size={40} />
                <span className="line-clamp-2 text-[10px] leading-tight text-mist-200">{it.name}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* The library itself */}
      {filtered.length === 0 ? (
        <p className="rounded-lg bg-white/[0.03] px-3 py-4 text-center text-xs text-mist-500">
          {favOnly ? "No favourites yet — tap the ☆ on a track to save it." : q ? `No ${noun} match “${query}”.` : `No ${noun} in this folder.`}
        </p>
      ) : view === "grid" ? (
        <div className="grid max-h-[min(62vh,34rem)] grid-cols-3 gap-1.5 overflow-y-auto overscroll-contain pr-1 sm:grid-cols-4">
          {filtered.map((it) => {
            const m = metaOf(it);
            return (
              <div key={it.id} className={cn("relative flex flex-col items-center gap-1 rounded-lg border p-1.5 text-center", currentSrc === it.src ? "border-lotus-400 bg-lotus-500/10" : "border-line bg-ink-800/60")}>
                <div className="absolute right-0.5 top-0.5"><FavBtn id={it.id} /></div>
                <div className="relative">
                  <Thumb it={it} thumb={m.thumb} size={52} />
                  {m.durationSec ? <span className="absolute bottom-0 right-0 rounded bg-black/70 px-1 text-[8px] font-semibold text-white">{fmtDuration(m.durationSec)}</span> : null}
                </div>
                <span className="line-clamp-2 w-full text-[10px] leading-tight text-mist-100" title={it.name}>{it.name}</span>
                <PlayBtn it={it} />
              </div>
            );
          })}
        </div>
      ) : (
        <div className="max-h-[min(62vh,34rem)] space-y-1 overflow-y-auto overscroll-contain pr-1">
          {filtered.map((it) => {
            const line = metaLine(it);
            return (
              <div key={it.id} className={cn("flex items-center gap-2 rounded-lg border px-2 py-1", currentSrc === it.src ? "border-lotus-400 bg-lotus-500/10" : "border-line bg-ink-800/60")}>
                <div className="relative shrink-0">
                  <Thumb it={it} thumb={metaOf(it).thumb} size={34} />
                  {it.kind === "video" && <span className="pointer-events-none absolute inset-0 grid place-items-center"><Play className="size-3 text-white/90 drop-shadow" /></span>}
                </div>
                <div className="min-w-0 flex-1">
                  {/* Full name (wraps to 2 lines) so long song/video names aren't cut off. */}
                  <div className="line-clamp-2 text-xs font-semibold leading-tight text-mist-100" title={it.name}>{it.name}</div>
                  {line && <div className="truncate text-[10px] text-mist-500">{line}</div>}
                </div>
                <FavBtn id={it.id} />
                <PlayBtn it={it} />
              </div>
            );
          })}
        </div>
      )}
      <p className="mt-1.5 text-center text-[10px] text-mist-500">{filtered.length} {noun}{cat !== "all" ? ` in “${cat}”` : ""}{favOnly ? " · favourites" : ""}</p>
    </div>
  );
}
