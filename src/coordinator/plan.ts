import { amount, assertSameDenomination, type Amount } from "../domain/amount.js";
import { allocateBudget } from "../domain/allocation.js";
import { identifier, requireInput } from "../domain/errors.js";
import type { Instrument } from "../domain/instrument.js";

export interface Position {
  readonly instrument: Instrument;
  readonly raw: Amount;
  readonly reservedRaw: Amount;
  readonly valueLower: bigint;
  readonly valueUpper: bigint;
  readonly buyEligible: boolean;
  readonly sellEligible: boolean;
}

export interface PortfolioSnapshot {
  readonly revision: bigint;
  readonly sourceBlock: bigint;
  readonly valuationUnit: string;
  readonly confirmedCash: Amount;
  readonly reservedCash: Amount;
  readonly cashValueLower: bigint;
  readonly nativeGas: Amount;
  readonly positions: readonly Position[];
}

export interface CoordinatorPolicy {
  readonly minimumCash: Amount;
  readonly feeAllowance: Amount;
  readonly requiredNativeGas: Amount;
  readonly companyCapsBps: Readonly<Record<string, number>>;
  readonly sectorCapsBps: Readonly<Record<string, number>>;
  readonly issuerCapsBps: Readonly<Record<string, number>>;
}

interface BaseProposal {
  readonly id: string;
  readonly instrumentId: string;
  readonly priority: number;
  /** Common valuation-unit notional used only to net the same exact instrument. */
  readonly nominalValue: bigint;
}

export interface BuyProposal extends BaseProposal {
  readonly side: "buy";
  readonly spend: Amount;
  readonly acquiredValueLower: bigint;
  readonly acquiredValueUpper: bigint;
}

export interface SellProposal extends BaseProposal {
  readonly side: "sell";
  readonly raw: Amount;
  readonly proceeds: Amount;
  readonly proceedsValueLower: bigint;
  readonly mandatory: boolean;
}

export type Proposal = BuyProposal | SellProposal;

export type DecisionReason = "ACCEPTED" | "NETTED" | "COMPANY_CAP" | "SECTOR_CAP" |
  "ISSUER_CAP" | "CASH_LIMIT" | "INSUFFICIENT_GAS" | "INSUFFICIENT_INVENTORY" |
  "HALTED" | "AWAITING_SELL_CONFIRMATION" | "MANDATORY_REDUCTION_BLOCKED" |
  "EXISTING_BREACH" | "INTERMEDIATE_LIMIT";

export interface Decision {
  readonly proposalId: string;
  readonly instrumentId: string;
  readonly side: "buy" | "sell";
  readonly requestedUnits: bigint;
  readonly acceptedUnits: bigint;
  readonly nettedNominal: bigint;
  readonly contingentUnits: bigint;
  readonly reason: DecisionReason;
}

export interface PlannedLeg {
  readonly proposalId: string;
  readonly instrumentId: string;
  readonly side: "buy" | "sell";
  readonly amount: Amount;
}

export interface CoordinationResult {
  readonly phase: "buy" | "sell" | "blocked";
  readonly decisions: readonly Decision[];
  readonly legs: readonly PlannedLeg[];
  readonly requiresNewSnapshot: boolean;
}

const byId = (a: string, b: string): number => a < b ? -1 : a > b ? 1 : 0;
const ceilDiv = (numerator: bigint, denominator: bigint): bigint => (numerator + denominator - 1n) / denominator;
const floorScale = (value: bigint, part: bigint, whole: bigint): bigint => value * part / whole;
const ceilScale = (value: bigint, part: bigint, whole: bigint): bigint => ceilDiv(value * part, whole);

interface MutablePosition {
  instrument: Instrument;
  raw: bigint;
  reservedRaw: bigint;
  lower: bigint;
  upper: bigint;
  buyEligible: boolean;
  sellEligible: boolean;
}

function validateCaps(caps: Readonly<Record<string, number>>): void {
  for (const [key, bps] of Object.entries(caps)) {
    identifier(key);
    requireInput(Number.isInteger(bps) && bps >= 0 && bps <= 10_000,
      "INVALID_CAP", "Exposure cap must be an integer from 0 to 10,000 bps.");
  }
}

function validate(snapshot: PortfolioSnapshot, policy: CoordinatorPolicy, proposals: readonly Proposal[]): Map<string, MutablePosition> {
  requireInput(snapshot.revision >= 0n && snapshot.sourceBlock >= 0n, "INVALID_SNAPSHOT", "Snapshot requires revision and source block.");
  identifier(snapshot.valuationUnit);
  assertSameDenomination(snapshot.confirmedCash, snapshot.reservedCash);
  assertSameDenomination(snapshot.confirmedCash, policy.minimumCash);
  assertSameDenomination(snapshot.confirmedCash, policy.feeAllowance);
  assertSameDenomination(snapshot.nativeGas, policy.requiredNativeGas);
  requireInput(snapshot.cashValueLower >= 0n, "INVALID_VALUATION", "Cash needs a conservative lower value.");
  validateCaps(policy.companyCapsBps);
  validateCaps(policy.sectorCapsBps);
  validateCaps(policy.issuerCapsBps);
  const positions = new Map<string, MutablePosition>();
  const assets = new Set<string>();
  for (const p of snapshot.positions) {
    const key = p.instrument.instrumentId;
    requireInput(!positions.has(key) && !assets.has(p.instrument.assetId), "DUPLICATE_POSITION", "Each exact asset appears once.");
    positions.set(key, { instrument: p.instrument, raw: p.raw.units, reservedRaw: p.reservedRaw.units,
      lower: p.valueLower, upper: p.valueUpper, buyEligible: p.buyEligible, sellEligible: p.sellEligible });
    assets.add(p.instrument.assetId);
    assertSameDenomination(p.raw, p.reservedRaw);
    requireInput(p.raw.assetId === p.instrument.assetId && p.raw.decimals === p.instrument.decimals,
      "DENOMINATION_MISMATCH", "Position raw quantity must match exact instrument.");
    requireInput(p.reservedRaw.units <= p.raw.units, "INVALID_RESERVATION", "Reserved inventory exceeds raw balance.");
    requireInput(p.valueLower >= 0n && p.valueUpper >= p.valueLower && (p.raw.units > 0n || p.valueUpper === 0n),
      "INVALID_VALUATION", "Position valuation bounds are invalid.");
  }
  const ids = new Set<string>();
  for (const p of proposals) {
    identifier(p.id);
    requireInput(!ids.has(p.id), "DUPLICATE_PROPOSAL", "Proposal IDs must be unique.");
    ids.add(p.id);
    requireInput(positions.has(p.instrumentId), "UNKNOWN_INSTRUMENT", "Proposal must name an exact snapshot instrument.");
    requireInput(Number.isSafeInteger(p.priority) && p.priority >= 0, "INVALID_PRIORITY", "Priority must be nonnegative.");
    requireInput(p.nominalValue > 0n, "INVALID_NOTIONAL", "Proposal notional must be positive.");
    const position = positions.get(p.instrumentId)!;
    if (p.side === "buy") {
      assertSameDenomination(snapshot.confirmedCash, p.spend);
      requireInput(p.spend.units > 0n && p.acquiredValueLower >= 0n && p.acquiredValueUpper >= p.acquiredValueLower,
        "INVALID_PROPOSAL", "Buy requires positive spend and bounded acquired value.");
    } else {
      assertSameDenomination(p.raw, { assetId: position.instrument.assetId, decimals: position.instrument.decimals, units: position.raw });
      assertSameDenomination(snapshot.confirmedCash, p.proceeds);
      requireInput(p.raw.units > 0n && p.proceedsValueLower >= 0n,
        "INVALID_PROPOSAL", "Sell requires positive raw quantity and nonnegative proceeds value.");
    }
  }
  return positions;
}

function groupUpper(positions: Map<string, MutablePosition>, kind: "company" | "sector" | "issuer", key: string): bigint {
  let total = 0n;
  for (const p of positions.values()) {
    if ((kind === "company" && p.instrument.underlyingId === key)
      || (kind === "issuer" && p.instrument.issuerId === key)
      || (kind === "sector" && p.instrument.sectorTags.includes(key))) total += p.upper;
  }
  return total;
}

function totalLower(positions: Map<string, MutablePosition>, cashLower: bigint): bigint {
  return cashLower + [...positions.values()].reduce((sum, p) => sum + p.lower, 0n);
}

function capReason(positions: Map<string, MutablePosition>, total: bigint, policy: CoordinatorPolicy): DecisionReason | null {
  if (total <= 0n) return "EXISTING_BREACH";
  for (const [kind, caps, reason] of [
    ["company", policy.companyCapsBps, "COMPANY_CAP"],
    ["sector", policy.sectorCapsBps, "SECTOR_CAP"],
    ["issuer", policy.issuerCapsBps, "ISSUER_CAP"]
  ] as const) {
    for (const [key, bps] of Object.entries(caps)) {
      if (groupUpper(positions, kind, key) * 10_000n > total * BigInt(bps)) return reason;
    }
  }
  return null;
}

function breachedCaps(positions: Map<string, MutablePosition>, total: bigint, policy: CoordinatorPolicy): Set<string> {
  const breached = new Set<string>();
  for (const [kind, caps] of [
    ["company", policy.companyCapsBps], ["sector", policy.sectorCapsBps], ["issuer", policy.issuerCapsBps]
  ] as const) {
    for (const [key, bps] of Object.entries(caps)) {
      if (total <= 0n || groupUpper(positions, kind, key) * 10_000n > total * BigInt(bps))
        breached.add(`${kind}:${key}`);
    }
  }
  return breached;
}

function capReasonAfterBuy(
  positions: Map<string, MutablePosition>, position: MutablePosition,
  total: bigint, acquiredUpper: bigint, policy: CoordinatorPolicy
): DecisionReason | null {
  if (total <= 0n) return "EXISTING_BREACH";
  for (const [kind, caps, reason] of [
    ["company", policy.companyCapsBps, "COMPANY_CAP"],
    ["sector", policy.sectorCapsBps, "SECTOR_CAP"],
    ["issuer", policy.issuerCapsBps, "ISSUER_CAP"]
  ] as const) {
    for (const [key, bps] of Object.entries(caps)) {
      const touches = (kind === "company" && position.instrument.underlyingId === key)
        || (kind === "issuer" && position.instrument.issuerId === key)
        || (kind === "sector" && position.instrument.sectorTags.includes(key));
      const numerator = groupUpper(positions, kind, key) + (touches ? acquiredUpper : 0n);
      if (numerator * 10_000n > total * BigInt(bps)) return reason;
    }
  }
  return null;
}

interface AdjustedProposal { proposal: Proposal; residualNominal: bigint; nettedNominal: bigint }

function netProposals(proposals: readonly Proposal[], positions: Map<string, MutablePosition>): AdjustedProposal[] {
  const adjusted = proposals.map((proposal) => ({ proposal, residualNominal: proposal.nominalValue, nettedNominal: 0n }));
  const byInstrument = new Map<string, AdjustedProposal[]>();
  for (const item of adjusted) {
    if (item.proposal.side === "sell" && item.proposal.mandatory) continue;
    const position = positions.get(item.proposal.instrumentId)!;
    if (item.proposal.side === "buy" && !position.buyEligible) continue;
    if (item.proposal.side === "sell" && (!position.sellEligible
      || item.proposal.raw.units > position.raw - position.reservedRaw)) continue;
    const group = byInstrument.get(item.proposal.instrumentId) ?? [];
    group.push(item);
    byInstrument.set(item.proposal.instrumentId, group);
  }
  for (const group of byInstrument.values()) {
    const position = positions.get(group[0]!.proposal.instrumentId)!;
    const sellDemand = group.filter((x) => x.proposal.side === "sell")
      .reduce((sum, x) => sum + (x.proposal as SellProposal).raw.units, 0n);
    if (sellDemand > position.raw - position.reservedRaw) continue;
    const buys = group.filter((x) => x.proposal.side === "buy").sort((a, b) => a.proposal.priority - b.proposal.priority || byId(a.proposal.id, b.proposal.id));
    const sells = group.filter((x) => x.proposal.side === "sell").sort((a, b) => a.proposal.priority - b.proposal.priority || byId(a.proposal.id, b.proposal.id));
    for (const buy of buys) for (const sell of sells) {
      const offset = buy.residualNominal < sell.residualNominal ? buy.residualNominal : sell.residualNominal;
      buy.residualNominal -= offset; sell.residualNominal -= offset;
      buy.nettedNominal += offset; sell.nettedNominal += offset;
    }
  }
  return adjusted;
}

function residualUnits(item: AdjustedProposal): bigint {
  const p = item.proposal;
  const original = p.side === "buy" ? p.spend.units : p.raw.units;
  return item.residualNominal === 0n ? 0n : ceilScale(original, item.residualNominal, p.nominalValue);
}

function evaluateBuys(
  items: readonly AdjustedProposal[], positions: Map<string, MutablePosition>,
  snapshot: PortfolioSnapshot, policy: CoordinatorPolicy, cashUnits: bigint, cashLower: bigint
): Decision[] {
  const results: Decision[] = [];
  const buys = items.filter((item) => item.proposal.side === "buy")
    .sort((a, b) => a.proposal.priority - b.proposal.priority || byId(a.proposal.id, b.proposal.id));
  const allocation = allocateBudget({ confirmed: amount(cashUnits, snapshot.confirmedCash),
    reserved: snapshot.reservedCash, minimumReserve: policy.minimumCash,
    feeAllowance: policy.feeAllowance, nativeGas: snapshot.nativeGas,
    requiredNativeGas: policy.requiredNativeGas },
  buys.filter((item) => residualUnits(item) > 0n && positions.get(item.proposal.instrumentId)?.buyEligible)
    .map((item) => ({ id: item.proposal.id, priority: item.proposal.priority,
      requested: amount(residualUnits(item), snapshot.confirmedCash) })));
  const allocated = new Map(allocation.decisions.map((decision) => [decision.id, decision.accepted.units]));
  for (const item of buys) {
    const p = item.proposal as BuyProposal;
    const requested = residualUnits(item);
    const pos = positions.get(p.instrumentId)!;
    let accepted = 0n;
    let reason: DecisionReason = "ACCEPTED";
    if (requested === 0n) reason = "NETTED";
    else if (!pos.buyEligible) reason = "HALTED";
    else if (snapshot.nativeGas.units < policy.requiredNativeGas.units) reason = "INSUFFICIENT_GAS";
    else {
      const currentTotal = totalLower(positions, cashLower);
      const breach = capReason(positions, currentTotal, policy);
      if (breach) reason = "EXISTING_BREACH";
      else {
        const cashBudget = cashUnits - snapshot.reservedCash.units - policy.minimumCash.units - policy.feeAllowance.units;
        const remainingCash = cashBudget > 0n ? cashBudget : 0n;
        const allocationTarget = allocated.get(p.id) ?? 0n;
        let low = 0n, high = allocationTarget < remainingCash ? allocationTarget : remainingCash;
        const viable = (spend: bigint): boolean => {
          const removedCash = ceilScale(cashLower, spend, cashUnits);
          const acquiredLower = floorScale(p.acquiredValueLower, spend, p.spend.units);
          const acquiredUpper = ceilScale(p.acquiredValueUpper, spend, p.spend.units);
          const nextTotal = currentTotal - removedCash + acquiredLower;
          return capReasonAfterBuy(positions, pos, nextTotal, acquiredUpper, policy) === null;
        };
        while (low < high) {
          const mid = (low + high + 1n) / 2n;
          if (viable(mid)) low = mid; else high = mid - 1n;
        }
        accepted = low;
        if (accepted < requested) {
          if (allocationTarget <= accepted) reason = "CASH_LIMIT";
          else {
            const next = accepted + 1n;
            const removedCash = ceilScale(cashLower, next, cashUnits);
            const nextTotal = currentTotal - removedCash + floorScale(p.acquiredValueLower, next, p.spend.units);
            const upper = ceilScale(p.acquiredValueUpper, next, p.spend.units);
            reason = capReasonAfterBuy(positions, pos, nextTotal, upper, policy) ?? "CASH_LIMIT";
          }
        }
        if (accepted > 0n) {
          const removedCash = ceilScale(cashLower, accepted, cashUnits);
          pos.lower += floorScale(p.acquiredValueLower, accepted, p.spend.units);
          pos.upper += ceilScale(p.acquiredValueUpper, accepted, p.spend.units);
          cashUnits -= accepted;
          cashLower -= removedCash;
        }
      }
    }
    results.push({ proposalId: p.id, instrumentId: p.instrumentId, side: "buy", requestedUnits: p.spend.units,
      acceptedUnits: accepted, nettedNominal: item.nettedNominal, contingentUnits: 0n, reason });
  }
  return results;
}

/** Pure conservative planner. It never quotes, authorizes, reserves or executes. */
export function coordinatePortfolio(
  snapshot: PortfolioSnapshot, policy: CoordinatorPolicy, proposals: readonly Proposal[]
): CoordinationResult {
  const positions = validate(snapshot, policy, proposals);
  const adjusted = netProposals(proposals, positions);
  const decisions: Decision[] = [];
  const sellItems = adjusted.filter((item) => item.proposal.side === "sell" && item.residualNominal > 0n)
    .sort((a, b) => Number((b.proposal as SellProposal).mandatory) - Number((a.proposal as SellProposal).mandatory)
      || a.proposal.priority - b.proposal.priority || byId(a.proposal.id, b.proposal.id));
  let projectedCash = snapshot.confirmedCash.units;
  let projectedCashLower = snapshot.cashValueLower;
  let mandatoryBlocked = false;
  for (const item of sellItems) {
    const p = item.proposal as SellProposal;
    const pos = positions.get(p.instrumentId)!;
    const requested = residualUnits(item);
    const available = pos.raw - pos.reservedRaw;
    let accepted = 0n;
    let reason: DecisionReason = "ACCEPTED";
    if (!pos.sellEligible) reason = "HALTED";
    else if (requested > available) reason = "INSUFFICIENT_INVENTORY";
    else {
      const nextRaw = pos.raw - requested;
      const nextPos = { ...pos, raw: nextRaw,
        lower: floorScale(pos.lower, nextRaw, pos.raw), upper: ceilScale(pos.upper, nextRaw, pos.raw) };
      const candidate = new Map(positions);
      candidate.set(p.instrumentId, nextPos);
      const nextCashLower = projectedCashLower + floorScale(p.proceedsValueLower, requested, p.raw.units);
      const before = breachedCaps(positions, totalLower(positions, projectedCashLower), policy);
      const after = breachedCaps(candidate, totalLower(candidate, nextCashLower), policy);
      if ([...after].some((key) => !before.has(key))) reason = "INTERMEDIATE_LIMIT";
      else {
        accepted = requested;
        positions.set(p.instrumentId, nextPos);
        projectedCash += floorScale(p.proceeds.units, accepted, p.raw.units);
        projectedCashLower = nextCashLower;
      }
    }
    if (p.mandatory && accepted === 0n) mandatoryBlocked = true;
    decisions.push({ proposalId: p.id, instrumentId: p.instrumentId, side: "sell", requestedUnits: p.raw.units,
      acceptedUnits: accepted, nettedNominal: item.nettedNominal, contingentUnits: 0n, reason });
  }
  for (const item of adjusted.filter((x) => x.proposal.side === "sell" && x.residualNominal === 0n)) {
    decisions.push({ proposalId: item.proposal.id, instrumentId: item.proposal.instrumentId, side: "sell",
      requestedUnits: (item.proposal as SellProposal).raw.units, acceptedUnits: 0n,
      nettedNominal: item.nettedNominal, contingentUnits: 0n, reason: "NETTED" });
  }
  const activeSells = decisions.filter((d) => d.side === "sell" && d.acceptedUnits > 0n);
  if (activeSells.length > 0 || mandatoryBlocked) {
    const projected = mandatoryBlocked ? [] : evaluateBuys(adjusted, positions, snapshot, policy, projectedCash, projectedCashLower);
    for (const item of adjusted.filter((x) => x.proposal.side === "buy")) {
      const p = item.proposal as BuyProposal;
      const preview = projected.find((d) => d.proposalId === p.id);
      decisions.push({ proposalId: p.id, instrumentId: p.instrumentId, side: "buy", requestedUnits: p.spend.units,
        acceptedUnits: 0n, nettedNominal: item.nettedNominal, contingentUnits: preview?.acceptedUnits ?? 0n,
        reason: mandatoryBlocked ? "MANDATORY_REDUCTION_BLOCKED"
          : preview?.acceptedUnits === 0n ? (preview?.reason ?? "AWAITING_SELL_CONFIRMATION") : "AWAITING_SELL_CONFIRMATION" });
    }
    return Object.freeze({ phase: activeSells.length ? "sell" : "blocked", decisions: Object.freeze(decisions),
      legs: Object.freeze(activeSells.map((d) => Object.freeze({ proposalId: d.proposalId, instrumentId: d.instrumentId,
        side: "sell" as const, amount: amount(d.acceptedUnits, (proposals.find((p) => p.id === d.proposalId) as SellProposal).raw) }))),
      requiresNewSnapshot: activeSells.length > 0 });
  }
  const buyDecisions = evaluateBuys(adjusted, positions, snapshot, policy, snapshot.confirmedCash.units, snapshot.cashValueLower);
  decisions.push(...buyDecisions);
  const activeBuys = buyDecisions.filter((d) => d.acceptedUnits > 0n);
  return Object.freeze({ phase: activeBuys.length ? "buy" : "blocked", decisions: Object.freeze(decisions),
    legs: Object.freeze(activeBuys.map((d) => Object.freeze({ proposalId: d.proposalId, instrumentId: d.instrumentId,
      side: "buy" as const, amount: amount(d.acceptedUnits, snapshot.confirmedCash) }))),
    requiresNewSnapshot: false });
}
