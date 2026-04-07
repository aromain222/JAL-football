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
  getPlayerPrimaryProduction,
} from "@/lib/football";
import { getPlayerProfileData } from "@/lib/data/queries";
import { PffStatsGrid } from "@/components/players/pff-stats-grid";
import { AlignmentProfile } from "@/components/players/alignment-profile";

export default async function PlayerDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const data = await getPlayerProfileData(params.id);
  if (!data) notFound();

  const { player, matchingNeeds, reviews, shortlists, sourceNotes, pffStats } = data;
  const topNeed = matchingNeeds[0]?.need ?? null;
  const currentShortlist = shortlists[0] ?? null;
  const keyStats = getPlayerKeyStats(player);
  const productionMetrics = getPlayerProductionMetrics(player, 8);
  const pffOverall = pffStats?.grades_overall != null ? Number(pffStats.grades_overall).toFixed(1) : null;

  return (
    <div className="grid gap-5">
      {/* ── Hero ─────────────────────────────────────────────────────── */}
      <Card className="overflow-hidden border-none bg-[linear-gradient(145deg,#060c18_0%,#09192b_48%,#0f2941_72%,#0d4d67_100%)] text-white shadow-[0_35px_80px_rgba(8,15,33,0.34)]">
        <CardContent className="grid gap-8 p-8 lg:grid-cols-[1.2fr_0.8fr]">
          {/* Left: identity */}
          <div className="flex items-start gap-5">
            <div className="relative h-28 w-28 shrink-0 overflow-hidden rounded-[28px] border border-white/10 bg-white/10 shadow-inner">
              <Image
                alt={`${player.first_name} ${player.last_name}`}
                className="object-cover"
                fill
                sizes="112px"
                src={getPlayerPhotoUrl(player)}
              />
            </div>
            <div className="min-w-0">
              <p className="text-[10px] font-semibold uppercase tracking-[0.36em] text-cyan-300">
                {player.position}
              </p>
              <h1 className="mt-2 text-4xl font-bold tracking-tight sm:text-5xl">
                {player.first_name} {player.last_name}
              </h1>
              <p className="mt-2 text-sm text-slate-300">
                {player.current_school} &nbsp;·&nbsp; {player.class_year} &nbsp;·&nbsp;{" "}
                {player.eligibility_remaining} yrs remaining
              </p>
              <div className="mt-3 flex flex-wrap gap-1.5">
                <Badge>{player.position}</Badge>
                <Badge variant="accent">{player.status}</Badge>
                {player.stars ? <Badge variant="warning">{player.stars}-star</Badge> : null}
                {currentShortlist ? <Badge variant="success">{currentShortlist.stage}</Badge> : null}
              </div>
            </div>
          </div>

          {/* Right: metrics grid */}
          <div className="grid grid-cols-2 gap-3">
            <HeroMetric
              label="Height / Weight"
              value={`${formatHeightInFeetInches(player.measurements?.height_in)} / ${player.measurements?.weight_lbs ?? "--"} lbs`}
            />
            <HeroMetric
              label="Arm / Forty"
              value={`${player.measurements?.arm_length_in ?? "--"}" / ${player.measurements?.forty_time ? `${player.measurements.forty_time}s` : "--"}`}
            />
            <HeroMetric
              label="Starts / Games"
              value={`${player.latest_stats?.starts ?? 0} / ${player.latest_stats?.games_played ?? 0}`}
            />
            {pffOverall ? (
              <HeroMetric label="PFF Overall" value={pffOverall} highlight />
            ) : (
              <HeroMetric
                label="Board Fit"
                value={matchingNeeds[0] ? `${matchingNeeds[0].fit.fitScore}` : "--"}
              />
            )}
          </div>
        </CardContent>
      </Card>

      {/* ── Two-column grid ──────────────────────────────────────────── */}
      <div className="grid gap-5 lg:grid-cols-[1.1fr_0.9fr]">

        {/* ── Left column ── */}
        <div className="grid gap-5">

          {/* Key stats + latest note */}
          {(keyStats.length > 0 || reviews[0]?.note || player.notes) && (
            <Card>
              <CardContent className="grid gap-4 pt-6">
                {keyStats.length > 0 && (
                  <div className="grid gap-2 sm:grid-cols-2">
                    {keyStats.map((stat) => (
                      <div
                        key={stat}
                        className="rounded-2xl border border-slate-100 bg-white px-4 py-2.5 text-sm font-medium text-slate-700"
                      >
                        {stat}
                      </div>
                    ))}
                  </div>
                )}

                {(reviews[0]?.note || player.notes) && (
                  <div className="rounded-2xl border border-slate-100 bg-white p-4">
                    <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-400">
                      Latest note
                    </p>
                    <p className="mt-2 border-l-2 border-cyan-200 pl-3 text-sm text-slate-700">
                      {reviews[0]?.note ?? player.notes}
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Production Stats */}
          <Card>
            <CardHeader className="flex-row items-center justify-between">
              <CardTitle>Production Stats</CardTitle>
              {player.latest_stats?.season && (
                <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-semibold text-slate-500">
                  {player.latest_stats.season}
                </span>
              )}
            </CardHeader>
            <CardContent className="grid gap-4">
              {!player.latest_stats ? (
                <p className="text-sm text-slate-500">
                  No stats yet. Run{" "}
                  <code className="rounded bg-slate-100 px-1 text-xs">npm run enrich:stats</code> to
                  backfill.
                </p>
              ) : (
                <>
                  <div className="rounded-2xl border border-slate-100 bg-white p-4">
                    <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-400">
                      Primary signal
                    </p>
                    <p className="mt-2 text-2xl font-bold text-slate-900">
                      {getPlayerPrimaryProduction(player)}
                    </p>
                  </div>
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                    {productionMetrics.map((metric) => (
                      <StatTile key={metric.label} label={metric.label} value={metric.value} />
                    ))}
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          {/* PFF Intelligence */}
          <Card>
            <CardHeader>
              <CardTitle>PFF Intelligence</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-6">
              <PffStatsGrid pffStats={pffStats ?? null} position={player.position} />
              <AlignmentProfile pffStats={pffStats ?? null} position={player.position} />
            </CardContent>
          </Card>

          {/* Review History */}
          <Card>
            <CardHeader>
              <CardTitle>Review History</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-3">
              {reviews.length ? (
                reviews.map((review) => (
                  <div key={review.id} className="rounded-2xl border border-slate-100 bg-white p-4">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge
                        variant={
                          review.decision === "right"
                            ? "success"
                            : review.decision === "needs_film"
                            ? "warning"
                            : "default"
                        }
                      >
                        {review.decision}
                      </Badge>
                      <Badge variant="accent">Fit {review.fit_score}</Badge>
                    </div>
                    <p className="mt-3 border-l-2 border-slate-200 pl-3 text-sm text-slate-700">
                      {review.note ?? "No note recorded."}
                    </p>
                  </div>
                ))
              ) : (
                <div className="rounded-2xl border border-dashed border-slate-200 p-5 text-sm text-slate-400">
                  No review history yet.
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* ── Right column ── */}
        <div className="grid gap-5 self-start">

          {/* Quick Actions — only shown when there's a matching need */}
          {topNeed && (
            <Card>
              <CardHeader>
                <CardTitle>Quick Actions</CardTitle>
              </CardHeader>
              <CardContent className="grid gap-2.5">
                <form
                  action={addPlayerToShortlistAction.bind(null, {
                    playerId: player.id,
                    needId: topNeed.id,
                  })}
                >
                  <Button className="w-full justify-between" type="submit">
                    Add to shortlist
                    <Trophy className="h-4 w-4" />
                  </Button>
                </form>
                <form
                  action={markPlayerNeedsFilmAction.bind(null, {
                    playerId: player.id,
                    needId: topNeed.id,
                  })}
                >
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
              </CardContent>
            </Card>
          )}

          {/* Board Fit */}
          <Card>
            <CardHeader>
              <CardTitle>Board Fit</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-3">
              {matchingNeeds.length ? (
                matchingNeeds.map(({ need, fit, shortlist, latestReview }) => (
                  <div key={need.id} className="rounded-2xl border border-slate-100 bg-white p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-400">
                          {need.position}
                        </p>
                        <h3 className="mt-0.5 truncate text-sm font-semibold text-slate-900">
                          {need.title}
                        </h3>
                      </div>
                      <span
                        className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-bold tabular-nums ${
                          fit.fitScore >= 85
                            ? "bg-emerald-100 text-emerald-700"
                            : fit.fitScore >= 72
                            ? "bg-sky-100 text-sky-700"
                            : "bg-amber-100 text-amber-700"
                        }`}
                      >
                        {fit.fitScore}
                      </span>
                    </div>

                    {/* Fit bar */}
                    <div className="mt-2.5 h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
                      <div
                        className={`h-1.5 rounded-full transition-all ${
                          fit.fitScore >= 85
                            ? "bg-emerald-500"
                            : fit.fitScore >= 72
                            ? "bg-sky-500"
                            : "bg-amber-400"
                        }`}
                        style={{ width: `${fit.fitScore}%` }}
                      />
                    </div>

                    <p className="mt-2.5 text-xs text-slate-600">{fit.fitSummary}</p>

                    <div className="mt-2 flex flex-wrap gap-1.5">
                      <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-500">
                        Prod {fit.productionScore}
                      </span>
                      <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-500">
                        Measure {fit.measurementScore}
                      </span>
                      {shortlist && <Badge variant="success">{shortlist.stage}</Badge>}
                    </div>

                    {latestReview?.note && (
                      <p className="mt-2.5 border-l-2 border-slate-200 pl-2.5 text-xs text-slate-500">
                        {latestReview.note}
                      </p>
                    )}

                    <div className="mt-3 flex gap-2">
                      <Button asChild size="sm" variant="outline">
                        <Link href={`/needs/${need.id}`}>Need</Link>
                      </Button>
                      <Button asChild size="sm">
                        <Link href={`/review/${need.id}`}>Review</Link>
                      </Button>
                    </div>
                  </div>
                ))
              ) : (
                <div className="rounded-2xl border border-dashed border-slate-200 p-5 text-sm text-slate-400">
                  No active needs match this player's position.
                </div>
              )}
            </CardContent>
          </Card>

          {/* 247 Write-up */}
          <Paste247WriteUpForm playerId={player.id} />

          {/* Source Notes */}
          <Card>
            <CardHeader>
              <CardTitle>Source Notes</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4">
              <SourceNoteForm playerId={player.id} />
              <div className="grid gap-2.5">
                {sourceNotes.length ? (
                  sourceNotes.map((note) => (
                    <div key={note.id} className="rounded-2xl border border-slate-100 bg-white p-4">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <Badge variant="default">{note.note_type}</Badge>
                        {note.source_account && (
                          <Badge variant="accent">@{note.source_account}</Badge>
                        )}
                        {note.status_signal && (
                          <Badge variant="warning">{note.status_signal}</Badge>
                        )}
                        {note.confidence != null && (
                          <Badge variant="success">{note.confidence.toFixed(1)} conf</Badge>
                        )}
                      </div>
                      {note.summary && (
                        <p className="mt-2.5 text-sm font-semibold text-slate-900">{note.summary}</p>
                      )}
                      <p className="mt-1.5 border-l-2 border-cyan-100 pl-3 text-sm text-slate-600">
                        {note.source_text}
                      </p>
                      {(note.traits.length > 0 || note.source_url) && (
                        <div className="mt-2.5 flex flex-wrap gap-1.5">
                          {note.traits.map((trait) => (
                            <Badge key={trait} variant="default">
                              {trait}
                            </Badge>
                          ))}
                          {note.source_url && (
                            <Button asChild size="sm" variant="outline">
                              <Link href={note.source_url} target="_blank">
                                Source
                              </Link>
                            </Button>
                          )}
                        </div>
                      )}
                    </div>
                  ))
                ) : (
                  <div className="rounded-2xl border border-dashed border-slate-200 p-5 text-sm text-slate-400">
                    No source notes saved yet.
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Film */}
          <Card>
            <CardHeader>
              <CardTitle>Highlight &amp; Film</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-2.5">
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
                <div className="rounded-2xl border border-dashed border-slate-200 p-5 text-sm text-slate-400">
                  No film link attached yet.
                </div>
              )}
            </CardContent>
          </Card>

          {/* Shortlist Status */}
          {shortlists.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Shortlist Status</CardTitle>
              </CardHeader>
              <CardContent className="grid gap-2.5">
                {shortlists.map((item) => (
                  <div
                    key={item.id}
                    className="flex items-center justify-between rounded-2xl border border-slate-100 bg-white px-4 py-3"
                  >
                    <span className="text-sm font-medium text-slate-700">
                      Need {item.need_id.slice(0, 8)}
                    </span>
                    <Badge variant="success">{item.stage}</Badge>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}

/* ── Sub-components ──────────────────────────────────────────────── */

function HeroMetric({
  label,
  value,
  highlight = false,
}: {
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <div className="rounded-[22px] border border-white/10 bg-white/10 p-4 backdrop-blur">
      <p className="text-[10px] font-semibold uppercase tracking-[0.28em] text-slate-300">{label}</p>
      <div
        className={`mt-2 text-2xl font-bold ${
          highlight ? "text-cyan-300" : "text-white"
        }`}
      >
        {value}
      </div>
    </div>
  );
}

function StatTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-slate-100 bg-white p-3.5">
      <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-400">{label}</p>
      <div className="mt-2 text-xl font-bold text-slate-900">{value}</div>
    </div>
  );
}
