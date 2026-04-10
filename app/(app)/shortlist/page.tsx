import Link from "next/link";
import { SectionHeader } from "@/components/section-header";
import { ShortlistBoard } from "@/components/shortlist/shortlist-board";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { getNeeds, getShortlistBoard } from "@/lib/data/queries";
import { scoutingDisplay } from "@/lib/football-ui";

export default async function ShortlistPage({
  searchParams
}: {
  searchParams?: {
    needId?: string;
    position?: string;
  };
}) {
  const needId =
    searchParams?.needId && searchParams.needId !== "ALL" ? searchParams.needId : undefined;
  const position =
    searchParams?.position && searchParams.position !== "ALL"
      ? searchParams.position
      : undefined;

  const [board, needs] = await Promise.all([
    getShortlistBoard({ needId, position }),
    getNeeds()
  ]);

  return (
    <div className="grid gap-6">
      <section className="scouting-panel relative isolate">
        <div className="field-grid-lines absolute inset-0 opacity-40" />
        <div className="absolute inset-y-0 left-[11%] w-px bg-white/10" />
        <div className="absolute inset-y-0 right-[17%] w-px bg-white/10" />
        <div className="relative grid gap-8 px-6 py-7 lg:grid-cols-[minmax(0,1.45fr)_minmax(280px,0.8fr)] lg:px-8 lg:py-8">
          <div>
            <p className="field-label text-[#d3b26c]">Shortlist</p>
            <h1 className={`${scoutingDisplay.className} mt-3 text-[3.2rem] uppercase leading-[0.9] tracking-[0.04em] text-[#f5efe0] sm:text-[4.2rem]`}>
              Move Top Candidates
            </h1>
            <p className="mt-4 max-w-2xl text-sm leading-6 text-[#d7e0d3]/78 sm:text-[15px]">
              Run the internal recruiting board across assistant, coordinator, head coach, and final-watch stages with fast stage changes and compact player context.
            </p>
          </div>
          <div className="grid gap-3 self-end sm:grid-cols-2 lg:grid-cols-1">
            <div className="rounded-[24px] border border-white/10 bg-black/[0.16] p-4 backdrop-blur-sm">
              <p className="field-label text-[#8ac7b7]">Board Size</p>
              <div className={`${scoutingDisplay.className} mt-2 text-[2.8rem] leading-none text-white`}>
                {board.length}
              </div>
              <p className="mt-2 text-sm text-[#d7e0d3]/70">Players currently in active shortlist stages.</p>
            </div>
          </div>
        </div>
      </section>
      <Card className="border-[#d8ddd7] bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(244,247,244,0.94))]">
        <CardContent className="p-5">
          <form className="grid gap-4 md:grid-cols-[1fr_220px_160px_auto]">
            <select
              className="h-10 rounded-xl border bg-white px-3 text-sm"
              defaultValue={searchParams?.needId ?? "ALL"}
              name="needId"
            >
              <option value="ALL">All team needs</option>
              {needs.map((need) => (
                <option key={need.id} value={need.id}>
                  {need.title}
                </option>
              ))}
            </select>
            <select
              className="h-10 rounded-xl border bg-white px-3 text-sm"
              defaultValue={searchParams?.position ?? "ALL"}
              name="position"
            >
              <option value="ALL">All positions</option>
              {["EDGE", "DL", "LB", "CB", "WR", "RB", "OL", "QB", "TE", "S", "ST"].map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
            <Button type="submit">Apply filters</Button>
            <Button asChild type="button" variant="outline">
              <Link href="/shortlist">Reset</Link>
            </Button>
          </form>
        </CardContent>
      </Card>
      <ShortlistBoard items={board} />
    </div>
  );
}
