import assert from "node:assert/strict";
import test from "node:test";
import { Wallet } from "ethers";
import { eoaApprovalTypedData, prepareEoaLegApproval, verifyEoaLegApproval,
  verifySignedEoaSwap, type ApprovalMetadata } from "../src/execution/eoa.js";
import { fixture } from "./market-gate.test.js";

const metadata: ApprovalMetadata = {
  portfolioId: "portfolio-one", planId: "plan-one", legId: "leg-one",
  policyHash: `0x${"a".repeat(64)}`, transactionNonce: 7,
  authorizationNonce: "auth-one", maxGasLimit: 300_000n,
  maxFeePerGas: 5_000_000_000n, expiresAt: "2026-09-28T14:03:00Z"
};

test("P7 EOA owner signs exact plan and exact swap; verifier returns signed hash", async () => {
  const owner = Wallet.createRandom();
  const request = fixture(owner.address);
  const approval = prepareEoaLegApproval(request, metadata);
  const { domain, types, value } = eoaApprovalTypedData(approval);
  const signature = await owner.signTypedData(domain, types, value);
  const raw = await owner.signTransaction({ type: 2, chainId: 56, nonce: 7,
    to: approval.router, data: approval.calldata, value: approval.value,
    gasLimit: 250_000n, maxFeePerGas: 4_000_000_000n,
    maxPriorityFeePerGas: 1_000_000_000n });
  assert.match(verifySignedEoaSwap(approval, signature, raw, request, metadata, false), /^0x[0-9a-f]{64}$/);
  assert.throws(() => verifySignedEoaSwap(approval, signature, raw, request, metadata, true),
    { code: "PORTFOLIO_PAUSED" });
  assert.throws(() => verifySignedEoaSwap(approval, signature, raw,
    { ...request, snapshot: { ...request.snapshot, revision: 2n } }, metadata, false),
  { code: "APPROVAL_CHANGED" });
  assert.throws(() => verifySignedEoaSwap(approval, signature, raw, request,
    { ...metadata, policyHash: `0x${"b".repeat(64)}` }, false), { code: "APPROVAL_CHANGED" });
  const changed = { ...request, evidence: { ...request.evidence,
    tokenStatus: { ...request.evidence.tokenStatus!, observedAt: "2026-09-28T13:59:30Z" } } };
  assert.throws(() => verifySignedEoaSwap(approval, signature, raw, changed, metadata, false),
    { code: "APPROVAL_CHANGED" });
  assert.throws(() => verifySignedEoaSwap(approval, signature, raw,
    { ...request, now: "2026-09-28T14:03:00Z" }, metadata, false), { code: "APPROVAL_EXPIRED" });
  assert.throws(() => verifySignedEoaSwap(approval, signature, raw,
    { ...request, evidence: { ...request.evidence, audit: { ...request.evidence.audit!, state: "unsupported" } } },
    metadata, false), { code: "MARKET_GATE_BLOCKED" });
  const wrong = Wallet.createRandom();
  const wrongSignature = await wrong.signTypedData(domain, types, value);
  assert.throws(() => verifyEoaLegApproval(approval, wrongSignature, request, metadata, false),
    { code: "WRONG_SIGNER" });
  const changedCalldata = await owner.signTransaction({ type: 2, chainId: 56, nonce: 7,
    to: approval.router, data: "0x", value: 0n, gasLimit: 250_000n,
    maxFeePerGas: 4_000_000_000n, maxPriorityFeePerGas: 1_000_000_000n });
  assert.throws(() => verifySignedEoaSwap(approval, signature, changedCalldata, request, metadata, false),
    { code: "TRANSACTION_CHANGED" });
  const highFee = await owner.signTransaction({ type: 2, chainId: 56, nonce: 7,
    to: approval.router, data: approval.calldata, value: 0n, gasLimit: 250_000n,
    maxFeePerGas: 6_000_000_000n, maxPriorityFeePerGas: 1_000_000_000n });
  assert.throws(() => verifySignedEoaSwap(approval, signature, highFee, request, metadata, false),
    { code: "FEE_BOUND" });
});

test("P7 EOA preparation blocks missing live evidence and approval beyond quote expiry", () => {
  const request = fixture(Wallet.createRandom().address);
  assert.throws(() => prepareEoaLegApproval({ ...request,
    evidence: { ...request.evidence, eligibility: null } }, metadata), { code: "MARKET_GATE_BLOCKED" });
  assert.throws(() => prepareEoaLegApproval(request,
    { ...metadata, expiresAt: "2026-09-28T14:05:00Z" }), { code: "APPROVAL_EXPIRED" });
});
