"use client";

// Renders the CONTENT of a private-chat message: the attachment (if any), the
// reply quote, and the text with clickable links.

import { withBase } from "@/lib/base-path";
import { fmtBytes, fmtDuration, type DMessage } from "@/lib/messages";
import { cn } from "@/lib/cn";
import { FileText, Download, CornerUpLeft, Link2 } from "lucide-react";

/** Split text into plain runs and URLs so links can be made clickable. */
const URL_RE = /(https?:\/\/[^\s<]+|www\.[^\s<]+)/gi;

function hrefOf(raw: string): string {
  const clean = raw.replace(/[.,!?;:)\]}]+$/, "");
  return clean.startsWith("http") ? clean : `https://${clean}`;
}

/** The first URL in the text — used for the preview card. */
export function firstUrl(text: string): string {
  const m = text.match(URL_RE);
  return m?.[0] ? hrefOf(m[0]) : "";
}

function LinkedText({ text }: { text: string }) {
  const parts = text.split(URL_RE);
  return (
    <>
      {parts.map((p, i) =>
        URL_RE.test(p) && (p.startsWith("http") || p.startsWith("www.")) ? (
          <a
            key={i}
            href={hrefOf(p)}
            target="_blank"
            rel="noopener noreferrer nofollow"
            className="break-all underline decoration-white/40 underline-offset-2 hover:decoration-white"
          >
            {p}
          </a>
        ) : (
          <span key={i}>{p}</span>
        ),
      )}
    </>
  );
}

/** A compact preview card for a shared link. The host name is derived locally —
 *  no external request is made, so it works with a strict content policy and
 *  can never leak the conversation to a third-party site. */
function LinkPreview({ url }: { url: string }) {
  let host = "";
  try { host = new URL(url).hostname.replace(/^www\./, ""); } catch { return null; }
  if (!host) return null;
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer nofollow"
      className="mt-1.5 flex items-center gap-2 rounded-lg border border-white/15 bg-black/20 px-2.5 py-2 transition hover:bg-black/30"
    >
      <span className="grid size-8 shrink-0 place-items-center rounded-md bg-white/10">
        <Link2 className="size-4 opacity-80" />
      </span>
      <span className="min-w-0">
        <span className="block truncate text-xs font-semibold">{host}</span>
        <span className="block truncate text-[11px] opacity-70">{url}</span>
      </span>
    </a>
  );
}

export function MessageBody({ m, onOpenImage, allowDownload = true }: { m: DMessage; onOpenImage?: (url: string) => void; allowDownload?: boolean }) {
  const src = m.mediaUrl ? withBase(m.mediaUrl) : "";
  const link = m.type === "text" || !m.type ? firstUrl(m.text || "") : "";

  return (
    <div className="space-y-1.5">
      {/* Reply quote — kept even if the original was later deleted. */}
      {m.replyToId && (
        <div className="flex gap-1.5 rounded-lg border-l-2 border-white/40 bg-black/20 px-2 py-1">
          <CornerUpLeft className="mt-0.5 size-3 shrink-0 opacity-60" />
          <div className="min-w-0">
            {m.replyToFrom && <div className="truncate text-[11px] font-bold opacity-80">{m.replyToFrom}</div>}
            <div className="truncate text-[11px] opacity-70">{m.replyToText || "Message"}</div>
          </div>
        </div>
      )}

      {/* Attachment */}
      {m.type === "image" || m.type === "sticker" ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={src}
          alt={m.text || "Photo"}
          loading="lazy"
          onClick={() => onOpenImage?.(src)}
          className={cn(
            "cursor-zoom-in rounded-lg object-cover",
            m.type === "sticker" ? "size-32 bg-transparent object-contain" : "max-h-64 w-full max-w-[15rem]",
          )}
        />
      ) : m.type === "video" ? (
        <video src={src} controls playsInline preload="metadata" className="max-h-64 w-full max-w-[15rem] rounded-lg bg-black" />
      ) : m.type === "audio" ? (
        <div className="min-w-[12rem]">
          <audio src={src} controls preload="metadata" className="h-9 w-full" />
          {!!m.duration && <div className="mt-0.5 text-[10px] opacity-70">🎤 Voice message · {fmtDuration(m.duration)}</div>}
        </div>
      ) : m.type === "file" ? (
        <a
          href={src}
          target="_blank"
          rel="noreferrer"
          {...(allowDownload ? { download: m.mediaName } : {})}
          className="flex items-center gap-2 rounded-lg border border-white/15 bg-black/20 px-2.5 py-2 transition hover:bg-black/30"
        >
          <span className="grid size-9 shrink-0 place-items-center rounded-md bg-white/10"><FileText className="size-4" /></span>
          <span className="min-w-0 flex-1">
            <span className="block max-w-[11rem] truncate text-xs font-semibold">{m.mediaName || "Document"}</span>
            <span className="block text-[11px] opacity-70">{fmtBytes(m.mediaSize) || "File"}</span>
          </span>
          {allowDownload && <Download className="size-4 shrink-0 opacity-70" />}
        </a>
      ) : null}

      {/* Caption / text, with clickable links */}
      {m.text ? <p className="whitespace-pre-wrap break-words"><LinkedText text={m.text} /></p> : null}

      {/* Link preview card for shared URLs */}
      {link ? <LinkPreview url={link} /> : null}
    </div>
  );
}
