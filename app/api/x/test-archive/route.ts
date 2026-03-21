import { NextRequest, NextResponse } from "next/server";

const X_API_BASE_URL = "https://api.twitter.com/2";

export async function POST(request: NextRequest) {
  const bearerToken = process.env.BEARER_API_KEY;

  if (!bearerToken) {
    return NextResponse.json(
      { error: "Missing BEARER_API_KEY environment variable." },
      { status: 500 }
    );
  }

  let body: {
    query?: string;
    start_time?: string;
    end_time?: string;
    max_results?: number;
  };

  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const query = body.query?.trim() || "transfer portal";
  const startTime = body.start_time?.trim() || "2025-03-01T00:00:00Z";
  const endTime = body.end_time?.trim() || "2026-03-01T00:00:00Z";
  const maxResults = Math.max(10, Math.min(100, body.max_results ?? 10));

  const url = new URL(`${X_API_BASE_URL}/tweets/search/all`);
  url.searchParams.set("query", query);
  url.searchParams.set("start_time", startTime);
  url.searchParams.set("end_time", endTime);
  url.searchParams.set("max_results", String(maxResults));
  url.searchParams.set("tweet.fields", "author_id,created_at");

  try {
    const response = await fetch(url.toString(), {
      headers: {
        Authorization: `Bearer ${bearerToken}`
      },
      cache: "no-store"
    });

    const rawText = await response.text();
    let parsedBody: unknown = null;

    try {
      parsedBody = rawText ? JSON.parse(rawText) : null;
    } catch {
      parsedBody = rawText;
    }

    return NextResponse.json(
      {
        archive_access: response.ok,
        endpoint: "/2/tweets/search/all",
        query,
        start_time: startTime,
        end_time: endTime,
        status: response.status,
        status_text: response.statusText,
        response: parsedBody
      },
      { status: response.ok ? 200 : response.status }
    );
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Archive probe failed."
      },
      { status: 502 }
    );
  }
}
