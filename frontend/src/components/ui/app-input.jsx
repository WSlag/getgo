import React from "react";
import { cn } from "@/lib/cn";

export function AppInput({
  label,
  hint,
  error,
  className,
  inputClassName,
  ...props
}) {
  return (
    <label className={cn("block", className)}>
      {label ? (
        <span className="mb-1.5 block text-[13px] font-medium text-slate-700 dark:text-slate-300">
          {label}
        </span>
      ) : null}

      <input
        className={cn(
          "h-12 w-full rounded-[8px] border border-slate-300 bg-white px-3.5 text-[16px] text-slate-950 outline-none transition",
          "placeholder:text-slate-400",
          "focus:border-orange-500 focus:ring-2 focus:ring-orange-200",
          "dark:border-slate-700 dark:bg-slate-900 dark:text-white dark:placeholder:text-slate-500 dark:focus:ring-orange-900",
          error && "border-red-500 bg-red-50 focus:border-red-500 focus:ring-red-200 dark:bg-red-950/20 dark:focus:ring-red-900",
          inputClassName
        )}
        {...props}
      />

      {error ? (
        <p className="mt-1 text-[12px] text-red-600 dark:text-red-400">{error}</p>
      ) : hint ? (
        <p className="mt-1 text-[12px] text-slate-500 dark:text-slate-400">{hint}</p>
      ) : null}
    </label>
  );
}

export function AppTextarea({
  label,
  hint,
  error,
  className,
  textareaClassName,
  ...props
}) {
  return (
    <label className={cn("block", className)}>
      {label ? (
        <span className="mb-1.5 block text-[13px] font-medium text-slate-700 dark:text-slate-300">
          {label}
        </span>
      ) : null}

      <textarea
        className={cn(
          "min-h-24 w-full rounded-[8px] border border-slate-300 bg-white px-3.5 py-3 text-[16px] text-slate-950 outline-none transition",
          "placeholder:text-slate-400",
          "focus:border-orange-500 focus:ring-2 focus:ring-orange-200",
          "dark:border-slate-700 dark:bg-slate-900 dark:text-white dark:placeholder:text-slate-500 dark:focus:ring-orange-900",
          error && "border-red-500 bg-red-50 focus:border-red-500 focus:ring-red-200 dark:bg-red-950/20 dark:focus:ring-red-900",
          textareaClassName
        )}
        {...props}
      />

      {error ? (
        <p className="mt-1 text-[12px] text-red-600 dark:text-red-400">{error}</p>
      ) : hint ? (
        <p className="mt-1 text-[12px] text-slate-500 dark:text-slate-400">{hint}</p>
      ) : null}
    </label>
  );
}

export default AppInput;