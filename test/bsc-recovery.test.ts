import assert from "node:assert/strict";
import test from "node:test";
import { id } from "ethers";
import { amount, nativeAssetId, tokenAssetId } from "../src/domain/amount.js";
import { observeBscLeg, prepareBscBalanceEvidence,
  type BscRecoveryStorePort } from "../src/execution/bsc-recovery.js";
import { classifyEoaObservation, type EoaChainObservation } from "../src/execution/recovery.js";

const wallet = "0x1111111111111111111111111111111111111111";
const transactionHash = `0x${"a".repeat(64)}`;
const blockHash = `0x${"b".repeat(64)}`;
const context = { portfolioId: "portfolio-one", legId: "leg-one", chainId: 56,
  revision: 2n, wallet, transactionHash, nonce: 7n,
  tokenIn: "0x2222222222222222222222222222222222222222",
  tokenOut: "0x3333333333333333333333333333333333333333",
  router: "0x4444444444444444444444444444444444444444", transactionValue: 0n,
  inputRaw: 5n, minimumOutputRaw: 3n, state: "unknown" as const,
  includedBlock: null, includedBlockHash: null, receiptSuccess: null, balances: [] };

test("P7 BSC recovery uses persisted wallet and hash and records only canonical evidence", async () => {
  const queries: Array<{ method: string; params: unknown[] }> = [];
  const recorded: EoaChainObservation[] = [];
  const store: BscRecoveryStorePort = {
    async loadRecoveryContext() { return context; },
    async recordChainObservation(_portfolioId, _legId, observation, finalityBlocks) {
      recorded.push(observation);
      return classifyEoaObservation({ hash: transactionHash, wallet, nonce: 7n,
        state: "unknown", includedBlockHash: null }, observation, finalityBlocks);
    }
  };
  const fetcher = (async (_url, init) => {
    const body = JSON.parse(String(init?.body)) as { id: number; method: string; params: unknown[] };
    queries.push(body);
    const result = body.method === "eth_chainId" ? "0x38"
      : body.method === "eth_blockNumber" ? "0x6f"
      : body.method === "eth_getTransactionCount" ? "0x8"
      : body.method === "eth_getTransactionReceipt"
        ? { transactionHash, from: wallet, blockNumber: "0x64", blockHash, status: "0x1" }
        : { number: "0x64", hash: blockHash };
    return new Response(JSON.stringify({ jsonrpc: "2.0", id: body.id, result }), { status: 200 });
  }) as typeof fetch;
  const decision = await observeBscLeg(store, { portfolioId: "portfolio-one", legId: "leg-one",
    rpcUrl: "https://rpc.example.invalid", finalityBlocks: 12n }, fetcher);
  assert.equal(decision?.state, "confirmed");
  assert.equal(recorded[0]?.receipt?.hash, transactionHash);
  assert.deepEqual(queries.find(query => query.method === "eth_getTransactionReceipt")?.params,
    [transactionHash]);
  assert.deepEqual(queries.find(query => query.method === "eth_getTransactionCount")?.params,
    [wallet, "latest"]);
});

test("P7 BSC recovery leaves the store unchanged on wrong chain or unavailable RPC", async () => {
  let writes = 0;
  const store: BscRecoveryStorePort = {
    async loadRecoveryContext() { return context; },
    async recordChainObservation(_portfolioId, _legId, observation, finalityBlocks) {
      writes += 1;
      return classifyEoaObservation({ hash: transactionHash, wallet, nonce: 7n,
        state: "unknown", includedBlockHash: null }, observation, finalityBlocks);
    }
  };
  const errorFetch = (async () => new Response("{}", { status: 500 })) as typeof fetch;
  assert.equal(await observeBscLeg(store, { portfolioId: "portfolio-one", legId: "leg-one",
    rpcUrl: "https://rpc.example.invalid", finalityBlocks: 12n }, errorFetch), null);
  assert.equal(writes, 0);
  await assert.rejects(observeBscLeg({ ...store,
    async loadRecoveryContext() { return { ...context, chainId: 1 }; } },
  { portfolioId: "portfolio-one", legId: "leg-one",
    rpcUrl: "https://rpc.example.invalid", finalityBlocks: 12n }, errorFetch),
  { code: "WRONG_CHAIN" });
  assert.equal(writes, 0);
});

test("P7 finalized BSC balance candidate is DB-bound, complete and receipt-block pinned", async () => {
  const inAsset = { assetId: tokenAssetId(56, context.tokenIn), decimals: 18 };
  const outAsset = { assetId: tokenAssetId(56, context.tokenOut), decimals: 18 };
  const native = { assetId: nativeAssetId(56), decimals: 18 };
  const finalized = { ...context, state: "confirmed" as const,
    includedBlock: 100n, includedBlockHash: blockHash, receiptSuccess: true,
    balances: [amount(10n, inAsset), amount(0n, outAsset), amount(100n, native)] };
  const store = { async loadRecoveryContext() { return finalized; } };
  const request = { portfolioId: "portfolio-one", legId: "leg-one",
    rpcUrl: "https://rpc.example.invalid", finalityBlocks: 12n,
    async resolveTrackedAssets() { return [inAsset, outAsset, native]; } };
  const rpc = (reorg = false): typeof fetch => {
    let blockReads = 0;
    return (async (_url, init) => {
      const body = JSON.parse(String(init?.body)) as { id: number; method: string; params: unknown[] };
      const result = body.method === "eth_chainId" ? "0x38"
        : body.method === "eth_blockNumber" ? "0x6f"
        : body.method === "eth_getTransactionCount" ? "0x8"
        : body.method === "eth_getTransactionReceipt"
          ? { transactionHash, from: wallet, to: context.router,
            blockNumber: "0x64", blockHash, status: "0x1",
            gasUsed: "0x1", effectiveGasPrice: "0x1", logs: [
              { address: context.tokenIn, topics: [id("Transfer(address,address,uint256)"),
                `0x${wallet.slice(2).padStart(64, "0")}`,
                `0x${context.router.slice(2).padStart(64, "0")}`],
                data: `0x${"5".padStart(64, "0")}`, transactionHash,
                blockNumber: "0x64", blockHash, logIndex: "0x0", removed: false },
              { address: context.tokenOut, topics: [id("Transfer(address,address,uint256)"),
                `0x${context.router.slice(2).padStart(64, "0")}`,
                `0x${wallet.slice(2).padStart(64, "0")}`],
                data: `0x${"4".padStart(64, "0")}`, transactionHash,
                blockNumber: "0x64", blockHash, logIndex: "0x1", removed: false }] }
          : body.method === "eth_getBlockByNumber"
            ? { number: "0x64", hash: reorg && ++blockReads > 1 ? `0x${"c".repeat(64)}` : blockHash }
            : body.method === "eth_getBalance" ? "0x63"
            : body.method === "eth_call" ? (body.params[0] as { to: string }).to === context.tokenIn
              ? `0x${"5".padStart(64, "0")}` : `0x${"4".padStart(64, "0")}`
              : null;
      return new Response(JSON.stringify({ jsonrpc: "2.0", id: body.id, result }), { status: 200 });
    }) as typeof fetch;
  };
  const candidate = await prepareBscBalanceEvidence(store, request, rpc());
  assert.equal(candidate?.sourceBlock, 100n);
  assert.equal(candidate?.sourceBlockHash, blockHash);
  assert.equal(candidate?.expectedRevision, 2n);
  assert.deepEqual(candidate?.balances.map(value => value.units), [5n, 4n, 99n]);
  assert.equal(await prepareBscBalanceEvidence(store, request, rpc(true)), null);
  await assert.rejects(prepareBscBalanceEvidence(store, { ...request,
    async resolveTrackedAssets() { return [inAsset, outAsset]; } }, rpc()),
  { code: "INCOMPLETE_TRACKED_ASSETS" });
});
