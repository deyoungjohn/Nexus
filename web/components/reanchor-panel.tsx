'use client';
import {useEffect,useRef,useState} from 'react';
import {checkedReanchor,signReanchor,type ReanchorView} from '../lib/reanchor-wallet';
import type {ExecutionWallet} from '../lib/execution-wallet';
async function api<T>(body:unknown):Promise<T> {
  const response=await fetch('/api/reanchor',{method:'POST',credentials:'same-origin',cache:'no-store',
    headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
  const value=await response.json();if(!response.ok)throw Error(value.error??'Recovery review unavailable.');return value;
}
export default function ReanchorPanel({wallet,portfolioId,legId,revision,onRefresh}:{wallet:string;portfolioId:string;legId:string;
  revision:string;onRefresh:()=>Promise<void>}) {
  const [review,setReview]=useState<ReanchorView|null>(null),[accepted,setAccepted]=useState(false),[busy,setBusy]=useState(false),
    [error,setError]=useState(''),[notice,setNotice]=useState('');
  const epoch=useRef(0),alive=useRef(true);
  useEffect(()=>{alive.current=true;epoch.current++;setReview(null);setAccepted(false);
    return()=>{alive.current=false;epoch.current++;};},[wallet,portfolioId,legId,revision]);
  const current=(e:number)=>()=>alive.current&&epoch.current===e;
  async function run(action:(e:number)=>Promise<void>) {const e=epoch.current;setBusy(true);setError('');
    try{await action(e);}catch(error){if(current(e)())setError(error instanceof Error?error.message:'Recovery failed.');}
    finally{if(current(e)())setBusy(false);}}
  return <div className="receipt"><h4>Review a re-included fill</h4>
    <p>A counted fill has lost its canonical block. Recovery can re-anchor the same transaction only after two independent sources confirm identical effects. Trading stays paused.</p>
    {error&&<p role="alert">{error}</p>}{notice&&<p role="status">{notice}</p>}
    <button type="button" className="secondary" disabled={busy} onClick={()=>run(async e=>{
      setReview(null);setAccepted(false);const r=await api<ReanchorView>({kind:'prepare',portfolioId,legId});
      checkedReanchor(r,wallet,portfolioId,legId,revision);if(current(e)())setReview(r);
    })}>Review re-included fill</button>
    {review&&<><p>No balance change. Revision {revision} → {(BigInt(revision)+1n).toString()}. Review expires {review.expiresAt}.</p>
      <details><summary>Verified recovery evidence</summary><pre>{JSON.stringify(review.evidence,null,2)}</pre></details>
      <label className="checkbox-label"><input type="checkbox" checked={accepted} onChange={e=>setAccepted(e.target.checked)} />I reviewed this recovery correction.</label>
      <button type="button" className="primary" disabled={busy||!accepted||Date.parse(review.expiresAt)<=Date.now()} onClick={()=>run(async e=>{
        const provider=(window as Window&{ethereum?:ExecutionWallet}).ethereum;if(!provider)throw Error('Open your EOA wallet extension.');
        const signature=await signReanchor(provider,review,wallet,portfolioId,legId,revision,current(e));
        if(!current(e)())return;await api({kind:'activate',reviewId:review.reviewId,ownerSignature:signature});
        if(current(e)()){setReview(null);setNotice('Fill re-anchored. Balances are unchanged and trading remains paused.');await onRefresh();}
      })}>Sign recovery correction</button></>}
  </div>;
}
