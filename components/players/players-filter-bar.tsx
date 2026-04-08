import { Search, SlidersHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { FilterGroup, NumberRangeFields } from "@/components/players/player-filter-controls";
import { getArchetypesByPosition } from "@/lib/archetypes";

const positions = ["ALL", "EDGE", "DL", "LB", "CB", "WR", "RB", "OL"];
const classYears = ["ALL", "FR", "SO", "JR", "SR", "GR"];
const yearsRemainingOptions = ["ALL", "1", "2", "3", "4"];
const conferences = [
  "ALL",
  "AAC",
  "ACC",
  "Big 12",
  "CUSA",
  "MAC",
  "Mountain West",
  "SEC",
  "Sun Belt"
];

export interface PlayersFilterDefaults {
  search?: string;
  needId?: string;
  position?: string;
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
  archetype?: string;
}

const archetypesByPosition = getArchetypesByPosition();

export function PlayersFilterBar({
  defaults
}: {
  defaults: PlayersFilterDefaults;
}) {
  return (
    <Card className="overflow-hidden border-cyan-100 bg-white/95">
      <CardContent className="p-0">
        <div className="flex items-center gap-3 border-b bg-slate-950 px-5 py-4 text-white">
          <SlidersHorizontal className="h-4 w-4 text-cyan-300" />
          <div>
            <p className="text-xs uppercase tracking-[0.28em] text-slate-300">Board Filters</p>
            <p className="text-sm text-slate-300">Keep the board broad by default. Layer in measurable filters only when needed.</p>
          </div>
        </div>
        <form className="grid gap-4 p-5 lg:grid-cols-4">
          <input name="needId" type="hidden" value={defaults.needId ?? ""} />
          <div className="relative lg:col-span-2">
            <Search className="absolute left-3 top-3.5 h-4 w-4 text-slate-400" />
            <Input
              className="pl-9"
              defaultValue={defaults.search}
              name="search"
              placeholder="Search player, school, or tag signal"
            />
          </div>

          <FilterGroup label="Position">
            <select className="h-10 rounded-xl border bg-white px-3 text-sm" defaultValue={defaults.position ?? "ALL"} name="position">
              {positions.map((option) => (
                <option key={option} value={option}>
                  {option === "ALL" ? "All positions" : option}
                </option>
              ))}
            </select>
          </FilterGroup>

          <FilterGroup label="Class Year">
            <select className="h-10 rounded-xl border bg-white px-3 text-sm" defaultValue={defaults.classYear ?? "ALL"} name="classYear">
              {classYears.map((option) => (
                <option key={option} value={option}>
                  {option === "ALL" ? "All classes" : option}
                </option>
              ))}
            </select>
          </FilterGroup>

          <FilterGroup label="Height (in)">
            <NumberRangeFields
              maxDefaultValue={defaults.heightMax}
              maxName="heightMax"
              maxPlaceholder="Max"
              minDefaultValue={defaults.heightMin}
              minName="heightMin"
              minPlaceholder="Min"
            />
          </FilterGroup>

          <FilterGroup label="Weight (lbs)">
            <NumberRangeFields
              maxDefaultValue={defaults.weightMax}
              maxName="weightMax"
              maxPlaceholder="Max"
              minDefaultValue={defaults.weightMin}
              minName="weightMin"
              minPlaceholder="Min"
            />
          </FilterGroup>

          <FilterGroup label="Arm Length Min">
            <Input defaultValue={defaults.armLengthMin} name="armLengthMin" placeholder="Optional" type="number" />
          </FilterGroup>

          <FilterGroup label="Forty Max">
            <Input defaultValue={defaults.fortyMax} name="fortyMax" placeholder="Optional" type="number" />
          </FilterGroup>

          <FilterGroup label="Years Remaining">
            <select className="h-10 rounded-xl border bg-white px-3 text-sm" defaultValue={defaults.yearsRemaining ?? "ALL"} name="yearsRemaining">
              {yearsRemainingOptions.map((option) => (
                <option key={option} value={option}>
                  {option === "ALL" ? "Any years left" : `${option} year${option === "1" ? "" : "s"}`}
                </option>
              ))}
            </select>
          </FilterGroup>

          <FilterGroup label="School">
            <Input defaultValue={defaults.school} name="school" placeholder="School name" />
          </FilterGroup>

          <FilterGroup label="Conference">
            <select className="h-10 rounded-xl border bg-white px-3 text-sm" defaultValue={defaults.conference ?? "ALL"} name="conference">
              {conferences.map((option) => (
                <option key={option} value={option}>
                  {option === "ALL" ? "All conferences" : option}
                </option>
              ))}
            </select>
          </FilterGroup>

          <FilterGroup label="Archetype">
            <select className="h-10 rounded-xl border bg-white px-3 text-sm" defaultValue={defaults.archetype ?? "ALL"} name="archetype">
              <option value="ALL">All archetypes</option>
              {Object.entries(archetypesByPosition).map(([pos, names]) => (
                <optgroup key={pos} label={pos}>
                  {names.map((n) => (
                    <option key={n} value={n}>{n}</option>
                  ))}
                </optgroup>
              ))}
            </select>
          </FilterGroup>

          <div className="flex items-end gap-3 lg:col-span-4">
            <Button type="submit">Apply filters</Button>
            <Button asChild type="button" variant="outline">
              <a href={defaults.needId ? `/players?needId=${defaults.needId}` : "/players"}>Reset</a>
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
