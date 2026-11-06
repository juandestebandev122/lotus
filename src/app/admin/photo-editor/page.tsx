"use client";

import { useEffect, useState } from "react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import { cn } from "@/lib/cn";
import { useConfig, saveConfig } from "@/lib/config";
import { fileToDataUrl } from "@/lib/image";
import { avatarLabel, avatarLabelScale, DEFAULT_AVATAR_LABEL } from "@/lib/avatar-label";
import { Camera, Check, ImageIcon, Loader2, ShieldCheck, Info, Trash2, UserCircle, Search, ExternalLink, Eye, Users } from "lucide-react";

const field = "rounded-lg border border-line bg-ink-900 px-3 py-2 text-sm text-mist-100 outline-none focus:border-lotus-400";
const ALL_FORMATS = ["jpg", "png", "webp", "heic"];

// Sample names for the live preview — deliberately including an emoji-prefixed
// one, because that is exactly the case that used to render as a broken "◆S".
const PREVIEW_NAMES = ["🌸SIVA SIVA", "Ahmed Al Rashid", "Priya", "محمد العتيبي"];

interface PendingRow { userId: string; publicId?: string; fullName: string; username?: string; currentAvatar: string; pendingAvatar: string; at?: string }
interface MemberRow { id: string; publicId?: string; fullName: string; username?: string; avatar?: string; accountStatus?: string; joinedAt?: string }

// Full-size viewer. The approvals list only ever showed a 56px thumbnail, and
// after approval there was no way to look at a member's picture at all — which
// is what this fixes (client request).
function PictureViewer({ open, onClose }: { open: { src: string; name: string; sub?: string } | null; onClose: () => void }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div onClick={onClose} className="fixed inset-0 z-[120] grid place-items-center bg-black/85 p-4 backdrop-blur-sm">
      <div onClick={(e) => e.stopPropagation()} className="flex max-h-full w-full max-w-lg flex-col items-center gap-3">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={open.src} alt={open.name} className="max-h-[70vh] w-auto max-w-full rounded-2xl border border-white/15 object-contain shadow-2xl" />
        <div className="text-center">
          <p className="text-sm font-bold text-mist-100">{open.name}</p>
          {open.sub && <p className="text-xs text-mist-400">{open.sub}</p>}
        </div>
        <div className="flex gap-2">
          <a href={open.src} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 rounded-lg border border-line bg-ink-800 px-3 py-1.5 text-xs font-semibold text-mist-200 no-underline hover:border-lotus-400/40">
            <ExternalLink className="size-3.5" /> Open full size
          </a>
          <button onClick={onClose} className="rounded-lg border border-line bg-ink-800 px-3 py-1.5 text-xs font-semibold text-mist-200 hover:border-lotus-400/40">Close</button>
        </div>
      </div>
    </div>
  );
}

export default function AdminPhotoEditorPage() {
  const { config, loading, reload } = useConfig();
  const { toast } = useToast();
  const [f, setF] = useState(() => config.photoEditor ?? {});
  // The photo-less avatar (config.defaultAvatar) — separate config key, saved together.
  const [da, setDa] = useState(() => ({ ...DEFAULT_AVATAR_LABEL, ...(config.defaultAvatar ?? {}) }));
  const [saving, setSaving] = useState(false);
  const [pending, setPending] = useState<PendingRow[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  // Browse every member's CURRENT picture — available at any time, approved or not.
  const [members, setMembers] = useState<MemberRow[] | null>(null);
  const [membersLoading, setMembersLoading] = useState(false);
  const [q, setQ] = useState("");
  const [withPhotoOnly, setWithPhotoOnly] = useState(true);
  const [viewing, setViewing] = useState<{ src: string; name: string; sub?: string } | null>(null);

  useEffect(() => {
    if (loading) return;
    setF(config.photoEditor ?? {});
    setDa({ ...DEFAULT_AVATAR_LABEL, ...(config.defaultAvatar ?? {}) });
  }, [loading, config]);
  const loadPending = () => { fetch("/api/admin/photo-approvals", { credentials: "include", cache: "no-store" }).then((r) => r.json()).then((d) => setPending(d.pending ?? [])).catch(() => {}); };
  useEffect(() => { loadPending(); }, []);

  // Members are loaded on demand — the list can be large, and most visits to this
  // page are about the editor settings, not browsing pictures.
  const loadMembers = async () => {
    if (membersLoading) return;
    setMembersLoading(true);
    try {
      const r = await fetch("/api/admin/users", { credentials: "include", cache: "no-store" });
      const d = await r.json();
      setMembers((d.users ?? d.data ?? []) as MemberRow[]);
    } catch { toast("Could not load members", "error"); }
    setMembersLoading(false);
  };

  const set = (patch: Partial<typeof f>) => setF((s) => ({ ...s, ...patch }));
  const toggleFormat = (fmt: string) => { const cur = f.formats ?? ["jpg", "png", "webp"]; set({ formats: cur.includes(fmt) ? cur.filter((x) => x !== fmt) : [...cur, fmt] }); };

  const setDefAv = (patch: Partial<typeof da>) => setDa((s) => ({ ...s, ...patch }));

  const save = async () => {
    setSaving(true);
    // photoEditor.defaultImage is the older, narrower copy of the same idea (it
    // only applied when a member REMOVED their photo). Mirror it so there is one
    // picture to manage, and so an existing upload keeps working after this update.
    const res = await saveConfig({ photoEditor: { ...f, defaultImage: da.imageUrl }, defaultAvatar: da });
    setSaving(false);
    if (res.ok) { await reload(); toast("Photo editor settings saved — live now.", "success"); }
    else toast(res.error ?? "Could not save", "error");
  };

  const onDefaultImage = async (file?: File) => {
    if (!file) return;
    try { const url = await fileToDataUrl(file, f.maxRes ?? 512, 0.82); setDefAv({ imageUrl: url }); toast("Default image set — remember to Save.", "info"); }
    catch { toast("Could not read that image", "error"); }
  };

  const decide = async (userId: string, approve: boolean) => {
    setBusy(userId + approve);
    try {
      const res = await fetch("/api/admin/photo-approvals", { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ userId, approve }) });
      if (res.ok) { toast(approve ? "Photo approved" : "Photo rejected", "success"); loadPending(); }
      else toast("Action failed", "error");
    } catch { toast("Action failed", "error"); }
    setBusy(null);
  };

  const Toggle = ({ label, hint, k }: { label: string; hint?: string; k: keyof typeof f }) => (
    <div className="flex items-center gap-3 rounded-lg border border-line bg-ink-900/50 p-2.5">
      <div className="min-w-0 flex-1"><div className="text-sm text-mist-100">{label}</div>{hint && <div className="text-[11px] text-mist-500">{hint}</div>}</div>
      <button onClick={() => set({ [k]: !(f[k] as boolean) } as Partial<typeof f>)} role="switch" aria-checked={!!f[k]} className={cn("relative h-6 w-11 shrink-0 rounded-full transition", f[k] ? "bg-emerald-500" : "bg-mist-600")}>
        <span className={cn("absolute top-0.5 size-5 rounded-full bg-white shadow transition-all", f[k] ? "left-[22px]" : "left-0.5")} />
      </button>
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-extrabold text-mist-100">Profile Photo Editor</h1>
          <p className="text-sm text-mist-400">Control the crop / zoom / rotate editor users see before saving a profile picture, the upload limits, and approval.</p>
        </div>
        <Button onClick={save} disabled={saving || loading}>{saving ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />} Save settings</Button>
      </div>

      {loading ? <div className="grid place-items-center py-16 text-mist-500"><Loader2 className="size-6 animate-spin" /></div> : (
        <>
          {/* Editor + mode */}
          <Card className="p-5">
            <h2 className="flex items-center gap-2 font-semibold text-mist-100"><Camera className="size-4 text-lotus-300" /> Editor</h2>
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              <Toggle label="Enable photo editor" hint="Off = plain resize like before, no crop screen" k="enabled" />
              <div className="flex items-center gap-3 rounded-lg border border-line bg-ink-900/50 p-2.5">
                <div className="min-w-0 flex-1"><div className="text-sm text-mist-100">Editing mode</div><div className="text-[11px] text-mist-500">Full editing, or crop only</div></div>
                <select value={f.mode ?? "full"} onChange={(e) => set({ mode: e.target.value as "full" | "cropOnly" })} className={cn(field, "shrink-0")}>
                  <option value="full">Full editing</option><option value="cropOnly">Crop only</option>
                </select>
              </div>
            </div>
          </Card>

          {/* Upload limits */}
          <Card className="p-5">
            <h2 className="flex items-center gap-2 font-semibold text-mist-100"><ImageIcon className="size-4 text-lotus-300" /> Upload limits</h2>
            <div className="mt-3 grid gap-3 sm:grid-cols-3">
              <label className="block"><span className="text-xs font-semibold text-mist-300">Max upload size (MB)</span><input type="number" min={1} max={100} value={f.maxSizeMB ?? 10} onChange={(e) => set({ maxSizeMB: Math.max(1, Math.min(100, Math.floor(Number(e.target.value) || 10))) })} className={cn(field, "mt-1 w-full")} /></label>
              <label className="block"><span className="text-xs font-semibold text-mist-300">Min resolution (px)</span><input type="number" min={0} value={f.minRes ?? 0} onChange={(e) => set({ minRes: Math.max(0, Math.floor(Number(e.target.value) || 0)) })} className={cn(field, "mt-1 w-full")} /><span className="mt-0.5 block text-[11px] text-mist-500">0 = no minimum</span></label>
              <label className="block"><span className="text-xs font-semibold text-mist-300">Output resolution (px)</span><input type="number" min={64} max={4000} value={f.maxRes ?? 512} onChange={(e) => set({ maxRes: Math.max(64, Math.min(4000, Math.floor(Number(e.target.value) || 512))) })} className={cn(field, "mt-1 w-full")} /><span className="mt-0.5 block text-[11px] text-mist-500">saved picture size</span></label>
            </div>
            <div className="mt-3">
              <span className="text-xs font-semibold text-mist-300">Allowed formats</span>
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                {ALL_FORMATS.map((fmt) => {
                  const on = (f.formats ?? ["jpg", "png", "webp"]).includes(fmt);
                  return <button key={fmt} onClick={() => toggleFormat(fmt)} className={cn("rounded-lg border px-3 py-1.5 text-xs font-semibold uppercase transition", on ? "border-emerald-400/40 bg-emerald-500/10 text-emerald-300" : "border-line bg-ink-900 text-mist-400")}>{fmt}</button>;
                })}
              </div>
              <p className="mt-1 text-[11px] text-mist-500">Note: HEIC/HEIF (some iPhone photos) can&apos;t be decoded by browsers — allow it only if you have client-side conversion; otherwise users should send JPG/PNG.</p>
            </div>
          </Card>

          {/* Quality */}
          <Card className="p-5">
            <h2 className="font-semibold text-mist-100">Quality &amp; compression</h2>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <Toggle label="Auto-compress on upload" hint="Smaller files, faster to load" k="autoCompress" />
              <label className="block"><span className="text-xs font-semibold text-mist-300">Image quality %</span><input type="number" min={30} max={100} value={f.quality ?? 82} onChange={(e) => set({ quality: Math.max(30, Math.min(100, Math.floor(Number(e.target.value) || 82))) })} className={cn(field, "mt-1 w-full")} /></label>
            </div>
          </Card>

          {/* Feature toggles */}
          <Card className="p-5">
            <h2 className="font-semibold text-mist-100">Allowed tools</h2>
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              <Toggle label="Force square crop (1:1)" k="forceSquare" />
              <Toggle label="Force circular profile preview" k="forceCircle" />
              <Toggle label="Allow rotation" k="allowRotate" />
              <Toggle label="Allow zoom" k="allowZoom" />
              <Toggle label="Allow drag / move" k="allowDrag" />
              <Toggle label="Allow flip" k="allowFlip" />
              <Toggle label="Auto-center image" k="autoCenter" />
            </div>
          </Card>

          {/* Approval + moderation */}
          <Card className="p-5">
            <h2 className="flex items-center gap-2 font-semibold text-mist-100"><ShieldCheck className="size-4 text-emerald-300" /> Approval &amp; moderation</h2>
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              <Toggle label="Profile picture approval required" hint="New photos wait for an admin to approve" k="approvalRequired" />
              <div className="flex items-center gap-3 rounded-lg border border-line bg-ink-900/50 p-2.5">
                <div className="min-w-0 flex-1"><div className="text-sm text-mist-100">Image moderation</div><div className="text-[11px] text-mist-500">AI needs a provider (see note)</div></div>
                <select value={f.moderation ?? "off"} onChange={(e) => set({ moderation: e.target.value as "off" | "manual" | "ai" })} className={cn(field, "shrink-0")}>
                  <option value="off">Off</option><option value="manual">Manual</option><option value="ai">AI (flag)</option>
                </select>
              </div>
            </div>
            <p className="mt-2 flex items-start gap-1.5 text-[11px] text-mist-500"><Info className="mt-0.5 size-3.5 shrink-0 text-sky-300" /> AI moderation requires connecting an image-moderation service (e.g. a vision API) — it&apos;s available as a setting here and will activate once a provider key is added. Manual moderation = the approval queue below.</p>
          </Card>

          {/* Default (photo-less) profile picture */}
          <Card className="p-5">
            <h2 className="flex items-center gap-2 font-semibold text-mist-100"><UserCircle className="size-4 text-lotus-300" /> Default profile picture</h2>
            <p className="mt-1 text-xs text-mist-400">What a member shows when they haven&apos;t set a photo — everywhere in the app (rooms, seats, chat, lists, profile).</p>

            {/* Live preview — updates as you change the settings below. */}
            <div className="mt-4 rounded-xl border border-line bg-ink-900/50 p-4">
              <div className="text-[11px] font-semibold uppercase tracking-wide text-mist-500">Live preview</div>
              <div className="mt-3 flex flex-wrap items-start gap-5">
                {PREVIEW_NAMES.map((n) => {
                  const label = da.showName || !da.imageUrl ? avatarLabel(n, da) : "";
                  return (
                    <div key={n} className="flex w-24 flex-col items-center gap-1.5 text-center">
                      <span className="relative grid size-16 place-items-center overflow-hidden rounded-full bg-gradient-to-br from-lotus-500 to-petal-500 text-base font-semibold text-white">
                        {da.imageUrl && (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img aria-hidden src={da.imageUrl} alt="" className="absolute inset-0 size-full object-cover" />
                        )}
                        {label && (
                          <span className={cn("relative px-[6%] text-center leading-tight drop-shadow", avatarLabelScale(label), da.imageUrl && "[text-shadow:0_1px_3px_rgba(0,0,0,.75)]")} style={{ wordBreak: "break-word" }}>{label}</span>
                        )}
                      </span>
                      <span className="w-full truncate text-[11px] text-mist-500">{n}</span>
                    </div>
                  );
                })}
              </div>
              <p className="mt-3 text-[11px] text-mist-500">The first name is emoji-prefixed on purpose — that is the case that used to render as a broken square.</p>
            </div>

            {/* What text to show */}
            <div className="mt-4">
              <span className="text-xs font-semibold text-mist-300">Show inside the circle</span>
              <div className="mt-1.5 grid gap-2 sm:grid-cols-3">
                {([
                  { v: "first", t: "First name", d: "Siva" },
                  { v: "full", t: "Full name", d: "Siva Siva" },
                  { v: "initials", t: "Initials only", d: "SS" },
                ] as const).map((o) => (
                  <button key={o.v} onClick={() => setDefAv({ mode: o.v })} className={cn("rounded-lg border px-3 py-2 text-left transition", da.mode === o.v ? "border-lotus-400/50 bg-lotus-500/10" : "border-line bg-ink-900 hover:border-lotus-400/30")}>
                    <div className={cn("text-sm font-semibold", da.mode === o.v ? "text-lotus-200" : "text-mist-200")}>{o.t}</div>
                    <div className="text-[11px] text-mist-500">e.g. &ldquo;{o.d}&rdquo;</div>
                  </button>
                ))}
              </div>
            </div>

            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              <label className="block rounded-lg border border-line bg-ink-900/50 p-2.5">
                <span className="text-sm text-mist-100">Maximum letters</span>
                <span className="block text-[11px] text-mist-500">Longer names are trimmed so they still fit the circle</span>
                <input type="number" min={1} max={24} value={da.maxChars} onChange={(e) => setDefAv({ maxChars: Math.max(1, Math.min(24, Math.floor(Number(e.target.value) || 10))) })} className={cn(field, "mt-1.5 w-full")} />
              </label>
              <div className="space-y-2">
                <div className="flex items-center gap-3 rounded-lg border border-line bg-ink-900/50 p-2.5">
                  <div className="min-w-0 flex-1"><div className="text-sm text-mist-100">UPPER CASE</div><div className="text-[11px] text-mist-500">Force capitals</div></div>
                  <button onClick={() => setDefAv({ uppercase: !da.uppercase })} role="switch" aria-checked={da.uppercase} className={cn("relative h-6 w-11 shrink-0 rounded-full transition", da.uppercase ? "bg-emerald-500" : "bg-mist-600")}>
                    <span className={cn("absolute top-0.5 size-5 rounded-full bg-white shadow transition-all", da.uppercase ? "left-[22px]" : "left-0.5")} />
                  </button>
                </div>
                <div className="flex items-center gap-3 rounded-lg border border-line bg-ink-900/50 p-2.5">
                  <div className="min-w-0 flex-1"><div className="text-sm text-mist-100">Keep emoji in the name</div><div className="text-[11px] text-mist-500">Off = cleaner; emoji are hard to read this small</div></div>
                  <button onClick={() => setDefAv({ keepEmoji: !da.keepEmoji })} role="switch" aria-checked={da.keepEmoji} className={cn("relative h-6 w-11 shrink-0 rounded-full transition", da.keepEmoji ? "bg-emerald-500" : "bg-mist-600")}>
                    <span className={cn("absolute top-0.5 size-5 rounded-full bg-white shadow transition-all", da.keepEmoji ? "left-[22px]" : "left-0.5")} />
                  </button>
                </div>
              </div>
            </div>

            {/* Optional house picture behind the name */}
            <div className="mt-4 border-t border-line pt-4">
              <div className="text-sm font-semibold text-mist-100">Default picture (optional)</div>
              <p className="mt-0.5 text-xs text-mist-400">Leave empty to use the coloured circle. Upload a picture to use your own artwork instead.</p>
              <div className="mt-3 flex flex-wrap items-center gap-3">
                {da.imageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={da.imageUrl} alt="default" className="size-16 rounded-full border border-line object-cover" />
                ) : <div className="grid size-16 place-items-center rounded-full border border-line bg-ink-900 text-mist-600"><ImageIcon className="size-6" /></div>}
                <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-line bg-ink-800 px-3 py-1.5 text-xs font-semibold text-mist-200 hover:border-lotus-400/40">
                  <Camera className="size-3.5" /> {da.imageUrl ? "Replace" : "Upload"}
                  <input type="file" accept="image/*" className="hidden" onChange={(e) => onDefaultImage(e.target.files?.[0])} />
                </label>
                {da.imageUrl && <button onClick={() => setDefAv({ imageUrl: "" })} className="inline-flex items-center gap-1 text-xs text-rose-300 hover:underline"><Trash2 className="size-3.5" /> Remove</button>}
              </div>
              {da.imageUrl && (
                <div className="mt-3 flex items-center gap-3 rounded-lg border border-line bg-ink-900/50 p-2.5 sm:max-w-md">
                  <div className="min-w-0 flex-1"><div className="text-sm text-mist-100">Show the name on the picture</div><div className="text-[11px] text-mist-500">Off = the picture only, no text</div></div>
                  <button onClick={() => setDefAv({ showName: !da.showName })} role="switch" aria-checked={da.showName} className={cn("relative h-6 w-11 shrink-0 rounded-full transition", da.showName ? "bg-emerald-500" : "bg-mist-600")}>
                    <span className={cn("absolute top-0.5 size-5 rounded-full bg-white shadow transition-all", da.showName ? "left-[22px]" : "left-0.5")} />
                  </button>
                </div>
              )}
            </div>
          </Card>

          {/* Pending approvals */}
          <Card className="p-5">
            <h2 className="font-semibold text-mist-100">Pending photo approvals {pending.length > 0 && <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-[11px] font-bold text-amber-300">{pending.length}</span>}</h2>
            <p className="mt-1 text-xs text-mist-400">Tap either picture to see it full size before you decide.</p>
            {pending.length === 0 ? <p className="mt-2 text-sm text-mist-500">No profile photos are waiting for approval.</p> : (
              <div className="mt-3 space-y-2">
                {pending.map((p) => (
                  <div key={p.userId} className="flex flex-wrap items-center gap-3 rounded-lg border border-line bg-ink-900/50 p-2.5">
                    {/* The NEW picture, and the one it would replace — both openable. */}
                    <button
                      onClick={() => setViewing({ src: p.pendingAvatar, name: p.fullName, sub: "New picture — awaiting approval" })}
                      title="View this picture full size"
                      className="group relative shrink-0 rounded-lg ring-offset-2 ring-offset-ink-900 transition hover:ring-2 hover:ring-lotus-400/60"
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={p.pendingAvatar} alt="" className="size-14 rounded-lg object-cover" />
                      <span className="absolute inset-0 grid place-items-center rounded-lg bg-black/45 opacity-0 transition group-hover:opacity-100"><Eye className="size-5 text-white" /></span>
                    </button>
                    {p.currentAvatar && (
                      <button
                        onClick={() => setViewing({ src: p.currentAvatar, name: p.fullName, sub: "Current picture" })}
                        title="View the picture this would replace"
                        className="hidden shrink-0 opacity-70 transition hover:opacity-100 sm:block"
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={p.currentAvatar} alt="" className="size-10 rounded-lg object-cover grayscale" />
                        <span className="mt-0.5 block text-[9px] text-mist-500">now</span>
                      </button>
                    )}
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-semibold text-mist-100">{p.fullName} {p.username && <span className="text-xs text-mist-500">@{p.username}</span>}</div>
                      {p.publicId && <div className="font-mono text-[11px] text-lotus-300">ID {p.publicId}</div>}
                    </div>
                    <div className="flex gap-2">
                      <Button size="sm" variant="secondary" onClick={() => setViewing({ src: p.pendingAvatar, name: p.fullName, sub: "New picture — awaiting approval" })}><Eye className="size-4" /> View</Button>
                      <Button size="sm" variant="secondary" disabled={busy !== null} onClick={() => decide(p.userId, false)}>Reject</Button>
                      <Button size="sm" disabled={busy !== null} onClick={() => decide(p.userId, true)}><Check className="size-4" /> Approve</Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>

          {/* Browse ANY member's current picture — the part that was missing.
              Once a photo was approved it disappeared from the queue and there
              was no way to look at it again (client request). */}
          <Card className="p-5">
            <h2 className="flex items-center gap-2 font-semibold text-mist-100"><Users className="size-4 text-lotus-300" /> Member profile pictures</h2>
            <p className="mt-1 text-xs text-mist-400">View any member&apos;s current profile picture at any time — including after it has been approved. Search by name, @username or User ID, then tap a picture to see it full size.</p>

            {members === null ? (
              <Button className="mt-4" onClick={loadMembers} disabled={membersLoading}>
                {membersLoading ? <Loader2 className="size-4 animate-spin" /> : <Users className="size-4" />} Load members
              </Button>
            ) : (
              <>
                <div className="mt-4 flex flex-wrap items-center gap-2">
                  <label className="relative min-w-56 flex-1">
                    <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-mist-500" />
                    <input
                      value={q}
                      onChange={(e) => setQ(e.target.value)}
                      placeholder="Search name, @username or ID…"
                      className={cn(field, "w-full !pl-8")}
                    />
                  </label>
                  <button
                    onClick={() => setWithPhotoOnly((v) => !v)}
                    className={cn("rounded-lg border px-3 py-2 text-xs font-semibold transition", withPhotoOnly ? "border-emerald-400/40 bg-emerald-500/10 text-emerald-300" : "border-line bg-ink-900 text-mist-400")}
                  >
                    {withPhotoOnly ? "With a photo only" : "Everyone"}
                  </button>
                  <Button size="sm" variant="secondary" onClick={loadMembers} disabled={membersLoading}>
                    {membersLoading ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />} Refresh
                  </Button>
                </div>

                {(() => {
                  const needle = q.trim().toLowerCase();
                  const shown = members
                    .filter((m) => (withPhotoOnly ? !!m.avatar : true))
                    .filter((m) => !needle
                      || m.fullName?.toLowerCase().includes(needle)
                      || (m.username ?? "").toLowerCase().includes(needle)
                      || (m.publicId ?? "").toLowerCase().includes(needle)
                      || m.id.toLowerCase().includes(needle));
                  const capped = shown.slice(0, 120);
                  return (
                    <>
                      <p className="mt-3 text-[11px] text-mist-500">
                        {shown.length} member{shown.length === 1 ? "" : "s"}
                        {shown.length > capped.length && ` · showing the first ${capped.length} — search to narrow it down`}
                      </p>
                      {capped.length === 0 ? (
                        <p className="mt-3 text-sm text-mist-500">No members match that search.</p>
                      ) : (
                        <div className="mt-3 grid grid-cols-3 gap-3 sm:grid-cols-5 lg:grid-cols-7">
                          {capped.map((m) => {
                            const waiting = pending.some((p) => p.userId === m.id);
                            return (
                              <button
                                key={m.id}
                                onClick={() => m.avatar
                                  ? setViewing({ src: m.avatar, name: m.fullName, sub: [m.username ? `@${m.username}` : "", m.publicId ? `ID ${m.publicId}` : ""].filter(Boolean).join(" · ") })
                                  : toast(`${m.fullName} has not set a profile picture.`, "info")}
                                title={m.avatar ? "View full size" : "No picture set"}
                                className="group flex flex-col items-center gap-1.5 rounded-xl border border-line bg-ink-900/50 p-2 text-center transition hover:border-lotus-400/50"
                              >
                                <span className="relative">
                                  {m.avatar ? (
                                    <>
                                      {/* eslint-disable-next-line @next/next/no-img-element */}
                                      <img src={m.avatar} alt="" loading="lazy" className="size-16 rounded-full border border-white/10 object-cover" />
                                      <span className="absolute inset-0 grid place-items-center rounded-full bg-black/45 opacity-0 transition group-hover:opacity-100"><Eye className="size-5 text-white" /></span>
                                    </>
                                  ) : (
                                    <span className="grid size-16 place-items-center rounded-full border border-dashed border-line bg-ink-900 text-mist-600"><ImageIcon className="size-5" /></span>
                                  )}
                                  {waiting && <span title="A new picture is waiting for approval" className="absolute -right-1 -top-1 size-3.5 rounded-full border-2 border-ink-900 bg-amber-400" />}
                                </span>
                                <span className="w-full truncate text-[11px] font-semibold text-mist-200">{m.fullName}</span>
                                {m.publicId && <span className="w-full truncate font-mono text-[10px] text-mist-500">{m.publicId}</span>}
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </>
                  );
                })()}
              </>
            )}
          </Card>
        </>
      )}

      <PictureViewer open={viewing} onClose={() => setViewing(null)} />
    </div>
  );
}
