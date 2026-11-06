import { ok, fail, readJson } from "@/server/http";
import { getCurrentUser } from "@/server/auth";
import { listConversations, sendMessage, findById, notifyUser, featureOn, mediaSummary, dmSendBlockReason, getConfig } from "@/server/repo";

export const runtime = "nodejs";

// GET — my conversations (one per person, newest first).
export async function GET() {
  const me = await getCurrentUser();
  if (!me) return fail("Not authenticated", 401);
  return ok({ conversations: await listConversations(me.id) });
}

// POST { toUserId, text, type?, mediaUrl?, ... } — send a direct message.
// A message may be plain text, or an attachment (photo / video / voice note /
// document / sticker) with `text` acting as an optional caption.
const MEDIA_TYPES = ["image", "video", "audio", "file", "sticker"] as const;

export async function POST(req: Request) {
  const me = await getCurrentUser();
  if (!me) return fail("Not authenticated", 401);
  if (!(await featureOn("chat"))) return fail("Messaging is currently turned off.", 403);
  // Admin per-user switch: a user whose personal messaging was turned OFF can't send DMs.
  if (me.role !== "admin" && me.dmDisabled === true) return fail("Your personal messaging has been turned off by an administrator.", 403);

  const b = await readJson<{
    toUserId?: string; text?: string; type?: string; mediaUrl?: string;
    mediaName?: string; mediaMime?: string; mediaSize?: number; duration?: number; replyToId?: string; forwarded?: boolean;
  }>(req);
  const { toUserId } = b;
  const body = typeof b.text === "string" ? b.text.trim() : "";
  const type = MEDIA_TYPES.includes(b.type as (typeof MEDIA_TYPES)[number]) ? (b.type as (typeof MEDIA_TYPES)[number]) : undefined;
  // Only accept URLs this app itself serves — never an arbitrary remote address.
  const mediaUrl = typeof b.mediaUrl === "string" && /^\/api\/(file|media)\/[\w.-]+$/.test(b.mediaUrl) ? b.mediaUrl : "";
  if (!toUserId || typeof toUserId !== "string") return fail("Missing recipient");
  // An attachment needs no caption; a plain message still does.
  if (!body && !(type && mediaUrl)) return fail("Message is empty");
  if (type && !mediaUrl) return fail("Attachment is missing");
  if (toUserId === me.id) return fail("You can't message yourself");

  // Per-type enable/disable (Admin → Messaging Controls). Admins are never blocked.
  if (me.role !== "admin") {
    const types = (await getConfig()).messaging?.types ?? {};
    const key = type ?? "text";
    if (types[key] === false) return fail(`${key === "text" ? "Text messages are" : `${key[0].toUpperCase()}${key.slice(1)} messages are`} currently turned off.`, 403);
  }

  const recipient = await findById(toUserId);
  if (!recipient) return fail("User not found", 404);

  // Anti-spam: block after too many unanswered messages (admin-controlled, OFF by
  // default). Server-enforced so it can't be bypassed by a client.
  const blocked = await dmSendBlockReason(me.id, toUserId);
  if (blocked) return fail(blocked, 429);

  const message = await sendMessage(me.id, toUserId, body, {
    type,
    mediaUrl: mediaUrl || undefined,
    mediaName: typeof b.mediaName === "string" ? b.mediaName : undefined,
    mediaMime: typeof b.mediaMime === "string" ? b.mediaMime : undefined,
    mediaSize: typeof b.mediaSize === "number" ? b.mediaSize : undefined,
    duration: typeof b.duration === "number" ? b.duration : undefined,
    replyToId: typeof b.replyToId === "string" ? b.replyToId : undefined,
    forwarded: b.forwarded === true,
  });
  // Link the recipient back to a chat with the SENDER (by id, so it works even
  // if the sender has no username yet). Previously linked to themselves.
  await notifyUser(
    toUserId,
    `${me.fullName} sent you ${type ? mediaSummary(type).toLowerCase() || "a message" : "a message"}`,
    { label: "Open chat", href: `/messages?to=${me.id}` },
    "message",
  );
  return ok({ message });
}
