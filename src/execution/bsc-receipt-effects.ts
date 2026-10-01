import type { EoaReceiptEffectProof, EoaReceiptLog } from "./receipt-effects.js";

export interface BscReceiptEffectRequest {
  readonly rpcUrl: string;
  readonly transactionHash: string;
  readonly blockNumber: bigint;
  readonly blockHash: string;
}

const hash = (value: unknown): value is string => typeof value === "string"
  && /^0x[0-9a-fA-F]{64}$/.test(value);
const address = (value: unknown): value is string => typeof value === "string"
  && /^0x[0-9a-fA-F]{40}$/.test(value);
const quantity = (value: unknown): bigint | null => typeof value === "string"
  && /^0x(?:0|[1-9a-fA-F][0-9a-fA-F]*)$/.test(value) ? BigInt(value) : null;
const same = (left: string, right: string): boolean => left.toLowerCase() === right.toLowerCase();
const hex = (value: bigint): string => `0x${value.toString(16)}`;

/** Reads a canonical, transaction-bound receipt and its complete log set. */
export async function fetchBscReceiptEffectProof(input: BscReceiptEffectRequest,
  fetcher: typeof fetch = fetch): Promise<EoaReceiptEffectProof | null> {
  try {
    const url = new URL(input.rpcUrl);
    if (url.protocol !== "https:" || !url.hostname || url.username || url.password || url.hash
      || !hash(input.transactionHash) || !hash(input.blockHash)
      || input.blockNumber < 0n) return null;
    let id = 0;
    const rpc = async (method: string, params: unknown[]): Promise<unknown> => {
      const requestId = ++id;
      const response = await fetcher(input.rpcUrl, { method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jsonrpc: "2.0", id: requestId, method, params }),
        signal: AbortSignal.timeout(5000) });
      if (!response.ok) throw new Error("RPC unavailable");
      const body = await response.json() as Record<string, unknown>;
      if (body.id !== requestId || body.error || !Object.hasOwn(body, "result"))
        throw new Error("RPC error");
      return body.result;
    };
    if (quantity(await rpc("eth_chainId", [])) !== 56n) return null;
    const raw = await rpc("eth_getTransactionReceipt", [input.transactionHash]);
    if (!raw || typeof raw !== "object") return null;
    const receipt = raw as Record<string, unknown>;
    if (!hash(receipt.transactionHash) || !same(receipt.transactionHash, input.transactionHash)
      || !hash(receipt.blockHash) || !same(receipt.blockHash, input.blockHash)
      || quantity(receipt.blockNumber) !== input.blockNumber
      || !address(receipt.from) || !address(receipt.to)
      || (receipt.status !== "0x1" && receipt.status !== "0x0")
      || !Array.isArray(receipt.logs) || receipt.logs.length > 2048) return null;
    const gasUsed = quantity(receipt.gasUsed);
    const effectiveGasPrice = quantity(receipt.effectiveGasPrice);
    if (gasUsed === null || gasUsed === 0n || effectiveGasPrice === null) return null;
    const logs: EoaReceiptLog[] = [];
    let priorIndex = -1n;
    for (const item of receipt.logs) {
      if (!item || typeof item !== "object") return null;
      const log = item as Record<string, unknown>;
      const logIndex = quantity(log.logIndex);
      if (!address(log.address) || !hash(log.transactionHash)
        || !same(log.transactionHash, input.transactionHash)
        || !hash(log.blockHash) || !same(log.blockHash, input.blockHash)
        || quantity(log.blockNumber) !== input.blockNumber
        || logIndex === null || logIndex <= priorIndex
        || (log.removed !== false && log.removed !== undefined)
        || !Array.isArray(log.topics) || log.topics.length > 4
        || !log.topics.every(hash) || typeof log.data !== "string"
        || !/^0x(?:[0-9a-fA-F]{2})*$/.test(log.data)) return null;
      priorIndex = logIndex;
      logs.push({ address: log.address.toLowerCase(),
        transactionHash: log.transactionHash.toLowerCase(),
        blockHash: log.blockHash.toLowerCase(), blockNumber: input.blockNumber,
        logIndex, removed: false, topics: log.topics.map((topic: string) => topic.toLowerCase()),
        data: log.data.toLowerCase() });
    }
    const canonical = await rpc("eth_getBlockByNumber", [hex(input.blockNumber), false]);
    if (!canonical || typeof canonical !== "object") return null;
    const block = canonical as Record<string, unknown>;
    if (quantity(block.number) !== input.blockNumber
      || !hash(block.hash) || !same(block.hash, input.blockHash)) return null;
    return { transactionHash: receipt.transactionHash.toLowerCase(),
      from: receipt.from.toLowerCase(), to: receipt.to.toLowerCase(),
      blockNumber: input.blockNumber, blockHash: input.blockHash.toLowerCase(),
      success: receipt.status === "0x1", gasUsed, effectiveGasPrice, logs };
  } catch { return null; }
}
