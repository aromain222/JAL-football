"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BarChart3, ClipboardList, Layers3, Link2, ListFilter } from "lucide-react";
import { cn } from "@/lib/utils";

const iconMap = {
  dashboard: BarChart3,
  needs: ClipboardList,
  players: ListFilter,
  shortlist: Layers3,
  identity: Link2
} as const;

interface NavItem {
  href: string;
  label: string;
  icon: keyof typeof iconMap;
}

export function AppSidebarNav({ items }: { items: readonly NavItem[] }) {
  const pathname = usePathname();

  return (
    <nav className="grid gap-2">
      {items.map((item) => {
        const Icon = iconMap[item.icon];
        const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);

        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "group flex items-center justify-between rounded-[22px] border px-3 py-3 text-sm font-medium transition-all duration-200",
              isActive
                ? "border-[#204234]/18 bg-[#123928] font-semibold text-[#e4f5ea] shadow-[0_10px_28px_rgba(17,48,33,0.28)]"
                : "border-transparent text-slate-500 hover:border-[#d8ddd7] hover:bg-white/82 hover:text-slate-800"
            )}
          >
            <span className="flex items-center gap-3">
              <span
                className={cn(
                  "flex h-10 w-10 items-center justify-center rounded-2xl border transition-all duration-200",
                  isActive
                    ? "border-[#d3b26c]/35 bg-[#d3b26c]/18 text-[#f4e2b9]"
                    : "border-transparent bg-slate-100/80 text-slate-500 group-hover:bg-[#163627] group-hover:text-[#ebf4ee]"
                )}
              >
                <Icon className="h-4 w-4" />
              </span>
              {item.label}
            </span>
            <span
              className={cn(
                "h-2.5 w-2.5 rounded-full transition-colors duration-200",
                isActive ? "bg-[#d3b26c]" : "bg-transparent group-hover:bg-slate-300"
              )}
            />
          </Link>
        );
      })}
    </nav>
  );
}
