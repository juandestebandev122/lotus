/** Building the link to a member's public profile.
 *
 *  A profile lives at /u/<key>. Historically the key was always the username —
 *  which breaks for the members whose username contains emoji or other non-ASCII
 *  characters (e.g. "🪷sivasiva", "🅱𝖚𝖏𝖏𝖎...💗"). Those profiles render perfectly on
 *  the server, but the LINK to them was built un-encoded in most places, so
 *  clicking it navigated to a mangled URL and the member appeared "unviewable".
 *
 *  Fix: always link with an ASCII-safe key. A plain username is kept (nice URLs),
 *  anything else falls back to the member ID number, then the internal id. The
 *  profile route resolves all three, so every member is always reachable. */

const PLAIN_USERNAME = /^[A-Za-z0-9._-]{1,40}$/;

export interface ProfileLinkable {
  username?: string | null;
  publicId?: string | null;
  id?: string | null;
}

/** The safest key that resolves to this member's profile. */
export function profileKey(user: ProfileLinkable): string {
  const uname = (user.username ?? "").trim();
  if (PLAIN_USERNAME.test(uname)) return uname;
  const pid = (user.publicId ?? "").trim();
  if (pid) return pid;
  const id = (user.id ?? "").trim();
  if (id) return id;
  return uname; // last resort — encoded below
}

/** Href for a member's public profile. Always ASCII, always encoded. */
export function profileHref(user: ProfileLinkable): string {
  return `/u/${encodeURIComponent(profileKey(user))}`;
}

/** Same, for the many call sites that only have loose strings to hand. */
export function profileHrefOf(username?: string | null, publicId?: string | null, id?: string | null): string {
  return profileHref({ username, publicId, id });
}
