"use client";

import Link from "next/link";
import { ArrowUpRight, Gauge } from "lucide-react";
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
import { detectArchetype } from "@/lib/archetypes";
import { scoutingDisplay } from "@/lib/football-ui";
import { getPffPrimaryGrade } from "@/lib/pff/summary";

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
  const keyStats = getPlayerKeyStats(player).slice(0, 3);
  const productionMetrics = getPlayerProductionMetrics(player, 2);
  const conference = getPlayerDisplayConference(player);
  const archetype = detectArchetype(player.position, player.measurements?.height_in, player.measurements?.weight_lbs);
  const pffPrimary = getPffPrimaryGrade(player.pffStats ?? null, player.position);
  const pffOverall = pffPrimary ? `${pffPrimary.label} ${pffPrimary.value.toFixed(1)}` : null;
  const pffSeason = player.pffStats?.season ?? null;
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
      className={`overflow-hidden border-[#17211c]/8 bg-[linear-gradient(180deg,rgba(255,255,255,0.96),rgba(247,249,247,0.94))] transition hover:-translate-y-1 hover:border-[#24483a]/18 hover:shadow-[0_28px_70px_rgba(15,23,42,0.14)] ${onQuickView ? "cursor-pointer" : ""}`}
      onClick={onQuickView ? () => onQuickView(player.id) : undefined}
    >
      <CardContent className="grid gap-0 p-0">
        <div className="relative overflow-hidden border-b border-[#d5dcd7] bg-[linear-gradient(150deg,#0f2019_0%,#173126_55%,#214837_100%)] px-5 py-4 text-white ring-1 ring-inset ring-white/5">
          <div className="absolute inset-0 bg-[linear-gradient(to_right,rgba(255,255,255,0.06)_1px,transparent_1px)] bg-[length:90px_90px] opacity-40" />
          <div className="relative flex items-start gap-4">
            <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl border border-white/15 bg-[radial-gradient(circle_at_30%_30%,rgba(211,178,108,0.35),rgba(255,255,255,0.06)_45%,rgba(0,0,0,0.28))] text-lg font-bold text-[#f0e4c0] shadow-inner">
              {initials}
            </div>
            <div className="min-w-0">
              <p className="text-[10px] font-semibold uppercase tracking-[0.3em] text-[#d3b26c]">
                {player.position}
                {archetype ? <span className="ml-1.5 font-normal text-[#d6e0d3]/72">· {archetype}</span> : null}
              </p>
              <h3 className={`${scoutingDisplay.className} mt-1 truncate text-[2rem] uppercase leading-none tracking-[0.04em] text-[#f4efe2]`}>
                {player.first_name} {player.last_name}
              </h3>
              <p className="mt-2 truncate text-sm text-[#d6e0d3]/78">{schoolLabel}</p>
              <p className="mt-1 text-[11px] uppercase tracking-[0.22em] text-[#aebcb4]/72">
                {player.class_year} • {player.eligibility_remaining} yrs left
              </p>
            </div>
            <div className="ml-auto shrink-0">
              <Badge className="border border-white/10" variant={getFitVariant(fitScore) as "default" | "success" | "accent" | "warning" | "destructive"}>
                {fitScore ? `${fitScore} Fit` : player.status}
              </Badge>
            </div>
          </div>
        </div>

        <div className="grid gap-3 p-4">
          <div className="grid gap-3 rounded-[22px] border border-[#d9dfdb] bg-[linear-gradient(180deg,rgba(250,251,250,0.92),rgba(241,245,242,0.92))] px-4 py-3 lg:grid-cols-[1.25fr_0.85fr]">
            <div className="grid gap-1">
              <p className="field-label text-[#51685c]">Profile</p>
              <div className="text-base font-semibold text-[#13251d]">{heightWeightLabel}</div>
              {armFortyLabel ? <div className="text-sm text-slate-500">{armFortyLabel}</div> : null}
            </div>
            {player.latest_stats ? (
              <div className="grid gap-1 lg:justify-items-end">
                <p className="field-label text-[#51685c]">Latest season</p>
                <span className="inline-flex items-center gap-1 text-sm font-medium text-[#274536]">
                  <Gauge className="h-3.5 w-3.5" />
                  {player.latest_stats.season}
                </span>
              </div>
            ) : null}
          </div>

          <div className="grid grid-cols-2 gap-2">
            {keyStats.map((stat) => (
              <div
                key={stat}
                className="rounded-[18px] border border-[#dce3de] bg-white/[0.84] px-3 py-2.5 text-sm font-medium text-[#294838] transition hover:border-[#24483a]/20 hover:bg-white"
              >
                {stat}
              </div>
            ))}
          </div>

          {productionMetrics.length ? (
          <div className="rounded-[22px] border border-[#d9dfdb] bg-[#f3f6f3] p-3">
            <div className="mb-3 flex items-center justify-between gap-2">
              <p className="field-label text-[#51685c]">Signals</p>
            </div>
            <div className="flex flex-wrap gap-2">
              {productionMetrics.map((metric) => (
                <div key={metric.label} className="rounded-full border border-[#dde3df] bg-white px-3 py-1.5 text-sm text-slate-700 shadow-sm">
                  <span className="text-slate-400">{metric.label}:</span>{" "}
                  <span className="font-medium">{metric.value}</span>
                </div>
              ))}
            </div>
          </div>
          ) : null}

          <div className="flex flex-wrap items-center gap-2">
            {(player.tags ?? []).slice(0, 1).map((tag) => (
              <Badge key={tag} className="border border-[#d8dfda] bg-white text-[#355546]" variant="default">
                {tag}
              </Badge>
            ))}
            {pffOverall ? (
              <Badge className="bg-[#163627] text-[#d8f1e1]" variant="default">
                PFF {pffOverall}
                {pffSeason ? ` · ${pffSeason}` : ""}
              </Badge>
            ) : null}
            {player.latest_stats && (player.latest_stats.starts ?? 0) > 0 ? (
              <Badge className="gap-1 border border-[#d8dfda] bg-white text-[#355546]" variant="default">
                <Gauge className="h-3 w-3" />
                {player.latest_stats.starts ?? 0} starts
              </Badge>
            ) : null}
          </div>

          <div className="flex items-center justify-between gap-3 border-t border-[#e0e5e1] pt-2" onClick={(e) => e.stopPropagation()}>
            <p className="line-clamp-2 text-sm leading-6 text-slate-500">
              {player.notes ?? "No staff summary added yet."}
            </p>
            {onQuickView && detailHref ? (
              <div className="flex shrink-0 items-center gap-1.5">
                <Button size="sm" variant="outline" className="border-[#ccd5d0] bg-white/[0.84]" onClick={(e) => { e.stopPropagation(); onQuickView(player.id); }}>
                  Quick view
                </Button>
                <Button asChild size="sm" variant="ghost" className="px-2 text-[#284737]" onClick={(e) => e.stopPropagation()}>
                  <Link href={detailHref} title="Open full profile">
                    <ArrowUpRight className="h-4 w-4" />
                  </Link>
                </Button>
              </div>
            ) : onQuickView ? (
              <Button size="sm" variant="outline" className="border-[#ccd5d0] bg-white/[0.84]" onClick={(e) => { e.stopPropagation(); onQuickView(player.id); }}>
                Quick view
                <ArrowUpRight className="h-4 w-4" />
              </Button>
            ) : detailHref ? (
              <Button asChild size="sm" variant="outline" className="border-[#ccd5d0] bg-white/[0.84]">
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
