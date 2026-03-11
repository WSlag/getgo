import React from "react";
import { cn } from "@/lib/cn";

const variants = {
  transit: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400",
  pending: "bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400",
  accepted: "bg-sky-100 text-sky-700 dark:bg-sky-950/40 dark:text-sky-400",
  completed: "bg-violet-100 text-violet-700 dark:bg-violet-950/40 dark:text-violet-400",
  cancelled: "bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-400",
  verified: "bg-orange-100 text-orange-700 dark:bg-orange-950/40 dark:text-orange-400",
  secure: "bg-blue-100 text-blue-700 dark:bg-blue-950/40 dark:text-blue-400",
  neutral: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300",
};

export function StatusChip({ variant = "neutral", className, children, ...props }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[12px] font-semibold",
        variants[variant],
        className
      )}
      {...props}
    >
      {children}
    </span>
  );
}

export default StatusChip;