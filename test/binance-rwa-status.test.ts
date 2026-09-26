import assert from "node:assert/strict";
import test from "node:test";
import { fetchBinanceRwaStatus } from "../src/market-gate/binance-rwa-status.js";

const token = "0xa9ee28c80f960b889dfbd1902055218cba016f75";
const now = (): Date => new Date("2026-09-25T14:00:00.000Z");
const reply = (data: unknown, success = true): typeof fetch => (async (url) => {
  assert.equal(new URL(String(url)).searchParams.get("contractAddress"), token);
  return new Response(JSON.stringify({ code: "000000", success, data }), { status: 200 });
}) as typeof fetch;

test("P5.5 Binance token status is a short-lived receipt, separate from market session", async () => {
  const open = await fetchBinanceRwaStatus("nvda", token,
    reply({ openState: true, reasonCode: "TRADING", marketStatus: "offhours" }), now);
  assert.equal(open?.state, "open");
  assert.equal(open?.observedAt, "2026-09-25T14:00:00.000Z");
  assert.equal(open?.expiresAt, "2026-09-25T14:00:30.000Z");
  assert.equal(await fetchBinanceRwaStatus("nvda", token,
    reply({ openState: false, reasonCode: "TRADING" }), now).then((x) => x?.state), "unknown");
  assert.equal(await fetchBinanceRwaStatus("nvda", token,
    reply({ openState: true, reasonCode: "HALTED" }), now).then((x) => x?.state), "unknown");
  assert.equal(await fetchBinanceRwaStatus("nvda", token,
    reply({ openState: true }), now), null);
});
