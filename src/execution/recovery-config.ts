import { createHash } from "node:crypto";
import { nativeAssetId, tokenAssetId, validateDenomination,
  type Denomination } from "../domain/amount.js";
import { identifier, requireInput } from "../domain/errors.js";
import type { EoaRecoveryContext } from "./store.js";

export interface RecoveryAsset extends Denomination {
  readonly semantics: "native-gas" | "erc20-transfer-net";
  readonly review: string;
  /** Receipt-block identity of the code reviewed for raw Transfer accounting. */
  readonly contract?: RecoveryContractReview;
}
export type RecoveryContractReview =
  | { readonly kind: "runtime"; readonly codeHash: string }
  | { readonly kind: "beacon"; readonly codeHash: string; readonly beacon: string;
      readonly beaconCodeHash: string; readonly implementation: string;
      readonly implementationCodeHash: string };
export interface RecoveryConfig {
  readonly version: 1;
  readonly registryVersion: string;
  readonly finalityBlocks: string;
  readonly sources: readonly { readonly id: string; readonly rpcUrl: string;
    readonly independence?: { readonly upstreamGroup:string; readonly reviewDigest:string; readonly reviewedAt:string } }[];
  readonly assets: readonly RecoveryAsset[];
}

/** Operator-owned configuration only; reject ambiguous/extra fields and unsafe URLs. */
export function parseRecoveryConfig(value: unknown): RecoveryConfig {
  const object = (input: unknown, keys: readonly string[], optional: readonly string[] = []): Record<string, unknown> => {
    requireInput(typeof input === "object" && input !== null && !Array.isArray(input),
      "INVALID_RECOVERY_CONFIG", "Expected a recovery configuration object.");
    const record = input as Record<string, unknown>;
    requireInput(Object.keys(record).every(key => keys.includes(key) || optional.includes(key))
      && keys.every(key => Object.hasOwn(record, key)), "INVALID_RECOVERY_CONFIG", "Unexpected configuration fields.");
    return record;
  };
  const root = object(value, ["version", "registryVersion", "finalityBlocks", "sources", "assets"]);
  requireInput(root.version === 1 && typeof root.registryVersion === "string"
    && typeof root.finalityBlocks === "string" && /^[1-9][0-9]{0,5}$/.test(root.finalityBlocks),
  "INVALID_RECOVERY_CONFIG", "Versioned registry and explicit positive finality depth required.");
  identifier(root.registryVersion);
  requireInput(Array.isArray(root.sources) && root.sources.length > 0 && root.sources.length <= 4
    && Array.isArray(root.assets) && root.assets.length > 0 && root.assets.length <= 128,
  "INVALID_RECOVERY_CONFIG", "Bounded source and reviewed asset lists required.");
  const sources = root.sources.map(value => {
    const row = object(value, ["id", "rpcUrl"], ["independence"]);
    requireInput(typeof row.id === "string" && typeof row.rpcUrl === "string",
      "INVALID_RECOVERY_CONFIG", "Source identity and HTTPS endpoint required.");
    identifier(row.id);
    let url: URL;
    try { url = new URL(row.rpcUrl); } catch { throw new Error("Invalid recovery RPC URL."); }
    requireInput(url.protocol === "https:" && !url.username && !url.password
      && !url.search && !url.hash, "INVALID_RECOVERY_CONFIG", "Use a public HTTPS RPC without embedded credentials.");
    let independence:RecoveryConfig['sources'][number]['independence'];
    if(row.independence!==undefined) {
      const record=object(row.independence,['upstreamGroup','reviewDigest','reviewedAt']);
      requireInput(typeof record.upstreamGroup==='string'&&typeof record.reviewDigest==='string'
        &&/^[0-9a-f]{64}$/.test(record.reviewDigest)&&typeof record.reviewedAt==='string'
        &&Number.isFinite(Date.parse(record.reviewedAt)),
      'INVALID_RECOVERY_CONFIG','Explicit reviewed RPC upstream independence required.');
      identifier(record.upstreamGroup);
      independence=Object.freeze({upstreamGroup:record.upstreamGroup,reviewDigest:record.reviewDigest,reviewedAt:record.reviewedAt});
    }
    return Object.freeze({ id: row.id, rpcUrl: url.href,...(independence?{independence}:{}) });
  });
  const assets = root.assets.map(value => {
    const row = object(value, ["assetId", "decimals", "semantics", "review"], ["contract"]);
    requireInput(typeof row.assetId === "string" && typeof row.decimals === "number"
      && typeof row.review === "string", "INVALID_RECOVERY_CONFIG", "Reviewed denominations required.");
    const denomination = { assetId: row.assetId, decimals: row.decimals };
    validateDenomination(denomination); identifier(row.review);
    requireInput(row.assetId.startsWith("eip155:56/")
      && (row.assetId === nativeAssetId(56)
        ? row.decimals === 18 && row.semantics === "native-gas"
        : row.semantics === "erc20-transfer-net"),
    "UNSUPPORTED_RECOVERY_ASSET", "Recovery supports BSC native gas and reviewed ERC20 Transfer net effects.");
    let contract: RecoveryContractReview | undefined;
    if (Object.hasOwn(row, "contract")) {
      requireInput(row.assetId !== nativeAssetId(56), "INVALID_RECOVERY_CONFIG", "Native gas has no token contract.");
      const candidate = row.contract as Record<string, unknown> | null;
      const review = object(candidate, candidate?.kind === "beacon"
        ? ["kind", "codeHash", "beacon", "beaconCodeHash", "implementation", "implementationCodeHash"]
        : ["kind", "codeHash"]);
      const hash = (value: unknown): value is string => typeof value === "string"
        && /^0x[0-9a-f]{64}$/.test(value);
      requireInput(hash(review.codeHash), "INVALID_RECOVERY_CONFIG", "Reviewed runtime code hash required.");
      if (review.kind === "runtime") contract = Object.freeze({ kind: "runtime", codeHash: review.codeHash });
      else {
        requireInput(review.kind === "beacon" && typeof review.beacon === "string"
          && typeof review.implementation === "string" && hash(review.beaconCodeHash)
          && hash(review.implementationCodeHash), "INVALID_RECOVERY_CONFIG", "Complete reviewed beacon path required.");
        const beacon = tokenAssetId(56, review.beacon).split("erc20:")[1]!;
        const implementation = tokenAssetId(56, review.implementation).split("erc20:")[1]!;
        requireInput(beacon !== implementation && row.assetId !== tokenAssetId(56, beacon)
          && row.assetId !== tokenAssetId(56, implementation), "INVALID_RECOVERY_CONFIG", "Distinct proxy, beacon and implementation required.");
        contract = Object.freeze({ kind: "beacon", codeHash: review.codeHash, beacon,
          beaconCodeHash: review.beaconCodeHash, implementation,
          implementationCodeHash: review.implementationCodeHash });
      }
    }
    return Object.freeze({ ...denomination, semantics: row.semantics as RecoveryAsset["semantics"],
      review: row.review, ...(contract === undefined ? {} : { contract }) });
  });
  requireInput(new Set(sources.map(row => row.id)).size === sources.length
    && new Set(sources.map(row => row.rpcUrl)).size === sources.length
    && new Set(assets.map(row => row.assetId)).size === assets.length
    && assets.some(row => row.assetId === nativeAssetId(56)),
  "INVALID_RECOVERY_CONFIG", "Unique sources/assets and native gas denomination required.");
  return Object.freeze({ version: 1, registryVersion: root.registryVersion,
    finalityBlocks: root.finalityBlocks, sources: Object.freeze(sources), assets: Object.freeze(assets) });
}

/** Safe durable binding: endpoint digests rather than URLs or potential path credentials. */
export function recoveryConfigurationRecord(config: RecoveryConfig): { hash: string; snapshot: unknown } {
  const snapshot = { ...config, sources: config.sources.map(source => ({ id: source.id,
    endpointHash: createHash("sha256").update(source.rpcUrl).digest("hex"),
    ...(source.independence?{independence:source.independence}:{}) })) };
  return { hash: createHash("sha256").update(JSON.stringify(snapshot)).digest("hex"), snapshot };
}

export function resolveRecoveryAssets(config: RecoveryConfig, context: EoaRecoveryContext): readonly Denomination[] {
  const registry = new Map(config.assets.map(asset => [asset.assetId, asset]));
  const required = new Map(context.balances.map(asset => [asset.assetId, asset.decimals]));
  const output = tokenAssetId(56, context.tokenOut);
  requireInput(required.has(nativeAssetId(56)) && required.has(tokenAssetId(56, context.tokenIn)),
    "INCOMPLETE_TRACKED_ASSETS", "Persisted native gas and input balances required.");
  const keys = new Set([...required.keys(), output]);
  return [...keys].map(assetId => {
    const asset = registry.get(assetId);
    requireInput(asset !== undefined && (!required.has(assetId) || required.get(assetId) === asset.decimals),
      "UNREVIEWED_RECOVERY_ASSET", "Every tracked asset and output must have a matching reviewed registry entry.");
    return { assetId: asset.assetId, decimals: asset.decimals };
  });
}
