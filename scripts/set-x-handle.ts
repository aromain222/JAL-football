import { config } from "dotenv";
config({ path: ".env.local" });
config({ path: ".env" });

import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const args = process.argv.slice(2);
const [fullNameArg, schoolArgOrHandle, maybeHandleArg] = args;
const schoolArg = maybeHandleArg ? schoolArgOrHandle : undefined;
const handleArg = maybeHandleArg ?? schoolArgOrHandle;

if (!fullNameArg || !handleArg) {
  console.error('Usage: npm run set:x:handle -- "Full Name" ["School Name"] "handle"');
  process.exit(1);
}

const supabase = createClient<Database>(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false }
});

async function main() {
  const nameParts = splitName(fullNameArg);
  const normalizedHandle = handleArg.trim().replace(/^@/, "");

  const { data: players, error } = await supabase
    .from("players")
    .select("id, first_name, last_name, current_school, previous_school")
    .ilike("first_name", nameParts.firstName)
    .ilike("last_name", nameParts.lastName);

  if (error) {
    console.error("Fetch players error:", error);
    process.exit(1);
  }

  let matches = players ?? [];

  if (schoolArg) {
    const normalizedSchool = normalize(schoolArg);
    matches = matches.filter((player) => {
      const schools = [player.previous_school, player.current_school].filter(Boolean) as string[];
      return schools.some((school) => {
        const normalizedPlayerSchool = normalize(school);
        return (
          normalizedPlayerSchool === normalizedSchool ||
          normalizedPlayerSchool.includes(normalizedSchool) ||
          normalizedSchool.includes(normalizedPlayerSchool)
        );
      });
    });
  }

  if (!matches.length) {
    console.error(
      schoolArg
        ? `No player match found for ${fullNameArg} at ${schoolArg}.`
        : `No player match found for ${fullNameArg}.`
    );
    process.exit(1);
  }

  if (matches.length > 1) {
    console.error(
      schoolArg
        ? `Multiple player matches found for ${fullNameArg} at ${schoolArg}.`
        : `Multiple player matches found for ${fullNameArg}. Add the school argument to disambiguate.`
    );
    matches.forEach((player) => {
      console.error(
        `- ${player.first_name} ${player.last_name} | previous_school=${player.previous_school ?? "n/a"} | current_school=${player.current_school}`
      );
    });
    process.exit(1);
  }

  const player = matches[0];

  const { error: updateError } = await supabase
    .from("players")
    .update({ x_handle: normalizedHandle })
    .eq("id", player.id);

  if (updateError) {
    console.error("Update failed:", updateError);
    process.exit(1);
  }

  console.log(`Updated ${player.first_name} ${player.last_name} -> @${normalizedHandle}`);
}

function splitName(fullName: string) {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);

  if (parts.length < 2) {
    console.error("Full name must include first and last name.");
    process.exit(1);
  }

  return {
    firstName: parts[0],
    lastName: parts.slice(1).join(" ")
  };
}

function normalize(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
