// Parse a pasted video LINK into something playable. Handles the major video
// platforms (rendered as an embed <iframe>) and direct video files (.mp4/.webm/
// .mov…, played in a <video> tag). Shared by the reel/video composer, the reel
// feed, the profile & business "Videos" tabs, and the server.
//
// Supported: YouTube, Vimeo, Facebook, Instagram (Reels/posts), TikTok,
// X (Twitter), Dailymotion, and direct video-file URLs.

export type VideoProvider =
  | "youtube" | "vimeo" | "facebook" | "instagram" | "tiktok" | "twitter" | "dailymotion" | "direct";

export interface ParsedVideoLink {
  ok: boolean;
  /** iframe src (YouTube / Vimeo / Facebook / Instagram / TikTok / X / Dailymotion).
   *  When set, render an <iframe>. */
  embedUrl?: string;
  /** direct video URL (.mp4 etc.). When set, render a <video src>. */
  directUrl?: string;
  /** which platform we detected (for labels / hints) */
  provider?: VideoProvider;
  raw: string;
}

const DIRECT_RE = /\.(mp4|webm|mov|m4v|ogg)(\?.*)?$/i;

export function parseVideoLink(input: string): ParsedVideoLink {
  const url = (input ?? "").trim();
  if (!/^https?:\/\//i.test(url)) return { ok: false, raw: url };

  // YouTube: watch?v=, youtu.be/, shorts/, embed/, live/
  const yt = url.match(/(?:youtube\.com\/(?:watch\?(?:.*&)?v=|shorts\/|embed\/|live\/)|youtu\.be\/)([a-zA-Z0-9_-]{6,})/i);
  if (yt) return { ok: true, provider: "youtube", embedUrl: `https://www.youtube.com/embed/${yt[1]}`, raw: url };

  // Vimeo: vimeo.com/{id} or player.vimeo.com/video/{id}
  const vm = url.match(/vimeo\.com\/(?:video\/)?(\d+)/i);
  if (vm) return { ok: true, provider: "vimeo", embedUrl: `https://player.vimeo.com/video/${vm[1]}`, raw: url };

  // TikTok: full URL .../video/{id} (short vm./vt. links are resolved server-side
  // at create time — see /api/reels resolveShortLink — so they reach us in this form)
  const tt = url.match(/tiktok\.com\/(?:@[^/]+\/video|v|embed\/v2|player\/v1)\/(\d+)/i)
    || url.match(/tiktok\.com\/.*?[?&]item_id=(\d+)/i);
  if (tt) return { ok: true, provider: "tiktok", embedUrl: `https://www.tiktok.com/embed/v2/${tt[1]}`, raw: url };

  // Instagram: reel / post / IGTV (optionally prefixed by a username segment)
  const ig = url.match(/instagram\.com\/(?:[^/?#]+\/)?(reels?|tv|p)\/([A-Za-z0-9_-]+)/i);
  if (ig) {
    const type = /^reels?$/i.test(ig[1]) ? "reel" : ig[1].toLowerCase();
    return { ok: true, provider: "instagram", embedUrl: `https://www.instagram.com/${type}/${ig[2]}/embed`, raw: url };
  }

  // X (Twitter): .../status/{id} → the tweet (with its video) embeds via the
  // official platform.twitter.com iframe.
  const tw = url.match(/(?:twitter\.com|x\.com)\/[^/]+\/status(?:es)?\/(\d+)/i);
  if (tw) return { ok: true, provider: "twitter", embedUrl: `https://platform.twitter.com/embed/Tweet.html?id=${tw[1]}`, raw: url };

  // Dailymotion: dailymotion.com/video/{id} or dai.ly/{id}
  const dm = url.match(/dailymotion\.com\/(?:embed\/)?video\/([a-zA-Z0-9]+)/i) || url.match(/dai\.ly\/([a-zA-Z0-9]+)/i);
  if (dm) return { ok: true, provider: "dailymotion", embedUrl: `https://www.dailymotion.com/embed/video/${dm[1]}`, raw: url };

  // Facebook: any facebook.com / fb.watch video link → the official video plugin,
  // which resolves the original URL itself (works for /watch, /videos, /reel, fb.watch).
  if (/(?:^|\/\/|\.)facebook\.com\//i.test(url) || /(?:^|\/\/|\.)fb\.watch\//i.test(url)) {
    return { ok: true, provider: "facebook", embedUrl: `https://www.facebook.com/plugins/video.php?href=${encodeURIComponent(url)}&show_text=false`, raw: url };
  }

  // Direct video file
  if (DIRECT_RE.test(url)) return { ok: true, provider: "direct", directUrl: url, raw: url };

  // Unknown http(s) link — try to play it as a direct video (best effort).
  return { ok: true, provider: "direct", directUrl: url, raw: url };
}

const PROVIDER_LABEL: Record<VideoProvider, string> = {
  youtube: "YouTube video",
  vimeo: "Vimeo video",
  facebook: "Facebook video",
  instagram: "Instagram video",
  tiktok: "TikTok video",
  twitter: "X (Twitter) video",
  dailymotion: "Dailymotion video",
  direct: "Video link",
};

/** A short label for the kind of link, for UI hints. */
export function videoLinkLabel(input: string): string {
  const p = parseVideoLink(input);
  if (!p.ok) return "";
  return PROVIDER_LABEL[p.provider ?? "direct"];
}
