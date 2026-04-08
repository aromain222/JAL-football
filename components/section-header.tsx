import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";

interface SectionHeaderProps {
  eyebrow: string;
  title: string;
  description: string;
  cta?: {
    label: string;
    href: string;
  };
}

export function SectionHeader({ eyebrow, title, description, cta }: SectionHeaderProps) {
  return (
    <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
      <div className="max-w-3xl">
        <div className="inline-flex items-center rounded-full border border-cyan-200/70 bg-gradient-to-r from-cyan-50 to-sky-50 px-3.5 py-1.5 text-[11px] font-semibold uppercase tracking-[0.28em] text-cyan-800 shadow-[0_0_16px_rgba(14,116,144,0.15)]">
          {eyebrow}
        </div>
        <h1 className="gradient-heading mt-4 text-4xl font-bold tracking-tight lg:text-[2.9rem]">{title}</h1>
        <p className="mt-3 max-w-2xl text-[15px] leading-7 text-slate-600 lg:text-base">{description}</p>
      </div>
      {cta ? (
        <Button asChild size="lg">
          <Link href={cta.href}>
            {cta.label}
            <ArrowRight className="h-4 w-4" />
          </Link>
        </Button>
      ) : null}
    </div>
  );
}
