import Link from "next/link";
import { ArrowRight, Clock3, Eye, Film, Layers3, Radar, Target } from "lucide-react";
import { SectionHeader } from "@/components/section-header";
import { StatCard } from "@/components/stat-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getPlayerPrimaryProduction } from "@/lib/football";
import { Player } from "@/lib/types";
import { formatDate, formatNumber } from "@/lib/utils";
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
      <Card className="overflow-hidden border-none bg-[linear-gradient(145deg,#07111d_0%,#0f2740_52%,#0e7490_100%)] text-white shadow-[0_35px_80px_rgba(8,15,33,0.32)]">
        <CardContent className="grid gap-8 p-8 lg:grid-cols-[1.1fr_0.9fr]">
          <SectionHeader
            eyebrow="Control Room"
            title="Transfer board status"
            description="Track roster needs, move quickly through first-pass eval, and keep the internal board moving toward coordinator and head coach review."
            cta={{ label: "Create new need", href: "/needs/new" }}
          />
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="rounded-3xl border border-white/10 bg-white/10 p-5 backdrop-blur">
              <p className="text-xs uppercase tracking-[0.3em] text-slate-300">Portal pipeline</p>
              <div className="mt-4 text-4xl font-semibold">{formatNumber(metrics.totalPlayers)}</div>
              <p className="mt-2 text-sm text-slate-300">Imported players live in the internal eval board.</p>
            </div>
            <div className="rounded-3xl border border-white/10 bg-white/10 p-5 backdrop-blur">
              <p className="text-xs uppercase tracking-[0.3em] text-slate-300">Shortlisted now</p>
              <div className="mt-4 text-4xl font-semibold">{metrics.shortlistedPlayers}</div>
              <p className="mt-2 text-sm text-slate-300">Players currently held in staff review stages.</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-5">
        <StatCard label="Active needs" value={String(metrics.activeNeeds)} hint="Open recruiting priorities" />
        <StatCard label="Total players" value={String(metrics.totalPlayers)} hint="Searchable transfer board" />
        <StatCard label="Shortlisted" value={String(metrics.shortlistedPlayers)} hint="Advancing to internal stages" />
        <StatCard label="Recent reviews" value={String(metrics.recentReviews)} hint="Last 14 days of eval activity" />
        <StatCard label="Needs film" value={String(playersNeedingFilm)} hint="Profiles flagged for deeper tape work" />
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.05fr_0.95fr]">
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
          <CardContent className="grid gap-4">
            {needs.map((need) => (
              <div key={need.id} className="flex flex-col gap-4 rounded-3xl border bg-slate-50 p-5 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <Badge variant={need.priority === "critical" ? "destructive" : "accent"}>{need.priority}</Badge>
                    <Badge>{need.position}</Badge>
                  </div>
                  <h3 className="mt-3 text-xl font-semibold">{need.title}</h3>
                  <p className="mt-1 text-sm text-slate-600">{need.notes}</p>
                </div>
                <div className="flex gap-3">
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

        <Card>
          <CardHeader>
            <CardTitle>Recent activity</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3">
            {activityFeed.length ? (
              activityFeed.map((item) => (
                <div key={item.id} className="rounded-3xl border bg-slate-50 p-4">
                  <div className="flex items-center justify-between">
                    <Badge variant={item.type === "shortlist" ? "accent" : item.label === "right" ? "success" : item.label === "needs_film" ? "warning" : "default"}>
                      {item.label}
                    </Badge>
                    <div className="flex items-center gap-2 text-xs uppercase tracking-[0.24em] text-slate-500">
                      <Clock3 className="h-3.5 w-3.5" />
                      {formatDate(item.created_at)}
                    </div>
                  </div>
                  <p className="mt-3 text-sm font-medium text-slate-900">{item.detail}</p>
                  <p className="mt-2 text-sm text-slate-600">{item.meta}</p>
                </div>
              ))
            ) : (
              <div className="rounded-3xl border border-dashed bg-slate-50 p-5 text-sm text-slate-500">
                No recent reviews yet.
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.05fr_0.95fr]">
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
                <div key={need.id} className="rounded-3xl border bg-slate-50 p-5">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge>{need.position}</Badge>
                    <Badge variant={need.priority === "critical" ? "destructive" : "accent"}>{need.priority}</Badge>
                  </div>
                  <h3 className="mt-3 text-xl font-semibold">{need.title}</h3>
                  <div className="mt-4 grid gap-3">
                    {candidates.map((candidate) => (
                        <div key={candidate.player.id} className="rounded-2xl border bg-white px-4 py-3">
                          <div className="flex items-center justify-between gap-3">
                            <div>
                              <p className="font-medium text-slate-950">
                                {candidate.player.first_name} {candidate.player.last_name}
                            </p>
                            <p className="text-sm text-slate-600">
                              {candidate.player.current_school} • {candidate.player.position}
                            </p>
                          </div>
                          <Badge variant="success">{candidate.fitScore} fit</Badge>
                          </div>
                          <p className="mt-2 text-sm text-slate-600">{candidate.fitSummary}</p>
                          <p className="mt-2 text-sm text-slate-700">{getPlayerPrimaryProduction(candidate.player)}</p>
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
              <div className="rounded-3xl border border-dashed bg-slate-50 p-5 text-sm text-slate-500">
                No high-fit candidates surfaced yet for active needs.
              </div>
            )}
          </CardContent>
        </Card>

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
                <div key={item.id} className="rounded-3xl border bg-slate-50 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="font-medium text-slate-950">
                        {item.player?.first_name} {item.player?.last_name}
                      </p>
                      <p className="text-sm text-slate-600">
                        {item.player?.current_school} • {item.need?.title}
                      </p>
                    </div>
                    <Badge variant="accent">{item.stage}</Badge>
                  </div>
                  <p className="mt-3 text-sm text-slate-700">{item.latestNote ?? "No shortlist note attached."}</p>
                  <div className="mt-3 flex gap-2">
                    {item.fitScore !== null ? <Badge variant="success">{item.fitScore} fit</Badge> : null}
                    <Badge variant="default">{formatDate(item.created_at)}</Badge>
                    {item.player ? <Badge variant="default">{getPlayerPrimaryProduction(item.player)}</Badge> : null}
                  </div>
                </div>
              ))
            ) : (
              <div className="rounded-3xl border border-dashed bg-slate-50 p-5 text-sm text-slate-500">
                No shortlisted players yet.
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card className="border-amber-100 bg-white/95">
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
