"use client";

import { useState } from "react";
import { Sparkles, Loader2, ChevronDown, ChevronUp } from "lucide-react";
import { aiPlayerSearchAction } from "@/app/actions";
import { PlayerCard } from "@/components/players/player-card";
import { PlayerQuickView } from "@/components/players/player-quick-view";
import { Sheet } from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { boardFilterBadges } from "@/lib/ai/player-search";
import { cn } from "@/lib/utils";
import type { AiBoardFilters, AiPlayerSearchResult, AiSearchCriteria } from "@/lib/ai/player-search";
import type { Player } from "@/lib/types";

type SearchResult = AiPlayerSearchResult & { player: Player };

const EXAMPLE_QUERIES = [
  "Big nose tackle with 2 years of eligibility",
  "Slot corner who is good in the run",
  "Pass rushing edge with at least 1 year remaining",
  "Physical off-ball linebacker who plays in the box"
];

function getMatchColor(score: number) {
  if (score >= 80) return "bg-emerald-100 text-emerald-800";
  if (score >= 60) return "bg-blue-100 text-blue-800";
  if (score >= 40) return "bg-amber-100 text-amber-800";
  return "bg-[#f1f5f2] text-[#4b5563]";
}

export function AiSearchPanel({ boardFilters }: { boardFilters?: AiBoardFilters }) {
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [criteria, setCriteria] = useState<AiSearchCriteria | null>(null);
  const [results, setResults] = useState<SearchResult[] | null>(null);
  const [activePlayerId, setActivePlayerId] = useState<string | null>(null);
  const [showReasoning, setShowReasoning] = useState(false);

  const scopeBadges = boardFilterBadges(boardFilters);

  async function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    if (!query.trim()) return;
    setLoading(true);
    setError(null);
    setCriteria(null);
    setResults(null);

    try {
      const data = await aiPlayerSearchAction({ query: query.trim(), boardFilters });
      setCriteria(data.criteria);
      setResults(data.results);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Search failed. Try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="grid gap-4">
      <form
        onSubmit={handleSearch}
        className="flex gap-2 rounded-2xl border border-[#e4e8e5] bg-white p-3"
      >
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#dcf0e3]">
          <Sparkles className="h-4 w-4 text-[#15542a]" />
        </div>
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Describe the player you need…"
          className="flex-1 bg-transparent text-[14px] text-[#111827] placeholder:text-[#9ca3af] focus:outline-none"
          disabled={loading}
        />
        <button
          type="submit"
          disabled={loading || !query.trim()}
          className="flex shrink-0 items-center gap-1.5 rounded-xl bg-[#15542a] px-4 py-2 text-[13px] font-medium text-white hover:bg-[#1a6934] disabled:opacity-50"
        >
          {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
          {loading ? "Searching…" : "Search"}
        </button>
      </form>

      <div className="flex flex-wrap gap-2">
        {EXAMPLE_QUERIES.map((ex) => (
          <button
            key={ex}
            type="button"
            onClick={() => { setQuery(ex); setError(null); setCriteria(null); setResults(null); }}
            className="rounded-full border border-[#e4e8e5] bg-white px-3 py-1.5 text-[12px] text-[#4b5563] hover:border-[#c8d0cb] hover:bg-[#f1f5f2]"
          >
            {ex}
          </button>
        ))}
        {scopeBadges.length > 0 && (
          <span className="rounded-full bg-[#dcf0e3] px-3 py-1.5 text-[12px] font-medium text-[#15542a]">
            Scoped: {scopeBadges.join(", ")}
          </span>
        )}
      </div>

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-[13px] text-red-700">
          {error}
        </div>
      )}

      {results !== null && criteria && (
        <div className="grid gap-4">
          <div className="rounded-2xl border border-[#e4e8e5] bg-white px-4 py-3">
            <button
              type="button"
              onClick={() => setShowReasoning((v) => !v)}
              className="flex w-full items-center justify-between text-left"
            >
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[#9ca3af]">
                  AI matched
                </span>
                {criteria.positions.slice(0, 2).map((pos) => (
                  <Badge key={pos} className="bg-[#dcf0e3] text-[#15542a]" variant="default">{pos}</Badge>
                ))}
                {criteria.min_years_remaining != null && (
                  <Badge variant="default">{criteria.min_years_remaining}+ yr eligibility</Badge>
                )}
                {criteria.roles.slice(0, 2).map((role) => (
                  <Badge key={`${role.key}-${role.label}`} variant="default">{role.label}</Badge>
                ))}
                {criteria.traits.slice(0, 2).map((trait) => (
                  <Badge key={`${trait.key}-${trait.label}`} variant="default">{trait.label}</Badge>
                ))}
              </div>
              {showReasoning ? (
                <ChevronUp className="ml-3 h-4 w-4 shrink-0 text-[#9ca3af]" />
              ) : (
                <ChevronDown className="ml-3 h-4 w-4 shrink-0 text-[#9ca3af]" />
              )}
            </button>
            {showReasoning && (
              <p className="mt-3 border-t border-[#f1f5f2] pt-3 text-[13px] text-[#4b5563]">
                {criteria.reasoning}
              </p>
            )}
          </div>

          <div className="flex items-baseline gap-2">
            <p className="text-[14px] font-semibold text-[#111827]">{results.length} matching players</p>
          </div>

          {results.length === 0 && (
            <div className="rounded-2xl border border-dashed border-[#e4e8e5] p-8 text-center">
              <p className="text-[13px] text-[#9ca3af]">
                No players matched these criteria. Try broadening the description.
              </p>
            </div>
          )}

          <div className="grid gap-5 2xl:grid-cols-2">
            {results.map((result) => (
              <div key={result.playerId} className="grid gap-2">
                <PlayerCard
                  player={result.player}
                  detailHref={`/players/${result.playerId}`}
                  fitScore={result.matchScore}
                  onQuickView={(id: string) => setActivePlayerId(id)}
                />
                <div className="flex flex-wrap items-center gap-2 px-1">
                  <span className={cn("rounded-full px-2.5 py-0.5 text-[11px] font-semibold", getMatchColor(result.matchScore))}>
                    {result.matchScore}% match
                  </span>
                  {result.reasonBadges.slice(0, 3).map((reason) => (
                    <span key={reason} className="rounded-full border border-[#e4e8e5] bg-white px-2.5 py-0.5 text-[11px] text-[#4b5563]">
                      {reason}
                    </span>
                  ))}
                </div>
                {result.searchExplanation.length > 0 && (
                  <div className="rounded-xl border border-[#e4e8e5] bg-[#f8f9fa] px-4 py-3">
                    <div className="grid gap-1">
                      {result.searchExplanation.map((line) => (
                        <p key={line} className="text-[13px] text-[#4b5563]">{line}</p>
                      ))}
                    </div>
                  </div>
                )}
                {result.featuredStats.length > 0 && (
                  <div className="flex flex-wrap gap-2 px-1">
                    {result.featuredStats.slice(0, 3).map((stat) => (
                      <div
                        key={`${stat.label}-${stat.value}`}
                        className="flex items-center gap-1.5 rounded-full border border-[#e4e8e5] bg-white px-3 py-1.5 text-[12px]"
                      >
                        <span className="text-[#9ca3af]">{stat.label}</span>
                        <span className="font-semibold text-[#111827]">{stat.value}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      <Sheet open={activePlayerId !== null} onClose={() => setActivePlayerId(null)}>
        <PlayerQuickView playerId={activePlayerId} />
      </Sheet>
    </div>
  );
}
