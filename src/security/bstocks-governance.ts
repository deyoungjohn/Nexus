import { Interface, keccak256 } from "ethers";
import { reviewedSourcePin } from "./reviewed-source-pins.js";
import type { SecurityComponent, SecurityGovernance } from "./token-security.js";

export const BSTOCKS_WALLET_PROFILES = Object.freeze([
  Object.freeze({ profile: "bstocks-operator-wallet-v1" as const,
    address: "0x5948602680fe4aea08d98302337a2715b3aadad1",
    implementation: "0xd00eb2a87e7b699b75be975c2edae47d36cf07dd", name: "OperatorWallet" }),
  Object.freeze({ profile: "bstocks-burn-wallet-v1" as const,
    address: "0xc94e485510c458860f89d23dcb8dd34bd10e6b8b",
    implementation: "0x72f6389c01bffce7698fa5135cbf75191fe56d17", name: "BurnWallet" })
]);
const implementationSlot = "0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc";
const adminSlot = "0xb53127684a568b3173ae13b9f8a6016e243e63b6e8ee1178d6a717850b5d6103";
const beaconSlot = "0xa3f0ad74e5423aebfd80d3ef4346578335a9a72aeaee59ff6cb3582b35133d50";
const zero = `0x${"0".repeat(64)}`;
const abi = new Interface(["function owner() view returns (address)",
  "function implementation() view returns (address)", "function admin() view returns (address)",
  "function operator() view returns (address)", "function paused() view returns (bool)",
  "function numOfHotWallets() view returns (uint256)", "function hotWallets(uint256) view returns (address)",
  "function isHotWallet(address) view returns (bool)"]);
const normalize = (value: unknown): string => {
  if (typeof value !== "string" || !/^0x[0-9a-fA-F]{40}$/.test(value)) throw Error("Invalid governance address.");
  return value.toLowerCase();
};
const word = (value: unknown): string => {
  if (typeof value !== "string" || !/^0x[0-9a-fA-F]{64}$/.test(value)) throw Error("Invalid governance word.");
  return value.toLowerCase();
};
const addressWord = (value: unknown, allowZero = false): string => {
  const w = word(value);
  if (!/^0x0{24}/.test(w) || (!allowZero && w === zero)) throw Error("Invalid governance address slot.");
  return `0x${w.slice(-40)}`;
};

/** Known implementation layouts only. An upgrade needs new review, never guessed storage. */
export async function fetchBStocksGovernance(input: {
  readonly authorities: readonly { readonly address: string; readonly codeHash: string }[];
  readonly blockHash: string;
  readonly rpc: (method: string, params: unknown[]) => Promise<unknown>;
}): Promise<{ readonly governance: readonly SecurityGovernance[];
  readonly components: readonly Pick<SecurityComponent, "address" | "codeHash">[];
  readonly controllerAddresses: readonly string[] } | null> {
  try {
    const ref = { blockHash: input.blockHash, requireCanonical: true };
    const storage = (to: string, slot: string) => input.rpc("eth_getStorageAt", [to, slot, ref]);
    const call = async (to: string, name: string, args: unknown[] = [], from?: string) => {
      const data = await input.rpc("eth_call", [{ to, ...(from ? { from } : {}),
        data: abi.encodeFunctionData(name, args) }, ref]);
      if (typeof data !== "string") throw Error("Missing governance call.");
      return abi.decodeFunctionResult(name, data)[0];
    };
    const components: Array<Pick<SecurityComponent, "address" | "codeHash">> = [];
    const governance = await Promise.all(BSTOCKS_WALLET_PROFILES.map(async profile => {
      const authority = input.authorities.find(a => a.address === profile.address);
      const proxyPin = authority && reviewedSourcePin(authority.address, authority.codeHash);
      if (!authority || proxyPin?.certificate.contractName !== "UpgradeableProxy")
        throw Error("Unknown governance proxy identity.");
      const [implWord, adminWord, beaconWord, initializedWord, statusWord] = await Promise.all([
        storage(profile.address, implementationSlot), storage(profile.address, adminSlot),
        storage(profile.address, beaconSlot), storage(profile.address, "0x0"), storage(profile.address, "0x33")
      ]);
      const implementation = addressWord(implWord), admin = addressWord(adminWord);
      if (implementation !== profile.implementation || word(beaconWord) !== zero
        || BigInt(word(initializedWord)) !== 1n || BigInt(word(statusWord)) !== 1n)
        throw Error("Unknown or uninitialized governance layout.");
      const code = await input.rpc("eth_getCode", [implementation, ref]);
      if (typeof code !== "string" || !/^0x(?:[0-9a-fA-F]{2})+$/.test(code)) throw Error("Missing implementation code.");
      const implementationCodeHash = keccak256(code);
      if (reviewedSourcePin(implementation, implementationCodeHash)?.certificate.contractName !== profile.name)
        throw Error("Unreviewed governance implementation.");
      const ownerSlot = profile.profile === "bstocks-operator-wallet-v1" ? 151 : 101;
      const [ownerWord, pendingWord, ownerResult, adminResult, implementationResult] = await Promise.all([
        storage(profile.address, `0x${ownerSlot.toString(16)}`),
        storage(profile.address, `0x${(ownerSlot + (ownerSlot === 151 ? 2 : 1)).toString(16)}`),
        call(profile.address, "owner"), call(profile.address, "admin", [], admin),
        call(profile.address, "implementation", [], admin)
      ]);
      const owner = addressWord(ownerWord), pendingOwner = addressWord(pendingWord, true);
      if (normalize(ownerResult) !== owner || normalize(adminResult) !== admin
        || normalize(implementationResult) !== implementation) throw Error("Governance getter/storage mismatch.");
      let operator: string | null = null, paused: boolean | null = null;
      let hotWallets: string[] = [];
      if (profile.profile === "bstocks-operator-wallet-v1") {
        const [operatorWord, pauseWord, lengthWord, operatorResult, pausedResult, countResult] = await Promise.all([
          storage(profile.address, "0x98"), storage(profile.address, "0x65"), storage(profile.address, "0x9b"),
          call(profile.address, "operator"), call(profile.address, "paused"), call(profile.address, "numOfHotWallets")
        ]);
        operator = addressWord(operatorWord);
        if (typeof pausedResult !== "boolean" || typeof countResult !== "bigint"
          || countResult < 0n || countResult > 64n || BigInt(word(lengthWord)) !== countResult
          || BigInt(word(pauseWord)) !== (pausedResult ? 1n : 0n) || normalize(operatorResult) !== operator)
          throw Error("Operator controls mismatch.");
        paused = pausedResult;
        hotWallets = await Promise.all(Array.from({ length: Number(countResult) }, async (_, i) => {
          const wallet = normalize(await call(profile.address, "hotWallets", [i]));
          if (/^0x0{40}$/.test(wallet) || await call(profile.address, "isHotWallet", [wallet]) !== true)
            throw Error("Invalid hot-wallet membership.");
          return wallet;
        }));
        if (new Set(hotWallets).size !== hotWallets.length) throw Error("Duplicate hot-wallet membership.");
        hotWallets.sort();
      }
      components.push({ address: profile.address, codeHash: authority.codeHash },
        { address: implementation, codeHash: implementationCodeHash });
      return { profile: profile.profile, address: profile.address, codeHash: authority.codeHash,
        implementation, implementationCodeHash, admin, owner, pendingOwner, initialized: true,
        operator, paused, hotWallets };
    }));
    components.sort((a, b) => a.address < b.address ? -1 : a.address > b.address ? 1 : 0);
    return { governance, components, controllerAddresses: [...new Set(governance.flatMap(g =>
      [g.admin, g.owner, ...(g.operator ? [g.operator] : []),
        ...(!/^0x0{40}$/.test(g.pendingOwner) ? [g.pendingOwner] : [])]))].sort() };
  } catch { return null; }
}
