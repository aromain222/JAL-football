import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { FilterGroup } from "@/components/players/player-filter-controls";
import { getArchetypesByPosition } from "@/lib/archetypes";

const positions = ["ALL", "EDGE", "DL", "LB", "CB", "WR", "RB", "OL"];
const classYears = ["ALL", "FR", "SO", "JR", "SR", "GR"];
const yearsRemainingOptions = ["ALL", "1", "2", "3", "4"];
const conferences = [
  "ALL", "AAC", "ACC", "Big 12", "CUSA", "MAC", "Mountain West", "SEC", "Sun Belt"
];

export interface PlayersFilterDefaults {
  search?: string;
  needId?: string;
  position?: string;
  armLengthMin?: string;
  classYear?: string;
  yearsRemaining?: string;
  school?: string;
  conference?: string;
  archetype?: string;
}

const archetypesByPosition = getArchetypesByPosition();

const selectClass = "h-10 rounded-xl border border-[#e4e8e5] bg-white px-3 text-[13px] text-[#111827] focus:border-[#15542a] focus:outline-none focus:ring-1 focus:ring-[#15542a]/20 w-full";

export function PlayersFilterBar({ defaults }: { defaults: PlayersFilterDefaults }) {
  return (
    <form className="rounded-2xl border border-[#e4e8e5] bg-white p-4">
      <input name="needId" type="hidden" value={defaults.needId ?? ""} />
      <div className="grid gap-3 lg:grid-cols-4">
        <div className="relative lg:col-span-2">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-[#9ca3af]" />
          <Input
            className="h-10 rounded-xl border-[#e4e8e5] pl-9 text-[13px]"
            defaultValue={defaults.search}
            name="search"
            placeholder="Search player, school, or tag"
          />
        </div>

        <FilterGroup label="Position">
          <select className={selectClass} defaultValue={defaults.position ?? "ALL"} name="position">
            {positions.map((option) => (
              <option key={option} value={option}>
                {option === "ALL" ? "All positions" : option}
              </option>
            ))}
          </select>
        </FilterGroup>

        <FilterGroup label="Class Year">
          <select className={selectClass} defaultValue={defaults.classYear ?? "ALL"} name="classYear">
            {classYears.map((option) => (
              <option key={option} value={option}>
                {option === "ALL" ? "All classes" : option}
              </option>
            ))}
          </select>
        </FilterGroup>

        <FilterGroup label="Conference">
          <select className={selectClass} defaultValue={defaults.conference ?? "ALL"} name="conference">
            {conferences.map((option) => (
              <option key={option} value={option}>
                {option === "ALL" ? "All conferences" : option}
              </option>
            ))}
          </select>
        </FilterGroup>

        <FilterGroup label="Years Remaining">
          <select className={selectClass} defaultValue={defaults.yearsRemaining ?? "ALL"} name="yearsRemaining">
            {yearsRemainingOptions.map((option) => (
              <option key={option} value={option}>
                {option === "ALL" ? "Any years left" : `${option} yr${option === "1" ? "" : "s"}`}
              </option>
            ))}
          </select>
        </FilterGroup>

        <FilterGroup label="School">
          <Input
            className="h-10 rounded-xl border-[#e4e8e5] text-[13px]"
            defaultValue={defaults.school}
            name="school"
            placeholder="School name"
          />
        </FilterGroup>

        <FilterGroup label="Archetype">
          <select className={selectClass} defaultValue={defaults.archetype ?? "ALL"} name="archetype">
            <option value="ALL">All archetypes</option>
            {Object.entries(archetypesByPosition).map(([pos, names]) => (
              <optgroup key={pos} label={pos}>
                {(names as string[]).map((n) => (
                  <option key={n} value={n}>{n}</option>
                ))}
              </optgroup>
            ))}
          </select>
        </FilterGroup>

        <FilterGroup label="Arm Length Min">
          <Input
            className="h-10 rounded-xl border-[#e4e8e5] text-[13px]"
            defaultValue={defaults.armLengthMin}
            name="armLengthMin"
            placeholder="Optional"
            type="number"
          />
        </FilterGroup>
      </div>

      <div className="mt-3 flex gap-2 border-t border-[#f1f5f2] pt-3">
        <button
          type="submit"
          className="rounded-xl bg-[#15542a] px-4 py-2 text-[13px] font-medium text-white hover:bg-[#1a6934]"
        >
          Apply filters
        </button>
        <a
          href={defaults.needId ? `/players?needId=${defaults.needId}` : "/players"}
          className="rounded-xl border border-[#e4e8e5] px-4 py-2 text-[13px] font-medium text-[#4b5563] hover:bg-[#f1f5f2]"
        >
          Reset
        </a>
      </div>
    </form>
  );
}
