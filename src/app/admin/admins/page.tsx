"use client";

import { useEffect, useState } from "react";
import { Card } from "@/components/ui/Card";
import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { useToast } from "@/components/ui/Toast";
import { useAuth } from "@/lib/auth";
import { useConfig, saveConfig } from "@/lib/config";
import { fetchAdmins, createAdmin, updateAdmin, deleteAdmin, type AdminAccount } from "@/lib/admin";
import { ADMIN_ROLES, ADMIN_PERMISSIONS, ROLE_DEFAULT_PERMS, type AdminRole } from "@/lib/admin-perms";
import { ADMIN_NAV } from "@/components/admin/AdminShell";
import { cn } from "@/lib/cn";
import { ShieldCheck, Plus, X, Check, Trash2, Settings, Crown, Users, Clock } from "lucide-react";

const ROLE_STYLE: Record<string, string> = {
  super_admin: "bg-gold-400/15 text-gold-300",
  admin: "bg-lotus-500/15 text-lotus-300",
  moderator: "bg-sky-500/15 text-sky-300",
  support: "bg-emerald-500/15 text-emerald-300",
};
const STATUS_STYLE: Record<string, string> = {
  active: "bg-emerald-500/15 text-emerald-300",
  inactive: "bg-mist-500/15 text-mist-400",
  suspended: "bg-amber-500/15 text-amber-300",
};

export default function AdminAdminsPage() {
  const { user } = useAuth();
  const { config, reload: reloadConfig } = useConfig();
  const { toast } = useToast();
  const isSuper = !user?.adminRole || user?.adminRole === "super_admin";

  const [admins, setAdmins] = useState<AdminAccount[]>([]);
  const [count, setCount] = useState(0);
  const [activeAdmins, setActive] = useState(0);
  const [limit, setLimit] = useState(0);
  const [limitInput, setLimitInput] = useState(0);
  const [loading, setLoading] = useState(true);
  const [addOpen, setAddOpen] = useState(false);
  const [manage, setManage] = useState<AdminAccount | null>(null);
  const [confirmDel, setConfirmDel] = useState<AdminAccount | null>(null);

  const load = () => fetchAdmins().then((d) => {
    setAdmins(d.admins); setCount(d.count); setActive(d.activeAdmins); setLimit(d.limit); setLimitInput(d.limit); setLoading(false);
  });
  useEffect(() => { load(); }, []);

  const saveLimit = async () => {
    const res = await saveConfig({ adminLimit: limitInput });
    if (res.ok) { await reloadConfig(); load(); toast("Admin limit updated", "success"); }
    else toast(res.error ?? "Could not save", "error");
  };

  // Only "reached" when we actually know a positive limit and have hit it.
  // (A still-loading or zero limit must never block creation.)
  const limitReached = limit > 0 && count >= limit;

  const del = async (a: AdminAccount) => {
    setConfirmDel(null);
    const ok = await deleteAdmin(a.id);
    if (ok) { toast(`${a.fullName} deleted`, "success"); load(); }
    else toast("Could not delete this admin", "error");
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-extrabold text-mist-100">Admin user management</h1>
          <p className="text-sm text-mist-400">Manage administrator accounts, roles &amp; permissions.</p>
        </div>
        {isSuper && <Button onClick={() => setAddOpen(true)}><Plus className="size-4" /> Add admin</Button>}
      </div>

      {/* Counts + limit */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Card className="p-5">
          <ShieldCheck className="size-6 text-lotus-300" />
          <div className="mt-3 font-display text-2xl font-extrabold text-mist-100">{loading ? "—" : count}</div>
          <div className="text-sm text-mist-400">Current admin users</div>
        </Card>
        <Card className="p-5">
          <Users className="size-6 text-emerald-300" />
          <div className="mt-3 font-display text-2xl font-extrabold text-mist-100">{loading ? "—" : activeAdmins}</div>
          <div className="text-sm text-mist-400">Active admins</div>
        </Card>
        <Card className="p-5">
          <Crown className="size-6 text-gold-300" />
          <div className="mt-1 text-sm text-mist-400">Maximum allowed</div>
          <div className="mt-1 flex items-center gap-2">
            <input
              type="number" min={1} max={100} value={limitInput} disabled={!isSuper}
              onChange={(e) => setLimitInput(Math.max(1, Math.min(100, Number(e.target.value) || 1)))}
              className="h-9 w-20 rounded-lg border border-line bg-ink-900 px-2 text-center text-sm text-mist-100 outline-none focus:border-lotus-400 disabled:opacity-50"
            />
            {isSuper && limitInput !== limit && <Button size="sm" onClick={saveLimit}><Check className="size-3.5" /> Save</Button>}
          </div>
          <div className="mt-1 text-[11px] text-mist-500">{count} of {limit} used</div>
        </Card>
      </div>

      {/* Admin list */}
      <Card className="overflow-visible p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/5 text-left text-xs uppercase tracking-wide text-mist-500">
                <th className="px-5 py-3 font-semibold">Admin</th>
                <th className="px-5 py-3 font-semibold">Role</th>
                <th className="px-5 py-3 font-semibold">Status</th>
                <th className="px-5 py-3 font-semibold">Last login</th>
                <th className="px-5 py-3 font-semibold">Created</th>
                <th className="px-5 py-3 text-right font-semibold">Manage</th>
              </tr>
            </thead>
            <tbody>
              {admins.map((a) => (
                <tr key={a.id} className="border-b border-white/5 last:border-0 hover:bg-white/[0.03]">
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-3">
                      <Avatar name={a.fullName} size="sm" />
                      <div>
                        <div className="font-semibold text-mist-100">{a.fullName}{a.isSelf && <span className="ml-1 text-[10px] text-mist-500">(you)</span>}</div>
                        <div className="text-xs text-mist-500">{a.email || "—"}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-5 py-3"><span className={cn("rounded-full px-2 py-0.5 text-xs font-semibold capitalize", ROLE_STYLE[a.role])}>{a.role.replace("_", " ")}</span></td>
                  <td className="px-5 py-3"><span className={cn("rounded-full px-2 py-0.5 text-xs font-semibold capitalize", STATUS_STYLE[a.accountStatus] ?? "bg-rose-500/15 text-rose-300")}>{a.accountStatus}</span></td>
                  <td className="px-5 py-3 text-xs text-mist-400">
                    {a.lastSeen ? <><div>{new Date(a.lastSeen).toLocaleString("en-SA", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</div><div className="text-mist-600">{a.lastIp || ""}</div></> : "—"}
                  </td>
                  <td className="px-5 py-3 text-xs text-mist-400">{a.createdAt ? new Date(a.createdAt).toLocaleDateString("en-SA", { day: "numeric", month: "short", year: "numeric" }) : "—"}</td>
                  <td className="px-5 py-3 text-right">
                    {isSuper ? (
                      <Button size="sm" variant="secondary" onClick={() => setManage(a)}><Settings className="size-3.5" /> Manage</Button>
                    ) : <span className="text-xs text-mist-600">—</span>}
                  </td>
                </tr>
              ))}
              {!loading && admins.length === 0 && <tr><td colSpan={6} className="px-5 py-8 text-center text-sm text-mist-500">No admins yet.</td></tr>}
            </tbody>
          </table>
        </div>
      </Card>

      {!isSuper && (
        <p className="text-xs text-mist-500">Only a <span className="font-semibold text-gold-300">Super Admin</span> can add or manage admin accounts.</p>
      )}

      {addOpen && <AddAdminModal limitReached={limitReached} onClose={() => setAddOpen(false)} onCreated={() => { setAddOpen(false); load(); toast("Admin created", "success"); }} />}
      {manage && <ManageAdminModal admin={manage} onClose={() => setManage(null)} onSaved={() => { setManage(null); load(); toast("Admin updated", "success"); }} onDelete={() => { const a = manage; setManage(null); setConfirmDel(a); }} />}
      {confirmDel && (
        <ConfirmDialog danger title={`Delete admin "${confirmDel.fullName}"?`} message="This permanently removes their admin account. Consider deactivating instead." confirmLabel="Delete" cancelLabel="Cancel" onConfirm={() => del(confirmDel)} onCancel={() => setConfirmDel(null)} />
      )}
    </div>
  );
}

function PermGrid({ selected, onToggle }: { selected: string[]; onToggle: (k: string) => void }) {
  return (
    <div className="mt-1.5 grid grid-cols-2 gap-1.5">
      {ADMIN_PERMISSIONS.map((p) => {
        const on = selected.includes(p.key);
        return (
          <button key={p.key} onClick={() => onToggle(p.key)} className={cn("flex items-center gap-2 rounded-lg border px-2.5 py-1.5 text-left text-xs transition", on ? "border-lotus-400 bg-lotus-500/15 text-lotus-200" : "border-line bg-ink-900 text-mist-400 hover:text-mist-100")}>
            <span className={cn("grid size-4 shrink-0 place-items-center rounded border", on ? "border-lotus-400 bg-lotus-500" : "border-mist-500")}>{on && <Check className="size-3 text-white" />}</span>
            {p.label}
          </button>
        );
      })}
    </div>
  );
}

function FeaturePermGrid({ selected, onToggle }: { selected: string[]; onToggle: (k: string) => void }) {
  return (
    <div className="mt-2 max-h-72 overflow-y-auto rounded-xl border border-line bg-ink-900/40 p-2">
      <div className="mb-2 text-[11px] text-mist-500">
        Full admin sidebar feature list. Some entries share the same permission group.
      </div>
      <div className="grid grid-cols-1 gap-1 sm:grid-cols-2">
        {ADMIN_NAV.map((item) => {
          const alwaysOn = !item.perm;
          const on = alwaysOn || selected.includes(item.perm);
          return (
            <button
              key={item.href}
              onClick={() => !alwaysOn && onToggle(item.perm)}
              disabled={alwaysOn}
              className={cn(
                "flex items-center gap-2 rounded-lg border px-2.5 py-1.5 text-left text-xs transition",
                on ? "border-lotus-400/50 bg-lotus-500/12 text-lotus-200" : "border-line bg-ink-900 text-mist-400 hover:text-mist-100",
                alwaysOn && "cursor-not-allowed opacity-70",
              )}
            >
              <span className={cn("grid size-4 shrink-0 place-items-center rounded border", on ? "border-lotus-400 bg-lotus-500" : "border-mist-500")}>
                {on && <Check className="size-3 text-white" />}
              </span>
              <span className="min-w-0 flex-1 truncate">{item.label}</span>
              <span className="shrink-0 rounded-full bg-white/10 px-1.5 py-0.5 text-[10px] text-mist-500">
                {alwaysOn ? "always" : item.perm}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function AddAdminModal({ limitReached, onClose, onCreated }: { limitReached: boolean; onClose: () => void; onCreated: () => void }) {
  const { toast } = useToast();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<AdminRole>("admin");
  const [perms, setPerms] = useState<string[]>(ROLE_DEFAULT_PERMS.admin);
  const [busy, setBusy] = useState(false);
  const field = "mt-1 h-11 w-full rounded-xl border border-line bg-ink-900 px-3.5 text-sm text-mist-100 outline-none focus:border-lotus-400";

  const pickRole = (r: AdminRole) => { setRole(r); setPerms(ROLE_DEFAULT_PERMS[r]); };
  const toggle = (k: string) => setPerms((p) => (p.includes(k) ? p.filter((x) => x !== k) : [...p, k]));

  const submit = async () => {
    if (limitReached) { toast("Admin limit reached — raise the limit first", "error"); return; }
    setBusy(true);
    const res = await createAdmin({ fullName, email, password, adminRole: role, permissions: perms });
    setBusy(false);
    if (res.ok) onCreated();
    else toast(res.error ?? "Could not create admin", "error");
  };

  return (
    <Modal title="Add a new admin" onClose={onClose}>
      <label className="block text-xs font-semibold text-mist-300">Full name</label>
      <input value={fullName} onChange={(e) => setFullName(e.target.value)} className={field} autoFocus />
      <label className="mt-3 block text-xs font-semibold text-mist-300">Email</label>
      <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="admin@example.com" className={field} />
      <label className="mt-3 block text-xs font-semibold text-mist-300">Temporary password</label>
      <input type="text" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="At least 6 characters" className={field} />

      <label className="mt-4 block text-xs font-semibold text-mist-300">Role</label>
      <div className="mt-1.5 grid grid-cols-2 gap-1.5">
        {ADMIN_ROLES.map((r) => (
          <button key={r.key} onClick={() => pickRole(r.key)} title={r.desc} className={cn("rounded-lg border px-3 py-2 text-left text-xs font-semibold transition", role === r.key ? "border-lotus-400 bg-lotus-500/15 text-lotus-200" : "border-line bg-ink-900 text-mist-300 hover:text-mist-100")}>{r.label}</button>
        ))}
      </div>

      <label className="mt-4 block text-xs font-semibold text-mist-300">Permissions</label>
      <PermGrid selected={perms} onToggle={toggle} />
      <FeaturePermGrid selected={perms} onToggle={toggle} />

      {limitReached && <p className="mt-3 text-xs text-rose-300">Admin limit reached. Raise the maximum first.</p>}
      <Button block className="mt-5" onClick={submit} disabled={busy || limitReached}><ShieldCheck className="size-4" /> {busy ? "Creating…" : "Create admin"}</Button>
    </Modal>
  );
}

function ManageAdminModal({ admin, onClose, onSaved, onDelete }: { admin: AdminAccount; onClose: () => void; onSaved: () => void; onDelete: () => void }) {
  const [role, setRole] = useState<AdminRole>(admin.role);
  const [perms, setPerms] = useState<string[]>(admin.permissions);
  const [status, setStatus] = useState(admin.accountStatus);
  const [busy, setBusy] = useState(false);
  const toggle = (k: string) => setPerms((p) => (p.includes(k) ? p.filter((x) => x !== k) : [...p, k]));

  const save = async () => {
    setBusy(true);
    const ok = await updateAdmin(admin.id, { adminRole: role, permissions: perms, accountStatus: status });
    setBusy(false);
    if (ok) onSaved();
  };

  return (
    <Modal title={`Manage ${admin.fullName}`} onClose={onClose}>
      <p className="text-xs text-mist-400">{admin.email}</p>

      <label className="mt-4 block text-xs font-semibold text-mist-300">Role</label>
      <div className="mt-1.5 grid grid-cols-2 gap-1.5">
        {ADMIN_ROLES.map((r) => (
          <button key={r.key} onClick={() => { setRole(r.key); setPerms(ROLE_DEFAULT_PERMS[r.key]); }} className={cn("rounded-lg border px-3 py-2 text-left text-xs font-semibold transition", role === r.key ? "border-lotus-400 bg-lotus-500/15 text-lotus-200" : "border-line bg-ink-900 text-mist-300 hover:text-mist-100")}>{r.label}</button>
        ))}
      </div>

      <label className="mt-4 block text-xs font-semibold text-mist-300">Status</label>
      <div className="mt-1.5 flex gap-1.5">
        {(["active", "inactive", "suspended"] as const).map((s) => (
          <button key={s} onClick={() => setStatus(s)} disabled={admin.isSelf && s !== "active"} className={cn("flex-1 rounded-lg border px-3 py-2 text-xs font-semibold capitalize transition disabled:opacity-40", status === s ? "border-lotus-400 bg-lotus-500/15 text-lotus-200" : "border-line bg-ink-900 text-mist-300 hover:text-mist-100")}>{s}</button>
        ))}
      </div>

      <label className="mt-4 block text-xs font-semibold text-mist-300">Permissions</label>
      <PermGrid selected={role === "super_admin" ? ADMIN_PERMISSIONS.map((p) => p.key) : perms} onToggle={role === "super_admin" ? () => {} : toggle} />
      <FeaturePermGrid selected={role === "super_admin" ? ADMIN_PERMISSIONS.map((p) => p.key) : perms} onToggle={role === "super_admin" ? () => {} : toggle} />
      {role === "super_admin" && <p className="mt-1 text-[11px] text-gold-300/80">Super Admins have full access to everything.</p>}

      <div className="mt-5 flex gap-2">
        <Button block onClick={save} disabled={busy}><Check className="size-4" /> {busy ? "Saving…" : "Save"}</Button>
        {!admin.isSelf && <Button variant="danger" onClick={onDelete}><Trash2 className="size-4" /></Button>}
      </div>
    </Modal>
  );
}

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-[70] grid place-items-center overflow-y-auto bg-black/60 p-4" onClick={onClose}>
      <div className="my-8 w-full max-w-md rounded-2xl border border-white/10 bg-ink-850 p-5" onClick={(e) => e.stopPropagation()}>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="flex items-center gap-2 font-display text-lg font-bold text-mist-100"><ShieldCheck className="size-5 text-lotus-300" /> {title}</h2>
          <button onClick={onClose} className="text-mist-400 hover:text-mist-100"><X className="size-5" /></button>
        </div>
        {children}
      </div>
    </div>
  );
}
