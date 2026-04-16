"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ShortlistPlayerTile } from "@/components/shortlist/shortlist-player-tile";
import { scoutingDisplay } from "@/lib/football-ui";
import { ShortlistBoardItem, ShortlistStage } from "@/lib/types";

export function ShortlistColumn({
  title,
  stage,
  items,
  onStageChange,
  isEmpty
}: {
  title: string;
  stage: ShortlistStage;
  items: ShortlistBoardItem[];
  onStageChange: (shortlistId: string, stage: ShortlistStage) => void;
  isEmpty?: boolean;
}) {
  return (
    <Card className={`scouting-surface h-full backdrop-blur ${isEmpty ? "min-h-[280px]" : "min-h-[420px]"}`}>
      <CardHeader className="border-b border-[var(--scout-card-border-soft)] pb-4">
        <div className="flex items-center justify-between">
          <CardTitle className={`${scoutingDisplay.className} scouting-title text-[1.7rem] uppercase leading-none tracking-[0.04em]`}>{title}</CardTitle>
          <p className="text-xs uppercase tracking-[0.22em] text-slate-500">{items.length} players</p>
        </div>
      </CardHeader>
      <CardContent className={`grid gap-3 p-4 ${isEmpty ? "content-start" : ""}`}>
        {items.length ? (
          items.map((item) => (
            <ShortlistPlayerTile
              key={item.id}
              item={item}
              onStageChange={onStageChange}
            />
          ))
        ) : (
          <div className="rounded-3xl border border-dashed bg-slate-50 p-6 text-sm text-slate-500">
            No players in {title.toLowerCase()}.
          </div>
        )}
      </CardContent>
    </Card>
  );
}
