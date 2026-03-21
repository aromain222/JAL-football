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
import type { Profile, Team } from "@/lib/types";
import { needSchema, reviewSchema, shortlistStageSchema } from "@/lib/validation";
import { z } from "zod";

export async function createNeedAction(input: z.infer<typeof needSchema>) {
  const parsed = needSchema.parse(input);
  const supabase = hasSupabaseEnv() ? createSupabaseServerClient() : null;

  let viewerProfile = null as Awaited<ReturnType<typeof getViewerContext>>["profile"] | null;
  let viewerTeam = null as Awaited<ReturnType<typeof getViewerContext>>["team"] | null;

  if (supabase) {
    const {
      data: { user }
    } = await supabase.auth.getUser();

    if (!user) {
      throw new Error("Sign in again before creating a need.");
    }

    const { data: profileRaw, error: profileError } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", user.id)
      .single();
    const profile = profileRaw as Profile | null;

    if (profileError || !profile) {
      throw new Error("Your staff profile is missing. Sign in with a seeded demo user.");
    }

    const { data: teamRaw, error: teamError } = await supabase
      .from("teams")
      .select("*")
      .eq("id", profile.team_id)
      .single();
    const team = teamRaw as Team | null;

    if (teamError || !team) {
      throw new Error("Your team record could not be found.");
    }

    viewerProfile = profile;
    viewerTeam = team;
  } else {
    const { profile, team } = await getViewerContext();
    viewerProfile = profile;
    viewerTeam = team;
  }

  const needId = crypto.randomUUID();
  const createdNeed = await insertTeamNeed({
    id: needId,
    teamId: viewerTeam.id,
    createdBy: viewerProfile.id,
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
    await supabase.from("player_reviews" as never).upsert(
      {
        need_id: parsed.needId,
        player_id: parsed.playerId,
        reviewer_id: profile.id,
        decision: parsed.decision,
        fit_score: parsed.fitScore,
        note: parsed.note || null
      } as never,
      { onConflict: "need_id,player_id,reviewer_id" }
    );

    if (parsed.decision === "right" || parsed.decision === "save") {
      await supabase.from("shortlists" as never).upsert(
        {
          need_id: parsed.needId,
          player_id: parsed.playerId,
          created_by: profile.id,
          stage: parsed.decision === "right" ? "assistant" : "final_watch",
          note: parsed.note || null
        } as never,
        { onConflict: "need_id,player_id" }
      );
    }

    if (parsed.decision === "needs_film") {
      await supabase.from("player_tags" as never).upsert(
        {
          player_id: parsed.playerId,
          tag: "needs-film"
        } as never,
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

/** Save measurables from pasted 247 write-up (fallback when API doesn't have arm/shuttle/40 etc). Stats come from Sportradar via enrich-stats. */
export async function saveMeasurablesFrom247WriteUpAction(input: {
  playerId: string;
  writeUpText: string;
}) {
  const { parse247WriteUp } = await import("@/lib/measurables/parse-247-writeup");
  const parsed = parse247WriteUp(input.writeUpText);
  const hasAny =
    parsed.forty_time != null ||
    parsed.shuttle_time != null ||
    parsed.vertical_jump != null ||
    parsed.arm_length_in != null ||
    parsed.wing_span_in != null;
  if (!hasAny) {
    return { ok: false, message: "No combine measurables found (e.g. 40, shuttle, vertical, arm, wingspan)." };
  }

  if (!hasSupabaseEnv()) {
    revalidatePath(`/players/${input.playerId}`);
    return { ok: true, message: "Demo mode: measurables not persisted." };
  }

  const supabase = createSupabaseServerClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (!user) {
    return { ok: false, message: "Sign in to save measurables." };
  }

  const { data: existing } = await supabase
    .from("player_measurements")
    .select("*")
    .eq("player_id", input.playerId)
    .single();

  const row = {
    player_id: input.playerId,
    height_in: existing?.height_in ?? null,
    weight_lbs: existing?.weight_lbs ?? null,
    forty_time: parsed.forty_time ?? existing?.forty_time ?? null,
    shuttle_time: parsed.shuttle_time ?? existing?.shuttle_time ?? null,
    vertical_jump: parsed.vertical_jump ?? existing?.vertical_jump ?? null,
    arm_length_in: parsed.arm_length_in ?? existing?.arm_length_in ?? null,
    wing_span_in: parsed.wing_span_in ?? existing?.wing_span_in ?? null,
    verified_at: existing?.verified_at ?? null
  };

  const { error } = await supabase.from("player_measurements").upsert(row, { onConflict: "player_id" });
  if (error) {
    return { ok: false, message: error.message };
  }
  revalidatePath(`/players/${input.playerId}`);
  return { ok: true, message: "Measurables updated from write-up." };
}

export async function upsertPlayerIdentityLinkAction(input: {
  playerId: string;
  espnUrl?: string;
  rosterUrl?: string;
  confidence?: number;
  source?: string;
  matchedTeam?: string;
  notes?: string;
}) {
  if (!hasSupabaseEnv()) {
    return { ok: false, message: "Demo mode: identity links not persisted." };
  }

  const supabase = createSupabaseServerClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, message: "Sign in to save." };

  const row = {
    player_id: input.playerId,
    espn_url: input.espnUrl?.trim() || null,
    roster_url: input.rosterUrl?.trim() || null,
    confidence: typeof input.confidence === "number" ? input.confidence : null,
    source: input.source?.trim() || null,
    matched_team: input.matchedTeam?.trim() || null,
    notes: input.notes?.trim() || null,
    last_checked_at: new Date().toISOString()
  };

  const { error } = await supabase.from("player_identity_links").upsert(row, { onConflict: "player_id" });
  if (error) return { ok: false, message: error.message };

  revalidatePath("/identity");
  revalidatePath(`/players/${input.playerId}`);
  return { ok: true, message: "Saved identity links." };
}

export async function addPlayerSourceNoteAction(formData: FormData) {
  const playerId = String(formData.get("playerId") ?? "").trim();
  const sourcePlatform = String(formData.get("sourcePlatform") ?? "x").trim() || "x";
  const sourceAccount = String(formData.get("sourceAccount") ?? "").trim() || null;
  const sourceUrl = String(formData.get("sourceUrl") ?? "").trim() || null;
  const noteType = String(formData.get("noteType") ?? "scouting").trim() || "scouting";
  const sourceText = String(formData.get("sourceText") ?? "").trim();
  const summary = String(formData.get("summary") ?? "").trim() || null;
  const traitsRaw = String(formData.get("traits") ?? "").trim();
  const statusSignal = String(formData.get("statusSignal") ?? "").trim() || null;
  const confidenceRaw = String(formData.get("confidence") ?? "").trim();

  if (!playerId || !sourceText) {
    throw new Error("Player and source text are required.");
  }

  const traits = traitsRaw
    ? traitsRaw
        .split(",")
        .map((value) => value.trim().toLowerCase())
        .filter(Boolean)
        .slice(0, 8)
    : [];

  const confidence = confidenceRaw ? Number(confidenceRaw) : null;
  const normalizedConfidence =
    confidence !== null && Number.isFinite(confidence) && confidence >= 0 && confidence <= 1
      ? confidence
      : null;

  if (!hasSupabaseEnv()) {
    revalidatePath(`/players/${playerId}`);
    return { ok: true, message: "Demo mode: note not persisted." };
  }

  const supabase = createSupabaseServerClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    throw new Error("Sign in to save source notes.");
  }

  const row = {
    player_id: playerId,
    source_platform: sourcePlatform,
    source_account: sourceAccount,
    source_url: sourceUrl,
    note_type: noteType,
    source_text: sourceText,
    summary,
    traits,
    status_signal: statusSignal,
    confidence: normalizedConfidence,
    created_by: user.id
  };

  const { error } = await supabase.from("player_source_notes" as never).insert(row as never);
  if (error) {
    throw new Error(error.message);
  }

  revalidatePath(`/players/${playerId}`);
  return { ok: true, message: "Source note saved." };
}
