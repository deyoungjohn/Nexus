import type { Instrument } from "../domain/instrument.js";
import type { CoordinatorPolicy, PortfolioSnapshot, Proposal } from "../coordinator/plan.js";

export interface TimedEvidence {
  readonly source: string;
  readonly observedAt: string;
  readonly expiresAt: string;
}

export interface EligibilityEvidence extends TimedEvidence {
  readonly instrumentId: string;
  readonly wallet: string;
  readonly venueId: string;
  readonly allowedSides: readonly ("buy" | "sell")[];
  readonly verifiedRequirements: readonly string[];
  readonly transferPermitted: boolean;
}

/** Ratio maps raw token base units to 10^18 reference-share base units. */
export interface QuantityEvidence extends TimedEvidence {
  readonly instrumentId: string;
  readonly quantityModel: string;
  readonly adapterVersion: string;
  readonly mappingRevision: string;
  readonly sourceBlock: bigint;
  readonly shareUnitsNumerator: bigint;
  readonly shareUnitsDenominator: bigint;
}

export interface ReferenceEvidence {
  readonly underlyingId: string;
  readonly source: string;
  /** Timestamp from the price source, never substituted by HTTP receipt time. */
  readonly sourceAt: string;
  readonly receivedAt: string;
  readonly pricePerShare: bigint; // settlement base units per 10^18 reference-share units
}

export interface SettlementEvidence extends TimedEvidence {
  readonly valuationUnit: string;
  readonly assetId: string;
  readonly lowerValueNumerator: bigint;
  readonly upperValueNumerator: bigint;
  readonly denominator: bigint;
}

export interface PositionValuationEvidence extends TimedEvidence {
  readonly instrumentId: string;
  readonly sourceBlock: bigint;
  readonly mappingRevision: string;
  readonly valueLower: bigint;
  readonly valueUpper: bigint;
}

export interface SessionEvidence extends TimedEvidence {
  readonly exchangeZone: string;
  readonly localDate: string;
  readonly openLocal: string;
  readonly closeLocal: string;
  readonly status: "regular" | "holiday" | "closed";
}

export interface TokenStatusEvidence extends TimedEvidence {
  readonly instrumentId: string;
  readonly state: "open" | "halted" | "paused" | "unknown";
}

export interface AuditEvidence extends TimedEvidence {
  readonly instrumentId: string;
  readonly state: "clear" | "risk" | "unsupported";
}

export interface EventEvidence extends TimedEvidence {
  readonly underlyingId: string;
  readonly issuerSourceUrl: string;
  readonly revision: string;
  readonly confirmation: "none-confirmed" | "confirmed" | "uncertain" | "withdrawn";
  readonly eventAt: string | null;
  readonly blackoutStart: string | null;
  readonly blackoutEnd: string | null;
}

export interface RouteQuote {
  readonly venueId: string;
  readonly chainId: number;
  readonly sender: string;
  readonly recipient: string;
  readonly router: string;
  readonly spender: string;
  readonly tokenIn: string;
  readonly tokenOut: string;
  readonly inputRaw: bigint;
  readonly expectedOutputRaw: bigint;
  readonly minimumOutputRaw: bigint;
  readonly additionalFeeSettlement: bigint;
  readonly networkFeeSettlement: bigint;
  readonly nativeFeeRaw: bigint;
  readonly priceImpactBps: number;
  readonly spreadBps: number;
  readonly calldata: string;
  readonly value: bigint;
  readonly quotedAt: string;
  readonly expiresAt: string;
  readonly onchainDeadline: string;
}

export interface SimulationEvidence {
  readonly chainId: number;
  readonly sender: string;
  readonly recipient: string;
  readonly router: string;
  readonly spender: string;
  readonly tokenIn: string;
  readonly allowanceRaw: bigint;
  readonly calldata: string;
  readonly value: bigint;
  readonly inputRaw: bigint;
  readonly outputRaw: bigint;
  readonly sourceBlock: bigint;
  readonly source: string;
  readonly simulatedAt: string;
  readonly success: boolean;
}

export interface MarketEvidence {
  readonly eligibility: EligibilityEvidence | null;
  readonly quantity: QuantityEvidence | null;
  readonly reference: ReferenceEvidence | null;
  readonly settlement: SettlementEvidence | null;
  readonly portfolioValuations: readonly PositionValuationEvidence[] | null;
  readonly session: SessionEvidence | null;
  readonly tokenStatus: TokenStatusEvidence | null;
  readonly audit: AuditEvidence | null;
  readonly event: EventEvidence | null;
  readonly quote: RouteQuote | null;
  readonly simulation: SimulationEvidence | null;
}

export interface MarketGatePolicy {
  readonly maxReferenceAgeMs: number;
  readonly maxStatusAgeMs: number;
  readonly maxQuoteAgeMs: number;
  readonly maxSimulationAgeMs: number;
  readonly maxBlockLag: bigint;
  readonly maxPriceDeviationBps: number;
  readonly maxPriceImpactBps: number;
  readonly maxSpreadBps: number;
  readonly maxPositiveFillBufferBps: number;
  readonly maxNetworkFeeSettlement: bigint;
  readonly maxAdditionalFeeSettlement: bigint;
  readonly maxSlippageBps: number;
  readonly maxQuoteLifetimeMs: number;
  readonly exchangeZone: string;
  readonly regularOpenLocal: string;
  readonly regularCloseLocal: string;
  readonly approvedV3FeeTiers: readonly number[];
  readonly approvedVenues: readonly string[];
  readonly approvedRouters: readonly string[];
}

export interface GateRequest {
  readonly now: string;
  readonly wallet: string;
  readonly instrument: Instrument;
  readonly snapshot: PortfolioSnapshot;
  readonly coordinatorPolicy: CoordinatorPolicy;
  readonly proposal: Proposal;
  readonly marketPolicy: MarketGatePolicy;
  readonly evidence: MarketEvidence;
  /** P7 must compare this to the final authorization and recheck before submission. */
  readonly expectedMappingRevision: string;
}
