// Competition staff roles + the granular permission catalog the Admin assigns
// per Host / Co-Host / Moderator / Judge. Shared by the server (enforcement) and
// the admin UI (toggles). Enforced permissions map to real competition actions;
// the rest are stored/assignable for future actions.

export type CompetitionStaffRole = "host" | "cohost" | "moderator" | "judge";

export interface CompetitionPermission { key: string; label: string; group: string }

export const COMPETITION_PERMISSIONS: CompetitionPermission[] = [
  // Flow
  { key: "start", label: "Start Competition", group: "Flow" },
  { key: "end", label: "End Competition", group: "Flow" },
  { key: "pause", label: "Pause Competition", group: "Flow" },
  { key: "resume", label: "Resume Competition", group: "Flow" },
  { key: "manageQueue", label: "Manage Queue / Next singer", group: "Flow" },
  { key: "changeOrder", label: "Change Speaking Order", group: "Flow" },
  { key: "announceWinners", label: "Announce Winners / Publish results", group: "Flow" },
  // Room
  { key: "lockRoom", label: "Lock Room", group: "Room" },
  { key: "unlockRoom", label: "Unlock Room", group: "Room" },
  { key: "editDetails", label: "Edit Competition Details", group: "Room" },
  { key: "schedule", label: "Schedule Competition", group: "Room" },
  { key: "uploadBanner", label: "Upload Competition Banner", group: "Room" },
  { key: "sendNotifications", label: "Send Room Notifications", group: "Room" },
  // Participants
  { key: "approveJoin", label: "Approve Registrations", group: "Participants" },
  { key: "rejectJoin", label: "Reject Registrations", group: "Participants" },
  { key: "remove", label: "Remove Participants", group: "Participants" },
  { key: "ban", label: "Ban Participants", group: "Participants" },
  { key: "mute", label: "Mute Participants", group: "Participants" },
  { key: "unmute", label: "Unmute Participants", group: "Participants" },
  { key: "muteAll", label: "Mute Everyone", group: "Participants" },
  { key: "inviteSpeakers", label: "Invite Speakers", group: "Participants" },
  { key: "acceptHands", label: "Accept Raised Hands", group: "Participants" },
  { key: "tempSpeakers", label: "Assign Temporary Speakers", group: "Participants" },
  { key: "manageAudience", label: "Manage Audience", group: "Participants" },
  // Voting
  { key: "enableVoting", label: "Enable Voting", group: "Voting" },
  { key: "disableVoting", label: "Disable Voting", group: "Voting" },
  { key: "startVoting", label: "Start Voting", group: "Voting" },
  { key: "stopVoting", label: "Stop Voting", group: "Voting" },
  // Chat / moderation
  { key: "pinMessages", label: "Pin Messages", group: "Chat" },
  { key: "deleteMessages", label: "Delete Messages", group: "Chat" },
  { key: "deleteComments", label: "Delete Comments", group: "Chat" },
  { key: "enableComments", label: "Enable Comments", group: "Chat" },
  { key: "disableComments", label: "Disable Comments", group: "Chat" },
  // Coins / reports
  { key: "awardBonus", label: "Award Bonus Coins", group: "Coins & Reports" },
  { key: "viewReports", label: "View Reports", group: "Coins & Reports" },
  { key: "viewAnalytics", label: "View Analytics", group: "Coins & Reports" },
];

export const COMPETITION_PERM_KEYS = COMPETITION_PERMISSIONS.map((p) => p.key);

/** Sensible default permission set per role (Admin can change any of them). */
export function defaultPermsForRole(role: CompetitionStaffRole): string[] {
  switch (role) {
    case "host":
      return COMPETITION_PERM_KEYS; // a host gets everything by default
    case "cohost":
      return ["pause", "resume", "manageQueue", "changeOrder", "approveJoin", "rejectJoin", "remove", "mute", "unmute", "muteAll", "inviteSpeakers", "acceptHands", "enableVoting", "disableVoting", "sendNotifications", "viewReports"];
    case "moderator":
      return ["remove", "ban", "mute", "unmute", "muteAll", "pinMessages", "deleteMessages", "deleteComments", "enableComments", "disableComments", "lockRoom", "unlockRoom"];
    case "judge":
      return ["startVoting", "stopVoting", "enableVoting", "disableVoting", "viewReports", "viewAnalytics", "awardBonus"];
    default:
      return [];
  }
}

export const STAFF_ROLE_LABEL: Record<CompetitionStaffRole, string> = {
  host: "Host", cohost: "Co-Host", moderator: "Moderator", judge: "Judge",
};
