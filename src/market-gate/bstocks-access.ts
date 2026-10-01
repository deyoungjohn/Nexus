import { createHash, randomBytes } from "node:crypto";
import { verifyTypedData } from "ethers";
import type { Instrument } from "../domain/instrument.js";
import type { EligibilityEvidence } from "./evidence.js";
import { BSTOCKS_BSC_NVDAB } from "./bstocks-bsc.js";
import { BSTOCKS_BSC_V3_POOL, BSTOCKS_BSC_V3_ROUTER,
  fetchBStocksTransferPreflight, type BStocksTransferPreflightRequest } from "./bstocks-transfer.js";

const address = (value: unknown): value is string => typeof value === "string"
  && /^0x[0-9a-fA-F]{40}$/.test(value) && !/^0x0{40}$/i.test(value);
const same = (a: string, b: string): boolean => a.toLowerCase() === b.toLowerCase();
const instant = (value: unknown): number => typeof value === "string"
  && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/.test(value)
  ? Date.parse(value) : NaN;
const countryCode = (value: unknown): value is string => typeof value === "string" && /^[A-Z]{2}$/.test(value);
const id = (value: unknown): value is string => typeof value === "string" && /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/.test(value);
const sha = (value: unknown): string => createHash("sha256").update(JSON.stringify(value)).digest("hex");

export interface BStocksWalletChallenge {
  readonly sessionId: string;
  readonly wallet: string;
  readonly nonce: string;
  readonly issuedAt: string;
  readonly expiresAt: string;
}

export interface BStocksWalletBinding {
  readonly sessionId: string;
  readonly wallet: string;
  readonly bindingId: string;
  readonly observedAt: string;
  readonly expiresAt: string;
}

export interface BStocksChallengeStore {
  issue(challenge: BStocksWalletChallenge): Promise<void>;
  /** Atomically consumes exactly one issued challenge; never accepts replay. */
  consume(sessionId: string, nonce: string): Promise<BStocksWalletChallenge | null>;
}

const domain = { name: "Nexus bStocks wallet binding", version: "1", chainId: 56 };
const types = { WalletBinding: [
  { name: "sessionId", type: "string" }, { name: "wallet", type: "address" },
  { name: "nonce", type: "bytes32" }, { name: "issuedAt", type: "uint256" },
  { name: "expiresAt", type: "uint256" }
] };
const signingValue = (challenge: BStocksWalletChallenge) => ({
  ...challenge, issuedAt: BigInt(instant(challenge.issuedAt)),
  expiresAt: BigInt(instant(challenge.expiresAt))
});

/** A challenge is scoped to one authenticated server session and one EOA. */
export async function issueBStocksWalletChallenge(sessionId: string, wallet: string,
  store: BStocksChallengeStore, now: Date): Promise<BStocksWalletChallenge> {
  if (!id(sessionId) || !address(wallet) || !Number.isFinite(now.getTime())) throw new Error("Invalid binding request");
  const challenge = { sessionId, wallet: wallet.toLowerCase(),
    nonce: `0x${randomBytes(32).toString("hex")}`, issuedAt: now.toISOString(),
    expiresAt: new Date(now.getTime() + 5 * 60_000).toISOString() };
  await store.issue(challenge);
  return challenge;
}

export function bStocksWalletChallengeTypedData(challenge: BStocksWalletChallenge) {
  return { domain, types, value: signingValue(challenge) };
}

/** Caller must persist the returned binding against the authenticated session. */
export async function verifyBStocksWalletChallenge(challenge: BStocksWalletChallenge,
  signature: string, store: BStocksChallengeStore, now: Date): Promise<BStocksWalletBinding | null> {
  try {
    const at = now.getTime(), issued = instant(challenge.issuedAt), expiry = instant(challenge.expiresAt);
    if (!id(challenge.sessionId) || !address(challenge.wallet)
      || !/^0x[0-9a-fA-F]{64}$/.test(challenge.nonce)
      || !Number.isFinite(at) || !Number.isFinite(issued) || !Number.isFinite(expiry)
      || issued > at || at >= expiry || expiry - issued > 5 * 60_000) return null;
    const signer = verifyTypedData(domain, types, signingValue(challenge), signature);
    if (!same(signer, challenge.wallet)) return null;
    const issuedChallenge = await store.consume(challenge.sessionId, challenge.nonce);
    if (!issuedChallenge || sha(issuedChallenge) !== sha(challenge)) return null;
    return { sessionId: challenge.sessionId, wallet: challenge.wallet.toLowerCase(),
      bindingId: sha({ sessionId: challenge.sessionId, wallet: challenge.wallet.toLowerCase(),
        nonce: challenge.nonce }), observedAt: challenge.issuedAt,
      expiresAt: challenge.expiresAt };
  } catch { return null; }
}

interface TimedDecision { readonly source: string; readonly revision: string;
  readonly observedAt: string; readonly expiresAt: string }

/** Supplied only by a reviewed server-side identity/location provider. */
export interface BStocksJurisdiction extends TimedDecision {
  readonly sessionId: string;
  readonly residenceCountry: string;
  readonly accessCountry: string;
  readonly restrictedPerson: boolean;
}

/** Supplied only by the reviewed issuer country endpoint adapter. */
export interface BStocksCountryDecision extends TimedDecision {
  readonly sourceUrl: string;
  readonly country: string;
  readonly productId: "bstocks";
  readonly allowed: boolean;
}

export interface BStocksProductDecision extends TimedDecision {
  readonly instrumentId: string;
  readonly venueId: string;
  readonly side: "buy" | "sell";
  readonly allowed: boolean;
}

export interface BStocksAccessPorts {
  /** Session and wallet binding must come from a trusted server-side store. */
  session(sessionId: string): Promise<{ active: boolean; binding: BStocksWalletBinding | null }>;
  jurisdiction(sessionId: string): Promise<BStocksJurisdiction | null>;
  country(country: string): Promise<BStocksCountryDecision | null>;
  product(instrumentId: string, venueId: string, side: "buy" | "sell"): Promise<BStocksProductDecision | null>;
}

export interface BStocksAccessPolicy {
  readonly venueId: string;
  readonly jurisdictionSource: string;
  readonly countrySourceUrl: string;
  readonly countrySourceRevision: string;
  readonly productSource: string;
  readonly maxEvidenceAgeMs: number;
  readonly maxBlockAgeMs: number;
}

export interface BStocksAccessRequest {
  readonly sessionId: string;
  readonly wallet: string;
  readonly instrument: Instrument;
  readonly side: "buy" | "sell";
  readonly now: string;
}

/** Never derive policy or reviewed on-chain controls from client input. */
export interface BStocksAccessServerContext {
  readonly policy: BStocksAccessPolicy;
  readonly transfer: Omit<BStocksTransferPreflightRequest, "wallet" | "side" | "now" | "maxBlockAgeMs">;
}

const requirements = ["bstocks-wallet-bound", "bstocks-person-reviewed", "bstocks-country-allowed",
  "bstocks-product-allowed", "bstocks-transfer-allowed"] as const;
function timely(value: TimedDecision, now: number, maxAge: number): boolean {
  const observed = instant(value.observedAt), expiry = instant(value.expiresAt);
  return !!value.source && !!value.revision && Number.isFinite(observed)
    && Number.isFinite(expiry) && observed <= now && now < expiry
    && expiry > observed && now - observed <= maxAge;
}

/** Returns null on any missing, denied, stale, conflicting or malformed input. */
export async function assessBStocksAccess(input: BStocksAccessRequest, context: BStocksAccessServerContext,
  ports: BStocksAccessPorts,
  rpcFetcher: typeof fetch = fetch): Promise<EligibilityEvidence | null> {
  try {
    const now = instant(input.now), p = context.policy;
    if (!Number.isFinite(now) || !id(input.sessionId) || !address(input.wallet)
      || input.instrument.issuerId !== "bstocks" || input.instrument.chainId !== 56
      || !same(input.instrument.tokenAddress, BSTOCKS_BSC_NVDAB)
      || !["buy", "sell"].includes(input.side)
      || !id(p.venueId) || !p.jurisdictionSource || !p.productSource
      || !/^https:\/\/(?:[a-z0-9-]+\.)*binance\.com\//i.test(p.countrySourceUrl)
      || !p.countrySourceRevision
      || !Number.isSafeInteger(p.maxEvidenceAgeMs) || p.maxEvidenceAgeMs <= 0
      || !Number.isSafeInteger(p.maxBlockAgeMs) || p.maxBlockAgeMs <= 0
      || !input.instrument.eligibilityRequirements.every(r => requirements.includes(r as typeof requirements[number]))) return null;
    const session = await ports.session(input.sessionId);
    const binding = session.binding;
    if (!session.active || !binding || binding.sessionId !== input.sessionId
      || !same(binding.wallet, input.wallet) || !/^[0-9a-f]{64}$/.test(binding.bindingId)
      || !Number.isFinite(instant(binding.observedAt))
      || instant(binding.observedAt) > now || now >= instant(binding.expiresAt)
      || instant(binding.expiresAt) - instant(binding.observedAt) > 5 * 60_000) return null;
    const jurisdiction = await ports.jurisdiction(input.sessionId);
    if (!jurisdiction || !timely(jurisdiction, now, p.maxEvidenceAgeMs)
      || jurisdiction.sessionId !== input.sessionId
      || jurisdiction.source !== p.jurisdictionSource
      || jurisdiction.restrictedPerson !== false
      || !countryCode(jurisdiction.residenceCountry)
      || !countryCode(jurisdiction.accessCountry)
      || jurisdiction.residenceCountry !== jurisdiction.accessCountry) return null;
    const country = await ports.country(jurisdiction.residenceCountry);
    if (!country || !timely(country, now, p.maxEvidenceAgeMs)
      || country.sourceUrl !== p.countrySourceUrl
      || country.source !== "official-bstocks-country"
      || country.revision !== p.countrySourceRevision
      || country.country !== jurisdiction.residenceCountry
      || country.productId !== "bstocks" || country.allowed !== true) return null;
    const product = await ports.product(input.instrument.instrumentId, p.venueId, input.side);
    if (!product || !timely(product, now, p.maxEvidenceAgeMs)
      || product.source !== p.productSource
      || product.instrumentId !== input.instrument.instrumentId
      || product.venueId !== p.venueId || product.side !== input.side
      || product.allowed !== true) return null;
    const transfer = await fetchBStocksTransferPreflight({ ...context.transfer,
      wallet: input.wallet, side: input.side, now: input.now,
      maxBlockAgeMs: p.maxBlockAgeMs }, rpcFetcher);
    if (!transfer || !same(transfer.wallet, input.wallet) || transfer.side !== input.side
      || transfer.sourceBlock !== context.transfer.snapshot.sourceBlock) return null;
    const expiresAt = new Date(Math.min(instant(binding.expiresAt), instant(jurisdiction.expiresAt),
      instant(country.expiresAt), instant(product.expiresAt), instant(transfer.expiresAt))).toISOString();
    if (now >= instant(expiresAt)) return null;
    const authorization = { policy: p, bindingId: binding.bindingId, wallet: input.wallet.toLowerCase(),
      instrumentId: input.instrument.instrumentId, side: input.side, venueId: p.venueId,
      token: BSTOCKS_BSC_NVDAB, pool: BSTOCKS_BSC_V3_POOL,
      router: BSTOCKS_BSC_V3_ROUTER, jurisdictionRevision: jurisdiction.revision,
      countryRevision: country.revision, productRevision: product.revision,
      transferRevision: transfer.controlRevision };
    const authorizationHash = sha(authorization);
    const accessHash = sha({ ...authorization, transferBlock: String(transfer.sourceBlock) });
    return { source: "bstocks-access:v1", observedAt: new Date(Math.min(
      instant(binding.observedAt), instant(jurisdiction.observedAt), instant(country.observedAt),
      instant(product.observedAt), instant(transfer.observedAt))).toISOString(), expiresAt,
      instrumentId: input.instrument.instrumentId, wallet: input.wallet.toLowerCase(),
      venueId: p.venueId, allowedSides: [input.side],
      verifiedRequirements: [...requirements], transferPermitted: true,
      accessControl: { accessHash, authorizationHash, side: input.side, token: BSTOCKS_BSC_NVDAB,
        pool: BSTOCKS_BSC_V3_POOL, router: BSTOCKS_BSC_V3_ROUTER,
        transferBlock: transfer.sourceBlock,
        transferRevision: transfer.controlRevision } };
  } catch { return null; }
}
