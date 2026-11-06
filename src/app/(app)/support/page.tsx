"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { LifeBuoy, ChevronDown, Send, Loader2, CheckCircle2, Clock, MessageSquare } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { ScreenShareSupport } from "@/components/support/ScreenShareSupport";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import { cn } from "@/lib/cn";
import { withBase } from "@/lib/base-path";

interface Ticket { id: string; subject: string; message: string; status: "open" | "in_progress" | "resolved"; reply?: string; createdAt: string }

const FAQ: { q: string; a: string }[] = [
  { q: "How do I earn coins?", a: "Play games, win matches, send/receive gifts, spin the daily Lucky Spin, refer friends, and log in daily. You can also buy coins from your Wallet." },
  { q: "How do I create or join a voice room?", a: "Open Voice Rooms from the menu, then tap Join a room to enter one, or Create room to start your own and invite friends." },
  { q: "How do I verify my account?", a: "Go to Verify Account (KYC) from the More Options menu and upload the requested documents. An admin reviews and approves it." },
  { q: "How do I withdraw my coins?", a: "Open your Wallet → Withdraw. Withdrawals require a verified account and are reviewed by an admin before payout." },
  { q: "How do I report a user or content?", a: "Use the Report option on a user's profile, a room, or a reel — or send us a message below and our team will look into it." },
  { q: "The app isn't updating — what do I do?", a: "Refresh the page once (pull down to refresh, or close and reopen). The app then keeps itself up to date automatically." },
];

const STATUS: Record<Ticket["status"], { label: string; tone: string; icon: typeof Clock }> = {
  open: { label: "Open", tone: "bg-amber-500/15 text-amber-300", icon: Clock },
  in_progress: { label: "In progress", tone: "bg-sky-500/15 text-sky-300", icon: Loader2 },
  resolved: { label: "Resolved", tone: "bg-emerald-500/15 text-emerald-300", icon: CheckCircle2 },
};

function SupportInner() {
  const { toast } = useToast();
  const params = useSearchParams();
  const isReport = params.get("type") === "report";
  const [subject, setSubject] = useState(isReport ? "Report an issue" : "");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [open, setOpen] = useState<number | null>(0);

  const loadTickets = () => {
    fetch(withBase("/api/support"), { credentials: "include", cache: "no-store" })
      .then((r) => r.json()).then((d) => setTickets(d.tickets ?? [])).catch(() => {});
  };
  useEffect(() => { loadTickets(); }, []);

  const send = async () => {
    if (!message.trim()) { toast("Please describe your issue.", "error"); return; }
    setBusy(true);
    const res = await fetch(withBase("/api/support"), { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ subject, message }) });
    setBusy(false);
    if (res.ok) { toast("Message sent — our team will get back to you. 🙏", "success"); setMessage(""); if (!isReport) setSubject(""); loadTickets(); }
    else { const d = await res.json().catch(() => ({})); toast(d.error ?? "Could not send", "error"); }
  };

  return (
    <div className="mx-auto w-full max-w-2xl">
      <div className="mb-1 flex items-center gap-2">
        <LifeBuoy className="size-6 text-lotus-300" />
        <h1 className="text-2xl font-extrabold text-mist-100">{isReport ? "Report an issue" : "Help & Support"}</h1>
      </div>
      <p className="mb-5 text-sm text-mist-400">Find quick answers below, or send us a message and our team will help you out.</p>

      {/* Screen sharing — let support SEE the problem instead of describing it. */}
      <div className="mb-6"><ScreenShareSupport /></div>

      {/* FAQ */}
      <h2 className="mb-2 text-sm font-bold uppercase tracking-wide text-mist-400">Frequently asked</h2>
      <div className="mb-6 space-y-2">
        {FAQ.map((f, i) => (
          <Card key={i} className="overflow-hidden">
            <button onClick={() => setOpen(open === i ? null : i)} className="flex w-full items-center justify-between gap-3 p-3.5 text-left">
              <span className="text-sm font-semibold text-mist-100">{f.q}</span>
              <ChevronDown className={cn("size-4 shrink-0 text-mist-400 transition", open === i && "rotate-180")} />
            </button>
            {open === i && <p className="border-t border-white/[0.06] p-3.5 text-sm text-mist-300">{f.a}</p>}
          </Card>
        ))}
      </div>

      {/* Contact form */}
      <h2 className="mb-2 text-sm font-bold uppercase tracking-wide text-mist-400">Contact us</h2>
      <Card className="space-y-3 p-4">
        <input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Subject (optional)" className="w-full rounded-lg border border-line bg-ink-800 p-2.5 text-sm text-mist-100 outline-none focus:border-lotus-400" />
        <textarea value={message} onChange={(e) => setMessage(e.target.value)} rows={4} placeholder={isReport ? "Describe the issue you're reporting…" : "How can we help?"} className="w-full resize-none rounded-lg border border-line bg-ink-800 p-2.5 text-sm text-mist-100 outline-none focus:border-lotus-400" />
        <Button block disabled={busy} onClick={send}>{busy ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />} Send message</Button>
      </Card>

      {/* My tickets */}
      {tickets.length > 0 && (
        <div className="mt-6">
          <h2 className="mb-2 text-sm font-bold uppercase tracking-wide text-mist-400">Your messages</h2>
          <div className="space-y-2">
            {tickets.map((t) => {
              const s = STATUS[t.status];
              return (
                <Card key={t.id} className="p-3.5">
                  <div className="flex items-center justify-between gap-2">
                    <p className="truncate text-sm font-semibold text-mist-100">{t.subject}</p>
                    <span className={cn("inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold", s.tone)}><s.icon className="size-3" /> {s.label}</span>
                  </div>
                  <p className="mt-1 text-sm text-mist-300">{t.message}</p>
                  {t.reply && (
                    <div className="mt-2 flex gap-2 rounded-lg bg-lotus-500/10 p-2.5">
                      <MessageSquare className="size-4 shrink-0 text-lotus-300" />
                      <div>
                        <p className="text-[11px] font-semibold text-lotus-200">Support replied</p>
                        <p className="text-sm text-mist-200">{t.reply}</p>
                      </div>
                    </div>
                  )}
                  <p className="mt-1.5 text-[11px] text-mist-500">{new Date(t.createdAt).toLocaleString()}</p>
                </Card>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

export default function SupportPage() {
  return (
    <Suspense fallback={<div className="grid min-h-[50vh] place-items-center text-mist-400"><span className="animate-pulse text-sm">Loading…</span></div>}>
      <SupportInner />
    </Suspense>
  );
}
