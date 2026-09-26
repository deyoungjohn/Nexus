import { randomBytes } from "node:crypto";
import { Signature, verifyTypedData, type TypedDataDomain } from "ethers";

/** This is an owner representation, not an issuer KYC or legal determination. */
export interface OwnerEligibilityStatement {
  readonly wallet: string;
  readonly token: string;
  readonly router: string;
  readonly venueId: string;
  readonly side: "buy" | "sell";
  readonly notProhibited: boolean;
  readonly restrictionsSatisfied: boolean;
  readonly termsAcknowledged: boolean;
  readonly issuedAt: number;
  readonly expiresAt: number;
  readonly nonce: string;
}

export interface SignedOwnerAttestation {
  readonly statement: OwnerEligibilityStatement;
  readonly signature: string;
  /** Agentic Wallet can return the recovery byte separately. */
  readonly signatureRecovery?: string;
}

export const OWNER_ATTESTATION_DOMAIN: TypedDataDomain = Object.freeze({
  name: "Nexus Owner Eligibility", version: "1", chainId: 56
});

export const OWNER_ATTESTATION_TYPES = Object.freeze({
  OwnerEligibility: [
    { name: "wallet", type: "address" }, { name: "token", type: "address" },
    { name: "router", type: "address" }, { name: "venueId", type: "string" },
    { name: "side", type: "string" },
    { name: "notProhibited", type: "bool" },
    { name: "restrictionsSatisfied", type: "bool" },
    { name: "termsAcknowledged", type: "bool" },
    { name: "issuedAt", type: "uint64" }, { name: "expiresAt", type: "uint64" },
    { name: "nonce", type: "bytes32" }
  ]
});

const address = (value: string): boolean => /^0x[0-9a-fA-F]{40}$/.test(value);
const same = (a: string, b: string): boolean => a.toLowerCase() === b.toLowerCase();
const MAX_LIFETIME_SECONDS = 24 * 60 * 60;

function normalizedSignature(signed: SignedOwnerAttestation): string | null {
  const signature = signed.signature.startsWith("0x") ? signed.signature : `0x${signed.signature}`;
  if (/^0x[0-9a-fA-F]{130}$/.test(signature)) return Signature.from(signature).serialized;
  if (!/^0x[0-9a-fA-F]{128}$/.test(signature)
    || typeof signed.signatureRecovery !== "string"
    || !/^(?:00|01|1b|1c)$/i.test(signed.signatureRecovery)) return null;
  const recovery = Number.parseInt(signed.signatureRecovery, 16);
  return Signature.from({ r: `0x${signature.slice(2, 66)}`, s: `0x${signature.slice(66)}`,
    yParity: recovery === 1 || recovery === 28 ? 1 : 0 }).serialized;
}

export function createOwnerEligibilityStatement(input: Pick<OwnerEligibilityStatement,
  "wallet" | "token" | "router" | "venueId" | "side" | "notProhibited"
  | "restrictionsSatisfied" | "termsAcknowledged">, now = new Date()): OwnerEligibilityStatement {
  if (![input.wallet, input.token, input.router].every(address) || !/^[a-z0-9-]{1,64}$/.test(input.venueId)
    || !["buy", "sell"].includes(input.side) || input.notProhibited !== true
    || input.restrictionsSatisfied !== true || input.termsAcknowledged !== true
    || !Number.isFinite(now.getTime())) throw new Error("Invalid attestation scope or time");
  const issuedAt = Math.floor(now.getTime() / 1000);
  return { ...input, issuedAt, expiresAt: issuedAt + MAX_LIFETIME_SECONDS,
    nonce: `0x${randomBytes(32).toString("hex")}` };
}

/** Returns an eth_signTypedData_v4 request; signing conveys only the displayed statement. */
export function ownerAttestationSignRequest(statement: OwnerEligibilityStatement): string {
  return JSON.stringify({ method: "eth_signTypedData_v4",
    params: [statement.wallet, JSON.stringify({ domain: OWNER_ATTESTATION_DOMAIN,
      types: { EIP712Domain: [
        { name: "name", type: "string" }, { name: "version", type: "string" },
        { name: "chainId", type: "uint256" }
      ], ...OWNER_ATTESTATION_TYPES }, primaryType: "OwnerEligibility", message: statement })] });
}

/** Revalidate at every use. Revocation and current transfer permission are separate required checks. */
export function verifyOwnerEligibilityAttestation(signed: SignedOwnerAttestation, scope: {
  readonly wallet: string; readonly token: string; readonly router: string; readonly venueId: string;
  readonly side: "buy" | "sell";
}, now: Date, isRevoked: (nonce: string) => boolean): boolean {
  try {
    const s = signed.statement;
    const time = Math.floor(now.getTime() / 1000);
    if (!Number.isSafeInteger(time) || ![s.wallet, s.token, s.router].every(address)
      || !same(s.wallet, scope.wallet) || !same(s.token, scope.token)
      || !same(s.router, scope.router) || s.venueId !== scope.venueId || s.side !== scope.side
      || s.notProhibited !== true || s.restrictionsSatisfied !== true
      || s.termsAcknowledged !== true || !Number.isSafeInteger(s.issuedAt)
      || !Number.isSafeInteger(s.expiresAt) || s.issuedAt > time || time >= s.expiresAt
      || s.expiresAt <= s.issuedAt || s.expiresAt - s.issuedAt > MAX_LIFETIME_SECONDS
      || !/^0x[0-9a-fA-F]{64}$/.test(s.nonce) || isRevoked(s.nonce)) return false;
    const signature = normalizedSignature(signed);
    return signature !== null && same(verifyTypedData(OWNER_ATTESTATION_DOMAIN,
      OWNER_ATTESTATION_TYPES, s, signature), s.wallet);
  } catch { return false; }
}
