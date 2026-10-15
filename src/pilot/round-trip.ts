import { spawn } from "node:child_process";
import { createServer } from "node:net";
import { Interface, keccak256 } from "ethers";
import { BSTOCKS_BSC_V3_POOL, BSTOCKS_BSC_V3_ROUTER } from "../market-gate/bstocks-transfer.js";
import { BSTOCKS_V3_QUOTER, BSTOCKS_V3_FACTORY, routeAbi, type BStocksRouteConfig } from "../market-gate/bstocks-route.js";
import type { BStocksBscQuantitySnapshot } from "../market-gate/bstocks-bsc.js";
import type { ExecutionMarketContext } from "../market-gate/bstocks-production.js";
import type { RouteQuote } from "../market-gate/evidence.js";
import { securityDigest } from "../security/token-security.js";
import type { PilotRoundTrip } from "./profile.js";

type Rpc=(method:string,params:unknown[])=>Promise<unknown>;
export interface LocalFork {rpc:Rpc;close():Promise<void>}
export interface LocalForkFactory {open(snapshot:BStocksBscQuantitySnapshot):Promise<LocalFork>}
const hex=(n:bigint)=>`0x${n.toString(16)}`;
const erc=new Interface(['function balanceOf(address) view returns(uint256)','function allowance(address,address) view returns(uint256)',
  'function approve(address,uint256) returns(bool)','event Transfer(address indexed from,address indexed to,uint256 value)']);

/** All simulated writes are confined to a new loopback Anvil process with no funded test accounts. */
export function createAnvilForkFactory(rpcUrl:string,fetcher:typeof fetch=fetch,executable='anvil'):LocalForkFactory {
  const url=new URL(rpcUrl);
  if(url.protocol!=='https:'||url.username||url.password||url.search||url.hash)throw Error('Invalid public fork source');
  return{async open(s){
    const server=createServer();await new Promise<void>((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',resolve);});
    const address=server.address();if(!address||typeof address==='string')throw Error('Local port unavailable');
    const port=address.port;await new Promise<void>((resolve,reject)=>server.close(e=>e?reject(e):resolve()));
    const child=spawn(executable,['--fork-url',rpcUrl,'--fork-block-number',s.sourceBlock.toString(),'--host','127.0.0.1',
      '--port',String(port),'--chain-id','56','--accounts','0','--silent','--no-storage-caching'],{stdio:'ignore'});
    let spawnError=false;child.on('error',()=>{spawnError=true;});
    let id=0;
    const rpc:Rpc=async(method,params)=>{
      const requestId=++id,r=await fetcher(`http://127.0.0.1:${port}`,{method:'POST',headers:{'Content-Type':'application/json'},
        body:JSON.stringify({jsonrpc:'2.0',id:requestId,method,params}),signal:AbortSignal.timeout(5000)});
      const b=await r.json() as Record<string,unknown>;
      if(!r.ok||b.id!==requestId||b.error||!Object.hasOwn(b,'result'))throw Error('Fork RPC unavailable');return b.result;
    };
    const close=async()=>{if(child.exitCode!==null)return;child.kill('SIGTERM');
      await new Promise<void>(resolve=>{const t=setTimeout(()=>{child.kill('SIGKILL');resolve();},1000);child.once('exit',()=>{clearTimeout(t);resolve();});});};
    try{
      let ready=false;
      for(let attempt=0;attempt<50;attempt++){
        if(spawnError||child.exitCode!==null)throw Error('Anvil could not start');
        try{if(await rpc('eth_chainId',[])==='0x38'){ready=true;break;}}catch{/* starting */}
        await new Promise(resolve=>setTimeout(resolve,100));
      }
      if(!ready)throw Error('Anvil startup timeout');
      return{rpc,close};
    }catch(e){await close();throw e;}
  }};
}

function transferMatches(receipt:Record<string,unknown>,token:string,from:string,to:string,value:bigint):boolean {
  if(receipt.status!=='0x1'||!Array.isArray(receipt.logs))return false;
  const transfers=receipt.logs.filter(log=>typeof log==='object'&&log!==null
    &&String((log as Record<string,unknown>).address).toLowerCase()===token.toLowerCase())
    .flatMap(log=>{try{const l=log as {topics:string[];data:string};const parsed=erc.parseLog(l);
      return parsed?.name==='Transfer'?[parsed]:[];}catch{return [];}});
  return transfers.length===1&&String(transfers[0]!.args[0]).toLowerCase()===from.toLowerCase()
    &&String(transfers[0]!.args[1]).toLowerCase()===to.toLowerCase()&&transfers[0]!.args[2]===value;
}

/** Actual owner balances/allowance, same fork state buy then exact sell; never funds or rewrites storage. */
export function createPilotRoundTrip(factory:LocalForkFactory,route:BStocksRouteConfig,clock:()=>Date=()=>new Date()) {
  return async(c:ExecutionMarketContext,s:BStocksBscQuantitySnapshot,q:RouteQuote):Promise<PilotRoundTrip|null>=>{
    if(!c.pilotProfile||c.wallet!==c.pilotProfile.wallet||c.proposal.side!=='buy'||q.router!==BSTOCKS_BSC_V3_ROUTER
      ||q.sender!==c.wallet||q.recipient!==c.wallet||q.inputRaw>c.pilotProfile.maximumSpendRaw)return null;
    let fork:LocalFork|undefined;
    try{
      fork=await factory.open(s);const rpc=fork.rpc;
      const block=await rpc('eth_getBlockByNumber',[hex(s.sourceBlock),false]) as Record<string,unknown>;
      if(await rpc('eth_chainId',[])!=='0x38'||block?.hash!==s.sourceBlockHash
        ||await rpc('eth_blockNumber',[])!==hex(s.sourceBlock)||await rpc('eth_getCode',[c.wallet,'latest'])!=='0x')return null;
      for(const [key,address]of Object.entries({factory:BSTOCKS_V3_FACTORY,pool:BSTOCKS_BSC_V3_POOL,router:BSTOCKS_BSC_V3_ROUTER,quoter:BSTOCKS_V3_QUOTER})){
        const code=await rpc('eth_getCode',[address,'latest']);
        if(typeof code!=='string'||keccak256(code)!==route.codeHashes[key as keyof typeof route.codeHashes])return null;
      }
      const call=async(token:string,name:string,args:unknown[])=>{
        const raw=await rpc('eth_call',[{to:token,data:erc.encodeFunctionData(name,args)},'latest']);
        if(typeof raw!=='string')throw Error('Missing fork state');return erc.decodeFunctionResult(name,raw)[0] as bigint;
      };
      const beforeCash=await call(q.tokenIn,'balanceOf',[c.wallet]),beforeStock=await call(q.tokenOut,'balanceOf',[c.wallet]);
      if(beforeCash<q.inputRaw||await call(q.tokenIn,'allowance',[c.wallet,q.router])!==q.inputRaw)return null;
      await rpc('anvil_impersonateAccount',[c.wallet]);
      const send=async(to:string,data:string)=>{
        const tx=await rpc('eth_sendTransaction',[{from:c.wallet,to,data,value:'0x0',gas:hex(route.maxGasLimit),
          maxFeePerGas:hex(route.maxFeePerGas),maxPriorityFeePerGas:'0x0',type:'0x2'}]);
        if(typeof tx!=='string')throw Error('Fork transaction unavailable');
        const receipt=await rpc('eth_getTransactionReceipt',[tx]) as Record<string,unknown>;
        if(receipt?.status!=='0x1')throw Error('Fork transaction reverted');return receipt;
      };
      const buyReceipt=await send(q.router,q.calldata);
      const afterCash=await call(q.tokenIn,'balanceOf',[c.wallet]),afterStock=await call(q.tokenOut,'balanceOf',[c.wallet]);
      const bought=afterStock-beforeStock;
      if(beforeCash-afterCash!==q.inputRaw||bought<q.minimumOutputRaw||!transferMatches(buyReceipt,q.tokenIn,c.wallet,BSTOCKS_BSC_V3_POOL,q.inputRaw)
        ||!transferMatches(buyReceipt,q.tokenOut,BSTOCKS_BSC_V3_POOL,c.wallet,bought))return null;
      // Exact local-only sell allowance is part of the scenario; mainnet allowance is untouched.
      await send(q.tokenOut,erc.encodeFunctionData('approve',[q.router,bought]));
      const raw=await rpc('eth_call',[{to:BSTOCKS_V3_QUOTER,data:routeAbi.encodeFunctionData('quoteExactInputSingle',
        [[q.tokenOut,q.tokenIn,bought,2500,0]])},'latest']);
      if(typeof raw!=='string')return null;
      const expected=routeAbi.decodeFunctionResult('quoteExactInputSingle',raw)[0] as bigint;
      const minimum=expected*BigInt(10000-route.slippageBps)/10000n;if(minimum<=0n)return null;
      const sellCalldata=routeAbi.encodeFunctionData('exactInputSingle',[[q.tokenOut,q.tokenIn,2500,c.wallet,
        BigInt(Date.parse(q.onchainDeadline)/1000),bought,minimum,0]]);
      const sellReceipt=await send(q.router,sellCalldata);
      const finalCash=await call(q.tokenIn,'balanceOf',[c.wallet]),finalStock=await call(q.tokenOut,'balanceOf',[c.wallet]);
      const received=finalCash-afterCash;
      if(finalStock!==beforeStock||received<minimum||!transferMatches(sellReceipt,q.tokenOut,c.wallet,BSTOCKS_BSC_V3_POOL,bought)
        ||!transferMatches(sellReceipt,q.tokenIn,BSTOCKS_BSC_V3_POOL,c.wallet,received))return null;
      const now=clock().toISOString();
      return{source:'anvil-owner-round-trip:v1',wallet:c.wallet,sourceBlock:s.sourceBlock,sourceBlockHash:s.sourceBlockHash,
        observedAt:now,expiresAt:new Date(Date.parse(now)+c.marketPolicy.maxSimulationAgeMs).toISOString(),
        buyCalldata:q.calldata,sellCalldata,buyInputRaw:q.inputRaw,boughtRaw:bought,soldRaw:bought,sellOutputRaw:received,
        buyTransferTaxRaw:0n,sellTransferTaxRaw:0n,success:true,
        evidenceDigest:securityDigest({sourceBlock:s.sourceBlock,sourceBlockHash:s.sourceBlockHash,buyReceipt,sellReceipt,
          beforeCash,beforeStock,afterCash,afterStock,finalCash,finalStock})};
    }catch{return null;}finally{await fork?.close();}
  };
}
