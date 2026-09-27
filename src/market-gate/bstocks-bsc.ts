import { AbiCoder, Interface, id as ethersId, keccak256 } from "ethers";

/** Exact initial candidate; a ticker or a new listing cannot replace this contract. */
export const BSTOCKS_BSC_NVDAB = "0x02fca66c1d1afb4e2a7884261eb00f63598a7436";
const BEACON_SLOT = "0xa3f0ad74e5423aebfd80d3ef4346578335a9a72aeaee59ff6cb3582b35133d50";
const IMPLEMENTATION_SLOT = "0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc";
const UNIT = 10n ** 18n;
const tokenAbi = new Interface([
  "function decimals() view returns (uint8)",
  "function supportsInterface(bytes4) view returns (bool)",
  "function uiMultiplier() view returns (uint256)",
  "function newUIMultiplier() view returns (uint256)",
  "function effectiveAt() view returns (uint256)",
  "function hasPendingMultiplier() view returns (bool)",
  "function pendingMultiplier() view returns (uint256,uint256)",
  "function compliance() view returns (address)",
  "function pauseManager() view returns (address)",
  "function DEFAULT_ADMIN_ROLE() view returns (bytes32)",
  "function ISSUER_ROLE() view returns (bytes32)",
  "function getRoleMembers(bytes32) view returns (address[])",
  "function mintEnabled() view returns (bool)",
  "function burnEnabled() view returns (bool)"
]);
const beaconAbi = new Interface([
  "function implementation() view returns (address)",
  "function owner() view returns (address)"
]);
const pauseAbi = new Interface(["function isTokenPaused(address) view returns (bool)"]);
const rolesAbi = new Interface(["function getRoleMembers(bytes32) view returns (address[])"]);
const address = (value: unknown): value is string =>
  typeof value === "string" && /^0x[0-9a-fA-F]{40}$/.test(value);
const code = (value: unknown): value is string =>
  typeof value === "string" && /^0x(?:[0-9a-fA-F]{2})+$/.test(value);
const hex = (value: unknown): value is string =>
  typeof value === "string" && /^0x[0-9a-fA-F]+$/.test(value);
const nonzeroAddress = (value: unknown): value is string =>
  address(value) && !/^0x0{40}$/i.test(value);
const slotAddress = (value: unknown): string | null => {
  if (typeof value !== "string" || !/^0x[0-9a-fA-F]{64}$/.test(value)
    || !/^0{24}$/i.test(value.slice(2, 26))) return null;
  const result = `0x${value.slice(-40)}`.toLowerCase();
  return nonzeroAddress(result) ? result : null;
};

export interface BStocksBscControlFingerprint {
  readonly token: string;
  readonly tokenCodeHash: string;
  readonly beacon: string;
  readonly beaconCodeHash: string;
  readonly implementation: string;
  readonly implementationCodeHash: string;
  readonly beaconOwner: string;
  readonly compliance: string;
  readonly complianceCodeHash: string;
  readonly pauseManager: string;
  readonly pauseManagerCodeHash: string;
  readonly adminMembersHash: string;
  readonly issuerMembersHash: string;
  readonly complianceAdminMembersHash: string;
  readonly complianceOpsMembersHash: string;
  readonly complianceMembersHash: string;
  readonly pauseAdminMembersHash: string;
  readonly pauseOpsMembersHash: string;
  readonly mintEnabled: boolean;
  readonly burnEnabled: boolean;
}

export interface BStocksBscQuantitySnapshot {
  readonly instrumentId: string;
  readonly source: string;
  readonly observedAt: string;
  readonly expiresAt: string;
  readonly sourceBlock: bigint;
  readonly rawDecimals: 18;
  readonly uiMultiplier: bigint;
  readonly pendingMultiplier: bigint | null;
  readonly pendingEffectiveAt: string | null;
  readonly tokenPaused: boolean;
  readonly mappingRevision: string;
  readonly control: BStocksBscControlFingerprint;
}

export interface BStocksBscQuantityRequest {
  readonly instrumentId: string;
  readonly tokenAddress: string;
  readonly rpcUrl: string;
  readonly maxBlockAgeMs: number;
  readonly now?: string;
}

/** Read-only identity and display mapping. It is not P5 reference-share or audit evidence. */
export async function fetchBStocksBscQuantity(input: BStocksBscQuantityRequest,
  fetcher: typeof fetch = fetch): Promise<BStocksBscQuantitySnapshot | null> {
  if (!input.instrumentId || !address(input.tokenAddress)
    || input.tokenAddress.toLowerCase() !== BSTOCKS_BSC_NVDAB
    || !/^https:\/\//.test(input.rpcUrl)
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
  const call = async (to: string, abi: Interface, method: string,
    args: readonly unknown[], block: string): Promise<readonly unknown[]> => {
    const result = await rpc("eth_call", [{ to, data: abi.encodeFunctionData(method, args) }, block]);
    if (typeof result !== "string") throw new Error("Invalid call result");
    return [...abi.decodeFunctionResult(method, result)];
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
    const nowMs = BigInt(input.now === undefined ? Date.now() : Date.parse(input.now));
    if (blockMs > nowMs || nowMs - blockMs > BigInt(input.maxBlockAgeMs)) return null;
    const token = BSTOCKS_BSC_NVDAB;
    const [tokenCode, beaconWord, implementationWord, decimals, core, extension, scheduledExtension,
      current, next, effective, hasPending, pending, complianceResult, pauseResult,
      adminRoleResult, issuerRoleResult, mintEnabledResult, burnEnabledResult] = await Promise.all([
      rpc("eth_getCode", [token, block]), rpc("eth_getStorageAt", [token, BEACON_SLOT, block]),
      rpc("eth_getStorageAt", [token, IMPLEMENTATION_SLOT, block]),
      call(token, tokenAbi, "decimals", [], block),
      call(token, tokenAbi, "supportsInterface", ["0xa60bf13d"], block),
      call(token, tokenAbi, "supportsInterface", ["0x4bd27648"], block),
      call(token, tokenAbi, "supportsInterface", ["0xeb0093dd"], block),
      call(token, tokenAbi, "uiMultiplier", [], block),
      call(token, tokenAbi, "newUIMultiplier", [], block),
      call(token, tokenAbi, "effectiveAt", [], block),
      call(token, tokenAbi, "hasPendingMultiplier", [], block),
      call(token, tokenAbi, "pendingMultiplier", [], block),
      call(token, tokenAbi, "compliance", [], block),
      call(token, tokenAbi, "pauseManager", [], block),
      call(token, tokenAbi, "DEFAULT_ADMIN_ROLE", [], block),
      call(token, tokenAbi, "ISSUER_ROLE", [], block),
      call(token, tokenAbi, "mintEnabled", [], block),
      call(token, tokenAbi, "burnEnabled", [], block)
    ]);
    const beacon = slotAddress(beaconWord);
    const compliance = complianceResult[0], pauseManager = pauseResult[0];
    const adminRole = adminRoleResult[0], issuerRole = issuerRoleResult[0];
    if (!code(tokenCode) || !beacon || !/^0x0{64}$/i.test(String(implementationWord))
      || decimals[0] !== 18n || core[0] !== true || extension[0] !== true
      || scheduledExtension[0] !== true
      || typeof current[0] !== "bigint" || current[0] <= 0n
      || typeof next[0] !== "bigint" || next[0] <= 0n
      || typeof effective[0] !== "bigint" || typeof hasPending[0] !== "boolean"
      || typeof mintEnabledResult[0] !== "boolean" || typeof burnEnabledResult[0] !== "boolean"
      || !nonzeroAddress(compliance) || !nonzeroAddress(pauseManager)
      || adminRole !== `0x${"0".repeat(64)}` || issuerRole !== ethersId("ISSUER_ROLE")) return null;
    const [beaconCode, implementationResult, ownerResult, complianceCode,
      pauseCode, pausedResult, adminMembersResult, issuerMembersResult,
      complianceAdminResult, complianceOpsResult, complianceRoleResult,
      pauseAdminResult, pauseOpsResult] = await Promise.all([
      rpc("eth_getCode", [beacon, block]),
      call(beacon, beaconAbi, "implementation", [], block),
      call(beacon, beaconAbi, "owner", [], block),
      rpc("eth_getCode", [compliance, block]),
      rpc("eth_getCode", [pauseManager, block]),
      call(pauseManager, pauseAbi, "isTokenPaused", [token], block),
      call(token, tokenAbi, "getRoleMembers", [adminRole], block),
      call(token, tokenAbi, "getRoleMembers", [issuerRole], block),
      call(compliance, rolesAbi, "getRoleMembers", [adminRole], block),
      call(compliance, rolesAbi, "getRoleMembers", [ethersId("OPS_ROLE")], block),
      call(compliance, rolesAbi, "getRoleMembers", [ethersId("COMPLIANCE_ROLE")], block),
      call(pauseManager, rolesAbi, "getRoleMembers", [adminRole], block),
      call(pauseManager, rolesAbi, "getRoleMembers", [ethersId("OPS_ROLE")], block)
    ]);
    const implementation = implementationResult[0], owner = ownerResult[0];
    if (!code(beaconCode) || !nonzeroAddress(implementation) || !nonzeroAddress(owner)
      || !code(complianceCode) || !code(pauseCode)
      || typeof pausedResult[0] !== "boolean"
      || implementation.toLowerCase() === beacon || implementation.toLowerCase() === token) return null;
    const members = (result: readonly unknown[], allowEmpty = false): string[] | null => {
      const list = result[0];
      if (!Array.isArray(list) || (!allowEmpty && list.length === 0) || list.length > 64
        || !list.every(nonzeroAddress)) return null;
      const normalized = list.map((entry: string) => entry.toLowerCase()).sort();
      return new Set(normalized).size === normalized.length ? normalized : null;
    };
    const admins = members(adminMembersResult), issuers = members(issuerMembersResult);
    const complianceAdmins = members(complianceAdminResult);
    const complianceOps = members(complianceOpsResult, true);
    const complianceMembers = members(complianceRoleResult, true);
    const pauseAdmins = members(pauseAdminResult);
    const pauseOps = members(pauseOpsResult, true);
    if (!admins || !issuers || !complianceAdmins || !complianceOps
      || !complianceMembers || !pauseAdmins || !pauseOps) return null;
    const implementationCode = await rpc("eth_getCode", [implementation, block]);
    if (!code(implementationCode)) return null;
    const pendingNow = hasPending[0];
    if (pendingNow) {
      if (effective[0] <= blockMs / 1000n || next[0] !== pending[0]
        || effective[0] !== pending[1]) return null;
    } else if (effective[0] !== 0n || next[0] !== current[0]
      || pending[0] !== 0n || pending[1] !== 0n) return null;
    const roleHash = (values: readonly string[]): string =>
      keccak256(AbiCoder.defaultAbiCoder().encode(["address[]"], [values]));
    const control: BStocksBscControlFingerprint = {
      token, tokenCodeHash: keccak256(tokenCode), beacon,
      beaconCodeHash: keccak256(beaconCode),
      implementation: implementation.toLowerCase(),
      implementationCodeHash: keccak256(implementationCode),
      beaconOwner: owner.toLowerCase(),
      compliance: compliance.toLowerCase(), complianceCodeHash: keccak256(complianceCode),
      pauseManager: pauseManager.toLowerCase(), pauseManagerCodeHash: keccak256(pauseCode),
      adminMembersHash: roleHash(admins), issuerMembersHash: roleHash(issuers),
      complianceAdminMembersHash: roleHash(complianceAdmins),
      complianceOpsMembersHash: roleHash(complianceOps),
      complianceMembersHash: roleHash(complianceMembers),
      pauseAdminMembersHash: roleHash(pauseAdmins),
      pauseOpsMembersHash: roleHash(pauseOps),
      mintEnabled: mintEnabledResult[0], burnEnabled: burnEnabledResult[0]
    };
    const observedAt = new Date(Number(blockMs)).toISOString();
    return { instrumentId: input.instrumentId, source: `bstocks-bsc:${token}`,
      observedAt, expiresAt: new Date(Number(blockMs) + input.maxBlockAgeMs).toISOString(),
      sourceBlock: BigInt(block), rawDecimals: 18, uiMultiplier: current[0],
      pendingMultiplier: pendingNow ? next[0] : null,
      pendingEffectiveAt: pendingNow ? new Date(Number(effective[0]) * 1000).toISOString() : null,
      tokenPaused: pausedResult[0],
      mappingRevision: `bsc:${token}:${current[0]}:${next[0]}:${effective[0]}:${Object.values(control).join(":")}`,
      control };
  } catch { return null; }
}

/** A changed code path, upgrade owner or scheduled multiplier invalidates review. */
export function matchesReviewedBStocksControl(snapshot: BStocksBscQuantitySnapshot,
  reviewed: BStocksBscControlFingerprint): boolean {
  return snapshot.pendingMultiplier === null && !snapshot.tokenPaused
    && (["token", "tokenCodeHash", "beacon", "beaconCodeHash", "implementation",
      "implementationCodeHash", "beaconOwner", "compliance", "complianceCodeHash",
      "pauseManager", "pauseManagerCodeHash", "adminMembersHash", "issuerMembersHash",
      "complianceAdminMembersHash", "complianceOpsMembersHash", "complianceMembersHash",
      "pauseAdminMembersHash", "pauseOpsMembersHash", "mintEnabled", "burnEnabled"] as const)
      .every(key => snapshot.control[key] === reviewed[key]);
}

/** Floor exactly like the BEP-677 display calculation; never use for transfers. */
export function bStocksDisplayedRaw(raw: bigint, snapshot: BStocksBscQuantitySnapshot): bigint {
  if (raw < 0n || snapshot.uiMultiplier <= 0n) throw new RangeError("Invalid raw amount or multiplier");
  return raw * snapshot.uiMultiplier / UNIT;
}
