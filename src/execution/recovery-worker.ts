import { randomUUID } from "node:crypto";
import type { Pool } from "pg";
import { DomainError, requireInput } from "../domain/errors.js";
import { prepareBscBalanceEvidence } from "./bsc-recovery.js";
import { fetchEoaBscObservation } from "./bsc-rpc.js";
import { parseRecoveryConfig, recoveryConfigurationRecord, resolveRecoveryAssets,
  type RecoveryConfig } from "./recovery-config.js";
import { EoaExecutionStore } from "./store.js";
import { verifyBscRecoveryContracts } from "./recovery-contracts.js";

export interface RecoveryWorkerResult {
  readonly legId: string;
  readonly outcome: "busy" | "unavailable" | "waiting" | "manual-review" | "reconciled" | "monitored";
  readonly reason: string;
  readonly sourceId?: string;
}

/** Trusted headless runtime. Discovers persisted legs; has no signer or broadcast port. */
export async function runBscRecoveryOnce(pool: Pool, rawConfig: RecoveryConfig,
  fetcher: typeof fetch = fetch, limit = 25): Promise<readonly RecoveryWorkerResult[]> {
  const config = parseRecoveryConfig(rawConfig);
  requireInput(Number.isInteger(limit) && limit > 0 && limit <= 100,
    "INVALID_RECOVERY_LIMIT", "Recovery batch must contain 1–100 legs.");
  const candidates = await pool.query<{ id: string; portfolio_id: string }>(`
    SELECT l.id, l.portfolio_id FROM eoa_execution_legs l
    LEFT JOIN LATERAL (SELECT max(started_at) checked FROM eoa_recovery_attempts
      WHERE leg_id = l.id) a ON true
    WHERE l.chain_id = 56
    ORDER BY a.checked NULLS FIRST, l.created_at, l.id LIMIT $1`, [limit]);
  const results: RecoveryWorkerResult[] = [];
  const record = recoveryConfigurationRecord(config);
  for (const leg of candidates.rows) {
    const lock = await pool.connect();
    let locked = false;
    let connectionLost = false;
    const onConnectionError = (): void => { connectionLost = true; };
    lock.on("error", onConnectionError);
    let attemptId: string | undefined;
    const lockKey = `nexus-eoa-recovery:${leg.portfolio_id}`;
    try {
      // Same portfolio must not collect/apply concurrent pre-fill balance snapshots.
      // Session lock releases on process death; no expired lease can duplicate a fill.
      const claim = await lock.query<{ claimed: boolean }>(
        "SELECT pg_try_advisory_lock(hashtextextended(current_schema() || $1, 0)) claimed", [lockKey]);
      locked = claim.rows[0]?.claimed === true;
      if (!locked) {
        results.push({ legId: leg.id, outcome: "busy", reason: "RECOVERY_WORKER_ACTIVE" });
        continue;
      }
      attemptId = randomUUID();
      await lock.query(`INSERT INTO eoa_recovery_attempts(id, leg_id, configuration_hash, configuration)
        VALUES ($1, $2, $3, $4::jsonb)`, [attemptId, leg.id, record.hash, JSON.stringify(record.snapshot)]);
      // Reuse the lock-owning connection for every database transaction. Losing
      // that connection prevents further writes as well as releasing ownership.
      const store = new EoaExecutionStore(pool, lock);
      // Never silently rewrite a deep reorg or substitute unknown replacement effects.
      const context = await store.loadRecoveryContext(leg.portfolio_id, leg.id);
      let result: RecoveryWorkerResult = { legId: leg.id, outcome: "unavailable", reason: "RPC_EVIDENCE_UNAVAILABLE" };
      if (context.state === "reorged" || context.state === "replaced") {
        result = { legId: leg.id, outcome: "manual-review", reason: "PERSISTED_CHAIN_REVIEW_REQUIRED" };
      } else {
        for (const source of config.sources) {
          const provenance = { attemptId, sourceId: source.id };
          const current = await store.loadRecoveryContext(leg.portfolio_id, leg.id);
          const observation = await fetchEoaBscObservation({ rpcUrl: source.rpcUrl,
            wallet: current.wallet, transactionHash: current.transactionHash }, fetcher);
          if (observation === null) continue;
          const decision = await store.recordChainObservation(leg.portfolio_id, leg.id,
            observation, BigInt(config.finalityBlocks), provenance);
          result = { legId: leg.id, outcome: "waiting", reason: decision.reason, sourceId: source.id };
          if (decision.reason === "NONCE_USED_UNKNOWN") {
            result = { ...result, outcome: "manual-review" };
            break;
          }
          if (decision.state === "reorged" || decision.state === "replaced") {
            result = { ...result, outcome: "manual-review" };
            break;
          }
          const saved = await lock.query<{ reconciled_at: Date | null }>(
            "SELECT reconciled_at FROM eoa_execution_legs WHERE id = $1", [leg.id]);
          if (saved.rows[0]?.reconciled_at !== null) {
            result = { ...result, outcome: "monitored" };
            break;
          }
          if (decision.state !== "confirmed" && decision.state !== "reverted") break;
          // Retry the entire evidence read on backup, never combine balances/logs
          // from different endpoints. Contradictory/unsupported proof throws and
          // requires review rather than seeking a more convenient source.
          const evidence = await prepareBscBalanceEvidence(store, {
            portfolioId: leg.portfolio_id, legId: leg.id,
            rpcUrl: source.rpcUrl, finalityBlocks: BigInt(config.finalityBlocks),
            async resolveTrackedAssets(context) { return resolveRecoveryAssets(config, context); },
            async validateTrackedAssets(context) {
              const required = new Set(resolveRecoveryAssets(config, context).map(asset => asset.assetId));
              return verifyBscRecoveryContracts({ rpcUrl: source.rpcUrl,
                blockNumber: context.includedBlock!, blockHash: context.includedBlockHash!,
                assets: config.assets.filter(asset => required.has(asset.assetId)) }, fetcher);
            }
          }, fetcher);
          if (evidence === null) {
            result = { ...result, outcome: "unavailable", reason: "RECEIPT_BALANCE_PROOF_UNAVAILABLE" };
            continue;
          }
          await store.reconcileFinalizedLeg({ ...evidence, recoverySource: provenance });
          result = { ...result, outcome: "reconciled", reason: "RECEIPT_EFFECTS_APPLIED_ONCE" };
          break;
        }
      }
      await lock.query("UPDATE eoa_recovery_attempts SET outcome = $2, reason = $3, finished_at = now() WHERE id = $1",
        [attemptId, result.outcome, result.reason]);
      results.push(result);
    } catch (error) {
      // Domain rejection is durable and safe to inspect. Infrastructure errors
      // propagate for operator alerts; raw database/RPC messages are never logged.
      if (!(error instanceof DomainError)) throw error;
      if (attemptId !== undefined) await lock.query(
        "UPDATE eoa_recovery_attempts SET outcome = 'manual-review', reason = $2, finished_at = now() WHERE id = $1",
        [attemptId, error.code]);
      results.push({ legId: leg.id, outcome: "manual-review", reason: error.code });
    } finally {
      try {
        if (locked && !connectionLost) await lock.query("SELECT pg_advisory_unlock(hashtextextended(current_schema() || $1, 0))", [lockKey]);
        lock.release(connectionLost);
      } catch { lock.release(true); }
      finally { lock.off("error", onConnectionError); }
    }
  }
  return results;
}
