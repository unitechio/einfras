import type { ReactNode } from "react";
import { AlertTriangle, ShieldAlert, Trash2, X } from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/shared/ui/Button";

type Tone = "danger" | "warning";

export function ConfirmActionDialog({
  open,
  title,
  description,
  confirmLabel,
  cancelLabel = "Cancel",
  onConfirm,
  onClose,
  pending = false,
  tone = "danger",
  children,
}: {
  open: boolean;
  title: string;
  description: string;
  confirmLabel: string;
  cancelLabel?: string;
  onConfirm: () => void;
  onClose: () => void;
  pending?: boolean;
  tone?: Tone;
  children?: ReactNode;
}) {
  if (!open) {
    return null;
  }

  const isDanger = tone === "danger";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 p-4 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-[28px] border border-zinc-200 bg-white shadow-2xl dark:border-zinc-800 dark:bg-[#121212]">
        <div className="flex items-start justify-between gap-4 border-b border-zinc-200 px-6 py-5 dark:border-zinc-800">
          <div className="flex min-w-0 items-start gap-3">
            <div
              className={cn(
                "mt-0.5 rounded-2xl p-2",
                isDanger ? "bg-red-500/10 text-red-500" : "bg-amber-500/10 text-amber-500",
              )}
            >
              {isDanger ? <Trash2 className="h-5 w-5" /> : <ShieldAlert className="h-5 w-5" />}
            </div>
            <div>
              <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">{title}</h3>
              <p className="mt-1 text-sm leading-6 text-zinc-500 dark:text-zinc-400">{description}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-2 text-zinc-400 transition hover:bg-zinc-100 hover:text-zinc-700 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
            aria-label="Close dialog"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="space-y-4 px-6 py-5">
          {children ? (
            children
          ) : (
            <div
              className={cn(
                "rounded-2xl border px-4 py-3 text-sm",
                isDanger
                  ? "border-red-200 bg-red-50/80 text-red-700 dark:border-red-900/60 dark:bg-red-950/30 dark:text-red-300"
                  : "border-amber-200 bg-amber-50/80 text-amber-700 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-300",
              )}
            >
              <div className="flex items-start gap-2">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                <span>This action changes runtime state immediately. Please confirm before continuing.</span>
              </div>
            </div>
          )}
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={onClose} disabled={pending}>
              {cancelLabel}
            </Button>
            <Button
              variant="primary"
              onClick={onConfirm}
              disabled={pending}
              className={cn(
                isDanger
                  ? "bg-red-600 hover:bg-red-700 focus-visible:ring-red-500/30"
                  : "bg-amber-600 hover:bg-amber-700 focus-visible:ring-amber-500/30",
              )}
            >
              {confirmLabel}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
