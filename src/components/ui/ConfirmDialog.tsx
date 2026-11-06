"use client";

import { Button } from "@/components/ui/Button";
import { AlertTriangle, X } from "lucide-react";

/** A simple yes/no confirmation modal. Render conditionally (when open). */
export function ConfirmDialog({
  title,
  message,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  danger,
  onConfirm,
  onCancel,
}: {
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-[60] grid place-items-center bg-black/60 p-4"
      onClick={onCancel}
      role="dialog"
      aria-modal="true"
    >
      <div
        className="w-full max-w-sm rounded-2xl border border-white/10 bg-ink-850 p-5 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <span
              className={
                "grid size-10 shrink-0 place-items-center rounded-full " +
                (danger ? "bg-rose-500/15 text-rose-300" : "bg-lotus-500/15 text-lotus-300")
              }
            >
              <AlertTriangle className="size-5" />
            </span>
            <h2 className="font-display text-lg font-bold text-mist-100">{title}</h2>
          </div>
          <button onClick={onCancel} className="text-mist-400 hover:text-mist-100">
            <X className="size-5" />
          </button>
        </div>
        <p className="mt-3 text-sm text-mist-300">{message}</p>
        <div className="mt-5 flex justify-end gap-2">
          <Button variant="secondary" onClick={onCancel}>
            {cancelLabel}
          </Button>
          <Button variant={danger ? "danger" : "primary"} onClick={onConfirm}>
            {confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}
