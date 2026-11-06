"use client";

import { useEffect, useState, type ComponentType } from "react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import { useConfig, saveConfig } from "@/lib/config";
import { cn } from "@/lib/cn";
import { ShieldCheck, Check, Eye, MessageSquare, UserCheck, Power, Lock } from "lucide-react";

type Privacy = {
  enabled: boolean;
  mutualFollowToView: boolean;
  dmLimitEnabled: boolean;
  maxUnansweredDMs: number;
  unlockOnFollow: boolean;
};
type LoginSec = { enabled: boolean; maxAttempts: number; lockoutMinutes: number };

const DEFAULTS: Privacy = {
  enabled: true, mutualFollowToView: false,
  dmLimitEnabled: false, maxUnansweredDMs: 4, unlockOnFollow: true,
};
const LS_DEFAULTS: LoginSec = { enabled: true, maxAttempts: 5, lockoutMinutes: 15 };
const LOCK_PRESETS = [1, 5, 10, 15, 30, 60];

export default function AdminPrivacyPage() {
  const { config, loading, reload } = useConfig();
  const { toast } = useToast();
  const [p, setP] = useState<Privacy>(DEFAULTS);
  const [ls, setLs] = useState<LoginSec>(LS_DEFAULTS);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (loading) return;
    const c = config.privacy ?? {};
    setP({
      enabled: c.enabled !== false,
      mutualFollowToView: c.mutualFollowToView === true,
      dmLimitEnabled: c.dmLimitEnabled === true,
      maxUnansweredDMs: c.maxUnansweredDMs ?? 4,
      unlockOnFollow: c.unlockOnFollow !== false,
    });
    const s = config.loginSecurity ?? {};
    setLs({ enabled: s.enabled !== false, maxAttempts: s.maxAttempts ?? 5, lockoutMinutes: s.lockoutMinutes ?? 15 });
  }, [loading, config]);

  const save = async () => {
    setSaving(true);
    const res = await saveConfig({ privacy: p, loginSecurity: ls });
    setSaving(false);
    if (res.ok) { await reload(); toast("Privacy, messaging & login settings saved — live for all users.", "success"); }
    else toast(res.error ?? "Could not save", "error");
  };

  return (
    <div className="mx-auto max-w-3xl space-y-5 pb-24">
      <div>
        <h1 className="flex items-center gap-2 font-display text-2xl font-extrabold text-mist-100">
          <ShieldCheck className="size-6 text-lotus-300" /> Privacy &amp; Messaging
        </h1>
        <p className="mt-1 text-sm text-mist-400">
          Control who can view profiles and how many messages a user can send before the other person replies.
          These improve privacy and cut spam. Everything is OFF by default — nothing changes until you turn it on.
        </p>
      </div>

      {/* Master switch */}
      <Card className="p-4 sm:p-5">
        <Toggle
          icon={Power}
          label="Privacy & messaging restrictions"
          hint="Master switch. Off = none of the rules below apply, no matter their own settings."
          on={p.enabled}
          onChange={(v) => setP({ ...p, enabled: v })}
        />
      </Card>

      {/* Profile privacy */}
      <Card className={cn("p-4 sm:p-5 transition", !p.enabled && "opacity-60")}>
        <h2 className="mb-1 flex items-center gap-2 font-display text-lg font-bold text-mist-100">
          <Eye className="size-5 text-lotus-300" /> Profile privacy
        </h2>
        <Toggle
          icon={UserCheck}
          label="Only mutual followers can view a full profile"
          hint="A user's profile details, reels, videos and activity are shown only to people they follow BACK. Others see just the name + a Follow button. Admins and the user themselves always see everything."
          on={p.mutualFollowToView}
          onChange={(v) => setP({ ...p, mutualFollowToView: v })}
          disabled={!p.enabled}
        />
      </Card>

      {/* Message limit */}
      <Card className={cn("p-4 sm:p-5 transition", !p.enabled && "opacity-60")}>
        <h2 className="mb-1 flex items-center gap-2 font-display text-lg font-bold text-mist-100">
          <MessageSquare className="size-5 text-lotus-300" /> Private message limit
        </h2>
        <p className="mb-1 text-sm text-mist-400">Stops one user flooding another who hasn&apos;t replied.</p>
        <Toggle
          icon={MessageSquare}
          label="Limit unanswered messages"
          hint="After the limit, the sender can't send more until the other person replies (or follows them, if set below)."
          on={p.dmLimitEnabled}
          onChange={(v) => setP({ ...p, dmLimitEnabled: v })}
          disabled={!p.enabled}
        />
        {p.enabled && p.dmLimitEnabled && (
          <>
            <div className="flex flex-wrap items-center justify-between gap-2 border-t border-line/60 py-3 pl-8">
              <div className="min-w-0">
                <span className="text-xs font-semibold text-mist-300">Maximum unanswered messages</span>
                <p className="text-xs text-mist-500">How many messages in a row before the sender is paused.</p>
              </div>
              <input
                type="number" min={1} max={50} value={p.maxUnansweredDMs}
                onChange={(e) => setP({ ...p, maxUnansweredDMs: Math.max(1, Math.min(50, Number(e.target.value) || 1)) })}
                className="h-9 w-20 rounded-lg border border-line bg-ink-800 px-2 text-sm font-semibold text-mist-100 outline-none focus:border-lotus-400"
              />
            </div>
            <Toggle
              icon={UserCheck}
              label="A follow-back also unlocks more messages"
              hint="On = the sender can continue if the recipient FOLLOWS them (not only when they reply). Off = only a reply unlocks."
              on={p.unlockOnFollow}
              onChange={(v) => setP({ ...p, unlockOnFollow: v })}
              disabled={!p.enabled}
            />
          </>
        )}
      </Card>

      {/* Login attempt limit / lockout */}
      <Card className="p-4 sm:p-5">
        <h2 className="mb-1 flex items-center gap-2 font-display text-lg font-bold text-mist-100">
          <Lock className="size-5 text-lotus-300" /> Login attempt limit
        </h2>
        <p className="mb-1 text-sm text-mist-400">
          Locks an account for a while after too many wrong passwords (&ldquo;Too many failed attempts. Try again in N minutes.&rdquo;).
          You can clear any member&apos;s lock instantly from <b className="text-mist-300">Users → the member → Reset login lock</b>.
        </p>
        <Toggle
          icon={Lock}
          label="Lock accounts after too many failed logins"
          hint="Off = wrong passwords are never locked out (only rejected). On = an account is temporarily locked after the number of tries below."
          on={ls.enabled}
          onChange={(v) => setLs({ ...ls, enabled: v })}
        />
        {ls.enabled && (
          <>
            <div className="flex flex-wrap items-center justify-between gap-2 border-t border-line/60 py-3 pl-8">
              <div className="min-w-0">
                <span className="text-xs font-semibold text-mist-300">Wrong attempts before lock</span>
                <p className="text-xs text-mist-500">How many failed logins in a row trigger the lock.</p>
              </div>
              <input
                type="number" min={1} max={50} value={ls.maxAttempts}
                onChange={(e) => setLs({ ...ls, maxAttempts: Math.max(1, Math.min(50, Number(e.target.value) || 1)) })}
                className="h-9 w-20 rounded-lg border border-line bg-ink-800 px-2 text-sm font-semibold text-mist-100 outline-none focus:border-lotus-400"
              />
            </div>
            <div className="border-t border-line/60 py-3 pl-8">
              <span className="text-xs font-semibold text-mist-300">Lockout duration</span>
              <p className="mb-2 text-xs text-mist-500">How long the account stays locked. Pick a preset or type any value (minutes).</p>
              <div className="flex flex-wrap items-center gap-1.5">
                {LOCK_PRESETS.map((m) => (
                  <button
                    key={m}
                    onClick={() => setLs({ ...ls, lockoutMinutes: m })}
                    className={cn("rounded-lg px-3 py-1.5 text-xs font-semibold transition", ls.lockoutMinutes === m ? "bg-lotus-500 text-white" : "bg-ink-800 text-mist-300 hover:bg-white/[0.06]")}
                  >
                    {m} min
                  </button>
                ))}
                <span className="ml-1 flex items-center gap-1.5 text-xs text-mist-400">
                  Custom
                  <input
                    type="number" min={1} max={1440} value={ls.lockoutMinutes}
                    onChange={(e) => setLs({ ...ls, lockoutMinutes: Math.max(1, Math.min(1440, Number(e.target.value) || 1)) })}
                    className="h-9 w-20 rounded-lg border border-line bg-ink-800 px-2 text-sm font-semibold text-mist-100 outline-none focus:border-lotus-400"
                  />
                  min
                </span>
              </div>
            </div>
          </>
        )}
      </Card>

      {/* Sticky save */}
      <div className="fixed inset-x-0 bottom-0 z-20 border-t border-line bg-ink-900/95 px-4 py-3 backdrop-blur">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-3">
          <span className="text-xs text-mist-400">Changes apply to every user after you save.</span>
          <Button onClick={save} disabled={saving}><Check className="size-4" /> {saving ? "Saving…" : "Save changes"}</Button>
        </div>
      </div>
    </div>
  );
}

function Toggle({ icon: Icon, label, hint, on, onChange, disabled }: {
  icon: ComponentType<{ className?: string }>; label: string; hint: string; on: boolean; onChange: (v: boolean) => void; disabled?: boolean;
}) {
  return (
    <div className={cn("flex items-center gap-3 border-t border-line/60 py-3 first:border-t-0", disabled && "opacity-60")}>
      <Icon className="size-5 shrink-0 text-mist-400" />
      <div className="min-w-0 flex-1">
        <div className="text-sm font-semibold text-mist-100">{label}</div>
        <div className="text-xs text-mist-500">{hint}</div>
      </div>
      <button
        onClick={() => !disabled && onChange(!on)}
        role="switch"
        aria-checked={on}
        disabled={disabled}
        title={on ? "On — tap to turn off" : "Off — tap to turn on"}
        className={cn("relative h-6 w-11 shrink-0 rounded-full transition", on ? "bg-emerald-500" : "bg-mist-600", disabled && "cursor-not-allowed")}
      >
        <span className={cn("absolute top-0.5 size-5 rounded-full bg-white shadow transition-all", on ? "left-[22px]" : "left-0.5")} />
      </button>
    </div>
  );
}
