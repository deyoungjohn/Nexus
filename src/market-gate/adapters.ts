import type { MarketEvidence, ReferenceEvidence } from "./evidence.js";

/** Provider implementations may return null; a transport receipt cannot certify source time. */
export interface EvidenceAdapters {
  eligibility(): Promise<MarketEvidence["eligibility"]>;
  quantity(): Promise<MarketEvidence["quantity"]>;
  reference(): Promise<MarketEvidence["reference"]>;
  settlement(): Promise<MarketEvidence["settlement"]>;
  portfolioValuations(): Promise<MarketEvidence["portfolioValuations"]>;
  session(): Promise<MarketEvidence["session"]>;
  tokenStatus(): Promise<MarketEvidence["tokenStatus"]>;
  audit(): Promise<MarketEvidence["audit"]>;
  event(): Promise<MarketEvidence["event"]>;
  /** Optional for existing providers; the gate requires it for bStocks. */
  providerEvent?(): Promise<MarketEvidence["providerEvent"]>;
  quote(): Promise<MarketEvidence["quote"]>;
  simulation(quote: NonNullable<MarketEvidence["quote"]>): Promise<MarketEvidence["simulation"]>;
}

/** Adapter failures become missing evidence, which the gate blocks. */
export async function collectMarketEvidence(adapters: EvidenceAdapters): Promise<MarketEvidence> {
  const read = async <T>(fetch: () => Promise<T>): Promise<T | null> => {
    try { return await fetch(); } catch { return null; }
  };
  const [eligibility, quantity, reference, settlement, portfolioValuations, session, tokenStatus, audit, event, providerEvent] = await Promise.all([
    read(() => adapters.eligibility()), read(() => adapters.quantity()), read(() => adapters.reference()),
    read(() => adapters.settlement()), read(() => adapters.portfolioValuations()),
    read(() => adapters.session()), read(() => adapters.tokenStatus()), read(() => adapters.audit()),
    read(() => adapters.event()), adapters.providerEvent ? read(() => adapters.providerEvent!()) : Promise.resolve(null)
  ]);
  const quote = await read(() => adapters.quote());
  const simulation = quote ? await read(() => adapters.simulation(quote)) : null;
  return { eligibility, quantity, reference, settlement, portfolioValuations,
    session, tokenStatus, audit, event, providerEvent, quote, simulation };
}

/** Only a provider-origin timestamp is accepted; observedAt is just receipt metadata. */
export function adaptTimestampedReference(payload: unknown, receivedAt: string,
  source: string, underlyingId: string): ReferenceEvidence | null {
  if (!payload || typeof payload !== "object") return null;
  const data = payload as Record<string, unknown>;
  if (typeof data.sourceAt !== "string" || typeof data.pricePerShare !== "string"
    || !/^[1-9][0-9]*$/.test(data.pricePerShare)) return null;
  return { source, underlyingId, sourceAt: data.sourceAt, receivedAt,
    pricePerShare: BigInt(data.pricePerShare) };
}
