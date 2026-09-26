import assert from "node:assert/strict";
import test from "node:test";
import { amount, tokenAssetId, nativeAssetId } from "../src/domain/amount.js";
import { createInstrument } from "../src/domain/instrument.js";
import { adaptTimestampedReference, collectMarketEvidence } from "../src/market-gate/adapters.js";
import { evaluateMarketGate } from "../src/market-gate/gate.js";
import { regularSessionOpen } from "../src/market-gate/session.js";
import type { GateRequest, MarketEvidence, SessionEvidence } from "../src/market-gate/evidence.js";

const wallet = "0x1111111111111111111111111111111111111111";
const cashToken = "0x2222222222222222222222222222222222222222";
const equityToken = "0x3333333333333333333333333333333333333333";
const router = "0x4444444444444444444444444444444444444444";
const unit = 10n ** 18n;
const cashDenom = { assetId: tokenAssetId(56, cashToken), decimals: 18 };
const instrument = createInstrument({ chainId: 56, tokenAddress: equityToken, issuerId: "issuer", productType: "stock",
  underlyingId: "company", ticker: "COMP", decimals: 18, quantityModel: "share-ratio",
  adapterVersion: "v1", sectorTags: ["sector"], classificationVersion: "v1", statusSource: "issuer-status",
  referenceSource: "exchange-price", eligibilityRequirements: ["owner-verified", "transfer-verified"] });
const now = "2026-09-28T14:00:00.000Z";

function calldata(recipient = wallet, input = 5n * unit, minimum = 24n * unit / 1000n,
  tokenIn = cashToken, tokenOut = equityToken): string {
  const word = (value: bigint): string => value.toString(16).padStart(64, "0");
  const addr = (value: string): string => value.slice(2).toLowerCase().padStart(64, "0");
  return `0x414bf389${addr(tokenIn)}${addr(tokenOut)}${word(10000n)}${addr(recipient)}${word(BigInt(Date.parse("2026-09-28T14:05:00.000Z") / 1000))}${word(input)}${word(minimum)}${word(0n)}`;
}

function fixture(): GateRequest {
  const evidence: MarketEvidence = {
    eligibility: { source: "issuer", observedAt: "2026-09-28T13:59:00Z", expiresAt: "2026-09-28T14:10:00Z",
      instrumentId: instrument.instrumentId, wallet, venueId: "v3", allowedSides: ["buy"],
      verifiedRequirements: ["owner-verified", "transfer-verified"], transferPermitted: true },
    quantity: { source: "chain-and-issuer", observedAt: "2026-09-28T13:59:00Z", expiresAt: "2026-09-28T14:10:00Z",
      instrumentId: instrument.instrumentId, quantityModel: "share-ratio", adapterVersion: "v1",
      mappingRevision: "map-1", sourceBlock: 101n, shareUnitsNumerator: 1n, shareUnitsDenominator: 1n },
    reference: { source: "exchange-price", underlyingId: "company", sourceAt: "2026-09-28T13:59:30Z",
      receivedAt: "2026-09-28T13:59:40Z", pricePerShare: 200n * unit },
    settlement: { source: "settlement-oracle", observedAt: "2026-09-28T13:59:00Z", expiresAt: "2026-09-28T14:10:00Z",
      valuationUnit: "USD-18", assetId: cashDenom.assetId, lowerValueNumerator: 1n,
      upperValueNumerator: 1n, denominator: 1n },
    portfolioValuations: [],
    session: { source: "exchange-calendar", observedAt: "2026-09-28T13:59:00Z", expiresAt: "2026-09-28T21:00:00Z",
      exchangeZone: "America/New_York", localDate: "2026-09-28", openLocal: "09:30",
      closeLocal: "16:00", status: "regular" },
    tokenStatus: { source: "issuer-status", observedAt: "2026-09-28T13:59:00Z", expiresAt: "2026-09-28T14:10:00Z",
      instrumentId: instrument.instrumentId, state: "open" },
    audit: { source: "token-audit", observedAt: "2026-09-28T13:59:00Z", expiresAt: "2026-09-28T14:10:00Z",
      instrumentId: instrument.instrumentId, state: "clear" },
    event: { source: "issuer-ir", observedAt: "2026-09-28T13:59:00Z", expiresAt: "2026-09-28T14:10:00Z",
      underlyingId: "company", issuerSourceUrl: "https://issuer.example/ir", revision: "1",
      confirmation: "none-confirmed", eventAt: null, blackoutStart: null, blackoutEnd: null },
    quote: { venueId: "v3", chainId: 56, sender: wallet, recipient: wallet, router, spender: router,
      tokenIn: cashToken, tokenOut: equityToken, inputRaw: 5n * unit, expectedOutputRaw: 25n * unit / 1000n,
      minimumOutputRaw: 24n * unit / 1000n, additionalFeeSettlement: 0n, networkFeeSettlement: unit / 10000n,
      nativeFeeRaw: unit / 10000n,
      priceImpactBps: 20, spreadBps: 20, calldata: calldata(), value: 0n,
      quotedAt: "2026-09-28T13:59:45Z", expiresAt: "2026-09-28T14:04:00Z",
      onchainDeadline: "2026-09-28T14:05:00.000Z" },
    simulation: { chainId: 56, sender: wallet, recipient: wallet, router, spender: router,
      tokenIn: cashToken, allowanceRaw: 5n * unit, calldata: calldata(), value: 0n,
      inputRaw: 5n * unit, outputRaw: 25n * unit / 1000n, sourceBlock: 102n, source: "wallet-preview",
      simulatedAt: "2026-09-28T13:59:50Z", success: true }
  };
  return { now, wallet, instrument, expectedMappingRevision: "map-1", evidence,
    snapshot: { revision: 1n, sourceBlock: 100n, valuationUnit: "USD-18", confirmedCash: amount(100n * unit, cashDenom),
      reservedCash: amount(0n, cashDenom), cashValueLower: 100n * unit,
      nativeGas: amount(unit, { assetId: nativeAssetId(56), decimals: 18 }),
      positions: [{ instrument, raw: amount(0n, instrument), reservedRaw: amount(0n, instrument),
        valueLower: 0n, valueUpper: 0n, buyEligible: true, sellEligible: false }] },
    coordinatorPolicy: { minimumCash: amount(0n, cashDenom), feeAllowance: amount(0n, cashDenom),
      requiredNativeGas: amount(0n, { assetId: nativeAssetId(56), decimals: 18 }),
      companyCapsBps: {}, sectorCapsBps: {}, issuerCapsBps: {} },
    proposal: { id: "buy-1", instrumentId: instrument.instrumentId, side: "buy", priority: 1,
      nominalValue: 5n * unit, spend: amount(5n * unit, cashDenom),
      acquiredValueLower: 0n, acquiredValueUpper: 0n },
    marketPolicy: { maxReferenceAgeMs: 120_000, maxStatusAgeMs: 600_000, maxQuoteAgeMs: 120_000,
      maxSimulationAgeMs: 120_000, maxBlockLag: 10n, maxPriceDeviationBps: 100,
      maxPriceImpactBps: 100, maxSpreadBps: 100, maxPositiveFillBufferBps: 100,
      maxNetworkFeeSettlement: unit / 1000n, maxAdditionalFeeSettlement: 0n,
      maxSlippageBps: 500, maxQuoteLifetimeMs: 600_000,
      exchangeZone: "America/New_York", regularOpenLocal: "09:30", regularCloseLocal: "16:00",
      approvedV3FeeTiers: [10000],
      approvedVenues: ["v3"], approvedRouters: [router] } };
}

function withEvidence(change: Partial<MarketEvidence>): GateRequest {
  const base = fixture(); return { ...base, evidence: { ...base.evidence, ...change } };
}
function reason(input: GateRequest): string {
  const result = evaluateMarketGate(input);
  return result.allowed ? "ALLOWED" : result.reason;
}

test("P5 accepts one exact-size route and binds evidence to a hash", () => {
  const result = evaluateMarketGate(fixture());
  assert.equal(result.allowed, true);
  if (result.allowed) {
    assert.match(result.evidenceHash, /^[0-9a-f]{64}$/);
    assert.equal(result.adjustedProposal.side, "buy");
    if (result.adjustedProposal.side === "buy") {
      assert.equal(result.adjustedProposal.acquiredValueLower, 48n * unit / 10n);
      assert.equal(result.adjustedProposal.acquiredValueUpper, 505n * unit / 100n);
    }
  }
});

test("P5 source timestamp is distinct from receipt and missing input blocks", () => {
  assert.equal(adaptTimestampedReference({ pricePerShare: "200" }, now, "exchange-price", "company"), null);
  assert.equal(reason(withEvidence({ reference: null })), "MISSING_EVIDENCE");
  assert.equal(reason(withEvidence({ reference: { ...fixture().evidence.reference!, sourceAt: "2026-09-28T13:00:00Z" } })), "REFERENCE_UNAVAILABLE");
  assert.equal(reason(withEvidence({ settlement: { ...fixture().evidence.settlement!, valuationUnit: "USD" } })), "REFERENCE_UNAVAILABLE");
});

test("P5 exchange timezone handles daylight saving and supplied holiday record", () => {
  const session = fixture().evidence.session!;
  const dated = (localDate: string, status: SessionEvidence["status"]): SessionEvidence => ({ ...session, localDate, status });
  assert.equal(regularSessionOpen(new Date("2026-03-09T13:30:00Z"), dated("2026-03-09", "regular")), true);
  assert.equal(regularSessionOpen(new Date("2026-11-02T14:30:00Z"), dated("2026-11-02", "regular")), true);
  assert.equal(regularSessionOpen(new Date("2026-11-02T13:30:00Z"), dated("2026-11-02", "regular")), false);
  assert.equal(regularSessionOpen(new Date("2026-07-03T14:30:00Z"), dated("2026-07-03", "holiday")), false);
  assert.equal(reason(withEvidence({ session: { ...session, status: "holiday" } })), "SESSION_CLOSED");
});

test("P5 changed mapping, uncertain event, and halt block plans", () => {
  assert.equal(reason(withEvidence({ quantity: { ...fixture().evidence.quantity!, mappingRevision: "map-2" } })), "QUANTITY_CHANGED");
  assert.equal(reason(withEvidence({ event: { ...fixture().evidence.event!, confirmation: "uncertain" } })), "EVENT_RESTRICTED");
  assert.equal(reason(withEvidence({ tokenStatus: { ...fixture().evidence.tokenStatus!, state: "halted" } })), "TOKEN_HALTED");
  assert.equal(reason(withEvidence({ audit: { ...fixture().evidence.audit!, state: "unsupported" } })), "AUDIT_UNSUPPORTED");
  const f = fixture();
  assert.equal(reason({ ...f, expectedMappingRevision: "map-2" }), "QUANTITY_CHANGED");
  assert.equal(reason(withEvidence({ eligibility: { ...f.evidence.eligibility!, transferPermitted: false } })), "ELIGIBILITY_BLOCKED");
  assert.equal(reason(withEvidence({ event: { ...f.evidence.event!, confirmation: "confirmed",
    eventAt: "2026-09-28T15:00:00Z", blackoutStart: "2026-09-28T13:00:00Z",
    blackoutEnd: "2026-09-28T16:00:00Z" } })), "EVENT_RESTRICTED");
});

test("P5 decoded route rejects recipient and spender substitution", () => {
  const q = fixture().evidence.quote!;
  assert.equal(reason(withEvidence({ quote: { ...q, recipient: router } })), "ROUTE_UNSUPPORTED");
  assert.equal(reason(withEvidence({ quote: { ...q, spender: wallet } })), "ROUTE_UNSUPPORTED");
  assert.equal(reason(withEvidence({ quote: { ...q, calldata: calldata(router) } })), "QUOTE_MISMATCH");
  assert.equal(reason(withEvidence({ quote: { ...q, inputRaw: 6n * unit } })), "QUOTE_MISMATCH");
});

test("P5 quote cost, exact simulation, and portfolio caps block", () => {
  const f = fixture();
  assert.equal(reason(withEvidence({ quote: { ...f.evidence.quote!, priceImpactBps: 150 } })), "QUOTE_COST");
  assert.equal(reason(withEvidence({ simulation: { ...f.evidence.simulation!, allowanceRaw: 0n } })), "SIMULATION_MISMATCH");
  assert.equal(reason(withEvidence({ quote: { ...f.evidence.quote!, nativeFeeRaw: 2n * unit } })), "QUOTE_COST");
  assert.equal(reason(withEvidence({ quote: { ...f.evidence.quote!, onchainDeadline: "2026-09-28T14:06:00Z" } })), "QUOTE_MISMATCH");
  assert.equal(reason({ ...f, coordinatorPolicy: { ...f.coordinatorPolicy, companyCapsBps: { company: 100 } } }), "PORTFOLIO_LIMIT");
});

test("P5 sell quote uses exact raw inventory and minimum settlement proceeds", () => {
  const f = fixture();
  const raw = 25n * unit / 1000n;
  const min = 49n * unit / 10n;
  const data = calldata(wallet, raw, min, equityToken, cashToken);
  const sell: GateRequest = { ...f,
    proposal: { id: "sell-1", instrumentId: instrument.instrumentId, side: "sell", priority: 1,
      nominalValue: 5n * unit, raw: amount(raw, instrument), proceeds: amount(min, cashDenom),
      proceedsValueLower: min, mandatory: true },
    snapshot: { ...f.snapshot, positions: [{ ...f.snapshot.positions[0]!, raw: amount(raw, instrument),
      valueLower: 5n * unit, valueUpper: 5n * unit, buyEligible: false, sellEligible: true }] },
    evidence: { ...f.evidence,
      portfolioValuations: [{ source: "exchange-price", observedAt: "2026-09-28T13:59:30Z",
        expiresAt: "2026-09-28T14:05:00Z", instrumentId: instrument.instrumentId,
        sourceBlock: 101n, mappingRevision: "map-1", valueLower: 5n * unit, valueUpper: 5n * unit }],
      eligibility: { ...f.evidence.eligibility!, allowedSides: ["sell"] },
      quote: { ...f.evidence.quote!, tokenIn: equityToken, tokenOut: cashToken, inputRaw: raw,
        expectedOutputRaw: 5n * unit, minimumOutputRaw: min, calldata: data },
      simulation: { ...f.evidence.simulation!, tokenIn: equityToken, inputRaw: raw,
        allowanceRaw: raw, outputRaw: 5n * unit, calldata: data } } };
  const result = evaluateMarketGate(sell);
  assert.equal(result.allowed, true);
  if (result.allowed && result.adjustedProposal.side === "sell") {
    assert.equal(result.adjustedProposal.proceeds.units, min);
    assert.equal(result.adjustedProposal.proceedsValueLower, min);
  }
  if (sell.proposal.side === "sell")
    assert.equal(reason({ ...sell, proposal: { ...sell.proposal, raw: amount(raw + 1n, instrument) } }), "QUOTE_MISMATCH");
  const depegged = { ...sell, marketPolicy: { ...sell.marketPolicy, maxPriceDeviationBps: 3000 },
    snapshot: { ...sell.snapshot, cashValueLower: 80n * unit },
    evidence: { ...sell.evidence, settlement: { ...sell.evidence.settlement!, lowerValueNumerator: 8n,
      upperValueNumerator: 11n, denominator: 10n } } };
  const depeggedResult = evaluateMarketGate(depegged);
  assert.equal(depeggedResult.allowed, true);
  if (depeggedResult.allowed && depeggedResult.adjustedProposal.side === "sell")
    assert.equal(depeggedResult.adjustedProposal.proceedsValueLower, min * 8n / 10n);
  assert.equal(reason({ ...sell, evidence: { ...sell.evidence, portfolioValuations: [] } }), "REFERENCE_UNAVAILABLE");
});

test("P5 adapter outage becomes missing evidence", async () => {
  const f = fixture();
  const adapters = Object.fromEntries(Object.entries(f.evidence).map(([key, value]) => [key, async () => value])) as unknown as
    Parameters<typeof collectMarketEvidence>[0];
  adapters.reference = async () => { throw new Error("feed unavailable"); };
  const evidence = await collectMarketEvidence(adapters);
  assert.equal(reason({ ...f, evidence }), "MISSING_EVIDENCE");
});
