import type { BStocksBscControlFingerprint, BStocksBscQuantitySnapshot } from "./bstocks-bsc.js";
import { BSTOCKS_BSC_NVDAB, fetchBStocksBscQuantity } from "./bstocks-bsc.js";
import { assessBStocksAccess, type BStocksAccessPolicy, type BStocksAccessPorts } from "./bstocks-access.js";
import { fetchBinanceRwaStatus } from "./binance-rwa-status.js";
import { fetchChainlinkBscEquity, fetchChainlinkBscSettlement, BSC_USDT_ASSET } from "./chainlink-bsc.js";
import { fetchNyseSession } from "./nyse-calendar.js";
import { collectBscTokenSecurity } from "../security/bsc-token-security.js";
import type { TokenSecurityReview } from "../security/token-security.js";
import type { GateRequest, MarketEvidence, QuantityEvidence, RouteQuote } from "./evidence.js";

export type ExecutionMarketContext = Omit<GateRequest, "evidence"> & { readonly sessionId: string };
export interface ExecutionMarketCollector {
  collect(context: ExecutionMarketContext, exactQuote?: RouteQuote): Promise<MarketEvidence>;
}

/** Operator-owned unresolved sources; no browser declarations and no UI-multiplier fallback. */
export interface BStocksProductionReviewPorts {
  readonly accessPolicy: BStocksAccessPolicy | null;
  readonly reviewedControl: BStocksBscControlFingerprint | null;
  readonly access: BStocksAccessPorts;
  economicQuantity(context: ExecutionMarketContext, snapshot: BStocksBscQuantitySnapshot): Promise<QuantityEvidence | null>;
  portfolioValuations(context: ExecutionMarketContext): Promise<MarketEvidence["portfolioValuations"]>;
  event(context: ExecutionMarketContext): Promise<MarketEvidence["event"]>;
  providerEvent(context: ExecutionMarketContext): Promise<MarketEvidence["providerEvent"]>;
  /** Must validate the venue and return an actual-size bounded direct route. */
  quote(context: ExecutionMarketContext, snapshot: BStocksBscQuantitySnapshot): Promise<RouteQuote | null>;
  /** Re-simulate exact quoted bytes against real state; no funded/allowance overrides. */
  simulation(context: ExecutionMarketContext, snapshot: BStocksBscQuantitySnapshot,
    quote: RouteQuote): Promise<MarketEvidence["simulation"]>;
}
const read = async <T>(fn: () => Promise<T>): Promise<T | null> => { try { return await fn(); } catch { return null; } };

/** Free public source assembly; qualified external reviews remain explicit ports. */
export function createBStocksProductionCollector(config: {
  readonly rpcUrl: string;
  readonly securityReviews: readonly TokenSecurityReview[];
  readonly settlementMaxAgeMs: number;
  readonly settlementUncertaintyBps: number;
  readonly settlementMaxPegDeviationBps: number;
}, ports: BStocksProductionReviewPorts, fetcher: typeof fetch = fetch): ExecutionMarketCollector {
  return { async collect(context, exactQuote) {
    const { instrument, marketPolicy: policy, now } = context;
    const compatible = instrument.chainId === 56 && instrument.issuerId === "bstocks"
      && instrument.tokenAddress === BSTOCKS_BSC_NVDAB && instrument.decimals === 18
      && instrument.underlyingId === "NVDA" && context.snapshot.confirmedCash.assetId === BSC_USDT_ASSET
      && context.snapshot.confirmedCash.decimals === 18;
    const snapshot = compatible ? await read(() => fetchBStocksBscQuantity({
      instrumentId: instrument.instrumentId, tokenAddress: instrument.tokenAddress,
      rpcUrl: config.rpcUrl, maxBlockAgeMs: policy.maxStatusAgeMs, now }, fetcher)) : null;
    const [eligibility, quantity, reference, settlement, valuations, session, status, event, providerEvent, security] = await Promise.all([
      snapshot && ports.accessPolicy && ports.reviewedControl ? read(() => assessBStocksAccess({
        sessionId: context.sessionId, wallet: context.wallet, instrument, side: context.proposal.side, now }, {
        policy: ports.accessPolicy!, transfer: { snapshot, reviewedControl: ports.reviewedControl!, rpcUrl: config.rpcUrl }
      }, ports.access, fetcher)) : Promise.resolve(null),
      snapshot ? read(() => ports.economicQuantity(context, snapshot)) : Promise.resolve(null),
      compatible ? read(() => fetchChainlinkBscEquity({ underlyingId: "NVDA", rpcUrl: config.rpcUrl,
        maxBlockAgeMs: policy.maxStatusAgeMs, maxReferenceAgeMs: policy.maxReferenceAgeMs, now }, fetcher)) : Promise.resolve(null),
      compatible ? read(() => fetchChainlinkBscSettlement({ rpcUrl: config.rpcUrl,
        maxBlockAgeMs: policy.maxStatusAgeMs, maxReferenceAgeMs: config.settlementMaxAgeMs,
        uncertaintyBps: config.settlementUncertaintyBps, maxPegDeviationBps: config.settlementMaxPegDeviationBps, now }, fetcher)) : Promise.resolve(null),
      read(() => ports.portfolioValuations(context)),
      read(() => fetchNyseSession(new Intl.DateTimeFormat("en-CA", {
        timeZone: policy.exchangeZone, year: "numeric", month: "2-digit", day: "2-digit"
      }).format(new Date(now)), fetcher)),
      compatible ? read(() => fetchBinanceRwaStatus(instrument.instrumentId, instrument.tokenAddress,
        fetcher, () => new Date(now))) : Promise.resolve(null),
      read(() => ports.event(context)), read(() => ports.providerEvent(context)),
      snapshot ? read(() => collectBscTokenSecurity({ rpcUrl: config.rpcUrl, maxAgeMs: Math.min(policy.maxStatusAgeMs, 300_000),
        reviews: config.securityReviews, blockNumber: snapshot.sourceBlock, blockHash: snapshot.sourceBlockHash }, fetcher)) : Promise.resolve(null)
    ]);
    // A stale or unavailable mapping is not upgraded into share entitlement.
    const boundQuantity = quantity && snapshot && quantity.sourceBlock === snapshot.sourceBlock
      && quantity.mappingRevision === snapshot.mappingRevision ? quantity : null;
    const quote = snapshot ? exactQuote ?? await read(() => ports.quote(context, snapshot)) : null;
    const simulation = quote && snapshot ? await read(() => ports.simulation(context, snapshot, quote)) : null;
    const audit = security && security.length === 2 && security.every(s => s.observation)
      ? { source: "full-token-security:v2", instrumentId: instrument.instrumentId,
        observedAt: security.map(s => s.observation!.observedAt).sort()[0]!,
        expiresAt: security.map(s => s.observation!.expiresAt).sort()[0]!,
        state: security.every(s => s.state === "clear") ? "clear" as const
          : security.some(s => s.state === "risk") ? "risk" as const : "unsupported" as const } : null;
    // Source closure cannot be labelled clear independently of the detailed reports.
    return { eligibility, quantity: boundQuantity, reference, settlement,
      portfolioValuations: valuations, session, tokenStatus: status, event, providerEvent,
      tokenSecurity: security, audit, quote, simulation };
  } };
}
