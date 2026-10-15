import { Interface, keccak256 } from "ethers";
import { BSTOCKS_BSC_NVDAB, type BStocksBscQuantitySnapshot } from "./bstocks-bsc.js";
import { BSTOCKS_BSC_V3_POOL, BSTOCKS_BSC_V3_ROUTER } from "./bstocks-transfer.js";
import { BSC_USDT_ASSET, BSC_USDT_USD_FEED } from "./chainlink-bsc.js";
import type { ExecutionMarketContext } from "./bstocks-production.js";
import type { RouteQuote, SimulationEvidence } from "./evidence.js";
import { decodeV3ExactInputSingle, routeMatchesCalldata } from "./route.js";

export const BSTOCKS_V3_FACTORY="0x0bfbcf9fa4f9c56b0f40a671ad40e0805a091865";
export const BSTOCKS_V3_QUOTER="0xb048bbc1ee6b733fffcfb9e9cef7375518e25997";
export const BSC_BNB_USD_FEED="0x0567f2323251f0aab15c8dfb1967e4e8a7d42aee";
const USDT=BSC_USDT_ASSET.split("erc20:")[1]!;
export const routeAbi=new Interface([
  "function factory() view returns(address)","function token0() view returns(address)","function token1() view returns(address)",
  "function fee() view returns(uint24)","function liquidity() view returns(uint128)",
  "function slot0() view returns(uint160,int24,uint16,uint16,uint16,uint32,bool)",
  "function getPool(address,address,uint24) view returns(address)",
  "function quoteExactInputSingle((address tokenIn,address tokenOut,uint256 amountIn,uint24 fee,uint160 sqrtPriceLimitX96)) returns(uint256,uint160,uint32,uint256)",
  "function exactInputSingle((address tokenIn,address tokenOut,uint24 fee,address recipient,uint256 deadline,uint256 amountIn,uint256 amountOutMinimum,uint160 sqrtPriceLimitX96)) payable returns(uint256)",
  "function decimals() view returns(uint8)","function allowance(address,address) view returns(uint256)","function balanceOf(address) view returns(uint256)",
  "function description() view returns(string)","function latestRoundData() view returns(uint80,int256,uint256,uint256,uint80)"
]);
export interface BStocksRouteConfig {
  readonly version:string;
  readonly codeHashes:Readonly<Record<"factory"|"pool"|"router"|"quoter",string>>;
  readonly slippageBps:number;
  readonly lifetimeMs:number;
  readonly maxGasLimit:bigint;
  readonly maxFeePerGas:bigint;
  readonly feeFeedMaxAgeMs:number;
  readonly feeUncertaintyBps:number;
  readonly maxSettlementPegDeviationBps:number;
}
const ceil=(n:bigint,d:bigint)=>(n+d-1n)/d;
const quantity=(v:unknown):bigint=>{if(typeof v!=="string"||!/^0x(?:0|[1-9a-f][0-9a-f]*)$/.test(v))throw Error("Invalid RPC quantity");return BigInt(v);};
const addresses={factory:BSTOCKS_V3_FACTORY,pool:BSTOCKS_BSC_V3_POOL,router:BSTOCKS_BSC_V3_ROUTER,quoter:BSTOCKS_V3_QUOTER};

/** Canonical actual-size USDT/NVDAB direct route. Read-only, no allowance/state overrides. */
export function createBStocksRoutePorts(rpcUrl:string,input:BStocksRouteConfig,fetcher:typeof fetch=fetch,
  clock:()=>Date=()=>new Date()) {
  const config=structuredClone(input),url=new URL(rpcUrl);
  if(url.protocol!=="https:"||url.username||url.password||url.search||url.hash
    ||!config.version||!Object.values(config.codeHashes).every(h=>/^0x[0-9a-f]{64}$/.test(h))
    ||Object.keys(config.codeHashes).sort().join(",")!=="factory,pool,quoter,router"
    ||![config.slippageBps,config.feeUncertaintyBps,config.maxSettlementPegDeviationBps].every(n=>Number.isInteger(n)&&n>=0&&n<10_000)
    ||![config.lifetimeMs,config.feeFeedMaxAgeMs].every(n=>Number.isSafeInteger(n)&&n>0)
    ||config.maxGasLimit<=0n||config.maxFeePerGas<=0n)throw Error("Invalid reviewed route configuration");
  let nextId=0;
  const rpc=async(method:string,params:unknown[])=>{
    const id=++nextId,response=await fetcher(url.href,{method:"POST",headers:{"Content-Type":"application/json"},
      body:JSON.stringify({jsonrpc:"2.0",id,method,params}),signal:AbortSignal.timeout(5000)});
    const body=response.ok?await response.json() as Record<string,unknown>:null;
    if(!body||body.jsonrpc!=="2.0"||body.id!==id||body.error||!Object.hasOwn(body,"result"))throw Error("Route RPC unavailable");
    return body.result;
  };
  const frame=async(c:ExecutionMarketContext,s:BStocksBscQuantitySnapshot)=>{
    const now=Date.parse(c.now),block=`0x${s.sourceBlock.toString(16)}`;
    if(c.instrument.chainId!==56||c.instrument.issuerId!=="bstocks"||c.instrument.tokenAddress!==BSTOCKS_BSC_NVDAB
      ||c.instrument.decimals!==18||c.snapshot.confirmedCash.assetId!==BSC_USDT_ASSET||c.snapshot.confirmedCash.decimals!==18
      ||s.instrumentId!==c.instrument.instrumentId||s.control.token!==BSTOCKS_BSC_NVDAB||s.rawDecimals!==18
      ||!/^0x[0-9a-f]{40}$/.test(c.wallet)||/^0x0{40}$/.test(c.wallet)||!Number.isFinite(now)
      ||!/^0x[0-9a-f]{64}$/.test(s.sourceBlockHash)||s.sourceBlock<=0n||Date.parse(s.expiresAt)<=now
      ||config.slippageBps>c.marketPolicy.maxSlippageBps||config.lifetimeMs>c.marketPolicy.maxQuoteLifetimeMs
      ||!c.marketPolicy.approvedV3FeeTiers.includes(2500)||!c.marketPolicy.approvedVenues.includes("pancake-v3")
      ||!c.marketPolicy.approvedRouters.includes(BSTOCKS_BSC_V3_ROUTER)||await rpc("eth_chainId",[])!=="0x38")throw Error("Unsupported route context");
    const header=await rpc("eth_getBlockByNumber",[block,false]) as Record<string,unknown>;
    const at=quantity(header?.timestamp)*1000n;
    if(header?.hash!==s.sourceBlockHash||quantity(header.number)!==s.sourceBlock||at>BigInt(now)
      ||BigInt(now)-at>BigInt(c.marketPolicy.maxStatusAgeMs))throw Error("Stale route frame");
    const ref={blockHash:s.sourceBlockHash,requireCanonical:true};
    const call=async(to:string,name:string,args:unknown[]=[])=>{
      const result=await rpc("eth_call",[{to,data:routeAbi.encodeFunctionData(name,args)},ref]);
      if(typeof result!=="string")throw Error("Invalid route response");return routeAbi.decodeFunctionResult(name,result);
    };
    await Promise.all(Object.entries(addresses).map(async([key,address])=>{
      const code=await rpc("eth_getCode",[address,ref]);
      if(typeof code!=="string"||!/^0x(?:[0-9a-f]{2})+$/.test(code)||keccak256(code)!==config.codeHashes[key as keyof typeof addresses])throw Error("Venue code changed");
    }));
    const [pool,token0,token1,fee,poolFactory,routerFactory,quoterFactory,liquidity,slot,d0,d1]=await Promise.all([
      call(BSTOCKS_V3_FACTORY,"getPool",[BSTOCKS_BSC_NVDAB,USDT,2500]),call(addresses.pool,"token0"),call(addresses.pool,"token1"),
      call(addresses.pool,"fee"),call(addresses.pool,"factory"),call(addresses.router,"factory"),call(addresses.quoter,"factory"),
      call(addresses.pool,"liquidity"),call(addresses.pool,"slot0"),call(BSTOCKS_BSC_NVDAB,"decimals"),call(USDT,"decimals")]);
    if(String(pool[0]).toLowerCase()!==addresses.pool||String(token0[0]).toLowerCase()!==BSTOCKS_BSC_NVDAB
      ||String(token1[0]).toLowerCase()!==USDT||fee[0]!==2500n||d0[0]!==18n||d1[0]!==18n
      ||[poolFactory,routerFactory,quoterFactory].some(v=>String(v[0]).toLowerCase()!==addresses.factory)
      ||liquidity[0]<=0n||slot[0]<=0n||slot[6]!==true)throw Error("Venue identity/liquidity changed");
    const finish=async()=>{const end=await rpc("eth_getBlockByNumber",[block,false]) as Record<string,unknown>;
      if(end?.hash!==s.sourceBlockHash||quantity(end.number)!==s.sourceBlock)throw Error("Route reorg");};
    return{ref,call,finish,at,sqrt:slot[0] as bigint};
  };
  const networkFee=async(c:ExecutionMarketContext,f:Awaited<ReturnType<typeof frame>>,native:bigint)=>{
    const answer=async(proxy:string,label:string)=>{const [round,decimals,desc]=await Promise.all([
      f.call(proxy,"latestRoundData"),f.call(proxy,"decimals"),f.call(proxy,"description")]);
      const [id,value,started,updated,answered]=round as unknown as bigint[];
      if(decimals[0]!==8n||desc[0]!==label||!id||!value||value<=0n||!started||!updated||answered===undefined||answered<id
        ||started>updated||updated*1000n>f.at||BigInt(Date.parse(c.now))-updated*1000n>BigInt(config.feeFeedMaxAgeMs))throw Error("Fee source unavailable");
      return value;};
    const [bnb,usdt]=await Promise.all([answer(BSC_BNB_USD_FEED,"BNB / USD"),answer(BSC_USDT_USD_FEED.proxy,"USDT / USD")]);
    if((usdt>100_000_000n?usdt-100_000_000n:100_000_000n-usdt)*10_000n>100_000_000n*BigInt(config.maxSettlementPegDeviationBps))throw Error("Settlement depeg");
    return ceil(native*bnb*BigInt(10_000+config.feeUncertaintyBps),usdt*BigInt(10_000-config.feeUncertaintyBps));
  };
  const units=(c:ExecutionMarketContext)=>c.proposal.side==="buy"?c.proposal.spend.units:c.proposal.raw.units;
  const pair=(c:ExecutionMarketContext)=>c.proposal.side==="buy"?[USDT,BSTOCKS_BSC_NVDAB]:[BSTOCKS_BSC_NVDAB,USDT];
  return{
    async pilotMid(c:ExecutionMarketContext,s:BStocksBscQuantitySnapshot) {try {
      const f=await frame(c,s);await f.finish();return{sourceBlock:s.sourceBlock,sourceBlockHash:s.sourceBlockHash,
        midNumerator:f.sqrt*f.sqrt,midDenominator:1n<<192n};
    }catch{return null;}},
    async quote(c:ExecutionMarketContext,s:BStocksBscQuantitySnapshot):Promise<RouteQuote|null>{try{
      const f=await frame(c,s),[tokenIn,tokenOut]=pair(c),inputRaw=units(c);
      if(inputRaw<=0n)throw Error("Invalid accepted amount");
      const out=await f.call(addresses.quoter,"quoteExactInputSingle",[[tokenIn,tokenOut,inputRaw,2500,0n]]);
      const expectedOutputRaw=out[0] as bigint,spot=c.proposal.side==="sell"?ceil(inputRaw*f.sqrt*f.sqrt,1n<<192n):ceil(inputRaw*(1n<<192n),f.sqrt*f.sqrt);
      const ideal=ceil(spot*997_500n,1_000_000n);
      if(ideal<=0n||expectedOutputRaw<=0n||expectedOutputRaw>ideal+1n)throw Error("Invalid quoted output");
      const impact=Number(ceil((ideal>expectedOutputRaw?ideal-expectedOutputRaw:0n)*10_000n,ideal));
      const minimumOutputRaw=ceil(expectedOutputRaw*BigInt(10_000-config.slippageBps),10_000n);
      const deadline=BigInt(Math.floor((Date.parse(c.now)+config.lifetimeMs)/1000));
      const nativeFeeRaw=config.maxGasLimit*config.maxFeePerGas;
      const quote:RouteQuote={venueId:"pancake-v3",chainId:56,sender:c.wallet,recipient:c.wallet,router:addresses.router,
        spender:addresses.router,tokenIn:tokenIn!,tokenOut:tokenOut!,inputRaw,expectedOutputRaw,minimumOutputRaw,
        additionalFeeSettlement:0n,networkFeeSettlement:await networkFee(c,f,nativeFeeRaw),nativeFeeRaw,priceImpactBps:impact,spreadBps:25,
        calldata:routeAbi.encodeFunctionData("exactInputSingle",[[tokenIn,tokenOut,2500,c.wallet,deadline,inputRaw,minimumOutputRaw,0n]]),
        value:0n,quotedAt:c.now,expiresAt:new Date(Number(deadline)*1000).toISOString(),onchainDeadline:new Date(Number(deadline)*1000).toISOString()};
      if(impact>c.marketPolicy.maxPriceImpactBps||(!c.pilotProfile&&quote.networkFeeSettlement>c.marketPolicy.maxNetworkFeeSettlement)
        ||quote.spreadBps>c.marketPolicy.maxSpreadBps||deadline*1000n<=BigInt(Date.parse(c.now)))return null;
      await f.finish();return quote;
    }catch{return null;}},
    async simulation(c:ExecutionMarketContext,s:BStocksBscQuantitySnapshot,q:RouteQuote):Promise<SimulationEvidence|null>{try{
      const f=await frame(c,s),[tokenIn,tokenOut]=pair(c),decoded=decodeV3ExactInputSingle(q.calldata),native=config.maxGasLimit*config.maxFeePerGas;
      if(!decoded||!routeMatchesCalldata(q)||q.venueId!=="pancake-v3"||q.chainId!==56||q.sender!==c.wallet||q.recipient!==c.wallet
        ||q.router!==addresses.router||q.spender!==addresses.router||q.tokenIn!==tokenIn||q.tokenOut!==tokenOut||q.inputRaw!==units(c)
        ||decoded.feeTier!==2500||q.value!==0n||q.minimumOutputRaw<=0n||q.expectedOutputRaw<q.minimumOutputRaw
        ||Date.parse(q.expiresAt)<=Date.parse(c.now)||Date.parse(q.quotedAt)>Date.parse(c.now)
        ||q.nativeFeeRaw<native||await networkFee(c,f,native)>q.networkFeeSettlement)throw Error("Quote changed/expired");
      const [balance,allowance,nativeBalance]=await Promise.all([f.call(tokenIn!,"balanceOf",[c.wallet]),
        f.call(tokenIn!,"allowance",[c.wallet,addresses.router]),rpc("eth_getBalance",[c.wallet,f.ref])]);
      if(balance[0]<q.inputRaw||allowance[0]<q.inputRaw||quantity(nativeBalance)<native+c.coordinatorPolicy.requiredNativeGas.units)throw Error("Insufficient real funds/allowance");
      const tx={from:c.wallet,to:q.router,data:q.calldata,value:"0x0",gas:`0x${config.maxGasLimit.toString(16)}`,gasPrice:`0x${config.maxFeePerGas.toString(16)}`};
      const result=await rpc("eth_call",[tx,f.ref]),gas=quantity(await rpc("eth_estimateGas",[tx,f.ref]));
      if(typeof result!=="string"||gas<=0n||gas>config.maxGasLimit)throw Error("Simulation/gas unavailable");
      const outputRaw=routeAbi.decodeFunctionResult("exactInputSingle",result)[0] as bigint;
      if(outputRaw<q.minimumOutputRaw)throw Error("Minimum output failed");
      await f.finish();const simulatedAt=clock().toISOString();
      if(Date.parse(simulatedAt)<Date.parse(q.quotedAt))throw Error("Invalid simulation clock");
      return{chainId:56,sender:c.wallet,recipient:c.wallet,router:q.router,spender:q.spender,tokenIn:q.tokenIn,
        allowanceRaw:allowance[0] as bigint,calldata:q.calldata,value:0n,inputRaw:q.inputRaw,outputRaw,sourceBlock:s.sourceBlock,
        source:`bstocks-real-state:${config.version}`,simulatedAt,success:true};
    }catch{return null;}}
  };
}
