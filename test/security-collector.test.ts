import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { Interface, keccak256 } from "ethers";
import { BSTOCKS_WALLET_PROFILES, fetchBStocksGovernance } from "../src/security/bstocks-governance.js";
import { REVIEWED_BSC_SOURCES, reviewedSourcePin } from "../src/security/reviewed-source-pins.js";
import { collectBscTokenSecurity, fetchSecuritySourceDigest, BSC_USDT } from "../src/security/bsc-token-security.js";
import { fetchSecurityReviewArtifact } from "../src/security/review-artifact.js";
import { trustedReviewPublication } from "../src/security/review-publishers.js";
import { assessTokenSecurity, normalizeBinanceAudit, normalizeGoPlusAudit, parseTokenSecurityReviews,
  BINANCE_COVERAGE_FIELDS, GOPLUS_COVERAGE_FIELDS, securityDigest, tokenSecurityFingerprint } from "../src/security/token-security.js";
import { syntheticTokenSecurity } from "./token-security-fixture.js";
import { collectorMock } from "./security-collector-fixture.js";

const now = "2026-09-28T14:00:00.000Z", maxAgeMs = 120_000;
const base = syntheticTokenSecurity(`eip155:56/erc20:${BSC_USDT}`);
const stock = syntheticTokenSecurity("eip155:56/erc20:0x02fca66c1d1afb4e2a7884261eb00f63598a7436");
const snapshot = JSON.parse(readFileSync("docs/integrations/2026-10-01-bstocks-governance.json", "utf8"));
const proof = snapshot.sources[0];
const abi = new Interface(["function owner() view returns (address)", "function admin() view returns (address)",
  "function implementation() view returns (address)", "function operator() view returns (address)",
  "function paused() view returns (bool)", "function numOfHotWallets() view returns (uint256)",
  "function hotWallets(uint256) view returns (address)", "function isHotWallet(address) view returns (bool)"]);
const zero = `0x${"0".repeat(64)}`;
const padded = (a: string) => `0x${a.slice(2).padStart(64, "0")}`;
const implSlot = "0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc";
const adminSlot = "0xb53127684a568b3173ae13b9f8a6016e243e63b6e8ee1178d6a717850b5d6103";
const beaconSlot = "0xa3f0ad74e5423aebfd80d3ef4346578335a9a72aeaee59ff6cb3582b35133d50";

/** Published source/runtime identities, explicitly synthetic storage/status/RPC responses. */
function governanceRpc(change: { slot?: string; value?: string; implCode?: string;
  getterMismatch?: boolean; unavailable?: boolean; badMembership?: boolean } = {}, hash = proof.header.hash) {
  const calls: Array<{ method: string; params: unknown[] }> = [];
  const rpc = async (method: string, params: unknown[]): Promise<unknown> => {
    calls.push({ method, params });
    assert.ok(["eth_getCode", "eth_getStorageAt", "eth_call"].includes(method));
    assert.deepEqual(params.at(-1), { blockHash: hash, requireCanonical: true });
    if (change.unavailable) throw Error("historical state unavailable");
    const to = (method === "eth_call" ? (params[0] as { to: string }).to : String(params[0])).toLowerCase();
    const p = proof.proxies.find((p: { address: string; implementation: string }) => p.address === to || p.implementation === to);
    assert.ok(p);
    if (method === "eth_getCode") return change.implCode ?? p.implementationRuntime.code;
    if (method === "eth_getStorageAt") {
      const slot = String(params[1]);
      if (p.type === "OperatorWallet" && change.slot === slot) return change.value;
      if (slot === implSlot) return padded(p.implementation);
      if (slot === adminSlot) return padded(p.admin);
      if (slot === beaconSlot) return zero;
      if (slot === "0x0") return p.initializedWord;
      if (slot === "0x33") return padded("0x0000000000000000000000000000000000000001");
      if (slot === "0x65" && p.type === "OperatorWallet") return p.paused ? padded("0x0000000000000000000000000000000000000001") : zero;
      const result = p.storageWords[String(BigInt(slot))];
      assert.ok(result); return result;
    }
    const request = params[0] as { data: string; from?: string };
    const call = abi.parseTransaction({ data: request.data }); assert.ok(call);
    if (call.name === "admin" || call.name === "implementation") assert.equal(request.from, p.admin);
    const value = call.name === "owner" ? change.getterMismatch ? BSC_USDT : p.owner
      : call.name === "admin" ? p.admin : call.name === "implementation" ? p.implementation
        : call.name === "operator" ? p.operator : call.name === "paused" ? p.paused
          : call.name === "numOfHotWallets" ? BigInt(p.hotWallets.length)
            : call.name === "hotWallets" ? p.hotWallets[Number(call.args[0])]
              : !change.badMembership;
    return abi.encodeFunctionResult(call.name, [value]);
  };
  return { rpc, calls };
}

test("P5.5d production source certificates bind the preserved full rebuild artifact", async () => {
  const raw = readFileSync("docs/research/bstocks-governance/source-rebuilds.json", "utf8");
  const report = JSON.parse(raw), reportDigest = createHash("sha256").update(raw).digest("hex");
  for (const pin of REVIEWED_BSC_SOURCES) {
    const r = pin.certificate.contractName === "UpgradeableBeacon" ? report.beacon
      : report.sourceRebuilds.find((r: { address: string }) => r.address === pin.address);
    assert.equal(pin.certificate.reportDigest, reportDigest);
    assert.equal(pin.codeHash, keccak256(r.deployedRuntime));
    assert.equal(pin.certificate.compiledCodeHash, keccak256(r.compiledRuntime));
    assert.equal(pin.certificate.inputDigest, r.inputDigest);
    assert.equal(pin.certificate.compiler, r.compiler);
    assert.equal(pin.certificate.contractName, r.contractName);
    assert.equal(pin.certificate.executableCodeHash, r.executableCodeHash);
    assert.equal(pin.certificate.executableMatch, r.executableMatch);
    assert.equal(pin.certificate.exactMatch, r.exactMatch);
    assert.equal(pin.sourceDigest, securityDigest({ address: pin.address, codeHash: pin.codeHash, certificate: pin.certificate }));
    const noNetwork = (async () => { throw Error("Local certificate needs no provider"); }) as typeof fetch;
    assert.equal(await fetchSecuritySourceDigest(pin, noNetwork), pin.sourceDigest);
    assert.equal(reviewedSourcePin(BSC_USDT, pin.codeHash), undefined);
    assert.equal(await fetchSecuritySourceDigest({ ...pin, codeHash: keccak256("0x6000") }, noNetwork), null);
    assert.ok(Object.isFrozen(pin) && Object.isFrozen(pin.certificate));
    if (pin.certificate.contractName === "UpgradeableBeacon") {
      const input = JSON.parse(readFileSync("docs/research/bstocks-governance/beacon-standard-input.json", "utf8"));
      assert.equal(pin.certificate.inputDigest, createHash("sha256").update(JSON.stringify(input)).digest("hex"));
    }
  }
});

test("P5.5d governance reads implementation/admin and source-derived state at one canonical hash", async () => {
  const mock = governanceRpc();
  const result = await fetchBStocksGovernance({ authorities: proof.accounts, blockHash: proof.header.hash, rpc: mock.rpc });
  assert.ok(result); assert.equal(result.governance.length, 2); assert.equal(result.components.length, 4);
  assert.deepEqual(result.governance.map(g => g.owner), proof.proxies.map((p: { owner: string }) => p.owner));
  assert.ok(result.controllerAddresses.includes(proof.proxies[0].admin));
  assert.ok(result.controllerAddresses.includes(proof.proxies[0].operator));
  assert.ok(mock.calls.length > 20);
});

test("P5.5d unchanged wrapper cannot hide an inner upgrade, invalid initialization or mismatched getter", async () => {
  const cases = [{ slot: implSlot, value: padded(BSC_USDT) }, { implCode: "0x6000" },
    { slot: "0x0", value: zero }, { slot: "0x33", value: zero }, { slot: beaconSlot, value: padded(BSC_USDT) },
    { slot: "0x9b", value: padded("0x0000000000000000000000000000000000000003") },
    { slot: "0x65", value: padded("0x0000000000000000000000000000000000000001") },
    { getterMismatch: true }, { unavailable: true }, { badMembership: true }];
  for (const change of cases) assert.equal(await fetchBStocksGovernance({ authorities: proof.accounts,
    blockHash: proof.header.hash, rpc: governanceRpc(change).rpc }), null);
  assert.equal(await fetchBStocksGovernance({ authorities: proof.accounts.filter((a: { address: string }) =>
    a.address !== BSTOCKS_WALLET_PROFILES[0]!.address), blockHash: proof.header.hash, rpc: governanceRpc().rpc }), null);
});

test("P5.5d supported wallet governance resolves contract authority but every control change invalidates review", () => {
  assert.equal(stock.state, "clear");
  assert.ok(!stock.reasons.includes("contract-or-delegated-authority-unresolved"));
  const o = stock.observation!, g = o.governance![0]!;
  for (const changes of [{ admin: BSC_USDT }, { owner: BSC_USDT }, { operator: BSC_USDT },
    { hotWallets: [BSC_USDT] }, { implementation: BSC_USDT }]) {
    const changed = { ...o, governance: [{ ...g, ...changes }, o.governance![1]!] };
    assert.notEqual(tokenSecurityFingerprint(changed), tokenSecurityFingerprint(o));
    assert.ok(assessTokenSecurity({ ...stock, observation: changed, now, maxAgeMs }).reasons.includes("reviewed-controls-changed"));
  }
  for (const changed of [{ ...o, governance: [] }, { ...o, components: o.components.slice(0, -1) },
    { ...o, authorities: [...o.authorities, { address: BSC_USDT, codeHash: keccak256("0x6000") }] },
    { ...o, authorities: o.authorities.map(a => a.address === g.owner ? { ...a, codeHash: keccak256("0x6000") } : a) }]) {
    const result = assessTokenSecurity({ ...stock, observation: changed, review: { ...stock.review!,
      fingerprint: tokenSecurityFingerprint(changed), components: changed.components }, now, maxAgeMs });
    assert.notEqual(result.state, "clear");
  }
});

test("P5.5d paused wallet or pending ownership stays a risk with matching source", () => {
  const o = stock.observation!;
  for (const change of [{ paused: true }, { pendingOwner: o.authorities[0]!.address }]) {
    const changed = { ...o, governance: [{ ...o.governance![0]!, ...change }, o.governance![1]!] };
    assert.equal(assessTokenSecurity({ ...stock, observation: changed, now, maxAgeMs }).state, "risk");
  }
});

test("P5.5d collector integrates local beacon plus four governance execution components without source API", async () => {
  const wallets = proof.proxies.map((p: { address: string }) => p.address);
  const baseMock = collectorMock({ missingBeaconSource: true, issuerMembers: wallets });
  const govMock = governanceRpc({}, `0x${"a".repeat(64)}`);
  const fetcher = (async (url, init) => {
    const body = init?.body ? JSON.parse(String(init.body)) : null;
    if (body?.method) {
      const to = (body.method === "eth_call" ? body.params[0]?.to : body.params[0])?.toLowerCase();
      if (body.method === "eth_getCode") {
        const p = proof.proxies.find((p: { implementation: string }) => p.implementation === to);
        const account = proof.accounts.find((a: { address: string }) => a.address === to);
        const code = to === proof.beacon.address ? proof.beacon.code : p?.implementationRuntime.code ?? account?.code;
        if (code !== undefined) return new Response(JSON.stringify({ jsonrpc: "2.0", id: body.id, result: code }));
      }
      if (wallets.includes(to)) return new Response(JSON.stringify({ jsonrpc: "2.0", id: body.id,
        result: await govMock.rpc(body.method, body.params) }));
    }
    return baseMock.fetcher(url, init);
  }) as typeof fetch;
  const result = await collectBscTokenSecurity({ rpcUrl: "https://example.invalid/rpc", now: "2026-09-27T15:00:02.000Z",
    reviews: [], maxAgeMs: 60_000, blockNumber: 256n, blockHash: `0x${"a".repeat(64)}` }, fetcher);
  const observed = result[1]!.observation!; assert.ok(observed);
  assert.equal(observed.governance!.length, 2); assert.equal(observed.components.length, 9);
  assert.ok(observed.components.every(c => c.sourceDigest));
  assert.ok(!result[1]!.reasons.includes("source-closure-incomplete"));
  assert.ok(!result[1]!.reasons.includes("contract-or-delegated-authority-unresolved"));
  assert.ok(result[1]!.reasons.includes("contract-scope-review-missing-or-expired"));
  assert.equal(result[1]!.state, "unsupported");
});

test("P5.5d quantity-frame mismatch cannot be replaced with a new security head", async () => {
  await assert.rejects(collectBscTokenSecurity({ rpcUrl: "https://example.invalid", reviews: [], maxAgeMs: 60000,
    blockNumber: 256n }), /quantity frame/);
  const result = await collectBscTokenSecurity({ rpcUrl: "https://example.invalid", reviews: [], maxAgeMs: 60000,
    now: "2026-09-27T15:00:02.000Z", blockNumber: 256n, blockHash: `0x${"f".repeat(64)}` }, collectorMock().fetcher);
  assert.ok(result.every(r => !r.observation && r.state !== "clear"));
});

test("P5.5d unsupported Binance discards unreliable fields while risk and unknown coverage stay separate", () => {
  const clock = { observedAt: now, expiresAt: "2026-09-28T14:01:00.000Z" };
  const data = { hasResult: false, isSupported: false, riskLevel: 1, extraInfo: { buyTax: "0", sellTax: "0" },
    riskItems: [{ id: "CONTRACT_RISK", details: [{ title: "Unreliable", isHit: true, riskType: "RISK" }] }] };
  const unsupported = normalizeBinanceAudit({ code: "000000", success: true, data }, base.assetId, clock);
  assert.deepEqual(unsupported.findings, []); assert.ok(Object.values(unsupported.coverage!).every(x => x === "unknown"));
  const partial = normalizeBinanceAudit({ code: "000000", success: true, data: { ...data,
    hasResult: true, isSupported: true, riskAlert: null } }, base.assetId, clock);
  assert.equal(partial.state, "risk"); assert.equal(partial.coverage!.CONTRACT_RISK, "covered");
  assert.equal(partial.coverage!.TRADE_RISK, "unknown");
});

test("P5.5d GoPlus mint risk remains visible alongside missing proxy fields; failed envelopes cover nothing", () => {
  const data = { ...Object.fromEntries(GOPLUS_COVERAGE_FIELDS.map(k => [k, "0"])), is_open_source: "1", is_mintable: "1" };
  delete (data as Record<string, string>).hidden_owner;
  const payload = { code: 1, result: { [BSC_USDT]: data } };
  const partial = normalizeGoPlusAudit(payload, base.assetId, base.providers[0]!);
  assert.equal(partial.state, "risk"); assert.equal(partial.coverage!.hidden_owner, "unknown");
  assert.equal(partial.coverage!.is_mintable, "covered"); assert.ok(partial.findings.includes("is_mintable"));
  const failed = normalizeGoPlusAudit({ ...payload, code: 0 }, base.assetId, base.providers[0]!);
  assert.equal(failed.state, "unavailable"); assert.deepEqual(failed.findings, []);
  assert.ok(Object.values(failed.coverage!).every(x => x === "unknown"));
});

test("P5.5d a forged clear provider label cannot conceal missing field/category coverage", () => {
  for (const coverage of [undefined, {}, { ...base.providers[0]!.coverage, TRADE_RISK: "unknown" as const },
    { ...base.providers[0]!.coverage, fake: "covered" as const }]) {
    const { coverage: _old, ...provider } = base.providers[0]!;
    const result = assessTokenSecurity({ ...base, providers: [{ ...provider, ...(coverage ? { coverage } : {}) }, base.providers[1]!], now, maxAgeMs });
    assert.notEqual(result.state, "clear"); assert.ok(result.reasons.includes("binance-coverage-incomplete"));
  }
  assert.deepEqual(Object.keys(base.providers[0]!.coverage!).sort(), [...BINANCE_COVERAGE_FIELDS].sort());
});

const pdf = Buffer.from("%PDF-1.7\nExplicitly synthetic test artifact, never an actual independent audit.\n%%EOF");
const pdfDigest = createHash("sha256").update(pdf).digest("hex");
const review = { ...base.review!, reportDigest: pdfDigest };
const response = (body: string | Buffer = pdf, headers: Record<string, string> = { "content-type": "application/pdf" }) =>
  (async (_url, init) => { assert.equal(init?.redirect, "error");
    return new Response(typeof body === "string" ? body : new Uint8Array(body), { headers }); }) as typeof fetch;

test("P5.5d independent artifact intake fetches primary immutable publication and verifies actual bytes", async () => {
  const artifact = await fetchSecurityReviewArtifact({ review, now, maxAgeMs }, response());
  assert.equal(artifact.state, "verified"); assert.equal(artifact.observedDigest, pdfDigest);
  assert.equal(assessTokenSecurity({ ...base, review, reviewArtifact: artifact, now, maxAgeMs }).state, "clear");
  const tampered = await fetchSecurityReviewArtifact({ review, now, maxAgeMs }, response(Buffer.concat([pdf, Buffer.from("changed")])));
  assert.equal(tampered.state, "mismatch");
  assert.notEqual(assessTokenSecurity({ ...base, review, reviewArtifact: tampered, now, maxAgeMs }).state, "clear");
});

test("P5.5d auditor lookalikes, mutable branches, HTML and oversized reports cannot become independent proof", async () => {
  const commit = "a".repeat(40);
  const publication = `https://raw.githubusercontent.com/peckshield/publications/${commit}/audit_reports/Report.pdf`;
  assert.equal(trustedReviewPublication("peckshield", publication), true);
  assert.equal(trustedReviewPublication("peckshield", publication.replace("/audit_reports/", "/audits/")), false);
  assert.equal(trustedReviewPublication("peckshield", publication.replace(commit, "master")), false);
  assert.equal(trustedReviewPublication("unknown", publication), false);
  assert.equal(trustedReviewPublication("certik", "https://certik-public-assets.s3.amazonaws.com/Report.pdf"), false);
  for (const reportUrl of ["https://raw.githubusercontent.com.evil.invalid/EtherAuthority/Audit/report.pdf",
    "https://raw.githubusercontent.com/EtherAuthority/Audit/main/report.pdf", "https://www.binance.com/faq",
    review.reportUrl + "?token=synthetic", review.reportUrl.replace("synthetic-review", "%2e%2e%2fsynthetic")]) {
    assert.equal(trustedReviewPublication("etherauthority", reportUrl), false);
    const noFetch = (async () => { throw Error("Untrusted URL must not be requested"); }) as typeof fetch;
    assert.equal((await fetchSecurityReviewArtifact({ review: { ...review, reportUrl }, now, maxAgeMs }, noFetch)).state, "unsupported");
    assert.throws(() => parseTokenSecurityReviews({ version: 1, reviews: [{ ...review, reportUrl }] }));
  }
  for (const fetcher of [response("<html>Issuer says audited</html>", { "content-type": "text/html" }),
    response(pdf, { "content-type": "application/pdf", "content-length": "99999999" }),
    response("%PDF-" + "x".repeat(4 * 1024 * 1024)), response("not a PDF")])
    assert.notEqual((await fetchSecurityReviewArtifact({ review, now, maxAgeMs }, fetcher)).state, "verified");
});

test("P5.5d redirect or unavailable publisher leaves artifact unverified", async () => {
  const redirected = (async () => { const r = new Response(pdf, { headers: { "content-type": "application/pdf" } });
    Object.defineProperty(r, "url", { value: "https://other.invalid/report.pdf" }); return r; }) as typeof fetch;
  assert.equal((await fetchSecurityReviewArtifact({ review, now, maxAgeMs }, redirected)).state, "unsupported");
  assert.equal((await fetchSecurityReviewArtifact({ review, now, maxAgeMs },
    (async () => { throw Error("timeout"); }) as typeof fetch)).state, "unavailable");
});

test("P5.5d legacy assertions, incomplete scope and stale/mismatched artifact cannot clear review", () => {
  const { publisherId: _p, components: _c, ...old } = base.review!;
  const legacy = { ...old, version: 1 as const };
  assert.equal(parseTokenSecurityReviews({ version: 1, reviews: [legacy] }).length, 1);
  assert.ok(assessTokenSecurity({ ...base, review: legacy, now, maxAgeMs }).reasons.includes("independent-review-provenance-missing"));
  const wrongScope = { ...stock.review!, components: stock.review!.components!.slice(0, -1) };
  assert.ok(assessTokenSecurity({ ...stock, review: wrongScope, now, maxAgeMs }).reasons.includes("independent-review-source-scope-incomplete"));
  for (const reviewArtifact of [null, { ...base.reviewArtifact!, observedDigest: "f".repeat(64) },
    { ...base.reviewArtifact!, publisherId: "unknown" }, { ...base.reviewArtifact!, expectedDigest: "f".repeat(64) },
    { ...base.reviewArtifact!, expiresAt: now }, { ...base.reviewArtifact!, reviewId: "other" }])
    assert.ok(assessTokenSecurity({ ...base, reviewArtifact, now, maxAgeMs }).reasons.includes("independent-review-artifact-unverified"));
});

test("P5.5d verified independent document never overrides a review risk or scanner gap", () => {
  assert.equal(assessTokenSecurity({ ...base, review: { ...base.review!, coverage: {
    ...base.review!.coverage, "privileged-authority": "risk" } }, now, maxAgeMs }).state, "risk");
  assert.notEqual(assessTokenSecurity({ ...base, providers: [{ ...base.providers[0]!, state: "unsupported" },
    base.providers[1]!], now, maxAgeMs }).state, "clear");
});
