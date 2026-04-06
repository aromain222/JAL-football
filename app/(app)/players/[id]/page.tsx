import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Film, PlayCircle, Radar, Trophy } from "lucide-react";
import { addPlayerToShortlistAction, markPlayerNeedsFilmAction } from "@/app/actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Paste247WriteUpForm } from "@/components/players/paste-247-writeup-form";
import { SourceNoteForm } from "@/components/players/source-note-form";
import {
  formatHeightInFeetInches,
  getPlayerKeyStats,
  getPlayerPhotoUrl,
  getPlayerProductionMetrics,
  getPlayerPrimaryProduction
} from "@/lib/football";
import { getPlayerProfileData } from "@/lib/data/queries";
import { FeaturedStats } from "@/components/players/featured-stats";
import { PffStatsGrid } from "@/components/players/pff-stats-grid";

export default async function PlayerDetailPage({
  params
}: {
  params: { id: string };
}) {
  const data = await getPlayerProfileData(params.id);
  if (!data) notFound();

  const { player, matchingNeeds, reviews, shortlists, sourceNotes, pffStats, schemeContext } = data;
  const topNeed = matchingNeeds[0]?.need ?? null;
  const currentShortlist = shortlists[0] ?? null;
  const keyStats = getPlayerKeyStats(player);
  const productionMetrics = getPlayerProductionMetrics(player, 8);

  return (
    <div className="grid gap-6">
      <Card className="overflow-hidden border-none bg-[linear-gradient(145deg,#060c18_0%,#09192b_48%,#0f2941_72%,#0d4d67_100%)] text-white shadow-[0_35px_80px_rgba(8,15,33,0.34)]">
        <CardContent className="grid gap-8 p-8 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="flex items-start gap-5">
            <div className="relative h-28 w-28 overflow-hidden rounded-[28px] border border-white/10 bg-white/10 shadow-inner">
              <Image
                alt={`${player.first_name} ${player.last_name}`}
                className="object-cover"
                fill
                sizes="112px"
                src={getPlayerPhotoUrl(player)}
              />
            </div>
            <div>
              <p className="text-xs uppercase tracking-[0.32em] text-cyan-300">{player.position}</p>
              <h1 className="mt-3 text-5xl font-semibold tracking-tight">
                {player.first_name} {player.last_name}
              </h1>
              <p className="mt-3 text-lg text-slate-300">
                {player.current_school} • {player.class_year} • {player.eligibility_remaining} years remaining
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                <Badge>{player.position}</Badge>
                <Badge variant="accent">{player.status}</Badge>
                {player.stars ? <Badge variant="warning">{player.stars}-star</Badge> : null}
                {currentShortlist ? <Badge variant="success">{currentShortlist.stage}</Badge> : null}
              </div>
            </div>
          </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <HeroMetric
                label="Height / Weight"
                value={`${formatHeightInFeetInches(player.measurements?.height_in)} / ${player.measurements?.weight_lbs ?? "--"}`}
              />
              <HeroMetric label="Arm / Forty" value={`${player.measurements?.arm_length_in ?? "--"} / ${player.measurements?.forty_time ? `${player.measurements.forty_time}s` : "--"}`} />
              <HeroMetric
              label="Starts / Games"
              value={`${player.latest_stats?.starts ?? 0} / ${player.latest_stats?.games_played ?? 0}`}
            />
            <HeroMetric label="Board Fit" value={matchingNeeds[0] ? `${matchingNeeds[0].fit.fitScore}` : "--"} />
          </div>
        </CardContent>
      </Card>

      <FeaturedStats schemeContext={schemeContext} />

      <div className="grid gap-6 lg:grid-cols-[1.05fr_0.95fr]">
        <div className="grid gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Profile Overview</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4">
              <div className="grid gap-4 sm:grid-cols-3">
                <MetricCard label="Height" value={formatHeightInFeetInches(player.measurements?.height_in)} />
                <MetricCard label="Weight" value={player.measurements?.weight_lbs ? `${player.measurements.weight_lbs} lbs` : "--"} />
                <MetricCard label="Wing / Arm" value={player.measurements?.wing_span_in ? `${player.measurements.wing_span_in}" span` : player.measurements?.arm_length_in ? `${player.measurements.arm_length_in}" arm` : "--"} />
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                {keyStats.map((stat) => (
                  <div key={stat} className="rounded-3xl border bg-slate-50 px-4 py-3 text-sm font-medium text-slate-700">
                    {stat}
                  </div>
                ))}
              </div>
              <div className="rounded-3xl border bg-slate-50 p-5">
                <p className="text-xs uppercase tracking-[0.24em] text-slate-500">Latest notes</p>
                <p className="mt-3 text-sm text-slate-700">
                  {reviews[0]?.note ?? player.notes ?? "No recent note attached."}
                </p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex-row items-center justify-between">
              <CardTitle>Production Stats</CardTitle>
              <Badge variant="default">{player.latest_stats?.season ?? "No season"}</Badge>
            </CardHeader>
            <CardContent className="grid gap-4">
              {!player.latest_stats && (
                <p className="col-span-full text-sm text-slate-500">
                  Stats come from Sportradar. Run <code className="rounded bg-slate-100 px-1">npm run enrich:stats</code> to backfill (≈1 sec per player).
                </p>
              )}
              <div className="rounded-3xl border bg-slate-50 p-5">
                <p className="text-xs uppercase tracking-[0.24em] text-slate-500">Primary production signal</p>
                <p className="mt-3 text-2xl font-semibold text-slate-950">
                  {getPlayerPrimaryProduction(player)}
                </p>
                <p className="mt-2 text-sm text-slate-600">
                  Latest imported season used on board cards, fit ranking, and review context.
                </p>
              </div>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                {productionMetrics.map((metric) => (
                  <MetricCard key={metric.label} label={metric.label} value={metric.value} />
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>PFF Grades &amp; Stats</CardTitle>
            </CardHeader>
            <CardContent>
              <PffStatsGrid pffStats={pffStats ?? null} position={player.position} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Review History</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-3">
              {reviews.length ? (
                reviews.map((review) => (
                  <div key={review.id} className="rounded-3xl border bg-slate-50 p-4">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant={review.decision === "right" ? "success" : review.decision === "needs_film" ? "warning" : "default"}>
                        {review.decision}
                      </Badge>
                      <Badge variant="accent">Fit {review.fit_score}</Badge>
                    </div>
                    <p className="mt-3 text-sm text-slate-700">{review.note ?? "No note recorded."}</p>
                  </div>
                ))
              ) : (
                <div className="rounded-3xl border border-dashed bg-slate-50 p-5 text-sm text-slate-500">
                  No review history for this player yet.
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Quick Actions</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-3">
              {topNeed ? (
                <>
                  <form action={addPlayerToShortlistAction.bind(null, { playerId: player.id, needId: topNeed.id })}>
                    <Button className="w-full justify-between" type="submit">
                      Add to shortlist
                      <Trophy className="h-4 w-4" />
                    </Button>
                  </form>
                  <form action={markPlayerNeedsFilmAction.bind(null, { playerId: player.id, needId: topNeed.id })}>
                    <Button className="w-full justify-between" type="submit" variant="secondary">
                      Mark needs film
                      <Film className="h-4 w-4" />
                    </Button>
                  </form>
                  <Button asChild className="w-full justify-between" variant="outline">
                    <Link href={`/review/${topNeed.id}`}>
                      Open review mode
                      <Radar className="h-4 w-4" />
                    </Link>
                  </Button>
                </>
              ) : (
                <div className="rounded-3xl border border-dashed bg-slate-50 p-5 text-sm text-slate-500">
                  No matching active need is available for direct actions.
                </div>
              )}
            </CardContent>
          </Card>

          <Paste247WriteUpForm playerId={player.id} />

          <Card>
            <CardHeader>
              <CardTitle>Source Notes</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4">
              <SourceNoteForm playerId={player.id} />

              <div className="grid gap-3">
                {sourceNotes.length ? (
                  sourceNotes.map((note) => (
                    <div key={note.id} className="rounded-3xl border bg-slate-50 p-4">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge variant="default">{note.note_type}</Badge>
                        {note.source_account ? <Badge variant="accent">@{note.source_account}</Badge> : null}
                        {note.status_signal ? <Badge variant="warning">{note.status_signal}</Badge> : null}
                        {note.confidence !== null ? <Badge variant="success">{note.confidence.toFixed(1)} conf</Badge> : null}
                      </div>
                      {note.summary ? <p className="mt-3 text-sm font-medium text-slate-900">{note.summary}</p> : null}
                      <p className="mt-2 text-sm text-slate-700">{note.source_text}</p>
                      <div className="mt-3 flex flex-wrap gap-2">
                        {note.traits.map((trait) => (
                          <Badge key={trait} variant="default">
                            {trait}
                          </Badge>
                        ))}
                        {note.source_url ? (
                          <Button asChild size="sm" variant="outline">
                            <Link href={note.source_url} target="_blank">
                              Source
                            </Link>
                          </Button>
                        ) : null}
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="rounded-3xl border border-dashed bg-slate-50 p-5 text-sm text-slate-500">
                    No source notes saved yet.
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Highlight & Film</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-3">
              {player.film_url ? (
                <>
                  <Button asChild className="w-full justify-between" variant="outline">
                    <Link href={player.film_url} target="_blank">
                      Short highlight
                      <PlayCircle className="h-4 w-4" />
                    </Link>
                  </Button>
                  <Button asChild className="w-full justify-between" variant="outline">
                    <Link href={player.film_url} target="_blank">
                      Full film
                      <Film className="h-4 w-4" />
                    </Link>
                  </Button>
                </>
              ) : (
                <div className="rounded-3xl border border-dashed bg-slate-50 p-5 text-sm text-slate-500">
                  No highlight or film link is attached for this player yet.
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Fit Scores For Active Needs</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-3">
              {matchingNeeds.length ? (
                matchingNeeds.map(({ need, fit, shortlist, latestReview }) => (
                  <div key={need.id} className="rounded-3xl border bg-slate-50 p-4">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-xs uppercase tracking-[0.24em] text-slate-500">{need.position}</p>
                        <h3 className="mt-1 text-lg font-semibold text-slate-950">{need.title}</h3>
                      </div>
                      <Badge variant={fit.fitScore >= 85 ? "success" : fit.fitScore >= 72 ? "accent" : "warning"}>
                        {fit.fitScore} fit
                      </Badge>
                    </div>
                    <p className="mt-3 text-sm text-slate-700">{fit.fitSummary}</p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <Badge variant="default">Prod {fit.productionScore}</Badge>
                      <Badge variant="default">Measure {fit.measurementScore}</Badge>
                      {shortlist ? <Badge variant="success">{shortlist.stage}</Badge> : null}
                    </div>
                    <p className="mt-3 text-sm text-slate-600">
                      {latestReview?.note ?? need.notes ?? "No attached review note yet."}
                    </p>
                    <div className="mt-4 flex gap-3">
                      <Button asChild variant="outline">
                        <Link href={`/needs/${need.id}`}>Need detail</Link>
                      </Button>
                      <Button asChild>
                        <Link href={`/review/${need.id}`}>Open review</Link>
                      </Button>
                    </div>
                  </div>
                ))
              ) : (
                <div className="rounded-3xl border border-dashed bg-slate-50 p-5 text-sm text-slate-500">
                  No active team needs match this player’s position group.
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Shortlist Status</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-3">
              {shortlists.length ? (
                shortlists.map((item) => (
                  <div key={item.id} className="rounded-3xl border bg-slate-50 p-4">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-slate-900">Need {item.need_id.slice(0, 8)}</span>
                      <Badge variant="success">{item.stage}</Badge>
                    </div>
                    <p className="mt-2 text-sm text-slate-600">{item.note ?? "No shortlist note attached."}</p>
                  </div>
                ))
              ) : (
                <div className="rounded-3xl border border-dashed bg-slate-50 p-5 text-sm text-slate-500">
                  This player is not currently on a shortlist.
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

function HeroMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[28px] border border-white/10 bg-white/10 p-4 backdrop-blur">
      <p className="text-xs uppercase tracking-[0.24em] text-slate-300">{label}</p>
      <div className="mt-3 text-2xl font-semibold text-white">{value}</div>
    </div>
  );
}

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-3xl border bg-slate-50 p-4">
      <p className="text-xs uppercase tracking-[0.24em] text-slate-500">{label}</p>
      <div className="mt-3 text-2xl font-semibold text-slate-950">{value}</div>
    </div>
  );
}
