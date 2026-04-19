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
    <nav className="grid gap-0.5">
      {items.map((item) => {
        const Icon = iconMap[item.icon];
        const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);

        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "flex items-center gap-2.5 rounded-xl px-3 py-2 text-[13px] font-medium transition-colors",
              isActive
                ? "bg-[#dcf0e3] text-[#15542a]"
                : "text-[#4b5563] hover:bg-[#f1f5f2] hover:text-[#111827]"
            )}
          >
            <Icon className="h-4 w-4 shrink-0" />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
