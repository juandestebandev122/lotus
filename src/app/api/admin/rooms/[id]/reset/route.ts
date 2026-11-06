import { ok, fail, readJson } from "@/server/http";
import { getCurrentUser } from "@/server/auth";
import { adminResetRoomSection, type RoomResetSection } from "@/server/repo";

export const runtime = "nodejs";

const SECTIONS: RoomResetSection[] = [
  "groupSettings", "chat", "memberPerms", "hostCohost", "moderation",
  "games", "gameConfig", "voice", "security", "announcements", "reports", "factory",
];

// Super-Admin: reset ONE section of THIS room's configuration back to defaults.
// Isolated to this room only; audit-logged. Also fixes a stuck game (section "games").
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return fail("Please log in first", 401);
  if (user.role !== "admin") return fail("Administrator access required", 403);
  const { id } = await ctx.params;
  const body = await readJson<{ section?: string }>(req);
  const section = body.section as RoomResetSection;
  if (!SECTIONS.includes(section)) return fail("Unknown reset section");
  const res = await adminResetRoomSection(user.fullName, user.id, id, section);
  if (!res.ok) return fail(res.error ?? "Reset failed", 400);
  return ok({ ok: true, summary: res.summary });
}
