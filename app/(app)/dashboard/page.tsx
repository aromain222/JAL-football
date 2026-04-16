import Link from "next/link";
import { ArrowRight, Clock3, Film, Layers3 } from "lucide-react";
import { StatCard } from "@/components/stat-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getPlayerPrimaryProduction } from "@/lib/football";
import { scoutingDisplay } from "@/lib/football-ui";
import { cn, formatDate, formatNumber } from "@/lib/utils";
import {
  getDashboardMetrics,
  getNeeds,
  getPlayers,
  getReviewsByNeed,
  getShortlistBoard
} from "@/lib/data/queries";

export default async function DashboardPage() {
  const [metrics, needs, shortlistBoard, allPlayers] = await Promise.all([
    getDashboardMetrics(),
    getNeeds(),
    getShortlistBoard(),
    getPlayers()
  ]);

  const recentReviewGroups = await Promise.all(needs.map((need) => getReviewsByNeed(need.id)));
  const recentReviews = recentReviewGroups
    .flat()
    .sort((a, b) => b.created_at.localeCompare(a.created_at))
    .slice(0, 6);

  const playersNeedingFilm = (allPlayers as typeof allPlayers).filter((player) =>
    (player as { tags?: string[] }).tags?.includes("needs-film")
  ).length;

  const recentShortlisted = shortlistBoard
    .slice()
    .sort((a, b) => (b.updated_at ?? b.created_at).localeCompare(a.updated_at ?? a.created_at))
    .slice(0, 4);

  function buildShortlistActivity(item: (typeof recentShortlisted)[number]) {
    const activityAt = item.updated_at ?? item.created_at;
    const movedLater = activityAt !== item.created_at;
    const detail = item.player
      ? movedLater
        ? `${item.player.first_name} ${item.player.last_name} moved to ${item.stage.replace("_", " ")}.`
        : `${item.player.first_name} ${item.player.last_name} moved into shortlist.`
      : movedLater
        ? `Player moved to ${item.stage.replace("_", " ")}.`
        : "Player moved into shortlist.";

    return {
      id: item.id,
      type: "shortlist" as const,
      created_at: activityAt,
      label: item.stage,
      detail,
      meta: item.need?.title ?? "Shortlist update"
    };
  }

  const activityFeed = [
    ...recentReviews.map((review) => ({
      id: review.id,
      type: "review" as const,
      created_at: review.created_at,
      label: review.decision,
      detail: review.note ?? "Review logged without note.",
      meta: `Fit ${review.fit_score}`
    })),
    ...recentShortlisted.map(buildShortlistActivity)
  ]
    .sort((a, b) => b.created_at.localeCompare(a.created_at))
    .slice(0, 6);

  return (
    <div className="grid gap-6">
      <section className="scouting-panel relative isolate">
        <div className="field-grid-lines absolute inset-0 opacity-40" />
        <div className="absolute inset-y-0 left-[12%] w-px bg-white/10" />
        <div className="absolute inset-y-0 right-[18%] w-px bg-white/10" />
        <div className="absolute inset-x-0 bottom-0 h-24 bg-[linear-gradient(180deg,transparent,rgba(5,12,10,0.42))]" />
        <div className="relative grid gap-8 px-6 py-7 lg:grid-cols-[minmax(0,1.45fr)_minmax(320px,0.9fr)] lg:px-8 lg:py-8">
          <div>
            <p className="field-label scouting-kicker">Control Room</p>
            <h1 className={`${scoutingDisplay.className} mt-3 text-[3.2rem] uppercase leading-[0.88] tracking-[0.04em] text-[#f5efe0] sm:text-[4.4rem]`}>
              Transfer Board Status
            </h1>
            <p className="scouting-support mt-4 max-w-2xl text-sm leading-6 sm:text-[15px]">
              Track roster needs, move quickly through first-pass eval, and keep the internal board moving toward coordinator and head coach review.
            </p>
            <div className="mt-6">
              <Button asChild className="scouting-cta">
                <Link href="/needs/new">
                  Create new need
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
            </div>
          </div>
          <div className="grid gap-3 self-end sm:grid-cols-2">
            <div className="scouting-hero-stat">
              <p className="field-label text-[var(--scout-teal)]">Portal Pipeline</p>
              <div className={`${scoutingDisplay.className} mt-2 text-[2.8rem] leading-none text-white`}>
                {formatNumber(metrics.totalPlayers)}
              </div>
              <p className="mt-2 text-sm text-white/70">Imported players live in the internal eval board.</p>
            </div>
            <div className="scouting-hero-stat">
              <p className="field-label text-[var(--scout-teal)]">Shortlisted Now</p>
              <div className={`${scoutingDisplay.className} mt-2 text-[2.8rem] leading-none text-white`}>
                {metrics.shortlistedPlayers}
              </div>
              <p className="mt-2 text-sm text-white/70">Players currently held in staff review stages.</p>
            </div>
          </div>
        </div>
      </section>

      {/* Stat cards row */}
      <div className="grid gap-4 lg:grid-cols-5">
        <StatCard label="Active needs" value={String(metrics.activeNeeds)} hint="Open recruiting priorities" />
        <StatCard label="Total players" value={String(metrics.totalPlayers)} hint="Searchable transfer board" />
        <StatCard label="Shortlisted" value={String(metrics.shortlistedPlayers)} hint="Advancing to internal stages" />
        <StatCard label="Recent reviews" value={String(metrics.recentReviews)} hint="Last 14 days of eval activity" />
        <StatCard label="Needs film" value={String(playersNeedingFilm)} hint="Profiles flagged for deeper tape work" />
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.05fr_0.95fr]">
        {/* Active needs */}
        <Card className="scouting-surface overflow-hidden">
          <CardHeader className="flex-row items-center justify-between">
            <div>
              <CardTitle>Active needs</CardTitle>
              <p className="text-sm text-slate-600">Launch review mode directly from any live roster gap.</p>
            </div>
            <Button asChild variant="outline">
              <Link href="/needs">All needs</Link>
            </Button>
          </CardHeader>
          <CardContent className="grid gap-3">
            {needs.map((need) => (
              <div
                key={need.id}
                className={cn(
                  "flex flex-col gap-3 rounded-[24px] border bg-white/[0.86] p-4 shadow-[0_12px_28px_rgba(15,23,42,0.06)] transition hover:-translate-y-0.5 hover:shadow-[0_18px_36px_rgba(15,23,42,0.09)] lg:flex-row lg:items-center lg:justify-between",
                  need.priority === "critical"
                    ? "border-l-4 border-l-rose-400"
                    : "border-l-4 border-l-cyan-400"
                )}
              >
                <div>
                  <p className="field-label text-[#52695d]">
                    {need.priority === "critical" ? "Critical need" : "Live need"} • {need.position}
                  </p>
                  <h3 className="mt-2 text-lg font-semibold text-slate-950">{need.title}</h3>
                  <p className="mt-1 text-sm text-slate-500">{need.notes}</p>
                </div>
                <div className="flex shrink-0 gap-3">
                  <Button asChild variant="outline">
                    <Link href={`/needs/${need.id}`}>View</Link>
                  </Button>
                  <Button asChild>
                    <Link href={`/review/${need.id}`}>
                      Review
                      <ArrowRight className="h-4 w-4" />
                    </Link>
                  </Button>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Activity feed — timeline style */}
        <Card className="scouting-surface overflow-hidden">
          <CardHeader>
            <CardTitle>Recent activity</CardTitle>
            <p className="text-sm text-slate-600">Latest reviews and shortlist movements.</p>
          </CardHeader>
          <CardContent>
            {activityFeed.length ? (
              <div className="relative grid gap-0">
                {/* Vertical connector line */}
                <div className="absolute bottom-5 left-[19px] top-5 w-px bg-slate-200" />
                {activityFeed.map((item) => {
                  const isShortlist = item.type === "shortlist";
                  const isPositive = item.label === "right";
                  return (
                    <div key={item.id} className="relative flex gap-4 pb-4 last:pb-0">
                      {/* Dot */}
                      <div
                        className={cn(
                          "relative z-10 mt-1 flex h-10 w-10 shrink-0 items-center justify-center rounded-full border-2 border-white shadow-sm",
                          isShortlist ? "bg-cyan-100" : isPositive ? "bg-emerald-100" : "bg-slate-100"
                        )}
                      >
                        <div
                          className={cn(
                            "h-2.5 w-2.5 rounded-full",
                            isShortlist ? "bg-cyan-500" : isPositive ? "bg-emerald-500" : "bg-slate-400"
                          )}
                        />
                      </div>
                      {/* Card */}
                      <div className="flex-1 rounded-[24px] border border-[#d8ddd7] bg-white/[0.88] p-4 shadow-[0_12px_28px_rgba(15,23,42,0.06)]">
                        <div className="flex items-center justify-between">
                          <Badge
                            variant={
                              isShortlist ? "accent" : isPositive ? "success" : item.label === "needs_film" ? "warning" : "default"
                            }
                          >
                            {item.label}
                          </Badge>
                          <div className="flex items-center gap-1.5 text-[11px] uppercase tracking-[0.2em] text-slate-400">
                            <Clock3 className="h-3 w-3" />
                            {formatDate(item.created_at)}
                          </div>
                        </div>
                        <p className="mt-2.5 text-sm font-medium text-slate-900">{item.detail}</p>
                        <p className="mt-1 text-sm text-slate-500">{item.meta}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="rounded-2xl border border-dashed bg-slate-50 p-5 text-sm text-slate-500">
                No recent reviews yet.
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Recently shortlisted + Film queue */}
      <div className="grid gap-6 lg:grid-cols-[1.05fr_0.95fr]">
        <Card className="scouting-surface overflow-hidden">
          <CardHeader className="flex-row items-center justify-between">
            <div>
              <CardTitle>Recently shortlisted</CardTitle>
              <p className="text-sm text-slate-600">Fresh movement into internal recruiting stages.</p>
            </div>
            <Button asChild variant="outline">
              <Link href="/shortlist">
                Shortlist board
                <Layers3 className="h-4 w-4" />
              </Link>
            </Button>
          </CardHeader>
          <CardContent className="grid gap-3">
            {recentShortlisted.length ? (
              recentShortlisted.map((item) => (
                <div key={item.id} className="rounded-[24px] border border-l-4 border-l-cyan-400 bg-white/[0.88] p-4 shadow-[0_12px_28px_rgba(15,23,42,0.06)]">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="field-label text-[#52695d]">
                        {item.need?.title ?? "Shortlist update"} • {formatDate(item.updated_at ?? item.created_at)}
                      </p>
                      <p className="font-semibold text-slate-950">
                        {item.player?.first_name} {item.player?.last_name}
                      </p>
                      <p className="text-sm text-slate-500">
                        {item.player?.current_school}
                      </p>
                    </div>
                    <Badge variant="accent">{item.stage}</Badge>
                  </div>
                  <p className="mt-2.5 text-sm text-slate-600">{item.latestNote ?? "No shortlist note attached."}</p>
                  <p className="mt-3 text-xs uppercase tracking-[0.2em] text-slate-500">
                    {item.fitScore !== null ? `Fit ${item.fitScore}` : "Staff eval pending"}
                    {item.player ? ` • ${getPlayerPrimaryProduction(item.player)}` : ""}
                  </p>
                </div>
              ))
            ) : (
              <div className="rounded-2xl border border-dashed bg-slate-50 p-5 text-sm text-slate-500">
                No shortlisted players yet.
              </div>
            )}
          </CardContent>
        </Card>

        {/* Film queue */}
        <Card className="overflow-hidden border-[#e7d8b3] bg-[linear-gradient(180deg,rgba(255,252,245,0.98),rgba(250,246,236,0.95))]">
          <CardHeader className="flex-row items-center justify-between">
            <div>
              <CardTitle>Needs Film Queue</CardTitle>
              <p className="text-sm text-slate-600">Players flagged for deeper tape work before board promotion.</p>
            </div>
            <Badge variant="warning">
              <Film className="mr-1 h-3 w-3" />
              {playersNeedingFilm}
            </Badge>
          </CardHeader>
        </Card>
      </div>
    </div>
  );
}
