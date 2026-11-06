"use client";

import { useEffect, useState } from "react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import { useConfig, saveConfig } from "@/lib/config";
import { cn } from "@/lib/cn";
import { Check } from "lucide-react";

type Kind = "user" | "group" | "agency";
type Rules = Record<Kind, boolean>; // true = duplicates allowed

const ROWS: { id: Kind; label: string; desc: string }[] = [
  { id: "user", label: "User Name", desc: "The member's display name (Full name) — at sign-up, profile edit, and accounts created by admins or agencies." },
  { id: "group", label: "Group Name", desc: "Room / group names — when a group is created, renamed, or a rename / extra-room request is approved." },
  { id: "agency", label: "Agency Name", desc: "Agency names — when an agency is requested, created or renamed." },
];

const fromConfig = (d?: { user?: boolean; group?: boolean; agency?: boolean }): Rules => ({
  user: d?.user !== false,
  group: d?.group !== false,
  agency: d?.agency !== false,
});

/** Admin → Settings: allow or block duplicate User / Group / Agency names. */
export function DuplicateNamesCard() {
  const { config, loading, reload } = useConfig();
  const { toast } = useToast();
  const saved = fromConfig(config.duplicateNames);
  const [rules, setRules] = useState<Rules>(saved);
  const [saving, setSaving] = useState(false);

  const savedKey = JSON.stringify(saved);
  useEffect(() => {
    if (!loading) setRules(JSON.parse(savedKey) as Rules);
  }, [loading, savedKey]);

  const dirty = JSON.stringify(rules) !== savedKey;

  const save = async () => {
    setSaving(true);
    const res = await saveConfig({ duplicateNames: rules });
    setSaving(false);
    if (!res.ok) {
      toast(res.error ?? "Could not save", "error");
      return;
    }
    await reload();
    toast("Duplicate-name rules saved", "success");
  };

  return (
    <Card className="p-5">
      <h2 className="font-semibold text-mist-100">Duplicate names</h2>
      <p className="mt-1 text-xs leading-relaxed text-mist-400">
        Choose, for each name type, whether two records may share the same name. With
        <b className="text-mist-200"> Duplicate Names Not Allowed</b>, a name that already exists is refused — capital
        letters and extra spaces don&apos;t count as a difference (&ldquo;John Smith&rdquo; = &ldquo;john&nbsp;&nbsp;smith&rdquo;).
        Names that are already duplicated stay as they are; only new names and renames are checked.
      </p>

      <div className="mt-4 space-y-2">
        {ROWS.map((r) => (
          <div key={r.id} className="rounded-xl border border-line bg-ink-800 px-3 py-3">
            <div className="text-sm font-semibold text-mist-100">{r.label}</div>
            <div className="text-xs text-mist-400">{r.desc}</div>
            <div className="mt-2.5 grid grid-cols-2 gap-2" role="radiogroup" aria-label={r.label}>
              {([true, false] as const).map((allowed) => {
                const active = rules[r.id] === allowed;
                return (
                  <button
                    key={String(allowed)}
                    type="button"
                    role="radio"
                    aria-checked={active}
                    disabled={loading || saving}
                    onClick={() => setRules((s) => ({ ...s, [r.id]: allowed }))}
                    className={cn(
                      "rounded-lg border px-3 py-2 text-xs font-semibold transition-colors disabled:opacity-50",
                      active
                        ? allowed
                          ? "border-emerald-400/60 bg-emerald-500/15 text-emerald-200"
                          : "border-rose-400/60 bg-rose-500/15 text-rose-200"
                        : "border-line bg-ink-900 text-mist-400 hover:text-mist-200",
                    )}
                  >
                    {allowed ? "Duplicate Names Allowed" : "Duplicate Names Not Allowed"}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      <p className="mt-3 text-xs text-mist-500">
        Login usernames (@username) are always unique — this setting doesn&apos;t change that.
      </p>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <Button onClick={save} disabled={loading || saving || !dirty}>
          <Check className="size-4" /> {saving ? "Saving…" : "Save name rules"}
        </Button>
        {dirty && <span className="text-xs text-amber-300">Not saved yet.</span>}
      </div>
    </Card>
  );
}
