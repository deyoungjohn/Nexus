import { requireInput } from "../domain/errors.js";

export type EoaLegState = "signed" | "unknown" | "included" | "confirmed" |
  "reverted" | "replaced" | "reorged";

export interface EoaReceipt {
  readonly hash: string;
  readonly blockNumber: bigint;
  readonly blockHash: string;
  readonly success: boolean;
}

export interface EoaChainObservation {
  readonly headBlock: bigint;
  readonly latestNonce: bigint;
  readonly receipt: EoaReceipt | null;
  /** A distinct same-sender/same-nonce chain transaction, if actually observed. */
  readonly replacement: { readonly from: string; readonly nonce: bigint;
    readonly receipt: EoaReceipt } | null;
}

export interface EoaTrackedLeg {
  readonly hash: string;
  readonly wallet: string;
  readonly nonce: bigint;
  readonly state: EoaLegState;
  readonly includedBlockHash: string | null;
}

export interface EoaRecoveryDecision {
  readonly state: EoaLegState;
  readonly reason: "NOT_BROADCAST" | "PENDING_OR_UNKNOWN" | "NONCE_USED_UNKNOWN" |
    "INCLUDED" | "CONFIRMED" | "REVERTED" | "REPLACED" | "REORGED";
  readonly receipt: EoaReceipt | null;
  readonly replacementHash: string | null;
}

const hash = (value: string): boolean => /^0x[0-9a-fA-F]{64}$/.test(value);
const same = (a: string, b: string): boolean => a.toLowerCase() === b.toLowerCase();

/** A timeout never becomes failure. Only finalized receipt evidence resolves a leg. */
export function classifyEoaObservation(tracked: EoaTrackedLeg, observed: EoaChainObservation,
  finalityBlocks: bigint): EoaRecoveryDecision {
  requireInput(hash(tracked.hash) && /^0x[0-9a-fA-F]{40}$/.test(tracked.wallet)
    && tracked.nonce >= 0n && observed.headBlock >= 0n && observed.latestNonce >= 0n
    && finalityBlocks > 0n, "INVALID_RECOVERY_INPUT", "Valid chain observations and finality required.");
  const output = (state: EoaLegState, reason: EoaRecoveryDecision["reason"],
    receipt: EoaReceipt | null = null, replacementHash: string | null = null): EoaRecoveryDecision =>
    ({ state, reason, receipt, replacementHash });
  const receipt = observed.receipt;
  if (receipt) {
    requireInput(hash(receipt.hash) && same(receipt.hash, tracked.hash)
      && hash(receipt.blockHash) && receipt.blockNumber >= 0n
      && receipt.blockNumber <= observed.headBlock,
    "INVALID_RECEIPT", "Receipt does not match tracked transaction or canonical head.");
    if (tracked.includedBlockHash && !same(tracked.includedBlockHash, receipt.blockHash))
      return output("reorged", "REORGED", receipt);
    const depth = observed.headBlock - receipt.blockNumber + 1n;
    if (depth < finalityBlocks) return output("included", "INCLUDED", receipt);
    return receipt.success ? output("confirmed", "CONFIRMED", receipt)
      : output("reverted", "REVERTED", receipt);
  }
  if (tracked.includedBlockHash || tracked.state === "included" || tracked.state === "confirmed")
    return output("reorged", "REORGED");
  const replacement = observed.replacement;
  if (replacement) {
    const candidate = replacement.receipt;
    requireInput(same(replacement.from, tracked.wallet) && replacement.nonce === tracked.nonce
      && hash(candidate.hash) && !same(candidate.hash, tracked.hash)
      && hash(candidate.blockHash) && candidate.blockNumber <= observed.headBlock,
    "INVALID_REPLACEMENT", "Replacement must be a different observed same-nonce transaction.");
    const depth = observed.headBlock - candidate.blockNumber + 1n;
    return depth >= finalityBlocks ? output("replaced", "REPLACED", candidate, candidate.hash)
      : output("unknown", "PENDING_OR_UNKNOWN", candidate, candidate.hash);
  }
  if (tracked.state === "signed" && observed.latestNonce <= tracked.nonce)
    return output("signed", "NOT_BROADCAST");
  return observed.latestNonce > tracked.nonce
    ? output("unknown", "NONCE_USED_UNKNOWN") : output("unknown", "PENDING_OR_UNKNOWN");
}

export interface SequentialLeg {
  readonly id: string;
  readonly state: EoaLegState;
  /** Confirmed settlement spent, independent of a planned or quoted amount. */
  readonly confirmedSpend: bigint;
}

export type SequentialOutcome =
  | { readonly action: "await-reconciliation" | "blocked" | "replan-buy"; readonly reason: string }
  | { readonly action: "complete" | "partial"; readonly invested: bigint;
      readonly remainingCash: bigint; readonly reason: string };

/** A sell never funds a buy until a new reconciled portfolio revision exists. */
export function nextSequentialAction(phase: "sell" | "buy", planRevision: bigint,
  currentRevision: bigint, budget: bigint, legs: readonly SequentialLeg[]): SequentialOutcome {
  requireInput(planRevision >= 0n && currentRevision >= planRevision && budget >= 0n
    && legs.length > 0 && new Set(legs.map(leg => leg.id)).size === legs.length
    && legs.every(leg => leg.confirmedSpend >= 0n),
  "INVALID_BATCH", "Valid unique legs and nonnegative amounts required.");
  if (legs.some(leg => ["unknown", "included", "signed", "reorged"].includes(leg.state)))
    return { action: "await-reconciliation", reason: "UNRESOLVED_LEG" };
  if (legs.some(leg => leg.state === "replaced"))
    return { action: "blocked", reason: "REPLACEMENT_NEEDS_BALANCE_RECONCILIATION" };
  if (phase === "sell") {
    if (legs.some(leg => leg.state === "reverted"))
      return { action: "blocked", reason: "SELL_DID_NOT_FUND_BUY" };
    return currentRevision > planRevision
      ? { action: "replan-buy", reason: "CONFIRMED_SELL_NEW_REVISION" }
      : { action: "await-reconciliation", reason: "SELL_NEEDS_NEW_SNAPSHOT" };
  }
  requireInput(legs.every(leg => leg.state !== "confirmed" || leg.confirmedSpend > 0n),
    "INVALID_FILL", "Confirmed buy needs actual settlement spend.");
  const invested = legs.reduce((sum, leg) => sum + (leg.state === "confirmed" ? leg.confirmedSpend : 0n), 0n);
  requireInput(invested <= budget, "BUDGET_OVERRUN", "Actual confirmed spend exceeds approved budget.");
  return { action: legs.every(leg => leg.state === "confirmed") ? "complete" : "partial",
    invested, remainingCash: budget - invested,
    reason: legs.every(leg => leg.state === "confirmed") ? "ALL_BUYS_CONFIRMED" : "UNSPENT_FUNDS_STAY_CASH" };
}
