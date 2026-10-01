/** Public, read-only P5.5d research. No wallet, signer, approval, send or risk override. */
import { createHash } from "node:crypto";
import { pathToFileURL } from "node:url";
import { Interface, id as roleId, keccak256 } from "ethers";

const BEACON = "0x156d6dce9a4f6139a3406f1f021f1a4880de93a3";
const TOKEN = "0x02fca66c1d1afb4e2a7884261eb00f63598a7436";
const OPERATOR = "0x5948602680fe4aea08d98302337a2715b3aadad1";
const BURN = "0xc94e485510c458860f89d23dcb8dd34bd10e6b8b";
const IMPL_SLOT = "0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc";
const ADMIN_SLOT = "0xb53127684a568b3173ae13b9f8a6016e243e63b6e8ee1178d6a717850b5d6103";
const BEACON_SLOT = "0xa3f0ad74e5423aebfd80d3ef4346578335a9a72aeaee59ff6cb3582b35133d50";
const abi = new Interface([
  "function owner() view returns (address)", "function implementation() view returns (address)",
  "function compliance() view returns (address)", "function pauseManager() view returns (address)",
  "function mintEnabled() view returns (bool)", "function burnEnabled() view returns (bool)",
  "function operator() view returns (address)", "function paused() view returns (bool)",
  "function numOfHotWallets() view returns (uint256)", "function hotWallets(uint256) view returns (address)",
  "function isHotWallet(address) view returns (bool)", "function getRoleMembers(bytes32) view returns (address[])",
  "function upgradeTo(address)", "function initialize(address)",
  "function execTransaction(address,uint256,bytes) payable returns (bool)", "function burn(address,uint256) returns (bool)"
]);
const digest = data => createHash("sha256").update(JSON.stringify(data)).digest("hex");
const address = value => {
  if (typeof value !== "string" || !/^0x[0-9a-fA-F]{40}$/.test(value)) throw Error("Invalid address evidence.");
  return value.toLowerCase();
};
const slotAddress = value => {
  if (typeof value !== "string" || !/^0x0{24}[0-9a-fA-F]{40}$/.test(value)) throw Error("Invalid address slot.");
  return address(`0x${value.slice(-40)}`);
};
export function probeOutcome(r, label, name, expectSuccess) {
  // Transport/internal RPC errors must not become negative permission evidence.
  if (r.error && !/execution reverted/i.test(r.error.message ?? ""))
    throw Error(`Non-execution RPC error during ${label}: ${r.error.message ?? "unavailable"}.`);
  const success = !r.error && typeof r.result === "string" && /^0x(?:[0-9a-fA-F]{2})*$/.test(r.result);
  if (!r.error && !success) throw Error(`Malformed probe result: ${label}.`);
  if (success && ["execTransaction", "burn"].includes(name) && abi.decodeFunctionResult(name, r.result)[0] !== true)
    throw Error(`Contract returned false during ${label}.`);
  if (success !== expectSuccess) throw Error(`Unexpected authorization result: ${label}.`);
  return { success, ...(r.error ? { errorCode: r.error.code,
    revertData: typeof r.error.data === "string" ? r.error.data : null } : { returnData: r.result }) };
}
export async function inspect(url, blockNumber, expectedHash) {
  if (blockNumber !== undefined && !/^0x(?:0|[1-9a-f][0-9a-f]*)$/.test(blockNumber))
    throw Error("Explicit block must be a hexadecimal quantity.");
  const endpoint = new URL(url);
  if (endpoint.protocol !== "https:" || endpoint.username || endpoint.password || endpoint.search || endpoint.hash)
    throw Error("Trusted HTTPS RPC required.");
  let nextId = 0;
  let nextRead = Promise.resolve();
  const request = async (method, params) => {
    if (!["eth_chainId", "eth_getBlockByNumber", "eth_getCode", "eth_getStorageAt", "eth_call"].includes(method))
      throw Error("Read-only RPC method required.");
    const id = ++nextId;
    const previous = nextRead;
    let release;
    nextRead = new Promise(resolve => { release = resolve; });
    await previous;
    try {
      let r, body;
      for (let attempt = 0; attempt < 3; attempt++) {
        try {
          r = await fetch(endpoint.href, { method: "POST", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ jsonrpc: "2.0", id, method, params }), signal: AbortSignal.timeout(10_000) });
          body = await r.text();
          if (r.status === 429 || r.status >= 500) {
            if (attempt < 2) {
              await new Promise(resolve => setTimeout(resolve, 1000 * (attempt + 1)));
              continue;
            }
          }
          break;
        } catch {
          if (attempt === 2) throw Error(`RPC ${endpoint.hostname} ${method} transport unavailable.`);
          await new Promise(resolve => setTimeout(resolve, 1000 * (attempt + 1)));
        }
      }
      if (!r.ok) throw Error(`RPC ${endpoint.hostname} ${method} HTTP ${r.status}.`);
      const data = JSON.parse(body);
      if (data.jsonrpc !== "2.0" || data.id !== id) throw Error("Mismatched RPC response.");
      return data;
    } finally {
      // Bound anonymous endpoint load, including concurrently requested role reads.
      setTimeout(release, 200);
    }
  };
  const rpc = async (method, params) => {
    const r = await request(method, params);
    if (r.error || !Object.hasOwn(r, "result")) throw Error(`RPC ${endpoint.hostname} ${method} unavailable: ${r.error?.message ?? "missing result"}.`);
    return r.result;
  };
  if (await rpc("eth_chainId", []) !== "0x38") throw Error("BSC chain 56 required.");
  // Let public nodes converge before hash-pinning the complete observation.
  if (!blockNumber) {
    const latest = await rpc("eth_getBlockByNumber", ["latest", false]);
    if (!latest || !/^0x[0-9a-f]+$/.test(latest.number) || BigInt(latest.number) < 64n)
      throw Error("Invalid latest block.");
    blockNumber = `0x${(BigInt(latest.number) - 64n).toString(16)}`;
  }
  const head = await rpc("eth_getBlockByNumber", [blockNumber, false]);
  if (!head || !/^0x[0-9a-f]+$/.test(head.number) || !/^0x[0-9a-f]{64}$/.test(head.hash)
    || !/^0x[0-9a-f]+$/.test(head.timestamp) || (expectedHash && head.hash !== expectedHash)) throw Error("Invalid canonical head.");
  const header = { number: head.number, hash: head.hash, timestamp: head.timestamp };
  const ref = { blockHash: head.hash, requireCanonical: true };
  const storage = (to, slot) => rpc("eth_getStorageAt", [to, slot, ref]);
  const runtime = async to => {
    const code = await rpc("eth_getCode", [to, ref]);
    if (typeof code !== "string" || !/^0x(?:[0-9a-fA-F]{2})*$/.test(code)) throw Error("Runtime evidence unavailable.");
    return { address: to, code, codeHash: keccak256(code), bytes: (code.length - 2) / 2 };
  };
  const call = async (to, name, args = [], from) => {
    const result = await rpc("eth_call", [{ to, ...(from ? { from } : {}), data: abi.encodeFunctionData(name, args) }, ref]);
    return abi.decodeFunctionResult(name, result)[0];
  };
  const roles = async to => Object.fromEntries(await Promise.all([
    ["admin", `0x${"0".repeat(64)}`], ["issuer", roleId("ISSUER_ROLE")],
    ["operations", roleId("OPS_ROLE")], ["compliance", roleId("COMPLIANCE_ROLE")]
  ].map(async ([name, role]) => {
    const values = [...await call(to, "getRoleMembers", [role])].map(address).sort();
    if (values.length > 64 || new Set(values).size !== values.length) throw Error("Invalid role set.");
    return [name, values];
  })));
  const stock = { ...await runtime(TOKEN), beaconWord: await storage(TOKEN, BEACON_SLOT),
    implementationWord: await storage(TOKEN, IMPL_SLOT),
    compliance: address(await call(TOKEN, "compliance")), pauseManager: address(await call(TOKEN, "pauseManager")),
    mintEnabled: await call(TOKEN, "mintEnabled"), burnEnabled: await call(TOKEN, "burnEnabled") };
  if (slotAddress(stock.beaconWord) !== BEACON || stock.implementationWord !== `0x${"0".repeat(64)}`)
    throw Error("NVDAB no longer uses the inspected beacon.");
  const beacon = { ...await runtime(BEACON), owner: address(await call(BEACON, "owner")),
    implementation: address(await call(BEACON, "implementation", [], TOKEN)),
    ownerWord: await storage(BEACON, "0x0"), implementationWord: await storage(BEACON, "0x1") };
  if (slotAddress(beacon.ownerWord) !== beacon.owner || slotAddress(beacon.implementationWord) !== beacon.implementation)
    throw Error("Beacon storage/getter mismatch.");
  const proxies = await Promise.all([OPERATOR, BURN].map(async to => {
    const implementation = slotAddress(await storage(to, IMPL_SLOT)), admin = slotAddress(await storage(to, ADMIN_SLOT));
    const beaconWord = await storage(to, BEACON_SLOT);
    if (beaconWord !== `0x${"0".repeat(64)}`) throw Error("Unexpected proxy beacon.");
    const owner = address(await call(to, "owner"));
    const result = { ...await runtime(to), type: to === OPERATOR ? "OperatorWallet" : "BurnWallet", implementation,
      implementationRuntime: await runtime(implementation), admin, owner, beaconWord,
      initializedWord: await storage(to, "0x0") };
    if (to === OPERATOR) {
      result.operator = address(await call(to, "operator"));
      result.paused = await call(to, "paused");
      const count = Number(await call(to, "numOfHotWallets"));
      if (!Number.isSafeInteger(count) || count < 0 || count > 100) throw Error("Unbounded hot-wallet list.");
      result.hotWallets = await Promise.all(Array.from({ length: count }, async (_, i) => address(await call(to, "hotWallets", [i]))));
      result.storageWords = Object.fromEntries(await Promise.all([151, 152, 153, 155].map(async slot =>
        [slot.toString(), await storage(to, `0x${slot.toString(16)}`)])));
      if (slotAddress(result.storageWords[151]) !== owner || slotAddress(result.storageWords[152]) !== result.operator
        || BigInt(result.storageWords[155]) !== BigInt(count)) throw Error("Operator storage/getter mismatch.");
      result.pendingOwner = slotAddress(result.storageWords[153]);
      result.hotWalletMembership = await Promise.all(result.hotWallets.map(async w => ({ address: w, member: await call(to, "isHotWallet", [w]) })));
      if (!result.hotWalletMembership.every(x => x.member)) throw Error("Hot-wallet membership mismatch.");
    } else {
      result.storageWords = Object.fromEntries(await Promise.all([101, 102].map(async slot =>
        [slot.toString(), await storage(to, `0x${slot.toString(16)}`)])));
      if (slotAddress(result.storageWords[101]) !== owner) throw Error("Burn owner storage/getter mismatch.");
      result.pendingOwner = slotAddress(result.storageWords[102]);
    }
    // Transparent proxy getters are checked with the actual administrator as caller.
    if (address(await call(to, "implementation", [], admin)) !== implementation) throw Error("Proxy admin getter mismatch.");
    return result;
  }));
  const roleSets = { token: await roles(TOKEN),
    compliance: await roles(stock.compliance), pauseManager: await roles(stock.pauseManager) };
  if (![OPERATOR, BURN].every(a => roleSets.token.issuer.includes(a)))
    throw Error("Inspected wallets are not both current token issuers.");
  const controlAddresses = [...new Set([beacon.owner, ...proxies.flatMap(p => [p.owner, p.admin, ...(p.operator ? [p.operator] : [])]),
    ...Object.values(roleSets).flatMap(sets => Object.values(sets).flat())])].sort();
  const accounts = await Promise.all(controlAddresses.map(runtime));
  const probes = [];
  const probe = async (label, to, name, args, from, expectSuccess) => {
    const r = await request("eth_call", [{ to, from, data: abi.encodeFunctionData(name, args) }, ref]);
    probes.push({ label, to, from, method: name, arguments: args, expectSuccess,
      ...probeOutcome(r, label, name, expectSuccess) });
  };
  const outsider = "0x1111111111111111111111111111111111111111";
  await probe("beacon-owner-can-upgrade", BEACON, "upgradeTo", [beacon.implementation], beacon.owner, true);
  await probe("beacon-outsider-cannot-upgrade", BEACON, "upgradeTo", [beacon.implementation], outsider, false);
  for (const p of proxies) {
    await probe(`${p.type}-admin-can-upgrade`, p.address, "upgradeTo", [p.implementation], p.admin, true);
    await probe(`${p.type}-outsider-cannot-upgrade`, p.address, "upgradeTo", [p.implementation], outsider, false);
    await probe(`${p.type}-admin-cannot-fallback`, p.address, "owner", [], p.admin, false);
  }
  const op = proxies[0], burn = proxies[1];
  await probe("operator-owner-can-execute-zero-value-call", OPERATOR, "execTransaction", [op.owner, 0n, "0x"], op.owner, true);
  await probe("operator-outsider-cannot-execute", OPERATOR, "execTransaction", [op.owner, 0n, "0x"], outsider, false);
  await probe("burn-owner-can-burn-zero-own-tokens", BURN, "burn", [TOKEN, 0n], burn.owner, true);
  await probe("burn-outsider-cannot-burn", BURN, "burn", [TOKEN, 0n], outsider, false);
  const final = await rpc("eth_getBlockByNumber", [head.number, false]);
  if (!final || final.hash !== head.hash || final.number !== head.number) throw Error("Inspection block reorged.");
  return { source: endpoint.hostname, header, stock, beacon, proxies, roleSets, accounts, probes, canonicalAtEnd: true };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) try {
  const primary = await inspect(process.env.NEXUS_GOVERNANCE_RPC ?? "https://bsc.rpc.sentio.xyz",
    process.env.NEXUS_GOVERNANCE_BLOCK);
  console.error(`Primary inspection complete: ${primary.source}, block ${BigInt(primary.header.number)}.`);
  const secondary = await inspect(process.env.NEXUS_GOVERNANCE_BACKUP_RPC ?? "https://bsc-mainnet.public.blastapi.io",
    primary.header.number, primary.header.hash);
  const comparable = s => JSON.parse(JSON.stringify({ header: s.header, stock: s.stock, beacon: s.beacon, proxies: s.proxies,
    roleSets: s.roleSets, accounts: s.accounts,
    probes: s.probes.map(({ errorCode, ...p }) => p) }, (_k, v) => typeof v === "bigint" ? v.toString() : v));
  if (digest(comparable(primary)) !== digest(comparable(secondary))) throw Error("Public governance sources disagree.");
  console.log(JSON.stringify({ recordedAt: new Date().toISOString(), mode: "read-only", chainId: 56,
    sources: [primary, secondary], crossSourceMatch: true,
    scope: "Current source-backed permissions only; no custody identity, independent audit or risk acceptance." },
    (_k, v) => typeof v === "bigint" ? v.toString() : v, 2));
} catch (error) {
  console.error(error instanceof Error ? error.message : "Public governance inspection unavailable.");
  process.exitCode = 1;
}
