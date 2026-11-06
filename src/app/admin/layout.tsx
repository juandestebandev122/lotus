import { AdminShell } from "@/components/admin/AdminShell";

export const metadata = { title: "Admin · LotusPlay Connect" };

// Render every admin page DYNAMICALLY (per request) instead of as a statically
// prerendered shell. The static shells were served with a 1-year cache header,
// so after a deploy a browser could keep an OLD admin page that pointed at JS
// chunks which no longer exist on the server — the page then failed to load
// ("This page couldn't load"). Forcing dynamic = no long-lived cached HTML, so
// every visit gets fresh markup that references the current build's chunks.
export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return <AdminShell>{children}</AdminShell>;
}
