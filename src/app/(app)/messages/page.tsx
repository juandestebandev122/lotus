"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  Search, Send, ArrowLeft, Check, CheckCheck, Trash2, MoreVertical,
  Smile, Paperclip, Mic, CornerUpLeft, X, Image as ImageIcon, Camera, Video, FileText,
  CheckSquare, Ban, Flag, MessageSquareX, ShieldOff,
  Copy, Forward, Star, Pin, Pencil,
} from "lucide-react";
import { Avatar } from "@/components/ui/Avatar";
import { EmojiPicker } from "@/components/chat/EmojiPicker";
import { VoiceRecorder } from "@/components/chat/VoiceRecorder";
import { MessageBody } from "@/components/chat/MessageBody";
import { uploadFile } from "@/lib/upload";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { cn } from "@/lib/cn";
import { BrandImg } from "@/components/BrandImg";
import { useConfig } from "@/lib/config";
import { useAuth } from "@/lib/auth";
import { useVoice } from "@/lib/VoiceProvider";
import { useToast } from "@/components/ui/Toast";
import {
  fetchConversations,
  fetchThread,
  sendDM,
  deleteDmMessage,
  deleteDmMany,
  clearDmConversation,
  removeDmConversationApi,
  setDmBlocked,
  reportDmUser,
  reactDm,
  starDm,
  pinDm,
  editDm,
  adminEditDm,
  adminDeleteDm,
  clockFromIso,
  type DMConversation,
  type DMPeer,
  type DMessage,
  type SendDMOptions,
} from "@/lib/messages";
import type { AppConfig } from "@/lib/config";

export default function MessagesPage() {
  const params = useSearchParams();
  const toParam = params?.get("to") ?? null;

  const [conversations, setConversations] = useState<DMConversation[]>([]);
  const [activePeer, setActivePeer] = useState<DMPeer | null>(null);
  const [thread, setThread] = useState<DMessage[]>([]);
  const [block, setBlock] = useState<{ iBlocked: boolean; blockedMe: boolean }>({ iBlocked: false, blockedMe: false });
  const [query, setQuery] = useState("");

  const loadConversations = () => fetchConversations().then(setConversations);
  useEffect(() => { loadConversations(); }, []);
  // Keep the conversation list fresh (new messages, unread counts).
  useEffect(() => {
    const t = setInterval(loadConversations, 6000);
    return () => clearInterval(t);
  }, []);

  // Open a chat from a "Message" link (?to=username) on first load.
  useEffect(() => {
    if (!toParam) return;
    fetchThread(toParam).then(({ peer, messages, iBlocked, blockedMe }) => {
      if (peer) { setActivePeer(peer); setThread(messages); setBlock({ iBlocked, blockedMe }); }
    });
  }, [toParam]);

  // Poll the open thread for new messages + live block state.
  useEffect(() => {
    if (!activePeer) return;
    let on = true;
    const load = () => fetchThread(activePeer.id).then(({ messages, iBlocked, blockedMe }) => { if (on) { setThread(messages); setBlock({ iBlocked, blockedMe }); } });
    const t = setInterval(load, 4000);
    return () => { on = false; clearInterval(t); };
  }, [activePeer]);

  const openChat = async (peer: DMPeer) => {
    setActivePeer(peer);
    const { messages, iBlocked, blockedMe } = await fetchThread(peer.id);
    setThread(messages);
    setBlock({ iBlocked, blockedMe });
    loadConversations();
  };

  const { config } = useConfig();
  const { toast } = useToast();
  const allowEveryone = config.chat?.deleteForEveryone !== false;

  const send = async (text: string, opts: SendDMOptions = {}) => {
    const body = text.trim();
    // An attachment can be sent with no caption; a plain message still needs text.
    if ((!body && !opts.mediaUrl) || !activePeer) return;
    const tmpId = `tmp_${Date.now()}`;
    // Optimistic append so the bubble appears instantly.
    setThread((m) => [...m, {
      id: tmpId, fromMe: true, text: body, at: new Date().toISOString(),
      type: opts.type ?? "text", mediaUrl: opts.mediaUrl, mediaName: opts.mediaName,
      mediaSize: opts.mediaSize, duration: opts.duration,
    }]);
    const res = await sendDM(activePeer.id, body, opts);
    if (!res.ok) {
      // Blocked (e.g. the 4-unanswered-message limit, or a block) — remove the
      // optimistic bubble and show the server's message as a popup.
      setThread((m) => m.filter((x) => x.id !== tmpId));
      toast(res.error ?? "Could not send the message.", "error");
      return;
    }
    const { messages } = await fetchThread(activePeer.id);
    setThread(messages);
    loadConversations();
  };

  // ---- Management actions (block / report / remove conversation) ----
  const toggleBlock = async () => {
    if (!activePeer) return;
    const next = !block.iBlocked;
    const okB = await setDmBlocked(activePeer.id, next);
    if (okB) { setBlock((b) => ({ ...b, iBlocked: next })); toast(next ? "User blocked" : "User unblocked", "info"); }
    else toast("Could not update", "error");
  };
  const reportUser = async (detail: string) => {
    if (!activePeer) return;
    const okR = await reportDmUser(activePeer.id, detail);
    toast(okR ? "Report sent to the admins. Thank you." : "Could not send the report", okR ? "success" : "error");
  };
  const removeConversation = async () => {
    if (!activePeer) return;
    const okR = await removeDmConversationApi(activePeer.id);
    if (okR) { setActivePeer(null); setThread([]); toast("Conversation removed", "info"); loadConversations(); }
  };
  const deleteSelected = async (ids: string[]) => {
    if (!activePeer || ids.length === 0) return;
    const okD = await deleteDmMany(activePeer.id, ids);
    if (okD) { const { messages } = await fetchThread(activePeer.id); setThread(messages); toast(`${ids.length} message${ids.length === 1 ? "" : "s"} deleted`, "info"); }
    else toast("Could not delete", "error");
  };

  const deleteMessage = async (msgId: string, forEveryone: boolean) => {
    if (!activePeer) return;
    const okDel = await deleteDmMessage(activePeer.id, msgId, forEveryone);
    if (okDel) {
      const { messages } = await fetchThread(activePeer.id);
      setThread(messages);
      toast(forEveryone ? "Message deleted for everyone" : "Message deleted", "info");
    } else {
      toast("Couldn't delete that message", "error");
    }
  };

  const clearChat = async () => {
    if (!activePeer) return;
    const okClear = await clearDmConversation(activePeer.id);
    if (okClear) { setThread([]); toast("Conversation cleared", "info"); loadConversations(); }
  };

  // Re-fetch the open thread immediately after a message-management action (react /
  // star / pin / edit) so the change shows without waiting for the 4s poll.
  const reloadThread = async () => {
    if (!activePeer) return;
    const { messages } = await fetchThread(activePeer.id);
    setThread(messages);
  };

  const filtered = useMemo(
    () => conversations.filter((c) => c.peer.fullName.toLowerCase().includes(query.trim().toLowerCase())),
    [conversations, query],
  );

  return (
    <div className="mx-auto max-w-5xl">
      {/* On a phone the page title is dead weight once you're reading a thread —
          the conversation header already says who you're talking to. Hiding it
          hands those pixels to the messages instead. */}
      <h1 className={cn("mb-4 font-display text-3xl font-extrabold text-mist-100", activePeer && "hidden lg:block")}>Messages</h1>

      {/* Height uses dvh (the visible viewport, excluding mobile browser chrome) and
          leaves room on mobile for the fixed bottom nav (pb-20) + page header, so the
          message composer at the bottom is never pushed off-screen. Desktop has no
          bottom nav, so it can use more height. */}
      <div className={cn(
        "grid min-h-[340px] overflow-hidden rounded-2xl border border-white/10 bg-ink-850/50 lg:h-[calc(100dvh-210px)] lg:grid-cols-[330px_1fr]",
        activePeer ? "h-[calc(100dvh-248px)]" : "h-[calc(100dvh-300px)]",
      )}>
        {/* Conversation list */}
        <aside className={cn("flex min-h-0 flex-col border-r border-white/10", activePeer ? "hidden lg:flex" : "flex")}>
          <div className="p-3">
            <div className="flex items-center gap-2 rounded-xl border border-line bg-ink-800 px-3">
              <Search className="size-4 text-mist-400" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search chats"
                className="h-10 w-full bg-transparent text-sm text-mist-100 outline-none placeholder:text-mist-500"
              />
            </div>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto">
            {filtered.map((c) => (
              <button
                key={c.peer.id}
                onClick={() => openChat(c.peer)}
                className={cn(
                  "flex w-full items-center gap-3 px-3 py-3 text-left transition hover:bg-white/[0.04]",
                  c.peer.id === activePeer?.id && "bg-white/[0.06]",
                )}
              >
                <span className={c.peer.status === "online" ? "" : "opacity-50"}>
                  <Avatar name={c.peer.fullName} src={c.peer.avatar} size="md" status={c.peer.status as never} />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <span className={`truncate text-sm font-semibold text-mist-100 ${c.peer.status === "online" ? "" : "opacity-70"}`}>{c.peer.fullName}</span>
                    <span className="shrink-0 text-[10px] text-mist-500">{clockFromIso(c.lastAt)}</span>
                  </div>
                  <p className="truncate text-xs text-mist-400">
                    {/* ID number beside the name — two members can share a display name. */}
                    {c.peer.publicId && <span className="mr-1.5 font-mono text-[11px] text-mist-500">ID {c.peer.publicId}</span>}
                    {c.fromMe ? "You: " : ""}
                    {c.lastText}
                  </p>
                </div>
                {c.unread > 0 && (
                  <span className="grid size-5 shrink-0 place-items-center rounded-full bg-lotus-500 text-[10px] font-bold text-white">
                    {c.unread}
                  </span>
                )}
              </button>
            ))}
            {filtered.length === 0 && (
              <p className="px-4 py-8 text-center text-sm text-mist-400">
                No chats yet. Open a friend&apos;s profile and tap <span className="text-mist-200">Message</span> to start.
              </p>
            )}
          </div>
        </aside>

        {/* Thread */}
        <section className={cn("min-h-0 flex-col", activePeer ? "flex" : "hidden lg:flex")}>
          {activePeer ? (
            <Thread
              key={activePeer.id}
              peer={activePeer}
              messages={thread}
              block={block}
              onBack={() => setActivePeer(null)}
              onSend={send}
              onDelete={deleteMessage}
              onDeleteMany={deleteSelected}
              onClear={clearChat}
              onRemoveConversation={removeConversation}
              onToggleBlock={toggleBlock}
              onReport={reportUser}
              allowEveryone={allowEveryone}
              onRefresh={reloadThread}
              conversations={conversations}
              msgCfg={config.messaging ?? {}}
            />
          ) : (
            <div className="grid h-full place-items-center p-6 text-center">
              <div>
                <BrandImg slot="emptyMessages" className="mx-auto w-28 animate-float drop-shadow-xl" />
                <p className="mt-4 font-semibold text-mist-200">Select a chat to start messaging</p>
                <p className="mt-1 text-sm text-mist-400">Pick a friend from the list to say hello.</p>
              </div>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

function Thread({
  peer,
  messages,
  block,
  onBack,
  onSend,
  onDelete,
  onDeleteMany,
  onClear,
  onRemoveConversation,
  onToggleBlock,
  onReport,
  allowEveryone,
  onRefresh,
  conversations,
  msgCfg,
}: {
  peer: DMPeer;
  messages: DMessage[];
  block: { iBlocked: boolean; blockedMe: boolean };
  onBack: () => void;
  onSend: (text: string, opts?: SendDMOptions) => void;
  onDelete: (msgId: string, forEveryone: boolean) => void;
  onDeleteMany: (ids: string[]) => void;
  onClear: () => void;
  onRemoveConversation: () => void;
  onToggleBlock: () => void;
  onReport: (detail: string) => void;
  allowEveryone: boolean;
  onRefresh: () => void;
  conversations: DMConversation[];
  msgCfg: NonNullable<AppConfig["messaging"]>;
}) {
  const [text, setText] = useState("");
  const [menuFor, setMenuFor] = useState<string | null>(null);
  // Message-management UI state (v395)
  const [showSearch, setShowSearch] = useState(false);
  const [msgSearch, setMsgSearch] = useState("");
  const [starredOnly, setStarredOnly] = useState(false);
  const [editing, setEditing] = useState<{ id: string; text: string; admin?: boolean } | null>(null);
  const [forwardMsg, setForwardMsg] = useState<DMessage | null>(null);
  const allowForward = msgCfg.allowForward !== false;
  const allowCopy = msgCfg.allowCopy !== false;
  const allowDownload = msgCfg.allowDownload !== false;
  const editWindowMin = msgCfg.editWindowMin ?? 15;
  const QUICK_REACTIONS = ["👍", "❤️", "😂", "😮", "😢", "🙏"];
  const [confirmClear, setConfirmClear] = useState(false);
  const [chatMenu, setChatMenu] = useState(false);          // header 3-dot menu
  const [selecting, setSelecting] = useState(false);        // multi-select mode
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [confirmRemove, setConfirmRemove] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [reportText, setReportText] = useState("");
  const blocked = block.iBlocked || block.blockedMe; // composer disabled either way
  const toggleSelect = (id: string) => setSelected((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const exitSelect = () => { setSelecting(false); setSelected(new Set()); };
  // Rich-media composer state
  const [showEmoji, setShowEmoji] = useState(false);
  const [showAttach, setShowAttach] = useState(false);
  const [recording, setRecording] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [replyTo, setReplyTo] = useState<DMessage | null>(null);
  const [lightbox, setLightbox] = useState("");
  const { toast } = useToast();
  const peerName = peer.fullName;
  const scrollRef = useRef<HTMLDivElement>(null);
  // Only follow new messages when the reader is already at the bottom — a reader who
  // scrolled up to read history is left in place instead of being yanked down.
  const stickToBottom = useRef(true);
  const onDmScroll = () => {
    const el = scrollRef.current;
    if (el) stickToBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
  };
  // While a voice room is minimised, its floating dock sits at the bottom of the
  // screen. Lift the message composer above it so the Send button and the dock's
  // Leave button can't be tapped by mistake (client: too close together).
  const inVoiceRoom = !!useVoice().roomId;

  useEffect(() => {
    if (stickToBottom.current) scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  const submit = () => {
    stickToBottom.current = true; // my own send always follows to the latest
    onSend(text, replyTo ? { replyToId: replyTo.id } : undefined);
    setText("");
    setReplyTo(null);
    setShowEmoji(false);
  };

  /** Upload a file, then send it as a message. The caption in the box (if any)
   *  travels with it, exactly like other messaging apps. */
  const sendAttachment = async (file: File, type: "image" | "video" | "file" | "audio", seconds?: number) => {
    setUploading(true);
    const res = await uploadFile(file, `chat${type}`);
    setUploading(false);
    if (!res.ok || !res.file?.url) {
      toast(res.error ?? "Could not send that file", "error");
      return;
    }
    onSend(text, {
      type,
      mediaUrl: res.file.url,
      mediaName: res.file.originalName ?? file.name,
      mediaMime: file.type,
      mediaSize: file.size,
      ...(seconds ? { duration: seconds } : {}),
      ...(replyTo ? { replyToId: replyTo.id } : {}),
    });
    setText("");
    setReplyTo(null);
  };

  // ---- Who may edit / delete what (Admin → Messaging Controls) --------------
  // Four independent ON/OFF switches, plus a per-user override the admin can set
  // for one account. `editing.admin` remembers that a save must go through the
  // administrator route (which has no time window and works on any sender).
  const { user: meUser } = useAuth();
  const iAmAdmin = meUser?.role === "admin";
  const myPerms = (meUser?.id && msgCfg.perUser?.[meUser.id]) || {};
  const iMayEdit = myPerms.edit ?? msgCfg.userEdit !== false;
  const iMayDelete = myPerms.delete ?? msgCfg.userDelete !== false;
  const adminMayEdit = iAmAdmin && msgCfg.adminEditAny !== false;
  const adminMayDelete = iAmAdmin && msgCfg.adminDeleteAny !== false;

  // ---- Message management actions (v395) ----
  const doReact = async (m: DMessage, emoji: string) => { setMenuFor(null); await reactDm(peer.id, m.id, emoji); onRefresh(); };
  const doStar = async (m: DMessage) => { setMenuFor(null); await starDm(peer.id, m.id); onRefresh(); };
  const doPin = async (m: DMessage) => { setMenuFor(null); await pinDm(peer.id, m.id); onRefresh(); };
  const doCopy = async (m: DMessage) => { setMenuFor(null); try { await navigator.clipboard.writeText(m.text || ""); toast("Copied", "success"); } catch { toast("Couldn't copy", "error"); } };
  const startEdit = (m: DMessage, asAdmin = false) => { setMenuFor(null); setEditing({ id: m.id, text: m.text || "", admin: asAdmin }); };
  const saveEdit = async () => {
    if (!editing) return;
    const r = editing.admin
      ? await adminEditDm(peer.id, editing.id, editing.text.trim())
      : await editDm(peer.id, editing.id, editing.text.trim());
    if (r.ok) { setEditing(null); onRefresh(); toast(editing.admin ? "Message edited (admin)" : "Message edited", "success"); }
    else toast(r.error ?? "Couldn't edit", "error");
  };
  const withinEditWindow = (m: DMessage) => editWindowMin > 0 && Date.now() - new Date(m.at).getTime() <= editWindowMin * 60_000;
  const isTextMsg = (m: DMessage) => !m.type || m.type === "text";
  // My OWN message: allowed only while the admin's edit switch is on for me and
  // the edit window hasn't closed.
  const canEdit = (m: DMessage) => m.fromMe && !m.deleted && isTextMsg(m) && iMayEdit && withinEditWindow(m);
  // ANY message (including the other person's): admins only, no time window.
  const canAdminEdit = (m: DMessage) => adminMayEdit && !m.deleted && isTextMsg(m);
  const canAdminDelete = (m: DMessage) => adminMayDelete && !m.deleted;
  const doAdminDelete = async (m: DMessage) => {
    setMenuFor(null);
    const r = await adminDeleteDm(peer.id, m.id);
    if (r.ok) { onRefresh(); toast("Message deleted for both people (admin)", "success"); }
    else toast(r.error ?? "Couldn't delete", "error");
  };
  const doForward = async (targetId: string) => {
    const m = forwardMsg;
    if (!m) return;
    setForwardMsg(null);
    const r = await sendDM(targetId, m.text || "", {
      forwarded: true,
      ...(m.type && m.type !== "text" ? { type: m.type, mediaUrl: m.mediaUrl, mediaName: m.mediaName, mediaMime: m.mediaMime, mediaSize: m.mediaSize, duration: m.duration } : {}),
    });
    toast(r.ok ? "Message forwarded" : (r.error ?? "Couldn't forward"), r.ok ? "success" : "error");
  };

  // Filtered view: in-thread text search + "starred only" toggle.
  const shownMessages = useMemo(() => {
    let list = messages;
    if (starredOnly) list = list.filter((m) => m.starred);
    const q = msgSearch.trim().toLowerCase();
    if (q) list = list.filter((m) => (m.text || "").toLowerCase().includes(q));
    return list;
  }, [messages, starredOnly, msgSearch]);
  const pinnedMsgs = useMemo(() => messages.filter((m) => m.pinned && !m.deleted), [messages]);

  return (
    <div className="flex h-full min-h-0 flex-col" onClick={() => { setMenuFor(null); setChatMenu(false); }}>
      {selecting ? (
        // ---- Multi-select toolbar ----
        <div className="flex items-center gap-3 border-b border-white/10 p-3">
          <button onClick={exitSelect} className="text-mist-300 hover:text-mist-100" title="Cancel"><X className="size-5" /></button>
          <span className="flex-1 text-sm font-semibold text-mist-100">{selected.size} selected</span>
          <button
            onClick={(e) => { e.stopPropagation(); if (selected.size) { onDeleteMany([...selected]); exitSelect(); } }}
            disabled={selected.size === 0}
            className="inline-flex items-center gap-1.5 rounded-lg bg-rose-500/15 px-3 py-1.5 text-xs font-semibold text-rose-300 transition hover:bg-rose-500/25 disabled:opacity-40"
          >
            <Trash2 className="size-4" /> Delete selected
          </button>
        </div>
      ) : (
        <div className="flex items-center gap-3 border-b border-white/10 p-3">
          <button onClick={onBack} className="text-mist-300 hover:text-mist-100 lg:hidden">
            <ArrowLeft className="size-5" />
          </button>
          <Avatar name={peer.fullName} src={peer.avatar} size="md" status={peer.status as never} />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-mist-100">{peer.fullName}</p>
            <p className="text-xs capitalize text-mist-400">
              {peer.publicId && <span className="mr-1.5 font-mono text-[11px] normal-case text-mist-500">ID {peer.publicId}</span>}
              {block.iBlocked ? "Blocked" : peer.status === "online" ? "online" : "offline"}
            </p>
          </div>
          {/* Starred-only filter */}
          <button onClick={(e) => { e.stopPropagation(); setStarredOnly((v) => !v); }} title="Starred messages" className={cn("grid size-9 shrink-0 place-items-center rounded-lg transition hover:bg-white/[0.06]", starredOnly ? "text-gold-300" : "text-mist-400 hover:text-mist-100")}>
            <Star className={cn("size-5", starredOnly && "fill-gold-300")} />
          </button>
          {/* In-thread search */}
          <button onClick={(e) => { e.stopPropagation(); setShowSearch((v) => !v); if (showSearch) setMsgSearch(""); }} title="Search in this chat" className={cn("grid size-9 shrink-0 place-items-center rounded-lg transition hover:bg-white/[0.06]", showSearch ? "text-lotus-300" : "text-mist-400 hover:text-mist-100")}>
            <Search className="size-5" />
          </button>
          {/* ---- Chat options 3-dot menu ---- */}
          <div className="relative">
            <button onClick={(e) => { e.stopPropagation(); setChatMenu((v) => !v); }} title="Chat options" className="grid size-9 shrink-0 place-items-center rounded-lg text-mist-400 transition hover:bg-white/[0.06] hover:text-mist-100">
              <MoreVertical className="size-5" />
            </button>
            {chatMenu && (
              <div className="absolute right-0 z-30 mt-1 w-52 overflow-hidden rounded-xl border border-white/10 bg-ink-850 py-1 shadow-2xl" onClick={(e) => e.stopPropagation()}>
                <MenuItem icon={CheckSquare} label="Select messages" onClick={() => { setChatMenu(false); setSelecting(true); }} disabled={messages.length === 0} />
                <MenuItem icon={Trash2} label="Clear chat" onClick={() => { setChatMenu(false); setConfirmClear(true); }} disabled={messages.length === 0} />
                <MenuItem icon={MessageSquareX} label="Remove conversation" onClick={() => { setChatMenu(false); setConfirmRemove(true); }} />
                <div className="my-1 border-t border-white/10" />
                {block.iBlocked
                  ? <MenuItem icon={ShieldOff} label="Unblock user" onClick={() => { setChatMenu(false); onToggleBlock(); }} />
                  : <MenuItem icon={Ban} label="Block user" danger onClick={() => { setChatMenu(false); onToggleBlock(); }} />}
                <MenuItem icon={Flag} label="Report user" danger onClick={() => { setChatMenu(false); setReportOpen(true); }} />
              </div>
            )}
          </div>
        </div>
      )}

      {/* Block banner */}
      {blocked && (
        <div className="flex items-center gap-2 border-b border-rose-500/20 bg-rose-500/[0.06] px-4 py-2 text-xs text-rose-200">
          <Ban className="size-3.5 shrink-0" />
          {block.iBlocked
            ? <span>You blocked {peer.fullName.split(" ")[0]}. <button onClick={onToggleBlock} className="font-semibold underline">Unblock</button> to message again.</span>
            : <span>You can&apos;t message {peer.fullName.split(" ")[0]} right now.</span>}
        </div>
      )}

      {/* In-thread search bar */}
      {showSearch && (
        <div className="flex items-center gap-2 border-b border-white/10 bg-ink-900/40 px-3 py-2">
          <Search className="size-4 text-mist-500" />
          <input autoFocus value={msgSearch} onChange={(e) => setMsgSearch(e.target.value)} placeholder="Search this conversation…" className="h-8 w-full bg-transparent text-sm text-mist-100 outline-none placeholder:text-mist-500" />
          <button onClick={() => { setShowSearch(false); setMsgSearch(""); }} className="text-mist-400 hover:text-mist-100"><X className="size-4" /></button>
        </div>
      )}
      {/* Pinned banner */}
      {pinnedMsgs.length > 0 && !starredOnly && (
        <div className="flex items-center gap-2 border-b border-white/10 bg-lotus-500/[0.06] px-3 py-1.5 text-xs text-mist-300">
          <Pin className="size-3.5 shrink-0 text-lotus-300" />
          <span className="truncate"><b className="text-mist-200">Pinned:</b> {pinnedMsgs[pinnedMsgs.length - 1].text || mediaLabel(pinnedMsgs[pinnedMsgs.length - 1].type)}</span>
          {pinnedMsgs.length > 1 && <span className="ml-auto shrink-0 rounded-full bg-lotus-500/20 px-1.5 text-[10px] font-bold text-lotus-200">{pinnedMsgs.length}</span>}
        </div>
      )}

      <div ref={scrollRef} onScroll={onDmScroll} className="min-h-0 flex-1 space-y-2 overflow-y-auto p-4">
        {messages.length === 0 && (
          <p className="py-8 text-center text-sm text-mist-500">
            No messages yet — say hi to {peer.fullName.split(" ")[0]}! 👋
          </p>
        )}
        {messages.length > 0 && shownMessages.length === 0 && (
          <p className="py-8 text-center text-sm text-mist-500">{starredOnly ? "No starred messages yet." : "No messages match your search."}</p>
        )}
        {shownMessages.map((m) => {
          const isSel = selected.has(m.id);
          return (
          <div
            key={m.id}
            className={cn("group flex items-center gap-1.5", m.fromMe ? "flex-row-reverse" : "flex-row", selecting && "cursor-pointer", selecting && isSel && "rounded-lg bg-lotus-500/10")}
            onClick={selecting ? (e) => { e.stopPropagation(); toggleSelect(m.id); } : undefined}
          >
            {/* Selection checkbox (multi-select mode) */}
            {selecting && (
              <span className={cn("grid size-5 shrink-0 place-items-center rounded-md border", isSel ? "border-lotus-400 bg-lotus-500 text-white" : "border-mist-500")}>
                {isSel && <Check className="size-3.5" />}
              </span>
            )}
            <div
              className={cn(
                "relative max-w-[75%] rounded-[var(--bubble-radius,1rem)] px-3.5 py-2 text-[length:var(--bubble-font,0.875rem)]",
                m.deleted
                  ? "bg-ink-800/60 italic text-mist-500"
                  : m.fromMe ? "rounded-br-md bg-lotus-600 text-white" : "rounded-bl-md bg-ink-800 text-mist-100",
              )}
            >
              {!m.deleted && m.forwarded && (
                <div className={cn("mb-0.5 flex items-center gap-1 text-[10px] italic", m.fromMe ? "text-white/60" : "text-mist-500")}><Forward className="size-3" /> Forwarded</div>
              )}
              {editing?.id === m.id ? (
                <div className="flex min-w-[200px] flex-col gap-1.5">
                  <textarea
                    autoFocus value={editing.text}
                    onChange={(e) => setEditing({ id: m.id, text: e.target.value, admin: editing.admin })}
                    onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); saveEdit(); } if (e.key === "Escape") setEditing(null); }}
                    rows={2}
                    className="w-full resize-none rounded-lg bg-black/25 px-2 py-1 text-sm text-white outline-none"
                  />
                  <div className="flex justify-end gap-3 text-[11px] font-semibold">
                    <button onClick={() => setEditing(null)} className="opacity-80 hover:opacity-100">Cancel</button>
                    <button onClick={saveEdit}>Save</button>
                  </div>
                </div>
              ) : m.deleted
                ? <p className="whitespace-pre-wrap break-words">🚫 This message was deleted</p>
                : <MessageBody m={m} onOpenImage={setLightbox} allowDownload={allowDownload} />}
              <span
                className={cn(
                  "mt-0.5 flex items-center justify-end gap-1 text-[10px]",
                  m.fromMe && !m.deleted ? "text-white/70" : "text-mist-500",
                )}
              >
                {m.starred && <Star className="size-3 fill-gold-300 text-gold-300" aria-label="Starred" />}
                {m.pinned && <Pin className="size-3" aria-label="Pinned" />}
                {m.editedAt && !m.deleted && <span className="italic opacity-70">edited</span>}
                {clockFromIso(m.at)}
                {/* Delivery status (WhatsApp-style), only on MY messages:
                    · sent (on server, recipient offline) → single grey ✓
                    · delivered (recipient came online) → double grey ✓✓
                    · read (recipient opened the chat) → double COLOUR ✓✓ */}
                {m.fromMe && !m.deleted && (
                  m.read ? (
                    <CheckCheck className="size-3.5 text-sky-300" aria-label="Read" />
                  ) : m.delivered ? (
                    <CheckCheck className="size-3.5" aria-label="Delivered" />
                  ) : (
                    <Check className="size-3.5" aria-label="Sent" />
                  )
                )}
              </span>
              {/* Reaction chips */}
              {!m.deleted && m.reactions && m.reactions.length > 0 && (
                <div className={cn("absolute -bottom-2.5 flex", m.fromMe ? "right-1" : "left-1")}>
                  <span className="flex items-center gap-1 rounded-full border border-white/10 bg-ink-850 px-1.5 py-0.5 text-[11px] leading-none shadow">
                    {groupReactions(m.reactions).map(([e, c]) => (
                      <span key={e}>{e}{c > 1 ? <span className="ml-0.5 text-[9px] text-mist-400">{c}</span> : null}</span>
                    ))}
                  </span>
                </div>
              )}
            </div>
            {/* Per-message options menu (hidden while multi-selecting) */}
            {!selecting && !m.deleted && !m.id.startsWith("tmp_") && (
              <div className="relative">
                <button
                  onClick={(e) => { e.stopPropagation(); setMenuFor((cur) => (cur === m.id ? null : m.id)); }}
                  className="grid size-7 place-items-center rounded-full text-mist-500 opacity-60 transition hover:bg-white/[0.06] hover:text-mist-200 group-hover:opacity-100"
                  title="Message options"
                >
                  <MoreVertical className="size-4" />
                </button>
                {menuFor === m.id && (
                  <div className={cn("absolute z-20 mt-1 w-56 overflow-hidden rounded-xl border border-white/10 bg-ink-850 py-1 shadow-xl", m.fromMe ? "right-0" : "left-0")} onClick={(e) => e.stopPropagation()}>
                    {/* Quick reactions */}
                    <div className="flex items-center justify-between px-2 py-1.5">
                      {QUICK_REACTIONS.map((e) => (
                        <button key={e} onClick={() => doReact(m, e)} className={cn("grid size-7 place-items-center rounded-full text-base transition hover:bg-white/[0.08]", m.myReaction === e && "bg-lotus-500/20")}>{e}</button>
                      ))}
                    </div>
                    <div className="my-1 border-t border-white/10" />
                    <button onClick={() => { setMenuFor(null); setReplyTo(m); }} className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-mist-200 hover:bg-white/[0.05]">
                      <CornerUpLeft className="size-3.5" /> Reply
                    </button>
                    {allowForward && (
                      <button onClick={() => { setMenuFor(null); setForwardMsg(m); }} className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-mist-200 hover:bg-white/[0.05]">
                        <Forward className="size-3.5" /> Forward
                      </button>
                    )}
                    {allowCopy && m.text && (
                      <button onClick={() => doCopy(m)} className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-mist-200 hover:bg-white/[0.05]">
                        <Copy className="size-3.5" /> Copy
                      </button>
                    )}
                    <button onClick={() => doStar(m)} className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-mist-200 hover:bg-white/[0.05]">
                      <Star className={cn("size-3.5", m.starred && "fill-gold-300 text-gold-300")} /> {m.starred ? "Unstar" : "Star"}
                    </button>
                    <button onClick={() => doPin(m)} className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-mist-200 hover:bg-white/[0.05]">
                      <Pin className="size-3.5" /> {m.pinned ? "Unpin" : "Pin"}
                    </button>
                    {canEdit(m) && (
                      <button onClick={() => startEdit(m)} className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-mist-200 hover:bg-white/[0.05]">
                        <Pencil className="size-3.5" /> Edit
                      </button>
                    )}
                    <div className="my-1 border-t border-white/10" />
                    <button onClick={() => { setMenuFor(null); onDelete(m.id, false); }} className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-mist-200 hover:bg-white/[0.05]">
                      <Trash2 className="size-3.5" /> Delete for me
                    </button>
                    {m.fromMe && allowEveryone && iMayDelete && (
                      <button onClick={() => { setMenuFor(null); onDelete(m.id, true); }} className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-rose-300 hover:bg-rose-500/10">
                        <Trash2 className="size-3.5" /> Delete for everyone
                      </button>
                    )}
                    {/* ---- ADMINISTRATOR CONTROLS -------------------------------
                        Full control over ANY message in this chat — the other
                        person's included. Each power is switchable from
                        Admin → Messaging Controls and is written to the admin log. */}
                    {iAmAdmin && (canAdminEdit(m) || canAdminDelete(m)) && (
                      <>
                        <div className="my-1 border-t border-amber-400/25" />
                        <p className="px-3 pb-0.5 pt-1 text-[10px] font-semibold uppercase tracking-wide text-amber-300/80">Admin controls</p>
                        {canAdminEdit(m) && (
                          <button onClick={() => startEdit(m, true)} className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-amber-200 hover:bg-amber-500/10">
                            <Pencil className="size-3.5" /> Edit this message{m.fromMe ? "" : ` (${peerName.split(" ")[0]}'s)`}
                          </button>
                        )}
                        {canAdminDelete(m) && (
                          <button onClick={() => doAdminDelete(m)} className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-rose-300 hover:bg-rose-500/10">
                            <Trash2 className="size-3.5" /> Delete this message for both
                          </button>
                        )}
                      </>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
          );
        })}
      </div>

      {confirmClear && (
        <ConfirmDialog
          danger
          title="Clear this chat?"
          message="This removes all messages in this conversation from your side. The other person keeps their copy."
          confirmLabel="Clear chat"
          cancelLabel="Cancel"
          onConfirm={() => { setConfirmClear(false); onClear(); }}
          onCancel={() => setConfirmClear(false)}
        />
      )}

      {confirmRemove && (
        <ConfirmDialog
          danger
          title="Remove this conversation?"
          message="This removes the chat from your message list. It comes back if this person messages you again."
          confirmLabel="Remove"
          cancelLabel="Cancel"
          onConfirm={() => { setConfirmRemove(false); onRemoveConversation(); }}
          onCancel={() => setConfirmRemove(false)}
        />
      )}

      {/* Report user modal */}
      {reportOpen && (
        <div className="fixed inset-0 z-[200] grid place-items-center bg-black/70 p-4" onClick={() => setReportOpen(false)}>
          <div className="w-full max-w-sm rounded-2xl border border-white/10 bg-ink-900 p-4" onClick={(e) => e.stopPropagation()}>
            <h3 className="flex items-center gap-2 font-semibold text-mist-100"><Flag className="size-4 text-rose-300" /> Report {peer.fullName.split(" ")[0]}</h3>
            <p className="mt-1 text-xs text-mist-400">Tell the admins what&apos;s wrong. Your report is private and reviewed by the team.</p>
            <textarea
              value={reportText}
              onChange={(e) => setReportText(e.target.value)}
              rows={3}
              maxLength={300}
              placeholder="Reason (e.g. spam, abuse, harassment)…"
              className="mt-3 w-full resize-none rounded-lg border border-line bg-ink-800 px-3 py-2 text-sm text-mist-100 outline-none focus:border-lotus-400"
            />
            <div className="mt-3 flex justify-end gap-2">
              <button onClick={() => setReportOpen(false)} className="rounded-lg border border-line px-3 py-1.5 text-xs font-semibold text-mist-300 hover:bg-white/[0.06]">Cancel</button>
              <button
                onClick={() => { if (reportText.trim()) { onReport(reportText.trim()); setReportText(""); setReportOpen(false); } }}
                disabled={!reportText.trim()}
                className="rounded-lg bg-rose-500 px-3 py-1.5 text-xs font-bold text-white transition hover:bg-rose-400 disabled:opacity-50"
              >
                Send report
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Forward to… picker */}
      {forwardMsg && (
        <div className="fixed inset-0 z-[200] grid place-items-center bg-black/70 p-4" onClick={() => setForwardMsg(null)}>
          <div className="flex max-h-[70vh] w-full max-w-sm flex-col overflow-hidden rounded-2xl border border-white/10 bg-ink-900" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between gap-2 border-b border-white/10 p-3">
              <h3 className="flex items-center gap-2 font-semibold text-mist-100"><Forward className="size-4 text-lotus-300" /> Forward to…</h3>
              <button onClick={() => setForwardMsg(null)} className="text-mist-400 hover:text-mist-100"><X className="size-5" /></button>
            </div>
            <div className="mb-1 border-b border-white/10 bg-ink-850/60 px-3 py-1.5 text-[11px] text-mist-400 truncate">
              {forwardMsg.text || mediaLabel(forwardMsg.type)}
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto p-1.5">
              {conversations.filter((c) => c.peer.id !== peer.id).length === 0 ? (
                <p className="p-6 text-center text-sm text-mist-500">No other chats to forward to yet.</p>
              ) : conversations.filter((c) => c.peer.id !== peer.id).map((c) => (
                <button key={c.peer.id} onClick={() => doForward(c.peer.id)} className="flex w-full items-center gap-2.5 rounded-lg px-2 py-2 text-left hover:bg-white/[0.05]">
                  <Avatar name={c.peer.fullName} src={c.peer.avatar} size="sm" />
                  <span className="truncate text-sm text-mist-100">{c.peer.fullName}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      <div className={cn("border-t border-white/10 p-3 transition-[margin]", inVoiceRoom && "mb-[68px]")}>
        {/* Replying to… */}
        {replyTo && (
          <div className="mb-2 flex items-start gap-2 rounded-lg border-l-2 border-lotus-400 bg-ink-800 px-2.5 py-1.5">
            <CornerUpLeft className="mt-0.5 size-3.5 shrink-0 text-lotus-300" />
            <div className="min-w-0 flex-1">
              <div className="text-[11px] font-bold text-lotus-300">Replying to {replyTo.fromMe ? "yourself" : peerName}</div>
              <div className="truncate text-[11px] text-mist-400">{replyTo.text || mediaLabel(replyTo.type)}</div>
            </div>
            <button onClick={() => setReplyTo(null)} className="shrink-0 text-mist-400 hover:text-mist-100" title="Cancel reply"><X className="size-4" /></button>
          </div>
        )}

        {/* Upload progress */}
        {uploading && (
          <div className="mb-2 flex items-center gap-2 rounded-lg bg-ink-800 px-3 py-2 text-xs text-mist-300">
            <span className="size-3.5 animate-spin rounded-full border-2 border-lotus-500/30 border-t-lotus-400" />
            Sending attachment…
          </div>
        )}

        {blocked ? (
          <div className="rounded-xl border border-line bg-ink-800/60 px-4 py-3 text-center text-xs text-mist-400">
            {block.iBlocked
              ? <>You blocked this user. <button onClick={onToggleBlock} className="font-semibold text-lotus-300 underline">Unblock</button> to send messages.</>
              : "You can't send messages to this user."}
          </div>
        ) : recording ? (
          <VoiceRecorder
            onSend={(file, seconds) => { setRecording(false); void sendAttachment(file, "audio", seconds); }}
            onCancel={() => setRecording(false)}
          />
        ) : (
          <div className="relative flex items-center gap-1.5">
            {showEmoji && <EmojiPicker onPick={(e) => setText((t) => t + e)} onClose={() => setShowEmoji(false)} />}

            {/* Emoji */}
            <button
              onClick={() => setShowEmoji((v) => !v)}
              title="Emoji"
              className={cn("grid size-9 shrink-0 place-items-center rounded-lg transition hover:bg-white/[0.06]", showEmoji ? "text-lotus-300" : "text-mist-400 hover:text-mist-100")}
            >
              <Smile className="size-5" />
            </button>

            {/* Attach — photo / video / GIF / document */}
            <div className="relative shrink-0">
              <button
                onClick={() => setShowAttach((v) => !v)}
                title="Attach"
                className={cn("grid size-9 place-items-center rounded-lg transition hover:bg-white/[0.06]", showAttach ? "text-lotus-300" : "text-mist-400 hover:text-mist-100")}
              >
                <Paperclip className="size-5" />
              </button>
              {showAttach && (
                <div className="absolute bottom-full left-0 z-30 mb-2 w-52 overflow-hidden rounded-xl border border-line bg-ink-850 py-1 shadow-2xl">
                  <AttachRow icon={ImageIcon} label="Photo or GIF" accept="image/*" onPick={(f) => sendAttachment(f, "image")} onDone={() => setShowAttach(false)} />
                  <AttachRow icon={Camera} label="Camera" accept="image/*" capture onPick={(f) => sendAttachment(f, "image")} onDone={() => setShowAttach(false)} />
                  <AttachRow icon={Video} label="Video" accept="video/*" onPick={(f) => sendAttachment(f, "video")} onDone={() => setShowAttach(false)} />
                  <AttachRow icon={FileText} label="Document" accept=".pdf,.doc,.docx,.xls,.xlsx,.txt" onPick={(f) => sendAttachment(f, "file")} onDone={() => setShowAttach(false)} />
                </div>
              )}
            </div>

            <input
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  submit();
                }
              }}
              placeholder="Type a message…"
              className="h-11 min-w-0 flex-1 rounded-full border border-line bg-ink-900 px-4 text-sm text-mist-100 outline-none placeholder:text-mist-500 focus:border-lotus-400"
            />

            {/* Send, or hold-free voice note when there's nothing typed */}
            {text.trim() ? (
              <button
                onClick={submit}
                className="grid size-10 shrink-0 place-items-center rounded-full bg-lotus-600 text-white transition-colors hover:bg-lotus-500"
              >
                <Send className="size-4" />
              </button>
            ) : (
              <button
                onClick={() => { setShowEmoji(false); setShowAttach(false); setRecording(true); }}
                title="Record a voice message"
                className="grid size-10 shrink-0 place-items-center rounded-full bg-lotus-600 text-white transition-colors hover:bg-lotus-500"
              >
                <Mic className="size-4" />
              </button>
            )}
          </div>
        )}
      </div>

      {/* Full-screen image viewer */}
      {lightbox && (
        <div className="fixed inset-0 z-[200] grid place-items-center bg-black/90 p-4" onClick={() => setLightbox("")}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={lightbox} alt="" className="max-h-full max-w-full rounded-lg object-contain" />
          <button onClick={() => setLightbox("")} className="absolute right-4 top-4 grid size-10 place-items-center rounded-full bg-white/10 text-white hover:bg-white/20"><X className="size-5" /></button>
        </div>
      )}
    </div>
  );
}

/** One row of the attach menu — a hidden file input behind a labelled button. */
function AttachRow({ icon: Icon, label, accept, capture, onPick, onDone }: {
  icon: typeof ImageIcon; label: string; accept: string; capture?: boolean;
  onPick: (f: File) => void; onDone: () => void;
}) {
  return (
    <label className="flex cursor-pointer items-center gap-2.5 px-3 py-2.5 text-sm text-mist-200 transition hover:bg-white/[0.05]">
      <Icon className="size-4 text-lotus-300" /> {label}
      <input
        type="file"
        accept={accept}
        {...(capture ? { capture: "environment" as const } : {})}
        className="hidden"
        onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; onDone(); if (f) onPick(f); }}
      />
    </label>
  );
}

/** One row of the chat-options 3-dot menu. */
function MenuItem({ icon: Icon, label, onClick, danger, disabled }: {
  icon: typeof Trash2; label: string; onClick: () => void; danger?: boolean; disabled?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm transition disabled:opacity-40",
        danger ? "text-rose-300 hover:bg-rose-500/10" : "text-mist-200 hover:bg-white/[0.05]",
      )}
    >
      <Icon className="size-4 shrink-0" /> {label}
    </button>
  );
}

/** Label for a media message with no caption. */
function mediaLabel(type?: string): string {
  return type === "image" ? "📷 Photo"
    : type === "video" ? "🎬 Video"
    : type === "audio" ? "🎤 Voice message"
    : type === "file" ? "📎 Document"
    : type === "sticker" ? "🌟 Sticker"
    : "Message";
}

/** Group a flat list of reaction emojis into [emoji, count] pairs for the chips. */
function groupReactions(list: string[]): [string, number][] {
  const counts = new Map<string, number>();
  for (const e of list) counts.set(e, (counts.get(e) ?? 0) + 1);
  return [...counts.entries()];
}
