"use client";

import { useEffect, useRef, useState } from "react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import { useConfig, saveConfig, type AppConfig } from "@/lib/config";
import { ChangePasswordCard } from "@/components/security/ChangePasswordCard";
import { LivekitSettingsCard } from "@/components/admin/LivekitSettingsCard";
import { SmsOtpSettingsCard } from "@/components/admin/SmsOtpSettingsCard";
import { RazorpaySettingsCard } from "@/components/admin/RazorpaySettingsCard";
import { DuplicateNamesCard } from "@/components/admin/DuplicateNamesCard";
import { cn } from "@/lib/cn";
import { Check, Megaphone, ShieldCheck } from "lucide-react";

type SettingKey = keyof AppConfig["settings"];
type PermKey = keyof AppConfig["permissions"];

const SWITCHES: { id: SettingKey; label: string; desc: string; danger?: boolean }[] = [
  { id: "signups", label: "Allow new sign-ups", desc: "Let new users register on the platform." },
  { id: "otp", label: "Require OTP verification", desc: "Verify phone numbers with a one-time code at login." },
  { id: "roomCreation", label: "Allow members to create rooms", desc: "Members can host their own voice rooms." },
  { id: "gifts", label: "In-game gifts", desc: "Enable sending coin gifts during games." },
  { id: "maintenance", label: "Maintenance mode", desc: "Temporarily take the app offline for everyone except admins.", danger: true },
];

const PERMS: { id: PermKey; label: string; desc: string }[] = [
  { id: "coHostCanMute", label: "Co-Hosts can mute members", desc: "Allow co-hosts to mute/unmute people in the room." },
  { id: "coHostCanRemove", label: "Co-Hosts can remove members", desc: "Allow co-hosts to remove members from the room." },
  { id: "memberCanInvite", label: "Members can invite to games", desc: "Let ordinary members send game invitations." },
  { id: "memberCanGift", label: "Members can send gifts", desc: "Let members send coin gifts to others." },
];

export default function AdminSettingsPage() {
  const { config, loading, reload } = useConfig();
  const { toast } = useToast();

  const [appName, setAppName] = useState(config.appName);
  const [announcement, setAnnouncement] = useState(config.announcement);
  const [settings, setSettings] = useState(config.settings);
  const [permissions, setPermissions] = useState(config.permissions);
  const [googleClientId, setGoogleClientId] = useState(config.googleClientId ?? "");
  const [androidFingerprint, setAndroidFingerprint] = useState(config.androidFingerprint ?? "");
  const [saving, setSaving] = useState(false);
  const [savingGoogle, setSavingGoogle] = useState(false);
  const [savingAndroid, setSavingAndroid] = useState(false);

  // Sync local form state from the server config, field by field: only a field
  // whose SAVED value changed is overwritten. The Google card saves on its own
  // and reloads config, which must not wipe unsaved edits in the other fields.
  const lastSynced = useRef<AppConfig | null>(null);
  useEffect(() => {
    if (loading) return;
    const prev = lastSynced.current;
    lastSynced.current = config;
    const changed = <T,>(a: T, b: T) => JSON.stringify(a) !== JSON.stringify(b);
    if (!prev || changed(prev.appName, config.appName)) setAppName(config.appName);
    if (!prev || changed(prev.announcement, config.announcement)) setAnnouncement(config.announcement);
    if (!prev || changed(prev.settings, config.settings)) setSettings(config.settings);
    if (!prev || changed(prev.permissions, config.permissions)) setPermissions(config.permissions);
    if (!prev || changed(prev.googleClientId, config.googleClientId)) setGoogleClientId(config.googleClientId ?? "");
    if (!prev || changed(prev.androidFingerprint, config.androidFingerprint)) setAndroidFingerprint(config.androidFingerprint ?? "");
  }, [loading, config]);

  const flip = (id: SettingKey) => setSettings((s) => ({ ...s, [id]: !s[id] }));
  const flipPerm = (id: PermKey) => setPermissions((p) => ({ ...p, [id]: !p[id] }));

  const save = async () => {
    setSaving(true);
    const res = await saveConfig({ appName, announcement, settings, permissions });
    setSaving(false);
    if (!res.ok) {
      toast(res.error ?? "Could not save", "error");
      return;
    }
    await reload();
    toast("Platform settings saved", "success");
  };

  const GOOGLE_SUFFIX = ".apps.googleusercontent.com";
  const googleInput = googleClientId.trim();
  const googleSaved = (config.googleClientId ?? "").trim();
  const googleInvalid = googleInput !== "" && !googleInput.endsWith(GOOGLE_SUFFIX);
  const googleDirty = googleInput !== googleSaved;

  const saveGoogle = async () => {
    setSavingGoogle(true);
    const res = await saveConfig({ googleClientId: googleInput });
    setSavingGoogle(false);
    if (!res.ok) {
      toast(res.error ?? "Could not save the Client ID", "error");
      return;
    }
    await reload();
    toast(googleInput ? "Google Client ID saved — the Google button is now on the login page" : "Google Client ID removed — the Google button is hidden", "success");
  };

  const androidInput = androidFingerprint.trim();
  const androidSaved = (config.androidFingerprint ?? "").trim();
  const androidHex = androidInput.replace(/[^0-9a-fA-F]/g, "");
  const androidInvalid = androidInput !== "" && androidHex.length !== 64;
  const androidDirty = androidInput !== androidSaved;

  const saveAndroid = async () => {
    setSavingAndroid(true);
    const res = await saveConfig({ androidFingerprint: androidInput });
    setSavingAndroid(false);
    if (!res.ok) {
      toast(res.error ?? "Could not save the fingerprint", "error");
      return;
    }
    await reload();
    toast(androidInput ? "SHA-256 fingerprint saved — the address bar will disappear from the Android app" : "SHA-256 fingerprint removed — the Android app will show a browser bar", "success");
  };

  const field = "h-11 w-full rounded-xl border border-line bg-ink-800 px-3.5 text-sm text-mist-100 outline-none focus:border-lotus-400";

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-extrabold text-mist-100">Platform settings</h1>
        <p className="text-sm text-mist-400">System-wide configuration, announcements and feature switches.</p>
      </div>

      <Card className="p-5">
        <h2 className="font-semibold text-mist-100">General</h2>
        <label className="mt-4 block text-sm font-semibold text-mist-200">App name</label>
        <input value={appName} onChange={(e) => setAppName(e.target.value)} className={cn(field, "mt-1.5")} />
        <label className="mt-4 flex items-center gap-1.5 text-sm font-semibold text-mist-200">
          <Megaphone className="size-4 text-petal-400" /> Global announcement
        </label>
        <input
          value={announcement}
          onChange={(e) => setAnnouncement(e.target.value)}
          placeholder="Shown as a banner to all users (leave blank for none)"
          className={cn(field, "mt-1.5")}
        />
        <p className="mt-1.5 text-xs text-mist-500">This appears as a banner at the top of the app for every member.</p>
      </Card>

      <DuplicateNamesCard />

      {/* Google Sign-In — the PUBLIC OAuth Client ID; the login page's Google
          button appears the moment this is saved (live config, no rebuild). */}
      <Card className="p-5">
        <h2 className="font-semibold text-mist-100">Google Sign-In</h2>

        {/* WHAT IT IS, in plain words. The client asked "I am not understand" —
            the old text jumped straight into OAuth jargon. Explain the purpose
            and the consequence of leaving it blank BEFORE showing the field. */}
        <div className="mt-2 rounded-xl border border-sky-400/25 bg-sky-500/[0.07] p-3 text-xs leading-relaxed text-mist-300">
          <p className="font-semibold text-mist-100">What is this setting for?</p>
          <p className="mt-1">
            It adds a <b className="text-mist-100">&ldquo;Continue with Google&rdquo;</b> button to the login page,
            so people can sign in with the Google account they already have instead of creating a new
            username and password.
          </p>
          <p className="mt-2">
            <b className="text-mist-100">Do I have to fill this in?</b> No. This box is completely optional.
            If you leave it empty, everything keeps working exactly as it does today — people simply sign in
            with a username and password, or with a mobile number. Nothing breaks.
          </p>
          <p className="mt-2">
            <b className="text-mist-100">What is a &ldquo;Client ID&rdquo;?</b> It is a long code that Google gives you,
            free of charge, so Google knows that lotusplay.tech is really yours. It is not a password and it is
            not secret — it is safe to paste here. It looks like this:
          </p>
          <p className="mt-1 break-all font-mono text-[11px] text-mist-400">
            1234567890-abc123def456.apps.googleusercontent.com
          </p>
        </div>

        <label className="mt-4 block text-xs font-semibold text-mist-300">
          Paste the Client ID here (or leave it empty)
        </label>
        <input
          value={googleClientId}
          onChange={(e) => setGoogleClientId(e.target.value)}
          placeholder="Leave empty to hide the Google button"
          className={cn(field, "mt-1.5 font-mono text-xs")}
        />
        {googleInvalid && (
          <p className="mt-1.5 text-xs text-amber-300">
            ⚠ This does not look right. A Google Client ID always ends in
            <b> .apps.googleusercontent.com</b> — please copy it again from Google.
          </p>
        )}

        <div className="mt-3 flex flex-wrap items-center gap-2">
          <Button onClick={saveGoogle} disabled={loading || savingGoogle || !googleDirty || googleInvalid}>
            <Check className="size-4" /> {savingGoogle ? "Saving…" : googleInput || !googleSaved ? "Save Client ID" : "Remove Client ID"}
          </Button>
          {googleDirty && (
            <Button variant="ghost" onClick={() => setGoogleClientId(googleSaved)} disabled={savingGoogle}>
              Cancel
            </Button>
          )}
        </div>

        {/* Status reflects what is SAVED on the server, not what is typed in the box. */}
        <p className={cn("mt-2 text-xs", googleDirty ? "text-amber-300" : googleSaved ? "text-emerald-300" : "text-mist-500")}>
          {googleDirty
            ? "Not saved yet — press “Save Client ID” to apply this change."
            : googleSaved
              ? "✓ Saved — the “Continue with Google” button is shown on the login page."
              : "The “Continue with Google” button is currently hidden. That is fine — this setting is optional."}
        </p>

        <div className="mt-4 rounded-xl border border-line bg-ink-800/60 p-3 text-xs leading-relaxed text-mist-400">
          <p className="font-semibold text-mist-200">If you DO want the Google button, here is how to get the code</p>
          <p className="mt-0.5 text-mist-500">
            One time only, about 5 minutes, no payment. You need a Google account (any Gmail account works).
          </p>
          <ol className="mt-2 space-y-2.5 pl-0">
            <li className="flex gap-2.5">
              <span className="grid size-5 shrink-0 place-items-center rounded-full bg-lotus-500/20 text-[11px] font-bold text-lotus-200">1</span>
              <span>
                Go to <a href="https://console.cloud.google.com/apis/credentials" target="_blank" rel="noreferrer" className="font-semibold text-lotus-300 underline">console.cloud.google.com/apis/credentials</a> and
                sign in with your Google account.
              </span>
            </li>
            <li className="flex gap-2.5">
              <span className="grid size-5 shrink-0 place-items-center rounded-full bg-lotus-500/20 text-[11px] font-bold text-lotus-200">2</span>
              <span>
                If it asks you to create a project first, click <b className="text-mist-200">New Project</b>, give it any
                name (for example <i>Lotus</i>) and click <b className="text-mist-200">Create</b>.
              </span>
            </li>
            <li className="flex gap-2.5">
              <span className="grid size-5 shrink-0 place-items-center rounded-full bg-lotus-500/20 text-[11px] font-bold text-lotus-200">3</span>
              <span>
                Click <b className="text-mist-200">+ Create Credentials</b> at the top, then choose
                <b className="text-mist-200"> OAuth client ID</b>.
              </span>
            </li>
            <li className="flex gap-2.5">
              <span className="grid size-5 shrink-0 place-items-center rounded-full bg-lotus-500/20 text-[11px] font-bold text-lotus-200">4</span>
              <span>
                For <b className="text-mist-200">Application type</b> choose <b className="text-mist-200">Web application</b>.
              </span>
            </li>
            <li className="flex gap-2.5">
              <span className="grid size-5 shrink-0 place-items-center rounded-full bg-lotus-500/20 text-[11px] font-bold text-lotus-200">5</span>
              <span>
                Under <b className="text-mist-200">Authorised JavaScript origins</b> click <b className="text-mist-200">Add URI</b> and
                paste exactly:
                <span className="mt-1 block break-all rounded-lg border border-line bg-ink-900 px-2 py-1 font-mono text-[11px] text-mist-200">https://lotusplay.tech</span>
              </span>
            </li>
            <li className="flex gap-2.5">
              <span className="grid size-5 shrink-0 place-items-center rounded-full bg-lotus-500/20 text-[11px] font-bold text-lotus-200">6</span>
              <span>
                Click <b className="text-mist-200">Create</b>. Google shows a box with a
                <b className="text-mist-200"> Client ID</b> and a <b className="text-mist-200">Client secret</b>.
                Copy the <b className="text-mist-200">Client ID</b> only — you do <b>not</b> need the secret.
              </span>
            </li>
            <li className="flex gap-2.5">
              <span className="grid size-5 shrink-0 place-items-center rounded-full bg-lotus-500/20 text-[11px] font-bold text-lotus-200">7</span>
              <span>
                Paste it into the box above and press <b className="text-mist-200">Save Client ID</b>. The Google button appears
                on the login page straight away — no app update needed.
              </span>
            </li>
          </ol>
          <p className="mt-3 border-t border-line pt-2 text-mist-500">
            <b className="text-mist-300">Important:</b> the project must be created under <b>your own</b> Google
            account, not a developer&apos;s, so the sign-in always stays under your control.
          </p>
        </div>
      </Card>

      {/* Has its own Save button: it holds a secret, so it is saved through
          /api/admin/livekit rather than the main "Save settings" below. */}
      <LivekitSettingsCard />

      {/* Has its own Save button: it holds a secret, so it is saved through
          /api/admin/sms rather than the main "Save settings" below. */}
      <SmsOtpSettingsCard />

      {/* Same pattern as LiveKit: holds a secret, so it saves via /api/admin/razorpay. */}
      <RazorpaySettingsCard />

      {/* ANDROID APP LINK. The one value that decides whether the Play Store app
          opens like an app or like a website in a frame. It cannot be set before
          the first upload to Play (Google generates it), so it is a live setting
          rather than something baked into a build. */}
      <Card className="p-5">
        <h2 className="font-semibold text-mist-100">Android app (Play Store)</h2>

        <div className="mt-2 rounded-xl border border-emerald-400/25 bg-emerald-500/[0.07] p-3 text-xs leading-relaxed text-mist-300">
          <p className="font-semibold text-mist-100">What is this setting for?</p>
          <p className="mt-1">
            It removes the <b className="text-mist-100">browser address bar</b> from the top of the Android app.
            Without it the app still works, but it looks like a website inside a frame instead of a real app.
          </p>
          <p className="mt-2">
            <b className="text-mist-100">When do I fill this in?</b> Only <i>after</i> you have uploaded the app to
            Google Play for the first time. Google creates this code for you — it does not exist before that.
          </p>
          <p className="mt-2">
            <b className="text-mist-100">Is it secret?</b> No. It is a public code, safe to paste here.
          </p>
        </div>

        <label className="mt-4 block text-xs font-semibold text-mist-300">
          Paste the SHA-256 certificate fingerprint from Google Play
        </label>
        <input
          value={androidFingerprint}
          onChange={(e) => setAndroidFingerprint(e.target.value)}
          placeholder="AB:CD:EF:12:…  (leave empty until the app is on Play)"
          className={cn(field, "mt-1.5 font-mono text-xs")}
        />
        {androidInvalid && (
          <p className="mt-1.5 text-xs text-amber-300">
            ⚠ This does not look right — a SHA-256 fingerprint has exactly 64 letters/numbers
            (you have {androidHex.length}). Copy the whole line from Google Play and paste it again.
          </p>
        )}

        <div className="mt-3 flex flex-wrap items-center gap-2">
          <Button onClick={saveAndroid} disabled={loading || savingAndroid || !androidDirty || androidInvalid}>
            <Check className="size-4" /> {savingAndroid ? "Saving…" : androidInput || !androidSaved ? "Save fingerprint" : "Remove fingerprint"}
          </Button>
          {androidDirty && (
            <Button variant="ghost" onClick={() => setAndroidFingerprint(androidSaved)} disabled={savingAndroid}>
              Cancel
            </Button>
          )}
        </div>

        {/* Status reflects what is SAVED on the server, not what is typed in the box. */}
        <p className={cn("mt-2 text-xs", androidDirty ? "text-amber-300" : androidSaved ? "text-emerald-300" : "text-mist-500")}>
          {androidDirty
            ? "Not saved yet — press “Save fingerprint” to apply this change."
            : androidSaved
              ? "✓ Saved — the address bar disappears for anyone who installs or reopens the app (it can take a few minutes)."
              : "Not set yet. The app will show a browser bar at the top until this is filled in."}
        </p>

        <div className="mt-4 rounded-xl border border-line bg-ink-800/60 p-3 text-xs leading-relaxed text-mist-400">
          <p className="font-semibold text-mist-200">Where to find this code</p>
          <ol className="mt-2 space-y-2.5 pl-0">
            <li className="flex gap-2.5">
              <span className="grid size-5 shrink-0 place-items-center rounded-full bg-lotus-500/20 text-[11px] font-bold text-lotus-200">1</span>
              <span>Open <a href="https://play.google.com/console" target="_blank" rel="noreferrer" className="font-semibold text-lotus-300 underline">play.google.com/console</a> and choose your app.</span>
            </li>
            <li className="flex gap-2.5">
              <span className="grid size-5 shrink-0 place-items-center rounded-full bg-lotus-500/20 text-[11px] font-bold text-lotus-200">2</span>
              <span>In the left menu go to <b className="text-mist-200">Test and release → Setup → App integrity</b>.</span>
            </li>
            <li className="flex gap-2.5">
              <span className="grid size-5 shrink-0 place-items-center rounded-full bg-lotus-500/20 text-[11px] font-bold text-lotus-200">3</span>
              <span>Open the <b className="text-mist-200">App signing</b> tab.</span>
            </li>
            <li className="flex gap-2.5">
              <span className="grid size-5 shrink-0 place-items-center rounded-full bg-lotus-500/20 text-[11px] font-bold text-lotus-200">4</span>
              <span>
                Under <b className="text-mist-200">App signing key certificate</b>, copy the long
                <b className="text-mist-200"> SHA-256 certificate fingerprint</b>, paste it above and press
                <b className="text-mist-200"> Save fingerprint</b>.
              </span>
            </li>
          </ol>
          <p className="mt-3 border-t border-line pt-2 text-mist-500">
            Use the one under <b className="text-mist-300">App signing key certificate</b> — not the
            &ldquo;upload key certificate&rdquo; just below it. The app package is
            <span className="mx-1 rounded bg-ink-900 px-1.5 py-0.5 font-mono text-[11px] text-mist-300">com.lotusplay.app</span>
            and can never change.
          </p>
        </div>
      </Card>

      <Card className="p-5">
        <h2 className="font-semibold text-mist-100">Feature switches</h2>
        <div className="mt-4 space-y-2">
          {SWITCHES.map((t) => (
            <div key={t.id} className="flex items-center gap-3 rounded-xl border border-line bg-ink-800 px-3 py-2.5">
              <div className="min-w-0 flex-1">
                <div className="text-sm font-semibold text-mist-100">{t.label}</div>
                <div className="text-xs text-mist-400">{t.desc}</div>
              </div>
              <button
                onClick={() => flip(t.id)}
                disabled={loading}
                className={cn(
                  "relative h-6 w-11 shrink-0 rounded-full transition-colors disabled:opacity-50",
                  settings[t.id] ? (t.danger ? "bg-rose-500" : "bg-emerald-500") : "bg-ink-700",
                )}
                aria-label={`Toggle ${t.label}`}
              >
                <span className={cn("absolute top-0.5 size-5 rounded-full bg-white transition-all", settings[t.id] ? "left-[22px]" : "left-0.5")} />
              </button>
            </div>
          ))}
        </div>
      </Card>

      <Card className="p-5">
        <h2 className="font-semibold text-mist-100">Permissions</h2>
        <p className="text-xs text-mist-400">Control what co-hosts and members are allowed to do.</p>
        <div className="mt-4 space-y-2">
          {PERMS.map((t) => (
            <div key={t.id} className="flex items-center gap-3 rounded-xl border border-line bg-ink-800 px-3 py-2.5">
              <div className="min-w-0 flex-1">
                <div className="text-sm font-semibold text-mist-100">{t.label}</div>
                <div className="text-xs text-mist-400">{t.desc}</div>
              </div>
              <button
                onClick={() => flipPerm(t.id)}
                disabled={loading}
                className={cn(
                  "relative h-6 w-11 shrink-0 rounded-full transition-colors disabled:opacity-50",
                  permissions[t.id] ? "bg-emerald-500" : "bg-ink-700",
                )}
                aria-label={`Toggle ${t.label}`}
              >
                <span className={cn("absolute top-0.5 size-5 rounded-full bg-white transition-all", permissions[t.id] ? "left-[22px]" : "left-0.5")} />
              </button>
            </div>
          ))}
        </div>
      </Card>

      <Button size="lg" onClick={save} disabled={saving || loading}>
        <Check className="size-4" /> {saving ? "Saving…" : "Save settings"}
      </Button>

      {/* ===== Security — admin's own password ===== */}
      <div className="border-t border-white/10 pt-6">
        <h2 className="mb-3 flex items-center gap-2 font-display text-lg font-extrabold text-mist-100"><ShieldCheck className="size-5 text-lotus-300" /> My account security</h2>
        <ChangePasswordCard />
      </div>
    </div>
  );
}
