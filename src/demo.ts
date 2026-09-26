import { allocateBudget } from "./domain/allocation.js";
import { nativeAssetId, parseAmount, tokenAssetId } from "./domain/amount.js";

// Synthetic identity only. This address is not a verified supported instrument.
const settlement = { assetId: tokenAssetId(56, `0x${"1".repeat(40)}`), decimals: 6 };
const gas = { assetId: nativeAssetId(56), decimals: 18 };
const cash = (value: string) => parseAmount(value, settlement);
const result = allocateBudget({
  confirmed: cash("100"), reserved: cash("10"), minimumReserve: cash("10"), feeAllowance: cash("5"),
  nativeGas: parseAmount("0.01", gas), requiredNativeGas: parseAmount("0.001", gas),
}, [
  { id: "basket-a", priority: 2, requested: cash("40") },
  { id: "basket-b", priority: 2, requested: cash("35") },
  { id: "basket-c", priority: 2, requested: cash("25") },
]);
console.log(JSON.stringify({
  label: "SYNTHETIC ALLOCATION EXAMPLE — cannot execute; no market or portfolio eligibility checks",
  result,
}, (_key, value: unknown) => typeof value === "bigint" ? value.toString() : value, 2));
