"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { ArrowRight, ChevronLeft, ChevronRight, ExternalLink } from "lucide-react";
import { updateShortlistStageAction } from "@/app/actions";
import { PlayerPhoto } from "@/components/players/player-photo";
import { getPlayerPhotoUrl } from "@/lib/football";
import { ShortlistBoardItem, ShortlistStage } from "@/lib/types";

const stageOrder: ShortlistStage[] = [
  "assistant",
  "coordinator",
  "head_coach",
  "final_watch"
];

const stageLabels: Record<ShortlistStage, string> = {
  assistant: "Assistant",
  coordinator: "Coordinator",
  head_coach: "Head Coach",
  final_watch: "Final Watch"
};

export function ShortlistPlayerTile({
  item,
  onStageChange
}: {
  item: ShortlistBoardItem;
  onStageChange: (shortlistId: string, stage: ShortlistStage) => void;
}) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const currentIndex = stageOrder.indexOf(item.stage);
  const player = item.player;
  const initials = player
    ? `${player.first_name[0] ?? ""}${player.last_name[0] ?? ""}`.toUpperCase()
    : "?";

  function moveToStage(stage: ShortlistStage) {
    if (stage === item.stage) return;
    setError(null);
    onStageChange(item.id, stage);

    startTransition(async () => {
      try {
        const formData = new FormData();
        formData.set("shortlistId", item.id);
        formData.set("stage", stage);
        await updateShortlistStageAction(formData);
      } catch (stageError) {
        setError(stageError instanceof Error ? stageError.message : "Could not update stage.");
        onStageChange(item.id, item.stage);
      }
    });
  }

  return (
    <div className="rounded-xl border border-[#e4e8e5] bg-white p-3">
      <div className="flex items-start gap-3">
        <PlayerPhoto
          src={getPlayerPhotoUrl(player ?? { first_name: "P", last_name: "?", photo_url: null })}
          alt={player ? `${player.first_name} ${player.last_name}` : "Player"}
          initials={initials}
          size={40}
        />
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[#9ca3af]">
            {player?.position ?? "Player"}
            {item.fitScore !== null ? ` \u00b7 Fit ${item.fitScore}` : ""}
          </p>
          <p className="mt-0.5 truncate text-[14px] font-bold text-[#111827]">
            {player?.first_name} {player?.last_name}
          </p>
          <p className="truncate text-[12px] text-[#4b5563]">{player?.current_school}</p>
          {item.need_id && (
            <Link
              className="mt-0.5 inline-flex items-center gap-1 text-[11px] text-[#15542a] hover:underline"
              href={`/needs/${item.need_id}`}
            >
              {item.need?.title ?? "Open need"}
              <ExternalLink className="h-3 w-3" />
            </Link>
          )}
        </div>
      </div>

      {item.latestNote && (
        <p className="mt-2.5 rounded-lg bg-[#f8f9fa] px-3 py-2 text-[12px] text-[#4b5563]">
          {item.latestNote}
        </p>
      )}

      {error && <p className="mt-1 text-[12px] text-red-600">{error}</p>}

      <div className="mt-3 grid grid-cols-3 gap-1.5">
        <button
          type="button"
          disabled={isPending || currentIndex <= 0}
          className="flex h-9 items-center justify-center rounded-xl border border-[#e4e8e5] bg-white text-[#4b5563] hover:bg-[#f1f5f2] disabled:opacity-40"
          onClick={() => moveToStage(stageOrder[Math.max(0, currentIndex - 1)])}
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <select
          className="h-9 rounded-xl border border-[#e4e8e5] bg-white px-2 text-[12px] text-[#111827]"
          disabled={isPending}
          value={item.stage}
          onChange={(event) => moveToStage(event.target.value as ShortlistStage)}
        >
          {stageOrder.map((stage) => (
            <option key={stage} value={stage}>{stageLabels[stage]}</option>
          ))}
        </select>
        <button
          type="button"
          disabled={isPending || currentIndex >= stageOrder.length - 1}
          className="flex h-9 items-center justify-center rounded-xl border border-[#e4e8e5] bg-white text-[#4b5563] hover:bg-[#f1f5f2] disabled:opacity-40"
          onClick={() => moveToStage(stageOrder[Math.min(stageOrder.length - 1, currentIndex + 1)])}
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>

      <Link
        href={`/players/${item.player_id}`}
        className="mt-2 flex w-full items-center justify-center gap-1.5 rounded-xl border border-[#e4e8e5] py-1.5 text-[12px] font-medium text-[#4b5563] hover:bg-[#f1f5f2]"
      >
        Open profile
        <ArrowRight className="h-3.5 w-3.5" />
      </Link>
    </div>
  );
}
