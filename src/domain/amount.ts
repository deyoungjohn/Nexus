import { requireInput } from "./errors.js";

export interface Denomination {
  readonly assetId: string;
  readonly decimals: number;
}

export interface Amount extends Denomination {
  readonly units: bigint;
}

export interface SerializedAmount extends Denomination {
  readonly units: string;
}

export function chainId(value: number): void {
  requireInput(Number.isSafeInteger(value) && value > 0, "INVALID_CHAIN", "Chain ID must be a positive safe integer.");
}

export function tokenAssetId(chain: number, address: string): string {
  chainId(chain);
  requireInput(typeof address === "string" && /^0x[0-9a-fA-F]{40}$/.test(address)
    && !/^0x0{40}$/.test(address), "INVALID_ADDRESS", "Expected a nonzero 20-byte token address.");
  return `eip155:${chain}/erc20:${address.toLowerCase()}`;
}

export function nativeAssetId(chain: number): string {
  chainId(chain);
  return `eip155:${chain}/native`;
}

export function validateDenomination(value: Denomination): void {
  requireInput(typeof value.assetId === "string", "INVALID_ASSET", "Asset ID must be a canonical chain asset identifier.");
  const match = /^eip155:([1-9][0-9]*)\/(native|erc20:0x[0-9a-f]{40})$/.exec(value.assetId);
  requireInput(match !== null, "INVALID_ASSET", "Ticker symbols are not denominations.");
  chainId(Number(match[1]));
  requireInput(!value.assetId.endsWith(`erc20:0x${"0".repeat(40)}`), "INVALID_ASSET", "Zero token address is invalid.");
  requireInput(Number.isInteger(value.decimals) && value.decimals >= 0 && value.decimals <= 255,
    "INVALID_DECIMALS", "Decimals must be an integer from 0 to 255.");
}

export function amount(units: bigint, denomination: Denomination): Amount {
  validateDenomination(denomination);
  requireInput(typeof units === "bigint" && units >= 0n, "INVALID_AMOUNT", "Units must be a nonnegative bigint.");
  return Object.freeze({ assetId: denomination.assetId, decimals: denomination.decimals, units });
}

export function parseAmount(value: string, denomination: Denomination): Amount {
  validateDenomination(denomination);
  requireInput(typeof value === "string" && /^(0|[1-9][0-9]*)(\.[0-9]+)?$/.test(value),
    "INVALID_DECIMAL", "Expected an unsigned plain decimal string without whitespace.");
  const [whole = "", fraction = ""] = value.split(".");
  requireInput(fraction.length <= denomination.decimals, "EXCESS_PRECISION", "Input exceeds denomination precision.");
  return amount(BigInt(whole) * 10n ** BigInt(denomination.decimals)
    + BigInt(fraction.padEnd(denomination.decimals, "0") || "0"), denomination);
}

export function formatAmount(value: Amount): string {
  amount(value.units, value);
  if (value.decimals === 0) return value.units.toString();
  const digits = value.units.toString().padStart(value.decimals + 1, "0");
  const fraction = digits.slice(-value.decimals).replace(/0+$/, "");
  return digits.slice(0, -value.decimals) + (fraction ? `.${fraction}` : "");
}

export function assertSameDenomination(left: Amount, right: Amount): void {
  amount(left.units, left);
  amount(right.units, right);
  requireInput(left.assetId === right.assetId && left.decimals === right.decimals,
    "DENOMINATION_MISMATCH", "Amounts must have the same asset and precision.");
}

export function add(left: Amount, right: Amount): Amount {
  assertSameDenomination(left, right);
  return amount(left.units + right.units, left);
}

export function subtract(left: Amount, right: Amount): Amount {
  assertSameDenomination(left, right);
  requireInput(left.units >= right.units, "AMOUNT_UNDERFLOW", "Subtraction would produce a negative amount.");
  return amount(left.units - right.units, left);
}

export function compare(left: Amount, right: Amount): -1 | 0 | 1 {
  assertSameDenomination(left, right);
  return left.units < right.units ? -1 : left.units > right.units ? 1 : 0;
}

export function serializeAmount(value: Amount): SerializedAmount {
  amount(value.units, value);
  return { assetId: value.assetId, decimals: value.decimals, units: value.units.toString() };
}

export function deserializeAmount(value: unknown): Amount {
  requireInput(typeof value === "object" && value !== null && !Array.isArray(value),
    "INVALID_SERIALIZED_AMOUNT", "Expected a denominated amount object.");
  const record = value as Record<string, unknown>;
  requireInput(Object.keys(record).length === 3 && typeof record.assetId === "string"
    && typeof record.decimals === "number" && typeof record.units === "string"
    && /^(0|[1-9][0-9]*)$/.test(record.units), "INVALID_SERIALIZED_AMOUNT", "Expected assetId, decimals and canonical string units only.");
  return amount(BigInt(record.units), { assetId: record.assetId, decimals: record.decimals });
}
