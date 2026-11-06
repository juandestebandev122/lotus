"use client";

import { useState } from "react";
import { Loader2, Send, CheckCircle2 } from "lucide-react";

// The public contact form. No login required on purpose: a privacy request, a
// complaint, or a question from someone locked out of their account all have to
// be able to reach us. Messages arrive in Admin → Support.

const TOPICS = [
  "General question",
  "Account & login help",
  "Payment or coins",
  "Refund request",
  "Report a user or content",
  "Privacy / data request",
  "Complaint / grievance",
  "Business & partnerships",
];

const field =
  "w-full rounded-lg border border-line bg-ink-900 px-3 py-2.5 text-sm text-mist-100 outline-none transition focus:border-lotus-400";

export function ContactForm() {
  const [form, setForm] = useState({ name: "", email: "", topic: TOPICS[0], subject: "", message: "", website: "" });
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");

  const set = (patch: Partial<typeof form>) => setForm((s) => ({ ...s, ...patch }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSending(true);
    try {
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) setSent(true);
      else setError(data?.error ?? "Sorry — your message could not be sent. Please email us instead.");
    } catch {
      setError("Sorry — your message could not be sent. Please email us instead.");
    }
    setSending(false);
  };

  if (sent) {
    return (
      <div className="not-prose rounded-2xl border border-emerald-400/30 bg-emerald-500/10 p-5">
        <p className="flex items-center gap-2 font-bold text-emerald-200">
          <CheckCircle2 className="size-5" /> Message sent
        </p>
        <p className="mt-2 text-sm text-emerald-100/80">
          Thank you — we have received your message. We acknowledge every enquiry within{" "}
          <strong>24 hours</strong> and aim to resolve it within <strong>15 days</strong>. Our reply
          will go to the email address you gave us, so please check your spam folder too.
        </p>
        <button
          onClick={() => { setSent(false); setForm({ name: "", email: "", topic: TOPICS[0], subject: "", message: "", website: "" }); }}
          className="mt-3 rounded-lg border border-emerald-400/40 bg-emerald-500/10 px-3 py-1.5 text-xs font-semibold text-emerald-200 transition hover:bg-emerald-500/20"
        >
          Send another message
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="not-prose rounded-2xl border border-white/10 bg-ink-850/60 p-5">
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block">
          <span className="mb-1 block text-xs font-semibold text-mist-300">Your name *</span>
          <input required value={form.name} onChange={(e) => set({ name: e.target.value })} className={field} autoComplete="name" />
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-semibold text-mist-300">Email address *</span>
          <input required type="email" value={form.email} onChange={(e) => set({ email: e.target.value })} className={field} autoComplete="email" placeholder="so we can reply" />
        </label>
      </div>

      <label className="mt-3 block">
        <span className="mb-1 block text-xs font-semibold text-mist-300">What is this about?</span>
        <select value={form.topic} onChange={(e) => set({ topic: e.target.value })} className={field}>
          {TOPICS.map((t) => <option key={t} value={t}>{t}</option>)}
        </select>
      </label>

      <label className="mt-3 block">
        <span className="mb-1 block text-xs font-semibold text-mist-300">Subject</span>
        <input value={form.subject} onChange={(e) => set({ subject: e.target.value })} className={field} placeholder="A short summary" />
      </label>

      <label className="mt-3 block">
        <span className="mb-1 block text-xs font-semibold text-mist-300">Your message *</span>
        <textarea
          required rows={6} value={form.message} onChange={(e) => set({ message: e.target.value })}
          className={`${field} resize-y`}
          placeholder="Please include your username or User ID, and a transaction ID if your question is about a payment — it helps us answer you much faster."
        />
      </label>

      {/* Honeypot — hidden from people, irresistible to bots. */}
      <input
        type="text" name="website" tabIndex={-1} autoComplete="off" aria-hidden
        value={form.website} onChange={(e) => set({ website: e.target.value })}
        className="absolute left-[-9999px] size-0 opacity-0"
      />

      {error && <p className="mt-3 rounded-lg bg-rose-500/15 px-3 py-2 text-xs text-rose-200">{error}</p>}

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <button
          type="submit" disabled={sending}
          className="inline-flex items-center gap-2 rounded-xl bg-lotus-600 px-4 py-2.5 text-sm font-bold text-white transition hover:brightness-110 disabled:opacity-60"
        >
          {sending ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
          {sending ? "Sending…" : "Send message"}
        </button>
        <p className="text-[11px] text-mist-500">
          We use what you send here only to answer you — see our{" "}
          <a href="/legal/privacy" className="text-lotus-300 underline">Privacy Policy</a>.
        </p>
      </div>
    </form>
  );
}
