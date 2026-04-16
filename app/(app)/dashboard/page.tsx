import Link from "next/link";
import { ArrowRight, ListFilter, Layers3, ClipboardList } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { scoutingDisplay, scoutingBody } from "@/lib/football-ui";
import { getDashboardMetrics, getNeeds } from "@/lib/data/queries";
import { cn } from "@/lib/utils";

export default async function DashboardPage() {
  const [metrics, needs] = await Promise.all([getDashboardMetrics(), getNeeds()]);

  return (
    <div className={`${scoutingBody.className} grid gap-6`}>
      {/* Hero */}
      <section className="scouting-panel relative isolate">
        <div className="field-grid-lines absolute inset-0 opacity-40" />
        <div className="absolute inset-y-0 left-[12%] w-px bg-white/10" />
        <div className="absolute inset-y-0 right-[18%] w-px bg-white/10" />
        <div className="absolute inset-x-0 bottom-0 h-24 bg-[linear-gradient(180deg,transparent,rgba(5,12,10,0.42))]" />
        <div className="relative grid gap-8 px-6 py-7 lg:grid-cols-[minmax(0,1.45fr)_minmax(320px,0.9fr)] lg:px-8 lg:py-8">
          <div>
            <p className="field-label scouting-kicker">Control Room</p>
            <h1 className={`${scoutingDisplay.className} mt-3 text-[3.2rem] uppercase leading-[0.88] tracking-[0.04em] text-[#f5efe0] sm:text-[4.4rem]`}>
              Transfer Board
            </h1>
            <p className="scouting-support mt-4 max-w-2xl text-sm leading-6 sm:text-[15px]">
              Create a need, launch review mode, shortlist the fits. Keep the board moving from first-pass eval to coordinator and head coach sign-off.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Button asChild className="scouting-cta">
                <Link href="/needs/new">
                  New need
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
              <Button asChild variant="outline" className="border-white/20 bg-white/10 text-white hover:bg-white/18 hover:text-white">
                <Link href="/players">Browse board</Link>
              </Button>
            </div>
          </div>
          <div className="grid gap-3 self-end sm:grid-cols-3 lg:grid-cols-1">
            <div className="scouting-hero-stat">
              <p className="field-label text-[var(--scout-teal)]">Active Needs</p>
              <div className={`${scoutingDisplay.className} mt-2 text-[2.8rem] leading-none text-white`}>{metrics.activeNeeds}</div>
              <p className="mt-2 text-sm text-white/70">Open recruiting lanes in the workspace.</p>
            </div>
            <div className="scouting-hero-stat">
              <p className="field-label text-[var(--scout-teal)]">Portal Pool</p>
              <div className={`${scoutingDisplay.className} mt-2 text-[2.8rem] leading-none text-white`}>{metrics.totalPlayers}</div>
              <p className="mt-2 text-sm text-white/70">Players in the searchable transfer board.</p>
            </div>
            <div className="scouting-hero-stat">
              <p className="field-label text-[var(--scout-teal)]">Shortlisted</p>
              <div className={`${scoutingDisplay.className} mt-2 text-[2.8rem] leading-none text-white`}>{metrics.shortlistedPlayers}</div>
              <p className="mt-2 text-sm text-white/70">Players advancing through internal stages.</p>
            </div>
          </div>
        </div>
      </section>

      {/* Workflow quick-links */}
      <div className="grid gap-4 lg:grid-cols-3">
        {[
          {
            href: "/needs",
            icon: ClipboardList,
            label: "Step 1",
            title: "Define Needs",
            desc: "Set the measurable and production bars for each open roster spot."
          },
          {
            href: needs[0] ? `/review/${needs[0].id}` : "/needs",
            icon: ListFilter,
            label: "Step 2",
            title: "Review Players",
            desc: "Swipe through the board fit-ranked against your need. Flag, advance, or pass."
          },
          {
            href: "/shortlist",
            icon: Layers3,
            label: "Step 3",
            title: "Manage Shortlist",
            desc: "Move candidates through assistant → coordinator → head coach stages."
          }
        ].map(({ href, icon: Icon, label, title, desc }) => (
          <Link key={title} href={href} className="group block">
            <Card className="h-full border-[#d9e0db] bg-white/[0.88] transition hover:-translate-y-0.5 hover:border-[#24483a]/25 hover:shadow-[0_18px_40px_rgba(15,23,42,0.10)]">
              <CardContent className="flex flex-col gap-3 p-5">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-2xl border border-[#d3e8db] bg-[#eef5f0]">
                    <Icon className="h-5 w-5 text-[#1e4a33]" />
                  </div>
                  <p className="text-[10px] font-semibold uppercase tracking-[0.3em] text-[#52695d]">{label}</p>
                </div>
                <h3 className={`${scoutingDisplay.className} text-[1.7rem] uppercase leading-none tracking-[0.04em] text-[#14241c]`}>{title}</h3>
                <p className="text-sm leading-6 text-slate-500">{desc}</p>
                <div className="mt-auto flex items-center gap-1.5 pt-2 text-sm font-medium text-[#1e4a33] opacity-0 transition group-hover:opacity-100">
                  Go <ArrowRight className="h-3.5 w-3.5" />
                </div>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      {/* Active needs */}
      {needs.length > 0 ? (
        <section className="grid gap-4">
          <div className="flex items-end justify-between">
            <div>
              <p className="field-label text-[#2c5947]">Active Needs</p>
              <h2 className={`${scoutingDisplay.className} mt-2 text-[2.4rem] uppercase leading-none tracking-[0.04em] text-[#13251d]`}>
                Open Recruiting Lanes
              </h2>
            </div>
            <Button asChild variant="outline" className="border-[#cdd6d1] bg-white/80">
              <Link href="/needs">All needs</Link>
            </Button>
          </div>
          <div className="grid gap-3">
            {needs.map((need) => (
              <div
                key={need.id}
                className={cn(
                  "flex flex-col gap-4 rounded-[26px] border bg-white/[0.86] p-5 shadow-[0_12px_28px_rgba(15,23,42,0.05)] transition hover:-translate-y-0.5 hover:shadow-[0_18px_36px_rgba(15,23,42,0.08)] lg:flex-row lg:items-center lg:justify-between",
                  need.priority === "critical"
                    ? "border-l-4 border-l-rose-400"
                    : "border-l-4 border-l-cyan-400"
                )}
              >
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant={need.priority === "critical" ? "destructive" : "accent"}>
                      {need.priority === "critical" ? "Critical" : "Active"}
                    </Badge>
                    <Badge variant="default">{need.position}</Badge>
                    {need.target_count > 1 && (
                      <Badge variant="default">{need.target_count} spots</Badge>
                    )}
                  </div>
                  <h3 className={`${scoutingDisplay.className} mt-3 text-[1.9rem] uppercase leading-none tracking-[0.04em] text-[#14241c]`}>
                    {need.title}
                  </h3>
                  {need.notes && <p className="mt-2 max-w-xl text-sm text-slate-500">{need.notes}</p>}
                </div>
                <div className="flex shrink-0 flex-wrap gap-2">
                  <Button asChild variant="outline" className="border-[#cdd6d1] bg-white/80">
                    <Link href={`/players?needId=${need.id}`}>Browse fits</Link>
                  </Button>
                  <Button asChild className="bg-[#163627] text-[#ebf4ee] hover:bg-[#1b4330]">
                    <Link href={`/review/${need.id}`}>
                      Review
                      <ArrowRight className="h-4 w-4" />
                    </Link>
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </section>
      ) : (
        <div className="rounded-[28px] border border-dashed border-[#9eb2a5] bg-[#f3f6f2] p-10 text-center">
          <p className="field-label text-[#4e6d5d]">No needs yet</p>
          <h3 className={`${scoutingDisplay.className} mt-3 text-[2rem] uppercase leading-none tracking-[0.04em] text-[#16261f]`}>
            Create your first need
          </h3>
          <p className="mt-3 text-sm text-slate-600">Define the position, measurables, and production bar to unlock the review queue.</p>
          <div className="mt-6">
            <Button asChild className="bg-[#163627] text-[#ebf4ee] hover:bg-[#1b4330]">
              <Link href="/needs/new">
                Create need
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
