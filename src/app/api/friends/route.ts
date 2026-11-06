import { ok, fail, readJson } from "@/server/http";
import { getCurrentUser } from "@/server/auth";
import { listFriends, applyFriendAction, friendSuggestions, notifyUser } from "@/server/repo";

export const runtime = "nodejs";

export async function GET() {
  const me = await getCurrentUser();
  if (!me) return fail("Not authenticated", 401);
  const [friends, suggestions] = await Promise.all([listFriends(me.id), friendSuggestions(me.id)]);
  return ok({ friends, suggestions });
}

// Body: { otherId, action: "accept" | "decline" | "add" | "cancel" | "remove" }
export async function POST(req: Request) {
  const me = await getCurrentUser();
  if (!me) return fail("Not authenticated", 401);

  const { otherId, action } = await readJson(req);
  if (!otherId || typeof otherId !== "string") return fail("Missing otherId");
  if (!["accept", "decline", "add", "cancel", "remove"].includes(action as string)) return fail("Invalid action");

  const { state, unchanged } = await applyFriendAction(me.id, otherId, action as "add" | "accept" | "decline" | "cancel" | "remove");

  // Keep the other person informed. Skip the ping when the request was a no-op
  // (already friends / already requested) so re-tapping doesn't spam them.
  if (action === "add" && !unchanged) {
    await notifyUser(otherId, `${me.fullName} sent you a friend request`, { label: "View requests", href: "/friends" }, "friend_request");
  } else if (action === "accept") {
    await notifyUser(otherId, `${me.fullName} accepted your friend request 🎉`, { label: "View friends", href: "/friends" }, "friend_accept");
  }

  return ok({ otherId, state });
}
