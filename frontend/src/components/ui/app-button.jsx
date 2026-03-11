import React from "react";
import { cn } from "@/lib/cn";

const variants = {
  primary:
    "bg-orange-500 text-white hover:bg-orange-600 shadow-[0_6px_12px_rgba(0,0,0,0.10)]",
  secondary:
    "border border-slate-200 bg-slate-100 text-slate-900 hover:bg-slate-200 dark:border-slate-700 dark:bg-slate-800 dark:text-white dark:hover:bg-slate-700",
  outline:
    "border border-orange-500 bg-transparent text-orange-600 hover:bg-orange-50 dark:text-orange-400 dark:hover:bg-orange-950/30",
  success:
    "bg-emerald-500 text-white hover:bg-emerald-600 shadow-[0_6px_12px_rgba(0,0,0,0.10)]",
  danger:
    "bg-red-500 text-white hover:bg-red-600 shadow-[0_6px_12px_rgba(0,0,0,0.10)]",
  ghost:
    "bg-transparent text-slate-700 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800",
};

const sizes = {
  sm: "h-9 rounded-[10px] px-3 text-sm",
  md: "h-11 rounded-[10px] px-4 text-sm",
  lg: "h-12 rounded-[10px] px-5 text-base",
  icon: "h-11 w-11 rounded-[10px] p-0",
};

export function AppButton({
  asChild = false,
  type = "button",
  variant = "primary",
  size = "lg",
  className,
  children,
  disabled,
  ...props
}) {
  const Component = asChild ? "span" : "button";

  return (
    <Component
      type={asChild ? undefined : type}
      disabled={asChild ? undefined : disabled}
      className={cn(
        "inline-flex items-center justify-center gap-2 whitespace-nowrap font-semibold transition-all active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-200 focus-visible:ring-offset-2 dark:focus-visible:ring-orange-900",
        variants[variant],
        sizes[size],
        className
      )}
      {...props}
    >
      {children}
    </Component>
  );
}

export default AppButton;