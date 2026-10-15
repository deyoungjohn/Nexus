import assert from "node:assert/strict";
import test from "node:test";
import { BSC_EQUITY_FEEDS, BSC_USDT_ASSET, fetchChainlinkBscEquity,
  fetchChainlinkBscSettlement, fetchPilotFeedObservation } from "../src/market-gate/chainlink-bsc.js";

const updatedAt = BigInt(Date.parse("2026-09-25T14:00:00.000Z") / 1000);
const word = (value: bigint): string => value.toString(16).padStart(64, "0");
const encodedLabel = (name: string): string => `0x${word(32n)}${word(BigInt(name.length))}`
  + Buffer.from(name).toString("hex").padEnd(64, "0");
const input = { underlyingId: "NVDA" as const, rpcUrl: "https://example.invalid/rpc",
  maxBlockAgeMs: 15_000, maxReferenceAgeMs: 60_000, now: "2026-09-25T14:00:10.000Z" };

const replies = (changes: { chain?: string; label?: string; decimals?: bigint;
  answer?: bigint; updatedAt?: bigint; answeredInRound?: bigint; blockTime?: bigint;
  blockNumber?: string; hash?:string } = {}): typeof fetch =>
  (async (_url, init) => {
    const body = JSON.parse(String(init?.body)) as { id: number; method: string;
      params: Array<{ data: string }> };
    const selector = body.params[0]?.data;
    const result = body.method === "eth_chainId" ? changes.chain ?? "0x38"
      : body.method === "eth_blockNumber" ? "0x100"
        : body.method === "eth_getBlockByNumber"
          ? { number: changes.blockNumber ?? "0x100",
            hash:changes.hash??`0x${"a".repeat(64)}`,timestamp: `0x${(changes.blockTime ?? updatedAt + 8n).toString(16)}` }
          : selector === "0xfeaf968c" ? `0x${word(42n)}${word(changes.answer ?? 22534000000n)}`
            + `${word(updatedAt - 2n)}${word(changes.updatedAt ?? updatedAt)}`
            + `${word(changes.answeredInRound ?? 42n)}`
            : selector === "0x313ce567" ? `0x${word(changes.decimals ?? 8n)}`
              : encodedLabel(changes.label ?? "NVDA / USD");
    return new Response(JSON.stringify({ jsonrpc: "2.0", id: body.id, result }), { status: 200 });
  }) as typeof fetch;

test("P5.5 Chainlink BSC reader uses feed round time and 18-decimal USD reference", async () => {
  const result = await fetchChainlinkBscEquity(input, replies());
  assert.equal(result?.sourceAt, "2026-09-25T14:00:00.000Z");
  assert.equal(result?.pricePerShare, 225340000000000000000n);
  assert.equal(result?.source, `chainlink-bsc:${BSC_EQUITY_FEEDS.NVDA.proxy}`);
});

test("P5.5 Chainlink BSC reader blocks stale, malformed and mismatched rounds", async () => {
  assert.equal(await fetchChainlinkBscEquity(input, replies({ chain: "0x1" })), null);
  assert.equal(await fetchChainlinkBscEquity(input, replies({ label: "BTC / USD" })), null);
  assert.equal(await fetchChainlinkBscEquity(input, replies({ decimals: 18n })), null);
  assert.equal(await fetchChainlinkBscEquity(input, replies({ answer: 0n })), null);
  assert.equal(await fetchChainlinkBscEquity(input, replies({ answer: (1n << 256n) - 1n })), null);
  assert.equal(await fetchChainlinkBscEquity(input, replies({ answeredInRound: 41n })), null);
  assert.equal(await fetchChainlinkBscEquity(input, replies({ updatedAt: updatedAt - 120n })), null);
  assert.equal(await fetchChainlinkBscEquity(input, replies({ blockTime: updatedAt - 30n })), null);
  assert.equal(await fetchChainlinkBscEquity(input, replies({ blockNumber: "0xff" })), null);
});

test("P5.5 USDT valuation widens a timed on-chain quote and rejects stale rounds", async () => {
  const request = { rpcUrl: input.rpcUrl, maxBlockAgeMs: input.maxBlockAgeMs,
    maxReferenceAgeMs: input.maxReferenceAgeMs, now: input.now, uncertaintyBps: 50,
    maxPegDeviationBps: 100 };
  const result = await fetchChainlinkBscSettlement(request,
    replies({ label: "USDT / USD", answer: 99900000n }));
  assert.equal(result?.assetId, BSC_USDT_ASSET);
  assert.equal(result?.valuationUnit, "USD-18");
  assert.equal(result?.observedAt, "2026-09-25T14:00:00.000Z");
  assert.equal(result?.lowerValueNumerator, 994005000000000000n);
  assert.equal(result?.upperValueNumerator, 1003995000000000000n);
  assert.equal(result?.denominator, 10n ** 18n);
  assert.equal(await fetchChainlinkBscSettlement(request,
    replies({ label: "USDT / USD", updatedAt: updatedAt - 120n })), null);
  assert.equal(await fetchChainlinkBscSettlement({ ...request, uncertaintyBps: 10_001 },
    replies({ label: "USDT / USD" })), null);
  assert.equal(await fetchChainlinkBscSettlement(request,
    replies({ label: "USDT / USD", answer: 98000000n })), null);
  assert.equal(await fetchChainlinkBscSettlement({ ...request, maxPegDeviationBps: -1 },
    replies({ label: "USDT / USD" })), null);
});


test('P5.5 Amendment raw feed observations bind a canonical hash and preserve P1/P3 diagnostic facts',async()=>{
  const samples:[Record<string,unknown>,bigint][]=[[{answer:0n},0n],[{answer:(1n<<256n)-1n},-(10n**10n)]];
  for(const [change,answer]of samples) {
    const result=await fetchPilotFeedObservation(input,'equity',replies(change));
    assert.equal(result?.answer18,answer);assert.equal(result?.roundId,42n);
  }
  const future=await fetchPilotFeedObservation(input,'equity',replies({updatedAt:updatedAt+9n}));
  assert.equal(future?.updatedAt,'2026-09-25T14:00:09.000Z');assert.equal(future?.blockTimestamp,'2026-09-25T14:00:08.000Z');
  const base=replies();let headers=0;
  const reorg:typeof fetch=async(url,init)=>{const b=JSON.parse(String(init?.body));
    if(b.method==='eth_getBlockByNumber'&&++headers>1)return replies({hash:`0x${'b'.repeat(64)}`})(url,init);
    if(b.method==='eth_call')assert.deepEqual(b.params[1],{blockHash:`0x${'a'.repeat(64)}`,requireCanonical:true});
    return base(url,init);};
  assert.equal(await fetchPilotFeedObservation(input,'equity',reorg),null);
});
