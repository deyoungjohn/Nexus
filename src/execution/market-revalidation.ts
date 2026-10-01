import { requireInput } from "../domain/errors.js";
import type { GateRequest, MarketEvidence } from "../market-gate/evidence.js";
import { evaluateMarketGate } from "../market-gate/gate.js";
import { securityDigest, tokenSecurityFingerprint } from "../security/token-security.js";

const omit = (value: unknown, keys: readonly string[]): unknown => value && typeof value === "object"
  ? Object.fromEntries(Object.entries(value).filter(([key]) => !keys.includes(key))) : value;
const timed = (value: unknown) => omit(value, ["observedAt", "expiresAt"]);

/** The wallet sees the earliest original evidence lease, not just the route deadline. */
export function executionMarketExpiry(request: GateRequest): number {
  const e = request.evidence, p = request.marketPolicy;
  const clocks = [e.eligibility,e.quantity,e.settlement,e.session,e.tokenStatus,e.audit,e.event,e.providerEvent];
  const values = clocks.filter(v => v !== null && v !== undefined).flatMap(v => [
    Date.parse(v.expiresAt), Date.parse(v.observedAt) + p.maxStatusAgeMs]);
  for (const v of e.portfolioValuations ?? []) values.push(Date.parse(v.expiresAt), Date.parse(v.observedAt)+p.maxReferenceAgeMs);
  for (const s of e.tokenSecurity ?? []) {
    for (const c of [s.observation, ...s.providers, s.reviewArtifact])
      if (c) values.push(Date.parse(c.expiresAt), Date.parse(c.observedAt)+p.maxStatusAgeMs);
    if (s.review) values.push(Date.parse(s.review.expiresAt), Date.parse(s.review.observedAt)+86_400_000);
  }
  values.push(Date.parse(e.reference!.sourceAt)+p.maxReferenceAgeMs,
    Date.parse(e.quote!.expiresAt), Date.parse(e.quote!.onchainDeadline),
    Date.parse(e.quote!.quotedAt)+p.maxQuoteAgeMs, Date.parse(e.simulation!.simulatedAt)+p.maxSimulationAgeMs);
  return Math.min(...values);
}

/** Semantic facts only; both complete current and original gates must pass separately. */
function approvalFacts(e: MarketEvidence): unknown {
  const eligibility = e.eligibility && { ...e.eligibility,
    ...(e.eligibility.accessControl ? { accessControl: omit(e.eligibility.accessControl,
      ["accessHash", "transferBlock"]) } : {}) };
  return {
    eligibility: timed(eligibility), quantity: omit(e.quantity, ["observedAt", "expiresAt", "sourceBlock"]),
    reference: omit(e.reference, ["sourceAt", "receivedAt"]), settlement: timed(e.settlement),
    portfolioValuations: e.portfolioValuations?.map(v => omit(v, ["observedAt", "expiresAt", "sourceBlock"])),
    session: timed(e.session), tokenStatus: timed(e.tokenStatus), audit: timed(e.audit),
    event: timed(e.event), providerEvent: timed(e.providerEvent), quote: e.quote,
    simulation: omit(e.simulation, ["sourceBlock", "simulatedAt", "outputRaw"]),
    tokenSecurity: e.tokenSecurity?.map(s => ({ assetId: s.assetId, state: s.state, reasons: s.reasons,
      fingerprint: s.observation ? tokenSecurityFingerprint(s.observation) : null,
      providers: s.providers.map(p => timed(p)), review: s.review,
      reviewArtifact: timed(s.reviewArtifact) })).sort((a, b) => a.assetId.localeCompare(b.assetId))
  };
}

/** Preserve the signed packet only after fresh facts prove it still valid within its original lease. */
export function revalidateExecutionMarket(approved: GateRequest, current: MarketEvidence, now: string): GateRequest {
  const request = { ...approved, now }, fresh = { ...request, evidence: current };
  requireInput(evaluateMarketGate(request).allowed && evaluateMarketGate(fresh).allowed,
    "MARKET_GATE_BLOCKED", "Original and current complete market gates must pass.");
  // Pool movements inside the signed minimum still need today's price/limit checks.
  requireInput(evaluateMarketGate({ ...fresh, evidence: { ...current,
    quote: { ...current.quote!, expectedOutputRaw: current.simulation!.outputRaw } } }).allowed,
  "MARKET_GATE_BLOCKED", "Current simulated fill must also pass price and portfolio bounds.");
  if (approved.instrument.issuerId === "bstocks") {
    for (const e of [approved.evidence, current]) requireInput(
      typeof e.eligibility?.accessControl?.authorizationHash === "string"
      && /^[0-9a-f]{64}$/.test(e.eligibility.accessControl.authorizationHash),
    "ACCESS_REVISION_MISSING", "Current reviewed bStocks authorization revision is required.");
  }
  requireInput(Date.parse(current.reference!.sourceAt) >= Date.parse(approved.evidence.reference!.sourceAt),
    "MARKET_EVIDENCE_CHANGED", "Reference source time cannot move backwards.");
  requireInput(securityDigest(approvalFacts(approved.evidence)) === securityDigest(approvalFacts(current)),
    "MARKET_EVIDENCE_CHANGED", "Current market, review or authorization facts changed.");
  const maximumOutput = approved.evidence.quote!.expectedOutputRaw
    * BigInt(10_000 + approved.marketPolicy.maxPositiveFillBufferBps) / 10_000n;
  requireInput(current.simulation!.outputRaw <= maximumOutput,
    "MARKET_EVIDENCE_CHANGED", "Current simulated output exceeds approved portfolio valuation bounds.");
  return request;
}
