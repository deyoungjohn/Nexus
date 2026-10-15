import type { ReferenceEvidence, SettlementEvidence } from "./evidence.js";

/** Addresses published in Chainlink's BSC mainnet feed directory. */
export const BSC_EQUITY_FEEDS = {
  NVDA: { proxy: "0xea5c2cbb5cd57dac24e26180b19a929f3e9699b8", description: "NVDA / USD" },
  AAPL: { proxy: "0xb7ed5be7977d61e83534230f3256c021e0fae0b6", description: "AAPL / USD" }
} as const;
export const BSC_USDT_USD_FEED = {
  proxy: "0xb97ad0e74fa7d920791e90258a6e2085088b4320", description: "USDT / USD"
} as const;
export const BSC_USDT_ASSET = "eip155:56/erc20:0x55d398326f99059ff775485246999027b3197955";

export type SupportedBscEquity = keyof typeof BSC_EQUITY_FEEDS;

export interface ChainlinkBscEquityRequest {
  readonly underlyingId: SupportedBscEquity;
  readonly rpcUrl: string;
  readonly maxBlockAgeMs: number;
  readonly maxReferenceAgeMs: number;
  /** Optional deterministic test clock; live reads use receipt time. */
  readonly now?: string;
}

export interface ChainlinkBscSettlementRequest extends Omit<ChainlinkBscEquityRequest, "underlyingId"> {
  /** Conservative haircut added in both directions around the feed answer. */
  readonly uncertaintyBps: number;
  /** Reject a settlement token whose observed USD price has moved too far from $1. */
  readonly maxPegDeviationBps: number;
}

type Feed = { readonly proxy: string; readonly description: string };
type Round = { readonly answer18: bigint; readonly updatedAt: string;
  readonly receivedAt: string; readonly source: string; readonly observation?: import("../pilot/price-integrity.js").PilotFeedObservation };

const word = (value: string, index: number): bigint | null => {
  if (!/^0x(?:[0-9a-fA-F]{64})+$/.test(value) || value.length < 2 + 64 * (index + 1)) return null;
  return BigInt(`0x${value.slice(2 + index * 64, 2 + (index + 1) * 64)}`);
};

const description = (value: string): string | null => {
  if (!/^0x[0-9a-fA-F]+$/.test(value) || word(value, 0) !== 32n) return null;
  const size = word(value, 1);
  if (size === null || size <= 0n || size > 64n || value.length < 2 + 128 + Number(size) * 2) return null;
  return Buffer.from(value.slice(2 + 128, 2 + 128 + Number(size) * 2), "hex").toString("utf8");
};

/** Reads a single Chainlink round at one BSC block; stale/unsupported data returns null. */
async function fetchRound(input: Omit<ChainlinkBscEquityRequest, "underlyingId">,
  feed: Feed, fetcher: typeof fetch, inspect=false): Promise<Round | null> {
  if (!/^https:\/\//.test(input.rpcUrl)
    || !Number.isSafeInteger(input.maxBlockAgeMs) || input.maxBlockAgeMs <= 0
    || !Number.isSafeInteger(input.maxReferenceAgeMs) || input.maxReferenceAgeMs <= 0
    || (input.now !== undefined && !Number.isFinite(Date.parse(input.now)))) return null;
  let nextId = 0;
  const rpc = async (method: string, params: unknown[]): Promise<unknown> => {
    const id = ++nextId;
    const response = await fetcher(input.rpcUrl, { method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", id, method, params }),
      signal: AbortSignal.timeout(5000) });
    if (!response.ok) throw new Error("RPC unavailable");
    const body = await response.json() as Record<string, unknown>;
    if (body.error || body.id !== id) throw new Error("RPC error");
    return body.result;
  };
  try {
    if (await rpc("eth_chainId", []) !== "0x38") return null;
    const block = await rpc("eth_blockNumber", []);
    if (typeof block !== "string" || !/^0x[0-9a-fA-F]+$/.test(block)) return null;
    const header = await rpc("eth_getBlockByNumber", [block, false]);
    if (!header || typeof header !== "object") return null;
    const fields = header as Record<string, unknown>;
    if (fields.number !== block) return null;
    const timestamp = fields.timestamp;
    if (typeof timestamp !== "string" || !/^0x[0-9a-fA-F]+$/.test(timestamp)) return null;
    const call = async (selector: string): Promise<string> => {
      const ref=inspect?{blockHash:fields.hash,requireCanonical:true}:block;
      const value = await rpc("eth_call", [{ to: feed.proxy, data: `0x${selector}` }, ref]);
      if (typeof value !== "string") throw new Error("Invalid feed response");
      return value;
    };
    const [round, decimals, label] = await Promise.all([
      call("feaf968c"), call("313ce567"), call("7284e416")]);
    if (round.length !== 2 + 64 * 5 || decimals.length !== 2 + 64
      || word(decimals, 0) !== 8n || description(label) !== feed.description) return null;
    const roundId = word(round, 0), answer = word(round, 1), startedAt = word(round, 2);
    const updatedAt = word(round, 3), answeredInRound = word(round, 4);
    const blockMs = BigInt(timestamp) * 1000n;
    const nowMs = BigInt(input.now === undefined ? Date.now() : Date.parse(input.now));
    if(inspect) {
      if(roundId===null||answer===null||startedAt===null||answeredInRound===null||updatedAt===null
        ||updatedAt>8640000000000n||startedAt>8640000000000n||typeof fields.hash!=="string"||!/^0x[0-9a-f]{64}$/.test(fields.hash))return null;
      const end=await rpc("eth_getBlockByNumber",[block,false]) as Record<string,unknown>;
      if(end?.hash!==fields.hash||end.number!==block)return null;
      const signedAnswer=answer>=1n<<255n?answer-(1n<<256n):answer;
      const observation={source:`chainlink-bsc:${feed.proxy}`,roundId,answeredInRound,answer18:signedAnswer*10n**10n,
        startedAt:new Date(Number(startedAt*1000n)).toISOString(),updatedAt:new Date(Number(updatedAt*1000n)).toISOString(),observedAt:new Date(Number(nowMs)).toISOString(),
        sourceBlock:BigInt(block),sourceBlockHash:fields.hash,blockTimestamp:new Date(Number(blockMs)).toISOString()};
      return {source:observation.source,updatedAt:observation.updatedAt,receivedAt:observation.observedAt,
        answer18:observation.answer18,observation};
    }
    if (!roundId || !answer || answer >= 1n << 255n || !startedAt || !updatedAt
      || answeredInRound === null || answeredInRound < roundId
      || startedAt > updatedAt || updatedAt > blockMs / 1000n
      || blockMs > nowMs || nowMs - blockMs > BigInt(input.maxBlockAgeMs)
      || nowMs - updatedAt * 1000n > BigInt(input.maxReferenceAgeMs)) return null;
    return { source: `chainlink-bsc:${feed.proxy}`,
      updatedAt: new Date(Number(updatedAt * 1000n)).toISOString(),
      receivedAt: new Date(Number(nowMs)).toISOString(), answer18: answer * 10n ** 10n };
  } catch { return null; }
}

export async function fetchChainlinkBscEquity(input: ChainlinkBscEquityRequest,
  fetcher: typeof fetch = fetch): Promise<ReferenceEvidence | null> {
  const feed = BSC_EQUITY_FEEDS[input.underlyingId];
  if (!feed) return null;
  const round = await fetchRound(input, feed, fetcher);
  return round ? { underlyingId: input.underlyingId, source: round.source,
    sourceAt: round.updatedAt, receivedAt: round.receivedAt,
    pricePerShare: round.answer18 } : null;
}

/** USDT/USD depeg valuation. The source is capped by policy; uncertainty widens both bounds. */
export async function fetchChainlinkBscSettlement(input: ChainlinkBscSettlementRequest,
  fetcher: typeof fetch = fetch): Promise<SettlementEvidence | null> {
  if (!Number.isInteger(input.uncertaintyBps) || input.uncertaintyBps < 0
    || input.uncertaintyBps > 1000 || !Number.isInteger(input.maxPegDeviationBps)
    || input.maxPegDeviationBps < 0 || input.maxPegDeviationBps > 10_000) return null;
  const round = await fetchRound(input, BSC_USDT_USD_FEED, fetcher);
  if (!round) return null;
  const oneDollar = 10n ** 18n;
  const pegDeviation = round.answer18 >= oneDollar ? round.answer18 - oneDollar : oneDollar - round.answer18;
  if (pegDeviation * 10_000n > oneDollar * BigInt(input.maxPegDeviationBps)) return null;
  const lower = round.answer18 * BigInt(10_000 - input.uncertaintyBps) / 10_000n;
  const upper = (round.answer18 * BigInt(10_000 + input.uncertaintyBps) + 9_999n) / 10_000n;
  if (lower <= 0n) return null;
  return { source: round.source, observedAt: round.updatedAt,
    expiresAt: new Date(Date.parse(round.updatedAt) + input.maxReferenceAgeMs).toISOString(),
    valuationUnit: "USD-18", assetId: BSC_USDT_ASSET,
    lowerValueNumerator: lower, upperValueNumerator: upper,
    denominator: 10n ** 18n };
}

/** Retains invalid answers/clocks for P1/P3 diagnosis; no invalid sample authorizes a trade. */
export async function fetchPilotFeedObservation(input:Omit<ChainlinkBscEquityRequest,'underlyingId'>,
  kind:'equity'|'settlement',fetcher:typeof fetch=fetch) {
  return (await fetchRound(input,kind==='equity'?BSC_EQUITY_FEEDS.NVDA:BSC_USDT_USD_FEED,fetcher,true))?.observation??null;
}
