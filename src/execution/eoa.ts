import { Transaction, verifyTypedData } from "ethers";
import { identifier, requireInput } from "../domain/errors.js";
import type { GateRequest } from "../market-gate/evidence.js";
import { eoaApprovalTypedData, type EoaLegApproval } from "./signing-payload.js";
export { eoaApprovalTypedData, type EoaLegApproval } from "./signing-payload.js";
import { evaluateMarketGate } from "../market-gate/gate.js";
import { executionMarketExpiry, revalidateExecutionMarket } from "./market-revalidation.js";
import { securityDigest } from "../security/token-security.js";

export interface ApprovalMetadata {
  readonly portfolioId: string;
  readonly planId: string;
  readonly legId: string;
  readonly policyHash: string;
  readonly transactionNonce: number;
  readonly authorizationNonce: string;
  readonly maxGasLimit: bigint;
  readonly maxFeePerGas: bigint;
  readonly expiresAt: string;
}

const hex32 = (value: string): boolean => /^0x[0-9a-fA-F]{64}$/.test(value);
const same = (a: string, b: string): boolean => a.toLowerCase() === b.toLowerCase();


/** Requires a currently passing P5 gate; never prepares an executable transaction on failure. */
export function prepareEoaLegApproval(request: GateRequest, metadata: ApprovalMetadata): EoaLegApproval {
  for (const id of [metadata.portfolioId, metadata.planId, metadata.legId, metadata.authorizationNonce]) identifier(id);
  requireInput(hex32(metadata.policyHash), "INVALID_POLICY_HASH", "Policy hash must be bytes32.");
  requireInput(Number.isSafeInteger(metadata.transactionNonce) && metadata.transactionNonce >= 0,
    "INVALID_NONCE", "Transaction nonce must be nonnegative.");
  requireInput(metadata.maxGasLimit > 0n && metadata.maxFeePerGas > 0n,
    "INVALID_FEE_BOUND", "Positive gas bounds are required.");
  const gate = evaluateMarketGate(request);
  requireInput(gate.allowed, "MARKET_GATE_BLOCKED", "Fresh market evidence must pass before approval.");
  requireInput(request.evidence.quote !== null, "MISSING_QUOTE", "Quote is required.");
  const quote = request.evidence.quote;
  const expiry = Date.parse(metadata.expiresAt);
  requireInput(Number.isFinite(expiry) && expiry > Date.parse(request.now)
    && expiry <= Date.parse(gate.quoteExpiresAt) && expiry <= Date.parse(quote.onchainDeadline)
    && (request.marketPolicy.approvalClock !== "refresh-before-submit" || expiry <= executionMarketExpiry(request)),
  "APPROVAL_EXPIRED", "Approval must expire within quote and on-chain deadlines.");
  return Object.freeze({ ...metadata, portfolioRevision: request.snapshot.revision,
    evidenceHash: gate.evidenceHash, wallet: request.wallet, chainId: quote.chainId,
    router: quote.router, tokenIn: quote.tokenIn, tokenOut: quote.tokenOut,
    inputRaw: quote.inputRaw, minimumOutputRaw: quote.minimumOutputRaw,
    calldata: quote.calldata, value: quote.value });
}

/** Rebuilds the approval against fresh inputs and checks the owner's typed signature. */
export function verifyEoaLegApproval(approval: EoaLegApproval, signature: string,
  freshRequest: GateRequest, expected: ApprovalMetadata, paused: boolean, approvedRequest?: GateRequest): void {
  requireInput(!paused, "PORTFOLIO_PAUSED", "Paused portfolios cannot execute.");
  requireInput(approval.portfolioId === expected.portfolioId && approval.planId === expected.planId
    && approval.legId === expected.legId && same(approval.policyHash, expected.policyHash)
    && approval.transactionNonce === expected.transactionNonce
    && approval.authorizationNonce === expected.authorizationNonce
    && approval.maxGasLimit === expected.maxGasLimit
    && approval.maxFeePerGas === expected.maxFeePerGas
    && approval.expiresAt === expected.expiresAt,
  "APPROVAL_CHANGED", "Owner approval differs from the recorded plan and policy.");
  const now = Date.parse(freshRequest.now);
  requireInput(Number.isFinite(now) && now < Date.parse(approval.expiresAt),
    "APPROVAL_EXPIRED", "Owner approval has expired.");
  if (approvedRequest) {
    requireInput(approvedRequest.marketPolicy.approvalClock === "refresh-before-submit"
      && securityDigest({ ...freshRequest, now: approvedRequest.now, evidence: approvedRequest.evidence })
        === securityDigest(approvedRequest),
    "APPROVAL_CHANGED", "Renewal requires the same trusted original approval policy.");
    revalidateExecutionMarket(approvedRequest, freshRequest.evidence, freshRequest.now);
  }
  const rebuilt = prepareEoaLegApproval(approvedRequest ?? freshRequest, expected);
  requireInput(approval.portfolioRevision === rebuilt.portfolioRevision
    && same(approval.evidenceHash, rebuilt.evidenceHash)
    && same(approval.wallet, rebuilt.wallet) && approval.chainId === rebuilt.chainId
    && same(approval.router, rebuilt.router) && same(approval.tokenIn, rebuilt.tokenIn)
    && same(approval.tokenOut, rebuilt.tokenOut) && approval.inputRaw === rebuilt.inputRaw
    && approval.minimumOutputRaw === rebuilt.minimumOutputRaw
    && same(approval.calldata, rebuilt.calldata) && approval.value === rebuilt.value,
  "APPROVAL_CHANGED", "Plan revision, policy, quote or evidence changed.");
  let signer: string;
  try { signer = verifyTypedData(eoaApprovalTypedData(approval).domain, eoaApprovalTypedData(approval).types, eoaApprovalTypedData(approval).value, signature); }
  catch { requireInput(false, "INVALID_SIGNATURE", "Owner approval signature is invalid."); }
  requireInput(same(signer!, approval.wallet), "WRONG_SIGNER", "Approval signer does not control the EOA.");
}

/** Validates a signed EIP-1559 swap and returns its hash; does not broadcast it. */
export function verifySignedEoaSwap(approval: EoaLegApproval, signature: string,
  rawSignedTransaction: string, freshRequest: GateRequest, expected: ApprovalMetadata, paused: boolean,
  approvedRequest?: GateRequest): string {
  verifyEoaLegApproval(approval, signature, freshRequest, expected, paused, approvedRequest);
  let tx: Transaction;
  try { tx = Transaction.from(rawSignedTransaction); }
  catch { requireInput(false, "INVALID_TRANSACTION", "Signed transaction cannot be decoded."); }
  requireInput(tx!.isSigned() && tx!.type === 2 && tx!.chainId === BigInt(approval.chainId)
    && tx!.from !== null && same(tx!.from, approval.wallet)
    && tx!.to !== null && same(tx!.to, approval.router)
    && tx!.data.toLowerCase() === approval.calldata.toLowerCase()
    && tx!.value === approval.value && tx!.nonce === approval.transactionNonce,
  "TRANSACTION_CHANGED", "Signed transaction differs from the approved leg.");
  requireInput(tx!.gasLimit > 0n && tx!.gasLimit <= approval.maxGasLimit
    && tx!.maxFeePerGas !== null && tx!.maxFeePerGas > 0n
    && tx!.maxFeePerGas <= approval.maxFeePerGas
    && tx!.maxPriorityFeePerGas !== null && tx!.maxPriorityFeePerGas <= tx!.maxFeePerGas,
  "FEE_BOUND", "Signed transaction exceeds approved gas bounds.");
  return tx!.hash!;
}
