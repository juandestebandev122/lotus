import Link from "next/link";
import type { VoiceRoom } from "@/lib/types";
import { Avatar } from "@/components/ui/Avatar";
import { Badge, LiveDot } from "@/components/ui/Badge";
import { Lock, Users2 } from "lucide-react";

const TYPE_LABEL: Record<VoiceRoom["type"], string> = {
  public: "Public",
  private: "Private",
  password: "Locked",
  community: "Community",
};

export function RoomCard({ room }: { room: VoiceRoom }) {
  return (
    <Link
      href="/rooms"
      className="group block rounded-xl glass p-4 transition-colors hover:border-white/15 hover:bg-ink-800"
    >
      <div className="flex items-start justify-between">
        <Badge tone="lotus">{room.category}</Badge>
        {room.live && (
          <span className="flex items-center gap-1.5 text-xs font-semibold text-rose-300">
            <LiveDot /> LIVE
          </span>
        )}
      </div>
      <h3 className="mt-3 flex items-center gap-1.5 font-display text-base font-bold text-mist-100">
        {(room.type === "password" || room.type === "private") && (
          <Lock className="size-3.5 text-mist-400" />
        )}
        {room.name}
      </h3>
      <div className="mt-1 text-xs text-mist-400">Hosted by {room.host.fullName}</div>

      <div className="mt-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Avatar name={room.host.fullName} size="sm" />
          <span className="text-xs text-mist-400">Host</span>
        </div>
        <div className="flex items-center gap-3 text-xs text-mist-400">
          <span className="flex items-center gap-1">
            <Users2 className="size-3.5" /> {room.speakers} in room
          </span>
          <span className="text-mist-500">{TYPE_LABEL[room.type]}</span>
        </div>
      </div>
    </Link>
  );
}
