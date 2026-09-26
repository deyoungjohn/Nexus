import assert from "node:assert/strict";
import test from "node:test";
import { Interface } from "ethers";
import { fetchXStocksBscIdentity, fetchXStocksBscWrappedQuantity } from "../src/market-gate/xstocks-bsc.js";

const token = "0xc845b2894dbddd03858fd2d643b4ef725fe0849d";
const wrapper = "0xa8ddb5cd96b5222afe198316e9a57caa642850d5";
const legacy = "0x93e62845c1dd5822ebc807ab71a5fb750decd15a";
const now = "2026-09-26T22:31:13.000Z";
const blockTime = BigInt(Date.parse("2026-09-26T22:31:11.000Z") / 1000);
const identityRequest = { symbol: "NVDAx", underlyingSymbol: "NVDA", tokenAddress: token,
  wrapperAddress: wrapper, now };
const issuerReply = (change: { token?: string; wrapper?: string; halted?: boolean;
  duplicate?: boolean; v2?: string; currency?: string } = {}): typeof fetch => (async () => {
  const deployment = { network: "BinanceSmartChain", address: change.token ?? token,
    wrapperAddress: legacy, wrapperAddressV2: change.v2 ?? change.wrapper ?? wrapper };
  return new Response(JSON.stringify({ symbol: "NVDAx", underlyingSymbol: "NVDA",
    underlying: { symbol: "NVDA", currency: change.currency ?? "USD" },
    isTradingHalted: change.halted ?? false,
    trading: { isTradingHalted: change.halted ?? false },
    deployments: change.duplicate ? [deployment, deployment] : [deployment] }), { status: 200 });
}) as typeof fetch;
const abi = new Interface([
  "function decimals() view returns (uint8)",
  "function getCurrentMultiplier() view returns (uint256)",
  "function asset() view returns (address)",
  "function convertToAssets(uint256) view returns (uint256)"
]);
const multiplier = 1001701196801074000n;
const rpcReply = (change: { chain?: string; timestamp?: bigint; asset?: string;
  multiplier?: bigint; converted?: bigint; wrapperCode?: string;
  decimals?: bigint; blockNumber?: string } = {}): typeof fetch => (async (_url, init) => {
  const body = JSON.parse(String(init?.body)) as { id: number; method: string;
    params: Array<{ to: string; data: string } | string> };
  const method = body.method;
  let result: unknown;
  if (method === "eth_chainId") result = change.chain ?? "0x38";
  else if (method === "eth_blockNumber") result = "0x100";
  else if (method === "eth_getBlockByNumber") result = { number: change.blockNumber ?? "0x100",
    timestamp: `0x${(change.timestamp ?? blockTime).toString(16)}` };
  else if (method === "eth_getCode") result = body.params[0] === wrapper
    ? change.wrapperCode ?? "0x6002" : "0x6001";
  else {
    const call = body.params[0];
    const calldata = typeof call === "object" ? call?.data ?? "" : "";
    const functionName = ["decimals", "getCurrentMultiplier", "asset", "convertToAssets"]
      .find(name => calldata.startsWith(abi.getFunction(name)?.selector ?? "no-selector"));
    if (!functionName) throw new Error("Unexpected eth_call");
    const value = functionName === "decimals" ? change.decimals ?? 18n
      : functionName === "getCurrentMultiplier" ? change.multiplier ?? multiplier
        : functionName === "convertToAssets" ? change.converted ?? multiplier
          : change.asset ?? token;
    result = abi.encodeFunctionResult(functionName, [value]);
  }
  return new Response(JSON.stringify({ jsonrpc: "2.0", id: body.id, result }), { status: 200 });
}) as typeof fetch;

test("P5.5 xStocks identity requires exact BSC token and current wrapper", async () => {
  const found = await fetchXStocksBscIdentity(identityRequest, issuerReply());
  assert.equal(found?.symbol, "NVDAx");
  assert.equal(found?.wrapperAddress, wrapper);
  assert.equal(found?.issuerHalted, false);
  assert.equal(await fetchXStocksBscIdentity(identityRequest, issuerReply({ token: legacy })), null);
  assert.equal(await fetchXStocksBscIdentity(identityRequest, issuerReply({ v2: legacy })), null);
  assert.equal(await fetchXStocksBscIdentity(identityRequest, issuerReply({ duplicate: true })), null);
  assert.equal(await fetchXStocksBscIdentity(identityRequest, issuerReply({ currency: "EUR" })), null);
});

test("P5.5 xStocks wrapper quantity pins BSC conversion, code and block", async () => {
  const identity = await fetchXStocksBscIdentity(identityRequest, issuerReply());
  assert.ok(identity);
  const evidence = await fetchXStocksBscWrappedQuantity({ instrumentId: "nvda-x-wrapper",
    identity, rpcUrl: "https://example.invalid/rpc", maxBlockAgeMs: 10_000,
    maxIdentityAgeMs: 10_000, now }, rpcReply());
  assert.equal(evidence?.quantityModel, "xstocks-v2-wrapper");
  assert.equal(evidence?.shareUnitsNumerator, multiplier);
  assert.equal(evidence?.shareUnitsDenominator, 10n ** 18n);
  assert.equal(evidence?.sourceBlock, 256n);
  assert.match(evidence?.mappingRevision ?? "", /1001701196801074000/);
});

test("P5.5 xStocks quantity blocks halted, stale and inconsistent contracts", async () => {
  const identity = await fetchXStocksBscIdentity(identityRequest, issuerReply());
  assert.ok(identity);
  const request = { instrumentId: "nvda-x-wrapper", identity,
    rpcUrl: "https://example.invalid/rpc", maxBlockAgeMs: 10_000,
    maxIdentityAgeMs: 10_000, now };
  assert.equal(await fetchXStocksBscWrappedQuantity(request, rpcReply({ chain: "0x1" })), null);
  assert.equal(await fetchXStocksBscWrappedQuantity(request, rpcReply({ timestamp: blockTime - 60n })), null);
  assert.equal(await fetchXStocksBscWrappedQuantity(request, rpcReply({ blockNumber: "0xff" })), null);
  assert.equal(await fetchXStocksBscWrappedQuantity(request, rpcReply({ asset: legacy })), null);
  assert.equal(await fetchXStocksBscWrappedQuantity(request, rpcReply({ converted: multiplier + 1n })), null);
  assert.equal(await fetchXStocksBscWrappedQuantity(request, rpcReply({ wrapperCode: "0x" })), null);
  assert.equal(await fetchXStocksBscWrappedQuantity(request, rpcReply({ decimals: 6n })), null);
  assert.equal(await fetchXStocksBscWrappedQuantity({ ...request,
    identity: { ...identity, observedAt: "2026-09-26T22:30:00.000Z" } }, rpcReply()), null);
  const halted = await fetchXStocksBscIdentity(identityRequest, issuerReply({ halted: true }));
  assert.ok(halted);
  assert.equal(await fetchXStocksBscWrappedQuantity({ ...request, identity: halted }, rpcReply()), null);
});
