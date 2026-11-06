"use client";

import { useEffect, useRef, useState } from "react";
import { Share2, Copy, Check, MessageCircle, Send, Mail, Phone, Globe, Hash } from "lucide-react";
import { cn } from "@/lib/cn";

/**
 * Share controls for a Voice Room.
 *
 * - "Copy link" copies the room URL to the clipboard.
 * - "Share" opens the device's NATIVE share sheet (Web Share API) when available
 *   — that surfaces WhatsApp, Telegram, SMS, Email, Facebook, X and every other
 *   installed app automatically. On desktop / browsers without the API we fall
 *   back to a small menu of direct share links.
 *
 * The link is just the current room URL, so opening it takes the recipient
 * straight to this room (after login if they're new), where they can join.
 */
export function RoomShare({ roomName, variant = "pill" }: { roomName: string; variant?: "pill" | "row" }) {
  const [url, setUrl] = useState("");
  const [copied, setCopied] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [canNativeShare, setCanNativeShare] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setUrl(window.location.href);
    setCanNativeShare(typeof navigator !== "undefined" && typeof navigator.share === "function");
  }, []);

  // Close the fallback menu on outside click / Escape.
  useEffect(() => {
    if (!menuOpen) return;
    const onClick = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setMenuOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setMenuOpen(false);
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [menuOpen]);

  const message = `Join my voice room "${roomName}" on LotusPlay Connect:`;

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(url);
    } catch {
      // Fallback for older browsers / non-secure contexts.
      const ta = document.createElement("textarea");
      ta.value = url;
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select();
      try {
        document.execCommand("copy");
      } catch {
        /* ignore */
      }
      document.body.removeChild(ta);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };

  const share = async () => {
    if (canNativeShare) {
      try {
        await navigator.share({ title: `${roomName} · LotusPlay Connect`, text: message, url });
        return;
      } catch {
        // user cancelled or share failed — fall through to the menu
      }
    }
    setMenuOpen((v) => !v);
  };

  const enc = encodeURIComponent;
  const links: { label: string; href: string; icon: typeof Share2; tint: string }[] = [
    { label: "WhatsApp", href: `https://wa.me/?text=${enc(`${message} ${url}`)}`, icon: MessageCircle, tint: "text-emerald-400" },
    { label: "Telegram", href: `https://t.me/share/url?url=${enc(url)}&text=${enc(message)}`, icon: Send, tint: "text-sky-400" },
    { label: "SMS", href: `sms:?&body=${enc(`${message} ${url}`)}`, icon: Phone, tint: "text-green-400" },
    { label: "Email", href: `mailto:?subject=${enc(`Join "${roomName}" on LotusPlay Connect`)}&body=${enc(`${message}\n${url}`)}`, icon: Mail, tint: "text-amber-400" },
    { label: "Facebook", href: `https://www.facebook.com/sharer/sharer.php?u=${enc(url)}`, icon: Globe, tint: "text-blue-400" },
    { label: "X (Twitter)", href: `https://twitter.com/intent/tweet?text=${enc(message)}&url=${enc(url)}`, icon: Hash, tint: "text-mist-200" },
  ];

  if (variant === "row") {
    return (
      <div ref={wrapRef} className="relative space-y-1.5">
        <button
          onClick={copyLink}
          className="flex w-full items-center gap-3 rounded-xl border border-line bg-ink-800 px-3.5 py-3 text-left text-sm font-semibold text-mist-100 transition hover:bg-ink-700"
        >
          <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-emerald-500/15 text-emerald-300">{copied ? <Check className="size-4" /> : <Copy className="size-4" />}</span>
          <span className="flex-1">{copied ? "Link copied!" : "Copy room link"}</span>
        </button>
        <button
          onClick={share}
          className="flex w-full items-center gap-3 rounded-xl border border-line bg-ink-800 px-3.5 py-3 text-left text-sm font-semibold text-mist-100 transition hover:bg-ink-700"
        >
          <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-lotus-500/15 text-lotus-300"><Share2 className="size-4" /></span>
          <span className="flex-1">Share room</span>
        </button>
        {menuOpen && (
          <div className="grid grid-cols-3 gap-1.5 rounded-xl border border-white/10 bg-ink-800 p-2">
            {links.map((l) => {
              const Icon = l.icon;
              return (
                <a key={l.label} href={l.href} target="_blank" rel="noopener noreferrer" onClick={() => setMenuOpen(false)}
                  className="flex flex-col items-center gap-1 rounded-lg px-1 py-2 text-[11px] text-mist-200 transition hover:bg-ink-700">
                  <Icon className={cn("size-5", l.tint)} /> {l.label}
                </a>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  return (
    <div ref={wrapRef} className="relative flex items-center gap-2">
      <button
        onClick={copyLink}
        className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-ink-700 px-3 py-1 text-xs font-semibold text-mist-200 transition hover:bg-ink-600"
        title="Copy room link"
      >
        {copied ? <Check className="size-3.5 text-emerald-400" /> : <Copy className="size-3.5" />}
        {copied ? "Copied!" : "Copy link"}
      </button>

      <button
        onClick={share}
        className="inline-flex items-center gap-1.5 rounded-full bg-gradient-to-r from-lotus-500 to-petal-500 px-3 py-1 text-xs font-semibold text-white shadow-sm transition hover:brightness-110"
        title="Share this room"
      >
        <Share2 className="size-3.5" /> Share
      </button>

      {menuOpen && (
        <div className="absolute right-0 top-full z-50 mt-2 w-56 overflow-hidden rounded-xl border border-white/10 bg-ink-800 p-1.5 shadow-2xl">
          <p className="px-2.5 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-mist-400">
            Share via
          </p>
          {links.map((l) => {
            const Icon = l.icon;
            return (
              <a
                key={l.label}
                href={l.href}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => setMenuOpen(false)}
                className="flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm text-mist-200 transition hover:bg-ink-700"
              >
                <Icon className={cn("size-4", l.tint)} /> {l.label}
              </a>
            );
          })}
          <button
            onClick={() => {
              copyLink();
              setMenuOpen(false);
            }}
            className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm text-mist-200 transition hover:bg-ink-700"
          >
            <Copy className="size-4 text-mist-300" /> Copy link
          </button>
        </div>
      )}
    </div>
  );
}
