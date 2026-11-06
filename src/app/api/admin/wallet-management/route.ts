import { ok, fail } from "@/server/http";
import { getCurrentUser } from "@/server/auth";
import { walletManagementSummary, userWalletDetail, listWalletAudit, searchWalletUsers, houseWalletsOverview } from "@/server/repo";

export const runtime = "nodejs";

// The consolidated Wallet-Management dashboard.
//   ?q=<term>   → live user-search results (for the wallet picker) — returns { matches }
//   ?user=<key> → that user's full wallet (balances, locked, lifetime, dual ledgers)
//   (no param)  → summary tiles + Company/Agencies/Trust house wallets + recent audit
export async function GET(req: Request) {
  const user = await getCurrentUser();
  if (!user) return fail("Please log in first", 401);
  if (user.role !== "admin") return fail("Administrator access required", 403);
  const sp = new URL(req.url).searchParams;
  const q = sp.get("q")?.trim();
  if (q) return ok({ matches: await searchWalletUsers(q, 25) });

  const key = sp.get("user")?.trim();
  if (key) return ok({ detail: await userWalletDetail(key) });

  const [summary, house, audit] = await Promise.all([walletManagementSummary(), houseWalletsOverview(), listWalletAudit(300)]);
  return ok({ summary, house, audit });
}
