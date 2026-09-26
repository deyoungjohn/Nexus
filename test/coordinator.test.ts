import assert from "node:assert/strict";
import test from "node:test";
import { amount, nativeAssetId, tokenAssetId } from "../src/domain/amount.js";
import { createInstrument, type Instrument } from "../src/domain/instrument.js";
import { coordinatePortfolio, type BuyProposal, type CoordinatorPolicy,
  type PortfolioSnapshot, type Position, type SellProposal } from "../src/coordinator/plan.js";

const settlement = { assetId: tokenAssetId(56, "0x1111111111111111111111111111111111111111"), decimals: 0 };
const gas = { assetId: nativeAssetId(56), decimals: 0 };
const cash = (units: bigint) => amount(units, settlement);

function instrument(address: string, underlying: string, sector: string, issuer = "ondo"): Instrument {
  return createInstrument({ chainId: 56, tokenAddress: address, issuerId: issuer, productType: "share",
    underlyingId: underlying, ticker: underlying, decimals: 0, quantityModel: "fixed", adapterVersion: "v1",
    sectorTags: [sector], classificationVersion: "v1", statusSource: "fixture", referenceSource: "fixture",
    eligibilityRequirements: ["fixture-only"] });
}

const nvda = instrument("0x2222222222222222222222222222222222222222", "NVDA", "semi");
const amd = instrument("0x3333333333333333333333333333333333333333", "AMD", "semi");
const other = instrument("0x4444444444444444444444444444444444444444", "OTHER", "other", "otherissuer");
const wrapper = instrument("0x5555555555555555555555555555555555555555", "NVDA", "semi", "otherissuer");

function position(i: Instrument, raw: bigint, value: bigint, sellEligible = true): Position {
  return { instrument: i, raw: amount(raw, { assetId: i.assetId, decimals: i.decimals }),
    reservedRaw: amount(0n, { assetId: i.assetId, decimals: i.decimals }),
    valueLower: value, valueUpper: value, buyEligible: true, sellEligible };
}

function snapshot(cashUnits: bigint, positions: readonly Position[], revision = 0n): PortfolioSnapshot {
  return { revision, sourceBlock: 100n, valuationUnit: "USD-0", confirmedCash: cash(cashUnits),
    reservedCash: cash(0n), cashValueLower: cashUnits, nativeGas: amount(1n, gas), positions };
}

function policy(company: Readonly<Record<string, number>> = {}, sector: Readonly<Record<string, number>> = {},
  issuer: Readonly<Record<string, number>> = {}): CoordinatorPolicy {
  return { minimumCash: cash(0n), feeAllowance: cash(0n), requiredNativeGas: amount(0n, gas),
    companyCapsBps: company, sectorCapsBps: sector, issuerCapsBps: issuer };
}

function buy(id: string, i: Instrument, spend: bigint, priority = 2): BuyProposal {
  return { id, instrumentId: i.instrumentId, side: "buy", priority, nominalValue: spend,
    spend: cash(spend), acquiredValueLower: spend, acquiredValueUpper: spend };
}

function sell(id: string, i: Instrument, raw: bigint, mandatory = true): SellProposal {
  return { id, instrumentId: i.instrumentId, side: "sell", priority: 0, nominalValue: raw,
    raw: amount(raw, { assetId: i.assetId, decimals: i.decimals }), proceeds: cash(raw),
    proceedsValueLower: raw, mandatory };
}

test("blueprint NVDA/AMD conflict sells first and clips AMD after confirmed revision", () => {
  const rules = policy({ NVDA: 2500 }, { semi: 4000 });
  const current = snapshot(200n, [position(nvda, 280n, 280n), position(amd, 120n, 120n), position(other, 400n, 400n)]);
  const proposals = [buy("schedule-nvda", nvda, 60n), sell("event-reduction", nvda, 30n),
    buy("tactical-amd", amd, 50n, 3)] as const;
  const first = coordinatePortfolio(current, rules, proposals);
  assert.equal(first.phase, "sell");
  assert.deepEqual(first.legs.map((x) => [x.side, x.instrumentId, x.amount.units]), [["sell", nvda.instrumentId, 30n]]);
  assert.equal(first.decisions.find((x) => x.proposalId === "schedule-nvda")?.contingentUnits, 0n);
  assert.equal(first.decisions.find((x) => x.proposalId === "schedule-nvda")?.reason, "COMPANY_CAP");
  assert.equal(first.decisions.find((x) => x.proposalId === "tactical-amd")?.contingentUnits, 30n);
  assert.equal(first.decisions.find((x) => x.proposalId === "tactical-amd")?.acceptedUnits, 0n);
  const reconciled = snapshot(230n, [position(nvda, 250n, 250n), position(amd, 120n, 120n), position(other, 400n, 400n)], 1n);
  const second = coordinatePortfolio(reconciled, rules, [proposals[0], proposals[2]]);
  assert.equal(second.phase, "buy");
  assert.deepEqual(second.legs.map((x) => [x.side, x.instrumentId, x.amount.units]), [["buy", amd.instrumentId, 30n]]);
  assert.equal(second.decisions.find((x) => x.proposalId === "tactical-amd")?.reason, "SECTOR_CAP");
});

test("halted mandatory sale cannot fund or justify the buy", () => {
  const current = snapshot(200n, [position(nvda, 280n, 280n, false), position(amd, 120n, 120n), position(other, 400n, 400n)]);
  const result = coordinatePortfolio(current, policy({ NVDA: 2500 }, { semi: 4000 }),
    [sell("event", nvda, 30n), buy("amd", amd, 50n)]);
  assert.equal(result.phase, "blocked");
  assert.equal(result.legs.length, 0);
  assert.equal(result.decisions.find((x) => x.proposalId === "event")?.reason, "HALTED");
  assert.equal(result.decisions.find((x) => x.proposalId === "amd")?.reason, "MANDATORY_REDUCTION_BLOCKED");
});

test("same exact instrument nets optional opposing proposals; wrappers remain distinct", () => {
  const current = snapshot(100n, [position(nvda, 100n, 100n), position(wrapper, 50n, 50n), position(other, 750n, 750n)]);
  const exact = coordinatePortfolio(current, policy(), [buy("b", nvda, 20n), sell("s", nvda, 10n, false)]);
  assert.deepEqual(exact.legs.map((x) => [x.side, x.amount.units]), [["buy", 10n]]);
  assert.equal(exact.decisions.find((x) => x.proposalId === "s")?.nettedNominal, 10n);
  const different = coordinatePortfolio(current, policy(), [buy("b", nvda, 20n), sell("s", wrapper, 10n, false)]);
  assert.equal(different.phase, "sell");
  assert.equal(different.legs[0]?.instrumentId, wrapper.instrumentId);
});

test("company caps aggregate wrappers and every intermediate buy stays in bounds", () => {
  const grouped = snapshot(200n, [position(nvda, 100n, 100n), position(wrapper, 100n, 100n), position(other, 600n, 600n)]);
  const blocked = coordinatePortfolio(grouped, policy({ NVDA: 2000 }), [buy("more-wrapper", wrapper, 10n)]);
  assert.equal(blocked.decisions[0]?.acceptedUnits, 0n);
  assert.equal(blocked.decisions[0]?.reason, "COMPANY_CAP");
  const current = snapshot(200n, [position(nvda, 260n, 260n), position(amd, 120n, 120n), position(other, 420n, 420n)]);
  const ordered = coordinatePortfolio(current, policy({}, { semi: 4000 }), [buy("first", amd, 30n, 1), buy("second", amd, 30n, 2)]);
  assert.equal(ordered.decisions.find((x) => x.proposalId === "first")?.acceptedUnits, 20n);
  assert.equal(ordered.decisions.find((x) => x.proposalId === "second")?.acceptedUnits, 0n);
});

test("lower total valuation blocks purchases that dilute an unrelated cap", () => {
  const current = snapshot(200n, [position(nvda, 250n, 250n), position(amd, 0n, 0n), position(other, 550n, 550n)]);
  const uncertain: BuyProposal = { ...buy("amd", amd, 50n), acquiredValueLower: 40n, acquiredValueUpper: 50n };
  const result = coordinatePortfolio(current, policy({ NVDA: 2500 }), [uncertain]);
  assert.equal(result.decisions[0]?.acceptedUnits, 0n);
  assert.equal(result.decisions[0]?.reason, "COMPANY_CAP");
});

test("same-priority buys share scarce cash proportionally with stable rounding", () => {
  const current = snapshot(50n, [position(nvda, 0n, 0n), position(amd, 0n, 0n), position(other, 950n, 950n)]);
  const result = coordinatePortfolio(current, policy(), [buy("z-amd", amd, 40n), buy("a-nvda", nvda, 40n)]);
  assert.deepEqual(result.legs.map((x) => [x.proposalId, x.amount.units]), [["a-nvda", 25n], ["z-amd", 25n]]);
});

test("an ineligible or inventory-short sale cannot erase a valid opposing buy", () => {
  const current = snapshot(100n, [position(nvda, 0n, 0n), position(amd, 0n, 0n), position(other, 900n, 900n)]);
  const result = coordinatePortfolio(current, policy(), [buy("valid-buy", nvda, 10n), sell("impossible-sell", nvda, 10n, false)]);
  assert.deepEqual(result.legs.map((x) => [x.side, x.amount.units]), [["buy", 10n]]);
  assert.equal(result.decisions.find((x) => x.proposalId === "impossible-sell")?.reason, "INSUFFICIENT_INVENTORY");
});

test("multiple sells cannot reuse inventory held by another plan", () => {
  const held = { ...position(nvda, 100n, 100n), reservedRaw: amount(60n, { assetId: nvda.assetId, decimals: 0 }) };
  const current = snapshot(100n, [held, position(amd, 0n, 0n), position(other, 800n, 800n)]);
  const result = coordinatePortfolio(current, policy(), [sell("first", nvda, 30n), sell("second", nvda, 30n)]);
  assert.equal(result.decisions.find((x) => x.proposalId === "first")?.acceptedUnits, 30n);
  assert.equal(result.decisions.find((x) => x.proposalId === "second")?.acceptedUnits, 0n);
  assert.equal(result.decisions.find((x) => x.proposalId === "second")?.reason, "INSUFFICIENT_INVENTORY");
});

test("a sale cannot create a new intermediate concentration breach", () => {
  const current = snapshot(100n, [position(nvda, 100n, 100n), position(amd, 0n, 0n), position(other, 800n, 800n)]);
  const lossMaking = { ...sell("nvda-reduction", nvda, 10n), proceedsValueLower: 0n };
  const result = coordinatePortfolio(current, policy({ OTHER: 8000 }), [lossMaking]);
  assert.equal(result.phase, "blocked");
  assert.equal(result.decisions[0]?.reason, "INTERMEDIATE_LIMIT");
});

test("opposing proposals cannot net more sells than available inventory", () => {
  const current = snapshot(100n, [position(nvda, 10n, 10n), position(amd, 0n, 0n), position(other, 890n, 890n)]);
  const result = coordinatePortfolio(current, policy(), [buy("buy-a", nvda, 10n), buy("buy-b", nvda, 10n),
    sell("sell-a", nvda, 10n, false), sell("sell-b", nvda, 10n, false)]);
  assert.equal(result.phase, "sell");
  assert.deepEqual(result.legs.map((x) => x.amount.units), [10n]);
  assert.equal(result.decisions.find((x) => x.proposalId === "sell-b")?.reason, "INSUFFICIENT_INVENTORY");
});

test("issuer caps, cash floor, fees and native gas remain separate constraints", () => {
  const current = snapshot(200n, [position(nvda, 200n, 200n), position(amd, 200n, 200n), position(other, 400n, 400n)]);
  const issuerBlocked = coordinatePortfolio(current, policy({}, {}, { ondo: 4000 }), [buy("amd", amd, 10n)]);
  assert.equal(issuerBlocked.decisions[0]?.reason, "ISSUER_CAP");
  const constrained = { ...policy(), minimumCash: cash(150n), feeAllowance: cash(10n) };
  const funded = coordinatePortfolio(current, constrained, [buy("a", amd, 40n), buy("b", nvda, 40n)]);
  assert.deepEqual(funded.legs.map((x) => x.amount.units), [20n, 20n]);
  const noGas = coordinatePortfolio(current, { ...policy(), requiredNativeGas: amount(2n, gas) }, [buy("a", amd, 10n)]);
  assert.equal(noGas.decisions[0]?.reason, "INSUFFICIENT_GAS");
});
