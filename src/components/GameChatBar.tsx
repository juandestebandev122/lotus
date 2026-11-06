"use client";

import { useEffect, useRef, useState } from "react";
import { withBase } from "@/lib/base-path";
import { Send, Gift, MessageCircle, X } from "lucide-react";

const EMOJIS = ["😀", "😂", "🔥", "👍", "🎉", "😮", "😢", "👏", "❤️", "🎲", "🙏", "💪"];

interface Msg { userName: string; text: string; type?: string }

// Compact in-game chat bar (text + emoji + gift) wired to the room's own chat,
// so players can talk while playing without leaving the board.
export function GameChatBar({ roomId, onGift }: { roomId: string; onGift: () => void }) {
  const [open, setOpen] = useState(false);
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [text, setText] = useState("");
  const [unread, setUnread] = useState(0);
  const lastCount = useRef(0);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!roomId) return;
    let on = true;
    const load = async () => {
      if (typeof document !== "undefined" && document.hidden) return; // pause when backgrounded
      try {
        const res = await fetch(withBase(`/api/rooms/${roomId}/chat`), { credentials: "include", cache: "no-store" });
        const d = await res.json().catch(() => ({}));
        if (!on) return;
        const m = (d.messages ?? []) as Msg[];
        setMsgs(m);
        if (!open && m.length > lastCount.current) setUnread((u) => u + (m.length - lastCount.current));
        lastCount.current = m.length;
      } catch { /* ignore */ }
    };
    load();
    const t = setInterval(load, 5000);
    return () => { on = false; clearInterval(t); };
  }, [roomId, open]);

  useEffect(() => { if (open) { setUnread(0); endRef.current?.scrollIntoView({ block: "end" }); } }, [open, msgs.length]);

  const send = async (raw: string) => {
    const v = raw.trim();
    if (!v) return;
    setText("");
    try {
      await fetch(withBase(`/api/rooms/${roomId}/chat`), {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: v }),
      });
    } catch { /* ignore */ }
  };

  return (
    <>
      {/* Bottom chat bar */}
      <div className="flex items-center gap-2 rounded-2xl border border-white/10 bg-white/[0.06] px-2 py-1.5 backdrop-blur">
        <button onClick={() => setOpen(true)} title="Open chat" className="relative grid size-9 shrink-0 place-items-center rounded-full bg-white/10 text-white transition hover:bg-white/20">
          <MessageCircle className="size-4" />
          {unread > 0 && <span className="absolute -right-1 -top-1 grid min-w-4 place-items-center rounded-full bg-rose-500 px-1 text-[10px] font-bold text-white">{unread > 9 ? "9+" : unread}</span>}
        </button>
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") send(text); }}
          onFocus={() => setOpen(true)}
          placeholder="Message the group…"
          className="h-9 min-w-0 flex-1 rounded-full bg-white/10 px-3 text-sm text-white outline-none placeholder:text-white/40"
        />
        <button onClick={() => send(text)} title="Send" className="grid size-9 shrink-0 place-items-center rounded-full bg-lotus-600 text-white transition hover:bg-lotus-500"><Send className="size-4" /></button>
        <button onClick={onGift} title="Send a gift" className="grid size-9 shrink-0 place-items-center rounded-full bg-amber-500/20 text-amber-300 transition hover:bg-amber-500/30"><Gift className="size-4" /></button>
      </div>

      {/* Slide-up chat panel */}
      {open && (
        <div className="fixed inset-0 z-[120] flex flex-col justify-end bg-black/50" onClick={() => setOpen(false)}>
          <div className="mx-auto w-full max-w-2xl rounded-t-3xl border-t border-white/10 bg-ink-900 p-3 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="mb-2 flex items-center justify-between">
              <p className="font-display font-bold text-white">Group chat</p>
              <button onClick={() => setOpen(false)} className="text-white/60 hover:text-white"><X className="size-5" /></button>
            </div>
            <div className="max-h-[45dvh] space-y-1.5 overflow-y-auto pr-1">
              {msgs.length === 0 ? (
                <p className="py-8 text-center text-sm text-white/40">No messages yet — say hi! 👋</p>
              ) : (
                msgs.map((m, i) => (
                  <div key={i} className="text-sm leading-snug">
                    <span className="font-semibold text-lotus-300">{m.userName.split(" ")[0]}: </span>
                    <span className="text-white/90">{m.text}</span>
                  </div>
                ))
              )}
              <div ref={endRef} />
            </div>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {EMOJIS.map((e) => (
                <button key={e} onClick={() => send(e)} className="grid size-9 place-items-center rounded-lg bg-white/5 text-xl transition hover:bg-white/15">{e}</button>
              ))}
            </div>
            <div className="mt-2 flex items-center gap-2">
              <input
                value={text}
                onChange={(e) => setText(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") send(text); }}
                placeholder="Type a message…"
                autoFocus
                className="h-10 flex-1 rounded-full bg-white/10 px-4 text-sm text-white outline-none placeholder:text-white/40"
              />
              <button onClick={() => { send(text); onGift(); }} title="Send a gift" className="grid size-10 shrink-0 place-items-center rounded-full bg-amber-500/20 text-amber-300 hover:bg-amber-500/30"><Gift className="size-4" /></button>
              <button onClick={() => send(text)} className="grid size-10 shrink-0 place-items-center rounded-full bg-lotus-600 text-white hover:bg-lotus-500"><Send className="size-4" /></button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
