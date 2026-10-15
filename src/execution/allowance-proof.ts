export interface CanonicalAllowanceProof {
  readonly wallet:string;readonly token:string;readonly spender:string;
  readonly sourceBlock:bigint;readonly sourceBlockHash:string;readonly allowanceRaw:bigint;
}
/** Read at the receipt's canonical hash, never at latest or from browser state. */
export async function fetchCanonicalAllowance(input:Omit<CanonicalAllowanceProof,'allowanceRaw'> & {readonly rpcUrl:string},
  fetcher:typeof fetch=fetch):Promise<CanonicalAllowanceProof|null> {
  try {
    if(![input.wallet,input.token,input.spender].every(x=>/^0x[0-9a-f]{40}$/i.test(x))
      ||!/^0x[0-9a-f]{64}$/i.test(input.sourceBlockHash)||input.sourceBlock<0n)return null;
    let id=0;const rpc=async(method:string,params:unknown[])=>{
      const n=++id,response=await fetcher(input.rpcUrl,{method:'POST',headers:{'Content-Type':'application/json'},
        body:JSON.stringify({jsonrpc:'2.0',id:n,method,params}),signal:AbortSignal.timeout(5000)});
      const b=await response.json() as Record<string,unknown>;
      if(!response.ok||b.error||b.id!==n)throw Error('RPC unavailable');return b.result;
    };
    if(await rpc('eth_chainId',[])!=='0x38')return null;
    const tag=`0x${input.sourceBlock.toString(16)}`;
    const canonical=async()=>{const b=await rpc('eth_getBlockByNumber',[tag,false]) as Record<string,unknown>|null;
      return !!b&&b.number===tag&&b.hash===input.sourceBlockHash;};
    if(!await canonical())return null;
    const data=`0xdd62ed3e${input.wallet.slice(2).toLowerCase().padStart(64,'0')}${input.spender.slice(2).toLowerCase().padStart(64,'0')}`;
    const value=await rpc('eth_call',[{to:input.token,data},{blockHash:input.sourceBlockHash,requireCanonical:true}]);
    if(typeof value!=='string'||!/^0x[0-9a-f]{64}$/i.test(value)||!await canonical())return null;
    return{wallet:input.wallet.toLowerCase(),token:input.token.toLowerCase(),spender:input.spender.toLowerCase(),
      sourceBlock:input.sourceBlock,sourceBlockHash:input.sourceBlockHash.toLowerCase(),allowanceRaw:BigInt(value)};
  }catch{return null;}
}
