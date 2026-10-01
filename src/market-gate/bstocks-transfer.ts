import { Interface } from "ethers";
import { BSTOCKS_BSC_NVDAB, matchesReviewedBStocksControl } from "./bstocks-bsc.js";
import type { BStocksBscControlFingerprint, BStocksBscQuantitySnapshot } from "./bstocks-bsc.js";

/** Exact route candidate from the P5.5e direct-V3 probe. */
export const BSTOCKS_BSC_V3_POOL = "0x8fb4243b553ac29ba088acf00b9b7da24bd6690c";
export const BSTOCKS_BSC_V3_ROUTER = "0x1b81d678ffb9c0263b24a97847620c99d213eb14";
const address = (value: unknown): value is string =>
  typeof value === "string" && /^0x[0-9a-fA-F]{40}$/.test(value)
    && !/^0x0{40}$/i.test(value);
const hex = (value: unknown): value is string =>
  typeof value === "string" && /^0x[0-9a-fA-F]+$/.test(value);
const complianceAbi = new Interface([
  "function checkIsCompliant(address token,address user) view"
]);
const pauseAbi = new Interface([
  "function isTokenPaused(address token) view returns (bool)"
]);

export interface BStocksTransferPreflightRequest {
  readonly wallet: string;
  readonly side: "buy" | "sell";
  readonly snapshot: BStocksBscQuantitySnapshot;
  readonly reviewedControl: BStocksBscControlFingerprint;
  readonly rpcUrl: string;
  readonly maxBlockAgeMs: number;
  readonly now?: string;
}

/** On-chain restriction check only; it does not establish geographic or issuer eligibility. */
export async function fetchBStocksTransferPreflight(input: BStocksTransferPreflightRequest,
  fetcher: typeof fetch = fetch): Promise<{ readonly sourceBlock: bigint;
    readonly observedAt: string; readonly expiresAt: string;
    readonly wallet: string; readonly side: "buy" | "sell";
    readonly controlRevision: string } | null> {
  if (!address(input.wallet) || !["buy", "sell"].includes(input.side)
    || !/^https:\/\//.test(input.rpcUrl)
    || !Number.isSafeInteger(input.maxBlockAgeMs) || input.maxBlockAgeMs <= 0
    || (input.now !== undefined && !Number.isFinite(Date.parse(input.now)))
    || !Number.isFinite(Date.parse(input.snapshot.expiresAt))
    || input.snapshot.sourceBlock <= 0n
    || input.snapshot.control.token !== BSTOCKS_BSC_NVDAB
    || !matchesReviewedBStocksControl(input.snapshot, input.reviewedControl)) return null;
  let id = 0;
  const rpc = async (method: string, params: unknown[]): Promise<unknown> => {
    const requestId = ++id;
    const response = await fetcher(input.rpcUrl, { method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", id: requestId, method, params }),
      signal: AbortSignal.timeout(5000) });
    if (!response.ok) throw new Error("RPC unavailable");
    const body = await response.json() as Record<string, unknown>;
    if (body.jsonrpc !== "2.0" || body.error || body.id !== requestId) throw new Error("RPC error");
    return body.result;
  };
  try {
    if (await rpc("eth_chainId", []) !== "0x38") return null;
    const block = `0x${input.snapshot.sourceBlock.toString(16)}`;
    const header = await rpc("eth_getBlockByNumber", [block, false]);
    if (!header || typeof header !== "object") return null;
    const fields = header as Record<string, unknown>;
    if (fields.number !== block || !hex(fields.timestamp)
      || typeof fields.hash !== "string" || fields.hash !== input.snapshot.sourceBlockHash
      || !/^0x[0-9a-f]{64}$/.test(fields.hash)) return null;
    const blockRef = { blockHash: fields.hash, requireCanonical: true };
    const blockMs = BigInt(fields.timestamp) * 1000n;
    const nowMs = BigInt(input.now === undefined ? Date.now() : Date.parse(input.now));
    if (blockMs > nowMs || nowMs - blockMs > BigInt(input.maxBlockAgeMs)
      || new Date(Number(blockMs)).toISOString() !== input.snapshot.observedAt
      || Date.parse(input.snapshot.expiresAt) < Number(nowMs)) return null;
    const paused = await rpc("eth_call", [{ to: input.snapshot.control.pauseManager,
      data: pauseAbi.encodeFunctionData("isTokenPaused", [BSTOCKS_BSC_NVDAB]) }, blockRef]);
    if (typeof paused !== "string"
      || pauseAbi.decodeFunctionResult("isTokenPaused", paused)[0] !== false) return null;
    // The verified token checks the sender and recipient, plus the caller of
    // transferFrom. Check all route participants even when one path omits one.
    const participants = [input.wallet.toLowerCase(), BSTOCKS_BSC_V3_POOL,
      BSTOCKS_BSC_V3_ROUTER];
    const results = await Promise.all(participants.map(user => rpc("eth_call", [{
      to: input.snapshot.control.compliance,
      data: complianceAbi.encodeFunctionData("checkIsCompliant", [BSTOCKS_BSC_NVDAB, user])
    }, blockRef])));
    if (results.some(result => result !== "0x")) return null;
    const finalHeader = await rpc("eth_getBlockByNumber", [block, false]);
    if (!finalHeader || typeof finalHeader !== "object"
      || (finalHeader as Record<string, unknown>).hash !== input.snapshot.sourceBlockHash
      || (finalHeader as Record<string, unknown>).number !== block) return null;
    return { sourceBlock: input.snapshot.sourceBlock,
      observedAt: input.snapshot.observedAt,
      expiresAt: input.snapshot.expiresAt,
      wallet: input.wallet.toLowerCase(), side: input.side,
      controlRevision: input.snapshot.mappingRevision };
  } catch { return null; }
}
