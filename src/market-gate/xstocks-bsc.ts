import { Interface, keccak256 } from "ethers";
import type { QuantityEvidence } from "./evidence.js";

const issuerBase = "https://api.xstocks.fi/api/v2/public/assets";
const address = (value: unknown): value is string =>
  typeof value === "string" && /^0x[0-9a-fA-F]{40}$/.test(value);
const same = (a: string, b: string): boolean => a.toLowerCase() === b.toLowerCase();
const hex = (value: unknown): value is string =>
  typeof value === "string" && /^0x[0-9a-fA-F]+$/.test(value);
const tokenAbi = new Interface([
  "function decimals() view returns (uint8)",
  "function getCurrentMultiplier() view returns (uint256)"
]);
const wrapperAbi = new Interface([
  "function decimals() view returns (uint8)",
  "function asset() view returns (address)",
  "function convertToAssets(uint256) view returns (uint256)"
]);
const unit = 10n ** 18n;

export interface XStocksBscIdentity {
  readonly symbol: string;
  readonly underlyingSymbol: string;
  readonly tokenAddress: string;
  readonly wrapperAddress: string;
  /** Issuer halt is a veto; false does not certify a DEX venue is open. */
  readonly issuerHalted: boolean;
  readonly observedAt: string;
}

export interface XStocksBscIdentityRequest {
  readonly symbol: string;
  readonly underlyingSymbol: string;
  /** Immutable registry expectations; an API listing cannot silently substitute a token. */
  readonly tokenAddress: string;
  readonly wrapperAddress: string;
  readonly now?: string;
}

/** Discovers issuer metadata for an already registered exact BSC token and current v2 wrapper. */
export async function fetchXStocksBscIdentity(input: XStocksBscIdentityRequest,
  fetcher: typeof fetch = fetch): Promise<XStocksBscIdentity | null> {
  if (!/^[A-Z0-9]{1,15}x$/.test(input.symbol)
    || !/^[A-Z0-9.]{1,15}$/.test(input.underlyingSymbol)
    || !address(input.tokenAddress) || !address(input.wrapperAddress)
    || (input.now !== undefined && !Number.isFinite(Date.parse(input.now)))) return null;
  try {
    const response = await fetcher(`${issuerBase}/${encodeURIComponent(input.symbol)}`,
      { headers: { Accept: "application/json" }, signal: AbortSignal.timeout(5000) });
    if (!response.ok) return null;
    const data = await response.json() as Record<string, unknown>;
    const deployments = data.deployments;
    const trading = data.trading as Record<string, unknown> | undefined;
    const underlying = data.underlying as Record<string, unknown> | undefined;
    if (data.symbol !== input.symbol || data.underlyingSymbol !== input.underlyingSymbol
      || !underlying || underlying.symbol !== input.underlyingSymbol
      || underlying.currency !== "USD"
      || typeof data.isTradingHalted !== "boolean"
      || !trading || typeof trading.isTradingHalted !== "boolean"
      || !Array.isArray(deployments)) return null;
    const bsc = deployments.filter((d): d is Record<string, unknown> =>
      !!d && typeof d === "object" && d.network === "BinanceSmartChain");
    if (bsc.length !== 1 || !address(bsc[0]?.address)
      || !address(bsc[0]?.wrapperAddressV2)
      || !same(bsc[0].address, input.tokenAddress)
      || !same(bsc[0].wrapperAddressV2, input.wrapperAddress)
      || same(bsc[0].address, bsc[0].wrapperAddressV2)
      || (address(bsc[0].wrapperAddress)
        && same(bsc[0].wrapperAddress, bsc[0].wrapperAddressV2))) return null;
    const observedAt = new Date(input.now === undefined ? Date.now() : Date.parse(input.now)).toISOString();
    return { symbol: input.symbol, underlyingSymbol: input.underlyingSymbol,
      tokenAddress: input.tokenAddress.toLowerCase(), wrapperAddress: input.wrapperAddress.toLowerCase(),
      issuerHalted: data.isTradingHalted || trading.isTradingHalted, observedAt };
  } catch { return null; }
}

export interface XStocksBscQuantityRequest {
  readonly instrumentId: string;
  readonly identity: XStocksBscIdentity;
  readonly rpcUrl: string;
  readonly maxBlockAgeMs: number;
  readonly maxIdentityAgeMs: number;
  readonly now?: string;
}

/** Maps stable wrapper base units to reference-share units at one BSC block. */
export async function fetchXStocksBscWrappedQuantity(input: XStocksBscQuantityRequest,
  fetcher: typeof fetch = fetch): Promise<QuantityEvidence | null> {
  if (!input.instrumentId || input.identity.issuerHalted
    || !address(input.identity.tokenAddress) || !address(input.identity.wrapperAddress)
    || !/^https:\/\//.test(input.rpcUrl)
    || !Number.isSafeInteger(input.maxBlockAgeMs) || input.maxBlockAgeMs <= 0
    || !Number.isSafeInteger(input.maxIdentityAgeMs) || input.maxIdentityAgeMs <= 0
    || (input.now !== undefined && !Number.isFinite(Date.parse(input.now)))) return null;
  let id = 0;
  const rpc = async (method: string, params: unknown[]): Promise<unknown> => {
    const requestId = ++id;
    const response = await fetcher(input.rpcUrl, { method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", id: requestId, method, params }),
      signal: AbortSignal.timeout(5000) });
    if (!response.ok) throw new Error("RPC unavailable");
    const body = await response.json() as Record<string, unknown>;
    if (body.error || body.id !== requestId) throw new Error("RPC error");
    return body.result;
  };
  const call = async (to: string, abi: Interface, method: string, args: readonly unknown[], block: string): Promise<unknown> => {
    const result = await rpc("eth_call", [{ to, data: abi.encodeFunctionData(method, args) }, block]);
    if (typeof result !== "string") throw new Error("Invalid call result");
    return abi.decodeFunctionResult(method, result)[0];
  };
  try {
    if (await rpc("eth_chainId", []) !== "0x38") return null;
    const block = await rpc("eth_blockNumber", []);
    if (!hex(block)) return null;
    const header = await rpc("eth_getBlockByNumber", [block, false]);
    if (!header || typeof header !== "object") return null;
    const fields = header as Record<string, unknown>;
    if (fields.number !== block || !hex(fields.timestamp)) return null;
    const blockMs = BigInt(fields.timestamp) * 1000n;
    const nowMs = BigInt(input.now === undefined ? Date.now() : Date.parse(input.now));
    const identityMs = Date.parse(input.identity.observedAt);
    if (!Number.isFinite(identityMs) || BigInt(identityMs) > nowMs
      || nowMs - BigInt(identityMs) > BigInt(input.maxIdentityAgeMs)
      || blockMs > nowMs || nowMs - blockMs > BigInt(input.maxBlockAgeMs)) return null;
    const token = input.identity.tokenAddress;
    const wrapper = input.identity.wrapperAddress;
    const [tokenCode, wrapperCode, tokenDecimals, wrapperDecimals, wrappedAsset,
      multiplier, converted] = await Promise.all([
      rpc("eth_getCode", [token, block]), rpc("eth_getCode", [wrapper, block]),
      call(token, tokenAbi, "decimals", [], block),
      call(wrapper, wrapperAbi, "decimals", [], block),
      call(wrapper, wrapperAbi, "asset", [], block),
      call(token, tokenAbi, "getCurrentMultiplier", [], block),
      call(wrapper, wrapperAbi, "convertToAssets", [unit], block)
    ]);
    if (typeof tokenCode !== "string" || typeof wrapperCode !== "string"
      || !/^0x(?:[0-9a-fA-F]{2})+$/.test(tokenCode)
      || !/^0x(?:[0-9a-fA-F]{2})+$/.test(wrapperCode)
      || tokenDecimals !== 18n || wrapperDecimals !== 18n
      || !address(wrappedAsset) || !same(wrappedAsset, token)
      || typeof multiplier !== "bigint" || multiplier <= 0n
      || converted !== multiplier) return null;
    const observedAt = new Date(Number(blockMs)).toISOString();
    return { instrumentId: input.instrumentId,
      source: `xstocks-bsc-wrapper:${wrapper.toLowerCase()}`,
      observedAt, expiresAt: new Date(Number(blockMs) + input.maxBlockAgeMs).toISOString(),
      quantityModel: "xstocks-v2-wrapper", adapterVersion: "1",
      mappingRevision: `bsc:${token.toLowerCase()}:${wrapper.toLowerCase()}:${multiplier}:${keccak256(tokenCode)}:${keccak256(wrapperCode)}`,
      sourceBlock: BigInt(block), shareUnitsNumerator: multiplier,
      shareUnitsDenominator: unit };
  } catch { return null; }
}
