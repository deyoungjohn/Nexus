import assert from 'node:assert/strict';
import test from 'node:test';
import {Interface,keccak256} from 'ethers';
import {createPilotRoundTrip} from '../src/pilot/round-trip.js';
import {routeAbi,type BStocksRouteConfig} from '../src/market-gate/bstocks-route.js';
import {BSTOCKS_BSC_V3_POOL} from '../src/market-gate/bstocks-transfer.js';
import type {BStocksBscQuantitySnapshot} from '../src/market-gate/bstocks-bsc.js';
import {pilotFixture} from './pilot-fixture.js';
const erc=new Interface(['function balanceOf(address) view returns(uint256)','function allowance(address,address) view returns(uint256)',
  'function approve(address,uint256) returns(bool)','event Transfer(address indexed from,address indexed to,uint256 value)']);

function scenario(mode='good'){
  const p=pilotFixture(),q=p.evidence.quote!,calls:string[]=[];let phase=0,closed=false;
  const route:BStocksRouteConfig={version:'fixture',codeHashes:{factory:keccak256('0x6000'),pool:keccak256('0x6000'),router:keccak256('0x6000'),quoter:keccak256('0x6000')},
    slippageBps:50,lifetimeMs:300000,maxGasLimit:300000n,maxFeePerGas:1000000000n,feeFeedMaxAgeMs:900000,feeUncertaintyBps:25,maxSettlementPegDeviationBps:100};
  const receipt=(sell=false)=>{const amount=sell?q.expectedOutputRaw:q.inputRaw,out=sell?49n*10n**17n:q.expectedOutputRaw;
    const a=erc.encodeEventLog(erc.getEvent('Transfer')!,[p.wallet,BSTOCKS_BSC_V3_POOL,amount]);
    const b=erc.encodeEventLog(erc.getEvent('Transfer')!,[BSTOCKS_BSC_V3_POOL,p.wallet,out]);
    return{status:sell&&mode==='failed-sell'?'0x0':'0x1',logs:[{address:sell?q.tokenOut:q.tokenIn,...a},{address:sell?q.tokenIn:q.tokenOut,...b}]};};
  const factory={async open(){return{async close(){closed=true;},async rpc(method:string,params:unknown[]){
    calls.push(method);
    if(method==='eth_chainId')return'0x38';if(method==='eth_getBlockByNumber')return{hash:p.evidence.quantity!.sourceBlock===101n?p.evidence.tokenSecurity[0]!.observation!.sourceBlockHash:'bad'};
    if(method==='eth_blockNumber')return'0x65';
    if(method==='eth_getCode')return params[0]===p.wallet?'0x':mode==='changed-code'?'0x6001':'0x6000';
    if(method==='anvil_impersonateAccount')return null;
    if(method==='eth_call'){
      const tx=params[0] as {to:string;data:string};
      if(tx.data.startsWith(routeAbi.getFunction('quoteExactInputSingle')!.selector))return routeAbi.encodeFunctionResult('quoteExactInputSingle',[49n*10n**17n,1n,0,1n]);
      const fn=erc.parseTransaction({data:tx.data})!;
      if(fn.name==='allowance')return erc.encodeFunctionResult('allowance',[mode==='unlimited'?2n**256n-1n:q.inputRaw]);
      const stock=tx.to===q.tokenOut;
      const units=stock?(phase===1?q.expectedOutputRaw-(mode==='tax'?1n:0n):0n)
        :100n*10n**18n-(phase>0?q.inputRaw:0n)+(phase===2?49n*10n**17n:0n);
      return erc.encodeFunctionResult('balanceOf',[units]);
    }
    if(method==='eth_sendTransaction'){
      const tx=params[0] as {data:string;to:string};assert.equal(tx.to===q.router||tx.to===q.tokenOut,true);
      if(tx.data.startsWith('0x095ea7b3'))return'approval';phase++;return phase===1?'buy':'sell';
    }
    if(method==='eth_getTransactionReceipt')return params[0]==='approval'?{status:'0x1'}:receipt(params[0]==='sell');
    throw Error('Unexpected fork method');
  }}}};
  const snapshot={sourceBlock:101n,sourceBlockHash:p.evidence.tokenSecurity[0]!.observation!.sourceBlockHash} as BStocksBscQuantitySnapshot;
  return{p,q,calls,closed:()=>closed,run:()=>createPilotRoundTrip(factory,route,()=>new Date(p.now))({...p,sessionId:'fixture'},snapshot,q)};
}

test('P5.5 owner fork buys then sells whole raw position, proves zero tax and never changes funded storage',async()=>{
  const s=scenario(),proof=await s.run();assert.equal(proof?.success,true);assert.equal(proof?.soldRaw,proof?.boughtRaw);
  assert.equal(proof?.sellTransferTaxRaw,0n);assert.equal(proof?.buyTransferTaxRaw,0n);
  assert.equal(s.calls.filter(m=>m==='eth_sendTransaction').length,3);assert.equal(s.closed(),true);
  assert.equal(s.calls.some(m=>/setBalance|setStorage|setCode/.test(m)),false);
});
test('P5.5 fork rejects tax, failed sell, changed venue code and unlimited allowance and always closes',async()=>{
  for(const mode of ['tax','failed-sell','changed-code','unlimited']){const s=scenario(mode);assert.equal(await s.run(),null);assert.equal(s.closed(),true);}
});
