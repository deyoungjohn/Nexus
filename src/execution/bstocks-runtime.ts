import type { Pool } from "pg";
import type { ExecutionSessions, ExecutionDeployment } from "./production.js";
import { ProductionEoaExecutor } from "./production.js";
import { createBscExecutionChain } from "./bsc-execution-chain.js";
import { createBStocksProductionCollector, type BStocksProductionReviewPorts } from "../market-gate/bstocks-production.js";
import type { TokenSecurityReview } from "../security/token-security.js";
import { parseRecoveryConfig, recoveryConfigurationRecord, type RecoveryConfig } from "./recovery-config.js";

/** Trusted deployment composition. Broadcasting defaults to disabled; no browser overrides. */
export function createBStocksExecutionRuntime(input: {
  readonly pool: Pool; readonly sessions: ExecutionSessions;
  readonly deployment: Omit<ExecutionDeployment, "broadcastEnabled" | "recoveryConfigurationHash"> & { readonly broadcastEnabled?: boolean };
  readonly rpcUrl: string;
  readonly recoveryConfig: RecoveryConfig;
  readonly securityReviews: readonly TokenSecurityReview[];
  readonly settlementMaxAgeMs: number;
  readonly settlementUncertaintyBps: number;
  readonly settlementMaxPegDeviationBps: number;
}, reviews: BStocksProductionReviewPorts, fetcher: typeof fetch = fetch) {
  const recovery = parseRecoveryConfig(input.recoveryConfig);
  if (!recovery.sources.some(s => s.rpcUrl === input.rpcUrl)) throw Error("Execution source is not in the reviewed recovery configuration.");
  const collector = createBStocksProductionCollector(input, reviews, fetcher);
  const chain = createBscExecutionChain(input.rpcUrl, input.deployment.marketPolicy.maxStatusAgeMs, fetcher);
  return new ProductionEoaExecutor(input.pool, input.sessions,
    { ...input.deployment, recoveryConfigurationHash: recoveryConfigurationRecord(recovery).hash,
      broadcastEnabled: input.deployment.broadcastEnabled ?? false }, collector, {
      async state(wallet, assets, now) {
        if (!assets.every(a => recovery.assets.some(r => r.assetId === a.assetId && r.decimals === a.decimals
          && (r.semantics === "native-gas" || r.contract !== undefined)))) return null;
        return chain.state(wallet, assets, now);
      }, send: claim => chain.send(claim)
    });
}
