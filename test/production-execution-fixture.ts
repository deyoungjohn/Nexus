import { securityDigest, assessTokenSecurity } from "../src/security/token-security.js";
import { BSTOCKS_BSC_NVDAB } from "../src/market-gate/bstocks-bsc.js";
import { BSTOCKS_BSC_V3_POOL, BSTOCKS_BSC_V3_ROUTER } from "../src/market-gate/bstocks-transfer.js";
import { BSC_USDT } from "../src/security/bsc-token-security.js";
import { createInstrument } from "../src/domain/instrument.js";
import type { MarketEvidence, GateRequest } from "../src/market-gate/evidence.js";
import { fixture } from "./market-gate.test.js";
import { syntheticTokenSecurity } from "./token-security-fixture.js";

/** Actual token/venue IDs, entirely synthetic prices, eligibility, sources and independent reviews. */
export function productionFixture(wallet: string): GateRequest {
  const base = fixture(wallet);
  const instrument = createInstrument({ ...base.instrument, tokenAddress: BSTOCKS_BSC_NVDAB,
    issuerId: "bstocks", underlyingId: "NVDA", ticker: "NVDAB", eligibilityRequirements: ["bstocks-wallet-bound",
      "bstocks-person-reviewed", "bstocks-country-allowed", "bstocks-product-allowed", "bstocks-transfer-allowed"] });
  function replace<T>(value: T): T {
    if (typeof value === "string") return value.replaceAll(base.instrument.instrumentId,instrument.instrumentId)
      .replaceAll("2".repeat(40), BSC_USDT.slice(2)).replaceAll("3".repeat(40), BSTOCKS_BSC_NVDAB.slice(2))
      .replaceAll("4".repeat(40), BSTOCKS_BSC_V3_ROUTER.slice(2)) as T;
    if (Array.isArray(value)) return value.map(replace) as T;
    if (value !== null && typeof value === "object") return Object.fromEntries(Object.entries(value)
      .map(([key,item])=>[key,replace(item)])) as T;
    return value;
  }
  const result = replace(base);
  const e = result.evidence;
  return { ...result, instrument, snapshot: { ...result.snapshot, positions: result.snapshot.positions.map(p => ({...p,instrument})) },
    proposal: result.proposal.side === "buy" ? { ...result.proposal, acquiredValueLower: 5n*10n**18n,
      acquiredValueUpper: 5n*10n**18n } : result.proposal,
    marketPolicy: { ...result.marketPolicy, approvedV3FeeTiers: [2500] },
    evidence: { ...e,
      eligibility: { ...e.eligibility!, source: "bstocks-access:v1", verifiedRequirements: instrument.eligibilityRequirements,
        accessControl: { accessHash: securityDigest("synthetic-access"), authorizationHash: securityDigest("synthetic-authorization"),
          side: "buy", token: BSTOCKS_BSC_NVDAB, pool: BSTOCKS_BSC_V3_POOL, router: BSTOCKS_BSC_V3_ROUTER,
          transferBlock: 101n, transferRevision: "map-1" } },
      reference: { ...e.reference!, underlyingId: "NVDA" }, event: { ...e.event!, underlyingId: "NVDA" },
      providerEvent: { ...e.event!, instrumentId: instrument.instrumentId, providerSourceUrl: "https://provider.example/notices",
        source: "synthetic-provider-notice" },
      quote: { ...e.quote!, nativeFeeRaw: 300_000n*5_000_000_000n,
        calldata: e.quote!.calldata.slice(0,10+64*2)+(2500n).toString(16).padStart(64,"0")+e.quote!.calldata.slice(10+64*3) },
      simulation: { ...e.simulation!, calldata: e.quote!.calldata.slice(0,10+64*2)+(2500n).toString(16).padStart(64,"0")
        +e.quote!.calldata.slice(10+64*3) },
      tokenSecurity: [syntheticTokenSecurity(instrument.assetId), syntheticTokenSecurity(result.snapshot.confirmedCash.assetId)]
    } };
}

export function refreshFixtureEvidence(evidence: MarketEvidence, now: string, sourceBlock = 102n): MarketEvidence {
  const e = structuredClone(evidence);
  const expiry = new Date(Date.parse(now)+60_000).toISOString();
  for (const value of [e.eligibility,e.quantity,e.settlement,e.session,e.tokenStatus,e.audit,e.event,e.providerEvent])
    if (value) Object.assign(value,{ observedAt:now,expiresAt:expiry });
  Object.assign(e.quantity!,{ sourceBlock });
  Object.assign(e.eligibility!.accessControl!,{ transferBlock:sourceBlock,accessHash:securityDigest({now,sourceBlock}) });
  Object.assign(e.reference!,{ sourceAt:now,receivedAt:now });
  Object.assign(e.simulation!,{ sourceBlock,simulatedAt:now });
  return { ...e, tokenSecurity: e.tokenSecurity!.map(s=>assessTokenSecurity({ ...s,
    observation: { ...s.observation!, observedAt:now,expiresAt:expiry,sourceBlock },
    providers:s.providers.map(p=>({...p,observedAt:now,expiresAt:expiry})),
    reviewArtifact:{...s.reviewArtifact!,observedAt:now,expiresAt:expiry},now,maxAgeMs:600_000 })) };
}
