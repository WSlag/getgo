import React from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { cn } from "@/lib/cn";

export function AppDialog({
  open,
  onOpenChange,
  title,
  description,
  className,
  children,
}) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm" />
        <Dialog.Content
          className={cn(
            "fixed left-1/2 top-1/2 z-50 w-[calc(100vw-24px)] max-w-lg -translate-x-1/2 -translate-y-1/2",
            "rounded-[18px] border border-slate-200 bg-white p-5 shadow-[0_18px_30px_rgba(0,0,0,0.15)] outline-none",
            "dark:border-slate-800 dark:bg-slate-900",
            className
          )}
        >
          <div className="mb-4 flex items-start justify-between gap-3">
            <div className="min-w-0">
              {title ? (
                <Dialog.Title className="text-[22px] font-bold tracking-[-0.02em] text-slate-950 dark:text-white">
                  {title}
                </Dialog.Title>
              ) : null}
              {description ? (
                <Dialog.Description className="mt-1 text-[14px] text-slate-500 dark:text-slate-400">
                  {description}
                </Dialog.Description>
              ) : null}
            </div>

            <Dialog.Close asChild>
              <button
                type="button"
                className="inline-flex h-11 w-11 items-center justify-center rounded-[10px] border border-slate-200 bg-slate-100 text-slate-600 transition hover:bg-slate-200 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
                aria-label="Close dialog"
              >
                <X className="size-5" />
              </button>
            </Dialog.Close>
          </div>

          {children}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

export default AppDialog;