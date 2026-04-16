"use client";

import Image from "next/image";
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
  Timer,
  Zap
} from "lucide-react";
import { submitReviewAction } from "@/app/actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import {
  formatHeightInFeetInches,
  getPlayerKeyStats,
  getPlayerPhotoUrl,
  getPlayerProductionMetrics
} from "@/lib/football";
import { scoutingDisplay } from "@/lib/football-ui";
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
  const progressLabel = `${reviewedSoFar} of ${totalCount} reviewed`;
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
      <Card className="overflow-hidden scouting-surface">
        <CardContent className="p-0">
          <div className="scouting-dark-surface px-8 py-7 text-white">
            <p className="text-xs uppercase tracking-[0.28em] text-[var(--scout-gold-soft)]">Queue cleared</p>
            <h2 className="mt-3 text-4xl font-semibold">Board triage complete.</h2>
            <p className="mt-3 max-w-2xl text-sm text-[#d7e0d3]/75">
              Every matching player for {need.title} has been logged into the review trail. Move the best fits into shortlist management or reopen the need detail page.
            </p>
          </div>
          <div className="grid gap-4 p-8 lg:grid-cols-2">
            <div className="rounded-[28px] border bg-slate-50 p-6">
              <p className="text-xs uppercase tracking-[0.28em] text-slate-500">Final tally</p>
              <div className="mt-3 text-4xl font-semibold text-slate-950">{reviewedSoFar}</div>
              <p className="mt-2 text-sm text-slate-600">Reviewed against the current need profile.</p>
            </div>
            <div className="grid gap-3">
              <Button asChild size="lg" className="scouting-cta">
                <Link href="/shortlist">Open shortlist board</Link>
              </Button>
              <Button asChild variant="outline">
                <Link href={`/needs/${need.id}`}>Return to need detail</Link>
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  const stats = getPlayerKeyStats(current.player);
  const productionMetrics = getPlayerProductionMetrics(current.player, 4);
  const swipeHint =
    dragX > 40
      ? "Shortlist"
      : dragX < -40
        ? "Pass"
        : "Drag card or use controls";

  return (
    <div className="grid gap-6">
      <Card className="scouting-dark-surface overflow-hidden border-[#1a342b] text-white">
        <CardContent className="grid gap-5 p-6 lg:grid-cols-[1fr_auto] lg:items-center">
          <div>
            <p className="field-label text-[var(--scout-teal)]">{need.position} Triage Deck</p>
            <h2 className={`${scoutingDisplay.className} mt-2 text-[2.8rem] uppercase leading-[0.9] tracking-[0.04em] text-[#f5efe0]`}>
              {need.title}
            </h2>
            <p className="mt-3 text-sm text-[#d7e0d3]/76">{progressLabel}</p>
          </div>
          <div className="min-w-[240px]">
            <div className="flex items-center justify-between text-sm text-[#d7e0d3]/76">
              <span>Progress</span>
              <span>{progressWidth}%</span>
            </div>
            <div className="mt-3 h-2 rounded-full bg-white/10">
              <div className="h-2 rounded-full bg-[#d3b26c] transition-all" style={{ width: `${progressWidth}%` }} />
            </div>
          </div>
        </CardContent>
      </Card>

      {error ? (
        <div className="flex items-center gap-2 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          <CircleAlert className="h-4 w-4" />
          {error}
        </div>
      ) : null}

      <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <div className="relative min-h-[640px]">
          <div className="absolute inset-6 rounded-[32px] border border-[#d8ddd7] bg-white/35" />
          <div className="absolute inset-3 rounded-[32px] border border-[#e5ebe6] bg-white/55" />
          <Card
            className="relative z-10 overflow-hidden border-[#d8ddd7] bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(245,247,245,0.95))] shadow-[0_28px_60px_rgba(15,23,42,0.14)] transition-transform"
            style={{ transform: `translateX(${dragX}px) rotate(${dragX / 45}deg)` }}
          >
            <CardContent className="p-0">
              <div
                className="scouting-dark-surface select-none px-6 py-6 text-white"
                onPointerDown={handlePointerDown}
                onPointerMove={handlePointerMove}
                onPointerUp={handlePointerUp}
                onPointerCancel={handlePointerUp}
              >
                <div className="flex items-start gap-4">
                  <div className="relative h-24 w-24 overflow-hidden rounded-3xl border border-white/10 bg-white/5">
                    <Image
                      alt={`${current.player.first_name} ${current.player.last_name}`}
                      className="object-cover"
                      fill
                      sizes="96px"
                      src={getPlayerPhotoUrl(current.player)}
                    />
                  </div>
                  <div className="flex-1">
                    <p className="field-label text-[var(--scout-teal)]">
                      {current.player.position} • {current.player.class_year} • Fit {current.fitScore}
                    </p>
                    <h3 className={`${scoutingDisplay.className} mt-3 text-[3.3rem] uppercase leading-[0.88] tracking-[0.03em] text-[#f5efe0]`}>
                      {current.player.first_name} {current.player.last_name}
                    </h3>
                    <p className="mt-2 text-sm text-slate-300">
                      {current.player.current_school} • {current.player.eligibility_remaining} years remaining
                    </p>
                  </div>
                </div>

                <div className="mt-5 flex items-center justify-between text-xs uppercase tracking-[0.25em] text-slate-300">
                  <span>{swipeHint}</span>
                  <span>Swipe left / right</span>
                </div>
              </div>

              <div className="grid gap-5 p-6">
                <div className="grid gap-3 md:grid-cols-4">
                  <ReviewMetric
                    label="Height / Weight"
                    value={`${formatHeightInFeetInches(current.player.measurements?.height_in)} / ${current.player.measurements?.weight_lbs ?? "--"}`}
                  />
                  <ReviewMetric label="Arm" value={current.player.measurements?.arm_length_in ? `${current.player.measurements.arm_length_in}"` : "--"} />
                  <ReviewMetric label="Forty" value={current.player.measurements?.forty_time ? `${current.player.measurements.forty_time}s` : "--"} />
                  <ReviewMetric label="Years Left" value={String(current.player.eligibility_remaining)} />
                </div>

                <div className="grid gap-4 lg:grid-cols-[1fr_0.95fr]">
                  <div className="rounded-[28px] border bg-slate-50 p-5">
                    <div className="flex items-center gap-2 text-xs uppercase tracking-[0.24em] text-slate-500">
                      <ShieldCheck className="h-4 w-4" />
                      Fit Explanation
                    </div>
                    <p className="mt-3 text-sm text-slate-700">{current.fitSummary}</p>
                    <div className="mt-4 grid gap-2">
                      {current.matchReasons.map((reason) => (
                        <div key={reason} className="rounded-2xl bg-white px-4 py-3 text-sm text-slate-700">
                          {reason}
                        </div>
                      ))}
                    </div>
                    <p className="mt-4 text-xs uppercase tracking-[0.2em] text-slate-500">
                      Production {current.productionScore} • Measurement {current.measurementScore}
                    </p>
                  </div>

                  <div className="rounded-[28px] border bg-slate-50 p-5">
                    <div className="flex items-center gap-2 text-xs uppercase tracking-[0.24em] text-slate-500">
                      <Zap className="h-4 w-4" />
                      Key Stats
                    </div>
                    <div className="mt-4 grid gap-2 sm:grid-cols-2">
                      {stats.map((stat) => (
                        <div key={stat} className="rounded-2xl bg-white px-4 py-3 text-sm font-medium text-slate-800">
                          {stat}
                        </div>
                      ))}
                    </div>
                    <p className="mt-4 text-xs uppercase tracking-[0.2em] text-slate-500">
                      {current.player.latest_stats?.season ?? "No season logged"}
                      {current.player.measurements?.forty_time ? ` • Forty ${current.player.measurements.forty_time}s` : ""}
                      {(current.player.tags ?? []).length ? ` • ${(current.player.tags ?? []).slice(0, 2).join(" • ")}` : ""}
                    </p>
                  </div>
                </div>

                <div className="rounded-[28px] border bg-slate-50 p-5">
                  <div className="flex items-center justify-between gap-3">
                    <div className="text-xs uppercase tracking-[0.24em] text-slate-500">
                      Latest Production
                    </div>
                    <div className="text-xs uppercase tracking-[0.2em] text-slate-500">
                      {current.player.latest_stats?.season ?? "No season"}
                    </div>
                  </div>
                  <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                    {productionMetrics.map((metric) => (
                      <div key={metric.label} className="rounded-2xl bg-white px-4 py-3">
                        <div className="text-[11px] uppercase tracking-[0.18em] text-slate-500">{metric.label}</div>
                        <div className="mt-1 text-base font-semibold text-slate-900">{metric.value}</div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <Button asChild variant="outline">
                    <Link href={current.player.film_url ?? "#"} target="_blank">
                      <Film className="h-4 w-4" />
                      Open film
                    </Link>
                  </Button>
                  <Button asChild variant="outline">
                    <Link href={`/players/${current.player.id}`}>
                      <Eye className="h-4 w-4" />
                      Full player detail
                    </Link>
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-4">
          <Card className="scouting-surface">
            <CardContent className="p-5">
              <p className="field-label text-[#52695d]">Decision Keys</p>
              <div className="mt-3 grid gap-2 text-sm text-slate-700">
                <p>Left arrow: pass</p>
                <p>Right arrow: shortlist</p>
                <p>S: save for later</p>
                <p>F: needs film</p>
              </div>
            </CardContent>
          </Card>

          <Card className="scouting-surface">
            <CardContent className="p-5">
              <p className="field-label text-[#52695d]">Reviewer Note</p>
              <Textarea
                className="mt-4"
                placeholder="Context for coordinator, concern to verify on film, or roster usage note..."
                value={note}
                onChange={(event) => setNote(event.target.value)}
              />
            </CardContent>
          </Card>

          <div className="grid gap-3">
            <DecisionButton
              disabled={isPending}
              icon={<MoveLeft className="h-4 w-4" />}
              label="Pass"
              meta="Left"
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
            <DecisionButton
              disabled={isPending}
              icon={<MoveRight className="h-4 w-4" />}
              label="Shortlist"
              meta="Right"
              variant="default"
              className="scouting-cta border-0"
              onClick={() => void handleDecision("right")}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

function ReviewMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-3xl border bg-white p-4">
      <p className="text-xs uppercase tracking-[0.24em] text-slate-500">{label}</p>
      <div className="mt-2 text-xl font-semibold text-slate-950">{value}</div>
    </div>
  );
}

function DecisionButton({
  icon,
  label,
  meta,
  onClick,
  variant,
  disabled,
  className
}: {
  icon: ReactNode;
  label: string;
  meta: string;
  onClick: () => void;
  variant: "default" | "outline" | "secondary";
  disabled: boolean;
  className?: string;
}) {
  return (
    <Button className={`h-12 w-full justify-between ${className ?? ""}`} disabled={disabled} onClick={onClick} type="button" variant={variant}>
      <span className="flex items-center gap-2">
        {icon}
        {label}
      </span>
      <span className="text-xs uppercase tracking-[0.24em] opacity-80">{meta}</span>
    </Button>
  );
}
