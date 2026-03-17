import Image from "next/image";
import Link from "next/link";
import { ArrowUpRight, Gauge, Ruler, Shield, Star, Timer } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { getPlayerDisplayConference, getPlayerKeyStats, getPlayerPhotoUrl } from "@/lib/football";
import { Player, PlayerFitResult } from "@/lib/types";

function getFitVariant(score?: number) {
  if (!score) return "default";
  if (score >= 85) return "success";
  if (score >= 70) return "accent";
  if (score >= 55) return "warning";
  return "destructive";
}

export function PlayerCard({
  player,
  fitScore,
  detailHref
}: {
  player: Player;
  fitScore?: number;
  detailHref?: string;
}) {
  const keyStats = getPlayerKeyStats(player).slice(0, 4);
  const photoUrl = getPlayerPhotoUrl(player);
  const conference = getPlayerDisplayConference(player);

  return (
    <Card className="overflow-hidden border-slate-200 bg-white/95 transition hover:-translate-y-0.5 hover:shadow-2xl">
      <CardContent className="grid gap-0 p-0">
        <div className="border-b bg-slate-950 px-4 py-4 text-white">
          <div className="flex items-start gap-4">
            <div className="relative h-16 w-16 overflow-hidden rounded-2xl border border-white/10 bg-slate-900">
              <Image
                alt={`${player.first_name} ${player.last_name}`}
                className="object-cover"
                fill
                sizes="64px"
                src={photoUrl}
              />
            </div>
            <div>
              <p className="text-xs uppercase tracking-[0.28em] text-slate-300">{player.position}</p>
              <h3 className="mt-1 text-xl font-semibold">
                {player.first_name} {player.last_name}
              </h3>
              <p className="mt-1 text-sm text-slate-300">
                {player.current_school} • {conference}
              </p>
              <p className="mt-1 text-xs uppercase tracking-[0.22em] text-slate-400">
                {player.class_year} • {player.eligibility_remaining} years left
              </p>
            </div>
            <div className="ml-auto">
              <Badge variant={getFitVariant(fitScore) as any}>
                {fitScore ? `${fitScore} Fit` : player.status}
              </Badge>
            </div>
          </div>
        </div>

        <div className="grid gap-4 p-4">
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-2xl bg-slate-50 p-3">
              <div className="flex items-center gap-2 text-xs uppercase tracking-[0.24em] text-slate-500">
                <Ruler className="h-3.5 w-3.5" />
                Measurables
              </div>
              <div className="mt-2 text-sm font-medium text-slate-900">
                {player.measurements?.height_in ? `${player.measurements.height_in}"` : "--"} /{" "}
                {player.measurements?.weight_lbs ? `${player.measurements.weight_lbs} lbs` : "--"}
              </div>
            </div>
            <div className="rounded-2xl bg-slate-50 p-3">
              <div className="flex items-center gap-2 text-xs uppercase tracking-[0.24em] text-slate-500">
                <Shield className="h-3.5 w-3.5" />
                Reach
              </div>
              <div className="mt-2 text-sm font-medium text-slate-900">
                {player.measurements?.arm_length_in
                  ? `${player.measurements.arm_length_in}" arm`
                  : player.measurements?.wing_span_in
                    ? `${player.measurements.wing_span_in}" span`
                    : "No verified length"}
              </div>
            </div>
            <div className="rounded-2xl bg-slate-50 p-3">
              <div className="flex items-center gap-2 text-xs uppercase tracking-[0.24em] text-slate-500">
                <Timer className="h-3.5 w-3.5" />
                Speed
              </div>
              <div className="mt-2 text-sm font-medium text-slate-900">
                {player.measurements?.forty_time ? `${player.measurements.forty_time}s 40` : "No verified time"}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            {keyStats.map((stat) => (
              <div key={stat} className="rounded-2xl border bg-white px-3 py-2 text-sm font-medium text-slate-700">
                {stat}
              </div>
            ))}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {(player.tags ?? []).slice(0, 2).map((tag) => (
              <Badge key={tag} variant="default">
                {tag}
              </Badge>
            ))}
            {player.stars ? (
              <Badge variant="warning" className="gap-1">
                <Star className="h-3 w-3 fill-current" />
                {player.stars}-star
              </Badge>
            ) : null}
            {player.latest_stats ? (
              <Badge variant="accent" className="gap-1">
                <Gauge className="h-3 w-3" />
                {player.latest_stats.starts ?? 0} starts
              </Badge>
            ) : null}
          </div>

          <div className="flex items-center justify-between gap-3">
            <p className="line-clamp-2 text-sm text-slate-600">{player.notes ?? "No staff summary added yet."}</p>
            {detailHref ? (
              <Button asChild size="sm" variant="outline">
                <Link href={detailHref}>
                  View
                  <ArrowUpRight className="h-4 w-4" />
                </Link>
              </Button>
            ) : null}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export function ScoredPlayerCard({
  result,
  detailHref
}: {
  result: PlayerFitResult;
  detailHref?: string;
}) {
  return <PlayerCard player={result.player} fitScore={result.fitScore} detailHref={detailHref} />;
}
