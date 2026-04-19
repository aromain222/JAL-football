import Link from "next/link";
import { ArrowRight } from "lucide-react";

interface SectionHeaderProps {
  eyebrow: string;
  title: string;
  description: string;
  cta?: { label: string; href: string };
}

export function SectionHeader({ eyebrow, title, description, cta }: SectionHeaderProps) {
  return (
    <div className="flex flex-col gap-4 border-b border-[#e4e8e5] pb-5 lg:flex-row lg:items-start lg:justify-between">
      <div className="max-w-2xl">
        <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[#9ca3af]">{eyebrow}</p>
        <h1 className="mt-1.5 text-2xl font-bold text-[#111827]">{title}</h1>
        <p className="mt-1 text-sm text-[#9ca3af]">{description}</p>
      </div>
      {cta ? (
        <Link
          href={cta.href}
          className="flex shrink-0 items-center gap-2 rounded-xl bg-[#15542a] px-4 py-2 text-sm font-medium text-white hover:bg-[#1a6934]"
        >
          {cta.label}
          <ArrowRight className="h-4 w-4" />
        </Link>
      ) : null}
    </div>
  );
}
