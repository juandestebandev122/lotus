"use client";

// A small admin user search box: type a name / @username / member ID and pick
// from live matching results (photo + name + ID). Used wherever an admin tool
// needs "which user?" — plain text inputs kept guessing wrong.
import { useEffect, useRef, useState } from "react";
import { Avatar } from "@/components/ui/Avatar";
import { fetchAdminUsers, type AdminUser } from "@/lib/admin";
import { cn } from "@/lib/cn";

export function UserPicker({ value, onPick, placeholder, className }: {
  value: string; // what's shown in the input (publicId or username after picking)
  onPick: (v: string, user?: AdminUser) => void;
  placeholder?: string;
  className?: string;
}) {
  const [users, setUsers] = useState<AdminUser[] | null>(null);
  const [open, setOpen] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);

  // Load the user list once, on first focus (118 users — cheap to filter locally).
  const ensureLoaded = () => {
    if (users !== null) return;
    fetchAdminUsers().then(setUsers).catch(() => setUsers([]));
  };

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  const q = value.trim().replace(/^@/, "").toLowerCase();
  const matches = (users ?? [])
    .filter((u) =>
      q.length > 0 &&
      (u.fullName.toLowerCase().includes(q) ||
        u.username.toLowerCase().includes(q) ||
        (u.publicId ?? "").toLowerCase().includes(q)))
    .slice(0, 8);

  return (
    <div ref={boxRef} className={cn("relative", className)}>
      <input
        value={value}
        onChange={(e) => { onPick(e.target.value); setOpen(true); }}
        onFocus={() => { ensureLoaded(); setOpen(true); }}
        placeholder={placeholder ?? "Name, @username or member ID"}
        className="h-9 w-full rounded-lg border border-line bg-ink-900 px-2.5 text-sm text-mist-100 outline-none focus:border-lotus-400"
      />
      {open && q.length > 0 && (
        <div className="absolute left-0 top-full z-30 mt-1 w-full min-w-64 overflow-hidden rounded-xl border border-white/10 bg-ink-900 shadow-xl">
          {users === null ? (
            <p className="px-3 py-2.5 text-xs text-mist-500">Loading members…</p>
          ) : matches.length === 0 ? (
            <p className="px-3 py-2.5 text-xs text-mist-500">No member matches “{value.trim()}”.</p>
          ) : (
            matches.map((u) => (
              <button
                key={u.id}
                onClick={() => { onPick(u.publicId || u.username, u); setOpen(false); }}
                className="flex w-full items-center gap-2.5 px-3 py-2 text-left transition hover:bg-white/[0.05]"
              >
                <Avatar name={u.fullName} src={u.avatar || undefined} size="xs" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm text-mist-100">{u.fullName}</span>
                  <span className="block truncate text-[10px] text-mist-500">@{u.username}{u.publicId ? ` · ID ${u.publicId}` : ""}</span>
                </span>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}
