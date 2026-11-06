"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type { AppNotification } from "./types";
import { NOTIFICATIONS } from "./mock-data";
import { withBase } from "./base-path";
import { IS_PROD_SITE } from "./prod";

// ============================================================
// Notifications — ONE shared source for the whole app so the bell
// badge, the sidebar badge and the Notifications page always agree.
// On the real site there's NO demo data — only the account's own.
// ============================================================

interface NotificationsValue {
  items: AppNotification[];
  unreadCount: number;
  markAllRead: () => void;
  markRead: (id: string) => void;
  dismiss: (id: string) => void;
  clearAll: () => void;
}

const NotificationsContext = createContext<NotificationsValue | null>(null);

export function NotificationsProvider({ children }: { children: React.ReactNode }) {
  // Real site → start empty (only the account's own notifications). Demo build
  // → start with the sample set so the showcase feels alive.
  const [items, setItems] = useState<AppNotification[]>(IS_PROD_SITE ? [] : NOTIFICATIONS);
  // Local overrides so a poll can't briefly "un-read" or resurrect something the
  // user just acted on (the server catches up on the next poll).
  const readIdsRef = useRef<Set<string>>(new Set());
  const dismissedIdsRef = useRef<Set<string>>(new Set());
  const applyLocal = useCallback((list: AppNotification[]) =>
    list
      .filter((n) => !dismissedIdsRef.current.has(n.id))
      .map((n) => (readIdsRef.current.has(n.id) ? { ...n, unread: false } : n)),
  []);

  const load = useCallback(async () => {
    try {
      const res = await fetch(withBase("/api/notifications"), { credentials: "include", cache: "no-store" });
      if (!res.ok) return;
      const json = await res.json();
      const real = (json.notifications as AppNotification[]) ?? [];
      const realIds = new Set(real.map((n) => n.id));
      // Drop stale local overrides for notifications the server no longer returns.
      readIdsRef.current = new Set([...readIdsRef.current].filter((id) => realIds.has(id)));
      dismissedIdsRef.current = new Set([...dismissedIdsRef.current].filter((id) => realIds.has(id)));
      if (IS_PROD_SITE) {
        setItems(applyLocal(real)); // real site: backend is the source of truth
      } else if (real.length) {
        setItems((prev) => applyLocal([...real, ...prev.filter((n) => !realIds.has(n.id))]));
      }
    } catch {
      /* ignore */
    }
  }, [applyLocal]);

  // POLL so notifications created AFTER the page loaded (tournament approvals,
  // gifts, join requests, admin broadcasts…) appear WITHOUT a manual reload — the
  // reported "users not receiving notifications" (the old code fetched once only).
  // Pauses while backgrounded to save data; refetches the moment the tab/app
  // regains focus so it's up to date the instant the user returns.
  useEffect(() => {
    load();
    const iv = setInterval(() => { if (typeof document === "undefined" || !document.hidden) load(); }, 20000);
    const onFocus = () => load();
    const onVis = () => { if (typeof document !== "undefined" && !document.hidden) load(); };
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVis);
    return () => {
      clearInterval(iv);
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [load]);

  const markAllRead = useCallback(() => {
    setItems((prev) => { prev.forEach((n) => readIdsRef.current.add(n.id)); return prev.map((n) => ({ ...n, unread: false })); });
    fetch(withBase("/api/notifications"), { method: "POST", credentials: "include" }).catch(() => {});
  }, []);

  const markRead = useCallback((id: string) => {
    readIdsRef.current.add(id);
    setItems((prev) => prev.map((n) => (n.id === id ? { ...n, unread: false } : n)));
    fetch(withBase("/api/notifications"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ id }),
    }).catch(() => {});
  }, []);

  // Remove a notification entirely (e.g. after a request is accepted/declined).
  const dismiss = useCallback((id: string) => {
    dismissedIdsRef.current.add(id);
    setItems((prev) => prev.filter((n) => n.id !== id));
    fetch(withBase("/api/notifications"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ id, dismiss: true }),
    }).catch(() => {});
  }, []);

  // Delete ALL of my notifications (clear the whole list).
  const clearAll = useCallback(() => {
    setItems((prev) => { prev.forEach((n) => dismissedIdsRef.current.add(n.id)); return []; });
    fetch(withBase("/api/notifications"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ clearAll: true }),
    }).catch(() => {});
  }, []);

  const unreadCount = useMemo(() => items.filter((n) => n.unread).length, [items]);

  const value = useMemo(
    () => ({ items, unreadCount, markAllRead, markRead, dismiss, clearAll }),
    [items, unreadCount, markAllRead, markRead, dismiss, clearAll],
  );

  return <NotificationsContext.Provider value={value}>{children}</NotificationsContext.Provider>;
}

export function useNotifications(): NotificationsValue {
  const ctx = useContext(NotificationsContext);
  if (!ctx) return { items: [], unreadCount: 0, markAllRead: () => {}, markRead: () => {}, dismiss: () => {}, clearAll: () => {} };
  return ctx;
}
