import { requireInput } from "../domain/errors.js";
import { BSTOCKS_BSC_NVDAB } from "../market-gate/bstocks-bsc.js";
import { BSC_USDT_ASSET } from "../market-gate/chainlink-bsc.js";
import { assessTokenSecurity, tokenSecurityFingerprint, BINANCE_COVERAGE_FIELDS, GOPLUS_COVERAGE_FIELDS,
  type TokenSecurityEvidence } from "../security/token-security.js";
import type { GateRequest } from "../market-gate/evidence.js";
import { decodeV3ExactInputSingle } from "../market-gate/route.js";

export interface PilotAdmissionProfile {
  readonly version: 2;
  readonly revision: string;
  readonly wallet: string;
  readonly instrumentId: string;
  /** One lifetime buy, including failed/unknown submissions; not a daily reset. */
  readonly maximumSpendRaw: bigint;
  readonly independentReview: "deferred";
  readonly gas: { readonly maximumNativeFeeRaw: bigint; readonly maximumSettlementFeeRaw: bigint; readonly reviewedAt: string };
  readonly price: {
    readonly heartbeatMs: number;
    readonly heartbeatSourceUrl: string;
    readonly heartbeatSourceDigest: string;
    readonly baseBandBps: number;
    readonly additionalBandBpsPerHour: number;
    readonly maximumBandBps: number;
  };
  /** Exact reviewed facts remain valid while their fingerprint stays unchanged. */
  readonly security: readonly {
    readonly assetId: string;
    readonly fingerprint: string;
    readonly acceptedFindings: Readonly<Record<"binance" | "goplus", readonly string[]>>;
  }[];
}

export interface PilotRoundTrip {
  readonly source: "anvil-owner-round-trip:v1";
  readonly wallet: string;
  readonly sourceBlock: bigint;
  readonly sourceBlockHash: string;
  readonly observedAt: string;
  readonly expiresAt: string;
  readonly buyCalldata: string;
  readonly sellCalldata: string;
  readonly buyInputRaw: bigint;
  readonly boughtRaw: bigint;
  readonly soldRaw: bigint;
  readonly sellOutputRaw: bigint;
  readonly buyTransferTaxRaw: bigint;
  readonly sellTransferTaxRaw: bigint;
  readonly success: boolean;
  readonly evidenceDigest: string;
}

const sha = (s: string) => /^[0-9a-f]{64}$/.test(s);
// Provider output is never rewritten. Only these issuer-trust cautions can be accepted.
const tolerated = (finding: string): boolean => ["risk-level-above-low", "is_mintable",
  "transfer_pausable", "is_blacklisted", "is_whitelisted", "external_call",
  "owner_change_balance", "honeypot_with_same_creator"].includes(finding)
  || /^(CONTRACT_RISK|TRADE_RISK):CAUTION:[^\n]{1,160}$/u.test(finding)
    && /mint|paus|blacklist|whitelist|freez|owner|upgrade|proxy/iu.test(finding)
    && !/tax|honeypot|cannot|selfdestruct/iu.test(finding);

export function validatePilotProfile(p: PilotAdmissionProfile): void {
  requireInput(p.version === 2 && /^[A-Za-z0-9._-]{1,128}$/.test(p.revision)
    && /^0x[0-9a-f]{40}$/.test(p.wallet) && !/^0x0{40}$/.test(p.wallet)
    && p.instrumentId.startsWith(`eip155:56/erc20:${BSTOCKS_BSC_NVDAB}/issuer:bstocks/product:`) && p.maximumSpendRaw > 0n
    && p.maximumSpendRaw <= 5n * 10n ** 18n && p.independentReview === "deferred",
  "INVALID_PILOT_PROFILE", "Owner-only NVDAB pilot is capped at five USDT.");
  requireInput(!!p.gas && p.gas.maximumNativeFeeRaw > 0n && p.gas.maximumSettlementFeeRaw > 0n
    && Number.isFinite(Date.parse(p.gas.reviewedAt)), "INVALID_PILOT_PROFILE", "Reviewed absolute gas cap required.");
  const price = p.price;
  requireInput(Number.isSafeInteger(price.heartbeatMs) && price.heartbeatMs > 0 && price.heartbeatMs <= 86_400_000
    && price.heartbeatSourceUrl === "https://reference-data-directory.vercel.app/feeds-bsc-mainnet.json"
    && sha(price.heartbeatSourceDigest)
    && [price.baseBandBps, price.additionalBandBpsPerHour, price.maximumBandBps]
      .every(v => Number.isInteger(v) && v >= 0 && v <= 200)
    && price.baseBandBps === 100 && price.additionalBandBpsPerHour === 10 && price.maximumBandBps === 200,
  "INVALID_PILOT_PROFILE", "Published heartbeat and explicit bounded price parameters required.");
  requireInput(p.security.length === 2 && new Set(p.security.map(s => s.assetId)).size === 2
    && p.security.some(s => s.assetId === BSC_USDT_ASSET)
    && p.security.some(s => s.assetId === `eip155:56/erc20:${BSTOCKS_BSC_NVDAB}`)
    && p.security.every(s => sha(s.fingerprint) && ["binance", "goplus"].every(provider => {
      const findings = s.acceptedFindings[provider as "binance" | "goplus"];
      return Array.isArray(findings) && new Set(findings).size === findings.length && findings.every(tolerated);
    })), "INVALID_PILOT_PROFILE", "Exact fingerprints and explicit issuer-trust findings required for both assets.");
}

/** Linear age band is explicit policy, not a volatility estimate or proof of unchanged price. */
export function pilotPriceBand(p: PilotAdmissionProfile, ageMs: number): number {
  validatePilotProfile(p);
  requireInput(Number.isFinite(ageMs) && ageMs >= 0 && ageMs <= p.price.heartbeatMs,
    "PILOT_REFERENCE_EXPIRED", "True reference age exceeds the published heartbeat.");
  return Math.min(p.price.maximumBandBps,
    p.price.baseBandBps + Math.ceil(ageMs * p.price.additionalBandBpsPerHour / 3_600_000));
}

/** Missing scanner coverage stays unknown; complete sourced current control observation remains mandatory. */
export function verifyPilotSecurity(request: GateRequest): boolean {
  try {
    const p = request.pilotProfile!;
    validatePilotProfile(p);
    const reports = request.evidence.tokenSecurity;
    if (!reports || reports.length !== 2 || new Set(reports.map(s => s.assetId)).size !== 2) return false;
    const deferred = new Set(["binance-risk", "goplus-risk", "binance-unsupported", "goplus-unsupported",
      "binance-coverage-incomplete", "goplus-coverage-incomplete", "contract-scope-review-missing-or-expired"]);
    let blockHash: string | undefined;
    for (const pin of p.security) {
      const s: TokenSecurityEvidence | undefined = reports.find(s => s.assetId === pin.assetId);
      if (!s?.observation || s.observation.decimals !== 18
        || s.observation.sourceBlock !== request.evidence.quantity!.sourceBlock
        || (blockHash && blockHash !== s.observation.sourceBlockHash)
        || tokenSecurityFingerprint(s.observation) !== pin.fingerprint) return false;
      blockHash = s.observation.sourceBlockHash;
      const computed = assessTokenSecurity({ ...s, now: request.now, maxAgeMs: request.marketPolicy.maxStatusAgeMs });
      if (computed.evidenceHash !== s.evidenceHash || computed.reasons.some(r => !deferred.has(r))) return false;
      if (s.providers.some(provider => provider.state === "unavailable"
        || !provider.coverage
        || Object.keys(provider.coverage).length !== (provider.provider==='binance'?BINANCE_COVERAGE_FIELDS:GOPLUS_COVERAGE_FIELDS).length
        || !(provider.provider==='binance'?BINANCE_COVERAGE_FIELDS:GOPLUS_COVERAGE_FIELDS)
          .every(key=>['covered','unknown'].includes(provider.coverage?.[key]??''))
        || provider.findings.some(f => !pin.acceptedFindings[provider.provider].includes(f)))) return false;
    }
    const round = request.evidence.pilotRoundTrip, quote = request.evidence.quote!;
    const sell = round && decodeV3ExactInputSingle(round.sellCalldata);
    return !!round && round.source === "anvil-owner-round-trip:v1" && round.success
      && round.wallet.toLowerCase() === p.wallet && round.sourceBlock === request.evidence.quantity!.sourceBlock
      && round.sourceBlockHash === blockHash && round.buyCalldata.toLowerCase() === quote.calldata.toLowerCase()
      && round.buyInputRaw === quote.inputRaw && round.boughtRaw >= quote.minimumOutputRaw
      && round.soldRaw === round.boughtRaw && round.sellOutputRaw > 0n
      && round.buyTransferTaxRaw === 0n && round.sellTransferTaxRaw === 0n
      && !!sell && sell.tokenIn.toLowerCase() === quote.tokenOut.toLowerCase()
      && sell.tokenOut.toLowerCase() === quote.tokenIn.toLowerCase()
      && sell.recipient.toLowerCase() === p.wallet && sell.inputRaw === round.soldRaw
      && sell.minimumOutputRaw > 0n && request.marketPolicy.approvedV3FeeTiers.includes(sell.feeTier)
      && sha(round.evidenceDigest)
      && Date.parse(round.observedAt) <= Date.parse(request.now)
      && Date.parse(request.now) < Date.parse(round.expiresAt)
      && Date.parse(request.now) - Date.parse(round.observedAt) <= request.marketPolicy.maxSimulationAgeMs;
  } catch { return false; }
}
