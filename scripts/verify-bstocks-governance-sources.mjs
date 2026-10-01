/** Rebuild source evidence in a temporary compiler environment, without submitting verification. */
import { readFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";
import { createHash } from "node:crypto";
import { keccak256 } from "ethers";

const sha256 = text => createHash("sha256").update(text).digest("hex");
const executable = code => {
  if (!/^0x(?:[0-9a-f]{2})+$/.test(code)) throw Error("Invalid runtime bytecode.");
  const length = parseInt(code.slice(-4), 16);
  if (length < 1 || 2 * (length + 2) >= code.length - 2) throw Error("Invalid Solidity metadata trailer.");
  return code.slice(0, -2 * (length + 2));
};
async function compiler(variable, expected) {
  if (!process.env[variable]) throw Error(`${variable} must identify the isolated solc module.`);
  const { default: solc } = await import(pathToFileURL(process.env[variable]).href);
  if (!solc.version().startsWith(expected)) throw Error(`Compiler version ${expected} required.`);
  return solc;
}
function rebuild(solc, input, sourcePath, name, deployed, requireExact) {
  const result = JSON.parse(solc.compile(JSON.stringify(input)));
  if (result.errors?.some(error => error.severity === "error")) throw Error("Source rebuild failed.");
  const artifact = result.contracts?.[sourcePath]?.[name];
  const code = `0x${artifact?.evm?.deployedBytecode?.object}`;
  const exactMatch = code === deployed, executableMatch = executable(code) === executable(deployed);
  if (!executableMatch || (requireExact && !exactMatch)) throw Error(`${name} deployed bytecode mismatch.`);
  return { compiler: solc.version(), contractName: name,
    inputDigest: sha256(JSON.stringify(input)), deployedCodeHash: keccak256(deployed), compiledCodeHash: keccak256(code),
    executableCodeHash: keccak256(executable(deployed)), exactMatch, executableMatch,
    runtimeBytes: (deployed.length - 2) / 2, compiledRuntime: code, deployedRuntime: deployed,
    // Source paths in remote compiler records can contain personal development
    // directories. Store only contract names and storage labels/types.
    storage: artifact.storageLayout.storage.map(item => ({ label: item.label, slot: item.slot,
      offset: item.offset, type: artifact.storageLayout.types[item.type].label })) };
}

try {
  const reportPath = process.env.NEXUS_GOVERNANCE_EVIDENCE
    ?? "docs/integrations/2026-10-01-bstocks-governance.json";
  const snapshot = JSON.parse(await readFile(reportPath, "utf8"));
  if (snapshot.mode !== "read-only" || snapshot.chainId !== 56 || snapshot.crossSourceMatch !== true
    || snapshot.sources.length !== 2) throw Error("Canonical public governance evidence required.");
  const inputText = await readFile("docs/research/bstocks-governance/beacon-standard-input.json", "utf8");
  const input = JSON.parse(inputText);
  const solc24 = await compiler("NEXUS_SOLC_0824_MODULE", "0.8.24+commit.e11b9ed9");
  const solc4 = await compiler("NEXUS_SOLC_084_MODULE", "0.8.4+commit.c7e474f2");
  const observed = snapshot.sources[0];
  const beacon = rebuild(solc24, input,
    "lib/openzeppelin-contracts/contracts/proxy/beacon/UpgradeableBeacon.sol", "UpgradeableBeacon", observed.beacon.code, true);
  const sourceRebuilds = [];
  for (const address of [...observed.proxies.map(p => p.address), ...observed.proxies.map(p => p.implementation)]) {
    const url = `https://sourcify.dev/server/v2/contract/56/${address}?fields=all`;
    const response = await fetch(url, { signal: AbortSignal.timeout(15_000) });
    if (!response.ok) throw Error("Governance source unavailable.");
    const data = await response.json();
    if (!["match", "exact_match"].includes(data.runtimeMatch) || !data.sources || !data.compilation)
      throw Error("Unverified governance source.");
    const deployed = observed.proxies.find(p => p.address === address)?.code
      ?? observed.proxies.find(p => p.implementation === address)?.implementationRuntime.code;
    if (data.runtimeBytecode?.onchainBytecode !== deployed) throw Error("Source and observed runtime disagree.");
    const settings = { ...data.compilation.compilerSettings,
      outputSelection: { "*": { "*": ["evm.deployedBytecode.object", "storageLayout"] } } };
    const input = { language: "Solidity", sources: data.sources, settings };
    const sourcePath = data.compilation.fullyQualifiedName.slice(0, data.compilation.fullyQualifiedName.lastIndexOf(":"));
    sourceRebuilds.push({ address, sourceUrl: url, sourceMatch: data.runtimeMatch,
      ...rebuild(solc4, input, sourcePath, data.compilation.name, deployed, data.runtimeMatch === "exact_match") });
  }
  console.log(JSON.stringify({ recordedAt: new Date().toISOString(), mode: "local-read-only-rebuild",
    evidenceBlockHash: observed.header.hash, beacon, sourceRebuilds,
    scope: "Source/runtime correspondence; no independent audit, publication or live-risk approval." }, null, 2));
} catch (error) {
  console.error(error instanceof Error ? error.message : "Governance source verification failed.");
  process.exitCode = 1;
}
