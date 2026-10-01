import { createHash } from "node:crypto";
import type { Pool, PoolClient } from "pg";
import { type Amount, type Denomination, amount, chainId, validateDenomination } from "../domain/amount.js";
import { identifier, requireInput } from "../domain/errors.js";

type QueryClient = PoolClient;

export interface PortfolioInput {
  readonly id: string;
  readonly chainId: number;
  readonly settlement: Denomination;
  readonly balances: readonly Amount[];
}

export interface ReservationInput {
  readonly id: string;
  readonly amount: Amount;
}

export interface ReservePlanInput {
  readonly portfolioId: string;
  readonly planId: string;
  readonly occurrenceId: string;
  readonly idempotencyKey: string;
  readonly expectedRevision: bigint;
  readonly leaseUntil: Date;
  readonly reservations: readonly ReservationInput[];
}

export interface OutboxEvent {
  readonly id: string;
  readonly eventKey: string;
  readonly topic: string;
  readonly payload: unknown;
  readonly attempts: number;
}

function validateBalances(chain: number, balances: readonly Amount[]): void {
  const seen = new Set<string>();
  for (const value of balances) {
    amount(value.units, value);
    requireInput(value.assetId.startsWith(`eip155:${chain}/`), "WRONG_CHAIN", "Balance belongs to another chain.");
    requireInput(!seen.has(value.assetId), "DUPLICATE_ASSET", "Balance asset appears twice.");
    seen.add(value.assetId);
  }
}

function validateReserve(input: ReservePlanInput): string {
  for (const value of [input.portfolioId, input.planId, input.occurrenceId, input.idempotencyKey]) identifier(value);
  requireInput(input.expectedRevision >= 0n, "INVALID_REVISION", "Expected revision must be nonnegative.");
  requireInput(input.leaseUntil instanceof Date && !Number.isNaN(input.leaseUntil.valueOf())
    && input.leaseUntil.valueOf() > Date.now(), "INVALID_LEASE", "Reservation lease must be in the future.");
  requireInput(input.reservations.length > 0, "EMPTY_RESERVATIONS", "A plan must reserve an asset.");
  const ids = new Set<string>();
  for (const reservation of input.reservations) {
    identifier(reservation.id);
    requireInput(!ids.has(reservation.id), "DUPLICATE_RESERVATION", "Reservation IDs must be unique.");
    ids.add(reservation.id);
    amount(reservation.amount.units, reservation.amount);
    requireInput(reservation.amount.units > 0n, "INVALID_RESERVATION", "Reservation must be positive.");
  }
  const canonical = input.reservations.map((r) => ({
    id: r.id, assetId: r.amount.assetId, decimals: r.amount.decimals, units: r.amount.units.toString()
  })).sort((a, b) => a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
  return createHash("sha256").update(JSON.stringify({
    portfolioId: input.portfolioId, planId: input.planId, occurrenceId: input.occurrenceId,
    expectedRevision: input.expectedRevision.toString(), reservations: canonical
  })).digest("hex");
}

async function transaction<T>(pool: Pool, run: (client: QueryClient) => Promise<T>, existingClient?: PoolClient): Promise<T> {
  if (existingClient) return run(existingClient);
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    try {
      const result = await run(client);
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

async function lockedPortfolio(client: QueryClient, id: string): Promise<{ revision: bigint; chainId: number }> {
  const result = await client.query<{ revision: string; chain_id: number }>(
    "SELECT revision, chain_id FROM portfolios WHERE id = $1 FOR UPDATE", [id]);
  requireInput(result.rows[0] !== undefined, "UNKNOWN_PORTFOLIO", "Portfolio does not exist.");
  return { revision: BigInt(result.rows[0].revision), chainId: result.rows[0].chain_id };
}

export class Ledger {
  constructor(private readonly pool: Pool) {}

  async createPortfolio(input: PortfolioInput): Promise<void> {
    identifier(input.id);
    chainId(input.chainId);
    validateDenomination(input.settlement);
    requireInput(input.settlement.assetId.startsWith(`eip155:${input.chainId}/`), "WRONG_CHAIN", "Settlement asset belongs to another chain.");
    validateBalances(input.chainId, input.balances);
    requireInput(input.balances.some((x) => x.assetId === input.settlement.assetId
      && x.decimals === input.settlement.decimals), "MISSING_SETTLEMENT", "Settlement balance is required.");
    await transaction(this.pool, async (client) => {
      await client.query(`INSERT INTO portfolios(id, chain_id, settlement_asset_id, settlement_decimals)
        VALUES ($1, $2, $3, $4)`, [input.id, input.chainId, input.settlement.assetId, input.settlement.decimals]);
      await client.query("INSERT INTO portfolio_revisions(portfolio_id, revision, reason) VALUES ($1, 0, 'initial')", [input.id]);
      for (const balance of input.balances) {
        await client.query(`INSERT INTO balances(portfolio_id, asset_id, decimals, confirmed_units)
          VALUES ($1, $2, $3, $4)`, [input.id, balance.assetId, balance.decimals, balance.units.toString()]);
      }
    });
  }

  async reservePlan(input: ReservePlanInput, transactionClient?: PoolClient): Promise<{ id: string; replay: boolean }> {
    const hash = validateReserve(input);
    const reserve = async (client: PoolClient): Promise<{ id: string; replay: boolean }> => {
      const portfolio = await lockedPortfolio(client, input.portfolioId);
      const prior = await client.query<{ id: string; request_hash: string }>(
        "SELECT id, request_hash FROM plans WHERE portfolio_id = $1 AND idempotency_key = $2",
        [input.portfolioId, input.idempotencyKey]);
      if (prior.rows[0]) {
        requireInput(prior.rows[0].request_hash === hash, "IDEMPOTENCY_CONFLICT", "Key was used for different plan content.");
        return { id: prior.rows[0].id, replay: true };
      }
      requireInput(portfolio.revision === input.expectedRevision, "STALE_REVISION", "Portfolio revision has changed.");
      const unresolved = await client.query("SELECT 1 FROM reservations WHERE portfolio_id = $1 AND state = 'submitted' LIMIT 1", [input.portfolioId]);
      requireInput(unresolved.rowCount === 0, "UNRESOLVED_SUBMISSION", "A submitted reservation requires reconciliation.");
      const occurrence = await client.query("SELECT 1 FROM plans WHERE portfolio_id = $1 AND occurrence_id = $2", [input.portfolioId, input.occurrenceId]);
      requireInput(occurrence.rowCount === 0, "DUPLICATE_OCCURRENCE", "Occurrence already has a plan.");
      const demanded = new Map<string, { decimals: number; units: bigint }>();
      for (const reservation of input.reservations) {
        const a = reservation.amount;
        requireInput(a.assetId.startsWith(`eip155:${portfolio.chainId}/`), "WRONG_CHAIN", "Reservation belongs to another chain.");
        const current = demanded.get(a.assetId);
        requireInput(current === undefined || current.decimals === a.decimals, "DENOMINATION_MISMATCH", "Asset precision changed within plan.");
        demanded.set(a.assetId, { decimals: a.decimals, units: (current?.units ?? 0n) + a.units });
      }
      for (const [assetId, demand] of demanded) {
        const balance = await client.query<{ confirmed_units: string; decimals: number; reserved_units: string }>(`
          SELECT b.confirmed_units, b.decimals,
            COALESCE((SELECT sum(r.units) FROM reservations r WHERE r.portfolio_id = b.portfolio_id
              AND r.asset_id = b.asset_id AND r.state IN ('held', 'submitted')), 0) AS reserved_units
          FROM balances b WHERE b.portfolio_id = $1 AND b.asset_id = $2`, [input.portfolioId, assetId]);
        requireInput(balance.rows[0] !== undefined, "UNKNOWN_BALANCE", "Asset has no confirmed balance.");
        requireInput(balance.rows[0].decimals === demand.decimals, "DENOMINATION_MISMATCH", "Balance precision differs.");
        requireInput(BigInt(balance.rows[0].confirmed_units) - BigInt(balance.rows[0].reserved_units) >= demand.units,
          "INSUFFICIENT_BALANCE", "Confirmed inventory less active reservations cannot cover demand.");
      }
      await client.query(`INSERT INTO plans(id, portfolio_id, revision, occurrence_id, idempotency_key, request_hash, status)
        VALUES ($1, $2, $3, $4, $5, $6, 'reserved')`,
      [input.planId, input.portfolioId, input.expectedRevision.toString(), input.occurrenceId, input.idempotencyKey, hash]);
      for (const reservation of input.reservations) {
        await client.query(`INSERT INTO reservations(id, portfolio_id, plan_id, asset_id, decimals, units, state, lease_until)
          VALUES ($1, $2, $3, $4, $5, $6, 'held', $7)`, [reservation.id, input.portfolioId,
          input.planId, reservation.amount.assetId, reservation.amount.decimals,
          reservation.amount.units.toString(), input.leaseUntil]);
      }
      await client.query(`INSERT INTO outbox(event_key, topic, payload) VALUES ($1, 'plan.reserved', $2::jsonb)`,
        [`plan.reserved:${input.planId}`, JSON.stringify({ portfolioId: input.portfolioId, planId: input.planId })]);
      return { id: input.planId, replay: false };
    };
    // A caller supplying a client must already be inside a transaction. This
    // allows P4 to plan and reserve under the same portfolio row lock.
    return transactionClient ? reserve(transactionClient) : transaction(this.pool, reserve);
  }

  async startExecution(portfolioId: string, planId: string, existingClient?: PoolClient): Promise<void> {
    identifier(portfolioId); identifier(planId);
    await transaction(this.pool, async (client) => {
      const portfolio = await lockedPortfolio(client, portfolioId);
      const plan = await client.query<{ revision: string; status: string }>(
        "SELECT revision, status FROM plans WHERE id = $1 AND portfolio_id = $2 FOR UPDATE", [planId, portfolioId]);
      requireInput(plan.rows[0]?.status === "reserved", "PLAN_NOT_RESERVED", "Plan is not reserved.");
      requireInput(BigInt(plan.rows[0].revision) === portfolio.revision, "STALE_REVISION", "Portfolio revision has changed.");
      const reservations = await client.query<{ invalid: string }>(`
        SELECT count(*) FILTER (WHERE state <> 'held' OR lease_until <= now()) AS invalid
        FROM reservations WHERE plan_id = $1`, [planId]);
      requireInput(BigInt(reservations.rows[0]?.invalid ?? "0") === 0n, "EXPIRED_RESERVATION", "Reservation is unavailable.");
      const active = await client.query("SELECT 1 FROM plans WHERE portfolio_id = $1 AND id <> $2 AND status IN ('executing', 'reconciling', 'unknown') LIMIT 1", [portfolioId, planId]);
      requireInput(active.rowCount === 0, "BATCH_ALREADY_EXECUTING", "Another batch is active.");
      await client.query("UPDATE plans SET status = 'executing' WHERE id = $1", [planId]);
    }, existingClient);
  }

  async markSubmitted(portfolioId: string, planId: string, reservationId: string, transactionId: string): Promise<void> {
    for (const id of [portfolioId, planId, reservationId, transactionId]) identifier(id);
    await transaction(this.pool, async (client) => {
      await lockedPortfolio(client, portfolioId);
      const plan = await client.query<{ status: string }>("SELECT status FROM plans WHERE id = $1 AND portfolio_id = $2 FOR UPDATE", [planId, portfolioId]);
      requireInput(plan.rows[0]?.status === "executing" || plan.rows[0]?.status === "reconciling", "PLAN_NOT_EXECUTING", "Plan is not executing.");
      const reservation = await client.query<{ state: string; lease_until: Date }>(
        "SELECT state, lease_until FROM reservations WHERE id = $1 AND plan_id = $2 FOR UPDATE", [reservationId, planId]);
      requireInput(reservation.rows[0]?.state === "held" && reservation.rows[0].lease_until > new Date(),
        "EXPIRED_RESERVATION", "Only a live held reservation may be submitted.");
      await client.query("INSERT INTO transactions(id, portfolio_id, plan_id, reservation_id, state) VALUES ($1, $2, $3, $4, 'unknown')",
        [transactionId, portfolioId, planId, reservationId]);
      await client.query("UPDATE reservations SET state = 'submitted', lease_until = NULL WHERE id = $1", [reservationId]);
      await client.query("UPDATE plans SET status = 'reconciling' WHERE id = $1", [planId]);
      await client.query("INSERT INTO outbox(event_key, topic, payload) VALUES ($1, 'transaction.reconcile', $2::jsonb)",
        [`transaction.reconcile:${transactionId}`, JSON.stringify({ portfolioId, planId, reservationId, transactionId })]);
    });
  }

  async expireHeldReservations(): Promise<number> {
    const candidates = await this.pool.query<{ portfolio_id: string }>(`
      SELECT DISTINCT portfolio_id FROM reservations WHERE state = 'held' AND lease_until <= now()`);
    let expired = 0;
    for (const { portfolio_id } of candidates.rows) {
      expired += await transaction(this.pool, async (client) => {
        // Use the same lock order as submission and planning: portfolio first,
        // then reservations/plans. A second expiry worker safely sees no rows.
        await lockedPortfolio(client, portfolio_id);
        const result = await client.query<{ plan_id: string }>(`
          UPDATE reservations SET state = 'released', lease_until = NULL
          WHERE portfolio_id = $1 AND state = 'held' AND lease_until <= now()
          RETURNING plan_id`, [portfolio_id]);
        for (const id of new Set(result.rows.map((row) => row.plan_id))) {
          await client.query(`UPDATE plans SET status = 'expired'
            WHERE id = $1 AND status IN ('reserved', 'executing')
              AND NOT EXISTS (SELECT 1 FROM reservations WHERE plan_id = $1 AND state = 'submitted')`, [id]);
        }
        return result.rowCount ?? 0;
      });
    }
    return expired;
  }

  async claimOutbox(workerId: string, leaseSeconds: number): Promise<OutboxEvent | null> {
    identifier(workerId);
    requireInput(Number.isSafeInteger(leaseSeconds) && leaseSeconds > 0, "INVALID_LEASE", "Lease seconds must be positive.");
    const result = await this.pool.query<{ id: string; event_key: string; topic: string; payload: unknown; attempts: number }>(`
      WITH candidate AS (
        SELECT id FROM outbox WHERE delivered_at IS NULL AND available_at <= now()
          AND (lease_until IS NULL OR lease_until <= now())
        ORDER BY available_at, id FOR UPDATE SKIP LOCKED LIMIT 1
      )
      UPDATE outbox o SET worker_id = $1, lease_until = now() + ($2::integer * interval '1 second'),
        attempts = attempts + 1
      FROM candidate WHERE o.id = candidate.id
      RETURNING o.id, o.event_key, o.topic, o.payload, o.attempts`, [workerId, leaseSeconds]);
    const row = result.rows[0];
    return row ? { id: row.id, eventKey: row.event_key, topic: row.topic, payload: row.payload, attempts: row.attempts } : null;
  }

  async acknowledgeOutbox(id: string, workerId: string): Promise<boolean> {
    identifier(workerId);
    const result = await this.pool.query(`UPDATE outbox SET delivered_at = now(), lease_until = NULL, worker_id = NULL
      WHERE id = $1 AND worker_id = $2 AND lease_until > now() AND delivered_at IS NULL`, [id, workerId]);
    return result.rowCount === 1;
  }

  async retryOutbox(id: string, workerId: string, delaySeconds: number): Promise<boolean> {
    identifier(workerId);
    requireInput(Number.isSafeInteger(delaySeconds) && delaySeconds >= 0, "INVALID_DELAY", "Retry delay must be nonnegative.");
    const result = await this.pool.query(`UPDATE outbox SET available_at = now() + ($3::integer * interval '1 second'),
      lease_until = NULL, worker_id = NULL
      WHERE id = $1 AND worker_id = $2 AND lease_until > now() AND delivered_at IS NULL`, [id, workerId, delaySeconds]);
    return result.rowCount === 1;
  }

  async recordBalances(portfolioId: string, expectedRevision: bigint, balances: readonly Amount[], reason: string): Promise<bigint> {
    identifier(portfolioId); identifier(reason);
    requireInput(expectedRevision >= 0n, "INVALID_REVISION", "Expected revision must be nonnegative.");
    return transaction(this.pool, async (client) => {
      const portfolio = await lockedPortfolio(client, portfolioId);
      requireInput(portfolio.revision === expectedRevision, "STALE_REVISION", "Portfolio revision has changed.");
      validateBalances(portfolio.chainId, balances);
      const settlement = await client.query<{ settlement_asset_id: string; settlement_decimals: number }>(
        "SELECT settlement_asset_id, settlement_decimals FROM portfolios WHERE id = $1", [portfolioId]);
      requireInput(balances.some((x) => x.assetId === settlement.rows[0]?.settlement_asset_id
        && x.decimals === settlement.rows[0]?.settlement_decimals), "MISSING_SETTLEMENT", "Settlement balance is required.");
      const unresolved = await client.query("SELECT 1 FROM reservations WHERE portfolio_id = $1 AND state = 'submitted' LIMIT 1", [portfolioId]);
      requireInput(unresolved.rowCount === 0, "UNRESOLVED_SUBMISSION", "Submitted inventory needs transaction reconciliation first.");
      await client.query("UPDATE reservations SET state = 'released', lease_until = NULL WHERE portfolio_id = $1 AND state = 'held'", [portfolioId]);
      await client.query("UPDATE plans SET status = 'stale' WHERE portfolio_id = $1 AND status IN ('reserved', 'executing')", [portfolioId]);
      await client.query("DELETE FROM balances WHERE portfolio_id = $1", [portfolioId]);
      for (const balance of balances) {
        await client.query("INSERT INTO balances(portfolio_id, asset_id, decimals, confirmed_units) VALUES ($1, $2, $3, $4)",
          [portfolioId, balance.assetId, balance.decimals, balance.units.toString()]);
      }
      const next = expectedRevision + 1n;
      await client.query("UPDATE portfolios SET revision = $2 WHERE id = $1", [portfolioId, next.toString()]);
      await client.query("INSERT INTO portfolio_revisions(portfolio_id, revision, reason) VALUES ($1, $2, $3)",
        [portfolioId, next.toString(), reason]);
      return next;
    });
  }
}
