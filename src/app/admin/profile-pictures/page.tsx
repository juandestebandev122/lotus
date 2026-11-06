"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import { withBase } from "@/lib/base-path";
import { cn } from "@/lib/cn";
import { UserPicker } from "@/components/admin/UserPicker";
import { Avatar } from "@/components/ui/Avatar";
import { UserRound, Upload, Loader2, Ban, Trash2, Clock, Play, CalendarClock, Lock, Users, Pencil, X, Check } from "lucide-react";

interface Campaign {
  id: string; name: string; image: string; agencyIds?: string[]; userIds?: string[];
  startAt: string; endAt: string; lockUserAvatar?: boolean; cancelledAt?: string;
  createdBy?: string; createdAt: string;
  status: "scheduled" | "active" | "expired" | "cancelled"; affectedCount: number;
}
interface AgencyLite { id: string; name: string; agencyId: string; members: number }

const toLocalInput = (iso?: string) => { if (!iso) return ""; const d = new Date(iso); const p = (x: number) => String(x).padStart(2, "0"); return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`; };
const fmt = (iso?: string) => (iso ? new Date(iso).toLocaleString("en-GB", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "—");

const STATUS_STYLE: Record<Campaign["status"], string> = {
  scheduled: "bg-amber-500/15 text-amber-300",
  active: "bg-emerald-500/15 text-emerald-300",
  expired: "bg-white/10 text-mist-400",
  cancelled: "bg-rose-500/15 text-rose-300",
};

export default function AdminProfilePicturesPage() {
  const { toast } = useToast();
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [agencies, setAgencies] = useState<AgencyLite[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  // Draft
  const [name, setName] = useState("");
  const [image, setImage] = useState("");
  const [applyAll, setApplyAll] = useState(true);
  const [agencyIds, setAgencyIds] = useState<string[]>([]);
  const [startAt, setStartAt] = useState("");
  const [endAt, setEndAt] = useState("");
  const [lock, setLock] = useState(false);
  // Specific USERS (in addition to, or instead of, whole groups). The server takes
  // the union of the two lists, so an admin can mix "this group + these people".
  const [userIds, setUserIds] = useState<string[]>([]);
  const [userNames, setUserNames] = useState<Record<string, { name: string; username: string; avatar?: string }>>({});
  const [pickText, setPickText] = useState("");
  // When set, the form is EDITING that campaign instead of creating a new one.
  const [editingId, setEditingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const r = await fetch(withBase("/api/admin/avatar-campaigns"), { credentials: "include", cache: "no-store" });
      const d = await r.json().catch(() => ({}));
      setCampaigns(Array.isArray(d?.campaigns) ? d.campaigns : []);
      setAgencies(Array.isArray(d?.agencies) ? d.agencies : []);
    } catch { toast("Could not load campaigns", "error"); }
    setLoading(false);
  }, [toast]);
  useEffect(() => { void load(); }, [load]);

  const pickImage = (file?: File) => {
    if (!file) return;
    if (!/\.(jpe?g|png|webp)$/i.test(file.name) && !/image\/(jpeg|png|webp)/i.test(file.type)) { toast("Use a JPG, PNG or WEBP image", "error"); return; }
    if (file.size > 2 * 1024 * 1024) { toast("Image is too large (max 2 MB)", "error"); return; }
    const reader = new FileReader();
    reader.onload = () => setImage(String(reader.result || ""));
    reader.readAsDataURL(file);
  };

  const reset = () => {
    setName(""); setImage(""); setApplyAll(true); setAgencyIds([]); setStartAt(""); setEndAt(""); setLock(false);
    setUserIds([]); setPickText(""); setEditingId(null);
  };

  /** Load an existing campaign back into the form so it can be edited. */
  const startEdit = (c: Campaign) => {
    setEditingId(c.id);
    setName(c.name);
    setImage(c.image);
    const targeted = (c.agencyIds?.length ?? 0) > 0 || (c.userIds?.length ?? 0) > 0;
    setApplyAll(!targeted);
    setAgencyIds(c.agencyIds ?? []);
    setUserIds(c.userIds ?? []);
    setStartAt(toLocalInput(c.startAt));
    setEndAt(toLocalInput(c.endAt));
    setLock(c.lockUserAvatar === true);
    if (typeof window !== "undefined") window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const post = async (payload: Record<string, unknown>) => {
    const r = await fetch(withBase("/api/admin/avatar-campaigns"), { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
    return { ok: r.ok, data: await r.json().catch(() => ({})) as { error?: string } };
  };

  const create = async (now: boolean) => {
    if (!image) { toast("Upload a picture first", "error"); return; }
    const start = now ? new Date().toISOString() : (startAt ? new Date(startAt).toISOString() : "");
    const end = endAt ? new Date(endAt).toISOString() : "";
    if (!start || !end) { toast("Set the start and end date/time", "error"); return; }
    if (!applyAll && agencyIds.length === 0 && userIds.length === 0) { toast("Pick at least one group or user, or choose Apply to All", "error"); return; }
    setBusy("create");
    const payload = {
      name: name.trim() || "Profile picture campaign",
      image,
      agencyIds: applyAll ? [] : agencyIds,
      userIds: applyAll ? [] : userIds,
      startAt: start, endAt: end, lockUserAvatar: lock,
    };
    const res = editingId
      ? await post({ action: "update", id: editingId, ...payload })
      : await post({ action: "create", ...payload });
    setBusy(null);
    if (res.ok) {
      toast(editingId ? "Campaign updated" : now ? "Campaign started" : "Campaign scheduled", "success");
      reset();
      await load();
    } else toast(res.data.error ?? "Could not save the campaign", "error");
  };

  const act = async (action: "cancel" | "delete", c: Campaign) => {
    if (action === "delete" && !confirm(`Delete campaign "${c.name}"? Users are unaffected — their real picture shows immediately.`)) return;
    if (action === "cancel" && !confirm(`Cancel "${c.name}" now? Every user's own picture returns immediately.`)) return;
    setBusy(action + c.id);
    const res = await post({ action, id: c.id });
    setBusy(null);
    if (res.ok) { toast(action === "cancel" ? "Campaign cancelled — pictures reverted" : "Campaign deleted", "success"); await load(); }
    else toast(res.data.error ?? "Failed", "error");
  };

  const toggleAgency = (id: string) => setAgencyIds((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));
  const targetLabel = (c: Campaign) => {
    const all = (!c.agencyIds || c.agencyIds.length === 0) && (!c.userIds || c.userIds.length === 0);
    if (all) return "All users";
    const parts: string[] = [];
    if (c.agencyIds?.length) parts.push(`${c.agencyIds.length} group${c.agencyIds.length === 1 ? "" : "s"}`);
    if (c.userIds?.length) parts.push(`${c.userIds.length} user${c.userIds.length === 1 ? "" : "s"}`);
    return parts.join(" + ") || "All users";
  };
  const activeCount = useMemo(() => campaigns.filter((c) => c.status === "active").length, [campaigns]);

  return (
    <div className="mx-auto max-w-5xl space-y-5 pb-24">
      <div>
        <h1 className="flex items-center gap-2 font-display text-2xl font-extrabold text-mist-100"><UserRound className="size-6 text-lotus-300" /> Common Profile Picture</h1>
        <p className="mt-1 text-sm text-mist-400">Show one picture as the profile photo for chosen users during a scheduled window (e.g. a festival or event). It reverts automatically when the window ends. <b className="text-emerald-300">Nobody&rsquo;s real picture is ever changed or lost</b> — this only overrides what&rsquo;s shown, so everyone gets their own photo back on its own.</p>
      </div>

      {/* Create form */}
      <Card className="space-y-4 p-4 sm:p-5">
        <h2 className="font-display text-lg font-bold text-mist-100">
          {editingId ? "Edit campaign" : "New campaign"}
          {editingId && <span className="ml-2 rounded-full bg-amber-500/15 px-2 py-0.5 align-middle text-[11px] font-bold uppercase text-amber-300">editing</span>}
        </h2>
        <div className="grid gap-4 sm:grid-cols-[auto_1fr]">
          {/* Image + preview */}
          <div className="flex flex-col items-center gap-2">
            <div className="grid size-28 place-items-center overflow-hidden rounded-2xl border border-line bg-ink-900">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              {image ? <img src={image} alt="preview" className="size-full object-cover" /> : <UserRound className="size-10 text-mist-600" />}
            </div>
            <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={(e) => pickImage(e.target.files?.[0])} />
            <Button size="sm" variant="secondary" onClick={() => fileRef.current?.click()}><Upload className="size-3.5" /> {image ? "Replace" : "Upload"}</Button>
            {image && <button onClick={() => setImage("")} className="text-[11px] text-mist-500 hover:text-rose-300">Remove</button>}
          </div>
          {/* Fields */}
          <div className="space-y-3">
            <label className="block"><span className="mb-1 block text-xs font-semibold text-mist-300">Campaign name</span>
              <input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Lotus Festival 2026" className="h-10 w-full rounded-lg border border-line bg-ink-800 px-3 text-sm text-mist-100 outline-none focus:border-lotus-400/50" />
            </label>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block"><span className="mb-1 block text-xs font-semibold text-mist-300">Start date &amp; time</span>
                <input type="datetime-local" value={startAt} onChange={(e) => setStartAt(e.target.value)} className="h-10 w-full rounded-lg border border-line bg-ink-800 px-3 text-sm text-mist-100 outline-none focus:border-lotus-400/50" />
              </label>
              <label className="block"><span className="mb-1 block text-xs font-semibold text-mist-300">End date &amp; time</span>
                <input type="datetime-local" value={endAt} onChange={(e) => setEndAt(e.target.value)} className="h-10 w-full rounded-lg border border-line bg-ink-800 px-3 text-sm text-mist-100 outline-none focus:border-lotus-400/50" />
              </label>
            </div>
            {/* Target */}
            <div>
              <div className="mb-1.5 text-xs font-semibold text-mist-300">Apply to</div>
              <div className="flex flex-wrap gap-2">
                <button onClick={() => setApplyAll(true)} className={cn("rounded-lg border px-3 py-1.5 text-sm font-semibold transition", applyAll ? "border-lotus-400/50 bg-lotus-500/15 text-lotus-200" : "border-line bg-ink-900 text-mist-400 hover:text-mist-100")}><Users className="mr-1 inline size-3.5" /> All users / groups</button>
                <button onClick={() => setApplyAll(false)} className={cn("rounded-lg border px-3 py-1.5 text-sm font-semibold transition", !applyAll ? "border-lotus-400/50 bg-lotus-500/15 text-lotus-200" : "border-line bg-ink-900 text-mist-400 hover:text-mist-100")}>Specific groups / users</button>
              </div>
              {!applyAll && (
                <div className="mt-2 space-y-3">
                  {/* Groups */}
                  <div>
                    <div className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-mist-500">Groups</div>
                    <div className="max-h-36 space-y-1 overflow-y-auto rounded-lg border border-line bg-ink-900/50 p-2">
                      {agencies.length === 0 ? <p className="p-2 text-[11px] text-mist-500">No groups (agencies) exist yet.</p> : agencies.map((a) => (
                        <label key={a.id} className="flex cursor-pointer items-center gap-2 rounded px-2 py-1 text-sm text-mist-200 hover:bg-white/[0.04]">
                          <input type="checkbox" checked={agencyIds.includes(a.id)} onChange={() => toggleAgency(a.id)} className="size-4 accent-lotus-500" />
                          {a.name} <span className="text-[10px] text-mist-500">{a.agencyId} · {a.members} members</span>
                        </label>
                      ))}
                    </div>
                    <p className="mt-1 text-[10px] text-mist-500">Anyone who joins a selected group later is picked up automatically while the campaign is running.</p>
                  </div>

                  {/* Individual users */}
                  <div>
                    <div className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-mist-500">Specific users {userIds.length > 0 && <span className="text-mist-400">({userIds.length})</span>}</div>
                    <UserPicker
                      value={pickText}
                      onPick={(v, u) => {
                        setPickText(v);
                        if (!u) return;
                        setUserIds((p) => (p.includes(u.id) ? p : [...p, u.id]));
                        setUserNames((n) => ({ ...n, [u.id]: { name: u.fullName, username: u.username, avatar: u.avatar || undefined } }));
                        setPickText("");
                      }}
                      placeholder="Add a user — name, @username or member ID"
                      className="max-w-sm"
                    />
                    {userIds.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {userIds.map((id) => {
                          const who = userNames[id];
                          return (
                            <span key={id} className="inline-flex items-center gap-1.5 rounded-full border border-line bg-ink-900 py-1 pl-1 pr-2 text-xs text-mist-200">
                              <Avatar name={who?.name ?? "User"} src={who?.avatar} size="xs" />
                              <span className="max-w-32 truncate">{who?.name ?? id}</span>
                              <button onClick={() => setUserIds((p) => p.filter((x) => x !== id))} className="text-mist-500 hover:text-rose-300"><X className="size-3" /></button>
                            </span>
                          );
                        })}
                        <button onClick={() => setUserIds([])} className="text-[11px] font-semibold text-mist-500 hover:text-rose-300">clear all</button>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
            <label className="flex items-center gap-2 text-sm text-mist-300">
              <input type="checkbox" checked={lock} onChange={(e) => setLock(e.target.checked)} className="size-4 accent-lotus-500" />
              <Lock className="size-3.5 text-mist-400" /> Lock user profile picture (users can&rsquo;t change their own while active)
            </label>
            <div className="flex flex-wrap gap-2 pt-1">
              {editingId ? (
                <>
                  <Button onClick={() => create(false)} disabled={busy === "create"}>{busy === "create" ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />} Save changes</Button>
                  <Button variant="ghost" onClick={reset}><X className="size-4" /> Cancel editing</Button>
                </>
              ) : (
                <>
                  <Button onClick={() => create(false)} disabled={busy === "create"}>{busy === "create" ? <Loader2 className="size-4 animate-spin" /> : <CalendarClock className="size-4" />} Schedule</Button>
                  <Button variant="secondary" onClick={() => create(true)} disabled={busy === "create"}><Play className="size-4" /> Apply now</Button>
                  <Button variant="ghost" onClick={reset}>Clear</Button>
                </>
              )}
            </div>
          </div>
        </div>
      </Card>

      {/* Campaigns / history */}
      <Card className="p-4 sm:p-5">
        <h2 className="mb-1 flex items-center gap-2 font-display text-lg font-bold text-mist-100"><Clock className="size-5 text-lotus-300" /> Campaigns {activeCount > 0 && <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-[11px] font-bold text-emerald-300">{activeCount} active</span>}</h2>
        <p className="mb-3 text-sm text-mist-400">Scheduled / active / expired / cancelled — with who it affects and who created it.</p>
        {loading ? <div className="grid h-24 place-items-center text-mist-500"><Loader2 className="size-5 animate-spin" /></div> :
          campaigns.length === 0 ? <p className="py-8 text-center text-sm text-mist-500">No campaigns yet.</p> : (
          <div className="-mx-4 overflow-x-auto sm:-mx-5">
            <table className="w-full min-w-[820px] text-sm">
              <thead><tr className="border-b border-line text-left text-xs uppercase tracking-wide text-mist-500">
                <th className="px-4 py-2.5 font-semibold">Campaign</th><th className="px-4 py-2.5 font-semibold">Status</th><th className="px-4 py-2.5 font-semibold">Applies to</th>
                <th className="px-4 py-2.5 font-semibold">Window</th><th className="px-4 py-2.5 font-semibold">Lock</th><th className="px-4 py-2.5 text-right font-semibold">Users</th><th className="px-4 py-2.5 font-semibold">Created</th><th className="px-4 py-2.5 text-right font-semibold">Actions</th>
              </tr></thead>
              <tbody>
                {campaigns.map((c) => (
                  <tr key={c.id} className="border-b border-line/50">
                    <td className="px-4 py-2">
                      <div className="flex items-center gap-2">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={c.image} alt="" className="size-9 rounded-lg object-cover" />
                        <span className="font-semibold text-mist-100">{c.name}</span>
                      </div>
                    </td>
                    <td className="px-4 py-2"><span className={cn("rounded-full px-2 py-0.5 text-[11px] font-bold uppercase", STATUS_STYLE[c.status])}>{c.status}</span></td>
                    <td className="px-4 py-2 text-xs text-mist-300">{targetLabel(c)}</td>
                    <td className="whitespace-nowrap px-4 py-2 text-[11px] text-mist-400">{fmt(c.startAt)}<br />→ {fmt(c.endAt)}</td>
                    <td className="px-4 py-2 text-xs">{c.lockUserAvatar ? <span className="text-amber-300">Locked</span> : <span className="text-mist-500">—</span>}</td>
                    <td className="px-4 py-2 text-right tabular-nums text-mist-300">{c.affectedCount}</td>
                    <td className="whitespace-nowrap px-4 py-2 text-[11px] text-mist-500">{c.createdBy ?? "—"}<br />{fmt(c.createdAt)}</td>
                    <td className="px-4 py-2">
                      <div className="flex items-center justify-end gap-1">
                        <button title="Edit campaign" onClick={() => startEdit(c)} className="grid size-8 place-items-center rounded-lg text-mist-400 hover:bg-white/[0.06] hover:text-mist-100"><Pencil className="size-4" /></button>
                        {(c.status === "active" || c.status === "scheduled") && <Button size="sm" variant="ghost" onClick={() => act("cancel", c)} disabled={busy === "cancel" + c.id}>{busy === "cancel" + c.id ? <Loader2 className="size-4 animate-spin" /> : <Ban className="size-4" />} Cancel</Button>}
                        <button title="Delete" onClick={() => act("delete", c)} disabled={busy === "delete" + c.id} className="grid size-8 place-items-center rounded-lg text-rose-300 hover:bg-rose-500/10"><Trash2 className="size-4" /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
