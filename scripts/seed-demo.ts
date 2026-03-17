import { writeFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  demoNeeds,
  demoPlayers,
  demoProfile,
  demoReviews,
  demoShortlists,
  demoTeam
} from "../lib/data/demo";

const outputPath = resolve(process.cwd(), "supabase", "seed-data.json");

writeFileSync(
  outputPath,
  JSON.stringify(
    {
      team: demoTeam,
      profile: demoProfile,
      players: demoPlayers,
      needs: demoNeeds,
      reviews: demoReviews,
      shortlists: demoShortlists
    },
    null,
    2
  )
);

console.log(`Wrote demo seed snapshot to ${outputPath}`);
