"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { getPlayerQuickDataAction } from "@/app/actions";
import { Badge } from "@/components/ui/badge";
import { AlignmentProfile } from "@/components/players/alignment-profile";
import { PffStatsGrid } from "@/components/players/pff-stats-grid";
import { formatHeightInFeetInches, getPlayerKeyStats } from "@/lib/football";
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
      <div className="flex flex-1 items-center justify-center p-12 text-slate-400">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-slate-200 border-t-slate-600" />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-4 p-10 text-center">
        <p className="text-sm text-slate-500">Could not load player data.</p>
        <Link
          className="flex items-center gap-2 rounded-2xl bg-slate-950 px-5 py-3 text-sm font-semibold text-white hover:bg-slate-800"
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
  const keyStats = getPlayerKeyStats(player).slice(0, 6);

  return (
    <div className="flex flex-col">
      {/* Header */}
      <div className="bg-[linear-gradient(145deg,#060c18_0%,#09192b_50%,#0f2941_100%)] px-6 pb-6 pt-10 text-white">
        <div className="flex items-start gap-4">
          <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-2xl border border-white/10 bg-gradient-to-br from-cyan-400/25 via-slate-900 to-slate-800 text-xl font-semibold text-cyan-100">
            {initials}
          </div>
          <div className="min-w-0">
            <p className="text-[10px] font-semibold uppercase tracking-[0.36em] text-cyan-300">
              {player.position}
            </p>
            <h2 className="mt-1 text-2xl font-bold">
              {player.first_name} {player.last_name}
            </h2>
            <p className="mt-1 text-sm text-slate-300">
              {player.current_school} · {player.class_year} · {player.eligibility_remaining} yr
            </p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              <Badge>{player.position}</Badge>
              <Badge variant="accent">{player.status}</Badge>
            </div>
          </div>
        </div>

        {/* Measurements row */}
        <div className="mt-5 grid grid-cols-3 gap-2">
          <MiniTile
            label="Height"
            value={formatHeightInFeetInches(player.measurements?.height_in)}
          />
          <MiniTile
            label="Weight"
            value={player.measurements?.weight_lbs ? `${player.measurements.weight_lbs} lbs` : "--"}
          />
          <MiniTile
            label="Forty"
            value={player.measurements?.forty_time ? `${player.measurements.forty_time}s` : "--"}
          />
        </div>
      </div>

      {/* Body */}
      <div className="flex flex-1 flex-col gap-6 p-6">
        {/* Key stats */}
        {keyStats.length > 0 && (
          <div>
            <p className="mb-2.5 text-[10px] font-semibold uppercase tracking-widest text-slate-400">
              Season Stats
            </p>
            <div className="grid grid-cols-2 gap-2">
              {keyStats.map((stat) => (
                <div
                  key={stat}
                  className="rounded-xl border border-slate-100 bg-white px-3 py-2 text-sm font-medium text-slate-700"
                >
                  {stat}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* PFF grades + alignment */}
        <PffStatsGrid pffStats={pffStats} position={player.position} />
        <AlignmentProfile pffStats={pffStats} position={player.position} />
      </div>

      {/* Footer */}
      <div className="sticky bottom-0 border-t bg-white/95 p-4 backdrop-blur">
        <Link
          className="flex w-full items-center justify-center gap-2 rounded-2xl bg-slate-950 py-3 text-sm font-semibold text-white hover:bg-slate-800"
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
    <div className="rounded-2xl border border-white/10 bg-white/10 px-3 py-2.5 backdrop-blur">
      <p className="text-[9px] font-semibold uppercase tracking-widest text-slate-300">{label}</p>
      <p className="mt-1 text-base font-bold text-white">{value}</p>
    </div>
  );
}
