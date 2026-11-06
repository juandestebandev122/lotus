"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Avatar } from "@/components/ui/Avatar";
import { withBase } from "@/lib/base-path";
import { profileHref } from "@/lib/profile-href";
import { useConfig } from "@/lib/config";
import { frameImageOf } from "@/lib/frames";
import { framesOnIn } from "@/lib/module-frames";
import { Users2 } from "lucide-react";

/** A modal listing WHO a profile's followers / following / friends actually are.
 *  Opened by tapping the count tiles on a profile (yours OR someone else's).
 *  `user` is the username OR member id whose lists to show. The connections API
 *  always lets you view YOUR OWN lists, so this works on the own-profile page. */
export function ConnectionsModal({ user, type, onClose }: {
  user: string;
  type: "followers" | "following" | "friends";
  onClose: () => void;
}) {
  const router = useRouter();
  const { config } = useConfig();
  const [people, setPeople] = useState<null | { id: string; username: string; fullName: string; avatar?: string; publicId?: string; level?: number; equippedFrame?: string }[]>(null);
  const [privateMsg, setPrivateMsg] = useState("");
  const title = type === "followers" ? "Followers" : type === "following" ? "Following" : "Friends";
  useEffect(() => {
    let on = true;
    fetch(withBase(`/api/social/connections?user=${encodeURIComponent(user)}&type=${type}`), { credentials: "include" })
      .then(async (r) => {
        const d = await r.json().catch(() => ({}));
        if (!on) return;
        if (!r.ok) { setPrivateMsg((d?.error as string) || "This list is private."); setPeople([]); }
        else setPeople(Array.isArray(d.users) ? d.users : []);
      })
      .catch(() => { if (on) setPeople([]); });
    return () => { on = false; };
  }, [user, type]);
  return (
    <div className="fixed inset-0 z-[120] grid place-items-center bg-black/60 p-4" onClick={onClose}>
      <div className="max-h-[80vh] w-full max-w-sm overflow-hidden rounded-2xl border border-white/10 bg-ink-850" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
          <h2 className="flex items-center gap-2 font-display text-base font-bold text-mist-100"><Users2 className="size-4 text-lotus-300" /> {title}</h2>
          <button onClick={onClose} className="text-mist-400 hover:text-mist-100" aria-label="Close"><span className="text-lg leading-none">✕</span></button>
        </div>
        <div className="max-h-[calc(80vh-3.5rem)] overflow-y-auto p-2">
          {people === null ? (
            <p className="py-8 text-center text-sm text-mist-500">Loading…</p>
          ) : privateMsg ? (
            <p className="px-4 py-8 text-center text-sm text-mist-500">🔒 {privateMsg}</p>
          ) : people.length === 0 ? (
            <p className="py-8 text-center text-sm text-mist-500">No {title.toLowerCase()} yet.</p>
          ) : (
            people.map((p) => (
              <button
                key={p.id}
                onClick={() => { onClose(); router.push(profileHref(p)); }}
                className="flex w-full items-center gap-3 rounded-xl px-2 py-2 text-left transition hover:bg-white/[0.06]"
              >
                <Avatar name={p.fullName} src={p.avatar} size="md" frameImage={framesOnIn(config, "friends") && p.equippedFrame ? frameImageOf(config, p.equippedFrame) : undefined} />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-semibold text-mist-100">{p.fullName}</div>
                  <div className="truncate text-xs text-mist-500">@{p.username}{p.publicId ? ` · ID ${p.publicId}` : ""}</div>
                </div>
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
