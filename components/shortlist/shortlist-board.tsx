"use client";

import type { CSSProperties } from "react";
import { useMemo, useState } from "react";
import { ShortlistColumn } from "@/components/shortlist/shortlist-column";
import { ShortlistBoardItem, ShortlistStage } from "@/lib/types";

const columns: Array<{ key: ShortlistStage; label: string }> = [
  { key: "assistant", label: "Assistant" },
  { key: "coordinator", label: "Coordinator" },
  { key: "head_coach", label: "Head Coach" },
  { key: "final_watch", label: "Final Watch" }
];

export function ShortlistBoard({ items }: { items: ShortlistBoardItem[] }) {
  const [boardItems, setBoardItems] = useState(items);

  const counts = useMemo(
    () =>
      columns.map((column) => ({
        ...column,
        items: boardItems.filter((item) => item.stage === column.key),
        count: boardItems.filter((item) => item.stage === column.key).length
      })),
    [boardItems]
  );

  const boardGridStyle = useMemo(
    () =>
      ({
        "--shortlist-board-columns": counts
          .map((column) =>
            column.count > 0 ? "minmax(22rem, 1.35fr)" : "minmax(15rem, 0.78fr)"
          )
          .join(" ")
      }) as CSSProperties,
    [counts]
  );

  function handleStageChange(shortlistId: string, stage: ShortlistStage) {
    setBoardItems((current) =>
      current.map((item) => (item.id === shortlistId ? { ...item, stage } : item))
    );
  }

  if (!boardItems.length) {
    return (
      <div className="rounded-2xl border border-dashed border-[#e4e8e5] p-12 text-center">
        <p className="text-[14px] font-medium text-[#111827]">No shortlisted players</p>
        <p className="mt-1 text-[12px] text-[#9ca3af]">
          Push players into the shortlist from review mode to get started.
        </p>
      </div>
    );
  }

  return (
    <div className="grid items-start gap-4 md:grid-cols-2 xl:overflow-x-auto xl:pb-2 xl:[grid-template-columns:var(--shortlist-board-columns)]"
      style={boardGridStyle}
    >
      {counts.map((column) => (
        <ShortlistColumn
          key={column.key}
          isEmpty={column.count === 0}
          items={column.items}
          onStageChange={handleStageChange}
          stage={column.key}
          title={column.label}
        />
      ))}
    </div>
  );
}
