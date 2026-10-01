import { expect,test,type Page } from "@playwright/test";
import { Wallet } from "ethers";
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
  await page.exposeFunction("syntheticTypedSignature",async()=>{
    const {eoaApprovalTypedData}=await import("../../src/execution/eoa.js");const t=eoaApprovalTypedData(approval);return owner.signTypedData(t.domain,t.types,t.value);});
  const raw=await owner.signTransaction({type:2,chainId:56,to:approval.router,data:calldata,nonce:7,value:0n,
    gasLimit:300_000n,maxFeePerGas:5_000_000_000n,maxPriorityFeePerGas:0n});
  await page.exposeFunction("syntheticRawTransaction",async()=>raw);
  await page.addInitScript(({address,mode})=>{
    const listeners:Record<string,(()=>void)[]>={};let changed=false;
    Object.defineProperty(window,"ethereum",{value:{on:(name:string,fn:()=>void)=>{(listeners[name]??=[]).push(fn);},
      removeListener:(name:string,fn:()=>void)=>{listeners[name]=(listeners[name]??[]).filter(x=>x!==fn);},
      request:async({method}:{method:string})=>{
        (window as unknown as {executionWalletCalls:string[]}).executionWalletCalls.push(method);
        if(method==="eth_accounts")return[changed?"0x2222222222222222222222222222222222222222":address];
        if(method==="eth_chainId")return"0x38";
        if(method==="eth_signTypedData_v4"){
          if(mode==="account-change"){changed=true;listeners.accountsChanged?.forEach(fn=>fn());}
          return(window as unknown as {syntheticTypedSignature:()=>Promise<string>}).syntheticTypedSignature();}
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
  return{raw,calls,sends:()=>sends};
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
