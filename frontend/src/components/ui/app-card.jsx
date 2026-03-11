import React from "react";
import { cn } from "@/lib/cn";

export function AppCard({ className, children, ...props }) {
  return (
    <div
      className={cn(
        "rounded-[14px] border border-slate-200 bg-white p-4 shadow-[0_1px_3px_rgba(0,0,0,0.08)] dark:border-slate-800 dark:bg-slate-900",
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}

export function StatCard({ className, label, value, valueClassName, icon, ...props }) {
  return (
    <div
      className={cn(
        "rounded-[14px] border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900",
        className
      )}
      {...props}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[13px] text-slate-500 dark:text-slate-400">{label}</p>
          <p className={cn("mt-2 text-[18px] font-bold text-slate-950 dark:text-white", valueClassName)}>
            {value}
          </p>
        </div>
        {icon ? <div className="shrink-0 text-slate-400 dark:text-slate-500">{icon}</div> : null}
      </div>
    </div>
  );
}

export default AppCard;