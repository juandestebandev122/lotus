import Link from "next/link";

/**
 * The "🏛️ Agency: NAME" pill shown next to a room/group name everywhere it
 * appears (room header, rooms list, spectator view, in-game). It is SEPARATE from
 * the Host indicator — the agency and the host are different roles.
 *
 * When `id` is given AND `linked` is true, the pill links to the agency's profile
 * page. Inside another link (e.g. a room card) pass `linked={false}` so we don't
 * nest anchors — it renders as a plain label instead.
 */
export function AgencyBadge({
  name,
  id,
  linked = true,
  className = "",
}: {
  name?: string;
  id?: string;
  linked?: boolean;
  className?: string;
}) {
  if (!name) return null;
  const base = `inline-flex max-w-full items-center gap-1 truncate rounded-full border border-lotus-400/30 bg-lotus-500/15 px-2 py-0.5 text-[11px] font-semibold text-lotus-200${className ? ` ${className}` : ""}`;
  if (linked && id) {
    return (
      <Link href={`/agencies/${id}`} className={`${base} transition hover:bg-lotus-500/25`} title={`View agency: ${name}`}>
        🏛️ Agency: {name}
      </Link>
    );
  }
  return (
    <span className={base} title={`Agency: ${name}`}>
      🏛️ Agency: {name}
    </span>
  );
}
