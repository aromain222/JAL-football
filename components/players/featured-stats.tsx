import type { PlayerSchemeContext } from "@/lib/types";

export function FeaturedStats({ schemeContext }: { schemeContext: PlayerSchemeContext }) {
  const { featuredStats, fitTrait, schemeFitSummary } = schemeContext;

  if (featuredStats.length === 0) {
    return (
      <div className="rounded-3xl border bg-slate-50 px-4 py-3 text-sm text-slate-400">
        No featured PFF signals yet
      </div>
    );
  }

  return (
    <div className="rounded-3xl border bg-slate-50 px-4 py-3 space-y-2">
      <div className="flex flex-wrap gap-2">
        {featuredStats.map((stat) => (
          <div
            key={stat.label}
            className="flex items-center gap-1.5 rounded-full border bg-white px-3 py-1 text-sm"
          >
            <span className="text-slate-500">{stat.label}</span>
            <span className="font-semibold text-slate-800">{stat.value}</span>
          </div>
        ))}
      </div>
      {fitTrait && (
        <p className="text-xs text-slate-500">
          Best fit: <span className="font-medium text-slate-700">{fitTrait}</span>
        </p>
      )}
      {schemeFitSummary && (
        <p className="text-xs text-slate-500 italic">{schemeFitSummary}</p>
      )}
    </div>
  );
}
