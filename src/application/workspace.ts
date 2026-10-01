import { randomUUID } from "node:crypto";
import type { Pool, PoolClient } from "pg";
import { amount, nativeAssetId } from "../domain/amount.js";
import { identifier, requireInput } from "../domain/errors.js";
import type { Instrument } from "../domain/instrument.js";
import { EoaExecutionStore } from "../execution/store.js";
import { Ledger } from "../ledger/ledger.js";
import { BSC_USDT_ASSET } from "../market-gate/chainlink-bsc.js";
import { compiledRuleDraft, type CompiledRule } from "../rules/rules.js";
import { RuleStore } from "../rules/store.js";
import { applicationTransaction, SessionStore } from "./session.js";
import type { PortfolioSummary, WorkspaceView } from "./contracts.js";

export function commandObject(value: unknown, keys: readonly string[]): Record<string, unknown> {
  requireInput(value !== null && typeof value === "object" && !Array.isArray(value), "INVALID_COMMAND", "An object command is required.");
  const record = value as Record<string, unknown>;
  requireInput(Object.keys(record).length === keys.length && keys.every(key => Object.hasOwn(record,key)), "INVALID_COMMAND", "Command fields must match the selected operation exactly.");
  return record;
}
function revision(value: unknown): bigint {
  requireInput(typeof value === "string" && /^(0|[1-9][0-9]{0,18})$/.test(value), "INVALID_REVISION", "A canonical revision string is required.");
  const parsed = BigInt(value);
  requireInput(parsed <= 9223372036854775807n, "INVALID_REVISION", "Revision exceeds the storage range.");
  return parsed;
}
function interpretation(rule: CompiledRule): string {
  if (rule.kind === "basket") return `Allocate ${rule.contribution.units} settlement base units ${rule.schedule.frequency} at ${rule.schedule.localTime} (${rule.schedule.zone})${rule.schedule.weekday === null ? "" : ` on weekday ${rule.schedule.weekday}`}, within ${rule.schedule.windowMinutes} minutes. Weights: ${rule.targets.map(x => `${x.instrumentId}: ${x.weightBps / 100}%`).join(", ")}.`;
  if (rule.kind === "price") return `${rule.side} ${rule.quantity.units} base units when ${rule.underlyingId} is ${rule.comparator} ${rule.pricePerShareRaw} USD-18 per share. Require ${rule.referenceSource}, age ≤ ${rule.maxReferenceAgeMs}ms.`;
  return `${rule.action === "freeze-buy" ? "Freeze buys" : `Reduce ${rule.reductionBps / 100}%`} for ${rule.underlyingId}, scope ${rule.scope}${rule.allocationId === null ? "" : ` (${rule.allocationId})`}. Require the reviewed confirmed event revision.`;
}
interface PortfolioRow { id: string; revision: string; execution_paused: boolean; data_mode: string;
  chain_id: number; settlement_asset_id: string; settlement_decimals: number; active_policy_id: string | null }
const summary = (row: PortfolioRow): PortfolioSummary => ({ id: row.id,revision:row.revision,paused:row.execution_paused,dataMode:row.data_mode });
async function owned(client: PoolClient, wallet: string, id: string): Promise<PortfolioRow> {
  identifier(id);
  const result = await client.query<PortfolioRow>("SELECT * FROM portfolios WHERE id=$1 AND owner_wallet=$2 AND chain_id=56 FOR UPDATE", [id,wallet]);
  requireInput(result.rows[0] !== undefined, "PORTFOLIO_UNAVAILABLE", "This portfolio is unavailable to your wallet.");
  return result.rows[0];
}

/** Application boundary; authentication and backend mutation commit together. */
export class WorkspaceService {
  readonly sessions: SessionStore;
  constructor(private readonly pool: Pool, origin: string) { this.sessions = new SessionStore(pool,origin); }

  async read(token: string, now: Date, selected?: string): Promise<WorkspaceView> {
    return applicationTransaction(this.pool, async client => {
      const session = await this.sessions.authenticate(token,now,client);
      const rows = await client.query<PortfolioRow>("SELECT * FROM portfolios WHERE owner_wallet=$1 AND chain_id=56 ORDER BY id", [session.wallet]);
      const portfolioId = selected ?? rows.rows[0]?.id;
      const registered = await client.query<{ body: Instrument }>("SELECT body FROM instruments ORDER BY instrument_id");
      const instruments = registered.rows.map(x => x.body).filter(x => x.chainId === 56)
        .map(x => ({ instrumentId:x.instrumentId,ticker:x.ticker,issuerId:x.issuerId,assetId:x.assetId,decimals:x.decimals,underlyingId:x.underlyingId,referenceSource:x.referenceSource }));
      const view: WorkspaceView = { wallet:session.wallet,sessionExpiresAt:session.expiresAt,portfolios:rows.rows.map(summary),portfolio:null,instruments,tradingEnabled:false };
      if (portfolioId === undefined) return view;
      const row = await owned(client,session.wallet,portfolioId);
      const balances = await client.query<{ asset_id: string; decimals: number; confirmed_units: string; reserved_units: string }>(`SELECT b.asset_id,b.decimals,b.confirmed_units,
        coalesce((SELECT sum(r.units) FROM reservations r WHERE r.portfolio_id=b.portfolio_id AND r.asset_id=b.asset_id
          AND r.state IN ('held','submitted')),0)::text AS reserved_units
        FROM balances b WHERE b.portfolio_id=$1 ORDER BY asset_id`, [portfolioId]);
      const rules = await new RuleStore(this.pool).list(portfolioId,client);
      const decisions = await client.query<{ id:string;revision:string;kind:string;body:unknown;recorded_at:Date }>("SELECT id,revision,kind,body,recorded_at FROM decision_records WHERE portfolio_id=$1 ORDER BY recorded_at DESC,id LIMIT 100", [portfolioId]);
      const batches = await client.query<{ batch_id:string;revision:string;body:unknown;recorded_at:Date }>("SELECT batch_id,revision,body,recorded_at FROM rule_batches WHERE portfolio_id=$1 ORDER BY recorded_at DESC,batch_id LIMIT 100", [portfolioId]);
      // Explicit projection excludes signed transactions, owner signatures and authorization nonces.
      const receipts = await client.query<{ id:string;plan_id:string;tx_hash:string;state:string;included_block:string|null;
        receipt_success:boolean|null;spent_raw:string|null;received_raw:string|null;receipt_effects_hash:string|null;reconciled_at:Date|null }>(`SELECT id,plan_id,tx_hash,state,included_block,receipt_success,spent_raw,
        received_raw,receipt_effects_hash,reconciled_at FROM eoa_execution_legs WHERE portfolio_id=$1 ORDER BY created_at DESC,id LIMIT 100`, [portfolioId]);
      view.portfolio = { ...summary(row),chainId:row.chain_id,settlement:{ assetId:row.settlement_asset_id,decimals:row.settlement_decimals },policyConfigured:row.active_policy_id !== null,
        balances:balances.rows.map(x => ({ assetId:x.asset_id,decimals:x.decimals,confirmedUnits:x.confirmed_units,reservedUnits:x.reserved_units })),
        rules:rules.map(x => ({ id:x.rule.id,version:x.rule.version,kind:x.rule.kind,state:x.rule.state,reviewHash:x.reviewHash,eventRevision:x.eventRevision,interpretation:interpretation(x.rule),draft:compiledRuleDraft(x.rule) })),
        decisions:decisions.rows.map(x => ({ id:x.id,revision:x.revision,kind:x.kind,body:x.body,recordedAt:x.recorded_at.toISOString() })),
        batches:batches.rows.map(x => ({ batchId:x.batch_id,revision:x.revision,body:x.body,recordedAt:x.recorded_at.toISOString() })),
        receipts:receipts.rows.map(x => ({ id:x.id,planId:x.plan_id,transactionHash:x.tx_hash,state:x.state,includedBlock:x.included_block,receiptSuccess:x.receipt_success,spentRaw:x.spent_raw,receivedRaw:x.received_raw,effectProofHash:x.receipt_effects_hash,reconciledAt:x.reconciled_at?.toISOString() ?? null })) };
      view.portfolios = view.portfolios.map(x => x.id === row.id ? summary(row) : x);
      return view;
    });
  }

  async command(token: string, now: Date, input: unknown): Promise<{ portfolioId: string; revision: string }> {
    requireInput(input !== null && typeof input === "object" && !Array.isArray(input), "INVALID_COMMAND", "An object command is required.");
    const kind = (input as Record<string,unknown>).kind;
    const fields: Readonly<Record<string,readonly string[]>> = {
      "create-portfolio":["kind"], "save-rule":["kind","portfolioId","expectedRevision","draft"],
      "set-rule-state":["kind","portfolioId","expectedRevision","ruleId","version","reviewedHash","state"],
      "set-pause":["kind","portfolioId","expectedRevision","paused"],
    };
    requireInput(typeof kind === "string" && Object.hasOwn(fields,kind), "INVALID_COMMAND", "Unknown workspace command.");
    const command = commandObject(input,fields[kind]!);
    return applicationTransaction(this.pool, async client => {
      const session = await this.sessions.authenticate(token,now,client);
      if (kind === "create-portfolio") {
        await client.query("SELECT pg_advisory_xact_lock(hashtext($1))", [`workspace:${session.wallet}`]);
        const prior = await client.query<{ id:string;revision:string }>("SELECT id,revision FROM portfolios WHERE owner_wallet=$1 AND chain_id=56 ORDER BY id LIMIT 1", [session.wallet]);
        if (prior.rows[0]) return { portfolioId:prior.rows[0].id,revision:prior.rows[0].revision };
        const id = `portfolio-${randomUUID()}`, settlement = { assetId:BSC_USDT_ASSET,decimals:18 };
        await new Ledger(this.pool).createPortfolio({ id,chainId:56,settlement,
          balances:[amount(0n,settlement),amount(0n,{ assetId:nativeAssetId(56),decimals:18 })] },client);
        const next = await new EoaExecutionStore(this.pool).bindOwnerWallet(id,session.wallet,0n,client);
        return { portfolioId:id,revision:next.toString() };
      }
      requireInput(typeof command.portfolioId === "string", "INVALID_COMMAND", "Portfolio ID is required.");
      const portfolio = await owned(client,session.wallet,command.portfolioId);
      const expectedRevision = revision(command.expectedRevision);
      // HTTP retries must reload the current record even if a core idempotent call would replay.
      requireInput(BigInt(portfolio.revision) === expectedRevision, "STALE_REVISION", "Portfolio changed. Refresh and review its current state.");
      let next: bigint;
      const rules = new RuleStore(this.pool);
      if (kind === "save-rule") {
        // Event revisions are trusted evidence, never a browser-supplied assertion.
        const draft = command.draft as Record<string,unknown> | null;
        requireInput(draft !== null && typeof draft === "object" && draft.kind !== "earnings", "EVENT_SOURCE_UNAVAILABLE", "Saving earnings controls requires server-reviewed event evidence, which is not connected yet.");
        next = (await rules.saveDraft({ portfolioId:portfolio.id,expectedRevision,draft:command.draft,eventRevision:null },client)).revision;
      } else if (kind === "set-rule-state") {
        requireInput(typeof command.ruleId === "string" && Number.isSafeInteger(command.version)
          && typeof command.reviewedHash === "string" && (command.state === "ACTIVE" || command.state === "PAUSED"), "INVALID_COMMAND", "Review the saved rule before changing its state.");
        next = await rules.setState({ portfolioId:portfolio.id,expectedRevision,ruleId:command.ruleId,
          version:command.version as number,reviewedHash:command.reviewedHash,state:command.state,now },client);
      } else {
        requireInput(typeof command.paused === "boolean", "INVALID_COMMAND", "A boolean pause state is required.");
        next = await new EoaExecutionStore(this.pool).setPaused(portfolio.id,expectedRevision,command.paused,client);
      }
      return { portfolioId:portfolio.id,revision:next.toString() };
    });
  }
}
