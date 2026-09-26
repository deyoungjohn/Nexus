import { createHash } from "node:crypto";
import { amount, assertSameDenomination } from "../domain/amount.js";
import { coordinatePortfolio, type Proposal } from "../coordinator/plan.js";
import { regularSessionOpen } from "./session.js";
import { decodeV3ExactInputSingle, routeMatchesCalldata } from "./route.js";
import type { GateRequest, TimedEvidence } from "./evidence.js";

export type GateReason = "MISSING_EVIDENCE" | "INVALID_CLOCK" | "STALE_EVIDENCE" |
  "INSTRUMENT_MISMATCH" | "ELIGIBILITY_BLOCKED" | "QUANTITY_CHANGED" |
  "REFERENCE_UNAVAILABLE" | "SESSION_CLOSED" | "TOKEN_HALTED" |
  "AUDIT_UNSUPPORTED" | "EVENT_RESTRICTED" | "ROUTE_UNSUPPORTED" | "QUOTE_MISMATCH" |
  "QUOTE_COST" | "PRICE_DEVIATION" | "SIMULATION_MISMATCH" |
  "PORTFOLIO_LIMIT";

export type GateResult = { readonly allowed: false; readonly reason: GateReason } | {
  readonly allowed: true;
  readonly evidenceHash: string;
  readonly quoteExpiresAt: string;
  readonly adjustedProposal: Proposal;
  readonly mappingRevision: string;
};

const deny = (reason: GateReason): GateResult => ({ allowed: false, reason });
const at = (value: string): number => typeof value === "string"
  && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/.test(value)
  ? Date.parse(value) : NaN;
const address = (value: string): boolean => typeof value === "string" && /^0x[0-9a-fA-F]{40}$/.test(value);
const same = (left: string, right: string): boolean => left.toLowerCase() === right.toLowerCase();
const bps = (value: number): boolean => Number.isInteger(value) && value >= 0 && value <= 10_000;
const canonical = (value: unknown): unknown => {
  if (typeof value === "bigint") return value.toString();
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === "object") return Object.fromEntries(Object.entries(value)
    .sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0).map(([key, item]) => [key, canonical(item)]));
  return value;
};

function timely(value: TimedEvidence, now: number, maxAge: number): boolean {
  const observed = at(value.observedAt), expiry = at(value.expiresAt);
  return typeof value.source === "string" && value.source.length > 0
    && Number.isFinite(observed) && Number.isFinite(expiry) && observed <= now
    && now < expiry && expiry > observed && now - observed <= maxAge;
}

const ceil = (num: bigint, den: bigint): bigint => (num + den - 1n) / den;

/** Pure pre-approval gate. P7 must recheck every field and compare evidenceHash before submission. */
export function evaluateMarketGate(input: GateRequest): GateResult {
  try { return evaluateChecked(input); } catch { return deny("MISSING_EVIDENCE"); }
}

function evaluateChecked(input: GateRequest): GateResult {
  const { now: nowText, wallet, instrument, snapshot, proposal, marketPolicy: p, evidence: e } = input;
  const now = at(nowText);
  if (!Number.isFinite(now) || !address(wallet)) return deny("INVALID_CLOCK");
  if (proposal.instrumentId !== instrument.instrumentId || snapshot.positions.filter((x) => x.instrument.instrumentId === instrument.instrumentId).length !== 1)
    return deny("INSTRUMENT_MISMATCH");
  const position = snapshot.positions.find((x) => x.instrument.instrumentId === instrument.instrumentId)!;
  if (JSON.stringify(canonical(position.instrument)) !== JSON.stringify(canonical(instrument))) return deny("INSTRUMENT_MISMATCH");
  if (!e.eligibility || !e.quantity || !e.reference || !e.settlement || !e.portfolioValuations
    || !e.session || !e.tokenStatus || !e.audit || !e.event || !e.quote || !e.simulation)
    return deny("MISSING_EVIDENCE");
  const { eligibility, quantity, reference, settlement, portfolioValuations,
    session, tokenStatus, audit, event, quote, simulation } = e;
  if (![p.maxReferenceAgeMs, p.maxStatusAgeMs, p.maxQuoteAgeMs, p.maxSimulationAgeMs, p.maxQuoteLifetimeMs].every((n) => Number.isSafeInteger(n) && n > 0)
    || p.maxBlockLag < 0n || p.maxNetworkFeeSettlement < 0n || p.maxAdditionalFeeSettlement < 0n
    || ![p.maxPriceDeviationBps, p.maxPriceImpactBps, p.maxSpreadBps, p.maxPositiveFillBufferBps, p.maxSlippageBps].every(bps))
    return deny("INVALID_CLOCK");
  if (![eligibility, quantity, settlement, session, tokenStatus, audit, event].every((item) => timely(item, now, p.maxStatusAgeMs)))
    return deny("STALE_EVIDENCE");
  if (eligibility.instrumentId !== instrument.instrumentId || !same(eligibility.wallet, wallet)
    || !eligibility.transferPermitted || !eligibility.allowedSides.includes(proposal.side)
    || !instrument.eligibilityRequirements.every((r) => eligibility.verifiedRequirements.includes(r)))
    return deny("ELIGIBILITY_BLOCKED");
  if (quantity.instrumentId !== instrument.instrumentId || quantity.quantityModel !== instrument.quantityModel
    || quantity.adapterVersion !== instrument.adapterVersion || quantity.mappingRevision !== input.expectedMappingRevision
    || !quantity.mappingRevision || quantity.shareUnitsNumerator <= 0n || quantity.shareUnitsDenominator <= 0n
    || quantity.sourceBlock < snapshot.sourceBlock || quantity.sourceBlock - snapshot.sourceBlock > p.maxBlockLag)
    return deny("QUANTITY_CHANGED");
  if (reference.underlyingId !== instrument.underlyingId || reference.source !== instrument.referenceSource
    || reference.pricePerShare <= 0n || !Number.isFinite(at(reference.sourceAt))
    || !Number.isFinite(at(reference.receivedAt)) || at(reference.sourceAt) > at(reference.receivedAt)
    || at(reference.receivedAt) > now || at(reference.sourceAt) > now
    || now - at(reference.sourceAt) > p.maxReferenceAgeMs) return deny("REFERENCE_UNAVAILABLE");
  if (settlement.valuationUnit !== snapshot.valuationUnit || settlement.assetId !== snapshot.confirmedCash.assetId
    || settlement.denominator <= 0n || settlement.lowerValueNumerator <= 0n
    || settlement.upperValueNumerator < settlement.lowerValueNumerator
    || snapshot.cashValueLower > snapshot.confirmedCash.units * settlement.lowerValueNumerator / settlement.denominator)
    return deny("REFERENCE_UNAVAILABLE");
  const held = snapshot.positions.filter((item) => item.raw.units > 0n);
  if (portfolioValuations.length !== held.length || new Set(portfolioValuations.map((item) => item.instrumentId)).size !== held.length)
    return deny("REFERENCE_UNAVAILABLE");
  for (const item of held) {
    const valuation = portfolioValuations.find((v) => v.instrumentId === item.instrument.instrumentId);
    if (!valuation || valuation.source !== item.instrument.referenceSource
      || !timely(valuation, now, p.maxReferenceAgeMs) || !valuation.mappingRevision
      || (item.instrument.instrumentId === instrument.instrumentId && valuation.mappingRevision !== quantity.mappingRevision)
      || valuation.sourceBlock < snapshot.sourceBlock || valuation.sourceBlock - snapshot.sourceBlock > p.maxBlockLag
      || valuation.valueLower !== item.valueLower || valuation.valueUpper !== item.valueUpper)
      return deny("REFERENCE_UNAVAILABLE");
  }
  if (session.exchangeZone !== p.exchangeZone || session.openLocal !== p.regularOpenLocal
    || session.closeLocal !== p.regularCloseLocal || !regularSessionOpen(new Date(now), session))
    return deny("SESSION_CLOSED");
  if (tokenStatus.instrumentId !== instrument.instrumentId || tokenStatus.source !== instrument.statusSource
    || tokenStatus.state !== "open") return deny("TOKEN_HALTED");
  if (audit.instrumentId !== instrument.instrumentId || audit.state !== "clear") return deny("AUDIT_UNSUPPORTED");
  if (event.underlyingId !== instrument.underlyingId || !/^https:\/\//.test(event.issuerSourceUrl)
    || !event.revision || event.confirmation === "uncertain" || event.confirmation === "withdrawn")
    return deny("EVENT_RESTRICTED");
  if (event.confirmation === "confirmed") {
    const start = at(event.blackoutStart ?? ""), end = at(event.blackoutEnd ?? ""), eventAt = at(event.eventAt ?? "");
    if (!Number.isFinite(start) || !Number.isFinite(end) || !Number.isFinite(eventAt)
      || start > eventAt || eventAt > end || (now >= start && now <= end)) return deny("EVENT_RESTRICTED");
  } else if (event.eventAt !== null || event.blackoutStart !== null || event.blackoutEnd !== null) return deny("EVENT_RESTRICTED");

  const settlementMatch = /^eip155:(\d+)\/erc20:(0x[0-9a-f]{40})$/.exec(snapshot.confirmedCash.assetId);
  const settlementToken = settlementMatch?.[2];
  if (!settlementToken || Number(settlementMatch?.[1]) !== instrument.chainId
    || quote.chainId !== instrument.chainId || !address(quote.sender) || !same(quote.sender, wallet)
    || !same(quote.recipient, wallet) || !same(quote.router, quote.spender)
    || !p.approvedVenues.includes(quote.venueId) || !p.approvedRouters.some((r) => same(r, quote.router))
    || eligibility.venueId !== quote.venueId) return deny("ROUTE_UNSUPPORTED");
  const tokenIn = proposal.side === "buy" ? settlementToken : instrument.tokenAddress;
  const tokenOut = proposal.side === "buy" ? instrument.tokenAddress : settlementToken;
  if (!same(quote.tokenIn, tokenIn) || !same(quote.tokenOut, tokenOut)
    || !routeMatchesCalldata(quote)
    || !p.approvedV3FeeTiers.includes(decodeV3ExactInputSingle(quote.calldata)?.feeTier ?? -1)
    || quote.value !== 0n || quote.additionalFeeSettlement !== 0n
    || quote.inputRaw <= 0n || quote.minimumOutputRaw <= 0n
    || quote.expectedOutputRaw < quote.minimumOutputRaw || quote.additionalFeeSettlement < 0n
    || quote.networkFeeSettlement < 0n || at(quote.quotedAt) > now || !Number.isFinite(at(quote.quotedAt))
    || now - at(quote.quotedAt) > p.maxQuoteAgeMs || at(quote.expiresAt) <= now
    || at(quote.onchainDeadline) <= now || at(quote.expiresAt) > at(quote.onchainDeadline)
    || at(quote.onchainDeadline) - now > p.maxQuoteLifetimeMs) return deny("QUOTE_MISMATCH");
  if (!bps(quote.priceImpactBps) || !bps(quote.spreadBps)
    || quote.priceImpactBps > p.maxPriceImpactBps || quote.spreadBps > p.maxSpreadBps
    || quote.networkFeeSettlement > p.maxNetworkFeeSettlement
    || quote.additionalFeeSettlement > p.maxAdditionalFeeSettlement || quote.nativeFeeRaw < 0n
    || quote.nativeFeeRaw + input.coordinatorPolicy.requiredNativeGas.units > snapshot.nativeGas.units
    || (quote.expectedOutputRaw - quote.minimumOutputRaw) * 10_000n
      > quote.expectedOutputRaw * BigInt(p.maxSlippageBps)) return deny("QUOTE_COST");
  if ((proposal.side === "buy" && (proposal.spend.units !== quote.inputRaw + quote.additionalFeeSettlement
    || proposal.spend.assetId !== snapshot.confirmedCash.assetId))
    || (proposal.side === "sell" && proposal.raw.units !== quote.inputRaw)) return deny("QUOTE_MISMATCH");
  if (quote.minimumOutputRaw <= quote.additionalFeeSettlement && proposal.side === "sell") return deny("QUOTE_COST");

  const shareValue = (raw: bigint): bigint => raw * quantity.shareUnitsNumerator * reference.pricePerShare
    / (quantity.shareUnitsDenominator * 10n ** 18n);
  const referenceExpected = proposal.side === "buy" ? shareValue(quote.expectedOutputRaw) : shareValue(quote.inputRaw);
  const effectiveSettlementRaw = proposal.side === "buy" ? quote.inputRaw + quote.additionalFeeSettlement
    : quote.expectedOutputRaw - quote.additionalFeeSettlement;
  const effectiveSettlement = proposal.side === "buy"
    ? ceil(effectiveSettlementRaw * settlement.upperValueNumerator, settlement.denominator)
    : effectiveSettlementRaw * settlement.lowerValueNumerator / settlement.denominator;
  if (referenceExpected <= 0n || effectiveSettlement <= 0n
    || (referenceExpected > effectiveSettlement ? referenceExpected - effectiveSettlement : effectiveSettlement - referenceExpected)
      * 10_000n > referenceExpected * BigInt(p.maxPriceDeviationBps)) return deny("PRICE_DEVIATION");

  if (!simulation.source || simulation.chainId !== quote.chainId || !same(simulation.sender, quote.sender)
    || !same(simulation.recipient, quote.recipient) || !same(simulation.router, quote.router)
    || !same(simulation.spender, quote.spender) || !same(simulation.tokenIn, quote.tokenIn)
    || simulation.calldata.toLowerCase() !== quote.calldata.toLowerCase() || simulation.value !== quote.value
    || simulation.inputRaw !== quote.inputRaw || simulation.allowanceRaw < quote.inputRaw
    || simulation.outputRaw < quote.minimumOutputRaw || !simulation.success
    || simulation.sourceBlock < snapshot.sourceBlock || simulation.sourceBlock < quantity.sourceBlock
    || simulation.sourceBlock - snapshot.sourceBlock > p.maxBlockLag
    || !Number.isFinite(at(simulation.simulatedAt)) || at(simulation.simulatedAt) > now
    || at(simulation.simulatedAt) < at(quote.quotedAt)
    || now - at(simulation.simulatedAt) > p.maxSimulationAgeMs) return deny("SIMULATION_MISMATCH");

  const adjusted: Proposal = proposal.side === "buy" ? {
    ...proposal, spend: amount(quote.inputRaw + quote.additionalFeeSettlement, snapshot.confirmedCash),
    acquiredValueLower: shareValue(quote.minimumOutputRaw),
    acquiredValueUpper: ceil(shareValue(quote.expectedOutputRaw) * BigInt(10_000 + p.maxPositiveFillBufferBps), 10_000n)
  } : { ...proposal, proceeds: amount(quote.minimumOutputRaw - quote.additionalFeeSettlement, snapshot.confirmedCash),
    proceedsValueLower: (quote.minimumOutputRaw - quote.additionalFeeSettlement)
      * settlement.lowerValueNumerator / settlement.denominator };
  try {
    if (proposal.side === "buy" && adjusted.side === "buy") assertSameDenomination(proposal.spend, adjusted.spend);
    else if (proposal.side === "sell" && adjusted.side === "sell") assertSameDenomination(proposal.proceeds, adjusted.proceeds);
    else return deny("PORTFOLIO_LIMIT");
    const plan = coordinatePortfolio(snapshot, input.coordinatorPolicy, [adjusted]);
    if (plan.legs.length !== 1 || plan.legs[0]?.proposalId !== proposal.id
      || plan.legs[0]?.amount.units !== (adjusted.side === "buy" ? adjusted.spend.units : adjusted.raw.units))
      return deny("PORTFOLIO_LIMIT");
  } catch { return deny("PORTFOLIO_LIMIT"); }
  const evidenceHash = createHash("sha256").update(JSON.stringify(canonical({
    wallet, instrument, snapshotRevision: snapshot.revision, sourceBlock: snapshot.sourceBlock,
    mappingRevision: quantity.mappingRevision, proposal: adjusted, evidence: e, marketPolicy: p
  }))).digest("hex");
  return { allowed: true, evidenceHash, quoteExpiresAt: quote.expiresAt,
    adjustedProposal: adjusted, mappingRevision: quantity.mappingRevision };
}
