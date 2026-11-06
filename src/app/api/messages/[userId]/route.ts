import { ok, fail, readJson } from "@/server/http";
import { getCurrentUser, publicUser } from "@/server/auth";
import { getThread, findById, findByUsername, deleteDmForMe, deleteDmForEveryone, clearDmThread, removeDmConversation, deleteManyDmsForMe, setUserBlocked, dmBlockState, reactToDm, starDm, pinDm, editDm, adminEditDm, adminDeleteDm, addAdminLog } from "@/server/repo";

export const runtime = "nodejs";

// GET — the full thread with one person (by user id OR username). Marks read.
export async function GET(_req: Request, { params }: { params: Promise<{ userId: string }> }) {
  const me = await getCurrentUser();
  if (!me) return fail("Not authenticated", 401);

  const { userId } = await params;
  // Accept either a real user id or a @username (so "Message" links work).
  const other = (await findById(userId)) ?? (await findByUsername(userId));
  if (!other) return fail("User not found", 404);

  const thread = await getThread(me.id, other.id);
  const block = await dmBlockState(me.id, other.id);
  // Respect the peer's "hide online status / last seen" privacy settings (the
  // owner isn't viewing their own DM header, and admins keep the real value).
  const peer = publicUser(other);
  if (other.privacy?.hideOnlineStatus === true && me.role !== "admin") peer.status = "offline";
  if (other.privacy?.hideLastSeen === true && me.role !== "admin") peer.lastSeen = undefined;
  // READ RECEIPTS. If the OTHER person hid read receipts, I don't get to see the
  // blue "read" tick on messages I sent them (they still show as delivered).
  // Admins always see the real state.
  const hideReceipts = other.privacy?.hideReadReceipts === true && me.role !== "admin";
  return ok({
    peer,
    // Block state so the DM screen can show a banner + disable the composer.
    iBlocked: block.iBlocked,
    blockedMe: block.blockedMe,
    // This projection is a WHITELIST — a field not listed here never reaches the
    // app, however well it is stored. Attachment + reply fields must stay listed.
    messages: thread.map((m) => ({
      id: m.id,
      fromMe: m.fromId === me.id,
      text: m.text,
      at: m.at,
      deleted: !!m.deleted,
      // Hide the read tick on MY sent messages when the recipient hid receipts.
      read: m.fromId === me.id && hideReceipts ? false : !!m.read,
      delivered: !!m.delivered,
      // A deleted message must not leak its attachment or its quoted text.
      ...(m.deleted ? {} : {
        type: m.type ?? "text",
        mediaUrl: m.mediaUrl,
        mediaName: m.mediaName,
        mediaMime: m.mediaMime,
        mediaSize: m.mediaSize,
        duration: m.duration,
        replyToId: m.replyToId,
        replyToText: m.replyToText,
        replyToFrom: m.replyToFrom,
        // Message-management state (v395)
        reactions: m.reactions ? Object.values(m.reactions) : undefined, // emoji list for chips
        myReaction: m.reactions?.[me.id],                                 // my own reaction (for toggling)
        starred: (m.starredBy ?? []).includes(me.id),
        pinned: !!m.pinned,
        editedAt: m.editedAt,
        forwarded: !!m.forwarded,
      }),
    })),
  });
}

// POST — DM management actions:
//   { action: "deleteForMe" | "deleteForEveryone" | "clearForMe" | "deleteMany"
//           | "removeConversation" | "block" | "unblock", id?, ids? }
export async function POST(req: Request, { params }: { params: Promise<{ userId: string }> }) {
  const me = await getCurrentUser();
  if (!me) return fail("Not authenticated", 401);
  const { userId } = await params;
  const other = (await findById(userId)) ?? (await findByUsername(userId));
  if (!other) return fail("User not found", 404);

  const { action, id, ids, emoji, text } = await readJson<{ action?: string; id?: string; ids?: string[]; emoji?: string; text?: string }>(req);
  if (action === "clearForMe") {
    await clearDmThread(me.id, other.id);
    return ok({ ok: true });
  }
  if (action === "removeConversation") {
    await removeDmConversation(me.id, other.id);
    return ok({ ok: true });
  }
  if (action === "block" || action === "unblock") {
    await setUserBlocked(me.id, other.id, action === "block");
    return ok({ ok: true, blocked: action === "block" });
  }
  if (action === "deleteMany") {
    await deleteManyDmsForMe(me.id, Array.isArray(ids) ? ids.filter((x) => typeof x === "string") : []);
    return ok({ ok: true });
  }
  if (!id) return fail("Message id required");
  if (action === "react") {
    await reactToDm(me.id, id, typeof emoji === "string" ? emoji : "");
    return ok({ ok: true });
  }
  if (action === "star") {
    await starDm(me.id, id);
    return ok({ ok: true });
  }
  if (action === "pin") {
    await pinDm(me.id, id);
    return ok({ ok: true });
  }
  if (action === "edit") {
    const r = await editDm(me.id, id, typeof text === "string" ? text : "");
    if (r !== true) return fail(r === "expired" ? "The time window to edit this message has passed." : "You can't edit this message.", 403);
    return ok({ ok: true });
  }
  // ---- Administrator control over ANY message in this conversation ----------
  // Both powers are switchable from Admin → Messaging Controls, and each action
  // is written to the admin log so there is always a record of who changed what.
  if (action === "adminEdit" || action === "adminDelete") {
    if (me.role !== "admin") return fail("Administrator access required", 403);
    if (action === "adminEdit") {
      const done = await adminEditDm(id, typeof text === "string" ? text : "");
      if (!done) return fail("Editing other people's messages is switched off, or the message no longer exists.", 403);
      await addAdminLog(me.fullName, `Edited a personal (DM) message (${id}) in the chat with ${other.fullName}`);
      return ok({ ok: true });
    }
    const done = await adminDeleteDm(id);
    if (!done) return fail("Deleting other people's messages is switched off, or the message is already removed.", 403);
    await addAdminLog(me.fullName, `Deleted a personal (DM) message (${id}) in the chat with ${other.fullName}`);
    return ok({ ok: true });
  }
  if (action === "deleteForEveryone") {
    const done = await deleteDmForEveryone(me.id, id);
    if (!done) return fail("You can only delete your own message for everyone, and only if it's enabled.", 403);
    return ok({ ok: true });
  }
  // default → delete for me
  await deleteDmForMe(me.id, id);
  return ok({ ok: true });
}
