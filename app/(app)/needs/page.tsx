import Link from "next/link";
import { ArrowRight, Trash2 } from "lucide-react";
import { deleteNeedAction } from "@/app/actions";
import { SectionHeader } from "@/components/section-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { getNeeds } from "@/lib/data/queries";
import { scoutingDisplay } from "@/lib/football-ui";

export default async function NeedsPage() {
  const needs = await getNeeds();

  return (
    <div className="grid gap-6">
      <section className="scouting-panel relative isolate">
        <div className="field-grid-lines absolute inset-0 opacity-40" />
        <div className="absolute inset-y-0 left-[10%] w-px bg-white/10" />
        <div className="absolute inset-y-0 right-[16%] w-px bg-white/10" />
        <div className="relative grid gap-8 px-6 py-7 lg:grid-cols-[minmax(0,1.4fr)_minmax(280px,0.8fr)] lg:px-8 lg:py-8">
          <div>
            <p className="field-label scouting-kicker">Roster Needs</p>
            <h1 className={`${scoutingDisplay.className} mt-3 text-[3.2rem] uppercase leading-[0.9] tracking-[0.04em] text-[#f5efe0] sm:text-[4.2rem]`}>
              Manage Recruiting Profiles
            </h1>
            <p className="scouting-support mt-4 max-w-2xl text-sm leading-6 sm:text-[15px]">
              Define the measurable and production bars for each transfer target bucket, then launch review mode directly.
            </p>
            <div className="mt-6">
              <Button asChild className="scouting-cta">
                <Link href="/needs/new">
                  New need
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
            </div>
          </div>
          <div className="grid gap-3 self-end sm:grid-cols-2 lg:grid-cols-1">
            <div className="scouting-hero-stat">
              <p className="field-label text-[var(--scout-teal)]">Open Profiles</p>
              <div className={`${scoutingDisplay.className} mt-2 text-[2.8rem] leading-none text-white`}>
                {needs.length}
              </div>
              <p className="mt-2 text-sm text-white/70">Active recruiting lanes being managed in the workspace.</p>
            </div>
          </div>
        </div>
      </section>

      <div className="grid gap-4">
        {needs.map((need) => (
          <Card key={need.id} className="scouting-surface overflow-hidden">
            <CardContent className="flex flex-col gap-4 p-6 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <Badge>{need.position}</Badge>
                  <Badge variant={need.priority === "critical" ? "destructive" : "accent"}>{need.priority}</Badge>
                  <Badge variant="default">{need.target_count} spots</Badge>
                </div>
                <h2 className={`${scoutingDisplay.className} mt-3 text-[2.2rem] uppercase leading-none tracking-[0.04em] text-[#16261f]`}>
                  {need.title}
                </h2>
                <p className="mt-2 max-w-2xl text-sm text-slate-600">{need.notes}</p>
              </div>
              <div className="flex items-center gap-2">
                <Button asChild variant="outline">
                  <Link href={`/needs/${need.id}`}>View need</Link>
                </Button>
                <Button asChild>
                  <Link href={`/review/${need.id}`}>
                    Launch review
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                </Button>
                <form action={deleteNeedAction.bind(null, need.id)}>
                  <Button
                    size="sm"
                    type="submit"
                    variant="ghost"
                    aria-label="Delete need"
                    className="px-2 text-slate-400 hover:text-rose-600"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </form>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
