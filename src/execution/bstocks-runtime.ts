import { createBStocksRoutePorts, type BStocksRouteConfig } from "../market-gate/bstocks-route.js";
import { securityDigest } from "../security/token-security.js";
import type { Pool } from "pg";
import type { ExecutionSessions, ExecutionDeployment } from "./production.js";
import { ProductionEoaExecutor } from "./production.js";
import { createBscExecutionChain } from "./bsc-execution-chain.js";
import { createBStocksProductionCollector, type BStocksProductionReviewPorts } from "../market-gate/bstocks-production.js";
import type { TokenSecurityReview } from "../security/token-security.js";
import { parseRecoveryConfig, recoveryConfigurationRecord, type RecoveryConfig } from "./recovery-config.js";
import { createPilotPriceJournal } from "../pilot/price-journal.js";
import { createPilotManualPorts, type PilotManualRecords } from "../pilot/manual-records.js";
import { createAnvilForkFactory, createPilotRoundTrip } from "../pilot/round-trip.js";
import type { ExecutionMarketContext } from "../market-gate/bstocks-production.js";
import type { MarketEvidence } from "../market-gate/evidence.js";

/** Trusted deployment composition. Broadcasting defaults to disabled; no browser overrides. */
export function createBStocksExecutionRuntime(input: {
  readonly pool: Pool; readonly sessions: ExecutionSessions;
  readonly deployment: Omit<ExecutionDeployment, "broadcastEnabled" | "recoveryConfigurationHash"> & { readonly broadcastEnabled?: boolean };
  readonly rpcUrl: string;
  readonly route?: BStocksRouteConfig;
  readonly pilotRecords?: PilotManualRecords;
  readonly recoveryConfig: RecoveryConfig;
  readonly securityReviews: readonly TokenSecurityReview[];
  readonly settlementMaxAgeMs: number;
  readonly settlementUncertaintyBps: number;
  readonly settlementMaxPegDeviationBps: number;
}, reviews: Omit<BStocksProductionReviewPorts,"quote"|"simulation"> & Partial<Pick<BStocksProductionReviewPorts,"quote"|"simulation">>, fetcher: typeof fetch = fetch,
  observe?: (context: ExecutionMarketContext, evidence: MarketEvidence) => Promise<void>) {
  const recovery = parseRecoveryConfig(input.recoveryConfig);
  if (!recovery.sources.some(s => s.rpcUrl === input.rpcUrl)) throw Error("Execution source is not in the reviewed recovery configuration.");
  if (input.route && (input.route.maxGasLimit !== input.deployment.maxGasLimit
    || input.route.maxFeePerGas !== input.deployment.maxFeePerGas)) throw Error("Route/deployment gas ceilings differ.");
  const route=input.route ? createBStocksRoutePorts(input.rpcUrl,input.route,fetcher) : null;
  if(input.pilotRecords && (!input.deployment.pilotProfile || !input.route))throw Error("Pilot records require a profile and reviewed route.");
  const manual=input.pilotRecords&&input.deployment.pilotProfile
    ?createPilotManualPorts(input.deployment.pilotProfile,input.pilotRecords,input.rpcUrl,fetcher):null;
  const collector = createBStocksProductionCollector(input, { ...(manual??reviews),
    ...(manual&&input.route?{pilotRoundTrip:createPilotRoundTrip(createAnvilForkFactory(input.rpcUrl,fetcher),input.route)}:{}),
    ...(route?{pilotMid:route.pilotMid}:{}),
    quote: route?.quote ?? reviews.quote ?? (async () => null),
    simulation: route?.simulation ?? reviews.simulation ?? (async () => null) }, fetcher,createPilotPriceJournal(input.pool));
  const chain = createBscExecutionChain(input.rpcUrl, input.deployment.marketPolicy.maxStatusAgeMs, fetcher);
  return new ProductionEoaExecutor(input.pool, input.sessions,
    { ...input.deployment, ...(input.route ? {routeConfigurationHash:securityDigest(input.route)} : {}), recoveryConfigurationHash: recoveryConfigurationRecord(recovery).hash,
      broadcastEnabled: input.deployment.broadcastEnabled ?? false }, observe ? {
        async collect(context, pinnedQuote) {
          const evidence = await collector.collect(context, pinnedQuote);
          // An operator's evidence sink must succeed before signing/persistence/claim.
          await observe(context, evidence); return evidence;
        }
      } : collector, {
      async state(wallet, assets, now) {
        if (!assets.every(a => recovery.assets.some(r => r.assetId === a.assetId && r.decimals === a.decimals
          && (r.semantics === "native-gas" || r.contract !== undefined)))) return null;
        return chain.state(wallet, assets, now);
      }, send: claim => chain.send(claim)
    });
}
