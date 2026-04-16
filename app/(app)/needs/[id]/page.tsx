import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight } from "lucide-react";
import { ScoredPlayerCard } from "@/components/players/player-card";
import { SectionHeader } from "@/components/section-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getNeedById, getPlayers, getReviewsByNeed } from "@/lib/data/queries";

export default async function NeedDetailPage({
  params
}: {
  params: { id: string };
}) {
  const need = await getNeedById(params.id);
  if (!need) notFound();

  const [candidatePool, reviews] = await Promise.all([
    getPlayers({ needId: need.id, position: need.position, minFit: 55 }),
    getReviewsByNeed(need.id)
  ]);

  return (
    <div className="grid gap-6">
      <SectionHeader
        eyebrow="Need Detail"
        title={need.title}
        description={need.notes ?? "No notes added for this need yet."}
        cta={{ label: "Launch review", href: `/review/${need.id}` }}
      />

      <div className="grid gap-4 lg:grid-cols-4">
        <Card className="lg:col-span-1">
          <CardContent className="grid gap-3 p-5 text-sm text-slate-600">
            <div className="flex items-center justify-between">
              <span>Position</span>
              <Badge>{need.position}</Badge>
            </div>
            <div className="flex items-center justify-between">
              <span>Priority</span>
              <Badge variant={need.priority === "critical" ? "destructive" : "accent"}>{need.priority}</Badge>
            </div>
            <div className="flex items-center justify-between">
              <span>Target count</span>
              <span className="font-medium text-slate-950">{need.target_count}</span>
            </div>
            <div className="flex items-center justify-between">
              <span>Minimum starts</span>
              <span className="font-medium text-slate-950">{need.min_starts ?? "--"}</span>
            </div>
            <div className="flex items-center justify-between">
              <span>Min production</span>
              <span className="font-medium text-slate-950">{need.min_production_score ?? "--"}</span>
            </div>
          </CardContent>
        </Card>
        <Card className="lg:col-span-3">
          <CardHeader className="flex-row items-center justify-between">
            <CardTitle>Top fits</CardTitle>
            <Button asChild variant="outline">
              <Link href="/players">Open full database</Link>
            </Button>
          </CardHeader>
          <CardContent className="grid gap-4 lg:grid-cols-2">
            {(candidatePool as any[]).filter((r) => r.player).map((result) => (
              <ScoredPlayerCard key={result.player.id} detailHref={`/players/${result.player.id}`} result={result} />
            ))}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex-row items-center justify-between">
          <CardTitle>Review history</CardTitle>
          <Button asChild>
            <Link href={`/review/${need.id}`}>
              Continue reviewing
              <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>
        </CardHeader>
        <CardContent className="grid gap-3">
          {reviews.length ? (
            reviews.map((review) => (
              <div key={review.id} className="rounded-3xl border bg-slate-50 p-4">
                <div className="flex items-center gap-2">
                  <Badge variant={review.decision === "right" ? "success" : review.decision === "save" ? "warning" : "default"}>
                    {review.decision}
                  </Badge>
                  <span className="text-sm text-slate-500">Fit {review.fit_score}</span>
                </div>
                <p className="mt-3 text-sm text-slate-700">{review.note ?? "No reviewer note."}</p>
              </div>
            ))
          ) : (
            <div className="rounded-3xl border border-dashed bg-slate-50 p-5 text-sm text-slate-500">
              No player reviews logged for this need yet.
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
