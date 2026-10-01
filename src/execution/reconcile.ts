import { amount, nativeAssetId, tokenAssetId, type Amount } from "../domain/amount.js";
import { requireInput } from "../domain/errors.js";

export interface EoaBalanceDeltaRequest {
  readonly chainId: number;
  readonly tokenIn: string;
  readonly tokenOut: string;
  readonly inputRaw: bigint;
  readonly minimumOutputRaw: bigint;
  readonly success: boolean;
  readonly before: readonly Amount[];
  readonly after: readonly Amount[];
}

/** Only a supported exact-input fill can reconcile automatically. */
export function verifyEoaBalanceDelta(input: EoaBalanceDeltaRequest): { spent: bigint; received: bigint } {
  const inputAsset = tokenAssetId(input.chainId, input.tokenIn);
  const outputAsset = tokenAssetId(input.chainId, input.tokenOut);
  requireInput(inputAsset !== outputAsset && input.inputRaw > 0n && input.minimumOutputRaw > 0n,
    "INVALID_LEG", "Distinct tokens and positive exact-input bounds required.");
  const index = (values: readonly Amount[]): Map<string, Amount> => {
    const result = new Map<string, Amount>();
    for (const value of values) {
      amount(value.units, value);
      requireInput(value.assetId.startsWith(`eip155:${input.chainId}/`) && !result.has(value.assetId),
        "INVALID_BALANCES", "Balances must be unique and on the leg chain.");
      result.set(value.assetId, value);
    }
    return result;
  };
  const before = index(input.before), after = index(input.after);
  const nativeAsset = nativeAssetId(input.chainId);
  requireInput(before.has(inputAsset) && after.has(inputAsset) && after.has(outputAsset)
    && before.has(nativeAsset) && after.has(nativeAsset),
  "MISSING_BALANCE", "Exact input, output and native gas balances are required.");
  requireInput([...before.keys()].every(asset => after.has(asset))
    && [...after.keys()].every(asset => before.has(asset) || asset === outputAsset),
  "INCOMPLETE_BALANCES", "Every previously tracked asset must remain in the snapshot.");
  for (const asset of new Set([...before.keys(), ...after.keys()])) {
    const old = before.get(asset), current = after.get(asset);
    requireInput(!old || !current || old.decimals === current.decimals,
      "DENOMINATION_CHANGED", "Asset precision changed.");
    if (asset !== inputAsset && asset !== outputAsset && asset !== nativeAsset)
      requireInput((old?.units ?? 0n) === (current?.units ?? 0n),
        "EXTERNAL_BALANCE_CHANGE", "Unrelated token balance changed during leg.");
  }
  const oldIn = before.get(inputAsset)!.units, newIn = after.get(inputAsset)!.units;
  const oldOut = before.get(outputAsset)?.units ?? 0n, newOut = after.get(outputAsset)!.units;
  const oldNative = before.get(nativeAsset)!.units;
  const newNative = after.get(nativeAsset)!.units;
  requireInput(newNative <= oldNative, "EXTERNAL_BALANCE_CHANGE", "Native balance increased during leg.");
  if (!input.success) {
    requireInput(newIn === oldIn && newOut === oldOut,
      "REVERTED_BALANCE_CHANGE", "Reverted swap changed tracked token balances.");
    return { spent: 0n, received: 0n };
  }
  requireInput(oldIn - newIn === input.inputRaw,
    "INPUT_DELTA_MISMATCH", "Confirmed swap did not spend exact input.");
  requireInput(newOut >= oldOut && newOut - oldOut >= input.minimumOutputRaw,
    "OUTPUT_DELTA_MISMATCH", "Confirmed output is below approved minimum.");
  return { spent: input.inputRaw, received: newOut - oldOut };
}
