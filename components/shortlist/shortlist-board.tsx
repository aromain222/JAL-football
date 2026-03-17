"use client";

import { useMemo, useState } from "react";
import { Filter, SearchCheck } from "lucide-react";
import { ShortlistColumn } from "@/components/shortlist/shortlist-column";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { ShortlistBoardItem, ShortlistStage } from "@/lib/types";

const columns: Array<{ key: ShortlistStage; label: string }> = [
  { key: "assistant", label: "Assistant" },
  { key: "coordinator", label: "Coordinator" },
  { key: "head_coach", label: "Head Coach" },
  { key: "final_watch", label: "Final Watch" }
];

export function ShortlistBoard({
  items
}: {
  items: ShortlistBoardItem[];
}) {
  const [boardItems, setBoardItems] = useState(items);

  const counts = useMemo(
    () =>
      columns.map((column) => ({
        ...column,
        count: boardItems.filter((item) => item.stage === column.key).length
      })),
    [boardItems]
  );

  function handleStageChange(shortlistId: string, stage: ShortlistStage) {
    setBoardItems((current) =>
      current.map((item) => (item.id === shortlistId ? { ...item, stage } : item))
    );
  }

  return (
    <div className="grid gap-5">
      <Card className="border-cyan-100 bg-white/95">
        <CardContent className="flex flex-col gap-4 p-5 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="flex items-center gap-2 text-xs uppercase tracking-[0.28em] text-cyan-700">
              <Filter className="h-4 w-4" />
              Shortlist Flow
            </p>
            <h2 className="mt-2 text-2xl font-semibold text-slate-950">
              {boardItems.length} shortlisted players
            </h2>
          </div>
          <div className="flex flex-wrap gap-2">
            {counts.map((column) => (
              <Badge key={column.key} variant="default">
                {column.label}: {column.count}
              </Badge>
            ))}
          </div>
        </CardContent>
      </Card>

      {boardItems.length ? (
        <div className="grid gap-4 xl:grid-cols-4">
          {columns.map((column) => (
            <ShortlistColumn
              key={column.key}
              items={boardItems.filter((item) => item.stage === column.key)}
              onStageChange={handleStageChange}
              stage={column.key}
              title={column.label}
            />
          ))}
        </div>
      ) : (
        <Card>
          <CardContent className="p-10 text-center">
            <p className="flex items-center justify-center gap-2 text-xs uppercase tracking-[0.28em] text-slate-500">
              <SearchCheck className="h-4 w-4" />
              Empty shortlist
            </p>
            <h3 className="mt-3 text-3xl font-semibold text-slate-950">No shortlisted players match this filter.</h3>
            <p className="mt-3 text-sm text-slate-600">
              Adjust need or position filters, or push players into shortlist from review mode.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
