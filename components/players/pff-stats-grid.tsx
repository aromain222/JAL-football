// System/meta columns to exclude from display
const SKIP_COLUMNS = new Set([
  "id", "player_id", "pff_player_id", "created_at", "updated_at",
  "player_name", "team_name", "team", "position", "player", "franchise_id",
  // Snap columns are handled by AlignmentProfile, not here
  "snaps_offense", "snaps_defense", "snaps_special_teams",
  "snaps_slot", "snaps_wide_left", "snaps_wide_right", "snaps_inline_te",
  "snaps_backfield", "snaps_at_left_tackle", "snaps_at_left_guard",
  "snaps_at_center", "snaps_at_right_guard", "snaps_at_right_tackle",
  "snaps_at_left_end", "snaps_at_right_end", "snaps_interior_dl",
  "snaps_in_box_lb", "snaps_off_ball_lb", "snaps_free_safety",
  "snaps_strong_safety", "snaps_slot_cb", "snaps_outside_cb",
  "snaps_in_box_db", "snaps_deep_safety",
]);

const LABEL_MAP: Record<string, string> = {
  grades_overall: "Overall",
  grades_offense: "Offense",
  grades_defense: "Defense",
  grades_special_teams: "Spec Teams",
  grades_pass: "Passing",
  grades_run_qb: "Run (QB)",
  grades_pass_route: "Route Running",
  grades_run_rb: "Rushing",
  grades_pass_block: "Pass Block",
  grades_run_block: "Run Block",
  grades_pass_block_rb: "Pass Block",
  grades_run_block_rb: "Run Block",
  grades_pass_rush: "Pass Rush",
  grades_run_defense_dl: "Run Defense",
  grades_run_defense: "Run Defense",
  grades_coverage_lb: "Coverage",
  grades_coverage_db: "Coverage",
  grades_coverage: "Coverage",
  grades_man_coverage: "Man Coverage",
  grades_zone_coverage: "Zone Coverage",
  grades_tackle: "Tackling",
  grades_tackle_db: "Tackling",
  grades_run_defense_lb: "Run Defense",
  grades_pass_rush_lb: "Pass Rush",
  grades_hands_drop: "Hands / Drop",
  stats_completions: "Completions",
  stats_attempts: "Attempts",
  stats_passing_yards: "Pass Yards",
  stats_passing_tds: "Pass TDs",
  stats_interceptions: "INTs",
  stats_big_time_throws: "Big Time Throws",
  stats_turnover_worthy_plays: "Turnover-Worthy",
  stats_adjusted_completion_pct: "Adj Comp %",
  stats_yards_per_attempt: "Yds / Attempt",
  stats_carries: "Carries",
  stats_rushing_yards: "Rush Yards",
  stats_rushing_tds: "Rush TDs",
  stats_yards_after_contact_per_carry: "YAC / Carry",
  stats_broken_tackles: "Broken Tackles",
  stats_elusive_rating: "Elusive Rating",
  stats_targets: "Targets",
  stats_receptions: "Receptions",
  stats_receiving_yards: "Rec Yards",
  stats_receiving_tds: "Rec TDs",
  stats_yac: "Yards After Catch",
  stats_catch_rate: "Catch Rate",
  stats_yards_per_route_run: "Yds / Route",
  stats_pass_block_snaps: "Pass Block Snaps",
  stats_pressures_allowed: "Pressures Allowed",
  stats_sacks_allowed: "Sacks Allowed",
  stats_hits_allowed: "Hits Allowed",
  stats_hurries_allowed: "Hurries Allowed",
  stats_pressures: "Pressures",
  stats_sacks: "Sacks",
  stats_hits: "QB Hits",
  stats_hurries: "Hurries",
  stats_run_stops: "Run Stops",
  stats_tackles: "Tackles",
  stats_stops_lb: "Stops",
  stats_forced_fumbles: "Forced Fumbles",
  stats_targets_allowed: "Targets Allowed",
  stats_receptions_allowed: "Rec Allowed",
  stats_yards_allowed: "Yards Allowed",
  stats_interceptions_def: "Interceptions",
  stats_pass_breakups: "Pass Breakups",
};

function humanize(col: string): string {
  if (LABEL_MAP[col]) return LABEL_MAP[col];
  const suffix = col.replace(/^(grades_|stats_|snaps_)/, "").replace(/_/g, " ");
  return suffix.replace(/\b\w/g, (c) => c.toUpperCase());
}

function formatValue(v: unknown): string | null {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  if (isNaN(n)) return String(v);
  if (Number.isInteger(n)) return n.toLocaleString();
  return n.toFixed(1);
}

interface GradeTier {
  bg: string;
  border: string;
  text: string;
  label: string;
  dot: string;
}

function gradeTier(value: string): GradeTier {
  const n = parseFloat(value);
  if (isNaN(n)) return { bg: "bg-slate-50", border: "border-slate-200", text: "text-slate-700", label: "", dot: "bg-slate-300" };
  if (n >= 90) return { bg: "bg-emerald-50", border: "border-emerald-200", text: "text-emerald-700", label: "Elite", dot: "bg-emerald-500" };
  if (n >= 80) return { bg: "bg-green-50",   border: "border-green-200",   text: "text-green-700",   label: "Good",      dot: "bg-green-500" };
  if (n >= 70) return { bg: "bg-sky-50",     border: "border-sky-200",     text: "text-sky-700",     label: "Above Avg", dot: "bg-sky-500" };
  if (n >= 60) return { bg: "bg-amber-50",   border: "border-amber-200",   text: "text-amber-700",   label: "Average",   dot: "bg-amber-400" };
  return           { bg: "bg-rose-50",    border: "border-rose-200",    text: "text-rose-700",    label: "Below Avg", dot: "bg-rose-500" };
}

interface Props {
  pffStats: Record<string, unknown> | null;
  position: string;
}

export function PffStatsGrid({ pffStats, position }: Props) {
  if (!pffStats) {
    return (
      <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/50 p-5 text-sm text-slate-400">
        No PFF data linked yet — name may not match between the players table and the{" "}
        <span className="font-medium text-slate-600">{position}</span> PFF table.
      </div>
    );
  }

  const season = pffStats.season as number | undefined;
  const overallRaw = pffStats.grades_overall;
  const overall = overallRaw != null ? formatValue(overallRaw) : null;

  const grades: { label: string; value: string }[] = [];
  const stats: { label: string; value: string }[] = [];

  for (const [col, raw] of Object.entries(pffStats)) {
    if (SKIP_COLUMNS.has(col) || col === "season") continue;
    if (col.startsWith("snaps_")) continue; // handled by AlignmentProfile
    const value = formatValue(raw);
    if (!value) continue;
    const label = humanize(col);
    if (col.startsWith("grades_")) grades.push({ label, value });
    else stats.push({ label, value });
  }

  if (grades.length === 0 && stats.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/50 p-5 text-sm text-slate-400">
        PFF row found but no grades or stats available.
      </div>
    );
  }

  return (
    <div className="grid gap-5">
      {/* Header row */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-400">
            {position} · PFF
          </p>
          {season && (
            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-500">
              {season}
            </span>
          )}
        </div>
        {overall && (
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] font-semibold uppercase tracking-widest text-slate-400">Overall</span>
            <span className={`text-2xl font-bold ${gradeTier(overall).text}`}>{overall}</span>
          </div>
        )}
      </div>

      {/* Grade tiles */}
      {grades.length > 0 && (
        <div>
          <p className="mb-2.5 text-[10px] font-semibold uppercase tracking-widest text-slate-400">
            Grades
          </p>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {grades
              .filter((g) => g.label !== "Overall") // already shown in header
              .map(({ label, value }) => {
                const tier = gradeTier(value);
                return (
                  <div
                    key={label}
                    className={`rounded-2xl border p-3.5 ${tier.bg} ${tier.border}`}
                  >
                    <div className="flex items-start justify-between gap-1">
                      <p className={`text-[10px] font-semibold uppercase leading-tight tracking-wider ${tier.text} opacity-70`}>
                        {label}
                      </p>
                      <span className={`mt-0.5 h-1.5 w-1.5 shrink-0 rounded-full ${tier.dot}`} />
                    </div>
                    <p className={`mt-2 text-2xl font-bold leading-none ${tier.text}`}>{value}</p>
                    {tier.label && (
                      <p className={`mt-1 text-[9px] font-semibold uppercase tracking-widest ${tier.text} opacity-60`}>
                        {tier.label}
                      </p>
                    )}
                  </div>
                );
              })}
          </div>
        </div>
      )}

      {/* Stats tiles */}
      {stats.length > 0 && (
        <div>
          <p className="mb-2.5 text-[10px] font-semibold uppercase tracking-widest text-slate-400">
            Stats
          </p>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
            {stats.map(({ label, value }) => (
              <div
                key={label}
                className="rounded-2xl border border-slate-100 bg-white p-3.5"
              >
                <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                  {label}
                </p>
                <p className="mt-2 text-xl font-bold text-slate-800">{value}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
