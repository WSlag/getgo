import React from "react";
import { cn } from "@/lib/cn";

export function SectionHeader({
  title,
  description,
  action,
  className,
  titleClassName,
  ...props
}) {
  return (
    <div
      className={cn("mb-4 flex items-start justify-between gap-3", className)}
      {...props}
    >
      <div className="min-w-0">
        <h2 className={cn("text-[22px] font-bold tracking-[-0.02em] text-slate-950 dark:text-white", titleClassName)}>
          {title}
        </h2>
        {description ? (
          <p className="mt-1 text-[14px] text-slate-500 dark:text-slate-400">
            {description}
          </p>
        ) : null}
      </div>

      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}

export default SectionHeader;