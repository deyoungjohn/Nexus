import { Transaction, TypedDataEncoder } from "ethers";
import type { Pool, PoolClient } from "pg";
import { identifier, requireInput } from "../domain/errors.js";
import { tokenAssetId } from "../domain/amount.js";
import { amount, type Amount } from "../domain/amount.js";
import type { GateRequest } from "../market-gate/evidence.js";
import { eoaApprovalTypedData, verifySignedEoaSwap,
  type ApprovalMetadata, type EoaLegApproval } from "./eoa.js";
import { classifyEoaObservation, type EoaChainObservation,
  type EoaLegState, type EoaRecoveryDecision } from "./recovery.js";
import { verifyEoaReceiptEffects, type EoaReceiptEffectProof } from "./receipt-effects.js";
import { securityDigest } from "../security/token-security.js";
import { executionJson } from "./execution-json.js";
import type { CanonicalAllowanceProof } from "./allowance-proof.js";
import type { NonceHistoryAnchor } from "./nonce-history.js";

async function transaction<T>(pool: Pool, run: (client: PoolClient) => Promise<T>,
  existingClient?: PoolClient, recoveryConnection?: PoolClient): Promise<T> {
  if (existingClient) return run(existingClient);
  const client = recoveryConnection ?? await pool.connect();
  try {
    await client.query("BEGIN");
    try { const result = await run(client); await client.query("COMMIT"); return result; }
    catch (error) { await client.query("ROLLBACK"); throw error; }
  } finally { if (!recoveryConnection) client.release(); }
}

interface PortfolioRow { revision: string; chain_id: number; owner_wallet: string | null;
  execution_paused: boolean }

async function lockPortfolio(client: PoolClient, portfolioId: string): Promise<PortfolioRow> {
  const result = await client.query<PortfolioRow>(
    "SELECT revision, chain_id, owner_wallet, execution_paused FROM portfolios WHERE id = $1 FOR UPDATE", [portfolioId]);
  requireInput(result.rows[0] !== undefined, "UNKNOWN_PORTFOLIO", "Portfolio does not exist.");
  return result.rows[0];
}

async function invalidateHeld(client: PoolClient, portfolioId: string): Promise<void> {
  await client.query("UPDATE reservations SET state = 'released', lease_until = NULL WHERE portfolio_id = $1 AND state = 'held'", [portfolioId]);
  await client.query(`UPDATE plans SET status = 'stale' WHERE portfolio_id = $1
    AND status IN ('reserved', 'executing') AND NOT EXISTS
      (SELECT 1 FROM reservations WHERE plan_id = plans.id AND state = 'submitted')`, [portfolioId]);
}

export interface PrepareSignedEoaLeg {
  readonly reservationId: string;
  readonly approval: EoaLegApproval;
  readonly ownerSignature: string;
  readonly rawSignedTransaction: string;
  readonly freshRequest: GateRequest;
  readonly approvedRequest?: GateRequest;
  /** Read from the trusted current plan and policy record, never client input. */
  readonly expected: ApprovalMetadata;
}

export interface FinalizedBalanceSnapshot {
  readonly portfolioId: string;
  readonly legId: string;
  readonly expectedRevision: bigint;
  readonly wallet: string;
  readonly sourceBlock: bigint;
  readonly sourceBlockHash: string;
  readonly balances: readonly Amount[];
  readonly receiptEffects: EoaReceiptEffectProof;
  readonly allowanceProof?:CanonicalAllowanceProof;
  readonly recoverySource?: RecoveryEvidenceSource;
}

export interface RecoveryEvidenceSource {
  readonly attemptId: string;
  readonly sourceId: string;
}

async function recordRecoveryEvidence(client: PoolClient, legId: string,
  source: RecoveryEvidenceSource | undefined, kind: "observation" | "reconciliation",
  block: bigint | null, blockHash: string | null, evidence: unknown): Promise<void> {
  if (source === undefined) return; // Existing offline callers remain compatible.
  identifier(source.sourceId);
  requireInput(/^[0-9a-f-]{36}$/.test(source.attemptId), "INVALID_RECOVERY_SOURCE", "Recovery attempt required.");
  const result = await client.query(`INSERT INTO eoa_recovery_evidence
    (attempt_id, leg_id, source_id, kind, block_number, block_hash, evidence)
    SELECT a.id, a.leg_id, $3, $4, $5, $6, $7::jsonb FROM eoa_recovery_attempts a
    WHERE a.id = $1 AND a.leg_id = $2 AND a.finished_at IS NULL
      AND EXISTS (SELECT 1 FROM jsonb_array_elements(a.configuration->'sources') s WHERE s->>'id' = $3)`,
  [source.attemptId, legId, source.sourceId, kind, block?.toString() ?? null,
    blockHash?.toLowerCase() ?? null,
    JSON.stringify(evidence, (_key, value: unknown) => typeof value === "bigint" ? value.toString() : value)]);
  requireInput(result.rowCount === 1, "INVALID_RECOVERY_SOURCE", "Source must belong to the active persisted attempt.");
}

export interface EoaRecoveryContext {
  readonly requireZeroAllowance?:boolean;
  readonly nonceHistoryAnchor?: NonceHistoryAnchor;
  readonly portfolioId: string;
  readonly legId: string;
  readonly chainId: number;
  readonly revision: bigint;
  readonly wallet: string;
  readonly transactionHash: string;
  readonly nonce: bigint;
  readonly tokenIn: string;
  readonly tokenOut: string;
  readonly router: string;
  readonly transactionValue: bigint;
  readonly inputRaw: bigint;
  readonly minimumOutputRaw: bigint;
  readonly state: EoaLegState;
  readonly includedBlock: bigint | null;
  readonly includedBlockHash: string | null;
  readonly receiptSuccess: boolean | null;
  readonly balances: readonly Amount[];
}

/** Database persistence only: no RPC, signer or broadcaster is available here. */
export class EoaExecutionStore {
  constructor(private readonly pool: Pool, private readonly recoveryConnection?: PoolClient) {}

  private transaction<T>(run: (client: PoolClient) => Promise<T>, existingClient?: PoolClient): Promise<T> {
    return transaction(this.pool, run, existingClient, this.recoveryConnection);
  }

  /** Trusted chain adapters derive transaction identity and tracked assets from persisted state. */
  async loadRecoveryContext(portfolioId: string, legId: string): Promise<EoaRecoveryContext> {
    identifier(portfolioId); identifier(legId);
    return this.transaction(async (client) => {
      const portfolio = await lockPortfolio(client, portfolioId);
      const leg = await client.query<{ chain_id: number; wallet: string; tx_hash: string;
        tx_nonce: string; token_in: string; token_out: string; input_raw: string;
        minimum_output_raw: string; state: EoaLegState; included_block: string | null;
        included_block_hash: string | null; receipt_success: boolean | null;
        signed_transaction: string; pilot_profile_hash:string|null }>(
        `SELECT chain_id, wallet, tx_hash, tx_nonce, token_in, token_out,
          input_raw, minimum_output_raw, state, included_block,
          included_block_hash, receipt_success, signed_transaction,pilot_profile_hash
          FROM eoa_execution_legs WHERE id = $1 AND portfolio_id = $2`, [legId, portfolioId]);
      const row = leg.rows[0];
      requireInput(row !== undefined && row.chain_id === portfolio.chain_id
        && row.wallet === portfolio.owner_wallet,
      "INVALID_RECOVERY_CONTEXT", "Persisted EOA leg and owner must match.");
      const signed = Transaction.from(row.signed_transaction);
      requireInput(signed.to !== null && signed.hash?.toLowerCase() === row.tx_hash,
        "INVALID_RECOVERY_CONTEXT", "Signed transaction identity must match persisted leg.");
      const stored = await client.query<{ asset_id: string; decimals: number;
        confirmed_units: string }>(
        "SELECT asset_id, decimals, confirmed_units FROM balances WHERE portfolio_id = $1",
        [portfolioId]);
      const anchors = await client.query<{source_block:string;source_block_hash:string;tx_nonce:string}>(
        `SELECT source_block,source_block_hash,tx_nonce FROM chain_snapshot_reviews WHERE portfolio_id=$1
          AND wallet=$2 AND kind='bootstrap' AND activated_revision IS NOT NULL ORDER BY source_block LIMIT 1`,
        [portfolioId,row.wallet]);
      const anchor=anchors.rows[0];
      return { portfolioId, legId,requireZeroAllowance:row.pilot_profile_hash!==null, chainId: portfolio.chain_id,
        ...(anchor ? {nonceHistoryAnchor:{blockNumber:BigInt(anchor.source_block),blockHash:anchor.source_block_hash,
          nonce:BigInt(anchor.tx_nonce)}} : {}),
        revision: BigInt(portfolio.revision), wallet: row.wallet,
        transactionHash: row.tx_hash, nonce: BigInt(row.tx_nonce),
        tokenIn: row.token_in, tokenOut: row.token_out,
        router: signed.to, transactionValue: signed.value,
        inputRaw: BigInt(row.input_raw), minimumOutputRaw: BigInt(row.minimum_output_raw),
        state: row.state, includedBlock: row.included_block === null
          ? null : BigInt(row.included_block), includedBlockHash: row.included_block_hash,
        receiptSuccess: row.receipt_success,
        balances: stored.rows.map(value => amount(BigInt(value.confirmed_units),
          { assetId: value.asset_id, decimals: value.decimals })) };
    });
  }

  /** Caller must first verify owner control via a separate authenticated challenge. */
  async bindOwnerWallet(portfolioId: string, wallet: string, expectedRevision: bigint, existingClient?: PoolClient): Promise<bigint> {
    identifier(portfolioId);
    requireInput(/^0x[0-9a-fA-F]{40}$/.test(wallet), "INVALID_WALLET", "Valid EOA address required.");
    return this.transaction(async (client) => {
      const portfolio = await lockPortfolio(client, portfolioId);
      requireInput(BigInt(portfolio.revision) === expectedRevision, "STALE_REVISION", "Portfolio revision changed.");
      requireInput(portfolio.owner_wallet === null, "OWNER_ALREADY_BOUND", "Owner wallet is already bound.");
      const active = await client.query(`SELECT 1 FROM eoa_execution_legs WHERE portfolio_id = $1
        AND state IN ('signed', 'unknown', 'included', 'reorged') LIMIT 1`, [portfolioId]);
      requireInput(active.rowCount === 0, "UNRESOLVED_SUBMISSION", "Unresolved transaction blocks owner change.");
      const submitted = await client.query(
        "SELECT 1 FROM reservations WHERE portfolio_id = $1 AND state = 'submitted' LIMIT 1", [portfolioId]);
      requireInput(submitted.rowCount === 0, "UNRESOLVED_SUBMISSION", "Submitted inventory blocks owner change.");
      await invalidateHeld(client, portfolioId);
      const next = expectedRevision + 1n;
      await client.query("UPDATE portfolios SET owner_wallet = $2, execution_paused = true, revision = $3 WHERE id = $1",
        [portfolioId, wallet.toLowerCase(), next.toString()]);
      await client.query("INSERT INTO portfolio_revisions(portfolio_id, revision, reason) VALUES ($1, $2, 'eoa-owner-bound')",
        [portfolioId, next.toString()]);
      return next;
    }, existingClient);
  }

  /** A trusted owner command changes the revision and invalidates unsigned plans. */
  async setPaused(portfolioId: string, expectedRevision: bigint, paused: boolean, existingClient?: PoolClient): Promise<bigint> {
    identifier(portfolioId);
    requireInput(typeof paused === "boolean", "INVALID_PAUSE", "Pause flag required.");
    return this.transaction(async (client) => {
      const portfolio = await lockPortfolio(client, portfolioId);
      requireInput(BigInt(portfolio.revision) === expectedRevision, "STALE_REVISION", "Portfolio revision changed.");
      requireInput(portfolio.owner_wallet !== null, "OWNER_UNBOUND", "EOA owner must be bound first.");
      requireInput(portfolio.execution_paused !== paused, "PAUSE_UNCHANGED", "Pause state already matches.");
      if (!paused) {
        const unresolved = await client.query(`SELECT 1 FROM eoa_execution_legs
          WHERE portfolio_id = $1 AND state IN ('signed', 'unknown', 'included', 'reorged') LIMIT 1`,
        [portfolioId]);
        const submitted = await client.query(`SELECT 1 FROM reservations
          WHERE portfolio_id = $1 AND state = 'submitted' LIMIT 1`, [portfolioId]);
        requireInput(unresolved.rowCount === 0 && submitted.rowCount === 0,
          "UNRESOLVED_SUBMISSION", "Resolve or repair pending execution before unpausing.");
      }
      await invalidateHeld(client, portfolioId);
      const next = expectedRevision + 1n;
      await client.query("UPDATE portfolios SET execution_paused = $2, revision = $3 WHERE id = $1",
        [portfolioId, paused, next.toString()]);
      await client.query("INSERT INTO portfolio_revisions(portfolio_id, revision, reason) VALUES ($1, $2, $3)",
        [portfolioId, next.toString(), paused ? "eoa-paused" : "eoa-unpaused"]);
      return next;
    }, existingClient);
  }

  /** Atomically freezes a verified signed transaction before any network call. */
  async persistSignedLeg(input: PrepareSignedEoaLeg, existingClient?: PoolClient): Promise<{ hash: string; replay: boolean }> {
    identifier(input.reservationId);
    const a = input.approval;
    const hash = verifySignedEoaSwap(a, input.ownerSignature, input.rawSignedTransaction,
      input.freshRequest, input.expected, false, input.approvedRequest).toLowerCase();
    const typed = eoaApprovalTypedData(a);
    const approvalHash = TypedDataEncoder.hash(typed.domain, typed.types, typed.value).toLowerCase();
    return this.transaction(async (client) => {
      if (input.freshRequest.pilotProfile) await client.query(
        "SELECT pg_advisory_xact_lock(hashtextextended('nexus-pilot:' || $1, 0))",[a.wallet.toLowerCase()]);
      const portfolio = await lockPortfolio(client, a.portfolioId);
      const prior = await client.query<{ tx_hash: string; signed_transaction: string }>(
        "SELECT tx_hash, signed_transaction FROM eoa_execution_legs WHERE id = $1", [a.legId]);
      if (prior.rows[0]) {
        requireInput(prior.rows[0].tx_hash === hash && prior.rows[0].signed_transaction === input.rawSignedTransaction,
          "LEG_ID_CONFLICT", "Leg ID was used for different signed bytes.");
        return { hash, replay: true };
      }
      if(input.freshRequest.pilotProfile){
        const used=await client.query("SELECT 1 FROM eoa_execution_legs WHERE chain_id=56 AND wallet=$1 LIMIT 1",[a.wallet.toLowerCase()]);
        requireInput(used.rowCount===0,"PILOT_ALREADY_USED","One persisted buy consumes the pilot exposure allowance.");
      }
      requireInput(!portfolio.execution_paused, "PORTFOLIO_PAUSED", "Portfolio is paused.");
      requireInput(portfolio.owner_wallet !== null && portfolio.owner_wallet === a.wallet.toLowerCase(),
        "WRONG_WALLET", "Signed wallet is not the bound EOA.");
      requireInput(portfolio.chain_id === a.chainId && BigInt(portfolio.revision) === a.portfolioRevision,
        "STALE_REVISION", "Plan revision or chain changed.");
      const plan = await client.query<{ status: string; revision: string }>(
        "SELECT status, revision FROM plans WHERE id = $1 AND portfolio_id = $2 FOR UPDATE", [a.planId, a.portfolioId]);
      requireInput(plan.rows[0]?.status === "executing" && BigInt(plan.rows[0].revision) === a.portfolioRevision,
        "PLAN_NOT_EXECUTING", "Current plan is not executing.");
      const reservation = await client.query<{ state: string; units: string; asset_id: string; lease_until: Date }>(
        "SELECT state, units, asset_id, lease_until FROM reservations WHERE id = $1 AND plan_id = $2 FOR UPDATE",
        [input.reservationId, a.planId]);
      requireInput(reservation.rows[0]?.state === "held"
        && reservation.rows[0].lease_until > new Date(),
      "EXPIRED_RESERVATION", "Only a live held reservation can be prepared.");
      requireInput(reservation.rows[0].asset_id === tokenAssetId(a.chainId, a.tokenIn)
        && BigInt(reservation.rows[0].units) === a.inputRaw,
      "RESERVATION_MISMATCH", "Reservation must exactly match signed input.");
      const unresolved = await client.query(`SELECT 1 FROM eoa_execution_legs WHERE portfolio_id = $1
        AND state IN ('signed', 'unknown', 'included', 'reorged') LIMIT 1`, [a.portfolioId]);
      requireInput(unresolved.rowCount === 0, "UNRESOLVED_SUBMISSION", "Prior leg must reconcile first.");
      await client.query(`INSERT INTO eoa_execution_legs(id, portfolio_id, plan_id, reservation_id,
        chain_id, wallet, side, token_in, token_out, input_raw, minimum_output_raw,
        tx_nonce, tx_hash, signed_transaction, authorization_nonce,
        approval_hash, evidence_hash,pilot_profile_hash, state)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17,$18, 'signed')`,
      [a.legId, a.portfolioId, a.planId, input.reservationId, a.chainId, a.wallet.toLowerCase(),
        input.freshRequest.proposal.side, a.tokenIn.toLowerCase(), a.tokenOut.toLowerCase(),
        a.inputRaw.toString(), a.minimumOutputRaw.toString(), a.transactionNonce, hash,
        input.rawSignedTransaction, a.authorizationNonce, approvalHash, a.evidenceHash,input.freshRequest.pilotProfile?securityDigest(input.freshRequest.pilotProfile):null]);
      await client.query(`INSERT INTO transactions(id, portfolio_id, plan_id, reservation_id, state)
        VALUES ($1, $2, $3, $4, 'unknown')`, [hash, a.portfolioId, a.planId, input.reservationId]);
      await client.query("UPDATE reservations SET state = 'submitted', lease_until = NULL WHERE id = $1", [input.reservationId]);
      await client.query("UPDATE plans SET status = 'reconciling' WHERE id = $1", [a.planId]);
      await client.query(`INSERT INTO outbox(event_key, topic, payload)
        VALUES ($1, 'transaction.reconcile', $2::jsonb)`, [
        `transaction.reconcile:${a.legId}`,
        JSON.stringify({ portfolioId: a.portfolioId, planId: a.planId, legId: a.legId, hash })]);
      return { hash, replay: false };
    }, existingClient);
  }

  /** Rechecks P5 and atomically claims the exact stored bytes once. */
  async claimBroadcastOnce(input: PrepareSignedEoaLeg, existingClient?: PoolClient): Promise<{ hash: string; rawSignedTransaction: string } | null> {
    const a = input.approval;
    const hash = verifySignedEoaSwap(a, input.ownerSignature, input.rawSignedTransaction,
      input.freshRequest, input.expected, false, input.approvedRequest).toLowerCase();
    const typed = eoaApprovalTypedData(a);
    const approvalHash = TypedDataEncoder.hash(typed.domain, typed.types, typed.value).toLowerCase();
    return this.transaction(async (client) => {
      const portfolio = await lockPortfolio(client, a.portfolioId);
      requireInput(!portfolio.execution_paused && portfolio.owner_wallet === a.wallet.toLowerCase()
        && portfolio.chain_id === a.chainId && BigInt(portfolio.revision) === a.portfolioRevision,
      "PRELEG_CHANGED", "Portfolio owner, pause, chain or revision changed.");
      const row = await client.query<{ state: string; tx_hash: string; signed_transaction: string;
        approval_hash: string; evidence_hash: string }>(
        "SELECT state, tx_hash, signed_transaction, approval_hash, evidence_hash FROM eoa_execution_legs WHERE id = $1 AND portfolio_id = $2 FOR UPDATE",
        [a.legId, a.portfolioId]);
      requireInput(row.rows[0] !== undefined && row.rows[0].tx_hash === hash
        && row.rows[0].signed_transaction === input.rawSignedTransaction
        && row.rows[0].approval_hash === approvalHash
        && row.rows[0].evidence_hash === a.evidenceHash,
      "STORED_LEG_CHANGED", "Stored signed transaction differs from fresh approval.");
      if (row.rows[0].state !== "signed") return null;
      await client.query(`UPDATE eoa_execution_legs SET state = 'unknown',
        attempted_at = now(), updated_at = now() WHERE id = $1`, [a.legId]);
      return { hash, rawSignedTransaction: row.rows[0].signed_transaction };
    }, existingClient);
  }

  /** Chain observations are supplied by a trusted RPC/indexer adapter, never a client. */
  async recordChainObservation(portfolioId: string, legId: string,
    observation: EoaChainObservation, finalityBlocks: bigint,
    recoverySource?: RecoveryEvidenceSource): Promise<EoaRecoveryDecision> {
    identifier(portfolioId); identifier(legId);
    return this.transaction(async (client) => {
      const portfolio = await lockPortfolio(client, portfolioId);
      const leg = await client.query<{ plan_id: string; tx_hash: string; wallet: string;
        tx_nonce: string; state: EoaLegState; included_block_hash: string | null;
        reconciled_at: Date | null }>(
        `SELECT plan_id, tx_hash, wallet, tx_nonce, state, included_block_hash, reconciled_at
          FROM eoa_execution_legs WHERE id = $1 AND portfolio_id = $2 FOR UPDATE`,
        [legId, portfolioId]);
      requireInput(leg.rows[0] !== undefined, "UNKNOWN_LEG", "EOA leg does not exist.");
      const row = leg.rows[0];
      const decision = classifyEoaObservation({ hash: row.tx_hash, wallet: row.wallet,
        nonce: BigInt(row.tx_nonce), state: row.state, includedBlockHash: row.included_block_hash },
      observation, finalityBlocks);
      await recordRecoveryEvidence(client, legId, recoverySource, "observation",
        observation.receipt?.blockNumber ?? observation.replacement?.receipt.blockNumber ?? null,
        observation.receipt?.blockHash ?? observation.replacement?.receipt.blockHash ?? null,
        { observation, finalityBlocks, decision });
      if (row.reconciled_at !== null) {
        if (decision.state === row.state) return decision;
        requireInput(decision.state === "reorged" && row.state !== "reorged",
          "RECONCILED_STATE_CHANGED", "Reconciled leg needs manual chain review.");
        const next = BigInt(portfolio.revision) + 1n;
        await invalidateHeld(client, portfolioId);
        await client.query("UPDATE portfolios SET execution_paused = true, revision = $2 WHERE id = $1",
          [portfolioId, next.toString()]);
        await client.query(`INSERT INTO portfolio_revisions(portfolio_id, revision, reason)
          VALUES ($1, $2, 'eoa-deep-reorg')`, [portfolioId, next.toString()]);
        await client.query(`UPDATE eoa_execution_legs SET state = 'reorged', updated_at = now()
          WHERE id = $1`, [legId]);
        await client.query("UPDATE transactions SET state = 'unknown' WHERE id = $1", [row.tx_hash]);
        return decision;
      }
      const receipt = decision.receipt;
      await client.query(`UPDATE eoa_execution_legs SET state = $3, included_block = $4,
        included_block_hash = $5, receipt_success = $6, replacement_hash = $7,
        updated_at = now() WHERE id = $1 AND portfolio_id = $2`,
      [legId, portfolioId, decision.state,
        receipt ? receipt.blockNumber.toString() : null,
        receipt?.blockHash.toLowerCase() ?? null, receipt?.success ?? null,
        decision.replacementHash?.toLowerCase() ?? null]);
      const legacyState = decision.state === "reorged" || decision.state === "signed"
        ? "unknown" : decision.state;
      await client.query("UPDATE transactions SET state = $2 WHERE id = $1",
        [row.tx_hash, legacyState]);
      await client.query("UPDATE plans SET status = $2 WHERE id = $1",
        [row.plan_id, decision.state === "unknown" || decision.state === "reorged" ? "unknown" : "reconciling"]);
      if (decision.state === "reorged" && row.state !== "reorged") {
        const next = BigInt(portfolio.revision) + 1n;
        await invalidateHeld(client, portfolioId);
        await client.query("UPDATE portfolios SET execution_paused = true, revision = $2 WHERE id = $1",
          [portfolioId, next.toString()]);
        await client.query(`INSERT INTO portfolio_revisions(portfolio_id, revision, reason)
          VALUES ($1, $2, 'eoa-unreconciled-reorg')`, [portfolioId, next.toString()]);
      }
      return decision;
    });
  }

  /** A post-fill allowance anomaly pauses once; submitted funds remain reserved. */
  async freezeAllowanceIncident(portfolioId:string,legId:string):Promise<void> {
    identifier(portfolioId);identifier(legId);
    await this.transaction(async c=>{
      const p=await lockPortfolio(c,portfolioId);
      const leg=await c.query(`SELECT 1 FROM eoa_execution_legs WHERE id=$1 AND portfolio_id=$2
        AND pilot_profile_hash IS NOT NULL AND receipt_success=true AND reconciled_at IS NULL`,[legId,portfolioId]);
      requireInput(leg.rowCount===1,"INVALID_ALLOWANCE_INCIDENT","An unreconciled successful pilot receipt is required.");
      const incidentId=`allowance-${legId}`;
      const existing=await c.query('SELECT 1 FROM decision_records WHERE id=$1',[incidentId]);
      if(existing.rowCount)return;
      const next=BigInt(p.revision)+1n;
      await invalidateHeld(c,portfolioId);
      await c.query('INSERT INTO portfolio_revisions(portfolio_id,revision,reason) VALUES($1,$2,$3)',
        [portfolioId,next.toString(),'pilot-post-fill-allowance-incident']);
      await c.query('UPDATE portfolios SET execution_paused=true,revision=$2 WHERE id=$1',[portfolioId,next.toString()]);
      await c.query(`INSERT INTO decision_records(id,portfolio_id,revision,kind,body) VALUES($1,$2,$3,'pilot-incident',$4::jsonb)`,
        [incidentId,portfolioId,next.toString(),executionJson({legId,reason:'PILOT_POST_FILL_ALLOWANCE_NONZERO'})]);
    });
  }

  /** Applies a finalized receipt and complete trusted chain balances together. */
  async reconcileFinalizedLeg(input: FinalizedBalanceSnapshot): Promise<{
    revision: bigint; spent: bigint; received: bigint }> {
    identifier(input.portfolioId); identifier(input.legId);
    requireInput(/^0x[0-9a-fA-F]{64}$/.test(input.sourceBlockHash) && input.sourceBlock >= 0n,
      "INVALID_BALANCE_SOURCE", "Pinned chain block required.");
    return this.transaction(async (client) => {
      const portfolio = await lockPortfolio(client, input.portfolioId);
      requireInput(BigInt(portfolio.revision) === input.expectedRevision
        && portfolio.owner_wallet === input.wallet.toLowerCase(),
      "STALE_REVISION", "Portfolio owner or revision changed before reconciliation.");
      const leg = await client.query<{ plan_id: string; reservation_id: string; state: EoaLegState;
        token_in: string; token_out: string; input_raw: string; minimum_output_raw: string;
        included_block: string | null; included_block_hash: string | null;
        receipt_success: boolean | null; reconciled_at: Date | null;
        tx_hash: string; wallet: string; signed_transaction: string;pilot_profile_hash:string|null }>(
        `SELECT plan_id, reservation_id, state, token_in, token_out, input_raw,
          minimum_output_raw, included_block, included_block_hash,
          receipt_success, reconciled_at, tx_hash, wallet, signed_transaction,pilot_profile_hash
          FROM eoa_execution_legs
          WHERE id = $1 AND portfolio_id = $2 FOR UPDATE`, [input.legId, input.portfolioId]);
      const row = leg.rows[0];
      requireInput(row !== undefined && row.reconciled_at === null
        && (row.state === "confirmed" || row.state === "reverted")
        && row.included_block !== null && row.included_block_hash !== null
        && row.receipt_success === (row.state === "confirmed")
        && input.sourceBlock === BigInt(row.included_block)
        && input.sourceBlockHash.toLowerCase() === row.included_block_hash,
      "UNFINALIZED_LEG", "Finalized receipt and matching balance block required.");
      const existing = await client.query<{ asset_id: string; decimals: number; confirmed_units: string }>(
        "SELECT asset_id, decimals, confirmed_units FROM balances WHERE portfolio_id = $1",
        [input.portfolioId]);
      const before = existing.rows.map(value => amount(BigInt(value.confirmed_units),
        { assetId: value.asset_id, decimals: value.decimals }));
      const signed = Transaction.from(row.signed_transaction);
      requireInput(signed.to !== null && signed.hash?.toLowerCase() === row.tx_hash,
        "INVALID_RECOVERY_CONTEXT", "Signed transaction identity must match persisted leg.");
      requireInput(input.receiptEffects.blockNumber === input.sourceBlock
        && input.receiptEffects.blockHash.toLowerCase() === input.sourceBlockHash.toLowerCase()
        && input.receiptEffects.success === row.receipt_success,
      "INVALID_RECEIPT_PROOF", "Proof must match the finalized stored receipt.");
      if(row.pilot_profile_hash!==null&&row.receipt_success) {
        const proof=input.allowanceProof;
        requireInput(!!proof&&proof.wallet.toLowerCase()===row.wallet&&proof.token.toLowerCase()===row.token_in
          &&proof.spender.toLowerCase()===signed.to.toLowerCase()&&proof.sourceBlock===input.sourceBlock
          &&proof.sourceBlockHash.toLowerCase()===input.sourceBlockHash.toLowerCase()&&proof.allowanceRaw===0n,
        "PILOT_POST_FILL_ALLOWANCE_INVALID","Canonical zero post-fill allowance is mandatory for this persisted pilot leg.");
      }
      const delta = verifyEoaReceiptEffects({ proof: input.receiptEffects,
        chainId: portfolio.chain_id, wallet: row.wallet, transactionHash: row.tx_hash,
        router: signed.to, transactionValue: signed.value,
        tokenIn: row.token_in, tokenOut: row.token_out,
        inputRaw: BigInt(row.input_raw), minimumOutputRaw: BigInt(row.minimum_output_raw),
        before, after: input.balances });
      const settlement = await client.query<{ settlement_asset_id: string; settlement_decimals: number }>(
        "SELECT settlement_asset_id, settlement_decimals FROM portfolios WHERE id = $1", [input.portfolioId]);
      requireInput(input.balances.some(value => value.assetId === settlement.rows[0]?.settlement_asset_id
        && value.decimals === settlement.rows[0]?.settlement_decimals),
      "MISSING_SETTLEMENT", "Complete settlement balance is required.");
      await client.query(`INSERT INTO eoa_fill_proofs(leg_id,proof,before_balances,after_balances,allowance_proof)
        VALUES($1,$2::jsonb,$3::jsonb,$4::jsonb,$5::jsonb)`,[input.legId,executionJson(input.receiptEffects),
        executionJson(before),executionJson(input.balances),input.allowanceProof?executionJson(input.allowanceProof):null]);
      await client.query("DELETE FROM balances WHERE portfolio_id = $1", [input.portfolioId]);
      for (const value of input.balances) await client.query(
        "INSERT INTO balances(portfolio_id, asset_id, decimals, confirmed_units) VALUES ($1, $2, $3, $4)",
        [input.portfolioId, value.assetId, value.decimals, value.units.toString()]);
      const released = await client.query("UPDATE reservations SET state = $2 WHERE id = $1 AND state = 'submitted'",
        [row.reservation_id, row.state === "confirmed" ? "consumed" : "released"]);
      requireInput(released.rowCount === 1, "RESERVATION_CHANGED", "Submitted reservation changed during reconciliation.");
      await invalidateHeld(client, input.portfolioId);
      await client.query("UPDATE plans SET status = 'completed' WHERE id = $1", [row.plan_id]);
      const next = input.expectedRevision + 1n;
      await client.query("UPDATE portfolios SET revision = $2 WHERE id = $1", [input.portfolioId, next.toString()]);
      await client.query("INSERT INTO portfolio_revisions(portfolio_id, revision, reason) VALUES ($1, $2, $3)",
        [input.portfolioId, next.toString(), row.state === "confirmed" ? "eoa-fill" : "eoa-reverted"]);
      await client.query(`UPDATE eoa_execution_legs SET balance_block = $2,
        balance_block_hash = $3, spent_raw = $4, received_raw = $5,
        receipt_effects_hash = $6, reconciled_at = now(), updated_at = now() WHERE id = $1`,
      [input.legId, input.sourceBlock.toString(), input.sourceBlockHash.toLowerCase(),
        delta.spent.toString(), delta.received.toString(), delta.proofHash]);
      await recordRecoveryEvidence(client, input.legId, input.recoverySource, "reconciliation",
        input.sourceBlock, input.sourceBlockHash,
        { revision: next, spent: delta.spent, received: delta.received,
          proofHash: delta.proofHash, balances: input.balances });
      return { revision: next, spent: delta.spent, received: delta.received };
    });
  }
}
