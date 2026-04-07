"use client";

import { useState } from "react";
import { PlayerCard } from "@/components/players/player-card";
import { PlayerQuickView } from "@/components/players/player-quick-view";
import { PlayersPagination } from "@/components/players/players-pagination";
import { Sheet } from "@/components/ui/sheet";
import type { Player, PlayerFitResult } from "@/lib/types";

type Item = Player | PlayerFitResult;

interface Props {
  items: Item[];
  needId?: string;
  page: number;
  totalPages: number;
  baseSearchParams: string;
}

export function PlayerListClient({ items, page, totalPages, baseSearchParams }: Props) {
  const hrefForPage = (p: number) => {
    const params = new URLSearchParams(baseSearchParams);
    params.set("page", String(p));
    return `/players?${params.toString()}`;
  };
  const [activePlayerId, setActivePlayerId] = useState<string | null>(null);

  return (
    <>
      <div className="grid gap-4 xl:grid-cols-2">
        {items.map((item) => {
          const isResult = "player" in item;
          const player = isResult ? item.player : item;
          const fitScore = isResult ? item.fitScore : undefined;
          return (
            <PlayerCard
              key={player.id}
              detailHref={`/players/${player.id}`}
              fitScore={fitScore}
              player={player}
              onQuickView={(id) => setActivePlayerId(id)}
            />
          );
        })}
      </div>

      <PlayersPagination
        hrefForPage={hrefForPage}
        page={page}
        totalPages={totalPages}
      />

      <Sheet open={activePlayerId !== null} onClose={() => setActivePlayerId(null)}>
        <PlayerQuickView playerId={activePlayerId} />
      </Sheet>
    </>
  );
}
