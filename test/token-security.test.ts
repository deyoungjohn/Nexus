import assert from "node:assert/strict";
import test from "node:test";
import { keccak256 } from "ethers";
import { assessTokenSecurity, GOPLUS_RISK_FIELDS, normalizeBinanceAudit, normalizeGoPlusAudit,
  parseTokenSecurityReviews, securityDigest, tokenSecurityFingerprint, verifyTokenSecurityBundle } from "../src/security/token-security.js";
import { BSC_USDT, collectBscTokenSecurity, fetchSecuritySourceDigest } from "../src/security/bsc-token-security.js";
import { BSTOCKS_BSC_NVDAB } from "../src/market-gate/bstocks-bsc.js";
import { evaluateMarketGate } from "../src/market-gate/gate.js";
import { eoaApprovalTypedData, prepareEoaLegApproval, verifyEoaLegApproval } from "../src/execution/eoa.js";
import { Wallet } from "ethers";
import { fixture } from "./market-gate.test.js";
import { syntheticTokenSecurity } from "./token-security-fixture.js";
import { collectorMock } from "./security-collector-fixture.js";

const now = "2026-09-28T14:00:00.000Z";
const base = syntheticTokenSecurity(`eip155:56/erc20:${BSC_USDT}`);
const clock = { observedAt: now, expiresAt: "2026-09-28T14:01:00.000Z" };
const binancePayload = () => ({ code: "000000", success: true, data: { hasResult: true,
  isSupported: true, riskLevel: 1, riskAlert: null, extraInfo: { buyTax: "0", sellTax: "0" },
  riskItems: ["CONTRACT_RISK", "TRADE_RISK", "SCAM_RISK"].map(id => ({ id,
    details: [{ title: "Synthetic covered check", isHit: false, riskType: "RISK" }] })) } });
const goPayload = (): { code: number; result: Record<string, Record<string, string>> } => ({ code: 1, result: { [BSC_USDT]: {
  ...Object.fromEntries(GOPLUS_RISK_FIELDS.map(f => [f, "0"])), is_open_source: "1", is_proxy: "0",
  buy_tax: "0", sell_tax: "0" } } });
const assess = (change: Partial<Parameters<typeof assessTokenSecurity>[0]> = {}) =>
  assessTokenSecurity({ ...base, now, maxAgeMs: 120_000, ...change });

test("P5.5d unsupported Binance flags suppress misleading risk fields", () => {
  const payload = binancePayload();
  payload.data.hasResult = false; payload.data.riskLevel = 5;
  payload.data.riskItems[0]!.details[0]!.isHit = true;
  const unsupported = normalizeBinanceAudit(payload, base.assetId, clock);
  assert.equal(unsupported.state, "unsupported"); assert.deepEqual(unsupported.findings, []);
  payload.data.hasResult = true; payload.data.isSupported = false;
  assert.equal(normalizeBinanceAudit(payload, base.assetId, clock).state, "unsupported");
  assert.equal(normalizeBinanceAudit({ ...payload, success: false }, base.assetId, clock).state, "unavailable");
});
test("P5.5d complete Binance checks distinguish risks from missing coverage", () => {
  assert.equal(normalizeBinanceAudit(binancePayload(), base.assetId, clock).state, "clear");
  const missing = binancePayload(); missing.data.riskItems.pop();
  assert.equal(normalizeBinanceAudit(missing, base.assetId, clock).state, "unsupported");
  const hit = binancePayload(); hit.data.riskItems[0]!.details[0]!.isHit = true;
  assert.equal(normalizeBinanceAudit(hit, base.assetId, clock).state, "risk");
  const high = binancePayload(); high.data.riskLevel = 3;
  assert.equal(normalizeBinanceAudit(high, base.assetId, clock).state, "risk");
  const tax = binancePayload(); tax.data.extraInfo.buyTax = "0.0000000001";
  assert.equal(normalizeBinanceAudit(tax, base.assetId, clock).state, "risk");
  tax.data.extraInfo.buyTax = "unknown";
  assert.equal(normalizeBinanceAudit(tax, base.assetId, clock).state, "unsupported");
});
test("P5.5d GoPlus missing flags and mint authority never become clean", () => {
  assert.equal(normalizeGoPlusAudit(goPayload(), base.assetId, clock).state, "clear");
  const missing = goPayload(); delete (missing.result[BSC_USDT] as Record<string, unknown>).hidden_owner;
  assert.equal(normalizeGoPlusAudit(missing, base.assetId, clock).state, "unsupported");
  const mint = goPayload(); mint.result[BSC_USDT]!.is_mintable = "1";
  assert.equal(normalizeGoPlusAudit(mint, base.assetId, clock).state, "risk");
  assert.equal(normalizeGoPlusAudit({ ...mint, code: 0 }, base.assetId, clock).state, "unavailable");
  const proxy = goPayload(); proxy.result[BSC_USDT]!.is_proxy = "1";
  assert.equal(normalizeGoPlusAudit(proxy, base.assetId, clock).state, "clear"); // Proxy source/control review is separate.
});
test("P5.5d full-token assessment requires independent review and full source closure", () => {
  assert.equal(assess().state, "clear");
  assert.equal(assess({ now: "2026-09-28T15:00:00+01:00" }).state, "clear");
  assert.notEqual(assess({ review: null }).state, "clear");
  const o = base.observation!;
  assert.notEqual(assess({ observation: { ...o, components: [{ ...o.components[0]!, sourceDigest: null }] } }).state, "clear");
  assert.equal(assess({ observation: { ...o, paused: true } }).state, "risk");
  assert.equal(assess({ observation: { ...o, pendingChange: true } }).state, "risk");
  assert.notEqual(assess({ providers: [base.providers[0]!, base.providers[0]!] }).state, "clear");
  assert.notEqual(assess({ providers: [{ ...base.providers[0]!, observedAt: "2026-09-28T13:00:00.000Z" }, base.providers[1]!] }).state, "clear");
  assert.notEqual(assess({ review: { ...base.review!, coverage: { ...base.review!.coverage,
    "privileged-authority": "unknown" } } }).state, "clear");
});
test("P5.5d owner, code, roles and source changes invalidate the reviewed fingerprint", () => {
  const o = base.observation!;
  for (const changed of [{ ...o, controls: { ...o.controls, owner: "0x1111111111111111111111111111111111111112" } },
    { ...o, controls: { ...o.controls, roleMembersHash: `0x${"f".repeat(64)}` } },
    { ...o, components: [{ ...o.components[0]!, codeHash: `0x${"f".repeat(64)}` }] },
    { ...o, components: [{ ...o.components[0]!, sourceDigest: "f".repeat(64) }] }])
    assert.ok(assess({ observation: changed }).reasons.includes("reviewed-controls-changed"));
  assert.equal(tokenSecurityFingerprint({ ...o, sourceBlock: o.sourceBlock + 1n }), tokenSecurityFingerprint(o));
});
test("P5.5d privileged account delegation is detected and unresolved governance blocks", () => {
  const o = base.observation!;
  const changed = { ...o, authorities: [{ ...o.authorities[0]!, codeHash: `0x${"f".repeat(64)}` }] };
  assert.ok(assess({ observation: changed }).reasons.includes("reviewed-controls-changed"));
  assert.ok(assess({ observation: changed, review: { ...base.review!, fingerprint: tokenSecurityFingerprint(changed) } })
    .reasons.includes("contract-or-delegated-authority-unresolved"));
  assert.notEqual(assess({ observation: { ...o, authorities: [] } }).state, "clear");
  const stock = syntheticTokenSecurity(`eip155:56/erc20:${BSTOCKS_BSC_NVDAB}`);
  assert.equal(stock.state, "clear");
  const wrongProfile = { ...stock.observation!, profile: "runtime-owner-v1" as const };
  assert.ok(assessTokenSecurity({ ...stock, observation: wrongProfile, review: { ...stock.review!,
    fingerprint: tokenSecurityFingerprint(wrongProfile) }, now, maxAgeMs: 120_000 }).reasons.includes("wrong-token-security-profile"));
});
test("P5.5d trusted review registry rejects extra fields, duplicates and long-lived claims", () => {
  assert.equal(parseTokenSecurityReviews({ version: 1, reviews: [base.review] }).length, 1);
  for (const reviews of [[{ ...base.review, approved: true }], [base.review, base.review],
    [{ ...base.review, expiresAt: "2026-09-30T14:00:00.000Z" }],
    [{ ...base.review, reportUrl: "https://user:secret@review.example/report" }],
    [{ ...base.review, coverage: {} }], [{ ...base.review, reportDigest: "" }]])
    assert.throws(() => parseTokenSecurityReviews({ version: 1, reviews }));
});
test("P5.5d a legacy clear label cannot pass without both route-token reports", () => {
  const f = fixture();
  assert.equal(evaluateMarketGate(f).allowed, true);
  for (const tokenSecurity of [null, [], [f.evidence.tokenSecurity![0]!],
    [f.evidence.tokenSecurity![0]!, f.evidence.tokenSecurity![0]!]]) {
    assert.deepEqual(evaluateMarketGate({ ...f, evidence: { ...f.evidence, tokenSecurity } }),
      { allowed: false, reason: "TOKEN_SECURITY_BLOCKED" });
  }
  assert.equal(verifyTokenSecurityBundle({ bundle: f.evidence.tokenSecurity!,
    assets: [{ assetId: f.instrument.assetId, decimals: 18 }, { assetId: f.snapshot.confirmedCash.assetId, decimals: 18 }],
    sourceBlock: 102n, now, maxAgeMs: 120_000 }), false);
});
test("P5.5d forged clear state, wrong chain/decimals/block and stale reviews block", () => {
  const f = fixture(), reports = f.evidence.tokenSecurity!, stock = reports[0]!;
  const bad = assessTokenSecurity({ ...stock, providers: [{ ...stock.providers[0]!, state: "unsupported" }, stock.providers[1]!],
    now, maxAgeMs: 120_000 });
  const wrong = [ { ...bad, state: "clear" as const }, { ...stock, evidenceHash: "0".repeat(64) },
    { ...stock, observation: { ...stock.observation!, decimals: 6 } },
    { ...stock, observation: { ...stock.observation!, sourceBlockHash: `0x${"f".repeat(64)}` } },
    { ...stock, assetId: stock.assetId.replace("56", "1") },
    { ...stock, review: { ...stock.review!, expiresAt: now } } ];
  for (const s of wrong) assert.equal(evaluateMarketGate({ ...f, evidence: { ...f.evidence,
    tokenSecurity: [s, reports[1]!] } }).allowed, false);
});
test("P5.5d proxy review cannot omit executable dependencies or privileged roles", () => {
  const o = { ...base.observation!, profile: "bstocks-beacon-v1" as const };
  const result = assess({ observation: o, review: { ...base.review!, fingerprint: tokenSecurityFingerprint(o) } });
  assert.notEqual(result.state, "clear");
  assert.ok(result.reasons.includes("execution-closure-incomplete"));
  assert.ok(result.reasons.includes("control-issuerMembersHash-unknown"));
});
test("P5.5d source verification matches exact deployed code, not a name or address claim", async () => {
  const component = { address: BSC_USDT, codeHash: keccak256("0x6000") };
  const payload = { runtimeMatch: "exact_match", runtimeBytecode: { onchainBytecode: "0x6000" },
    sources: { "Token.sol": { content: "contract Token {}" } }, compilation: { compiler: "solc" } };
  const fetcher = (data: unknown): typeof fetch => (async () => new Response(JSON.stringify(data))) as typeof fetch;
  assert.match((await fetchSecuritySourceDigest(component, fetcher(payload)))!, /^[0-9a-f]{64}$/);
  assert.equal(await fetchSecuritySourceDigest({ ...component, codeHash: keccak256("0x6001") }, fetcher(payload)), null);
  assert.equal(await fetchSecuritySourceDigest(component, fetcher({ ...payload, sources: {} })), null);
  assert.equal(await fetchSecuritySourceDigest(component, fetcher({ ...payload, runtimeMatch: null })), null);
});

const apiClock = "2026-09-27T15:00:02.000Z";
test("P5.5d read-only collector binds both tokens and all five stock components to one canonical block", async () => {
  const { fetcher, refs } = collectorMock({ missingBeaconSource: true });
  const result = await collectBscTokenSecurity({ rpcUrl: "https://example.invalid/rpc", maxAgeMs: 60_000, now: apiClock, reviews: [] }, fetcher);
  assert.equal(result.length, 2);
  assert.equal(result[0]!.observation!.sourceBlock, result[1]!.observation!.sourceBlock);
  assert.equal(result[1]!.observation!.components.length, 5);
  assert.equal(result[1]!.observation!.components.filter(c => !c.sourceDigest).length, 1);
  assert.ok(result[1]!.reasons.includes("source-closure-incomplete"));
  assert.ok(refs.every(ref => securityDigest(ref) === securityDigest({ blockHash: `0x${"a".repeat(64)}`, requireCanonical: true })));
  assert.ok(result.every(e => e.state !== "clear"));
});
test("P5.5d wrong chain and a reorg after scanner reads invalidate both observations", async () => {
  for (const options of [{ wrongChain: true }, { reorg: true }]) {
    const result = await collectBscTokenSecurity({ rpcUrl: "https://example.invalid/rpc", maxAgeMs: 60_000, now: apiClock,
      reviews: [] }, collectorMock(options).fetcher);
    assert.ok(result.every(e => e.observation === null && e.state !== "clear"));
  }
});
test("P5.5d a head mined during RPC retrieval is judged against receipt time", async () => {
  const mock = collectorMock(); let blockSeconds: bigint | undefined;
  const fetcher = (async (url, init) => {
    const body = init?.body ? JSON.parse(String(init.body)) : null;
    const response = await mock.fetcher(url, init);
    if (body?.method !== "eth_getBlockByNumber") return response;
    if (blockSeconds === undefined) {
      await new Promise(resolve => setTimeout(resolve, 1100));
      blockSeconds = BigInt(Math.floor(Date.now() / 1000));
    }
    const data = await response.json() as { result: { timestamp: string } };
    data.result.timestamp = `0x${blockSeconds.toString(16)}`;
    return new Response(JSON.stringify(data));
  }) as typeof fetch;
  const result = await collectBscTokenSecurity({ rpcUrl: "https://example.invalid/rpc", maxAgeMs: 60_000, reviews: [] }, fetcher);
  assert.ok(result.every(e => e.observation !== null));
});
test("P7 security review revision invalidates an already signed EOA approval", async () => {
  const owner = Wallet.createRandom(), request = fixture(owner.address);
  const meta = { portfolioId: "security-test", legId: "leg", planId: "plan",
    policyHash: `0x${"a".repeat(64)}`, transactionNonce: 7, authorizationNonce: "nonce",
    expiresAt: "2026-09-28T14:02:00.000Z", maxGasLimit: 300_000n, maxFeePerGas: 5_000_000_000n };
  const approval = prepareEoaLegApproval(request, meta);
  const { domain, types, value } = eoaApprovalTypedData(approval);
  const signature = await owner.signTypedData(domain, types, value);
  const stock = request.evidence.tokenSecurity![0]!;
  const revised = assessTokenSecurity({ ...stock, review: { ...stock.review!, reviewId: "synthetic-review-2" },
    reviewArtifact: { ...stock.reviewArtifact!, reviewId: "synthetic-review-2" }, now, maxAgeMs: 120_000 });
  const next = { ...request, evidence: { ...request.evidence,
    tokenSecurity: [revised, request.evidence.tokenSecurity![1]!] } };
  assert.equal(evaluateMarketGate(next).allowed, true);
  assert.throws(() => verifyEoaLegApproval(approval, signature, next, meta, false), { code: "APPROVAL_CHANGED" });
});
