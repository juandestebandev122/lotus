"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { cn } from "@/lib/cn";
import { withBase } from "@/lib/base-path";
import { useConfig, saveConfig } from "@/lib/config";
import {
  HardDrive, UploadCloud, FolderPlus, Folder, FolderOpen, Search, Download, Eye, Trash2, Pencil,
  Loader2, RefreshCw, X, Check, FileText, Image as ImageIcon, Film, Music, Archive, Table2, Presentation,
  Info, Settings2, FolderInput,
} from "lucide-react";

// ---------------------------------------------------------------------------
// ADMIN → FILE STORAGE
// One permanent home for every company file: project documents, training
// material, manuals, images, videos and archives. Files stay until an
// administrator deletes them — nothing here is ever auto-cleaned.
// ---------------------------------------------------------------------------

interface AdminFolder { id: string; name: string; createdAt: string; createdBy: string }
interface AdminFile {
  id: string; name: string; title: string; originalName: string;
  mime: string; ext: string; size: number; at: string;
  uploaderId: string; uploaderName: string; folderId?: string; note?: string;
}
interface Stats {
  files: number; folders: number; usedBytes: number; quotaBytes: number; freeBytes: number;
  byType: { type: string; files: number; bytes: number }[];
}

const fmtBytes = (n: number) =>
  !n ? "0 B" : n < 1024 ? `${n} B` : n < 1048576 ? `${Math.round(n / 1024)} KB`
    : n < 1073741824 ? `${(n / 1048576).toFixed(1)} MB` : `${(n / 1073741824).toFixed(2)} GB`;
const fmtDate = (iso: string) => { try { return new Date(iso).toLocaleString("en-SA", { dateStyle: "medium", timeStyle: "short" }); } catch { return iso; } };

const GROUPS = ["All", "Documents", "Spreadsheets", "Presentations", "Images", "Videos", "Audio", "Archives", "Other"] as const;

function groupOf(f: AdminFile): string {
  if (f.mime.startsWith("image/")) return "Images";
  if (f.mime.startsWith("video/")) return "Videos";
  if (f.mime.startsWith("audio/")) return "Audio";
  if (["zip", "rar", "7z", "tar", "gz"].includes(f.ext)) return "Archives";
  if (["doc", "docx", "txt", "rtf", "odt", "pdf"].includes(f.ext)) return "Documents";
  if (["xls", "xlsx", "csv", "ods"].includes(f.ext)) return "Spreadsheets";
  if (["ppt", "pptx", "odp"].includes(f.ext)) return "Presentations";
  return "Other";
}

function FileGlyph({ f, className }: { f: AdminFile; className?: string }) {
  const g = groupOf(f);
  const Icon = g === "Images" ? ImageIcon : g === "Videos" ? Film : g === "Audio" ? Music
    : g === "Archives" ? Archive : g === "Spreadsheets" ? Table2 : g === "Presentations" ? Presentation : FileText;
  return <Icon className={className} />;
}

/** Only these can safely be shown inside the browser; everything else downloads. */
const previewable = (f: AdminFile) => /^(image|video|audio)\//.test(f.mime) || f.mime === "application/pdf";

export default function AdminFileStoragePage() {
  const { toast } = useToast();
  const { config, reload } = useConfig();

  const [files, setFiles] = useState<AdminFile[]>([]);
  const [folders, setFolders] = useState<AdminFolder[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);

  const [q, setQ] = useState("");
  const [group, setGroup] = useState<string>("All");
  const [folderId, setFolderId] = useState<string>(""); // "" = all folders
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState("");
  const fileInput = useRef<HTMLInputElement>(null);

  const [newFolder, setNewFolder] = useState("");
  const [renaming, setRenaming] = useState<{ id: string; title: string } | null>(null);
  const [renamingFolder, setRenamingFolder] = useState<{ id: string; name: string } | null>(null);
  const [confirmFile, setConfirmFile] = useState<AdminFile | null>(null);
  const [confirmFolder, setConfirmFolder] = useState<AdminFolder | null>(null);
  const [preview, setPreview] = useState<AdminFile | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [quotaGB, setQuotaGB] = useState(String(config.fileStorage?.quotaGB ?? 0));
  const [maxFileMB, setMaxFileMB] = useState(String(config.fileStorage?.maxFileMB ?? 200));
  const [savingCfg, setSavingCfg] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const r = await fetch(withBase("/api/admin/file-storage"), { credentials: "include", cache: "no-store" });
      const d = await r.json();
      if (r.ok) { setFiles(d.files ?? []); setFolders(d.folders ?? []); setStats(d.stats ?? null); }
      else toast(d?.error ?? "Could not load the file library", "error");
    } catch { toast("Network error", "error"); }
    setLoading(false);
  };
  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, []);

  const act = async (body: Record<string, unknown>, okMsg: string) => {
    const r = await fetch(withBase("/api/admin/file-storage"), {
      method: "POST", headers: { "Content-Type": "application/json" }, credentials: "include",
      body: JSON.stringify(body),
    });
    const d = await r.json().catch(() => ({}));
    if (r.ok) { toast(okMsg, "success"); await load(); return true; }
    toast((d as { error?: string })?.error ?? "That didn't work", "error");
    return false;
  };

  /** Create a folder, saying WHY nothing happened when it can't. */
  const createFolder = async () => {
    const name = newFolder.trim();
    if (!name) { toast("Type a folder name first, then press Add.", "error"); return; }
    if (folders.some((f) => f.name.toLowerCase() === name.toLowerCase())) {
      toast(`A folder called "${name}" already exists.`, "error");
      return;
    }
    const okd = await act({ action: "createFolder", name }, `Folder "${name}" created`);
    if (okd) setNewFolder("");
  };

  const upload = async (list: FileList | null) => {
    if (!list || list.length === 0) return;
    setUploading(true);
    let done = 0;
    for (const file of Array.from(list)) {
      setProgress(`Uploading ${done + 1} of ${list.length} — ${file.name}`);
      const fd = new FormData();
      fd.append("file", file);
      if (folderId) fd.append("folderId", folderId);
      try {
        const r = await fetch(withBase("/api/admin/file-storage"), { method: "POST", credentials: "include", body: fd });
        const d = await r.json().catch(() => ({}));
        if (!r.ok) toast(`${file.name}: ${(d as { error?: string })?.error ?? "upload failed"}`, "error");
        else done++;
      } catch { toast(`${file.name}: network error`, "error"); }
    }
    setUploading(false);
    setProgress("");
    if (fileInput.current) fileInput.current.value = "";
    if (done > 0) toast(`${done} file${done === 1 ? "" : "s"} uploaded`, "success");
    await load();
  };

  const saveSettings = async () => {
    setSavingCfg(true);
    const res = await saveConfig({ fileStorage: { quotaGB: Math.max(0, Number(quotaGB) || 0), maxFileMB: Math.max(1, Number(maxFileMB) || 200) } });
    setSavingCfg(false);
    if (res.ok) { await reload(); await load(); setShowSettings(false); toast("File Storage settings saved", "success"); }
    else toast(res.error ?? "Could not save", "error");
  };

  const shown = useMemo(() => {
    const s = q.trim().toLowerCase();
    return files.filter((f) => {
      if (folderId && (f.folderId ?? "") !== folderId) return false;
      if (group !== "All" && groupOf(f) !== group) return false;
      if (s && !`${f.title} ${f.originalName} ${f.uploaderName} ${f.ext} ${f.note ?? ""}`.toLowerCase().includes(s)) return false;
      return true;
    });
  }, [files, q, group, folderId]);

  const shownBytes = shown.reduce((n, f) => n + f.size, 0);
  const usedPct = stats && stats.quotaBytes > 0 ? Math.min(100, Math.round((stats.usedBytes / stats.quotaBytes) * 100)) : 0;
  const folderName = (id?: string) => folders.find((f) => f.id === id)?.name;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 font-display text-2xl font-extrabold text-mist-100">
            <HardDrive className="size-6 text-lotus-300" /> File Storage
          </h1>
          <p className="text-sm text-mist-400">
            One permanent place for all project documents, training material, manuals, images and videos. Files stay here until you delete them.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="secondary" onClick={() => setShowSettings((v) => !v)}><Settings2 className="size-4" /> Settings</Button>
          <Button size="sm" variant="secondary" onClick={load} disabled={loading}><RefreshCw className={cn("size-4", loading && "animate-spin")} /> Refresh</Button>
        </div>
      </div>

      {/* Storage settings */}
      {showSettings && (
        <Card className="p-4">
          <h2 className="mb-3 flex items-center gap-2 font-semibold text-mist-100"><Settings2 className="size-4 text-lotus-300" /> Storage settings</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block">
              <span className="text-xs font-semibold text-mist-300">Total storage quota (GB)</span>
              <input value={quotaGB} onChange={(e) => setQuotaGB(e.target.value.replace(/[^\d.]/g, ""))} className="mt-1 w-full rounded-lg border border-line bg-ink-900 px-3 py-2 text-sm text-mist-100 outline-none focus:border-lotus-400" />
              <span className="mt-0.5 block text-[11px] text-mist-500">0 = unlimited (only the server disk limits it).</span>
            </label>
            <label className="block">
              <span className="text-xs font-semibold text-mist-300">Largest single file (MB)</span>
              <input value={maxFileMB} onChange={(e) => setMaxFileMB(e.target.value.replace(/\D/g, ""))} className="mt-1 w-full rounded-lg border border-line bg-ink-900 px-3 py-2 text-sm text-mist-100 outline-none focus:border-lotus-400" />
              <span className="mt-0.5 block text-[11px] text-mist-500">Applies to uploads on this page only.</span>
            </label>
          </div>
          <div className="mt-3 flex justify-end">
            <Button size="sm" onClick={saveSettings} disabled={savingCfg}><Check className="size-4" /> {savingCfg ? "Saving…" : "Save settings"}</Button>
          </div>
        </Card>
      )}

      {/* Usage statistics */}
      <Card className="p-4">
        <div className="grid gap-3 sm:grid-cols-4">
          <Stat label="Files stored" value={String(stats?.files ?? 0)} />
          <Stat label="Space used" value={fmtBytes(stats?.usedBytes ?? 0)} />
          <Stat label="Space available" value={stats && stats.quotaBytes > 0 ? fmtBytes(stats.freeBytes) : "Unlimited"} />
          <Stat label="Folders" value={String(stats?.folders ?? 0)} />
        </div>
        {stats && stats.quotaBytes > 0 && (
          <div className="mt-3">
            <div className="h-2 overflow-hidden rounded-full bg-ink-800">
              <div className={cn("h-full rounded-full transition-all", usedPct >= 90 ? "bg-rose-500" : usedPct >= 75 ? "bg-amber-400" : "bg-emerald-500")} style={{ width: `${usedPct}%` }} />
            </div>
            <p className="mt-1 text-[11px] text-mist-500">{usedPct}% of {fmtBytes(stats.quotaBytes)} used.</p>
          </div>
        )}
        {stats && stats.byType.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {stats.byType.map((t) => (
              <span key={t.type} className="rounded-full border border-line bg-ink-900 px-2.5 py-1 text-[11px] text-mist-300">
                {t.type}: <b className="text-mist-100">{t.files}</b> · {fmtBytes(t.bytes)}
              </span>
            ))}
          </div>
        )}
      </Card>

      {/* Upload + folders */}
      <div className="grid gap-4 lg:grid-cols-[18rem_1fr]">
        <Card className="p-4">
          <h2 className="mb-2 flex items-center gap-2 font-semibold text-mist-100"><Folder className="size-4 text-lotus-300" /> Folders</h2>
          {/* Creating a folder used to do NOTHING when the box was empty — no
              message, no disabled state — which reads as "the button is broken".
              It now says what it needs, and shows plainly when it can't act. */}
          <div className="flex items-center gap-1.5">
            <input
              value={newFolder}
              onChange={(e) => setNewFolder(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") void createFolder(); }}
              placeholder="Type a folder name…"
              className="h-9 w-full rounded-lg border border-line bg-ink-900 px-2.5 text-sm text-mist-100 outline-none focus:border-lotus-400"
            />
            <button
              onClick={() => void createFolder()}
              title={newFolder.trim() ? `Create the folder "${newFolder.trim()}"` : "Type a folder name first"}
              className={cn(
                "inline-flex h-9 shrink-0 items-center gap-1.5 rounded-lg px-3 text-sm font-semibold transition",
                newFolder.trim() ? "bg-lotus-600 text-white hover:bg-lotus-500" : "cursor-not-allowed bg-ink-800 text-mist-500",
              )}
            >
              <FolderPlus className="size-4" /> Add
            </button>
          </div>
          {!newFolder.trim() && <p className="mt-1.5 text-[11px] text-mist-500">Type a name in the box, then press <b className="text-mist-300">Add</b> (or Enter).</p>}

          <div className="mt-3 space-y-1">
            <button
              onClick={() => setFolderId("")}
              className={cn("flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-sm transition", folderId === "" ? "bg-lotus-500/15 text-mist-100" : "text-mist-300 hover:bg-white/[0.05]")}
            >
              <FolderOpen className="size-4 shrink-0 text-lotus-300" />
              <span className="min-w-0 flex-1 truncate">All Uploaded Files</span>
              <span className="text-[11px] text-mist-500">{files.length}</span>
            </button>
            {folders.map((f) => {
              const count = files.filter((x) => x.folderId === f.id).length;
              return (
                <div key={f.id} className={cn("group flex items-center gap-1 rounded-lg px-1 transition", folderId === f.id ? "bg-lotus-500/15" : "hover:bg-white/[0.05]")}>
                  {renamingFolder?.id === f.id ? (
                    <div className="flex w-full items-center gap-1 py-1">
                      <input
                        autoFocus value={renamingFolder.name}
                        onChange={(e) => setRenamingFolder({ id: f.id, name: e.target.value })}
                        onKeyDown={(e) => { if (e.key === "Enter") { act({ action: "renameFolder", id: f.id, name: renamingFolder.name }, "Folder renamed"); setRenamingFolder(null); } if (e.key === "Escape") setRenamingFolder(null); }}
                        className="h-8 w-full rounded-lg border border-line bg-ink-900 px-2 text-sm text-mist-100 outline-none focus:border-lotus-400"
                      />
                      <button onClick={() => { act({ action: "renameFolder", id: f.id, name: renamingFolder.name }, "Folder renamed"); setRenamingFolder(null); }} className="grid size-7 shrink-0 place-items-center rounded-lg text-emerald-300 hover:bg-emerald-500/10"><Check className="size-4" /></button>
                      <button onClick={() => setRenamingFolder(null)} className="grid size-7 shrink-0 place-items-center rounded-lg text-mist-400 hover:bg-white/10"><X className="size-4" /></button>
                    </div>
                  ) : (
                    <>
                      <button onClick={() => setFolderId(f.id)} className="flex min-w-0 flex-1 items-center gap-2 py-2 pl-1.5 text-left text-sm text-mist-300">
                        <Folder className="size-4 shrink-0 text-mist-400" />
                        <span className="min-w-0 flex-1 truncate">{f.name}</span>
                        <span className="text-[11px] text-mist-500">{count}</span>
                      </button>
                      <button onClick={() => setRenamingFolder({ id: f.id, name: f.name })} title="Rename folder" className="grid size-7 shrink-0 place-items-center rounded-lg text-mist-500 opacity-0 transition hover:text-mist-100 group-hover:opacity-100"><Pencil className="size-3.5" /></button>
                      <button onClick={() => setConfirmFolder(f)} title="Delete folder" className="grid size-7 shrink-0 place-items-center rounded-lg text-mist-500 opacity-0 transition hover:text-rose-300 group-hover:opacity-100"><Trash2 className="size-3.5" /></button>
                    </>
                  )}
                </div>
              );
            })}
            {folders.length === 0 && <p className="px-1 py-2 text-[11px] text-mist-500">No folders yet — create one to organise the library.</p>}
          </div>
        </Card>

        <div className="space-y-4">
          {/* Upload */}
          <Card className="p-4">
            <h2 className="mb-2 flex items-center gap-2 font-semibold text-mist-100"><UploadCloud className="size-4 text-lotus-300" /> Upload files</h2>
            <div
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => { e.preventDefault(); upload(e.dataTransfer.files); }}
              className="rounded-xl border border-dashed border-line bg-ink-900/50 px-4 py-6 text-center"
            >
              <input ref={fileInput} type="file" multiple className="hidden" onChange={(e) => upload(e.target.files)} />
              <p className="text-sm text-mist-300">
                Drag files here, or{" "}
                <button onClick={() => fileInput.current?.click()} className="font-semibold text-lotus-300 hover:text-lotus-200">choose files</button>
                {folderId && <> — they&apos;ll go into <b className="text-mist-100">{folderName(folderId)}</b></>}
              </p>
              <p className="mt-1 text-[11px] text-mist-500">
                PDF · DOC/DOCX · XLS/XLSX · PPT/PPTX · TXT/CSV · JPG/PNG/WEBP/GIF · MP4/WEBM/MOV · MP3/WAV · ZIP/RAR/7Z and more.
                Up to {config.fileStorage?.maxFileMB ?? 200} MB per file.
              </p>
              {uploading && <p className="mt-2 flex items-center justify-center gap-2 text-xs text-lotus-300"><Loader2 className="size-3.5 animate-spin" /> {progress}</p>}
            </div>
            <div className="mt-2 flex items-start gap-2 rounded-lg border border-sky-400/20 bg-sky-500/5 px-3 py-2 text-[11px] text-mist-400">
              <Info className="mt-0.5 size-3.5 shrink-0 text-sky-300" />
              <p>Executable and app-installer files (.exe, .bat, .apk, .msi…) are refused — they can&apos;t be safely stored and served back over the web. Everything else is accepted.</p>
            </div>
          </Card>

          {/* All uploaded files */}
          <Card className="p-4">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <h2 className="flex items-center gap-2 font-semibold text-mist-100">
                <FileText className="size-4 text-lotus-300" />
                {folderId ? folderName(folderId) : "All Uploaded Files"}
                <span className="rounded-full bg-ink-700 px-2 py-0.5 text-[11px] text-mist-300">{shown.length}</span>
              </h2>
              <span className="text-[11px] text-mist-500">{fmtBytes(shownBytes)} shown</span>
            </div>

            <div className="mb-2 flex items-center gap-2 rounded-xl border border-line bg-ink-900 px-3">
              <Search className="size-4 text-mist-500" />
              <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search by file name, uploader, type or note" className="w-full bg-transparent py-2.5 text-sm text-mist-100 outline-none" />
              {q && <button onClick={() => setQ("")} className="text-mist-500 hover:text-mist-200"><X className="size-4" /></button>}
            </div>

            <div className="mb-3 flex flex-wrap gap-1.5">
              {GROUPS.map((g) => (
                <button
                  key={g}
                  onClick={() => setGroup(g)}
                  className={cn("rounded-full border px-2.5 py-1 text-[11px] font-medium transition", group === g ? "border-lotus-400/50 bg-lotus-500/15 text-mist-100" : "border-line bg-ink-900 text-mist-400 hover:text-mist-100")}
                >
                  {g}
                </button>
              ))}
            </div>

            {loading ? (
              <div className="grid place-items-center py-12 text-mist-500"><Loader2 className="size-6 animate-spin" /></div>
            ) : shown.length === 0 ? (
              <p className="py-10 text-center text-sm text-mist-500">
                {files.length === 0 ? "No files yet — upload the first one above." : "No file matches these filters."}
              </p>
            ) : (
              <div className="space-y-1.5">
                {shown.map((f) => (
                  <div key={f.id} className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-xl border border-line bg-ink-900/50 px-3 py-2.5">
                    <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-white/[0.06] text-mist-300">
                      <FileGlyph f={f} className="size-4" />
                    </span>

                    {/* On a narrow screen the name takes its own line so the
                        buttons below it — Download especially — are never
                        pushed off the right edge. */}
                    <div className="min-w-0 flex-1 basis-[calc(100%-3rem)] sm:basis-0">
                      {renaming?.id === f.id ? (
                        <div className="flex items-center gap-1.5">
                          <input
                            autoFocus value={renaming.title}
                            onChange={(e) => setRenaming({ id: f.id, title: e.target.value })}
                            onKeyDown={(e) => { if (e.key === "Enter") { act({ action: "renameFile", id: f.id, title: renaming.title }, "File renamed"); setRenaming(null); } if (e.key === "Escape") setRenaming(null); }}
                            className="h-8 w-full max-w-sm rounded-lg border border-line bg-ink-900 px-2 text-sm text-mist-100 outline-none focus:border-lotus-400"
                          />
                          <button onClick={() => { act({ action: "renameFile", id: f.id, title: renaming.title }, "File renamed"); setRenaming(null); }} className="grid size-7 place-items-center rounded-lg text-emerald-300 hover:bg-emerald-500/10"><Check className="size-4" /></button>
                          <button onClick={() => setRenaming(null)} className="grid size-7 place-items-center rounded-lg text-mist-400 hover:bg-white/10"><X className="size-4" /></button>
                        </div>
                      ) : (
                        <>
                          <div className="truncate text-sm font-medium text-mist-100">{f.title}</div>
                          <div className="truncate text-[11px] text-mist-500">
                            {f.ext.toUpperCase()} · {fmtBytes(f.size)} · {fmtDate(f.at)} · by {f.uploaderName}
                            {f.folderId && folderName(f.folderId) ? ` · ${folderName(f.folderId)}` : ""}
                          </div>
                        </>
                      )}
                    </div>

                    {/* Move to folder */}
                    <div className="flex shrink-0 items-center gap-1">
                      <span className="hidden text-mist-500 sm:block"><FolderInput className="size-3.5" /></span>
                      <select
                        value={f.folderId ?? ""}
                        onChange={(e) => act({ action: "moveFile", id: f.id, folderId: e.target.value }, "File moved")}
                        title="Move to a folder"
                        className="h-8 max-w-[9rem] rounded-lg border border-line bg-ink-900 px-1.5 text-[11px] text-mist-200 outline-none focus:border-lotus-400"
                      >
                        <option value="">— No folder —</option>
                        {folders.map((fd) => <option key={fd.id} value={fd.id}>{fd.name}</option>)}
                      </select>
                    </div>

                    {/* Actions */}
                    <div className="flex shrink-0 items-center gap-1">
                      {previewable(f) && (
                        <button onClick={() => setPreview(f)} title="Preview" className="grid size-8 place-items-center rounded-lg text-mist-400 transition hover:bg-white/[0.06] hover:text-mist-100">
                          <Eye className="size-4" />
                        </button>
                      )}
                      {/* Labelled, not just an icon — the client reported the
                          download option as "missing" when it was an unlabelled
                          glyph being clipped off the row. */}
                      <a
                        href={withBase(`/api/file/${f.name}?download=1`)}
                        download={f.originalName}
                        title={`Download ${f.originalName}`}
                        className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-lotus-400/30 bg-lotus-500/10 px-2.5 text-xs font-semibold text-lotus-200 transition hover:bg-lotus-500/20"
                      >
                        <Download className="size-4" /> Download
                      </a>
                      <button onClick={() => setRenaming({ id: f.id, title: f.title })} title="Edit file name" className="grid size-8 place-items-center rounded-lg text-mist-400 transition hover:bg-white/[0.06] hover:text-mist-100">
                        <Pencil className="size-4" />
                      </button>
                      <button onClick={() => setConfirmFile(f)} title="Delete file" className="grid size-8 place-items-center rounded-lg text-rose-300 transition hover:bg-rose-500/10">
                        <Trash2 className="size-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>
      </div>

      {/* Preview */}
      {preview && (
        <div className="fixed inset-0 z-[80] grid place-items-center bg-black/75 p-4" onClick={() => setPreview(null)}>
          <div className="max-h-[90vh] w-full max-w-3xl overflow-hidden rounded-2xl border border-white/10 bg-ink-850" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center gap-2 border-b border-white/10 px-4 py-3">
              <FileGlyph f={preview} className="size-4 shrink-0 text-lotus-300" />
              <p className="min-w-0 flex-1 truncate text-sm font-semibold text-mist-100">{preview.title}</p>
              <a href={withBase(`/api/file/${preview.name}`)} download={preview.originalName} className="grid size-8 place-items-center rounded-lg text-mist-400 hover:bg-white/10 hover:text-mist-100"><Download className="size-4" /></a>
              <button onClick={() => setPreview(null)} className="grid size-8 place-items-center rounded-lg text-mist-400 hover:bg-white/10 hover:text-mist-100"><X className="size-4" /></button>
            </div>
            <div className="max-h-[76vh] overflow-auto bg-black/30 p-3">
              {preview.mime.startsWith("image/") && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={withBase(`/api/file/${preview.name}`)} alt={preview.title} className="mx-auto max-h-[70vh] max-w-full rounded-lg object-contain" />
              )}
              {preview.mime.startsWith("video/") && (
                <video src={withBase(`/api/file/${preview.name}`)} controls className="mx-auto max-h-[70vh] w-full rounded-lg" />
              )}
              {preview.mime.startsWith("audio/") && (
                <audio src={withBase(`/api/file/${preview.name}`)} controls className="mx-auto w-full" />
              )}
              {preview.mime === "application/pdf" && (
                <iframe src={withBase(`/api/file/${preview.name}`)} title={preview.title} className="h-[70vh] w-full rounded-lg bg-white" />
              )}
            </div>
          </div>
        </div>
      )}

      {confirmFile && (
        <ConfirmDialog
          danger
          title={`Delete "${confirmFile.title}"?`}
          message="The file is permanently removed from the server and can no longer be opened or downloaded anywhere it was shared."
          confirmLabel="Delete file"
          cancelLabel="Keep it"
          onConfirm={() => { act({ action: "deleteFile", id: confirmFile.id }, "File deleted"); setConfirmFile(null); }}
          onCancel={() => setConfirmFile(null)}
        />
      )}

      {confirmFolder && (
        <ConfirmDialog
          danger
          title={`Delete the folder "${confirmFolder.name}"?`}
          message="The folder is removed. Any files inside it are KEPT — they simply move back to “All Uploaded Files”."
          confirmLabel="Delete folder"
          cancelLabel="Cancel"
          onConfirm={() => { act({ action: "deleteFolder", id: confirmFolder.id }, "Folder deleted"); if (folderId === confirmFolder.id) setFolderId(""); setConfirmFolder(null); }}
          onCancel={() => setConfirmFolder(null)}
        />
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-line bg-ink-900/50 px-3 py-2.5">
      <div className="text-[11px] uppercase tracking-wide text-mist-500">{label}</div>
      <div className="mt-0.5 font-display text-lg font-bold text-mist-100">{value}</div>
    </div>
  );
}
