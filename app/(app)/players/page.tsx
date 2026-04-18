import { PlayersFilterBar } from "@/components/players/players-filter-bar";
import { PlayerListClient } from "@/components/players/player-list-client";
import { AiSearchPanel } from "@/components/players/ai-search-panel";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { getNeedById, getPlayersPage } from "@/lib/data/queries";
import { scoutingBody, scoutingDisplay } from "@/lib/football-ui";

function normalizeString(value?: string) {
  return value && value !== "ALL" ? value : undefined;
}

function normalizeNumber(value?: string) {
  if (!value || value === "ALL") return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

export default async function PlayersPage({
  searchParams
}: {
  searchParams?: {
    page?: string;
    needId?: string;
    position?: string;
    search?: string;
    armLengthMin?: string;
    classYear?: string;
    yearsRemaining?: string;
    school?: string;
    conference?: string;
    archetype?: string;
  };
}) {
  const filters = {
    page: normalizeNumber(searchParams?.page) ?? 1,
    pageSize: 24,
    needId: normalizeString(searchParams?.needId),
    position: normalizeString(searchParams?.position),
    search: normalizeString(searchParams?.search),
    armLengthMin: normalizeNumber(searchParams?.armLengthMin),
    classYear: normalizeString(searchParams?.classYear),
    yearsRemaining: normalizeNumber(searchParams?.yearsRemaining),
    school: normalizeString(searchParams?.school),
    conference: normalizeString(searchParams?.conference),
    archetype: normalizeString(searchParams?.archetype)
  };

  const [result, need] = await Promise.all([
    getPlayersPage(filters),
    filters.needId ? getNeedById(filters.needId) : Promise.resolve(null)
  ]);

  const baseParams = new URLSearchParams();
  for (const [key, value] of Object.entries(searchParams ?? {})) {
    if (typeof value === "string" && value.length > 0 && key !== "page") {
      baseParams.set(key, value);
    }
  }

  const activeFilterBadges = [
    filters.position,
    filters.classYear,
    filters.yearsRemaining ? `${filters.yearsRemaining} year${filters.yearsRemaining === 1 ? "" : "s"}` : null,
    filters.armLengthMin ? `Arm ${filters.armLengthMin}+` : null,
    filters.school ? `School: ${filters.school}` : null,
    filters.conference
  ].filter(Boolean) as string[];

  const boardSummary = need
    ? `Board locked to ${need.title}. The feed is weighting fit while you narrow the pool.`
    : "Search the portal like a scouting room: scope the board, describe a role, then work the film-backed shortlist.";

  return (
    <div className={`${scoutingBody.className} grid gap-6`}>
      <section className="scouting-panel relative isolate">
        <div className="field-grid-lines absolute inset-0 opacity-45" />
        <div className="absolute inset-y-0 left-[10%] w-px bg-white/10" />
        <div className="absolute inset-y-0 right-[16%] w-px bg-white/10" />
        <div className="absolute inset-x-0 bottom-0 h-20 bg-[linear-gradient(180deg,transparent,rgba(5,12,10,0.42))]" />

        <div className="relative grid gap-8 px-6 py-7 lg:grid-cols-[minmax(0,1.5fr)_minmax(280px,0.9fr)] lg:px-8 lg:py-8">
          <div>
            <p className="field-label text-[#d3b26c]">Players Command Center</p>
            <h1 className={`${scoutingDisplay.className} mt-3 text-[3.2rem] uppercase leading-[0.88] tracking-[0.04em] text-[#f5efe0] sm:text-[4.5rem]`}>
              Build the Board
            </h1>
            <p className="mt-4 max-w-2xl text-sm leading-6 text-[#d7e0d3]/78 sm:text-[15px]">
              {boardSummary}
            </p>

            {need ? (
              <div className="mt-6">
                <Badge className="border border-[#d3b26c]/35 bg-[#d3b26c]/14 text-[#f5deb1]" variant="default">
                  Need Fit Active
                </Badge>
              </div>
            ) : null}
          </div>

          <div className="grid gap-3 self-end sm:grid-cols-3 lg:grid-cols-1">
            <div className="rounded-[24px] border border-white/10 bg-black/[0.16] p-4 backdrop-blur-sm">
              <p className="field-label text-[#8ac7b7]">Board Pool</p>
              <div className={`${scoutingDisplay.className} mt-2 text-[2.8rem] leading-none text-white`}>
                {result.total}
              </div>
              <p className="mt-2 text-sm text-[#d7e0d3]/70">Players in the current search field.</p>
            </div>
            <div className="rounded-[24px] border border-white/10 bg-black/[0.16] p-4 backdrop-blur-sm">
              <p className="field-label text-[#8ac7b7]">Page</p>
              <div className={`${scoutingDisplay.className} mt-2 text-[2.8rem] leading-none text-white`}>
                {result.page}/{result.totalPages}
              </div>
              <p className="mt-2 text-sm text-[#d7e0d3]/70">Working slice of the scouting board.</p>
            </div>
            <div className="rounded-[24px] border border-white/10 bg-black/[0.16] p-4 backdrop-blur-sm">
              <p className="field-label text-[#8ac7b7]">Mode</p>
              <div className={`${scoutingDisplay.className} mt-2 text-[2.1rem] leading-none text-white`}>
                {need ? "Need" : "Open"}
              </div>
              <p className="mt-2 text-sm text-[#d7e0d3]/70">
                {need ? "Results ordered for scheme fit." : "Open-ended board discovery."}
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="grid gap-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="field-label text-[#2c5947]">Primary Workflow</p>
            <h2 className={`${scoutingDisplay.className} mt-2 text-[2.7rem] uppercase leading-none tracking-[0.04em] text-[#13251d]`}>
              Start with AI Search
            </h2>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
              Describe the football role first. The board will rank players by alignment usage, physical fit, production, and PFF-backed evidence before you tighten the pool manually.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Badge className="bg-[#153728] text-[#d8f1e1]" variant="default">AI-first board</Badge>
          </div>
        </div>

        <AiSearchPanel boardFilters={searchParams ?? {}} />
      </section>

      <section className="grid gap-4">
        <div className="flex flex-col gap-2 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="field-label text-[#4e6d5d]">Secondary Controls</p>
            <h3 className={`${scoutingDisplay.className} mt-2 text-[2.15rem] uppercase leading-none tracking-[0.04em] text-[#16261f]`}>
              Refine the Board Manually
            </h3>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
              Use manual filters after the AI pass when you need to hard-gate measurables, conference, class, or school context.
            </p>
          </div>
          {activeFilterBadges.length ? (
            <div className="flex flex-wrap gap-2">
              {activeFilterBadges.slice(0, 4).map((label) => (
                <Badge key={label} className="border border-[#d9e1dc] bg-white/[0.72] text-[#365647]" variant="default">
                  {label}
                </Badge>
              ))}
            </div>
          ) : null}
        </div>

        <PlayersFilterBar
          defaults={{
            search: searchParams?.search,
            needId: searchParams?.needId,
            position: searchParams?.position,
            armLengthMin: searchParams?.armLengthMin,
            classYear: searchParams?.classYear,
            yearsRemaining: searchParams?.yearsRemaining,
            school: searchParams?.school,
            conference: searchParams?.conference,
            archetype: searchParams?.archetype
          }}
        />
      </section>

      <section className="relative overflow-hidden rounded-[32px] border border-[#17211c]/8 bg-[linear-gradient(180deg,rgba(255,255,255,0.92),rgba(244,247,244,0.88))] shadow-[0_30px_70px_rgba(15,23,42,0.10)]">
        <div className="absolute inset-x-0 top-0 h-px bg-[linear-gradient(90deg,transparent,rgba(16,37,30,0.18),transparent)]" />
        <div className="yardline-divider grid gap-5 px-6 py-6 lg:px-8">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="field-label text-[#2c5947]">Result Field</p>
              <h2 className={`${scoutingDisplay.className} mt-2 text-[2.7rem] uppercase leading-none tracking-[0.04em] text-[#13251d]`}>
                Search the Transfer Board
              </h2>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
                Use the board filters for hard scope, then work down the cards like a prospect wall. Quick view keeps film context close without leaving the page.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {need ? <Badge className="bg-[#123928] text-[#d9f3e1]" variant="default">Need Fit Mode</Badge> : null}
              {activeFilterBadges.slice(0, 3).map((label) => (
                <Badge key={label} className="border border-[#d9e1dc] bg-white/[0.72] text-[#365647]" variant="default">
                  {label}
                </Badge>
              ))}
              {activeFilterBadges.length ? (
                <Button asChild size="sm" variant="ghost" className="text-[#274536]">
                  <a href={filters.needId ? `/players?needId=${filters.needId}` : "/players"}>Clear scope</a>
                </Button>
              ) : null}
            </div>
          </div>

          {result.items.length ? (
            <PlayerListClient
              baseSearchParams={baseParams.toString()}
              items={result.items}
              needId={filters.needId}
              page={result.page}
              totalPages={result.totalPages}
            />
          ) : (
            <div className="rounded-[28px] border border-dashed border-[#9eb2a5] bg-[#f3f6f2] p-10 text-center">
              <p className="field-label text-[#4e6d5d]">Empty Board</p>
              <h3 className={`${scoutingDisplay.className} mt-3 text-[2.3rem] uppercase leading-none tracking-[0.04em] text-[#16261f]`}>
                No players in this lane
              </h3>
              <p className="mt-3 text-sm text-slate-600">
                Pull back the measurable filters first, then widen position or school scope.
              </p>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
