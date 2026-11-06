"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import { cn } from "@/lib/cn";
import { Send, Clock, RotateCcw, Gamepad2, Crown, Home, Armchair, ShieldCheck } from "lucide-react";
import { sendGameInvites, fetchRoomInviteStatus, type GInviteStatus } from "@/lib/game-invites";

// ============================================================
// REAL game invitations. The host sends invites → each recipient gets a
// notification + a live Accept/Reject popup on their OWN device (see
// GameInviteListener). The host sees the real, server-backed status of every
// invite here and can only start once everyone has actually accepted.
// No auto-accept: a player is shown as joined only after they accept.
// ============================================================

export type InviteStatus = GInviteStatus;
const EXPIRE_SECONDS = 60;

const PILL: Record<string, string> = {
  pending: "bg-amber-500/15 text-amber-300",
  accepted: "bg-emerald-500/15 text-emerald-300",
  rejected: "bg-rose-500/15 text-rose-300",
  expired: "bg-mist-500/15 text-mist-400",
  cancelled: "bg-mist-500/15 text-mist-400",
};
const PILL_LABEL: Record<string, string> = {
  pending: "Pending",
  accepted: "Accepted",
  rejected: "Rejected",
  expired: "Expired",
  cancelled: "Cancelled",
};

// Derive the game slug used by the API from the display name.
function gameSlug(name: string): string {
  const n = name.toLowerCase();
  if (n.includes("snake")) return "snake";
  if (n.includes("chess")) return "chess";
  return "ludo";
}

// A friendly, readable list of names: "Ahmed" · "Ahmed & Sara" · "Ahmed, Sara & Omar".
function niceNames(names: string[]): string {
  const n = names.filter(Boolean);
  if (n.length === 0) return "player";
  if (n.length === 1) return n[0];
  return `${n.slice(0, -1).join(", ")} & ${n[n.length - 1]}`;
}

export function GameInvites({
  invitees,
  coHostIds = [],
  gameName,
  roomName,
  roomId,
  onReady,
}: {
  invitees: { id: string; name: string }[];
  coHostIds?: string[];
  gameName: string;
  hostName?: string;
  roomName: string;
  roomId: string;
  // Called with the people who ACCEPTED (id + name + chosen colour) once EVERYONE
  // has accepted, or null while still waiting — the host seats exactly these people.
  onReady: (accepted: { id: string; name: string; color?: string }[] | null) => void;
}) {
  const { toast } = useToast();
  const game = gameSlug(gameName);
  const [sent, setSent] = useState(false);
  const [status, setStatus] = useState<Record<string, InviteStatus>>({});
  const [sentAt, setSentAt] = useState<Record<string, string>>({}); // invite.at by toId
  const [now, setNow] = useState(() => Date.now());
  const [history, setHistory] = useState<{ name: string; time: string; status: InviteStatus }[]>([]);
  const prevStatus = useRef<Record<string, InviteStatus>>({});
  // Each accepter's chosen colour (toId → colour), read when everyone's in.
  const colorByRef = useRef<Record<string, string>>({});
  const isCoHost = useCallback((id: string) => coHostIds.includes(id), [coHostIds]);

  // The invitees we actually SENT to — snapshotted on send so that later changes
  // to the live member list (players accepting then navigating to the game,
  // presence updates, re-ordering) can't reset the invite tracking. THIS is what
  // broke 3/4-player start: the prop churned and wiped the accepted state.
  const [sentInvitees, setSentInvitees] = useState<{ id: string; name: string }[]>([]);
  const tracked = sent ? sentInvitees : invitees;

  // Before sending, reset the tracking when the host changes their selection.
  // Order-insensitive (so re-ordering the SAME people doesn't reset), and it
  // NEVER resets once invites are sent.
  const key = invitees.map((i) => i.id).slice().sort().join(",");
  useEffect(() => {
    if (sent) return;
    setStatus({}); setSentAt({}); setHistory([]); prevStatus.current = {};
  }, [key, sent]);

  const allAccepted = sent && tracked.length > 0 && tracked.every((i) => status[i.id] === "accepted");
  useEffect(() => {
    onReady(allAccepted ? sentInvitees.map((i) => ({ ...i, color: colorByRef.current[i.id] })) : null);
  }, [allAccepted, sentInvitees, onReady]);

  // Poll the REAL invite statuses from the server while any are outstanding.
  useEffect(() => {
    if (!sent) return;
    let active = true;
    const tick = async () => {
      const invites = await fetchRoomInviteStatus(roomId, game);
      if (!active) return;
      const byTo: Record<string, InviteStatus> = {};
      const atBy: Record<string, string> = {};
      const colorBy: Record<string, string> = {};
      // Use the latest invite per recipient.
      for (const inv of invites) { byTo[inv.toId] = inv.status; atBy[inv.toId] = inv.at; if (inv.color) colorBy[inv.toId] = inv.color; }
      colorByRef.current = colorBy;
      // Announce transitions (pending → accepted/rejected/expired).
      const time = new Date().toLocaleTimeString("en-SA", { hour: "2-digit", minute: "2-digit" });
      for (const i of sentInvitees) {
        const next = byTo[i.id];
        const prev = prevStatus.current[i.id];
        if (next && next !== prev && prev === "pending") {
          if (next === "accepted") toast(`${i.name} accepted the invitation ✅`, "success");
          else if (next === "rejected") toast(`${i.name} declined the invitation`, "info");
          else if (next === "expired") toast(`Invitation expired — ${i.name} didn't respond`, "info");
          setHistory((h) => [{ name: i.name, time, status: next }, ...h]);
        }
      }
      prevStatus.current = byTo;
      setStatus(byTo);
      setSentAt(atBy);
      setNow(Date.now());
    };
    tick();
    const t = setInterval(tick, 3000);
    return () => { active = false; clearInterval(t); };
  }, [sent, roomId, game, sentInvitees, toast]);

  const send = useCallback(async () => {
    const list = invitees;
    const toIds = list.map((i) => i.id);
    if (toIds.length === 0) return;
    const res = await sendGameInvites({ roomId, game, gameName, toIds });
    if (!res.ok) { toast(res.error ?? "Could not send invitations", "error"); return; }
    const time = new Date().toLocaleTimeString("en-SA", { hour: "2-digit", minute: "2-digit" });
    const init: Record<string, InviteStatus> = {};
    const atBy: Record<string, string> = {};
    list.forEach((i) => { init[i.id] = "pending"; atBy[i.id] = new Date().toISOString(); });
    setSentInvitees(list); // lock the invitee set for the rest of this invite round
    prevStatus.current = init;
    setStatus(init); setSentAt(atBy); setNow(Date.now()); setSent(true);
    setHistory(list.map((i) => ({ name: i.name, time, status: "pending" as InviteStatus })));
    // Confirmation names the actual invitee(s): "Invitation sent to Ahmed".
    toast(`Invitation${toIds.length > 1 ? "s" : ""} sent to ${niceNames(list.map((i) => i.name))} — waiting to accept`, "success");
  }, [invitees, roomId, game, gameName, toast]);

  if (!sent) {
    // Dynamic label names who you're inviting: "Invite Ahmed" / "Invite Ahmed & Sara".
    return (
      <Button block size="lg" className="mt-5" disabled={invitees.length === 0} onClick={send}>
        <Send className="size-5" /> {invitees.length === 0 ? "Select a player to invite" : `Invite ${niceNames(invitees.map((i) => i.name))}`}
      </Button>
    );
  }

  const accepted = tracked.filter((i) => status[i.id] === "accepted").length;
  const pending = tracked.filter((i) => (status[i.id] ?? "pending") === "pending").length;
  const declined = tracked.filter((i) => status[i.id] === "rejected" || status[i.id] === "expired").length;
  const anyClosed = declined > 0 && pending === 0;
  const roomTag = roomId.length > 6 ? roomId.slice(-6) : roomId;

  return (
    <div className="mt-5 space-y-3">
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <span className="font-semibold text-mist-200">Invitations</span>
        <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 font-semibold text-emerald-300">{accepted} accepted</span>
        <span className="rounded-full bg-amber-500/15 px-2 py-0.5 font-semibold text-amber-300">{pending} pending</span>
        <span className="rounded-full bg-rose-500/15 px-2 py-0.5 font-semibold text-rose-300">{declined} declined</span>
      </div>

      {tracked.map((i) => {
        const st = (status[i.id] ?? "pending") as InviteStatus;
        const cohost = isCoHost(i.id);

        if (st === "pending") {
          const at = sentAt[i.id] ? new Date(sentAt[i.id]).getTime() : now;
          const remaining = Math.max(0, Math.ceil((at + EXPIRE_SECONDS * 1000 - now) / 1000));
          return (
            <div key={i.id} className="rounded-2xl border border-amber-400/30 bg-amber-500/[0.06] p-4">
              <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-amber-300">
                <Gamepad2 className="size-4" /> Invitation sent
              </div>
              <div className="mt-2 flex items-center gap-3">
                <Avatar name={i.name} size="md" />
                <div className="min-w-0 flex-1">
                  <p className="font-display text-base font-bold text-mist-100">Waiting for {i.name} to accept…</p>
                  <p className="flex items-center gap-1 text-xs text-mist-400">
                    <Home className="size-3" /> {roomName} <span className="text-mist-500">#{roomTag}</span> · {gameName}
                  </p>
                  {cohost && (
                    <span className="mt-1 inline-flex items-center gap-1 text-[11px] text-lotus-300"><ShieldCheck className="size-3.5" /> Co-Host</span>
                  )}
                </div>
                <div className="text-center">
                  <div className={cn("grid size-11 place-items-center rounded-full text-sm font-bold tabular-nums", remaining <= 10 ? "bg-rose-500/20 text-rose-300" : "bg-ink-800 text-mist-100")}>{remaining}</div>
                  <div className="mt-0.5 text-[10px] text-mist-500">sec</div>
                </div>
              </div>
            </div>
          );
        }

        return (
          <div key={i.id} className="flex items-center gap-2.5 rounded-lg border border-line bg-ink-800 px-2.5 py-2">
            <Avatar name={i.name} size="xs" />
            <span className="text-sm text-mist-100">{i.name}</span>
            {cohost && (
              <span className="inline-flex items-center gap-1 rounded-full bg-lotus-500/15 px-1.5 py-0.5 text-[10px] font-semibold text-lotus-300">
                <ShieldCheck className="size-3" /> Co-Host
              </span>
            )}
            <span className="ml-auto inline-flex items-center gap-1.5 text-[11px] text-mist-500">
              <Armchair className={cn("size-3.5", st === "accepted" ? "text-emerald-300" : "text-mist-600")} />
              {st === "accepted" ? "Joined" : "Not joined"}
            </span>
            <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-semibold", PILL[st] ?? PILL.pending)}>{PILL_LABEL[st] ?? st}</span>
          </div>
        );
      })}

      <p className="text-[11px] text-mist-500">
        Each player accepts on their own device. A player is shown as <span className="text-emerald-300">Joined</span> only after they accept.
      </p>

      {anyClosed && (
        <Button block variant="secondary" onClick={send}>
          <RotateCcw className="size-4" /> Resend invitations
        </Button>
      )}

      <div className="rounded-xl border border-white/8 bg-ink-850/50 p-3">
        <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-mist-300">
          <Clock className="size-3.5 text-mist-400" /> Invitation history
        </p>
        <div className="space-y-1">
          {history.length === 0 ? (
            <p className="text-[11px] text-mist-500">No invitations sent yet.</p>
          ) : (
            history.map((h, idx) => (
              <div key={idx} className="flex items-center gap-2 text-[11px]">
                <Crown className="size-3 text-gold-400/0" />
                <span className="text-mist-200">{h.name}</span>
                <span className="text-mist-500">· {h.time}</span>
                <span className={cn("ml-auto rounded-full px-1.5 py-0.5 font-semibold", PILL[h.status] ?? PILL.pending)}>{PILL_LABEL[h.status] ?? h.status}</span>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
