import assert from "node:assert/strict";
import test from "node:test";
import { adaptPythProReference, fetchPythProReference } from "../src/market-gate/pyth-pro.js";

const feed = { priceFeedId: 1314, underlyingId: "NVDA" };
const receivedAt = "2026-09-28T14:00:01.000Z";
const updated = BigInt(Date.parse("2026-09-28T14:00:00.000Z")) * 1000n;
const packet = (change: Record<string, unknown> = {}): unknown => ({ parsed: {
  timestampUs: (updated + 500_000n).toString(),
  priceFeeds: [{ priceFeedId: 1314, price: "20012345", exponent: -5,
    feedUpdateTimestamp: Number(updated), publisherCount: 3, marketSession: "regular", ...change }]
} });

test("P5 live-source parser uses Pyth price-origin time and exact feed identity", () => {
  const result = adaptPythProReference(packet(), feed, receivedAt);
  assert.equal(result?.sourceAt, "2026-09-28T14:00:00.000Z");
  assert.equal(result?.receivedAt, receivedAt);
  assert.equal(result?.pricePerShare, 200123450000000000000n);
  assert.equal(result?.source, "pyth-pro:1314");
  assert.equal(adaptPythProReference(packet({ priceFeedId: 922 }), feed, receivedAt), null);
});

test("P5 live-source parser preserves carried-forward origin and rejects malformed prices", () => {
  const stale = { parsed: { timestampUs: (updated + 60_000_000n).toString(),
    priceFeeds: [{ priceFeedId: 1314, price: "20012345", exponent: -5,
      feedUpdateTimestamp: Number(updated), publisherCount: 3, marketSession: "regular" }] } };
  assert.equal(adaptPythProReference(stale, feed, "2026-09-28T14:01:01.000Z")?.sourceAt,
    "2026-09-28T14:00:00.000Z");
  assert.equal(adaptPythProReference(packet({ feedUpdateTimestamp: undefined }), feed, receivedAt), null);
  assert.equal(adaptPythProReference(packet({ marketSession: "closed" }), feed, receivedAt), null);
  assert.equal(adaptPythProReference(packet({ exponent: -19 }), feed, receivedAt), null);
  assert.equal(adaptPythProReference(packet({ price: "0" }), feed, receivedAt), null);
});

test("P5 price accessor fails closed without credential or on provider failure", async () => {
  assert.equal(await fetchPythProReference(feed, ""), null);
  const failing = (async () => new Response("forbidden", { status: 403 })) as typeof fetch;
  assert.equal(await fetchPythProReference(feed, "runtime-only", failing), null);
});
