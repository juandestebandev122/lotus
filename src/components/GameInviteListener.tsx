"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import { useAuth } from "@/lib/auth";
import { fetchMyGameInvites, respondGameInvite, type GameInviteView } from "@/lib/game-invites";
import { fetchTakenColors, claimColor } from "@/lib/game-colors";
import { cn } from "@/lib/cn";
import { Gamepad2, Home, Check, X } from "lucide-react";

const TTL_SECONDS = 60;

// The four Ludo seat colours the invitee can request when accepting.
const LUDO_COLORS: { key: string; label: string; cls: string }[] = [
  { key: "red", label: "Red", cls: "bg-red-500" },
  { key: "green", label: "Green", cls: "bg-green-600" },
  { key: "yellow", label: "Yellow", cls: "bg-yellow-400" },
  { key: "blue", label: "Blue", cls: "bg-blue-600" },
];
// Diagonal (opposite-corner) colour pairs — for a 2-player game the invitee
// defaults to the OPPOSITE of the host's colour, so the two sit on opposite sides.
const LUDO_DIAG: Record<string, string> = { red: "yellow", yellow: "red", green: "blue", blue: "green" };

// App-wide listener for incoming game invitations / join requests. Polls the
// server and shows a call-style Accept/Reject popup on ANY screen, so the
// recipient genuinely receives the invite (no more silent/auto-accept).
export function GameInviteListener() {
  const { user } = useAuth();
  const { toast } = useToast();
  const router = useRouter();
  const [invite, setInvite] = useState<GameInviteView | null>(null);
  const [secs, setSecs] = useState(TTL_SECONDS);
  const [busy, setBusy] = useState(false);
  // The colour the invitee wants (Ludo only). We reserve a FREE colour live so
  // every player genuinely gets the colour they choose (no duplicates).
  const [color, setColor] = useState<string>("red");
  const [taken, setTaken] = useState<string[]>([]);
  const dismissed = useRef<Set<string>>(new Set());
  const currentId = useRef<string | null>(null);
  // Colour choice only makes sense when *I* am being invited to play Ludo — not
  // on a host's "someone wants to join" approval popup.
  const showColorPick = invite?.game === "ludo" && invite?.kind !== "request";

  // Poll for pending invites addressed to me.
  useEffect(() => {
    if (!user) return;
    let active = true;
    const tick = async () => {
      // Don't poll while the app is backgrounded — saves mobile data (the user
      // isn't looking; pending invites are still here when they return).
      if (typeof document !== "undefined" && document.hidden) return;
      const mine = await fetchMyGameInvites();
      if (!active) return;
      const next = mine.find((i) => !dismissed.current.has(i.id));
      if (next && next.id !== currentId.current) {
        currentId.current = next.id;
        setInvite(next);
        setColor("red"); // reset the colour choice for each new invite
        const age = Math.floor((Date.now() - new Date(next.at).getTime()) / 1000);
        setSecs(Math.max(1, TTL_SECONDS - age));
      } else if (!next && currentId.current) {
        currentId.current = null;
        setInvite(null);
      }
    };
    tick();
    const t = setInterval(tick, 6000);
    const onVis = () => { if (!document.hidden) tick(); }; // refresh on return
    document.addEventListener("visibilitychange", onVis);
    return () => { active = false; clearInterval(t); document.removeEventListener("visibilitychange", onVis); };
  }, [user]);

  // Countdown — auto-dismiss when the invite expires.
  useEffect(() => {
    if (!invite) return;
    const t = setInterval(() => {
      setSecs((s) => {
        if (s <= 1) {
          dismissed.current.add(invite.id);
          currentId.current = null;
          setInvite(null);
          return 0;
        }
        return s - 1;
      });
    }, 1000);
    return () => clearInterval(t);
  }, [invite]);

  // Ludo: keep the taken-colours list live and RESERVE a free colour for me, so
  // the colour I choose is genuinely mine at game start (no duplicates).
  const colorRef = useRef(color);
  colorRef.current = color;
  const explicitRef = useRef(false); // did the invitee TAP a colour themselves?
  useEffect(() => { explicitRef.current = false; }, [invite?.id]); // reset per invite
  useEffect(() => {
    if (!invite || !showColorPick) { setTaken([]); return; }
    const roomId = invite.roomId;
    let active = true;
    const load = async () => {
      const t = await fetchTakenColors(roomId);
      if (!active) return;
      let want = colorRef.current;
      // 2-player default: sit OPPOSITE the host (diagonal of the single taken
      // colour) — unless the invitee explicitly tapped a colour.
      const diag = t.length === 1 ? LUDO_DIAG[t[0]] : undefined;
      if (!explicitRef.current && diag && !t.includes(diag)) {
        want = diag;
      } else if (t.includes(want)) {
        want = LUDO_COLORS.find((c) => !t.includes(c.key))?.key ?? want;
      }
      const r = await claimColor(roomId, want);
      if (!active) return;
      setColor(want);
      setTaken(r.taken);
    };
    load();
    const iv = setInterval(load, 4000);
    return () => { active = false; clearInterval(iv); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [invite?.id, showColorPick]);

  const pickColor = useCallback(async (key: string) => {
    if (!invite) return;
    explicitRef.current = true; // the invitee chose this colour on purpose
    setColor(key);
    const r = await claimColor(invite.roomId, key);
    setTaken(r.taken);
    if (r.conflict) {
      const free = LUDO_COLORS.find((c) => !r.taken.includes(c.key))?.key;
      if (free) { setColor(free); const r2 = await claimColor(invite.roomId, free); setTaken(r2.taken); }
    }
  }, [invite]);

  const respond = useCallback(async (accept: boolean) => {
    if (!invite) return;
    setBusy(true);
    // Send the chosen colour only when I'm the one being invited to play Ludo.
    // Use colorRef.current (always the LATEST pick) — NOT the `color` closure,
    // which this callback captured when the invite arrived (before the invitee
    // tapped a colour). Reading the stale `color` sent the DEFAULT colour instead
    // of the one they chose → "picked blue but got red". colorRef fixes that.
    const chosen = colorRef.current;
    const res = await respondGameInvite(invite.id, accept, invite.game === "ludo" && invite.kind !== "request" ? chosen : undefined);
    setBusy(false);
    dismissed.current.add(invite.id);
    currentId.current = null;
    setInvite(null);
    if (!res.ok) { toast(res.error ?? "Could not respond", "error"); return; }
    if (accept) {
      toast(`Joining ${invite.fromName}'s ${invite.gameName} game 🎮`, "success");
      // Land the player directly on the shared game board so they play their own
      // turn — not just the room. The board auto-joins the running session.
      const slug = ["ludo", "snake", "chess"].includes(invite.game) ? invite.game : "";
      router.push(slug ? `/games/${slug}?room=${encodeURIComponent(invite.roomId)}&join=1` : `/rooms/${invite.roomId}`);
    } else {
      toast("Invitation declined", "info");
    }
  }, [invite, router, toast]);

  if (!invite) return null;

  return (
    <div className="fixed inset-x-0 top-3 z-[300] flex justify-center px-4">
      <div className="w-full max-w-sm animate-rise rounded-2xl border border-lotus-400/30 bg-ink-850/95 p-4 shadow-2xl backdrop-blur">
        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-lotus-300">
          <Gamepad2 className="size-4" /> {invite.kind === "request" ? "Join request" : "Game invitation"}
          <span className={`ml-auto grid size-7 place-items-center rounded-full text-xs font-bold tabular-nums ${secs <= 10 ? "bg-rose-500/20 text-rose-300" : "bg-ink-800 text-mist-200"}`}>{secs}</span>
        </div>
        <div className="mt-3 flex items-center gap-3">
          <Avatar name={invite.fromName} size="md" />
          <div className="min-w-0">
            <p className="font-display text-base font-bold text-mist-100">
              {invite.fromName} {invite.kind === "request" ? "wants to join your" : "invited you to play"} <span className="text-lotus-300">{invite.gameName}</span>
            </p>
            <p className="flex items-center gap-1 text-xs text-mist-400"><Home className="size-3" /> Tap Accept to join the game</p>
          </div>
        </div>
        {/* Ludo: pick the colour you want to play before accepting. */}
        {showColorPick && (
          <div className="mt-3 rounded-xl border border-white/8 bg-ink-900/50 p-2.5">
            <p className="mb-2 text-[11px] font-semibold text-mist-300">Choose your colour</p>
            <div className="flex items-center justify-between gap-2">
              {LUDO_COLORS.map((c) => {
                const on = color === c.key;
                const isTaken = !on && taken.includes(c.key);
                return (
                  <button
                    key={c.key}
                    type="button"
                    disabled={isTaken}
                    onClick={() => pickColor(c.key)}
                    aria-label={isTaken ? `${c.label} (taken)` : c.label}
                    className={cn(
                      "relative grid size-10 flex-1 place-items-center rounded-full border-2 transition",
                      c.cls,
                      on ? "scale-105 border-white shadow-[0_0_0_3px_rgba(255,255,255,0.25)]" : "border-white/25 hover:scale-105",
                      isTaken && "cursor-not-allowed opacity-30 hover:scale-100",
                    )}
                  >
                    {on && (
                      <span className="grid size-5 place-items-center rounded-full bg-white">
                        <Check className="size-3.5 text-ink-900" />
                      </span>
                    )}
                    {isTaken && <X className="size-4 text-white/80" />}
                  </button>
                );
              })}
            </div>
            <p className="mt-1.5 text-center text-[10px] text-mist-500">This colour is reserved for you. Faded colours are taken by others.</p>
          </div>
        )}
        <div className="mt-4 flex gap-2">
          <Button block disabled={busy} onClick={() => respond(true)}><Check className="size-4" /> Accept</Button>
          <Button block variant="outline" disabled={busy} onClick={() => respond(false)}><X className="size-4" /> Reject</Button>
        </div>
      </div>
    </div>
  );
}
