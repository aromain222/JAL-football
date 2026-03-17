import { PlayersFilterBar } from "@/components/players/players-filter-bar";
import { PlayersPagination } from "@/components/players/players-pagination";
import { PlayerCard } from "@/components/players/player-card";
import { SectionHeader } from "@/components/section-header";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { getNeedById, getPlayersPage } from "@/lib/data/queries";

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
    heightMin?: string;
    heightMax?: string;
    weightMin?: string;
    weightMax?: string;
    armLengthMin?: string;
    fortyMax?: string;
    classYear?: string;
    yearsRemaining?: string;
    school?: string;
    conference?: string;
  };
}) {
  const filters = {
    page: normalizeNumber(searchParams?.page) ?? 1,
    pageSize: 24,
    needId: normalizeString(searchParams?.needId),
    position: normalizeString(searchParams?.position),
    search: normalizeString(searchParams?.search),
    heightMin: normalizeNumber(searchParams?.heightMin),
    heightMax: normalizeNumber(searchParams?.heightMax),
    weightMin: normalizeNumber(searchParams?.weightMin),
    weightMax: normalizeNumber(searchParams?.weightMax),
    armLengthMin: normalizeNumber(searchParams?.armLengthMin),
    fortyMax: normalizeNumber(searchParams?.fortyMax),
    classYear: normalizeString(searchParams?.classYear),
    yearsRemaining: normalizeNumber(searchParams?.yearsRemaining),
    school: normalizeString(searchParams?.school),
    conference: normalizeString(searchParams?.conference)
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

  const hrefForPage = (page: number) => {
    const params = new URLSearchParams(baseParams);
    params.set("page", String(page));
    return `/players?${params.toString()}`;
  };

  return (
    <div className="grid gap-6">
      <SectionHeader
        eyebrow="Player Database"
        title="Search the transfer board"
        description={
          need
            ? `Board filtered against ${need.title}. Fit score badges surface how closely each player matches this need.`
            : "Filter by measurable thresholds, eligibility, and school context, then open any player profile for full context."
        }
      />

      <PlayersFilterBar
        defaults={{
          search: searchParams?.search,
          needId: searchParams?.needId,
          position: searchParams?.position,
          heightMin: searchParams?.heightMin,
          heightMax: searchParams?.heightMax,
          weightMin: searchParams?.weightMin,
          weightMax: searchParams?.weightMax,
          armLengthMin: searchParams?.armLengthMin,
          fortyMax: searchParams?.fortyMax,
          classYear: searchParams?.classYear,
          yearsRemaining: searchParams?.yearsRemaining,
          school: searchParams?.school,
          conference: searchParams?.conference
        }}
      />

      <Card className="overflow-hidden">
        <CardContent className="grid gap-5 p-6">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.28em] text-cyan-700">Board Results</p>
              <h2 className="mt-1 text-2xl font-semibold text-slate-950">
                {result.total} players
              </h2>
            </div>
            <div className="flex flex-wrap gap-2">
              {need ? <Badge variant="accent">Need fit mode</Badge> : null}
              {filters.position ? <Badge>{filters.position}</Badge> : null}
              {filters.conference ? <Badge variant="default">{filters.conference}</Badge> : null}
              {filters.classYear ? <Badge variant="default">{filters.classYear}</Badge> : null}
            </div>
          </div>

          {result.items.length ? (
            <>
              <div className="grid gap-4 xl:grid-cols-2">
                {result.items.map((item) =>
                  "player" in item ? (
                    <PlayerCard
                      key={item.player.id}
                      detailHref={`/players/${item.player.id}`}
                      fitScore={item.fitScore}
                      player={item.player}
                    />
                  ) : (
                    <PlayerCard
                      key={item.id}
                      detailHref={`/players/${item.id}`}
                      player={item}
                    />
                  )
                )}
              </div>
              <PlayersPagination
                hrefForPage={hrefForPage}
                page={result.page}
                totalPages={result.totalPages}
              />
            </>
          ) : (
            <div className="rounded-[28px] border border-dashed bg-slate-50 p-10 text-center">
              <p className="text-xs uppercase tracking-[0.28em] text-slate-500">Empty board</p>
              <h3 className="mt-3 text-2xl font-semibold text-slate-950">No players match the current filter set.</h3>
              <p className="mt-3 text-sm text-slate-600">
                Loosen measurable thresholds or clear school and conference filters to widen the board.
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
