import assert from "node:assert/strict";
import test from "node:test";
import { keccak256 } from "ethers";
import { createBStocksRoutePorts, routeAbi, BSTOCKS_V3_FACTORY, BSC_BNB_USD_FEED, type BStocksRouteConfig } from "../src/market-gate/bstocks-route.js";
import { BSC_USDT_USD_FEED } from "../src/market-gate/chainlink-bsc.js";
import { productionFixture } from "./production-execution-fixture.js";
import { snapshot } from "./bstocks-transfer.test.js";
import { decodeV3ExactInputSingle } from "../src/market-gate/route.js";

export const routeNow="2026-09-28T14:00:00.000Z";
export function routeFixture(mode="ok",side:"buy"|"sell"="buy"){
  const base=productionFixture("0x1111111111111111111111111111111111111111"),codeHash=keccak256("0x6000");
  const config:BStocksRouteConfig={version:"synthetic-route",codeHashes:{factory:codeHash,pool:codeHash,router:codeHash,quoter:codeHash},
    slippageBps:50,lifetimeMs:60_000,maxGasLimit:300_000n,maxFeePerGas:5_000_000_000n,feeFeedMaxAgeMs:60_000,feeUncertaintyBps:100,maxSettlementPegDeviationBps:100};
  const s={...snapshot,instrumentId:base.instrument.instrumentId,mappingRevision:base.expectedMappingRevision,
    observedAt:routeNow,expiresAt:"2026-09-28T14:01:00.000Z"};
  const c={...base,now:routeNow,sessionId:"synthetic",marketPolicy:{...base.marketPolicy,approvedVenues:["pancake-v3"],maxNetworkFeeSettlement:2n*10n**18n}};
  if(side==="sell")c.proposal={id:"sell",instrumentId:base.instrument.instrumentId,side:"sell",priority:1,mandatory:false,
    raw:{...base.snapshot.positions[0]!.raw,units:5n*10n**18n},proceeds:base.snapshot.confirmedCash,
    proceedsValueLower:5n*10n**18n,nominalValue:5n*10n**18n};
  const calls:{method:string;params:unknown[]}[]=[];let headers=0;
  const fetcher=(async(_url,init)=>{
    const body=JSON.parse(String(init?.body));calls.push(body);let result:unknown;
    if(body.method==="eth_chainId")result=mode==="wrong-chain"?"0x1":"0x38";
    else if(body.method==="eth_getBlockByNumber"){headers++;result={number:"0x100",hash:mode==="reorg"&&headers>1?`0x${"f".repeat(64)}`:s.sourceBlockHash,
      timestamp:`0x${(BigInt(Date.parse(routeNow)/1000)-(mode==="stale"?120n:0n)).toString(16)}`};}
    else if(body.method==="eth_getCode")result=mode==="code"?"0x6001":"0x6000";
    else if(body.method==="eth_getBalance")result=mode==="native"?"0x1":"0xde0b6b3a7640000";
    else if(body.method==="eth_estimateGas")result=mode==="gas"?"0x1000000":"0x30d40";
    else if(body.method==="eth_call"){
      const tx=body.params[0];const parsed=routeAbi.parseTransaction({data:tx.data})!;const name=parsed.name;
      if(name==="getPool")result=routeAbi.encodeFunctionResult(name,[mode==="pool"?c.wallet:"0x8fb4243b553ac29ba088acf00b9b7da24bd6690c"]);
      else if(name==="factory")result=routeAbi.encodeFunctionResult(name,[mode==="factory"?c.wallet:BSTOCKS_V3_FACTORY]);
      else if(name==="token0")result=routeAbi.encodeFunctionResult(name,[base.instrument.tokenAddress]);
      else if(name==="token1")result=routeAbi.encodeFunctionResult(name,[base.evidence.quote!.tokenIn]);
      else if(name==="fee")result=routeAbi.encodeFunctionResult(name,[mode==="fee-tier"?500:2500]);
      else if(name==="liquidity")result=routeAbi.encodeFunctionResult(name,[mode==="liquidity"?0n:10n**24n]);
      else if(name==="slot0")result=routeAbi.encodeFunctionResult(name,[1n<<96n,0,1,1,1,0,mode!=="locked"]);
      else if(name==="decimals")result=routeAbi.encodeFunctionResult(name,[mode==="decimals"?6:18]);
      else if(name==="description")result=routeAbi.encodeFunctionResult(name,[mode==="feed-identity"?"Unknown":tx.to===BSC_BNB_USD_FEED?"BNB / USD":"USDT / USD"]);
      // Feeds use 8 decimals even though route tokens use 18.
      if(name==="decimals"&&[BSC_BNB_USD_FEED,BSC_USDT_USD_FEED.proxy].includes(tx.to))result=routeAbi.encodeFunctionResult(name,[8]);
      if(name==="latestRoundData")result=routeAbi.encodeFunctionResult(name,[1,tx.to===BSC_BNB_USD_FEED?60_000_000_000n:mode==="depeg"?90_000_000n:100_000_000n,
        BigInt(Date.parse(routeNow)/1000)-30n,BigInt(Date.parse(routeNow)/1000)-(mode==="feed-stale"?120n:10n),1]);
      else if(name==="quoteExactInputSingle")result=routeAbi.encodeFunctionResult(name,[mode==="impact"?1n:parsed.args[0].amountIn*997_490n/1_000_000n,1n<<96n,0,150000]);
      else if(name==="balanceOf")result=routeAbi.encodeFunctionResult(name,[mode==="funds"?1n:100n*10n**18n]);
      else if(name==="allowance")result=routeAbi.encodeFunctionResult(name,[mode==="allowance"?0n:100n*10n**18n]);
      else if(name==="exactInputSingle"){
        if(mode==="revert")return new Response(JSON.stringify({jsonrpc:"2.0",id:body.id,error:{code:-32000,message:"Reverted"}}));
        result=routeAbi.encodeFunctionResult(name,[mode==="minimum"?1n:parsed.args[0].amountIn*997_490n/1_000_000n]);
      }
    }else throw Error("Unexpected RPC method");
    return new Response(JSON.stringify({jsonrpc:"2.0",id:mode==="rpc-id"?body.id+1:body.id,result}));
  }) as typeof fetch;
  return{c,s,config,calls,ports:createBStocksRoutePorts("https://fixture.invalid",config,fetcher,()=>new Date(routeNow))};
}

test("P5.5e bStocks quotes actual accepted buy/sell size and simulates exact bytes without overrides",async()=>{
  for(const side of ["buy","sell"] as const){const f=routeFixture("ok",side),q=await f.ports.quote(f.c,f.s);assert.ok(q);
    assert.equal(q.inputRaw,5n*10n**18n);assert.equal(q.nativeFeeRaw,f.config.maxGasLimit*f.config.maxFeePerGas);
    assert.ok(q.networkFeeSettlement>900_000_000_000_000_000n);assert.equal(q.spreadBps,25);
    const d=decodeV3ExactInputSingle(q.calldata)!;assert.equal(d.inputRaw,q.inputRaw);assert.equal(d.recipient,f.c.wallet);
    assert.equal(d.minimumOutputRaw,q.minimumOutputRaw);assert.equal(d.feeTier,2500);
    const result=await f.ports.simulation(f.c,f.s,q);assert.ok(result);assert.equal(result.outputRaw,q.expectedOutputRaw);
    assert.equal(result.allowanceRaw,100n*10n**18n);
    for(const call of f.calls){assert.ok(!call.method.includes("send"));
      if(["eth_call","eth_estimateGas","eth_getCode","eth_getBalance"].includes(call.method)){
        assert.equal(call.params.length,2);assert.deepEqual(call.params[1],{blockHash:f.s.sourceBlockHash,requireCanonical:true});}}
  }
});

test("P5.5e bStocks route rejects changed venue, unsafe source, thin pool, depeg and canonical failures",async()=>{
  for(const mode of ["wrong-chain","code","pool","factory","fee-tier","decimals","liquidity","locked","impact","stale","feed-identity","feed-stale","depeg","reorg","rpc-id"]){
    const f=routeFixture(mode);assert.equal(await f.ports.quote(f.c,f.s),null,mode);
  }
  const f=routeFixture();assert.throws(()=>createBStocksRoutePorts("http://fixture.invalid",f.config));
  assert.throws(()=>createBStocksRoutePorts("https://fixture.invalid",{...f.config,codeHashes:{...f.config.codeHashes,pool:"unknown"}}));
});

test("P5.5e real-state simulation blocks missing allowance/funds, gas ceiling, revert and worse fill",async()=>{
  const f=routeFixture(),q=await f.ports.quote(f.c,f.s);assert.ok(q);
  for(const mode of ["allowance","funds","native","gas","revert","minimum","reorg"]){
    const bad=routeFixture(mode);assert.equal(await bad.ports.simulation(bad.c,bad.s,q),null,mode);
  }
  for(const patch of [{calldata:q.calldata+"00"},{recipient:"0x2222222222222222222222222222222222222222"},
    {expiresAt:"2026-09-28T13:59:59.000Z"},{networkFeeSettlement:0n},{inputRaw:q.inputRaw+1n}])
    assert.equal(await f.ports.simulation(f.c,f.s,{...q,...patch}),null);
});
