import { createHash } from "node:crypto";
import type { Pool, PoolClient } from "pg";
import { deserializeAmount, nativeAssetId, serializeAmount, type Amount } from "../domain/amount.js";
import { identifier, requireInput } from "../domain/errors.js";
import { createInstrument, type Instrument } from "../domain/instrument.js";
import { Ledger } from "../ledger/ledger.js";
import { coordinatePortfolio, type CoordinationResult, type CoordinatorPolicy,
  type PortfolioSnapshot, type Proposal } from "./plan.js";

function json(value: unknown): string {
  return JSON.stringify(value, (_key, item: unknown) => typeof item === "bigint" ? item.toString() : item);
}

function digest(value: unknown): string {
  const canonical = (item: unknown): unknown => {
    if (typeof item === "bigint") return item.toString();
    if (item instanceof Date) return item.toISOString();
    if (Array.isArray(item)) return item.map(canonical);
    if (item && typeof item === "object") return Object.fromEntries(Object.entries(item)
      .sort(([left], [right]) => left < right ? -1 : left > right ? 1 : 0)
      .map(([key, content]) => [key, canonical(content)]));
    return item;
  };
  return createHash("sha256").update(JSON.stringify(canonical(value))).digest("hex");
}

async function inTransaction<T>(pool: Pool, action: (client: PoolClient) => Promise<T>, existingClient?: PoolClient): Promise<T> {
  if (existingClient) return action(existingClient);
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    try {
      const result = await action(client);
      await client.query("COMMIT");
      return result;
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    }
  } finally {
    client.release();
  }
}

interface PortfolioRow {
  revision: string;
  chain_id: number;
  settlement_asset_id: string;
  settlement_decimals: number;
  active_policy_id: string | null;
}

async function lockPortfolio(client: PoolClient, id: string): Promise<PortfolioRow> {
  const result = await client.query<PortfolioRow>("SELECT revision, chain_id, settlement_asset_id, settlement_decimals, active_policy_id FROM portfolios WHERE id = $1 FOR UPDATE", [id]);
  requireInput(result.rows[0] !== undefined, "UNKNOWN_PORTFOLIO", "Portfolio does not exist.");
  return result.rows[0];
}

interface PolicyRecord {
  minimumCash: ReturnType<typeof serializeAmount>;
  feeAllowance: ReturnType<typeof serializeAmount>;
  requiredNativeGas: ReturnType<typeof serializeAmount>;
  companyCapsBps: Readonly<Record<string, number>>;
  sectorCapsBps: Readonly<Record<string, number>>;
  issuerCapsBps: Readonly<Record<string, number>>;
}

function encodePolicy(policy: CoordinatorPolicy): PolicyRecord {
  return { minimumCash: serializeAmount(policy.minimumCash), feeAllowance: serializeAmount(policy.feeAllowance),
    requiredNativeGas: serializeAmount(policy.requiredNativeGas), companyCapsBps: policy.companyCapsBps,
    sectorCapsBps: policy.sectorCapsBps, issuerCapsBps: policy.issuerCapsBps };
}

function decodePolicy(value: PolicyRecord): CoordinatorPolicy {
  return { minimumCash: deserializeAmount(value.minimumCash), feeAllowance: deserializeAmount(value.feeAllowance),
    requiredNativeGas: deserializeAmount(value.requiredNativeGas), companyCapsBps: value.companyCapsBps,
    sectorCapsBps: value.sectorCapsBps, issuerCapsBps: value.issuerCapsBps };
}

interface StoredResult {
  phase: CoordinationResult["phase"];
  requiresNewSnapshot: boolean;
  decisions: Array<Omit<CoordinationResult["decisions"][number], "requestedUnits" | "acceptedUnits" | "nettedNominal" | "contingentUnits"> & {
    requestedUnits: string; acceptedUnits: string; nettedNominal: string; contingentUnits: string;
  }>;
  legs: Array<{ proposalId: string; instrumentId: string; side: "buy" | "sell"; amount: ReturnType<typeof serializeAmount> }>;
}

function encodeResult(result: CoordinationResult): StoredResult {
  return { phase: result.phase, requiresNewSnapshot: result.requiresNewSnapshot,
    decisions: result.decisions.map((d) => ({ ...d, requestedUnits: d.requestedUnits.toString(),
      acceptedUnits: d.acceptedUnits.toString(), nettedNominal: d.nettedNominal.toString(),
      contingentUnits: d.contingentUnits.toString() })),
    legs: result.legs.map((leg) => ({ ...leg, amount: serializeAmount(leg.amount) })) };
}

function decodeResult(value: StoredResult): CoordinationResult {
  return { phase: value.phase, requiresNewSnapshot: value.requiresNewSnapshot,
    decisions: value.decisions.map((d) => ({ ...d, requestedUnits: BigInt(d.requestedUnits),
      acceptedUnits: BigInt(d.acceptedUnits), nettedNominal: BigInt(d.nettedNominal),
      contingentUnits: BigInt(d.contingentUnits) })),
    legs: value.legs.map((leg) => ({ ...leg, amount: deserializeAmount(leg.amount) })) };
}

export interface PolicyActivation {
  readonly portfolioId: string;
  readonly expectedRevision: bigint;
  readonly policyId: string;
  readonly version: number;
  readonly policy: CoordinatorPolicy;
}

export interface CoordinationRequest {
  readonly portfolioId: string;
  readonly expectedRevision: bigint;
  readonly planId: string;
  readonly occurrenceId: string;
  readonly idempotencyKey: string;
  readonly leaseUntil: Date;
  readonly snapshot: PortfolioSnapshot;
  readonly proposals: readonly Proposal[];
}

export interface StoredCoordination {
  readonly result: CoordinationResult;
  readonly replay: boolean;
  readonly reservedPlanId: string | null;
}

export class CoordinatorStore {
  private readonly ledger: Ledger;
  constructor(private readonly pool: Pool) { this.ledger = new Ledger(pool); }

  async registerInstrument(instrument: Instrument, existingClient?: PoolClient): Promise<void> {
    const rebuilt = createInstrument(instrument);
    requireInput(rebuilt.instrumentId === instrument.instrumentId && rebuilt.assetId === instrument.assetId,
      "INVALID_INSTRUMENT", "Instrument identity does not match its metadata.");
    const database=existingClient??this.pool;
    const existing = await database.query<{ body: Instrument }>(
      "SELECT body FROM instruments WHERE instrument_id = $1", [instrument.instrumentId]);
    if (existing.rows[0]) {
      requireInput(digest(existing.rows[0].body) === digest(instrument), "INSTRUMENT_METADATA_CHANGED",
        "Registered instrument metadata is immutable.");
      return;
    }
    await database.query("INSERT INTO instruments(instrument_id, asset_id, body) VALUES ($1, $2, $3::jsonb)",
      [instrument.instrumentId, instrument.assetId, json(instrument)]);
  }

  async activatePolicy(input: PolicyActivation, existingClient?: PoolClient): Promise<bigint> {
    identifier(input.portfolioId); identifier(input.policyId);
    requireInput(input.expectedRevision >= 0n && Number.isSafeInteger(input.version) && input.version > 0,
      "INVALID_POLICY_VERSION", "Policy version and portfolio revision must be valid.");
    const body = encodePolicy(input.policy);
    return inTransaction(this.pool, async (client) => {
      const portfolio = await lockPortfolio(client, input.portfolioId);
      requireInput(BigInt(portfolio.revision) === input.expectedRevision, "STALE_REVISION", "Portfolio revision changed.");
      requireInput(body.minimumCash.assetId === portfolio.settlement_asset_id
        && body.feeAllowance.assetId === portfolio.settlement_asset_id
        && body.minimumCash.decimals === portfolio.settlement_decimals
        && body.feeAllowance.decimals === portfolio.settlement_decimals,
      "DENOMINATION_MISMATCH", "Policy cash amounts must use portfolio settlement denomination.");
      requireInput(body.requiredNativeGas.assetId === nativeAssetId(portfolio.chain_id),
        "DENOMINATION_MISMATCH", "Policy gas amount must use the portfolio's native asset.");
      for (const caps of [body.companyCapsBps, body.sectorCapsBps, body.issuerCapsBps]) {
        for (const [key, bps] of Object.entries(caps)) {
          identifier(key);
          requireInput(Number.isInteger(bps) && bps >= 0 && bps <= 10_000,
            "INVALID_CAP", "Policy caps must be integer basis points from 0 to 10,000.");
        }
      }
      const submitted = await client.query("SELECT 1 FROM reservations WHERE portfolio_id = $1 AND state = 'submitted' LIMIT 1", [input.portfolioId]);
      requireInput(submitted.rowCount === 0, "UNRESOLVED_SUBMISSION", "Submitted inventory requires reconciliation.");
      const prior = await client.query<{ version: string }>("SELECT version FROM policies WHERE portfolio_id = $1 ORDER BY version DESC LIMIT 1", [input.portfolioId]);
      requireInput(!prior.rows[0] || BigInt(input.version) > BigInt(prior.rows[0].version),
        "POLICY_VERSION_CONFLICT", "New policy version must increase.");
      await client.query("INSERT INTO policies(id, portfolio_id, version, body) VALUES ($1, $2, $3, $4::jsonb)",
        [input.policyId, input.portfolioId, input.version, json(body)]);
      await client.query("UPDATE reservations SET state = 'released', lease_until = NULL WHERE portfolio_id = $1 AND state = 'held'", [input.portfolioId]);
      await client.query("UPDATE plans SET status = 'stale' WHERE portfolio_id = $1 AND status IN ('reserved', 'executing')", [input.portfolioId]);
      const next = input.expectedRevision + 1n;
      await client.query("UPDATE portfolios SET active_policy_id = $2, revision = $3 WHERE id = $1",
        [input.portfolioId, input.policyId, next.toString()]);
      await client.query("INSERT INTO portfolio_revisions(portfolio_id, revision, reason) VALUES ($1, $2, 'policy-change')",
        [input.portfolioId, next.toString()]);
      return next;
    }, existingClient);
  }

  async coordinateAndReserve(input: CoordinationRequest, existingClient?: PoolClient): Promise<StoredCoordination> {
    for (const id of [input.portfolioId, input.planId, input.occurrenceId, input.idempotencyKey]) identifier(id);
    requireInput(input.expectedRevision >= 0n, "INVALID_REVISION", "Expected revision must be nonnegative.");
    const requestHash = digest({ planId: input.planId, snapshot: input.snapshot, proposals: input.proposals,
      expectedRevision: input.expectedRevision, occurrenceId: input.occurrenceId,
      idempotencyKey: input.idempotencyKey });
    const decisionId = `coordination-${input.planId}`;
    return inTransaction(this.pool, async (client) => {
      const portfolio = await lockPortfolio(client, input.portfolioId);
      const prior = await client.query<{ body: { requestHash: string; result: StoredResult; reservedPlanId: string | null } }>(
        "SELECT body FROM decision_records WHERE id = $1 AND portfolio_id = $2 AND kind = 'coordination'",
        [decisionId, input.portfolioId]);
      if (prior.rows[0]) {
        requireInput(prior.rows[0].body.requestHash === requestHash, "IDEMPOTENCY_CONFLICT", "Coordination retry changed content.");
        return { result: decodeResult(prior.rows[0].body.result), replay: true,
          reservedPlanId: prior.rows[0].body.reservedPlanId };
      }
      const occurrence = await client.query("SELECT 1 FROM coordination_occurrences WHERE portfolio_id = $1 AND occurrence_id = $2",
        [input.portfolioId, input.occurrenceId]);
      requireInput(occurrence.rowCount === 0, "DUPLICATE_OCCURRENCE", "Occurrence was already coordinated.");
      requireInput(BigInt(portfolio.revision) === input.expectedRevision && input.snapshot.revision === input.expectedRevision,
        "STALE_REVISION", "Snapshot and portfolio revision must match.");
      requireInput(portfolio.active_policy_id !== null, "MISSING_POLICY", "Activate a policy before coordination.");
      const policyRow = await client.query<{ body: PolicyRecord }>("SELECT body FROM policies WHERE id = $1 AND portfolio_id = $2",
        [portfolio.active_policy_id, input.portfolioId]);
      requireInput(policyRow.rows[0] !== undefined, "MISSING_POLICY", "Active policy record is unavailable.");
      const policy = decodePolicy(policyRow.rows[0].body);
      await verifySnapshot(client, input.portfolioId, portfolio, input.snapshot);
      const unresolved = await client.query("SELECT 1 FROM reservations WHERE portfolio_id = $1 AND state = 'submitted' LIMIT 1", [input.portfolioId]);
      requireInput(unresolved.rowCount === 0, "UNRESOLVED_SUBMISSION", "Resolve submitted inventory before planning.");
      const result = coordinatePortfolio(input.snapshot, policy, input.proposals);
      let reservedPlanId: string | null = null;
      if (result.legs.length > 0) {
        const reserved = await this.ledger.reservePlan({ portfolioId: input.portfolioId, planId: input.planId,
          occurrenceId: input.occurrenceId, idempotencyKey: input.idempotencyKey,
          expectedRevision: input.expectedRevision, leaseUntil: input.leaseUntil,
          reservations: result.legs.map((leg, index) => ({ id: `${input.planId}-${index}`,
            amount: leg.amount })) }, client);
        reservedPlanId = reserved.id;
      }
      await client.query(`INSERT INTO evidence_snapshots(id, portfolio_id, revision, source_block, observed_at, body)
        VALUES ($1, $2, $3, $4, now(), $5::jsonb)`, [`evidence-${input.planId}`, input.portfolioId,
        input.expectedRevision.toString(), input.snapshot.sourceBlock.toString(), json(input.snapshot)]);
      await client.query(`INSERT INTO decision_records(id, portfolio_id, revision, kind, body)
        VALUES ($1, $2, $3, 'coordination', $4::jsonb)`, [decisionId, input.portfolioId,
        input.expectedRevision.toString(), json({ requestHash, policyId: portfolio.active_policy_id,
          occurrenceId: input.occurrenceId, reservedPlanId, proposals: input.proposals, result: encodeResult(result) })]);
      await client.query(`INSERT INTO coordination_occurrences(portfolio_id, occurrence_id, plan_id, decision_record_id)
        VALUES ($1, $2, $3, $4)`, [input.portfolioId, input.occurrenceId, input.planId, decisionId]);
      return { result, replay: false, reservedPlanId };
    }, existingClient);
  }
}

async function verifySnapshot(client: PoolClient, portfolioId: string, portfolio: PortfolioRow,
  snapshot: PortfolioSnapshot): Promise<void> {
  const expected = new Map<string, Amount>();
  expected.set(snapshot.confirmedCash.assetId, snapshot.confirmedCash);
  expected.set(snapshot.nativeGas.assetId, snapshot.nativeGas);
  for (const position of snapshot.positions) {
    requireInput(!expected.has(position.raw.assetId), "DUPLICATE_ASSET", "Snapshot asset appears twice.");
    expected.set(position.raw.assetId, position.raw);
    const registered = await client.query<{ body: Instrument }>(
      "SELECT body FROM instruments WHERE instrument_id = $1 AND asset_id = $2",
      [position.instrument.instrumentId, position.instrument.assetId]);
    requireInput(registered.rows[0] !== undefined, "UNKNOWN_INSTRUMENT", "Snapshot instrument is not registered.");
    requireInput(digest(registered.rows[0].body) === digest(position.instrument),
      "INSTRUMENT_METADATA_CHANGED", "Snapshot instrument classification differs from registry.");
  }
  requireInput(snapshot.confirmedCash.assetId === portfolio.settlement_asset_id
    && snapshot.confirmedCash.decimals === portfolio.settlement_decimals,
  "DENOMINATION_MISMATCH", "Snapshot settlement denomination differs from portfolio.");
  const balances = await client.query<{ asset_id: string; decimals: number; confirmed_units: string }>(
    "SELECT asset_id, decimals, confirmed_units FROM balances WHERE portfolio_id = $1", [portfolioId]);
  requireInput(balances.rows.length === expected.size, "UNRECONCILED_SNAPSHOT", "Snapshot omits or adds an asset.");
  for (const row of balances.rows) {
    const observed = expected.get(row.asset_id);
    requireInput(observed !== undefined && observed.decimals === row.decimals
      && observed.units === BigInt(row.confirmed_units), "UNRECONCILED_SNAPSHOT", "Snapshot balance differs from ledger.");
  }
  const active = await client.query<{ asset_id: string; units: string }>(`
    SELECT asset_id, sum(units) AS units FROM reservations
    WHERE portfolio_id = $1 AND state IN ('held', 'submitted') GROUP BY asset_id`, [portfolioId]);
  const reserved = new Map(active.rows.map((row) => [row.asset_id, BigInt(row.units)]));
  requireInput(snapshot.reservedCash.units === (reserved.get(snapshot.confirmedCash.assetId) ?? 0n),
    "UNRECONCILED_SNAPSHOT", "Settlement reservations differ from ledger.");
  for (const position of snapshot.positions) {
    requireInput(position.reservedRaw.units === (reserved.get(position.raw.assetId) ?? 0n),
      "UNRECONCILED_SNAPSHOT", "Inventory reservations differ from ledger.");
  }
}
