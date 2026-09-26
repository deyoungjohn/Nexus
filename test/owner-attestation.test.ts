import assert from "node:assert/strict";
import test from "node:test";
import { Wallet } from "ethers";
import { createOwnerEligibilityStatement, ownerAttestationSignRequest,
  OWNER_ATTESTATION_DOMAIN, OWNER_ATTESTATION_TYPES,
  verifyOwnerEligibilityAttestation } from "../src/market-gate/owner-attestation.js";

const signer = Wallet.createRandom();
const token = "0xa9ee28c80f960b889dfbd1902055218cba016f75";
const router = "0x1b81D678ffb9C0263b24A97847620C99d213eB14";
const scope = { wallet: signer.address, token, router, venueId: "pancakeswap-v3-direct", side: "buy" as const };
const now = new Date("2026-09-28T14:00:00Z");

test("P5.5 owner attestation signs exact wallet, asset, venue and router scope", async () => {
  const statement = createOwnerEligibilityStatement({ ...scope, notProhibited: true,
    restrictionsSatisfied: true, termsAcknowledged: true }, now);
  const request = JSON.parse(ownerAttestationSignRequest(statement)) as { method: string; params: string[] };
  assert.equal(request.method, "eth_signTypedData_v4");
  assert.equal(request.params[0], signer.address);
  assert.equal(JSON.parse(request.params[1]!).message.nonce, statement.nonce);
  const signature = await signer.signTypedData(OWNER_ATTESTATION_DOMAIN, OWNER_ATTESTATION_TYPES, statement);
  const signed = { statement, signature };
  assert.equal(verifyOwnerEligibilityAttestation(signed, scope, now, () => false), true);
  const recovery = signature.slice(-2);
  assert.equal(verifyOwnerEligibilityAttestation({ statement, signature: signature.slice(2, -2),
    signatureRecovery: recovery }, scope, now, () => false), true);
  assert.equal(verifyOwnerEligibilityAttestation(signed, { ...scope, token: "0x390a684ef9cade28a7ad0dfa61ab1eb3842618c4" }, now, () => false), false);
  assert.equal(verifyOwnerEligibilityAttestation(signed, { ...scope, router: token }, now, () => false), false);
  assert.equal(verifyOwnerEligibilityAttestation(signed, { ...scope, venueId: "other" }, now, () => false), false);
  assert.equal(verifyOwnerEligibilityAttestation(signed, { ...scope, side: "sell" }, now, () => false), false);
  assert.equal(verifyOwnerEligibilityAttestation(signed, scope, now, (nonce) => nonce === statement.nonce), false);
  assert.equal(verifyOwnerEligibilityAttestation(signed, scope, new Date(now.getTime() + 86_400_000), () => false), false);
  assert.equal(verifyOwnerEligibilityAttestation({ ...signed, statement: { ...statement, restrictionsSatisfied: false } }, scope, now, () => false), false);
  assert.equal(verifyOwnerEligibilityAttestation({ ...signed, statement: { ...statement, expiresAt: statement.expiresAt + 1 } }, scope, now, () => false), false);
  assert.equal(verifyOwnerEligibilityAttestation({ ...signed, signature: "0x" }, scope, now, () => false), false);
  assert.throws(() => createOwnerEligibilityStatement({ ...scope, notProhibited: false,
    restrictionsSatisfied: true, termsAcknowledged: true }, now));
});
