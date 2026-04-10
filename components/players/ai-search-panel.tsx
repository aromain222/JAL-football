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
import { boardFilterBadges } from "@/lib/ai/player-search";
import { scoutingDisplay } from "@/lib/football-ui";
import type { AiBoardFilters, AiPlayerSearchResult, AiSearchCriteria } from "@/lib/ai/player-search";
import type { Player } from "@/lib/types";

type SearchResult = AiPlayerSearchResult & { player: Player };

const EXAMPLE_QUERIES = [
  "Big nose tackle with 2 years of eligibility left",
  "Slot corner who is good in the run",
  "Athletic pass rushing edge with at least 1 year remaining",
  "Physical off-ball linebacker who plays in the box and tackles"
];

function getScoreVariant(score: number) {
  if (score >= 80) return "success";
  if (score >= 60) return "accent";
  if (score >= 40) return "warning";
  return "default";
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

  function handleExample(example: string) {
    setQuery(example);
    setError(null);
    setCriteria(null);
    setResults(null);
  }

  return (
    <Card className="relative overflow-hidden border-[#142218]/10 bg-[linear-gradient(160deg,#f7faf7_0%,#edf2ee_100%)] shadow-[0_26px_70px_rgba(15,23,42,0.12)]">
      <div className="absolute inset-x-0 top-0 h-28 bg-[linear-gradient(135deg,#11251d_0%,#183327_60%,#1f4435_100%)]" />
      <div className="absolute inset-x-0 top-0 h-28 bg-[linear-gradient(to_right,rgba(255,255,255,0.06)_1px,transparent_1px)] bg-[length:84px_84px] opacity-50" />
      <CardContent className="relative grid gap-5 p-6">
        <div className="flex flex-col gap-4 rounded-[28px] border border-white/10 bg-[linear-gradient(145deg,rgba(10,21,16,0.92),rgba(18,40,30,0.88))] p-5 text-white shadow-[0_20px_50px_rgba(7,12,10,0.24)]">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl border border-white/10 bg-white/8">
              <Sparkles className="h-4 w-4 text-[#d3b26c]" />
            </div>
            <div>
              <p className="field-label text-[#d3b26c]">AI Search Desk</p>
              <h2 className={`${scoutingDisplay.className} mt-1 text-[2.2rem] uppercase leading-none tracking-[0.04em] text-[#f4efe2]`}>
                Find the Fit
              </h2>
            </div>
          </div>
          <p className="max-w-2xl text-sm leading-6 text-[#d8e1d5]/76">
            Describe the role in football language. The search model converts it into board scope, traits, PFF evidence, and projection logic.
          </p>
          {scopeBadges.length ? (
            <div className="flex flex-wrap gap-1.5">
              {scopeBadges.slice(0, 6).map((badge) => (
                <Badge key={badge} className="border border-white/10 bg-white/8 text-[#dce7d9]" variant="default">
                  {badge}
                </Badge>
              ))}
            </div>
          ) : null}

          <form onSubmit={handleSearch} className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_auto]">
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder='e.g. "big nose tackle with 2 years of eligibility"'
              className="min-w-0 rounded-[20px] border border-white/10 bg-white/10 px-4 py-3 text-sm text-white placeholder:text-slate-400 focus:border-[#d3b26c]/55 focus:outline-none focus:ring-1 focus:ring-[#d3b26c]/30"
              disabled={loading}
            />
            <Button
              type="submit"
              disabled={loading || !query.trim()}
              className="h-12 shrink-0 gap-2 rounded-[18px] bg-[#d3b26c] text-[#0d1a14] hover:bg-[#e2c380] disabled:opacity-50"
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
              {loading ? "Searching…" : "Run search"}
            </Button>
          </form>
        </div>

        {!results && !loading && (
          <div className="grid gap-2 sm:grid-cols-2">
            {EXAMPLE_QUERIES.map((ex) => (
              <button
                key={ex}
                type="button"
                onClick={() => handleExample(ex)}
                className="rounded-[20px] border border-[#d7ded9] bg-white/72 px-4 py-3 text-left text-sm text-slate-700 transition hover:-translate-y-0.5 hover:border-[#1f4435]/30 hover:bg-white"
              >
                {ex}
              </button>
            ))}
          </div>
        )}

        {error && (
          <div className="rounded-[20px] border border-rose-500/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-700">
            {error}
          </div>
        )}

        {results !== null && criteria && (
          <div className="grid gap-4">
            <div className="rounded-[24px] border border-[#d9e0db] bg-white/72 px-4 py-4">
              <button
                type="button"
                onClick={() => setShowReasoning((v) => !v)}
                className="flex w-full items-center justify-between text-left"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <span className="field-label text-[#456253]">AI matched</span>
                  {criteria.positions.map((pos) => (
                    <Badge key={pos} className="bg-[#143828] text-[#d8f1e1]" variant="default">
                      {pos}
                    </Badge>
                  ))}
                  {criteria.min_years_remaining != null && (
                    <Badge className="border border-[#d7ded9] bg-white text-[#355546]" variant="default">
                      {criteria.min_years_remaining}+ yr eligibility
                    </Badge>
                  )}
                  {criteria.min_weight_lbs != null && (
                    <Badge className="border border-[#d7ded9] bg-white text-[#355546]" variant="default">
                      {criteria.min_weight_lbs}+ lbs
                    </Badge>
                  )}
                  {criteria.roles.map((role) => (
                    <Badge key={`${role.key}-${role.label}`} className="border border-[#d7ded9] bg-white text-[#355546]" variant="default">
                      {role.label}
                    </Badge>
                  ))}
                  {criteria.traits.map((trait) => (
                    <Badge key={`${trait.key}-${trait.label}`} className="border border-[#d7ded9] bg-white text-[#355546]" variant="default">
                      {trait.label}
                    </Badge>
                  ))}
                  {criteria.pff_criteria.map((criterion) => (
                    <Badge key={criterion.column} className="border border-[#d7ded9] bg-white text-[#355546]" variant="default">
                      {criterion.label}
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
                <p className="mt-3 border-t border-[#dfe5e1] pt-3 text-sm text-slate-600">
                  {criteria.reasoning}
                </p>
              )}
            </div>

            <div>
              <p className="field-label text-[#456253]">Results</p>
              <h3 className={`${scoutingDisplay.className} mt-1 text-[2.3rem] uppercase leading-none tracking-[0.04em] text-[#16261f]`}>
                {results.length} matching players
              </h3>
            </div>

            {results.length === 0 && (
              <div className="rounded-[24px] border border-dashed border-[#b9c7bf] bg-[#f5f7f4] p-8 text-center">
                <p className="text-sm text-slate-500">
                  No players matched these criteria. Try broadening the description.
                </p>
              </div>
            )}

            <div className="grid gap-6 2xl:grid-cols-2">
              {results.map((result) => (
                <div key={result.playerId} className="grid gap-2">
                  <PlayerCard
                    player={result.player}
                    detailHref={`/players/${result.playerId}`}
                    fitScore={result.matchScore}
                    onQuickView={(id: string) => setActivePlayerId(id)}
                  />
                  <div className="flex flex-wrap items-center gap-2 px-1">
                    <Badge className="border border-transparent" variant={getScoreVariant(result.matchScore) as "success" | "accent" | "warning" | "default"}>
                      {result.matchScore}% match
                    </Badge>
                    {!result.hasPffData && (
                      <span className="rounded-full border border-[#c8d0cb] px-2.5 py-0.5 text-xs uppercase tracking-[0.18em] text-slate-500">
                        Profile only
                      </span>
                    )}
                    <span className="rounded-full bg-[#153728] px-2.5 py-1 text-[11px] uppercase tracking-[0.16em] text-[#d8f1e1]">
                      Fit {result.fitScore}
                    </span>
                    <span className="rounded-full bg-[#24483a] px-2.5 py-1 text-[11px] uppercase tracking-[0.16em] text-[#d8f1e1]">
                      Prod {result.productionScore}
                    </span>
                    <span className="rounded-full bg-[#35584b] px-2.5 py-1 text-[11px] uppercase tracking-[0.16em] text-[#d8f1e1]">
                      PFF {result.pffScore}
                    </span>
                    {result.reasonBadges.map((reason) => (
                      <span key={reason} className="rounded-full border border-[#d7ded9] bg-white/76 px-2.5 py-1 text-[11px] uppercase tracking-[0.16em] text-[#355546]">
                        {reason}
                      </span>
                    ))}
                  </div>
                  {result.searchExplanation.length ? (
                    <div className="rounded-[20px] border border-[#d8e0db] bg-white/72 px-4 py-3">
                      <div className="grid gap-1.5">
                        {result.searchExplanation.map((line) => (
                          <p key={line} className="text-sm leading-6 text-slate-600">
                            {line}
                          </p>
                        ))}
                      </div>
                    </div>
                  ) : null}
                  {result.featuredStats.length ? (
                    <div className="rounded-[20px] border border-[#d8e0db] bg-[#f4f7f4] px-4 py-3">
                      <p className="field-label text-[#456253]">Featured Stats</p>
                      <div className="mt-2 flex flex-wrap gap-2">
                        {result.featuredStats.map((stat) => (
                          <div
                            key={`${stat.label}-${stat.value}`}
                            className="flex items-center gap-1.5 rounded-full border border-[#d5ddd8] bg-white px-3 py-1.5 text-sm"
                          >
                            <span className="text-slate-500">{stat.label}</span>
                            <span className="font-semibold text-slate-800">{stat.value}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : null}
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>

      <Sheet open={activePlayerId !== null} onClose={() => setActivePlayerId(null)}>
        <PlayerQuickView playerId={activePlayerId} />
      </Sheet>
    </Card>
  );
}
