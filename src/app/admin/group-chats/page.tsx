"use client";

import { useEffect, useState } from "react";
import { useToast } from "@/components/ui/Toast";
import { fetchModeration, moderationAction, type ModerationData } from "@/lib/admin";
import { GroupChatHistory } from "@/components/admin/GroupChatHistory";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { useConfig, saveConfig } from "@/lib/config";
import { withBase } from "@/lib/base-path";
import { cn } from "@/lib/cn";
import { MessageSquare, Check, Search, User, Trash2 } from "lucide-react";

import { UserLink, SortTh, applyFilterSort, type SortDir } from "@/components/admin/TableControls";

interface DmRow { id: string; fromId?: string; fromName: string; fromPublicId?: string; toId?: string; toName: string; toPublicId?: string; text: string; at: string; deleted: boolean }

function Toggle({ on, onClick }: { on: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick} className={cn("relative h-6 w-11 shrink-0 rounded-full transition", on ? "bg-emerald-500" : "bg-ink-700")}>
      <span className={cn("absolute top-0.5 size-5 rounded-full bg-white transition-all", on ? "left-[22px]" : "left-0.5")} />
    </button>
  );
}

// Dedicated, top-level "Group Chat History" page — the same full feature that
// also lives as a tab in the Moderation Center, surfaced here so admins can find
// it directly from the sidebar — plus the chat & messages policy controls.
export default function AdminGroupChatsPage() {
  const { toast } = useToast();
  const { config, reload } = useConfig();
  const [data, setData] = useState<ModerationData | null>(null);
  const [chat, setChat] = useState({ storeMessages: true, groupRetentionDays: 3, deleteForEveryone: true });
  const [savingChat, setSavingChat] = useState(false);
  const [dms, setDms] = useState<DmRow[]>([]);
  const [dmQuery, setDmQuery] = useState("");
  const [dmSort, setDmSort] = useState("when");
  const [dmDir, setDmDir] = useState<SortDir>("desc");
  const [dmBusy, setDmBusy] = useState("");

  // Admin moderation: remove a personal (DM) message for BOTH people.
  const removeDm = async (id: string) => {
    if (!window.confirm("Remove this personal message for both people? This can't be undone.")) return;
    setDmBusy(id);
    try {
      const r = await fetch(withBase("/api/admin/dms"), { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "deleteMessage", id }) });
      if (r.ok) { setDms((prev) => prev.map((m) => (m.id === id ? { ...m, deleted: true, text: "" } : m))); toast("Message removed for both people", "success"); }
      else { const d = await r.json().catch(() => ({})); toast(d.error ?? "Could not remove the message", "error"); }
    } catch { toast("Could not remove the message", "error"); }
    setDmBusy("");
  };

  const load = () => fetchModeration().then(setData);
  useEffect(() => { load(); }, []);
  useEffect(() => {
    fetch(withBase("/api/admin/dms"), { credentials: "include", cache: "no-store" })
      .then((r) => r.json()).then((d) => { if (d?.messages) setDms(d.messages); }).catch(() => {});
  }, []);
  const sortDms = (col: string) => { if (col === dmSort) setDmDir((d) => (d === "asc" ? "desc" : "asc")); else { setDmSort(col); setDmDir("desc"); } };
  const shownDms = applyFilterSort(dms, {
    q: dmQuery, sort: dmSort, dir: dmDir,
    searchText: (m) => `${m.fromName} ${m.fromPublicId ?? ""} ${m.toName} ${m.toPublicId ?? ""} ${m.text} ${m.at}`,
    sortKeys: {
      from: (m) => m.fromName ?? "",
      to: (m) => m.toName ?? "",
      message: (m) => m.text ?? "",
      when: (m) => new Date(m.at).getTime() || 0,
    },
  });
  useEffect(() => {
    setChat({
      storeMessages: config.chat?.storeMessages !== false,
      groupRetentionDays: config.chat?.groupRetentionDays ?? 3,
      deleteForEveryone: config.chat?.deleteForEveryone !== false,
    });
  }, [config.chat]);

  const act = async (body: Record<string, unknown>, msg: string) => {
    const ok = await moderationAction(body);
    toast(ok ? msg : "Action failed", ok ? "success" : "error");
    load();
  };

  const saveChat = async () => {
    setSavingChat(true);
    const res = await saveConfig({ chat });
    setSavingChat(false);
    if (res.ok) { await reload(); toast("Chat settings saved", "success"); }
    else toast(res.error ?? "Could not save", "error");
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="flex items-center gap-2 font-display text-2xl font-extrabold text-mist-100">
          <MessageSquare className="size-6 text-lotus-300" /> Chat &amp; Messages
        </h1>
        <p className="text-sm text-mist-400">Policy controls + view, search, filter, moderate &amp; export every group&apos;s chat — by group, owner, ID, type or date.</p>
      </div>

      {/* ===== Chat & messages policy ===== */}
      <Card className="space-y-4 p-5">
        <h2 className="font-semibold text-mist-100">Message policy</h2>
        <div className="flex items-center justify-between gap-4">
          <div className="min-w-0">
            <p className="text-sm font-semibold text-mist-200">Store chat history for review</p>
            <p className="text-xs text-mist-400">Keep messages so admins can view &amp; export the history below. Turn off to stop retaining chat for review.</p>
          </div>
          <Toggle on={chat.storeMessages} onClick={() => setChat((c) => ({ ...c, storeMessages: !c.storeMessages }))} />
        </div>
        <div className="flex items-center justify-between gap-4 border-t border-white/5 pt-4">
          <div className="min-w-0">
            <p className="text-sm font-semibold text-mist-200">Group chat auto-delete</p>
            <p className="text-xs text-mist-400">Members only see messages from the last N days. Older group messages disappear automatically (admins still keep the full history).</p>
          </div>
          <label className="flex shrink-0 items-center gap-2 rounded-lg border border-line bg-ink-900 px-2.5 py-1.5">
            <input type="number" min={1} max={365} value={chat.groupRetentionDays} onChange={(e) => setChat((c) => ({ ...c, groupRetentionDays: Math.max(1, Math.min(365, Math.floor(Number(e.target.value) || 1))) }))} className="w-14 bg-transparent text-center text-sm text-mist-100 outline-none" />
            <span className="text-xs text-mist-400">days</span>
          </label>
        </div>
        <div className="flex items-center justify-between gap-4 border-t border-white/5 pt-4">
          <div className="min-w-0">
            <p className="text-sm font-semibold text-mist-200">Allow &ldquo;Delete for everyone&rdquo; in personal chats</p>
            <p className="text-xs text-mist-400">Let users unsend their own DM for both people. Off = users can only delete messages for themselves.</p>
          </div>
          <Toggle on={chat.deleteForEveryone} onClick={() => setChat((c) => ({ ...c, deleteForEveryone: !c.deleteForEveryone }))} />
        </div>
        <Button size="sm" onClick={saveChat} disabled={savingChat}><Check className="size-4" /> {savingChat ? "Saving…" : "Save chat settings"}</Button>
      </Card>

      <GroupChatHistory chats={data?.chats ?? []} groups={data?.groups ?? []} onAction={act} />

      {/* ===== Personal (DM) message history ===== */}
      <div>
        <h2 className="mb-2 flex items-center gap-2 font-semibold text-mist-100">
          <User className="size-4 text-lotus-300" /> Personal messages (DM) history
          <span className="font-normal text-mist-500">({shownDms.length}{dmQuery ? ` of ${dms.length}` : ""})</span>
        </h2>
        <div className="mb-3 flex items-center gap-2 rounded-xl border border-line bg-ink-900 px-3">
          <Search className="size-4 text-mist-500" />
          <input value={dmQuery} onChange={(e) => setDmQuery(e.target.value)} placeholder="Search by user name, message text or date…" className="w-full bg-transparent py-2.5 text-sm text-mist-100 outline-none" />
        </div>
        <Card className="overflow-hidden p-0">
          <div className="max-h-[28rem] overflow-auto">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-ink-900">
                <tr className="border-b border-white/5 text-left text-xs uppercase tracking-wide text-mist-500">
                  <SortTh col="from" sort={dmSort} dir={dmDir} onSort={sortDms} className="px-4 py-2.5">From</SortTh>
                  <SortTh col="to" sort={dmSort} dir={dmDir} onSort={sortDms} className="px-4 py-2.5">To</SortTh>
                  <SortTh col="message" sort={dmSort} dir={dmDir} onSort={sortDms} className="px-4 py-2.5">Message</SortTh>
                  <SortTh col="when" sort={dmSort} dir={dmDir} onSort={sortDms} className="px-4 py-2.5">When</SortTh>
                  <th className="px-4 py-2.5 text-right">Action</th>
                </tr>
              </thead>
              <tbody>
                {shownDms.map((m) => (
                  <tr key={m.id} className="border-b border-white/5 last:border-0">
                    <td className="whitespace-nowrap px-4 py-2.5 text-mist-200"><UserLink name={m.fromName} publicId={m.fromPublicId} userId={m.fromId} /></td>
                    <td className="whitespace-nowrap px-4 py-2.5 text-mist-300"><UserLink name={m.toName} publicId={m.toPublicId} userId={m.toId} /></td>
                    <td className={cn("px-4 py-2.5", m.deleted ? "italic text-mist-500" : "text-mist-200")}>{m.deleted ? "[removed by admin]" : m.text}</td>
                    <td className="whitespace-nowrap px-4 py-2.5 text-xs text-mist-400">{new Date(m.at).toLocaleString("en-SA", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</td>
                    <td className="whitespace-nowrap px-4 py-2.5 text-right">
                      {m.deleted ? (
                        <span className="text-[11px] text-mist-600">removed</span>
                      ) : (
                        <button onClick={() => removeDm(m.id)} disabled={dmBusy === m.id} title="Remove this message for both people" className="inline-flex items-center gap-1 rounded-lg bg-rose-500/10 px-2 py-1 text-[11px] font-semibold text-rose-300 transition hover:bg-rose-500/20 disabled:opacity-50">
                          <Trash2 className="size-3.5" /> {dmBusy === m.id ? "Removing…" : "Remove"}
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
                {shownDms.length === 0 && <tr><td colSpan={5} className="px-4 py-8 text-center text-sm text-mist-500">{chat.storeMessages ? "No personal messages match." : "Message storage is turned off."}</td></tr>}
              </tbody>
            </table>
          </div>
        </Card>
      </div>
    </div>
  );
}
