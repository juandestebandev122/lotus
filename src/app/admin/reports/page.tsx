"use client";

import { useState } from "react";
import { Card } from "@/components/ui/Card";
import { Avatar } from "@/components/ui/Avatar";
import { useToast } from "@/components/ui/Toast";
import { useConfig, saveConfig } from "@/lib/config";
import { cn } from "@/lib/cn";
import { Flag, Check, Ban, Clock } from "lucide-react";
import { IS_PROD_SITE } from "@/lib/prod";

interface Report {
  id: string;
  reported: string;
  reason: string;
  detail: string;
  by: string;
  time: string;
}

// Sample moderation queue. Each report's resolution is stored in the
// platform config (config.moderation) so admin actions persist.
const QUEUE: Report[] = IS_PROD_SITE
  ? []
  : [
      { id: "r1", reported: "Karan Singh", reason: "Abusive language", detail: "Used offensive words in a voice room.", by: "Muskan Gupta", time: "10m ago" },
      { id: "r2", reported: "Rohit Kumar", reason: "Spam", detail: "Posting promo links in group chat repeatedly.", by: "Aryan Verma", time: "1h ago" },
      { id: "r3", reported: "Anjali Mehta", reason: "Cheating", detail: "Suspected of using a bot in a Ludo tournament.", by: "Pooja Sharma", time: "3h ago" },
      { id: "r4", reported: "Vikram Khanna", reason: "Inappropriate content", detail: "Shared an unsuitable video link.", by: "Sneha Verma", time: "yesterday" },
    ];

type Resolution = "actioned" | "dismissed" | undefined;

const PILL: Record<"open" | "actioned" | "dismissed", string> = {
  open: "bg-amber-500/15 text-amber-300",
  actioned: "bg-emerald-500/15 text-emerald-300",
  dismissed: "bg-mist-500/15 text-mist-400",
};
const LABEL: Record<"open" | "actioned" | "dismissed", string> = {
  open: "open",
  actioned: "resolved",
  dismissed: "dismissed",
};

export default function AdminReportsPage() {
  const { config, loading, reload } = useConfig();
  const { toast } = useToast();
  const [busy, setBusy] = useState<string | null>(null);

  const resolutionOf = (id: string): Resolution => config.moderation[id];
  const openCount = QUEUE.filter((r) => !resolutionOf(r.id)).length;

  const act = async (id: string, resolution: "actioned" | "dismissed", msg: string) => {
    setBusy(id);
    const res = await saveConfig({ moderation: { ...config.moderation, [id]: resolution } });
    setBusy(null);
    if (!res.ok) {
      toast(res.error ?? "Could not save", "error");
      return;
    }
    await reload();
    toast(msg, resolution === "dismissed" ? "info" : "success");
  };

  return (
    <div className="space-y-5">
      <div>
        <h1 className="font-display text-2xl font-extrabold text-mist-100">Reports &amp; moderation</h1>
        <p className="text-sm text-mist-400">{openCount} open reports · review and take action.</p>
      </div>

      <div className="space-y-3">
        {QUEUE.map((r) => {
          const resolution = resolutionOf(r.id);
          const state = resolution ?? "open";
          return (
            <Card key={r.id} className="p-4">
              <div className="flex flex-wrap items-start gap-3">
                <span className="grid size-10 shrink-0 place-items-center rounded-full bg-rose-500/15 text-rose-300">
                  <Flag className="size-5" />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-semibold text-mist-100">{r.reported}</span>
                    <span className="rounded-full bg-rose-500/15 px-2 py-0.5 text-[11px] font-semibold text-rose-300">{r.reason}</span>
                    <span className={cn("rounded-full px-2 py-0.5 text-[11px] font-semibold capitalize", PILL[state])}>{LABEL[state]}</span>
                  </div>
                  <p className="mt-1 text-sm text-mist-300">{r.detail}</p>
                  <p className="mt-1 flex items-center gap-1.5 text-xs text-mist-500">
                    <Avatar name={r.by} size="xs" /> Reported by {r.by} · <Clock className="size-3" /> {r.time}
                  </p>
                </div>
                {!resolution && (
                  <div className="flex shrink-0 gap-2">
                    <button
                      onClick={() => act(r.id, "actioned", `Action taken on ${r.reported}`)}
                      disabled={loading || busy === r.id}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-500/15 px-3 py-1.5 text-xs font-semibold text-emerald-300 hover:bg-emerald-500/25 disabled:opacity-50"
                    >
                      <Ban className="size-3.5" /> Take action
                    </button>
                    <button
                      onClick={() => act(r.id, "dismissed", `Report on ${r.reported} dismissed`)}
                      disabled={loading || busy === r.id}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-white/[0.06] px-3 py-1.5 text-xs font-semibold text-mist-300 hover:text-mist-100 disabled:opacity-50"
                    >
                      <Check className="size-3.5" /> Dismiss
                    </button>
                  </div>
                )}
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
