import { notFound } from "next/navigation";
import { ReviewClient } from "@/components/review/review-client";
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

  const reviewedCount = reviews.length;
  const totalCount = reviews.length + queue.length;

  return (
    <div className="grid gap-6">
      <div className="border-b border-[#e4e8e5] pb-5">
        <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[#9ca3af]">Review Mode \u00b7 Step 2</p>
        <h1 className="mt-1 text-2xl font-bold text-[#111827]">{need.title}</h1>
        <div className="mt-2 flex items-center gap-4">
          <span className="text-[13px] text-[#4b5563]">
            <span className="font-mono font-semibold text-[#111827]">{reviewedCount}</span> reviewed
          </span>
          <span className="text-[13px] text-[#4b5563]">
            <span className="font-mono font-semibold text-[#111827]">{queue.length}</span> remaining
          </span>
          <span className="text-[13px] text-[#9ca3af]">{totalCount} total</span>
        </div>
      </div>

      <ReviewClient
        need={need}
        queue={queue}
        reviewedCount={reviewedCount}
        totalCount={totalCount}
      />
    </div>
  );
}
