"use client";

import { useEffect, useState } from "react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import { useAuth } from "@/lib/auth";
import { withBase } from "@/lib/base-path";
import { Gift, Copy, Share2, Users, Coins, Check, Clock } from "lucide-react";

interface HistItem { name: string; status: string; at: string; reward: number }
interface ReferInfo { code: string; reward: number; count: number; enabled: boolean; pending: number; coins: number; history: HistItem[] }

export default function ReferFriendPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [info, setInfo] = useState<ReferInfo | null>(null);
  const [copied, setCopied] = useState(false);
  const [shareOpen, setShareOpen] = useState(false); // fallback share menu (no native share sheet)

  useEffect(() => {
    let on = true;
    fetch(withBase("/api/refer"), { credentials: "include", cache: "no-store" })
      .then((r) => r.json())
      .then((d) => { if (on && d?.code) setInfo({ code: d.code, reward: d.reward ?? 0, count: d.count ?? 0, enabled: !!d.enabled, pending: d.pending ?? 0, coins: d.coins ?? 0, history: Array.isArray(d.history) ? d.history : [] }); })
      .catch(() => {});
    return () => { on = false; };
  }, []);

  const code = info?.code || user?.username || "";
  const link = typeof window !== "undefined" && code ? `${window.location.origin}${withBase("/signup")}?ref=${encodeURIComponent(code)}` : "";
  const reward = info?.reward ?? 0;

  // Robust copy: the Clipboard API is UNAVAILABLE over plain HTTP / LAN IPs and in
  // some in-app browsers, so fall back to a hidden textarea + execCommand("copy").
  const copyToClipboard = async (t: string): Promise<boolean> => {
    try {
      if (navigator.clipboard?.writeText) { await navigator.clipboard.writeText(t); return true; }
    } catch { /* fall through to the legacy path */ }
    try {
      const ta = document.createElement("textarea");
      ta.value = t;
      ta.style.position = "fixed"; ta.style.left = "-9999px"; ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.focus(); ta.select();
      const ok = document.execCommand("copy");
      document.body.removeChild(ta);
      return ok;
    } catch { return false; }
  };

  const copy = async () => {
    if (!link) return;
    if (await copyToClipboard(link)) {
      setCopied(true);
      toast("Invite link copied — share it with your friends!", "success");
      setTimeout(() => setCopied(false), 2000);
    } else {
      toast("Couldn't copy — long-press the link above to copy it.", "info");
    }
  };

  const shareText = "Join me on LotusPlay Connect! Sign up with my invite link 👇";
  const share = async () => {
    if (!link) return;
    const nav = navigator as Navigator & { share?: (d: { title?: string; text?: string; url?: string }) => Promise<void> };
    if (nav.share) {
      // Native share sheet (mobile) — the best experience where available.
      try { await nav.share({ title: "Join me on LotusPlay Connect", text: shareText, url: link }); }
      catch { /* user cancelled — do nothing */ }
    } else {
      // No native share (most desktops / non-secure contexts): open our own menu of
      // direct share links so "Share" is never a dead button.
      setShareOpen((s) => !s);
    }
  };

  // Direct share targets used when the native share sheet isn't available.
  const shareLinks = link ? [
    { label: "WhatsApp", href: `https://wa.me/?text=${encodeURIComponent(`${shareText} ${link}`)}` },
    { label: "Telegram", href: `https://t.me/share/url?url=${encodeURIComponent(link)}&text=${encodeURIComponent(shareText)}` },
    { label: "Email", href: `mailto:?subject=${encodeURIComponent("Join me on LotusPlay Connect")}&body=${encodeURIComponent(`${shareText}\n${link}`)}` },
    { label: "SMS", href: `sms:?&body=${encodeURIComponent(`${shareText} ${link}`)}` },
  ] : [];

  return (
    <div className="mx-auto max-w-xl space-y-5">
      <div>
        <h1 className="flex items-center gap-2 font-display text-2xl font-extrabold text-mist-100">
          <Gift className="size-6 text-petal-400" /> Refer a friend
        </h1>
        <p className="mt-1 text-sm text-mist-400">
          Invite your friends to LotusPlay Connect{reward > 0 ? <> and earn <b className="text-gold-300">{reward} coins</b> for every friend who joins.</> : "."}
        </p>
      </div>

      {/* Reward + count summary */}
      <div className="grid grid-cols-2 gap-3">
        <Card className="flex items-center gap-3 p-4">
          <span className="grid size-11 place-items-center rounded-xl bg-gold-400/15 text-gold-300"><Coins className="size-5" /></span>
          <div>
            <div className="font-display text-xl font-extrabold text-mist-100">{reward > 0 ? `${reward}` : "—"}</div>
            <div className="text-xs text-mist-400">coins per friend</div>
          </div>
        </Card>
        <Card className="flex items-center gap-3 p-4">
          <span className="grid size-11 place-items-center rounded-xl bg-emerald-500/15 text-emerald-300"><Users className="size-5" /></span>
          <div>
            <div className="font-display text-xl font-extrabold text-mist-100">{info?.count ?? 0}</div>
            <div className="text-xs text-mist-400">friends joined</div>
          </div>
        </Card>
      </div>

      {/* Invite link */}
      <Card className="space-y-3 p-5">
        <h2 className="text-sm font-semibold text-mist-200">Your personal invite link</h2>
        <div className="flex items-center gap-2 rounded-xl border border-line bg-ink-900 px-3 py-2.5">
          <span className="min-w-0 flex-1 truncate text-sm text-mist-200">{link || "…"}</span>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <Button variant="secondary" onClick={copy} disabled={!link}>{copied ? <><Check className="size-4" /> Copied</> : <><Copy className="size-4" /> Copy link</>}</Button>
          <Button onClick={share} disabled={!link}><Share2 className="size-4" /> Share</Button>
        </div>
        {/* Fallback share targets — shown only when the device has no native share
            sheet (e.g. desktop), so the Share button always does something. */}
        {shareOpen && shareLinks.length > 0 && (
          <div className="grid grid-cols-2 gap-2 rounded-xl border border-line bg-ink-900 p-2 sm:grid-cols-4">
            {shareLinks.map((s) => (
              <a key={s.label} href={s.href} target="_blank" rel="noopener noreferrer" onClick={() => setShareOpen(false)}
                className="rounded-lg bg-white/[0.05] px-3 py-2 text-center text-sm font-semibold text-mist-100 transition hover:bg-white/[0.1]">
                {s.label}
              </a>
            ))}
          </div>
        )}
        <p className="text-xs text-mist-500">Your invite code is <b className="font-mono text-mist-200">{code || "—"}</b> — friends can also type it in the “Referral code” box when they sign up.</p>
        {info && !info.enabled && <p className="rounded-lg bg-amber-500/10 px-3 py-2 text-xs text-amber-200">The referral rewards program is currently paused by the admin — your link still works and referrals are tracked.</p>}
      </Card>

      {/* Coins earned + pending */}
      {info && (info.coins > 0 || info.pending > 0) && (
        <div className="grid grid-cols-2 gap-3">
          <Card className="flex items-center gap-3 p-4">
            <span className="grid size-11 place-items-center rounded-xl bg-gold-400/15 text-gold-300"><Coins className="size-5" /></span>
            <div><div className="font-display text-xl font-extrabold text-mist-100">{info.coins.toLocaleString("en-SA")}</div><div className="text-xs text-mist-400">coins earned</div></div>
          </Card>
          <Card className="flex items-center gap-3 p-4">
            <span className="grid size-11 place-items-center rounded-xl bg-amber-500/15 text-amber-300"><Clock className="size-5" /></span>
            <div><div className="font-display text-xl font-extrabold text-mist-100">{info.pending}</div><div className="text-xs text-mist-400">pending approval</div></div>
          </Card>
        </div>
      )}

      {/* Referral history */}
      {info && info.history.length > 0 && (
        <Card className="p-5">
          <h2 className="mb-3 text-sm font-semibold text-mist-200">Your referrals</h2>
          <div className="space-y-2">
            {info.history.map((h, i) => (
              <div key={i} className="flex items-center justify-between rounded-lg bg-ink-800/50 px-3 py-2 text-sm">
                <span className="text-mist-200">{h.name}</span>
                <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold capitalize ${h.status === "approved" ? "bg-emerald-500/15 text-emerald-300" : h.status === "pending" ? "bg-amber-500/15 text-amber-300" : "bg-rose-500/15 text-rose-300"}`}>{h.status === "approved" ? `+${h.reward} coins` : h.status}</span>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* How it works */}
      <Card className="space-y-3 p-5">
        <h2 className="text-sm font-semibold text-mist-200">How it works</h2>
        <ol className="space-y-2.5 text-sm text-mist-300">
          {[
            "Share your invite link (or code) with friends.",
            "Your friend signs up using your link and gets approved.",
            reward > 0 ? `You automatically get ${reward} coins added to your wallet — for every friend who joins!` : "You'll be rewarded once the referral reward is enabled by the admin.",
          ].map((step, i) => (
            <li key={i} className="flex items-start gap-2.5">
              <span className="mt-0.5 grid size-5 shrink-0 place-items-center rounded-full bg-lotus-500/20 text-[11px] font-bold text-lotus-200">{i + 1}</span>
              <span>{step}</span>
            </li>
          ))}
        </ol>
      </Card>
    </div>
  );
}
