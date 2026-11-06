// Shared admin role + permission definitions (server- and client-safe).

export type AdminRole = "super_admin" | "admin" | "moderator" | "support";

export const ADMIN_ROLES: { key: AdminRole; label: string; desc: string }[] = [
  { key: "super_admin", label: "Super Admin", desc: "Full access to everything, including admin management." },
  { key: "admin", label: "Admin", desc: "Manage the platform, but not other admins or core settings." },
  { key: "moderator", label: "Agency Manager", desc: "Manage agencies, plus rooms and reports." },
  { key: "support", label: "Support Staff", desc: "View and manage support tickets only." },
];

// Permission keys map to the admin sections / nav items.
export const ADMIN_PERMISSIONS: { key: string; label: string }[] = [
  { key: "analytics", label: "Analytics" },
  { key: "users", label: "Users" },
  { key: "rooms", label: "Rooms / Groups" },
  { key: "games", label: "Games" },
  { key: "tournaments", label: "Tournaments" },
  { key: "coins", label: "Coin Packages & Rewards" },
  { key: "agencies", label: "Agency System" },
  { key: "competitions", label: "Competitions" },
  { key: "membership", label: "Membership" },
  { key: "ads", label: "Advertisements" },
  { key: "notifications", label: "Notifications" },
  { key: "content", label: "Content" },
  { key: "reports", label: "Reports / Moderation" },
  { key: "moderation", label: "Moderation Center (Super Admin tools)" },
  { key: "support", label: "Support tickets" },
  { key: "documents", label: "Document Requests" },
  { key: "payments", label: "Payments / Financial" },
  { key: "storage", label: "Storage Management" },
  { key: "settings", label: "Settings & Permissions" },
  { key: "admins", label: "Admin management" },
];

export const ALL_PERMS = ADMIN_PERMISSIONS.map((p) => p.key);

export const ROLE_DEFAULT_PERMS: Record<AdminRole, string[]> = {
  super_admin: [...ALL_PERMS],
  admin: ALL_PERMS.filter((p) => p !== "admins" && p !== "payments"),
  // Agency Manager = the Agency System + group & room management (rooms + the
  // moderation tools that act on them). No user/admin/finance access.
  moderator: ["agencies", "rooms", "reports", "moderation"],
  support: ["support"],
};

/** The effective permissions for a user. Treats a missing adminRole as super_admin
 *  (so the original seeded admin keeps full access). */
export function effectivePerms(adminRole?: string, adminPermissions?: string[]): string[] {
  if (!adminRole || adminRole === "super_admin") return [...ALL_PERMS];
  return adminPermissions ?? ROLE_DEFAULT_PERMS[(adminRole as AdminRole)] ?? [];
}

export function canAccess(perm: string, adminRole?: string, adminPermissions?: string[]): boolean {
  return effectivePerms(adminRole, adminPermissions).includes(perm);
}
