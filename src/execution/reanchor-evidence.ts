import { createHash } from 'node:crypto';
import { Transaction } from 'ethers';
import { requireInput } from '../domain/errors.js';
import type { Amount } from '../domain/amount.js';
import { securityDigest } from '../security/token-security.js';
import type { EoaRecoveryContext } from './store.js';
import { parseRecoveryConfig,resolveRecoveryAssets,type RecoveryConfig } from './recovery-config.js';
import { fetchBscTrackedBalances } from './bsc-balances.js';
import { fetchBscReceiptEffectProof } from './bsc-receipt-effects.js';
import { verifyBscRecoveryContracts } from './recovery-contracts.js';
import { fetchCanonicalAllowance,type CanonicalAllowanceProof } from './allowance-proof.js';
import { receiptEffectsIdentity,verifyEoaReceiptEffects,type EoaReceiptEffectProof } from './receipt-effects.js';

export interface AppliedFillProof {readonly proof:EoaReceiptEffectProof;readonly before:readonly Amount[];readonly after:readonly Amount[]}
export interface R1Evidence {
  readonly outcome:'R1';readonly finalizedBlock:bigint;readonly finalizedBlockHash:string;
  readonly proof:EoaReceiptEffectProof;readonly before:readonly Amount[];readonly after:readonly Amount[];
  readonly allowanceProof:CanonicalAllowanceProof|null;
  readonly sources:readonly {readonly id:string;readonly upstreamGroup:string;readonly endpointDigest:string;
    readonly reviewDigest:string;readonly oldCanonicalHash:string;readonly evidenceDigest:string}[];
}
export interface ReanchorReader {
  read(context:EoaRecoveryContext,original:AppliedFillProof,signedTransaction:string,pinned?:R1Evidence):Promise<R1Evidence|null>;
}
export const rawBalanceDigest=(balances:readonly Amount[])=>securityDigest([...balances].sort((a,b)=>a.assetId.localeCompare(b.assetId)));

/** Two complete reads, explicit independence and finalized-tag support. No replacement/cancellation port. */
export function createBscReanchorReader(rawConfig:RecoveryConfig,fetcher:typeof fetch=fetch):ReanchorReader {
  const config=parseRecoveryConfig(rawConfig);
  return{async read(context,original,signedTransaction,pinned) {
    const independent=config.sources.filter(s=>s.independence&&Date.parse(s.independence.reviewedAt)<=Date.now());
    requireInput(new Set(independent.map(s=>s.independence!.upstreamGroup)).size>=2,
      'RPC_INDEPENDENCE_REQUIRED','Two reviewed RPC sources with distinct known upstreams are required for R1.');
    const sources=independent.filter((s,i)=>independent.findIndex(x=>x.independence!.upstreamGroup===s.independence!.upstreamGroup)===i).slice(0,2);
    const signed=Transaction.from(signedTransaction),assets=resolveRecoveryAssets(config,context);
    requireInput(signed.hash?.toLowerCase()===context.transactionHash&&signed.nonce===Number(context.nonce),
      'INVALID_RECOVERY_CONTEXT','Persisted exact transaction required.');
    const connections=sources.map(source=>{let id=0;return{source,rpc:async(method:string,params:unknown[])=>{
      const n=++id,response=await fetcher(source.rpcUrl,{method:'POST',headers:{'Content-Type':'application/json'},
        body:JSON.stringify({jsonrpc:'2.0',id:n,method,params}),signal:AbortSignal.timeout(5000)});
      const body=await response.json() as Record<string,unknown>;
      if(!response.ok||body.error||body.id!==n)throw Error('RPC unavailable');return body.result;
    }};});
    const qty=(v:unknown)=>{if(typeof v!=='string'||!/^0x(?:0|[1-9a-f][0-9a-f]*)$/i.test(v))throw Error('RPC quantity unavailable');return BigInt(v);};
    const block=async(rpc:typeof connections[number]['rpc'],tag:string)=>{
      const b=await rpc('eth_getBlockByNumber',[tag,false]) as Record<string,unknown>|null;
      if(!b||typeof b.hash!=='string'||!/^0x[0-9a-f]{64}$/i.test(b.hash))throw Error('Finalized block unavailable');
      return{number:qty(b.number),hash:b.hash.toLowerCase()};
    };
    try {
      const heads=await Promise.all(connections.map(async c=>{
        if(await c.rpc('eth_chainId',[])!=='0x38')throw Error('Wrong chain');return block(c.rpc,'finalized');
      }));
      const finalizedBlock=pinned?.finalizedBlock??heads.reduce((a,b)=>a.number<b.number?a:b).number;
      if(heads.some(h=>h.number<finalizedBlock))return null;
      const tag=`0x${finalizedBlock.toString(16)}`;
      const observations=await Promise.all(connections.map(async(c,index)=>{
        const head=await block(c.rpc,tag),old=await block(c.rpc,`0x${original.proof.blockNumber.toString(16)}`);
        if(head.number!==finalizedBlock||old.number!==original.proof.blockNumber||old.hash===original.proof.blockHash
          ||finalizedBlock<original.proof.blockNumber)return null;
        const tx=await c.rpc('eth_getTransactionByHash',[context.transactionHash]) as Record<string,unknown>|null;
        if(!tx||String(tx.hash).toLowerCase()!==context.transactionHash||String(tx.from).toLowerCase()!==context.wallet
          ||String(tx.to).toLowerCase()!==context.router.toLowerCase()||tx.input!==signed.data||qty(tx.value)!==0n
          ||qty(tx.nonce)!==context.nonce)return null;
        const number=qty(tx.blockNumber),hash=String(tx.blockHash).toLowerCase();
        if(number===original.proof.blockNumber&&hash===original.proof.blockHash||number>finalizedBlock
          ||number<=0n||finalizedBlock-number+1n<BigInt(config.finalityBlocks))return null;
        const nonce=qty(await c.rpc('eth_getTransactionCount',[context.wallet,tag]));
        if(nonce!==context.nonce+1n)return null; // Later external activity needs general repair.
        const receipt=await fetchBscReceiptEffectProof({rpcUrl:c.source.rpcUrl,transactionHash:context.transactionHash,
          blockNumber:number,blockHash:hash},fetcher);
        if(!receipt)return null;
        requireInput(receiptEffectsIdentity(receipt)===receiptEffectsIdentity(original.proof),
          'REANCHOR_EFFECTS_CHANGED','Re-included transaction logs and gas must be identical.');
        const previous=await block(c.rpc,`0x${(number-1n).toString(16)}`);
        const required=config.assets.filter(a=>assets.some(x=>x.assetId===a.assetId));
        if(await verifyBscRecoveryContracts({rpcUrl:c.source.rpcUrl,blockNumber:number,blockHash:hash,assets:required},fetcher)!==true
          ||await verifyBscRecoveryContracts({rpcUrl:c.source.rpcUrl,blockNumber:finalizedBlock,blockHash:head.hash,assets:required},fetcher)!==true)return null;
        const read=(n:bigint,h:string)=>fetchBscTrackedBalances({rpcUrl:c.source.rpcUrl,wallet:context.wallet,blockNumber:n,blockHash:h,assets},fetcher);
        const [before,after,finalized,current]=await Promise.all([read(previous.number,previous.hash),read(number,hash),
          read(finalizedBlock,head.hash),read(heads[index]!.number,heads[index]!.hash)]);
        if(!before||!after||!finalized||!current)return null;
        requireInput(rawBalanceDigest(before.balances)===rawBalanceDigest(original.before)
          &&rawBalanceDigest(after.balances)===rawBalanceDigest(original.after)
          &&rawBalanceDigest(finalized.balances)===rawBalanceDigest(context.balances)
          &&rawBalanceDigest(current.balances)===rawBalanceDigest(context.balances),
        'REANCHOR_BALANCES_CHANGED','Original raw effects and complete finalized ledger equality are required.');
        verifyEoaReceiptEffects({proof:receipt,chainId:56,wallet:context.wallet,transactionHash:context.transactionHash,
          router:context.router,transactionValue:context.transactionValue,tokenIn:context.tokenIn,tokenOut:context.tokenOut,
          inputRaw:context.inputRaw,minimumOutputRaw:context.minimumOutputRaw,before:before.balances,after:after.balances});
        const allowance=context.requireZeroAllowance&&receipt.success?await fetchCanonicalAllowance({rpcUrl:c.source.rpcUrl,
          wallet:context.wallet,token:context.tokenIn,spender:context.router,sourceBlock:number,sourceBlockHash:hash},fetcher):null;
        if(context.requireZeroAllowance&&receipt.success&&(!allowance||allowance.allowanceRaw!==0n))return null;
        if((await block(c.rpc,tag)).hash!==head.hash||(await block(c.rpc,`0x${number.toString(16)}`)).hash!==hash)return null;
        return{proof:receipt,before:before.balances,after:after.balances,allowanceProof:allowance,finalizedBlockHash:head.hash,
          source:{id:c.source.id,upstreamGroup:c.source.independence!.upstreamGroup,
            endpointDigest:createHash('sha256').update(c.source.rpcUrl).digest('hex'),reviewDigest:c.source.independence!.reviewDigest,
            oldCanonicalHash:old.hash,evidenceDigest:securityDigest({old,head,nonce,receipt,before:before.balances,after:after.balances,
              balances:finalized.balances,allowance})}};
      }));
      const [a,b]=observations;if(!a||!b||a.source.oldCanonicalHash!==b.source.oldCanonicalHash)return null;
      if(securityDigest({...a,source:undefined})!==securityDigest({...b,source:undefined}))return null;
      const evidence:R1Evidence={outcome:'R1',finalizedBlock,finalizedBlockHash:a.finalizedBlockHash,
        proof:a.proof,before:a.before,after:a.after,allowanceProof:a.allowanceProof,sources:[a.source,b.source]};
      if(pinned&&securityDigest(evidence)!==securityDigest(pinned))return null;
      return evidence;
    }catch(error){if(error instanceof Error&&'code' in error)throw error;return null;}
  }};
}
