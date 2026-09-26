import { amount, assertSameDenomination, type Amount } from "./amount.js";
import { identifier, requireInput } from "./errors.js";

export interface Budget {
  readonly confirmed: Amount;
  readonly reserved: Amount;
  readonly minimumReserve: Amount;
  readonly feeAllowance: Amount;
  readonly nativeGas: Amount;
  readonly requiredNativeGas: Amount;
}

export interface SpendingRequest {
  readonly id: string;
  readonly priority: number;
  readonly requested: Amount;
}

export type AllocationReason = "ACCEPTED" | "CASH_LIMIT" | "INSUFFICIENT_SETTLEMENT" | "INSUFFICIENT_NATIVE_GAS";

export interface AllocationDecision extends SpendingRequest {
  readonly accepted: Amount;
  readonly rejected: Amount;
  readonly status: "accepted" | "reduced" | "rejected";
  readonly reason: AllocationReason;
}

export interface AllocationResult {
  readonly status: "allocated" | "blocked";
  readonly blockers: readonly AllocationReason[];
  readonly available: Amount;
  readonly unallocated: Amount;
  readonly decisions: readonly AllocationDecision[];
}

const byId = (a: string, b: string): number => a < b ? -1 : a > b ? 1 : 0;

/** Pure spending proposal math. Does not reserve inventory, authorize or execute. */
export function allocateBudget(budget: Budget, requests: readonly SpendingRequest[]): AllocationResult {
  const { confirmed, reserved, minimumReserve, feeAllowance, nativeGas, requiredNativeGas } = budget;
  for (const value of [reserved, minimumReserve, feeAllowance]) assertSameDenomination(confirmed, value);
  assertSameDenomination(nativeGas, requiredNativeGas);
  const chain = confirmed.assetId.split("/")[0];
  requireInput(confirmed.assetId.includes("/erc20:") && nativeGas.assetId === `${chain}/native`,
    "INVALID_GAS_ASSET", "Settlement must be a token and gas must be the same chain's native asset.");
  const ids = new Set<string>();
  for (const request of requests) {
    identifier(request.id);
    requireInput(!ids.has(request.id), "DUPLICATE_REQUEST", "Spending request IDs must be unique.");
    ids.add(request.id);
    requireInput(Number.isSafeInteger(request.priority) && request.priority >= 0,
      "INVALID_PRIORITY", "Priority must be a nonnegative safe integer.");
    assertSameDenomination(confirmed, request.requested);
    requireInput(request.requested.units > 0n, "EMPTY_REQUEST", "Spending requests must be positive.");
  }
  const sorted = [...requests].sort((a, b) => a.priority - b.priority || byId(a.id, b.id));
  const net = confirmed.units - reserved.units - minimumReserve.units - feeAllowance.units;
  const available = amount(net > 0n ? net : 0n, confirmed);
  const blockers: AllocationReason[] = [];
  if (net < 0n) blockers.push("INSUFFICIENT_SETTLEMENT");
  if (nativeGas.units < requiredNativeGas.units) blockers.push("INSUFFICIENT_NATIVE_GAS");
  const accepted = new Map<string, bigint>();
  let remaining = available.units;
  if (blockers.length === 0) {
    for (const priority of new Set(sorted.map((request) => request.priority))) {
      const group = sorted.filter((request) => request.priority === priority);
      const total = group.reduce((sum, request) => sum + request.requested.units, 0n);
      const spend = remaining < total ? remaining : total;
      const shares = group.map((request) => ({
        id: request.id,
        units: spend * request.requested.units / total,
        remainder: spend * request.requested.units % total,
      }));
      let dust = spend - shares.reduce((sum, share) => sum + share.units, 0n);
      shares.sort((a, b) => a.remainder > b.remainder ? -1 : a.remainder < b.remainder ? 1 : byId(a.id, b.id));
      for (const share of shares) {
        accepted.set(share.id, share.units + (dust > 0n ? 1n : 0n));
        if (dust > 0n) dust -= 1n;
      }
      remaining -= spend;
    }
  }
  return Object.freeze({
    status: blockers.length ? "blocked" : "allocated",
    blockers: Object.freeze(blockers), available, unallocated: amount(remaining, confirmed),
    decisions: Object.freeze(sorted.map((request): AllocationDecision => {
      const units = accepted.get(request.id) ?? 0n;
      return Object.freeze({
        id: request.id, priority: request.priority,
        requested: amount(request.requested.units, confirmed),
        accepted: amount(units, confirmed), rejected: amount(request.requested.units - units, confirmed),
        status: units === request.requested.units ? "accepted" : units === 0n ? "rejected" : "reduced",
        reason: blockers[0] ?? (units === request.requested.units ? "ACCEPTED" : "CASH_LIMIT"),
      });
    })),
  });
}
