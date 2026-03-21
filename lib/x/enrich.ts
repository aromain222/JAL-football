export type SourceType = "bio" | "post";
export type Confidence = "high" | "medium" | "low";

export interface EnrichRequestBody {
  name: string;
  school: string;
  handle?: string;
}

export interface XTweet {
  id: string;
  text: string;
  author_id?: string;
}

export interface XUser {
  id: string;
  description?: string;
  url?: string;
  username?: string;
}

export interface OfferResult {
  school: string;
  source_type: SourceType;
  confidence: Confidence;
  source_text: string;
}

export interface RouteSource {
  type: SourceType;
  id: string;
  text: string;
}

export interface MeasurableResult {
  bench_press: string | null;
  squat: string | null;
  power_clean: string | null;
  forty_time: string | null;
  arm_length: string | null;
}

export interface TrackResult {
  hundred_meter: string | null;
  two_hundred_meter: string | null;
  hurdles_110: string | null;
  long_jump: string | null;
  triple_jump: string | null;
}

export interface EnrichmentResponse {
  player: {
    name: string;
    school: string;
  };
  measurables: MeasurableResult;
  track: TrackResult;
  offers: OfferResult[];
  sources: RouteSource[];
}

const X_API_BASE_URL = "https://api.x.com/2";

const MEASURABLE_PATTERNS: Array<{
  key: keyof MeasurableResult;
  patterns: RegExp[];
}> = [
  {
    key: "bench_press",
    patterns: [
      /\bbench(?:\s+press)?[:\s-]*(\d{3})\b/i,
      /\b(\d{3})\s*(?:lb\s*)?bench\b/i
    ]
  },
  {
    key: "squat",
    patterns: [
      /\bsquat[:\s-]*(\d{3})\b/i,
      /\b(\d{3})\s*(?:lb\s*)?squat\b/i
    ]
  },
  {
    key: "power_clean",
    patterns: [
      /\bpower\s+clean[:\s-]*(\d{3})\b/i,
      /\bclean[:\s-]*(\d{3})\b/i,
      /\b(\d{3})\s*(?:lb\s*)?(?:power\s+)?clean\b/i
    ]
  },
  {
    key: "forty_time",
    patterns: [
      /\b(\d\.\d{2})\s*(?:40|forty)\b/i,
      /\b(?:40|forty)[:\s-]*(\d\.\d{2})\b/i,
      /\b\d['’]\d{1,2}\s*[|/]\s*(\d\.\d{2})\b/i,
      /\bht(?:\.|:)?\s*\d['’]\d{1,2}\s*(?:wt(?:\.|:)?\s*\d{2,3}\s*)?[-|/]\s*(\d\.\d{2})\b/i
    ]
  },
  {
    key: "arm_length",
    patterns: [
      /\barm(?:\s+length)?[:\s-]*(\d{2}(?:\.\d)?)\b/i,
      /\b(\d{2}(?:\.\d)?)\s*(?:"|inch(?:es)?)\s*arms?\b/i
    ]
  }
];

const TRACK_PATTERNS: Array<{
  key: keyof TrackResult;
  patterns: RegExp[];
}> = [
  {
    key: "hundred_meter",
    patterns: [/\b(?:100m|100)\s*[:\-]?\s*(\d{1,2}\.\d{2})\b/i, /\b(\d{1,2}\.\d{2})\s*(?:100m|100)\b/i]
  },
  {
    key: "two_hundred_meter",
    patterns: [/\b(?:200m|200)\s*[:\-]?\s*(\d{1,2}\.\d{2})\b/i, /\b(\d{1,2}\.\d{2})\s*(?:200m|200)\b/i]
  },
  {
    key: "hurdles_110",
    patterns: [/\b(?:110h|110mh|110 hurdles)\s*[:\-]?\s*(\d{1,2}\.\d{2})\b/i, /\b(\d{1,2}\.\d{2})\s*(?:110h|110mh|110 hurdles)\b/i]
  },
  {
    key: "long_jump",
    patterns: [/\b(?:lj|long jump)\s*[:\-]?\s*(\d{1,2}[-']\d{1,2})\b/i]
  },
  {
    key: "triple_jump",
    patterns: [/\b(?:tj|triple jump)\s*[:\-]?\s*(\d{1,2}[-']\d{1,2})\b/i]
  }
];

const OFFER_PATTERNS: Array<{
  pattern: RegExp;
  confidence: Confidence;
}> = [
  {
    pattern: /\b(?:offer from|received an offer from|blessed to receive an offer from|offered by)\s+([A-Za-z0-9&.'’\-\s]+?)(?=[,.;!]|$)/i,
    confidence: "high"
  },
  {
    pattern: /\bPWO from\s+([A-Za-z0-9&.'’\-\s]+?)(?=[,.;!]|$)/i,
    confidence: "medium"
  },
  {
    pattern: /\bafter speaking with coach(?:es)?(?:\s+\w+)?(?:\s+at)?\s+([A-Za-z0-9&.'’\-\s]+?)(?=[,.;!]|$)/i,
    confidence: "low"
  }
];

export function createEmptyMeasurables(): MeasurableResult {
  return {
    bench_press: null,
    squat: null,
    power_clean: null,
    forty_time: null,
    arm_length: null
  };
}

export function createEmptyTrack(): TrackResult {
  return {
    hundred_meter: null,
    two_hundred_meter: null,
    hurdles_110: null,
    long_jump: null,
    triple_jump: null
  };
}

export async function enrichPlayerFromX(params: {
  bearerToken: string;
  name: string;
  school: string;
  handle?: string;
}): Promise<EnrichmentResponse> {
  const directUser = params.handle
    ? await fetchUserByUsername({ bearerToken: params.bearerToken, username: params.handle })
    : null;
  const tweets = await searchRecentTweets(params);

  if (!tweets.length && !directUser) {
    return buildResponse(
      { name: params.name, school: params.school },
      createEmptyMeasurables(),
      createEmptyTrack(),
      [],
      []
    );
  }

  const authorIds = Array.from(
    new Set(tweets.map((tweet) => tweet.author_id).filter(Boolean))
  ) as string[];
  if (directUser?.id) authorIds.unshift(directUser.id);
  const users = await fetchUsers({ bearerToken: params.bearerToken, authorIds });
  const mergedUsers = dedupeUsers(directUser ? [directUser, ...users] : users);
  const usersById = new Map(mergedUsers.map((user) => [user.id, user]));

  const measurables = createEmptyMeasurables();
  const track = createEmptyTrack();
  const offers: OfferResult[] = [];
  const sources: RouteSource[] = [];
  const seenSources = new Set<string>();
  const seenOffers = new Set<string>();

  for (const user of mergedUsers) {
    if (!user.description) continue;

    const measurableMatches = extractMeasurables(user.description);
    const trackMatches = extractTrack(user.description);
    const offerMatches = extractOffers(user.description, "bio");

    mergeMeasurables(measurables, measurableMatches);
    mergeTrack(track, trackMatches);
    pushSourceIfMatched({
      sourceBucket: sources,
      seenSourceIds: seenSources,
      matched: hasMatchedData(measurableMatches, trackMatches, offerMatches),
      source: { type: "bio", id: `bio:${user.id}`, text: user.description }
    });
    mergeOffers(offers, seenOffers, offerMatches);
  }

  for (const tweet of tweets) {
    const measurableMatches = extractMeasurables(tweet.text);
    const trackMatches = extractTrack(tweet.text);
    const offerMatches = extractOffers(tweet.text, "post");

    mergeMeasurables(measurables, measurableMatches);
    mergeTrack(track, trackMatches);
    pushSourceIfMatched({
      sourceBucket: sources,
      seenSourceIds: seenSources,
      matched: hasMatchedData(measurableMatches, trackMatches, offerMatches),
      source: { type: "post", id: tweet.id, text: tweet.text }
    });
    mergeOffers(offers, seenOffers, offerMatches);

    const author = tweet.author_id ? usersById.get(tweet.author_id) : null;
    if (author?.description) {
      const authorMeasurableMatches = extractMeasurables(author.description);
      const authorTrackMatches = extractTrack(author.description);
      const authorOfferMatches = extractOffers(author.description, "bio");

      mergeMeasurables(measurables, authorMeasurableMatches);
      mergeTrack(track, authorTrackMatches);
      pushSourceIfMatched({
        sourceBucket: sources,
        seenSourceIds: seenSources,
        matched: hasMatchedData(authorMeasurableMatches, authorTrackMatches, authorOfferMatches),
        source: { type: "bio", id: `bio:${author.id}`, text: author.description }
      });
      mergeOffers(offers, seenOffers, authorOfferMatches);
    }
  }

  return buildResponse(
    { name: params.name, school: params.school },
    measurables,
    track,
    offers,
    sources
  );
}

function buildResponse(
  player: { name: string; school: string },
  measurables: MeasurableResult,
  track: TrackResult,
  offers: OfferResult[],
  sources: RouteSource[]
): EnrichmentResponse {
  return {
    player,
    measurables,
    track,
    offers,
    sources
  };
}

async function searchRecentTweets(params: {
  bearerToken: string;
  name: string;
  school: string;
  handle?: string;
}): Promise<XTweet[]> {
  const search = new URL(`${X_API_BASE_URL}/tweets/search/recent`);
  const query = params.handle
    ? `from:${params.handle} (${params.name} OR ${params.school} football) -is:retweet`
    : `${params.name} ${params.school} football -is:retweet`;
  search.searchParams.set("query", query);
  search.searchParams.set("max_results", "10");
  search.searchParams.set("tweet.fields", "author_id");

  const response = await fetch(search, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${params.bearerToken}`
    },
    cache: "no-store"
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`X recent search failed with status ${response.status}: ${errorText}`);
  }

  const payload = (await response.json()) as { data?: XTweet[] };
  return (payload.data ?? []).slice(0, 5);
}

async function fetchUserByUsername(params: {
  bearerToken: string;
  username: string;
}): Promise<XUser | null> {
  const url = new URL(`${X_API_BASE_URL}/users/by/username/${params.username}`);
  url.searchParams.set("user.fields", "description,url,username");

  const response = await fetch(url, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${params.bearerToken}`
    },
    cache: "no-store"
  });

  if (!response.ok) return null;

  const payload = (await response.json()) as { data?: XUser };
  return payload.data ?? null;
}

async function fetchUsers(params: {
  bearerToken: string;
  authorIds: string[];
}): Promise<XUser[]> {
  const users: XUser[] = [];

  for (const authorId of params.authorIds) {
    const url = new URL(`${X_API_BASE_URL}/users/${authorId}`);
    url.searchParams.set("user.fields", "description,url,username");

    const response = await fetch(url, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${params.bearerToken}`
      },
      cache: "no-store"
    });

    if (!response.ok) continue;

    const payload = (await response.json()) as { data?: XUser };
    if (payload.data) users.push(payload.data);
  }

  return users;
}

function dedupeUsers(users: XUser[]) {
  const seen = new Set<string>();
  return users.filter((user) => {
    if (seen.has(user.id)) return false;
    seen.add(user.id);
    return true;
  });
}

export function extractMeasurables(text: string): MeasurableResult {
  const result = createEmptyMeasurables();

  for (const definition of MEASURABLE_PATTERNS) {
    for (const pattern of definition.patterns) {
      const match = text.match(pattern);
      if (match?.[1]) {
        result[definition.key] = normalizeNumericString(match[1]);
        break;
      }
    }
  }

  return result;
}

export function extractTrack(text: string): TrackResult {
  const result = createEmptyTrack();

  for (const definition of TRACK_PATTERNS) {
    for (const pattern of definition.patterns) {
      const match = text.match(pattern);
      if (match?.[1]) {
        result[definition.key] = normalizeNumericString(match[1]);
        break;
      }
    }
  }

  return result;
}

export function extractOffers(text: string, sourceType: SourceType): OfferResult[] {
  const matches: OfferResult[] = [];

  for (const definition of OFFER_PATTERNS) {
    const matched = text.match(definition.pattern);
    const capturedSchool = matched?.[1]?.trim();
    if (!capturedSchool) continue;

    matches.push({
      school: normalizeSchoolName(capturedSchool),
      source_type: sourceType,
      confidence: definition.confidence,
      source_text: text
    });
  }

  return matches;
}

function mergeMeasurables(target: MeasurableResult, incoming: MeasurableResult) {
  for (const key of Object.keys(target) as Array<keyof MeasurableResult>) {
    if (!target[key] && incoming[key]) {
      target[key] = incoming[key];
    }
  }
}

function mergeTrack(target: TrackResult, incoming: TrackResult) {
  for (const key of Object.keys(target) as Array<keyof TrackResult>) {
    if (!target[key] && incoming[key]) {
      target[key] = incoming[key];
    }
  }
}

function mergeOffers(
  target: OfferResult[],
  seenOffers: Set<string>,
  incoming: OfferResult[]
) {
  for (const offer of incoming) {
    const dedupeKey = `${offer.school.toLowerCase()}|${offer.source_type}|${offer.source_text.toLowerCase()}`;
    if (seenOffers.has(dedupeKey)) continue;
    seenOffers.add(dedupeKey);
    target.push(offer);
  }
}

function pushSourceIfMatched(params: {
  sourceBucket: RouteSource[];
  seenSourceIds: Set<string>;
  matched: boolean;
  source: RouteSource;
}) {
  if (!params.matched || params.seenSourceIds.has(params.source.id)) return;
  params.seenSourceIds.add(params.source.id);
  params.sourceBucket.push(params.source);
}

function hasMatchedData(
  measurables: MeasurableResult,
  track: TrackResult,
  offers: OfferResult[]
) {
  const measurableFound = Object.values(measurables).some(Boolean);
  const trackFound = Object.values(track).some(Boolean);
  return measurableFound || trackFound || offers.length > 0;
}

function normalizeNumericString(value: string) {
  return value.trim().replace(/["']/g, "");
}

function normalizeSchoolName(value: string) {
  const cleaned = value
    .replace(/\bcoach(?:es)?\b/gi, "")
    .replace(/\buniversity of\b/gi, "")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/[.,;:!?]+$/g, "");

  const acronyms = new Set(["LSU", "UAB", "UCF", "USF", "UCLA", "USC", "BYU", "SMU", "TCU", "FIU", "FAU", "UTSA"]);
  const upper = cleaned.toUpperCase();
  if (acronyms.has(upper)) return upper;

  return cleaned
    .toLowerCase()
    .split(" ")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}
