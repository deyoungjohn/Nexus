import assert from "node:assert/strict";
import { test } from "node:test";
import { allocateBudget, type Budget, type SpendingRequest } from "../src/domain/allocation.js";
import { amount, nativeAssetId, tokenAssetId } from "../src/domain/amount.js";

const settlement = { assetId: tokenAssetId(56, `0x${"1".repeat(40)}`), decimals: 6 };
const gas = { assetId: nativeAssetId(56), decimals: 18 };
const cash = (units: bigint) => amount(units, settlement);
const budget = (units: bigint, patch: Partial<Budget> = {}): Budget => ({
  confirmed: cash(units), reserved: cash(0n), minimumReserve: cash(0n), feeAllowance: cash(0n),
  nativeGas: amount(10n, gas), requiredNativeGas: amount(1n, gas), ...patch,
});
const request = (id: string, units: bigint, priority = 2): SpendingRequest => ({ id, priority, requested: cash(units) });

test("budget subtracts reservations, minimum cash and fees before allocation", () => {
  const result = allocateBudget(budget(100n, { reserved: cash(10n), minimumReserve: cash(20n), feeAllowance: cash(5n) }), [request("a", 100n)]);
  assert.equal(result.available.units, 65n);
  assert.equal(result.decisions[0]?.accepted.units, 65n);
  assert.equal(result.decisions[0]?.rejected.units, 35n);
  assert.equal(result.decisions[0]?.status, "reduced");
  assert.equal(result.decisions[0]?.reason, "CASH_LIMIT");
  assert.equal(result.unallocated.units, 0n);
});

test("higher priority is funded first, then proportional peers with stable rounding ties", () => {
  const result = allocateBudget(budget(7n), [request("c", 5n), request("b", 5n), request("first", 2n, 0), request("last", 1n, 3)]);
  assert.deepEqual(result.decisions.map((d) => [d.id, d.accepted.units]), [["first", 2n], ["b", 3n], ["c", 2n], ["last", 0n]]);
  assert.equal(result.decisions[0]?.reason, "ACCEPTED");
  assert.equal(result.decisions[3]?.status, "rejected");
});

test("largest fractional remainder precedes ID tie-break ordering", () => {
  const result = allocateBudget(budget(2n), [request("a", 1n), request("z", 3n)]);
  assert.deepEqual(result.decisions.map((d) => d.accepted.units), [1n, 1n]);
  const nonTie = allocateBudget(budget(1n), [request("a", 1n), request("z", 3n)]);
  assert.deepEqual(nonTie.decisions.map((d) => d.accepted.units), [0n, 1n]);
});

test("unspent funds remain cash; zero budget and empty requests are valid", () => {
  assert.equal(allocateBudget(budget(100n), [request("a", 40n)]).unallocated.units, 60n);
  const empty = allocateBudget(budget(100n), []);
  assert.deepEqual(empty.decisions, []);
  assert.equal(empty.unallocated.units, 100n);
  const zero = allocateBudget(budget(0n), [request("a", 1n)]);
  assert.equal(zero.status, "allocated");
  assert.equal(zero.decisions[0]?.reason, "CASH_LIMIT");
  assert.equal(zero.decisions[0]?.accepted.units, 0n);
});

test("insufficient commitments block allocation instead of inventing funds", () => {
  const result = allocateBudget(budget(5n, { reserved: cash(6n) }), [request("a", 1n)]);
  assert.equal(result.status, "blocked");
  assert.deepEqual(result.blockers, ["INSUFFICIENT_SETTLEMENT"]);
  assert.equal(result.available.units, 0n);
  assert.equal(result.decisions[0]?.reason, "INSUFFICIENT_SETTLEMENT");
  assert.equal(result.decisions[0]?.accepted.units, 0n);
});

test("native gas insufficiency blocks spending regardless of settlement wealth", () => {
  const result = allocateBudget(budget(10n ** 30n, { nativeGas: amount(0n, gas) }), [request("a", 1n)]);
  assert.equal(result.status, "blocked");
  assert.deepEqual(result.blockers, ["INSUFFICIENT_NATIVE_GAS"]);
  assert.equal(result.unallocated.units, 10n ** 30n);
  assert.equal(result.decisions[0]?.accepted.units, 0n);
  const both = allocateBudget(budget(0n, { reserved: cash(1n), nativeGas: amount(0n, gas) }), []);
  assert.deepEqual(both.blockers, ["INSUFFICIENT_SETTLEMENT", "INSUFFICIENT_NATIVE_GAS"]);
});

test("gas denomination must be native, separate from settlement and on the same chain", () => {
  assert.throws(() => allocateBudget(budget(10n, { nativeGas: cash(10n), requiredNativeGas: cash(1n) }), []), { code: "INVALID_GAS_ASSET" });
  const otherGas = { ...gas, assetId: nativeAssetId(1) };
  assert.throws(() => allocateBudget(budget(10n, { nativeGas: amount(10n, otherGas), requiredNativeGas: amount(1n, otherGas) }), []), { code: "INVALID_GAS_ASSET" });
  assert.throws(() => allocateBudget(budget(10n, { feeAllowance: amount(1n, gas) }), []), { code: "DENOMINATION_MISMATCH" });
  assert.throws(() => allocateBudget(budget(10n), [{ ...request("a", 1n), requested: amount(1n, gas) }]), { code: "DENOMINATION_MISMATCH" });
});

test("request validation rejects ambiguous IDs, duplicate IDs, zero amounts and invalid priority", () => {
  for (const requests of [[request("same", 1n), request("same", 2n)], [request("", 1n)],
    [request("é", 1n)], [request("a", 0n)], [request("a", 1n, -1)], [request("a", 1n, 0.5)], [request("a", 1n, NaN)]]) {
    assert.throws(() => allocateBudget(budget(10n), requests));
  }
});

test("large allocations preserve exact base units", () => {
  const units = 9007199254740993123456789n;
  const result = allocateBudget(budget(units), [request("a", units), request("b", units)]);
  assert.equal(result.decisions[0]?.accepted.units, (units + 1n) / 2n);
  assert.equal(result.decisions[1]?.accepted.units, units / 2n);
});

test("generated cases conserve inventory, bound each request and replay independently of input order", () => {
  // Deterministic generator makes every failure reproducible without a seed service.
  let seed = 123456789;
  const next = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed; };
  for (let caseId = 0; caseId < 1000; caseId++) {
    const units = BigInt(next() % 100000);
    const inputs = Array.from({ length: 1 + next() % 20 }, (_, i) => request(`r-${i}`, BigInt(1 + next() % 10000), next() % 4));
    const result = allocateBudget(budget(units), inputs);
    assert.deepEqual(allocateBudget(budget(units), [...inputs].reverse()), result, `case ${caseId}`);
    let spent = 0n;
    for (const decision of result.decisions) {
      assert.ok(decision.accepted.units >= 0n && decision.accepted.units <= decision.requested.units);
      assert.equal(decision.accepted.units + decision.rejected.units, decision.requested.units);
      spent += decision.accepted.units;
      if (decision.accepted.units > 0n) {
        assert.ok(result.decisions.filter((d) => d.priority < decision.priority).every((d) => d.accepted.units === d.requested.units));
      }
    }
    const demand = inputs.reduce((sum, item) => sum + item.requested.units, 0n);
    assert.equal(spent + result.unallocated.units, units);
    assert.equal(spent, units < demand ? units : demand);
  }
});

test("allocation output is an immutable snapshot of mutable request inputs", () => {
  const requested = { ...cash(2n) };
  const result = allocateBudget(budget(10n), [{ id: "a", priority: 0, requested }]);
  requested.units = 100n;
  assert.equal(result.decisions[0]?.requested.units, 2n);
  assert.ok(Object.isFrozen(result));
  assert.ok(Object.isFrozen(result.decisions));
  assert.ok(Object.isFrozen(result.decisions[0]));
});
