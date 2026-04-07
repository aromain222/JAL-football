import { Badge } from "@/components/ui/badge";

interface AlignmentBucket {
  key: string;
  label: string;
}

// Position → alignment spots. Keys match PFF snap column names.
const ALIGNMENTS: Record<string, AlignmentBucket[]> = {
  WR: [
    { key: "snaps_slot",        label: "Slot" },
    { key: "snaps_wide_left",   label: "Wide Left" },
    { key: "snaps_wide_right",  label: "Wide Right" },
    { key: "snaps_backfield",   label: "Backfield" },
  ],
  TE: [
    { key: "snaps_inline_te",   label: "Inline TE" },
    { key: "snaps_slot",        label: "Slot / Wing" },
    { key: "snaps_wide_left",   label: "Wide Left" },
    { key: "snaps_wide_right",  label: "Wide Right" },
    { key: "snaps_backfield",   label: "Backfield" },
  ],
  RB: [
    { key: "snaps_backfield",   label: "Backfield" },
    { key: "snaps_slot",        label: "Slot / Receiving" },
    { key: "snaps_wide_left",   label: "Wide Left" },
    { key: "snaps_wide_right",  label: "Wide Right" },
  ],
  OL: [
    { key: "snaps_at_left_tackle",  label: "Left Tackle" },
    { key: "snaps_at_left_guard",   label: "Left Guard" },
    { key: "snaps_at_center",       label: "Center" },
    { key: "snaps_at_right_guard",  label: "Right Guard" },
    { key: "snaps_at_right_tackle", label: "Right Tackle" },
  ],
  "DL/EDGE": [
    { key: "snaps_at_left_end",   label: "Left End" },
    { key: "snaps_at_right_end",  label: "Right End" },
    { key: "snaps_interior_dl",   label: "Interior (NT / 3-Tech)" },
  ],
  LB: [
    { key: "snaps_in_box_lb",   label: "Box LB" },
    { key: "snaps_off_ball_lb", label: "Off-Ball LB" },
  ],
  S: [
    { key: "snaps_free_safety",   label: "Free Safety" },
    { key: "snaps_strong_safety", label: "Strong Safety" },
    { key: "snaps_in_box_db",     label: "Box Safety" },
    { key: "snaps_deep_safety",   label: "Deep Safety" },
    { key: "snaps_slot_cb",       label: "Nickel / Slot" },
  ],
  CB: [
    { key: "snaps_outside_cb", label: "Outside CB" },
    { key: "snaps_slot_cb",    label: "Slot CB (Nickel)" },
    { key: "snaps_in_box_db",  label: "Box DB" },
  ],
};

// Normalize player position to alignment bucket key
function resolveAlignmentKey(position: string): string {
  const up = position.toUpperCase();
  if (ALIGNMENTS[up]) return up;
  if (["DE", "DT", "DL", "EDGE"].includes(up)) return "DL/EDGE";
  if (["OT", "OG", "C", "LT", "LG", "RG", "RT"].includes(up)) return "OL";
  if (["ILB", "OLB", "MLB"].includes(up)) return "LB";
  if (["FS", "SS"].includes(up)) return "S";
  if (up === "DB") return "CB";
  if (["FB"].includes(up)) return "RB";
  return up;
}

function barColor(rank: number): string {
  if (rank === 0) return "bg-indigo-500";
  if (rank === 1) return "bg-indigo-300";
  return "bg-slate-300";
}

interface Props {
  pffStats: Record<string, unknown> | null;
  position: string;
}

export function AlignmentProfile({ pffStats, position }: Props) {
  if (!pffStats) return null;

  const bucketKey = resolveAlignmentKey(position);
  const buckets = ALIGNMENTS[bucketKey];
  if (!buckets || buckets.length === 0) return null;

  // Extract snap counts
  const rows = buckets
    .map((b) => ({ label: b.label, snaps: Number(pffStats[b.key] ?? 0) }))
    .filter((r) => r.snaps > 0)
    .sort((a, b) => b.snaps - a.snaps);

  if (rows.length === 0) return null;

  const total = rows.reduce((s, r) => s + r.snaps, 0);
  const withPct = rows.map((r, i) => ({
    ...r,
    pct: Math.round((r.snaps / total) * 100),
    rank: i,
  }));

  const isVersatile = withPct.filter((r) => r.pct >= 25).length >= 2;
  const primary = withPct[0];

  return (
    <div className="grid gap-3">
      {/* Header */}
      <div className="flex items-center gap-2">
        <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-400">
          Alignment Profile
        </p>
        {isVersatile && (
          <Badge variant="accent">Versatile</Badge>
        )}
      </div>

      {primary && (
        <p className="text-xs text-slate-500">
          Primary:{" "}
          <span className="font-semibold text-indigo-600">{primary.label}</span>
          {" "}({primary.pct}% of snaps)
        </p>
      )}

      {/* Bars */}
      <div className="grid gap-2.5">
        {withPct.map((row) => (
          <div key={row.label}>
            <div className="mb-1 flex items-center justify-between gap-3">
              <span className={`text-xs font-medium ${row.rank === 0 ? "text-slate-800" : "text-slate-500"}`}>
                {row.label}
                {row.rank === 0 && (
                  <span className="ml-1.5 text-[10px] font-semibold uppercase tracking-wider text-indigo-500">
                    Primary
                  </span>
                )}
              </span>
              <span className="shrink-0 text-[11px] tabular-nums text-slate-400">
                {row.pct}% · {row.snaps.toLocaleString()} snaps
              </span>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
              <div
                className={`h-2 rounded-full transition-all ${barColor(row.rank)}`}
                style={{ width: `${row.pct}%` }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
