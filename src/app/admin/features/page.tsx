"use client";

import { useState } from "react";
import { Card } from "@/components/ui/Card";
import { useToast } from "@/components/ui/Toast";
import { useConfig, saveConfig, type AppConfig } from "@/lib/config";
import { cn } from "@/lib/cn";
import { Mic, Lock, Gem, Gift, Coins, Star, Gamepad2, ShieldCheck, UserPlus, UserCheck, MessageSquare, SlidersHorizontal, History, Building2, Film, Trophy, Swords, Ticket, Sparkles, Store, Palette, Crown, Users2, Search, Bell, Landmark, Briefcase, HardDrive, FileText, LifeBuoy, LayoutGrid } from "lucide-react";

type FeatureKey = keyof NonNullable<AppConfig["features"]>;

const FEATURES: { key: FeatureKey; label: string; desc: string; icon: typeof Mic }[] = [
  { key: "registration", label: "Registration", desc: "Allow new people to sign up for an account.", icon: UserPlus },
  { key: "voiceRooms", label: "Voice Rooms", desc: "The public voice-room area (browse, create & join rooms).", icon: Mic },
  { key: "privateRooms", label: "Private Rooms", desc: "Allow hosts to create invite-only private rooms.", icon: Lock },
  { key: "paidZone", label: "Paid Zone", desc: "The premium 1:1 private audio/video calling area.", icon: Gem },
  { key: "gifts", label: "Gift System", desc: "Sending gifts in rooms, games & profiles.", icon: Gift },
  { key: "coins", label: "Coin System", desc: "Wallet, buying coins, and spending coins.", icon: Coins },
  { key: "levels", label: "Level / XP System", desc: "Earning XP and levelling up from activity.", icon: Star },
  { key: "games", label: "Games Section", desc: "Ludo, Snake & Ladder and Chess.", icon: Gamepad2 },
  { key: "tournaments", label: "Tournaments", desc: "The Tournaments section (brackets, match rooms, prizes).", icon: Trophy },
  { key: "competitions", label: "Competitions", desc: "The Competitions (singing) section.", icon: Swords },
  { key: "coHost", label: "Host / Co-host System", desc: "Assigning co-hosts in rooms.", icon: ShieldCheck },
  { key: "chat", label: "Chat / Messages", desc: "Direct messages and in-room group chat.", icon: MessageSquare },
  { key: "business", label: "Business Module", desc: "Official business accounts, the directory & verification.", icon: Building2 },
  { key: "reels", label: "Reels", desc: "Short-video Reels: upload/record, the Reels feed, likes, comments & leaderboards.", icon: Film },
  { key: "luckyNumber", label: "Lucky Number", desc: "The Lucky Number draw — entries, results and past winners.", icon: Ticket },
];

// Every remaining section of the app. Turning one OFF removes it from the side
// menu, the phone bottom bar and the All Pages directory for every user.
const SECTIONS: { key: FeatureKey; label: string; desc: string; icon: typeof Mic }[] = [
  { key: "luckySpin", label: "Lucky Spin", desc: "The spin-the-wheel coin reward game.", icon: Sparkles },
  { key: "store", label: "Store", desc: "Buying frames, backgrounds, name effects and badges.", icon: Store },
  { key: "customize", label: "Frames & Appearance", desc: "The page where users equip frames, backgrounds and name effects.", icon: Palette },
  { key: "leaderboards", label: "Leaderboards", desc: "Top players by level, wins and coins.", icon: Crown },
  { key: "friends", label: "Friends & Followers", desc: "Friend requests, followers and the people a user follows.", icon: Users2 },
  { key: "search", label: "Search", desc: "Finding people, rooms and agencies by name or ID.", icon: Search },
  { key: "notifications", label: "Notifications", desc: "The notifications page (requests, invites, approvals, announcements).", icon: Bell },
  { key: "agencies", label: "Agency Directory", desc: "Browsing agencies and applying to join one.", icon: Landmark },
  { key: "jobs", label: "Jobs", desc: "Job posts from businesses and job applications.", icon: Briefcase },
  { key: "myStorage", label: "My Storage (user side)", desc: "The user's own storage page. Does not affect admin User Storage.", icon: HardDrive },
  { key: "documents", label: "Documents", desc: "Document submissions and admin document requests.", icon: FileText },
  { key: "support", label: "Help & Support", desc: "The support-ticket section users raise tickets from.", icon: LifeBuoy },
];

const ALL_TOGGLES = [...FEATURES, ...SECTIONS];

export default function AdminFeaturesPage() {
  const { config, reload } = useConfig();
  const { toast } = useToast();
  const [busy, setBusy] = useState<string>("");
  const [q, setQ] = useState("");
  const match = (f: { label: string; desc: string }) => {
    const s = q.trim().toLowerCase();
    return !s || f.label.toLowerCase().includes(s) || f.desc.toLowerCase().includes(s);
  };

  const features = config.features ?? {};
  const isOn = (k: FeatureKey) => features[k] !== false;
  const approvalOn = config.settings?.signupApproval !== false;

  const toggleFeature = async (k: FeatureKey, label: string) => {
    setBusy(k);
    // Start from the SAVED features, not just the ones rendered here — rebuilding
    // the object from the list alone silently dropped any key this page didn't
    // know about, which switched those modules back to their default.
    const next = {
      ...(config.features ?? {}),
      ...ALL_TOGGLES.reduce((a, f) => ({ ...a, [f.key]: isOn(f.key) }), {}),
      [k]: !isOn(k),
    };
    const res = await saveConfig({ features: next as AppConfig["features"] });
    setBusy("");
    if (res.ok) { await reload(); toast(`${label} turned ${!isOn(k) ? "ON" : "OFF"}`, "success"); }
    else toast(res.error ?? "Could not save", "error");
  };

  const toggleApproval = async () => {
    setBusy("approval");
    const res = await saveConfig({ settings: { ...config.settings, signupApproval: !approvalOn } });
    setBusy("");
    if (res.ok) { await reload(); toast(`New-user approval turned ${!approvalOn ? "ON" : "OFF"}`, "success"); }
    else toast(res.error ?? "Could not save", "error");
  };

  // Primary-group deletion approval (default ON = users must ask admin to delete their first group).
  const gdApprovalOn = config.settings?.primaryGroupDeleteApproval !== false;
  const toggleGdApproval = async () => {
    setBusy("gdApproval");
    const res = await saveConfig({ settings: { ...config.settings, primaryGroupDeleteApproval: !gdApprovalOn } });
    setBusy("");
    if (res.ok) { await reload(); toast(`Primary-group deletion approval turned ${!gdApprovalOn ? "ON" : "OFF"}`, "success"); }
    else toast(res.error ?? "Could not save", "error");
  };

  // Agency user approval (default OFF = agency-created accounts activate immediately).
  const agencyApprovalOn = config.settings?.agencyUserApproval === true;
  const toggleAgencyApproval = async () => {
    setBusy("agencyApproval");
    const res = await saveConfig({ settings: { ...config.settings, agencyUserApproval: !agencyApprovalOn } });
    setBusy("");
    if (res.ok) { await reload(); toast(`Agency user approval turned ${!agencyApprovalOn ? "ON" : "OFF"}`, "success"); }
    else toast(res.error ?? "Could not save", "error");
  };

  // Game coins (default OFF = games never charge/award coins).
  const gameCoinsOn = config.settings?.gameCoinsEnabled === true;
  const toggleGameCoins = async () => {
    setBusy("gameCoins");
    const res = await saveConfig({ settings: { ...config.settings, gameCoinsEnabled: !gameCoinsOn } });
    setBusy("");
    if (res.ok) { await reload(); toast(`Game coins turned ${!gameCoinsOn ? "ON" : "OFF"}`, "success"); }
    else toast(res.error ?? "Could not save", "error");
  };

  const Switch = ({ on, onClick, disabled }: { on: boolean; onClick: () => void; disabled: boolean }) => (
    <button onClick={onClick} disabled={disabled} className={cn("relative h-7 w-12 shrink-0 rounded-full transition disabled:opacity-50", on ? "bg-emerald-500" : "bg-ink-700")} aria-pressed={on}>
      <span className={cn("absolute top-0.5 size-6 rounded-full bg-white shadow transition-all", on ? "left-[22px]" : "left-0.5")} />
    </button>
  );

  const Row = ({ icon: Icon, label, desc, on, onToggle, busyKey, note }: { icon: typeof Mic; label: string; desc: string; on: boolean; onToggle: () => void; busyKey: string; note?: string }) => (
    <div className="flex items-center gap-4 p-4">
      <span className={cn("grid size-11 shrink-0 place-items-center rounded-2xl", on ? "bg-lotus-500/15 text-lotus-300" : "bg-ink-800 text-mist-500")}><Icon className="size-5" /></span>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-semibold text-mist-100">{label}</span>
          <span className={cn("rounded-full px-2 py-0.5 text-[11px] font-bold", on ? "bg-emerald-500/15 text-emerald-300" : "bg-rose-500/15 text-rose-300")}>{on ? "Active" : "Disabled"}</span>
        </div>
        <p className="text-xs text-mist-400">{note ?? desc}</p>
      </div>
      <Switch on={on} onClick={onToggle} disabled={busy === busyKey} />
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 font-display text-2xl font-extrabold text-mist-100"><SlidersHorizontal className="size-6 text-lotus-300" /> Feature Management</h1>
          <p className="text-sm text-mist-400">Turn any feature ON or OFF — changes apply instantly across the whole app. Disabling a feature hides it for users and blocks its actions. Every change is saved to the admin history.</p>
        </div>
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search a feature…"
          className="w-60 rounded-lg border border-line bg-ink-800 px-3 py-2 text-sm text-mist-100 outline-none placeholder:text-mist-500 focus:border-lotus-400/60"
        />
      </div>

      <Card className="divide-y divide-white/5 p-0">
        {/* New-user approval (special — lives in settings) */}
        <Row icon={UserPlus} label="New-user Joining Approval" desc="" note={approvalOn ? "ON: new sign-ups wait for admin approval before they can use the app." : "OFF: new sign-ups are auto-approved and can enter immediately."} on={approvalOn} onToggle={toggleApproval} busyKey="approval" />
        {/* Primary-group deletion approval */}
        <Row icon={ShieldCheck} label="Primary Group Deletion Approval" desc="" note={gdApprovalOn ? "ON: users must request admin approval to delete their first (primary) group." : "OFF: users can delete their first group directly."} on={gdApprovalOn} onToggle={toggleGdApproval} busyKey="gdApproval" />
        <Row icon={UserCheck} label="Agency User Approval" desc="" note={agencyApprovalOn ? "ON: an account created by an agency stays Pending — the user can't log in until an admin approves it (Agencies → Agency User Approvals)." : "OFF: agency-created accounts activate immediately (direct activation)."} on={agencyApprovalOn} onToggle={toggleAgencyApproval} busyKey="agencyApproval" />
        {/* Game coins */}
        <Row icon={Coins} label="Game Coins" desc="" note={gameCoinsOn ? "ON: games can charge coins to start (per-game cost)." : "OFF: games never use, deduct or award coins — game play never affects coin balances."} on={gameCoinsOn} onToggle={toggleGameCoins} busyKey="gameCoins" />
        {FEATURES.filter(match).map((f) => (
          <Row key={f.key} icon={f.icon} label={f.label} desc={f.desc} on={isOn(f.key)} onToggle={() => toggleFeature(f.key, f.label)} busyKey={f.key} />
        ))}
      </Card>

      {/* Every other section of the app — same switch, same instant effect. */}
      <div>
        <h2 className="mb-2 flex items-center gap-2 font-display text-lg font-bold text-mist-100"><LayoutGrid className="size-5 text-lotus-300" /> App Sections</h2>
        <p className="mb-3 text-sm text-mist-400">Switch any section of the app off and it disappears from the side menu, the phone bottom bar and the All Pages directory for every user.</p>
        <Card className="divide-y divide-white/5 p-0">
          {SECTIONS.filter(match).map((f) => (
            <Row key={f.key} icon={f.icon} label={f.label} desc={f.desc} on={isOn(f.key)} onToggle={() => toggleFeature(f.key, f.label)} busyKey={f.key} />
          ))}
          {!SECTIONS.filter(match).length && <p className="p-6 text-center text-sm text-mist-500">No sections match “{q}”.</p>}
        </Card>
      </div>

      <p className="flex items-center gap-1.5 text-xs text-mist-500"><History className="size-3.5" /> Every ON/OFF change is recorded in the admin audit log (who changed what, and when).</p>
    </div>
  );
}
