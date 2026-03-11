import React from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { cn } from "@/lib/cn";

export function AppSheet({
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
            "fixed inset-x-0 bottom-0 z-50 rounded-t-[18px] border border-slate-200 bg-white p-5 shadow-[0_18px_30px_rgba(0,0,0,0.15)] outline-none",
            "dark:border-slate-800 dark:bg-slate-900",
            className
          )}
        >
          <div className="mx-auto mb-3 h-1.5 w-12 rounded-full bg-slate-300 dark:bg-slate-700" />

          <div className="mb-4 flex items-start justify-between gap-3">
            <div className="min-w-0">
              {title ? (
                <Dialog.Title className="text-[18px] font-semibold text-slate-950 dark:text-white">
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
                aria-label="Close sheet"
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

export default AppSheet;