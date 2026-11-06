"use client";

import { createContext, useCallback, useContext, useState } from "react";

type ToastKind = "success" | "error" | "info";
interface Toast {
  id: number;
  kind: ToastKind;
  message: string;
}

const ToastContext = createContext<{
  toast: (message: string, kind?: ToastKind) => void;
} | null>(null);

let counter = 0;

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const toast = useCallback((message: string, kind: ToastKind = "info") => {
    const id = ++counter;
    // Keep at most 2 older toasts so they don't pile up — newest replaces oldest.
    setToasts((t) => [...t.slice(-2), { id, kind, message }]);
    setTimeout(() => {
      setToasts((t) => t.filter((x) => x.id !== id));
    }, 3200);
  }, []);

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 top-4 z-[200] flex flex-col items-center gap-2 px-4">
        {toasts.map((t) => (
          <div
            key={t.id}
            className="animate-rise glass-strong pointer-events-auto flex items-center gap-3 rounded-2xl px-4 py-3 text-sm shadow-[0_20px_60px_-20px_rgba(0,0,0,0.8)]"
          >
            <span
              className={
                "flex size-6 items-center justify-center rounded-full text-xs font-bold " +
                (t.kind === "success"
                  ? "bg-emerald-500/20 text-emerald-300"
                  : t.kind === "error"
                    ? "bg-rose-500/20 text-rose-300"
                    : "bg-lotus-500/20 text-lotus-200")
              }
            >
              {t.kind === "success" ? "✓" : t.kind === "error" ? "!" : "i"}
            </span>
            <span className="text-mist-100">{t.message}</span>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) return { toast: () => {} };
  return ctx;
}
