import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center justify-center rounded-lg border px-2.5 py-0.5 text-xs font-medium w-fit whitespace-nowrap shrink-0 [&>svg]:size-3 gap-1 [&>svg]:pointer-events-none transition-all overflow-hidden",
  {
    variants: {
      variant: {
        default: "border-transparent bg-primary text-primary-foreground",
        secondary: "border-transparent bg-secondary text-secondary-foreground",
        destructive: "border-transparent bg-destructive text-white",
        outline: "text-foreground border-border",
        success: "border-transparent bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
        warning: "border-transparent bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400",
        info: "border-transparent bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
        // Gradient variants
        "gradient-green": "border-transparent bg-gradient-to-br from-green-400 to-green-600 text-white shadow-lg",
        "gradient-orange": "border-transparent bg-gradient-to-br from-orange-400 to-orange-600 text-white shadow-lg",
        "gradient-blue": "border-transparent bg-gradient-to-br from-blue-400 to-blue-600 text-white shadow-lg",
        "gradient-purple": "border-transparent bg-gradient-to-br from-purple-400 to-purple-600 text-white shadow-lg",
        "gradient-red": "border-transparent bg-gradient-to-br from-red-400 to-red-600 text-white shadow-lg",
      },
      size: {
        default: "px-2.5 py-0.5 text-xs",
        sm: "px-2 py-0.5 text-[10px]",
        lg: "px-3 py-1 text-sm",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
);

const Badge = React.forwardRef(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "span";
    return (
      <Comp
        ref={ref}
        className={cn(badgeVariants({ variant, size }), className)}
        {...props}
      />
    );
  }
);
Badge.displayName = "Badge";

export { Badge, badgeVariants };
