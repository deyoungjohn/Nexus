import { tokenAssetId, validateDenomination } from "./amount.js";
import { identifier, requireInput } from "./errors.js";

export interface InstrumentInput {
  readonly chainId: number;
  readonly tokenAddress: string;
  readonly issuerId: string;
  readonly productType: string;
  readonly underlyingId: string;
  readonly ticker: string;
  readonly decimals: number;
  readonly quantityModel: string;
  readonly adapterVersion: string;
  readonly sectorTags: readonly string[];
  readonly classificationVersion: string;
  readonly statusSource: string;
  readonly referenceSource: string;
  readonly eligibilityRequirements: readonly string[];
}

export interface Instrument extends InstrumentInput {
  readonly instrumentId: string;
  readonly assetId: string;
}

export function createInstrument(input: InstrumentInput): Instrument {
  const assetId = tokenAssetId(input.chainId, input.tokenAddress);
  validateDenomination({ assetId, decimals: input.decimals });
  for (const value of [input.issuerId, input.productType, input.underlyingId, input.quantityModel,
    input.adapterVersion, input.classificationVersion, input.statusSource, input.referenceSource]) identifier(value);
  requireInput(typeof input.ticker === "string" && /^[A-Za-z0-9][A-Za-z0-9.-]{0,31}$/.test(input.ticker),
    "INVALID_TICKER", "Expected a ticker label.");
  for (const values of [input.sectorTags, input.eligibilityRequirements]) {
    requireInput(Array.isArray(values) && values.length > 0, "MISSING_METADATA", "Classification and eligibility requirements must be explicit.");
    values.forEach(identifier);
    requireInput(new Set(values).size === values.length, "DUPLICATE_METADATA", "Metadata entries must be unique.");
  }
  return Object.freeze({
    ...input, tokenAddress: input.tokenAddress.toLowerCase(), assetId,
    instrumentId: `${assetId}/issuer:${input.issuerId}/product:${input.productType}`,
    sectorTags: Object.freeze([...input.sectorTags]),
    eligibilityRequirements: Object.freeze([...input.eligibilityRequirements]),
  });
}

/** Metadata lookup only: presence never establishes eligibility or trading permission. */
export class InstrumentRegistry {
  readonly #instruments = new Map<string, Instrument>();

  constructor(inputs: readonly InstrumentInput[]) {
    const assets = new Set<string>();
    for (const input of inputs) {
      const instrument = createInstrument(input);
      requireInput(!this.#instruments.has(instrument.instrumentId) && !assets.has(instrument.assetId),
        "DUPLICATE_INSTRUMENT", "A chain/token identity may have only one registry record.");
      this.#instruments.set(instrument.instrumentId, instrument);
      assets.add(instrument.assetId);
    }
  }

  get(instrumentId: string): Instrument {
    const result = this.#instruments.get(instrumentId);
    requireInput(result !== undefined, "UNKNOWN_INSTRUMENT", "Resolve an exact instrument ID; tickers are not identities.");
    return result;
  }

  forUnderlying(underlyingId: string): readonly Instrument[] {
    return Object.freeze([...this.#instruments.values()]
      .filter((value) => value.underlyingId === underlyingId)
      .sort((a, b) => a.instrumentId < b.instrumentId ? -1 : a.instrumentId > b.instrumentId ? 1 : 0));
  }
}
