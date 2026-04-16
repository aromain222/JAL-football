import { notFound } from "next/navigation";
import { ReviewClient } from "@/components/review/review-client";
import { getNeedById, getReviewQueue, getReviewsByNeed } from "@/lib/data/queries";
import { scoutingDisplay } from "@/lib/football-ui";

export default async function ReviewPage({
  params
}: {
  params: { needId: string };
}) {
  const need = await getNeedById(params.needId);
  if (!need) notFound();

  const [queue, reviews] = await Promise.all([
    getReviewQueue(need.id),
    getReviewsByNeed(need.id)
  ]);

  const reviewedCount = reviews.length;
  const totalCount = reviews.length + queue.length;

  return (
    <div className="grid gap-6">
      <section className="scouting-panel relative isolate">
        <div className="field-grid-lines absolute inset-0 opacity-40" />
        <div className="absolute inset-y-0 left-[11%] w-px bg-white/10" />
        <div className="absolute inset-y-0 right-[18%] w-px bg-white/10" />
        <div className="relative grid gap-8 px-6 py-7 lg:grid-cols-[minmax(0,1.45fr)_minmax(280px,0.86fr)] lg:px-8 lg:py-8">
          <div>
            <p className="field-label scouting-kicker">Review Mode</p>
            <h1 className={`${scoutingDisplay.className} mt-3 text-[3.2rem] uppercase leading-[0.9] tracking-[0.04em] text-[#f5efe0] sm:text-[4.2rem]`}>
              {need.title}
            </h1>
            <p className="scouting-support mt-4 max-w-2xl text-sm leading-6 sm:text-[15px]">
              Work the player queue fast, keep notes for the next evaluator, and only move true fits into shortlist stages.
            </p>
          </div>
          <div className="grid gap-3 self-end sm:grid-cols-2">
            <div className="scouting-hero-stat">
              <p className="field-label text-[var(--scout-teal)]">Reviewed</p>
              <div className={`${scoutingDisplay.className} mt-2 text-[2.8rem] leading-none text-white`}>
                {reviewedCount}
              </div>
              <p className="mt-2 text-sm text-white/70">Logged against this need so far.</p>
            </div>
            <div className="scouting-hero-stat">
              <p className="field-label text-[var(--scout-teal)]">Still In Queue</p>
              <div className={`${scoutingDisplay.className} mt-2 text-[2.8rem] leading-none text-white`}>
                {queue.length}
              </div>
              <p className="mt-2 text-sm text-white/70">{totalCount} total profiles in this triage run.</p>
            </div>
          </div>
        </div>
      </section>
      <ReviewClient
        need={need}
        queue={queue}
        reviewedCount={reviewedCount}
        totalCount={totalCount}
      />
    </div>
  );
}
