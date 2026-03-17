import { notFound } from "next/navigation";
import { ReviewClient } from "@/components/review/review-client";
import { SectionHeader } from "@/components/section-header";
import { getNeedById, getReviewQueue, getReviewsByNeed } from "@/lib/data/queries";

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

  return (
    <div className="grid gap-6">
      <SectionHeader
        eyebrow="Review Mode"
        title={need.title}
        description="Swipe left to pass, right to shortlist. Save and needs-film keep promising profiles alive without cluttering the shortlist."
      />
      <ReviewClient
        need={need}
        queue={queue}
        reviewedCount={reviews.length}
        totalCount={reviews.length + queue.length}
      />
    </div>
  );
}
