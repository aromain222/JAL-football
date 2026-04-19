import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Film, Radar, Trophy } from "lucide-react";
import { addPlayerToShortlistAction, markPlayerNeedsFilmAction } from "@/app/actions";
import { Badge } from "@/components/ui/badge";
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
import { FeaturedStats } from "@/components/players/featured-stats";
import { getPffPrimaryGrade } from "@/lib/pff/summary";
import { SchoolLogo } from "@/components/players/school-logo";
import { getSchoolLogoUrl } from "@/lib/school-logos";

export default async function PlayerDetailPage({
  params,
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
  const pffPrimary = getPffPrimaryGrade(pffStats ?? null, player.position);
  const pffOverall = pffPrimary ? pffPrimary.value.toFixed(1) : null;

  return (
    <div className="grid gap-5">
      {/* Hero */}
      <div className="rounded-2xl border border-[#e4e8e5] bg-white p-6">
        <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
          <div className="flex items-start gap-5">
            <div className="relative h-24 w-24 shrink-0 overflow-hidden rounded-2xl border border-[#e4e8e5] bg-[#f8f9fa]">
              <Image
                alt={`${player.first_name} ${player.last_name}`}
                className="object-cover"
                fill
                sizes="96px"
                src={getPlayerPhotoUrl(player)}
              />
            </div>
            <div className="min-w-0">
              <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[#9ca3af]">
                {player.position}
              </p>
              <h1 className="mt-0.5 text-[28px] font-bold tracking-tight text-[#111827]">
                {player.first_name} {player.last_name}
              </h1>
              <div className="mt-1 flex items-center gap-2 text-[13px] text-[#4b5563]">
                <SchoolLogo school={player.current_school} logoUrl={getSchoolLogoUrl(player.current_school)} size={16} />
                <span>{player.current_school} · {player.class_year} · {player.eligibility_remaining} yrs remaining</span>
              </div>
              <div className="mt-2 flex flex-wrap gap-1.5">
                <Badge>{player.position}</Badge>
                <Badge variant="accent">{player.status}</Badge>
                {currentShortlist ? <Badge variant="success">{currentShortlist.stage}</Badge> : null}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
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
              <HeroMetric label={`PFF ${pffPrimary?.label ?? "Grade"}`} value={pffOverall} highlight />
            ) : (
              <HeroMetric
                label="Board Fit"
                value={matchingNeeds[0] ? `${matchingNeeds[0].fit.fitScore}` : "--"}
              />
            )}
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-[#e4e8e5] bg-white p-5">
        <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.08em] text-[#9ca3af]">Featured Stats</p>
        <FeaturedStats schemeContext={schemeContext} />
      </div>

      <div className="grid gap-5 lg:grid-cols-[1.1fr_0.9fr]">
        <div className="grid gap-5">
          {(keyStats.length > 0 || reviews[0]?.note || player.notes) && (
            <div className="rounded-2xl border border-[#e4e8e5] bg-white p-5">
              <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.08em] text-[#9ca3af]">Key Stats</p>
              {keyStats.length > 0 && (
                <div className="grid gap-2 sm:grid-cols-2">
                  {keyStats.map((stat) => (
                    <div key={stat} className="rounded-xl border border-[#e4e8e5] bg-[#f8f9fa] px-4 py-2.5 text-[13px] font-medium text-[#4b5563]">
                      {stat}
                    </div>
                  ))}
                </div>
              )}
              {(reviews[0]?.note || player.notes) && (
                <div className="mt-3 rounded-xl border border-[#e4e8e5] bg-[#f8f9fa] p-4">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[#9ca3af]">Latest note</p>
                  <p className="mt-2 border-l-2 border-[#b8952a]/40 pl-3 text-[13px] text-[#4b5563]">
                    {reviews[0]?.note ?? player.notes}
                  </p>
                </div>
              )}
            </div>
          )}

          <div className="rounded-2xl border border-[#e4e8e5] bg-white p-5">
            <div className="mb-3 flex items-center justify-between">
              <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[#9ca3af]">Production Stats</p>
              {player.latest_stats?.season && (
                <span className="rounded-full bg-[#f1f5f2] px-2.5 py-1 text-[11px] font-semibold text-[#4b5563]">
                  {player.latest_stats.season}
                </span>
              )}
            </div>
            {!player.latest_stats ? (
              <p className="text-[13px] text-[#9ca3af]">
                No stats yet. Run{" "}
                <code className="rounded bg-[#f1f5f2] px-1 text-[12px]">npm run enrich:stats</code> to backfill.
              </p>
            ) : (
              <>
                <div className="mb-3 rounded-xl border border-[#e4e8e5] bg-[#f8f9fa] p-4">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[#9ca3af]">Primary signal</p>
                  <p className="mt-2 text-[20px] font-bold text-[#111827]">{getPlayerPrimaryProduction(player)}</p>
                </div>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                  {productionMetrics.map((metric) => (
                    <StatTile key={metric.label} label={metric.label} value={metric.value} />
                  ))}
                </div>
              </>
            )}
          </div>

          <div className="rounded-2xl border border-[#e4e8e5] bg-white p-5">
            <p className="mb-4 text-[11px] font-semibold uppercase tracking-[0.08em] text-[#9ca3af]">PFF Intelligence</p>
            <div className="grid gap-6">
              <PffStatsGrid pffStats={pffStats ?? null} position={player.position} />
              <AlignmentProfile pffStats={pffStats ?? null} position={player.position} />
            </div>
          </div>

          <div className="rounded-2xl border border-[#e4e8e5] bg-white p-5">
            <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.08em] text-[#9ca3af]">Review History</p>
            <div className="grid gap-3">
              {reviews.length ? (
                reviews.map((review) => (
                  <div key={review.id} className="rounded-xl border border-[#e4e8e5] bg-[#f8f9fa] p-4">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant={review.decision === "right" ? "success" : review.decision === "needs_film" ? "warning" : "default"}>
                        {review.decision}
                      </Badge>
                      <Badge variant="accent">Fit {review.fit_score}</Badge>
                    </div>
                    <p className="mt-3 border-l-2 border-[#e4e8e5] pl-3 text-[13px] text-[#4b5563]">
                      {review.note ?? "No note recorded."}
                    </p>
                  </div>
                ))
              ) : (
                <div className="rounded-xl border border-dashed border-[#e4e8e5] p-5 text-[13px] text-[#9ca3af]">
                  No review history yet.
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="grid gap-5 self-start">
          {topNeed && (
            <div className="rounded-2xl border border-[#e4e8e5] bg-white p-5">
              <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.08em] text-[#9ca3af]">Quick Actions</p>
              <div className="grid gap-2">
                <form action={addPlayerToShortlistAction.bind(null, { playerId: player.id, needId: topNeed.id })}>
                  <button type="submit" className="flex w-full items-center justify-between rounded-xl bg-[#15542a] px-4 py-2.5 text-[13px] font-medium text-white hover:bg-[#1a6934]">
                    Add to shortlist
                    <Trophy className="h-4 w-4" />
                  </button>
                </form>
                <form action={markPlayerNeedsFilmAction.bind(null, { playerId: player.id, needId: topNeed.id })}>
                  <button type="submit" className="flex w-full items-center justify-between rounded-xl border border-[#e4e8e5] bg-white px-4 py-2.5 text-[13px] font-medium text-[#4b5563] hover:bg-[#f1f5f2]">
                    Mark needs film
                    <Film className="h-4 w-4" />
                  </button>
                </form>
                <Link href={`/review/${topNeed.id}`} className="flex items-center justify-between rounded-xl border border-[#e4e8e5] bg-white px-4 py-2.5 text-[13px] font-medium text-[#4b5563] hover:bg-[#f1f5f2]">
                  Open review mode
                  <Radar className="h-4 w-4" />
                </Link>
              </div>
            </div>
          )}

          <div className="rounded-2xl border border-[#e4e8e5] bg-white p-5">
            <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.08em] text-[#9ca3af]">Board Fit</p>
            <div className="grid gap-3">
              {matchingNeeds.length ? (
                matchingNeeds.map(({ need, fit, shortlist, latestReview }) => (
                  <div key={need.id} className="rounded-xl border border-[#e4e8e5] bg-[#f8f9fa] p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[#9ca3af]">{need.position}</p>
                        <h3 className="mt-0.5 truncate text-[13px] font-semibold text-[#111827]">{need.title}</h3>
                      </div>
                      <span className={`shrink-0 rounded-full px-2.5 py-1 text-[12px] font-bold tabular-nums ${fit.fitScore >= 85 ? "bg-emerald-100 text-emerald-700" : fit.fitScore >= 72 ? "bg-blue-100 text-blue-700" : "bg-amber-100 text-amber-700"}`}>
                        {fit.fitScore}
                      </span>
                    </div>
                    <div className="mt-2.5 h-1.5 w-full overflow-hidden rounded-full bg-[#e4e8e5]">
                      <div className={`h-1.5 rounded-full transition-all ${fit.fitScore >= 85 ? "bg-emerald-500" : fit.fitScore >= 72 ? "bg-blue-500" : "bg-amber-400"}`} style={{ width: `${fit.fitScore}%` }} />
                    </div>
                    <p className="mt-2.5 text-[12px] text-[#4b5563]">{fit.fitSummary}</p>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      <span className="rounded-full bg-[#f1f5f2] px-2 py-0.5 text-[11px] font-semibold text-[#4b5563]">Prod {fit.productionScore}</span>
                      <span className="rounded-full bg-[#f1f5f2] px-2 py-0.5 text-[11px] font-semibold text-[#4b5563]">Measure {fit.measurementScore}</span>
                      {shortlist && <Badge variant="success">{shortlist.stage}</Badge>}
                    </div>
                    {latestReview?.note && (
                      <p className="mt-2.5 border-l-2 border-[#e4e8e5] pl-2.5 text-[12px] text-[#9ca3af]">{latestReview.note}</p>
                    )}
                    <div className="mt-3 flex gap-2">
                      <Link href={`/needs/${need.id}`} className="rounded-xl border border-[#e4e8e5] px-3 py-1.5 text-[12px] font-medium text-[#4b5563] hover:bg-[#f1f5f2]">Need</Link>
                      <Link href={`/review/${need.id}`} className="rounded-xl bg-[#15542a] px-3 py-1.5 text-[12px] font-medium text-white hover:bg-[#1a6934]">Review</Link>
                    </div>
                  </div>
                ))
              ) : (
                <div className="rounded-xl border border-dashed border-[#e4e8e5] p-5 text-[13px] text-[#9ca3af]">
                  No active needs match this player&apos;s position.
                </div>
              )}
            </div>
          </div>

          {sourceNotes.length > 0 && (
            <div className="rounded-2xl border border-[#e4e8e5] bg-white p-5">
              <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.08em] text-[#9ca3af]">Source Notes</p>
              <div className="grid gap-3">
                {sourceNotes.map((note) => (
                  <div key={note.id} className="rounded-xl border border-[#e4e8e5] bg-[#f8f9fa] p-4">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <Badge variant="default">{note.note_type}</Badge>
                      {note.source_account && <Badge variant="accent">@{note.source_account}</Badge>}
                      {note.status_signal && <Badge variant="warning">{note.status_signal}</Badge>}
                      {note.confidence != null && <Badge variant="success">{note.confidence.toFixed(1)} conf</Badge>}
                    </div>
                    {note.summary && <p className="mt-2.5 text-[13px] font-semibold text-[#111827]">{note.summary}</p>}
                    <p className="mt-1.5 border-l-2 border-[#b8952a]/30 pl-3 text-[13px] text-[#4b5563]">{note.source_text}</p>
                    {(note.traits.length > 0 || note.source_url) && (
                      <div className="mt-2.5 flex flex-wrap gap-1.5">
                        {note.traits.map((trait) => <Badge key={trait} variant="default">{trait}</Badge>)}
                        {note.source_url && (
                          <Link href={note.source_url} target="_blank" className="rounded-xl border border-[#e4e8e5] px-2.5 py-1 text-[12px] font-medium text-[#4b5563] hover:bg-[#f1f5f2]">Source</Link>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {shortlists.length > 0 && (
            <div className="rounded-2xl border border-[#e4e8e5] bg-white p-5">
              <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.08em] text-[#9ca3af]">Shortlist Status</p>
              <div className="grid gap-2">
                {shortlists.map((item) => (
                  <div key={item.id} className="flex items-center justify-between rounded-xl border border-[#e4e8e5] bg-[#f8f9fa] px-4 py-3">
                    <span className="text-[13px] font-medium text-[#4b5563]">Need {item.need_id.slice(0, 8)}</span>
                    <Badge variant="success">{item.stage}</Badge>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function HeroMetric({ label, value, highlight = false }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className="rounded-xl border border-[#e4e8e5] bg-[#f8f9fa] p-3">
      <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[#9ca3af]">{label}</p>
      <div className={`mt-1 font-mono text-[18px] font-semibold ${highlight ? "text-[#b8952a]" : "text-[#111827]"}`}>
        {value}
      </div>
    </div>
  );
}

function StatTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-[#e4e8e5] bg-[#f8f9fa] p-3.5">
      <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[#9ca3af]">{label}</p>
      <div className="mt-2 font-mono text-[18px] font-semibold text-[#111827]">{value}</div>
    </div>
  );
}
