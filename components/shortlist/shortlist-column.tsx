"use client";

import { ShortlistPlayerTile } from "@/components/shortlist/shortlist-player-tile";
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
    <div className={`rounded-2xl border border-[#e4e8e5] bg-[#f8f9fa] ${isEmpty ? "min-h-[200px]" : "min-h-[360px]"}`}>
      <div className="flex items-center justify-between border-b border-[#e4e8e5] px-4 py-3">
        <h3 className="text-[13px] font-semibold text-[#111827]">{title}</h3>
        <span className="text-[12px] font-mono text-[#9ca3af]">{items.length}</span>
      </div>
      <div className="grid gap-2 p-3">
        {items.length ? (
          items.map((item) => (
            <ShortlistPlayerTile
              key={item.id}
              item={item}
              onStageChange={onStageChange}
            />
          ))
        ) : (
          <div className="rounded-xl border border-dashed border-[#e4e8e5] p-6 text-center text-[12px] text-[#9ca3af]">
            No players in {title.toLowerCase()}
          </div>
        )}
      </div>
    </div>
  );
}
