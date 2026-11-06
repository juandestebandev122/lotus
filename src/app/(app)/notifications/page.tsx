"use client";

import { useState } from "react";
import Link from "next/link";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Avatar } from "@/components/ui/Avatar";
import { useToast } from "@/components/ui/Toast";
import { useNotifications } from "@/lib/notifications";
import { BrandImg } from "@/components/BrandImg";
import type { NotificationType } from "@/lib/types";
import {
  UserPlus,
  UserCheck,
  MessageCircle,
  Mic,
  Gamepad2,
  Trophy,
  Gift,
  Bell,
  CheckCheck,
  Check,
  X,
  Trash2,
  Heart,
  MessageSquare,
  Film,
} from "lucide-react";

const ICON: Record<NotificationType, { icon: typeof Bell; tone: string }> = {
  friend_request: { icon: UserPlus, tone: "bg-lotus-500/15 text-lotus-300" },
  friend_accept: { icon: UserCheck, tone: "bg-emerald-500/15 text-emerald-300" },
  follow: { icon: UserPlus, tone: "bg-sky-500/15 text-sky-300" },
  message: { icon: MessageCircle, tone: "bg-lotus-500/15 text-lotus-300" },
  room_invite: { icon: Mic, tone: "bg-petal-500/15 text-petal-400" },
  game_invite: { icon: Gamepad2, tone: "bg-amber-500/15 text-amber-300" },
  tournament: { icon: Trophy, tone: "bg-gold-400/15 text-gold-300" },
  reward: { icon: Gift, tone: "bg-gold-400/15 text-gold-300" },
  reel_like: { icon: Heart, tone: "bg-rose-500/15 text-rose-300" },
  reel_comment: { icon: MessageSquare, tone: "bg-sky-500/15 text-sky-300" },
  reel_share: { icon: Film, tone: "bg-fuchsia-500/15 text-fuchsia-300" },
  system: { icon: Bell, tone: "bg-white/[0.06] text-mist-300" },
};

const FILTERS = ["All", "Requests", "Invites", "Reels", "Rewards"] as const;

export default function NotificationsPage() {
  // One shared source — the bell & sidebar badges read the same data.
  const { items, unreadCount: unread, markAllRead, markRead, dismiss, clearAll } = useNotifications();
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>("All");
  const { toast } = useToast();

  const filtered = items.filter((n) => {
    if (filter === "Requests") return n.type === "friend_request" || n.type === "follow";
    if (filter === "Invites") return n.type === "room_invite" || n.type === "game_invite";
    if (filter === "Reels") return n.type === "reel_like" || n.type === "reel_comment" || n.type === "reel_share";
    if (filter === "Rewards") return n.type === "reward" || n.type === "tournament";
    return true;
  });

  const handleMarkAll = () => {
    markAllRead();
    toast("All notifications marked as read", "success");
  };

  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-extrabold text-mist-100">Notifications</h1>
          <p className="text-sm text-mist-400">
            {unread > 0 ? `${unread} unread` : "You're all caught up 🎉"}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {unread > 0 && (
            <Button size="sm" variant="outline" onClick={handleMarkAll}>
              <CheckCheck className="size-4" /> Mark all read
            </Button>
          )}
          {items.length > 0 && (
            <Button size="sm" variant="outline" onClick={() => { clearAll(); toast("All notifications deleted", "info"); }}>
              <Trash2 className="size-4" /> Clear all
            </Button>
          )}
        </div>
      </div>

      <div className="mb-4 flex gap-2 overflow-x-auto no-scrollbar">
        {FILTERS.map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={
              "shrink-0 rounded-full px-4 py-1.5 text-sm font-semibold transition " +
              (filter === f
                ? "bg-lotus-600 text-white"
                : "border border-line bg-ink-800 text-mist-400 hover:text-mist-100")
            }
          >
            {f}
          </button>
        ))}
      </div>

      <Card className="divide-y divide-black/[0.06] p-1">
        {filtered.length ? (
          filtered.map((n) => {
            const meta = ICON[n.type];
            return (
              <div
                key={n.id}
                onClick={() => markRead(n.id)}
                className={
                  "flex cursor-pointer items-start gap-3 rounded-xl px-3 py-3.5 transition hover:bg-white/[0.04] " +
                  (n.unread ? "bg-lotus-500/[0.07]" : "")
                }
              >
                {n.actor ? (
                  <Avatar name={n.actor.fullName} src={n.actor.avatar} size="md" />
                ) : (
                  <span className={`grid size-11 shrink-0 place-items-center rounded-full ${meta.tone}`}>
                    <meta.icon className="size-5" />
                  </span>
                )}
                <div className="min-w-0 flex-1">
                  <p className="text-sm text-mist-200">
                    {n.actor && <span className="font-semibold text-mist-100">{n.actor.fullName} </span>}
                    {n.text}
                  </p>
                  <div className="mt-0.5 text-xs text-mist-500">{n.time}</div>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  {/* Game invitations let the MEMBER accept or reject. */}
                  {n.type === "game_invite" ? (
                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          dismiss(n.id);
                          toast("You joined the game 🎮", "success");
                        }}
                        className="inline-flex items-center gap-1 rounded-lg bg-emerald-500/20 px-2.5 py-1.5 text-xs font-semibold text-emerald-300 hover:bg-emerald-500/30"
                      >
                        <Check className="size-3.5" /> Accept
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          dismiss(n.id);
                          toast("Invitation declined", "info");
                        }}
                        className="inline-flex items-center gap-1 rounded-lg bg-white/[0.06] px-2.5 py-1.5 text-xs font-semibold text-mist-300 hover:bg-rose-500/15 hover:text-rose-300"
                      >
                        <X className="size-3.5" /> Reject
                      </button>
                    </div>
                  ) : (
                    n.cta && (
                      <Link
                        href={n.cta.href ?? "#"}
                        onClick={(e) => { e.stopPropagation(); dismiss(n.id); }}
                        className="rounded-lg bg-lotus-600 px-3 py-1.5 text-xs font-semibold text-white"
                      >
                        {n.cta.label}
                      </Link>
                    )
                  )}
                  {n.unread && <span className="size-2 rounded-full bg-petal-500" />}
                  {/* Delete this notification */}
                  {n.type !== "game_invite" && (
                    <button
                      onClick={(e) => { e.stopPropagation(); dismiss(n.id); }}
                      title="Delete notification"
                      className="grid size-7 shrink-0 place-items-center rounded-lg text-mist-500 transition hover:bg-rose-500/15 hover:text-rose-300"
                    >
                      <Trash2 className="size-4" />
                    </button>
                  )}
                </div>
              </div>
            );
          })
        ) : (
          <div className="px-4 py-12 text-center">
            <BrandImg slot="emptyNotifications" className="mx-auto w-24 animate-float drop-shadow-xl" />
            <p className="mt-4 font-semibold text-mist-200">You&apos;re all caught up</p>
            <p className="mt-1 text-sm text-mist-400">No notifications in this category.</p>
          </div>
        )}
      </Card>
    </div>
  );
}
