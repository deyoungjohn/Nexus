import assert from "node:assert/strict";
import test from "node:test";
import { fetchEoaBscObservation } from "../src/execution/bsc-rpc.js";

const wallet = "0x1111111111111111111111111111111111111111";
const transactionHash = `0x${"a".repeat(64)}`;
const blockHash = `0x${"b".repeat(64)}`;
const request = { rpcUrl: "https://rpc.example.invalid", wallet, transactionHash };

function rpc(change: { chain?: string; receipt?: unknown; blockHash?: string;
  nonce?: string; error?: boolean } = {}): typeof fetch {
  return (async (_url, init) => {
    const body = JSON.parse(String(init?.body)) as { id: number; method: string };
    if (change.error) return new Response("{}", { status: 500 });
    const receipt = change.receipt === undefined
      ? { transactionHash, from: wallet, blockNumber: "0x64", blockHash, status: "0x1" }
      : change.receipt;
    const result = body.method === "eth_chainId" ? (change.chain ?? "0x38")
      : body.method === "eth_blockNumber" ? "0x6f"
      : body.method === "eth_getTransactionCount" ? (change.nonce ?? "0x8")
      : body.method === "eth_getTransactionReceipt" ? receipt
      : { number: "0x64", hash: change.blockHash ?? blockHash };
    return new Response(JSON.stringify({ jsonrpc: "2.0", id: body.id, result }), { status: 200 });
  }) as typeof fetch;
}

test("P7 BSC adapter verifies canonical receipt and keeps missing receipt unresolved", async () => {
  assert.deepEqual(await fetchEoaBscObservation(request, rpc()), {
    headBlock: 111n, latestNonce: 8n,
    receipt: { hash: transactionHash, blockNumber: 100n, blockHash, success: true },
    replacement: null });
  const missing = await fetchEoaBscObservation(request, rpc({ receipt: null }));
  assert.equal(missing?.receipt, null);
  assert.equal(missing?.latestNonce, 8n);
});

test("P7 BSC adapter fails closed on wrong chain, noncanonical receipt and RPC error", async () => {
  assert.equal(await fetchEoaBscObservation(request, rpc({ chain: "0x1" })), null);
  assert.equal(await fetchEoaBscObservation(request, rpc({ blockHash: `0x${"c".repeat(64)}` })), null);
  assert.equal(await fetchEoaBscObservation(request, rpc({ receipt: { transactionHash,
    from: wallet, blockNumber: "0x64", blockHash, status: "0x2" } })), null);
  assert.equal(await fetchEoaBscObservation(request, rpc({ error: true })), null);
  assert.equal(await fetchEoaBscObservation({ ...request, rpcUrl: "http://rpc.example.invalid" }, rpc()), null);
});

test("P7 BSC adapter identifies a canonical same-wallet, same-nonce replacement", async () => {
  const replacementHash = `0x${"c".repeat(64)}`;
  const replacementBlockHash = `0x${"d".repeat(64)}`;
  const replacementRequest = { ...request, nonce: 7n, scanFromBlock: 110n };
  const fetcher = (async (_url, init) => {
    const body = JSON.parse(String(init?.body)) as { id: number; method: string; params: unknown[] };
    const number = body.params[0];
    const result = body.method === "eth_chainId" ? "0x38"
      : body.method === "eth_blockNumber" ? "0x6f"
      : body.method === "eth_getTransactionCount" ? "0x8"
      : body.method === "eth_getTransactionReceipt" ? (number === replacementHash
        ? { transactionHash: replacementHash, from: wallet, blockNumber: "0x6f",
          blockHash: replacementBlockHash, status: "0x1" } : null)
      : { number, hash: number === "0x6f" ? replacementBlockHash : blockHash,
        transactions: number === "0x6f" ? [
          { hash: replacementHash, from: wallet, nonce: "0x7" }] : [] };
    return new Response(JSON.stringify({ jsonrpc: "2.0", id: body.id, result }), { status: 200 });
  }) as typeof fetch;
  assert.deepEqual(await fetchEoaBscObservation(replacementRequest, fetcher), {
    headBlock: 111n, latestNonce: 8n, receipt: null,
    replacement: { from: wallet, nonce: 7n,
      receipt: { hash: replacementHash, blockNumber: 111n,
        blockHash: replacementBlockHash, success: true } } });
});

test("P7 BSC replacement scan fails closed on incomplete and noncanonical evidence", async () => {
  const replacementHash = `0x${"c".repeat(64)}`;
  const scanned = { ...request, nonce: 7n, scanFromBlock: 111n };
  const makeFetcher = (mode: "reorg" | "missing-receipt" | "no-match"): typeof fetch =>
    (async (_url, init) => {
      const body = JSON.parse(String(init?.body)) as { id: number; method: string; params: unknown[] };
      const result = body.method === "eth_chainId" ? "0x38"
        : body.method === "eth_blockNumber" ? "0x6f"
        : body.method === "eth_getTransactionCount" ? "0x8"
        : body.method === "eth_getTransactionReceipt" ? null
        : { number: "0x6f", hash: mode === "reorg" && body.params[1] === false
          ? blockHash : `0x${"d".repeat(64)}`,
          transactions: mode === "no-match" ? [] : [
            { hash: replacementHash, from: wallet, nonce: "0x7" }] };
      return new Response(JSON.stringify({ jsonrpc: "2.0", id: body.id, result }), { status: 200 });
    }) as typeof fetch;
  assert.equal(await fetchEoaBscObservation(scanned, makeFetcher("missing-receipt")), null);
  assert.deepEqual(await fetchEoaBscObservation(scanned, makeFetcher("no-match")), {
    headBlock: 111n, latestNonce: 8n, receipt: null, replacement: null });
  assert.equal(await fetchEoaBscObservation({ ...scanned, scanFromBlock: 79n }, rpc({ receipt: null })), null);
  // A candidate with a receipt is required to reach the canonical recheck.
  const reorgFetcher = (async (_url, init) => {
    const body = JSON.parse(String(init?.body)) as { id: number; method: string; params: unknown[] };
    const result = body.method === "eth_chainId" ? "0x38"
      : body.method === "eth_blockNumber" ? "0x6f"
      : body.method === "eth_getTransactionCount" ? "0x8"
      : body.method === "eth_getTransactionReceipt" ? (body.params[0] === replacementHash
        ? { transactionHash: replacementHash, from: wallet, blockNumber: "0x6f",
          blockHash: `0x${"d".repeat(64)}`, status: "0x1" } : null)
      : { number: "0x6f", hash: body.params[1] === false ? blockHash
        : `0x${"d".repeat(64)}`,
        transactions: [{ hash: replacementHash, from: wallet, nonce: "0x7" }] };
    return new Response(JSON.stringify({ jsonrpc: "2.0", id: body.id, result }), { status: 200 });
  }) as typeof fetch;
  assert.equal(await fetchEoaBscObservation(scanned, reorgFetcher), null);
});

test('P7 archive nonce diagnosis finds a distant canonical replacement with logarithmic reads',async()=>{
  const anchor={blockNumber:100n,blockHash:`0x${'1'.repeat(64)}`,nonce:5n};
  const replacementHash=`0x${'c'.repeat(64)}`, transition=900000n, head=1000000n;
  let counts=0,fullBlocks=0;
  const make=(mode='good'):typeof fetch=>(async(_url,init)=>{
    const b=JSON.parse(String(init?.body));const tag=b.params[0];
    let result:unknown;
    if(b.method==='eth_chainId')result='0x38';
    else if(b.method==='eth_blockNumber')result=`0x${head.toString(16)}`;
    else if(b.method==='eth_getTransactionCount'){
      counts++;const n=b.params[1]==='latest'?head:BigInt(b.params[1]);
      result=mode==='missing-history'&&n!==head?null:n>=transition?'0x8':'0x5';
    }else if(b.method==='eth_getTransactionReceipt')result=tag===replacementHash&&mode!=='missing-receipt'
      ?{from:wallet,transactionHash:replacementHash,blockNumber:`0x${transition.toString(16)}`,blockHash,status:'0x1'}:null;
    else {const n=BigInt(tag);if(b.params[1])fullBlocks++;
      result={number:tag,hash:n===100n?(mode==='anchor-reorg'?blockHash:anchor.blockHash):blockHash,
        transactions:n===transition&&mode!=='missing-tx'?[{from:wallet,hash:replacementHash,nonce:'0x7',
          blockNumber:mode==='wrong-tx-block'?'0x1':tag,
          blockHash:mode==='wrong-tx-hash'?anchor.blockHash:blockHash}]:[]};}
    return new Response(JSON.stringify({jsonrpc:'2.0',id:b.id,result}));
  }) as typeof fetch;
  const input={...request,nonce:7n,nonceHistoryAnchor:anchor};
  const observed=await fetchEoaBscObservation(input,make());
  assert.equal(observed?.replacement?.receipt.blockNumber,transition);
  assert.equal(observed?.replacement?.receipt.hash,replacementHash);
  assert.ok(counts<=25);assert.equal(fullBlocks,1);
  for(const mode of ['missing-history','missing-receipt','anchor-reorg','missing-tx','wrong-tx-block','wrong-tx-hash'])
    assert.equal(await fetchEoaBscObservation(input,make(mode)),null);
  assert.equal(await fetchEoaBscObservation({...input,scanFromBlock:100n},make()),null);
});
