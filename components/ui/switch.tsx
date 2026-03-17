"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

export const Switch = React.forwardRef<
  HTMLButtonElement,
  {
    checked: boolean;
    onCheckedChange: (checked: boolean) => void;
    disabled?: boolean;
    className?: string;
  }
>(({ checked, onCheckedChange, disabled, className }, ref) => {
  return (
    <button
      ref={ref}
      aria-checked={checked}
      className={cn(
        "relative inline-flex h-6 w-11 items-center rounded-full border transition",
        checked ? "border-cyan-700 bg-cyan-700" : "border-slate-300 bg-slate-200",
        disabled ? "cursor-not-allowed opacity-50" : "cursor-pointer",
        className
      )}
      disabled={disabled}
      role="switch"
      type="button"
      onClick={() => onCheckedChange(!checked)}
    >
      <span
        className={cn(
          "inline-block h-4 w-4 rounded-full bg-white transition",
          checked ? "translate-x-6" : "translate-x-1"
        )}
      />
    </button>
  );
});

Switch.displayName = "Switch";
