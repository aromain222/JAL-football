import { NextRequest, NextResponse } from "next/server";
import { enrichPlayerFromX } from "@/lib/x/enrich";

export async function POST(request: NextRequest) {
  const bearerToken = process.env.BEARER_API_KEY;

  if (!bearerToken) {
    return NextResponse.json(
      { error: "Missing BEARER_API_KEY environment variable." },
      { status: 500 }
    );
  }

  let body: { name?: string; school?: string; handle?: string };

  try {
    body = (await request.json()) as { name?: string; school?: string; handle?: string };
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const name = body.name?.trim();
  const school = body.school?.trim();
  const handle = body.handle?.trim();

  if (!name || !school) {
    return NextResponse.json(
      { error: "Both 'name' and 'school' are required." },
      { status: 400 }
    );
  }

  try {
    const result = await enrichPlayerFromX({
      bearerToken,
      name,
      school,
      ...(handle ? { handle } : {})
    });

    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to enrich X measurables.";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
