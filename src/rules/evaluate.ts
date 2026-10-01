import { amount } from "../domain/amount.js";
import { requireInput } from "../domain/errors.js";
import type { EventEvidence, ReferenceEvidence } from "../market-gate/evidence.js";
import type { CompiledRule } from "./rules.js";
import { scheduleOccurrence } from "./schedule.js";

export type RuleIntent =
  | { readonly kind: "buy-budget"; readonly instrumentId: string; readonly spend: ReturnType<typeof amount> }
  | { readonly kind: "price-order"; readonly instrumentId: string; readonly side: "buy" | "sell";
      readonly quantity: ReturnType<typeof amount> }
  | { readonly kind: "freeze-buy"; readonly underlyingId: string; readonly scope: "company" | "allocation";
      readonly allocationId: string | null }
  | { readonly kind: "reduce"; readonly underlyingId: string; readonly scope: "company" | "allocation";
      readonly allocationId: string | null; readonly reductionBps: number };

export interface RuleEvaluation {
  readonly status: "ready" | "not-due" | "inactive" | "suspended" | "duplicate";
  readonly reason: string;
  readonly occurrenceId: string | null;
  readonly ruleHash: string;
  readonly intents: readonly RuleIntent[];
}

export interface RuleContext {
  readonly now: Date;
  readonly seenOccurrenceIds: ReadonlySet<string>;
  readonly reference?: ReferenceEvidence;
  readonly event?: EventEvidence;
}

const result = (rule: CompiledRule, status: RuleEvaluation["status"], reason: string,
  occurrenceId: string | null = null, intents: readonly RuleIntent[] = []): RuleEvaluation =>
  Object.freeze({ status, reason, occurrenceId, ruleHash: rule.hash, intents: Object.freeze(intents) });

function basketIntents(rule: Extract<CompiledRule, { kind: "basket" }>): readonly RuleIntent[] | null {
  const total = rule.contribution.units;
  const shares = rule.targets.map((target) => ({ instrumentId: target.instrumentId,
    units: total * BigInt(target.weightBps) / 10_000n,
    remainder: total * BigInt(target.weightBps) % 10_000n }));
  let dust = total - shares.reduce((sum, share) => sum + share.units, 0n);
  shares.sort((a, b) => a.remainder > b.remainder ? -1 : a.remainder < b.remainder ? 1
    : a.instrumentId.localeCompare(b.instrumentId));
  for (const share of shares) {
    if (dust > 0n) { share.units += 1n; dust -= 1n; }
  }
  if (shares.some((share) => share.units === 0n)) return null;
  return shares.sort((a, b) => a.instrumentId.localeCompare(b.instrumentId))
    .map((share) => ({ kind: "buy-budget", instrumentId: share.instrumentId,
      spend: amount(share.units, rule.contribution) }));
}

/** Emits proposals/restrictions, never wallet instructions or trade approval. */
export function evaluateRule(rule: CompiledRule, context: RuleContext): RuleEvaluation {
  const now = context.now.getTime();
  requireInput(Number.isFinite(now), "INVALID_CLOCK", "Valid evaluation time required.");
  if (rule.state !== "ACTIVE" || (rule.expiresAt !== null && now >= Date.parse(rule.expiresAt)))
    return result(rule, "inactive", "RULE_INACTIVE");
  if (rule.kind === "basket") {
    const occurrence = scheduleOccurrence(rule.schedule, context.now);
    if (!occurrence) return result(rule, "not-due", "SCHEDULE_NOT_DUE");
    const occurrenceId = `${rule.id}.v${rule.version}.${occurrence.localDate}`;
    if (context.seenOccurrenceIds.has(occurrenceId)) return result(rule, "duplicate", "OCCURRENCE_SEEN", occurrenceId);
    const intents = basketIntents(rule);
    return intents ? result(rule, "ready", "SCHEDULE_DUE", occurrenceId, intents)
      : result(rule, "suspended", "AMOUNT_TOO_SMALL", occurrenceId);
  }
  if (rule.kind === "price") {
    const occurrenceId = `${rule.id}.v${rule.version}.condition`;
    if (context.seenOccurrenceIds.has(occurrenceId)) return result(rule, "duplicate", "OCCURRENCE_SEEN", occurrenceId);
    const reference = context.reference;
    const sourceAt = Date.parse(reference?.sourceAt ?? ""), receivedAt = Date.parse(reference?.receivedAt ?? "");
    if (!reference || reference.source !== rule.referenceSource || reference.underlyingId !== rule.underlyingId
      || !Number.isFinite(sourceAt) || !Number.isFinite(receivedAt)
      || sourceAt > receivedAt || receivedAt > now || now - sourceAt > rule.maxReferenceAgeMs
      || reference.pricePerShare <= 0n) return result(rule, "suspended", "REFERENCE_UNAVAILABLE");
    const crossed = rule.comparator === "at-or-below" ? reference.pricePerShare <= rule.pricePerShareRaw
      : reference.pricePerShare >= rule.pricePerShareRaw;
    return crossed ? result(rule, "ready", "PRICE_TRIGGERED", occurrenceId,
      [{ kind: "price-order", instrumentId: rule.instrumentId, side: rule.side, quantity: rule.quantity }])
      : result(rule, "not-due", "PRICE_NOT_TRIGGERED");
  }
  const event = context.event;
  const observed = Date.parse(event?.observedAt ?? ""), expiry = Date.parse(event?.expiresAt ?? "");
  if (!event || event.underlyingId !== rule.underlyingId || !event.revision
    || !Number.isFinite(observed) || !Number.isFinite(expiry) || observed > now || now >= expiry
    || event.confirmation === "uncertain" || event.confirmation === "withdrawn")
    return result(rule, "suspended", "EVENT_UNCERTAIN");
  if (event.confirmation === "none-confirmed") return event.eventAt === null
    && event.blackoutStart === null && event.blackoutEnd === null
    ? result(rule, "not-due", "EVENT_NOT_CONFIRMED") : result(rule, "suspended", "EVENT_UNCERTAIN");
  const start = Date.parse(event.blackoutStart ?? ""), end = Date.parse(event.blackoutEnd ?? "");
  const eventAt = Date.parse(event.eventAt ?? "");
  if (event.confirmation !== "confirmed" || !Number.isFinite(start) || !Number.isFinite(end)
    || !Number.isFinite(eventAt) || start > eventAt || eventAt > end)
    return result(rule, "suspended", "EVENT_UNCERTAIN");
  if (now < start || now > end) return result(rule, "not-due", "OUTSIDE_EVENT_WINDOW");
  const occurrenceId = `${rule.id}.v${rule.version}.event`;
  if (rule.action === "reduce" && context.seenOccurrenceIds.has(occurrenceId))
    return result(rule, "duplicate", "OCCURRENCE_SEEN", occurrenceId);
  return rule.action === "freeze-buy"
    ? result(rule, "ready", "EVENT_FREEZE", occurrenceId,
      [{ kind: "freeze-buy", underlyingId: rule.underlyingId, scope: rule.scope, allocationId: rule.allocationId }])
    : result(rule, "ready", "EVENT_REDUCE", occurrenceId,
      [{ kind: "reduce", underlyingId: rule.underlyingId, scope: rule.scope,
        allocationId: rule.allocationId, reductionBps: rule.reductionBps }]);
}
