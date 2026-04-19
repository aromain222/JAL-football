import { PlayersFilterBar } from "@/components/players/players-filter-bar";
import { PlayerListClient } from "@/components/players/player-list-client";
import { AiSearchPanel } from "@/components/players/ai-search-panel";
import { Badge } from "@/components/ui/badge";
import { getNeedById, getPlayersPage } from "@/lib/data/queries";

function normalizeString(value?: string) { return value && value !== "ALL" ? value : undefined; }
function normalizeNumber(value?: string) {
  if (!value || value === "ALL") return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

export default async function PlayersPage({ searchParams }: { searchParams?: { page?: string; needId?: string; position?: string; search?: string; armLengthMin?: string; classYear?: string; yearsRemaining?: string; school?: string; conference?: string; archetype?: string } }) {
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
    if (typeof value === "string" && value.length > 0 && key !== "page") baseParams.set(key, value);
  }

  const activeFilterBadges = [
    filters.position,
    filters.classYear,
    filters.yearsRemaining ? `${filters.yearsRemaining} yr${filters.yearsRemaining === 1 ? "" : "s"}` : null,
    filters.armLengthMin ? `Arm ${filters.armLengthMin}+` : null,
    filters.school ? `School: ${filters.school}` : null,
    filters.conference
  ].filter(Boolean) as string[];

  return (
    <div className="grid gap-6">
      <div className="border-b border-[#e4e8e5] pb-5">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold text-[#111827]">Players</h1>
            <p className="mt-1 text-sm text-[#9ca3af]">{need ? `Board locked to: ${need.title}` : "Transfer portal · AI-powered search"}</p>
          </div>
          {need && <a href="/players" className="rounded-xl border border-[#e4e8e5] px-3 py-1.5 text-[12px] text-[#4b5563] hover:bg-[#f1f5f2]">Clear need filter</a>}
        </div>
      </div>

      <div>
        <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-[#9ca3af]">AI Search</p>
        <AiSearchPanel boardFilters={searchParams ?? {}} />
      </div>

      <div>
        <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-[#9ca3af]">Filters</p>
        <PlayersFilterBar defaults={{ search: serchParams?.search, needId: searchParams?.needId, position: searchParams?.position, armLengthMin: searchParams?.armLengthMin, classYear: searchParams?.classYear, yearsRemaining: searchParams?.yearsRemaining, school: searchParams?.school, conference: searchParams?.conference, archetype: searchParams?.archetype }} />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <span className="text-[14px] font-medium text-[#111827]">{result.total} players</span>
        {activeFilterBadges.map((label) => <Badge key={label} className="border border-[#e4e8e5] bg-white text-[#4b5563]" variant="default">{label}</Badge>)}
        {activeFilterBadges.length > 0 && <a href={filters.needId ? `/players?needId=${filters.needId}` : "/players"} className="text-[12px] text-[#9ca3af] hover:text-[#4b5563]">Clear filters</a>}
      </div>

      {result.items.length ? (
        <PlayerListClient baseSearchParams={baseParams.toString()} items={result.items} needId={filters.needId} page={result.page} totalPages={result.totalPages} />
      ) : (
        <div className="rounded-2xl border border-dashed border-[#e4e8e5] p-12 text-center">
          <p className="text-[14px] font-medium text-[#111827]">No players found</p>
          <p className="mt-1 text-[12px] text-[#9ca3af]">Try adjusting filters or broadening your search.</p>
        </div>
      )}
    </div>
  );
}
