import Link from "next/link";
import type { User } from "@/lib/types";
import { Avatar } from "@/components/ui/Avatar";
import { profileHref } from "@/lib/profile-href";
import { CheckCircle2 } from "lucide-react";

export function UserRow({
  user,
  subtitle,
  right,
}: {
  user: User;
  subtitle?: React.ReactNode;
  right?: React.ReactNode;
}) {
  const online = user.status === "online";
  return (
    <div className="flex items-center gap-3 rounded-xl px-1 py-2">
      <Link href={profileHref(user)} className={online ? "" : "opacity-50"}>
        <Avatar name={user.fullName} src={user.avatar} status={user.status} size="md" />
      </Link>
      <div className="min-w-0 flex-1">
        <Link
          href={profileHref(user)}
          className={`flex items-center gap-1 truncate text-sm font-semibold text-mist-100 hover:text-lotus-300 ${online ? "" : "opacity-60"}`}
        >
          {user.fullName}
          {user.verified && <CheckCircle2 className="size-3.5 text-lotus-400" />}
          {online && <span className="ml-1 inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide text-emerald-400"><span className="size-1.5 rounded-full bg-emerald-400" /> Online</span>}
        </Link>
        {/* Name + permanent ID number — never the name alone. */}
        <div className="truncate text-xs text-mist-400">
          {subtitle ?? `@${user.username}`}
          {user.publicId && <span className="ml-1.5 font-mono text-[11px] text-mist-500">ID {user.publicId}</span>}
        </div>
      </div>
      {right}
    </div>
  );
}
