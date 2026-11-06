"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Avatar } from "@/components/ui/Avatar";
import { useToast } from "@/components/ui/Toast";
import { useAuth } from "@/lib/auth";
import { useConfig } from "@/lib/config";
import { withBase } from "@/lib/base-path";
import { cn } from "@/lib/cn";
import { reportUser } from "@/lib/admin";
import { CaptureGuard } from "@/components/CaptureGuard";
import {
  fetchPaidZone, submitPaidZoneRequest, paidZoneBlock, startPaidZoneCall, exitPaidZone, renewPaidZone, savePaidZoneProfile,
  CALL_INTEREST_LABEL, type PZState, type PZDirectoryEntry, type PZProfile, type CallInterest,
} from "@/lib/paid-zone";
import { uploadFile } from "@/lib/upload";
import { Gem, Phone, Video, Flag, Ban, Upload, Check, Clock, ShieldAlert, Coins, X, LogOut, RefreshCw, Eye, EyeOff, UserRound, Lock } from "lucide-react";

const GENDER_BADGE: Record<string, string> = { male: "♂ Male", female: "♀ Female", other: "Other" };

export default function PaidZonePage() {
  const { toast } = useToast();
  const [state, setState] = useState<PZState | null>(null);
  const reload = () => fetchPaidZone().then(setState);
  // Refresh periodically so members' online/offline status stays live (pauses
  // while the tab is backgrounded to save data).
  useEffect(() => {
    reload();
    const t = setInterval(() => { if (!document.hidden) reload(); }, 30000);
    const onVis = () => { if (!document.hidden) reload(); };
    document.addEventListener("visibilitychange", onVis);
    return () => { clearInterval(t); document.removeEventListener("visibilitychange", onVis); };
  }, []);

  if (!state) return <div className="grid min-h-[60vh] place-items-center text-mist-400">Loading the Paid Zone…</div>;

  const status = state.me?.status;
  const blocked = !state.enabled && status !== "approved";

  return (
    <div className="mx-auto max-w-3xl">
      {/* Screenshot/recording protection (admin-controlled, admins exempt). */}
      <CaptureGuard label="Paid Zone" />
      <div className="mb-5 flex items-center gap-3">
        <span className="grid size-11 place-items-center rounded-2xl bg-gradient-to-br from-fuchsia-500 to-purple-600 text-white"><Gem className="size-6" /></span>
        <div>
          <h1 className="font-display text-2xl font-extrabold text-mist-100">Paid Zone</h1>
          <p className="text-sm text-mist-400">A verified, members-only space for private 1:1 audio &amp; video calls.</p>
        </div>
      </div>

      {blocked ? (
        <Card className="p-8 text-center text-sm text-mist-400">The Paid Zone is currently closed by the admin. Please check back later.</Card>
      ) : status === "approved" ? (
        <>
          <MembershipCard state={state} onChange={reload} toast={toast} />
          {state.me?.membershipActive === false ? (
            <StatusCard icon={ShieldAlert} tone="amber" title="Membership inactive" body="Your monthly membership hasn't been renewed, so Paid Zone features are locked. Tap “Renew now” above to unlock calls and the member directory again." />
          ) : (
            <>
              <FriendZoneProfileCard profile={state.fzProfile} onChange={reload} toast={toast} />
              <Directory state={state} onChange={reload} toast={toast} />
            </>
          )}
        </>
      ) : status === "pending" ? (
        <StatusCard icon={Clock} tone="amber" title="Waiting for admin approval" body="Your Paid Zone request has been submitted. An admin will review your details shortly — you'll get a notification once you're approved." />
      ) : status === "suspended" ? (
        <StatusCard icon={ShieldAlert} tone="rose" title="Access suspended" body="Your Paid Zone access has been suspended by an admin. Please contact support if you think this is a mistake." />
      ) : (
        <JoinForm joinCost={state.joinCost} rejected={status === "rejected"} note={state.me?.note} onDone={reload} toast={toast} />
      )}
    </div>
  );
}

function StatusCard({ icon: Icon, tone, title, body }: { icon: typeof Clock; tone: "amber" | "rose"; title: string; body: string }) {
  return (
    <Card className="p-8 text-center">
      <span className={cn("mx-auto grid size-14 place-items-center rounded-2xl", tone === "amber" ? "bg-amber-500/15 text-amber-300" : "bg-rose-500/15 text-rose-300")}><Icon className="size-7" /></span>
      <h2 className="mt-4 font-display text-lg font-bold text-mist-100">{title}</h2>
      <p className="mx-auto mt-2 max-w-md text-sm text-mist-400">{body}</p>
    </Card>
  );
}

// ---- Separate Friend Zone profile (independent of the login account) --------
function FriendZoneProfileCard({ profile, onChange, toast }: {
  profile: PZProfile | null;
  onChange: () => void;
  toast: (m: string, t?: "success" | "error" | "info") => void;
}) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(profile?.fzName ?? "");
  const [username, setUsername] = useState(profile?.fzUsername ?? "");
  const [bio, setBio] = useState(profile?.fzBio ?? "");
  const [avatar, setAvatar] = useState(profile?.fzAvatar ?? "");
  const [visible, setVisible] = useState(profile?.fzVisible !== false);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setName(profile?.fzName ?? ""); setUsername(profile?.fzUsername ?? "");
    setBio(profile?.fzBio ?? ""); setAvatar(profile?.fzAvatar ?? ""); setVisible(profile?.fzVisible !== false);
  }, [profile]);

  const pickAvatar = async (file: File | undefined) => {
    if (!file) return;
    setUploading(true);
    const res = await uploadFile(file, "chatimage");
    setUploading(false);
    if (res.ok && res.file?.url) setAvatar(res.file.url);
    else toast(res.error ?? "Could not upload the picture", "error");
  };

  // The visibility switch saves on its own so it works instantly, even collapsed.
  const toggleVisible = async () => {
    const next = !visible;
    setVisible(next);
    const res = await savePaidZoneProfile({ fzVisible: next });
    if (res.ok) { onChange(); toast(next ? "Your Friend Zone profile is now visible to members." : "Your Friend Zone profile is now hidden.", "info"); }
    else { setVisible(!next); toast(res.error ?? "Could not update", "error"); }
  };

  const save = async () => {
    setSaving(true);
    const res = await savePaidZoneProfile({ fzName: name, fzUsername: username, fzBio: bio, fzAvatar: avatar, fzVisible: visible });
    setSaving(false);
    if (res.ok) { onChange(); setOpen(false); toast("Friend Zone profile saved.", "success"); }
    else toast(res.error ?? "Could not save", "error");
  };

  return (
    <Card className="mb-4 p-4 sm:p-5">
      <div className="flex items-center gap-3">
        <span className="relative shrink-0">
          <Avatar name={name || "Friend Zone"} src={avatar ? withBase(avatar) : undefined} size="lg" />
          <span className="absolute -bottom-1 -right-1 grid size-5 place-items-center rounded-full bg-purple-600 text-white ring-2 ring-ink-900"><Gem className="size-3" /></span>
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h2 className="truncate font-display text-base font-bold text-mist-100">{name || "Your Friend Zone profile"}</h2>
            {profile?.fzId && <span className="shrink-0 rounded-full bg-purple-500/15 px-2 py-0.5 font-mono text-[10px] font-bold text-purple-300">{profile.fzId}</span>}
          </div>
          <p className="text-xs text-mist-500">A separate identity, seen only by Friend Zone members — never by public users. Editing it never changes your login account.</p>
        </div>
        <button
          onClick={toggleVisible}
          title={visible ? "Visible to members — tap to hide" : "Hidden — tap to show"}
          className={cn("flex shrink-0 items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-semibold transition", visible ? "bg-emerald-500/15 text-emerald-300" : "bg-mist-600/30 text-mist-300")}
        >
          {visible ? <Eye className="size-4" /> : <EyeOff className="size-4" />}
          {visible ? "Visible" : "Hidden"}
        </button>
      </div>

      {!open ? (
        <button onClick={() => setOpen(true)} className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-ink-800 px-3 py-2 text-sm font-semibold text-mist-200 transition hover:bg-white/[0.06] hover:text-mist-100">
          <UserRound className="size-4" /> Edit my Friend Zone profile
        </button>
      ) : (
        <div className="mt-4 space-y-3 border-t border-line/60 pt-4">
          <div className="flex items-center gap-3">
            <Avatar name={name || "FZ"} src={avatar ? withBase(avatar) : undefined} size="lg" />
            <div className="flex gap-2">
              <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; void pickAvatar(f); }} />
              <Button size="sm" variant="secondary" onClick={() => fileRef.current?.click()} disabled={uploading}><Upload className="size-4" /> {uploading ? "Uploading…" : "Change picture"}</Button>
              {avatar && <Button size="sm" variant="ghost" onClick={() => setAvatar("")}>Remove</Button>}
            </div>
          </div>
          <label className="block">
            <span className="text-xs font-semibold text-mist-400">Friend Zone display name</span>
            <input value={name} onChange={(e) => setName(e.target.value)} maxLength={40} placeholder="e.g. Lotus Star" className={PZ_FIELD} />
          </label>
          <label className="block">
            <span className="text-xs font-semibold text-mist-400">Friend Zone username</span>
            <input value={username} onChange={(e) => setUsername(e.target.value)} maxLength={24} placeholder="e.g. lotus_star" className={PZ_FIELD} />
          </label>
          <label className="block">
            <span className="text-xs font-semibold text-mist-400">Friend Zone bio</span>
            <textarea value={bio} onChange={(e) => setBio(e.target.value)} maxLength={300} rows={3} placeholder="A short introduction shown only to Friend Zone members." className={cn(PZ_FIELD, "resize-none")} />
          </label>
          <div className="flex items-center gap-2 rounded-lg bg-ink-800/60 px-3 py-2 text-xs text-mist-400">
            <Lock className="size-3.5 shrink-0 text-mist-500" />
            This profile and everything in it is hidden from normal/public users. Only approved Friend Zone members can see it.
          </div>
          <div className="flex gap-2">
            <Button size="sm" onClick={save} disabled={saving}><Check className="size-4" /> {saving ? "Saving…" : "Save profile"}</Button>
            <Button size="sm" variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
          </div>
        </div>
      )}
    </Card>
  );
}

const PZ_FIELD = "mt-1 w-full rounded-lg border border-line bg-ink-900 px-3 py-2 text-sm text-mist-100 outline-none focus:border-lotus-400";

// ---- Registration / join form -------------------------------------------
function JoinForm({ joinCost, rejected, note, onDone, toast }: { joinCost: number; rejected?: boolean; note?: string; onDone: () => void; toast: (m: string, t?: "success" | "error" | "info") => void }) {
  const { user } = useAuth();
  const [realName, setRealName] = useState(user?.fullName ?? "");
  const [accountName, setAccountName] = useState(user?.username ?? "");
  const [gender, setGender] = useState<"male" | "female" | "other">("male");
  const [callInterest, setCallInterest] = useState<CallInterest>("both");
  const [doc, setDoc] = useState<{ url: string; name: string } | null>(null);
  const [uploading, setUploading] = useState(false);
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const field = "h-11 w-full rounded-xl border border-line bg-ink-800 px-3.5 text-sm text-mist-100 outline-none placeholder:text-mist-500 focus:border-lotus-400";

  const onFile = async (f: File) => {
    setUploading(true);
    const fd = new FormData(); fd.append("file", f); fd.append("kind", "paidzone");
    try {
      const res = await fetch(withBase("/api/upload"), { method: "POST", credentials: "include", body: fd });
      const d = await res.json().catch(() => ({}));
      if (res.ok) { setDoc({ url: d.url, name: d.originalName }); toast("Verification document uploaded", "success"); }
      else toast(d.error ?? "Upload failed", "error");
    } catch { toast("Upload failed", "error"); }
    setUploading(false);
  };

  const submit = async () => {
    if (!realName.trim() || !accountName.trim()) return toast("Enter your name and account name", "error");
    setBusy(true);
    const res = await submitPaidZoneRequest({ realName, accountName, gender, callInterest, docUrl: doc?.url, docName: doc?.name });
    setBusy(false);
    if (res.ok) { toast("Request submitted — waiting for admin approval", "success"); onDone(); }
    else toast(res.error ?? "Could not submit your request", "error");
  };

  const radio = (active: boolean) => cn("flex-1 rounded-xl border px-3 py-2.5 text-sm font-semibold capitalize transition", active ? "border-lotus-400 bg-lotus-500/20 text-white" : "border-line bg-ink-800 text-mist-300 hover:border-lotus-400/40");

  return (
    <Card className="p-5 sm:p-6">
      {rejected && (
        <div className="mb-4 rounded-xl border border-rose-400/20 bg-rose-500/10 p-3 text-sm text-rose-200">
          Your previous request wasn&apos;t approved{note ? `: ${note}` : ""}. You can update your details and apply again.
        </div>
      )}
      <h2 className="font-display text-lg font-bold text-mist-100">Join the Paid Zone</h2>
      <p className="mt-1 text-sm text-mist-400">Complete your registration. An admin verifies every member before access is granted.</p>

      <label className="mt-5 block text-sm font-semibold text-mist-200">Name <span className="text-mist-500">(for verification — private)</span></label>
      <input value={realName} onChange={(e) => setRealName(e.target.value)} placeholder="Your full name" className={cn(field, "mt-1.5")} maxLength={80} />

      <label className="mt-4 block text-sm font-semibold text-mist-200">Account name <span className="text-mist-500">(shown to other members)</span></label>
      <input value={accountName} onChange={(e) => setAccountName(e.target.value)} placeholder="A display name" className={cn(field, "mt-1.5")} maxLength={40} />

      <label className="mt-4 block text-sm font-semibold text-mist-200">Gender</label>
      <div className="mt-1.5 flex gap-2">
        {(["male", "female", "other"] as const).map((g) => (
          <button key={g} onClick={() => setGender(g)} className={radio(gender === g)}>{g}</button>
        ))}
      </div>

      <label className="mt-4 block text-sm font-semibold text-mist-200">Call interest <span className="text-mist-500">(shown by your name)</span></label>
      <div className="mt-1.5 flex flex-col gap-2 sm:flex-row">
        {(["audio", "video", "both"] as const).map((c) => (
          <button key={c} onClick={() => setCallInterest(c)} className={radio(callInterest === c)}>{CALL_INTEREST_LABEL[c]}</button>
        ))}
      </div>

      <label className="mt-4 block text-sm font-semibold text-mist-200">Verification document</label>
      <input ref={fileRef} type="file" accept=".pdf,.jpg,.jpeg,.png,.webp,.doc,.docx" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) onFile(f); }} />
      <button onClick={() => fileRef.current?.click()} disabled={uploading} className="mt-1.5 flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-line bg-ink-800 px-3 py-3 text-sm text-mist-300 hover:border-lotus-400/40">
        {uploading ? "Uploading…" : doc ? <><Check className="size-4 text-emerald-300" /> {doc.name}</> : <><Upload className="size-4" /> Upload ID / verification (PDF, image, doc)</>}
      </button>

      <div className="mt-5 flex items-center justify-between rounded-xl bg-ink-800 px-4 py-3">
        <span className="text-sm text-mist-300">Joining fee</span>
        <span className="inline-flex items-center gap-1.5 font-bold text-gold-300"><Coins className="size-4" /> {joinCost.toLocaleString("en-SA")} coins</span>
      </div>
      <p className="mt-1 text-[11px] text-mist-500">Coins are deducted when you submit and fully refunded if your request is rejected.</p>

      <Button block size="lg" className="mt-4" onClick={submit} disabled={busy}>
        <Gem className="size-5" /> {busy ? "Submitting…" : `Submit request · ${joinCost} coins`}
      </Button>
    </Card>
  );
}

// ---- Membership: status, monthly renewal, exit --------------------------
function MembershipCard({ state, onChange, toast }: { state: PZState; onChange: () => void; toast: (m: string, t?: "success" | "error" | "info") => void }) {
  const me = state.me!;
  const { monthlyCoins, renewalDays, autoRenew } = state.membership;
  const active = me.membershipActive !== false;
  const [busy, setBusy] = useState("");
  const [confirmExit, setConfirmExit] = useState(false);
  const renewDate = me.renewAt ? new Date(me.renewAt).toLocaleDateString("en-SA", { day: "numeric", month: "short", year: "numeric" }) : "—";

  const renew = async () => {
    setBusy("renew");
    const res = await renewPaidZone();
    setBusy("");
    if (res.ok) { toast("Membership renewed ✓", "success"); onChange(); }
    else toast(res.error ?? "Could not renew", "error");
  };
  const doExit = async () => {
    setBusy("exit");
    const res = await exitPaidZone();
    setBusy("");
    setConfirmExit(false);
    if (res.ok) { toast("You've left the Paid Zone. Your account stays active.", "info"); onChange(); }
    else toast(res.error ?? "Could not leave", "error");
  };

  return (
    <Card className="mb-4 p-4 sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-start gap-2.5">
          <span className={cn("mt-1.5 size-2.5 shrink-0 rounded-full", active ? "bg-emerald-400" : "bg-rose-400")} />
          <div>
            <p className="text-sm font-bold text-mist-100">Membership: <span className={active ? "text-emerald-300" : "text-rose-300"}>{active ? "Active" : "Inactive"}</span></p>
            <p className="text-xs text-mist-400">
              {monthlyCoins > 0
                ? active
                  ? <>Renews every {renewalDays} days for <b className="text-gold-300">{monthlyCoins} coins</b>{autoRenew ? " · auto-renew on" : ""} · next renewal <b className="text-mist-200">{renewDate}</b></>
                  : <>Renew for <b className="text-gold-300">{monthlyCoins} coins</b> to unlock the Paid Zone again.</>
                : "Free membership — no monthly fee."}
            </p>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {monthlyCoins > 0 && (
            <Button size="sm" onClick={renew} disabled={busy === "renew"}>
              <RefreshCw className="size-4" /> {busy === "renew" ? "Renewing…" : active ? "Renew now" : `Renew · ${monthlyCoins}`}
            </Button>
          )}
          <button onClick={() => setConfirmExit(true)} className="inline-flex items-center gap-1.5 rounded-full border border-line bg-ink-800 px-3.5 py-2 text-xs font-semibold text-mist-300 transition hover:text-rose-300">
            <LogOut className="size-3.5" /> Exit Paid Zone
          </button>
        </div>
      </div>
      {confirmExit && (
        <div className="mt-3 rounded-xl border border-rose-400/30 bg-rose-500/[0.08] p-3">
          <p className="text-sm text-mist-100">Leave the Paid Zone? You&apos;ll lose Paid Zone access and monthly renewals stop. Your account stays active as a normal user. (Re-joining needs a new request + admin approval.)</p>
          <div className="mt-2.5 flex gap-2">
            <Button size="sm" variant="secondary" onClick={() => setConfirmExit(false)}>Cancel</Button>
            <button onClick={doExit} disabled={busy === "exit"} className="inline-flex items-center gap-1.5 rounded-lg bg-rose-500 px-3.5 py-1.5 text-sm font-bold text-white transition hover:bg-rose-400 disabled:opacity-60">
              <LogOut className="size-4" /> {busy === "exit" ? "Leaving…" : "Yes, leave"}
            </button>
          </div>
        </div>
      )}
    </Card>
  );
}

// ---- Approved member directory ------------------------------------------
function Directory({ state, onChange, toast }: { state: PZState; onChange: () => void; toast: (m: string, t?: "success" | "error" | "info") => void }) {
  const router = useRouter();
  const { config } = useConfig();
  // Admin can turn audio and video calling on/off independently.
  const audioOn = config.paidZone?.callsEnabled !== false;
  const videoOn = config.paidZone?.videoCallsEnabled !== false;
  const [reportFor, setReportFor] = useState<PZDirectoryEntry | null>(null);
  const [calling, setCalling] = useState("");

  const call = async (m: PZDirectoryEntry, mode: "audio" | "video") => {
    setCalling(m.userId);
    const res = await startPaidZoneCall(m.userId, mode);
    setCalling("");
    if (res.ok && res.roomId) { toast(`Starting ${mode} call…`, "success"); router.push(`/rooms/${res.roomId}`); }
    else toast(res.error ?? "Could not start the call", "error");
  };
  const block = async (m: PZDirectoryEntry) => { await paidZoneBlock(m.userId, true); toast(`Blocked ${m.name}`, "info"); onChange(); };

  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <p className="text-sm font-semibold text-emerald-300">✓ You&apos;re a verified Paid Zone member</p>
        <span className="text-xs text-mist-500">{state.directory.filter((m) => m.online).length} online · {state.directory.length} member{state.directory.length === 1 ? "" : "s"}</span>
      </div>
      {state.directory.length === 0 ? (
        <Card className="p-8 text-center text-sm text-mist-400">No other members are available right now. Check back soon.</Card>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {state.directory.map((m) => {
            const interest = m.callInterest as CallInterest;
            const canAudio = (interest === "audio" || interest === "both") && audioOn;
            const canVideo = (interest === "video" || interest === "both") && videoOn;
            return (
              <Card key={m.userId} className="p-4">
                <div className="flex items-center gap-3">
                  {/* Dim the avatar/name for members who aren't active right now. */}
                  <div className={cn(!m.online && "opacity-50")}>
                    <Avatar name={m.name} src={m.avatar} size="lg" status={m.online ? "online" : "offline"} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <div className={cn("truncate font-display font-bold text-mist-100", !m.online && "opacity-60")}>{m.name}</div>
                      {m.username && <span className="shrink-0 truncate text-xs text-mist-500">@{m.username}</span>}
                      {/* Friend Zone ID beside the name — this zone uses its OWN
                          ID, deliberately separate from the login account's. */}
                      {m.fzId && <span className="shrink-0 rounded-full bg-purple-500/15 px-2 py-0.5 font-mono text-[10px] font-bold text-purple-300">{m.fzId}</span>}
                    </div>
                    <div className="mt-0.5 flex flex-wrap items-center gap-1.5">
                      {m.online ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-2 py-0.5 text-[11px] font-semibold text-emerald-300"><span className="size-1.5 rounded-full bg-emerald-400" /> Online</span>
                      ) : (
                        <span className="rounded-full bg-white/[0.05] px-2 py-0.5 text-[11px] font-semibold text-mist-500">Offline</span>
                      )}
                      <span className="rounded-full bg-white/[0.06] px-2 py-0.5 text-[11px] font-semibold text-mist-200">{GENDER_BADGE[m.gender] ?? m.gender}</span>
                      <span className="rounded-full bg-fuchsia-500/15 px-2 py-0.5 text-[11px] font-semibold text-fuchsia-200">{CALL_INTEREST_LABEL[interest]}</span>
                    </div>
                  </div>
                </div>
                {m.bio && <p className="mt-2 line-clamp-2 text-xs text-mist-400">{m.bio}</p>}
                <div className="mt-3 flex flex-wrap gap-2">
                  {canAudio && (
                    <Button size="sm" onClick={() => call(m, "audio")} disabled={calling === m.userId}><Phone className="size-4" /> Audio</Button>
                  )}
                  {canVideo && (
                    <Button size="sm" variant="secondary" onClick={() => call(m, "video")} disabled={calling === m.userId}><Video className="size-4" /> Video</Button>
                  )}
                  <button onClick={() => setReportFor(m)} title="Report" className="ml-auto grid size-9 place-items-center rounded-lg bg-ink-800 text-mist-400 hover:text-amber-300"><Flag className="size-4" /></button>
                  <button onClick={() => block(m)} title="Block" className="grid size-9 place-items-center rounded-lg bg-ink-800 text-mist-400 hover:text-rose-300"><Ban className="size-4" /></button>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {reportFor && <ReportModal member={reportFor} onClose={() => setReportFor(null)} onDone={() => { setReportFor(null); toast("Report sent to admin", "success"); }} toast={toast} />}
    </div>
  );
}

function ReportModal({ member, onClose, onDone, toast }: { member: PZDirectoryEntry; onClose: () => void; onDone: () => void; toast: (m: string, t?: "success" | "error" | "info") => void }) {
  const CATS = ["Inappropriate behavior", "Harassment", "Fake profile", "Spam / scam", "Other"];
  const [category, setCategory] = useState(CATS[0]);
  const [detail, setDetail] = useState("");
  const [busy, setBusy] = useState(false);
  const submit = async () => {
    setBusy(true);
    const res = await reportUser(member.userId, category, detail || `Reported from the Paid Zone`);
    setBusy(false);
    if (res.ok) onDone(); else toast(res.error ?? "Could not send report", "error");
  };
  return (
    <div className="fixed inset-0 z-[80] grid place-items-center bg-black/60 p-4" onClick={onClose}>
      <div className="w-full max-w-sm rounded-2xl border border-white/10 bg-ink-850 p-5" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h3 className="flex items-center gap-2 font-display text-lg font-bold text-mist-100"><Flag className="size-5 text-amber-300" /> Report {member.name}</h3>
          <button onClick={onClose} className="text-mist-400 hover:text-mist-100"><X className="size-5" /></button>
        </div>
        <label className="mt-4 block text-xs font-semibold text-mist-300">Reason</label>
        <select value={category} onChange={(e) => setCategory(e.target.value)} className="mt-1 h-10 w-full rounded-lg border border-line bg-ink-800 px-3 text-sm text-mist-100 outline-none focus:border-lotus-400">
          {CATS.map((c) => <option key={c}>{c}</option>)}
        </select>
        <label className="mt-3 block text-xs font-semibold text-mist-300">Details (optional)</label>
        <textarea value={detail} onChange={(e) => setDetail(e.target.value)} rows={3} placeholder="What happened?" className="mt-1 w-full rounded-lg border border-line bg-ink-800 p-2.5 text-sm text-mist-100 outline-none focus:border-lotus-400" maxLength={300} />
        <Button block className="mt-4" onClick={submit} disabled={busy}>{busy ? "Sending…" : "Send report"}</Button>
      </div>
    </div>
  );
}
