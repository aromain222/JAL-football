"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { getPlayerQuickDataAction } from "@/app/actions";
import { AlignmentProfile } from "@/components/players/alignment-profile";
import { PffStatsGrid } from "@/components/players/pff-stats-grid";
import { PlayerPhoto } from "@/components/players/player-photo";
import { formatHeightInFeetInches, getPlayerKeyStats, getPlayerPhotoUrl } from "@/lib/football";
import { Badge } from "@/components/ui/badge";
import type { Player } from "@/lib/types";

type QuickData = {
  player: Player;
  pffStats: Record<string, unknown> | null;
} | null;

export function PlayerQuickView({ playerId }: { playerId: string | null }) {
  const [data, setData] = useState<QuickData>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!playerId) { setData(null); return; }
    let cancelled = false;
    setLoading(true);
    setData(null);
    getPlayerQuickDataAction(playerId)
      .then((result) => { if (!cancelled) { setData(result); setLoading(false); } })
      .catch(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [playerId]);

  if (!playerId) return null;

  if (loading) {
    return (
      <div className="flex flex-1 items-center justify-center p-12">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-[#e4e8e5] border-t-[#15542a]" />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-4 p-10 text-center">
        <p className="text-sm text-[#9ca3af]">Could not load player data.</p>
        <Link
          className="flex items-center gap-2 rounded-xl bg-[#15542a] px-4 py-2 text-sm font-medium text-white hover:bg-[#1a6934]"
          href={`/players/${playerId}`}
        >
          Open full profile
          <ArrowUpRight className="h-4 w-4" />
        </Link>
      </div>
    );
  }

  const { player, pffStats } = data;
  const initials = `${player.first_name[0] ?? ""}${player.last_name[0] ?? ""}`.toUpperCase();
  const photoUrl = getPlayerPhotoUrl(player);
  const keyStats = getPlayerKeyStats(player).slice(0, 6);

  return (
    <div className="flex flex-col">
      <div className="border-b border-[#e4e8e5] px-6 pb-5 pt-8">
        <div className="flex items-start gap-4">
          <PlayerPhoto
            src={photoUrl}
            alt={`${player.first_name} ${player.last_name}`}
            initials={initials}
            size={64}
          />
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[#9ca3af]">
              {player.position}
            </p>
            <h2 className="mt-0.5 text-[22px] font-bold tracking-tight text-[#111827]">
              {player.first_name} {player.last_name}
            </h2>
            <p className="mt-0.5 text-sm text-[#4b5563]">
              {player.current_school} · {player.class_year} · {player.eligibility_remaining} yr
            </p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              <Badge>{player.position}</Badge>
              <Badge variant="accent">{player.status}</Badge>
            </div>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-3 gap-2">
          <MiniTile label="Height" value={formatHeightInFeetInches(player.measurements?.height_in)} />
          <MiniTile label="Weight" value={player.measurements?.weight_lbs ? `${player.measurements.weight_lbs} lbs` : "--"} />
          <MiniTile label="Forty" value={player.measurements?.forty_time ? `${player.measurements.forty_time}s` : "--"} />
        </div>
      </div>

      <div className="flex flex-1 flex-col gap-6 p-6">
        {keyStats.length > 0 && (
          <div>
            <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-[#9ca3af]">Season Stats</p>
            <div className="grid grid-cols-2 gap-2">
              {keyStats.map((stat) => (
                <div key={stat} className="rounded-xl border border-[#e4e8e5] bg-[#f8f9fa] px-3 py-2 text-[13px] font-medium text-[#4b5563]">
                  {stat}
                </div>
              ))}
            </div>
          </div>
        )}
        <PffStatsGrid pffStats={pffStats} position={player.position} />
        <AlignmentProfile pffStats={pffStats} position={player.position} />
      </div>

      <div className="sticky bottom-0 border-t border-[#e4e8e5] bg-white p-4">
        <Link
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#15542a] py-2.5 text-sm font-medium text-white hover:bg-[#1a6934]"
          href={`/players/${player.id}`}
        >
          Open full profile
          <ArrowUpRight className="h-4 w-4" />
        </Link>
      </div>
    </div>
  );
}

function MiniTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-[#e4e8e5] bg-[#f8f9fa] px-3 py-2.5">
      <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[#9ca3af]">{label}</p>
      <p className="mt-1 text-[15px] font-bold text-[#111827]">{value}</p>
    </div>
  );
}
