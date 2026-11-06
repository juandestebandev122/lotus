"use client";

import { useEffect, useMemo, useState, useCallback } from "react";
import { Card } from "@/components/ui/Card";
import { UserLink, TableSearch, SortSelect, applyFilterSort, type SortDir } from "@/components/admin/TableControls";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import { fetchFeatureRequests, decideFeatureRequest, removeFeatureRequest, type FeatureRequest } from "@/lib/feature-requests";
import { cn } from "@/lib/cn";
import { Check, X, Clock, Pencil, Video, Coins, UserPlus, Trash2, Mic } from "lucide-react";

const STATUS_STYLE: Record<FeatureRequest["status"], string> = {
  pending: "bg-amber-500/15 text-amber-300",
  approved: "bg-emerald-500/15 text-emerald-300",
  rejected: "bg-rose-500/15 text-rose-300",
};

export default function AdminFeatureRequestsPage() {
  const { toast } = useToast();
  const [requests, setRequests] = useState<FeatureRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"pending" | "all">("pending");
  const [busy, setBusy] = useState<string>("");
  const [q, setQ] = useState("");
  const [sort, setSort] = useState("newest");
  const [dir, setDir] = useState<SortDir>("desc");

  const load = useCallback(async () => {
    const r = await fetchFeatureRequests();
    setRequests(r);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
    const t = setInterval(load, 8000);
    return () => clearInterval(t);
  }, [load]);

  const decide = async (id: string, approve: boolean) => {
    setBusy(id);
    const res = await decideFeatureRequest(id, approve);
    setBusy("");
    if (res.ok) {
      toast(approve ? "Approved — applied live" : "Rejected — coins refunded", "success");
      load();
    } else {
      toast(res.error ?? "Could not update", "error");
    }
  };

  const remove = async (id: string) => {
    setBusy(id);
    const ok = await removeFeatureRequest(id);
    setBusy("");
    if (ok) { toast("Request deleted", "success"); load(); }
    else toast("Could not delete request", "error");
  };

  const shown = useMemo(() => applyFilterSort(
    requests.filter((r) => (filter === "pending" ? r.status === "pending" : true)),
    {
      q, sort, dir,
      searchText: (r) => `${r.userName} ${r.userId} ${r.roomName} ${r.type} ${r.payload ?? ""} ${r.status} ${r.decidedBy ?? ""} ${r.note ?? ""}`,
      sortKeys: {
        newest: (r) => new Date(r.at).getTime() || 0,
        user: (r) => r.userName ?? "",
        type: (r) => r.type ?? "",
        room: (r) => r.roomName ?? "",
        coins: (r) => r.coinCost ?? 0,
        status: (r) => r.status ?? "",
      },
    },
  ), [requests, filter, q, sort, dir]);
  const pendingCount = requests.filter((r) => r.status === "pending").length;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-extrabold text-mist-100">Approval Requests</h1>
          <p className="text-sm text-mist-400">Room name changes, video unlocks, extra co-host slots &amp; extra public rooms that members paid for — approve to apply, reject to refund, or delete.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <TableSearch value={q} onChange={setQ} placeholder="Search member, room, type…" className="w-60" />
          <SortSelect
            sort={sort} dir={dir} onSort={setSort} onDir={setDir}
            options={[{ key: "newest", label: "Date" }, { key: "user", label: "Member" }, { key: "type", label: "Type" }, { key: "room", label: "Room" }, { key: "coins", label: "Coins" }, { key: "status", label: "Status" }]}
          />
          <div className="flex gap-1.5 rounded-xl bg-ink-800 p-1">
            {(["pending", "all"] as const).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={cn("rounded-lg px-3 py-1.5 text-xs font-semibold capitalize transition", filter === f ? "bg-lotus-500/25 text-white" : "text-mist-400 hover:text-mist-100")}
              >
                {f === "pending" ? `Pending (${pendingCount})` : "All"}
              </button>
            ))}
          </div>
        </div>
      </div>

      {loading ? (
        <p className="py-10 text-center text-sm text-mist-400">Loading…</p>
      ) : shown.length === 0 ? (
        <Card className="p-10 text-center text-sm text-mist-400">
          {filter === "pending" ? "No requests waiting for approval. 🎉" : "No requests yet."}
        </Card>
      ) : (
        <div className="space-y-3">
          {shown.map((r) => (
            <Card key={r.id} className="flex flex-wrap items-center gap-3 p-4">
              <span className={cn("grid size-10 shrink-0 place-items-center rounded-xl", r.type === "video" ? "bg-lotus-500/15 text-lotus-300" : r.type === "cohost" ? "bg-emerald-500/15 text-emerald-300" : r.type === "public_room" ? "bg-gold-400/15 text-gold-300" : r.type === "group_deletion" ? "bg-rose-500/15 text-rose-300" : "bg-sky-500/15 text-sky-300")}>
                {r.type === "video" ? <Video className="size-5" /> : r.type === "cohost" ? <UserPlus className="size-5" /> : r.type === "public_room" ? <Mic className="size-5" /> : r.type === "group_deletion" ? <Trash2 className="size-5" /> : <Pencil className="size-5" />}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-mist-100">
                  {r.type === "room_name" ? (
                    <>Rename <span className="text-mist-300">&ldquo;{r.roomName}&rdquo;</span> → <span className="text-lotus-200">&ldquo;{r.payload}&rdquo;</span></>
                  ) : r.type === "cohost" ? (
                    <>Add an extra <span className="text-emerald-200">co-host slot</span> in <span className="text-mist-300">&ldquo;{r.roomName}&rdquo;</span></>
                  ) : r.type === "public_room" ? (
                    <>Create an extra <span className="text-gold-300">public room</span> <span className="text-mist-300">&ldquo;{(r.payload ?? "").split("|||")[0] || "My Room"}&rdquo;</span></>
                  ) : r.type === "group_deletion" ? (
                    <><span className="text-rose-300">Delete group</span> <span className="text-mist-300">&ldquo;{r.roomName}&rdquo;</span> <span className="font-mono text-[10px] text-mist-500">({r.roomId})</span></>
                  ) : (
                    <>Unlock video in <span className="text-mist-300">&ldquo;{r.roomName}&rdquo;</span></>
                  )}
                </p>
                {r.type === "group_deletion" && (
                  <p className="mt-0.5 text-xs text-mist-400">
                    <b className="text-mist-300">Reason:</b> {(r.payload ?? "").split("|||")[0] || "—"}
                    {(r.payload ?? "").split("|||")[1] ? <> · <b className="text-mist-300">Notes:</b> {(r.payload ?? "").split("|||")[1]}</> : null}
                  </p>
                )}
                <p className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-mist-500">
                  <span className="inline-flex items-center gap-1">by <UserLink name={r.userName} userId={r.userId} showId={false} className="text-xs" /></span>
                  <span className="inline-flex items-center gap-1 text-gold-300"><Coins className="size-3" /> {r.coinCost}</span>
                  <span>{new Date(r.at).toLocaleString()}</span>
                </p>
                {r.status !== "pending" && (
                  <p className="mt-0.5 text-[11px] text-mist-500">{r.decidedBy ? `${r.status} by ${r.decidedBy}` : r.status}{r.note ? ` — ${r.note}` : ""}</p>
                )}
              </div>
              <div className="flex shrink-0 items-center gap-2">
                {r.status === "pending" ? (
                  <>
                    <Button size="sm" variant="outline" onClick={() => decide(r.id, false)} disabled={busy === r.id}>
                      <X className="size-4" /> Reject
                    </Button>
                    <Button size="sm" onClick={() => decide(r.id, true)} disabled={busy === r.id}>
                      <Check className="size-4" /> Approve
                    </Button>
                  </>
                ) : (
                  <span className={cn("inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold capitalize", STATUS_STYLE[r.status])}>
                    {r.status === "approved" ? <Check className="size-3" /> : r.status === "rejected" ? <X className="size-3" /> : <Clock className="size-3" />}
                    {r.status}
                  </span>
                )}
                <button onClick={() => remove(r.id)} disabled={busy === r.id} title="Delete this request" className="grid size-8 place-items-center rounded-lg text-mist-500 hover:bg-rose-500/10 hover:text-rose-300 disabled:opacity-50">
                  <Trash2 className="size-4" />
                </button>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
