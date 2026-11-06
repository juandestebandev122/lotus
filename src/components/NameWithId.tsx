"use client";

// A member's name ALWAYS shown with their permanent ID number.
//
// Display names are not unique — this project has several members called "MM",
// two called "LOTUS", and names made mostly of emoji. Showing the name alone
// makes them impossible to tell apart in a list, a report or a room. The admin
// side already did this (UserLink); this is the same idea for the user-facing
// screens, in a form small enough to sit under a name without crowding it.

import { cn } from "@/lib/cn";

export function NameWithId({
  name,
  publicId,
  className,
  idClassName,
  inline = false,
}: {
  name: string;
  publicId?: string | null;
  className?: string;
  idClassName?: string;
  /** true = "Name · ID 100213" on one line; false = the ID on its own line under the name. */
  inline?: boolean;
}) {
  const id = (publicId ?? "").trim();
  if (!id) return <span className={className}>{name}</span>;
  if (inline) {
    return (
      <span className={className}>
        {name}
        <span className={cn("ml-1.5 font-mono text-[11px] text-mist-500", idClassName)}>ID {id}</span>
      </span>
    );
  }
  return (
    <span className={cn("inline-flex min-w-0 flex-col leading-tight", className)}>
      <span className="truncate">{name}</span>
      <span className={cn("font-mono text-[10px] text-mist-500", idClassName)}>ID {id}</span>
    </span>
  );
}

/** Plain-text form, for CSV/report columns and titles. */
export function nameWithId(name: string, publicId?: string | null): string {
  const id = (publicId ?? "").trim();
  return id ? `${name} (ID ${id})` : name;
}
