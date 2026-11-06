"use client";

import { useEffect, useMemo, useState } from "react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import { cn } from "@/lib/cn";
import { useConfig, saveConfig } from "@/lib/config";
import { fetchUploadAudit, fetchAdminUsers, deleteUpload, type UploadAuditRow, type AdminUser } from "@/lib/admin";
import { UserPicker } from "@/components/admin/UserPicker";
import { Avatar } from "@/components/ui/Avatar";
import { withBase } from "@/lib/base-path";
import {
  MessageSquare, Check, Info, FileText, RefreshCw, Loader2, Search, Download, ShieldAlert, SlidersHorizontal, Eye, Trash2,
  Pencil, X, UserCog, Plus,
} from "lucide-react";

const fmt = (iso?: string) => { if (!iso) return "—"; try { return new Date(iso).toLocaleString("en-SA", { dateStyle: "medium", timeStyle: "short" }); } catch { return iso; } };
const fmtBytes = (n: number) => (!n ? "—" : n < 1024 ? `${n} B` : n < 1048576 ? `${Math.round(n / 1024)} KB` : `${(n / 1048576).toFixed(1)} MB`);

// The message types the client asked about. Ones the web app fully supports are
// live; the advanced ones are labelled "coming with the app" so nothing is oversold.
const CORE_TYPES: [string, string][] = [
  ["text", "Text messages"], ["image", "Images / Photos / GIFs"], ["sticker", "Stickers"],
  ["audio", "Voice / Audio"], ["video", "Videos"], ["file", "Documents & files"],
];
const PHASE2_TYPES = ["MP3 music", "Polls", "Location", "Contacts (vCard)", "QR codes", "Business cards", "Link previews (already live)"];

export default function AdminMessagingPage() {
  const { toast } = useToast();
  const { config, reload } = useConfig();
  const m = config.messaging ?? {};
  const [types, setTypes] = useState<Record<string, boolean>>({ ...(m.types ?? {}) });
  const [maxFileMB, setMaxFileMB] = useState(String(m.maxFileMB ?? 50));
  const [blocked, setBlocked] = useState((m.blockedExtensions ?? []).join(", "));
  const [allowedExt, setAllowedExt] = useState((m.allowedExtensions ?? []).join(", "));
  const [allowAllTypes, setAllowAllTypes] = useState(!!m.allowAllTypes);
  const [allowDownload, setAllowDownload] = useState(m.allowDownload !== false);
  const [allowForward, setAllowForward] = useState(m.allowForward !== false);
  const [allowCopy, setAllowCopy] = useState(m.allowCopy !== false);
  const [editWindowMin, setEditWindowMin] = useState(String(m.editWindowMin ?? 15));
  const [retentionDays, setRetentionDays] = useState(String(m.retentionDays ?? 0));
  const [virusScan, setVirusScan] = useState(!!m.virusScan);
  const [auditUploads, setAuditUploads] = useState(m.auditUploads !== false);
  const [saving, setSaving] = useState(false);

  // ---- Edit / Delete message permissions -----------------------------------
  // Four global ON/OFF switches plus a per-user override list, so a single member
  // can lose (or keep) the Edit or Delete option without changing anyone else.
  const [userEdit, setUserEdit] = useState(m.userEdit !== false);
  const [userDelete, setUserDelete] = useState(m.userDelete !== false);
  const [adminEditAny, setAdminEditAny] = useState(m.adminEditAny !== false);
  const [adminDeleteAny, setAdminDeleteAny] = useState(m.adminDeleteAny !== false);
  const [perUser, setPerUser] = useState<Record<string, { edit?: boolean; delete?: boolean }>>({ ...(m.perUser ?? {}) });
  // Names for the rows (the config only stores ids).
  const [perUserNames, setPerUserNames] = useState<Record<string, { name: string; username: string; avatar?: string }>>({});
  const [pickText, setPickText] = useState("");

  // Resolve the ids already saved in the config to real names once.
  useEffect(() => {
    const ids = Object.keys(m.perUser ?? {});
    if (ids.length === 0) return;
    fetchAdminUsers()
      .then((list) => {
        const map: Record<string, { name: string; username: string; avatar?: string }> = {};
        for (const id of ids) {
          const u = list.find((x) => x.id === id);
          if (u) map[id] = { name: u.fullName, username: u.username, avatar: u.avatar || undefined };
        }
        setPerUserNames((cur) => ({ ...map, ...cur }));
      })
      .catch(() => {});
    // Only on first load — later edits keep the names we captured at pick time.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const addPerUser = (u?: AdminUser) => {
    if (!u) return;
    setPerUser((p) => (p[u.id] ? p : { ...p, [u.id]: { edit: userEdit, delete: userDelete } }));
    setPerUserNames((n) => ({ ...n, [u.id]: { name: u.fullName, username: u.username, avatar: u.avatar || undefined } }));
    setPickText("");
  };
  const setPerUserFlag = (id: string, key: "edit" | "delete", value: boolean) =>
    setPerUser((p) => ({ ...p, [id]: { ...(p[id] ?? {}), [key]: value } }));
  const removePerUser = (id: string) =>
    setPerUser((p) => { const n = { ...p }; delete n[id]; return n; });

  const [uploads, setUploads] = useState<UploadAuditRow[]>([]);
  const [loadingUp, setLoadingUp] = useState(true);
  const [q, setQ] = useState("");

  const loadUploads = async () => { setLoadingUp(true); setUploads(await fetchUploadAudit()); setLoadingUp(false); };
  const removeUpload = async (u: UploadAuditRow) => {
    if (!window.confirm(`Permanently delete "${u.originalName || u.name}"? It will no longer open anywhere it was shared.`)) return;
    const res = await deleteUpload(u.name);
    if (res.ok) { setUploads((list) => list.filter((x) => x.name !== u.name)); toast("File deleted", "success"); }
    else toast(res.error ?? "Could not delete", "error");
  };
  useEffect(() => { loadUploads(); }, []);

  const parseExt = (s: string) => Array.from(new Set(s.split(/[\s,]+/).map((x) => x.trim().toLowerCase().replace(/^\./, "")).filter((x) => /^[a-z0-9]{1,10}$/.test(x))));

  const save = async () => {
    setSaving(true);
    const res = await saveConfig({ messaging: {
      types,
      maxFileMB: Math.max(0, Number(maxFileMB) || 0),
      blockedExtensions: parseExt(blocked),
      allowedExtensions: parseExt(allowedExt),
      allowAllTypes,
      allowDownload, allowForward, allowCopy,
      editWindowMin: Math.max(0, Number(editWindowMin) || 0),
      retentionDays: Math.max(0, Number(retentionDays) || 0),
      virusScan, auditUploads,
      userEdit, userDelete, adminEditAny, adminDeleteAny, perUser,
    } });
    setSaving(false);
    if (res.ok) { await reload(); toast("Messaging controls saved — live now.", "success"); }
    else toast(res.error ?? "Could not save", "error");
  };

  const shownUploads = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return uploads;
    return uploads.filter((u) => `${u.originalName} ${u.ownerName} ${u.ownerPublicId ?? ""} ${u.kind} ${u.mime}`.toLowerCase().includes(s));
  }, [uploads, q]);

  const Toggle = ({ on, set, label, hint }: { on: boolean; set: (v: boolean) => void; label: string; hint?: string }) => (
    <div className="flex items-center gap-3 rounded-lg border border-line bg-ink-900/50 p-2.5">
      <div className="min-w-0 flex-1"><div className="text-sm text-mist-100">{label}</div>{hint && <div className="text-[11px] text-mist-500">{hint}</div>}</div>
      <button onClick={() => set(!on)} role="switch" aria-checked={on} className={cn("relative h-6 w-11 shrink-0 rounded-full transition", on ? "bg-emerald-500" : "bg-mist-600")}>
        <span className={cn("absolute top-0.5 size-5 rounded-full bg-white shadow transition-all", on ? "left-[22px]" : "left-0.5")} />
      </button>
    </div>
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-extrabold text-mist-100">Messaging Controls</h1>
        <p className="text-sm text-mist-400">Control what members can send, upload &amp; do in private chat — live, no app update needed.</p>
      </div>

      <div className="flex items-start gap-2 rounded-xl border border-sky-400/20 bg-sky-500/5 px-4 py-3 text-xs text-mist-400">
        <Info className="mt-0.5 size-4 shrink-0 text-sky-300" />
        <p>Private chat already supports two-way <b className="text-mist-200">text, photos, GIFs, videos, voice notes, MP3s and documents</b>, with reply, forward, copy, edit, star, pin, reactions, read receipts &amp; delivery ticks. These controls sit on top of that. Admin accounts are never restricted.</p>
      </div>

      {/* Message types */}
      <Card className="p-4">
        <h2 className="mb-3 flex items-center gap-2 font-semibold text-mist-100"><MessageSquare className="size-4 text-lotus-300" /> Allowed message types</h2>
        <div className="grid gap-2 sm:grid-cols-2">
          {CORE_TYPES.map(([key, label]) => (
            <Toggle key={key} on={types[key] !== false} set={(v) => setTypes((t) => ({ ...t, [key]: v }))} label={label} />
          ))}
        </div>
        <p className="mt-3 text-[11px] text-mist-500">
          GIFs count as Images, and Emojis are part of Text. Coming with the native app (need device features): {PHASE2_TYPES.join(" · ")}.
        </p>
      </Card>

      {/* File controls */}
      <Card className="p-4">
        <h2 className="mb-3 flex items-center gap-2 font-semibold text-mist-100"><FileText className="size-4 text-lotus-300" /> File &amp; upload controls</h2>
        <div className="grid gap-3 sm:grid-cols-3">
          <label className="block">
            <span className="text-xs font-semibold text-mist-300">Max attachment size (MB)</span>
            <input value={maxFileMB} onChange={(e) => setMaxFileMB(e.target.value.replace(/\D/g, ""))} className="mt-1 w-full rounded-lg border border-line bg-ink-900 px-3 py-2 text-sm text-mist-100 outline-none focus:border-lotus-400" />
            <span className="mt-0.5 block text-[11px] text-mist-500">0 = use the global upload limit</span>
          </label>
          <label className="block">
            <span className="text-xs font-semibold text-mist-300">Message edit window (minutes)</span>
            <input value={editWindowMin} onChange={(e) => setEditWindowMin(e.target.value.replace(/\D/g, ""))} className="mt-1 w-full rounded-lg border border-line bg-ink-900 px-3 py-2 text-sm text-mist-100 outline-none focus:border-lotus-400" />
            <span className="mt-0.5 block text-[11px] text-mist-500">0 = editing off</span>
          </label>
          <label className="block">
            <span className="text-xs font-semibold text-mist-300">Message retention (days)</span>
            <input value={retentionDays} onChange={(e) => setRetentionDays(e.target.value.replace(/\D/g, ""))} className="mt-1 w-full rounded-lg border border-line bg-ink-900 px-3 py-2 text-sm text-mist-100 outline-none focus:border-lotus-400" />
            <span className="mt-0.5 block text-[11px] text-mist-500">0 = keep forever</span>
          </label>
        </div>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <label className="block">
            <span className="text-xs font-semibold text-mist-300">Extra allowed file types</span>
            <input value={allowedExt} onChange={(e) => setAllowedExt(e.target.value)} placeholder="zip, rar, apk, 7z" className="mt-1 w-full rounded-lg border border-line bg-ink-900 px-3 py-2 text-sm text-mist-100 outline-none focus:border-lotus-400" />
            <span className="mt-0.5 block text-[11px] text-mist-500">Turn on archives / installers (ZIP, RAR, APK…) — comma separated.</span>
          </label>
          <label className="block">
            <span className="text-xs font-semibold text-mist-300">Blocked file types</span>
            <input value={blocked} onChange={(e) => setBlocked(e.target.value)} placeholder="exe, bat, scr" className="mt-1 w-full rounded-lg border border-line bg-ink-900 px-3 py-2 text-sm text-mist-100 outline-none focus:border-lotus-400" />
            <span className="mt-0.5 block text-[11px] text-mist-500">Refuse these extensions — comma separated.</span>
          </label>
        </div>
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          <Toggle on={allowAllTypes} set={setAllowAllTypes} label="Allow all file types" hint="Accept ANY file (documents, archives, etc.) in chat — except executables / app-installers (exe, bat, apk…), which stay blocked for safety." />
          <Toggle on={virusScan} set={setVirusScan} label="Security scan on upload" hint="Blocks dangerous file types (exe, bat, apk, scr…). Full virus scanning needs a provider." />
          <Toggle on={auditUploads} set={setAuditUploads} label="Keep upload audit log" hint="Record every uploaded file (shown below)." />
        </div>
      </Card>

      {/* Permissions */}
      <Card className="p-4">
        <h2 className="mb-3 flex items-center gap-2 font-semibold text-mist-100"><SlidersHorizontal className="size-4 text-lotus-300" /> Permissions</h2>
        <div className="grid gap-2 sm:grid-cols-3">
          <Toggle on={allowDownload} set={setAllowDownload} label="Allow downloads" />
          <Toggle on={allowForward} set={setAllowForward} label="Allow forwarding" />
          <Toggle on={allowCopy} set={setAllowCopy} label="Allow copy text" />
        </div>
        <div className="mt-3 flex items-start gap-2 rounded-lg border border-amber-400/20 bg-amber-500/[0.05] px-3 py-2 text-[11px] text-mist-400">
          <ShieldAlert className="mt-0.5 size-3.5 shrink-0 text-amber-300" />
          <p>Screenshot blocking on a website can only be a deterrent — a real screenshot/recording block needs the native app (already available for the Paid Zone via Capture Protection).</p>
        </div>
      </Card>

      {/* ---- Edit & Delete message permissions ------------------------------- */}
      <Card className="p-4">
        <h2 className="mb-1 flex items-center gap-2 font-semibold text-mist-100">
          <Pencil className="size-4 text-lotus-300" /> Edit &amp; Delete message permissions
        </h2>
        <p className="mb-3 text-xs text-mist-500">
          Every message in a private chat carries an <b className="text-mist-300">Edit</b> and a <b className="text-mist-300">Delete</b> option.
          These switches decide who gets to see them. Administrators can also edit or delete <b className="text-mist-300">any</b> user&apos;s
          message from inside the chat — every such action is written to the admin log.
        </p>

        <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-mist-400">Members (their own messages)</p>
        <div className="grid gap-2 sm:grid-cols-2">
          <Toggle on={userEdit} set={setUserEdit} label="Members can EDIT their own messages" hint={`Within the edit window above (${editWindowMin || 0} min). Off = the Edit option disappears for everyone.`} />
          <Toggle on={userDelete} set={setUserDelete} label="Members can DELETE their own messages" hint="“Delete for everyone”. Off = they can still delete a message from their own view only." />
        </div>

        <p className="mb-1.5 mt-4 text-[11px] font-semibold uppercase tracking-wide text-amber-300/80">Administrators (any user&apos;s messages)</p>
        <div className="grid gap-2 sm:grid-cols-2">
          <Toggle on={adminEditAny} set={setAdminEditAny} label="Admins can EDIT any message" hint="No time limit. The message is still marked “edited” for both people." />
          <Toggle on={adminDeleteAny} set={setAdminDeleteAny} label="Admins can DELETE any message" hint="Removes it for both people and leaves a “[removed]” placeholder in the history." />
        </div>

        {/* Per-user overrides */}
        <div className="mt-5 rounded-xl border border-line bg-ink-900/50 p-3">
          <h3 className="flex items-center gap-2 text-sm font-semibold text-mist-100">
            <UserCog className="size-4 text-lotus-300" /> Per-user overrides
            <span className="rounded-full bg-ink-700 px-2 py-0.5 text-[10px] text-mist-300">{Object.keys(perUser).length}</span>
          </h3>
          <p className="mt-0.5 text-[11px] text-mist-500">
            Turn Edit or Delete on or off for <b className="text-mist-300">one specific member</b>. Anyone not listed here follows the global switches above.
          </p>

          <div className="mt-2.5 flex items-center gap-2">
            <UserPicker value={pickText} onPick={(v, u) => { setPickText(v); if (u) addPerUser(u); }} placeholder="Add a member — name, @username or ID" className="max-w-sm flex-1" />
            <span className="hidden items-center gap-1 text-[11px] text-mist-500 sm:flex"><Plus className="size-3.5" /> pick a member to add a rule</span>
          </div>

          <div className="mt-3 space-y-1.5">
            {Object.entries(perUser).map(([id, rule]) => {
              const who = perUserNames[id];
              return (
                <div key={id} className="flex flex-wrap items-center gap-2 rounded-lg border border-line bg-ink-900 px-3 py-2">
                  <Avatar name={who?.name ?? "Member"} src={who?.avatar} size="xs" />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm text-mist-100">{who?.name ?? id}</div>
                    <div className="truncate text-[10px] text-mist-500">{who?.username ? `@${who.username}` : id}</div>
                  </div>
                  <button
                    onClick={() => setPerUserFlag(id, "edit", !(rule.edit ?? userEdit))}
                    className={cn("rounded-lg px-2.5 py-1 text-[11px] font-semibold transition", (rule.edit ?? userEdit) ? "bg-emerald-500/15 text-emerald-300" : "bg-rose-500/15 text-rose-300")}
                  >
                    Edit: {(rule.edit ?? userEdit) ? "ON" : "OFF"}
                  </button>
                  <button
                    onClick={() => setPerUserFlag(id, "delete", !(rule.delete ?? userDelete))}
                    className={cn("rounded-lg px-2.5 py-1 text-[11px] font-semibold transition", (rule.delete ?? userDelete) ? "bg-emerald-500/15 text-emerald-300" : "bg-rose-500/15 text-rose-300")}
                  >
                    Delete: {(rule.delete ?? userDelete) ? "ON" : "OFF"}
                  </button>
                  <button onClick={() => removePerUser(id)} title="Remove this override" className="grid size-7 place-items-center rounded-lg text-mist-400 transition hover:bg-rose-500/10 hover:text-rose-300">
                    <X className="size-4" />
                  </button>
                </div>
              );
            })}
            {Object.keys(perUser).length === 0 && (
              <p className="py-3 text-center text-xs text-mist-500">No overrides — every member follows the global switches.</p>
            )}
          </div>
        </div>
      </Card>

      <div className="flex justify-end">
        <Button onClick={save} disabled={saving}><Check className="size-4" /> {saving ? "Saving…" : "Save messaging controls"}</Button>
      </div>

      {/* Upload audit */}
      <Card className="p-4">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 className="flex items-center gap-2 font-semibold text-mist-100"><Download className="size-4 text-lotus-300" /> Uploaded file audit <span className="rounded-full bg-ink-700 px-2 py-0.5 text-[11px] text-mist-300">{uploads.length}</span></h2>
          <Button size="sm" variant="secondary" onClick={loadUploads} disabled={loadingUp}><RefreshCw className={cn("size-4", loadingUp && "animate-spin")} /> Refresh</Button>
        </div>
        <div className="mb-3 flex items-center gap-2 rounded-xl border border-line bg-ink-900 px-3">
          <Search className="size-4 text-mist-500" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search by file name · user · type" className="w-full bg-transparent py-2.5 text-sm text-mist-100 outline-none" />
        </div>
        {loadingUp ? (
          <div className="grid place-items-center py-10 text-mist-500"><Loader2 className="size-6 animate-spin" /></div>
        ) : shownUploads.length === 0 ? (
          <div className="py-8 text-center text-sm text-mist-500">No uploads recorded.</div>
        ) : (
          <div className="max-h-[26rem] space-y-1 overflow-y-auto">
            {shownUploads.map((u) => (
              <div key={u.name} className="flex items-center gap-3 rounded-lg border border-line bg-ink-900/50 px-3 py-2 text-xs">
                <FileText className="size-4 shrink-0 text-mist-400" />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-mist-100">{u.originalName || u.name}</div>
                  <div className="truncate text-[11px] text-mist-500">{u.ownerName}{u.ownerPublicId ? ` · ID ${u.ownerPublicId}` : ""} · {u.kind || "file"} · {u.mime}</div>
                </div>
                <div className="shrink-0 text-right text-[11px] text-mist-400">
                  <div>{fmtBytes(u.size)}</div>
                  <div className="text-mist-500">{fmt(u.at)}</div>
                </div>
                {/* View (open the file) + Delete (remove from index + disk). */}
                <div className="flex shrink-0 items-center gap-1">
                  <a href={withBase(`/api/file/${u.name}`)} target="_blank" rel="noreferrer" title="View / open file" className="grid size-7 place-items-center rounded-lg text-mist-400 transition hover:bg-white/[0.06] hover:text-mist-100">
                    <Eye className="size-4" />
                  </a>
                  <a href={withBase(`/api/file/${u.name}`)} download={u.originalName || u.name} title="Download" className="grid size-7 place-items-center rounded-lg text-mist-400 transition hover:bg-white/[0.06] hover:text-mist-100">
                    <Download className="size-4" />
                  </a>
                  <button onClick={() => removeUpload(u)} title="Delete file" className="grid size-7 place-items-center rounded-lg text-rose-300 transition hover:bg-rose-500/10">
                    <Trash2 className="size-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
