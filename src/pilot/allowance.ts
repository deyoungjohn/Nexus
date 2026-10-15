import {Interface} from 'ethers';
import {BSC_USDT_ASSET} from '../market-gate/chainlink-bsc.js';
import {BSTOCKS_BSC_V3_ROUTER} from '../market-gate/bstocks-transfer.js';
import type {PilotAdmissionProfile} from './profile.js';
const abi=new Interface(['function approve(address,uint256) returns(bool)','event Approval(address indexed owner,address indexed spender,uint256 value)']);
const qty=(v:unknown):bigint|null=>typeof v==='string'&&/^0x(?:0|[1-9a-f][0-9a-f]*)$/i.test(v)?BigInt(v):null;
const hash=(v:unknown):v is string=>typeof v==='string'&&/^0x[0-9a-f]{64}$/i.test(v);

/** Owner independently signs/sends this setup leg; Nexus verifies its exact canonical receipt. */
export async function verifyPilotAllowanceApproval(input:{rpcUrl:string;profile:PilotAdmissionProfile;
  transactionHash:string;snapshotBlock:bigint;finalityBlocks:bigint;amountRaw?:bigint},fetcher:typeof fetch=fetch):Promise<boolean>{
  try{
    const url=new URL(input.rpcUrl);if(url.protocol!=='https:'||url.username||url.password||url.search||url.hash
      ||!hash(input.transactionHash)||input.finalityBlocks<=0n)return false;
    let id=0;const rpc=async(method:string,params:unknown[])=>{const n=++id,r=await fetcher(input.rpcUrl,{method:'POST',headers:{'Content-Type':'application/json'},
      body:JSON.stringify({jsonrpc:'2.0',id:n,method,params}),signal:AbortSignal.timeout(5000)});
      const b=await r.json() as Record<string,unknown>;if(!r.ok||b.error||b.id!==n)throw Error('RPC unavailable');return b.result;};
    if(await rpc('eth_chainId',[])!=='0x38')return false;
    const tx=await rpc('eth_getTransactionByHash',[input.transactionHash]) as Record<string,unknown>|null;
    const r=await rpc('eth_getTransactionReceipt',[input.transactionHash]) as Record<string,unknown>|null;
    const block=qty(r?.blockNumber),head=qty(await rpc('eth_blockNumber',[]));
    const token=BSC_USDT_ASSET.split('erc20:')[1]!;
    const amount=input.amountRaw??input.profile.maximumSpendRaw;
    if(amount<=0n||amount>input.profile.maximumSpendRaw)return false;
    const data=abi.encodeFunctionData('approve',[BSTOCKS_BSC_V3_ROUTER,amount]);
    if(!tx||!r||tx.input!==data||String(tx.from).toLowerCase()!==input.profile.wallet||String(tx.to).toLowerCase()!==token
      ||qty(tx.value)!==0n||!hash(tx.hash)||tx.hash.toLowerCase()!==input.transactionHash.toLowerCase()
      ||String(r.from).toLowerCase()!==input.profile.wallet||String(r.to).toLowerCase()!==token
      ||String(r.transactionHash).toLowerCase()!==input.transactionHash.toLowerCase()
      ||block===null||head===null||block>input.snapshotBlock||head-block+1n<input.finalityBlocks
      ||qty(tx.blockNumber)!==block||tx.blockHash!==r.blockHash||!hash(r.blockHash)||r.status!=='0x1'||!Array.isArray(r.logs))return false;
    const events=r.logs.flatMap(raw=>{try{const log=raw as {address:string;topics:string[];data:string};
      if(log.address.toLowerCase()!==token)return[];const parsed=abi.parseLog(log);return parsed?.name==='Approval'?[parsed]:[];}catch{return[];}});
    if(events.length!==1||String(events[0]!.args[0]).toLowerCase()!==input.profile.wallet
      ||String(events[0]!.args[1]).toLowerCase()!==BSTOCKS_BSC_V3_ROUTER||events[0]!.args[2]!==amount)return false;
    const canonical=await rpc('eth_getBlockByNumber',[r.blockNumber,false]) as Record<string,unknown>|null;
    return canonical!==null&&qty(canonical.number)===block&&canonical.hash===r.blockHash;
  }catch{return false;}
}
