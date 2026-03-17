import Link from "next/link";
import { SectionHeader } from "@/components/section-header";
import { ShortlistBoard } from "@/components/shortlist/shortlist-board";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { getNeeds, getShortlistBoard } from "@/lib/data/queries";

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
      <SectionHeader
        eyebrow="Shortlist"
        title="Move top candidates through staff stages"
        description="Run the internal recruiting board across assistant, coordinator, head coach, and final-watch stages with fast stage changes and compact player context."
      />
      <Card className="border-cyan-100 bg-white/95">
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
