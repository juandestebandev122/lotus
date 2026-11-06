import { Gift as GiftIcon } from "lucide-react";
import { Card } from "@/components/ui/Card";
import type { ReceivedGift } from "@/lib/types";

/** "Gifts Received" panel — shows gifts other players sent to this profile. */
export function GiftsReceived({ gifts, name }: { gifts: ReceivedGift[]; name?: string }) {
  return (
    <Card className="p-5">
      <div className="mb-4 flex items-center gap-2">
        <span className="grid size-8 place-items-center rounded-lg bg-gradient-to-br from-amber-400 to-pink-500 text-white">
          <GiftIcon className="size-4" />
        </span>
        <h3 className="font-display text-lg font-bold text-mist-100">Gifts Received</h3>
        {gifts.length > 0 && (
          <span className="ml-auto rounded-full bg-white/[0.06] px-2.5 py-1 text-xs font-semibold text-mist-300">{gifts.length}</span>
        )}
      </div>
      {gifts.length === 0 ? (
        <p className="py-6 text-center text-sm text-mist-500">
          {name ? `${name} hasn't received any gifts yet.` : "No gifts yet — when another player sends you a gift, it shows up here."} 🎁
        </p>
      ) : (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {gifts.slice(0, 24).map((g) => (
            <div key={g.id} className="flex items-center gap-3 rounded-xl border border-white/8 bg-ink-800 p-3">
              <span className="text-3xl leading-none">{g.emoji}</span>
              <div className="min-w-0">
                <div className="truncate text-sm font-semibold text-mist-100">{g.name}</div>
                <div className="truncate text-xs text-mist-400">
                  from {g.fromName}
                  {g.fromPublicId && <span className="ml-1.5 font-mono text-[11px] text-mist-500">ID {g.fromPublicId}</span>}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}
