"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import {
  ArrowRight,
  Bookmark,
  CircleAlert,
  Eye,
  Film,
  MoveLeft,
  MoveRight,
  ShieldCheck,
  Zap
} from "lucide-react";
import { submitReviewAction } from "@/app/actions";
import { Textarea } from "@/components/ui/textarea";
import { PlayerPhoto } from "@/components/players/player-photo";
import {
  formatHeightInFeetInches,
  getPlayerKeyStats,
  getPlayerPhotoUrl,
  getPlayerProductionMetrics
} from "@/lib/football";
import { PlayerFitResult, ReviewDecision, TeamNeed } from "@/lib/types";

interface ReviewClientProps {
  need: TeamNeed;
  queue: PlayerFitResult[];
  reviewedCount: number;
  totalCount: number;
}

const SWIPE_THRESHOLD = 120;

export function ReviewClient({
  need,
  queue,
  reviewedCount,
  totalCount
}: ReviewClientProps) {
  const [cards, setCards] = useState(queue);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [note, setNote] = useState("");
  const [dragX, setDragX] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [optimisticReviewed, setOptimisticReviewed] = useState(reviewedCount);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const pointerStartX = useRef<number | null>(null);

  const current = cards[currentIndex];
  const reviewedSoFar = Math.min(optimisticReviewed, totalCount);
  const progressWidth = totalCount ? Math.round((reviewedSoFar / totalCount) * 100) : 100;

  const handleDecision = useCallback(
    async (decision: ReviewDecision) => {
      if (!current || !current.player) return;

      const leavingIndex = currentIndex;
      const leavingPlayerId = current.player.id;
      const leavingFitScore = current.fitScore;
      const leavingNote = note;

      setError(null);
      setCurrentIndex((value) => value + 1);
      setOptimisticReviewed((value) => value + 1);
      setNote("");
      setDragX(0);
      setIsDragging(false);

      startTransition(async () => {
        try {
          const formData = new FormData();
          formData.set("needId", need.id);
          formData.set("playerId", leavingPlayerId);
          formData.set("fitScore", String(leavingFitScore));
          formData.set("decision", decision);
          formData.set("note", leavingNote);
          await submitReviewAction(formData);
        } catch (submissionError) {
          setError(
            submissionError instanceof Error
              ? submissionError.message
              : "Could not save review decision."
          );
          setCurrentIndex(leavingIndex);
          setOptimisticReviewed((value) => Math.max(reviewedCount, value - 1));
          setNote(leavingNote);
        }
      });
    },
    [current, currentIndex, need.id, note, reviewedCount, startTransition]
  );

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (!current || isPending) return;
      if (event.key === "ArrowLeft") void handleDecision("left");
      if (event.key === "ArrowRight") void handleDecision("right");
      if (event.key.toLowerCase() === "s") void handleDecision("save");
      if (event.key.toLowerCase() === "f") void handleDecision("needs_film");
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [current, handleDecision, isPending]);

  function handlePointerDown(event: React.PointerEvent<HTMLDivElement>) {
    pointerStartX.current = event.clientX;
    setIsDragging(true);
  }

  function handlePointerMove(event: React.PointerEvent<HTMLDivElement>) {
    if (!isDragging || pointerStartX.current === null) return;
    setDragX(event.clientX - pointerStartX.current);
  }

  function handlePointerUp() {
    if (!isDragging) return;
    setIsDragging(false);

    if (dragX <= -SWIPE_THRESHOLD) {
      void handleDecision("left");
      return;
    }

    if (dragX >= SWIPE_THRESHOLD) {
      void handleDecision("right");
      return;
    }

    setDragX(0);
  }

  if (!current) {
    return (
      <div className="rounded-2xl border border-[#e4e8e5] bg-white">
        <div className="border-b border-[#e4e8e5] px-8 py-6">
          <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[#9ca3af]">Queue cleared</p>
          <h2 className="mt-1 text-2xl font-bold text-[#111827]">Board triage complete</h2>
          <p className="mt-1 text-sm text-[#4b5563]">
            All matching players for {need.title} have been reviewed.
          </p>
        </div>
        <div className="grid gap-4 p-8 lg:grid-cols-2">
          <div className="rounded-xl border border-[#e4e8e5] bg-[#f8f9fa] p-5">
            <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[#9ca3af]">Final tally</p>
            <p className="mt-2 font-mono text-[32px] font-semibold text-[#111827]">{reviewedSoFar}</p>
            <p className="mt-1 text-[12px] text-[#9ca3af]">Reviewed against this need profile.</p>
          </div>
          <div className="grid gap-2 content-start">
            <Link
              href="/shortlist"
              className="flex items-center justify-center gap-2 rounded-xl bg-[#15542a] px-4 py-2.5 text-sm font-medium text-white hover:bg-[#1a6934]"
            >
              Open shortlist board
              <ArrowRight className="h-4 w-4" />
            </Link>
            <Link
              href={`/needs/${need.id}`}
              className="flex items-center justify-center gap-2 rounded-xl border border-[#e4e8e5] px-4 py-2.5 text-sm font-medium text-[#4b5563] hover:bg-[#f1f5f2]"
            >
              Return to need detail
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const stats = getPlayerKeyStats(current.player);
  const productionMetrics = getPlayerProductionMetrics(current.player, 4);
  const swipeHint =
    dragX > 40
      ? "→ Shortlist"
      : dragX < -40
        ? "← Pass"
        : "Drag or use buttons below";

  const initials = `${current.player.first_name[0] ?? ""}${current.player.last_name[0] ?? ""}`.toUpperCase();

  return (
    <div className="grid gap-6">
      {/* Progress bar */}
      <div className="rounded-2xl border border-[#e4e8e5] bg-white p-4">
        <div className="flex items-center justify-between">
          <p className="text-[13px] font-medium text-[#4b5563]">
            {reviewedSoFar} of {totalCount} reviewed
          </p>
          <p className="text-[13px] font-mono font-semibold text-[#111827]">{progressWidth}%</p>
        </div>
        <div className="mt-2 h-1.5 rounded-full bg-[#f1f5f2]">
          <div
            className="h-1.5 rounded-full bg-[#15542a] transition-all"
            style={{ width: `${progressWidth}%` }}
          />
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-[13px] text-red-700">
          <CircleAlert className="h-4 w-4" />
          {error}
        </div>
      )}

      <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        {/* Player card */}
        <div
          className="rounded-2xl border border-[#e4e8e5] bg-white transition-transform"
          style={{ transform: `translateX(${dragX}px) rotate(${dragX / 50}deg)` }}
        >
          {/* Draggable header */}
          <div
            className="select-none cursor-grab rounded-t-2xl border-b border-[#e4e8e5] bg-[#f8f9fa] px-5 py-5 active:cursor-grabbing"
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerCancel={handlePointerUp}
          >
            <div className="flex items-start gap-4">
              <PlayerPhoto
                src={getPlayerPhotoUrl(current.player)}
                alt={`${current.player.first_name} ${current.player.last_name}`}
                initials={initials}
                size={72}
              />
              <div className="flex-1 min-w-0">
                <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[#9ca3af]">
                  {current.player.position} · {current.player.class_year}
                </p>
                <h3 className="mt-0.5 text-[22px] font-bold tracking-tight text-[#111827]">
                  {current.player.first_name} {current.player.last_name}
                </h3>
                <p className="mt-0.5 text-[13px] text-[#4b5563]">
                  {current.player.current_school} · {current.player.eligibility_remaining} yr remaining
                </p>
              </div>
              <span className="shrink-0 rounded-full bg-[#dcf0e3] px-3 py-1 text-[13px] font-semibold text-[#15542a]">
                Fit {current.fitScore}
              </span>
            </div>
            <p className="mt-3 text-center text-[12px] text-[#9ca3af]">{swipeHint}</p>
          </div>

          <div className="grid gap-5 p-5">
            {/* Measurements */}
            <div className="grid grid-cols-4 gap-2">
              <ReviewMetric
                label="H / W"
                value={`${formatHeightInFeetInches(current.player.measurements?.height_in)} / ${current.player.measurements?.weight_lbs ?? "--"}`}
              />
              <ReviewMetric
                label="Arm"
                value={current.player.measurements?.arm_length_in ? `${current.player.measurements.arm_length_in}"` : "--"}
              />
              <ReviewMetric
                label="Forty"
                value={current.player.measurements?.forty_time ? `${current.player.measurements.forty_time}s` : "--"}
              />
              <ReviewMetric label="Yrs Left" value={String(current.player.eligibility_remaining)} />
            </div>

            <div className="grid gap-4 lg:grid-cols-[1fr_0.95fr]">
              <div className="rounded-xl border border-[#e4e8e5] bg-[#f8f9fa] p-4">
                <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-[#9ca3af]">
                  <ShieldCheck className="h-3.5 w-3.5" />
                  Fit Explanation
                </div>
                <p className="mt-2 text-[13px] text-[#4b5563]">{current.fitSummary}</p>
                <div className="mt-3 grid gap-1.5">
                  {current.matchReasons.map((reason) => (
                    <div key={reason} className="rounded-lg bg-white px-3 py-2 text-[12px] text-[#4b5563] border border-[#e4e8e5]">
                      {reason}
                    </div>
                  ))}
                </div>
                <p className="mt-3 text-[11px] text-[#9ca3af]">
                  Production {current.productionScore} · Measurement {current.measurementScore}
                </p>
              </div>

              <div className="rounded-xl border border-[#e4e8e5] bg-[#f8f9fa] p-4">
                <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-[#9ca3af]">
                  <Zap className="h-3.5 w-3.5" />
                  Key Stats
                </div>
                <div className="mt-2 grid gap-1.5 sm:grid-cols-2">
                  {stats.map((stat) => (
                    <div key={stat} className="rounded-lg border border-[#e4e8e5] bg-white px-3 py-2 text-[12px] font-medium text-[#111827]">
                      {stat}
                    </div>
                  ))}
                </div>
                <p className="mt-3 text-[11px] text-[#9ca3af]">
                  {current.player.latest_stats?.season ?? "No season logged"}
                </p>
              </div>
            </div>

            {productionMetrics.length > 0 && (
              <div className="rounded-xl border border-[#e4e8e5] bg-[#f8f9fa] p-4">
                <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-[#9ca3af]">
                  Latest Production · {current.player.latest_stats?.season ?? "—"}
                </p>
                <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                  {productionMetrics.map((metric) => (
                    <div key={metric.label} className="rounded-lg border border-[#e4e8e5] bg-white px-3 py-2">
                      <p className="text-[11px] uppercase tracking-[0.08em] text-[#9ca3af]">{metric.label}</p>
                      <p className="mt-0.5 text-[15px] font-semibold text-[#111827]">{metric.value}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="grid gap-2 sm:grid-cols-2">
              <Link
                href={current.player.film_url ?? "#"}
                target="_blank"
                className="flex items-center justify-center gap-2 rounded-xl border border-[#e4e8e5] py-2 text-[13px] font-medium text-[#4b5563] hover:bg-[#f1f5f2]"
              >
                <Film className="h-4 w-4" />
                Open film
              </Link>
              <Link
                href={`/players/${current.player.id}`}
                className="flex items-center justify-center gap-2 rounded-xl border border-[#e4e8e5] py-2 text-[13px] font-medium text-[#4b5563] hover:bg-[#f1f5f2]"
              >
                <Eye className="h-4 w-4" />
                Full profile
              </Link>
            </div>
          </div>
        </div>

        {/* Decision panel */}
        <div className="grid gap-4 content-start">
          <div className="rounded-2xl border border-[#e4e8e5] bg-white p-4">
            <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-[#9ca3af]">Decision Keys</p>
            <div className="grid gap-1 text-[13px] text-[#4b5563]">
              <p>← Left arrow: pass</p>
              <p>→ Right arrow: shortlist</p>
              <p>S: save for later</p>
              <p>F: needs film</p>
            </div>
          </div>

          <div className="rounded-2xl border border-[#e4e8e5] bg-white p-4">
            <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-[#9ca3af]">Reviewer Note</p>
            <Textarea
              placeholder="Context for coordinator, concern to verify on film, or roster usage note..."
              value={note}
              onChange={(event) => setNote(event.target.value)}
              className="border-[#e4e8e5]"
            />
          </div>

          <div className="grid gap-2">
            <DecisionButton
              disabled={isPending}
              icon={<MoveLeft className="h-4 w-4" />}
              label="Pass"
              meta="←"
              variant="outline"
              onClick={() => void handleDecision("left")}
            />
            <DecisionButton
              disabled={isPending}
              icon={<Bookmark className="h-4 w-4" />}
              label="Save for later"
              meta="S"
              variant="outline"
              onClick={() => void handleDecision("save")}
            />
            <DecisionButton
              disabled={isPending}
              icon={<Film className="h-4 w-4" />}
              label="Needs film"
              meta="F"
              variant="outline"
              onClick={() => void handleDecision("needs_film")}
            />
            <button
              type="button"
              disabled={isPending}
              className="flex h-12 w-full items-center justify-between rounded-xl bg-[#15542a] px-4 text-sm font-medium text-white hover:bg-[#1a6934] disabled:opacity-50"
              onClick={() => void handleDecision("right")}
            >
              <span className="flex items-center gap-2">
                <MoveRight className="h-4 w-4" />
                Shortlist
              </span>
              <span className="text-[12px] opacity-70">→</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function ReviewMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-[#e4e8e5] bg-[#f8f9fa] p-3">
      <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[#9ca3af]">{label}</p>
      <p className="mt-1 text-[15px] font-semibold text-[#111827]">{value}</p>
    </div>
  );
}

function DecisionButton({
  icon,
  label,
  meta,
  onClick,
  variant,
  disabled
}: {
  icon: ReactNode;
  label: string;
  meta: string;
  onClick: () => void;
  variant: "default" | "outline" | "secondary";
  disabled: boolean;
}) {
  return (
    <button
      type="button"
      className="flex h-12 w-full items-center justify-between rounded-xl border border-[#e4e8e5] bg-white px-4 text-sm font-medium text-[#4b5563] hover:bg-[#f1f5f2] disabled:opacity-50"
      disabled={disabled}
      onClick={onClick}
    >
      <span className="flex items-center gap-2">
        {icon}
        {label}
      </span>
      <span className="text-[12px] text-[#9ca3af]">{meta}</span>
    </button>
  );
}
