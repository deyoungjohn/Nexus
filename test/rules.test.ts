import assert from "node:assert/strict";
import test from "node:test";
import { InstrumentRegistry, createInstrument } from "../src/domain/instrument.js";
import { activateRule, compileRule } from "../src/rules/rules.js";
import { evaluateRule } from "../src/rules/evaluate.js";
import { scheduleOccurrence } from "../src/rules/schedule.js";

const cash = "eip155:56/erc20:0x2222222222222222222222222222222222222222";
const base = { chainId: 56, issuerId: "fixture", productType: "stock", underlyingId: "alpha",
  ticker: "ALPH", decimals: 18, quantityModel: "fixed", adapterVersion: "1",
  sectorTags: ["technology"], classificationVersion: "1", statusSource: "status",
  referenceSource: "reference", eligibilityRequirements: ["route-approved"] };
const first = createInstrument({ ...base, tokenAddress: "0x1111111111111111111111111111111111111111" });
const second = createInstrument({ ...base, tokenAddress: "0x3333333333333333333333333333333333333333",
  underlyingId: "beta", ticker: "BETA" });
const registry = new InstrumentRegistry([first, second]);
const schedule = { zone: "Africa/Lagos", frequency: "daily", weekday: null,
  localTime: "09:00", windowMinutes: 30 };
const common = { id: "rule-one", portfolioId: "portfolio-one", version: 1, expiresAt: null };
const contribution = { assetId: cash, decimals: 18, units: "5" };
const basket = { ...common, kind: "basket", schedule, contribution,
  targets: [{ instrumentId: first.instrumentId, weightBps: 5000 },
    { instrumentId: second.instrumentId, weightBps: 5000 }] };

test("P6 strict compiler rejects invented fields, tokens, weights and signals", () => {
  assert.throws(() => compileRule({ ...basket, surprise: true }, registry), { code: "UNKNOWN_RULE_FIELD" });
  assert.throws(() => compileRule({ ...basket, targets: [{ instrumentId: "unknown", weightBps: 10000 }] }, registry),
    { code: "UNKNOWN_INSTRUMENT" });
  assert.throws(() => compileRule({ ...basket, targets: [{ instrumentId: first.instrumentId, weightBps: 9999 }] }, registry),
    { code: "INVALID_TARGETS" });
  assert.throws(() => compileRule({ ...basket, contribution: { ...contribution, units: "0.5" } }, registry),
    { code: "INVALID_UNITS" });
  assert.throws(() => compileRule({ ...common, kind: "price", instrumentId: first.instrumentId, side: "buy",
    comparator: "volatility-spike", pricePerShareRaw: "100", quantity: contribution,
    referenceSource: "reference", maxReferenceAgeMs: 60_000 }, registry), { code: "INVALID_SIGNAL" });
});

test("P6 basket activation is separate from approval and spends exact integer weights", () => {
  const ready = compileRule(basket, registry);
  assert.equal(ready.state, "READY_FOR_REVIEW");
  assert.throws(() => activateRule(ready, "wrong", new Date("2026-09-28T08:00:00Z")), { code: "RULE_NOT_REVIEWED" });
  assert.equal(evaluateRule(ready, { now: new Date("2026-09-28T08:05:00Z"), seenOccurrenceIds: new Set() }).status, "inactive");
  const active = activateRule(ready, ready.hash, new Date("2026-09-28T07:00:00Z"));
  const due = evaluateRule(active, { now: new Date("2026-09-28T08:05:00Z"), seenOccurrenceIds: new Set() });
  assert.equal(due.status, "ready");
  assert.equal(due.occurrenceId, "rule-one.v1.2026-09-28");
  assert.deepEqual(due.intents.map((intent) => intent.kind === "buy-budget" ? intent.spend.units : null), [3n, 2n]);
  assert.equal(evaluateRule(active, { now: new Date("2026-09-28T08:06:00Z"),
    seenOccurrenceIds: new Set([due.occurrenceId!]) }).status, "duplicate");
  assert.equal(evaluateRule(active, { now: new Date("2026-09-28T08:31:00Z"), seenOccurrenceIds: new Set() }).status, "not-due");
});

test("P6 schedule skips nonexistent DST times and never changes overlap occurrence ID", () => {
  const spring = { zone: "America/New_York", frequency: "weekly" as const, weekday: 0,
    localTime: "02:30", windowMinutes: 120 };
  assert.equal(scheduleOccurrence(spring, new Date("2026-03-08T07:00:00Z")), null);
  const fall = { ...spring, localTime: "01:30", windowMinutes: 120 };
  assert.equal(scheduleOccurrence(fall, new Date("2026-11-01T05:30:00Z"))?.dueAt, "2026-11-01T05:30:00.000Z");
  assert.equal(scheduleOccurrence(fall, new Date("2026-11-01T06:30:00Z"))?.dueAt, "2026-11-01T05:30:00.000Z");
  const rule = activateRule(compileRule({ ...basket, schedule: fall }, registry),
    compileRule({ ...basket, schedule: fall }, registry).hash, new Date("2026-10-31T12:00:00Z"));
  const firstRun = evaluateRule(rule, { now: new Date("2026-11-01T05:30:00Z"), seenOccurrenceIds: new Set() });
  const secondRun = evaluateRule(rule, { now: new Date("2026-11-01T06:30:00Z"),
    seenOccurrenceIds: new Set([firstRun.occurrenceId!]) });
  assert.equal(firstRun.occurrenceId, secondRun.occurrenceId);
  assert.equal(secondRun.status, "duplicate");
});

test("P6 price rule uses matching fresh source and fires once per version", () => {
  const draft = { ...common, kind: "price", instrumentId: first.instrumentId, side: "buy",
    comparator: "at-or-below", pricePerShareRaw: "100", quantity: contribution,
    referenceSource: "reference", maxReferenceAgeMs: 60_000 };
  const compiled = compileRule(draft, registry);
  const rule = activateRule(compiled, compiled.hash, new Date("2026-09-28T07:00:00Z"));
  const reference = { underlyingId: "alpha", source: "reference", sourceAt: "2026-09-28T08:00:00Z",
    receivedAt: "2026-09-28T08:00:10Z", pricePerShare: 99n };
  const context = { now: new Date("2026-09-28T08:00:30Z"), seenOccurrenceIds: new Set<string>(), reference };
  const ready = evaluateRule(rule, context);
  assert.equal(ready.status, "ready");
  assert.equal(evaluateRule(rule, { ...context, seenOccurrenceIds: new Set([ready.occurrenceId!]) }).status, "duplicate");
  assert.equal(evaluateRule(rule, { ...context, reference: { ...reference, underlyingId: "beta" } }).status, "suspended");
  assert.equal(evaluateRule(rule, { ...context, now: new Date("2026-09-28T08:02:00Z") }).status, "suspended");
  assert.equal(evaluateRule(rule, { ...context, reference: { ...reference, pricePerShare: 101n } }).status, "not-due");
});

test("P6 a weekly window crossing midnight preserves the prior day's occurrence", () => {
  const late = { zone: "Africa/Lagos", frequency: "weekly" as const, weekday: 2,
    localTime: "23:30", windowMinutes: 120 };
  assert.deepEqual(scheduleOccurrence(late, new Date("2026-09-30T00:00:00Z")),
    { localDate: "2026-09-29", dueAt: "2026-09-29T22:30:00.000Z" });
  assert.equal(scheduleOccurrence(late, new Date("2026-09-30T00:30:00Z")), null);
});

test("P6 earnings reductions require explicit scope and confirmed fresh event", () => {
  const draft = { ...common, kind: "earnings", underlyingId: "alpha", action: "reduce", scope: "allocation",
    allocationId: "earnings-slice", reductionBps: 2500 };
  assert.throws(() => compileRule({ ...draft, allocationId: null }, registry), { code: "INVALID_EVENT_RULE" });
  const compiled = compileRule(draft, registry);
  const rule = activateRule(compiled, compiled.hash, new Date("2026-09-28T07:00:00Z"));
  const event = { source: "issuer-ir", observedAt: "2026-09-28T07:59:00Z", expiresAt: "2026-09-28T08:10:00Z",
    underlyingId: "alpha", issuerSourceUrl: "https://issuer.example/ir", revision: "one",
    confirmation: "confirmed" as const, eventAt: "2026-09-28T08:00:00Z",
    blackoutStart: "2026-09-28T07:30:00Z", blackoutEnd: "2026-09-28T08:30:00Z" };
  const context = { now: new Date("2026-09-28T08:00:00Z"), seenOccurrenceIds: new Set<string>(), event };
  const ready = evaluateRule(rule, context);
  assert.equal(ready.status, "ready");
  assert.deepEqual(ready.intents, [{ kind: "reduce", underlyingId: "alpha", scope: "allocation",
    allocationId: "earnings-slice", reductionBps: 2500 }]);
  assert.equal(evaluateRule(rule, { ...context, seenOccurrenceIds: new Set([ready.occurrenceId!]) }).status, "duplicate");
  assert.equal(evaluateRule(rule, { ...context, event: { ...event, confirmation: "uncertain" as const } }).status, "suspended");
  assert.equal(evaluateRule(rule, { ...context, now: new Date("2026-09-28T08:11:00Z") }).status, "suspended");
  const freezeDraft = { ...draft, action: "freeze-buy", scope: "company", allocationId: null, reductionBps: 0 };
  const frozen = compileRule(freezeDraft, registry);
  const freeze = evaluateRule(activateRule(frozen, frozen.hash, new Date("2026-09-28T07:00:00Z")), context);
  assert.deepEqual(freeze.intents, [{ kind: "freeze-buy", underlyingId: "alpha", scope: "company", allocationId: null }]);
});
