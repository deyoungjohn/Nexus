import { keccak256 } from "ethers";
import { DomainError, requireInput } from "../domain/errors.js";
import type { RecoveryAsset } from "./recovery-config.js";

export const RECOVERY_BEACON_SLOT = "0xa3f0ad74e5423aebfd80d3ef4346578335a9a72aeaee59ff6cb3582b35133d50";
const implementationSlot = "0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc";

/** Checks reviewed token code at the exact receipt block; a new implementation
 * needs a new review even if its reported balances/decimals appear unchanged.
 * null means unavailable evidence; a definite code mismatch requires review.
 */
export async function verifyBscRecoveryContracts(input: {
  readonly rpcUrl: string; readonly blockNumber: bigint; readonly blockHash: string;
  readonly assets: readonly RecoveryAsset[];
}, fetcher: typeof fetch = fetch): Promise<true | null> {
  requireInput(input.blockNumber >= 0n && /^0x[0-9a-fA-F]{64}$/.test(input.blockHash),
    "INVALID_RECOVERY_CONTRACT_INPUT", "Canonical receipt block required.");
  const assets = input.assets.filter(asset => asset.contract !== undefined);
  if (assets.length === 0) return true; // Preserve operator-reviewed legacy/fixture records.
  const url = new URL(input.rpcUrl);
  requireInput(url.protocol === "https:" && !url.username && !url.password && !url.search && !url.hash,
    "INVALID_RECOVERY_CONTRACT_INPUT", "Trusted HTTPS RPC required.");
  const block = `0x${input.blockNumber.toString(16)}`;
  let nextId = 0;
  const rpc = async (method: string, params: unknown[]): Promise<unknown> => {
    const id = ++nextId;
    const response = await fetcher(url.href, { method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", id, method, params }), signal: AbortSignal.timeout(5000) });
    if (!response.ok) throw new Error("Recovery contract RPC unavailable.");
    const body = await response.json() as Record<string, unknown>;
    if (body.jsonrpc !== "2.0" || body.id !== id || body.error || !Object.hasOwn(body, "result"))
      throw new Error("Recovery contract RPC malformed.");
    return body.result;
  };
  const canonical = async (): Promise<boolean> => {
    const result = await rpc("eth_getBlockByNumber", [block, false]);
    if (typeof result !== "object" || result === null) return false;
    const header = result as Record<string, unknown>;
    return header.number === block && typeof header.hash === "string"
      && header.hash.toLowerCase() === input.blockHash.toLowerCase();
  };
  const codeMatches = async (address: string, expected: string): Promise<void> => {
    const code = await rpc("eth_getCode", [address, block]);
    if (typeof code !== "string" || !/^0x(?:[0-9a-fA-F]{2})*$/.test(code))
      throw new Error("Recovery runtime evidence unavailable.");
    requireInput(code !== "0x" && keccak256(code) === expected,
      "RECOVERY_CONTRACT_CHANGED", "Reviewed token execution code changed.");
  };
  const addressResult = (value: unknown): string => {
    if (typeof value !== "string" || !/^0x0{24}[0-9a-fA-F]{40}$/.test(value))
      throw new Error("Recovery beacon identity unavailable.");
    return `0x${value.slice(-40).toLowerCase()}`;
  };
  try {
    if (await rpc("eth_chainId", []) !== "0x38" || !await canonical()) return null;
    for (const asset of assets) {
      const token = asset.assetId.split("erc20:")[1];
      requireInput(token !== undefined && /^eip155:56\/erc20:0x[0-9a-f]{40}$/.test(asset.assetId),
        "INVALID_RECOVERY_CONTRACT_INPUT", "Reviewed BSC token required.");
      const review = asset.contract!;
      await codeMatches(token, review.codeHash);
      const decimals = await rpc("eth_call", [{ to: token, data: "0x313ce567" }, block]);
      if (typeof decimals !== "string" || !/^0x[0-9a-fA-F]{64}$/.test(decimals))
        throw new Error("Recovery denomination evidence unavailable.");
      requireInput(BigInt(decimals) === BigInt(asset.decimals), "RECOVERY_CONTRACT_CHANGED", "Reviewed raw decimals changed.");
      if (review.kind === "beacon") {
        const beacon = addressResult(await rpc("eth_getStorageAt", [token, RECOVERY_BEACON_SLOT, block]));
        requireInput(beacon === review.beacon, "RECOVERY_CONTRACT_CHANGED", "Reviewed beacon changed.");
        const implementationWord = await rpc("eth_getStorageAt", [token, implementationSlot, block]);
        if (typeof implementationWord !== "string" || !/^0x[0-9a-fA-F]{64}$/.test(implementationWord))
          throw new Error("Recovery proxy evidence unavailable.");
        requireInput(BigInt(implementationWord) === 0n, "RECOVERY_CONTRACT_CHANGED", "Unexpected direct implementation slot.");
        await codeMatches(beacon, review.beaconCodeHash);
        // Same caller used by the verified proxy's implementation resolution.
        const implementation = addressResult(await rpc("eth_call", [{ from: token,
          to: beacon, data: "0x5c60da1b" }, block]));
        requireInput(implementation === review.implementation, "RECOVERY_CONTRACT_CHANGED", "Reviewed implementation changed.");
        await codeMatches(implementation, review.implementationCodeHash);
      }
    }
    return await canonical() ? true : null;
  } catch (error) {
    if (error instanceof DomainError) {
      if (error.code === "RECOVERY_CONTRACT_CHANGED") {
        // A mismatch observed during a reorg is unavailable evidence, rather
        // than proof of an upgrade at the expected canonical block.
        try { if (!await canonical()) return null; } catch { return null; }
      }
      throw error;
    }
    return null;
  }
}
