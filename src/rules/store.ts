import { createHash } from "node:crypto";
import type { Pool, PoolClient } from "pg";
import { CoordinatorStore, type StoredCoordination } from "../coordinator/store.js";
import type { PortfolioSnapshot } from "../coordinator/plan.js";
import { identifier, requireInput } from "../domain/errors.js";
import { InstrumentRegistry, type Instrument } from "../domain/instrument.js";
import type { EventEvidence, ReferenceEvidence } from "../market-gate/evidence.js";
import { evaluateRule, type RuleEvaluation } from "./evaluate.js";
import { mapRuleProposals, type RuleAllocation, type RuleValuation } from "./planning.js";
import { activateRule, compileRule, compiledRuleDraft, type CompiledRule, type RuleState } from "./rules.js";

export const ruleJson = (value: unknown): string => JSON.stringify(value,
  (_key, item: unknown) => typeof item === "bigint" ? item.toString() : item);

function digest(value: unknown): string {
  const canonical = (item: unknown): unknown => {
    if (typeof item === "bigint") return item.toString();
    if (item instanceof Date) return item.toISOString();
    if (Array.isArray(item)) return item.map(canonical);
    if (item && typeof item === "object") return Object.fromEntries(Object.entries(item)
      .sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0).map(([key, v]) => [key, canonical(v)]));
    return item;
  };
  return createHash("sha256").update(JSON.stringify(canonical(value))).digest("hex");
}

async function transaction<T>(pool: Pool, run: (client: PoolClient) => Promise<T>, existingClient?: PoolClient): Promise<T> {
  if (existingClient) return run(existingClient);
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    try { const result = await run(client); await client.query("COMMIT"); return result; }
    catch (error) { await client.query("ROLLBACK"); throw error; }
  } finally { client.release(); }
}

interface PortfolioRow {
  revision: string;
  chain_id: number;
  settlement_asset_id: string;
  settlement_decimals: number;
  execution_paused: boolean;
}
async function lockPortfolio(client: PoolClient, id: string): Promise<PortfolioRow> {
  identifier(id);
  const rows = await client.query<PortfolioRow>(`SELECT revision, chain_id, settlement_asset_id,
    settlement_decimals, execution_paused FROM portfolios WHERE id = $1 FOR UPDATE`, [id]);
  requireInput(rows.rows[0] !== undefined, "UNKNOWN_PORTFOLIO", "Portfolio does not exist.");
  return rows.rows[0];
}
async function registry(client: PoolClient): Promise<InstrumentRegistry> {
  const rows = await client.query<{ body: Instrument }>("SELECT body FROM instruments ORDER BY instrument_id");
  return new InstrumentRegistry(rows.rows.map(row => row.body));
}
interface RuleRow {
  draft: unknown; rule_hash: string; review_hash: string; event_revision: string | null; state: RuleState;
}
export interface SavedRule {
  readonly rule: CompiledRule;
  readonly reviewHash: string;
  readonly eventRevision: string | null;
}
function decodeRule(row: RuleRow, instruments: InstrumentRegistry): SavedRule {
  const rule = compileRule(row.draft, instruments);
  requireInput(rule.hash === row.rule_hash && digest({ ruleHash: rule.hash, eventRevision: row.event_revision }) === row.review_hash,
    "RULE_RECORD_CHANGED", "Stored rule content does not match its review hash.");
  return { rule: Object.freeze({ ...rule, state: row.state }) as CompiledRule,
    reviewHash: row.review_hash, eventRevision: row.event_revision };
}

async function assertMutable(client: PoolClient, portfolioId: string): Promise<void> {
  const rows = await client.query(`SELECT 1 FROM reservations WHERE portfolio_id = $1 AND state = 'submitted'
    UNION ALL SELECT 1 FROM eoa_execution_legs WHERE portfolio_id = $1 AND state IN ('signed','unknown','included','reorged') LIMIT 1`, [portfolioId]);
  requireInput(rows.rowCount === 0, "UNRESOLVED_SUBMISSION", "Resolve pending execution before changing rules or allocations.");
}
async function advanceRevision(client: PoolClient, id: string, revision: bigint, reason: string): Promise<bigint> {
  const next = revision + 1n;
  await client.query("UPDATE reservations SET state = 'released', lease_until = NULL WHERE portfolio_id = $1 AND state = 'held'", [id]);
  await client.query("UPDATE plans SET status = 'stale' WHERE portfolio_id = $1 AND status IN ('reserved','executing')", [id]);
  await client.query("UPDATE portfolios SET revision = $2 WHERE id = $1", [id, next.toString()]);
  await client.query("INSERT INTO portfolio_revisions(portfolio_id, revision, reason) VALUES ($1,$2,$3)", [id, next.toString(), reason]);
  // Rule changes do not change balances. Carry forward only allocations valid at the prior revision.
  await client.query("UPDATE allocation_positions SET revision = $3 WHERE portfolio_id = $1 AND revision = $2", [id, revision.toString(), next.toString()]);
  return next;
}

export interface RuleBatchInput {
  readonly portfolioId: string;
  readonly batchId: string;
  readonly expectedRevision: bigint;
  readonly now: Date;
  readonly leaseUntil: Date;
  readonly snapshot: PortfolioSnapshot;
  readonly references: Readonly<Record<string, ReferenceEvidence>>;
  readonly events: Readonly<Record<string, EventEvidence>>;
  readonly valuations: readonly RuleValuation[];
}
export interface RuleBatch {
  readonly batchId: string;
  readonly replay: boolean;
  readonly evaluations: readonly { ruleId: string; version: number; evaluation: RuleEvaluation }[];
  readonly suppressed: readonly { ruleId: string; instrumentId: string; reason: "EVENT_CONTROL" }[];
  readonly coordination: StoredCoordination | null;
}
function decodeBatch(body: unknown): RuleBatch {
  return JSON.parse(JSON.stringify(body), (key: string, value: unknown) =>
    ["units", "requestedUnits", "acceptedUnits", "nettedNominal", "contingentUnits"].includes(key)
      && typeof value === "string" ? BigInt(value) : value) as RuleBatch;
}

/** Trusted internal commands. HTTP callers must authenticate portfolio ownership separately. */
export class RuleStore {
  constructor(private readonly pool: Pool) {}

  async list(portfolioId: string, existingClient?: PoolClient): Promise<readonly SavedRule[]> {
    return transaction(this.pool, async client => {
      await lockPortfolio(client, portfolioId);
      const instruments = await registry(client);
      const rows = await client.query<RuleRow>(`SELECT DISTINCT ON(rule_id) draft, rule_hash, review_hash, event_revision, state
        FROM rule_versions WHERE portfolio_id = $1 ORDER BY rule_id, version DESC`, [portfolioId]);
      return rows.rows.map(row => decodeRule(row, instruments));
    }, existingClient);
  }

  async saveDraft(input: { portfolioId: string; expectedRevision: bigint; draft: unknown; eventRevision: string | null }, existingClient?: PoolClient): Promise<SavedRule & { revision: bigint; replay: boolean }> {
    return transaction(this.pool, async client => {
      const portfolio = await lockPortfolio(client, input.portfolioId);
      const instruments = await registry(client);
      const rule = compileRule(input.draft, instruments);
      requireInput(rule.portfolioId === input.portfolioId, "WRONG_PORTFOLIO", "Draft must belong to this portfolio.");
      if (rule.kind === "earnings") { requireInput(input.eventRevision !== null, "EVENT_REVIEW_REQUIRED", "Review an event revision first."); identifier(input.eventRevision); }
      else requireInput(input.eventRevision === null, "UNEXPECTED_EVENT_REVISION", "Only event rules bind an event revision.");
      const budgets = rule.kind === "basket" ? [rule.contribution] : rule.kind === "price" && rule.side === "buy" ? [rule.quantity] : [];
      requireInput(budgets.every(value => value.assetId === portfolio.settlement_asset_id && value.decimals === portfolio.settlement_decimals),
        "DENOMINATION_MISMATCH", "Rule buys must use portfolio settlement denomination.");
      const draft = compiledRuleDraft(rule);
      const reviewHash = digest({ ruleHash: rule.hash, eventRevision: input.eventRevision });
      const existing = await client.query<RuleRow>(`SELECT draft,rule_hash,review_hash,event_revision,state FROM rule_versions
        WHERE portfolio_id=$1 AND rule_id=$2 AND version=$3`, [input.portfolioId, rule.id, rule.version]);
      if (existing.rows[0]) {
        requireInput(existing.rows[0].review_hash === reviewHash, "RULE_VERSION_CONFLICT", "A saved version cannot be rewritten.");
        return { ...decodeRule(existing.rows[0], instruments), revision: BigInt(portfolio.revision), replay: true };
      }
      requireInput(BigInt(portfolio.revision) === input.expectedRevision, "STALE_REVISION", "Portfolio revision changed.");
      await assertMutable(client, input.portfolioId);
      const latest = await client.query<{ version: string }>("SELECT version FROM rule_versions WHERE portfolio_id=$1 AND rule_id=$2 ORDER BY version DESC LIMIT 1", [input.portfolioId, rule.id]);
      requireInput(BigInt(rule.version) === BigInt(latest.rows[0]?.version ?? "0") + 1n, "RULE_VERSION_CONFLICT", "Rule versions must increase by one.");
      await client.query("UPDATE rule_versions SET state='PAUSED' WHERE portfolio_id=$1 AND rule_id=$2 AND state='ACTIVE'", [input.portfolioId, rule.id]);
      await client.query(`INSERT INTO rule_versions(portfolio_id,rule_id,version,draft,rule_hash,review_hash,event_revision,state)
        VALUES ($1,$2,$3,$4::jsonb,$5,$6,$7,'READY_FOR_REVIEW')`, [input.portfolioId, rule.id, rule.version, ruleJson(draft), rule.hash, reviewHash, input.eventRevision]);
      const revision = await advanceRevision(client, input.portfolioId, input.expectedRevision, "rule-draft-saved");
      await client.query(`INSERT INTO rule_changes(portfolio_id,revision,rule_id,version,review_hash,state)
        VALUES ($1,$2,$3,$4,$5,'READY_FOR_REVIEW')`, [input.portfolioId,revision.toString(),rule.id,rule.version,reviewHash]);
      return { rule, reviewHash, eventRevision: input.eventRevision, revision, replay: false };
    }, existingClient);
  }

  async setState(input: { portfolioId: string; ruleId: string; version: number; expectedRevision: bigint;
    reviewedHash: string; state: "ACTIVE" | "PAUSED"; now: Date }, existingClient?: PoolClient): Promise<bigint> {
    identifier(input.ruleId);
    requireInput(input.state === "ACTIVE" || input.state === "PAUSED", "INVALID_RULE_STATE", "Choose active or paused.");
    return transaction(this.pool, async client => {
      const portfolio = await lockPortfolio(client, input.portfolioId);
      const rows = await client.query<RuleRow>(`SELECT draft,rule_hash,review_hash,event_revision,state FROM rule_versions
        WHERE portfolio_id=$1 AND rule_id=$2 ORDER BY version DESC LIMIT 1`, [input.portfolioId, input.ruleId]);
      requireInput(rows.rows[0] !== undefined, "UNKNOWN_RULE", "Rule does not exist.");
      const saved = decodeRule(rows.rows[0], await registry(client));
      requireInput(saved.rule.version === input.version && saved.reviewHash === input.reviewedHash, "RULE_NOT_REVIEWED", "Review the current exact version and event revision.");
      if (saved.rule.state === input.state) return BigInt(portfolio.revision);
      requireInput(BigInt(portfolio.revision) === input.expectedRevision, "STALE_REVISION", "Portfolio revision changed.");
      await assertMutable(client, input.portfolioId);
      if (input.state === "ACTIVE") activateRule({ ...saved.rule, state: "READY_FOR_REVIEW" }, saved.rule.hash, input.now);
      await client.query("UPDATE rule_versions SET state=$4 WHERE portfolio_id=$1 AND rule_id=$2 AND version=$3", [input.portfolioId, input.ruleId, input.version, input.state]);
      const revision = await advanceRevision(client, input.portfolioId, input.expectedRevision, input.state === "ACTIVE" ? "rule-activated" : "rule-paused");
      await client.query(`INSERT INTO rule_changes(portfolio_id,revision,rule_id,version,review_hash,state)
        VALUES ($1,$2,$3,$4,$5,$6)`, [input.portfolioId,revision.toString(),input.ruleId,input.version,input.reviewedHash,input.state]);
      return revision;
    }, existingClient);
  }

  /** A trusted reconciliation step supplies the complete allocation ownership snapshot. */
  async recordAllocations(portfolioId: string, expectedRevision: bigint,
    entries: readonly Omit<RuleAllocation, "revision">[]): Promise<bigint> {
    return transaction(this.pool, async client => {
      const portfolio = await lockPortfolio(client, portfolioId);
      requireInput(BigInt(portfolio.revision) === expectedRevision, "STALE_REVISION", "Portfolio revision changed.");
      await assertMutable(client, portfolioId);
      const instruments = await registry(client), seen = new Set<string>(), sums = new Map<string, bigint>();
      for (const item of entries) {
        identifier(item.allocationId);
        const instrument = instruments.get(item.instrumentId), key = `${item.allocationId}/${item.instrumentId}`;
        requireInput(!seen.has(key) && typeof item.units === "bigint" && item.units >= 0n, "INVALID_ALLOCATION", "Allocation quantities must be unique and nonnegative.");
        seen.add(key); sums.set(instrument.assetId, (sums.get(instrument.assetId) ?? 0n) + item.units);
      }
      for (const [assetId, units] of sums) {
        const row = await client.query<{ confirmed_units: string }>("SELECT confirmed_units FROM balances WHERE portfolio_id=$1 AND asset_id=$2", [portfolioId, assetId]);
        requireInput(row.rows[0] !== undefined && units <= BigInt(row.rows[0].confirmed_units), "ALLOCATION_OVERLAP", "Allocation quantities exceed confirmed holdings.");
      }
      const revision = await advanceRevision(client, portfolioId, expectedRevision, "allocations-reconciled");
      await client.query("DELETE FROM allocation_positions WHERE portfolio_id=$1", [portfolioId]);
      for (const item of entries) await client.query(`INSERT INTO allocation_positions(portfolio_id,allocation_id,instrument_id,revision,units)
        VALUES ($1,$2,$3,$4,$5)`, [portfolioId, item.allocationId, item.instrumentId, revision.toString(), item.units.toString()]);
      return revision;
    });
  }

  async plan(input: RuleBatchInput): Promise<RuleBatch> {
    identifier(input.batchId);
    requireInput(Number.isFinite(input.now.getTime()), "INVALID_CLOCK", "Valid schedule clock required.");
    const requestHash = digest({ ...input, leaseUntil: null });
    return transaction(this.pool, async client => {
      const portfolio = await lockPortfolio(client, input.portfolioId);
      const prior = await client.query<{ request_hash: string; body: unknown }>("SELECT request_hash,body FROM rule_batches WHERE portfolio_id=$1 AND batch_id=$2", [input.portfolioId, input.batchId]);
      if (prior.rows[0]) {
        requireInput(prior.rows[0].request_hash === requestHash, "IDEMPOTENCY_CONFLICT", "Scheduling retry changed its input.");
        return { ...decodeBatch(prior.rows[0].body), replay: true };
      }
      requireInput(BigInt(portfolio.revision) === input.expectedRevision && input.snapshot.revision === input.expectedRevision, "STALE_REVISION", "Scheduling snapshot revision changed.");
      const instruments = await registry(client);
      const rows = await client.query<RuleRow>("SELECT draft,rule_hash,review_hash,event_revision,state FROM rule_versions WHERE portfolio_id=$1 AND state='ACTIVE' ORDER BY rule_id", [input.portfolioId]);
      const seenRows = await client.query<{ occurrence_id: string }>("SELECT occurrence_id FROM rule_occurrences WHERE portfolio_id=$1", [input.portfolioId]);
      const seen = new Set(seenRows.rows.map(x => x.occurrence_id));
      const evaluated = rows.rows.map(row => {
        const saved = decodeRule(row, instruments), rule = saved.rule;
        let evaluation: RuleEvaluation;
        if (portfolio.execution_paused) evaluation = { status: "inactive", reason: "PORTFOLIO_PAUSED", occurrenceId: null, ruleHash: rule.hash, intents: [] };
        else if (rule.kind === "earnings" && (rule.expiresAt === null || input.now.getTime() < Date.parse(rule.expiresAt))
          && input.events[rule.underlyingId]?.revision !== saved.eventRevision)
          evaluation = { status: "suspended", reason: "EVENT_REVISION_CHANGED", occurrenceId: null, ruleHash: rule.hash, intents: [] };
        else {
          const reference = rule.kind === "price" ? input.references[rule.underlyingId] : undefined;
          const event = rule.kind === "earnings" ? input.events[rule.underlyingId] : undefined;
          evaluation = evaluateRule(rule, { now: input.now, seenOccurrenceIds: seen,
            ...(reference ? { reference } : {}), ...(event ? { event } : {}) });
        }
        return { rule, evaluation };
      });
      const allocations = await client.query<{ allocation_id: string; instrument_id: string; revision: string; units: string }>("SELECT allocation_id,instrument_id,revision,units FROM allocation_positions WHERE portfolio_id=$1 ORDER BY allocation_id,instrument_id", [input.portfolioId]);
      const mapped = mapRuleProposals(evaluated, input.snapshot, input.valuations,
        allocations.rows.map(row => ({ allocationId: row.allocation_id, instrumentId: row.instrument_id, revision: BigInt(row.revision), units: BigInt(row.units) })));
      let coordination: StoredCoordination | null = null;
      const body: RuleBatch = { batchId: input.batchId, replay: false,
        evaluations: evaluated.map(x => ({ ruleId: x.rule.id, version: x.rule.version, evaluation: x.evaluation })),
        suppressed: mapped.suppressed, coordination };
      await client.query("INSERT INTO rule_batches(portfolio_id,batch_id,revision,request_hash,body,inputs) VALUES ($1,$2,$3,$4,$5::jsonb,$6::jsonb)", [input.portfolioId, input.batchId, input.expectedRevision.toString(), requestHash, ruleJson(body), ruleJson({ now: input.now, snapshot: input.snapshot, references: input.references, events: input.events, valuations: input.valuations })]);
      const actionable = evaluated.filter(x => x.evaluation.status === "ready" && x.evaluation.occurrenceId !== null
        && !(x.rule.kind === "earnings" && x.rule.action === "freeze-buy"));
      for (const item of actionable) await client.query(`INSERT INTO rule_occurrences(portfolio_id,rule_id,version,occurrence_id,batch_id)
        VALUES ($1,$2,$3,$4,$5)`, [input.portfolioId, item.rule.id, item.rule.version, item.evaluation.occurrenceId, input.batchId]);
      if (actionable.length > 0) {
        const identity = digest({ portfolioId: input.portfolioId, batchId: input.batchId }).slice(0, 40);
        coordination = await new CoordinatorStore(this.pool).coordinateAndReserve({ portfolioId: input.portfolioId,
          expectedRevision: input.expectedRevision, planId: `rule-plan-${identity}`, occurrenceId: `rule-batch-${identity}`,
          idempotencyKey: `rule-batch-${identity}`, leaseUntil: input.leaseUntil, snapshot: input.snapshot, proposals: mapped.proposals }, client);
      }
      const result: RuleBatch = { ...body, coordination };
      await client.query("UPDATE rule_batches SET body=$3::jsonb WHERE portfolio_id=$1 AND batch_id=$2", [input.portfolioId, input.batchId, ruleJson(result)]);
      return result;
    });
  }
}
