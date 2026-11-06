"use client";

import { useEffect, useState } from "react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import { useConfig, saveConfig, type AppConfig } from "@/lib/config";
import { cn } from "@/lib/cn";
import { Trophy, Swords, Save, Loader2 } from "lucide-react";

type TC = NonNullable<AppConfig["tournamentControls"]>;
const TC_KEYS: (keyof TC)[] = ["tournamentRegistration", "tournamentAutoStart", "tournamentAutoPrize", "tournamentMatchRooms", "tournamentPublicListing", "competitionRegistration", "competitionVoting", "competitionGifts", "competitionResults", "adminAutoJoinCompetition"];

// Tournament & Competition Management — master ON/OFF for the whole sections plus
// granular ON/OFF for each sub-feature. Everything admin-controlled, no app update.
export default function TournamentControlsPage() {
  const { config, reload } = useConfig();
  const { toast } = useToast();
  const [tournamentsOn, setTournamentsOn] = useState(true);
  const [competitionsOn, setCompetitionsOn] = useState(true);
  const [tc, setTc] = useState<TC>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setTournamentsOn(config.features?.tournaments !== false);
    setCompetitionsOn(config.features?.competitions !== false);
    setTc(config.tournamentControls ?? {});
  }, [config.features, config.tournamentControls]);

  const on = (k: keyof TC) => tc[k] !== false;
  const setFlag = (k: keyof TC) => setTc((p) => ({ ...p, [k]: !on(k) }));

  const save = async () => {
    setSaving(true);
    // Preserve every existing feature flag; only change tournaments/competitions.
    const feats = { ...(config.features ?? {}), tournaments: tournamentsOn, competitions: competitionsOn };
    const res = await saveConfig({ features: feats as AppConfig["features"], tournamentControls: tc });
    setSaving(false);
    if (res.ok) { await reload(); toast("Tournament & competition settings saved — live now.", "success"); }
    else toast(res.error ?? "Could not save", "error");
  };

  return (
    <div className="space-y-5 pb-24">
      <div>
        <h1 className="flex items-center gap-2 font-display text-2xl font-extrabold text-mist-100"><Trophy className="size-6 text-lotus-300" /> Tournament &amp; Competition Management</h1>
        <p className="mt-1 text-sm text-mist-400">Turn the whole section on or off, and control each feature individually. Every change is live instantly — no app update needed.</p>
      </div>

      {/* Tournaments */}
      <Card className="p-5">
        <MasterRow icon={Trophy} title="Tournaments" desc="The entire tournaments section (brackets, match rooms, prizes)." on={tournamentsOn} onToggle={() => setTournamentsOn((v) => !v)} />
        <div className={cn("mt-3 divide-y divide-line/60 border-t border-line/60 pt-1", !tournamentsOn && "opacity-40 pointer-events-none")}>
          <SubRow label="Registration / Join" desc="Let users request to join tournaments" on={on("tournamentRegistration")} onToggle={() => setFlag("tournamentRegistration")} />
          <SubRow label="Auto start" desc="Automatically go Live at the scheduled time" on={on("tournamentAutoStart")} onToggle={() => setFlag("tournamentAutoStart")} />
          <SubRow label="Auto prize distribution" desc="Credit prizes automatically when a champion is decided" on={on("tournamentAutoPrize")} onToggle={() => setFlag("tournamentAutoPrize")} />
          <SubRow label="Match rooms (2/4-player)" desc="Allow the room + qualification format" on={on("tournamentMatchRooms")} onToggle={() => setFlag("tournamentMatchRooms")} />
          <SubRow label="Public listing" desc="Show tournaments to users (off = admin-only)" on={on("tournamentPublicListing")} onToggle={() => setFlag("tournamentPublicListing")} />
        </div>
      </Card>

      {/* Competitions */}
      <Card className="p-5">
        <MasterRow icon={Swords} title="Competitions" desc="The competitions (singing) section." on={competitionsOn} onToggle={() => setCompetitionsOn((v) => !v)} />
        <div className={cn("mt-3 divide-y divide-line/60 border-t border-line/60 pt-1", !competitionsOn && "opacity-40 pointer-events-none")}>
          <SubRow label="Registration" desc="Let users register for competitions" on={on("competitionRegistration")} onToggle={() => setFlag("competitionRegistration")} />
          <SubRow label="Audience voting" desc="Allow the audience to vote" on={on("competitionVoting")} onToggle={() => setFlag("competitionVoting")} />
          <SubRow label="Gifts" desc="Allow gifts inside competitions" on={on("competitionGifts")} onToggle={() => setFlag("competitionGifts")} />
          <SubRow label="Show results" desc="Show competition results to the audience" on={on("competitionResults")} onToggle={() => setFlag("competitionResults")} />
          <SubRow label="Admin join competition room" desc="On: admins count as present/participants in a competition. Off: admins can still moderate but are not counted as joined (they don't inflate the room / voting numbers)." on={on("adminAutoJoinCompetition")} onToggle={() => setFlag("adminAutoJoinCompetition")} />
        </div>
      </Card>

      <div className="fixed inset-x-0 bottom-0 z-20 border-t border-line bg-ink-900/95 px-4 py-3 backdrop-blur">
        <div className="mx-auto flex max-w-4xl items-center justify-between gap-3">
          <span className="text-xs text-mist-400">Changes apply instantly across the app after you save.</span>
          <Button onClick={save} disabled={saving}>{saving ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />} Save settings</Button>
        </div>
      </div>
    </div>
  );
}

function MasterRow({ icon: Icon, title, desc, on, onToggle }: { icon: typeof Trophy; title: string; desc: string; on: boolean; onToggle: () => void }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <div className="flex items-center gap-3">
        <span className={cn("grid size-10 place-items-center rounded-xl", on ? "bg-lotus-500/15 text-lotus-300" : "bg-white/[0.06] text-mist-500")}><Icon className="size-5" /></span>
        <div>
          <div className="flex items-center gap-2 font-display text-lg font-bold text-mist-100">{title}<span className={cn("rounded-full px-2 py-0.5 text-[10px] font-bold", on ? "bg-emerald-500/15 text-emerald-300" : "bg-rose-500/15 text-rose-300")}>{on ? "Active" : "Disabled"}</span></div>
          <div className="text-xs text-mist-400">{desc}</div>
        </div>
      </div>
      <Toggle on={on} onToggle={onToggle} big />
    </div>
  );
}
function SubRow({ label, desc, on, onToggle }: { label: string; desc: string; on: boolean; onToggle: () => void }) {
  return (
    <div className="flex items-center justify-between gap-3 py-3">
      <div><div className="text-sm font-semibold text-mist-100">{label}</div><div className="text-xs text-mist-500">{desc}</div></div>
      <Toggle on={on} onToggle={onToggle} />
    </div>
  );
}
function Toggle({ on, onToggle, big }: { on: boolean; onToggle: () => void; big?: boolean }) {
  return (
    <button onClick={onToggle} className={cn("relative shrink-0 rounded-full transition", big ? "h-8 w-16" : "h-6 w-12", on ? "bg-emerald-500" : "bg-mist-600")} aria-pressed={on}>
      <span className={cn("absolute top-0.5 rounded-full bg-white transition-all", big ? "size-7" : "size-5", on ? (big ? "left-[calc(100%-1.875rem)]" : "left-[calc(100%-1.375rem)]") : "left-0.5")} />
    </button>
  );
}
