import { Search, SlidersHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { FilterGroup, NumberRangeFields } from "@/components/players/player-filter-controls";
import { scoutingDisplay } from "@/lib/football-ui";
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
    <Card className="overflow-hidden border-[#17211c]/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(244,247,244,0.94))] shadow-[0_24px_60px_rgba(15,23,42,0.10)]">
      <CardContent className="p-0">
        <div className="relative overflow-hidden border-b border-[#d6ddd8] bg-[linear-gradient(135deg,#10251e_0%,#183327_55%,#204234_100%)] px-5 py-5 text-white">
          <div className="absolute inset-0 bg-[linear-gradient(to_right,rgba(255,255,255,0.06)_1px,transparent_1px)] bg-[length:84px_84px] opacity-50" />
          <div className="relative flex items-start gap-3">
            <div className="mt-1 flex h-9 w-9 items-center justify-center rounded-2xl border border-white/10 bg-white/8">
              <SlidersHorizontal className="h-4 w-4 text-[#d3b26c]" />
            </div>
            <div>
              <p className="field-label text-[#d3b26c]">Board Filters</p>
              <h2 className={`${scoutingDisplay.className} mt-2 text-[2.2rem] uppercase leading-none tracking-[0.04em] text-[#f4efe2]`}>
                Set the Search Field
              </h2>
              <p className="mt-2 max-w-xl text-sm leading-6 text-[#d8e1d5]/75">
                Work from broad scope to tight scope. Lock in hard requirements first, then narrow by measurables.
              </p>
            </div>
          </div>
        </div>
        <form className="grid gap-4 p-5 lg:grid-cols-4">
          <input name="needId" type="hidden" value={defaults.needId ?? ""} />
          <div className="relative lg:col-span-2">
            <Search className="absolute left-3 top-3.5 h-4 w-4 text-slate-400" />
            <Input
              className="h-11 rounded-[18px] border-[#cfd8d2] bg-white/90 pl-9"
              defaultValue={defaults.search}
              name="search"
              placeholder="Search player, school, or tag signal"
            />
          </div>

          <FilterGroup label="Position">
            <select className="h-11 rounded-[18px] border border-[#cfd8d2] bg-white/90 px-3 text-sm" defaultValue={defaults.position ?? "ALL"} name="position">
              {positions.map((option) => (
                <option key={option} value={option}>
                  {option === "ALL" ? "All positions" : option}
                </option>
              ))}
            </select>
          </FilterGroup>

          <FilterGroup label="Class Year">
            <select className="h-11 rounded-[18px] border border-[#cfd8d2] bg-white/90 px-3 text-sm" defaultValue={defaults.classYear ?? "ALL"} name="classYear">
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
            <Input className="h-11 rounded-[18px] border-[#cfd8d2] bg-white/90" defaultValue={defaults.armLengthMin} name="armLengthMin" placeholder="Optional" type="number" />
          </FilterGroup>

          <FilterGroup label="Forty Max">
            <Input className="h-11 rounded-[18px] border-[#cfd8d2] bg-white/90" defaultValue={defaults.fortyMax} name="fortyMax" placeholder="Optional" type="number" />
          </FilterGroup>

          <FilterGroup label="Years Remaining">
            <select className="h-11 rounded-[18px] border border-[#cfd8d2] bg-white/90 px-3 text-sm" defaultValue={defaults.yearsRemaining ?? "ALL"} name="yearsRemaining">
              {yearsRemainingOptions.map((option) => (
                <option key={option} value={option}>
                  {option === "ALL" ? "Any years left" : `${option} year${option === "1" ? "" : "s"}`}
                </option>
              ))}
            </select>
          </FilterGroup>

          <FilterGroup label="School">
            <Input className="h-11 rounded-[18px] border-[#cfd8d2] bg-white/90" defaultValue={defaults.school} name="school" placeholder="School name" />
          </FilterGroup>

          <FilterGroup label="Conference">
            <select className="h-11 rounded-[18px] border border-[#cfd8d2] bg-white/90 px-3 text-sm" defaultValue={defaults.conference ?? "ALL"} name="conference">
              {conferences.map((option) => (
                <option key={option} value={option}>
                  {option === "ALL" ? "All conferences" : option}
                </option>
              ))}
            </select>
          </FilterGroup>

          <FilterGroup label="Archetype">
            <select className="h-11 rounded-[18px] border border-[#cfd8d2] bg-white/90 px-3 text-sm" defaultValue={defaults.archetype ?? "ALL"} name="archetype">
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

          <div className="flex items-end gap-3 pt-2 lg:col-span-4">
            <Button className="bg-[#163627] text-[#ebf4ee] hover:bg-[#1b4330]" type="submit">
              Apply field
            </Button>
            <Button asChild type="button" variant="outline" className="border-[#cdd6d1] bg-white/80">
              <a href={defaults.needId ? `/players?needId=${defaults.needId}` : "/players"}>Reset</a>
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
