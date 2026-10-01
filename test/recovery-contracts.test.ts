import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { keccak256 } from "ethers";
import { amount, nativeAssetId, tokenAssetId } from "../src/domain/amount.js";
import { parseRecoveryConfig, recoveryConfigurationRecord, resolveRecoveryAssets, type RecoveryAsset } from "../src/execution/recovery-config.js";
import { RECOVERY_BEACON_SLOT, verifyBscRecoveryContracts } from "../src/execution/recovery-contracts.js";

const token = "0x2222222222222222222222222222222222222222";
const proxy = "0x3333333333333333333333333333333333333333";
const beacon = "0x4444444444444444444444444444444444444444";
const implementation = "0x5555555555555555555555555555555555555555";
const blockHash = `0x${"a".repeat(64)}`;
const word = (address: string): string => `0x${address.slice(2).padStart(64, "0")}`;
const codes = new Map([[token, "0x6000"], [proxy, "0x6001"], [beacon, "0x6002"], [implementation, "0x6003"]]);
const assets: readonly RecoveryAsset[] = [
  { assetId: tokenAssetId(56, token), decimals: 18, semantics: "erc20-transfer-net", review: "fixture-runtime",
    contract: { kind: "runtime", codeHash: keccak256(codes.get(token)!) } },
  { assetId: tokenAssetId(56, proxy), decimals: 18, semantics: "erc20-transfer-net", review: "fixture-beacon",
    contract: { kind: "beacon", codeHash: keccak256(codes.get(proxy)!), beacon,
      beaconCodeHash: keccak256(codes.get(beacon)!), implementation,
      implementationCodeHash: keccak256(codes.get(implementation)!) } }
];
const request = { rpcUrl: "https://rpc.example.invalid", blockNumber: 100n, blockHash, assets };
function rpc(change: { codeAt?: string; decimals?: string; beacon?: string; implementation?: string;
  directImplementation?: string; chain?: string; reorg?: boolean; unavailable?: boolean } = {}) {
  const calls: Array<{ method: string; params: unknown[] }> = [];
  let headers = 0;
  const fetcher = (async (_url, init) => {
    const body = JSON.parse(String(init?.body)) as { id: number; method: string; params: unknown[] };
    calls.push(body);
    if (change.unavailable) return new Response("{}", { status: 503 });
    const call = body.params[0] as { to: string; data: string };
    const result = body.method === "eth_chainId" ? change.chain ?? "0x38"
      : body.method === "eth_getBlockByNumber" ? { number: "0x64", hash: change.reorg && ++headers > 1 ? `0x${"b".repeat(64)}` : blockHash }
        : body.method === "eth_getCode" ? body.params[0] === change.codeAt ? "0x6004" : codes.get(String(body.params[0]))
          : body.method === "eth_getStorageAt" ? body.params[1] === RECOVERY_BEACON_SLOT
            ? word(change.beacon ?? beacon) : change.directImplementation ?? `0x${"0".repeat(64)}`
            : body.method === "eth_call" ? call.data === "0x313ce567"
              ? change.decimals ?? `0x${"12".padStart(64, "0")}` : word(change.implementation ?? implementation) : null;
    return new Response(JSON.stringify({ jsonrpc: "2.0", id: body.id, result }), { status: 200 });
  }) as typeof fetch;
  return { calls, fetcher };
}

test("P7 raw token review pins runtime, decimals and immutable-beacon path to receipt block", async () => {
  const mock = rpc();
  assert.equal(await verifyBscRecoveryContracts(request, mock.fetcher), true);
  assert.ok(mock.calls.filter(call => call.method !== "eth_chainId").every(call =>
    call.params.at(-1) === "0x64" || call.method === "eth_getBlockByNumber" && call.params[0] === "0x64"));
  const resolution = mock.calls.find(call => call.method === "eth_call"
    && (call.params[0] as { data: string }).data === "0x5c60da1b");
  assert.deepEqual(resolution?.params[0], { from: proxy, to: beacon, data: "0x5c60da1b" });
});

test("P7 raw token review rejects changed code, decimals, beacon and implementation despite valid balances", async () => {
  for (const change of [...codes.keys()].map(codeAt => ({ codeAt })))
    await assert.rejects(verifyBscRecoveryContracts(request, rpc(change).fetcher), { code: "RECOVERY_CONTRACT_CHANGED" });
  for (const change of [{ decimals: `0x${"6".padStart(64, "0")}` }, { beacon: token },
    { implementation: token }, { directImplementation: word(implementation) }])
    await assert.rejects(verifyBscRecoveryContracts(request, rpc(change).fetcher), { code: "RECOVERY_CONTRACT_CHANGED" });
});

test("P7 raw token review keeps unavailable, malformed and reorged source evidence unresolved", async () => {
  for (const change of [{ unavailable: true }, { chain: "0x1" }, { reorg: true },
    { codeAt: token, reorg: true }, { decimals: "0x12" }])
    assert.equal(await verifyBscRecoveryContracts(request, rpc(change).fetcher), null);
  assert.equal(await verifyBscRecoveryContracts(request,
    (async () => new Response(JSON.stringify({ jsonrpc: "2.0", id: 999, result: "0x38" }))) as typeof fetch), null);
});

test("P7 recovery configuration binds reviewed code hashes and rejects incomplete beacon review", () => {
  const base = { version: 1, registryVersion: "guard-v1", finalityBlocks: "12",
    sources: [{ id: "rpc", rpcUrl: "https://rpc.example.invalid" }],
    assets: [{ assetId: "eip155:56/native", decimals: 18, semantics: "native-gas", review: "native" }, ...assets] };
  const config = parseRecoveryConfig(base);
  assert.equal(Object.isFrozen(config.assets[2]?.contract), true);
  assert.notEqual(recoveryConfigurationRecord(config).hash, recoveryConfigurationRecord(parseRecoveryConfig({
    ...base, assets: [base.assets[0], { ...assets[0], contract: { kind: "runtime", codeHash: keccak256("0x6004") } }, assets[1]] })).hash);
  for (const contract of [null, { kind: "runtime", codeHash: "0x12" },
    { kind: "beacon", codeHash: keccak256("0x6001") }, { ...assets[1]!.contract, beacon: proxy },
    { ...assets[1]!.contract, extra: true }])
    assert.throws(() => parseRecoveryConfig({ ...base, assets: [base.assets[0], { ...assets[1], contract }] }));
});

test("P7 deployment registry resolves raw USDT/NVDAB and is bound to durable source review evidence", () => {
  const deployment = parseRecoveryConfig(JSON.parse(readFileSync("config/bsc-recovery.json", "utf8")));
  const evidence = JSON.parse(readFileSync("docs/integrations/2026-09-30-token-recovery-semantics.json", "utf8")) as {
    contractReviews: RecoveryAsset[] };
  assert.deepEqual(deployment.assets.filter(asset => asset.contract !== undefined), evidence.contractReviews);
  const context = { portfolioId: "portfolio", legId: "leg", chainId: 56, revision: 1n,
    wallet: token, transactionHash: blockHash, nonce: 1n,
    tokenIn: "0x55d398326f99059ff775485246999027b3197955",
    tokenOut: "0x02fca66c1d1afb4e2a7884261eb00f63598a7436", router: proxy,
    transactionValue: 0n, inputRaw: 5n, minimumOutputRaw: 1n, state: "confirmed" as const,
    includedBlock: 100n, includedBlockHash: blockHash, receiptSuccess: true,
    balances: [amount(100n, { assetId: nativeAssetId(56), decimals: 18 }),
      amount(10n, { assetId: tokenAssetId(56, "0x55d398326f99059ff775485246999027b3197955"), decimals: 18 })] };
  assert.deepEqual(resolveRecoveryAssets(deployment, context), deployment.assets.map(({ assetId, decimals }) => ({ assetId, decimals })));
  assert.throws(() => resolveRecoveryAssets(deployment, { ...context, tokenOut: token }), { code: "UNREVIEWED_RECOVERY_ASSET" });
  assert.throws(() => resolveRecoveryAssets(deployment, { ...context,
    balances: [...context.balances, amount(1n, { assetId: tokenAssetId(56, context.tokenOut), decimals: 6 })] }),
  { code: "UNREVIEWED_RECOVERY_ASSET" });
});
