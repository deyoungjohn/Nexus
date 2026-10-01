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

export const eoaApprovalTypedData = (approval: EoaLegApproval) => ({
  domain: domain(approval.chainId), types, value: signingValue(approval)
});
