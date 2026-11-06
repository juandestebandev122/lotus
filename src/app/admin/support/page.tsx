"use client";

import { useEffect, useMemo, useState } from "react";
import { Card } from "@/components/ui/Card";
import { UserLink, TableSearch, SortSelect, applyFilterSort, type SortDir } from "@/components/admin/TableControls";
import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import { fetchSupportTickets, updateSupportTicket, deleteSupportTicket, type SupportTicket } from "@/lib/admin";
import { cn } from "@/lib/cn";
import { LifeBuoy, Send, Clock, Trash2, Mail } from "lucide-react";

type Status = SupportTicket["status"];

const PILL: Record<Status, string> = {
  open: "bg-amber-500/15 text-amber-300",
  in_progress: "bg-sky-500/15 text-sky-300",
  resolved: "bg-emerald-500/15 text-emerald-300",
};
const LABEL: Record<Status, string> = { open: "Open", in_progress: "In progress", resolved: "Resolved" };

export default function AdminSupportPage() {
  const { toast } = useToast();
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | Status>("all");
  const [replyFor, setReplyFor] = useState<string | null>(null);
  const [replyText, setReplyText] = useState("");
  const [q, setQ] = useState("");
  const [sort, setSort] = useState("newest");
  const [dir, setDir] = useState<SortDir>("desc");

  const load = () => fetchSupportTickets().then((t) => { setTickets(t); setLoading(false); });
  useEffect(() => { load(); }, []);

  const setStatus = async (t: SupportTicket, status: Status) => {
    setTickets((ts) => ts.map((x) => (x.id === t.id ? { ...x, status } : x)));
    const ok = await updateSupportTicket(t.id, { status });
    toast(ok ? `Ticket marked ${LABEL[status]}` : "Could not update", ok ? "success" : "error");
  };

  const removeTicket = async (t: SupportTicket) => {
    if (!confirm(`Delete this ticket permanently?\n\n"${t.subject}"\nfrom ${t.userName}\n\nThis cannot be undone.`)) return;
    const ok = await deleteSupportTicket(t.id);
    if (ok) {
      setTickets((ts) => ts.filter((x) => x.id !== t.id));
      toast("Ticket deleted", "success");
    } else toast("Could not delete the ticket", "error");
  };

  const sendReply = async (t: SupportTicket) => {
    if (!replyText.trim()) return;
    const ok = await updateSupportTicket(t.id, { reply: replyText.trim(), status: "resolved" });
    if (ok) {
      setTickets((ts) => ts.map((x) => (x.id === t.id ? { ...x, reply: replyText.trim(), status: "resolved" } : x)));
      toast("Reply sent · ticket resolved", "success");
      setReplyFor(null);
      setReplyText("");
    } else {
      toast("Could not send reply", "error");
    }
  };

  const shown = useMemo(() => applyFilterSort(
    tickets.filter((t) => filter === "all" || t.status === filter),
    {
      q, sort, dir,
      searchText: (t) => `${t.userName} ${t.publicId ?? ""} ${t.username ?? ""} ${t.subject} ${t.message} ${t.reply ?? ""} ${t.status}`,
      sortKeys: {
        newest: (t) => new Date(t.createdAt).getTime() || 0,
        user: (t) => t.userName ?? "",
        subject: (t) => t.subject ?? "",
        status: (t) => t.status ?? "",
      },
    },
  ), [tickets, filter, q, sort, dir]);
  const openCount = tickets.filter((t) => t.status !== "resolved").length;

  return (
    <div className="space-y-5">
      <div>
        <h1 className="font-display text-2xl font-extrabold text-mist-100">Support &amp; feedback</h1>
        <p className="text-sm text-mist-400">
          {loading ? "Loading…" : `${openCount} open · ${tickets.length} total`} — reply to users and track resolution.
        </p>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex gap-2">
          {(["all", "open", "in_progress", "resolved"] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={cn(
                "rounded-full px-3.5 py-1.5 text-sm font-semibold capitalize transition",
                filter === f ? "bg-lotus-600 text-white" : "border border-line bg-ink-800 text-mist-400 hover:text-mist-100",
              )}
            >
              {f === "all" ? "All" : LABEL[f]}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <TableSearch value={q} onChange={setQ} placeholder="Search user, ID, subject…" className="w-60" />
          <SortSelect
            sort={sort} dir={dir} onSort={setSort} onDir={setDir}
            options={[{ key: "newest", label: "Date" }, { key: "user", label: "User" }, { key: "subject", label: "Subject" }, { key: "status", label: "Status" }]}
          />
        </div>
      </div>

      <div className="space-y-3">
        {shown.map((t) => (
          <Card key={t.id} className="p-4">
            <div className="flex flex-wrap items-start gap-3">
              <Avatar name={t.userName} size="md" />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-semibold text-mist-100">{t.subject}</span>
                  <span className={cn("rounded-full px-2 py-0.5 text-[11px] font-semibold", PILL[t.status])}>{LABEL[t.status]}</span>
                </div>
                <p className="mt-1 text-sm text-mist-300">{t.message}</p>
                <p className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-mist-500">
                  <LifeBuoy className="size-3" />
                  {/* A contact-form message has no account behind it, so show the
                      name and the email they gave us instead of a user link. */}
                  {t.source === "contact-form"
                    ? <span className="text-mist-400">{t.userName}</span>
                    : <UserLink name={t.userName} publicId={t.publicId} userId={t.userId} username={t.username} className="text-xs" />}
                  · <Clock className="size-3" /> {new Date(t.createdAt).toLocaleDateString("en-SA", { day: "numeric", month: "short" })}
                </p>
                {t.source === "contact-form" && (
                  <p className="mt-1 flex flex-wrap items-center gap-2 text-xs">
                    <span className="rounded-full bg-sky-500/15 px-2 py-0.5 text-[11px] font-semibold text-sky-300">Website contact form</span>
                    {t.email && (
                      <a href={`mailto:${t.email}?subject=Re: ${encodeURIComponent(t.subject)}`} className="inline-flex items-center gap-1 text-lotus-300 hover:underline">
                        <Mail className="size-3" /> {t.email}
                      </a>
                    )}
                    <span className="text-mist-600">Replying here won&apos;t reach them — they have no account. Use the email link.</span>
                  </p>
                )}
                {t.reply && (
                  <div className="mt-2 rounded-lg border border-emerald-400/20 bg-emerald-500/[0.06] px-3 py-2 text-sm text-emerald-100">
                    <span className="font-semibold">Reply:</span> {t.reply}
                  </div>
                )}

                {replyFor === t.id && (
                  <div className="mt-2 flex gap-2">
                    <input
                      value={replyText}
                      onChange={(e) => setReplyText(e.target.value)}
                      placeholder="Type your reply…"
                      className="h-9 flex-1 rounded-lg border border-line bg-ink-900 px-3 text-sm text-mist-100 outline-none focus:border-lotus-400"
                    />
                    <Button size="sm" onClick={() => sendReply(t)}><Send className="size-3.5" /> Send</Button>
                  </div>
                )}
              </div>

              <div className="flex shrink-0 flex-col items-end gap-1.5">
                {t.status !== "resolved" && (
                  <button onClick={() => { setReplyFor(replyFor === t.id ? null : t.id); setReplyText(""); }} className="rounded-lg bg-lotus-500/15 px-3 py-1.5 text-xs font-semibold text-lotus-300 hover:bg-lotus-500/25">
                    Reply
                  </button>
                )}
                {t.status === "open" && (
                  <button onClick={() => setStatus(t, "in_progress")} className="rounded-lg bg-white/[0.06] px-3 py-1.5 text-xs font-semibold text-mist-300 hover:text-mist-100">
                    Start
                  </button>
                )}
                {t.status !== "resolved" && (
                  <button onClick={() => setStatus(t, "resolved")} className="rounded-lg bg-emerald-500/15 px-3 py-1.5 text-xs font-semibold text-emerald-300 hover:bg-emerald-500/25">
                    Resolve
                  </button>
                )}
                {/* Needed now the public contact form exists: spam has to be
                    removable, not just closed. */}
                <button onClick={() => removeTicket(t)} title="Delete this ticket permanently" className="rounded-lg bg-white/[0.04] px-3 py-1.5 text-xs font-semibold text-rose-300/80 hover:bg-rose-500/15 hover:text-rose-200">
                  <Trash2 className="mr-1 inline size-3" /> Delete
                </button>
              </div>
            </div>
          </Card>
        ))}
        {!loading && shown.length === 0 && (
          <Card className="p-10 text-center text-sm text-mist-500">No tickets in this view.</Card>
        )}
      </div>
    </div>
  );
}
