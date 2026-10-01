import { Interface } from "ethers";
import { BSC_USDT } from "../src/security/bsc-token-security.js";
import { BSTOCKS_BSC_NVDAB } from "../src/market-gate/bstocks-bsc.js";
import { GOPLUS_RISK_FIELDS } from "../src/security/token-security.js";
import { rpcReply as bstocksRpc } from "./bstocks-bsc.test.js";

/** Entire transport/scanner response is synthetic; no deployed risk clearance. */
const binancePayload = () => ({ code: "000000", success: true, data: { hasResult: true,
  isSupported: true, riskLevel: 1, riskAlert: null, extraInfo: { buyTax: "0", sellTax: "0" },
  riskItems: ["CONTRACT_RISK", "TRADE_RISK", "SCAM_RISK"].map(id => ({ id,
    details: [{ title: "Synthetic covered check", isHit: false, riskType: "RISK" }] })) } });
const goPayload = (): { code: number; result: Record<string, Record<string, string>> } => ({ code: 1, result: { [BSC_USDT]: {
  ...Object.fromEntries(GOPLUS_RISK_FIELDS.map(f => [f, "0"])), is_open_source: "1", is_proxy: "0",
  buy_tax: "0", sell_tax: "0" } } });
export function collectorMock(options: { reorg?: boolean; wrongChain?: boolean; missingBeaconSource?: boolean;
  issuerMembers?: readonly string[] } = {}) {
  const refs: unknown[] = [];
  let headers = 0;
  const fetcher = (async (url: string | URL | Request, init?: RequestInit) => {
    const text = String(url);
    if (text.includes("sourcify.dev")) {
      const address = text.split("/56/")[1]!.split("?")[0];
      if (options.missingBeaconSource && address === "0x156d6dce9a4f6139a3406f1f021f1a4880de93a3")
        return new Response("{}", { status: 404 });
      const codes: Record<string, string> = { [BSC_USDT]: "0x6006", [BSTOCKS_BSC_NVDAB]: "0x6001",
        "0x156d6dce9a4f6139a3406f1f021f1a4880de93a3": "0x6002",
        "0xcfed6c4679297ea4889f8183bc057b4a86c64e46": "0x6003",
        "0x53dba7aabde774787a1f57236b235567da8e14f4": "0x6004",
        "0x9fc74be63f3589485b2423984a7a0557e0cf700a": "0x6005" };
      return new Response(JSON.stringify({ runtimeMatch: "exact_match", runtimeBytecode: { onchainBytecode: codes[address!] },
        sources: { "Synthetic.sol": { content: "contract Synthetic {}" } }, compilation: { compiler: "synthetic" } }));
    }
    if (text.includes("binance.com")) return new Response(JSON.stringify(binancePayload()));
    if (text.includes("gopluslabs.io")) {
      const token = text.split("contract_addresses=")[1]!;
      return new Response(JSON.stringify({ ...goPayload(), result: { [token]: goPayload().result[BSC_USDT] } }));
    }
    const body = JSON.parse(String(init?.body)), token = body.params[0]?.to ?? body.params[0];
    let result: unknown;
    if (body.method === "eth_chainId" && options.wrongChain) result = "0x1";
    else if (body.method === "eth_getBlockByNumber") {
      headers++; const response = await bstocksRpc()(url, init); const data = await response.json() as { result: Record<string, unknown> };
      result = { ...data.result, hash: `0x${(options.reorg && headers >= 4 ? "f" : "a").repeat(64)}` };
    } else if (token === BSC_USDT) {
      refs.push(body.params.at(-1));
      result = body.method === "eth_getCode" ? "0x6006" : body.method === "eth_getStorageAt"
        ? `0x${"0".repeat(64)}` : new Interface(["function owner() view returns (address)", "function decimals() view returns (uint8)"])
          .encodeFunctionResult(body.params[0].data === "0x313ce567" ? "decimals" : "owner",
            body.params[0].data === "0x313ce567" ? [18] : ["0x1111111111111111111111111111111111111111"]);
    } else return bstocksRpc(options.issuerMembers ? { issuerMembers: options.issuerMembers } : {})(url, init);
    return new Response(JSON.stringify({ jsonrpc: "2.0", id: body.id, result }));
  }) as typeof fetch;
  return { fetcher, refs };
}
