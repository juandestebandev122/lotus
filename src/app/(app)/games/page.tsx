import { redirect } from "next/navigation";

// Games are now played inside a Voice Room (group), so the standalone
// games hub just points people to the rooms list.
export default function GamesPage() {
  redirect("/rooms");
}
