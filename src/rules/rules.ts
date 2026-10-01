import { createHash } from "node:crypto";
import { amount, serializeAmount, type Amount } from "../domain/amount.js";
import { identifier, requireInput } from "../domain/errors.js";
import type { InstrumentRegistry } from "../domain/instrument.js";
import { validateRuleSchedule, type RuleSchedule } from "./schedule.js";

export type RuleState = "READY_FOR_REVIEW" | "ACTIVE" | "PAUSED";

interface RuleBase {
  readonly id: string;
  readonly portfolioId: string;
  readonly version: number;
  readonly expiresAt: string | null;
  readonly hash: string;
  readonly state: RuleState;
}

export interface BasketRule extends RuleBase {
  readonly kind: "basket";
  readonly schedule: RuleSchedule;
  readonly contribution: Amount;
  readonly targets: readonly { readonly instrumentId: string; readonly weightBps: number }[];
}

export interface PriceRule extends RuleBase {
  readonly kind: "price";
  readonly instrumentId: string;
  readonly underlyingId: string;
  readonly side: "buy" | "sell";
  readonly comparator: "at-or-below" | "at-or-above";
  readonly pricePerShareRaw: bigint;
  readonly quantity: Amount;
  readonly referenceSource: string;
  readonly maxReferenceAgeMs: number;
}

export interface EarningsRule extends RuleBase {
  readonly kind: "earnings";
  readonly underlyingId: string;
  readonly action: "freeze-buy" | "reduce";
  readonly scope: "company" | "allocation";
  readonly allocationId: string | null;
  readonly reductionBps: number;
}

export type CompiledRule = BasketRule | PriceRule | EarningsRule;
type RuleCore = Omit<BasketRule, "hash" | "state"> | Omit<PriceRule, "hash" | "state"> | Omit<EarningsRule, "hash" | "state">;

function record(value: unknown): Record<string, unknown> {
  requireInput(value !== null && typeof value === "object" && !Array.isArray(value),
    "INVALID_RULE", "Expected a rule object.");
  return value as Record<string, unknown>;
}

function exact(value: Record<string, unknown>, keys: readonly string[]): void {
  requireInput(Object.keys(value).length === keys.length && keys.every((key) => Object.hasOwn(value, key)),
    "UNKNOWN_RULE_FIELD", "Rule fields must match the selected schema exactly.");
}

function positiveRaw(value: unknown): bigint {
  requireInput(typeof value === "string" && /^[1-9][0-9]*$/.test(value), "INVALID_UNITS", "Use positive integer base units.");
  return BigInt(value);
}

function parseAmount(value: unknown): Amount {
  const item = record(value);
  exact(item, ["assetId", "decimals", "units"]);
  requireInput(typeof item.assetId === "string" && typeof item.decimals === "number", "INVALID_AMOUNT", "Amount denomination is required.");
  return amount(positiveRaw(item.units), { assetId: item.assetId, decimals: item.decimals });
}

function parseExpiry(value: unknown): string | null {
  if (value === null) return null;
  requireInput(typeof value === "string" && /^\d{4}-\d{2}-\d{2}T/.test(value)
    && /(Z|[+-]\d{2}:\d{2})$/.test(value) && Number.isFinite(Date.parse(value)),
  "INVALID_EXPIRY", "Expiry needs an ISO timestamp with timezone.");
  return new Date(value).toISOString();
}

function parseSchedule(value: unknown): RuleSchedule {
  const item = record(value);
  exact(item, ["zone", "frequency", "weekday", "localTime", "windowMinutes"]);
  const schedule = item as unknown as RuleSchedule;
  validateRuleSchedule(schedule);
  return { zone: schedule.zone, frequency: schedule.frequency, weekday: schedule.weekday,
    localTime: schedule.localTime, windowMinutes: schedule.windowMinutes };
}

function hash(value: unknown): string {
  const canonical = (item: unknown): unknown => {
    if (typeof item === "bigint") return item.toString();
    if (Array.isArray(item)) return item.map(canonical);
    if (item && typeof item === "object") return Object.fromEntries(Object.entries(item)
      .sort(([a], [b]) => a.localeCompare(b)).map(([key, child]) => [key, canonical(child)]));
    return item;
  };
  return createHash("sha256").update(JSON.stringify(canonical(value))).digest("hex");
}

/** Structured drafts are data, never authority to sign or submit a trade. */
export function compileRule(input: unknown, instruments: InstrumentRegistry): CompiledRule {
  const item = record(input);
  requireInput(item.kind === "basket" || item.kind === "price" || item.kind === "earnings",
    "UNSUPPORTED_RULE", "Only basket, price and earnings rules are supported.");
  const common = ["kind", "id", "portfolioId", "version", "expiresAt"];
  identifier(item.id as string);
  identifier(item.portfolioId as string);
  requireInput(Number.isSafeInteger(item.version) && (item.version as number) > 0,
    "INVALID_RULE_VERSION", "Rule version must be a positive safe integer.");
  const base = { id: item.id as string, portfolioId: item.portfolioId as string,
    version: item.version as number, expiresAt: parseExpiry(item.expiresAt) };
  let core: RuleCore;
  if (item.kind === "basket") {
    exact(item, [...common, "schedule", "contribution", "targets"]);
    requireInput(Array.isArray(item.targets) && item.targets.length > 0, "INVALID_TARGETS", "Basket needs targets.");
    const targets = item.targets.map((value: unknown) => {
      const target = record(value);
      exact(target, ["instrumentId", "weightBps"]);
      requireInput(typeof target.instrumentId === "string", "INVALID_TARGETS", "Instrument ID required.");
      instruments.get(target.instrumentId);
      requireInput(Number.isInteger(target.weightBps) && (target.weightBps as number) > 0
        && (target.weightBps as number) <= 10_000, "INVALID_TARGETS", "Weight must be positive bps.");
      return { instrumentId: target.instrumentId, weightBps: target.weightBps as number };
    });
    requireInput(new Set(targets.map((target) => target.instrumentId)).size === targets.length
      && targets.reduce((sum, target) => sum + target.weightBps, 0) === 10_000,
    "INVALID_TARGETS", "Weights must be unique and total 10,000 bps.");
    targets.sort((a, b) => a.instrumentId.localeCompare(b.instrumentId));
    const contribution = parseAmount(item.contribution);
    requireInput(targets.every((target) => instruments.get(target.instrumentId).chainId
      === Number(contribution.assetId.match(/^eip155:(\d+)\//)?.[1])),
    "WRONG_CHAIN", "Basket settlement and instruments must share a chain.");
    core = { ...base, kind: "basket", schedule: parseSchedule(item.schedule), contribution, targets };
  } else if (item.kind === "price") {
    exact(item, [...common, "instrumentId", "side", "comparator", "pricePerShareRaw", "quantity", "referenceSource", "maxReferenceAgeMs"]);
    requireInput(typeof item.instrumentId === "string", "INVALID_RULE", "Instrument ID required.");
    const instrument = instruments.get(item.instrumentId);
    requireInput(item.side === "buy" || item.side === "sell", "INVALID_SIDE", "Price rule side must be buy or sell.");
    requireInput(item.comparator === "at-or-below" || item.comparator === "at-or-above",
      "INVALID_SIGNAL", "Unsupported price comparison.");
    requireInput(item.referenceSource === instrument.referenceSource, "INVALID_SIGNAL", "Reference source must match instrument.");
    requireInput(Number.isSafeInteger(item.maxReferenceAgeMs) && (item.maxReferenceAgeMs as number) > 0,
      "INVALID_SIGNAL", "Reference age must be positive milliseconds.");
    const quantity = parseAmount(item.quantity);
    requireInput(item.side === "sell" ? quantity.assetId === instrument.assetId && quantity.decimals === instrument.decimals
      : quantity.assetId.startsWith(`eip155:${instrument.chainId}/erc20:`) && quantity.assetId !== instrument.assetId,
    "INVALID_AMOUNT", "Quantity denomination does not match the side and chain.");
    core = { ...base, kind: "price", instrumentId: item.instrumentId, underlyingId: instrument.underlyingId, side: item.side,
      comparator: item.comparator, pricePerShareRaw: positiveRaw(item.pricePerShareRaw), quantity,
      referenceSource: instrument.referenceSource, maxReferenceAgeMs: item.maxReferenceAgeMs as number };
  } else {
    exact(item, [...common, "underlyingId", "action", "scope", "allocationId", "reductionBps"]);
    requireInput(typeof item.underlyingId === "string" && instruments.forUnderlying(item.underlyingId).length > 0,
      "UNKNOWN_UNDERLYING", "Earnings rule needs a registered underlying.");
    requireInput(item.action === "freeze-buy" || item.action === "reduce", "INVALID_EVENT_RULE", "Unsupported earnings action.");
    requireInput(item.scope === "company" || item.scope === "allocation", "INVALID_EVENT_RULE", "Explicit reduction scope required.");
    requireInput(item.scope === "company" ? item.allocationId === null : typeof item.allocationId === "string",
      "INVALID_EVENT_RULE", "Allocation scope needs an allocation ID; company scope must not have one.");
    if (item.scope === "allocation") identifier(item.allocationId as string);
    requireInput(Number.isInteger(item.reductionBps)
      && (item.action === "reduce" ? (item.reductionBps as number) > 0 : item.reductionBps === 0)
      && (item.reductionBps as number) <= 10_000,
    "INVALID_EVENT_RULE", "Reduction bps must match the action.");
    core = { ...base, kind: "earnings", underlyingId: item.underlyingId,
      action: item.action, scope: item.scope, allocationId: item.allocationId as string | null,
      reductionBps: item.reductionBps as number };
  }
  return Object.freeze({ ...core, hash: hash(core), state: "READY_FOR_REVIEW" }) as CompiledRule;
}

export function activateRule(rule: CompiledRule, reviewedHash: string, now: Date): CompiledRule {
  requireInput(rule.state === "READY_FOR_REVIEW" && rule.hash === reviewedHash, "RULE_NOT_REVIEWED", "Reviewed rule hash required.");
  requireInput(Number.isFinite(now.getTime()) && (rule.expiresAt === null || now.getTime() < Date.parse(rule.expiresAt)),
    "RULE_EXPIRED", "Rule expired before activation.");
  return Object.freeze({ ...rule, state: "ACTIVE" }) as CompiledRule;
}

export function pauseRule(rule: CompiledRule): CompiledRule {
  return Object.freeze({ ...rule, state: "PAUSED" }) as CompiledRule;
}

/** Lossless JSON input for the same strict compiler, without runtime lifecycle fields. */
export function compiledRuleDraft(rule: CompiledRule): Record<string, unknown> {
  const common = { id: rule.id, portfolioId: rule.portfolioId, version: rule.version,
    expiresAt: rule.expiresAt, kind: rule.kind };
  if (rule.kind === "basket") return { ...common, schedule: rule.schedule,
    contribution: serializeAmount(rule.contribution), targets: rule.targets };
  if (rule.kind === "price") return { ...common, instrumentId: rule.instrumentId, side: rule.side,
    comparator: rule.comparator, pricePerShareRaw: rule.pricePerShareRaw.toString(),
    quantity: serializeAmount(rule.quantity), referenceSource: rule.referenceSource,
    maxReferenceAgeMs: rule.maxReferenceAgeMs };
  return { ...common, underlyingId: rule.underlyingId, action: rule.action,
    scope: rule.scope, allocationId: rule.allocationId, reductionBps: rule.reductionBps };
}
