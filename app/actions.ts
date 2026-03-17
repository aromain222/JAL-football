"use server";

import { revalidatePath } from "next/cache";
import {
  addDemoPlayerTag,
  addDemoNeed,
  addOrUpdateDemoReview,
  addOrUpdateDemoShortlist,
  updateDemoShortlistStage
} from "@/lib/data/demo-store";
import { insertTeamNeed } from "@/lib/data/mutations";
import { createSupabaseServerClient, hasSupabaseEnv } from "@/lib/supabase/server";
import { getViewerContext } from "@/lib/data/queries";
import { needSchema, reviewSchema, shortlistStageSchema } from "@/lib/validation";
import { z } from "zod";

export async function createNeedAction(input: z.infer<typeof needSchema>) {
  const { profile, team } = await getViewerContext();
  const parsed = needSchema.parse(input);

  const needId = crypto.randomUUID();
  const createdNeed = await insertTeamNeed({
    id: needId,
    teamId: team.id,
    createdBy: profile.id,
    input: {
      title: parsed.title,
      position: parsed.position,
      priority: parsed.priority,
      status: parsed.active ? "active" : "draft",
      target_count: parsed.target_count,
      class_focus: parsed.class_focus || null,
      min_height_in: parsed.min_height_in,
      max_height_in: parsed.max_height_in,
      min_weight_lbs: parsed.min_weight_lbs,
      max_weight_lbs: parsed.max_weight_lbs,
      min_arm_length_in: parsed.min_arm_length_in,
      max_forty_time: parsed.max_forty_time,
      min_years_remaining: parsed.min_years_remaining,
      scheme: parsed.scheme || null,
      priority_traits: parsed.priority_traits,
      production_filters: parsed.production_filters,
      min_starts: parsed.min_starts,
      min_production_score: parsed.min_production_score,
      notes: parsed.notes || null
    }
  });

  if (!hasSupabaseEnv()) {
    addDemoNeed(createdNeed);
  }

  revalidatePath("/needs");
  revalidatePath("/dashboard");
  return { id: needId };
}

export async function submitReviewAction(formData: FormData) {
  const { profile } = await getViewerContext();

  const parsed = reviewSchema.parse({
    needId: formData.get("needId"),
    playerId: formData.get("playerId"),
    decision: formData.get("decision"),
    fitScore: formData.get("fitScore"),
    note: formData.get("note")
  });

  if (hasSupabaseEnv()) {
    const supabase = createSupabaseServerClient();
    await supabase.from("player_reviews").upsert(
      {
        need_id: parsed.needId,
        player_id: parsed.playerId,
        reviewer_id: profile.id,
        decision: parsed.decision,
        fit_score: parsed.fitScore,
        note: parsed.note || null
      },
      { onConflict: "need_id,player_id,reviewer_id" }
    );

    if (parsed.decision === "right" || parsed.decision === "save") {
      await supabase.from("shortlists").upsert(
        {
          need_id: parsed.needId,
          player_id: parsed.playerId,
          created_by: profile.id,
          stage: parsed.decision === "right" ? "assistant" : "final_watch",
          note: parsed.note || null
        },
        { onConflict: "need_id,player_id" }
      );
    }

    if (parsed.decision === "needs_film") {
      await supabase.from("player_tags").upsert(
        {
          player_id: parsed.playerId,
          tag: "needs-film"
        },
        { onConflict: "player_id,tag" }
      );
    }
  } else {
    addOrUpdateDemoReview({
      id: crypto.randomUUID(),
      need_id: parsed.needId,
      player_id: parsed.playerId,
      reviewer_id: profile.id,
      decision: parsed.decision,
      fit_score: parsed.fitScore,
      note: parsed.note || null,
      created_at: new Date().toISOString()
    });

    if (parsed.decision === "right" || parsed.decision === "save") {
      addOrUpdateDemoShortlist({
        id: crypto.randomUUID(),
        need_id: parsed.needId,
        player_id: parsed.playerId,
        created_by: profile.id,
        stage: parsed.decision === "right" ? "assistant" : "final_watch",
        priority_rank: null,
        note: parsed.note || null,
        created_at: new Date().toISOString()
      });
    }

    if (parsed.decision === "needs_film") {
      addDemoPlayerTag(parsed.playerId, "needs-film");
    }
  }

  revalidatePath(`/review/${parsed.needId}`);
  revalidatePath("/shortlist");
  revalidatePath("/dashboard");
}

export async function updateShortlistStageAction(formData: FormData) {
  const parsed = shortlistStageSchema.parse({
    shortlistId: formData.get("shortlistId"),
    stage: formData.get("stage")
  });

  if (hasSupabaseEnv()) {
    const supabase = createSupabaseServerClient();
    await supabase
      .from("shortlists")
      .update({ stage: parsed.stage })
      .eq("id", parsed.shortlistId);
  } else {
    updateDemoShortlistStage(parsed.shortlistId, parsed.stage);
  }

  revalidatePath("/shortlist");
}

export async function addPlayerToShortlistAction(input: {
  playerId: string;
  needId: string;
}) {
  const { profile } = await getViewerContext();

  if (hasSupabaseEnv()) {
    const supabase = createSupabaseServerClient();

    await supabase.from("player_reviews").upsert(
      {
        need_id: input.needId,
        player_id: input.playerId,
        reviewer_id: profile.id,
        decision: "right",
        fit_score: 80,
        note: "Added from player profile."
      },
      { onConflict: "need_id,player_id,reviewer_id" }
    );

    await supabase.from("shortlists").upsert(
      {
        need_id: input.needId,
        player_id: input.playerId,
        created_by: profile.id,
        stage: "assistant",
        note: "Added from player profile."
      },
      { onConflict: "need_id,player_id" }
    );
  } else {
    addOrUpdateDemoReview({
      id: crypto.randomUUID(),
      need_id: input.needId,
      player_id: input.playerId,
      reviewer_id: profile.id,
      decision: "right",
      fit_score: 80,
      note: "Added from player profile.",
      created_at: new Date().toISOString()
    });

    addOrUpdateDemoShortlist({
      id: crypto.randomUUID(),
      need_id: input.needId,
      player_id: input.playerId,
      created_by: profile.id,
      stage: "assistant",
      priority_rank: null,
      note: "Added from player profile.",
      created_at: new Date().toISOString()
    });
  }

  revalidatePath(`/players/${input.playerId}`);
  revalidatePath("/shortlist");
}

export async function markPlayerNeedsFilmAction(input: {
  playerId: string;
  needId: string;
}) {
  const { profile } = await getViewerContext();

  if (hasSupabaseEnv()) {
    const supabase = createSupabaseServerClient();

    await supabase.from("player_reviews").upsert(
      {
        need_id: input.needId,
        player_id: input.playerId,
        reviewer_id: profile.id,
        decision: "needs_film",
        fit_score: 72,
        note: "Needs deeper film review."
      },
      { onConflict: "need_id,player_id,reviewer_id" }
    );

    await supabase.from("player_tags").upsert(
      {
        player_id: input.playerId,
        tag: "needs-film"
      },
      { onConflict: "player_id,tag" }
    );
  } else {
    addOrUpdateDemoReview({
      id: crypto.randomUUID(),
      need_id: input.needId,
      player_id: input.playerId,
      reviewer_id: profile.id,
      decision: "needs_film",
      fit_score: 72,
      note: "Needs deeper film review.",
      created_at: new Date().toISOString()
    });

    addDemoPlayerTag(input.playerId, "needs-film");
  }

  revalidatePath(`/players/${input.playerId}`);
}
