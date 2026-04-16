import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { scoutingDisplay } from "@/lib/football-ui";

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
        <div className="inline-flex items-center rounded-full border border-[var(--scout-card-border)] bg-white/[0.82] px-3.5 py-1.5 text-[10px] font-semibold uppercase tracking-[0.32em] scouting-pill-label shadow-[0_10px_24px_rgba(15,23,42,0.06)]">
          {eyebrow}
        </div>
        <h1 className={`${scoutingDisplay.className} scouting-title mt-4 text-[3rem] uppercase leading-[0.92] tracking-[0.04em] lg:text-[4rem]`}>
          {title}
        </h1>
        <p className="mt-3 max-w-2xl text-[15px] leading-7 text-slate-600 lg:text-base">{description}</p>
      </div>
      {cta ? (
        <Button asChild size="lg" className="scouting-cta">
          <Link href={cta.href}>
            {cta.label}
            <ArrowRight className="h-4 w-4" />
          </Link>
        </Button>
      ) : null}
    </div>
  );
}
