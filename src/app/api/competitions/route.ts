import { ok, fail, readJson } from "@/server/http";
import { getCurrentUser } from "@/server/auth";
import { listCompetitions, createCompetition, getConfig, notifyAdmins } from "@/server/repo";

export const runtime = "nodejs";

// List active Competition Voice Rooms.
export async function GET() {
  return ok({ competitions: await listCompetitions() });
}

// Create a Competition Voice Room (creates a voice room + a competition).
// ADMIN ONLY — per the workflow, only an admin announces/creates a competition
// (normal users register to participate; the host then runs it).
export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return fail("Please log in first", 401);
  if (user.role !== "admin") return fail("Only an admin can create a competition.", 403);
  // Respects the master Voice Rooms feature switch (competitions ARE voice rooms).
  if ((await getConfig()).features?.voiceRooms === false) return fail("Voice Rooms are currently turned off.", 403);
  const b = await readJson<{ title?: string; prize?: string; registrationFeeCoins?: number; winnerPrizeCoins?: number; speakingSeats?: number }>(req);
  if (!b.title || !b.title.trim()) return fail("Enter a competition title");
  const res = await createCompetition(user.id, user.fullName, {
    title: b.title, prize: b.prize,
    registrationFeeCoins: typeof b.registrationFeeCoins === "number" ? b.registrationFeeCoins : undefined,
    winnerPrizeCoins: typeof b.winnerPrizeCoins === "number" ? b.winnerPrizeCoins : undefined,
    speakingSeats: typeof b.speakingSeats === "number" ? b.speakingSeats : undefined,
  });
  if (!res.ok) return fail(res.error ?? "Could not create the competition", 400);
  try { await notifyAdmins(`New competition created: “${b.title.trim()}” by ${user.fullName}.`, { label: "Room Activities", href: "/admin/room-activities" }); } catch { /* non-fatal */ }
  return ok({ roomId: res.roomId }, 201);
}
