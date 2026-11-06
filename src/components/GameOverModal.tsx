"use client";

import { useEffect, useState } from "react";
import { Trophy, RotateCcw, Home, X } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/cn";
import { withBase } from "@/lib/base-path";
import { APP_VERSION, lifelog } from "@/lib/lifelog";

// How long (ms) the results screen stays FULLY LOCKED after a game ends — no
// button works, nothing can dismiss or navigate. This guarantees every player
// gets a clear, uninterrupted look at the winner before anything can happen.
// (The client repeatedly reported the result "disappearing too quickly": a tap,
// queued click, or mobile ghost-tap was firing the Back-to-Room button the
// instant it became active. A long, obvious locked window makes that impossible.)
const RESULT_LOCK_MS = 3500;

/**
 * Shown when a game finishes. It NEVER auto-dismisses and NEVER auto-returns
 * anyone — it stays on screen until the player makes an explicit choice:
 *   • Play Again        → start a new round
 *   • Back to Room      → return to the voice room (only this player leaves)
 *   • ✕ (top-right)     → close the popup and view the final board
 *
 * SAFEGUARDS so it can't vanish on its own:
 *  1) No big "close" button — closing is a small, deliberate ✕ in the corner.
 *  2) EVERY control is fully INERT for RESULT_LOCK_MS after it opens, with a
 *     visible countdown — so the tap that ended the game, a queued click, or a
 *     mobile "ghost click" can't dismiss/navigate before the winner is seen.
 */
export function GameOverModal({
  winner,
  rank,
  isYou,
  onPlayAgain,
  onStay,
  onBackToRoom,
  onClose,
}: {
  winner: string;
  rank?: string;
  isYou?: boolean;
  onPlayAgain?: () => void;
  onStay?: () => void; // "close to view the board" (kept name for callers)
  onBackToRoom?: () => void;
  onClose?: () => void;
}) {
  const [armed, setArmed] = useState(false);
  const [secs, setSecs] = useState(Math.ceil(RESULT_LOCK_MS / 1000));
  useEffect(() => {
    lifelog("modal:mount", { winner });
    const t = setTimeout(() => setArmed(true), RESULT_LOCK_MS);
    const iv = setInterval(() => setSecs((s) => (s > 1 ? s - 1 : 1)), 1000);
    return () => { clearTimeout(t); clearInterval(iv); lifelog("modal:UNMOUNT", { winner }); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const dismiss = onStay ?? onClose; // the ✕ closes the popup to view the board

  return (
    <div className="fixed inset-0 z-[120] grid place-items-center bg-black/75 p-4">
      <div className="animate-modal-pop relative w-full max-w-sm rounded-2xl border border-gold-400/30 bg-ink-850 p-6 text-center shadow-2xl">
        {/* Small, deliberate close — view the final board. Armed after a moment. */}
        {dismiss && (
          <button
            type="button"
            aria-label="Close results and view the board"
            title="View the final board"
            disabled={!armed}
            onClick={() => armed && dismiss()}
            className={cn(
              "absolute right-3 top-3 grid size-8 place-items-center rounded-full text-mist-400 transition hover:bg-white/10 hover:text-mist-100",
              !armed && "pointer-events-none opacity-40",
            )}
          >
            <X className="size-4" />
          </button>
        )}

        <span className="mx-auto grid size-16 place-items-center rounded-2xl bg-gradient-to-br from-gold-400/30 to-amber-500/20">
          <Trophy className="size-9 text-gold-300" />
        </span>
        <h2 className="mt-4 font-display text-2xl font-extrabold text-mist-100">🏆 Game Completed</h2>
        <p className="mt-2 font-display text-lg font-bold text-gold-300">Winner: {winner}</p>
        {rank && <p className="text-sm text-mist-300">{rank}</p>}
        <p className="mt-1 text-sm text-mist-400">
          {isYou ? "Congratulations! You won the game. 🎉" : `Congratulations to ${winner}! 🎉`}
        </p>

        <div className={cn("mt-6 flex flex-col gap-2 transition-opacity", !armed && "pointer-events-none opacity-60")}>
          {onPlayAgain && (
            <Button block disabled={!armed} onClick={() => armed && onPlayAgain()}>
              <RotateCcw className="size-4" /> Play Again
            </Button>
          )}
          {onBackToRoom && (
            <Button variant="secondary" block disabled={!armed} onClick={() => armed && onBackToRoom()}>
              <Home className="size-4" /> Back to Room
            </Button>
          )}
          {onClose && !onBackToRoom && (
            <Button variant="secondary" block disabled={!armed} onClick={() => armed && onClose()}>
              <X className="size-4" /> Close
            </Button>
          )}
          {/* Full history of every match this player has finished. */}
          <a href={withBase("/games/history")} className="mt-1 text-center text-xs font-semibold text-lotus-300 underline underline-offset-2 hover:text-lotus-200">
            View match history
          </a>
        </div>
        <p className="mt-3 text-[11px] text-mist-500">
          {armed
            ? "These results stay until you choose. Tap ✕ to just view the final board."
            : `Enjoy the result… you can continue in ${secs}s`}
        </p>
        <p className="mt-1 text-[10px] text-mist-600">Lotus Ludo · {APP_VERSION}</p>
      </div>
    </div>
  );
}
