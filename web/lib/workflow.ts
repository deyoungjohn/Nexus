/** A local product walkthrough. These records are never transaction authorizations. */
export type Cadence = "weekly" | "monthly";

export interface FixtureDraft {
  contribution: string;
  reserve: string;
  nvdabWeight: string;
  amdbWeight: string;
  perLegCap: string;
  cadence: Cadence;
}

export interface FixtureLeg {
  symbol: "NVDAB" | "AMDB";
  targetWeight: number;
  intendedCents: number;
  acceptedCents: number;
  minimumUnits: string;
  reason: string;
}

export interface FixturePlan {
  id: string;
  createdAt: string;
  expiresAt: string;
  contributionCents: number;
  reserveCents: number;
  acceptedCents: number;
  unallocatedCents: number;
  feeAllowanceCents: number;
  cadence: Cadence;
  perLegCap: number;
  legs: FixtureLeg[];
}

export interface FixtureApproval {
  planId: string;
  approvedAt: string;
  kind: "LOCAL_FIXTURE_ONLY";
}

export interface FixtureReceipt {
  id: string;
  planId: string;
  recordedAt: string;
  kind: "RECONCILED_FIXTURE";
  spentCents: number;
  unallocatedCents: number;
  details: string;
}

export interface FixtureState {
  draft: FixtureDraft;
  plan: FixturePlan | null;
  approval: FixtureApproval | null;
  receipts: FixtureReceipt[];
  paused: boolean;
}

export const INITIAL_DRAFT: FixtureDraft = {
  contribution: "100.00",
  reserve: "20.00",
  nvdabWeight: "60",
  amdbWeight: "40",
  perLegCap: "60",
  cadence: "weekly",
};

export function initialFixtureState(): FixtureState {
  return { draft: { ...INITIAL_DRAFT }, plan: null, approval: null, receipts: [], paused: false };
}

function moneyCents(value: string, label: string): number {
  if (!/^(?:0|[1-9]\d{0,3})(?:\.\d{1,2})?$/.test(value)) {
    throw new Error(`${label} must be a non-negative amount with at most two decimal places.`);
  }
  const [whole = "0", fraction = ""] = value.split(".");
  return Number(whole) * 100 + Number(fraction.padEnd(2, "0"));
}

function percent(value: string, label: string): number {
  if (!/^(?:0|[1-9]\d{0,2})$/.test(value) || Number(value) > 100) {
    throw new Error(`${label} must be a whole percentage from 0 to 100.`);
  }
  return Number(value);
}

function minimumFixtureUnits(cents: number, syntheticPriceCents: number): string {
  const unitsTenThousandths = Math.floor(cents * 98 * 100 / syntheticPriceCents);
  return (unitsTenThousandths / 10_000).toFixed(4);
}

export function createFixturePlan(draft: FixtureDraft, now: Date, id: string): FixturePlan {
  if (!Number.isFinite(now.getTime()) || !/^[a-zA-Z0-9-]{1,80}$/.test(id)) {
    throw new Error("The preview could not be created. Try again.");
  }
  const contributionCents = moneyCents(draft.contribution, "Contribution");
  const reserveCents = moneyCents(draft.reserve, "Cash reserve");
  const nvdabWeight = percent(draft.nvdabWeight, "NVDAB target");
  const amdbWeight = percent(draft.amdbWeight, "AMDB target");
  const perLegCap = percent(draft.perLegCap, "Per-leg cap");
  if (contributionCents < 100) throw new Error("Contribution must be at least $1.00.");
  if (reserveCents >= contributionCents) throw new Error("Cash reserve must be below the contribution.");
  if (nvdabWeight + amdbWeight !== 100) throw new Error("Target weights must add to 100%.");
  if (perLegCap === 0) throw new Error("Per-leg cap must be above 0%.");
  if (draft.cadence !== "weekly" && draft.cadence !== "monthly") throw new Error("Choose a supported schedule.");

  const budget = contributionCents - reserveCents;
  const nvdabIntended = Math.floor(budget * nvdabWeight / 100);
  const targets = [
    { symbol: "NVDAB" as const, weight: nvdabWeight, intended: nvdabIntended, price: 12000 },
    { symbol: "AMDB" as const, weight: amdbWeight, intended: budget - nvdabIntended, price: 8000 },
  ];
  const capCents = Math.floor(budget * perLegCap / 100);
  const legs: FixtureLeg[] = targets.map((target) => {
    const acceptedCents = Math.min(target.intended, capCents);
    return {
      symbol: target.symbol,
      targetWeight: target.weight,
      intendedCents: target.intended,
      acceptedCents,
      minimumUnits: minimumFixtureUnits(acceptedCents, target.price),
      reason: acceptedCents < target.intended ? "Reduced by fixture per-leg cap" : "Within fixture per-leg cap",
    };
  });
  const acceptedCents = legs.reduce((sum, leg) => sum + leg.acceptedCents, 0);
  return {
    id,
    createdAt: now.toISOString(),
    expiresAt: new Date(now.getTime() + 15 * 60_000).toISOString(),
    contributionCents,
    reserveCents,
    acceptedCents,
    unallocatedCents: budget - acceptedCents,
    feeAllowanceCents: Math.min(25, reserveCents),
    cadence: draft.cadence,
    perLegCap,
    legs,
  };
}

export function approveFixturePlan(plan: FixturePlan | null, paused: boolean, now: Date): FixtureApproval {
  if (!plan) throw new Error("Create a preview before approving it.");
  if (paused) throw new Error("Resume the fixture before approving a plan.");
  if (!Number.isFinite(now.getTime()) || now.getTime() >= Date.parse(plan.expiresAt)) {
    throw new Error("This fixture preview expired. Create a fresh preview.");
  }
  return { planId: plan.id, approvedAt: now.toISOString(), kind: "LOCAL_FIXTURE_ONLY" };
}

export function recordFixtureReceipt(plan: FixturePlan | null, approval: FixtureApproval | null,
  existing: readonly FixtureReceipt[], now: Date): FixtureReceipt {
  if (!plan || !approval || approval.planId !== plan.id) {
    throw new Error("Approve this fixture preview before recording an outcome.");
  }
  if (existing.some((receipt) => receipt.planId === plan.id)) {
    throw new Error("This fixture outcome was already recorded.");
  }
  if (!Number.isFinite(now.getTime()) || now.getTime() >= Date.parse(plan.expiresAt)) {
    throw new Error("This fixture preview expired. Create a fresh preview.");
  }
  return {
    id: `fixture-${plan.id}`,
    planId: plan.id,
    recordedAt: now.toISOString(),
    kind: "RECONCILED_FIXTURE",
    spentCents: plan.acceptedCents,
    unallocatedCents: plan.unallocatedCents + plan.reserveCents,
    details: "Illustrative legs marked complete. No wallet signature, chain transaction, or balance reconciliation occurred.",
  };
}

export function restoreFixtureState(raw: string | null): FixtureState {
  if (!raw) return initialFixtureState();
  try {
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== "object" || parsed === null) return initialFixtureState();
    const state = parsed as Partial<FixtureState>;
    if (!state.draft || typeof state.draft.contribution !== "string" ||
      typeof state.draft.reserve !== "string" || typeof state.draft.nvdabWeight !== "string" ||
      typeof state.draft.amdbWeight !== "string" || typeof state.draft.perLegCap !== "string" ||
      (state.draft.cadence !== "weekly" && state.draft.cadence !== "monthly") ||
      typeof state.paused !== "boolean" || !Array.isArray(state.receipts)) return initialFixtureState();
    // Local storage is untrusted and never grants execution authority. A saved preview must be re-created.
    return { draft: state.draft, plan: null, approval: null, receipts: state.receipts.filter(
      (item): item is FixtureReceipt => typeof item === "object" && item !== null &&
        item.kind === "RECONCILED_FIXTURE" && typeof item.id === "string" &&
        typeof item.planId === "string" && typeof item.recordedAt === "string" &&
        Number.isFinite(item.spentCents) && Number.isFinite(item.unallocatedCents) &&
        typeof item.details === "string",
    ).slice(0, 25), paused: state.paused };
  } catch {
    return initialFixtureState();
  }
}

export function cents(value: number): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(value / 100);
}
