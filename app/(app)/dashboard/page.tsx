import Link from "next/link";
import { ArrowRight, Clock3, Eye, Film, Layers3, Radar, Target } from "lucide-react";
import { SectionHeader } from "@/components/section-header";
import { StatCard } from "@/components/stat-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getPlayerPrimaryProduction } from "@/lib/football";
import { Player } from "@/lib/types";
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
    .sort((a, b) => b.created_at.localeCompare(a.created_at))
    .slice(0, 4);

  const topCandidatesByNeed = (
    await Promise.all(
      needs
        .filter((need) => need.status === "active")
        .slice(0, 3)
        .map(async (need) => {
          const candidates = (await getPlayers({
            needId: need.id,
            position: need.position,
            heightMin: need.min_height_in ?? undefined,
            heightMax: need.max_height_in ?? undefined,
            weightMin: need.min_weight_lbs ?? undefined,
            weightMax: need.max_weight_lbs ?? undefined,
            armLengthMin: need.min_arm_length_in ?? undefined,
            fortyMax: need.max_forty_time ?? undefined,
            yearsRemainingMin: need.min_years_remaining ?? undefined,
            minFit: 70
          })) as Array<{
            player: Pick<Player, "id" | "first_name" | "last_name" | "current_school" | "position" | "latest_stats">;
            fitScore: number;
            fitSummary: string;
          }>;

          return {
            need,
            candidates: candidates.slice(0, 2)
          };
        })
    )
  ).filter((entry) => entry.candidates.length > 0);

  const activityFeed = [
    ...recentReviews.map((review) => ({
      id: review.id,
      type: "review" as const,
      created_at: review.created_at,
      label: review.decision,
      detail: review.note ?? "Review logged without note.",
      meta: `Fit ${review.fit_score}`
    })),
    ...recentShortlisted.map((item) => ({
      id: item.id,
      type: "shortlist" as const,
      created_at: item.created_at,
      label: item.stage,
      detail:
        item.player
          ? `${item.player.first_name} ${item.player.last_name} moved into shortlist.`
          : "Player moved into shortlist.",
      meta: item.need?.title ?? "Shortlist update"
    }))
  ]
    .sort((a, b) => b.created_at.localeCompare(a.created_at))
    .slice(0, 6);

  return (
    <div className="grid gap-6">
      {/* Hero card */}
      <Card className="relative overflow-hidden border-none bg-[linear-gradient(145deg,#06101c_0%,#0f2740_52%,#0e7490_100%)] text-white shadow-[0_40px_90px_rgba(8,15,33,0.38)]">
        {/* Decorative grid overlay */}
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.04]"
          style={{
            backgroundImage:
              "repeating-linear-gradient(0deg,transparent,transparent 39px,rgba(255,255,255,1) 39px,rgba(255,255,255,1) 40px),repeating-linear-gradient(90deg,transparent,transparent 39px,rgba(255,255,255,1) 39px,rgba(255,255,255,1) 40px)"
          }}
        />
        {/* Top cyan glow */}
        <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-cyan-400/50 to-transparent" />
        <CardContent className="relative grid gap-8 p-8 lg:grid-cols-[1.1fr_0.9fr]">
          <SectionHeader
            eyebrow="Control Room"
            title="Transfer board status"
            description="Track roster needs, move quickly through first-pass eval, and keep the internal board moving toward coordinator and head coach review."
            cta={{ label: "Create new need", href: "/needs/new" }}
          />
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="rounded-3xl border border-white/15 bg-white/10 p-5 backdrop-blur ring-1 ring-inset ring-white/8">
              <p className="text-[10px] font-semibold uppercase tracking-[0.3em] text-slate-300/80">Portal pipeline</p>
              <div className="mt-3 text-5xl font-bold tracking-tight">{formatNumber(metrics.totalPlayers)}</div>
              <p className="mt-2 text-sm text-slate-300/70">Imported players live in the internal eval board.</p>
            </div>
            <div className="rounded-3xl border border-white/15 bg-white/10 p-5 backdrop-blur ring-1 ring-inset ring-white/8">
              <p className="text-[10px] font-semibold uppercase tracking-[0.3em] text-slate-300/80">Shortlisted now</p>
              <div className="mt-3 text-5xl font-bold tracking-tight">{metrics.shortlistedPlayers}</div>
              <p className="mt-2 text-sm text-slate-300/70">Players currently held in staff review stages.</p>
            </div>
          </div>
        </CardContent>
      </Card>

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
        <Card>
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
                  "flex flex-col gap-4 rounded-2xl border bg-white p-5 shadow-sm transition hover:shadow-md lg:flex-row lg:items-center lg:justify-between",
                  need.priority === "critical"
                    ? "border-l-4 border-l-rose-400"
                    : "border-l-4 border-l-cyan-400"
                )}
              >
                <div>
                  <div className="flex items-center gap-2">
                    <Badge variant={need.priority === "critical" ? "destructive" : "accent"}>{need.priority}</Badge>
                    <Badge>{need.position}</Badge>
                  </div>
                  <h3 className="mt-3 text-lg font-semibold text-slate-950">{need.title}</h3>
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
        <Card>
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
                      <div className="flex-1 rounded-2xl border bg-white p-4 shadow-sm">
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

      <div className="grid gap-6 lg:grid-cols-[1.05fr_0.95fr]">
        {/* Top candidates */}
        <Card>
          <CardHeader className="flex-row items-center justify-between">
            <div>
              <CardTitle>Top matching candidates</CardTitle>
              <p className="text-sm text-slate-600">Best current fits surfaced for each active need.</p>
            </div>
            <Button asChild variant="outline">
              <Link href="/players">
                Open board
                <Target className="h-4 w-4" />
              </Link>
            </Button>
          </CardHeader>
          <CardContent className="grid gap-4">
            {topCandidatesByNeed.length ? (
              topCandidatesByNeed.map(({ need, candidates }) => (
                <div key={need.id} className="rounded-2xl border bg-slate-50/60 p-5">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge>{need.position}</Badge>
                    <Badge variant={need.priority === "critical" ? "destructive" : "accent"}>{need.priority}</Badge>
                  </div>
                  <h3 className="mt-2.5 text-lg font-semibold text-slate-950">{need.title}</h3>
                  <div className="mt-3 grid gap-2.5">
                    {candidates.map((candidate) => (
                      <div key={candidate.player.id} className="rounded-2xl border-l-4 border-l-emerald-400 bg-white px-4 py-3 shadow-sm">
                        <div className="flex items-center justify-between gap-3">
                          <div>
                            <p className="font-semibold text-slate-950">
                              {candidate.player.first_name} {candidate.player.last_name}
                            </p>
                            <p className="text-sm text-slate-500">
                              {candidate.player.current_school} • {candidate.player.position}
                            </p>
                          </div>
                          <Badge variant="success">{candidate.fitScore} fit</Badge>
                        </div>
                        <p className="mt-2 text-sm text-slate-600">{candidate.fitSummary}</p>
                        <p className="mt-1.5 text-sm text-slate-500">{getPlayerPrimaryProduction(candidate.player)}</p>
                        <div className="mt-3 flex gap-2">
                          <Button asChild size="sm" variant="outline">
                            <Link href={`/players/${candidate.player.id}`}>
                              <Eye className="h-4 w-4" />
                              Profile
                            </Link>
                          </Button>
                          <Button asChild size="sm">
                            <Link href={`/review/${need.id}`}>Review</Link>
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))
            ) : (
              <div className="rounded-2xl border border-dashed bg-slate-50 p-5 text-sm text-slate-500">
                No high-fit candidates surfaced yet for active needs.
              </div>
            )}
          </CardContent>
        </Card>

        {/* Recently shortlisted */}
        <Card>
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
                <div key={item.id} className="rounded-2xl border border-l-4 border-l-cyan-400 bg-white p-4 shadow-sm">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="font-semibold text-slate-950">
                        {item.player?.first_name} {item.player?.last_name}
                      </p>
                      <p className="text-sm text-slate-500">
                        {item.player?.current_school} • {item.need?.title}
                      </p>
                    </div>
                    <Badge variant="accent">{item.stage}</Badge>
                  </div>
                  <p className="mt-2.5 text-sm text-slate-600">{item.latestNote ?? "No shortlist note attached."}</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {item.fitScore !== null ? <Badge variant="success">{item.fitScore} fit</Badge> : null}
                    <Badge variant="default">{formatDate(item.created_at)}</Badge>
                    {item.player ? <Badge variant="default">{getPlayerPrimaryProduction(item.player)}</Badge> : null}
                  </div>
                </div>
              ))
            ) : (
              <div className="rounded-2xl border border-dashed bg-slate-50 p-5 text-sm text-slate-500">
                No shortlisted players yet.
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Film queue */}
      <Card className="border-amber-100/80 bg-white/95">
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
  );
}
