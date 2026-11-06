"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Card } from "@/components/ui/Card";
import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import { useConfig, saveConfig } from "@/lib/config";
import { cn } from "@/lib/cn";
import { fetchAdminBusinesses, adminBusinessAction, adminCreateBusiness, editBusiness, runBusinessMigration, type BusinessCard, type BizActivity, type BusinessFieldDef, type BusinessSection, type BizInput } from "@/lib/business";
import { Building2, BadgeCheck, Check, X, Ban, RotateCcw, Trash2, ScrollText, Users, Eye, Save, ExternalLink, Clock, Coins, Lock, Plus, Briefcase, ListPlus, ArrowUp, ArrowDown, Layers, Settings2, Pencil, RefreshCw, Loader2 } from "lucide-react";

const FIELD_TYPE_OPTIONS: { value: BusinessFieldDef["type"]; label: string }[] = [
  { value: "text", label: "Short text" },
  { value: "textarea", label: "Long text" },
  { value: "tel", label: "Phone" },
  { value: "email", label: "Email" },
  { value: "url", label: "Website / link" },
  { value: "number", label: "Number" },
  { value: "select", label: "Dropdown (choices)" },
];

const DEFAULT_SECTIONS: BusinessSection[] = [
  { key: "page", label: "Business Page", enabled: true },
  { key: "reels", label: "Reels / Shorts", enabled: true },
  { key: "videos", label: "Videos", enabled: true },
  { key: "products", label: "Products", enabled: true },
  { key: "offers", label: "Offers", enabled: true },
  { key: "jobs", label: "Jobs", enabled: true },
  { key: "reviews", label: "Reviews", enabled: true },
];

const STATUS_PILL: Record<string, string> = {
  pending: "bg-amber-500/15 text-amber-300",
  verified: "bg-emerald-500/15 text-emerald-300",
  rejected: "bg-rose-500/15 text-rose-300",
  suspended: "bg-orange-500/15 text-orange-300",
};

const LOG_TONE: Record<string, string> = {
  create: "bg-lotus-500/15 text-lotus-200",
  update: "bg-sky-500/15 text-sky-200",
  verify: "bg-emerald-500/15 text-emerald-300",
  reject: "bg-rose-500/15 text-rose-300",
  suspend: "bg-orange-500/15 text-orange-300",
  restore: "bg-emerald-500/15 text-emerald-300",
  remove: "bg-rose-500/15 text-rose-300",
};

export default function AdminBusinessPage() {
  const { toast } = useToast();
  const { config, reload: reloadConfig } = useConfig();
  const [businesses, setBusinesses] = useState<BusinessCard[]>([]);
  const [log, setLog] = useState<BizActivity[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"dashboard" | "forms" | "create" | "pending" | "all" | "log">("dashboard");
  const [cats, setCats] = useState("");
  const [regCost, setRegCost] = useState(0);
  const [jobTypes, setJobTypes] = useState("");
  const [fields, setFields] = useState<BusinessFieldDef[]>([]);
  const [jobFields, setJobFields] = useState<BusinessFieldDef[]>([]);
  const [sections, setSections] = useState<BusinessSection[]>([]);
  const [savingCats, setSavingCats] = useState(false);
  const [migrating, setMigrating] = useState(false);

  const runMigration = async () => {
    setMigrating(true);
    const res = await runBusinessMigration();
    setMigrating(false);
    if (res.ok) { await reloadConfig(); reload(); toast(`Done — ${res.businessesUpdated} business record(s) upgraded${res.sectionsAdded.length ? `, new section(s): ${res.sectionsAdded.join(", ")}` : ""}. No data changed.`, "success"); }
    else toast(res.error ?? "Migration failed", "error");
  };

  const reload = () => fetchAdminBusinesses().then((d) => { setBusinesses(d.businesses); setLog(d.log); setLoading(false); });
  useEffect(() => { reload(); }, []);
  useEffect(() => { setCats((config.business?.categories ?? []).join("\n")); }, [config.business?.categories]);
  useEffect(() => { setRegCost(config.business?.registerCost ?? 0); }, [config.business?.registerCost]);
  useEffect(() => { setJobTypes((config.business?.jobTypes ?? []).join("\n")); }, [config.business?.jobTypes]);
  useEffect(() => { setFields((config.business?.fields ?? []).map((f) => ({ ...f }))); }, [config.business?.fields]);
  useEffect(() => { setJobFields((config.business?.jobFields ?? []).map((f) => ({ ...f }))); }, [config.business?.jobFields]);
  useEffect(() => {
    const secs = config.business?.profileSections?.length ? config.business.profileSections : DEFAULT_SECTIONS;
    setSections(secs.map((s) => ({ ...s })));
  }, [config.business?.profileSections]);

  const stats = useMemo(() => ({
    total: businesses.length,
    verified: businesses.filter((b) => b.status === "verified").length,
    pending: businesses.filter((b) => b.status === "pending").length,
    followers: businesses.reduce((n, b) => n + b.followers, 0),
  }), [businesses]);

  const pending = businesses.filter((b) => b.status === "pending");

  const act = async (b: BusinessCard, action: "verify" | "reject" | "suspend" | "restore" | "remove") => {
    let note: string | undefined;
    if (action === "reject") { const n = window.prompt(`Reason for rejecting "${b.name}"? (optional)`); if (n === null) return; note = n || undefined; }
    if (action === "remove" && !window.confirm(`Permanently remove "${b.name}"? This deletes the record.`)) return;
    const okRes = await adminBusinessAction(b.id, action, note);
    if (okRes) { toast(`Business ${action === "verify" ? "verified" : action === "reject" ? "rejected" : action + "d"}.`, "success"); reload(); }
    else toast("Action failed", "error");
  };

  // Admin controls each business's visibility: everyone, or only registered
  // ("connected") business users.
  const setVisibility = async (b: BusinessCard, visibility: "everyone" | "businesses") => {
    if (b.visibility === visibility) return;
    const res = await editBusiness(b.id, { visibility });
    if (res.ok) { toast(visibility === "everyone" ? "Now visible to all users." : "Now visible to business users only.", "success"); reload(); }
    else toast(res.error ?? "Could not update visibility", "error");
  };

  const cleanFieldList = (list: BusinessFieldDef[]): BusinessFieldDef[] => list
    .filter((f) => f.label.trim())
    .map((f) => ({
      key: f.key,
      label: f.label.trim(),
      type: f.type,
      options: f.type === "select" ? (f.options ?? []).map((o) => o.trim()).filter(Boolean).slice(0, 30) : undefined,
      placeholder: f.placeholder?.trim() || undefined,
      required: !!f.required,
      enabled: f.enabled !== false,
    }))
    .slice(0, 30);

  const saveSettings = async () => {
    setSavingCats(true);
    const list = cats.split("\n").map((s) => s.trim()).filter(Boolean).slice(0, 40);
    const jt = jobTypes.split("\n").map((s) => s.trim()).filter(Boolean).slice(0, 30);
    const cleanSections = sections.map((s) => ({ key: s.key, label: (s.label || s.key).trim().slice(0, 40), enabled: s.enabled !== false }));
    // Send the FULL business object so no field is dropped on save.
    await saveConfig({ business: { categories: list, registerCost: Math.max(0, Math.floor(regCost || 0)), jobTypes: jt, fields: cleanFieldList(fields), jobFields: cleanFieldList(jobFields), profileSections: cleanSections } });
    await reloadConfig();
    setSavingCats(false);
    toast("Business settings saved.", "success");
  };

  if (loading) return <div className="grid min-h-[60vh] place-items-center text-mist-400">Loading businesses…</div>;

  return (
    <div className="space-y-5">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold text-mist-100"><Building2 className="size-6 text-lotus-300" /> Business Module</h1>
        <p className="mt-0.5 text-sm text-mist-400">Verify businesses, manage the directory, and set categories.</p>
      </div>

      {/* Tabs */}
      <div className="flex flex-wrap gap-2">
        {([["dashboard", "Dashboard"], ["forms", "Forms & Fields"], ["create", "Create business"], ["pending", `Pending${stats.pending ? ` · ${stats.pending}` : ""}`], ["all", "All businesses"], ["log", "Activity log"]] as const).map(([k, label]) => (
          <button key={k} onClick={() => setTab(k)} className={cn("rounded-lg border px-3.5 py-1.5 text-sm font-semibold transition-colors", tab === k ? "border-lotus-400 bg-lotus-500/15 text-lotus-100" : "border-line bg-ink-800 text-mist-300 hover:bg-ink-700")}>{label}</button>
        ))}
      </div>

      {tab === "dashboard" && (
        <div className="space-y-4">
          {/* Upgrade existing accounts to the latest features */}
          <Card className="flex flex-wrap items-center justify-between gap-3 border-sky-400/25 bg-sky-500/[0.05] p-4">
            <div className="min-w-0">
              <h3 className="flex items-center gap-2 font-bold text-mist-100"><RefreshCw className="size-4 text-sky-300" /> Upgrade existing accounts</h3>
              <p className="mt-0.5 text-[11px] text-mist-500">Gives every OLD business the newest features (e.g. the Reviews tab). Safe — it never changes or deletes any existing content. Runs automatically on updates; tap to run it now.</p>
            </div>
            <Button size="sm" onClick={runMigration} disabled={migrating}>{migrating ? <Loader2 className="size-4 animate-spin" /> : <RefreshCw className="size-4" />} Upgrade all now</Button>
          </Card>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Stat icon={Building2} tone="text-lotus-300" label="Businesses" value={stats.total} />
            <Stat icon={BadgeCheck} tone="text-emerald-300" label="Verified" value={stats.verified} />
            <Stat icon={Clock} tone="text-amber-300" label="Pending" value={stats.pending} />
            <Stat icon={Users} tone="text-sky-300" label="Total followers" value={stats.followers} />
          </div>

          <Card className="p-5">
            <h3 className="flex items-center gap-2 font-bold text-mist-100"><ScrollText className="size-4 text-lotus-300" /> Business settings</h3>

            <div className="mt-3">
              <label className="mb-1 block text-xs font-semibold text-mist-300">Registration cost (coins)</label>
              <div className="flex items-center gap-2 rounded-lg border border-line bg-ink-800 px-2.5">
                <Coins className="size-4 text-gold-300" />
                <input type="number" min={0} value={regCost} onChange={(e) => setRegCost(Math.max(0, Math.floor(Number(e.target.value) || 0)))} className="h-9 w-24 bg-transparent text-sm text-mist-100 outline-none" />
                <span className="text-xs text-mist-500">coins to register a business (0 = free · refunded if rejected)</span>
              </div>
            </div>

            <label className="mb-1 mt-4 block text-xs font-semibold text-mist-300">Categories</label>
            <p className="text-[11px] text-mist-500">One category per line — shown in the register form &amp; directory filter.</p>
            <textarea value={cats} onChange={(e) => setCats(e.target.value)} rows={8} className="mt-2 w-full rounded-xl border border-line bg-ink-800 p-3 text-sm text-mist-100 outline-none focus:border-lotus-400" />

            <label className="mb-1 mt-4 flex items-center gap-1.5 text-xs font-semibold text-mist-300"><Briefcase className="size-3.5 text-lotus-300" /> Job types</label>
            <p className="text-[11px] text-mist-500">One job type per line — shown in the “Post a job” form (e.g. Full Time, Remote).</p>
            <textarea value={jobTypes} onChange={(e) => setJobTypes(e.target.value)} rows={5} className="mt-2 w-full rounded-xl border border-line bg-ink-800 p-3 text-sm text-mist-100 outline-none focus:border-lotus-400" />

            <Button size="sm" className="mt-4" onClick={saveSettings} disabled={savingCats}><Save className="size-4" /> Save settings</Button>
          </Card>
        </div>
      )}

      {tab === "forms" && (
        <div className="space-y-4">
          <Card className="p-5">
            <FieldBuilder
              title="Business registration form fields"
              hint="Add extra fields to the business registration form. They appear on the form AND the public profile. Reorder with ↑ ↓; hide with the Shown toggle."
              emptyHint="No extra fields yet. Standard fields (name, category, description, phone, email, website…) always show. Add your own (e.g. VAT / Tax Number, CR Number, Owner name, Established year)."
              fields={fields}
              onChange={setFields}
            />
            <Button size="sm" className="mt-4" onClick={saveSettings} disabled={savingCats}><Save className="size-4" /> Save all form settings</Button>
          </Card>

          <Card className="p-5">
            <FieldBuilder
              title="Job post form fields"
              hint="Add extra fields to the “Post a job” form. They appear on the job form AND the job details page."
              emptyHint="No extra job fields yet. Standard fields (title, type, salary, location, description, qualifications, vacancies, deadline, contact) always show. Add your own (e.g. Experience level, Shift, Benefits)."
              fields={jobFields}
              onChange={setJobFields}
            />
            <Button size="sm" className="mt-4" onClick={saveSettings} disabled={savingCats}><Save className="size-4" /> Save all form settings</Button>
          </Card>

          <Card className="p-5">
            <SectionBuilder sections={sections} onChange={setSections} />
            <Button size="sm" className="mt-4" onClick={saveSettings} disabled={savingCats}><Save className="size-4" /> Save all form settings</Button>
          </Card>
        </div>
      )}

      {tab === "create" && (
        <CreateBusinessForm categories={config.business?.categories ?? []} onCreated={() => { reload(); setTab("all"); }} />
      )}

      {tab === "pending" && (
        <div className="space-y-3">
          {pending.length === 0 ? <Card className="p-8 text-center text-sm text-mist-400">No businesses waiting for review. 🎉</Card>
            : pending.map((b) => <AdminRow key={b.id} b={b} onAct={act} onVisibility={setVisibility} />)}
        </div>
      )}

      {tab === "all" && (
        <div className="space-y-3">
          {businesses.length === 0 ? <Card className="p-8 text-center text-sm text-mist-400">No businesses yet.</Card>
            : businesses.map((b) => <AdminRow key={b.id} b={b} onAct={act} onVisibility={setVisibility} />)}
        </div>
      )}

      {tab === "log" && (
        <Card className="divide-y divide-line p-0">
          {log.length === 0 ? <p className="p-6 text-center text-sm text-mist-500">No activity yet.</p>
            : log.map((e) => (
              <div key={e.id} className="flex items-center gap-3 px-4 py-2.5">
                <span className={cn("rounded-md px-2 py-0.5 text-[10px] font-bold uppercase", LOG_TONE[e.type] ?? "bg-mist-500/15 text-mist-300")}>{e.type}</span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm text-mist-200">{e.detail}</p>
                  <p className="text-[11px] text-mist-500">{e.actorName}{e.targetName ? ` · ${e.targetName}` : ""} · {new Date(e.at).toLocaleString()}</p>
                </div>
              </div>
            ))}
        </Card>
      )}
    </div>
  );
}

function AdminRow({ b, onAct, onVisibility }: { b: BusinessCard; onAct: (b: BusinessCard, a: "verify" | "reject" | "suspend" | "restore" | "remove") => void; onVisibility: (b: BusinessCard, v: "everyone" | "businesses") => void }) {
  return (
    <Card className="p-4">
      <div className="flex gap-3">
        <Avatar name={b.name} src={b.logoUrl || undefined} size="lg" />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-bold text-mist-100">{b.name}</span>
            {b.verified && <BadgeCheck className="size-4 text-sky-400" />}
            <span className={cn("rounded-md px-2 py-0.5 text-[10px] font-bold uppercase", STATUS_PILL[b.status])}>{b.status}</span>
            {b.visibility === "businesses" && <span className="flex items-center gap-0.5 rounded-md bg-mist-500/15 px-1.5 py-0.5 text-[10px] font-semibold text-mist-300"><Lock className="size-2.5" /> Businesses only</span>}
          </div>
          <p className="mt-0.5 text-xs text-mist-500">{b.category} · by {b.ownerName}</p>
          {b.description && <p className="mt-1 line-clamp-2 text-xs text-mist-400">{b.description}</p>}
          <div className="mt-1.5 flex gap-4 text-[11px] text-mist-500">
            <span className="flex items-center gap-1"><Users className="size-3" /> {b.followers}</span>
            <span className="flex items-center gap-1"><Eye className="size-3" /> {b.views}</span>
            <Link href={`/business/${b.id}`} className="flex items-center gap-1 text-lotus-300 hover:underline"><ExternalLink className="size-3" /> View</Link>
          </div>
        </div>
      </div>

      {/* Admin-controlled visibility: everyone vs registered business users only */}
      <div className="mt-3 flex flex-wrap items-center gap-2 rounded-lg border border-line bg-ink-800/50 px-3 py-2">
        <span className="text-[11px] font-semibold text-mist-400">Visibility:</span>
        <div className="flex overflow-hidden rounded-lg border border-line">
          <button onClick={() => onVisibility(b, "everyone")} className={cn("px-2.5 py-1 text-[11px] font-semibold transition-colors", (b.visibility ?? "everyone") === "everyone" ? "bg-lotus-500/25 text-lotus-100" : "bg-ink-850 text-mist-400 hover:bg-ink-800")}>All users</button>
          <button onClick={() => onVisibility(b, "businesses")} className={cn("px-2.5 py-1 text-[11px] font-semibold transition-colors", b.visibility === "businesses" ? "bg-lotus-500/25 text-lotus-100" : "bg-ink-850 text-mist-400 hover:bg-ink-800")}>Business users only</button>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap gap-2 border-t border-line pt-3">
        <Link href={`/business/new?id=${b.id}`} className="inline-flex items-center gap-1 rounded-lg border border-line bg-ink-800 px-3 py-1.5 text-sm font-semibold text-mist-200 transition-colors hover:bg-ink-700"><Pencil className="size-4" /> Edit</Link>
        <Link href={`/business/${b.id}`} className="inline-flex items-center gap-1 rounded-lg border border-line bg-ink-800 px-3 py-1.5 text-sm font-semibold text-mist-200 transition-colors hover:bg-ink-700"><Settings2 className="size-4" /> Manage content</Link>
        {b.status === "pending" && <>
          <Button size="sm" onClick={() => onAct(b, "verify")}><Check className="size-4" /> Verify</Button>
          <Button size="sm" variant="secondary" onClick={() => onAct(b, "reject")}><X className="size-4" /> Reject</Button>
        </>}
        {b.status === "verified" && <Button size="sm" variant="secondary" onClick={() => onAct(b, "suspend")}><Ban className="size-4" /> Suspend</Button>}
        {(b.status === "suspended" || b.status === "rejected") && <Button size="sm" onClick={() => onAct(b, "restore")}><RotateCcw className="size-4" /> {b.status === "rejected" ? "Verify" : "Restore"}</Button>}
        <Button size="sm" variant="ghost" className="!text-rose-300 hover:!bg-rose-500/10" onClick={() => onAct(b, "remove")}><Trash2 className="size-4" /> Remove</Button>
      </div>
    </Card>
  );
}

function Stat({ icon: Icon, tone, label, value }: { icon: typeof Building2; tone: string; label: string; value: number }) {
  return (
    <Card className="p-4">
      <Icon className={cn("size-5", tone)} />
      <div className="mt-1.5 font-display text-2xl font-extrabold text-mist-100">{value.toLocaleString()}</div>
      <div className="text-xs text-mist-400">{label}</div>
    </Card>
  );
}

const inputCls = "h-9 w-full rounded-lg border border-line bg-ink-850 px-2.5 text-sm text-mist-100 outline-none focus:border-lotus-400";

/** Reusable admin builder for a list of custom form fields (add/edit/remove/reorder/
 *  required/shown). Used for BOTH the business form and the job-post form. */
function FieldBuilder({ title, hint, emptyHint, fields, onChange }: { title: string; hint: string; emptyHint: string; fields: BusinessFieldDef[]; onChange: (f: BusinessFieldDef[]) => void }) {
  const add = () => onChange([...fields, { key: `field_${fields.length + 1}`, label: "", type: "text", required: false, enabled: true }]);
  const update = (i: number, patch: Partial<BusinessFieldDef>) => onChange(fields.map((f, idx) => (idx === i ? { ...f, ...patch } : f)));
  const remove = (i: number) => onChange(fields.filter((_, idx) => idx !== i));
  const move = (i: number, dir: -1 | 1) => {
    const j = i + dir;
    if (j < 0 || j >= fields.length) return;
    const next = [...fields];
    [next[i], next[j]] = [next[j], next[i]];
    onChange(next);
  };
  return (
    <>
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="flex items-center gap-2 font-bold text-mist-100"><ListPlus className="size-4 text-lotus-300" /> {title}</h3>
          <p className="mt-0.5 text-[11px] text-mist-500">{hint}</p>
        </div>
        <Button size="sm" variant="secondary" onClick={add}><Plus className="size-4" /> Add field</Button>
      </div>
      {fields.length === 0 ? (
        <p className="mt-4 rounded-xl border border-dashed border-line bg-ink-800/60 px-4 py-6 text-center text-xs text-mist-500">{emptyHint}</p>
      ) : (
        <div className="mt-4 space-y-3">
          {fields.map((fld, i) => (
            <div key={i} className="rounded-xl border border-line bg-ink-800/70 p-3">
              <div className="grid gap-2 sm:grid-cols-[auto_1fr_auto_auto]">
                <div className="flex items-end gap-1">
                  <button onClick={() => move(i, -1)} disabled={i === 0} className="grid size-9 place-items-center rounded-lg border border-line bg-ink-850 text-mist-300 transition-colors hover:bg-ink-800 disabled:opacity-30" title="Move up"><ArrowUp className="size-4" /></button>
                  <button onClick={() => move(i, 1)} disabled={i === fields.length - 1} className="grid size-9 place-items-center rounded-lg border border-line bg-ink-850 text-mist-300 transition-colors hover:bg-ink-800 disabled:opacity-30" title="Move down"><ArrowDown className="size-4" /></button>
                </div>
                <div>
                  <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wide text-mist-500">Field label</label>
                  <input value={fld.label} onChange={(e) => update(i, { label: e.target.value })} placeholder="e.g. VAT / Tax Number" className={inputCls} />
                </div>
                <div>
                  <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wide text-mist-500">Type</label>
                  <select value={fld.type} onChange={(e) => update(i, { type: e.target.value as BusinessFieldDef["type"] })} className="h-9 rounded-lg border border-line bg-ink-850 px-2 text-sm text-mist-100 outline-none focus:border-lotus-400">
                    {FIELD_TYPE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                </div>
                <div className="flex items-end">
                  <button onClick={() => remove(i)} className="grid size-9 place-items-center rounded-lg border border-line bg-ink-850 text-rose-300 transition-colors hover:bg-rose-500/10" title="Remove field"><Trash2 className="size-4" /></button>
                </div>
              </div>
              {fld.type === "select" && (
                <div className="mt-2">
                  <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wide text-mist-500">Choices (comma-separated)</label>
                  <input value={(fld.options ?? []).join(", ")} onChange={(e) => update(i, { options: e.target.value.split(",").map((s) => s.trim()) })} placeholder="e.g. Small, Medium, Large" className={inputCls} />
                </div>
              )}
              <div className="mt-2 flex flex-wrap items-center gap-4">
                <div className="min-w-[160px] flex-1">
                  <input value={fld.placeholder ?? ""} onChange={(e) => update(i, { placeholder: e.target.value })} placeholder="Placeholder / hint (optional)" className="h-8 w-full rounded-lg border border-line bg-ink-850 px-2.5 text-xs text-mist-200 outline-none focus:border-lotus-400" />
                </div>
                <label className="flex items-center gap-1.5 text-xs text-mist-300"><input type="checkbox" checked={!!fld.required} onChange={(e) => update(i, { required: e.target.checked })} className="accent-lotus-500" /> Required</label>
                <label className="flex items-center gap-1.5 text-xs text-mist-300"><input type="checkbox" checked={fld.enabled !== false} onChange={(e) => update(i, { enabled: e.target.checked })} className="accent-lotus-500" /> Shown</label>
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  );
}

/** Admin builder for the business-profile tabs: rename, show/hide, reorder. */
function SectionBuilder({ sections, onChange }: { sections: BusinessSection[]; onChange: (s: BusinessSection[]) => void }) {
  const update = (i: number, patch: Partial<BusinessSection>) => onChange(sections.map((s, idx) => (idx === i ? { ...s, ...patch } : s)));
  const move = (i: number, dir: -1 | 1) => {
    const j = i + dir;
    if (j < 0 || j >= sections.length) return;
    const next = [...sections];
    [next[i], next[j]] = [next[j], next[i]];
    onChange(next);
  };
  return (
    <>
      <div>
        <h3 className="flex items-center gap-2 font-bold text-mist-100"><Layers className="size-4 text-lotus-300" /> Business profile sections</h3>
        <p className="mt-0.5 text-[11px] text-mist-500">Rename, show/hide and reorder the tabs shown on every business profile.</p>
      </div>
      <div className="mt-4 space-y-2">
        {sections.map((s, i) => (
          <div key={s.key} className="flex items-center gap-2 rounded-xl border border-line bg-ink-800/70 p-2.5">
            <div className="flex gap-1">
              <button onClick={() => move(i, -1)} disabled={i === 0} className="grid size-8 place-items-center rounded-lg border border-line bg-ink-850 text-mist-300 transition-colors hover:bg-ink-800 disabled:opacity-30" title="Move up"><ArrowUp className="size-3.5" /></button>
              <button onClick={() => move(i, 1)} disabled={i === sections.length - 1} className="grid size-8 place-items-center rounded-lg border border-line bg-ink-850 text-mist-300 transition-colors hover:bg-ink-800 disabled:opacity-30" title="Move down"><ArrowDown className="size-3.5" /></button>
            </div>
            <input value={s.label} onChange={(e) => update(i, { label: e.target.value })} className="h-9 flex-1 rounded-lg border border-line bg-ink-850 px-2.5 text-sm text-mist-100 outline-none focus:border-lotus-400" />
            <span className="hidden shrink-0 rounded bg-ink-850 px-1.5 py-0.5 text-[10px] text-mist-500 sm:inline">{s.key}</span>
            <label className="flex shrink-0 items-center gap-1.5 text-xs text-mist-300"><input type="checkbox" checked={s.enabled !== false} onChange={(e) => update(i, { enabled: e.target.checked })} className="accent-lotus-500" /> Shown</label>
          </div>
        ))}
      </div>
    </>
  );
}

/** Admin: create a verified business on behalf of any user. */
function CreateBusinessForm({ categories, onCreated }: { categories: string[]; onCreated: () => void }) {
  const { toast } = useToast();
  const [owner, setOwner] = useState("");
  const [f, setF] = useState<BizInput>({ name: "", category: categories[0] ?? "Other", description: "", visibility: "everyone" });
  const [saving, setSaving] = useState(false);
  const set = (k: keyof BizInput, v: string) => setF((s) => ({ ...s, [k]: v }));

  const submit = async () => {
    if (!owner.trim()) { toast("Enter the owner's username or email.", "error"); return; }
    if (!f.name.trim()) { toast("Enter a business name.", "error"); return; }
    setSaving(true);
    const res = await adminCreateBusiness(owner.trim(), f);
    setSaving(false);
    if (!res.ok) { toast(res.error ?? "Could not create business", "error"); return; }
    toast("Business created & verified.", "success");
    onCreated();
  };

  return (
    <Card className="space-y-3 p-5">
      <div>
        <h3 className="flex items-center gap-2 font-bold text-mist-100"><Plus className="size-4 text-lotus-300" /> Create a business (as admin)</h3>
        <p className="mt-0.5 text-[11px] text-mist-500">Creates a VERIFIED business for the chosen user (no coins charged). You & the owner can then add products, reels, videos, jobs and offers from its profile.</p>
      </div>
      <div>
        <label className="mb-1 block text-xs font-semibold text-mist-300">Owner — username or email *</label>
        <input value={owner} onChange={(e) => setOwner(e.target.value)} placeholder="@username or user@email.com" className={inputCls} />
      </div>
      <div>
        <label className="mb-1 block text-xs font-semibold text-mist-300">Business name *</label>
        <input value={f.name} onChange={(e) => set("name", e.target.value)} placeholder="e.g. Lotus Cafe" maxLength={60} className={inputCls} />
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="mb-1 block text-xs font-semibold text-mist-300">Category</label>
          <select value={f.category} onChange={(e) => set("category", e.target.value)} className={inputCls}>
            {categories.length === 0 && <option value="Other">Other</option>}
            {categories.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs font-semibold text-mist-300">Location</label>
          <input value={f.location ?? ""} onChange={(e) => set("location", e.target.value)} placeholder="City / area" maxLength={160} className={inputCls} />
        </div>
      </div>
      <div>
        <label className="mb-1 block text-xs font-semibold text-mist-300">Description</label>
        <textarea value={f.description} onChange={(e) => set("description", e.target.value)} rows={3} placeholder="What the business does…" maxLength={1500} className="w-full rounded-lg border border-line bg-ink-850 p-2.5 text-sm text-mist-100 outline-none focus:border-lotus-400" />
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div><label className="mb-1 block text-xs font-semibold text-mist-300">Phone</label><input value={f.phone ?? ""} onChange={(e) => set("phone", e.target.value)} placeholder="+966 …" maxLength={40} className={inputCls} /></div>
        <div><label className="mb-1 block text-xs font-semibold text-mist-300">WhatsApp</label><input value={f.whatsapp ?? ""} onChange={(e) => set("whatsapp", e.target.value)} placeholder="+966 …" maxLength={20} className={inputCls} /></div>
        <div><label className="mb-1 block text-xs font-semibold text-mist-300">Email</label><input value={f.email ?? ""} onChange={(e) => set("email", e.target.value)} placeholder="hello@business.com" maxLength={120} className={inputCls} /></div>
        <div><label className="mb-1 block text-xs font-semibold text-mist-300">Website</label><input value={f.website ?? ""} onChange={(e) => set("website", e.target.value)} placeholder="https://…" maxLength={200} className={inputCls} /></div>
      </div>
      <Button onClick={submit} disabled={saving}><Plus className="size-4" /> Create business</Button>
    </Card>
  );
}
