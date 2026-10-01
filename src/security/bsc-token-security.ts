import { randomUUID } from "node:crypto";
import { Interface, keccak256 } from "ethers";
import { reviewedSourcePin } from "./reviewed-source-pins.js";
import { fetchBStocksGovernance } from "./bstocks-governance.js";
import { fetchSecurityReviewArtifact } from "./review-artifact.js";
import { BSTOCKS_BSC_NVDAB, fetchBStocksBscQuantity } from "../market-gate/bstocks-bsc.js";
import { assessTokenSecurity, normalizeBinanceAudit, normalizeGoPlusAudit, securityDigest,
  type SecurityComponent, type TokenSecurityEvidence, type TokenSecurityObservation,
  type TokenSecurityReview, type SecurityGovernance } from "./token-security.js";

export const BSC_USDT = "0x55d398326f99059ff775485246999027b3197955";
const usdtAbi = new Interface(["function owner() view returns (address)", "function decimals() view returns (uint8)"]);
const beaconSlot = "0xa3f0ad74e5423aebfd80d3ef4346578335a9a72aeaee59ff6cb3582b35133d50";
const implSlot = "0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc";
const obj = (x: unknown): Record<string, unknown> | null =>
  x !== null && typeof x === "object" && !Array.isArray(x) ? x as Record<string, unknown> : null;
const runtime = (x: unknown): x is string => typeof x === "string" && /^0x(?:[0-9a-fA-F]{2})+$/.test(x);
const blockHash = (x: unknown): x is string => typeof x === "string" && /^0x[0-9a-f]{64}$/.test(x);

/** Source matching covers every discovered execution component. It never substitutes for review. */
export async function fetchSecuritySourceDigest(component: Pick<SecurityComponent, "address" | "codeHash">,
  fetcher: typeof fetch = fetch): Promise<string | null> {
  const recovered = reviewedSourcePin(component.address, component.codeHash);
  if (recovered) return recovered.sourceDigest;
  try {
    const url = `https://sourcify.dev/server/v2/contract/56/${component.address}`
      + "?fields=runtimeMatch,runtimeBytecode.onchainBytecode,sources,compilation";
    const response = await fetcher(url, { signal: AbortSignal.timeout(10_000) });
    if (!response.ok) return null;
    const root = obj(await response.json()), bytecode = obj(root?.runtimeBytecode)?.onchainBytecode;
    const sources = obj(root?.sources);
    if (!root || !["match", "exact_match"].includes(String(root.runtimeMatch))
      || !runtime(bytecode) || keccak256(bytecode) !== component.codeHash || !sources
      || !Object.keys(sources).length || !obj(root.compilation)
      || !Object.values(sources).every(s => typeof obj(s)?.content === "string"
        && (obj(s)!.content as string).length > 0)) return null;
    return securityDigest({ runtimeMatch: root.runtimeMatch, codeHash: component.codeHash,
      sources, compilation: root.compilation });
  } catch { return null; }
}

/** Read-only, exact initial scope. Unknown tokens remain unsupported; no wallet/sign/send path. */
export async function collectBscTokenSecurity(input: {
  readonly rpcUrl: string; readonly maxAgeMs: number; readonly now?: string;
  readonly reviews: readonly TokenSecurityReview[];
  /** Bind to an already collected quantity frame; both fields are mandatory together. */
  readonly blockNumber?: bigint; readonly blockHash?: string;
}, fetcher: typeof fetch = fetch): Promise<readonly TokenSecurityEvidence[]> {
  const url = new URL(input.rpcUrl);
  if (url.protocol !== "https:" || url.username || url.password || url.hash || url.search
    || !Number.isSafeInteger(input.maxAgeMs) || input.maxAgeMs <= 0 || input.maxAgeMs > 300_000)
    throw new Error("Invalid token security source configuration.");
  if ((input.blockNumber === undefined) !== (input.blockHash === undefined)
    || (input.blockNumber !== undefined && (typeof input.blockNumber !== "bigint" || input.blockNumber < 0n))
    || (input.blockHash !== undefined && !blockHash(input.blockHash)))
    throw new Error("Invalid token security quantity frame.");
  let nextId = 0;
  const rpc = async (method: string, params: unknown[]): Promise<unknown> => {
    const id = ++nextId;
    const response = await fetcher(url.href, { method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", id, method, params }), signal: AbortSignal.timeout(5000) });
    if (!response.ok) throw new Error("Token security RPC unavailable.");
    const root = obj(await response.json());
    if (!root || root.jsonrpc !== "2.0" || root.id !== id || root.error || !Object.hasOwn(root, "result"))
      throw new Error("Token security RPC malformed.");
    return root.result;
  };
  const tokens = [BSC_USDT, BSTOCKS_BSC_NVDAB];
  const observations = new Map<string, TokenSecurityObservation>();
  let number: string | undefined, header: Record<string, unknown> | null = null;
  try {
    if (await rpc("eth_chainId", []) !== "0x38") throw new Error("Wrong chain.");
    const block = input.blockNumber === undefined ? await rpc("eth_blockNumber", [])
      : `0x${input.blockNumber.toString(16)}`;
    if (typeof block !== "string" || !/^0x[0-9a-f]+$/.test(block)) throw new Error("Missing head.");
    number = block;
    header = obj(await rpc("eth_getBlockByNumber", [block, false]));
    if (!header || header.number !== block || !blockHash(header.hash)
      || (input.blockHash !== undefined && header.hash !== input.blockHash)
      || typeof header.timestamp !== "string" || !/^0x[0-9a-f]+$/.test(header.timestamp)) throw new Error("Invalid header.");
    // Evaluate the live clock after RPC retrieval. A block mined while awaiting
    // the head is not future evidence relative to the actual receipt time.
    const chainNow = input.now ?? new Date().toISOString();
    const blockMs = Number(BigInt(header.timestamp) * 1000n), clockMs = Date.parse(chainNow);
    if (!Number.isFinite(blockMs) || blockMs > clockMs || clockMs - blockMs > input.maxAgeMs) throw new Error("Stale head.");
    const ref = { blockHash: header.hash, requireCanonical: true };
    const clock = { observedAt: new Date(blockMs).toISOString(), expiresAt: new Date(blockMs + input.maxAgeMs).toISOString() };
    const shared = { ...clock, source: `bsc-rpc:${url.hostname}`, sourceBlock: BigInt(block), sourceBlockHash: header.hash };
    // Individual token failures do not erase the other token's valid findings.
    await Promise.all(tokens.map(async token => {
      const assetId = `eip155:56/erc20:${token}`;
      try {
        let components: Array<Pick<SecurityComponent, "address" | "codeHash">>, controls: Record<string, string | boolean>;
        let authorityMembers: readonly string[];
        let paused = false, pendingChange = false;
        if (token === BSC_USDT) {
          const [code, decimals, owner, beacon, impl] = await Promise.all([
            rpc("eth_getCode", [token, ref]),
            rpc("eth_call", [{ to: token, data: usdtAbi.encodeFunctionData("decimals") }, ref]),
            rpc("eth_call", [{ to: token, data: usdtAbi.encodeFunctionData("owner") }, ref]),
            rpc("eth_getStorageAt", [token, beaconSlot, ref]), rpc("eth_getStorageAt", [token, implSlot, ref])
          ]);
          if (!runtime(code) || typeof decimals !== "string" || typeof owner !== "string"
            || usdtAbi.decodeFunctionResult("decimals", decimals)[0] !== 18n
            || beacon !== `0x${"0".repeat(64)}` || impl !== `0x${"0".repeat(64)}`) return;
          const ownerAddress = String(usdtAbi.decodeFunctionResult("owner", owner)[0]).toLowerCase();
          if (!/^0x[0-9a-f]{40}$/.test(ownerAddress)) return;
          controls = { owner: ownerAddress, beaconSlot: String(beacon), implementationSlot: String(impl) };
          authorityMembers = [ownerAddress];
          components = [{ address: token, codeHash: keccak256(code) }];
        } else {
          const snapshot = await fetchBStocksBscQuantity({ instrumentId: assetId, tokenAddress: token,
            rpcUrl: input.rpcUrl, now: chainNow, maxBlockAgeMs: input.maxAgeMs,
            blockNumber: BigInt(block), blockHash: header!.hash as string }, fetcher);
          if (!snapshot) return;
          const c = snapshot.control;
          controls = { ...c, uiMultiplier: snapshot.uiMultiplier.toString(),
            pendingMultiplier: snapshot.pendingMultiplier?.toString() ?? "none",
            pendingEffectiveAt: snapshot.pendingEffectiveAt ?? "none" };
          components = [ { address: token, codeHash: c.tokenCodeHash },
            { address: c.beacon, codeHash: c.beaconCodeHash },
            { address: c.implementation, codeHash: c.implementationCodeHash },
            { address: c.compliance, codeHash: c.complianceCodeHash },
            { address: c.pauseManager, codeHash: c.pauseManagerCodeHash } ];
          paused = snapshot.tokenPaused; pendingChange = snapshot.pendingMultiplier !== null;
          authorityMembers = snapshot.authorityMembers;
        }
        const readAuthority = async (address: string) => {
          const code = await rpc("eth_getCode", [address, ref]);
          if (typeof code !== "string" || !/^0x(?:[0-9a-fA-F]{2})*$/.test(code)) throw new Error("Authority runtime unavailable.");
          return { address, codeHash: keccak256(code) };
        };
        const authorities = await Promise.all(authorityMembers.map(readAuthority));
        let governance: readonly SecurityGovernance[] = [];
        if (token === BSTOCKS_BSC_NVDAB) {
          const current = await fetchBStocksGovernance({ authorities, rpc, blockHash: header!.hash as string });
          if (current) {
            governance = current.governance;
            components.push(...current.components);
            const additional = await Promise.all(current.controllerAddresses
              .filter(address => !authorities.some(a => a.address === address)).map(readAuthority));
            authorities.push(...additional);
          }
        }
        const sourced = await Promise.all(components.map(async c => ({ ...c,
          sourceDigest: await fetchSecuritySourceDigest(c, fetcher) })));
        observations.set(assetId, { ...shared, profile: token === BSC_USDT ? "runtime-owner-v1" : "bstocks-beacon-v1",
          assetId, decimals: 18, components: sourced, authorities, controls, governance, paused, pendingChange });
      } catch { /* Token-local missing evidence remains blocked. */ }
    }));
  } catch { observations.clear(); }
  const post = async (address: string): Promise<unknown> => {
    try {
      const response = await fetcher("https://web3.binance.com/bapi/defi/v1/public/wallet-direct/security/token/audit", {
        method: "POST", headers: { "Content-Type": "application/json", source: "agent",
          "Accept-Encoding": "identity", "User-Agent": "binance-web3/1.4 (Skill)" },
        body: JSON.stringify({ binanceChainId: "56", contractAddress: address, requestId: randomUUID() }),
        signal: AbortSignal.timeout(10_000) });
      return response.ok ? await response.json() : null;
    } catch { return null; }
  };
  const audits = await Promise.all(tokens.map(async token => {
    const [binance, goplus] = await Promise.all([post(token), (async () => {
      try { const r = await fetcher(`https://api.gopluslabs.io/api/v1/token_security/56?contract_addresses=${token}`,
        { signal: AbortSignal.timeout(10_000) }); return r.ok ? await r.json() : null; } catch { return null; }
    })()]);
    // Provider responses lack a source timestamp. Receipt TTL is a retrieval lease,
    // never a claim that a provider performed a fresh scan at this block.
    const observedAt = input.now ?? new Date().toISOString();
    const clock = { observedAt, expiresAt: new Date(Date.parse(observedAt) + input.maxAgeMs).toISOString() };
    const assetId = `eip155:56/erc20:${token}`;
    return [normalizeBinanceAudit(binance, assetId, clock), normalizeGoPlusAudit(goplus, assetId, clock)];
  }));
  const reviewArtifacts = await Promise.all(tokens.map(async token => {
    const review = input.reviews.find(r => r.assetId === `eip155:56/erc20:${token}`);
    return review ? fetchSecurityReviewArtifact({ review, maxAgeMs: input.maxAgeMs,
      ...(input.now ? { now: input.now } : {}) }, fetcher) : null;
  }));
  try {
    const final = number ? obj(await rpc("eth_getBlockByNumber", [number, false])) : null;
    if (!final || final.number !== number || final.hash !== header?.hash) observations.clear();
  } catch { observations.clear(); }
  const now = input.now ?? new Date().toISOString();
  return tokens.map((token, i) => {
    const assetId = `eip155:56/erc20:${token}`;
    return assessTokenSecurity({ assetId, observation: observations.get(assetId) ?? null,
      providers: audits[i]!, review: input.reviews.find(r => r.assetId === assetId) ?? null,
      reviewArtifact: reviewArtifacts[i] ?? null, now, maxAgeMs: input.maxAgeMs });
  });
}
