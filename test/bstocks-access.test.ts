import assert from "node:assert/strict";
import test from "node:test";
import { Wallet } from "ethers";
import { createInstrument } from "../src/domain/instrument.js";
import { BSTOCKS_BSC_NVDAB } from "../src/market-gate/bstocks-bsc.js";
import { assessBStocksAccess, bStocksWalletChallengeTypedData,
  issueBStocksWalletChallenge, verifyBStocksWalletChallenge,
  type BStocksAccessPorts, type BStocksAccessRequest,
  type BStocksAccessServerContext,
  type BStocksChallengeStore, type BStocksWalletChallenge } from "../src/market-gate/bstocks-access.js";
import { snapshot, rpcReply } from "./bstocks-transfer.test.js";

const now = "2026-09-27T15:00:02.000Z";
const instrument = createInstrument({ chainId: 56, tokenAddress: BSTOCKS_BSC_NVDAB,
  issuerId: "bstocks", productType: "stock", underlyingId: "nvidia",
  ticker: "NVDAB", decimals: 18, quantityModel: "share-ratio", adapterVersion: "fixture",
  sectorTags: ["technology"], classificationVersion: "fixture", statusSource: "fixture-status",
  referenceSource: "fixture-reference", eligibilityRequirements: ["bstocks-wallet-bound",
    "bstocks-person-reviewed", "bstocks-country-allowed", "bstocks-product-allowed",
    "bstocks-transfer-allowed"] });
const policy = { venueId: "pancake-v3", jurisdictionSource: "reviewed-identity",
  countrySourceUrl: "https://www.binance.com/test-fixture/country", countrySourceRevision: "country-1",
  productSource: "reviewed-product", maxEvidenceAgeMs: 60_000, maxBlockAgeMs: 10_000 };

function store(): BStocksChallengeStore {
  const entries = new Map<string, BStocksWalletChallenge>();
  return { async issue(challenge) { entries.set(`${challenge.sessionId}:${challenge.nonce}`, challenge); },
    async consume(sessionId, nonce) {
      const key = `${sessionId}:${nonce}`, challenge = entries.get(key) ?? null;
      entries.delete(key); return challenge;
    } };
}

async function setup() {
  const wallet = Wallet.createRandom();
  const challenges = store();
  const challenge = await issueBStocksWalletChallenge("session-one", wallet.address, challenges, new Date(now));
  const typed = bStocksWalletChallengeTypedData(challenge);
  const signature = await wallet.signTypedData(typed.domain, typed.types, typed.value);
  const binding = await verifyBStocksWalletChallenge(challenge, signature, challenges,
    new Date("2026-09-27T15:00:03.000Z"));
  assert.ok(binding);
  const request: BStocksAccessRequest = { sessionId: "session-one", wallet: wallet.address,
    instrument, side: "buy", now: "2026-09-27T15:00:03.000Z" };
  const context: BStocksAccessServerContext = { policy,
    transfer: { snapshot, reviewedControl: snapshot.control, rpcUrl: "https://example.invalid/rpc" } };
  const ports: BStocksAccessPorts = {
    async session() { return { active: true, binding }; },
    async jurisdiction() { return { sessionId: "session-one", source: "reviewed-identity",
      revision: "identity-1", observedAt: now, expiresAt: "2026-09-27T15:01:00Z",
      residenceCountry: "NG", accessCountry: "NG", restrictedPerson: false }; },
    async country() { return { source: "official-bstocks-country",
      sourceUrl: policy.countrySourceUrl, revision: "country-1", observedAt: now,
      expiresAt: "2026-09-27T15:01:00Z", country: "NG", productId: "bstocks", allowed: true }; },
    async product() { return { source: "reviewed-product", revision: "product-1",
      observedAt: now, expiresAt: "2026-09-27T15:01:00Z",
      instrumentId: instrument.instrumentId, venueId: policy.venueId, side: "buy", allowed: true }; }
  };
  return { wallet, challenge, signature, challenges, binding, request, context, ports };
}

test("P5.5c wallet challenge is session scoped, short lived and single use", async () => {
  const { wallet, challenge, signature, challenges } = await setup();
  assert.equal(await verifyBStocksWalletChallenge(challenge, signature, challenges, new Date(now)), null);
  const newStore = store();
  await newStore.issue(challenge);
  assert.equal(await verifyBStocksWalletChallenge({ ...challenge, sessionId: "other-session" },
    signature, newStore, new Date(now)), null);
  const other = Wallet.createRandom();
  const typed = bStocksWalletChallengeTypedData(challenge);
  const wrongSignature = await other.signTypedData(typed.domain, typed.types, typed.value);
  assert.equal(await verifyBStocksWalletChallenge(challenge, wrongSignature, newStore, new Date(now)), null);
  assert.equal(await verifyBStocksWalletChallenge(challenge, signature, newStore,
    new Date("2026-09-27T15:05:02.000Z")), null);
  assert.equal(wallet.address.toLowerCase(), challenge.wallet);
});

test("P5.5c complete reviewed access yields route-bound P5 evidence without personal country", async () => {
  const { request, context, ports } = await setup();
  const result = await assessBStocksAccess(request, context, ports, rpcReply());
  assert.equal(result?.source, "bstocks-access:v1");
  assert.equal(result?.wallet, request.wallet.toLowerCase());
  assert.equal(result?.accessControl?.transferBlock, 256n);
  assert.equal(result?.allowedSides[0], "buy");
  assert.match(result!.accessControl!.authorizationHash!, /^[0-9a-f]{64}$/);
  assert.ok(result?.verifiedRequirements.includes("bstocks-country-allowed"));
  assert.equal(JSON.stringify(result, (_key, value) => typeof value === "bigint" ? String(value) : value).includes("NG"), false);
});

test("P7 access authorization hash survives a block refresh but changes with reviewed policy", async () => {
  const { request, context, ports } = await setup();
  const first = await assessBStocksAccess(request, context, ports, rpcReply());
  const nextSnapshot = { ...snapshot, sourceBlock: 257n };
  const nextRpc = (async (url, init) => {
    const response = await rpcReply()(url, init);
    const body = JSON.parse(String(init?.body));
    if (body.method !== "eth_getBlockByNumber") return response;
    const data = await response.json() as { result: { number: string } };
    data.result.number = "0x101"; return new Response(JSON.stringify(data));
  }) as typeof fetch;
  const next = await assessBStocksAccess(request, { ...context, transfer: { ...context.transfer, snapshot: nextSnapshot } }, ports, nextRpc);
  assert.ok(first && next);
  assert.notEqual(first.accessControl!.accessHash, next.accessControl!.accessHash);
  assert.equal(first.accessControl!.authorizationHash, next.accessControl!.authorizationHash);
  const changed = await assessBStocksAccess(request, { ...context, policy: { ...context.policy, maxEvidenceAgeMs: 59_000 } }, ports, rpcReply());
  assert.ok(changed);
  assert.notEqual(first.accessControl!.authorizationHash, changed.accessControl!.authorizationHash);
});

test("P5.5c denied, stale, conflicting and unavailable access fails closed", async () => {
  const { request, context, ports } = await setup();
  const original = await ports.jurisdiction(request.sessionId);
  assert.ok(original);
  const country = await ports.country("NG");
  assert.ok(country);
  const product = await ports.product(instrument.instrumentId, policy.venueId, "buy");
  assert.ok(product);
  const blocked = async (override: Partial<BStocksAccessPorts>, change: Parameters<typeof rpcReply>[0] = {}) =>
    assessBStocksAccess(request, context, { ...ports, ...override }, rpcReply(change));
  assert.equal(await blocked({ session: async () => ({ active: false, binding: null }) }), null);
  assert.equal(await blocked({ jurisdiction: async () => ({ ...original, restrictedPerson: true }) }), null);
  assert.equal(await blocked({ jurisdiction: async () => ({ ...original, accessCountry: "US" }) }), null);
  assert.equal(await blocked({ jurisdiction: async () => ({ ...original, expiresAt: now }) }), null);
  assert.equal(await blocked({ country: async () => ({ ...country, allowed: false }) }), null);
  assert.equal(await blocked({ country: async () => ({ ...country, country: "US" }) }), null);
  assert.equal(await blocked({ country: async () => ({ ...country, revision: "changed" }) }), null);
  assert.equal(await blocked({ country: async () => null }), null);
  assert.equal(await blocked({ product: async () => ({ ...product, allowed: false }) }), null);
  assert.equal(await blocked({}, { blocked: request.wallet.toLowerCase() }), null);
  assert.equal(await blocked({}, { blocked: "0x8fb4243b553ac29ba088acf00b9b7da24bd6690c" }), null);
  assert.equal(await blocked({}, { paused: true }), null);
  assert.equal(await blocked({ country: async () => { throw new Error("outage"); } }), null);
});

test("P5.5c access rejects wrong route, token, policy source and expired binding", async () => {
  const { request, context, ports, binding } = await setup();
  assert.equal(await assessBStocksAccess({ ...request,
    instrument: createInstrument({ ...instrument, tokenAddress: "0x1111111111111111111111111111111111111111" }) },
    context, ports, rpcReply()), null);
  assert.equal(await assessBStocksAccess(request, { ...context, policy: { ...policy,
    countrySourceUrl: "https://unreviewed.example/country" } }, ports, rpcReply()), null);
  assert.equal(await assessBStocksAccess({ ...request, now: "2026-09-27T15:05:02.000Z" }, context, ports, rpcReply()), null);
  assert.equal(await assessBStocksAccess(request, context, { ...ports,
    session: async () => ({ active: true, binding: { ...binding, wallet: "0x1111111111111111111111111111111111111111" } }) },
  rpcReply()), null);
});
