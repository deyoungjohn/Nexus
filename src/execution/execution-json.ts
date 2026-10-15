import { requireInput } from "../domain/errors.js";

/** Only known quantity keys are revived; event/mapping/review revisions remain strings. */
const quantities = new Set(["pilotBootstrapBlock", "roundId", "answeredInRound", "answer18", "midNumerator", "midDenominator", "maximumNativeFeeRaw", "maximumSettlementFeeRaw", "units", "sourceBlock", "transferBlock", "shareUnitsNumerator", "shareUnitsDenominator",
  "pricePerShare", "lowerValueNumerator", "upperValueNumerator", "denominator", "valueLower", "valueUpper",
  "cashValueLower", "inputRaw", "expectedOutputRaw", "minimumOutputRaw", "additionalFeeSettlement",
  "networkFeeSettlement", "nativeFeeRaw", "value", "allowanceRaw", "outputRaw", "maxBlockLag",
  "maxNetworkFeeSettlement", "maxAdditionalFeeSettlement", "maximumSpendRaw", "buyInputRaw", "boughtRaw", "soldRaw",
  "sellOutputRaw", "buyTransferTaxRaw", "sellTransferTaxRaw", "nominalValue", "acquiredValueLower",
  "acquiredValueUpper", "proceedsValueLower", "maxGasLimit", "maxFeePerGas", "portfolioRevision"]);
export const executionJson = (value: unknown): string => JSON.stringify(value,
  (_key, item: unknown) => typeof item === "bigint" ? item.toString() : item);
export function executionInteger(value: unknown): bigint {
  requireInput(typeof value === "string" && /^(0|[1-9][0-9]{0,77})$/.test(value),
    "INVALID_EXECUTION_RECORD", "Stored quantity must be a bounded canonical integer string.");
  return BigInt(value);
}
export function decodeExecutionJson<T>(value: unknown): T {
  const parsed = JSON.parse(executionJson(value), (key, item: unknown) => quantities.has(key)
    && item !== null ? executionInteger(item) : item);
  if (parsed.snapshot) parsed.snapshot.revision = executionInteger(parsed.snapshot.revision);
  // Security controls deliberately retain canonical strings; only manual mapping quantity is raw.
  if (parsed.mapping?.uiMultiplier !== undefined) parsed.mapping.uiMultiplier = executionInteger(parsed.mapping.uiMultiplier);
  if(parsed.evidence?.quantity?.pilotMapping) parsed.evidence.quantity.pilotMapping.uiMultiplier = executionInteger(parsed.evidence.quantity.pilotMapping.uiMultiplier);
  return parsed as T;
}
