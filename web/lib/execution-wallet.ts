import { Transaction, verifyTypedData } from "ethers";
import type { ExecutionReviewView } from "../../src/application/execution.js";
import { decodeExecutionJson, executionJson } from "../../src/execution/execution-json.js";
import { eoaApprovalTypedData, type EoaLegApproval } from "../../src/execution/signing-payload.js";
import { decodeV3ExactInputSingle } from "../../src/market-gate/route.js";
export interface ExecutionWallet { request(input:{method:string;params?:unknown[]}):Promise<unknown> }
const same=(a:unknown,b:unknown):boolean=>typeof a==="string"&&typeof b==="string"&&a.toLowerCase()===b.toLowerCase();
const canonical=(v:unknown):unknown=>Array.isArray(v)?v.map(canonical):v&&typeof v==="object"?
  Object.fromEntries(Object.entries(v).sort(([a],[b])=>a.localeCompare(b)).map(([k,x])=>[k,canonical(x)])):v;
export function checkedReview(r:ExecutionReviewView,wallet:string,portfolioId:string,planId:string,now=Date.now()):EoaLegApproval {
  const a=decodeExecutionJson<EoaLegApproval>(r.approval),d=decodeV3ExactInputSingle(a.calldata);
  if(r.kind!=="review"||a.legId!==r.reviewId||a.portfolioId!==portfolioId||a.planId!==planId||a.chainId!==56
    ||!same(a.wallet,wallet)||!Number.isSafeInteger(a.transactionNonce)||a.transactionNonce<0||a.value!==0n
    ||a.inputRaw<=0n||a.minimumOutputRaw<=0n||a.maxGasLimit<=0n||a.maxFeePerGas<=0n||!Number.isFinite(Date.parse(a.expiresAt))
    ||Date.parse(a.expiresAt)<=now||!d||!same(d.tokenIn,a.tokenIn)||!same(d.tokenOut,a.tokenOut)||!same(d.recipient,a.wallet)
    ||d.inputRaw!==a.inputRaw||d.minimumOutputRaw!==a.minimumOutputRaw||BigInt(Date.parse(a.expiresAt))>d.deadlineSeconds*1000n)
    throw Error("The server review is invalid, changed or expired. Request a fresh review.");
  const typed=eoaApprovalTypedData(a),expected={domain:typed.domain,types:{...typed.types,
    EIP712Domain:[{name:"name",type:"string"},{name:"version",type:"string"},{name:"chainId",type:"uint256"}]},primaryType:"Leg",message:typed.value};
  if(JSON.stringify(canonical(JSON.parse(executionJson(expected))))!==JSON.stringify(canonical(r.typedData)))throw Error("The signing payload differs from the displayed approval.");
  const hex=(n:bigint|number)=>`0x${BigInt(n).toString(16)}`;
  const tx={type:"0x2",chainId:hex(a.chainId),from:a.wallet,to:a.router,data:a.calldata,value:hex(a.value),nonce:hex(a.transactionNonce),
    gas:hex(a.maxGasLimit),maxFeePerGas:hex(a.maxFeePerGas),maxPriorityFeePerGas:"0x0"};
  if(JSON.stringify(canonical(tx))!==JSON.stringify(canonical(r.transaction)))throw Error("The transaction template differs from the displayed approval.");
  return a;
}
export async function assertWallet(wallet:ExecutionWallet,address:string,current:()=>boolean):Promise<void>{
  if(!current())throw Error("The wallet session changed. Request a fresh review.");
  const accounts=await wallet.request({method:"eth_accounts"}),chain=await wallet.request({method:"eth_chainId"});
  if(!current()||!Array.isArray(accounts)||!same(accounts[0],address)||chain!=="0x38")throw Error("The wallet account or chain changed. Sign in again.");
}
export async function signApproval(wallet:ExecutionWallet,r:ExecutionReviewView,address:string,portfolioId:string,planId:string,current:()=>boolean,now:()=>number=Date.now):Promise<string>{
  const a=checkedReview(r,address,portfolioId,planId,now());await assertWallet(wallet,address,current);
  const signature=await wallet.request({method:"eth_signTypedData_v4",params:[address,JSON.stringify(r.typedData)]});
  await assertWallet(wallet,address,current);checkedReview(r,address,portfolioId,planId,now());
  const typed=eoaApprovalTypedData(a);
  if(typeof signature!=="string"||!same(verifyTypedData(typed.domain,typed.types,typed.value,signature),address))throw Error("The wallet returned an invalid trade-approval signature.");
  return signature;
}
export function checkedRawTransaction(raw:unknown,a:EoaLegApproval):string{
  if(typeof raw!=="string"||raw.length>8192||!/^0x02(?:[0-9a-fA-F]{2})+$/.test(raw))throw Error("Import the signed raw type-2 transaction, not its hash.");
  const tx=Transaction.from(raw);
  if(!tx.isSigned()||tx.type!==2||!same(tx.from,a.wallet)||tx.chainId!==56n||!same(tx.to,a.router)
    ||tx.data.toLowerCase()!==a.calldata.toLowerCase()||tx.value!==a.value||tx.nonce!==a.transactionNonce
    ||tx.gasLimit<=0n||tx.gasLimit>a.maxGasLimit||!tx.maxFeePerGas||tx.maxFeePerGas>a.maxFeePerGas
    ||tx.maxPriorityFeePerGas===null||tx.maxPriorityFeePerGas>tx.maxFeePerGas)throw Error("Signed bytes differ from the reviewed route, wallet, nonce or gas bounds.");
  return raw;
}
