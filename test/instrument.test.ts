import assert from "node:assert/strict";
import { test } from "node:test";
import { createInstrument, InstrumentRegistry, type InstrumentInput } from "../src/domain/instrument.js";

const fixture: InstrumentInput = {
  chainId: 56, tokenAddress: `0x${"A".repeat(40)}`, issuerId: "fixture-issuer", productType: "stock-wrapper",
  underlyingId: "fixture-company", ticker: "DEMO", decimals: 18, quantityModel: "fixed-balance",
  adapterVersion: "v1", sectorTags: ["technology"], classificationVersion: "v1",
  statusSource: "synthetic-status", referenceSource: "synthetic-reference", eligibilityRequirements: ["unverified"],
};

test("wrapper identity is exact while underlying exposure can be grouped", () => {
  const second = { ...fixture, tokenAddress: `0x${"b".repeat(40)}`, issuerId: "other-issuer" };
  const registry = new InstrumentRegistry([second, fixture]);
  const a = createInstrument(fixture);
  const b = createInstrument(second);
  assert.notEqual(a.instrumentId, b.instrumentId);
  assert.equal(a.tokenAddress, fixture.tokenAddress.toLowerCase());
  assert.deepEqual(registry.forUnderlying(fixture.underlyingId).map((entry) => entry.instrumentId), [a.instrumentId, b.instrumentId]);
  assert.equal(registry.get(a.instrumentId).issuerId, fixture.issuerId);
  assert.throws(() => registry.get("DEMO"), { code: "UNKNOWN_INSTRUMENT" });
  assert.deepEqual(registry.forUnderlying("missing"), []);
});

test("registry rejects duplicate tokens including changed issuer metadata and address case", () => {
  for (const duplicate of [fixture, { ...fixture, issuerId: "other" }, { ...fixture, tokenAddress: fixture.tokenAddress.toLowerCase() }]) {
    assert.throws(() => new InstrumentRegistry([fixture, duplicate]), { code: "DUPLICATE_INSTRUMENT" });
  }
  assert.doesNotThrow(() => new InstrumentRegistry([fixture, { ...fixture, chainId: 1 }]));
});

test("registry snapshots cannot be changed through source arrays or returned objects", () => {
  const sectorTags = ["technology"];
  const eligibilityRequirements = ["unverified"];
  const registry = new InstrumentRegistry([{ ...fixture, sectorTags, eligibilityRequirements }]);
  sectorTags.push("other");
  eligibilityRequirements[0] = "eligible";
  const value = registry.get(createInstrument(fixture).instrumentId);
  assert.deepEqual(value.sectorTags, ["technology"]);
  assert.deepEqual(value.eligibilityRequirements, ["unverified"]);
  assert.ok(Object.isFrozen(value));
  assert.ok(Object.isFrozen(value.sectorTags));
  assert.ok(Object.isFrozen(registry.forUnderlying(fixture.underlyingId)));
});

test("unsupported quantity models are retained as metadata without execution capability", () => {
  const input = { ...fixture, quantityModel: "unknown-rebasing" };
  const registry = new InstrumentRegistry([input]);
  assert.equal(registry.get(createInstrument(input).instrumentId).quantityModel, "unknown-rebasing");
  assert.equal("execute" in registry, false);
});

test("missing or ambiguous registry metadata is rejected", () => {
  for (const patch of [{ issuerId: "" }, { issuerId: "issuer/product:injected" }, { decimals: -1 },
    { sectorTags: [] }, { sectorTags: ["tech", "tech"] }, { eligibilityRequirements: [] },
    { adapterVersion: "" }, { referenceSource: "" }, { ticker: "" }]) {
    assert.throws(() => createInstrument({ ...fixture, ...patch }));
  }
});
