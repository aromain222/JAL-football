"use client";

import Image from "next/image";
import Link from "next/link";
import { useState, useTransition } from "react";
import { ArrowRight, ChevronLeft, ChevronRight, ExternalLink, GripVertical } from "lucide-react";
import { updateShortlistStageAction } from "@/app/actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
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
    <Card className="border-slate-200 bg-white/95 shadow-sm transition hover:shadow-lg">
      <CardContent className="grid gap-4 p-4">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-5 items-center justify-center text-slate-300">
            <GripVertical className="h-4 w-4" />
          </div>
          <div className="relative h-14 w-14 overflow-hidden rounded-2xl border bg-slate-100">
            <Image
              alt={`${item.player?.first_name ?? "Player"} ${item.player?.last_name ?? ""}`}
              className="object-cover"
              fill
              sizes="56px"
              src={getPlayerPhotoUrl(item.player ?? { first_name: "Player", last_name: "Card", photo_url: null })}
            />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              {item.player?.position ? <Badge>{item.player.position}</Badge> : null}
              {item.fitScore !== null ? <Badge variant="success">{item.fitScore} fit</Badge> : null}
            </div>
            <h3 className="mt-2 truncate text-lg font-semibold text-slate-950">
              {item.player?.first_name} {item.player?.last_name}
            </h3>
            <p className="truncate text-sm text-slate-600">
              {item.player?.current_school} • {item.need?.title}
            </p>
          </div>
        </div>

        <div className="rounded-2xl border bg-slate-50 px-3 py-3 text-sm text-slate-700">
          {item.latestNote ?? "No note attached yet."}
        </div>

        {error ? <p className="text-sm text-rose-600">{error}</p> : null}

        <div className="grid grid-cols-3 gap-2">
          <Button
            disabled={isPending || currentIndex <= 0}
            type="button"
            variant="outline"
            onClick={() => moveToStage(stageOrder[Math.max(0, currentIndex - 1)])}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <select
            className="h-10 rounded-xl border bg-white px-3 text-sm"
            disabled={isPending}
            value={item.stage}
            onChange={(event) => moveToStage(event.target.value as ShortlistStage)}
          >
            {stageOrder.map((stage) => (
              <option key={stage} value={stage}>
                {stageLabels[stage]}
              </option>
            ))}
          </select>
          <Button
            disabled={isPending || currentIndex >= stageOrder.length - 1}
            type="button"
            variant="outline"
            onClick={() => moveToStage(stageOrder[Math.min(stageOrder.length - 1, currentIndex + 1)])}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>

        <div className="flex gap-2">
          <Button asChild className="flex-1" size="sm" variant="outline">
            <Link href={`/players/${item.player_id}`}>
              Open profile
              <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>
          <Button asChild size="sm" variant="ghost">
            <Link href={`/needs/${item.need_id}`}>
              Need
              <ExternalLink className="h-4 w-4" />
            </Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
