import { amount, nativeAssetId, type Amount, type Denomination } from "../domain/amount.js";

export interface BscTrackedBalanceRequest {
  readonly rpcUrl: string;
  readonly wallet: string;
  /** Canonical receipt or finalized block chosen by the trusted recovery worker. */
  readonly blockNumber: bigint;
  readonly blockHash: string;
  /** Complete Nexus-tracked asset set from the trusted portfolio registry. */
  readonly assets: readonly Denomination[];
}

export interface BscTrackedBalanceSnapshot {
  readonly wallet: string;
  readonly blockNumber: bigint;
  readonly blockHash: string;
  readonly balances: readonly Amount[];
}

const address = (value: unknown): value is string => typeof value === "string"
  && /^0x[0-9a-fA-F]{40}$/.test(value) && !/^0x0{40}$/i.test(value);
const hash = (value: unknown): value is string => typeof value === "string"
  && /^0x[0-9a-fA-F]{64}$/.test(value);
const quantity = (value: unknown): bigint | null => typeof value === "string"
  && /^0x(?:0|[1-9a-fA-F][0-9a-fA-F]*)$/.test(value) ? BigInt(value) : null;
const hex = (value: bigint): string => `0x${value.toString(16)}`;
const same = (left: string, right: string): boolean => left.toLowerCase() === right.toLowerCase();
const maxStoredUnits = 10n ** 78n - 1n;

/** Reads every trusted portfolio asset at one block and checks its hash after each call. */
export async function fetchBscTrackedBalances(input: BscTrackedBalanceRequest,
  fetcher: typeof fetch = fetch): Promise<BscTrackedBalanceSnapshot | null> {
  try {
    const url = new URL(input.rpcUrl);
    if (url.protocol !== "https:" || !url.hostname || url.username || url.password || url.hash
      || !address(input.wallet) || !hash(input.blockHash) || input.blockNumber < 0n
      || input.assets.length === 0 || input.assets.length > 128) return null;
    const assets = new Map<string, Denomination>();
    for (const asset of input.assets) {
      amount(0n, asset);
      if (!asset.assetId.startsWith("eip155:56/") || assets.has(asset.assetId)
        || (asset.assetId === nativeAssetId(56) && asset.decimals !== 18)) return null;
      assets.set(asset.assetId, asset);
    }
    if (!assets.has(nativeAssetId(56))) return null;
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
    const blockTag = hex(input.blockNumber);
    const canonical = async (): Promise<boolean> => {
      const raw = await rpc("eth_getBlockByNumber", [blockTag, false]);
      if (!raw || typeof raw !== "object") return false;
      const block = raw as Record<string, unknown>;
      return quantity(block.number) === input.blockNumber
        && hash(block.hash) && same(block.hash, input.blockHash);
    };
    if (!await canonical()) return null;
    const balances: Amount[] = [];
    for (const asset of assets.values()) {
      let units: bigint | null;
      if (asset.assetId === nativeAssetId(56)) {
        units = quantity(await rpc("eth_getBalance", [input.wallet, blockTag]));
      } else {
        const token = asset.assetId.slice("eip155:56/erc20:".length);
        if (!address(token)) return null;
        const data = `0x70a08231${input.wallet.slice(2).toLowerCase().padStart(64, "0")}`;
        const raw = await rpc("eth_call", [{ to: token, data }, blockTag]);
        units = hash(raw) ? BigInt(raw) : null;
      }
      if (units === null || units > maxStoredUnits || !await canonical()) return null;
      balances.push(amount(units, asset));
    }
    return { wallet: input.wallet.toLowerCase(), blockNumber: input.blockNumber,
      blockHash: input.blockHash.toLowerCase(), balances };
  } catch { return null; }
}
