import assert from "node:assert/strict";
import test from "node:test";
import { fetchOndoBeaconFingerprint, fingerprintMatchesReview, EIP1967_BEACON_SLOT } from "../src/market-gate/ondo-beacon-risk.js";

const token = "0xa9ee28c80f960b889dfbd1902055218cba016f75";
const beacon = "0xc046b05a920e4b412815934dd8e58904dda73315";
const implementation = "0x578f397ca4661d1db4d9a65065d6b284a1a850fd";
const second = BigInt(Date.parse("2026-09-26T16:00:00Z") / 1000);
const input = { token, rpcUrl: "https://example.invalid", maxBlockAgeMs: 10_000, now: "2026-09-26T16:00:03Z" };
const padded = (address: string): string => `0x${address.slice(2).padStart(64, "0")}`;

function replies(change: { chain?: string; block?: string; beacon?: string;
  implementation?: string; code?: string; blockTime?: bigint } = {}): typeof fetch {
  return (async (_url, options) => {
    const body = JSON.parse(String(options?.body)) as { id: number; method: string; params: unknown[] };
    let result: unknown;
    if (body.method === "eth_chainId") result = change.chain ?? "0x38";
    else if (body.method === "eth_blockNumber") result = "0x100";
    else if (body.method === "eth_getBlockByNumber") result = { number: change.block ?? "0x100",
      timestamp: `0x${(change.blockTime ?? second).toString(16)}` };
    else if (body.method === "eth_getStorageAt") {
      assert.equal(body.params[1], EIP1967_BEACON_SLOT);
      result = padded(change.beacon ?? beacon);
    } else if (body.method === "eth_call") result = padded(change.implementation ?? implementation);
    else result = change.code ?? "0x6001600055";
    return new Response(JSON.stringify({ jsonrpc: "2.0", id: body.id, result }), { status: 200 });
  }) as typeof fetch;
}

test("P5.5 beacon fingerprint binds token proxy, beacon and implementation code", async () => {
  const result = await fetchOndoBeaconFingerprint(input, replies());
  assert.ok(result);
  assert.equal(result.sourceBlock, 256n);
  assert.equal(result.beacon, beacon);
  assert.equal(result.implementation, implementation);
  assert.equal(fingerprintMatchesReview(result, result), true);
  assert.equal(fingerprintMatchesReview({ ...result, implementationCodeHash: "0xchanged" }, result), false);
  assert.equal(fingerprintMatchesReview({ ...result, token: "0x390a684ef9cade28a7ad0dfa61ab1eb3842618c4" }, result), false);
});

test("P5.5 beacon fingerprint rejects wrong chain, stale block and unresolved code", async () => {
  assert.equal(await fetchOndoBeaconFingerprint(input, replies({ chain: "0x1" })), null);
  assert.equal(await fetchOndoBeaconFingerprint(input, replies({ block: "0xff" })), null);
  assert.equal(await fetchOndoBeaconFingerprint(input, replies({ blockTime: second - 30n })), null);
  assert.equal(await fetchOndoBeaconFingerprint(input, replies({ beacon: "0x0000000000000000000000000000000000000000" })), null);
  assert.equal(await fetchOndoBeaconFingerprint(input, replies({ implementation: "0x0000000000000000000000000000000000000000" })), null);
  assert.equal(await fetchOndoBeaconFingerprint(input, replies({ code: "0x" })), null);
});
