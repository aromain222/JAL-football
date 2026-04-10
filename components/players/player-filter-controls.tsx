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
      <Label className="text-[10px] font-semibold uppercase tracking-[0.28em] text-[#52695d]">{label}</Label>
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
        className="h-11 rounded-[18px] border border-[#cfd8d2] bg-white/90 px-3 text-sm"
        defaultValue={minDefaultValue}
        name={minName}
        placeholder={minPlaceholder}
        type="number"
      />
      <input
        className="h-11 rounded-[18px] border border-[#cfd8d2] bg-white/90 px-3 text-sm"
        defaultValue={maxDefaultValue}
        name={maxName}
        placeholder={maxPlaceholder}
        type="number"
      />
    </div>
  );
}
