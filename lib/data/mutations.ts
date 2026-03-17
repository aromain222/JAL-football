import { createSupabaseServerClient, hasSupabaseEnv } from "@/lib/supabase/server";
import { TeamNeed, TeamNeedInsertInput } from "@/lib/types";

export async function insertTeamNeed(params: {
  id: string;
  teamId: string;
  createdBy: string;
  input: TeamNeedInsertInput;
}): Promise<TeamNeed> {
  const row: TeamNeed = {
    id: params.id,
    team_id: params.teamId,
    created_by: params.createdBy,
    title: params.input.title,
    position: params.input.position,
    priority: params.input.priority,
    status: params.input.status,
    target_count: params.input.target_count,
    class_focus: params.input.class_focus,
    min_height_in: params.input.min_height_in,
    max_height_in: params.input.max_height_in,
    min_weight_lbs: params.input.min_weight_lbs,
    max_weight_lbs: params.input.max_weight_lbs,
    min_arm_length_in: params.input.min_arm_length_in,
    max_forty_time: params.input.max_forty_time,
    min_years_remaining: params.input.min_years_remaining,
    scheme: params.input.scheme,
    priority_traits: params.input.priority_traits,
    production_filters: params.input.production_filters,
    min_starts: params.input.min_starts,
    min_production_score: params.input.min_production_score,
    notes: params.input.notes,
    created_at: new Date().toISOString()
  };

  if (!hasSupabaseEnv()) {
    return row;
  }

  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase
    .from("team_needs")
    .insert({
      id: row.id,
      team_id: row.team_id,
      created_by: row.created_by,
      title: row.title,
      position: row.position,
      priority: row.priority,
      status: row.status,
      target_count: row.target_count,
      class_focus: row.class_focus,
      min_height_in: row.min_height_in,
      max_height_in: row.max_height_in ?? null,
      min_weight_lbs: row.min_weight_lbs,
      max_weight_lbs: row.max_weight_lbs ?? null,
      min_arm_length_in: row.min_arm_length_in ?? null,
      max_forty_time: row.max_forty_time ?? null,
      min_years_remaining: row.min_years_remaining ?? null,
      scheme: row.scheme ?? null,
      priority_traits: row.priority_traits ?? [],
      production_filters: row.production_filters ?? {},
      min_starts: row.min_starts,
      min_production_score: row.min_production_score,
      notes: row.notes
    })
    .select("*")
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return data as TeamNeed;
}
