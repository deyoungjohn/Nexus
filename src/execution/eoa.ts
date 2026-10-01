import { Transaction, verifyTypedData } from "ethers";
import { identifier, requireInput } from "../domain/errors.js";
import type { GateRequest } from "../market-gate/evidence.js";
import { evaluateMarketGate } from "../market-gate/gate.js";

/** Off-chain owner permission. It conveys no delegation and is not a transaction. */
export interface EoaLegApproval {
  readonly portfolioId: string;
  readonly planId: string;
  readonly legId: string;
  readonly portfolioRevision: bigint;
  readonly policyHash: string;
  readonly evidenceHash: string;
  readonly wallet: string;
  readonly chainId: number;
  readonly router: string;
  readonly tokenIn: string;
  readonly tokenOut: string;
  readonly inputRaw: bigint;
  readonly minimumOutputRaw: bigint;
  readonly calldata: string;
  readonly value: bigint;
  readonly transactionNonce: number;
  readonly authorizationNonce: string;
  readonly expiresAt: string;
  readonly maxGasLimit: bigint;
  readonly maxFeePerGas: bigint;
}

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
const hashText = (value: string): string => `0x${value}`;

const domain = (chainId: number) => ({ name: "Nexus EOA leg approval", version: "1", chainId });
const types = { Leg: [
  { name: "portfolioId", type: "string" }, { name: "planId", type: "string" },
  { name: "legId", type: "string" }, { name: "portfolioRevision", type: "uint256" },
  { name: "policyHash", type: "bytes32" }, { name: "evidenceHash", type: "bytes32" },
  { name: "wallet", type: "address" }, { name: "router", type: "address" },
  { name: "tokenIn", type: "address" }, { name: "tokenOut", type: "address" },
  { name: "inputRaw", type: "uint256" }, { name: "minimumOutputRaw", type: "uint256" },
  { name: "calldata", type: "bytes" }, { name: "value", type: "uint256" },
  { name: "transactionNonce", type: "uint256" }, { name: "authorizationNonce", type: "string" },
  { name: "expiresAt", type: "uint256" }, { name: "maxGasLimit", type: "uint256" },
  { name: "maxFeePerGas", type: "uint256" }
] };

function signingValue(approval: EoaLegApproval) {
  return { ...approval, policyHash: approval.policyHash, evidenceHash: hashText(approval.evidenceHash),
    expiresAt: BigInt(Date.parse(approval.expiresAt)) };
}

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
    && expiry <= Date.parse(gate.quoteExpiresAt) && expiry <= Date.parse(quote.onchainDeadline),
  "APPROVAL_EXPIRED", "Approval must expire within quote and on-chain deadlines.");
  return Object.freeze({ ...metadata, portfolioRevision: request.snapshot.revision,
    evidenceHash: gate.evidenceHash, wallet: request.wallet, chainId: quote.chainId,
    router: quote.router, tokenIn: quote.tokenIn, tokenOut: quote.tokenOut,
    inputRaw: quote.inputRaw, minimumOutputRaw: quote.minimumOutputRaw,
    calldata: quote.calldata, value: quote.value });
}

/** Rebuilds the approval against fresh inputs and checks the owner's typed signature. */
export function verifyEoaLegApproval(approval: EoaLegApproval, signature: string,
  freshRequest: GateRequest, expected: ApprovalMetadata, paused: boolean): void {
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
  const rebuilt = prepareEoaLegApproval(freshRequest, expected);
  requireInput(approval.portfolioRevision === rebuilt.portfolioRevision
    && same(approval.evidenceHash, rebuilt.evidenceHash)
    && same(approval.wallet, rebuilt.wallet) && approval.chainId === rebuilt.chainId
    && same(approval.router, rebuilt.router) && same(approval.tokenIn, rebuilt.tokenIn)
    && same(approval.tokenOut, rebuilt.tokenOut) && approval.inputRaw === rebuilt.inputRaw
    && approval.minimumOutputRaw === rebuilt.minimumOutputRaw
    && same(approval.calldata, rebuilt.calldata) && approval.value === rebuilt.value,
  "APPROVAL_CHANGED", "Plan revision, policy, quote or evidence changed.");
  let signer: string;
  try { signer = verifyTypedData(domain(approval.chainId), types, signingValue(approval), signature); }
  catch { requireInput(false, "INVALID_SIGNATURE", "Owner approval signature is invalid."); }
  requireInput(same(signer!, approval.wallet), "WRONG_SIGNER", "Approval signer does not control the EOA.");
}

/** Validates a signed EIP-1559 swap and returns its hash; does not broadcast it. */
export function verifySignedEoaSwap(approval: EoaLegApproval, signature: string,
  rawSignedTransaction: string, freshRequest: GateRequest, expected: ApprovalMetadata, paused: boolean): string {
  verifyEoaLegApproval(approval, signature, freshRequest, expected, paused);
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

export const eoaApprovalTypedData = (approval: EoaLegApproval) => ({
  domain: domain(approval.chainId), types, value: signingValue(approval)
});
