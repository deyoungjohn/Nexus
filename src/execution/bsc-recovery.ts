import { requireInput } from "../domain/errors.js";
import { nativeAssetId, tokenAssetId, validateDenomination,
  type Denomination } from "../domain/amount.js";
import type { EoaChainObservation, EoaRecoveryDecision } from "./recovery.js";
import { fetchEoaBscObservation } from "./bsc-rpc.js";
import { fetchBscTrackedBalances } from "./bsc-balances.js";
import { fetchBscReceiptEffectProof } from "./bsc-receipt-effects.js";
import { verifyEoaBalanceDelta } from "./reconcile.js";
import { verifyEoaReceiptEffects } from "./receipt-effects.js";
import type { EoaRecoveryContext, FinalizedBalanceSnapshot } from "./store.js";

export interface BscRecoveryStorePort {
  loadRecoveryContext(portfolioId: string, legId: string): Promise<EoaRecoveryContext>;
  recordChainObservation(portfolioId: string, legId: string,
    observation: EoaChainObservation, finalityBlocks: bigint): Promise<EoaRecoveryDecision>;
}

export interface ObserveBscLegRequest {
  readonly portfolioId: string;
  readonly legId: string;
  readonly rpcUrl: string;
  readonly finalityBlocks: bigint;
  /** Trusted earliest possible inclusion block; missing/too-old windows stay unresolved. */
  readonly scanFromBlock?: bigint;
}

/** Reads immutable leg identity from PostgreSQL; unavailable RPC evidence changes no state. */
export async function observeBscLeg(store: BscRecoveryStorePort, input: ObserveBscLegRequest,
  fetcher: typeof fetch = fetch): Promise<EoaRecoveryDecision | null> {
  requireInput(input.finalityBlocks > 0n, "INVALID_FINALITY", "Positive finality depth required.");
  const context = await store.loadRecoveryContext(input.portfolioId, input.legId);
  requireInput(context.chainId === 56, "WRONG_CHAIN", "BSC recovery requires chain 56.");
  const observation = await fetchEoaBscObservation({ rpcUrl: input.rpcUrl,
    wallet: context.wallet, transactionHash: context.transactionHash,
    ...(input.scanFromBlock === undefined ? {} : { nonce: context.nonce,
      scanFromBlock: input.scanFromBlock }) }, fetcher);
  if (observation === null) return null;
  return store.recordChainObservation(input.portfolioId, input.legId,
    observation, input.finalityBlocks);
}

export interface PrepareBscBalanceEvidenceRequest extends ObserveBscLegRequest {
  /** Server-side registry lookup; this must cover every Nexus-tracked asset. */
  readonly resolveTrackedAssets: (context: EoaRecoveryContext) => Promise<readonly Denomination[]>;
  /** Optional trusted contract review check, repeated before applying evidence. */
  readonly validateTrackedAssets?: (context: EoaRecoveryContext) => Promise<true | null>;
}

/** Builds a receipt-proven, read-only candidate from trusted stored identity. */
export async function prepareBscBalanceEvidence(store: Pick<BscRecoveryStorePort,
  "loadRecoveryContext">, input: PrepareBscBalanceEvidenceRequest,
  fetcher: typeof fetch = fetch): Promise<FinalizedBalanceSnapshot | null> {
  requireInput(input.finalityBlocks > 0n, "INVALID_FINALITY", "Positive finality depth required.");
  const context = await store.loadRecoveryContext(input.portfolioId, input.legId);
  requireInput(context.chainId === 56, "WRONG_CHAIN", "BSC recovery requires chain 56.");
  if ((context.state !== "confirmed" && context.state !== "reverted")
    || context.includedBlock === null || context.includedBlockHash === null
    || context.receiptSuccess !== (context.state === "confirmed")) return null;
  const readObservation = (): Promise<EoaChainObservation | null> =>
    fetchEoaBscObservation({ rpcUrl: input.rpcUrl, wallet: context.wallet,
      transactionHash: context.transactionHash }, fetcher);
  const matches = (observation: EoaChainObservation | null): boolean => {
    const receipt = observation?.receipt;
    return receipt !== null && receipt !== undefined
      && receipt.blockNumber === context.includedBlock
      && receipt.blockHash.toLowerCase() === context.includedBlockHash?.toLowerCase()
      && receipt.success === context.receiptSuccess
      && observation!.headBlock - receipt.blockNumber + 1n >= input.finalityBlocks;
  };
  if (!matches(await readObservation())) return null;
  const expected = new Map(context.balances.map(value => [value.assetId, value.decimals]));
  const outputAsset = tokenAssetId(56, context.tokenOut);
  requireInput(expected.has(nativeAssetId(56)) && expected.has(tokenAssetId(56, context.tokenIn)),
    "INCOMPLETE_TRACKED_ASSETS", "Native gas and input asset must already be tracked.");
  const assets = await input.resolveTrackedAssets(context);
  const supplied = new Map<string, number>();
  for (const asset of assets) {
    validateDenomination(asset);
    requireInput(!supplied.has(asset.assetId), "DUPLICATE_ASSET", "Tracked assets must be unique.");
    supplied.set(asset.assetId, asset.decimals);
  }
  requireInput(supplied.size === expected.size + (expected.has(outputAsset) ? 0 : 1)
    && supplied.has(outputAsset)
    && [...expected].every(([assetId, decimals]) => supplied.get(assetId) === decimals)
    && [...supplied.keys()].every(assetId => expected.has(assetId) || assetId === outputAsset),
  "INCOMPLETE_TRACKED_ASSETS", "Registry must cover exactly the tracked assets and output.");
  if (input.validateTrackedAssets && await input.validateTrackedAssets(context) !== true) return null;
  const balances = await fetchBscTrackedBalances({ rpcUrl: input.rpcUrl,
    wallet: context.wallet, blockNumber: context.includedBlock,
    blockHash: context.includedBlockHash, assets }, fetcher);
  if (balances === null) return null;
  verifyEoaBalanceDelta({ chainId: 56, tokenIn: context.tokenIn,
    tokenOut: context.tokenOut, inputRaw: context.inputRaw,
    minimumOutputRaw: context.minimumOutputRaw,
    success: context.receiptSuccess, before: context.balances,
    after: balances.balances });
  const receiptEffects = await fetchBscReceiptEffectProof({ rpcUrl: input.rpcUrl,
    transactionHash: context.transactionHash,
    blockNumber: context.includedBlock, blockHash: context.includedBlockHash }, fetcher);
  if (receiptEffects === null) return null;
  verifyEoaReceiptEffects({ proof: receiptEffects, chainId: 56,
    wallet: context.wallet, transactionHash: context.transactionHash,
    router: context.router, transactionValue: context.transactionValue,
    tokenIn: context.tokenIn, tokenOut: context.tokenOut,
    inputRaw: context.inputRaw, minimumOutputRaw: context.minimumOutputRaw,
    before: context.balances, after: balances.balances });
  if (input.validateTrackedAssets && await input.validateTrackedAssets(context) !== true) return null;
  if (!matches(await readObservation())) return null;
  return { portfolioId: context.portfolioId, legId: context.legId,
    expectedRevision: context.revision, wallet: context.wallet,
    sourceBlock: balances.blockNumber, sourceBlockHash: balances.blockHash,
    balances: balances.balances, receiptEffects };
}

export interface BscReconciliationStorePort extends Pick<BscRecoveryStorePort,
  "loadRecoveryContext"> {
  reconcileFinalizedLeg(input: FinalizedBalanceSnapshot): Promise<{
    revision: bigint; spent: bigint; received: bigint }>;
}

/** Reads receipt, effects and balances first; PostgreSQL then applies them atomically once. */
export async function reconcileBscLeg(store: BscReconciliationStorePort,
  input: PrepareBscBalanceEvidenceRequest,
  fetcher: typeof fetch = fetch): Promise<{
    revision: bigint; spent: bigint; received: bigint } | null> {
  const evidence = await prepareBscBalanceEvidence(store, input, fetcher);
  return evidence === null ? null : store.reconcileFinalizedLeg(evidence);
}
