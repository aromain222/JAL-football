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
    <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.3em] text-cyan-700">{eyebrow}</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-950">{title}</h1>
        <p className="mt-3 max-w-2xl text-sm text-slate-600">{description}</p>
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
