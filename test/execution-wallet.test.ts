import assert from "node:assert/strict";
import test from "node:test";
import { Wallet } from "ethers";
import { executionReviewView } from "../src/application/execution.js";
import { prepareEoaLegApproval, eoaApprovalTypedData } from "../src/execution/eoa.js";
import { checkedReview, signApproval, checkedRawTransaction, type ExecutionWallet } from "../web/lib/execution-wallet.js";
import { productionFixture } from "./production-execution-fixture.js";

const now=Date.parse("2026-09-28T14:00:00.000Z");
function review(){const owner=Wallet.createRandom(),base=productionFixture(owner.address);
  const a=prepareEoaLegApproval(base,{portfolioId:"portfolio",planId:"plan",legId:"review",policyHash:`0x${"a".repeat(64)}`,
    transactionNonce:7,authorizationNonce:"synthetic",expiresAt:"2026-09-28T14:00:30.000Z",maxGasLimit:300_000n,maxFeePerGas:5_000_000_000n});
  return{owner,a,r:executionReviewView("review",a)};}

test("P8 EOA payload is the exact displayed review and rejects injected signing/template changes",()=>{
  const {owner,r}=review();assert.ok(checkedReview(r,owner.address,"portfolio","plan",now));
  for(const patch of [{typedData:{...r.typedData,primaryType:"Other"}},
    {transaction:{...r.transaction,to:owner.address}},{approval:{...r.approval,minimumOutputRaw:"1"}},
    {approval:{...r.approval,chainId:1}},{approval:{...r.approval,planId:"other"}}])assert.throws(()=>checkedReview({...r,...patch},owner.address,"portfolio","plan",now));
  assert.throws(()=>checkedReview(r,owner.address,"portfolio","plan",now+60_000));
});

test("P8 EOA approval requests one typed signature and rechecks changed account/chain/session",async()=>{
  for(const mode of ["ok","account","chain","session","signer"]){const {owner,a,r}=review();const methods:string[]=[];let signed=false,current=true;
    const provider:ExecutionWallet={async request({method}){methods.push(method);
      if(method==="eth_accounts")return[signed&&mode==="account"?"0x2222222222222222222222222222222222222222":owner.address];
      if(method==="eth_chainId")return signed&&mode==="chain"?"0x1":"0x38";
      if(method==="eth_signTypedData_v4"){signed=true;if(mode==="session")current=false;
        const t=eoaApprovalTypedData(a);return(mode==="signer"?Wallet.createRandom():owner).signTypedData(t.domain,t.types,t.value);}
      throw Error("Unexpected wallet method");}};
    const call=()=>signApproval(provider,r,owner.address,"portfolio","plan",()=>current,()=>now);
    if(mode==="ok")assert.match(await call(),/^0x[0-9a-f]{130}$/i);else await assert.rejects(call);
    assert.equal(methods.filter(m=>m==="eth_signTypedData_v4").length,1);assert.ok(!methods.includes("eth_sendTransaction"));
  }
});

test("P8 imported signed transaction rejects hashes, wrong route/nonce/wallet and excess gas",async()=>{
  const {owner,a}=review();const unsigned={type:2,chainId:56,nonce:a.transactionNonce,to:a.router,data:a.calldata,value:0n,
    gasLimit:a.maxGasLimit,maxFeePerGas:a.maxFeePerGas,maxPriorityFeePerGas:0n};
  const raw=await owner.signTransaction(unsigned);assert.equal(checkedRawTransaction(raw,a),raw);
  // Separate awaited signing loop to keep each rejected byte stream explicit.
  for(const patch of [{nonce:8},{to:owner.address},{data:"0x"},{gasLimit:a.maxGasLimit+1n},{chainId:1},{value:1n}]){
    const bad=await owner.signTransaction({...unsigned,...patch});assert.throws(()=>checkedRawTransaction(bad,a));}
  assert.throws(()=>checkedRawTransaction(`0x${"a".repeat(64)}`,a));
  const wrongWallet=await Wallet.createRandom().signTransaction(unsigned);assert.throws(()=>checkedRawTransaction(wrongWallet,a));
});
