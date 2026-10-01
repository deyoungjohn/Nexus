import assert from "node:assert/strict";
import test from "node:test";
import { id } from "ethers";
import { amount, nativeAssetId, tokenAssetId } from "../src/domain/amount.js";
import { verifyEoaReceiptEffects,
  type EoaReceiptEffectProof, type EoaReceiptLog } from "../src/execution/receipt-effects.js";

const wallet = "0x1111111111111111111111111111111111111111";
const router = "0x2222222222222222222222222222222222222222";
const tokenIn = "0x3333333333333333333333333333333333333333";
const tokenOut = "0x4444444444444444444444444444444444444444";
const transactionHash = `0x${"a".repeat(64)}`;
const blockHash = `0x${"b".repeat(64)}`;
const native = { assetId: nativeAssetId(56), decimals: 18 };
const inputDenom = { assetId: tokenAssetId(56, tokenIn), decimals: 18 };
const outputDenom = { assetId: tokenAssetId(56, tokenOut), decimals: 18 };
const before = [amount(10n, inputDenom), amount(0n, outputDenom), amount(100n, native)];
const after = [amount(5n, inputDenom), amount(4n, outputDenom), amount(98n, native)];
const topic = (address: string): string => `0x${address.slice(2).padStart(64, "0")}`;
const transfer = (address: string, from: string, to: string,
  units: bigint, logIndex: bigint): EoaReceiptLog => ({
  address, topics: [id("Transfer(address,address,uint256)"), topic(from), topic(to)],
  data: `0x${units.toString(16).padStart(64, "0")}`, transactionHash,
  blockHash, blockNumber: 100n, logIndex, removed: false });
const proof: EoaReceiptEffectProof = { transactionHash, from: wallet, to: router,
  blockNumber: 100n, blockHash, success: true, gasUsed: 2n,
  effectiveGasPrice: 1n,
  logs: [transfer(tokenIn, wallet, router, 5n, 0n),
    transfer(tokenOut, router, wallet, 4n, 1n)] };
const request = { proof, chainId: 56, wallet, transactionHash, router,
  tokenIn, tokenOut, inputRaw: 5n, minimumOutputRaw: 3n,
  transactionValue: 0n, before, after };

test("P7 receipt Transfer effects and actual gas exactly explain wallet balance delta", () => {
  assert.deepEqual(verifyEoaReceiptEffects(request), {
    spent: 5n, received: 4n, gasFee: 2n,
    proofHash: verifyEoaReceiptEffects(request).proofHash });
  assert.match(verifyEoaReceiptEffects(request).proofHash, /^[0-9a-f]{64}$/);
});

test("P7 receipt proof rejects missing, spoofed, malformed and duplicate effects", () => {
  assert.throws(() => verifyEoaReceiptEffects({ ...request,
    proof: { ...proof, logs: proof.logs.slice(0, 1) } }),
  { code: "RECEIPT_EFFECT_MISMATCH" });
  assert.throws(() => verifyEoaReceiptEffects({ ...request,
    proof: { ...proof, logs: [proof.logs[0]!,
      { ...proof.logs[1]!, address: router }] } }),
  { code: "RECEIPT_EFFECT_MISMATCH" });
  assert.throws(() => verifyEoaReceiptEffects({ ...request,
    proof: { ...proof, logs: [proof.logs[0]!,
      { ...proof.logs[1]!, topics: [proof.logs[1]!.topics[0]!] }] } }),
  { code: "INVALID_TRANSFER_LOG" });
  assert.throws(() => verifyEoaReceiptEffects({ ...request,
    proof: { ...proof, logs: [proof.logs[0]!,
      { ...proof.logs[1]!, logIndex: 0n }] } }),
  { code: "INVALID_RECEIPT_LOG" });
  assert.throws(() => verifyEoaReceiptEffects({ ...request,
    proof: { ...proof, logs: [proof.logs[0]!,
      { ...proof.logs[1]!, removed: true }] } }),
  { code: "INVALID_RECEIPT_LOG" });
  assert.throws(() => verifyEoaReceiptEffects({ ...request,
    proof: { ...proof, effectiveGasPrice: 2n } }),
  { code: "GAS_DELTA_MISMATCH" });
  assert.throws(() => verifyEoaReceiptEffects({ ...request,
    transactionValue: 1n }), { code: "INVALID_RECEIPT_PROOF" });
});

test("P7 reverted receipt requires no Transfer logs and only gas loss", () => {
  const reverted = { ...proof, success: false, logs: [] };
  const unchanged = [before[0]!, before[1]!, amount(98n, native)];
  assert.equal(verifyEoaReceiptEffects({ ...request, proof: reverted,
    after: unchanged }).received, 0n);
  assert.throws(() => verifyEoaReceiptEffects({ ...request,
    proof: { ...reverted, logs: [proof.logs[0]!] }, after: unchanged }),
  { code: "RECEIPT_EFFECT_MISMATCH" });
});

test("P7 BEP-677 display events and multiplier notices do not duplicate raw stock receipts", () => {
  const raw = { ...proof.logs[1]!, logIndex: 1n };
  const display = { ...raw, logIndex: 2n,
    topics: [id("TransferWithUIAmount(address,address,uint256,uint256)"), ...raw.topics.slice(1)],
    data: `${raw.data}${"8".padStart(64, "0")}` };
  const notice = { ...raw, logIndex: 3n, topics: [id("UIMultiplierUpdated(uint256,uint256,uint256)")],
    data: `0x${"1".padStart(64, "0")}${"2".padStart(64, "0")}${"0".repeat(64)}` };
  for (const uiData of [display.data, `${raw.data}${"0".repeat(64)}`]) {
    const result = verifyEoaReceiptEffects({ ...request,
      proof: { ...proof, logs: [proof.logs[0]!, raw, { ...display, data: uiData }, notice] } });
    assert.equal(result.received, 4n);
    assert.equal(result.spent, 5n);
  }
  assert.throws(() => verifyEoaReceiptEffects({ ...request,
    proof: { ...proof, logs: [proof.logs[0]!, display] } }), { code: "RECEIPT_EFFECT_MISMATCH" });
});
