import Link from "next/link";
import { ArrowRight, ChevronRight, Clock3, Layers3, Plus } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { getPlayerPrimaryProduction } from "@/lib/football";
import { cn, formatDate, formatNumber } from "@/lib/utils";
import { getDashboardMetrics, getNeeds, getPlayers, getReviewsByNeed, getShortlistBoard } from "@/lib/data/queries";

export default async function DashboardPage() {
  const [metrics, needs, shortlistBoard, allPlayers] = await Promise.all([
    getDashboardMetrics(), getNeeds(), getShortlistBoard(), getPlayers()
  ]);
  const recentReviewGroups = await Promise.all(needs.map((need) => getReviewsByNeed(need.id)));
  const recentReviews = recentReviewGroups.flat().sort((a, b) => b.created_at.localeCompare(a.created_at)).slice(0, 6);
  const playersNeedingFilm = (allPlayers as typeof allPlayers).filter((p) => (p as { tags?: string[] }).tags?.includes("needs-film")).length;
  const recentShortlisted = shortlistBoard.slice().sort((a, b) => (b.updated_at ?? b.created_at).localeCompare(a.updated_at ?? a.created_at)).slice(0, 4);
  const activityFeed = [
    ...recentReviews.map((r) => ({ id: r.id, type: "review" as const, created_at: r.created_at, label: r.decision, detail: r.note ?? "Review logged.", meta: `Fit ${r.fit_score}` })),
    ...recentShortlisted.map((i) => ({ id: i.id, type: "shortlist" as const, created_at: i.updated_at ?? i.created_at, label: i.stage, detail: i.player ? `${i.player.first_name} ${i.player.last_name} → ${i.stage.replace("_", " ")}` : `Player → ${i.stage.replace("_", " ")}`, meta: i.need?.title ?? "Shortlist" }))
  ].sort((a, b) => b.created_at.localeCompare(a.created_at)).slice(0, 8);

  return (
    <div className="grid gap-6">
      <div className="flex items-start justify-between border-b border-[#e4e8e5] pb-5">
        <div>
          <h1 className="text-2xl font-bold text-[#111827]">Dashboar1>
          <p className="mt-1 text-sm text-[#9ca3af]">Transfer portal intelligence board</p>
        </div>
        <Link href="/needs/new" className="flex items-center gap-2 rounded-xl bg-[#15542a] px-4 py-2 text-sm font-medium text-white hover:bg-[#1a6934]">
          <Plus className="h-4 w-4" />New need
        </Link>
      </div>

      <div className="rounded-2xl border border-[#e4e8e5] bg-white p-5">
        <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[#9ca3af]">Core workflow</p>
        <div className="mt-3 flex items-center gap-2">
          <WorkflowStep number={1} label="Define Need" href="/needs/new" count={metrics.activeNeeds} countLabel="active" />
          <ChevronRight className="h-4 w-4 shrink-0 text-[#c8d0cb]" />
          <WorkflowStep number={2} label="Review Players" href="/needs" count={metrics.recentReviews} countLabel="recent" />
          <ChevronRight className="h-4 w-4 shrink-0 text-[#c8d0cb]" />
          <WorkflowStep number={3} label="Shortlist" href="/shortlist" count={metrics.shortlistedPlayers} countLabel="players" />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile label="Portal players" value={formatNumber(metrics.totalPlayers)} />
        <StatTile label="Active needs" value={String(metrics.activeNeeds)} />
        <StatTile label="Shortlisted" value={String(metrics.shortlistedPlayers)} />
        <StatTile label="Needs film" value={String(playersNeedingFilm)} />
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
        <section className="rounded-2xl border border-[#e4e8e5] bg-white">
          <div className="flex items-center justify-between border-b border-[#e4e8e5] px-5 py-4">
            <h2 className="text-[14px] font-semibold text-[#111827]">Active needs</h2>
            <Link href="/needs" className="text-[12px] text-[#4b5563] hover:text-[#111827]">All needs →</Link>
          </div>
          <div className="grid gap-2 p-4">
            {needs.leth ? needs.map((need) => (
              <div key={need.id} className={cn("flex items-center justify-between gap-3 rounded-xl border border-[#e4e8e5] bg-[#f8f9fa] px-4 py-3", need.priority === "critical" && "border-l-2 border-l-red-400")}>
                <div className="min-w-0">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[#9ca3af]">{need.position} · {need.priority === "critical" ? "Critical" : "Active"}</p>
                  <p className="mt-0.5 truncate text-[14px] font-medium text-[#111827]">{need.title}</p>
                </div>
                <Link href={`/review/${need.id}`} className="flex shrink-0 items-center gap-1.5 rounded-xl bg-[#15542a] px-3 py-1.5 text-[12px] font-medium text-white hover:bg-[#1a6934]">
                  Review <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              </div>
            )) : (
              <div className="rounded-xl border border-dashed border-[#e4e8e5] p-6 text-center text-sm text-[#9ca3af">
                No active needs. <Link href="/needs/new" className="text-[#15542a] underline">Create one →</Link>
              </div>
            )}
          </div>
        </section>

        <section className="rounded-2xl border border-[#e4e8e5] bg-white">
          <div className="flex items-center justify-between border-b border-[#e4e8e5] px-5 py-4">
            <h2 className="text-[14px] font-semibold text-[#111827]">Recent activity</h2>
          </div>
          <div className="divide-y divide-[#f1f5f2]">
            {activityFeed.length ? activityFeed.map((item) => (
              <div key={item.id} className="flex items-start gap-3 px-5 py-3">
                <div className={cn("mt-0.5 h-2 w-2 shrink-0 rounded-full", item.type === "shortlist" ? "bg-blue-400" : item.label === "right" ? "bg-emerald-400" : "bg-[#c8d0cb]")} />
                <div className="min-w-0 flex-1">
                  <p className="text-[13px] text-[#111827]">{item.detail}</p>
                  <p className="mt-0.5 flextems-center gap-1.5 text-[11px] text-[#9ca3af]">
                    <Clock3 className="h-3 w-3" />{formatDate(item.created_at)} · {item.meta}
                  </p>
                </div>
              </div>
            )) : <div className="p-6 text-center text-sm text-[#9ca3af]">No recent activity.</div>}
          </div>
        </section>
      </div>

      {recentShortlisted.length > 0 && (
        <section className="rounded-2xl border border-[#e4e8e5] bg-white">
          <div className="flex items-center justify-between border-b border-[#e4e8e5] px-5 py-4">
            <h2 className="text-[14px] font-semibold text-[#111827]">Recently shortlisted</h2>
            <Link href="/shortlist" className="flex items-center gap-1.5 text-[12px] text-[#4b5563] hover:text-[#111827]">
              <Layers3 className="h-3.5 w-3.5" />Shortlist board
            </Link>
          </div>
          <div className="grid gap-2 p-4 lg:grid-cols-2">
            {recentShortlisted.map((item) => (
              <div key{item.id} className="rounded-xl border border-[#e4e8e5] bg-[#f8f9fa] px-4 py-3">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-[14px] font-medium text-[#111827]">{item.player?.first_name} {item.player?.last_name}</p>
                    <p className="text-[12px] text-[#4b5563]">{item.player?.current_school}{item.player ? ` · ${getPlayerPrimaryProduction(item.player)}` : ""}</p>
                  </div>
                  <Badge variant="accent">{item.stage}</Badge>
                </div>
                <p className="mt-1 text-[11px] text-[#9ca3af]">{item.need?.title ?? "Shortlist"} · {formatDate(item.updated_at ?? item.created_at)}</p>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

function WorkflowStep({ number, label, href, count, countLabel }: { number: number; label: string; href: string; count: number; countLabel: string }) {
  return (
    <Link href={href} assName="flex flex-1 flex-col gap-1 rounded-xl border border-[#e4e8e5] bg-[#f8f9fa] px-4 py-3 transition-colors hover:border-[#c8d0cb] hover:bg-white">
      <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[#9ca3af]">Step {number}</span>
      <span className="text-[14px] font-semibold text-[#111827]">{label}</span>
      <span className="font-mono text-[12px] text-[#15542a]">{count} {countLabel}</span>
    </Link>
  );
}

function StatTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-[#e4e8e5] bg-white p-4">
      <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[#9ca3af]">{label}</p>
      <p className="mt-2 font-mono text-[22px] font-semibold text-[#111827]">{value}</p>
    </div>
  );
}
