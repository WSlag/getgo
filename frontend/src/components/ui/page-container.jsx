import { cn } from "@/lib/cn";

export function PageContainer({ as: Component = "main", className, children, ...props }) {
  return (
    <Component
      className={cn("mx-auto w-full max-w-screen-2xl px-4 lg:px-6", className)}
      {...props}
    >
      {children}
    </Component>
  );
}

export default PageContainer;
