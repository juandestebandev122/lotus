"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Users, Mic, ArrowLeft } from "lucide-react";
import { AgencyBadge } from "@/components/AgencyBadge";
import { fetchRoom } from "@/lib/rooms";

export interface GroupContext {
  room: string;
  name: string;
}

/**
 * Reads the ?room=&group= params that a Voice Room passes when launching a game.
 * Returns `undefined` while reading, `null` if the user did not come from a group,
 * or the group context when they did.
 */
export function useGroupParam(): GroupContext | null | undefined {
  const [group, setGroup] = useState<GroupContext | null | undefined>(undefined);
  useEffect(() => {
    const sp = new URLSearchParams(window.location.search);
    const room = sp.get("room");
    setGroup(room ? { room, name: sp.get("group") || "your group" } : null);
  }, []);
  return group;
}

/** Shown when someone opens a game without joining a group first. */
export function GroupRequired() {
  return (
    <div className="mx-auto max-w-md py-16 text-center">
      <span className="mx-auto grid size-16 place-items-center rounded-2xl bg-gradient-to-br from-lotus-500 to-petal-500 text-white shadow-lg">
        <Users className="size-8" />
      </span>
      <h1 className="mt-5 font-display text-2xl font-extrabold text-mist-100">
        Join a group to play
      </h1>
      <p className="mt-2 text-mist-300">
        Ludo and Chess are played with your group members. Join a Voice Room first, then start a
        match with the people in your room.
      </p>
      <Link
        href="/rooms"
        className="mt-6 inline-flex h-11 items-center gap-2 rounded-lg bg-gradient-to-r from-lotus-500 to-petal-500 px-5 text-sm font-semibold text-white shadow-md transition hover:brightness-110"
      >
        <Mic className="size-4" /> Browse Voice Rooms
      </Link>
      <div className="mt-3">
        <Link href="/home" className="inline-flex items-center gap-1.5 text-sm text-mist-400 hover:text-mist-200">
          <ArrowLeft className="size-4" /> Back to Home
        </Link>
      </div>
    </div>
  );
}

/**
 * Small banner shown above a game to confirm the group you're playing with.
 * The "Return to Room" link goes back to the room; the game keeps running in
 * the background (its session is saved), so you can switch back any time.
 */
export function GroupBanner({ name, roomId }: { name: string; roomId?: string }) {
  // The agency that manages this game's room — shown next to the group name here
  // too, so it's visible on the actual game screen (not just the room / spectator).
  const [agency, setAgency] = useState<{ name?: string; id?: string } | null>(null);
  useEffect(() => {
    let active = true;
    if (roomId) fetchRoom(roomId).then((r) => { if (active && r?.agencyName) setAgency({ name: r.agencyName, id: r.agencyId }); });
    return () => { active = false; };
  }, [roomId]);
  return (
    <div className="mb-4 flex flex-wrap items-center gap-x-2 gap-y-1.5 rounded-xl border border-lotus-400/30 bg-lotus-500/10 px-3.5 py-2 text-sm text-lotus-200">
      <Users className="size-4" />
      Playing with <span className="font-semibold text-mist-100">{name}</span>
      {agency?.name && <AgencyBadge name={agency.name} id={agency.id} />}
      <Link
        href={roomId ? `/rooms/${roomId}` : "/rooms"}
        className="ml-auto inline-flex items-center gap-1 rounded-md bg-lotus-500/20 px-2.5 py-1 text-xs font-semibold text-lotus-200 hover:bg-lotus-500/30"
      >
        <ArrowLeft className="size-3.5" /> Return to Room
      </Link>
    </div>
  );
}
