import assert from "node:assert/strict";
import { test } from "node:test";
import { amount, nativeAssetId, tokenAssetId } from "../src/domain/amount.js";
import { createInstrument, InstrumentRegistry } from "../src/domain/instrument.js";
import { compileRule, activateRule } from "../src/rules/rules.js";
import { evaluateRule } from "../src/rules/evaluate.js";
import { mapRuleProposals, type RuleValuation } from "../src/rules/planning.js";
import type { PortfolioSnapshot } from "../src/coordinator/plan.js";

const stock = createInstrument({ chainId: 56, tokenAddress: "0x2222222222222222222222222222222222222222", issuerId: "fixture",
  productType: "share", underlyingId: "NVDA", ticker: "NVDA", decimals: 0, quantityModel: "fixed", adapterVersion: "v1",
  sectorTags: ["semi"], classificationVersion: "v1", referenceSource: "fixture", statusSource: "fixture", eligibilityRequirements: ["fixture"] });
const registry = new InstrumentRegistry([stock]);
const cash = amount(100n, { assetId: tokenAssetId(56, "0x1111111111111111111111111111111111111111"), decimals: 0 });
const now = new Date("2026-09-30T08:05:00Z");
const snap: PortfolioSnapshot = { revision: 1n, sourceBlock: 1n, valuationUnit: "fixture", confirmedCash: cash,
  reservedCash: amount(0n, cash), cashValueLower: 100n, nativeGas: amount(1n, { assetId: nativeAssetId(56), decimals: 0 }),
  positions: [{ instrument: stock, raw: amount(100n, stock), reservedRaw: amount(0n, stock), valueLower: 100n,
    valueUpper: 100n, buyEligible: true, sellEligible: true }] };
const value: RuleValuation = { instrumentId: stock.instrumentId, settlementValueLowerNumerator: 1n,
  settlementValueUpperNumerator: 1n, settlementValueDenominator: 1n, tokenValueLowerNumerator: 1n,
  tokenValueUpperNumerator: 1n, tokenValueDenominator: 1n, tokenProceedsNumerator: 1n, tokenProceedsDenominator: 1n };
function basket(id: string) {
  const ready = compileRule({ kind: "basket", id, portfolioId: "one", version: 1, expiresAt: null,
    schedule: { zone: "Africa/Lagos", frequency: "daily", weekday: null, localTime: "09:00", windowMinutes: 30 },
    contribution: { ...cash, units: "10" }, targets: [{ instrumentId: stock.instrumentId, weightBps: 10000 }] }, registry);
  const rule = activateRule(ready, ready.hash, now);
  return { rule, evaluation: evaluateRule(rule, { now, seenOccurrenceIds: new Set() }) };
}

test("P6 uncertain allocation freezes suppress only buys from their named rule", () => {
  const rule = compileRule({ kind: "earnings", id: "event", portfolioId: "one", version: 1, expiresAt: null,
    underlyingId: "NVDA", action: "freeze-buy", scope: "allocation", allocationId: "scheduled", reductionBps: 0 }, registry);
  const active = activateRule(rule, rule.hash, now);
  const event = { rule: active, evaluation: evaluateRule(active, { now, seenOccurrenceIds: new Set() }) };
  const result = mapRuleProposals([basket("scheduled"), basket("tactical"), event], snap, [value], []);
  assert.equal(result.proposals.length, 1);
  assert.deepEqual(result.suppressed.map(x => x.ruleId), ["scheduled"]);
  assert.throws(() => mapRuleProposals([basket("tactical")], snap, [], []), { code: "MISSING_RULE_VALUATION" });
});
