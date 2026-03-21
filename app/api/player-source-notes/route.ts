import { revalidatePath } from "next/cache";
import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient, hasSupabaseEnv } from "@/lib/supabase/server";

export async function POST(request: NextRequest) {
  if (!hasSupabaseEnv()) {
    return NextResponse.json({ ok: false, message: "Demo mode: note not persisted." });
  }

  let body: {
    playerId?: string;
    sourcePlatform?: string;
    sourceAccount?: string;
    sourceUrl?: string;
    noteType?: string;
    sourceText?: string;
    summary?: string;
    traits?: string[];
    statusSignal?: string;
    confidence?: number | null;
  };

  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const playerId = body.playerId?.trim();
  const sourceText = body.sourceText?.trim();

  if (!playerId || !sourceText) {
    return NextResponse.json({ error: "playerId and sourceText are required." }, { status: 400 });
  }

  const supabase = createSupabaseServerClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Sign in to save source notes." }, { status: 401 });
  }

  const traits = Array.isArray(body.traits)
    ? body.traits.map((value) => value.trim().toLowerCase()).filter(Boolean).slice(0, 8)
    : [];

  const confidence =
    typeof body.confidence === "number" && Number.isFinite(body.confidence) && body.confidence >= 0 && body.confidence <= 1
      ? body.confidence
      : null;

  const row = {
    player_id: playerId,
    source_platform: body.sourcePlatform?.trim() || "x",
    source_account: body.sourceAccount?.trim() || null,
    source_url: body.sourceUrl?.trim() || null,
    note_type: body.noteType?.trim() || "scouting",
    source_text: sourceText,
    summary: body.summary?.trim() || null,
    traits,
    status_signal: body.statusSignal?.trim() || null,
    confidence,
    created_by: user.id
  };

  const { error } = await supabase.from("player_source_notes" as never).insert(row as never);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  revalidatePath(`/players/${playerId}`);
  return NextResponse.json({ ok: true });
}
