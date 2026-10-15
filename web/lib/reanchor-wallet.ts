import {sha256,toUtf8Bytes,verifyTypedData} from 'ethers';
import {assertWallet,type ExecutionWallet} from './execution-wallet.js';
export interface ReanchorView {
  reviewId:string;outcome:'R1';expiresAt:string;evidence:Record<string,unknown>;
  typedData:{domain:{name:string;version:string;chainId:number};primaryType:string;
    types:Record<string,{name:string;type:string}[]>;message:Record<string,string>};
}
const canonical=(v:unknown):unknown=>Array.isArray(v)?v.map(canonical):v&&typeof v==='object'
  ?Object.fromEntries(Object.entries(v).sort(([a],[b])=>a<b?-1:a>b?1:0).map(([k,x])=>[k,canonical(x)])):v;
const fields=[['reviewId','string'],['portfolioId','string'],['legId','string'],['wallet','address'],['beforeRevision','uint256'],
  ['afterRevision','uint256'],['outcome','string'],['originalProofHash','bytes32'],['evidenceHash','bytes32'],
  ['configurationHash','bytes32'],['expiresAt','uint256']].map(([name,type])=>({name:name!,type:type!}));
export function checkedReanchor(r:ReanchorView,wallet:string,portfolioId:string,legId:string,revision:string,now=Date.now()) {
  const t=r.typedData,m=t.message;
  const types={Reanchor:fields,EIP712Domain:[{name:'name',type:'string'},{name:'version',type:'string'},{name:'chainId',type:'uint256'}]};
  if(t.domain.name!=='Nexus disputed fill re-anchor'||t.domain.version!=='1'||t.domain.chainId!==56
    ||Object.keys(t.domain).length!==3||t.primaryType!=='Reanchor'||r.outcome!=='R1'||m.outcome!=='R1'
    ||m.wallet?.toLowerCase()!==wallet.toLowerCase()||m.portfolioId!==portfolioId||m.legId!==legId||m.reviewId!==r.reviewId
    ||m.beforeRevision!==revision||m.afterRevision!==(BigInt(revision)+1n).toString()
    ||m.expiresAt!==String(Date.parse(r.expiresAt))||!Number.isFinite(Date.parse(r.expiresAt))||now>=Date.parse(r.expiresAt)
    ||![m.originalProofHash,m.configurationHash].every(x=>/^0x[0-9a-f]{64}$/.test(x??''))
    ||m.evidenceHash!==sha256(toUtf8Bytes(JSON.stringify(canonical(r.evidence))))
    ||JSON.stringify(canonical(t.types))!==JSON.stringify(canonical(types)))throw Error('Recovery review changed or expired. Request a new review.');
  return{domain:t.domain,types:{Reanchor:fields},value:m};
}
export async function signReanchor(provider:ExecutionWallet,r:ReanchorView,wallet:string,portfolioId:string,legId:string,
  revision:string,current:()=>boolean,clock:()=>number=Date.now) {
  const t=checkedReanchor(r,wallet,portfolioId,legId,revision,clock());await assertWallet(provider,wallet,current);
  const signature=await provider.request({method:'eth_signTypedData_v4',params:[wallet,JSON.stringify(r.typedData)]});
  await assertWallet(provider,wallet,current);checkedReanchor(r,wallet,portfolioId,legId,revision,clock());
  if(typeof signature!=='string'||verifyTypedData(t.domain,t.types,t.value,signature).toLowerCase()!==wallet.toLowerCase())
    throw Error('Owner recovery signature is invalid.');return signature;
}
