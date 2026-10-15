import { createHash } from "node:crypto";
import { id } from "ethers";
import { nativeAssetId, tokenAssetId, type Amount } from "../domain/amount.js";
import { requireInput } from "../domain/errors.js";
import { verifyEoaBalanceDelta } from "./reconcile.js";
import { securityDigest } from '../security/token-security.js';

export interface EoaReceiptLog {
  readonly address: string;
  readonly topics: readonly string[];
  readonly data: string;
  readonly transactionHash: string;
  readonly blockHash: string;
  readonly blockNumber: bigint;
  readonly logIndex: bigint;
  readonly removed: boolean;
}

export interface EoaReceiptEffectProof {
  readonly transactionHash: string;
  readonly from: string;
  readonly to: string;
  readonly blockNumber: bigint;
  readonly blockHash: string;
  readonly success: boolean;
  readonly gasUsed: bigint;
  readonly effectiveGasPrice: bigint;
  readonly logs: readonly EoaReceiptLog[];
}

export interface VerifyEoaReceiptEffectsRequest {
  readonly proof: EoaReceiptEffectProof;
  readonly chainId: number;
  readonly wallet: string;
  readonly transactionHash: string;
  readonly router: string;
  readonly tokenIn: string;
  readonly tokenOut: string;
  readonly inputRaw: bigint;
  readonly minimumOutputRaw: bigint;
  readonly transactionValue: bigint;
  readonly before: readonly Amount[];
  readonly after: readonly Amount[];
}

/** Inclusion coordinates may change in R1; ordered contents and gas may not. */
export function receiptEffectsIdentity(proof:EoaReceiptEffectProof):string {
  return securityDigest({transactionHash:proof.transactionHash.toLowerCase(),from:proof.from.toLowerCase(),
    to:proof.to.toLowerCase(),success:proof.success,gasUsed:proof.gasUsed,effectiveGasPrice:proof.effectiveGasPrice,
    logs:proof.logs.map(l=>({address:l.address.toLowerCase(),topics:l.topics.map(t=>t.toLowerCase()),data:l.data.toLowerCase()}))});
}
export function decodeReceiptProof(proof:EoaReceiptEffectProof):EoaReceiptEffectProof {
  return {...proof,blockNumber:BigInt(proof.blockNumber),gasUsed:BigInt(proof.gasUsed),effectiveGasPrice:BigInt(proof.effectiveGasPrice),
    logs:proof.logs.map(l=>({...l,blockNumber:BigInt(l.blockNumber),logIndex:BigInt(l.logIndex)}))};
}

const hash = (value: unknown): value is string => typeof value === "string"
  && /^0x[0-9a-fA-F]{64}$/.test(value);
const address = (value: unknown): value is string => typeof value === "string"
  && /^0x[0-9a-fA-F]{40}$/.test(value);
const same = (left: string, right: string): boolean => left.toLowerCase() === right.toLowerCase();
const transferTopic = id("Transfer(address,address,uint256)").toLowerCase();
const topicAddress = (topic: string): string | null => /^0x0{24}[0-9a-fA-F]{40}$/.test(topic)
  ? `0x${topic.slice(-40).toLowerCase()}` : null;

/** Checks receipt-local ERC20 wallet movements and exact native gas against persisted deltas. */
export function verifyEoaReceiptEffects(input: VerifyEoaReceiptEffectsRequest): {
  readonly spent: bigint; readonly received: bigint; readonly gasFee: bigint;
  readonly proofHash: string } {
  const proof = input.proof;
  requireInput(input.chainId === 56 && address(input.wallet) && address(input.router)
    && hash(input.transactionHash) && input.transactionValue === 0n
    && hash(proof.transactionHash) && same(proof.transactionHash, input.transactionHash)
    && address(proof.from) && same(proof.from, input.wallet)
    && address(proof.to) && same(proof.to, input.router)
    && hash(proof.blockHash) && proof.blockNumber >= 0n
    && typeof proof.success === "boolean" && proof.gasUsed > 0n
    && proof.effectiveGasPrice >= 0n && Array.isArray(proof.logs)
    && proof.logs.length <= 2048,
  "INVALID_RECEIPT_PROOF", "Receipt identity, gas, route and logs must be valid.");
  const inputAsset = tokenAssetId(input.chainId, input.tokenIn);
  const outputAsset = tokenAssetId(input.chainId, input.tokenOut);
  const nativeAsset = nativeAssetId(input.chainId);
  const delta = verifyEoaBalanceDelta({ chainId: input.chainId,
    tokenIn: input.tokenIn, tokenOut: input.tokenOut, inputRaw: input.inputRaw,
    minimumOutputRaw: input.minimumOutputRaw, success: proof.success,
    before: input.before, after: input.after });
  const oldNative = input.before.find(value => value.assetId === nativeAsset)!.units;
  const newNative = input.after.find(value => value.assetId === nativeAsset)!.units;
  const gasFee = proof.gasUsed * proof.effectiveGasPrice;
  requireInput(oldNative - newNative === gasFee,
    "GAS_DELTA_MISMATCH", "Native balance change does not equal the receipt gas fee.");
  let inputNet = 0n, outputNet = 0n, priorIndex = -1n;
  for (const log of proof.logs) {
    requireInput(address(log.address) && hash(log.transactionHash)
      && same(log.transactionHash, proof.transactionHash)
      && hash(log.blockHash) && same(log.blockHash, proof.blockHash)
      && log.blockNumber === proof.blockNumber && log.removed === false
      && typeof log.logIndex === "bigint" && log.logIndex > priorIndex
      && Array.isArray(log.topics) && log.topics.length <= 4
      && log.topics.every(hash) && typeof log.data === "string"
      && /^0x(?:[0-9a-fA-F]{2})*$/.test(log.data),
    "INVALID_RECEIPT_LOG", "Receipt log is malformed or belongs to another transaction.");
    priorIndex = log.logIndex;
    const asset = tokenAssetId(input.chainId, log.address);
    if (asset !== inputAsset && asset !== outputAsset) continue;
    if (log.topics[0]?.toLowerCase() !== transferTopic) continue;
    const from = log.topics.length === 3 ? topicAddress(log.topics[1]!) : null;
    const to = log.topics.length === 3 ? topicAddress(log.topics[2]!) : null;
    requireInput(from !== null && to !== null && /^0x[0-9a-fA-F]{64}$/.test(log.data),
      "INVALID_TRANSFER_LOG", "Tracked token Transfer event is malformed.");
    const units = BigInt(log.data);
    const net = (same(to, input.wallet) ? units : 0n)
      - (same(from, input.wallet) ? units : 0n);
    if (asset === inputAsset) inputNet += net;
    else outputNet += net;
  }
  requireInput(proof.success ? inputNet === -delta.spent && outputNet === delta.received
    : proof.logs.length === 0 && inputNet === 0n && outputNet === 0n,
  "RECEIPT_EFFECT_MISMATCH", "Receipt token effects do not match wallet balance deltas.");
  const canonical = JSON.stringify({ transactionHash: proof.transactionHash.toLowerCase(),
    from: proof.from.toLowerCase(), to: proof.to.toLowerCase(),
    blockNumber: proof.blockNumber.toString(), blockHash: proof.blockHash.toLowerCase(),
    success: proof.success, gasUsed: proof.gasUsed.toString(),
    effectiveGasPrice: proof.effectiveGasPrice.toString(), logs: proof.logs.map(log => ({
      address: log.address.toLowerCase(), topics: log.topics.map((topic: string) => topic.toLowerCase()),
      data: log.data.toLowerCase(), transactionHash: log.transactionHash.toLowerCase(),
      blockHash: log.blockHash.toLowerCase(), blockNumber: log.blockNumber.toString(),
      logIndex: log.logIndex.toString(), removed: log.removed })) });
  return { ...delta, gasFee,
    proofHash: createHash("sha256").update(canonical).digest("hex") };
}
