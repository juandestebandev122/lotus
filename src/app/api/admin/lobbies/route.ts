import { ok, fail } from "@/server/http";
import { getCurrentUser } from "@/server/auth";
import { listLobbyLogs } from "@/server/repo";

export const runtime = "nodejs";

// Recent game lobbies + their full event logs (Admin → Game Lobby log viewer).
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return fail("Please log in first", 401);
  if (user.role !== "admin") return fail("Administrator access required", 403);
  return ok({ lobbies: await listLobbyLogs() });
}
