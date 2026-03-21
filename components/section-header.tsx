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
        <div className="inline-flex items-center rounded-full border border-cyan-100 bg-cyan-50/90 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.28em] text-cyan-800">
          {eyebrow}
        </div>
        <h1 className="mt-4 text-4xl font-semibold tracking-tight text-slate-950 lg:text-[2.8rem]">{title}</h1>
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
