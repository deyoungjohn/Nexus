import assert from "node:assert/strict";
import test from "node:test";
import { AbiCoder } from "ethers";
import { inspect, probeOutcome } from "./inspect-bstocks-governance.mjs";

test("P5.5d research rejects unavailable RPC as permission-denial evidence", () => {
  for (const message of ["missing trie node", "historical state is not available", "rate limit exceeded"]) {
    assert.throws(() => probeOutcome({ error: { code: -32000, message } }, "outsider", "upgradeTo", false),
      /Non-execution RPC error/);
  }
  assert.equal(probeOutcome({ error: { code: 3, message: "execution reverted: caller is not the owner", data: "0x" } },
    "outsider", "upgradeTo", false).success, false);
  assert.throws(() => probeOutcome({ result: "0x" }, "outsider", "upgradeTo", false), /Unexpected authorization/);
});

test("P5.5d research requires successful inner execution, not only outer eth_call", () => {
  const coder = AbiCoder.defaultAbiCoder();
  for (const method of ["execTransaction", "burn"]) {
    assert.throws(() => probeOutcome({ result: coder.encode(["bool"], [false]) }, "owner", method, true),
      /Contract returned false/);
    assert.equal(probeOutcome({ result: coder.encode(["bool"], [true]) }, "owner", method, true).success, true);
  }
  assert.throws(() => probeOutcome({ result: "not bytecode" }, "owner", "upgradeTo", true), /Malformed/);
});

test("P5.5d research rejects unsafe endpoints and invalid replay blocks before network access", async () => {
  await assert.rejects(inspect("http://localhost:8545"), /Trusted HTTPS/);
  await assert.rejects(inspect("https://example.org/?key=synthetic"), /Trusted HTTPS/);
  await assert.rejects(inspect("https://example.org", "latest"), /hexadecimal quantity/);
});
