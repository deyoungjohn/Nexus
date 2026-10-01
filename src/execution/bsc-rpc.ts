import type { EoaChainObservation, EoaReceipt } from "./recovery.js";

export interface EoaBscObservationRequest {
  readonly rpcUrl: string;
  readonly wallet: string;
  readonly transactionHash: string;
  /** Optional bounded canonical scan when the tracked receipt is missing. */
  readonly nonce?: bigint;
  readonly scanFromBlock?: bigint;
}

const hexQuantity = (value: unknown): bigint | null => typeof value === "string"
  && /^0x(?:0|[1-9a-fA-F][0-9a-fA-F]*)$/.test(value) ? BigInt(value) : null;
const hash = (value: unknown): value is string => typeof value === "string" && /^0x[0-9a-fA-F]{64}$/.test(value);
const wallet = (value: unknown): value is string => typeof value === "string" && /^0x[0-9a-fA-F]{40}$/.test(value);
const same = (a: string, b: string): boolean => a.toLowerCase() === b.toLowerCase();
const hex = (value: bigint): string => `0x${value.toString(16)}`;

/** Read-only BSC evidence. Missing receipts remain unknown, never failed. */
export async function fetchEoaBscObservation(input: EoaBscObservationRequest,
  fetcher: typeof fetch = fetch): Promise<EoaChainObservation | null> {
  try {
    const url = new URL(input.rpcUrl);
    if (url.protocol !== "https:" || !url.hostname || url.username || url.password || url.hash
      || !wallet(input.wallet) || !hash(input.transactionHash)) return null;
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
    if (await rpc("eth_chainId", []) !== "0x38") return null;
    const headBlock = hexQuantity(await rpc("eth_blockNumber", []));
    const latestNonce = hexQuantity(await rpc("eth_getTransactionCount", [input.wallet, "latest"]));
    if (headBlock === null || latestNonce === null) return null;
    if ((input.nonce === undefined) !== (input.scanFromBlock === undefined)
      || (input.nonce !== undefined && input.nonce < 0n)
      || (input.scanFromBlock !== undefined && (input.scanFromBlock < 0n
        || input.scanFromBlock > headBlock))) return null;
    const rawReceipt = await rpc("eth_getTransactionReceipt", [input.transactionHash]);
    let receipt: EoaReceipt | null = null;
    if (rawReceipt !== null) {
      if (!rawReceipt || typeof rawReceipt !== "object") return null;
      const fields = rawReceipt as Record<string, unknown>;
      const blockNumber = hexQuantity(fields.blockNumber);
      if (!hash(fields.transactionHash) || !same(fields.transactionHash, input.transactionHash)
        || !hash(fields.blockHash) || !wallet(fields.from) || !same(fields.from, input.wallet)
        || blockNumber === null || blockNumber > headBlock
        || (fields.status !== "0x1" && fields.status !== "0x0")) return null;
      const canonical = await rpc("eth_getBlockByNumber", [fields.blockNumber, false]);
      if (!canonical || typeof canonical !== "object") return null;
      const block = canonical as Record<string, unknown>;
      if (!hash(block.hash) || !same(block.hash, fields.blockHash)
        || hexQuantity(block.number) !== blockNumber) return null;
      receipt = { hash: fields.transactionHash.toLowerCase(), blockHash: fields.blockHash.toLowerCase(),
        blockNumber, success: fields.status === "0x1" };
    }
    let replacement: EoaChainObservation["replacement"] = null;
    if (receipt === null && input.nonce !== undefined && input.scanFromBlock !== undefined
      && latestNonce > input.nonce) {
      // A scan window must cover every candidate block; otherwise stay unresolved.
      if (headBlock - input.scanFromBlock + 1n > 32n) return null;
      for (let number = input.scanFromBlock; number <= headBlock; number += 1n) {
        const raw = await rpc("eth_getBlockByNumber", [hex(number), true]);
        if (!raw || typeof raw !== "object") return null;
        const block = raw as Record<string, unknown>;
        if (hexQuantity(block.number) !== number || !hash(block.hash)
          || !Array.isArray(block.transactions)) return null;
        for (const rawTx of block.transactions) {
          if (!rawTx || typeof rawTx !== "object") return null;
          const tx = rawTx as Record<string, unknown>;
          const txNonce = hexQuantity(tx.nonce);
          if (!wallet(tx.from) || !hash(tx.hash) || txNonce === null) return null;
          if (!same(tx.from, input.wallet) || txNonce !== input.nonce) continue;
          if (same(tx.hash, input.transactionHash) || replacement !== null) return null;
          const rawCandidate = await rpc("eth_getTransactionReceipt", [tx.hash]);
          if (!rawCandidate || typeof rawCandidate !== "object") return null;
          const candidate = rawCandidate as Record<string, unknown>;
          if (!hash(candidate.transactionHash) || !same(candidate.transactionHash, tx.hash)
            || !wallet(candidate.from) || !same(candidate.from, input.wallet)
            || hexQuantity(candidate.blockNumber) !== number
            || !hash(candidate.blockHash) || !same(candidate.blockHash, block.hash)
            || (candidate.status !== "0x1" && candidate.status !== "0x0")) return null;
          replacement = { from: input.wallet.toLowerCase(), nonce: input.nonce,
            receipt: { hash: tx.hash.toLowerCase(), blockNumber: number,
              blockHash: block.hash.toLowerCase(), success: candidate.status === "0x1" } };
        }
        const canonical = await rpc("eth_getBlockByNumber", [hex(number), false]);
        if (!canonical || typeof canonical !== "object") return null;
        const header = canonical as Record<string, unknown>;
        if (hexQuantity(header.number) !== number || !hash(header.hash)
          || !same(header.hash, block.hash)) return null;
      }
    }
    return { headBlock, latestNonce, receipt, replacement };
  } catch { return null; }
}
