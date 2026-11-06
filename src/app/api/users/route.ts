import { ok } from "@/server/http";
import { searchUsers } from "@/server/repo";
import { publicUser, getCurrentUser } from "@/server/auth";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const q = searchParams.get("q") ?? "";
  const me = await getCurrentUser();
  const users = (await searchUsers(q))
    .filter((u) => u.id !== me?.id)
    .map(publicUser);
  return ok({ users });
}
