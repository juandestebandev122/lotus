import { ok } from "@/server/http";
import { listAgencyPlans } from "@/server/repo";

export const runtime = "nodejs";

// Public: the ENABLED agency membership plans (for the request + purchase forms).
export async function GET() {
  return ok({ plans: await listAgencyPlans(false) });
}
