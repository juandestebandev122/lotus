"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Mic, MicOff, Plus, Users, Radio, Hash, Lock, Globe, X, LogIn, Search, Home, UserCheck, Coins, Crown, RefreshCw } from "lucide-react";
import { Avatar } from "@/components/ui/Avatar";
import { CustomUploads } from "@/components/CustomUploads";
import { AdBanner } from "@/components/AdBanner";
import { Button } from "@/components/ui/Button";
import { AgencyBadge } from "@/components/AgencyBadge";
import { RoomZoneOverlay } from "@/components/RoomOverlays";
import { useToast } from "@/components/ui/Toast";
import { cn } from "@/lib/cn";
import { fetchRoomsView, createRoom, type RoomView } from "@/lib/rooms";
import type { VoiceRoom } from "@/lib/types";
import { useConfig } from "@/lib/config";

// Fallback list if the admin hasn't defined any Room categories yet.
const CATEGORIES = ["Friendship", "Music", "Gaming", "Tamil Community", "Just Chatting", "Study"];
type Cat = { id: string; name: string; scope: "store" | "room"; enabled?: boolean; order?: number };
/** Enabled Room categories (admin-managed, config.categories) — names, ordered. */
function roomCategoryNames(config: { categories?: Cat[] }): string[] {
  const cats = (config.categories ?? []).filter((c) => c.scope === "room" && c.enabled !== false).sort((a, b) => (a.order ?? 0) - (b.order ?? 0)).map((c) => c.name);
  return cats.length ? cats : CATEGORIES;
}

const TYPE_ICON = {
  public: Globe,
  community: Hash,
  private: Lock,
  password: Lock,
} as const;

/** The three ways a member can browse the list (Active/Inactive are admin-toggled). */
type RoomsView = "all" | "active" | "inactive";

function RoomCard({ room, mine }: { room: RoomView; mine?: boolean }) {
  const TypeIcon = TYPE_ICON[room.type];
  return (
    <Link
      href={`/rooms/${room.id}`}
      className="group relative overflow-hidden rounded-2xl border border-white/10 bg-ink-850/60 p-5 transition hover:border-lotus-400/50 hover:bg-ink-850"
    >
      <div className="flex items-start gap-3">
        <Avatar name={room.name || room.host.fullName} src={room.image || undefined} size="lg" ring />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h2 className="truncate font-display text-lg font-bold text-mist-100">{room.name}</h2>
            {mine && (
              <span className="inline-flex items-center gap-1 rounded-full bg-gold-400/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-gold-300">
                <Crown className="size-3" /> Host
              </span>
            )}
            {room.live && (
              <span className="inline-flex items-center gap-1 rounded-full bg-rose-500/20 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-rose-300">
                <Radio className="size-3" /> Live
              </span>
            )}
          </div>
          <p className="mt-0.5 truncate text-sm text-mist-300">Hosted by {room.host.fullName}</p>
          {/* Agency that manages this room — shown next to the room name for
              everyone (a plain label here since the whole card is already a link). */}
          {room.agencyName && (
            <div className="mt-1.5"><AgencyBadge name={room.agencyName} id={room.agencyId} linked={false} /></div>
          )}
          <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-mist-400">
            <span className="inline-flex items-center gap-1"><TypeIcon className="size-3.5" /> {room.category}</span>
            <span className="inline-flex items-center gap-1"><Users className="size-3.5" /> {room.speakers} {room.speakers === 1 ? "member" : "members"} in room</span>
          </div>
          {room.tags && room.tags.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-1.5">
              {room.tags.map((t) => (
                <span key={t} className="rounded-full bg-white/[0.06] px-2 py-0.5 text-[11px] text-mist-300">#{t}</span>
              ))}
            </div>
          )}
        </div>
      </div>
      <div className="mt-4 flex items-center justify-between">
        <span className="text-xs text-mist-500">{mine ? "Tap to manage" : "Tap to enter"}</span>
        <span className="inline-flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-lotus-500 to-petal-500 px-4 py-2 text-sm font-semibold text-white shadow-sm transition group-hover:brightness-110">
          <LogIn className="size-4" /> {mine ? "Open" : "Join Room"}
        </span>
      </div>
    </Link>
  );
}

function Section({ title, icon: Icon, hint, rooms, mine }: { title: string; icon: typeof Home; hint?: string; rooms: RoomView[]; mine?: boolean }) {
  if (rooms.length === 0) return null;
  return (
    <div className="mb-7">
      <div className="flex items-center gap-2">
        <Icon className="size-4 text-lotus-300" />
        <h2 className="font-display text-lg font-bold text-mist-100">{title}</h2>
        <span className="rounded-full bg-white/[0.06] px-2 py-0.5 text-xs font-semibold text-mist-400">{rooms.length}</span>
      </div>
      {hint && <p className="mb-3 mt-0.5 text-xs text-mist-500">{hint}</p>}
      <div className={cn("grid gap-4 sm:grid-cols-2", hint ? "" : "mt-3")}>
        {rooms.map((r) => <RoomCard key={r.id} room={r} mine={mine} />)}
      </div>
    </div>
  );
}

export default function RoomsPage() {
  const { config } = useConfig();
  const [rooms, setRooms] = useState<RoomView[]>([]);
  const [myId, setMyId] = useState("");
  const [joined, setJoined] = useState<string[]>([]);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [catFilter, setCatFilter] = useState("all"); // filter the listing by room category
  // Which browse view the member picked: the usual grouped list, only the rooms
  // that are busy right now, or only the empty ones.
  const [view, setView] = useState<RoomsView>("all");

  const [refreshing, setRefreshing] = useState(false);
  const load = () => fetchRoomsView().then(({ rooms, myId, joined }) => { setRooms(rooms); setMyId(myId); setJoined(joined); });
  const refresh = () => { setRefreshing(true); load().finally(() => setRefreshing(false)); };
  useEffect(() => { load(); }, []);

  // Instant search by room name, room ID or host name + category filter.
  const q = query.trim().toLowerCase();
  const match = (r: RoomView) =>
    (!q || r.name.toLowerCase().includes(q) || r.id.toLowerCase().includes(q) || r.host.fullName.toLowerCase().includes(q)) &&
    (catFilter === "all" || r.category === catFilter);
  const visible = rooms.filter(match);
  const roomCats = roomCategoryNames(config);
  const joinedSet = new Set(joined);

  const myRooms = visible.filter((r) => !!myId && r.ownerId === myId);
  const privateRooms = visible.filter((r) => r.type === "private" && r.ownerId !== myId);
  const joinedRooms = visible.filter((r) => r.ownerId !== myId && r.type !== "private" && joinedSet.has(r.id));
  const publicRooms = visible.filter((r) => r.ownerId !== myId && r.type !== "private" && !joinedSet.has(r.id));

  // ACTIVE / INACTIVE browsing (admin-controlled, Admin → Rooms).
  // "Active" = somebody is in the room right now; `speakers` is the server's live
  // presence count, so an empty room reads 0 rather than a stale flag.
  const rl = config.roomList ?? {};
  const activeOn = rl.showActive !== false;
  const inactiveOn = rl.showInactive !== false;
  // A view the admin has switched off must never stay selected.
  const effView: RoomsView = (view === "active" && !activeOn) || (view === "inactive" && !inactiveOn) ? "all" : view;
  const activeRooms = visible.filter((r) => (r.speakers ?? 0) > 0);
  const inactiveRooms = visible.filter((r) => (r.speakers ?? 0) === 0);

  return (
    <div className="mx-auto max-w-5xl">
      {/* Admin overlay band for the Voice Room LIST screen (client request). */}
      <RoomZoneOverlay zone="roomList" className="mb-4" />
      {/* Admin banners / scrolling notice targeted at the room LIST screen. */}
      <CustomUploads placement="room-list-marquee" variant="marquee" className="mb-2" />
      <CustomUploads placement="room-list" className="mb-4" />
      {/* Admin advertisement — the "In feed" position also runs on this list. */}
      <AdBanner position="feed" className="mb-4" />
      <div className="mb-6 flex items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-extrabold text-mist-100">Voice Rooms</h1>
          <p className="mt-1 text-mist-300">Your rooms, joined rooms, and public rooms to discover.</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={refresh} disabled={refreshing} title="Refresh" className="grid size-10 shrink-0 place-items-center rounded-xl border border-line bg-ink-800 text-mist-300 transition hover:text-mist-100 disabled:opacity-50">
            <RefreshCw className={cn("size-4", refreshing && "animate-spin")} />
          </button>
          <Button onClick={() => setOpen(true)}>
            <Plus className="size-4" /> Create Room
          </Button>
        </div>
      </div>

      {/* Search */}
      <div className="relative mb-6">
        <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-mist-500" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search rooms by name, room ID or host…"
          className="h-12 w-full rounded-2xl border border-white/10 bg-ink-850/60 pl-10 pr-10 text-sm text-mist-100 outline-none placeholder:text-mist-500 focus:border-lotus-400"
        />
        {query && (
          <button onClick={() => setQuery("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-mist-500 hover:text-mist-200">
            <X className="size-4" />
          </button>
        )}
      </div>

      {/* ACTIVE / INACTIVE VOICE ROOMS.
          Each button is switched on or off by the admin (Admin → Rooms). When both
          are off this row disappears entirely and the screen behaves exactly as it
          did before. */}
      {(activeOn || inactiveOn) && (
        <div className="mb-4 flex flex-wrap gap-2">
          <button
            onClick={() => setView("all")}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-xl border px-3.5 py-2 text-sm font-semibold transition",
              effView === "all" ? "border-lotus-400 bg-lotus-500/15 text-lotus-100" : "border-line bg-ink-850/60 text-mist-300 hover:text-mist-100",
            )}
          >
            <Mic className="size-4" /> All Rooms
            <span className="rounded-full bg-white/[0.08] px-1.5 text-[10px] font-bold">{visible.length}</span>
          </button>
          {activeOn && (
            <button
              onClick={() => setView("active")}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-xl border px-3.5 py-2 text-sm font-semibold transition",
                effView === "active" ? "border-emerald-400 bg-emerald-500/15 text-emerald-100" : "border-line bg-ink-850/60 text-mist-300 hover:text-mist-100",
              )}
            >
              <Radio className="size-4" /> Active Voice Rooms
              <span className="rounded-full bg-white/[0.08] px-1.5 text-[10px] font-bold">{activeRooms.length}</span>
            </button>
          )}
          {inactiveOn && (
            <button
              onClick={() => setView("inactive")}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-xl border px-3.5 py-2 text-sm font-semibold transition",
                effView === "inactive" ? "border-lotus-400 bg-lotus-500/15 text-lotus-100" : "border-line bg-ink-850/60 text-mist-300 hover:text-mist-100",
              )}
            >
              <MicOff className="size-4" /> Inactive Voice Rooms
              <span className="rounded-full bg-white/[0.08] px-1.5 text-[10px] font-bold">{inactiveRooms.length}</span>
            </button>
          )}
        </div>
      )}

      {/* Category filter (admin-managed) */}
      {roomCats.length > 0 && (
        <div className="mb-5 flex gap-2 overflow-x-auto pb-1">
          {["all", ...roomCats].map((c) => (
            <button
              key={c}
              onClick={() => setCatFilter(c)}
              className={cn("shrink-0 rounded-full px-3.5 py-1.5 text-sm font-semibold transition", catFilter === c ? "bg-lotus-600 text-white" : "bg-ink-800 text-mist-300 hover:text-mist-100")}
            >{c === "all" ? "All" : c}</button>
          ))}
        </div>
      )}

      {visible.length === 0 ? (
        <div className="rounded-2xl border border-white/10 bg-ink-850/60 px-4 py-14 text-center">
          <Mic className="mx-auto size-8 text-mist-600" />
          <p className="mt-3 font-semibold text-mist-200">{query ? "No Voice Rooms Found" : "No voice rooms yet"}</p>
          <p className="mt-1 text-sm text-mist-400">{query ? `Nothing matches "${query.trim()}". Try a different name, room ID or host.` : "Be the first to start one — tap Create Room."}</p>
        </div>
      ) : effView === "active" ? (
        <>
          <Section title="Active Voice Rooms" icon={Radio} hint="Rooms with people in them right now — walk straight into a live conversation." rooms={activeRooms} />
          {activeRooms.length === 0 && (
            <div className="rounded-2xl border border-white/10 bg-ink-850/60 px-4 py-14 text-center">
              <Radio className="mx-auto size-8 text-mist-600" />
              <p className="mt-3 font-semibold text-mist-200">No rooms are active right now</p>
              <p className="mt-1 text-sm text-mist-400">Nobody is in a voice room at the moment. Open an inactive room and start one.</p>
            </div>
          )}
        </>
      ) : effView === "inactive" ? (
        <>
          <Section title="Inactive Voice Rooms" icon={MicOff} hint="Rooms that are empty right now — open one and it goes live the moment you join." rooms={inactiveRooms} />
          {inactiveRooms.length === 0 && (
            <div className="rounded-2xl border border-white/10 bg-ink-850/60 px-4 py-14 text-center">
              <MicOff className="mx-auto size-8 text-mist-600" />
              <p className="mt-3 font-semibold text-mist-200">Every room is busy</p>
              <p className="mt-1 text-sm text-mist-400">There are no empty rooms at the moment — they all have someone in them.</p>
            </div>
          )}
        </>
      ) : (
        <>
          <Section title="My Rooms" icon={Home} hint="Rooms you created — you're the host. Tap to manage." rooms={myRooms} mine />
          <Section title="Joined Rooms" icon={UserCheck} hint="Rooms you've joined before." rooms={joinedRooms} />
          <Section title="Public Rooms" icon={Globe} hint="Open rooms anyone can discover and join." rooms={publicRooms} />
          <Section title="Private Rooms" icon={Lock} hint="Invite-only — only rooms you've been invited to appear here." rooms={privateRooms} />
        </>
      )}

      {open && (
        <CreateRoomModal
          onClose={() => setOpen(false)}
          onCreated={() => { load(); setOpen(false); }}
        />
      )}
    </div>
  );
}

function CreateRoomModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const router = useRouter();
  const { toast } = useToast();
  const { config } = useConfig();
  const roomCats = roomCategoryNames(config); // admin-managed Room categories
  const [name, setName] = useState("");
  const [category, setCategory] = useState(roomCats[0]);
  const [type, setType] = useState<VoiceRoom["type"]>("public");
  const [busy, setBusy] = useState(false);
  // When the user's free public room is used, we switch to a "request an extra
  // public room" confirmation (with the admin-set coin cost).
  const [needRequest, setNeedRequest] = useState<{ cost: number } | null>(null);

  const submit = async () => {
    if (busy || !name.trim()) return;
    setBusy(true);
    const res = await createRoom({ name: name.trim(), category, type });
    setBusy(false);
    if (res.error) return toast(res.error, "error");
    if (res.requiresRequest) return setNeedRequest({ cost: res.cost ?? 0 });
    if (res.room) { onCreated(); router.push(`/rooms/${res.room.id}`); }
  };

  const sendRequest = async () => {
    if (busy) return;
    setBusy(true);
    const res = await createRoom({ name: name.trim(), category, type, requestExtra: true });
    setBusy(false);
    if (res.error) return toast(res.error, "error");
    if (res.requested) { toast("Request sent to the admin. You'll be notified when it's approved.", "success"); onClose(); }
  };

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4" onClick={onClose}>
      <div className="w-full max-w-md rounded-2xl border border-white/10 bg-ink-850 p-6" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h2 className="font-display text-xl font-bold text-mist-100">{needRequest ? "Extra public room" : "Create a Room"}</h2>
          <button onClick={onClose} className="text-mist-400 hover:text-mist-100"><X className="size-5" /></button>
        </div>

        {needRequest ? (
          <div className="mt-5">
            <div className="flex items-start gap-3 rounded-xl border border-gold-400/30 bg-gold-500/[0.08] p-4">
              <Coins className="mt-0.5 size-5 shrink-0 text-gold-300" />
              <div className="text-sm text-mist-200">
                You&apos;ve already used your <b className="text-mist-100">1 free public room</b>. To open another public room
                {needRequest.cost > 0 ? <> it costs <b className="text-gold-300">{needRequest.cost} coins</b></> : null} and needs <b className="text-mist-100">admin approval</b>.
                The coins are charged now and <b>refunded automatically if the admin rejects it</b>. (Private rooms are unlimited and free.)
              </div>
            </div>
            <div className="mt-4 flex flex-col gap-2">
              <Button block size="lg" onClick={sendRequest} disabled={busy}>
                <Coins className="size-5" /> {busy ? "Sending…" : `Request${needRequest.cost > 0 ? ` · ${needRequest.cost} coins` : ""}`}
              </Button>
              <Button block variant="secondary" onClick={() => { setType("private"); setNeedRequest(null); }}>
                <Lock className="size-4" /> Make it a private room instead (free)
              </Button>
              <button onClick={() => setNeedRequest(null)} className="mt-1 text-center text-xs text-mist-400 hover:text-mist-200">Back</button>
            </div>
          </div>
        ) : (
          <>
            <label className="mt-5 block text-sm font-semibold text-mist-200">Room name</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Friday Night Chill"
              autoFocus
              className="mt-1.5 h-11 w-full rounded-xl border border-line bg-ink-800 px-3.5 text-sm text-mist-100 outline-none placeholder:text-mist-500 focus:border-lotus-400"
            />

            <label className="mt-4 block text-sm font-semibold text-mist-200">Category</label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="mt-1.5 h-11 w-full rounded-xl border border-line bg-ink-800 px-3 text-sm text-mist-100 outline-none focus:border-lotus-400"
            >
              {roomCats.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>

            <label className="mt-4 block text-sm font-semibold text-mist-200">Who can join</label>
            <div className="mt-1.5 grid grid-cols-3 gap-2">
              {(["public", "community", "private"] as const).map((t) => {
                const Icon = TYPE_ICON[t];
                return (
                  <button
                    key={t}
                    onClick={() => setType(t)}
                    className={cn(
                      "flex h-11 items-center justify-center gap-1.5 rounded-xl border text-xs font-semibold capitalize transition",
                      type === t ? "border-lotus-400 bg-lotus-500/20 text-white" : "border-line bg-ink-800 text-mist-300 hover:border-lotus-400/40",
                    )}
                  >
                    <Icon className="size-3.5" /> {t}
                  </button>
                );
              })}
            </div>
            {type === "private" ? (
              <p className="mt-2 text-[11px] text-lotus-300">
                🔒 Private rooms are unlimited &amp; free, and hidden from everyone. After creating, open <b>Manage → Invite members</b> to choose exactly who can see &amp; join.
              </p>
            ) : (
              <p className="mt-2 text-[11px] text-mist-500">
                🌍 Your <b className="text-mist-300">first public room is free</b>. Extra public rooms need a coin payment + admin approval.
              </p>
            )}

            <Button block size="lg" className="mt-6" onClick={submit} disabled={busy || !name.trim()}>
              <Radio className="size-5" /> {busy ? "Creating…" : "Go Live"}
            </Button>
          </>
        )}
      </div>
    </div>
  );
}
