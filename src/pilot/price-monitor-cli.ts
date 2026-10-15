import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {Interface,keccak256} from 'ethers';
import {DomainError,requireInput} from '../domain/errors.js';
import {decodeExecutionJson} from '../execution/execution-json.js';
import {fetchPilotFeedObservation,BSC_USDT_ASSET} from '../market-gate/chainlink-bsc.js';
import {BSTOCKS_BSC_NVDAB,fetchBStocksBscQuantity,matchesReviewedBStocksControl} from '../market-gate/bstocks-bsc.js';
import {BSTOCKS_BSC_V3_POOL} from '../market-gate/bstocks-transfer.js';
import {fetchNyseSession} from '../market-gate/nyse-calendar.js';
import {regularSessionOpen,regularSessionStart} from '../market-gate/session.js';
import {validatePilotProfile,type PilotAdmissionProfile} from './profile.js';
import {validatePilotManualRecords,type PilotManualRecords} from './manual-records.js';
import {privateOutputPath} from './private-output.js';
import {diagnosePilotPrices,type PilotPriceSample} from './price-monitor.js';

async function main(){
  const args=process.argv.slice(2);
  requireInput((args.length===2||args.length===4)&&args[0]==='--output'&&(args.length===2||args[2]==='--history')
    &&!!process.env.NEXUS_EXECUTION_CONFIG,'INVALID_ARGUMENTS','Set the private execution config; use --output <private file> [--history <previous file>].');
  const output=await privateOutputPath(args[1]!);
  const config=decodeExecutionJson<{rpcUrl:string;deployment:{pilotProfile:PilotAdmissionProfile;marketPolicy:{maxStatusAgeMs:number}};
    route:{codeHashes:{pool:string}}}>(JSON.parse(await readFile(process.env.NEXUS_EXECUTION_CONFIG!,'utf8')));
  const profile=config.deployment.pilotProfile;validatePilotProfile(profile);
  const now=new Date().toISOString(),date=new Intl.DateTimeFormat('en-CA',{timeZone:'America/New_York',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(now));
  const [equityFeed,settlementFeed,session,snapshot]=await Promise.all([
    fetchPilotFeedObservation({rpcUrl:config.rpcUrl,maxBlockAgeMs:120000,maxReferenceAgeMs:profile.price.heartbeatMs,now},'equity'),
    fetchPilotFeedObservation({rpcUrl:config.rpcUrl,maxBlockAgeMs:120000,maxReferenceAgeMs:1350000,now},'settlement'),
    fetchNyseSession(date),fetchBStocksBscQuantity({rpcUrl:config.rpcUrl,instrumentId:profile.instrumentId,tokenAddress:BSTOCKS_BSC_NVDAB,maxBlockAgeMs:120000,now})]);
  const reference=equityFeed&&equityFeed.answer18>0n?{source:equityFeed.source,sourceAt:equityFeed.updatedAt,pricePerShare:equityFeed.answer18}:null;
  let mid:string|null=null,midRatio:PilotPriceSample['dexMidRatio']=null,mapping:PilotPriceSample['reviewedMapping']=null,
    pilotMapping:PilotPriceSample['pilotMapping']=snapshot?{mode:'dual',uiMultiplier:snapshot.uiMultiplier.toString()}:null,id=0;
  if(snapshot){
    const rpc=async(method:string,params:unknown[])=>{const n=++id,r=await fetch(config.rpcUrl,{method:'POST',headers:{'Content-Type':'application/json'},
      body:JSON.stringify({jsonrpc:'2.0',id:n,method,params}),signal:AbortSignal.timeout(5000)});const b=await r.json() as Record<string,unknown>;
      if(!r.ok||b.error||b.id!==n)throw Error('RPC unavailable');return b.result;};
    try{
      const ref={blockHash:snapshot.sourceBlockHash,requireCanonical:true},abi=new Interface(['function token0() view returns(address)',
        'function token1() view returns(address)','function slot0() view returns(uint160,int24,uint16,uint16,uint16,uint32,bool)']);
      const code=await rpc('eth_getCode',[BSTOCKS_BSC_V3_POOL,ref]);
      requireInput(typeof code==='string'&&keccak256(code)===config.route.codeHashes.pool,'POOL_CHANGED','Reviewed pool required.');
      const call=async(name:string)=>{const result=await rpc('eth_call',[{to:BSTOCKS_BSC_V3_POOL,data:abi.encodeFunctionData(name)},ref]);
        if(typeof result!=='string')throw Error('Pool unavailable');return abi.decodeFunctionResult(name,result);};
      const [[token0],[token1],slot]=await Promise.all([call('token0'),call('token1'),call('slot0')]);
      const stable=BSC_USDT_ASSET.split('erc20:')[1]!,a=String(token0).toLowerCase(),b=String(token1).toLowerCase(),sqrt=slot[0] as bigint;
      requireInput(new Set([a,b]).size===2&&[a,b].includes(stable)&&[a,b].includes(BSTOCKS_BSC_NVDAB)
        &&sqrt>0n&&slot[6]===true,'POOL_CHANGED','Exact stock/settlement pool required.');
      const value=a===BSTOCKS_BSC_NVDAB?sqrt*sqrt*10n**18n/(1n<<192n):(1n<<192n)*10n**18n/(sqrt*sqrt);
      const canonical=await rpc('eth_getBlockByNumber',[`0x${snapshot.sourceBlock.toString(16)}`,false]) as Record<string,unknown>;
      if(canonical.hash===snapshot.sourceBlockHash&&value>0n){mid=value.toString();
        midRatio=a===BSTOCKS_BSC_NVDAB?{numerator:(sqrt*sqrt).toString(),denominator:(1n<<192n).toString()}
          :{numerator:(1n<<192n).toString(),denominator:(sqrt*sqrt).toString()};} 
    }catch{/* A pool outage is recorded, not treated as an unchanged price. */}
    if(process.env.NEXUS_PILOT_RECORDS)try{
      const r=decodeExecutionJson<PilotManualRecords>(JSON.parse(await readFile(process.env.NEXUS_PILOT_RECORDS,'utf8')));
      validatePilotManualRecords(profile,r);const m=r.mapping;
      if(matchesReviewedBStocksControl(snapshot,r.reviewedControl)&&snapshot.mappingRevision===m.mappingRevision&&snapshot.uiMultiplier===m.uiMultiplier
        &&Date.parse(m.reviewedAt)<=Date.parse(now)&&Date.parse(now)<Date.parse(m.expiresAt)){
        const response=await fetch(m.sourceUrl,{headers:{'User-Agent':'Nexus-owner-pilot/1'},signal:AbortSignal.timeout(10000)}),bytes=await response.arrayBuffer();
        if(response.ok&&bytes.byteLength<=8000000&&createHash('sha256').update(Buffer.from(bytes)).digest('hex')===m.documentDigest){
          pilotMapping={mode:m.mode,uiMultiplier:m.uiMultiplier.toString(),...(m.clause?{clause:m.clause}:{}),...(m.interpretation?{interpretation:m.interpretation}:{})};
          mapping={revision:m.mappingRevision,numerator:m.shareUnitsNumerator.toString(),denominator:m.shareUnitsDenominator.toString()};}
      }
    }catch{/* Missing/changed economic terms leave normalized deviation unavailable. */}
  }
  const sample:PilotPriceSample={sessionStartAt:session&&regularSessionStart(session)!==null?new Date(regularSessionStart(session)!).toISOString():null,
    equityRound:equityFeed?{roundId:equityFeed.roundId.toString(),answeredInRound:equityFeed.answeredInRound.toString(),
      startedAt:equityFeed.startedAt,blockTimestamp:equityFeed.blockTimestamp}:null,
    settlementRound:settlementFeed?{roundId:settlementFeed.roundId.toString(),answeredInRound:settlementFeed.answeredInRound.toString(),
      price18:settlementFeed.answer18.toString(),sourceAt:settlementFeed.updatedAt,startedAt:settlementFeed.startedAt,blockTimestamp:settlementFeed.blockTimestamp}:null,
    pilotMapping,dexMidRatio:midRatio,observedAt:now,sessionDate:date,sessionOpen:!!session&&regularSessionOpen(new Date(now),session),
    reference:reference?{source:reference.source,sourceAt:reference.sourceAt,price18:reference.pricePerShare.toString()}:null,
    dexMidSettlementPerToken18:mid,settlementUsd18:settlementFeed&&settlementFeed.answer18>0n?settlementFeed.answer18.toString():null,reviewedMapping:mapping,
    unavailableSources:[...(!reference?['NVDA-reference']:[]),...(!settlementFeed?['USDT-reference']:[]),...(!session?['NYSE-calendar']:[]),...(!mid?['DEX-mid']:[])]};
  let prior:PilotPriceSample[]=[];
  if(args[3]){const bytes=await readFile(args[3]);requireInput(bytes.byteLength<=8000000,'INVALID_PRICE_HISTORY','Bounded history required.');
    const history=JSON.parse(bytes.toString()) as {profileRevision:string;samples:PilotPriceSample[]};
    requireInput(history.profileRevision===profile.revision&&Array.isArray(history.samples),'INVALID_PRICE_HISTORY','Matching profile history required.');prior=history.samples;}
  const samples=[...prior,sample],diagnostics=diagnosePilotPrices(profile,samples);
  await writeFile(output,JSON.stringify({profileRevision:profile.revision,economicReview:mapping?'signed-record-candidate':'unreviewed-dual-diagnostics',samples,diagnostics},null,2)+'\n',{mode:0o600,flag:'wx'});
  process.stdout.write(JSON.stringify(diagnostics)+'\n');
}
main().catch(error=>{process.stderr.write(`${error instanceof DomainError?error.code:'PILOT_PRICE_MONITOR_FAILED'}\n`);process.exitCode=1;});
