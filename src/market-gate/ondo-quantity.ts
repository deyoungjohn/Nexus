import type { QuantityEvidence } from "./evidence.js";

/** Ondo's published BSC SyntheticSharesOracle. Only chain 56 is supported. */
export const ONDO_BSC_SHARES_ORACLE = "0xf4fd8a1b412633e10527454137a29db7aa35f15e";
const address = (value: string): boolean => /^0x[0-9a-fA-F]{40}$/.test(value);
const word = (data: string, index: number): bigint | null => {
  if (!/^0x(?:[0-9a-fA-F]{64})+$/.test(data) || data.length < 2 + 64 * (index + 1)) return null;
  return BigInt(`0x${data.slice(2 + index * 64, 2 + (index + 1) * 64)}`);
};

export interface OndoQuantityRequest {
  readonly instrumentId: string;
  readonly tokenAddress: string;
  readonly rpcUrl: string;
  readonly maxBlockAgeMs: number;
  /** Optional evaluation clock for deterministic tests; live reads use receipt time. */
  readonly now?: string;
}

/** Reads one pinned block; an absent asset, scheduled pause or malformed RPC response blocks. */
export async function fetchOndoBscQuantity(input: OndoQuantityRequest,
  fetcher: typeof fetch = fetch): Promise<QuantityEvidence | null> {
  if (!address(input.tokenAddress) || !/^https:\/\//.test(input.rpcUrl)
    || !Number.isSafeInteger(input.maxBlockAgeMs) || input.maxBlockAgeMs <= 0
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
    const blockMs = BigInt(timestamp) * 1000n;
    const token = input.tokenAddress.toLowerCase().slice(2).padStart(64, "0");
    const call = async (selector: string): Promise<string> => {
      const result = await rpc("eth_call", [{ to: ONDO_BSC_SHARES_ORACLE,
        data: `0x${selector}${token}` }, block]);
      if (typeof result !== "string") throw new Error("Invalid oracle response");
      return result;
    };
    const [primary, metadata] = await Promise.all([call("0a562827"), call("41fee44a")]);
    if (primary.length !== 2 + 64 * 2 || metadata.length !== 2 + 64 * 6) return null;
    const shares = word(primary, 0), paused = word(primary, 1);
    const mappedShares = word(metadata, 0), pending = word(metadata, 1);
    const lastUpdate = word(metadata, 2), pauseStart = word(metadata, 3);
    const nowMs = BigInt(input.now === undefined ? Date.now() : Date.parse(input.now));
    if (blockMs > nowMs || nowMs - blockMs > BigInt(input.maxBlockAgeMs)) return null;
    if (!shares || shares > (1n << 128n) - 1n || paused !== 0n
      || shares !== mappedShares || pending !== 0n || pauseStart !== 0n
      || !lastUpdate || lastUpdate > blockMs / 1000n) return null;
    const observedAt = new Date(Number(blockMs)).toISOString();
    return { instrumentId: input.instrumentId, source: `ondo-bsc-oracle:${ONDO_BSC_SHARES_ORACLE}`,
      observedAt, expiresAt: new Date(Number(blockMs) + input.maxBlockAgeMs).toISOString(),
      quantityModel: "ondo-synthetic-shares", adapterVersion: "1",
      mappingRevision: `bsc:${input.tokenAddress.toLowerCase()}:${shares}:${lastUpdate}`,
      sourceBlock: BigInt(block), shareUnitsNumerator: shares,
      shareUnitsDenominator: 10n ** 18n };
  } catch { return null; }
}
