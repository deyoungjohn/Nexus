import { amount, assertSameDenomination } from "../domain/amount.js";
import { requireInput } from "../domain/errors.js";
import type { PortfolioSnapshot, Proposal } from "../coordinator/plan.js";
import type { RuleEvaluation } from "./evaluate.js";
import type { CompiledRule } from "./rules.js";

/** Trusted server inputs; P5 must independently verify actual execution prices. */
export interface RuleValuation {
  readonly instrumentId: string;
  readonly settlementValueLowerNumerator: bigint;
  readonly settlementValueUpperNumerator: bigint;
  readonly settlementValueDenominator: bigint;
  readonly tokenValueLowerNumerator: bigint;
  readonly tokenValueUpperNumerator: bigint;
  readonly tokenValueDenominator: bigint;
  readonly tokenProceedsNumerator: bigint;
  readonly tokenProceedsDenominator: bigint;
}

export interface RuleAllocation {
  readonly allocationId: string;
  readonly instrumentId: string;
  readonly revision: bigint;
  readonly units: bigint;
}

export interface EvaluatedRule {
  readonly rule: CompiledRule;
  readonly evaluation: RuleEvaluation;
}

export interface RuleProposalSet {
  readonly proposals: readonly Proposal[];
  readonly suppressed: readonly { ruleId: string; instrumentId: string; reason: "EVENT_CONTROL" }[];
}

const ceil = (num: bigint, den: bigint): bigint => (num + den - 1n) / den;

/** Converts canonical rule intents into P4 inputs; never produces a transaction. */
export function mapRuleProposals(items: readonly EvaluatedRule[], snapshot: PortfolioSnapshot,
  valuations: readonly RuleValuation[], allocations: readonly RuleAllocation[]): RuleProposalSet {
  requireInput(new Set(valuations.map(x => x.instrumentId)).size === valuations.length,
    "INVALID_RULE_VALUATION", "Valuation instruments must be unique.");
  for (const value of valuations) {
    requireInput(value.settlementValueLowerNumerator > 0n
      && value.settlementValueUpperNumerator >= value.settlementValueLowerNumerator
      && value.settlementValueDenominator > 0n && value.tokenValueLowerNumerator > 0n
      && value.tokenValueUpperNumerator >= value.tokenValueLowerNumerator
      && value.tokenValueDenominator > 0n && value.tokenProceedsNumerator > 0n
      && value.tokenProceedsDenominator > 0n,
    "INVALID_RULE_VALUATION", "Positive conservative ratios are required.");
  }
  const allocationKeys = new Set<string>(), allocationSums = new Map<string, bigint>();
  for (const item of allocations) {
    const key = `${item.allocationId}/${item.instrumentId}`;
    requireInput(!allocationKeys.has(key) && item.units >= 0n, "INVALID_ALLOCATION", "Allocation tags must be unique and nonnegative.");
    allocationKeys.add(key);
    allocationSums.set(item.instrumentId, (allocationSums.get(item.instrumentId) ?? 0n) + item.units);
  }
  for (const [id, units] of allocationSums) requireInput(snapshot.positions.some(row =>
    row.instrument.instrumentId === id && units <= row.raw.units), "ALLOCATION_OVERLAP", "Allocation ownership exceeds confirmed holdings.");
  const controls = items.filter(({ rule, evaluation }) => rule.kind === "earnings"
    && (evaluation.status === "suspended" || evaluation.status === "ready" || evaluation.status === "duplicate"));
  const proposals: Proposal[] = [];
  const suppressed: RuleProposalSet["suppressed"][number][] = [];
  function position(id: string) {
    const row = snapshot.positions.find(x => x.instrument.instrumentId === id);
    requireInput(row !== undefined, "MISSING_RULE_POSITION", "Rule instrument needs a reconciled snapshot position.");
    return row;
  }
  function value(id: string) {
    const row = valuations.find(x => x.instrumentId === id);
    requireInput(row !== undefined, "MISSING_RULE_VALUATION", "Rule intent needs server-side valuation bounds.");
    return row;
  }
  function buy(rule: CompiledRule, instrumentId: string, spend: ReturnType<typeof amount>) {
    const row = position(instrumentId);
    const blocked = controls.some(({ rule: control }) => control.kind === "earnings"
      && control.underlyingId === row.instrument.underlyingId
      && (control.scope === "company" || control.allocationId === rule.id));
    if (blocked) { suppressed.push({ ruleId: rule.id, instrumentId, reason: "EVENT_CONTROL" }); return; }
    assertSameDenomination(spend, snapshot.confirmedCash);
    const v = value(instrumentId);
    const lower = spend.units * v.settlementValueLowerNumerator / v.settlementValueDenominator;
    const upper = ceil(spend.units * v.settlementValueUpperNumerator, v.settlementValueDenominator);
    requireInput(lower > 0n, "RULE_DUST", "Spend is too small for a valued proposal.");
    proposals.push({ id: `rule-${rule.hash.slice(0,32)}-${proposals.length}`, instrumentId, side: "buy", priority: rule.kind === "basket" ? 2 : 1,
      nominalValue: upper, spend, acquiredValueLower: lower, acquiredValueUpper: upper });
  }
  function sell(rule: CompiledRule, instrumentId: string, units: bigint, mandatory: boolean) {
    if (units === 0n) return;
    const row = position(instrumentId), v = value(instrumentId);
    requireInput(units <= row.raw.units - row.reservedRaw.units, "ALLOCATION_UNAVAILABLE", "Reduction exceeds unreserved holdings.");
    const proceedsUnits = units * v.tokenProceedsNumerator / v.tokenProceedsDenominator;
    const proceedsLower = proceedsUnits * v.settlementValueLowerNumerator / v.settlementValueDenominator;
    requireInput(proceedsUnits > 0n && proceedsLower > 0n, "RULE_DUST", "Sale is too small for a valued proposal.");
    proposals.push({ id: `rule-${rule.hash.slice(0,32)}-${proposals.length}`, instrumentId, side: "sell", priority: mandatory ? 0 : 1,
      nominalValue: ceil(units * v.tokenValueUpperNumerator, v.tokenValueDenominator),
      raw: amount(units, row.raw), proceeds: amount(proceedsUnits, snapshot.confirmedCash),
      proceedsValueLower: proceedsLower, mandatory });
  }
  for (const { rule, evaluation } of items) {
    if (evaluation.status !== "ready") continue;
    for (const intent of evaluation.intents) {
      if (intent.kind === "buy-budget") buy(rule, intent.instrumentId, intent.spend);
      else if (intent.kind === "price-order") {
        if (intent.side === "buy") buy(rule, intent.instrumentId, intent.quantity);
        else {
          assertSameDenomination(intent.quantity, position(intent.instrumentId).raw);
          sell(rule, intent.instrumentId, intent.quantity.units, false);
        }
      } else if (intent.kind === "reduce") {
        const positions = snapshot.positions.filter(x => x.instrument.underlyingId === intent.underlyingId)
          .sort((a, b) => a.instrument.instrumentId.localeCompare(b.instrument.instrumentId));
        requireInput(positions.length > 0, "MISSING_RULE_POSITION", "Reduction needs the underlying's holdings.");
        if (intent.scope === "company") {
          for (const row of positions) sell(rule, row.instrument.instrumentId, ceil(row.raw.units * BigInt(intent.reductionBps), 10000n), true);
        } else {
          const tagged = allocations.filter(x => x.allocationId === intent.allocationId);
          requireInput(tagged.length > 0 && tagged.every(x => x.revision === snapshot.revision
            && x.units >= 0n && positions.some(p => p.instrument.instrumentId === x.instrumentId)),
          "STALE_ALLOCATION", "Allocation reduction requires current, underlying-matched quantities.");
          for (const tag of tagged) sell(rule, tag.instrumentId, ceil(tag.units * BigInt(intent.reductionBps), 10000n), true);
        }
      }
    }
  }
  return { proposals, suppressed };
}
