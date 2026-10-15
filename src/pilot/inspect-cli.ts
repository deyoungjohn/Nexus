import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {keccak256} from 'ethers';
import {createInstrument} from '../domain/instrument.js';
import {requireInput,DomainError} from '../domain/errors.js';
import {amount,nativeAssetId} from '../domain/amount.js';
import {parseRecoveryConfig} from '../execution/recovery-config.js';
import {executionJson} from '../execution/execution-json.js';
import {fetchBStocksBscQuantity,BSTOCKS_BSC_NVDAB} from '../market-gate/bstocks-bsc.js';
import {BSTOCKS_BSC_V3_POOL,BSTOCKS_BSC_V3_ROUTER} from '../market-gate/bstocks-transfer.js';
import {BSTOCKS_V3_FACTORY,BSTOCKS_V3_QUOTER} from '../market-gate/bstocks-route.js';
import {BSC_USDT_ASSET,BSC_EQUITY_FEEDS} from '../market-gate/chainlink-bsc.js';
import {collectBscTokenSecurity} from '../security/bsc-token-security.js';
import {tokenSecurityFingerprint} from '../security/token-security.js';
import {privateOutputPath} from './private-output.js';

/** Public reads only. Private candidate output, no signer/broadcaster or automatic risk acceptance. */
async function main(){
  const args=process.argv.slice(2);
  requireInput(args.length===4&&args[0]==='--wallet'&&args[2]==='--output'
    &&/^0x[0-9a-f]{40}$/i.test(args[1]??''),'INVALID_ARGUMENTS','Use --wallet <EOA> --output <private file outside the repository>.');
  const wallet=args[1]!.toLowerCase(),output=await privateOutputPath(args[3]!);
  const recovery=parseRecoveryConfig(JSON.parse(await readFile(process.env.NEXUS_RECOVERY_CONFIG??'config/bsc-recovery.json','utf8')));
  const rpcUrl=recovery.sources[0]!.rpcUrl;
  const instrument=createInstrument({chainId:56,tokenAddress:BSTOCKS_BSC_NVDAB,issuerId:'bstocks',productType:'stock',
    underlyingId:'NVDA',ticker:'NVDAB',decimals:18,quantityModel:'bstocks-reviewed-share-ratio',adapterVersion:'owner-pilot-v1',
    sectorTags:['semiconductors'],classificationVersion:'owner-pilot-v1',statusSource:'binance-rwa-status',
    referenceSource:`chainlink-bsc:${BSC_EQUITY_FEEDS.NVDA.proxy}`,eligibilityRequirements:['bstocks-wallet-bound','bstocks-person-reviewed',
      'bstocks-country-allowed','bstocks-product-allowed','bstocks-transfer-allowed']});
  const snapshot=await fetchBStocksBscQuantity({rpcUrl,instrumentId:instrument.instrumentId,tokenAddress:BSTOCKS_BSC_NVDAB,maxBlockAgeMs:120000});
  requireInput(snapshot!==null,'SOURCE_UNAVAILABLE','Current canonical stock controls unavailable.');
  const security=await collectBscTokenSecurity({rpcUrl,maxAgeMs:120000,reviews:[],blockNumber:snapshot.sourceBlock,blockHash:snapshot.sourceBlockHash});
  requireInput(security.length===2&&security.every(s=>s.observation!==null),'SOURCE_UNAVAILABLE','Both full control observations are required.');
  const directoryUrl='https://reference-data-directory.vercel.app/feeds-bsc-mainnet.json';
  const response=await fetch(directoryUrl,{signal:AbortSignal.timeout(10000)});
  requireInput(response.ok,'SOURCE_UNAVAILABLE','Published feed directory unavailable.');
  const bytes=Buffer.from(await response.arrayBuffer()),directory=JSON.parse(bytes.toString()) as Record<string,unknown>[];
  const entry=directory.find(f=>String(f.proxyAddress).toLowerCase()===BSC_EQUITY_FEEDS.NVDA.proxy);
  requireInput(entry?.name==='NVDA / USD'&&Number.isSafeInteger(entry.heartbeat)&&Number(entry.heartbeat)>0
    &&Number(entry.heartbeat)<=86400,'SOURCE_UNAVAILABLE','Reviewed NVDA heartbeat entry required.');
  let nextId=0;
  const rpc=async(method:string,params:unknown[])=>{const id=++nextId,r=await fetch(rpcUrl,{method:'POST',headers:{'Content-Type':'application/json'},
    body:JSON.stringify({jsonrpc:'2.0',id,method,params}),signal:AbortSignal.timeout(5000)});
    const b=await r.json() as Record<string,unknown>;if(!r.ok||b.error||b.id!==id)throw Error('RPC unavailable');return b.result;};
  requireInput(await rpc('eth_getCode',[wallet,'latest'])==='0x','EOA_REQUIRED','Use a code-free EOA for the pilot.');
  const gasHint=await rpc('eth_gasPrice',[]);
  requireInput(typeof gasHint==='string'&&/^0x[1-9a-f][0-9a-f]*$/i.test(gasHint),'SOURCE_UNAVAILABLE','Current gas price hint required.');
  const maxFeePerGas=BigInt(gasHint)*2n;
  const codeHashes:Record<string,string>={};
  for(const[key,address]of Object.entries({factory:BSTOCKS_V3_FACTORY,pool:BSTOCKS_BSC_V3_POOL,router:BSTOCKS_BSC_V3_ROUTER,quoter:BSTOCKS_V3_QUOTER})){
    const code=await rpc('eth_getCode',[address,{blockHash:snapshot.sourceBlockHash,requireCanonical:true}]);
    requireInput(typeof code==='string'&&/^0x(?:[0-9a-f]{2})+$/.test(code),'SOURCE_UNAVAILABLE','Venue runtime unavailable.');codeHashes[key]=keccak256(code);
  }
  const profile={version:2,revision:'owner-nvdab-pilot-amendment-1',wallet,instrumentId:instrument.instrumentId,maximumSpendRaw:5n*10n**18n,
    independentReview:'deferred',gas:{maximumNativeFeeRaw:500000n*maxFeePerGas,maximumSettlementFeeRaw:5n*10n**17n,reviewedAt:snapshot.observedAt},price:{heartbeatMs:Number(entry.heartbeat)*1000,heartbeatSourceUrl:directoryUrl,
      heartbeatSourceDigest:createHash('sha256').update(bytes).digest('hex'),baseBandBps:100,additionalBandBpsPerHour:10,maximumBandBps:200},
    security:security.map(s=>({assetId:s.assetId,fingerprint:tokenSecurityFingerprint(s.observation!),acceptedFindings:{binance:[],goplus:[]}}))};
  const cash={assetId:BSC_USDT_ASSET,decimals:18},gas={assetId:nativeAssetId(56),decimals:18};
  const configurationCandidate={rpcUrl,pilotInstrument:instrument,pilotCoordinatorPolicy:{minimumCash:amount(0n,cash),feeAllowance:amount(0n,cash),
    requiredNativeGas:amount(1000000000000000n,gas),companyCapsBps:{},sectorCapsBps:{},issuerCapsBps:{}},
    deployment:{version:'owner-nvdab-pilot-v1',broadcastEnabled:false,pilotProfile:profile,mappingRevisions:{[instrument.instrumentId]:snapshot.mappingRevision},
      maxGasLimit:500000n,maxFeePerGas,approvalLifetimeMs:300000,marketPolicy:{approvalClock:'refresh-before-submit',
        maxReferenceAgeMs:profile.price.heartbeatMs,maxSettlementAgeMs:1350000,maxStatusAgeMs:120000,maxQuoteAgeMs:300000,maxSimulationAgeMs:30000,
        maxBlockLag:2048n,maxPriceDeviationBps:200,maxPriceImpactBps:100,maxSpreadBps:100,maxPositiveFillBufferBps:100,
        maxNetworkFeeSettlement:5n*10n**17n,maxAdditionalFeeSettlement:0n,maxSlippageBps:50,maxQuoteLifetimeMs:300000,
        exchangeZone:'America/New_York',regularOpenLocal:'09:30',regularCloseLocal:'16:00',approvedV3FeeTiers:[2500],
        approvedVenues:['pancake-v3'],approvedRouters:[BSTOCKS_BSC_V3_ROUTER]}},route:{version:'owner-reviewed-route-v1',codeHashes,
      slippageBps:50,lifetimeMs:300000,maxGasLimit:500000n,maxFeePerGas,feeFeedMaxAgeMs:1350000,
      feeUncertaintyBps:25,maxSettlementPegDeviationBps:50},settlementMaxAgeMs:1350000,settlementUncertaintyBps:25,settlementMaxPegDeviationBps:50};
  await writeFile(output,executionJson({status:'CANDIDATE_REQUIRES_OPERATOR_REVIEW',configurationCandidate,
    quantitySnapshot:snapshot,securityObservations:security,
    required:['Review all venue/runtime/control fingerprints; inspection is not an audit.',
      'Explicitly accept only tolerated issuer-trust scanner findings, preserving the originals.',
      'Provide private primary-source economic/current-access/company/issuer-event records.',
      'Sign the private eligibility declaration; do not put residence/location/signatures in Git.',
      'Use separate exact allowance approval and canonical receipt, then owner-signed bootstrap.',
      'Review the price/gas parameters and feed terms; broadcasting is disabled.']})+'\n',{mode:0o600,flag:'wx'});
  process.stdout.write(`Private inspection candidate written to ${output}. No trade or allowance was submitted.\n`);
}
main().catch(error=>{process.stderr.write(`${error instanceof DomainError?error.code:'PILOT_INSPECTION_FAILED'}\n`);process.exitCode=1;});
