"use client";

import { useState } from "react";
import { Sparkles, Loader2, ChevronDown, ChevronUp } from "lucide-react";
import { aiPlayerSearchAction } from "@/app/actions";
import { PlayerCard } from "@/components/players/player-card";
import { PlayerQuickView } from "@/components/players/player-quick-view";
import { Sheet } from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import type { AiSearchCriteria, AiPlayerSearchResult } from "@/lib/ai/player-search";
import type { Player } from "@/lib/types";

type SearchResult = AiPlayerSearchResult & { player: Player };

const EXAMPLE_QUERIES = [
  "Big nose tackle with 2 years of eligibility left",
  "Slot corner who is good in the run",
  "Athletic pass rushing edge with at least 1 year remaining",
  "Coverage linebacker with 3 years eligibility"
];

function getScoreVariant(score: number) {
  if (score >= 80) return "success";
  if (score >= 60) return "accent";
  if (score >= 40) return "warning";
  return "default";
}

export function AiSearchPanel() {
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [criteria, setCriteria] = useState<AiSearchCriteria | null>(null);
  const [results, setResults] = useState<SearchResult[] | null>(null);
  const [activePlayerId, setActivePlayerId] = useState<string | null>(null);
  const [showReasoning, setShowReasoning] = useState(false);

  async function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    if (!query.trim()) return;
    setLoading(true);
    setError(null);
    setCriteria(null);
    setResults(null);

    try {
      const data = await aiPlayerSearchAction(query.trim());
      setCriteria(data.criteria);
      setResults(data.results);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Search failed. Try again.");
    } finally {
      setLoading(false);
    }
  }

  function handleExample(example: string) {
    setQuery(example);
    setError(null);
    setCriteria(null);
    setResults(null);
  }

  return (
    <Card className="overflow-hidden border-cyan-200 bg-gradient-to-br from-slate-950 to-slate-900">
      <CardContent className="grid gap-5 p-6">
        {/* Header */}
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-cyan-400/15">
            <Sparkles className="h-4 w-4 text-cyan-400" />
          </div>
          <div>
            <p className="text-xs uppercase tracking-[0.28em] text-cyan-400">AI Player Search</p>
            <p className="mt-0.5 text-sm text-slate-300">
              Describe a player profile in plain English — AI maps it to PFF grades, snap data, and measurables.
            </p>
          </div>
        </div>

        {/* Input form */}
        <form onSubmit={handleSearch} className="flex gap-2">
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder='e.g. "big nose tackle with 2 years of eligibility"'
            className="min-w-0 flex-1 rounded-xl border border-white/10 bg-white/10 px-4 py-2.5 text-sm text-white placeholder:text-slate-400 focus:border-cyan-400/50 focus:outline-none focus:ring-1 focus:ring-cyan-400/30"
            disabled={loading}
          />
          <Button
            type="submit"
            disabled={loading || !query.trim()}
            className="shrink-0 gap-2 bg-cyan-500 text-white hover:bg-cyan-400 disabled:opacity-50"
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
            {loading ? "Searching…" : "Search"}
          </Button>
        </form>

        {/* Example queries */}
        {!results && !loading && (
          <div className="flex flex-wrap gap-2">
            {EXAMPLE_QUERIES.map((ex) => (
              <button
                key={ex}
                type="button"
                onClick={() => handleExample(ex)}
                className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-slate-300 transition hover:border-cyan-400/40 hover:bg-cyan-400/10 hover:text-cyan-300"
              >
                {ex}
              </button>
            ))}
          </div>
        )}

        {/* Error state */}
        {error && (
          <div className="rounded-xl border border-rose-500/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-300">
            {error}
          </div>
        )}

        {/* Results */}
        {results !== null && criteria && (
          <div className="grid gap-4">
            {/* Criteria reasoning */}
            <div className="rounded-xl border border-white/10 bg-white/5 px-4 py-3">
              <button
                type="button"
                onClick={() => setShowReasoning((v) => !v)}
                className="flex w-full items-center justify-between text-left"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-xs uppercase tracking-[0.22em] text-slate-400">
                    AI matched
                  </span>
                  {criteria.positions.map((pos) => (
                    <Badge key={pos} variant="accent">
                      {pos}
                    </Badge>
                  ))}
                  {criteria.min_years_remaining != null && (
                    <Badge variant="default">{criteria.min_years_remaining}+ yr eligibility</Badge>
                  )}
                  {criteria.min_weight_lbs != null && (
                    <Badge variant="default">{criteria.min_weight_lbs}+ lbs</Badge>
                  )}
                  {criteria.pff_criteria.map((c) => (
                    <Badge key={c.column} variant="default">
                      {c.label}
                    </Badge>
                  ))}
                </div>
                {showReasoning ? (
                  <ChevronUp className="ml-3 h-4 w-4 shrink-0 text-slate-400" />
                ) : (
                  <ChevronDown className="ml-3 h-4 w-4 shrink-0 text-slate-400" />
                )}
              </button>
              {showReasoning && (
                <p className="mt-3 border-t border-white/10 pt-3 text-sm text-slate-300">
                  {criteria.reasoning}
                </p>
              )}
            </div>

            {/* Result count */}
            <div>
              <p className="text-xs uppercase tracking-[0.28em] text-slate-400">Results</p>
              <h3 className="mt-0.5 text-xl font-semibold text-white">
                {results.length} matching players
              </h3>
            </div>

            {results.length === 0 && (
              <div className="rounded-xl border border-dashed border-white/10 p-8 text-center">
                <p className="text-sm text-slate-400">
                  No players matched these criteria. Try broadening the description.
                </p>
              </div>
            )}

            {/* Player grid */}
            <div className="grid gap-6 xl:grid-cols-2">
              {results.map((result) => (
                <div key={result.playerId} className="grid gap-2">
                  <PlayerCard
                    player={result.player}
                    detailHref={`/players/${result.playerId}`}
                    onQuickView={(id) => setActivePlayerId(id)}
                  />
                  {/* Match score + reasons */}
                  <div className="flex flex-wrap items-center gap-2 px-1">
                    <Badge variant={getScoreVariant(result.matchScore) as any}>
                      {result.matchScore}% match
                    </Badge>
                    {!result.hasPffData && (
                      <span className="rounded-full border border-slate-600 px-2.5 py-0.5 text-xs text-slate-400">
                        Profile only
                      </span>
                    )}
                    {result.matchReasons.map((reason, i) => (
                      <span key={i} className="rounded-full bg-slate-800 px-2.5 py-0.5 text-xs text-slate-300">
                        {reason}
                      </span>
                    ))}
                    {result.pffHighlights.map((h, i) => (
                      <span key={`pff-${i}`} className="rounded-full bg-cyan-900/50 px-2.5 py-0.5 text-xs text-cyan-300">
                        {h}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>

      {/* Quick view sheet */}
      <Sheet open={activePlayerId !== null} onClose={() => setActivePlayerId(null)}>
        <PlayerQuickView playerId={activePlayerId} />
      </Sheet>
    </Card>
  );
}
