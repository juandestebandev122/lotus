"use client";

import { useEffect, useMemo, useState } from "react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import { cn } from "@/lib/cn";
import {
  ROOM_FEATURE_SECTIONS, ROOM_FEATURE_ITEMS, type RoomFeatures, type RoomFeatureItem,
} from "@/lib/room-features";
import { RoomPreviewModal } from "@/components/RoomPreviewModal";
import { PhotoEditor } from "@/components/PhotoEditor";
import {
  Search, Check, RotateCcw, Loader2, DoorOpen, Upload, Eye,
  Mic, Settings2, Music, MessageSquare, Gamepad2, Gift, UserCheck, Shield, Palette, FileText, type LucideIcon,
} from "lucide-react";

const ICONS: Record<string, LucideIcon> = {
  Mic, Settings2, Music, MessageSquare, Gamepad2, Gift, UserCheck, Shield, Palette, FileText,
};

// Text fields that hold an image URL → get an inline "Upload" button so the admin
// can upload a file instead of pasting a URL (the uploaded file's URL auto-fills).
const IMAGE_URL_KEYS = new Set(["backgroundImage", "roomLogo", "roomBanner"]);

type RoomLite = { id: string; name: string; category: string; type: string; hostName: string };

export default function AdminRoomConfigPage() {
  const { toast } = useToast();
  const [rooms, setRooms] = useState<RoomLite[]>([]);
  const [query, setQuery] = useState("");
  const [picked, setPicked] = useState<RoomLite | null>(null);
  const [features, setFeatures] = useState<RoomFeatures>({});
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [uploadingKey, setUploadingKey] = useState<string | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  // The image the admin is currently cropping/rotating before it uploads.
  const [editTarget, setEditTarget] = useState<{ key: string; file: File } | null>(null);

  // Upload an image file for an image-URL field → auto-fills that field's URL.
  const uploadImageFor = async (key: string, file: File | undefined) => {
    if (!file) return;
    setUploadingKey(key);
    try {
      const fd = new FormData(); fd.append("file", file);
      const res = await fetch("/api/admin/upload-media", { method: "POST", credentials: "include", body: fd });
      const d = await res.json().catch(() => ({}));
      if (res.ok && d.url) { setVal(key, d.url as string); toast("Image uploaded ✓", "success"); }
      else toast(d.error ?? "Upload failed", "error");
    } catch { toast("Upload failed — please try again", "error"); }
    setUploadingKey(null);
  };

  useEffect(() => {
    fetch("/api/admin/rooms")
      .then((r) => r.json())
      .then((d) => setRooms((d.rooms ?? []).map((r: RoomLite) => ({ id: r.id, name: r.name, category: r.category, type: r.type, hostName: r.hostName }))))
      .catch(() => {});
  }, []);

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return rooms.slice(0, 8);
    return rooms.filter((r) => `${r.name} ${r.category} ${r.hostName} ${r.id}`.toLowerCase().includes(q)).slice(0, 8);
  }, [query, rooms]);

  const selectRoom = async (r: RoomLite) => {
    setPicked(r); setQuery(""); setLoading(true); setDirty(false);
    try {
      const res = await fetch(`/api/admin/rooms/${r.id}/features`);
      const d = await res.json();
      setFeatures((d.features ?? {}) as RoomFeatures);
    } catch { setFeatures({}); toast("Could not load this room's settings", "error"); }
    setLoading(false);
  };

  // Effective value of an item: room override if present, else the catalogue default.
  const valOf = (it: RoomFeatureItem): boolean | number | string => {
    const v = features[it.key];
    if (it.kind === "toggle") return typeof v === "boolean" ? v : (it.def as boolean);
    if (it.kind === "number") return typeof v === "number" ? v : (it.def as number);
    return typeof v === "string" ? v : (it.def as string);
  };
  const isOverridden = (key: string) => features[key] !== undefined;

  const setVal = (key: string, value: boolean | number | string) => {
    setFeatures((f) => ({ ...f, [key]: value }));
    setDirty(true);
  };
  const clearVal = (key: string) => {
    setFeatures((f) => { const n = { ...f }; delete n[key]; return n; });
    setDirty(true);
  };

  const save = async () => {
    if (!picked) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/admin/rooms/${picked.id}/features`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ features }),
      });
      const d = await res.json();
      if (res.ok && d.ok) { setFeatures((d.features ?? {}) as RoomFeatures); setDirty(false); toast(`Saved — “${picked.name}” now uses its own settings`, "success"); }
      else toast(d.error ?? "Could not save", "error");
    } catch { toast("Could not save", "error"); }
    setSaving(false);
  };

  const resetAll = () => { setFeatures({}); setDirty(true); toast("All controls reset to the app defaults — press Save to apply", "info"); };

  const overrideCount = Object.keys(features).length;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-extrabold text-mist-100">Room settings (per-room control)</h1>
        <p className="text-sm text-mist-400">
          Give every room its <b className="text-mist-200">own</b> configuration. Pick a room, switch any feature on or off
          just for that room, and press Save. Editing one room <b className="text-mist-200">never</b> affects any other room —
          anything you don&apos;t change here keeps using the normal app setting.
        </p>
      </div>

      {/* Room picker */}
      <Card className="p-5">
        <label className="block text-xs font-semibold text-mist-300">Choose a room</label>
        <div className="relative mt-1">
          <div className="flex items-center gap-2 rounded-lg border border-line bg-ink-900 px-3">
            <Search className="size-4 text-mist-500" />
            <input
              value={picked ? `${picked.name} · ${picked.category}` : query}
              onChange={(e) => { setPicked(null); setFeatures({}); setQuery(e.target.value); }}
              placeholder="Search by room name / category / host / ID"
              className="w-full bg-transparent py-2.5 text-sm text-mist-100 outline-none"
            />
            {picked && <button onClick={() => { setPicked(null); setQuery(""); setFeatures({}); }} className="text-xs text-mist-400 hover:text-mist-100">change</button>}
          </div>
          {!picked && matches.length > 0 && (
            <div className="absolute z-20 mt-1 max-h-72 w-full overflow-auto rounded-lg border border-white/10 bg-ink-850 shadow-xl">
              {matches.map((r) => (
                <button key={r.id} onClick={() => selectRoom(r)} className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm hover:bg-white/[0.05]">
                  <span className="min-w-0 truncate text-mist-100"><DoorOpen className="mr-1.5 inline size-3.5 text-lotus-300" />{r.name}</span>
                  <span className="shrink-0 text-[11px] text-mist-500">{r.category} · {r.type}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      </Card>

      {picked && (
        <>
          {/* Sticky action bar */}
          <div className="sticky top-0 z-10 -mx-1 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-line bg-ink-900/95 px-4 py-3 backdrop-blur">
            <div className="min-w-0">
              <div className="truncate text-sm font-semibold text-mist-100">{picked.name}</div>
              <div className="text-[11px] text-mist-500">
                {overrideCount === 0 ? "Using all app defaults" : `${overrideCount} custom setting${overrideCount === 1 ? "" : "s"} for this room`}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button size="sm" variant="secondary" onClick={() => setPreviewOpen(true)}><Eye className="size-4" /> Preview room</Button>
              <Button size="sm" variant="ghost" onClick={resetAll} disabled={saving || overrideCount === 0}><RotateCcw className="size-4" /> Reset all</Button>
              <Button size="sm" onClick={save} disabled={saving || !dirty}>
                {saving ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />} {saving ? "Saving…" : "Save room settings"}
              </Button>
            </div>
          </div>

          {loading ? (
            <div className="grid place-items-center py-16 text-mist-500"><Loader2 className="size-6 animate-spin" /></div>
          ) : (
            <div className="grid gap-5 lg:grid-cols-2">
              {ROOM_FEATURE_SECTIONS.map((section) => {
                const Icon = ICONS[section.icon] ?? Settings2;
                return (
                  <Card key={section.id} className="p-5">
                    <h2 className="flex items-center gap-2 font-semibold text-mist-100"><Icon className="size-4 text-lotus-300" /> {section.title}</h2>
                    <div className="mt-3 divide-y divide-white/5">
                      {section.items.map((it) => {
                        const overridden = isOverridden(it.key);
                        return (
                          <div key={it.key} className="flex items-center gap-3 py-2.5">
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-1.5 text-sm text-mist-100">
                                {it.label}
                                {overridden && <span className="rounded-full bg-lotus-500/15 px-1.5 py-0.5 text-[9px] font-bold uppercase text-lotus-300">custom</span>}
                              </div>
                              {it.hint && <div className="text-[11px] text-mist-500">{it.hint}</div>}
                            </div>
                            {it.kind === "toggle" && (
                              <button
                                onClick={() => setVal(it.key, !(valOf(it) as boolean))}
                                role="switch" aria-checked={valOf(it) as boolean}
                                className={cn("relative h-6 w-11 shrink-0 rounded-full transition", (valOf(it) as boolean) ? "bg-emerald-500" : "bg-mist-600")}
                              >
                                <span className={cn("absolute top-0.5 size-5 rounded-full bg-white shadow transition-all", (valOf(it) as boolean) ? "left-[22px]" : "left-0.5")} />
                              </button>
                            )}
                            {it.kind === "number" && (
                              <input
                                type="number" min={0} value={(valOf(it) as number) || ""}
                                onChange={(e) => setVal(it.key, Math.max(0, Math.floor(Number(e.target.value) || 0)))}
                                placeholder={it.zeroMeans ?? "0"}
                                className="w-20 shrink-0 rounded-lg border border-line bg-ink-900 px-2 py-1.5 text-right text-sm text-mist-100 outline-none focus:border-lotus-400"
                              />
                            )}
                            {it.kind === "text" && (
                              <div className="flex shrink-0 items-center gap-1">
                                <input
                                  type="text" value={valOf(it) as string}
                                  onChange={(e) => setVal(it.key, e.target.value)}
                                  placeholder={it.hint ?? ""}
                                  className="w-40 rounded-lg border border-line bg-ink-900 px-2 py-1.5 text-sm text-mist-100 outline-none focus:border-lotus-400"
                                />
                                {IMAGE_URL_KEYS.has(it.key) && (
                                  <label title="Upload an image" className="grid size-8 cursor-pointer place-items-center rounded-lg border border-line bg-ink-800 text-mist-300 transition hover:border-lotus-400 hover:text-lotus-300">
                                    {uploadingKey === it.key ? <Loader2 className="size-3.5 animate-spin" /> : <Upload className="size-3.5" />}
                                    <input type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) setEditTarget({ key: it.key, file: f }); e.currentTarget.value = ""; }} />
                                  </label>
                                )}
                              </div>
                            )}
                            {overridden && (
                              <button onClick={() => clearVal(it.key)} title="Reset this one to the app default" className="shrink-0 text-mist-500 hover:text-mist-200"><RotateCcw className="size-3.5" /></button>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </Card>
                );
              })}
            </div>
          )}
          <p className="pb-4 text-center text-[11px] text-mist-600">
            {Object.keys(ROOM_FEATURE_ITEMS).length} controls · changes apply to this room only, live, with no app update.
          </p>
        </>
      )}

      {previewOpen && picked && (
        <RoomPreviewModal features={features} roomName={picked.name} onClose={() => setPreviewOpen(false)} />
      )}

      {/* Crop / rotate / zoom the picked image, then upload the edited result. */}
      {editTarget && (
        <PhotoEditor
          file={editTarget.file}
          config={{ mode: "full", allowRotate: true, allowZoom: true, allowDrag: true, allowFlip: true, autoCompress: true, quality: 90, maxRes: 1600, forceSquare: editTarget.key === "roomLogo" }}
          onCancel={() => setEditTarget(null)}
          onSave={async (dataUrl) => {
            const key = editTarget.key;
            setEditTarget(null);
            try {
              const blob = await (await fetch(dataUrl)).blob();
              const ext = blob.type.includes("png") ? "png" : "jpg";
              await uploadImageFor(key, new File([blob], `room-${key}.${ext}`, { type: blob.type || "image/jpeg" }));
            } catch { toast("Could not process the image", "error"); }
          }}
        />
      )}
    </div>
  );
}
