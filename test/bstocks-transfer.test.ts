import assert from "node:assert/strict";
import test from "node:test";
import { Interface } from "ethers";
import { BSTOCKS_BSC_NVDAB } from "../src/market-gate/bstocks-bsc.js";
import type { BStocksBscQuantitySnapshot } from "../src/market-gate/bstocks-bsc.js";
import { BSTOCKS_BSC_V3_POOL, BSTOCKS_BSC_V3_ROUTER,
  fetchBStocksTransferPreflight } from "../src/market-gate/bstocks-transfer.js";

const wallet = "0x0000000000000000000000000000000000000001";
const compliance = "0x0000000000000000000000000000000000000002";
const pauseManager = "0x0000000000000000000000000000000000000003";
const now = "2026-09-27T15:00:02.000Z";
const blockSeconds = BigInt(Date.parse("2026-09-27T15:00:00.000Z") / 1000);
const snapshot: BStocksBscQuantitySnapshot = {
  instrumentId: "nvdab", source: `bstocks-bsc:${BSTOCKS_BSC_NVDAB}`,
  observedAt: "2026-09-27T15:00:00.000Z", expiresAt: "2026-09-27T15:00:10.000Z",
  sourceBlock: 256n, rawDecimals: 18, uiMultiplier: 10n ** 18n,
  pendingMultiplier: null, pendingEffectiveAt: null, tokenPaused: false,
  mappingRevision: "reviewed:1",
  control: { token: BSTOCKS_BSC_NVDAB, tokenCodeHash: "token-code",
    beacon: "beacon", beaconCodeHash: "beacon-code", implementation: "implementation",
    implementationCodeHash: "implementation-code", beaconOwner: "owner",
    compliance, complianceCodeHash: "compliance-code", pauseManager,
    pauseManagerCodeHash: "pause-code", adminMembersHash: "admin-roles",
    issuerMembersHash: "issuer-roles", complianceAdminMembersHash: "compliance-admins",
    complianceOpsMembersHash: "compliance-ops", complianceMembersHash: "compliance-role",
    pauseAdminMembersHash: "pause-admins", pauseOpsMembersHash: "pause-ops",
    mintEnabled: true, burnEnabled: true }
};
const request = { wallet, side: "buy" as const, snapshot,
  reviewedControl: snapshot.control, rpcUrl: "https://example.invalid/rpc",
  maxBlockAgeMs: 10_000, now };
const complianceAbi = new Interface(["function checkIsCompliant(address,address) view"]);
const pauseAbi = new Interface(["function isTokenPaused(address) view returns (bool)"]);
type Change = { chain?: string; timestamp?: bigint; paused?: boolean;
  blocked?: string; badResponse?: boolean; headerNumber?: string };
const rpcReply = (change: Change = {}, seen: string[] = []): typeof fetch => (async (_url, init) => {
  const body = JSON.parse(String(init?.body)) as { id: number; method: string;
    params: Array<{ to: string; data: string } | string> };
  let result: unknown;
  if (body.method === "eth_chainId") result = change.chain ?? "0x38";
  else if (body.method === "eth_getBlockByNumber") result = {
    number: change.headerNumber ?? "0x100",
    timestamp: `0x${(change.timestamp ?? blockSeconds).toString(16)}` };
  else {
    const call = body.params[0] as { to: string; data: string };
    if (call.to === pauseManager) result = pauseAbi.encodeFunctionResult("isTokenPaused",
      [change.paused ?? false]);
    else {
      assert.equal(call.to, compliance);
      const decoded = complianceAbi.decodeFunctionData("checkIsCompliant", call.data);
      assert.equal(String(decoded[0]).toLowerCase(), BSTOCKS_BSC_NVDAB);
      const participant = String(decoded[1]).toLowerCase();
      seen.push(participant);
      if (participant === change.blocked) return new Response(JSON.stringify({ jsonrpc: "2.0",
        id: body.id, error: { code: 3, message: "restricted" } }), { status: 200 });
      result = change.badResponse ? "0x00" : "0x";
    }
  }
  return new Response(JSON.stringify({ jsonrpc: "2.0", id: body.id, result }), { status: 200 });
}) as typeof fetch;

test("P5.5c bStocks preflight checks wallet, pool and router at one block", async () => {
  const seen: string[] = [];
  const result = await fetchBStocksTransferPreflight(request, rpcReply({}, seen));
  assert.equal(result?.sourceBlock, 256n);
  assert.equal(result?.wallet, wallet);
  assert.equal(result?.controlRevision, snapshot.mappingRevision);
  assert.deepEqual(seen.sort(), [wallet, BSTOCKS_BSC_V3_POOL,
    BSTOCKS_BSC_V3_ROUTER].sort());
});

test("P5.5c on-chain restrictions and changed controls fail closed", async () => {
  for (const blocked of [wallet, BSTOCKS_BSC_V3_POOL, BSTOCKS_BSC_V3_ROUTER]) {
    assert.equal(await fetchBStocksTransferPreflight(request, rpcReply({ blocked })), null);
  }
  assert.equal(await fetchBStocksTransferPreflight(request, rpcReply({ paused: true })), null);
  assert.equal(await fetchBStocksTransferPreflight(request, rpcReply({ badResponse: true })), null);
  assert.equal(await fetchBStocksTransferPreflight({ ...request,
    reviewedControl: { ...snapshot.control, complianceCodeHash: "changed" } }, rpcReply()), null);
  assert.equal(await fetchBStocksTransferPreflight({ ...request,
    snapshot: { ...snapshot, pendingMultiplier: 2n * 10n ** 18n } }, rpcReply()), null);
});

test("P5.5c stale, wrong-chain and mismatched pinned block fail closed", async () => {
  assert.equal(await fetchBStocksTransferPreflight(request, rpcReply({ chain: "0x1" })), null);
  assert.equal(await fetchBStocksTransferPreflight(request, rpcReply({ headerNumber: "0xff" })), null);
  assert.equal(await fetchBStocksTransferPreflight(request,
    rpcReply({ timestamp: blockSeconds - 60n })), null);
  assert.equal(await fetchBStocksTransferPreflight({ ...request,
    now: "2026-09-27T15:00:11.000Z" }, rpcReply()), null);
  assert.equal(await fetchBStocksTransferPreflight({ ...request,
    snapshot: { ...snapshot, expiresAt: "invalid" } }, rpcReply()), null);
});
