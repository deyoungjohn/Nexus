import {sha256,toUtf8Bytes,verifyTypedData} from 'ethers';
import {assertWallet,type ExecutionWallet} from './execution-wallet.js';
export interface ChainSnapshotView {
  reviewId:string;reason:string;kind:'bootstrap'|'resync';expiresAt:string;
  snapshot:{sourceBlock:string;sourceBlockHash:string;transactionNonce:string;balances:{assetId:string;decimals:number;units:string}[]};
  typedData:{domain:{name:string;version:string;chainId:number};primaryType:string;
    types:Record<string,{name:string;type:string}[]>;message:Record<string,string>};
}
const canonical=(v:unknown):unknown=>Array.isArray(v)?v.map(canonical):v&&typeof v==='object'
  ?Object.fromEntries(Object.entries(v).sort(([a],[b])=>a<b?-1:a>b?1:0).map(([k,x])=>[k,canonical(x)])):v;
export function checkedChainSnapshot(r:ChainSnapshotView,wallet:string,portfolioId:string,revision:string,now=Date.now()){
  const t=r.typedData,m=t.message;
  const expectedTypes={ChainSnapshot:[{name:'reviewId',type:'string'},{name:'portfolioId',type:'string'},{name:'wallet',type:'address'},
    {name:'expectedRevision',type:'uint256'},{name:'evidenceHash',type:'bytes32'},{name:'configurationHash',type:'bytes32'},
    {name:'expiresAt',type:'uint256'}],EIP712Domain:[{name:'name',type:'string'},{name:'version',type:'string'},{name:'chainId',type:'uint256'}]};
  const digest=sha256(toUtf8Bytes(JSON.stringify(canonical({kind:r.kind,reason:r.reason,...r.snapshot}))));
  const assets=['eip155:56/native','eip155:56/erc20:0x55d398326f99059ff775485246999027b3197955',
    'eip155:56/erc20:0x02fca66c1d1afb4e2a7884261eb00f63598a7436'];
  if(t.domain.name!=='Nexus chain snapshot'||t.domain.version!=='1'||t.domain.chainId!==56||t.primaryType!=='ChainSnapshot'
    ||Object.keys(t.domain).length!==3||!['bootstrap','resync'].includes(r.kind)
    ||!/^0x[0-9a-f]{64}$/.test(r.snapshot.sourceBlockHash)||!/^(0|[1-9][0-9]{0,77})$/.test(r.snapshot.sourceBlock)
    ||!/^(0|[1-9][0-9]{0,77})$/.test(r.snapshot.transactionNonce)
    ||r.snapshot.balances.length!==3||new Set(r.snapshot.balances.map(b=>b.assetId)).size!==3
    ||!r.snapshot.balances.every(b=>assets.includes(b.assetId)&&b.decimals===18&&/^(0|[1-9][0-9]{0,77})$/.test(b.units))
    ||JSON.stringify(canonical(t.types))!==JSON.stringify(canonical(expectedTypes))||m.wallet?.toLowerCase()!==wallet.toLowerCase()
    ||m.portfolioId!==portfolioId||m.expectedRevision!==revision||m.reviewId!==r.reviewId||m.evidenceHash!==digest
    ||!/^0x[0-9a-f]{64}$/.test(m.configurationHash??'')||m.expiresAt!==String(Date.parse(r.expiresAt))
    ||!Number.isFinite(Date.parse(r.expiresAt))||now>=Date.parse(r.expiresAt))throw Error('Chain snapshot changed or expired. Request a new review.');
  return {domain:t.domain,types:{ChainSnapshot:expectedTypes.ChainSnapshot},value:m};
}
export async function signChainSnapshot(provider:ExecutionWallet,r:ChainSnapshotView,wallet:string,portfolioId:string,
  revision:string,current:()=>boolean,clock:()=>number=Date.now){
  const t=checkedChainSnapshot(r,wallet,portfolioId,revision,clock());await assertWallet(provider,wallet,current);
  const signature=await provider.request({method:'eth_signTypedData_v4',params:[wallet,JSON.stringify(r.typedData)]});
  await assertWallet(provider,wallet,current);checkedChainSnapshot(r,wallet,portfolioId,revision,clock());
  if(typeof signature!=='string'||verifyTypedData(t.domain,t.types,t.value,signature).toLowerCase()!==wallet.toLowerCase())
    throw Error('Owner snapshot signature is invalid.');return signature;
}
