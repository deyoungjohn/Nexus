import assert from "node:assert/strict";
import test from "node:test";
import { nativeAssetId, tokenAssetId } from "../src/domain/amount.js";
import { fetchBscTrackedBalances } from "../src/execution/bsc-balances.js";

const wallet = "0x1111111111111111111111111111111111111111";
const token = "0x2222222222222222222222222222222222222222";
const blockHash = `0x${"a".repeat(64)}`;
const assets = [
  { assetId: nativeAssetId(56), decimals: 18 },
  { assetId: tokenAssetId(56, token), decimals: 18 }
];
const request = { rpcUrl: "https://rpc.example.invalid", wallet,
  blockNumber: 100n, blockHash, assets };

function rpc(change: { chain?: string; tokenBalance?: unknown;
  reorgAfter?: number; error?: boolean } = {}) {
  const calls: Array<{ method: string; params: unknown[] }> = [];
  let blockReads = 0;
  const fetcher = (async (_url: unknown, init: RequestInit | undefined) => {
    const body = JSON.parse(String(init?.body)) as {
      id: number; method: string; params: unknown[] };
    calls.push({ method: body.method, params: body.params });
    if (change.error) return new Response("{}", { status: 500 });
    let result: unknown;
    if (body.method === "eth_chainId") result = change.chain ?? "0x38";
    else if (body.method === "eth_getBlockByNumber") {
      blockReads += 1;
      result = { number: "0x64", hash: change.reorgAfter !== undefined
        && blockReads > change.reorgAfter ? `0x${"b".repeat(64)}` : blockHash };
    } else if (body.method === "eth_getBalance") result = "0x64";
    else if (body.method === "eth_call") result = change.tokenBalance === undefined
      ? `0x${"0".repeat(63)}5` : change.tokenBalance;
    else throw new Error(`Unexpected RPC method: ${body.method}`);
    return new Response(JSON.stringify({ jsonrpc: "2.0", id: body.id, result }), { status: 200 });
  }) as typeof fetch;
  return { fetcher, calls };
}

test("P7 pinned BSC reader collects native and tracked ERC20 balances at one block", async () => {
  const mock = rpc();
  const snapshot = await fetchBscTrackedBalances(request, mock.fetcher);
  assert.equal(snapshot?.blockNumber, 100n);
  assert.equal(snapshot?.blockHash, blockHash);
  assert.deepEqual(snapshot?.balances.map(value => [value.assetId, value.units]), [
    [nativeAssetId(56), 100n], [tokenAssetId(56, token), 5n]
  ]);
  const balanceCalls = mock.calls.filter(call => call.method === "eth_getBalance"
    || call.method === "eth_call");
  assert.deepEqual(balanceCalls.map(call => call.params.at(-1)), ["0x64", "0x64"]);
  assert.deepEqual(balanceCalls[1]?.params[0], { to: token,
    data: `0x70a08231${wallet.slice(2).padStart(64, "0")}` });
});

test("P7 pinned BSC reader rejects a reorg during balance reads", async () => {
  const mock = rpc({ reorgAfter: 1 });
  assert.equal(await fetchBscTrackedBalances(request, mock.fetcher), null);
  assert.equal(mock.calls.some(call => call.method === "eth_call"), false);
});

test("P7 pinned BSC reader rejects incomplete or inconsistent asset evidence", async () => {
  assert.equal(await fetchBscTrackedBalances(request, rpc({ chain: "0x1" }).fetcher), null);
  assert.equal(await fetchBscTrackedBalances(request, rpc({ tokenBalance: "0x1" }).fetcher), null);
  assert.equal(await fetchBscTrackedBalances({ ...request, assets: [assets[1]!] }, rpc().fetcher), null);
  assert.equal(await fetchBscTrackedBalances({ ...request, assets: [assets[0]!, assets[0]!] },
    rpc().fetcher), null);
  assert.equal(await fetchBscTrackedBalances({ ...request, rpcUrl: "http://rpc.example.invalid" },
    rpc().fetcher), null);
  assert.equal(await fetchBscTrackedBalances(request, rpc({ error: true }).fetcher), null);
});
