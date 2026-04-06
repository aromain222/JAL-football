import { Badge } from "@/components/ui/badge";

// System/meta columns to exclude from display
const SKIP_COLUMNS = new Set([
  "id", "player_id", "pff_player_id", "created_at", "updated_at",
  "player_name", "team_name", "team", "position", "player", "franchise_id",
]);

// Human-readable label overrides for common PFF column names
const LABEL_MAP: Record<string, string> = {
  grades_overall: "Overall",
  grades_offense: "Offense",
  grades_defense: "Defense",
  grades_special_teams: "Spec Teams",
  grades_pass: "Passing",
  grades_run_qb: "Run (QB)",
  grades_pass_route: "Route",
  grades_run_rb: "Run (RB)",
  grades_pass_block: "Pass Block",
  grades_run_block: "Run Block",
  grades_pass_block_rb: "Pass Block (RB)",
  grades_run_block_rb: "Run Block (RB)",
  grades_pass_rush: "Pass Rush",
  grades_run_defense_dl: "Run Def",
  grades_run_defense: "Run Def",
  grades_coverage_lb: "Coverage (LB)",
  grades_coverage_db: "Coverage",
  grades_coverage: "Coverage",
  grades_man_coverage: "Man Cov",
  grades_zone_coverage: "Zone Cov",
  grades_tackle: "Tackle",
  grades_tackle_db: "Tackle",
  grades_run_defense_lb: "Run Def (LB)",
  grades_pass_rush_lb: "Pass Rush (LB)",
  grades_hands_drop: "Hands/Drop",
  stats_completions: "Comp",
  stats_attempts: "Att",
  stats_passing_yards: "Pass Yds",
  stats_passing_tds: "Pass TD",
  stats_interceptions: "INT",
  stats_big_time_throws: "BTT",
  stats_turnover_worthy_plays: "TWP",
  stats_adjusted_completion_pct: "Adj Comp%",
  stats_yards_per_attempt: "YPA",
  stats_carries: "Carries",
  stats_rushing_yards: "Rush Yds",
  stats_rushing_tds: "Rush TD",
  stats_yards_after_contact_per_carry: "YAC/Car",
  stats_broken_tackles: "BT",
  stats_elusive_rating: "Elusive",
  stats_targets: "Tgts",
  stats_receptions: "Rec",
  stats_receiving_yards: "Rec Yds",
  stats_receiving_tds: "Rec TD",
  stats_yac: "YAC",
  stats_catch_rate: "Catch%",
  stats_yards_per_route_run: "Yds/Route",
  stats_pass_block_snaps: "PB Snaps",
  stats_pressures_allowed: "Press Allow",
  stats_sacks_allowed: "Sacks Allow",
  stats_hits_allowed: "Hits Allow",
  stats_hurries_allowed: "Hurries Allow",
  stats_pressures: "Pressures",
  stats_sacks: "Sacks",
  stats_hits: "Hits",
  stats_hurries: "Hurries",
  stats_run_stops: "Run Stops",
  stats_tackles: "Tackles",
  stats_stops_lb: "Stops",
  stats_forced_fumbles: "FF",
  stats_targets_allowed: "Tgts Allow",
  stats_receptions_allowed: "Rec Allow",
  stats_yards_allowed: "Yds Allow",
  stats_interceptions_def: "INT",
  stats_pass_breakups: "PBU",
  snaps_offense: "Off Snaps",
  snaps_defense: "Def Snaps",
  snaps_special_teams: "ST Snaps",
  snaps_slot: "Slot",
  snaps_wide_left: "Wide L",
  snaps_wide_right: "Wide R",
  snaps_inline_te: "Inline",
  snaps_backfield: "Backfield",
  snaps_at_left_tackle: "LT",
  snaps_at_left_guard: "LG",
  snaps_at_center: "C",
  snaps_at_right_guard: "RG",
  snaps_at_right_tackle: "RT",
  snaps_at_left_end: "LE",
  snaps_at_right_end: "RE",
  snaps_interior_dl: "Interior",
  snaps_in_box_lb: "In Box",
  snaps_off_ball_lb: "Off Ball",
  snaps_free_safety: "FS",
  snaps_strong_safety: "SS",
  snaps_slot_cb: "Slot CB",
  snaps_outside_cb: "Outside CB",
  snaps_in_box_db: "In Box",
  snaps_deep_safety: "Deep",
};

function humanize(col: string): string {
  if (LABEL_MAP[col]) return LABEL_MAP[col];
  // Strip prefix then title-case
  const suffix = col
    .replace(/^(grades_|stats_|snaps_)/, "")
    .replace(/_/g, " ");
  return suffix.replace(/\b\w/g, (c) => c.toUpperCase());
}

function formatValue(v: unknown): string | null {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  if (isNaN(n)) return String(v);
  // Grades are 0–100, display with 1 decimal; snaps/counts are integers
  if (Number.isInteger(n)) return n.toLocaleString();
  return n.toFixed(1);
}

interface Props {
  pffStats: Record<string, unknown> | null;
  position: string;
}

export function PffStatsGrid({ pffStats, position }: Props) {
  if (!pffStats) {
    return (
      <div className="rounded-3xl border border-dashed bg-slate-50 p-5 text-sm text-slate-500">
        No PFF data linked yet for this player.
      </div>
    );
  }

  const season = pffStats.season as number | undefined;

  const grades: { label: string; value: string }[] = [];
  const stats: { label: string; value: string }[] = [];
  const snaps: { label: string; value: string }[] = [];

  for (const [col, raw] of Object.entries(pffStats)) {
    if (SKIP_COLUMNS.has(col)) continue;
    if (col === "season") continue;
    const value = formatValue(raw);
    if (!value) continue;
    const label = humanize(col);
    if (col.startsWith("grades_")) grades.push({ label, value });
    else if (col.startsWith("snaps_")) snaps.push({ label, value });
    else stats.push({ label, value });
  }

  if (grades.length === 0 && stats.length === 0 && snaps.length === 0) {
    return (
      <div className="rounded-3xl border border-dashed bg-slate-50 p-5 text-sm text-slate-500">
        PFF row found but contains no displayable data.
      </div>
    );
  }

  return (
    <div className="grid gap-4">
      <div className="flex items-center gap-2">
        <p className="text-xs uppercase tracking-[0.24em] text-slate-500">{position} — PFF</p>
        {season && <Badge variant="default">{season}</Badge>}
      </div>

      {grades.length > 0 && (
        <div>
          <p className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-400">Grades</p>
          <div className="grid gap-3 grid-cols-2 sm:grid-cols-3 lg:grid-cols-4">
            {grades.map(({ label, value }) => (
              <StatTile key={label} label={label} value={value} isGrade />
            ))}
          </div>
        </div>
      )}

      {stats.length > 0 && (
        <div>
          <p className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-400">Stats</p>
          <div className="grid gap-3 grid-cols-2 sm:grid-cols-3 lg:grid-cols-4">
            {stats.map(({ label, value }) => (
              <StatTile key={label} label={label} value={value} />
            ))}
          </div>
        </div>
      )}

      {snaps.length > 0 && (
        <div>
          <p className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-400">Snap Alignment</p>
          <div className="grid gap-3 grid-cols-2 sm:grid-cols-3 lg:grid-cols-4">
            {snaps.map(({ label, value }) => (
              <StatTile key={label} label={label} value={value} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function gradeColor(value: string): string {
  const n = parseFloat(value);
  if (isNaN(n)) return "";
  if (n >= 80) return "text-emerald-700";
  if (n >= 70) return "text-sky-700";
  if (n >= 60) return "text-slate-800";
  return "text-rose-600";
}

function StatTile({
  label,
  value,
  isGrade = false,
}: {
  label: string;
  value: string;
  isGrade?: boolean;
}) {
  return (
    <div className="rounded-3xl border bg-slate-50 p-3">
      <p className="text-xs uppercase tracking-[0.2em] text-slate-500">{label}</p>
      <div className={`mt-2 text-xl font-semibold ${isGrade ? gradeColor(value) : "text-slate-950"}`}>
        {value}
      </div>
    </div>
  );
}
