import { requireInput } from "../domain/errors.js";

/** Only known quantity keys are revived; event/mapping/review revisions remain strings. */
const quantities = new Set(["units", "sourceBlock", "transferBlock", "shareUnitsNumerator", "shareUnitsDenominator",
  "pricePerShare", "lowerValueNumerator", "upperValueNumerator", "denominator", "valueLower", "valueUpper",
  "cashValueLower", "inputRaw", "expectedOutputRaw", "minimumOutputRaw", "additionalFeeSettlement",
  "networkFeeSettlement", "nativeFeeRaw", "value", "allowanceRaw", "outputRaw", "maxBlockLag",
  "maxNetworkFeeSettlement", "maxAdditionalFeeSettlement", "nominalValue", "acquiredValueLower",
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
  return parsed as T;
}
