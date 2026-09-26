import { keccak256 } from "ethers";

/** EIP-1967 beacon slot used by the observed Ondo Stocks BSC token proxies. */
export const EIP1967_BEACON_SLOT = "0xa3f0ad74e5423aebfd80d3ef4346578335a9a72aeaee59ff6cb3582b35133d50";
const EMPTY_CODE_HASH = keccak256("0x");
const address = (x: unknown): x is string => typeof x === "string" && /^0x[0-9a-fA-F]{40}$/.test(x);
const code = (x: unknown): x is string => typeof x === "string" && /^0x(?:[0-9a-fA-F]{2})+$/.test(x);
const hex = (x: unknown): x is string => typeof x === "string" && /^0x[0-9a-fA-F]+$/.test(x);

export interface OndoBeaconFingerprint {
  readonly token: string;
  readonly sourceBlock: bigint;
  readonly observedAt: string;
  readonly proxyCodeHash: string;
  readonly beacon: string;
  readonly beaconCodeHash: string;
  readonly implementation: string;
  readonly implementationCodeHash: string;
}

/** A code identity check only. It does not classify the implementation as safe. */
export async function fetchOndoBeaconFingerprint(input: { readonly token: string;
  readonly rpcUrl: string; readonly maxBlockAgeMs: number; readonly now?: string },
fetcher: typeof fetch = fetch): Promise<OndoBeaconFingerprint | null> {
  if (!address(input.token) || !/^https:\/\//.test(input.rpcUrl)
    || !Number.isSafeInteger(input.maxBlockAgeMs) || input.maxBlockAgeMs <= 0) return null;
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
    if (!hex(block)) return null;
    const header = await rpc("eth_getBlockByNumber", [block, false]);
    if (!header || typeof header !== "object") return null;
    const fields = header as Record<string, unknown>;
    if (fields.number !== block || !hex(fields.timestamp)) return null;
    const blockMs = BigInt(fields.timestamp) * 1000n;
    const now = input.now === undefined ? Date.now() : Date.parse(input.now);
    if (!Number.isFinite(now) || blockMs > BigInt(now)
      || BigInt(now) - blockMs > BigInt(input.maxBlockAgeMs)) return null;
    const proxyCode = await rpc("eth_getCode", [input.token, block]);
    const slot = await rpc("eth_getStorageAt", [input.token, EIP1967_BEACON_SLOT, block]);
    if (!code(proxyCode) || typeof slot !== "string" || !/^0x[0-9a-fA-F]{64}$/.test(slot)
      || !/^0{24}$/.test(slot.slice(2, 26))) return null;
    const beacon = `0x${slot.slice(-40)}`.toLowerCase();
    if (!address(beacon) || /^0x0{40}$/.test(beacon)) return null;
    const beaconCode = await rpc("eth_getCode", [beacon, block]);
    const implementationWord = await rpc("eth_call", [{ to: beacon, data: "0x5c60da1b" }, block]);
    if (!code(beaconCode) || typeof implementationWord !== "string"
      || !/^0x[0-9a-fA-F]{64}$/.test(implementationWord)
      || !/^0{24}$/.test(implementationWord.slice(2, 26))) return null;
    const implementation = `0x${implementationWord.slice(-40)}`.toLowerCase();
    if (!address(implementation) || /^0x0{40}$/.test(implementation)) return null;
    const implementationCode = await rpc("eth_getCode", [implementation, block]);
    if (!code(implementationCode)) return null;
    const proxyCodeHash = keccak256(proxyCode);
    const beaconCodeHash = keccak256(beaconCode);
    const implementationCodeHash = keccak256(implementationCode);
    if ([proxyCodeHash, beaconCodeHash, implementationCodeHash].includes(EMPTY_CODE_HASH)) return null;
    return { token: input.token.toLowerCase(), sourceBlock: BigInt(block),
      observedAt: new Date(Number(blockMs)).toISOString(), proxyCodeHash,
      beacon, beaconCodeHash, implementation, implementationCodeHash };
  } catch { return null; }
}

export function fingerprintMatchesReview(actual: OndoBeaconFingerprint,
  reviewed: Pick<OndoBeaconFingerprint, "token" | "proxyCodeHash" | "beacon" | "beaconCodeHash"
    | "implementation" | "implementationCodeHash">): boolean {
  return actual.token.toLowerCase() === reviewed.token.toLowerCase()
    && actual.proxyCodeHash === reviewed.proxyCodeHash
    && actual.beacon === reviewed.beacon.toLowerCase()
    && actual.beaconCodeHash === reviewed.beaconCodeHash
    && actual.implementation === reviewed.implementation.toLowerCase()
    && actual.implementationCodeHash === reviewed.implementationCodeHash;
}
