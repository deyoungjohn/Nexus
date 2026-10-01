import { Transaction } from "ethers";
import type { Amount, Denomination } from "../domain/amount.js";
import { fetchBscTrackedBalances } from "./bsc-balances.js";

export interface ExecutionChainState {
  readonly chainId: 56; readonly wallet: string; readonly nonce: number;
  readonly blockNumber: bigint; readonly blockHash: string; readonly balances: readonly Amount[];
}
export interface ExecutionChainPort {
  state(wallet: string, assets: readonly Denomination[], now: string): Promise<ExecutionChainState | null>;
  /** One attempt only; every ambiguous/error response remains unknown. */
  send(claim: { hash: string; rawSignedTransaction: string }): Promise<"accepted" | "unknown">;
}
const quantity = (x: unknown): bigint | null => typeof x === "string"
  && /^0x(?:0|[1-9a-f][0-9a-f]*)$/.test(x) ? BigInt(x) : null;
const record = (x: unknown): Record<string, unknown> | null => x !== null && typeof x === "object"
  && !Array.isArray(x) ? x as Record<string, unknown> : null;

/** No signer, allowance mutation, state override, replacement or retry. */
export function createBscExecutionChain(rpcUrl: string, maxBlockAgeMs: number,
  fetcher: typeof fetch = fetch): ExecutionChainPort {
  const url = new URL(rpcUrl);
  if (url.protocol !== "https:" || url.username || url.password || url.search || url.hash
    || !Number.isSafeInteger(maxBlockAgeMs) || maxBlockAgeMs <= 0) throw Error("Invalid execution RPC configuration.");
  let nextId = 0;
  const rpc = async (method: string, params: unknown[]): Promise<unknown> => {
    const id = ++nextId;
    const response = await fetcher(url.href, { method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", id, method, params }), signal: AbortSignal.timeout(5_000) });
    const body = response.ok ? record(await response.json()) : null;
    if (!body || body.jsonrpc !== "2.0" || body.id !== id || body.error || !Object.hasOwn(body, "result"))
      throw Error("Execution RPC unavailable.");
    return body.result;
  };
  return {
    async state(wallet, assets, now) {
      try {
        if (!/^0x[0-9a-fA-F]{40}$/.test(wallet) || /^0x0{40}$/i.test(wallet)
          || await rpc("eth_chainId", []) !== "0x38") return null;
        const head = quantity(await rpc("eth_blockNumber", []));
        if (head === null) return null;
        const header = record(await rpc("eth_getBlockByNumber", [`0x${head.toString(16)}`, false]));
        const timestamp = quantity(header?.timestamp);
        if (!header || quantity(header.number) !== head || timestamp === null
          || typeof header.hash !== "string" || !/^0x[0-9a-f]{64}$/.test(header.hash)
          || !Number.isFinite(Date.parse(now)) || timestamp * 1000n > BigInt(Date.parse(now))
          || BigInt(Date.parse(now)) - timestamp * 1000n > BigInt(maxBlockAgeMs)) return null;
        const [mined, pending, code] = await Promise.all([
          rpc("eth_getTransactionCount", [wallet, { blockHash: header.hash, requireCanonical: true }]),
          rpc("eth_getTransactionCount", [wallet, "pending"]),
          rpc("eth_getCode", [wallet, { blockHash: header.hash, requireCanonical: true }])
        ]);
        const nonce = quantity(mined);
        if (nonce === null || nonce !== quantity(pending) || nonce > BigInt(Number.MAX_SAFE_INTEGER) || code !== "0x") return null;
        const balances = await fetchBscTrackedBalances({ rpcUrl, wallet, blockNumber: head,
          blockHash: header.hash, assets }, fetcher);
        const final = record(await rpc("eth_getBlockByNumber", [`0x${head.toString(16)}`, false]));
        if (!balances || final?.hash !== header.hash || quantity(final?.number) !== head) return null;
        return { chainId: 56, wallet: wallet.toLowerCase(), nonce: Number(nonce), blockNumber: head,
          blockHash: header.hash, balances: balances.balances };
      } catch { return null; }
    },
    async send(claim) {
      try {
        const tx = Transaction.from(claim.rawSignedTransaction);
        if (!tx.isSigned() || tx.type !== 2 || tx.chainId !== 56n || tx.value !== 0n
          || tx.hash !== claim.hash || await rpc("eth_chainId", []) !== "0x38") return "unknown";
        return await rpc("eth_sendRawTransaction", [claim.rawSignedTransaction]) === claim.hash ? "accepted" : "unknown";
      } catch { return "unknown"; }
    }
  };
}
