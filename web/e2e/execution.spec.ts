import { expect,test,type Page } from "@playwright/test";
import { Wallet } from "ethers";
import { reanchorTypedData } from "../../src/execution/reanchor.js";
import { securityDigest } from "../../src/security/token-security.js";
import { executionJson } from "../../src/execution/execution-json.js";
import { prepareEoaLegApproval } from "../../src/execution/eoa.js";
import { executionReviewView, type ExecutionRecordView } from "../../src/application/execution.js";
import { productionFixture } from "../../test/production-execution-fixture.js";
import type { WorkspaceView } from "../../src/application/contracts.js";

async function setup(page:Page,mode="ok"){
  const owner=Wallet.createRandom(),base=productionFixture(owner.address),expires=Date.now()+120_000;
  const initial=prepareEoaLegApproval(base,{portfolioId:"browser-portfolio",planId:"browser-plan",legId:"browser-review",
    policyHash:`0x${"a".repeat(64)}`,transactionNonce:7,authorizationNonce:"synthetic-browser",expiresAt:"2026-09-28T14:00:30.000Z",maxGasLimit:300_000n,maxFeePerGas:5_000_000_000n});
  const calldata=initial.calldata.slice(0,10+64*4)+BigInt(Math.floor(expires/1000)).toString(16).padStart(64,"0")+initial.calldata.slice(10+64*5);
  const approval={...initial,calldata,expiresAt:new Date(mode==="expired"?Date.now()-1000:expires-1000).toISOString()};
  const review=executionReviewView("browser-review",approval),calls:string[]=[];let persisted=false,sends=0;
  await page.exposeFunction("syntheticTypedSignature",async(payload?:string)=>{
    if(payload){const t=JSON.parse(payload);const types={...t.types};delete types.EIP712Domain;return owner.signTypedData(t.domain,types,t.message);}
    const {eoaApprovalTypedData}=await import("../../src/execution/eoa.js");const t=eoaApprovalTypedData(approval);return owner.signTypedData(t.domain,t.types,t.value);});
  const raw=await owner.signTransaction({type:2,chainId:56,to:approval.router,data:calldata,nonce:7,value:0n,
    gasLimit:300_000n,maxFeePerGas:5_000_000_000n,maxPriorityFeePerGas:0n});
  await page.exposeFunction("syntheticRawTransaction",async()=>raw);
  await page.addInitScript(({address,mode})=>{
    const listeners:Record<string,(()=>void)[]>={};let changed=false;
    Object.defineProperty(window,"ethereum",{value:{on:(name:string,fn:()=>void)=>{(listeners[name]??=[]).push(fn);},
      removeListener:(name:string,fn:()=>void)=>{listeners[name]=(listeners[name]??[]).filter(x=>x!==fn);},
      request:async({method,params}:{method:string;params?:unknown[]})=>{
        (window as unknown as {executionWalletCalls:string[]}).executionWalletCalls.push(method);
        if(method==="eth_accounts")return[changed?"0x2222222222222222222222222222222222222222":address];
        if(method==="eth_chainId")return"0x38";
        if(method==="eth_signTypedData_v4"){
          if(mode==="account-change"){changed=true;listeners.accountsChanged?.forEach(fn=>fn());}
          return(window as unknown as {syntheticTypedSignature:(payload?:string)=>Promise<string>}).syntheticTypedSignature(String(params?.[1]));}
        if(method==="eth_signTransaction"){
          if(mode==="unsupported")throw Object.assign(Error("Unsupported signing method"),{code:4200});
          return(window as unknown as {syntheticRawTransaction:()=>Promise<string>}).syntheticRawTransaction();}
        throw Error(`Unexpected method ${method}`);
      }}});
    (window as unknown as {executionWalletCalls:string[]}).executionWalletCalls=[];
  },{address:owner.address,mode});
  const view:WorkspaceView={wallet:owner.address.toLowerCase(),sessionExpiresAt:new Date(expires).toISOString(),tradingEnabled:false,
    portfolios:[{id:"browser-portfolio",revision:"3",paused:false,dataMode:"chain"}],instruments:[],
    portfolio:{id:"browser-portfolio",revision:"3",paused:false,dataMode:"chain",chainId:56,settlement:{assetId:base.snapshot.confirmedCash.assetId,decimals:18},
      policyConfigured:true,balances:[],rules:[],decisions:[],batches:[],receipts:[]}};
  const records:ExecutionRecordView={configured:true,broadcastEnabled:mode!=="disabled",legs:[{planId:"browser-plan",legIndex:0,
    instrumentId:base.instrument.instrumentId,side:"buy",inputUnits:"5000000000000000000",decimals:18,status:"reserved",
    reviewId:null,expiresAt:null,transactionHash:null,transactionState:null}]};
  if(mode.startsWith('reanchor')) {
    Object.assign(view.portfolios[0]!,{revision:'4',paused:true});Object.assign(view.portfolio!,{revision:'4',paused:true});
    Object.assign(records.legs[0]!,{reviewId:'browser-review',transactionHash:`0x${'b'.repeat(64)}`,transactionState:'reorged',
      reanchorAvailable:true,status:'completed'});
  }
  await page.route("**/api/workspace**",route=>route.fulfill({json:view}));
  await page.route("**/api/session/logout",route=>route.fulfill({json:{ok:true}}));
  await page.route("**/api/execution**",async route=>{
    if(route.request().method()==="GET")return route.fulfill({json:records});
    const body=route.request().postDataJSON();calls.push(body.kind);
    if(body.kind==="prepare")return route.fulfill({json:mode==="blocked"?{kind:"blocked",gate:{allowed:false,reason:"TOKEN_SECURITY_BLOCKED"}}:review});
    if(body.kind==="persist"){
      expect(body.rawSignedTransaction).toBe(raw);expect(body.reviewId).toBe("browser-review");persisted=true;
      Object.assign(records.legs[0],{reviewId:"browser-review",expiresAt:approval.expiresAt,transactionHash:`0x${"b".repeat(64)}`,transactionState:"signed"});
      return route.fulfill({json:{hash:`0x${"b".repeat(64)}`,replay:false}});
    }
    if(body.kind==="broadcast"){expect(persisted).toBe(true);sends++;Object.assign(records.legs[0],{transactionState:"unknown"});
      return route.fulfill({json:{outcome:mode==="unknown"?"unknown":"accepted",hash:`0x${"b".repeat(64)}`}});}
    throw Error("Unexpected execution command");
  });
  await page.goto("/workspace");await page.getByRole("navigation",{name:"Saved workspace navigation"}).getByRole("button",{name:"Review",exact:true}).click();
  return{raw,calls,owner,view,base,sends:()=>sends};
}

test("synthetic browser exact approval persists raw bytes before separate guarded submission",async({page})=>{
  const s=await setup(page);await page.getByRole("button",{name:"Review exact trade"}).click();
  await expect(page.getByRole("heading",{name:"Exact trade bounds"})).toBeVisible();
  await expect(page.getByRole("button",{name:"Sign trade approval"})).toBeDisabled();
  await page.getByLabel("I reviewed this exact trade and its bounds.").check();
  await page.getByRole("button",{name:"Sign trade approval"}).click();
  await page.getByRole("button",{name:"Sign transaction and store"}).click();
  await expect(page.getByText("Signed transaction stored. It has not been sent.")).toBeVisible();expect(s.sends()).toBe(0);
  const beforeReload=await page.evaluate(()=>(window as unknown as {executionWalletCalls:string[]}).executionWalletCalls);
  await page.reload();
  await page.getByRole("navigation",{name:"Saved workspace navigation"}).getByRole("button",{name:"Review",exact:true}).click();
  await expect(page.getByRole("button",{name:"Sign trade approval"})).toHaveCount(0);
  await page.getByRole("button",{name:"Submit stored transaction"}).click();
  await expect(page.getByRole("status").filter({hasText:"awaiting receipt and recovery"})).toBeVisible();expect(s.calls).toEqual(["prepare","persist","broadcast"]);
  const methods=await page.evaluate(()=>(window as unknown as {executionWalletCalls:string[]}).executionWalletCalls);
  expect(beforeReload).toContain("eth_signTypedData_v4");expect(beforeReload).toContain("eth_signTransaction");
  expect(methods).not.toContain("eth_signTypedData_v4");expect([...beforeReload,...methods]).not.toContain("eth_sendTransaction");
});

test("unsupported raw-signing wallet uses explicit signed-byte import",async({page})=>{
  const s=await setup(page,"unsupported");await page.getByRole("button",{name:"Review exact trade"}).click();
  await page.getByLabel("I reviewed this exact trade and its bounds.").check();await page.getByRole("button",{name:"Sign trade approval"}).click();
  await page.getByRole("button",{name:"Sign transaction and store"}).click();await expect(page.getByRole("alert").filter({hasText:"cannot sign without sending"})).toContainText("cannot sign without sending");
  expect(s.calls).toEqual(["prepare"]);await page.getByText("Import a transaction signed without sending",{exact:true}).click();
  await page.getByLabel("Signed raw transaction").fill(s.raw);await page.getByRole("button",{name:"Validate and store signed transaction"}).click();
  await expect(page.getByText("Signed transaction stored. It has not been sent.")).toBeVisible();expect(s.sends()).toBe(0);
});

for(const mode of ["blocked","expired","account-change","disabled","unknown"]){test(`synthetic browser ${mode} keeps exact execution state honest`,async({page})=>{
  const s=await setup(page,mode);await page.getByRole("button",{name:"Review exact trade"}).click();
  if(mode==="blocked"){await expect(page.getByRole("status")).toContainText("Token security evidence is incomplete");expect(s.calls).toEqual(["prepare"]);return;}
  if(mode==="expired"){await expect(page.getByRole("alert").filter({hasText:"expired"})).toContainText("expired");await expect(page.getByRole("button",{name:"Sign trade approval"})).toHaveCount(0);return;}
  await page.getByLabel("I reviewed this exact trade and its bounds.").check();await page.getByRole("button",{name:"Sign trade approval"}).click();
  if(mode==="account-change"){await expect(page.getByRole("button",{name:"Sign in with EOA",exact:true})).toBeVisible();expect(s.calls).toEqual(["prepare"]);return;}
  await page.getByRole("button",{name:"Sign transaction and store"}).click();
  const submit=page.getByRole("button",{name:"Submit stored transaction"});
  if(mode==="disabled"){await expect(submit).toBeDisabled();expect(s.sends()).toBe(0);return;}
  await submit.click();await expect(page.getByRole("status")).toContainText("Submission uncertain; recovery must check the chain");expect(s.sends()).toBe(1);
});}

for(const tampered of [false,true])test(`synthetic owner chain initialization ${tampered?'rejects changed displayed balances':'signs and activates without sending a transaction'}`,async({page})=>{
  const s=await setup(page);s.view.portfolio!.paused=true;s.view.portfolio!.dataMode='unverified';let activations=0;
  await page.route('**/api/chain-snapshot**',async route=>{
    if(route.request().method()==='GET')return route.fulfill({json:{configured:true,maximumSpendUnits:'5000000000000000000'}});
    const body=route.request().postDataJSON();
    if(body.kind==='activate'){
      expect(body.reviewId).toBe('synthetic-chain');expect(body.ownerSignature).toMatch(/^0x/);activations++;
      s.view.portfolio!.revision='4';s.view.portfolio!.dataMode='chain';return route.fulfill({json:{revision:'4',replay:false}});
    }
    const {chainSnapshotTypedData}=await import('../../src/execution/chain-bootstrap.js');
    const {securityDigest}=await import('../../src/security/token-security.js');
    const snapshot={sourceBlock:'100',sourceBlockHash:`0x${'a'.repeat(64)}`,transactionNonce:'7',
      balances:[s.base.snapshot.confirmedCash,s.base.snapshot.nativeGas,s.base.snapshot.positions[0]!.raw].map(b=>({...b,units:b.units.toString()}))};
    const expiresAt=new Date(Date.now()+300000).toISOString();
    const t=chainSnapshotTypedData({id:'synthetic-chain',portfolioId:'browser-portfolio',wallet:s.owner.address,
      expectedRevision:3n,evidenceHash:securityDigest({kind:'bootstrap',reason:body.reason,...snapshot}),configurationHash:'f'.repeat(64),expiresAt});
    if(tampered)snapshot.balances[0]!.units='1';
    const value={reviewId:'synthetic-chain',kind:'bootstrap',reason:body.reason,snapshot,expiresAt,typedData:{domain:t.domain,primaryType:'ChainSnapshot',
      types:{...t.types,EIP712Domain:[{name:'name',type:'string'},{name:'version',type:'string'},{name:'chainId',type:'uint256'}]},message:t.value}};
    return route.fulfill({json:JSON.parse(JSON.stringify(value,(_k,v:unknown)=>typeof v==='bigint'?v.toString():v))});
  });
  await page.goto('/workspace');await page.getByRole('navigation',{name:'Saved workspace navigation'}).getByRole('button',{name:'Review',exact:true}).click();
  await page.getByRole('button',{name:'Review initial chain balances'}).click();
  await page.getByLabel('I acknowledge these balances and this explanation.').check();
  await page.getByRole('button',{name:'Sign and activate chain snapshot'}).click();
  if(tampered){await expect(page.getByRole('alert').filter({hasText:'changed or expired'})).toBeVisible();expect(activations).toBe(0);}
  else{await expect(page.getByRole('button',{name:'Review chain resync'})).toBeVisible();expect(activations).toBe(1);}
  const calls=await page.evaluate(()=>(window as unknown as {executionWalletCalls:string[]}).executionWalletCalls);
  expect(calls).not.toContain('eth_sendTransaction');expect(calls).not.toContain('eth_signTransaction');
});


for(const mode of ['reanchor','reanchor-changed'])test(`synthetic browser ${mode} signs only the bound recovery correction and preserves pause`,async({page})=>{
  const s=await setup(page,mode),expiresAt=new Date(Date.now()+120000).toISOString();
  const evidence={outcome:'R1',finalizedBlock:'200',finalizedBlockHash:`0x${'f'.repeat(64)}`,
    proof:{transactionHash:`0x${'b'.repeat(64)}`,blockNumber:'102',blockHash:`0x${'d'.repeat(64)}`},
    sources:[{id:'primary',upstreamGroup:'synthetic-a'},{id:'backup',upstreamGroup:'synthetic-b'}]};
  const t=reanchorTypedData({id:'browser-reanchor',portfolioId:'browser-portfolio',legId:'browser-review',wallet:s.owner.address,
    expectedRevision:4n,evidenceHash:securityDigest(evidence),configurationHash:'a'.repeat(64),originalProofHash:'b'.repeat(64),expiresAt});
  const review=JSON.parse(executionJson({reviewId:'browser-reanchor',outcome:'R1',expiresAt,evidence,
    typedData:{domain:t.domain,primaryType:'Reanchor',types:{...t.types,EIP712Domain:[{name:'name',type:'string'},
      {name:'version',type:'string'},{name:'chainId',type:'uint256'}]},message:t.value}}));
  const calls:string[]=[];
  await page.route('**/api/reanchor',async route=>{
    const body=route.request().postDataJSON();calls.push(body.kind);
    if(body.kind==='prepare')return route.fulfill({json:mode==='reanchor-changed'?{...review,evidence:{...evidence,outcome:'R2'}}:review});
    expect(body.kind).toBe('activate');expect(body.reviewId).toBe('browser-reanchor');expect(body.ownerSignature).toMatch(/^0x/);
    return route.fulfill({json:{revision:'5',replay:false}});
  });
  await page.getByRole('button',{name:'Review re-included fill',exact:true}).click();
  if(mode==='reanchor-changed') {
    await expect(page.getByRole('alert').filter({hasText:'Recovery review changed'})).toContainText('Recovery review changed');expect(calls).toEqual(['prepare']);
    const methods=await page.evaluate(()=>(window as unknown as {executionWalletCalls:string[]}).executionWalletCalls);
    expect(methods).not.toContain('eth_signTypedData_v4');return;
  }
  await expect(page.getByRole('button',{name:'Sign recovery correction'})).toBeDisabled();
  await page.getByLabel('I reviewed this recovery correction.').check();
  await page.getByRole('button',{name:'Sign recovery correction'}).click();
  await expect(page.getByRole('status').filter({hasText:'Fill re-anchored'})).toContainText('trading remains paused');
  expect(calls).toEqual(['prepare','activate']);
  const methods=await page.evaluate(()=>(window as unknown as {executionWalletCalls:string[]}).executionWalletCalls);
  expect(methods).toContain('eth_signTypedData_v4');expect(methods).not.toContain('eth_signTransaction');expect(methods).not.toContain('eth_sendTransaction');
});
