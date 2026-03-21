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
    <nav className="grid gap-2.5">
      {items.map((item) => {
        const Icon = iconMap[item.icon];
        const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);

        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "group flex items-center justify-between rounded-2xl border px-3 py-3 text-sm font-medium transition-all duration-150",
              isActive
                ? "border-cyan-200 bg-cyan-50/90 text-slate-950 shadow-[0_10px_20px_rgba(14,116,144,0.08)]"
                : "border-transparent text-slate-600 hover:border-slate-200 hover:bg-white/80 hover:text-slate-950"
            )}
          >
            <span className="flex items-center gap-3">
              <span
                className={cn(
                  "flex h-10 w-10 items-center justify-center rounded-xl border transition-colors",
                  isActive
                    ? "border-cyan-200 bg-white text-cyan-700"
                    : "border-transparent bg-slate-100 text-slate-600 group-hover:bg-slate-950 group-hover:text-white"
                )}
              >
                <Icon className="h-4 w-4" />
              </span>
              {item.label}
            </span>
            <span
              className={cn(
                "h-2.5 w-2.5 rounded-full transition-colors",
                isActive ? "bg-cyan-500" : "bg-transparent group-hover:bg-slate-300"
              )}
            />
          </Link>
        );
      })}
    </nav>
  );
}
