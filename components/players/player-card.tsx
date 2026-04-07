"use client";

import Link from "next/link";
import { ArrowUpRight, Gauge, Star } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  formatHeightInFeetInches,
  getPlayerDisplayConference,
  getPlayerKeyStats,
  getPlayerProductionMetrics
} from "@/lib/football";
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
  detailHref,
  onQuickView
}: {
  player: Player;
  fitScore?: number;
  detailHref?: string;
  onQuickView?: (id: string) => void;
}) {
  const keyStats = getPlayerKeyStats(player).slice(0, 4);
  const productionMetrics = getPlayerProductionMetrics(player, 3);
  const conference = getPlayerDisplayConference(player);
  const initials = `${player.first_name[0] ?? ""}${player.last_name[0] ?? ""}`.toUpperCase();
  const heightWeightLabel = [
    formatHeightInFeetInches(player.measurements?.height_in),
    player.measurements?.weight_lbs ? `${player.measurements.weight_lbs} lbs` : "--"
  ].join(" / ");
  const armFortyLabel =
    player.measurements?.arm_length_in || player.measurements?.forty_time
      ? `${player.measurements?.arm_length_in ? `${player.measurements.arm_length_in}" arm` : "--"} • ${
          player.measurements?.forty_time ? `${player.measurements.forty_time}s 40` : "--"
        }`
      : null;
  const schoolLabel =
    player.previous_school && player.current_school === "Transfer Portal"
      ? `${player.previous_school} -> Transfer Portal`
      : player.previous_school
        ? `${player.current_school} • from ${player.previous_school}`
        : `${player.current_school} • ${conference}`;

  return (
    <Card
      className={`overflow-hidden border-slate-200 bg-white/95 transition hover:-translate-y-0.5 hover:border-cyan-200 hover:shadow-2xl ${onQuickView ? "cursor-pointer" : ""}`}
      onClick={onQuickView ? () => onQuickView(player.id) : undefined}
    >
      <CardContent className="grid gap-0 p-0">
        <div className="border-b bg-slate-950 px-4 py-4 text-white">
          <div className="flex items-start gap-4">
            <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl border border-white/10 bg-gradient-to-br from-cyan-400/25 via-slate-900 to-slate-800 text-lg font-semibold text-cyan-100">
              {initials}
            </div>
            <div className="min-w-0">
              <p className="text-xs uppercase tracking-[0.28em] text-slate-300">{player.position}</p>
              <h3 className="mt-1 truncate text-xl font-semibold">
                {player.first_name} {player.last_name}
              </h3>
              <p className="mt-1 truncate text-sm text-slate-300">{schoolLabel}</p>
              <p className="mt-1 text-xs uppercase tracking-[0.22em] text-slate-400">
                {player.class_year} • {player.eligibility_remaining} years left
              </p>
            </div>
            <div className="ml-auto shrink-0">
              <Badge variant={getFitVariant(fitScore) as any}>
                {fitScore ? `${fitScore} Fit` : player.status}
              </Badge>
            </div>
          </div>
        </div>

        <div className="grid gap-4 p-4">
          <div className="rounded-2xl border bg-slate-50/70 px-4 py-3">
            <div className="flex flex-wrap items-center gap-3 text-sm text-slate-600">
              <span className="font-medium text-slate-900">{heightWeightLabel}</span>
              {armFortyLabel ? <span>{armFortyLabel}</span> : null}
              {player.latest_stats ? (
                <span className="inline-flex items-center gap-1 text-slate-700">
                  <Gauge className="h-3.5 w-3.5" />
                  {player.latest_stats.season}
                </span>
              ) : null}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            {keyStats.map((stat) => (
              <div key={stat} className="rounded-2xl border bg-white px-3 py-2 text-sm font-medium text-slate-700">
                {stat}
              </div>
            ))}
          </div>

          <div className="rounded-2xl border bg-slate-50/80 p-3">
            <div className="flex flex-wrap gap-2">
              {productionMetrics.map((metric) => (
                <div key={metric.label} className="rounded-full bg-white px-3 py-1.5 text-sm text-slate-700">
                  <span className="text-slate-500">{metric.label}:</span> {metric.value}
                </div>
              ))}
            </div>
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

          <div className="flex items-center justify-between gap-3" onClick={(e) => e.stopPropagation()}>
            <p className="line-clamp-2 text-sm text-slate-600">
              {player.notes ?? "No staff summary added yet."}
            </p>
            {onQuickView && detailHref ? (
              <div className="flex shrink-0 items-center gap-1.5">
                <Button size="sm" variant="outline" onClick={(e) => { e.stopPropagation(); onQuickView(player.id); }}>
                  Quick view
                </Button>
                <Button asChild size="sm" variant="ghost" className="px-2" onClick={(e) => e.stopPropagation()}>
                  <Link href={detailHref} title="Open full profile">
                    <ArrowUpRight className="h-4 w-4" />
                  </Link>
                </Button>
              </div>
            ) : onQuickView ? (
              <Button size="sm" variant="outline" onClick={(e) => { e.stopPropagation(); onQuickView(player.id); }}>
                Quick view
                <ArrowUpRight className="h-4 w-4" />
              </Button>
            ) : detailHref ? (
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
