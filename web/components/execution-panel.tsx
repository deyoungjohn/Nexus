"use client";
import { useEffect, useRef, useState } from "react";
import type { ExecutionRecordView, ExecutionReviewView } from "../../src/application/execution";
import { assertWallet, checkedRawTransaction, checkedReview, signApproval, type ExecutionWallet } from "../lib/execution-wallet";
import ReanchorPanel from "./reanchor-panel";
import { formattedUnits } from "../lib/saved-workflow";
async function request<T>(portfolioId:string,body?:unknown):Promise<T>{
  const response=await fetch(`/api/execution${body?"":`?portfolio=${encodeURIComponent(portfolioId)}`}`,{method:body?"POST":"GET",credentials:"same-origin",cache:"no-store",
    ...(body?{headers:{"Content-Type":"application/json"},body:JSON.stringify(body)}:{})});
  const value=await response.json();if(!response.ok)throw Error(value.error??"Execution request failed.");return value as T;
}
const reasons:Record<string,string>={
  P1:"The price feed returned incomplete or invalid data.",P2:"Price feed history went backwards.",
  P3:"The price update is later than its chain block.",P4:"The stock feed has not updated during today's market session.",
  P5:"The USDT reference price is too old.",P6:"USDT is outside the approved dollar peg range.",
  P7:"The pool price is outside the approved reference band.",P8:"The expected or minimum fill is outside the approved price band.",
  P9:"The trade's gas ceiling exceeds the absolute fee cap.",
  MISSING_EVIDENCE:"Required trading evidence is unavailable.",STALE_EVIDENCE:"Trading evidence needs refreshing.",
  ELIGIBILITY_BLOCKED:"Current access requirements have not been verified.",QUANTITY_CHANGED:"The token's economic mapping needs a new review.",
  REFERENCE_UNAVAILABLE:"A fresh stock reference price is unavailable.",SESSION_CLOSED:"The approved market session is closed.",
  TOKEN_HALTED:"The token is paused or halted.",AUDIT_UNSUPPORTED:"Token audit evidence is unavailable.",
  TOKEN_SECURITY_BLOCKED:"Token security evidence is incomplete or restricted.",EVENT_RESTRICTED:"A company or token-provider event blocks trading.",
  QUOTE_COST:"Trading costs exceed the approved limits.",PRICE_DEVIATION:"The route price exceeds the approved fair-price bound.",
  SIMULATION_MISMATCH:"The exact trade could not be verified against real wallet state.",PORTFOLIO_LIMIT:"The trade exceeds portfolio limits."
};
export default function ExecutionPanel({wallet,portfolioId,revision,paused,dataMode,onRefresh}:{wallet:string;portfolioId:string;revision:string;paused:boolean;dataMode:string;onRefresh:()=>Promise<void>}){
  const [records,setRecords]=useState<ExecutionRecordView|null>(null),[review,setReview]=useState<ExecutionReviewView|null>(null);
  const [signature,setSignature]=useState(""),[raw,setRaw]=useState(""),[accepted,setAccepted]=useState(false),[busy,setBusy]=useState(false);
  const [error,setError]=useState(""),[notice,setNotice]=useState(""),[time,setTime]=useState(Date.now());
  const generation=useRef(0),alive=useRef(true);
  const invalidate=()=>{generation.current++;setReview(null);setSignature("");setRaw("");setAccepted(false);};
  async function reload(){const g=generation.current;const r=await request<ExecutionRecordView>(portfolioId);if(alive.current&&g===generation.current)setRecords(r);}
  useEffect(()=>{alive.current=true;invalidate();setRecords(null);reload().catch(e=>{if(alive.current)setError(e.message);});
    return()=>{alive.current=false;generation.current++;};},[wallet,portfolioId,revision,paused]);
  useEffect(()=>{const timer=setInterval(()=>setTime(Date.now()),1000);return()=>clearInterval(timer);},[]);
  const current=(g:number)=>()=>alive.current&&generation.current===g;
  const provider=():ExecutionWallet=>{const p=(window as Window&{ethereum?:ExecutionWallet}).ethereum;if(!p)throw Error("Open an EOA wallet extension.");return p;};
  async function run(action:(g:number)=>Promise<void>){const g=generation.current;setBusy(true);setError("");setNotice("");
    try{await action(g);}catch(e){if(current(g)())setError(e instanceof Error?e.message:"Execution failed.");}
    finally{if(alive.current)setBusy(false);}}
  const expired=!review||Date.parse(String(review.approval.expiresAt))<=time;
  async function prepare(planId:string,legIndex:number,g:number){
    setReview(null);setSignature("");setRaw("");setAccepted(false);
    const r=await request<ExecutionReviewView|{kind:"blocked";gate:{reason:string}}>(portfolioId,{kind:"prepare",planId,legIndex});
    if(!current(g)())return;setSignature("");setRaw("");setAccepted(false);
    if(r.kind==="blocked"){setReview(null);setNotice(`Trade blocked: ${reasons[r.gate.reason]??"A fresh verified route review is required."} No signature requested.`);return;}
    checkedReview(r,wallet,portfolioId,planId);setReview(r);setNotice("Review the exact bounds before signing.");
  }
  async function persist(g:number,imported?:string){
    if(!review||!signature)throw Error("Sign the reviewed trade approval first.");
    const a=checkedReview(review,wallet,portfolioId,String(review.approval.planId));await assertWallet(provider(),wallet,current(g));
    let bytes:unknown=imported;
    if(!bytes){try{bytes=await provider().request({method:"eth_signTransaction",params:[review.transaction]});}
      catch(e){const code=(e as {code?:number}).code;if(code===-32601||code===4200)throw Error("This wallet cannot sign without sending. Sign the exact transaction with a compatible wallet, then import its raw signed bytes below. Nothing was submitted.");throw e;}}
    await assertWallet(provider(),wallet,current(g));checkedReview(review,wallet,portfolioId,String(review.approval.planId));
    const signed=checkedRawTransaction(bytes,a);if(!current(g)())return;
    await request(portfolioId,{kind:"persist",reviewId:review.reviewId,ownerSignature:signature,rawSignedTransaction:signed});
    if(current(g)()){setRaw("");setReview(null);setSignature("");setNotice("Signed transaction stored. It has not been sent.");await reload();await onRefresh();}
  }
  async function broadcast(reviewId:string,g:number){await assertWallet(provider(),wallet,current(g));
    const r=await request<{outcome:string;hash:string}>(portfolioId,{kind:"broadcast",reviewId});
    if(current(g)()){setNotice(`${r.outcome=== "accepted"?"Submitted; awaiting receipt and recovery":r.outcome==="already-claimed"?"Already claimed; no repeat send":"Submission uncertain; recovery must check the chain"}. ${r.hash}`);await reload();await onRefresh();}}
  return <section className="card execution-panel"><span className="panel-kicker">EXACT EOA TRADE REVIEW</span><h2>Trade approvals</h2>
    <p>Rule activation does not approve a trade. Review each accepted leg, sign its exact bounds and transaction, then submit separately.</p>
    {error&&<p className="error-banner" role="alert">{error}</p>}{notice&&<p className="notice" role="status">{notice}</p>}
    {!records?<p>Loading execution records…</p>:<>
      {!records.configured&&<p>Live review sources are not configured. Trading remains blocked.</p>}
      {!records.broadcastEnabled&&<p>Submission is disabled for this deployment.</p>}
      {dataMode!=="chain"&&<p>Balances must be verified from the chain before a trade can be reviewed.</p>}
      {records.legs.length===0&&<p>No accepted execution leg is available. A trusted evaluation must reserve a plan first.</p>}
      {records.legs.map(leg=><article key={`${leg.planId}:${leg.legIndex}`} className="receipt">
        <h3>{leg.side.toUpperCase()} · {leg.instrumentId}</h3><p>{formattedUnits(leg.inputUnits,leg.decimals)} input units · plan {leg.planId} · leg {leg.legIndex+1} · {leg.status}</p>
        {leg.transactionHash?<><p>{leg.transactionState} · {leg.transactionHash}</p>{leg.transactionState==="signed"&&<button type="button" className="primary" disabled={busy||paused||!records.broadcastEnabled||Date.parse(leg.expiresAt??"")<=time} onClick={()=>run(g=>broadcast(leg.reviewId!,g))}>Submit stored transaction</button>}<p>Activity shows canonical receipts and recovery; a submitted hash is not a reconciled fill.</p></>:
          <button type="button" className="secondary" disabled={busy||paused||dataMode!=="chain"||!records.configured||!["reserved","executing"].includes(leg.status)} onClick={()=>run(g=>prepare(leg.planId,leg.legIndex,g))}>Review exact trade</button>}
        {paused&&leg.reanchorAvailable&&leg.reviewId&&<ReanchorPanel wallet={wallet} portfolioId={portfolioId}
          legId={leg.reviewId} revision={revision} onRefresh={onRefresh} />}
      </article>)}
    </>}
    {review&&<div className="receipt"><h3>Exact trade bounds</h3><dl>
      {[["Input token",review.approval.tokenIn],["Input base units",review.approval.inputRaw],["Output token",review.approval.tokenOut],
        ["Minimum output base units",review.approval.minimumOutputRaw],["Router / spender",review.approval.router],["Recipient",review.approval.wallet],
        ["Nonce",review.approval.transactionNonce],["Maximum gas",review.approval.maxGasLimit],["Maximum fee per gas (wei)",review.approval.maxFeePerGas],
        ["Expiry",review.approval.expiresAt],["Evidence hash",review.approval.evidenceHash]].map(([label,value])=><div key={String(label)}><dt>{String(label)}</dt><dd>{String(value)}</dd></div>)}
      </dl>
      {review.pilotAdmission&&<div role="note"><strong>Owner-only pilot · maximum {formattedUnits(review.pilotAdmission.maximumSpendUnits,18)} USDT</strong>
        <p>Independent security review is deferred. Scanner gaps remain. The issuer can upgrade, pause, freeze or mint and burn tokens.</p>
        <p>Reference time: {review.pilotAdmission.referenceSourceAt}. Price band: {review.pilotAdmission.referenceBandBps/100}%. Buy-and-sell simulation passed.</p>
        <details><summary>Pilot evidence and recorded findings</summary><pre>{JSON.stringify(review.pilotAdmission,null,2)}</pre></details></div>}
      <details><summary>Exact calldata and unsigned transaction</summary><pre>{JSON.stringify(review.transaction,null,2)}</pre></details>
      {expired?<p role="alert">Review expired. Request a fresh review before signing.</p>:<>
        <label className="checkbox-label"><input type="checkbox" checked={accepted} onChange={e=>setAccepted(e.target.checked)} />I reviewed this exact trade and its bounds.</label>
        <button type="button" className="primary" disabled={busy||paused||!accepted||Boolean(signature)} onClick={()=>run(async g=>{const s=await signApproval(provider(),review,wallet,portfolioId,String(review.approval.planId),current(g));if(current(g)()){setSignature(s);setNotice("Trade bounds approved. Sign the exact transaction separately.");}})}>Sign trade approval</button>
        {signature&&<><button type="button" className="secondary" disabled={busy||paused} onClick={()=>run(g=>persist(g))}>Sign transaction and store</button>
          <details><summary>Import a transaction signed without sending</summary><p>For wallets that cannot return raw signed bytes. Use the exact template above; never provide a private key.</p>
            <label>Signed raw transaction<textarea value={raw} onChange={e=>setRaw(e.target.value)} autoComplete="off" spellCheck={false} /></label>
            <button type="button" className="secondary" disabled={busy||paused||!raw} onClick={()=>run(g=>persist(g,raw))}>Validate and store signed transaction</button></details></>}
      </>}
    </div>}
  </section>;
}
