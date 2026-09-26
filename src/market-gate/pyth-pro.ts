import type { ReferenceEvidence } from "./evidence.js";

type ObjectValue = Record<string, unknown>;
const record = (value: unknown): ObjectValue | null => value !== null && typeof value === "object" && !Array.isArray(value)
  ? value as ObjectValue : null;
const integer = (value: unknown): bigint | null => {
  if (typeof value === "number" && Number.isSafeInteger(value)) return BigInt(value);
  if (typeof value === "string" && /^(0|[1-9][0-9]*)$/.test(value)) return BigInt(value);
  return null;
};

export interface PythEquityFeed {
  /** Resolve against Pyth's current symbol directory; never infer from a ticker alone. */
  readonly priceFeedId: number;
  readonly underlyingId: string;
}

/** Pyth Pro's feedUpdateTimestamp is the price origin; timestampUs may carry an old price. */
export function adaptPythProReference(payload: unknown, feed: PythEquityFeed,
  receivedAt: string): ReferenceEvidence | null {
  const root = record(payload), parsed = record(root?.parsed);
  if (!parsed || !Array.isArray(parsed.priceFeeds) || !Number.isSafeInteger(feed.priceFeedId)
    || feed.priceFeedId <= 0 || !Number.isFinite(Date.parse(receivedAt))) return null;
  const envelopeUs = integer(parsed.timestampUs);
  if (envelopeUs === null || envelopeUs <= 0n) return null;
  const matches = parsed.priceFeeds.filter((value: unknown) => record(value)?.priceFeedId === feed.priceFeedId);
  if (matches.length !== 1) return null;
  const item = record(matches[0])!;
  const price = integer(item.price), updatedUs = integer(item.feedUpdateTimestamp);
  const exponent = item.exponent;
  if (price === null || price <= 0n || updatedUs === null || updatedUs <= 0n
    || updatedUs > envelopeUs || item.marketSession !== "regular"
    || typeof exponent !== "number" || !Number.isInteger(exponent) || exponent < -18 || exponent > 0
    || typeof item.publisherCount !== "number" || !Number.isInteger(item.publisherCount)
    || item.publisherCount <= 0) return null;
  const sourceMs = updatedUs / 1000n;
  if (sourceMs > BigInt(Date.parse(receivedAt)) || sourceMs > BigInt(Number.MAX_SAFE_INTEGER)) return null;
  const pricePerShare = price * 10n ** BigInt(18 + exponent);
  return { underlyingId: feed.underlyingId, source: `pyth-pro:${feed.priceFeedId}`,
    sourceAt: new Date(Number(sourceMs)).toISOString(), receivedAt, pricePerShare };
}

/** Read-only accessor; callers provide a server-side key and must not log it. */
export async function fetchPythProReference(feed: PythEquityFeed, apiKey: string,
  fetcher: typeof fetch = fetch): Promise<ReferenceEvidence | null> {
  if (!apiKey || !Number.isSafeInteger(feed.priceFeedId) || feed.priceFeedId <= 0) return null;
  try {
    const response = await fetcher("https://pyth-lazer.dourolabs.app/v1/latest_price", {
      method: "POST", headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ priceFeedIds: [feed.priceFeedId],
        properties: ["price", "exponent", "feedUpdateTimestamp", "marketSession", "publisherCount"],
        formats: [], channel: "fixed_rate@200ms" }), signal: AbortSignal.timeout(5000)
    });
    if (!response.ok) return null;
    const receivedAt = new Date().toISOString();
    return adaptPythProReference(await response.json() as unknown, feed, receivedAt);
  } catch { return null; }
}
