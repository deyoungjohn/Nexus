import assert from "node:assert/strict";
import { test } from "node:test";
import {
  add, amount, compare, deserializeAmount, formatAmount, nativeAssetId, parseAmount,
  serializeAmount, subtract, tokenAssetId,
} from "../src/domain/amount.js";

const asset = { assetId: tokenAssetId(56, `0x${"a".repeat(40)}`), decimals: 6 };

test("decimal parsing and JSON round trip preserve units beyond safe number range", () => {
  const value = parseAmount("9007199254740993.123456", asset);
  assert.equal(value.units, 9007199254740993123456n);
  assert.equal(formatAmount(value), "9007199254740993.123456");
  assert.deepEqual(deserializeAmount(JSON.parse(JSON.stringify(serializeAmount(value)))), value);
  assert.equal(formatAmount(parseAmount("0.000001", asset)), "0.000001");
  assert.equal(formatAmount(parseAmount("1.230000", asset)), "1.23");
});

test("zero and boundary precisions round trip exactly", () => {
  for (const decimals of [0, 1, 6, 18, 255]) {
    const denomination = { ...asset, decimals };
    for (const units of [0n, 1n, 17n, 9007199254740993123456n]) {
      const value = amount(units, denomination);
      assert.deepEqual(parseAmount(formatAmount(value), denomination), value);
    }
  }
});

test("invalid decimal syntax and excess precision cannot be silently rounded", () => {
  for (const value of ["", " 1", "1 ", "-1", "+1", "1e3", "01", ".1", "1.", "NaN", "1,000", "0.0000001"]) {
    assert.throws(() => parseAmount(value, asset));
  }
  assert.throws(() => parseAmount("1.0", { ...asset, decimals: 0 }), { code: "EXCESS_PRECISION" });
  assert.throws(() => amount(1 as unknown as bigint, asset), { code: "INVALID_AMOUNT" });
  assert.throws(() => amount(-1n, asset), { code: "INVALID_AMOUNT" });
});

test("arithmetic enforces denomination, precision and nonnegative balances", () => {
  const a = parseAmount("10", asset);
  const b = parseAmount("3.25", asset);
  assert.equal(formatAmount(add(a, b)), "13.25");
  assert.equal(formatAmount(subtract(a, b)), "6.75");
  assert.equal(compare(a, b), 1);
  assert.equal(compare(b, a), -1);
  assert.equal(compare(a, a), 0);
  assert.throws(() => subtract(b, a), { code: "AMOUNT_UNDERFLOW" });
  for (const mismatch of [amount(1n, { assetId: nativeAssetId(56), decimals: 18 }), amount(1n, { ...asset, decimals: 18 })]) {
    for (const operation of [add, subtract, compare]) {
      assert.throws(() => operation(a, mismatch), { code: "DENOMINATION_MISMATCH" });
    }
  }
});

test("asset identity and decimals reject ambiguous or unsafe values", () => {
  assert.equal(tokenAssetId(56, `0x${"A".repeat(40)}`), asset.assetId);
  for (const chain of [0, -1, 1.5, Number.MAX_SAFE_INTEGER + 1, NaN]) {
    assert.throws(() => nativeAssetId(chain));
  }
  for (const address of ["NVDA", "0x123", `0x${"0".repeat(40)}`]) assert.throws(() => tokenAssetId(56, address));
  for (const decimals of [-1, 256, 1.2, NaN]) assert.throws(() => amount(0n, { ...asset, decimals }));
  for (const assetId of ["USDT", "eip155:056/native", `eip155:56/erc20:0x${"A".repeat(40)}`, `eip155:56/erc20:0x${"0".repeat(40)}`]) {
    assert.throws(() => amount(1n, { assetId, decimals: 6 }));
  }
});

test("deserialization rejects lossy numbers, unexpected fields and malformed units", () => {
  for (const value of [null, [], {}, { ...asset, units: 1 }, { ...asset, units: "01" },
    { ...asset, units: "-1" }, { ...asset, units: "1.0" }, { ...asset, units: "1", extra: true }]) {
    assert.throws(() => deserializeAmount(value), { code: "INVALID_SERIALIZED_AMOUNT" });
  }
  assert.ok(Object.isFrozen(amount(1n, asset)));
});
