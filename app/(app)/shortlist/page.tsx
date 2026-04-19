import Link from "next/link";
import { ShortlistBoard } from "@/components/shortlist/shortlist-board";
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
    searchParams?.position && searchParams.position !== "ALL" ? searchParams.position : undefined;

  const [board, needs] = await Promise.all([
    getShortlistBoard({ needId, position }),
    getNeeds()
  ]);

  const activeFilters = [needId ? "Need scoped" : null, position ?? null].filter(Boolean);

  return (
    <div className="grid gap-6">
      <div className="flex items-start justify-between border-b border-[#e4e8e5] pb-5">
        <div>
          <h1 className="text-2xl font-bold text-[#111827]">Shortlist</h1>
          <p className="mt-1 text-sm text-[#9ca3af]">
            {board.length} player{board.length !== 1 ? "s" : ""} on the board ·{" "}
            {activeFilters.length ? activeFilters.join(" · ") : "All needs · All positions"}
          </p>
        </div>
      </div>

      <form className="flex flex-wrap items-center gap-2">
        <select
          className="h-10 rounded-xl border border-[#e4e8e5] bg-white px-3 text-[13px] text-[#111827]"
          defaultValue={searchParams?.needId ?? "ALL"}
          name="needId"
        >
          <option value="ALL">All needs</option>
          {needs.map((need) => (
            <option key={need.id} value={need.id}>{need.title}</option>
          ))}
        </select>
        <select
          className="h-10 rounded-xl border border-[e8e5] bg-white px-3 text-[13px] text-[#111827]"
          defaultValue={searchParams?.position ?? "ALL"}
          name="position"
        >
          <option value="ALL">All positions</option>
          {["EDGE", "DL", "LB", "CB", "WR", "RB", "OL", "QB", "TE", "S", "ST"].map((o) => (
            <option key={o} value={o}>{o}</option>
          ))}
        </select>
        <button
          type="submit"
          className="rounded-xl bg-[#15542a] px-4 py-2 text-[13px] font-medium text-white hover:bg-[#1a6934]"
        >
          Apply
        </button>
        <Link
          href="/shortlist"
          className="rounded-xl border border-[#e4e8e5] px-4 py-2 text-[13px] font-medium text-[#4b5563] hover:bg-[#f1f5f2]"
        >
          Reset
        </Link>
      </form>

      <ShortlistBoard items={board} />
    </div>
  );
}
