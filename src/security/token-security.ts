import { createHash } from "node:crypto";
import { BSTOCKS_WALLET_PROFILES } from "./bstocks-governance.js";
import { reviewedSourcePin } from "./reviewed-source-pins.js";
import { trustedReviewPublication } from "./review-publishers.js";

export const SECURITY_AREAS = ["transfers-and-taxes", "balances-and-supply",
  "upgrades-and-delegation", "privileged-authority", "external-controls"] as const;
export type SecurityArea = typeof SECURITY_AREAS[number];
export type SecurityState = "clear" | "risk" | "unsupported" | "unavailable";
export interface SecurityClock { readonly observedAt: string; readonly expiresAt: string }
export interface ProviderSecurity extends SecurityClock {
  readonly provider: "binance" | "goplus";
  readonly assetId: string;
  readonly state: SecurityState;
  readonly findings: readonly string[];
  readonly digest: string;
  /** Explicit provider coverage is independent of a positive risk finding. */
  readonly coverage?: Readonly<Record<string, "covered" | "unknown">>;
}
export interface SecurityComponent {
  readonly address: string;
  readonly codeHash: string;
  readonly sourceDigest: string | null;
}
export interface SecurityGovernance {
  readonly profile: "bstocks-operator-wallet-v1" | "bstocks-burn-wallet-v1";
  readonly address: string;
  readonly codeHash: string;
  readonly implementation: string;
  readonly implementationCodeHash: string;
  readonly admin: string;
  readonly owner: string;
  readonly pendingOwner: string;
  readonly initialized: boolean;
  readonly operator: string | null;
  readonly paused: boolean | null;
  readonly hotWallets: readonly string[];
}
export interface TokenSecurityObservation extends SecurityClock {
  readonly profile: "runtime-owner-v1" | "bstocks-beacon-v1";
  readonly source: string;
  readonly assetId: string;
  readonly decimals: number;
  readonly sourceBlock: bigint;
  readonly sourceBlockHash: string;
  readonly components: readonly SecurityComponent[];
  /** Runtime pins detect a privileged EOA acquiring delegated execution code. */
  readonly authorities: readonly { readonly address: string; readonly codeHash: string }[];
  readonly governance?: readonly SecurityGovernance[];
  /** Canonical current owners, role sets, switches, mappings and control pointers. */
  readonly controls: Readonly<Record<string, string | boolean>>;
  readonly paused: boolean;
  readonly pendingChange: boolean;
}
/** Loaded from trusted, versioned configuration, never from a browser declaration. */
export interface TokenSecurityReview extends SecurityClock {
  readonly version: 1 | 2;
  readonly reviewId: string;
  readonly assetId: string;
  readonly fingerprint: string;
  readonly reportUrl: string;
  readonly reportDigest: string;
  readonly coverage: Readonly<Record<SecurityArea, "clear" | "risk" | "unknown">>;
  readonly publisherId?: string;
  readonly components?: readonly SecurityComponent[];
}
export interface SecurityReviewArtifact extends SecurityClock {
  readonly reviewId: string;
  readonly publisherId: string | null;
  readonly reportUrl: string;
  readonly expectedDigest: string;
  readonly observedDigest: string | null;
  readonly state: "verified" | "unsupported" | "unavailable" | "mismatch";
}
export interface TokenSecurityEvidence {
  readonly assetId: string;
  readonly observation: TokenSecurityObservation | null;
  readonly providers: readonly ProviderSecurity[];
  readonly review: TokenSecurityReview | null;
  readonly reviewArtifact?: SecurityReviewArtifact | null;
  readonly state: SecurityState;
  readonly reasons: readonly string[];
  readonly evidenceHash: string;
}
const record = (x: unknown): Record<string, unknown> | null =>
  x !== null && typeof x === "object" && !Array.isArray(x) ? x as Record<string, unknown> : null;
const canonical = (x: unknown): unknown => typeof x === "bigint" ? x.toString()
  : Array.isArray(x) ? x.map(canonical) : record(x)
    ? Object.fromEntries(Object.entries(x as object).sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0)
      .map(([k, v]) => [k, canonical(v)])) : x;
export const securityDigest = (x: unknown): string =>
  createHash("sha256").update(JSON.stringify(canonical(x))).digest("hex");
const hash = (x: unknown): x is string => typeof x === "string" && /^[0-9a-f]{64}$/.test(x);
const codeHash = (x: unknown): x is string => typeof x === "string" && /^0x[0-9a-f]{64}$/.test(x);
const address = (x: unknown): x is string => typeof x === "string"
  && /^0x[0-9a-f]{40}$/.test(x) && !/^0x0{40}$/.test(x);
const asset = (x: unknown): x is string => typeof x === "string"
  && /^eip155:56\/erc20:0x[0-9a-f]{40}$/.test(x) && address(x.split(":").at(-1));
const at = (x: unknown): number => typeof x === "string"
  && /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d+)?(?:Z|[+-]\d\d:\d\d)$/.test(x) ? Date.parse(x) : NaN;
const fresh = (x: SecurityClock, now: number, age: number): boolean =>
  Number.isFinite(at(x.observedAt)) && Number.isFinite(at(x.expiresAt))
  && at(x.observedAt) <= now && now < at(x.expiresAt)
  && at(x.expiresAt) > at(x.observedAt) && now - at(x.observedAt) <= age;
const https = (x: string): boolean => {
  try { const u = new URL(x); return u.protocol === "https:" && !!u.hostname
    && !u.username && !u.password && !u.hash; } catch { return false; }
};
const keys = (x: object, expected: readonly string[]): boolean =>
  Object.keys(x).length === expected.length && expected.every(k => Object.hasOwn(x, k));

export const BINANCE_COVERAGE_FIELDS = ["riskLevel", "buyTax", "sellTax", "riskAlert",
  "CONTRACT_RISK", "TRADE_RISK", "SCAM_RISK"] as const;

/** Unsupported responses deliberately discard their unreliable risk fields. */
export function normalizeBinanceAudit(payload: unknown, assetId: string,
  clock: SecurityClock): ProviderSecurity {
  const root = record(payload), data = record(root?.data);
  const findings: string[] = [];
  const coverage: Record<string, "covered" | "unknown"> = Object.fromEntries(BINANCE_COVERAGE_FIELDS.map(k => [k, "unknown"]));
  let state: SecurityState = "unavailable";
  if (root?.success === true && root.code === "000000" && data) {
    state = "unsupported";
    if (data.hasResult === true && data.isSupported === true) {
      let complete = Number.isInteger(data.riskLevel) && Number(data.riskLevel) >= 0
        && Number(data.riskLevel) <= 5;
      if (complete) coverage.riskLevel = "covered";
      if (complete && Number(data.riskLevel) > 1) findings.push("risk-level-above-low");
      const info = record(data.extraInfo);
      for (const field of ["buyTax", "sellTax"] as const) {
        const v = info?.[field];
        if (typeof v !== "string" || !/^\d+(?:\.\d+)?$/.test(v)) complete = false;
        else { coverage[field] = "covered"; if (/[1-9]/.test(v)) findings.push(`${field}-nonzero`); }
      }
      const groups = Array.isArray(data.riskItems) ? data.riskItems : [];
      for (const category of ["CONTRACT_RISK", "TRADE_RISK", "SCAM_RISK"]) {
        const matches = groups.filter(g => record(g)?.id === category);
        const details = record(matches[0])?.details;
        if (matches.length !== 1 || !Array.isArray(details) || details.length === 0
          || !details.every(item => { const f = record(item); return f && typeof f.title === "string"
            && !!f.title.trim() && typeof f.isHit === "boolean" && ["RISK", "CAUTION"].includes(String(f.riskType)); }))
          complete = false;
        else coverage[category] = "covered";
      }
      for (const group of groups) {
        const g = record(group);
        if (!g || !Array.isArray(g.details)) { complete = false; continue; }
        for (const item of g.details) {
          const f = record(item);
          if (!f || typeof f.title !== "string" || !f.title.trim()
            || typeof f.isHit !== "boolean" || !["RISK", "CAUTION"].includes(String(f.riskType))) {
            complete = false; continue;
          }
          if (f.isHit) findings.push(`${g.id}:${f.riskType}:${f.title}`);
        }
      }
      if (groups.length === 0) complete = false;
      if (Object.hasOwn(data, "riskAlert")) coverage.riskAlert = "covered"; else complete = false;
      if (data.riskAlert != null) { findings.push("provider-risk-alert"); }
      state = findings.length ? "risk" : complete ? "clear" : "unsupported";
    }
  }
  return { provider: "binance", assetId, ...clock, state, findings, coverage,
    digest: securityDigest(state === "unsupported" || state === "unavailable"
      ? { state, coverage } : { riskLevel: data?.riskLevel, extraInfo: data?.extraInfo, riskItems: data?.riskItems,
        riskAlert: data?.riskAlert, coverage }) };
}

export const GOPLUS_RISK_FIELDS = ["is_honeypot", "cannot_buy", "cannot_sell_all",
  "owner_change_balance", "hidden_owner", "can_take_back_ownership", "selfdestruct",
  "slippage_modifiable", "personal_slippage_modifiable", "is_blacklisted",
  "is_whitelisted", "transfer_pausable", "trading_cooldown", "is_anti_whale",
  "anti_whale_modifiable", "is_mintable", "external_call", "honeypot_with_same_creator"] as const;
export const GOPLUS_COVERAGE_FIELDS = [...GOPLUS_RISK_FIELDS, "is_open_source", "is_proxy", "buy_tax", "sell_tax"] as const;
export function normalizeGoPlusAudit(payload: unknown, assetId: string,
  clock: SecurityClock): ProviderSecurity {
  const root = record(payload), result = record(root?.result);
  const data = record(result?.[assetId.split(":").at(-1)!]);
  const findings: string[] = [];
  let complete = root?.code === 1 && !!data;
  const selected: Record<string, unknown> = {};
  const coverage: Record<string, "covered" | "unknown"> = Object.fromEntries(GOPLUS_COVERAGE_FIELDS.map(k => [k, "unknown"]));
  for (const key of GOPLUS_COVERAGE_FIELDS) {
    const v = data?.[key]; selected[key] = v ?? null;
    if (key === "buy_tax" || key === "sell_tax") {
      if (typeof v !== "string" || !/^\d+(?:\.\d+)?$/.test(v)) complete = false;
      else { if (root?.code === 1) coverage[key] = "covered"; if (/[1-9]/.test(v)) findings.push(`${key}-nonzero`); }
    } else if (v !== "0" && v !== "1") complete = false;
    else {
      if (root?.code === 1) coverage[key] = "covered";
      if ((key === "is_open_source" && v === "0")
        || (key !== "is_proxy" && key !== "is_open_source" && v === "1")) findings.push(key);
    }
  }
  // A failed envelope cannot turn its embedded result into valid evidence.
  const state = root?.code !== 1 ? "unavailable"
    : findings.length ? "risk" : complete ? "clear" : "unsupported";
  return { provider: "goplus", assetId, ...clock, state, coverage,
    findings: state === "unavailable" ? [] : findings,
    digest: securityDigest(state === "unavailable" ? { state, coverage } : { selected, coverage }) };
}

/** Excludes observation clocks/block; binds the entire executable/control/source surface. */
export function tokenSecurityFingerprint(observation: TokenSecurityObservation): string {
  return securityDigest({ assetId: observation.assetId, decimals: observation.decimals,
    profile: observation.profile,
    components: [...observation.components].sort((a, b) => a.address < b.address ? -1 : a.address > b.address ? 1 : 0),
    authorities: [...observation.authorities].sort((a, b) => a.address < b.address ? -1 : a.address > b.address ? 1 : 0),
    controls: observation.controls, governance: observation.governance ?? [] });
}
export function parseTokenSecurityReviews(payload: unknown): readonly TokenSecurityReview[] {
  const root = record(payload);
  if (!root || !keys(root, ["version", "reviews"]) || root.version !== 1
    || !Array.isArray(root.reviews)) throw new Error("Invalid token security review registry.");
  const seen = new Set<string>();
  return root.reviews.map((item: unknown) => {
    const r = record(item), coverage = record(r?.coverage);
    if (!r || !keys(r, ["version", "reviewId", "assetId", "fingerprint", "reportUrl", "reportDigest",
      "coverage", "observedAt", "expiresAt", ...(r.version === 2 ? ["publisherId", "components"] : [])])
      || (r.version !== 1 && r.version !== 2)
      || typeof r.reviewId !== "string" || !r.reviewId.trim() || !asset(r.assetId)
      || seen.has(r.assetId) || !hash(r.fingerprint) || !hash(r.reportDigest)
      || typeof r.reportUrl !== "string" || !https(r.reportUrl) || !coverage
      || !keys(coverage, SECURITY_AREAS)
      || !Object.values(coverage).every(v => ["clear", "risk", "unknown"].includes(String(v)))
      || !Number.isFinite(at(r.observedAt)) || !Number.isFinite(at(r.expiresAt))
      || at(r.expiresAt) <= at(r.observedAt)
      || at(r.expiresAt) - at(r.observedAt) > 86_400_000) throw new Error("Invalid token security review.");
    if (r.version === 2 && (!trustedReviewPublication(r.publisherId, r.reportUrl)
      || !Array.isArray(r.components) || !r.components.length
      || new Set(r.components.map(c => record(c)?.address)).size !== r.components.length
      || !r.components.every(c => { const component = record(c); return component
        && keys(component, ["address", "codeHash", "sourceDigest"]) && address(component.address)
        && codeHash(component.codeHash) && hash(component.sourceDigest); })))
      throw new Error("Invalid independent token security review.");
    seen.add(r.assetId);
    return Object.freeze({ ...r, coverage: Object.freeze({ ...coverage }), ...(r.version === 2
      ? { components: Object.freeze((r.components as object[]).map(c => Object.freeze({ ...c }))) } : {}) }) as unknown as TokenSecurityReview;
  });
}
export function assessTokenSecurity(input: {
  readonly assetId: string; readonly observation: TokenSecurityObservation | null;
  readonly providers: readonly ProviderSecurity[]; readonly review: TokenSecurityReview | null;
  readonly reviewArtifact?: SecurityReviewArtifact | null;
  readonly now: string; readonly maxAgeMs: number;
}): TokenSecurityEvidence {
  const { assetId, observation: o, providers, review: r } = input;
  const now = at(input.now), reasons: string[] = [];
  let state: SecurityState = "clear";
  const fail = (reason: string, result: SecurityState = "unsupported"): void => {
    reasons.push(reason);
    if (result === "risk" || state !== "risk") state = result;
  };
  if (!asset(assetId) || !Number.isFinite(now) || !Number.isSafeInteger(input.maxAgeMs)
    || input.maxAgeMs <= 0) fail("invalid-input", "unavailable");
  if (!o || o.assetId !== assetId || !o.source || !fresh(o, now, input.maxAgeMs)
    || typeof o.sourceBlock !== "bigint" || o.sourceBlock < 0n || !codeHash(o.sourceBlockHash)
    || !Number.isInteger(o.decimals) || o.decimals < 0 || o.decimals > 36
    || !o.components.length || !o.components.some(c => c.address === assetId.split(":").at(-1))
    || new Set(o.components.map(c => c.address)).size !== o.components.length
    || !o.components.every(c => address(c.address) && codeHash(c.codeHash))
    || !Object.keys(o.controls).length
    || !Object.values(o.controls).every(v => typeof v === "boolean" || (typeof v === "string" && !!v)))
    fail("onchain-evidence-unavailable", "unavailable");
  if (o) {
    if ((assetId === "eip155:56/erc20:0x02fca66c1d1afb4e2a7884261eb00f63598a7436" && o.profile !== "bstocks-beacon-v1")
      || (assetId === "eip155:56/erc20:0x55d398326f99059ff775485246999027b3197955" && o.profile !== "runtime-owner-v1"))
      fail("wrong-token-security-profile");
    const required = o.profile === "runtime-owner-v1" ? [assetId.split(":").at(-1)]
      : o.profile === "bstocks-beacon-v1"
        ? [assetId.split(":").at(-1), o.controls.beacon, o.controls.implementation,
          o.controls.compliance, o.controls.pauseManager,
          ...(o.governance ?? []).flatMap(g => [g.address, g.implementation])] : [];
    if (!required.length || required.some(a => !address(a))
      || required.length !== new Set(required).size || required.length !== o.components.length
      || required.some(a => !o.components.some(c => c.address === a))) fail("execution-closure-incomplete");
    const emptyCodeHash = "0xc5d2460186f7233c927e7db2dcc703c0e500b653ca82273b7bfad8045d85a470";
    if (!o.authorities.length || new Set(o.authorities.map(a => a.address)).size !== o.authorities.length
      || !o.authorities.every(a => address(a.address) && codeHash(a.codeHash))
      || !o.authorities.some(a => a.address === (o.profile === "runtime-owner-v1" ? o.controls.owner : o.controls.beaconOwner)))
      fail("authority-coverage-incomplete");
    const governance = o.governance ?? [];
    if (o.authorities.some(a => a.codeHash !== emptyCodeHash
      && !(o.profile === "bstocks-beacon-v1" && governance.some(g => g.address === a.address
        && g.codeHash === a.codeHash && reviewedSourcePin(g.address, g.codeHash)))))
      fail("contract-or-delegated-authority-unresolved");
    if (o.profile === "runtime-owner-v1" && (!address(o.controls.owner)
      || o.controls.beaconSlot !== `0x${"0".repeat(64)}`
      || o.controls.implementationSlot !== `0x${"0".repeat(64)}`)) fail("owner-controls-incomplete");
    if (o.profile === "bstocks-beacon-v1") {
      if (governance.length !== BSTOCKS_WALLET_PROFILES.length
        || new Set(governance.map(g => g.address)).size !== governance.length)
        fail("governance-coverage-incomplete");
      for (const profile of BSTOCKS_WALLET_PROFILES) {
        const g = governance.find(item => item.address === profile.address);
        const proxy = g && reviewedSourcePin(g.address, g.codeHash);
        const implementation = g && reviewedSourcePin(g.implementation, g.implementationCodeHash);
        if (!g || g.profile !== profile.profile || g.implementation !== profile.implementation
          || proxy?.certificate.contractName !== "UpgradeableProxy"
          || implementation?.certificate.contractName !== profile.name || g.initialized !== true
          || !address(g.admin) || !address(g.owner)
          || (g.pendingOwner !== `0x${"0".repeat(40)}` && !address(g.pendingOwner))
          || !o.authorities.some(a => a.address === g.address && a.codeHash === g.codeHash)
          || ![proxy, implementation].every(pin => pin && o.components.some(c =>
            c.address === pin.address && c.codeHash === pin.codeHash && c.sourceDigest === pin.sourceDigest))) {
          fail("governance-identity-or-source-incomplete"); continue;
        }
        const controllers = [g.owner, g.admin, ...(g.operator ? [g.operator] : []),
          ...(address(g.pendingOwner) ? [g.pendingOwner] : [])];
        if (controllers.some(controller => !o.authorities.some(a => a.address === controller && a.codeHash === emptyCodeHash)))
          fail("governance-controller-delegation-unresolved");
        if (g.profile === "bstocks-operator-wallet-v1") {
          if (!address(g.operator) || typeof g.paused !== "boolean" || !Array.isArray(g.hotWallets)
            || g.hotWallets.length > 64 || new Set(g.hotWallets).size !== g.hotWallets.length
            || !g.hotWallets.every(address)) fail("governance-operator-controls-incomplete");
          if (g.paused === true) fail("governance-paused", "risk");
        } else if (g.operator !== null || g.paused !== null || g.hotWallets.length !== 0)
          fail("governance-burn-controls-incomplete");
        if (address(g.pendingOwner)) fail("governance-owner-change-pending", "risk");
      }
      for (const key of ["tokenCodeHash", "beaconCodeHash", "implementationCodeHash",
        "complianceCodeHash", "pauseManagerCodeHash", "adminMembersHash", "issuerMembersHash",
        "complianceAdminMembersHash", "complianceOpsMembersHash", "complianceMembersHash",
        "pauseAdminMembersHash", "pauseOpsMembersHash"]) if (!codeHash(o.controls[key])) fail(`control-${key}-unknown`);
      if (!address(o.controls.beaconOwner) || typeof o.controls.mintEnabled !== "boolean"
        || typeof o.controls.burnEnabled !== "boolean" || typeof o.controls.uiMultiplier !== "string"
        || !/^[1-9][0-9]*$/.test(o.controls.uiMultiplier)) fail("privileged-controls-incomplete");
      for (const [pointer, digestKey] of [["token", "tokenCodeHash"], ["beacon", "beaconCodeHash"],
        ["implementation", "implementationCodeHash"], ["compliance", "complianceCodeHash"],
        ["pauseManager", "pauseManagerCodeHash"]] as const)
        if (!o.components.some(c => c.address === o.controls[pointer] && c.codeHash === o.controls[digestKey]))
          fail("control-code-identity-mismatch");
    }
    if (o.components.some(c => !hash(c.sourceDigest))) fail("source-closure-incomplete");
    if (o.paused === true || o.pendingChange === true) fail("paused-or-pending-change", "risk");
    if (typeof o.paused !== "boolean" || typeof o.pendingChange !== "boolean") fail("invalid-control-state");
  }
  if (providers.length !== 2 || new Set(providers.map(p => p.provider)).size !== 2)
    fail("provider-coverage-incomplete");
  for (const provider of ["binance", "goplus"] as const) {
    const p = providers.find(item => item.provider === provider);
    if (!p || p.assetId !== assetId || !fresh(p, now, input.maxAgeMs) || !hash(p.digest))
      fail(`${provider}-unavailable`, "unavailable");
    else if (p.state !== "clear" || p.findings.length)
      fail(`${provider}-${p.state}`, p.state === "risk" || p.findings.length ? "risk" : "unsupported");
    const expected = provider === "binance" ? BINANCE_COVERAGE_FIELDS : GOPLUS_COVERAGE_FIELDS;
    if (!p?.coverage || !keys(p.coverage, expected) || !expected.every(key => p.coverage?.[key] === "covered"))
      fail(`${provider}-coverage-incomplete`);
  }
  let reviewValid = false;
  if (r) {
    try { parseTokenSecurityReviews({ version: 1, reviews: [r] }); reviewValid = true; } catch { /* blocked */ }
  }
  if (!reviewValid || !r || r.assetId !== assetId || !fresh(r, now, 86_400_000))
    fail("contract-scope-review-missing-or-expired");
  else {
    if (!o || r.fingerprint !== tokenSecurityFingerprint(o)) fail("reviewed-controls-changed");
    if (r.version !== 2) fail("independent-review-provenance-missing");
    else {
      const sort = (list: readonly SecurityComponent[]) => [...list].sort((a, b) => a.address < b.address ? -1 : a.address > b.address ? 1 : 0);
      if (!o || !r.components || securityDigest(sort(r.components)) !== securityDigest(sort(o.components)))
        fail("independent-review-source-scope-incomplete");
      const a = input.reviewArtifact;
      if (!a || !fresh(a, now, input.maxAgeMs) || a.state !== "verified"
        || a.reviewId !== r.reviewId || a.publisherId !== r.publisherId || a.reportUrl !== r.reportUrl
        || a.expectedDigest !== r.reportDigest || a.observedDigest !== r.reportDigest
        || !trustedReviewPublication(a.publisherId, a.reportUrl)) fail("independent-review-artifact-unverified");
    }
    for (const area of SECURITY_AREAS) if (r.coverage[area] !== "clear")
      fail(`review-${area}-${r.coverage[area]}`, r.coverage[area] === "risk" ? "risk" : "unsupported");
  }
  const result = { assetId, observation: o, providers, review: r, reviewArtifact: input.reviewArtifact ?? null, state, reasons };
  return { ...result, evidenceHash: securityDigest(result) };
}

/** Recompute, rather than trusting a caller's state/hash. Both route assets are mandatory. */
export function verifyTokenSecurityBundle(input: {
  readonly bundle: readonly TokenSecurityEvidence[] | null | undefined;
  readonly assets: readonly { readonly assetId: string; readonly decimals: number }[];
  readonly sourceBlock: bigint; readonly now: string; readonly maxAgeMs: number;
}): boolean {
  try {
    const b = input.bundle;
    if (!b || b.length !== input.assets.length || new Set(b.map(x => x.assetId)).size !== b.length) return false;
    let blockHash: string | undefined;
    for (const asset of input.assets) {
      const report = b.find(x => x.assetId === asset.assetId);
      if (!report || report.observation?.sourceBlock !== input.sourceBlock
        || report.observation.decimals !== asset.decimals) return false;
      if (blockHash && blockHash !== report.observation.sourceBlockHash) return false;
      blockHash = report.observation.sourceBlockHash;
      const assessed = assessTokenSecurity({ ...report, now: input.now, maxAgeMs: input.maxAgeMs });
      if (assessed.state !== "clear" || report.state !== "clear"
        || assessed.evidenceHash !== report.evidenceHash) return false;
    }
    return true;
  } catch { return false; }
}
