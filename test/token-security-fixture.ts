import { assessTokenSecurity, SECURITY_AREAS, BINANCE_COVERAGE_FIELDS, GOPLUS_COVERAGE_FIELDS, tokenSecurityFingerprint,
  type TokenSecurityObservation, type TokenSecurityReview } from "../src/security/token-security.js";
import { BSTOCKS_WALLET_PROFILES } from "../src/security/bstocks-governance.js";
import { REVIEWED_BSC_SOURCES } from "../src/security/reviewed-source-pins.js";

/** Synthetic trusted-adapter/review evidence; no assertion about any deployed token. */
export function syntheticTokenSecurity(assetId: string, sourceBlock = 101n) {
  const clock = { observedAt: "2026-09-28T13:59:00.000Z", expiresAt: "2026-09-28T14:10:00.000Z" };
  const observation: TokenSecurityObservation = { ...clock, profile: "runtime-owner-v1", source: "synthetic-rpc", assetId,
    sourceBlock, sourceBlockHash: `0x${"a".repeat(64)}`, decimals: 18,
    authorities: [{ address: "0x1111111111111111111111111111111111111111",
      codeHash: "0xc5d2460186f7233c927e7db2dcc703c0e500b653ca82273b7bfad8045d85a470" }],
    components: [{ address: assetId.split(":").at(-1)!, codeHash: `0x${"b".repeat(64)}`,
      sourceDigest: "c".repeat(64) }], controls: { owner: "0x1111111111111111111111111111111111111111",
        beaconSlot: `0x${"0".repeat(64)}`, implementationSlot: `0x${"0".repeat(64)}` }, paused: false, pendingChange: false };
  if (assetId.endsWith("0x02fca66c1d1afb4e2a7884261eb00f63598a7436")) {
    const controls = { token: assetId.split(":").at(-1)!, tokenCodeHash: `0x${"b".repeat(64)}`,
      beacon: "0x0000000000000000000000000000000000000001", beaconCodeHash: `0x${"b".repeat(64)}`,
      implementation: "0x0000000000000000000000000000000000000002", implementationCodeHash: `0x${"b".repeat(64)}`,
      compliance: "0x0000000000000000000000000000000000000003", complianceCodeHash: `0x${"b".repeat(64)}`,
      pauseManager: "0x0000000000000000000000000000000000000004", pauseManagerCodeHash: `0x${"b".repeat(64)}`,
      beaconOwner: observation.authorities[0]!.address, mintEnabled: true, burnEnabled: true, uiMultiplier: "1000000000000000000",
      ...Object.fromEntries(["adminMembersHash", "issuerMembersHash", "complianceAdminMembersHash",
        "complianceOpsMembersHash", "complianceMembersHash", "pauseAdminMembersHash", "pauseOpsMembersHash"].map(k => [k, `0x${"b".repeat(64)}`])) };
    Object.assign(observation, { profile: "bstocks-beacon-v1", controls,
      components: [controls.token, controls.beacon, controls.implementation, controls.compliance, controls.pauseManager]
        .map(address => ({ address, codeHash: `0x${"b".repeat(64)}`, sourceDigest: "c".repeat(64) })) });
    // Actual reviewed source identities with explicitly synthetic chain/control state.
    const governance = BSTOCKS_WALLET_PROFILES.map(p => {
      const proxy = REVIEWED_BSC_SOURCES.find(pin => pin.address === p.address)!;
      const implementation = REVIEWED_BSC_SOURCES.find(pin => pin.address === p.implementation)!;
      return { profile: p.profile, address: p.address, codeHash: proxy.codeHash,
        implementation: p.implementation, implementationCodeHash: implementation.codeHash,
        admin: observation.authorities[0]!.address, owner: observation.authorities[0]!.address,
        pendingOwner: `0x${"0".repeat(40)}`, initialized: true,
        operator: p.profile === "bstocks-operator-wallet-v1" ? observation.authorities[0]!.address : null,
        paused: p.profile === "bstocks-operator-wallet-v1" ? false : null, hotWallets: [] };
    });
    Object.assign(observation, { governance,
      authorities: [...observation.authorities, ...governance.map(g => ({ address: g.address, codeHash: g.codeHash }))],
      components: [...observation.components, ...governance.flatMap(g => [g.address, g.implementation]
        .map(address => { const pin = REVIEWED_BSC_SOURCES.find(p => p.address === address)!;
          return { address, codeHash: pin.codeHash, sourceDigest: pin.sourceDigest }; }))] });
  }
  const review: TokenSecurityReview = { version: 2, ...clock, reviewId: "synthetic-review", assetId,
    publisherId: "etherauthority", components: observation.components,
    fingerprint: tokenSecurityFingerprint(observation), reportUrl: `https://raw.githubusercontent.com/EtherAuthority/Audit/${"a".repeat(40)}/synthetic-review.pdf`,
    reportDigest: "d".repeat(64), coverage: Object.fromEntries(SECURITY_AREAS.map(a => [a, "clear"])) as TokenSecurityReview["coverage"] };
  return assessTokenSecurity({ assetId, observation, review,
    reviewArtifact: { ...clock, reviewId: review.reviewId, publisherId: review.publisherId!, reportUrl: review.reportUrl,
      expectedDigest: review.reportDigest, observedDigest: review.reportDigest, state: "verified" },
    providers: ["binance", "goplus"].map(provider => ({ ...clock, provider: provider as "binance" | "goplus",
      assetId, state: "clear" as const, findings: [], digest: "e".repeat(64),
      coverage: Object.fromEntries((provider === "binance" ? BINANCE_COVERAGE_FIELDS : GOPLUS_COVERAGE_FIELDS)
        .map(field => [field, "covered" as const])) })),
    now: "2026-09-28T14:00:00.000Z", maxAgeMs: 120_000 });
}
