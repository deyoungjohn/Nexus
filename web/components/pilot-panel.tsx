'use client';
import {useEffect,useRef,useState} from 'react';
import {signChainSnapshot,type ChainSnapshotView} from '../lib/chain-snapshot-wallet';
import type {ExecutionWallet} from '../lib/execution-wallet';
import {formattedUnits} from '../lib/saved-workflow';
async function api<T>(url:string,body?:unknown):Promise<T>{
  const r=await fetch(url,{method:body?'POST':'GET',credentials:'same-origin',cache:'no-store',
    ...(body?{headers:{'Content-Type':'application/json'},body:JSON.stringify(body)}:{})});
  const value=await r.json();if(!r.ok)throw Error(value.error??'Pilot request failed.');return value as T;
}
export default function PilotPanel({wallet,portfolioId,revision,paused,dataMode,onRefresh}:{wallet:string;portfolioId:string;revision:string;
  paused:boolean;dataMode:string;onRefresh:()=>Promise<void>}){
  const [available,setAvailable]=useState<{configured:boolean;maximumSpendUnits:string|null}|null>(null),[review,setReview]=useState<ChainSnapshotView|null>(null);
  const [reason,setReason]=useState('Initialize the owner pilot from finalized BNB, USDT and NVDAB balances.');
  const [accepted,setAccepted]=useState(false),[busy,setBusy]=useState(false),[message,setMessage]=useState(''),[error,setError]=useState('');
  const epoch=useRef(0),alive=useRef(true);
  useEffect(()=>{alive.current=true;const e=++epoch.current;setReview(null);setAccepted(false);setAvailable(null);setBusy(false);
    api<{configured:boolean;maximumSpendUnits:string|null}>(`/api/chain-snapshot?portfolio=${encodeURIComponent(portfolioId)}`)
      .then(v=>{if(alive.current&&epoch.current===e)setAvailable(v);}).catch(()=>{});
    return()=>{alive.current=false;epoch.current++;};},[wallet,portfolioId,revision,paused]);
  const current=(e:number)=>()=>alive.current&&epoch.current===e;
  async function run(action:(e:number)=>Promise<void>){const e=epoch.current;setBusy(true);setError('');setMessage('');
    try{await action(e);}catch(err){if(current(e)())setError(err instanceof Error?err.message:'Pilot request failed.');}
    finally{if(current(e)())setBusy(false);}}
  if(!available?.configured)return null;
  return <section className="card" aria-labelledby="pilot-setup"><h3 id="pilot-setup">Owner-only pilot setup</h3>
    <p>One NVDAB buy, up to {formattedUnits(available.maximumSpendUnits!,18)} USDT. Independent review is deferred. Every trade requires your exact approval.</p>
    {error&&<p role="alert">{error}</p>}{message&&<p role="status">{message}</p>}
    {paused?<><label>Snapshot reason or explanation<input value={reason} onChange={e=>{setReason(e.target.value);setReview(null);setAccepted(false);}} /></label>
      <button type="button" className="secondary" disabled={busy||reason.trim().length<8} onClick={()=>run(async e=>{
        const r=await api<ChainSnapshotView>('/api/chain-snapshot',{kind:dataMode==='unverified'?'bootstrap':'resync',portfolioId,reason});
        if(current(e)()){setReview(r);setAccepted(false);}})}>{dataMode==='unverified'?'Review initial chain balances':'Review chain resync'}</button>
      {review&&<div><p>Finalized block {review.snapshot.sourceBlock} · nonce {review.snapshot.transactionNonce}. This keeps trading paused.</p>
        <pre>{JSON.stringify(review.snapshot,null,2)}</pre><label className="checkbox-label"><input type="checkbox" checked={accepted}
          onChange={e=>setAccepted(e.target.checked)} />I acknowledge these balances and this explanation.</label>
        <button type="button" className="primary" disabled={busy||!accepted} onClick={()=>run(async e=>{
          const provider=(window as Window&{ethereum?:ExecutionWallet}).ethereum;if(!provider)throw Error('Open your EOA wallet extension.');
          const signature=await signChainSnapshot(provider,review,wallet,portfolioId,revision,current(e));
          if(!current(e)())return;await api('/api/chain-snapshot',{kind:'activate',reviewId:review.reviewId,ownerSignature:signature});
          if(current(e)()){setReview(null);setMessage('Chain balances acknowledged. Resume planning separately in Settings.');await onRefresh();}
        })}>Sign and activate chain snapshot</button></div>}</>:dataMode==='chain'?<button type="button" className="secondary" disabled={busy}
      onClick={()=>run(async e=>{const r=await api<{planId:string}>('/api/pilot-plan',{portfolioId,requestId:crypto.randomUUID()});
        if(current(e)()){setMessage(`Pilot plan ${r.planId} created. Review its exact trade below.`);await onRefresh();}})}>Create bounded pilot plan</button>
      :<p>Pause in Settings before reviewing initial chain balances.</p>}
  </section>;
}
