"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Avatar } from "@/components/ui/Avatar";
import { useAuth } from "@/lib/auth";
import { fetchIncomingCalls, respondCall, type IncomingCall } from "@/lib/paid-zone";
import { Phone, Video, PhoneOff } from "lucide-react";

// App-wide listener for INCOMING Paid Zone calls. Polls the server and shows a
// full-screen ringing popup with Accept / Reject on ANY screen — so the receiver
// genuinely gets the call (not just a passive notification).
export function IncomingCallListener() {
  const { user } = useAuth();
  const router = useRouter();
  const [call, setCall] = useState<IncomingCall | null>(null);
  const [busy, setBusy] = useState(false);
  const handled = useRef<Set<string>>(new Set());
  const currentId = useRef<string | null>(null);

  useEffect(() => {
    if (!user) return;
    let on = true;
    const tick = async () => {
      if (typeof document !== "undefined" && document.hidden) return;
      const calls = await fetchIncomingCalls();
      if (!on) return;
      const next = calls.find((c) => !handled.current.has(c.id));
      if (next && next.id !== currentId.current) { currentId.current = next.id; setCall(next); }
      else if (!next && currentId.current) { currentId.current = null; setCall(null); } // caller hung up / expired
    };
    tick();
    const t = setInterval(tick, 3000);
    const onVis = () => { if (!document.hidden) tick(); };
    document.addEventListener("visibilitychange", onVis);
    return () => { on = false; clearInterval(t); document.removeEventListener("visibilitychange", onVis); };
  }, [user]);

  if (!call) return null;
  const video = call.type === "video";

  const accept = async () => {
    setBusy(true);
    handled.current.add(call.id);
    const r = await respondCall(call.id, true);
    setBusy(false);
    setCall(null);
    if (r.ok && r.roomId) router.push(`/rooms/${r.roomId}`);
  };
  const reject = async () => {
    setBusy(true);
    handled.current.add(call.id);
    await respondCall(call.id, false);
    setBusy(false);
    setCall(null);
  };

  return (
    <div className="fixed inset-0 z-[150] grid place-items-center bg-black/85 p-4">
      <div className="w-full max-w-xs rounded-3xl border border-fuchsia-400/30 bg-ink-850 p-6 text-center shadow-2xl">
        <span className="mx-auto block w-fit animate-pulse rounded-full bg-gradient-to-br from-fuchsia-500 to-purple-600 p-1">
          <Avatar name={call.callerName} size="2xl" />
        </span>
        <h2 className="mt-4 font-display text-xl font-extrabold text-mist-100">{call.callerName}</h2>
        <p className="mt-1 inline-flex items-center gap-1.5 text-sm text-fuchsia-200">
          {video ? <Video className="size-4" /> : <Phone className="size-4" />} Incoming {video ? "video" : "audio"} call…
        </p>
        <div className="mt-6 flex items-center justify-center gap-8">
          <button onClick={reject} disabled={busy} className="grid size-16 place-items-center rounded-full bg-rose-500 text-white shadow-lg transition hover:bg-rose-600 active:scale-95 disabled:opacity-50" aria-label="Decline">
            <PhoneOff className="size-7" />
          </button>
          <button onClick={accept} disabled={busy} className="grid size-16 place-items-center rounded-full bg-emerald-500 text-white shadow-lg transition hover:bg-emerald-600 active:scale-95 disabled:opacity-50" aria-label="Accept">
            {video ? <Video className="size-7" /> : <Phone className="size-7" />}
          </button>
        </div>
        <div className="mt-2.5 flex justify-center gap-[3.25rem] text-xs text-mist-500"><span>Decline</span><span>Accept</span></div>
      </div>
    </div>
  );
}
