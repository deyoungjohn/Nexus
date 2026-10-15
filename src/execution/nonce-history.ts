import type { EoaChainObservation } from "./recovery.js";

export interface NonceHistoryAnchor {
  readonly blockNumber: bigint;
  readonly blockHash: string;
  readonly nonce: bigint;
}
type Rpc = (method: string, params: unknown[]) => Promise<unknown>;
const qty = (x: unknown): bigint | null => typeof x === "string" && /^0x(?:0|[1-9a-f][0-9a-f]*)$/i.test(x) ? BigInt(x) : null;
const hash = (x: unknown): x is string => typeof x === "string" && /^0x[0-9a-f]{64}$/i.test(x);
const hex = (x: bigint) => `0x${x.toString(16)}`;
const object = (x: unknown): Record<string, unknown> => {
  if (!x || typeof x !== "object" || Array.isArray(x)) throw Error("Missing canonical nonce evidence");
  return x as Record<string, unknown>;
};

/** Locate the first canonical block that consumed n; never authorizes replacement effects. */
export async function diagnoseNonceHistory(rpc: Rpc, input: {
  wallet: string; transactionHash: string; nonce: bigint; headBlock: bigint;
  latestNonce: bigint; anchor: NonceHistoryAnchor;
}): Promise<EoaChainObservation["replacement"]> {
  const { anchor, headBlock, wallet, nonce } = input;
  if (anchor.blockNumber < 0n || anchor.blockNumber >= headBlock || anchor.nonce < 0n
    || anchor.nonce > nonce || !hash(anchor.blockHash)) throw Error("Invalid trusted nonce anchor");
  const header = async (n: bigint, full = false) => {
    const b = object(await rpc("eth_getBlockByNumber", [hex(n), full]));
    if (qty(b.number) !== n || !hash(b.hash)) throw Error("Invalid canonical block");
    return b;
  };
  const start = await header(anchor.blockNumber), head = await header(headBlock);
  if (String(start.hash).toLowerCase() !== anchor.blockHash.toLowerCase()) throw Error("Bootstrap reorg");
  const count = async (n: bigint) => {
    const before = await header(n);
    const value = qty(await rpc("eth_getTransactionCount", [wallet, hex(n)]));
    const after = await header(n);
    if (value === null || before.hash !== after.hash) throw Error("Noncanonical nonce read");
    return value;
  };
  let lowerNonce = await count(anchor.blockNumber), upperNonce = await count(headBlock);
  if (lowerNonce !== anchor.nonce || lowerNonce > nonce || upperNonce <= nonce
    || upperNonce !== input.latestNonce) throw Error("Unqualified nonce interval");
  let low = anchor.blockNumber, high = headBlock;
  while (high - low > 1n) {
    const middle = (low + high) / 2n, value = await count(middle);
    if (value < lowerNonce || value > upperNonce) throw Error("Nonmonotonic nonce evidence");
    if (value > nonce) { high = middle; upperNonce = value; }
    else { low = middle; lowerNonce = value; }
  }
  const block = await header(high, true);
  if (!Array.isArray(block.transactions)) throw Error("Full transition block unavailable");
  const candidates = block.transactions.map(object).filter(tx =>
    typeof tx.from === "string" && tx.from.toLowerCase() === wallet.toLowerCase() && qty(tx.nonce) === nonce);
  if (candidates.length !== 1) throw Error("Nonce transition transaction is missing or ambiguous");
  const tx = candidates[0]!;
  if (!hash(tx.hash) || tx.hash.toLowerCase() === input.transactionHash.toLowerCase())
    throw Error("Original transaction receipt still unavailable");
  if (qty(tx.blockNumber) !== high || !hash(tx.blockHash)
    || tx.blockHash.toLowerCase() !== String(block.hash).toLowerCase())
    throw Error("Transition transaction block metadata is inconsistent");
  const r = object(await rpc("eth_getTransactionReceipt", [tx.hash]));
  if (typeof r.from !== "string" || r.from.toLowerCase() !== wallet.toLowerCase()
    || !hash(r.transactionHash) || r.transactionHash.toLowerCase() !== tx.hash.toLowerCase()
    || qty(r.blockNumber) !== high || r.blockHash !== block.hash
    || (r.status !== "0x1" && r.status !== "0x0")) throw Error("Replacement receipt is not canonical");
  if ((await header(high)).hash !== block.hash || (await header(headBlock)).hash !== head.hash
    || (await header(anchor.blockNumber)).hash !== start.hash) throw Error("Nonce history reorg");
  return { from: wallet.toLowerCase(), nonce, receipt: { hash: tx.hash.toLowerCase(),
    blockNumber: high, blockHash: String(block.hash).toLowerCase(), success: r.status === "0x1" } };
}
