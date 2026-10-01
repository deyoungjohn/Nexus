import assert from "node:assert/strict";
import test from "node:test";
import { amount, nativeAssetId, tokenAssetId } from "../src/domain/amount.js";
import { verifyEoaBalanceDelta } from "../src/execution/reconcile.js";

const tokenIn = "0x1111111111111111111111111111111111111111";
const tokenOut = "0x2222222222222222222222222222222222222222";
const input = { chainId: 56, tokenIn, tokenOut, inputRaw: 5n, minimumOutputRaw: 3n };
const inDenom = { assetId: tokenAssetId(56, tokenIn), decimals: 18 };
const outDenom = { assetId: tokenAssetId(56, tokenOut), decimals: 18 };
const gasDenom = { assetId: nativeAssetId(56), decimals: 18 };
const before = [amount(10n, inDenom), amount(0n, outDenom), amount(100n, gasDenom)];
const after = [amount(5n, inDenom), amount(4n, outDenom), amount(99n, gasDenom)];

test("P7 confirmed exact-input balance delta reconciles and excludes native gas", () => {
  assert.deepEqual(verifyEoaBalanceDelta({ ...input, success: true, before, after }),
    { spent: 5n, received: 4n });
  assert.throws(() => verifyEoaBalanceDelta({ ...input, success: true, before,
    after: [amount(6n, inDenom), ...after.slice(1)] }), { code: "INPUT_DELTA_MISMATCH" });
  assert.throws(() => verifyEoaBalanceDelta({ ...input, success: true, before,
    after: [after[0]!, amount(2n, outDenom), after[2]!] }), { code: "OUTPUT_DELTA_MISMATCH" });
  assert.throws(() => verifyEoaBalanceDelta({ ...input, success: true, before,
    after: after.slice(0, 2) }), { code: "MISSING_BALANCE" });
  const third = { assetId: tokenAssetId(56, "0x3333333333333333333333333333333333333333"), decimals: 18 };
  assert.throws(() => verifyEoaBalanceDelta({ ...input, success: true,
    before: [...before, amount(2n, third)], after }), { code: "INCOMPLETE_BALANCES" });
});

test("P7 reverted or externally changed balances cannot be auto-reconciled", () => {
  assert.deepEqual(verifyEoaBalanceDelta({ ...input, success: false, before,
    after: [before[0]!, before[1]!, after[2]!] }), { spent: 0n, received: 0n });
  assert.throws(() => verifyEoaBalanceDelta({ ...input, success: false, before, after }),
    { code: "REVERTED_BALANCE_CHANGE" });
  const third = { assetId: tokenAssetId(56, "0x3333333333333333333333333333333333333333"), decimals: 18 };
  assert.throws(() => verifyEoaBalanceDelta({ ...input, success: true, before,
    after: [...after, amount(1n, third)] }), { code: "INCOMPLETE_BALANCES" });
  assert.throws(() => verifyEoaBalanceDelta({ ...input, success: true,
    before: [...before, amount(2n, third)], after: [...after, amount(3n, third)] }),
  { code: "EXTERNAL_BALANCE_CHANGE" });
});
