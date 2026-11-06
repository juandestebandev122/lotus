"use client";

import { useEffect, useMemo, useState } from "react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import { useConfig, saveConfig } from "@/lib/config";
import { fetchAdminUsers, type AdminUser } from "@/lib/admin";
import {
  fetchAllDocRequests, createDocRequest, reviewDocRequest, deleteDocRequest,
  DOC_REQUEST_TYPES, DOC_STATUS_META, type DocRequest, type DocReqStatus,
} from "@/lib/documents";
import { cn } from "@/lib/cn";
import { FileText, Plus, Search, Download, FileSpreadsheet, X, Check, RefreshCw, Eye, Trash2, History, Paperclip, Settings, Clock } from "lucide-react";
import { UserLink, SortTh, applyFilterSort, type SortDir } from "@/components/admin/TableControls";

function fmt(s?: string) { return s ? new Date(s).toLocaleString("en-SA", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) : "—"; }
function esc(s: string) { return s.replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c] || c)); }

export default function AdminDocumentsPage() {
  const { toast } = useToast();
  const [requests, setRequests] = useState<DocRequest[]>([]);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [viewing, setViewing] = useState<DocRequest | null>(null);
  const [q, setQ] = useState("");
  const [sort, setSort] = useState("created");
  const [dir, setDir] = useState<SortDir>("desc");
  const sortRows = (col: string) => { if (col === sort) setDir((d) => (d === "asc" ? "desc" : "asc")); else { setSort(col); setDir("desc"); } };
  const [status, setStatus] = useState<"all" | DocReqStatus>("all");

  const load = () => { fetchAllDocRequests().then((r) => { setRequests(r); setLoading(false); }); };
  useEffect(() => { load(); fetchAdminUsers().then(setUsers); }, []);

  const counts = useMemo(() => ({
    total: requests.length,
    awaiting: requests.filter((r) => r.status === "submitted" || r.status === "under_review").length,
    approved: requests.filter((r) => r.status === "approved").length,
    pending: requests.filter((r) => r.status === "pending" || r.status === "resubmit").length,
  }), [requests]);

  const needle = q.trim().toLowerCase();
  const shown = applyFilterSort(
    requests.filter((r) => status === "all" || r.status === status),
    {
      q, sort, dir,
      searchText: (r) => `${r.userName} ${r.userId} ${r.title} ${r.type} ${r.status} ${r.remarks ?? ""} ${r.reviewedBy ?? ""}`,
      sortKeys: {
        created: (r) => new Date(r.createdAt ?? 0).getTime() || 0,
        user: (r) => r.userName ?? "",
        title: (r) => r.title ?? "",
        type: (r) => r.type ?? "",
        files: (r) => r.submissions.length,
        status: (r) => r.status ?? "",
      },
    },
  );

  const act = async (id: string, s: DocReqStatus, remarks?: string) => {
    const ok = await reviewDocRequest(id, s, remarks);
    toast(ok ? "Updated" : "Could not update", ok ? "success" : "error");
    load();
    setViewing(null);
  };

  const remove = async (id: string) => {
    const ok = await deleteDocRequest(id);
    toast(ok ? "Request deleted" : "Could not delete", ok ? "success" : "error");
    load();
    setViewing(null);
  };

  const exportCsv = () => {
    const rows = [
      ["Created", "User", "User ID", "Title", "Type", "Mandatory", "Due", "Status", "Submissions", "Remarks", "Reviewed by"],
      ...shown.map((r) => [fmt(r.createdAt), r.userName, r.userId, r.title, r.type, r.mandatory ? "Yes" : "No", r.dueDate ?? "", DOC_STATUS_META[r.status].label, String(r.submissions.length), r.remarks ?? "", r.reviewedBy ?? ""]),
    ];
    const blob = new Blob(["﻿" + rows.map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(",")).join("\r\n")], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = "document-requests.csv"; a.click();
  };

  const exportPdf = () => {
    const rowsHtml = shown.map((r) => `<tr><td>${fmt(r.createdAt)}</td><td>${esc(r.userName)}</td><td>${esc(r.title)}</td><td>${esc(r.type)}</td><td>${DOC_STATUS_META[r.status].label}</td><td>${r.submissions.length}</td></tr>`).join("");
    const w = window.open("", "_blank"); if (!w) return;
    w.document.write(`<!doctype html><html><head><title>Document Requests</title><style>body{font-family:Arial;padding:24px}table{width:100%;border-collapse:collapse;font-size:12px}th,td{border:1px solid #ccc;padding:6px;text-align:left}th{background:#f3f3f3}</style></head><body><h1>LotusPlay Connect — Document Requests</h1><p>${shown.length} records · ${new Date().toLocaleString("en-SA")}</p><table><thead><tr><th>Created</th><th>User</th><th>Title</th><th>Type</th><th>Status</th><th>Files</th></tr></thead><tbody>${rowsHtml}</tbody></table><script>window.onload=function(){window.print()}<\/script></body></html>`);
    w.document.close();
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 font-display text-2xl font-extrabold text-mist-100"><FileText className="size-6 text-lotus-300" /> Document Requests</h1>
          <p className="text-sm text-mist-400">Request documents from users, review submissions, approve or ask for re-submission.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={exportCsv}><FileSpreadsheet className="size-4" /> Excel</Button>
          <Button variant="secondary" onClick={exportPdf}><Download className="size-4" /> PDF</Button>
          <Button onClick={() => setCreating(true)}><Plus className="size-4" /> New request</Button>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { label: "Total requests", value: counts.total, tone: "bg-lotus-500/15 text-lotus-300" },
          { label: "Awaiting review", value: counts.awaiting, tone: "bg-amber-500/15 text-amber-300" },
          { label: "Approved", value: counts.approved, tone: "bg-emerald-500/15 text-emerald-300" },
          { label: "Not submitted", value: counts.pending, tone: "bg-white/[0.06] text-mist-300" },
        ].map((c) => (
          <Card key={c.label} className="flex items-center gap-3 p-4">
            <span className={cn("grid size-10 place-items-center rounded-full", c.tone)}><FileText className="size-5" /></span>
            <div><div className="font-display text-xl font-bold text-mist-100">{c.value}</div><div className="text-xs text-mist-400">{c.label}</div></div>
          </Card>
        ))}
      </div>

      <UploadLimitCard />

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative max-w-xs flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-mist-500" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search user, title or type…" className="h-10 w-full rounded-xl border border-line bg-ink-900 pl-9 pr-3 text-sm text-mist-100 outline-none focus:border-lotus-400" />
        </div>
        <select value={status} onChange={(e) => setStatus(e.target.value as typeof status)} className="h-10 rounded-xl border border-line bg-ink-900 px-3 text-sm text-mist-100 outline-none focus:border-lotus-400">
          <option value="all">All statuses</option>
          {(Object.keys(DOC_STATUS_META) as DocReqStatus[]).map((s) => <option key={s} value={s}>{DOC_STATUS_META[s].label}</option>)}
        </select>
      </div>

      <Card className="overflow-hidden p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="border-b border-white/5 text-left text-xs uppercase tracking-wide text-mist-500">
              <SortTh col="created" sort={sort} dir={dir} onSort={sortRows} className="px-4 py-3">Created</SortTh><SortTh col="user" sort={sort} dir={dir} onSort={sortRows} className="px-4 py-3">User</SortTh><SortTh col="title" sort={sort} dir={dir} onSort={sortRows} className="px-4 py-3">Title</SortTh><SortTh col="type" sort={sort} dir={dir} onSort={sortRows} className="px-4 py-3">Type</SortTh><SortTh col="files" sort={sort} dir={dir} onSort={sortRows} className="px-4 py-3">Files</SortTh><SortTh col="status" sort={sort} dir={dir} onSort={sortRows} className="px-4 py-3">Status</SortTh><th className="px-4 py-3 text-right font-semibold">Review</th>
            </tr></thead>
            <tbody>
              {shown.map((r) => (
                <tr key={r.id} className="border-b border-white/5 last:border-0 hover:bg-white/[0.02]">
                  <td className="px-4 py-3 text-xs text-mist-400">{fmt(r.createdAt)}</td>
                  <td className="px-4 py-3 font-medium text-mist-100"><UserLink name={r.userName} userId={r.userId} showId={false} /></td>
                  <td className="px-4 py-3 text-mist-200">{r.title}{r.mandatory && <span className="ml-1.5 rounded-full bg-rose-500/15 px-1.5 py-0.5 text-[10px] font-semibold text-rose-300">Req</span>}</td>
                  <td className="px-4 py-3 text-mist-400">{r.type}</td>
                  <td className="px-4 py-3 text-mist-300">{r.submissions.length || "—"}</td>
                  <td className="px-4 py-3"><span className={cn("rounded-full px-2 py-0.5 text-[11px] font-semibold", DOC_STATUS_META[r.status].tone)}>{DOC_STATUS_META[r.status].label}</span></td>
                  <td className="px-4 py-3 text-right"><Button size="sm" variant="secondary" onClick={() => setViewing(r)}><Eye className="size-3.5" /> Review</Button></td>
                </tr>
              ))}
              {!loading && shown.length === 0 && <tr><td colSpan={7} className="px-4 py-10 text-center text-sm text-mist-500">No document requests match.</td></tr>}
            </tbody>
          </table>
        </div>
      </Card>

      {creating && <CreateModal users={users} onClose={() => setCreating(false)} onCreated={() => { setCreating(false); load(); toast("Document request sent", "success"); }} />}
      {viewing && <ReviewModal req={viewing} onClose={() => setViewing(null)} onAct={act} onDelete={remove} />}
    </div>
  );
}

function UploadLimitCard() {
  const { config, reload } = useConfig();
  const { toast } = useToast();
  const [mb, setMb] = useState(config.uploadMaxMB ?? 10);
  const [busy, setBusy] = useState(false);
  useEffect(() => { setMb(config.uploadMaxMB ?? 10); }, [config.uploadMaxMB]);
  const save = async () => {
    setBusy(true);
    const res = await saveConfig({ uploadMaxMB: mb });
    setBusy(false);
    if (res.ok) { await reload(); toast("Upload limit saved", "success"); } else toast(res.error ?? "Could not save", "error");
  };
  return (
    <Card className="flex flex-wrap items-center justify-between gap-3 p-4">
      <div className="flex items-center gap-2">
        <Settings className="size-4 text-mist-400" />
        <span className="text-sm text-mist-300">Max upload size for KYC &amp; document submissions</span>
      </div>
      <div className="flex items-center gap-2">
        <input type="number" min={1} max={100} value={mb} onChange={(e) => setMb(Math.max(1, Math.min(100, Number(e.target.value) || 1)))} className="h-9 w-20 rounded-lg border border-line bg-ink-900 px-2 text-sm text-mist-100 outline-none focus:border-lotus-400" />
        <span className="text-sm text-mist-400">MB</span>
        <Button size="sm" onClick={save} disabled={busy}><Check className="size-3.5" /> {busy ? "Saving…" : "Save"}</Button>
      </div>
    </Card>
  );
}

function CreateModal({ users, onClose, onCreated }: { users: AdminUser[]; onClose: () => void; onCreated: () => void }) {
  const { toast } = useToast();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [type, setType] = useState(DOC_REQUEST_TYPES[0]);
  const [dueDate, setDueDate] = useState("");
  const [mandatory, setMandatory] = useState(true);
  const [picked, setPicked] = useState<string[]>([]);
  const [search, setSearch] = useState("");
  const [busy, setBusy] = useState(false);

  const field = "h-11 w-full rounded-xl border border-line bg-ink-900 px-3.5 text-sm text-mist-100 outline-none focus:border-lotus-400";
  const normalUsers = users.filter((u) => u.role !== "admin");
  const filtered = normalUsers.filter((u) => !search || u.fullName.toLowerCase().includes(search.toLowerCase()) || u.username.toLowerCase().includes(search.toLowerCase()));
  const toggle = (id: string) => setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));

  const submit = async () => {
    if (!title.trim()) { toast("Enter a request title", "error"); return; }
    if (picked.length === 0) { toast("Select at least one user", "error"); return; }
    setBusy(true);
    const res = await createDocRequest({ userIds: picked, title: title.trim(), description, type, dueDate: dueDate || undefined, mandatory });
    setBusy(false);
    if (!res.ok) { toast(res.error ?? "Could not create", "error"); return; }
    onCreated();
  };

  return (
    <div className="fixed inset-0 z-[70] grid place-items-center overflow-y-auto bg-black/60 p-4" onClick={onClose}>
      <div className="my-8 w-full max-w-lg rounded-2xl border border-white/10 bg-ink-850 p-5" onClick={(e) => e.stopPropagation()}>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-display text-lg font-bold text-mist-100">New document request</h2>
          <button onClick={onClose} className="text-mist-400 hover:text-mist-100"><X className="size-5" /></button>
        </div>

        <div className="space-y-3">
          <div>
            <label className="block text-xs font-semibold text-mist-300">Request title</label>
            <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Upload your latest bank statement" className={`${field} mt-1`} />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="block text-xs font-semibold text-mist-300">Document type</label>
              <select value={type} onChange={(e) => setType(e.target.value)} className={`${field} mt-1 appearance-none`}>{DOC_REQUEST_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}</select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-mist-300">Due date (optional)</label>
              <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} className={`${field} mt-1`} />
            </div>
          </div>
          <div>
            <label className="block text-xs font-semibold text-mist-300">Description / instructions</label>
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} placeholder="What exactly should the user upload?" className={`${field} mt-1 h-auto py-2`} />
          </div>
          <label className="flex items-center gap-2 text-sm text-mist-300">
            <input type="checkbox" checked={mandatory} onChange={(e) => setMandatory(e.target.checked)} className="size-4 accent-lotus-500" /> Mark as mandatory
          </label>

          {/* Recipients */}
          <div>
            <div className="flex items-center justify-between">
              <label className="block text-xs font-semibold text-mist-300">Send to ({picked.length} selected)</label>
              <button onClick={() => setPicked(picked.length === filtered.length ? [] : filtered.map((u) => u.id))} className="text-[11px] text-lotus-300 hover:text-lotus-200">{picked.length === filtered.length && filtered.length > 0 ? "Clear" : "Select all shown"}</button>
            </div>
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search users…" className={`${field} mt-1`} />
            <div className="mt-2 max-h-44 space-y-1 overflow-y-auto rounded-xl border border-white/8 bg-ink-900 p-1.5">
              {filtered.map((u) => (
                <label key={u.id} className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-white/[0.04]">
                  <input type="checkbox" checked={picked.includes(u.id)} onChange={() => toggle(u.id)} className="size-4 accent-lotus-500" />
                  <span className="min-w-0 flex-1 truncate text-sm text-mist-100">{u.fullName} <span className="text-xs text-mist-500">@{u.username}</span></span>
                </label>
              ))}
              {filtered.length === 0 && <p className="px-2 py-3 text-center text-xs text-mist-500">No users found.</p>}
            </div>
          </div>
        </div>

        <div className="mt-5 flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button onClick={submit} disabled={busy}><Plus className="size-4" /> {busy ? "Sending…" : "Send request"}</Button>
        </div>
      </div>
    </div>
  );
}

function ReviewModal({ req, onClose, onAct, onDelete }: { req: DocRequest; onClose: () => void; onAct: (id: string, s: DocReqStatus, remarks?: string) => void; onDelete: (id: string) => void }) {
  const [remarks, setRemarks] = useState(req.remarks ?? "");
  const field = "h-11 w-full rounded-xl border border-line bg-ink-900 px-3.5 text-sm text-mist-100 outline-none focus:border-lotus-400";

  return (
    <div className="fixed inset-0 z-[70] grid place-items-center overflow-y-auto bg-black/60 p-4" onClick={onClose}>
      <div className="my-8 w-full max-w-lg rounded-2xl border border-white/10 bg-ink-850 p-5" onClick={(e) => e.stopPropagation()}>
        <div className="mb-3 flex items-start justify-between gap-3">
          <div>
            <h2 className="font-display text-lg font-bold text-mist-100">{req.title}</h2>
            <p className="text-xs text-mist-400">{req.userName} · {req.type} · <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-semibold", DOC_STATUS_META[req.status].tone)}>{DOC_STATUS_META[req.status].label}</span></p>
          </div>
          <button onClick={onClose} className="text-mist-400 hover:text-mist-100"><X className="size-5" /></button>
        </div>

        {req.description && <p className="mb-3 rounded-lg bg-white/[0.04] px-3 py-2 text-sm text-mist-300">{req.description}</p>}

        {/* Submitted files */}
        <h3 className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-mist-500"><Paperclip className="size-3.5" /> Submitted files</h3>
        {req.submissions.length === 0 ? (
          <p className="rounded-lg bg-white/[0.03] px-3 py-2 text-xs text-mist-500">No files submitted yet.</p>
        ) : (
          <div className="space-y-1.5">
            {req.submissions.map((s, i) => (
              <div key={i} className="flex items-center gap-2 rounded-lg border border-line bg-ink-900 px-3 py-2">
                <FileText className="size-4 shrink-0 text-lotus-300" />
                <div className="min-w-0 flex-1">
                  <a href={s.url} target="_blank" rel="noreferrer" className="block truncate text-sm text-mist-100 hover:text-lotus-300">{s.originalName}</a>
                  <div className="text-[11px] text-mist-500">{fmt(s.at)}{s.comment ? ` · "${s.comment}"` : ""}</div>
                </div>
                <a href={s.url} download target="_blank" rel="noreferrer" className="grid size-7 place-items-center rounded-lg bg-white/[0.06] text-mist-200 hover:bg-white/[0.12]"><Download className="size-3.5" /></a>
              </div>
            ))}
          </div>
        )}

        <label className="mt-4 block text-xs font-semibold text-mist-300">Remarks / comment to the user</label>
        <input value={remarks} onChange={(e) => setRemarks(e.target.value)} placeholder="e.g. Document unclear, please re-upload" className={`${field} mt-1`} />

        <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
          <Button variant="secondary" onClick={() => onAct(req.id, "under_review", remarks)}><Clock className="size-4" /> Review</Button>
          <Button variant="secondary" onClick={() => onAct(req.id, "resubmit", remarks)}><RefreshCw className="size-4" /> Resubmit</Button>
          <Button variant="danger" onClick={() => onAct(req.id, "rejected", remarks)}><X className="size-4" /> Reject</Button>
          <Button onClick={() => onAct(req.id, "approved", remarks)}><Check className="size-4" /> Approve</Button>
        </div>

        {/* History + delete */}
        <details className="mt-4">
          <summary className="cursor-pointer text-xs font-semibold text-mist-400 hover:text-mist-200"><History className="mr-1 inline size-3.5" /> History &amp; audit ({req.history.length})</summary>
          <div className="mt-2 space-y-1">
            {req.history.map((h, i) => <div key={i} className="flex items-start gap-2 text-[11px] text-mist-400"><span className="shrink-0 text-mist-600">{fmt(h.at)}</span><span>{h.action} — {h.by}</span></div>)}
          </div>
        </details>

        <button onClick={() => onDelete(req.id)} className="mt-4 inline-flex items-center gap-1.5 text-xs text-rose-300 hover:text-rose-200"><Trash2 className="size-3.5" /> Delete this request</button>
      </div>
    </div>
  );
}
