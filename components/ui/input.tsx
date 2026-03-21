import * as React from "react";
import { cn } from "@/lib/utils";

export const Input = React.forwardRef<HTMLInputElement, React.ComponentProps<"input">>(
  ({ className, ...props }, ref) => {
    return (
      <input
        ref={ref}
        className={cn(
          "flex h-11 w-full rounded-2xl border border-slate-200 bg-white/92 px-4 py-2 text-sm text-slate-900 outline-none ring-offset-background placeholder:text-slate-400 focus-visible:border-cyan-300 focus-visible:ring-2 focus-visible:ring-cyan-100",
          className
        )}
        {...props}
      />
    );
  }
);
Input.displayName = "Input";
