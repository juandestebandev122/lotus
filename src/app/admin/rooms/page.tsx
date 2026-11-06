"use client";

import { useEffect, useRef, useState } from "react";
import { fileToDataUrl } from "@/lib/image";
import { Card } from "@/components/ui/Card";
import { Avatar } from "@/components/ui/Avatar";
import { Badge, LiveDot } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { useToast } from "@/components/ui/Toast";
import { useConfig, saveConfig, type AppConfig } from "@/lib/config";
import {
  fetchAdminRooms,
  deleteAdminRoom,
  createAdminRoom,
  updateAdminRoom,
  setAdminRoomStatus,
  fetchAdminUsers,
  adminResetRoomSection,
  type AdminRoom,
  type AdminUser,
  type RoomResetSection,
} from "@/lib/admin";
import { cn } from "@/lib/cn";
import { GroupReportModal } from "@/components/admin/GroupReportModal";
import { Trash2, Users2, Lock, ShieldCheck, Crown, Mic, Video, Check, Plus, Settings, X, UserPlus, Power, CalendarClock, SlidersHorizontal, ScrollText, Eye, EyeOff, Search, RotateCcw, Loader2, AlertTriangle, ListFilter, Info, Radio } from "lucide-react";
import { fetchRoomEvents, type RoomEventView } from "@/lib/rooms";

const ROOM_TYPES = ["public", "private", "community", "password"] as const;
const CATEGORIES = ["Friendship", "Music", "Gaming", "Just Chatting", "Study", "Comedy", "Sports", "Tech"];

export default function AdminRoomsPage() {
  const { config, loading: cfgLoading, reload } = useConfig();
  const { toast } = useToast();
  const [rooms, setRooms] = useState<AdminRoom[]>([]);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [editRoom, setEditRoom] = useState<AdminRoom | null>(null);
  const [actionRoom, setActionRoom] = useState<AdminRoom | null>(null);
  const [confirmDeleteRoom, setConfirmDeleteRoom] = useState<AdminRoom | null>(null);
  const [reportRoom, setReportRoom] = useState<AdminRoom | null>(null); // Full group report
  const [resetRoom, setResetRoom] = useState<AdminRoom | null>(null); // Reset controls
  const [query, setQuery] = useState("");

  const reloadRooms = () => fetchAdminRooms().then(setRooms);

  // Active/Inactive here means REAL occupancy right now, not the admin on/off
  // status — that is the distinction the old indicator was missing.
  const [liveFilter, setLiveFilter] = useState<"all" | "active" | "inactive">("all");
  const [activityRoom, setActivityRoom] = useState<AdminRoom | null>(null);
  const isRoomActive = (r: AdminRoom) => (r.occupants ?? 0) > 0;
  const liveCount = rooms.filter(isRoomActive).length;

  // Real time: re-poll while the tab is visible so the dots update themselves.
  useEffect(() => {
    const t = setInterval(() => { if (typeof document === "undefined" || !document.hidden) void reloadRooms(); }, 10000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // DEEP LINK from inside a group: /admin/rooms?room=<id>&open=activity|manage|
  // actions|report|reset. The Options menu in a voice room sends an admin
  // straight to the right panel for that group, so these controls no longer
  // exist only on this page. Runs once, after the room list has loaded.
  const deepLinkedRef = useRef(false);
  useEffect(() => {
    if (deepLinkedRef.current || rooms.length === 0) return;
    const p = new URLSearchParams(window.location.search);
    const id = p.get("room");
    const which = p.get("open");
    if (!id || !which) return;
    const room = rooms.find((r) => r.id === id);
    if (!room) return;
    deepLinkedRef.current = true;
    if (which === "activity") setActivityRoom(room);
    else if (which === "manage") setEditRoom(room);
    else if (which === "actions") setActionRoom(room);
    else if (which === "report") setReportRoom(room);
    else if (which === "reset") setResetRoom(room);
    // Show only that group, so it is obvious which one the panel belongs to,
    // and drop the query string so a refresh doesn't reopen it.
    setQuery(room.id);
    window.history.replaceState(null, "", window.location.pathname);
  }, [rooms]);

  const shownRooms = rooms.filter((r) => {
    if (liveFilter === "active" && !isRoomActive(r)) return false;
    if (liveFilter === "inactive" && isRoomActive(r)) return false;
    const s = query.trim().toLowerCase();
    return !s || `${r.name} ${r.hostName} ${r.id} ${r.category}`.toLowerCase().includes(s);
  });

  // Local copy of room controls so edits feel instant before saving.
  const [voice, setVoice] = useState(config.roomControls.voiceEnabled);
  const [video, setVideo] = useState(config.roomControls.videoEnabled);
  const [defaultSeats, setDefaultSeats] = useState(config.roomControls.defaultSeats);
  const [maxSeats, setMaxSeats] = useState(config.roomControls.maxSeats);
  const [crown, setCrown] = useState(config.roomControls.showHostCrown !== false);
  const [seatGear, setSeatGear] = useState(config.roomControls.showSeatGear !== false);
  const [coHostStar, setCoHostStar] = useState(config.roomControls.showCoHostStar !== false);
  const [coHostLimit, setCoHostLimit] = useState(config.coHostLimit ?? 3);
  const [savingControls, setSavingControls] = useState(false);
  // ROOM LIST VISIBILITY — which rooms are listed in the Voice Rooms browse list.
  type RoomListCfg = NonNullable<AppConfig["roomList"]>;
  const RL_DEF: RoomListCfg = { mode: "all", hideOffline: false, requireHost: false, requireCoHost: false, requireMember: false, minLive: 0, alwaysShowMine: true, adminSeesAll: true, showActive: true, showInactive: true };
  const [rl, setRl] = useState<RoomListCfg>(RL_DEF);
  const [savingRl, setSavingRl] = useState(false);

  useEffect(() => {
    fetchAdminRooms().then((r) => {
      setRooms(r);
      setLoading(false);
    });
    fetchAdminUsers().then(setUsers);
  }, []);

  const userName = (id: string) => users.find((u) => u.id === id)?.fullName ?? id;

  useEffect(() => {
    if (!cfgLoading) {
      setVoice(config.roomControls.voiceEnabled);
      setVideo(config.roomControls.videoEnabled);
      setDefaultSeats(config.roomControls.defaultSeats);
      setMaxSeats(config.roomControls.maxSeats);
      setCrown(config.roomControls.showHostCrown !== false);
      setCoHostLimit(config.coHostLimit ?? 3);
      setRl({ ...RL_DEF, ...(config.roomList ?? {}) });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cfgLoading, config]);

  const saveRoomList = async () => {
    setSavingRl(true);
    const res = await saveConfig({ roomList: rl });
    setSavingRl(false);
    if (res.ok) { await reload(); toast("Room list visibility saved — applies to everyone's list.", "success"); }
    else toast(res.error ?? "Could not save", "error");
  };

  const remove = async (id: string, name: string) => {
    setRooms((r) => r.filter((x) => x.id !== id));
    const okRes = await deleteAdminRoom(id);
    toast(okRes ? `Room “${name}” removed` : "Could not remove room", okRes ? "success" : "error");
    if (!okRes) fetchAdminRooms().then(setRooms);
  };

  const saveControls = async () => {
    setSavingControls(true);
    const res = await saveConfig({
      roomControls: {
        voiceEnabled: voice,
        videoEnabled: video,
        defaultSeats: Math.min(Math.max(2, defaultSeats), 50),
        maxSeats: Math.min(Math.max(2, maxSeats), 50),
        showHostCrown: crown,
        showSeatGear: seatGear,
        showCoHostStar: coHostStar,
      },
      coHostLimit: Math.min(Math.max(0, coHostLimit), 20),
    });
    setSavingControls(false);
    if (res.ok) {
      await reload();
      toast("Room & seat controls saved", "success");
    } else {
      toast(res.error ?? "Could not save", "error");
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-extrabold text-mist-100">Group &amp; room management</h1>
          <p className="text-sm text-mist-400">Create, edit &amp; delete groups; manage hosts, co-hosts, members &amp; controls.</p>
        </div>
        <Button onClick={() => setCreateOpen(true)}>
          <Plus className="size-4" /> Create group
        </Button>
      </div>

      {/* Voice / Video + Seat controls */}
      <Card className="p-5">
        <h2 className="font-semibold text-mist-100">Voice, video &amp; seat controls</h2>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <Toggle icon={Mic} label="Voice rooms enabled" desc="Allow audio rooms across the platform." on={voice} onClick={() => setVoice((v) => !v)} />
          <Toggle icon={Video} label="Video rooms enabled" desc="Allow hosts to share video in rooms." on={video} onClick={() => setVideo((v) => !v)} />
          <Toggle icon={Crown} label="Show host crown badge" desc="The 👑 crown on the host's avatar. Off = hide it on every room's host frame." on={crown} onClick={() => setCrown((v) => !v)} />
          <Toggle icon={Settings} label="Show Settings symbol on seats" desc="The ⚙ hint on a seat you can manage. Off hides the symbol only — tapping the seat still opens the manage menu." on={seatGear} onClick={() => setSeatGear((v) => !v)} />
          <Toggle icon={ShieldCheck} label="Show Co-Host star badge" desc="The ★ marking a co-host on their seat. Off = hide it; the person is still a co-host with all their powers." on={coHostStar} onClick={() => setCoHostStar((v) => !v)} />
          <SeatInput label="Default seats per room" value={defaultSeats} onChange={setDefaultSeats} />
          <SeatInput label="Maximum seats (host may raise to)" value={maxSeats} onChange={setMaxSeats} />
          {/* How many co-hosts a host may assign per room */}
          <div className="flex items-center gap-3 rounded-xl border border-line bg-ink-800 px-3 py-2.5">
            <div className="min-w-0 flex-1 text-sm font-semibold text-mist-100">Maximum co-hosts per room</div>
            <input
              type="number"
              min={0}
              max={20}
              value={coHostLimit}
              onChange={(e) => setCoHostLimit(Math.min(20, Math.max(0, Number(e.target.value) || 0)))}
              className="h-9 w-16 rounded-lg border border-line bg-ink-900 px-2 text-center text-sm text-mist-100 outline-none focus:border-lotus-400"
            />
          </div>
        </div>
        <Button className="mt-4" onClick={saveControls} disabled={savingControls || cfgLoading}>
          <Check className="size-4" /> {savingControls ? "Saving…" : "Save controls"}
        </Button>
        <p className="mt-2 text-xs text-mist-500">Seats can be set up to 50 per room. A host may assign up to {coHostLimit} co-host{coHostLimit === 1 ? "" : "s"}.</p>
      </Card>

      {/* ── ROOM / GROUP LIST VISIBILITY ── */}
      <Card className="p-4 sm:p-5">
        <h2 className="flex items-center gap-2 font-display text-lg font-bold text-mist-100">
          <ListFilter className="size-5 text-lotus-300" /> Room list visibility
        </h2>
        <p className="mt-0.5 text-sm text-mist-400">
          Choose which groups appear in the <b className="text-mist-200">Voice Rooms</b> list. Your choice applies to
          every user&apos;s list, consistently.
        </p>
        <div className="mt-2 flex items-start gap-2 rounded-lg border border-sky-400/25 bg-sky-500/[0.06] px-3 py-2 text-[11px] text-mist-300">
          <Info className="mt-0.5 size-3.5 shrink-0 text-sky-300" />
          <p>
            <b className="text-mist-100">This only changes what is LISTED.</b> A group that isn&apos;t shown keeps working
            exactly as before — its members can still open it, invites and direct links still work, and the host keeps
            every control. Nothing about the room itself is affected.
          </p>
        </div>

        {/* Modes */}
        <div className="mt-4 grid gap-2 sm:grid-cols-2">
          {([
            { id: "all", label: "Show All Groups", desc: "Every group is listed. This is the default." },
            { id: "hostOnline", label: "Host Available Groups", desc: "Only groups whose host is currently in the room." },
            { id: "coHostOnline", label: "Co-host Available Groups", desc: "Only groups with a co-host currently in the room." },
            { id: "memberOnline", label: "Member Available Groups", desc: "Only groups with a member currently in the room." },
            { id: "custom", label: "Custom / As Required", desc: "Build your own rule from the switches below." },
          ] as const).map((m) => (
            <button
              key={m.id}
              onClick={() => setRl((s) => ({ ...s, mode: m.id }))}
              className={cn(
                "rounded-xl border p-3 text-left transition",
                rl.mode === m.id ? "border-lotus-400/60 bg-lotus-500/15" : "border-line bg-ink-900 hover:border-mist-600",
              )}
            >
              <div className="flex items-center gap-2">
                <span className={cn("grid size-4 shrink-0 place-items-center rounded-full border", rl.mode === m.id ? "border-lotus-300 bg-lotus-400" : "border-mist-600")}>
                  {rl.mode === m.id && <Check className="size-3 text-ink-950" />}
                </span>
                <span className="text-sm font-semibold text-mist-100">{m.label}</span>
              </div>
              <div className="mt-0.5 pl-6 text-[11px] leading-snug text-mist-500">{m.desc}</div>
            </button>
          ))}
        </div>

        {/* Always-available switches */}
        <div className="mt-4 divide-y divide-line/60 border-t border-line/60">
          <RlToggle
            label="Hide Offline Groups"
            desc="Hide any group with nobody in it right now. Works with every mode above."
            on={rl.hideOffline === true}
            onToggle={() => setRl((s) => ({ ...s, hideOffline: !s.hideOffline }))}
          />
          <RlToggle
            label="Always show a user's own groups"
            desc="A member never loses sight of a group they host or have already joined, whatever the rule above says. Strongly recommended."
            on={rl.alwaysShowMine !== false}
            onToggle={() => setRl((s) => ({ ...s, alwaysShowMine: s.alwaysShowMine === false }))}
          />
          <RlToggle
            label="Administrators see every group"
            desc="Admins bypass the filter so they can always monitor and manage all rooms."
            on={rl.adminSeesAll !== false}
            onToggle={() => setRl((s) => ({ ...s, adminSeesAll: s.adminSeesAll === false }))}
          />
        </div>

        {/* ACTIVE / INACTIVE browse options on the members' Voice Rooms screen.
            These add a way to BROWSE — unlike the rules above, they never hide a
            room from the list. */}
        <div className="mt-4 rounded-xl border border-emerald-400/25 bg-emerald-500/[0.05] p-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-emerald-200">Active / Inactive room options</p>
          <p className="mb-1 mt-0.5 text-[11px] text-mist-400">
            Buttons on the members&rsquo; Voice Rooms screen for browsing rooms that have people in
            them right now, and rooms that are empty. Switching one off only removes that button —
            no room is ever hidden by these.
          </p>
          <div className="divide-y divide-line/60">
            <RlToggle
              label="Show “Active Voice Rooms”"
              desc="Members can list only the rooms somebody is in right now."
              on={rl.showActive !== false}
              onToggle={() => setRl((s) => ({ ...s, showActive: s.showActive === false }))}
            />
            <RlToggle
              label="Show “Inactive Voice Rooms”"
              desc="Members can list only the rooms that are empty at the moment."
              on={rl.showInactive !== false}
              onToggle={() => setRl((s) => ({ ...s, showInactive: s.showInactive === false }))}
            />
          </div>
        </div>

        {/* Custom rule builder */}
        {rl.mode === "custom" && (
          <div className="mt-4 rounded-xl border border-lotus-400/25 bg-lotus-500/[0.05] p-3">
            <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-lotus-200">Custom rule</p>
            <p className="mb-2 text-[11px] text-mist-400">A group is listed only when <b>all</b> the requirements you switch on are met.</p>
            <div className="divide-y divide-line/60">
              <RlToggle label="Host must be available" desc="The room's host is currently in the room." on={rl.requireHost === true} onToggle={() => setRl((s) => ({ ...s, requireHost: !s.requireHost }))} />
              <RlToggle label="Co-host must be available" desc="At least one co-host is currently in the room." on={rl.requireCoHost === true} onToggle={() => setRl((s) => ({ ...s, requireCoHost: !s.requireCoHost }))} />
              <RlToggle label="Member must be available" desc="At least one ordinary member (not the host or a co-host) is in the room." on={rl.requireMember === true} onToggle={() => setRl((s) => ({ ...s, requireMember: !s.requireMember }))} />
            </div>
            <label className="mt-3 flex flex-wrap items-center gap-3">
              <span className="text-sm font-semibold text-mist-200">Minimum people in the room</span>
              <input
                type="number" min={0} max={50} value={rl.minLive ?? 0}
                onChange={(e) => setRl((s) => ({ ...s, minLive: Math.max(0, Math.min(50, Number(e.target.value) || 0)) }))}
                className="h-9 w-20 rounded-lg border border-line bg-ink-900 px-2 text-center text-sm text-mist-100 outline-none focus:border-lotus-400"
              />
              <span className="text-xs text-mist-500">0 = no minimum</span>
            </label>
          </div>
        )}

        <div className="mt-4 flex flex-wrap items-center gap-3">
          <Button onClick={saveRoomList} disabled={savingRl || cfgLoading}>
            <Check className="size-4" /> {savingRl ? "Saving…" : "Save room list visibility"}
          </Button>
          <button onClick={() => setRl(RL_DEF)} className="text-sm font-semibold text-mist-400 transition hover:text-mist-100">
            Reset to &ldquo;Show All Groups&rdquo;
          </button>
        </div>
        <div className="mt-3 flex items-start gap-2 rounded-lg border border-amber-400/25 bg-amber-500/[0.06] px-3 py-2 text-[11px] text-mist-300">
          <Info className="mt-0.5 size-3.5 shrink-0 text-amber-300" />
          <p>
            <b className="text-amber-200">Where to check it:</b> this rule applies to the <b className="text-mist-100">members&apos;</b> Voice
            Rooms list. The <b className="text-mist-100">Active rooms</b> list further down this page is the management list and always shows
            every room, so you never lose access to one. To see it as a member does, use <b className="text-mist-100">View as user</b> —
            admins normally bypass the rule (the &ldquo;Administrators see every group&rdquo; switch above), and that bypass is dropped while you preview.
          </p>
        </div>
      </Card>

      {/* Rooms list with host & co-host info */}
      <div>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-semibold text-mist-100">
            All rooms {!loading && <span className="font-normal text-mist-500">({shownRooms.length} of {rooms.length})</span>}
            <span className="ml-2 text-xs font-normal text-emerald-300">{liveCount} active now</span>
          </h2>
          <div className="flex flex-wrap items-center gap-2">
            {/* Active / Inactive filter — Active means somebody is IN the room
                right now, not the admin on/off status. */}
            <div className="flex overflow-hidden rounded-lg border border-line text-xs">
              {([["all", `All (${rooms.length})`], ["active", `Active (${liveCount})`], ["inactive", `Inactive (${rooms.length - liveCount})`]] as const).map(([k, label]) => (
                <button key={k} onClick={() => setLiveFilter(k)} className={cn("px-3 py-2 font-semibold transition", liveFilter === k ? "bg-lotus-600 text-white" : "text-mist-300 hover:bg-white/[0.05]")}>{label}</button>
              ))}
            </div>
            <div className="flex items-center gap-2 rounded-lg border border-line bg-ink-800 px-2.5">
              <Search className="size-4 text-mist-500" />
              <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search by room name, host, ID or category…" className="h-9 w-64 max-w-[60vw] bg-transparent text-sm text-mist-100 outline-none placeholder:text-mist-500" />
              {query && <button onClick={() => setQuery("")} className="text-mist-500 hover:text-mist-200"><X className="size-4" /></button>}
            </div>
          </div>
        </div>
        {/* The list used to be locked to three columns, so searching for one
            group left it alone on the left with two empty columns beside it —
            a big blank area that looked like something had failed to load. The
            columns now follow how many groups are actually being shown: one
            result fills the row, and a wide screen fits more than three. */}
        <div className="grid gap-4 [grid-template-columns:repeat(auto-fit,minmax(19rem,1fr))]">
          {shownRooms.map((room) => (
            <Card key={room.id} className="p-5">
              <div className="flex items-start justify-between">
                <Badge tone="lotus">{room.category}</Badge>
                <RoomStatusBadge room={room} />
              </div>
              <h3 className="mt-3 flex items-center gap-1.5 font-display font-bold text-mist-100">
                {(room.type === "password" || room.type === "private") && <Lock className="size-3.5 text-mist-400" />}
                {room.name}
              </h3>
              {room.status === "suspended" && room.suspendReason && (
                <p className="mt-1 text-xs text-amber-300/80">Reason: {room.suspendReason}</p>
              )}
              <div className="mt-3 flex items-center gap-3">
                <Avatar name={room.hostName} size="sm" />
                <div className="min-w-0">
                  <div className="flex items-center gap-1 text-xs text-mist-500">
                    <Crown className="size-3 text-gold-400" /> Host
                  </div>
                  <div className="truncate text-sm font-medium text-mist-100">{room.hostName}</div>
                </div>
              </div>
              <div className="mt-4 flex flex-wrap items-center gap-3 text-xs text-mist-400">
                <span className="flex items-center gap-1"><Users2 className="size-3.5" /> {room.capacity} seats</span>
                <span className="flex items-center gap-1"><ShieldCheck className="size-3.5 text-lotus-300" /> {room.coAdminCount} co-host{room.coAdminCount === 1 ? "" : "s"}</span>
                {room.type === "private" && <span>· {room.invitedCount} invited</span>}
              </div>
              {/* Five actions squeezed onto one line left each button barely
                  wider than its icon. They now wrap onto a second line when the
                  card is narrow, and never stretch past a comfortable width when
                  it is wide, so the labels are always readable. */}
              <div className="mt-4 flex flex-wrap gap-2 [&>*]:min-w-[6.5rem] [&>*]:max-w-[12rem] [&>*]:flex-1">
                <Button size="sm" variant="secondary" onClick={() => setActivityRoom(room)} title="Who joined and who left — without entering the room">
                  <Radio className="size-4" /> Activity
                </Button>
                <Button size="sm" variant="secondary" onClick={() => setEditRoom(room)}>
                  <Settings className="size-4" /> Manage
                </Button>
                <Button size="sm" variant="secondary" onClick={() => setActionRoom(room)}>
                  <SlidersHorizontal className="size-4" /> Actions
                </Button>
                <Button size="sm" variant="secondary" onClick={() => setReportRoom(room)} title="Full group report — owner, admins, members, blocks, reports, gifts, features">
                  <ScrollText className="size-4" /> Report
                </Button>
                <Button size="sm" variant="secondary" onClick={() => setResetRoom(room)} title="Reset controls — reset this room's settings / stuck game (per-room, isolated)">
                  <RotateCcw className="size-4" /> Reset
                </Button>
              </div>
            </Card>
          ))}
          {!loading && shownRooms.length === 0 && (
            <Card className="p-10 text-center text-sm text-mist-500 sm:col-span-2 lg:col-span-3">
              {rooms.length === 0 ? "No rooms have been created yet." : `No rooms match “${query.trim()}”.`}
            </Card>
          )}
        </div>
      </div>

      {reportRoom && <GroupReportModal roomId={reportRoom.id} onClose={() => setReportRoom(null)} />}
      {resetRoom && <ResetControlsModal room={resetRoom} onClose={() => setResetRoom(null)} />}
      {activityRoom && <RoomActivityModal room={rooms.find((r) => r.id === activityRoom.id) ?? activityRoom} onClose={() => setActivityRoom(null)} />}

      {createOpen && (
        <CreateGroupModal
          onClose={() => setCreateOpen(false)}
          onCreated={async () => {
            setCreateOpen(false);
            await reloadRooms();
            toast("Group created", "success");
          }}
        />
      )}

      {editRoom && (
        <EditGroupModal
          room={editRoom}
          users={users}
          userName={userName}
          onClose={() => setEditRoom(null)}
          onSaved={async () => {
            setEditRoom(null);
            await reloadRooms();
            toast("Group updated", "success");
          }}
        />
      )}

      {actionRoom && (
        <RoomActionModal
          room={actionRoom}
          onClose={() => setActionRoom(null)}
          onDelete={() => {
            setConfirmDeleteRoom(actionRoom);
            setActionRoom(null);
          }}
          onStatus={async (status, opts) => {
            const ok = await setAdminRoomStatus(actionRoom.id, status, opts);
            if (ok) {
              setActionRoom(null);
              await reloadRooms();
              const label = status === "active" ? "reactivated" : status === "inactive" ? "made inactive" : "suspended";
              toast(`Room ${label}`, "success");
            } else {
              toast("Could not update room status", "error");
            }
          }}
        />
      )}

      {confirmDeleteRoom && (
        <ConfirmDialog
          danger
          title="Are you sure you want to delete this room?"
          message="This action cannot be undone."
          confirmLabel="Delete"
          cancelLabel="Cancel"
          onConfirm={async () => {
            const room = confirmDeleteRoom;
            setConfirmDeleteRoom(null);
            await remove(room.id, room.name);
          }}
          onCancel={() => setConfirmDeleteRoom(null)}
        />
      )}
    </div>
  );
}

// ---------- Room activity, WITHOUT entering the room ----------
// The admin asked to see who joined and who left each room from the panel
// itself. Reads the same activity log the room screen shows, plus the live
// occupancy from the rooms API, and refreshes itself every 8 seconds.
function RoomActivityModal({ room, onClose }: { room: AdminRoom; onClose: () => void }) {
  const [events, setEvents] = useState<RoomEventView[] | null>(null);
  const [showAll, setShowAll] = useState(false);

  useEffect(() => {
    let stop = false;
    const pull = () => { void fetchRoomEvents(room.id).then((list) => { if (!stop) setEvents(list); }); };
    pull();
    const t = setInterval(() => { if (typeof document === "undefined" || !document.hidden) pull(); }, 8000);
    return () => { stop = true; clearInterval(t); };
  }, [room.id]);

  const joinLeave = (events ?? []).filter((e) => e.type === "join" || e.type === "leave");
  const shown = showAll ? (events ?? []) : joinLeave;
  const time = (iso: string) => { try { return new Date(iso).toLocaleString("en-SA", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }); } catch { return ""; } };

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/70 p-4" onClick={onClose}>
      <Card className="max-h-[85vh] w-full max-w-lg overflow-hidden p-0" onClick={(e: React.MouseEvent) => e.stopPropagation()}>
        <div className="flex items-start justify-between gap-3 border-b border-line p-4">
          <div className="min-w-0">
            <h3 className="truncate font-display font-bold text-mist-100">{room.name}</h3>
            <p className="text-[11px] text-mist-500">Room activity — live, without joining the room</p>
          </div>
          <button onClick={onClose} className="shrink-0 rounded-lg p-1 text-mist-400 hover:bg-white/[0.06] hover:text-mist-100"><X className="size-5" /></button>
        </div>

        <div className="grid grid-cols-3 gap-2 p-4">
          <div className="rounded-xl border border-line bg-ink-900 p-3 text-center">
            <div className={cn("text-2xl font-extrabold", (room.occupants ?? 0) > 0 ? "text-emerald-300" : "text-rose-300")}>{room.occupants ?? 0}</div>
            <div className="text-[11px] text-mist-400">In the room</div>
          </div>
          <div className="rounded-xl border border-line bg-ink-900 p-3 text-center">
            <div className="text-2xl font-extrabold text-mist-100">{room.hostPresent ? "Yes" : "No"}</div>
            <div className="text-[11px] text-mist-400">Host present</div>
          </div>
          <div className="rounded-xl border border-line bg-ink-900 p-3 text-center">
            <div className="text-2xl font-extrabold text-mist-100">{room.coHostPresent ? "Yes" : "No"}</div>
            <div className="text-[11px] text-mist-400">Co-host present</div>
          </div>
        </div>

        {(room.presentNames ?? []).length > 0 && (
          <p className="px-4 pb-2 text-xs text-mist-400">Inside now: <span className="text-mist-200">{(room.presentNames ?? []).join(", ")}</span></p>
        )}

        <div className="flex items-center justify-between border-y border-line px-4 py-2">
          <span className="text-xs font-semibold text-mist-300">{showAll ? "All activity" : "Joined / exited"}</span>
          <button onClick={() => setShowAll((v) => !v)} className="text-xs font-semibold text-lotus-300 hover:text-lotus-200">
            {showAll ? "Show joined / exited only" : "Show all activity"}
          </button>
        </div>

        <div className="max-h-[40vh] overflow-y-auto p-3">
          {events === null ? (
            <p className="py-8 text-center text-sm text-mist-500">Loading…</p>
          ) : shown.length === 0 ? (
            <p className="py-8 text-center text-sm text-mist-500">No activity recorded for this room yet.</p>
          ) : (
            <ul className="space-y-1">
              {shown.map((e) => (
                <li key={e.id} className="flex items-center justify-between gap-3 rounded-lg px-2 py-1.5 text-sm hover:bg-white/[0.04]">
                  <span className="flex min-w-0 items-center gap-2">
                    <span className={cn("size-2 shrink-0 rounded-full", e.type === "join" ? "bg-emerald-400" : e.type === "leave" ? "bg-rose-400" : "bg-mist-500")} />
                    <span className="truncate text-mist-200">
                      <b className="text-mist-100">{e.target}</b>{" "}
                      {e.type === "join" ? "joined the room" : e.type === "leave" ? "left the room" : e.type.replace(/_/g, " ")}
                    </span>
                  </span>
                  <span className="shrink-0 text-[11px] tabular-nums text-mist-500">{time(e.at)}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </Card>
    </div>
  );
}

// ---------- Room status badge ----------
function RoomStatusBadge({ room }: { room: AdminRoom }) {
  const s = room.status ?? "active";
  if (s === "suspended") {
    const until = room.suspendUntil ? new Date(room.suspendUntil).toLocaleString("en-SA", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) : "";
    return (
      <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-semibold text-amber-300" title={until ? `Until ${until}` : ""}>
        Suspended{until ? ` · until ${until}` : ""}
      </span>
    );
  }
  if (s === "inactive") {
    return <span className="rounded-full bg-mist-500/15 px-2 py-0.5 text-[10px] font-semibold text-mist-400">Turned off</span>;
  }
  // The room is switched on — so the badge shows whether anyone is ACTUALLY in
  // it right now. Green with a live dot = occupied; red = empty. Hovering names
  // who is inside, and the host/co-host presence is called out.
  const n = room.occupants ?? 0;
  if (n > 0) {
    const who = (room.presentNames ?? []).join(", ");
    const role = room.hostPresent ? "Host is in the room" : room.coHostPresent ? "Co-host is in the room" : `${n} in the room`;
    return (
      <span className="flex items-center gap-1.5 rounded-full bg-emerald-500/15 px-2 py-0.5 text-[11px] font-semibold text-emerald-300" title={who ? `${role} — ${who}` : role}>
        <LiveDot /> Active · {n}
      </span>
    );
  }
  return (
    <span className="flex items-center gap-1.5 rounded-full bg-rose-500/15 px-2 py-0.5 text-[11px] font-semibold text-rose-300" title="Nobody is in this room right now">
      <span className="size-2 rounded-full bg-rose-400" /> Inactive
    </span>
  );
}

// ---------- Room Action popup (status / suspend / delete) ----------
function RoomActionModal({
  room,
  onClose,
  onDelete,
  onStatus,
}: {
  room: AdminRoom;
  onClose: () => void;
  onDelete: () => void;
  onStatus: (status: "active" | "inactive" | "suspended", opts?: { from?: string; until?: string; reason?: string }) => void;
}) {
  const { toast } = useToast();
  // Default the selected action to the room's CURRENT status (Active by default)
  // — so opening "Actions" never pre-selects Suspend. A room only becomes
  // Suspended/Inactive when the admin DELIBERATELY picks it here.
  const [action, setAction] = useState<"active" | "inactive" | "suspended" | "delete">(
    room.status === "inactive" ? "inactive" : room.status === "suspended" ? "suspended" : "active",
  );
  const [from, setFrom] = useState("");
  const [until, setUntil] = useState("");
  const [reason, setReason] = useState("");

  const confirm = () => {
    if (action === "delete") {
      onDelete();
      return;
    }
    if (action === "suspended") {
      if (!from || !until) {
        toast("Please set a suspension start and end date/time", "error");
        return;
      }
      if (new Date(until) <= new Date(from)) {
        toast("Suspension end must be after the start", "error");
        return;
      }
      onStatus("suspended", { from: new Date(from).toISOString(), until: new Date(until).toISOString(), reason: reason.trim() });
      return;
    }
    onStatus(action);
  };

  const opt = (val: typeof action, label: string, desc: string) => (
    <button
      onClick={() => setAction(val)}
      className={cn(
        "flex w-full items-start gap-2.5 rounded-xl border px-3 py-2.5 text-left transition",
        action === val ? "border-lotus-400 bg-lotus-500/10" : "border-line bg-ink-800 hover:border-lotus-400/40",
      )}
    >
      <span className={cn("mt-0.5 grid size-4 shrink-0 place-items-center rounded-full border", action === val ? "border-lotus-400" : "border-mist-500")}>
        {action === val && <span className="size-2 rounded-full bg-lotus-400" />}
      </span>
      <span className="min-w-0">
        <span className={cn("block text-sm font-semibold", val === "delete" ? "text-rose-300" : "text-mist-100")}>{label}</span>
        <span className="block text-xs text-mist-400">{desc}</span>
      </span>
    </button>
  );

  const field = "w-full rounded-lg border border-line bg-ink-900 px-3 py-2 text-sm text-mist-100 outline-none focus:border-lotus-400";

  return (
    <div className="fixed inset-0 z-[70] grid place-items-center overflow-y-auto bg-black/60 p-4" onClick={onClose}>
      <div className="my-8 w-full max-w-sm rounded-2xl border border-white/10 bg-ink-850 p-5" onClick={(e) => e.stopPropagation()}>
        <div className="mb-1 flex items-center justify-between">
          <h2 className="flex items-center gap-2 font-display text-lg font-bold text-mist-100">
            <SlidersHorizontal className="size-5 text-lotus-300" /> Room action
          </h2>
          <button onClick={onClose} className="text-mist-400 hover:text-mist-100"><X className="size-5" /></button>
        </div>
        <p className="mb-4 truncate text-sm text-mist-400">{room.name}</p>

        <div className="space-y-2">
          {opt("active", "Make Active", "Room is live and joinable.")}
          {opt("inactive", "Make Inactive", "Hide the room from members until reactivated.")}
          {opt("suspended", "Suspend for a period", "Auto-reactivates when the period ends.")}
          {opt("delete", "Delete Permanently", "Remove the room for everyone. Cannot be undone.")}
        </div>

        {action === "suspended" && (
          <div className="mt-4 space-y-3 rounded-xl border border-amber-400/20 bg-amber-500/[0.05] p-3">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-amber-300">
              <CalendarClock className="size-3.5" /> Suspension period
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-[11px] text-mist-400">From</label>
                <input type="datetime-local" value={from} onChange={(e) => setFrom(e.target.value)} className={cn(field, "mt-1")} />
              </div>
              <div>
                <label className="block text-[11px] text-mist-400">To</label>
                <input type="datetime-local" value={until} onChange={(e) => setUntil(e.target.value)} className={cn(field, "mt-1")} />
              </div>
            </div>
            <div>
              <label className="block text-[11px] text-mist-400">Reason</label>
              <textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={2} placeholder="Reason for suspension (e.g. rule violation)" className={cn(field, "mt-1 resize-none")} />
            </div>
          </div>
        )}

        <div className="mt-5 flex gap-2">
          <Button variant="secondary" block onClick={onClose}>Cancel</Button>
          <Button variant={action === "delete" ? "danger" : "primary"} block onClick={confirm}>
            {action === "delete" ? <Trash2 className="size-4" /> : <Power className="size-4" />} Confirm
          </Button>
        </div>
      </div>
    </div>
  );
}

// ---------- Create group ----------
function CreateGroupModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const { toast } = useToast();
  const [name, setName] = useState("");
  const [category, setCategory] = useState(CATEGORIES[0]);
  const [type, setType] = useState<string>("public");
  const [busy, setBusy] = useState(false);
  const field = "w-full rounded-lg border border-line bg-ink-900 px-3 py-2 text-sm text-mist-100 outline-none focus:border-lotus-400";

  const create = async () => {
    if (!name.trim()) {
      toast("Please enter a group name", "error");
      return;
    }
    setBusy(true);
    const ok = await createAdminRoom({ name: name.trim(), category, type });
    setBusy(false);
    if (ok) onCreated();
    else toast("Could not create group", "error");
  };

  return (
    <ModalShell title="Create a group" onClose={onClose}>
      <label className="block text-xs font-semibold text-mist-300">Group name</label>
      <input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Friday Night Ludo" className={cn(field, "mt-1")} autoFocus />
      <div className="mt-3 grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-semibold text-mist-300">Category</label>
          <select value={category} onChange={(e) => setCategory(e.target.value)} className={cn(field, "mt-1")}>
            {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs font-semibold text-mist-300">Type</label>
          <select value={type} onChange={(e) => setType(e.target.value)} className={cn(field, "mt-1 capitalize")}>
            {ROOM_TYPES.map((t) => <option key={t} value={t} className="capitalize">{t}</option>)}
          </select>
        </div>
      </div>
      <Button block className="mt-5" onClick={create} disabled={busy}>
        <Plus className="size-4" /> {busy ? "Creating…" : "Create group"}
      </Button>
      <p className="mt-2 text-[11px] text-mist-500">You become the host; you can transfer the host or add co-hosts after.</p>
    </ModalShell>
  );
}

// ---------- Edit group (settings, host, co-hosts, members) ----------
function EditGroupModal({
  room,
  users,
  userName,
  onClose,
  onSaved,
}: {
  room: AdminRoom;
  users: AdminUser[];
  userName: (id: string) => string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { toast } = useToast();
  const [name, setName] = useState(room.name);
  const [category, setCategory] = useState(room.category);
  const [type, setType] = useState<string>(room.type);
  const [capacity, setCapacity] = useState(room.capacity);
  const [announcement, setAnnouncement] = useState(room.announcement);
  const [description, setDescription] = useState(room.description);
  const [image, setImage] = useState(room.image ?? "");
  const [coAdminIds, setCoAdminIds] = useState<string[]>(room.coAdminIds);
  const [invitedIds, setInvitedIds] = useState<string[]>(room.invitedIds);
  const [hostId, setHostId] = useState(room.ownerId);
  const [hideAdmins, setHideAdmins] = useState(room.hideAdmins === true);
  const [busy, setBusy] = useState(false);
  const imgInput = useRef<HTMLInputElement>(null);
  const pickImage = async (file: File | undefined) => {
    if (!file || !file.type.startsWith("image/")) return;
    try { setImage(await fileToDataUrl(file, 512)); }
    catch { toast("Could not read that image", "error"); }
  };

  const field = "w-full rounded-lg border border-line bg-ink-900 px-3 py-2 text-sm text-mist-100 outline-none focus:border-lotus-400";
  const candidates = users.filter((u) => u.id !== hostId);

  const toggle = (list: string[], set: (v: string[]) => void, id: string) =>
    set(list.includes(id) ? list.filter((x) => x !== id) : [...list, id]);

  const save = async () => {
    setBusy(true);
    const patch: Record<string, unknown> = {
      name,
      category,
      type,
      capacity: Math.min(50, Math.max(2, capacity)),
      announcement,
      description,
      image,
      coAdminIds: coAdminIds.filter((id) => id !== hostId),
      invitedIds,
      hideAdmins,
    };
    if (hostId !== room.ownerId) {
      patch.transferTo = hostId;
      patch.transferToName = userName(hostId);
    }
    const ok = await updateAdminRoom(room.id, patch);
    setBusy(false);
    if (ok) onSaved();
    else toast("Could not save group", "error");
  };

  return (
    <ModalShell title="Manage group" onClose={onClose} wide>
      {/* Room picture */}
      <label className="block text-xs font-semibold text-mist-300">Room picture</label>
      <div className="mt-1 flex items-center gap-3">
        <Avatar name={name || room.hostName} src={image || undefined} size="lg" ring />
        <div className="flex flex-col gap-1.5">
          <input ref={imgInput} type="file" accept="image/*" className="hidden" onChange={(e) => { pickImage(e.target.files?.[0]); e.target.value = ""; }} />
          <div className="flex gap-2">
            <Button size="sm" variant="secondary" onClick={() => imgInput.current?.click()}>{image ? "Change" : "Upload"}</Button>
            {image && <Button size="sm" variant="ghost" className="text-rose-300" onClick={() => setImage("")}>Remove</Button>}
          </div>
          <p className="text-[11px] text-mist-500">Save to apply. Falls back to the host avatar.</p>
        </div>
      </div>

      {/* Settings */}
      <label className="mt-3 block text-xs font-semibold text-mist-300">Group name</label>
      <input value={name} onChange={(e) => setName(e.target.value)} className={cn(field, "mt-1")} />
      <div className="mt-3 grid grid-cols-3 gap-3">
        <div>
          <label className="block text-xs font-semibold text-mist-300">Category</label>
          <select value={category} onChange={(e) => setCategory(e.target.value)} className={cn(field, "mt-1")}>
            {[category, ...CATEGORIES.filter((c) => c !== category)].map((c) => <option key={c}>{c}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs font-semibold text-mist-300">Type</label>
          <select value={type} onChange={(e) => setType(e.target.value)} className={cn(field, "mt-1 capitalize")}>
            {ROOM_TYPES.map((t) => <option key={t} value={t} className="capitalize">{t}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs font-semibold text-mist-300">Seats</label>
          <input type="number" min={2} max={50} value={capacity} onChange={(e) => setCapacity(Number(e.target.value) || 2)} className={cn(field, "mt-1")} />
        </div>
      </div>
      <label className="mt-3 block text-xs font-semibold text-mist-300">Announcement</label>
      <input value={announcement} onChange={(e) => setAnnouncement(e.target.value)} placeholder="Pin a message for the group" className={cn(field, "mt-1")} />
      <label className="mt-3 block text-xs font-semibold text-mist-300">Description</label>
      <input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="What's this group about?" className={cn(field, "mt-1")} />

      {/* ADMIN VISIBILITY — Show Admin / Hide Admin for this group. */}
      <label className="mt-4 block text-xs font-semibold text-mist-300">Admin visibility</label>
      <div className="mt-1 flex items-center gap-3 rounded-lg border border-line bg-ink-900 px-3 py-2.5">
        <span className={cn("grid size-8 shrink-0 place-items-center rounded-lg", hideAdmins ? "bg-lotus-500/15 text-lotus-300" : "bg-emerald-500/15 text-emerald-300")}>
          {hideAdmins ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-mist-100">{hideAdmins ? "Hide Admin" : "Show Admin"}</p>
          <p className="text-[11px] text-mist-500">
            {hideAdmins
              ? "Admins are hidden from this group's member list — they still monitor, manage members and enter at any time."
              : "Admins appear in this group's member list like any other member."}
          </p>
        </div>
        <button
          type="button"
          onClick={() => setHideAdmins((v) => !v)}
          role="switch"
          aria-checked={!hideAdmins}
          aria-label="Show admin in this group"
          className={cn("relative h-6 w-11 shrink-0 rounded-full transition", hideAdmins ? "bg-ink-600" : "bg-emerald-500")}
        >
          <span className={cn("absolute top-0.5 size-5 rounded-full bg-white transition-all", hideAdmins ? "left-0.5" : "left-[22px]")} />
        </button>
      </div>

      {/* Host */}
      <label className="mt-4 flex items-center gap-1.5 text-xs font-semibold text-mist-300">
        <Crown className="size-3.5 text-gold-400" /> Host
      </label>
      <select value={hostId} onChange={(e) => setHostId(e.target.value)} className={cn(field, "mt-1")}>
        <option value={room.ownerId}>{userName(room.ownerId)} (current)</option>
        {users.filter((u) => u.id !== room.ownerId).map((u) => (
          <option key={u.id} value={u.id}>{u.fullName}</option>
        ))}
      </select>

      {/* Co-hosts */}
      <p className="mt-4 flex items-center gap-1.5 text-xs font-semibold text-mist-300">
        <ShieldCheck className="size-3.5 text-lotus-300" /> Co-Hosts ({coAdminIds.filter((id) => id !== hostId).length})
      </p>
      <PickerList users={candidates} selected={coAdminIds} onToggle={(id) => toggle(coAdminIds, setCoAdminIds, id)} />

      {/* Members (invited) */}
      <p className="mt-4 flex items-center gap-1.5 text-xs font-semibold text-mist-300">
        <UserPlus className="size-3.5 text-emerald-300" /> Members / invited ({invitedIds.length})
      </p>
      <PickerList users={candidates} selected={invitedIds} onToggle={(id) => toggle(invitedIds, setInvitedIds, id)} />

      <Button block className="mt-5" onClick={save} disabled={busy}>
        <Check className="size-4" /> {busy ? "Saving…" : "Save group"}
      </Button>
    </ModalShell>
  );
}

function PickerList({ users, selected, onToggle }: { users: AdminUser[]; selected: string[]; onToggle: (id: string) => void }) {
  return (
    <div className="mt-1 max-h-36 space-y-1 overflow-y-auto rounded-lg border border-line bg-ink-900/60 p-1.5">
      {users.length === 0 && <p className="px-2 py-1 text-xs text-mist-500">No users available.</p>}
      {users.map((u) => {
        const on = selected.includes(u.id);
        return (
          <button
            key={u.id}
            onClick={() => onToggle(u.id)}
            className={cn(
              "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm transition",
              on ? "bg-lotus-500/15 text-lotus-200" : "text-mist-200 hover:bg-white/[0.05]",
            )}
          >
            <Avatar name={u.fullName} size="xs" />
            <span className="flex-1 truncate">{u.fullName}</span>
            {on ? <Check className="size-4 text-lotus-300" /> : <Plus className="size-4 text-mist-500" />}
          </button>
        );
      })}
    </div>
  );
}

function ModalShell({ title, onClose, wide, children }: { title: string; onClose: () => void; wide?: boolean; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-[70] grid place-items-center overflow-y-auto bg-black/60 p-4" onClick={onClose}>
      <div
        className={cn("my-8 w-full rounded-2xl border border-white/10 bg-ink-850 p-5", wide ? "max-w-lg" : "max-w-sm")}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="flex items-center gap-2 font-display text-lg font-bold text-mist-100">
            <Settings className="size-5 text-lotus-300" /> {title}
          </h2>
          <button onClick={onClose} className="text-mist-400 hover:text-mist-100"><X className="size-5" /></button>
        </div>
        {children}
      </div>
    </div>
  );
}

// Per-room Reset Controls — each reset affects ONLY this room. "Games" clears a
// stuck "Game Starting…" lobby / running match. Factory reset does all at once.
const RESET_ITEMS: { key: RoomResetSection; label: string; desc: string; danger?: boolean }[] = [
  { key: "games", label: "Reset / clear stuck game", desc: "Cancel a stuck “Game Starting…” lobby and force-close any running match so the room can start fresh." },
  { key: "groupSettings", label: "Reset group settings", desc: "Clear the description, room picture and stickers." },
  { key: "chat", label: "Reset chat settings", desc: "Unlock chat, clear chat-mutes, restore the auto-lock default." },
  { key: "memberPerms", label: "Reset member permissions", desc: "Back to host-controlled defaults (seat / mic / camera / chat / games)." },
  { key: "hostCohost", label: "Reset host & co-host", desc: "Remove all co-hosts and extra co-host slots. Owner & host are unchanged." },
  { key: "moderation", label: "Reset moderation", desc: "Un-mute everyone (mic, chat, camera) and unlock member voice." },
  { key: "gameConfig", label: "Reset game configuration", desc: "Clear this room’s per-room feature overrides — back to app defaults." },
  { key: "voice", label: "Reset voice room settings", desc: "Unlock voice/video, clear now-playing media, stage & audience lists." },
  { key: "security", label: "Reset security settings", desc: "Un-ban & un-kick everyone, clear suspension, show admins, stop recording." },
  { key: "announcements", label: "Reset announcements", desc: "Clear this room’s announcement banner." },
  { key: "reports", label: "Reset reports", desc: "Dismiss all open reports filed against this room." },
];

function ResetControlsModal({ room, onClose }: { room: AdminRoom; onClose: () => void }) {
  const { toast } = useToast();
  const [busy, setBusy] = useState<string>("");

  const run = async (section: RoomResetSection, confirmMsg: string) => {
    if (!window.confirm(confirmMsg)) return;
    setBusy(section);
    const res = await adminResetRoomSection(room.id, section);
    setBusy("");
    if (res.ok) toast(res.summary ? `✓ ${res.summary} reset` : "Reset done", "success");
    else toast(res.error ?? "Reset failed", "error");
  };

  return (
    <div className="fixed inset-0 z-[70] grid place-items-center overflow-y-auto bg-black/60 p-4" onClick={onClose}>
      <div className="my-8 w-full max-w-lg rounded-2xl border border-white/10 bg-ink-850 p-5" onClick={(e) => e.stopPropagation()}>
        <div className="mb-1 flex items-center justify-between">
          <h2 className="flex items-center gap-2 font-display text-lg font-bold text-mist-100"><RotateCcw className="size-5 text-lotus-300" /> Reset controls</h2>
          <button onClick={onClose} className="text-mist-400 hover:text-mist-100"><X className="size-5" /></button>
        </div>
        <p className="text-xs text-mist-400"><b className="text-mist-200">{room.name}</b> · each reset affects <b className="text-mist-200">only this room</b> — other rooms are never touched. Every reset is recorded in the Admin Log.</p>

        <div className="mt-3 max-h-[55vh] space-y-2 overflow-y-auto pr-1">
          {RESET_ITEMS.map((it) => (
            <div key={it.key} className="flex items-center gap-3 rounded-lg border border-line bg-ink-900/50 p-3">
              <div className="min-w-0 flex-1">
                <div className="text-sm font-semibold text-mist-100">{it.label}</div>
                <div className="text-[11px] leading-snug text-mist-500">{it.desc}</div>
              </div>
              <Button size="sm" variant="secondary" disabled={!!busy} onClick={() => run(it.key, `Reset “${it.label}” for "${room.name}"? This affects only this room.`)}>
                {busy === it.key ? <Loader2 className="size-3.5 animate-spin" /> : <RotateCcw className="size-3.5" />} Reset
              </Button>
            </div>
          ))}
        </div>

        {/* Factory reset */}
        <div className="mt-3 flex items-center gap-3 rounded-lg border border-rose-400/30 bg-rose-500/[0.06] p-3">
          <AlertTriangle className="size-5 shrink-0 text-rose-300" />
          <div className="min-w-0 flex-1">
            <div className="text-sm font-semibold text-rose-200">Factory reset group</div>
            <div className="text-[11px] leading-snug text-mist-400">Resets ALL of the above for this room at once. This cannot be undone.</div>
          </div>
          <Button size="sm" variant="danger" disabled={!!busy} onClick={() => run("factory", `FACTORY RESET "${room.name}"?\n\nThis resets every section above for this room (settings, chat, members, host/co-hosts, moderation, games, game config, voice, security, announcements, reports). It cannot be undone. Other rooms are not affected.`)}>
            {busy === "factory" ? <Loader2 className="size-3.5 animate-spin" /> : <AlertTriangle className="size-3.5" />} Factory reset
          </Button>
        </div>
      </div>
    </div>
  );
}

function Toggle({
  icon: Icon,
  label,
  desc,
  on,
  onClick,
}: {
  icon: typeof Mic;
  label: string;
  desc: string;
  on: boolean;
  onClick: () => void;
}) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-line bg-ink-800 px-3 py-2.5">
      <Icon className="size-5 text-lotus-300" />
      <div className="min-w-0 flex-1">
        <div className="text-sm font-semibold text-mist-100">{label}</div>
        <div className="text-xs text-mist-400">{desc}</div>
      </div>
      <button
        onClick={onClick}
        className={cn("relative h-6 w-11 shrink-0 rounded-full transition-colors", on ? "bg-emerald-500" : "bg-ink-700")}
        aria-label={`Toggle ${label}`}
      >
        <span className={cn("absolute top-0.5 size-5 rounded-full bg-white transition-all", on ? "left-[22px]" : "left-0.5")} />
      </button>
    </div>
  );
}

function SeatInput({ label, value, onChange }: { label: string; value: number; onChange: (n: number) => void }) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-line bg-ink-800 px-3 py-2.5">
      <div className="min-w-0 flex-1 text-sm font-semibold text-mist-100">{label}</div>
      <input
        type="number"
        min={2}
        max={50}
        value={value}
        onChange={(e) => onChange(Math.min(50, Math.max(2, Number(e.target.value) || 2)))}
        className="h-9 w-16 rounded-lg border border-line bg-ink-900 px-2 text-center text-sm text-mist-100 outline-none focus:border-lotus-400"
      />
    </div>
  );
}

/** ON/OFF row used by the Room list visibility panel. */
function RlToggle({ label, desc, on, onToggle }: { label: string; desc: string; on: boolean; onToggle: () => void }) {
  return (
    <div className="flex items-center justify-between gap-3 py-3">
      <div className="min-w-0">
        <div className="text-sm font-semibold text-mist-100">{label}</div>
        <div className="text-xs leading-snug text-mist-500">{desc}</div>
      </div>
      <button onClick={onToggle} aria-pressed={on} className={cn("relative h-7 w-14 shrink-0 rounded-full transition", on ? "bg-emerald-500" : "bg-mist-600")}>
        <span className={cn("absolute top-0.5 grid size-6 place-items-center rounded-full bg-white text-[9px] font-bold transition-all", on ? "left-[calc(100%-1.625rem)] text-emerald-600" : "left-0.5 text-mist-500")}>{on ? "ON" : "OFF"}</span>
      </button>
    </div>
  );
}
