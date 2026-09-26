import assert from "node:assert/strict";
import test from "node:test";
import { fetchOndoBscQuantity } from "../src/market-gate/ondo-quantity.js";

const tokenAddress = "0xa9ee28c80f960b889dfbd1902055218cba016f75";
const now = "2026-09-26T16:00:03.000Z";
const second = BigInt(Date.parse("2026-09-26T16:00:00.000Z") / 1000);
const hex = (value: bigint): string => value.toString(16).padStart(64, "0");
const request = { instrumentId: "nvda", tokenAddress, rpcUrl: "https://example.invalid/rpc",
  maxBlockAgeMs: 10_000, now };
const replies = (changes: { paused?: bigint; pending?: bigint; pauseStart?: bigint;
  chain?: string; blockTime?: bigint; blockNumber?: string } = {}): typeof fetch => (async (_url, init) => {
  const body = JSON.parse(String(init?.body)) as { id: number; method: string;
    params: Array<{ data: string }> };
  const shares = 1000932054247057497n;
  const result = body.method === "eth_chainId" ? changes.chain ?? "0x38"
    : body.method === "eth_blockNumber" ? "0x100"
      : body.method === "eth_getBlockByNumber"
        ? { number: changes.blockNumber ?? "0x100",
          timestamp: `0x${(changes.blockTime ?? second).toString(16)}` }
        : body.params[0]?.data.startsWith("0x0a562827")
          ? `0x${hex(shares)}${hex(changes.paused ?? 0n)}`
          : `0x${hex(shares)}${hex(changes.pending ?? 0n)}${hex(second - 10n)}`
            + `${hex(changes.pauseStart ?? 0n)}${hex(300n)}${hex(86400n)}`;
  return new Response(JSON.stringify({ jsonrpc: "2.0", id: body.id, result }), { status: 200 });
}) as typeof fetch;

test("P5 Ondo quantity pins BSC multiplier and identifies its mapping revision", async () => {
  const result = await fetchOndoBscQuantity(request, replies());
  assert.equal(result?.shareUnitsNumerator, 1000932054247057497n);
  assert.equal(result?.shareUnitsDenominator, 10n ** 18n);
  assert.equal(result?.sourceBlock, 256n);
  assert.match(result?.mappingRevision ?? "", /1000932054247057497/);
});

test("P5 Ondo quantity blocks wrong chain, old block and corporate-action pause", async () => {
  assert.equal(await fetchOndoBscQuantity(request, replies({ chain: "0x1" })), null);
  assert.equal(await fetchOndoBscQuantity(request, replies({ blockTime: second - 30n })), null);
  assert.equal(await fetchOndoBscQuantity(request, replies({ paused: 1n })), null);
  assert.equal(await fetchOndoBscQuantity(request, replies({ pending: 2n })), null);
  assert.equal(await fetchOndoBscQuantity(request, replies({ pauseStart: second + 100n })), null);
  assert.equal(await fetchOndoBscQuantity(request, replies({ blockNumber: "0xff" })), null);
});
