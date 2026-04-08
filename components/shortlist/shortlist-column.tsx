"use client";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ShortlistPlayerTile } from "@/components/shortlist/shortlist-player-tile";
import { ShortlistBoardItem, ShortlistStage } from "@/lib/types";

export function ShortlistColumn({
  title,
  stage,
  items,
  onStageChange
}: {
  title: string;
  stage: ShortlistStage;
  items: ShortlistBoardItem[];
  onStageChange: (shortlistId: string, stage: ShortlistStage) => void;
}) {
  return (
    <Card className="h-full min-h-[420px] border-slate-200 bg-white/80 backdrop-blur">
      <CardHeader className="border-b pb-4">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg">{title}</CardTitle>
          <Badge variant="accent">{items.length}</Badge>
        </div>
      </CardHeader>
      <CardContent className="grid gap-3 p-4">
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
