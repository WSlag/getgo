import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/cn";

export function AppSelect({
  label,
  hint,
  error,
  className,
  selectClassName,
  value,
  onValueChange,
  options = [],
  placeholder,
  ...props
}) {
  return (
    <label className={cn("block", className)}>
      {label ? (
        <span className="mb-1.5 block text-[13px] font-medium text-slate-700 dark:text-slate-300">
          {label}
        </span>
      ) : null}

      <div className="relative">
        <select
          value={value ?? ""}
          onChange={(event) => onValueChange?.(event.target.value)}
          className={cn(
            "h-12 w-full appearance-none rounded-[8px] border border-slate-300 bg-white px-3.5 pr-10 text-[16px] text-slate-950 outline-none transition",
            "focus:border-orange-500 focus:ring-2 focus:ring-orange-200",
            "dark:border-slate-700 dark:bg-slate-900 dark:text-white dark:focus:ring-orange-900",
            error && "border-red-500 bg-red-50 focus:border-red-500 focus:ring-red-200 dark:bg-red-950/20 dark:focus:ring-red-900",
            selectClassName
          )}
          {...props}
        >
          {placeholder ? <option value="">{placeholder}</option> : null}
          {options.map((option) => (
            <option key={option.value} value={option.value} disabled={option.disabled}>
              {option.label}
            </option>
          ))}
        </select>
        <ChevronDown className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-slate-400 dark:text-slate-500" />
      </div>

      {error ? (
        <p className="mt-1 text-[12px] text-red-600 dark:text-red-400">{error}</p>
      ) : hint ? (
        <p className="mt-1 text-[12px] text-slate-500 dark:text-slate-400">{hint}</p>
      ) : null}
    </label>
  );
}

export default AppSelect;
