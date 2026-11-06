"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth";
import { withBase } from "@/lib/base-path";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import { cn } from "@/lib/cn";
import { ShieldCheck, ArrowLeft, Lock, Globe, MessageSquare, Eye, Clock, Check, CheckCheck, Users } from "lucide-react";
import type { ProfileVisibility, WhoCanMessage } from "@/lib/types";

const MESSAGE_MODES: { v: WhoCanMessage; label: string; hint: string }[] = [
  { v: "everyone", label: "Everyone", hint: "Anyone can message you." },
  { v: "followers", label: "Followers only", hint: "Only people who follow you can message you." },
  { v: "following", label: "People you follow", hint: "Only people you follow can message you." },
  { v: "friends", label: "Friends only", hint: "Only your friends can message you." },
  { v: "nobody", label: "Nobody", hint: "No one can start a new message with you." },
];

export default function ProfilePrivacyPage() {
  const { user, updateUser } = useAuth();
  const { toast } = useToast();
  const router = useRouter();
  const [visibility, setVisibility] = useState<ProfileVisibility>("public");
  const [whoCanMessage, setWhoCanMessage] = useState<WhoCanMessage>("everyone");
  const [hideOnline, setHideOnline] = useState(false);
  const [hideLastSeen, setHideLastSeen] = useState(false);
  const [hideReceipts, setHideReceipts] = useState(false);
  const [hideFollowers, setHideFollowers] = useState(false);
  const [hideFollowing, setHideFollowing] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const p = user?.privacy ?? {};
    setVisibility(p.profileVisibility ?? "public");
    setWhoCanMessage(p.whoCanMessage ?? "everyone");
    setHideOnline(p.hideOnlineStatus === true);
    setHideLastSeen(p.hideLastSeen === true);
    setHideReceipts(p.hideReadReceipts === true);
    setHideFollowers(p.hideFollowersList === true);
    setHideFollowing(p.hideFollowingList === true);
  }, [user?.privacy]);

  if (!user) return null;

  const save = async () => {
    setSaving(true);
    const privacy = {
      profileVisibility: visibility, whoCanMessage,
      hideOnlineStatus: hideOnline, hideLastSeen,
      hideReadReceipts: hideReceipts, hideFollowersList: hideFollowers, hideFollowingList: hideFollowing,
    };
    try {
      const res = await fetch(withBase("/api/users/me"), {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ privacy }),
      });
      if (res.ok) { updateUser({ privacy }); toast("Privacy settings saved.", "success"); }
      else toast("Could not save settings", "error");
    } catch { toast("Could not save settings", "error"); }
    setSaving(false);
  };

  return (
    <div className="mx-auto max-w-2xl space-y-5 pb-24">
      <div className="flex items-center gap-3">
        <button onClick={() => router.back()} className="grid size-9 place-items-center rounded-lg text-mist-300 hover:bg-white/[0.06] hover:text-mist-100"><ArrowLeft className="size-5" /></button>
        <div>
          <h1 className="flex items-center gap-2 font-display text-2xl font-extrabold text-mist-100"><ShieldCheck className="size-6 text-lotus-300" /> Privacy &amp; Security</h1>
          <p className="text-sm text-mist-400">Control who can see your profile and message you.</p>
        </div>
      </div>

      {/* Profile visibility */}
      <Card className="p-4 sm:p-5">
        <h2 className="mb-1 font-display text-lg font-bold text-mist-100">Profile visibility</h2>
        <p className="mb-3 text-sm text-mist-400">Who can see your full profile, posts and activity.</p>
        <div className="grid gap-2 sm:grid-cols-2">
          <button
            onClick={() => setVisibility("public")}
            className={cn("flex items-start gap-3 rounded-xl border p-3 text-left transition", visibility === "public" ? "border-lotus-400 bg-lotus-500/10" : "border-line bg-ink-800 hover:bg-white/[0.06]")}
          >
            <Globe className={cn("size-5 shrink-0", visibility === "public" ? "text-lotus-300" : "text-mist-400")} />
            <div>
              <div className="text-sm font-semibold text-mist-100">Public</div>
              <div className="text-xs text-mist-500">Anyone can view your profile and it shows in search.</div>
            </div>
          </button>
          <button
            onClick={() => setVisibility("private")}
            className={cn("flex items-start gap-3 rounded-xl border p-3 text-left transition", visibility === "private" ? "border-lotus-400 bg-lotus-500/10" : "border-line bg-ink-800 hover:bg-white/[0.06]")}
          >
            <Lock className={cn("size-5 shrink-0", visibility === "private" ? "text-lotus-300" : "text-mist-400")} />
            <div>
              <div className="text-sm font-semibold text-mist-100">Private</div>
              <div className="text-xs text-mist-500">Only people you follow back see your full profile. Others see a &ldquo;Private Account&rdquo; card + a Follow button.</div>
            </div>
          </button>
        </div>
      </Card>

      {/* Who can message me */}
      <Card className="p-4 sm:p-5">
        <h2 className="mb-1 flex items-center gap-2 font-display text-lg font-bold text-mist-100"><MessageSquare className="size-5 text-lotus-300" /> Who can message me</h2>
        <p className="mb-3 text-sm text-mist-400">Choose who is allowed to start a chat with you.</p>
        <div className="space-y-1.5">
          {MESSAGE_MODES.map((m) => (
            <button
              key={m.v}
              onClick={() => setWhoCanMessage(m.v)}
              className={cn("flex w-full items-center gap-3 rounded-xl border p-3 text-left transition", whoCanMessage === m.v ? "border-lotus-400 bg-lotus-500/10" : "border-line bg-ink-800 hover:bg-white/[0.06]")}
            >
              <span className={cn("grid size-5 shrink-0 place-items-center rounded-full border", whoCanMessage === m.v ? "border-lotus-400 bg-lotus-500 text-white" : "border-mist-500")}>{whoCanMessage === m.v && <Check className="size-3.5" />}</span>
              <div>
                <div className="text-sm font-semibold text-mist-100">{m.label}</div>
                <div className="text-xs text-mist-500">{m.hint}</div>
              </div>
            </button>
          ))}
        </div>
      </Card>

      {/* Activity privacy */}
      <Card className="p-4 sm:p-5">
        <h2 className="mb-1 font-display text-lg font-bold text-mist-100">Activity</h2>
        <Row icon={Eye} label="Hide my online status" hint="Others won't see the green 'online' dot on your profile or in chat." on={hideOnline} onChange={setHideOnline} />
        <Row icon={Clock} label="Hide my last seen" hint="Others won't see when you were last active." on={hideLastSeen} onChange={setHideLastSeen} />
        <Row icon={CheckCheck} label="Hide read receipts" hint="Others won't see when you've read their messages (the blue double-tick)." on={hideReceipts} onChange={setHideReceipts} />
      </Card>

      {/* Connection lists */}
      <Card className="p-4 sm:p-5">
        <h2 className="mb-1 font-display text-lg font-bold text-mist-100">Connection lists</h2>
        <Row icon={Users} label="Hide my followers list" hint="Others can still see the count, but can't open the list of who follows you." on={hideFollowers} onChange={setHideFollowers} />
        <Row icon={Users} label="Hide my following list" hint="Others can still see the count, but can't open the list of who you follow." on={hideFollowing} onChange={setHideFollowing} />
      </Card>

      <p className="text-center text-xs text-mist-500">The follow-request approval inbox and two-step verification are coming in the next updates.</p>

      {/* Sticky save */}
      <div className="fixed inset-x-0 bottom-0 z-20 border-t border-line bg-ink-900/95 px-4 py-3 backdrop-blur">
        <div className="mx-auto flex max-w-2xl items-center justify-between gap-3">
          <span className="text-xs text-mist-400">These apply the moment you save.</span>
          <Button onClick={save} disabled={saving}><Check className="size-4" /> {saving ? "Saving…" : "Save settings"}</Button>
        </div>
      </div>
    </div>
  );
}

function Row({ icon: Icon, label, hint, on, onChange }: {
  icon: typeof Eye; label: string; hint: string; on: boolean; onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-center gap-3 border-t border-line/60 py-3 first:border-t-0">
      <Icon className="size-5 shrink-0 text-mist-400" />
      <div className="min-w-0 flex-1">
        <div className="text-sm font-semibold text-mist-100">{label}</div>
        <div className="text-xs text-mist-500">{hint}</div>
      </div>
      <button
        onClick={() => onChange(!on)}
        role="switch"
        aria-checked={on}
        className={cn("relative h-6 w-11 shrink-0 rounded-full transition", on ? "bg-emerald-500" : "bg-mist-600")}
      >
        <span className={cn("absolute top-0.5 size-5 rounded-full bg-white shadow transition-all", on ? "left-[22px]" : "left-0.5")} />
      </button>
    </div>
  );
}
