"use client";

import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import {
  formatHeightInFeetInches,
  getPlayerDisplayConference,
  getPlayerKeyStats,
  getPlayerPhotoUrl
} from "@/lib/football";
import { Player, PlayerFitResult } from "@/lib/types";
import { detectArchetype } from "@/lib/archetypes";
import { getPffPrimaryGrade } from "@/lib/pff/summary";
import { PlayerPhoto } from "@/components/players/player-photo";
import { SchoolLogo } from "@/components/players/school-logo";
import { getSchoolLogoUrl } from "@/lib/school-logos";
import { cn } from "@/lib/utils";

function FitBadge({ score }: { score: number }) {
  const cls =
    score >= 85
      ? "bg-emerald-100 text-emerald-800 border-emerald-200"
      : score >= 70
        ? "bg-blue-100 text-blue-800 border-blue-200"
        : score >= 55
          ? "bg-amber-100 text-amber-800 border-amber-200"
          : "bg-red-100 text-red-800 border-red-200";
  return (
    <span className={cn("rounded-full border px-2.5 py-0.5 text-[12px] font-semibold", cls)}>
      {score}
    </span>
  );
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
  const conference = getPlayerDisplayConference(player);
  const archetype = detectArchetype(player.position, player.measurements?.height_in, player.measurements?.weight_lbs);
  const pffPrimary = getPffPrimaryGrade(player.pffStats ?? null, player.position);
  const initials = `${player.first_name[0] ?? ""}${player.last_name[0] ?? ""}`.toUpperCase();
  const photoUrl = getPlayerPhotoUrl(player);
  const schoolLogoUrl = getSchoolLogoUrl(player.current_school);

  const schoolLabel =
    player.previous_school && player.current_school !== "Transfer Portal"
      ? `${player.current_school} · from ${player.previous_school}`
      : player.current_school;

  const meta = [player.class_year, conference].filter(Boolean).join(" · ");

  return (
    <div
      className={cn(
        "rounded-2xl border border-[#e4e8e5] bg-white p-4 transition-shadow hover:shadow-md",
        onQuickView && "cursor-pointer"
      )}
      onClick={onQuickView ? () => onQuickView(player.id) : undefined}
    >
      <div className="flex items-start gap-3">
        <PlayerPhoto
          src={photoUrl}
          alt={`${player.first_name} ${player.last_name}`}
          initials={initials}
          size={48}
        />
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[#9ca3af]">
            {player.position}
            {archetype ? <span className="font-normal"> · {archetype}</span> : null}
          </p>
          <h3 className="mt-0.5 truncate text-[22px] font-bold tracking-tight text-[#111827]">
            {player.first_name} {player.last_name}
          </h3>
          <div className="mt-1 flex items-center gap-1.5 truncate">
            <SchoolLogo school={player.current_school} logoUrl={schoolLogoUrl} size={14} className="shrink-0" />
            <p className="truncate text-[12px] text-[#4b5563]">{schoolLabel}</p>
          </div>
          <p className="mt-0.5 text-[12px] text-[#9ca3af]">{meta}</p>
        </div>
        <div className="shrink-0">
          {fitScore !== undefined ? (
            <FitBadge score={fitScore} />
          ) : (
            <span className="rounded-full border border-[#e4e8e5] px-2.5 py-0.5 text-[12px] text-[#9ca3af]">
              {player.status}
            </span>
          )}
        </div>
      </div>

      {keyStats.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {keyStats.map((stat) => (
            <span
              key={stat}
              className="rounded-lg bg-[#f1f5f2] px-2.5 py-1 text-[12px] font-medium text-[#4b5563]"
            >
              {stat}
            </span>
          ))}
        </div>
      )}

      <div className="mt-3 flex items-center gap-2 flex-wrap">
        {player.measurements?.height_in || player.measurements?.weight_lbs ? (
          <span className="text-[12px] text-[#9ca3af]">
            {formatHeightInFeetInches(player.measurements?.height_in)}
            {player.measurements?.weight_lbs ? ` / ${player.measurements.weight_lbs} lbs` : ""}
          </span>
        ) : null}
        {pffPrimary ? (
          <span className="rounded-full bg-[#fef3c7] px-2.5 py-0.5 text-[11px] font-semibold text-[#92400e]">
            PFF {pffPrimary.label} {pffPrimary.value.toFixed(1)}
            {player.pffStats?.season ? ` · ${player.pffStats.season}` : ""}
          </span>
        ) : null}
      </div>

      <div
        className="mt-3 flex items-center justify-end gap-2 border-t border-[#f1f5f2] pt-3"
        onClick={(e) => e.stopPropagation()}
      >
        {onQuickView && (
          <button
            type="button"
            className="rounded-xl border border-[#e4e8e5] bg-white px-3 py-1.5 text-[12px] font-medium text-[#4b5563] hover:bg-[#f1f5f2]"
            onClick={(e) => { e.stopPropagation(); onQuickView(player.id); }}
          >
            Quick view
          </button>
        )}
        {detailHref && (
          <Link
            href={detailHref}
            className="flex items-center gap-1 rounded-xl border border-[#e4e8e5] bg-white px-3 py-1.5 text-[12px] font-medium text-[#4b5563] hover:bg-[#f1f5f2]"
            onClick={(e) => e.stopPropagation()}
          >
            <ArrowUpRight className="h-3.5 w-3.5" />
          </Link>
        )}
      </div>
    </div>
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
