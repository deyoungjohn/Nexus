import assert from 'node:assert/strict';
import test from 'node:test';
import { Wallet } from 'ethers';
import { productionFixture, refreshFixtureEvidence } from './production-execution-fixture.js';
import { executionMarketExpiry, revalidateExecutionMarket } from '../src/execution/market-revalidation.js';
import { prepareEoaLegApproval, verifySignedEoaSwap, eoaApprovalTypedData } from '../src/execution/eoa.js';
import { assessTokenSecurity } from '../src/security/token-security.js';
import { evaluateMarketGate } from '../src/market-gate/gate.js';
import { pilotPriceBand, validatePilotProfile } from '../src/pilot/profile.js';

import {pilotFixture} from './pilot-fixture.js';

test('P5.5 pilot admits deferred review honestly, bounds true reference age and worst signed price',()=>{
  const p=pilotFixture();assert.equal(evaluateMarketGate(p).allowed,true);
  assert.equal(p.evidence.tokenSecurity[0]!.state,'unsupported');assert.equal(p.evidence.audit.state,'unsupported');
  const {pilotProfile:_profile,...strict}=p;
  assert.equal(evaluateMarketGate(strict).allowed,false);
  assert.equal(pilotPriceBand(p.pilotProfile,3600000),110);
  assert.equal(pilotPriceBand(p.pilotProfile,86400000),200);
  assert.throws(()=>pilotPriceBand(p.pilotProfile,86400001));
  assert.equal(evaluateMarketGate({...p,evidence:{...p.evidence,reference:{...p.evidence.reference!,sourceAt:'2026-09-27T13:59:00Z'}}}).allowed,false);
  assert.equal(evaluateMarketGate({...p,pilotProfile:{...p.pilotProfile,wallet:'0x2222222222222222222222222222222222222222'}}).allowed,false);
  assert.throws(()=>validatePilotProfile({...p.pilotProfile,maximumSpendRaw:p.pilotProfile.maximumSpendRaw+1n}));
  for(const r of [{...p.evidence.pilotRoundTrip,success:false},{...p.evidence.pilotRoundTrip,buyTransferTaxRaw:1n},
    {...p.evidence.pilotRoundTrip,soldRaw:1n},{...p.evidence.pilotRoundTrip,sellCalldata:'0x'}]){
    assert.equal(evaluateMarketGate({...p,evidence:{...p.evidence,pilotRoundTrip:r}}).allowed,false);
  }
  const changed=structuredClone(p);Object.assign(changed.evidence.tokenSecurity[0]!.observation!.controls,{owner:'0x2222222222222222222222222222222222222222'});
  assert.equal(evaluateMarketGate(changed).allowed,false);
  const risk=structuredClone(p);risk.evidence.tokenSecurity= risk.evidence.tokenSecurity.map(s=>assessTokenSecurity({...s,
    providers:s.providers.map(provider=>({...provider,state:'risk' as const,findings:['buy_tax-nonzero']})),now:risk.now,maxAgeMs:600000}));
  assert.equal(evaluateMarketGate(risk).allowed,false);
  assert.throws(()=>validatePilotProfile({...p.pilotProfile,security:p.pilotProfile.security.map(s=>({...s,acceptedFindings:{binance:[],goplus:['buy_tax-nonzero']}}))}));
});

test('P7 renewable signing survives a 30-second status lease but stale/changed sources cannot submit',async()=>{
  const owner=Wallet.createRandom(),base=productionFixture(owner.address);
  const approved={...base,marketPolicy:{...base.marketPolicy,approvalClock:'refresh-before-submit' as const,maxQuoteAgeMs:300000},
    evidence:{...base.evidence,tokenStatus:{...base.evidence.tokenStatus!,expiresAt:'2026-09-28T14:00:30Z'}}};
  assert.equal(new Date(executionMarketExpiry(approved)).toISOString(),'2026-09-28T14:04:00.000Z');
  const now='2026-09-28T14:01:00.000Z';
  const current=refreshFixtureEvidence(approved.evidence,now);
  const fresh=revalidateExecutionMarket(approved,current,now);
  assert.equal(fresh.evidence,current);assert.equal(evaluateMarketGate({...approved,now}).allowed,false);
  const expected={portfolioId:'p',planId:'plan',legId:'leg',policyHash:`0x${'a'.repeat(64)}`,transactionNonce:7,
    authorizationNonce:'a',maxGasLimit:300000n,maxFeePerGas:5000000000n,expiresAt:'2026-09-28T14:03:00Z'};
  const approval=prepareEoaLegApproval(approved,expected),typed=eoaApprovalTypedData(approval);
  const signature=await owner.signTypedData(typed.domain,typed.types,typed.value);
  const raw=await owner.signTransaction({type:2,chainId:56,to:approval.router,data:approval.calldata,value:0n,nonce:7,
    gasLimit:300000n,maxFeePerGas:5000000000n,maxPriorityFeePerGas:0n});
  assert.match(verifySignedEoaSwap(approval,signature,raw,fresh,expected,false,approved),/^0x/);
  assert.throws(()=>verifySignedEoaSwap(approval,signature,raw,{...fresh,snapshot:{...fresh.snapshot,revision:2n}},expected,false,approved));
  assert.throws(()=>revalidateExecutionMarket(approved,{...current,tokenStatus:approved.evidence.tokenStatus},now));
  assert.throws(()=>revalidateExecutionMarket(approved,{...current,reference:{...current.reference!,pricePerShare:201n*10n**18n}},now));
  assert.throws(()=>revalidateExecutionMarket(approved,current,'2026-09-28T14:04:00Z'));
});

test('P5.5 settlement heartbeat is separate from live status age and never fabricates a new source time',()=>{
  const p=productionFixture('0x1111111111111111111111111111111111111111');
  const aged={...p,evidence:{...p.evidence,settlement:{...p.evidence.settlement!,observedAt:'2026-09-28T13:49:00Z',expiresAt:'2026-09-28T14:04:00Z'}}};
  assert.equal(evaluateMarketGate(aged).allowed,false);
  assert.equal(evaluateMarketGate({...aged,marketPolicy:{...p.marketPolicy,maxSettlementAgeMs:900000}}).allowed,true);
  assert.equal(evaluateMarketGate({...aged,now:'2026-09-28T14:05:00Z',marketPolicy:{...p.marketPolicy,maxSettlementAgeMs:900000}}).allowed,false);
});

test('P5.5 external allowance proof requires exact amount/spender, canonical success and finality',async()=>{
  const {verifyPilotAllowanceApproval}=await import('../src/pilot/allowance.js');
  const {Interface}=await import('ethers');
  const {BSTOCKS_BSC_V3_ROUTER}=await import('../src/market-gate/bstocks-transfer.js');
  const p=pilotFixture().pilotProfile,txHash=`0x${'a'.repeat(64)}`,blockHash=`0x${'b'.repeat(64)}`;
  const abi=new Interface(['function approve(address,uint256) returns(bool)','event Approval(address indexed owner,address indexed spender,uint256 value)']);
  const token='0x55d398326f99059ff775485246999027b3197955';
  const fetcher=(mode='good'):typeof fetch=>(async(_url,init)=>{
    const b=JSON.parse(String(init?.body));const amount=mode==='unlimited'?(2n**256n-1n):p.maximumSpendRaw;
    const event=abi.encodeEventLog(abi.getEvent('Approval')!,[p.wallet,BSTOCKS_BSC_V3_ROUTER,amount]);
    const result=b.method==='eth_chainId'?'0x38':b.method==='eth_blockNumber'?'0xc8':b.method==='eth_getTransactionByHash'
      ?{hash:txHash,from:p.wallet,to:token,value:'0x0',input:abi.encodeFunctionData('approve',[BSTOCKS_BSC_V3_ROUTER,amount]),blockNumber:'0x64',blockHash}
      :b.method==='eth_getTransactionReceipt'?{transactionHash:txHash,from:p.wallet,to:token,blockNumber:'0x64',blockHash,
        status:mode==='reverted'?'0x0':'0x1',logs:[{address:token,...event}]}
      :{number:'0x64',hash:mode==='reorg'?txHash:blockHash};
    return new Response(JSON.stringify({jsonrpc:'2.0',id:b.id,result}));
  }) as typeof fetch;
  const input={rpcUrl:'https://fixture.invalid',profile:p,transactionHash:txHash,snapshotBlock:150n,finalityBlocks:12n};
  assert.equal(await verifyPilotAllowanceApproval(input,fetcher()),true);
  for(const mode of ['unlimited','reverted','reorg'])assert.equal(await verifyPilotAllowanceApproval(input,fetcher(mode)),false);
  assert.equal(await verifyPilotAllowanceApproval({...input,snapshotBlock:99n},fetcher()),false);
  assert.equal(await verifyPilotAllowanceApproval({...input,finalityBlocks:102n},fetcher()),false);
});
