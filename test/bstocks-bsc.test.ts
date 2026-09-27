import assert from "node:assert/strict";
import test from "node:test";
import { Interface, id as ethersId } from "ethers";
import { BSTOCKS_BSC_NVDAB, bStocksDisplayedRaw, fetchBStocksBscQuantity,
  matchesReviewedBStocksControl } from "../src/market-gate/bstocks-bsc.js";

const token = BSTOCKS_BSC_NVDAB;
const beacon = "0x156d6dce9a4f6139a3406f1f021f1a4880de93a3";
const implementation = "0xcfed6c4679297ea4889f8183bc057b4a86c64e46";
const owner = "0x4333daf4481f281f3d3d2b8735ce80bc00028d0c";
const compliance = "0x53dba7aabde774787a1f57236b235567da8e14f4";
const pauseManager = "0x9fc74be63f3589485b2423984a7a0557e0cf700a";
const now = "2026-09-27T15:00:02.000Z";
const blockSeconds = BigInt(Date.parse("2026-09-27T15:00:00.000Z") / 1000);
const multiplier = 1000778223752807865n;
const abi = new Interface([
  "function decimals() view returns (uint8)",
  "function supportsInterface(bytes4) view returns (bool)",
  "function uiMultiplier() view returns (uint256)",
  "function newUIMultiplier() view returns (uint256)",
  "function effectiveAt() view returns (uint256)",
  "function hasPendingMultiplier() view returns (bool)",
  "function pendingMultiplier() view returns (uint256,uint256)",
  "function implementation() view returns (address)",
  "function owner() view returns (address)",
  "function compliance() view returns (address)",
  "function pauseManager() view returns (address)",
  "function DEFAULT_ADMIN_ROLE() view returns (bytes32)",
  "function ISSUER_ROLE() view returns (bytes32)",
  "function getRoleMembers(bytes32) view returns (address[])",
  "function isTokenPaused(address) view returns (bool)"
]);
const request = { instrumentId: "nvdab", tokenAddress: token,
  rpcUrl: "https://example.invalid/rpc", maxBlockAgeMs: 10_000, now };
type Change = { chain?: string; blockSeconds?: bigint; tokenCode?: string;
  implementationCode?: string; beaconOwner?: string; implementation?: string;
  decimals?: bigint; supported?: boolean; multiplier?: bigint;
  next?: bigint; effective?: bigint; hasPending?: boolean;
  pending?: readonly [bigint, bigint]; beaconWord?: string; implementationWord?: string;
  blockHeaderNumber?: string; compliance?: string; pauseManager?: string;
  complianceCode?: string; pauseCode?: string; paused?: boolean;
  adminMembers?: readonly string[]; issuerMembers?: readonly string[] };
const rpcReply = (change: Change = {}): typeof fetch => (async (_url, init) => {
  const body = JSON.parse(String(init?.body)) as { id: number; method: string;
    params: Array<{ to: string; data: string } | string> };
  let result: unknown;
  const target = body.params[0];
  if (body.method === "eth_chainId") result = change.chain ?? "0x38";
  else if (body.method === "eth_blockNumber") result = "0x100";
  else if (body.method === "eth_getBlockByNumber") result = {
    number: change.blockHeaderNumber ?? "0x100",
    timestamp: `0x${(change.blockSeconds ?? blockSeconds).toString(16)}` };
  else if (body.method === "eth_getStorageAt") {
    const slot = body.params[1];
    result = slot === "0xa3f0ad74e5423aebfd80d3ef4346578335a9a72aeaee59ff6cb3582b35133d50"
      ? change.beaconWord ?? `0x${beacon.slice(2).padStart(64, "0")}`
      : change.implementationWord ?? `0x${"0".repeat(64)}`;
  } else if (body.method === "eth_getCode") result = String(target).toLowerCase() === token
    ? change.tokenCode ?? "0x6001" : String(target).toLowerCase() === beacon
      ? "0x6002" : String(target).toLowerCase() === compliance
        ? change.complianceCode ?? "0x6004" : String(target).toLowerCase() === pauseManager
          ? change.pauseCode ?? "0x6005" : change.implementationCode ?? "0x6003";
  else {
    const call = target as { to: string; data: string };
    const parsed = abi.parseTransaction({ data: call.data });
    if (!parsed) throw new Error("Unexpected call");
    const name = parsed.name;
    const isPending = change.hasPending ?? false;
    const next = change.next ?? (isPending ? multiplier * 2n : multiplier);
    const effective = change.effective ?? (isPending ? blockSeconds + 60n : 0n);
    const value = name === "decimals" ? [change.decimals ?? 18n]
      : name === "supportsInterface" ? [change.supported ?? true]
        : name === "uiMultiplier" ? [change.multiplier ?? multiplier]
          : name === "newUIMultiplier" ? [next]
            : name === "effectiveAt" ? [effective]
              : name === "hasPendingMultiplier" ? [isPending]
                : name === "pendingMultiplier" ? [...(change.pending ??
                  (isPending ? [next, effective] : [0n, 0n]))]
                  : name === "implementation" ? [change.implementation ?? implementation]
                    : name === "owner" ? [change.beaconOwner ?? owner]
                      : name === "compliance" ? [change.compliance ?? compliance]
                        : name === "pauseManager" ? [change.pauseManager ?? pauseManager]
                          : name === "DEFAULT_ADMIN_ROLE" ? [`0x${"0".repeat(64)}`]
                            : name === "ISSUER_ROLE" ? [ethersId("ISSUER_ROLE")]
                              : name === "getRoleMembers" ? [parsed.args[0] === ethersId("ISSUER_ROLE")
                                ? change.issuerMembers ?? [owner] : change.adminMembers ?? [owner]]
                                : [change.paused ?? false];
    result = abi.encodeFunctionResult(name, value);
  }
  return new Response(JSON.stringify({ jsonrpc: "2.0", id: body.id, result }), { status: 200 });
}) as typeof fetch;

test("P5.5b bStocks pins raw/UI mapping, proxy controls and exact token", async () => {
  const snapshot = await fetchBStocksBscQuantity(request, rpcReply());
  assert.ok(snapshot);
  assert.equal(snapshot.sourceBlock, 256n);
  assert.equal(snapshot.rawDecimals, 18);
  assert.equal(snapshot.uiMultiplier, multiplier);
  assert.equal(snapshot.pendingMultiplier, null);
  assert.equal(snapshot.control.beacon, beacon);
  assert.equal(snapshot.control.implementation, implementation);
  assert.equal(snapshot.control.compliance, compliance);
  assert.equal(snapshot.control.pauseManager, pauseManager);
  assert.equal(snapshot.tokenPaused, false);
  assert.ok(matchesReviewedBStocksControl(snapshot, snapshot.control));
  assert.equal(bStocksDisplayedRaw(22176198062689502n, snapshot), 22193456106768858n);
  assert.equal(await fetchBStocksBscQuantity({ ...request,
    tokenAddress: "0x0000000000000000000000000000000000000001" }, rpcReply()), null);
});

test("P5.5b scheduled multiplier is visible but cannot pass a control review", async () => {
  const snapshot = await fetchBStocksBscQuantity(request, rpcReply({ hasPending: true }));
  assert.ok(snapshot);
  assert.equal(snapshot.pendingMultiplier, multiplier * 2n);
  assert.equal(snapshot.pendingEffectiveAt, "2026-09-27T15:01:00.000Z");
  assert.equal(matchesReviewedBStocksControl(snapshot, snapshot.control), false);
  assert.equal(await fetchBStocksBscQuantity(request, rpcReply({ hasPending: true,
    pending: [multiplier * 3n, blockSeconds + 60n] })), null);
  assert.equal(await fetchBStocksBscQuantity(request, rpcReply({ hasPending: true,
    effective: blockSeconds })), null);
});

test("P5.5b rejects stale, wrong-chain, nonconforming and changed controls", async () => {
  const baseline = await fetchBStocksBscQuantity(request, rpcReply());
  assert.ok(baseline);
  for (const change of [
    { chain: "0x1" }, { blockSeconds: blockSeconds - 60n },
    { blockHeaderNumber: "0xff" }, { tokenCode: "0x" },
    { beaconWord: `0x${"0".repeat(64)}` },
    { implementationWord: `0x${"1".repeat(64)}` },
    { implementationCode: "0x" }, { decimals: 6n },
    { supported: false }, { next: multiplier + 1n },
    { pending: [1n, 1n] }
  ] satisfies Change[]) assert.equal(await fetchBStocksBscQuantity(request, rpcReply(change)), null);
  const changedOwner = await fetchBStocksBscQuantity(request,
    rpcReply({ beaconOwner: "0x0000000000000000000000000000000000000001" }));
  assert.ok(changedOwner);
  assert.equal(matchesReviewedBStocksControl(changedOwner, baseline.control), false);
  const changedCode = await fetchBStocksBscQuantity(request, rpcReply({ implementationCode: "0x6004" }));
  assert.ok(changedCode);
  assert.equal(matchesReviewedBStocksControl(changedCode, baseline.control), false);
  const changedCompliance = await fetchBStocksBscQuantity(request,
    rpcReply({ complianceCode: "0x6006" }));
  assert.ok(changedCompliance);
  assert.equal(matchesReviewedBStocksControl(changedCompliance, baseline.control), false);
  const changedRole = await fetchBStocksBscQuantity(request,
    rpcReply({ issuerMembers: [owner, "0x0000000000000000000000000000000000000001"] }));
  assert.ok(changedRole);
  assert.equal(matchesReviewedBStocksControl(changedRole, baseline.control), false);
  const changedManager = await fetchBStocksBscQuantity(request,
    rpcReply({ pauseManager: "0x0000000000000000000000000000000000000001" }));
  assert.ok(changedManager);
  assert.equal(matchesReviewedBStocksControl(changedManager, baseline.control), false);
  assert.equal(await fetchBStocksBscQuantity(request, rpcReply({ adminMembers: [] })), null);
  const paused = await fetchBStocksBscQuantity(request, rpcReply({ paused: true }));
  assert.ok(paused);
  assert.equal(matchesReviewedBStocksControl(paused, baseline.control), false);
  assert.throws(() => bStocksDisplayedRaw(-1n, baseline), RangeError);
});
