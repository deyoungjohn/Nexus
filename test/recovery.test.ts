import assert from "node:assert/strict";
import test from "node:test";
import { classifyEoaObservation, nextSequentialAction } from "../src/execution/recovery.js";

const txHash = `0x${"a".repeat(64)}`;
const blockHash = `0x${"b".repeat(64)}`;
const wallet = "0x1111111111111111111111111111111111111111";
const tracked = { hash: txHash, wallet, nonce: 7n, state: "unknown" as const,
  includedBlockHash: null };
const base = { headBlock: 100n, latestNonce: 7n, receipt: null, replacement: null };

test("P7 timeout and consumed wallet nonce never imply a failed transaction", () => {
  assert.deepEqual(classifyEoaObservation(tracked, base, 12n), {
    state: "unknown", reason: "PENDING_OR_UNKNOWN", receipt: null, replacementHash: null });
  assert.equal(classifyEoaObservation(tracked, { ...base, latestNonce: 8n }, 12n).reason,
    "NONCE_USED_UNKNOWN");
  assert.equal(classifyEoaObservation({ ...tracked, state: "signed" }, base, 12n).state, "signed");
});

test("P7 inclusion, finality, reorg and replacement remain distinct", () => {
  const receipt = { hash: txHash, blockNumber: 100n, blockHash, success: true };
  assert.equal(classifyEoaObservation(tracked, { ...base, receipt }, 12n).state, "included");
  assert.equal(classifyEoaObservation(tracked, { ...base, receipt, headBlock: 111n }, 12n).state, "confirmed");
  assert.equal(classifyEoaObservation(tracked, { ...base, receipt: { ...receipt, success: false },
    headBlock: 111n }, 12n).state, "reverted");
  assert.equal(classifyEoaObservation({ ...tracked, state: "included", includedBlockHash: blockHash },
    base, 12n).state, "reorged");
  assert.equal(classifyEoaObservation({ ...tracked, state: "confirmed", includedBlockHash: blockHash },
    { ...base, headBlock: 112n, latestNonce: 8n }, 12n).state, "reorged");
  assert.equal(classifyEoaObservation({ ...tracked, state: "included", includedBlockHash: blockHash },
    { ...base, receipt: { ...receipt, blockHash: `0x${"c".repeat(64)}` } }, 12n).state, "reorged");
  const replacement = { from: wallet, nonce: 7n, receipt: { ...receipt, hash: `0x${"d".repeat(64)}` } };
  assert.equal(classifyEoaObservation(tracked, { ...base, replacement }, 12n).state, "unknown");
  assert.equal(classifyEoaObservation(tracked, { ...base, replacement, headBlock: 111n }, 12n).state, "replaced");
  assert.throws(() => classifyEoaObservation(tracked, { ...base,
    replacement: { ...replacement, nonce: 8n } }, 12n), { code: "INVALID_REPLACEMENT" });
});

test("P7 sell requires confirmed new revision and partial buys keep cash", () => {
  const sold = [{ id: "sell-a", state: "confirmed" as const, confirmedSpend: 0n }];
  assert.equal(nextSequentialAction("sell", 3n, 3n, 100n, sold).action, "await-reconciliation");
  assert.equal(nextSequentialAction("sell", 3n, 4n, 100n, sold).action, "replan-buy");
  const basket = [
    { id: "buy-a", state: "confirmed" as const, confirmedSpend: 40n },
    { id: "buy-b", state: "confirmed" as const, confirmedSpend: 35n },
    { id: "buy-c", state: "reverted" as const, confirmedSpend: 0n }
  ];
  assert.deepEqual(nextSequentialAction("buy", 3n, 4n, 100n, basket), {
    action: "partial", invested: 75n, remainingCash: 25n,
    reason: "UNSPENT_FUNDS_STAY_CASH" });
  assert.equal(nextSequentialAction("buy", 3n, 4n, 100n,
    basket.map((leg, index) => index === 2 ? { ...leg, state: "unknown" } : leg)).action,
  "await-reconciliation");
  assert.equal(nextSequentialAction("buy", 3n, 4n, 100n,
    basket.map((leg, index) => index === 2 ? { ...leg, state: "replaced" } : leg)).action,
  "blocked");
  assert.throws(() => nextSequentialAction("buy", 3n, 4n, 50n, basket), { code: "BUDGET_OVERRUN" });
});
