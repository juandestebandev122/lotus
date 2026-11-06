import { ok, fail, readJson } from "@/server/http";
import { getCurrentUser } from "@/server/auth";
import { profilesByIds } from "@/server/repo";

export const runtime = "nodejs";

// Resolve real profile basics (name / username / avatar) for a list of user ids.
// The voice room uses this so EVERY member sees each other's real photo —
// avatars are stored on the account, not carried in the live-voice metadata.
export async function POST(req: Request) {
  const me = await getCurrentUser();
  if (!me) return fail("Please log in first", 401);

  const { ids } = await readJson<{ ids?: string[] }>(req);
  if (!Array.isArray(ids)) return fail("ids array required");
  const wanted = ids.filter((x) => typeof x === "string").slice(0, 100);
  const profiles = await profilesByIds(wanted);
  return ok({ profiles });
}
