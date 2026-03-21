import { NextRequest, NextResponse } from "next/server";

const OPENAI_API_URL = "https://api.openai.com/v1/responses";
const DEFAULT_MODEL = process.env.OPENAI_SOURCE_NOTE_MODEL || "gpt-4.1-mini";

export async function POST(request: NextRequest) {
  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    return NextResponse.json({ error: "Missing OPENAI_API_KEY." }, { status: 500 });
  }

  let body: { sourceText?: string };

  try {
    body = (await request.json()) as { sourceText?: string };
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const sourceText = body.sourceText?.trim();
  if (!sourceText) {
    return NextResponse.json({ error: "sourceText is required." }, { status: 400 });
  }

  const prompt = [
    "Extract structured football recruiting note data from the pasted text.",
    "Do not invent facts.",
    "Only include traits, status, offers, measurables, or summaries if explicitly supported by the text.",
    "Allowed note_type values: scouting, status_update, offer_interest, measurable.",
    "For traits, return short lowercase phrases.",
    "For confidence, use a decimal between 0 and 1.",
    "If a field is not clearly supported, return null or an empty array.",
    "",
    sourceText
  ].join("\n");

  try {
    const response = await fetch(OPENAI_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: DEFAULT_MODEL,
        input: [
          {
            role: "system",
            content: [
              {
                type: "input_text",
                text: "You extract structured recruiting note data from football player text."
              }
            ]
          },
          {
            role: "user",
            content: [{ type: "input_text", text: prompt }]
          }
        ],
        text: {
          format: {
            type: "json_schema",
            name: "player_source_note_extraction",
            schema: {
              type: "object",
              additionalProperties: false,
              properties: {
                note_type: {
                  type: "string",
                  enum: ["scouting", "status_update", "offer_interest", "measurable"]
                },
                summary: {
                  anyOf: [{ type: "string" }, { type: "null" }]
                },
                traits: {
                  type: "array",
                  items: { type: "string" }
                },
                status_signal: {
                  anyOf: [{ type: "string" }, { type: "null" }]
                },
                confidence: {
                  anyOf: [{ type: "number" }, { type: "null" }]
                }
              },
              required: ["note_type", "summary", "traits", "status_signal", "confidence"]
            }
          }
        }
      }),
      cache: "no-store"
    });

    const raw = await response.json();
    if (!response.ok) {
      return NextResponse.json(
        { error: "OpenAI extraction failed.", details: raw },
        { status: response.status }
      );
    }

    const contentText =
      raw.output?.[0]?.content?.find?.((item: { type?: string }) => item.type === "output_text")?.text ??
      raw.output?.[0]?.content?.[0]?.text ??
      raw.output_text ??
      null;

    if (!contentText) {
      return NextResponse.json({ error: "No structured output returned." }, { status: 502 });
    }

    const parsed = JSON.parse(contentText) as {
      note_type: string;
      summary: string | null;
      traits: string[];
      status_signal: string | null;
      confidence: number | null;
    };

    return NextResponse.json(parsed);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Extraction failed." },
      { status: 502 }
    );
  }
}
