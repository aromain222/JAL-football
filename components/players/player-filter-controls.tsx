import { ReactNode } from "react";
import { Label } from "@/components/ui/label";

export function FilterGroup({
  label,
  children
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="grid gap-2">
      <Label className="text-xs uppercase tracking-[0.24em] text-slate-500">{label}</Label>
      {children}
    </div>
  );
}

export function NumberRangeFields({
  minName,
  maxName,
  minDefaultValue,
  maxDefaultValue,
  minPlaceholder,
  maxPlaceholder
}: {
  minName: string;
  maxName: string;
  minDefaultValue?: string;
  maxDefaultValue?: string;
  minPlaceholder: string;
  maxPlaceholder: string;
}) {
  return (
    <div className="grid grid-cols-2 gap-2">
      <input
        className="h-10 rounded-xl border bg-white px-3 text-sm"
        defaultValue={minDefaultValue}
        name={minName}
        placeholder={minPlaceholder}
        type="number"
      />
      <input
        className="h-10 rounded-xl border bg-white px-3 text-sm"
        defaultValue={maxDefaultValue}
        name={maxName}
        placeholder={maxPlaceholder}
        type="number"
      />
    </div>
  );
}
