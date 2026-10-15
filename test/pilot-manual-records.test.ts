import assert from 'node:assert/strict';
import test from 'node:test';
import {createHash} from 'node:crypto';
import {Wallet,Interface} from 'ethers';
import {createPilotManualPorts,pilotDeclarationTypedData,validatePilotManualRecords,type PilotManualRecords} from '../src/pilot/manual-records.js';
import {executionJson,decodeExecutionJson} from '../src/execution/execution-json.js';
import {pilotFixture} from './pilot-fixture.js';
import {snapshot as transferSnapshot,rpcReply as transferRpc} from './bstocks-transfer.test.js';
import {BSTOCKS_BSC_V3_ROUTER} from '../src/market-gate/bstocks-transfer.js';

const now='2026-09-27T15:00:02.000Z',document='synthetic primary-source content';
const publicRecord=(url:string)=>({sourceUrl:url,section:'Reviewed synthetic section',
  documentDigest:createHash('sha256').update(document).digest('hex'),reviewedAt:now,expiresAt:'2026-09-28T15:00:02.000Z'});
async function fixture(){
  const owner=Wallet.createRandom(),context={...pilotFixture(owner.address),now,pilotBootstrapBlock:300n,sessionId:'synthetic-session'};
  const s={...transferSnapshot,instrumentId:context.instrument.instrumentId};
  const unsigned={wallet:owner.address.toLowerCase(),residenceCountry:'NG',accessCountry:'NG',notUSPerson:true,
    notForUSBenefit:true,offshoreAcquisition:true,followsTransferRestrictions:true,notRestrictedPerson:true,notRestrictedJurisdiction:true,localLawRulesRevision:"ng-owner-reviewed-1",issuedAt:now,
    expiresAt:'2026-09-28T15:00:02.000Z',nonce:`0x${'d'.repeat(64)}`};
  const records:Omit<PilotManualRecords,'declaration'>={version:2,revision:'synthetic-records-1',profileRevision:context.pilotProfile.revision,
    allowanceApprovalTransactionHash:`0x${'b'.repeat(64)}`,reviewedControl:s.control,localLawDecision:{recordedAt:now,reaffirmedAt:now,rulesRevision:"ng-owner-reviewed-1"},
    jurisdiction:{...publicRecord('https://www.adgm.com/synthetic-prospectus.pdf'),restrictedCountries:['US'],externalSecondaryTransferPermitted:true,
      prospectuses:[{...publicRecord('https://www.adgm.com/synthetic-prospectus.pdf'),approvalDate:'2026-06-11',type:'Primary',restrictedCountries:['US']}],
      currentRestrictions:{...publicRecord('https://www.binance.com/synthetic-current-restrictions'),restrictedCountries:['US']}},
    mapping:{mode:'dual',...publicRecord('https://www.adgm.com/synthetic-prospectus.pdf'),mappingRevision:s.mappingRevision,
      uiMultiplier:s.uiMultiplier,shareUnitsNumerator:1n,shareUnitsDenominator:1n,
      denominationRationale:'Synthetic reviewed formula reconciles eighteen raw places with eight-place issuance rounding.'},
    event:{...publicRecord('https://investor.nvidia.com/synthetic-calendar'),evidence:{...context.evidence.event!,issuerSourceUrl:'https://investor.nvidia.com/synthetic-calendar'}},
    providerEvent:{...publicRecord('https://www.binance.com/synthetic-issuer-notices'),evidence:{...context.evidence.providerEvent!,providerSourceUrl:'https://www.binance.com/synthetic-issuer-notices'}}};
  const typed=pilotDeclarationTypedData(context.pilotProfile,records,unsigned);
  const bundle={...records,declaration:{...unsigned,signature:await owner.signTypedData(typed.domain,typed.types,typed.value)}};
  const seen:string[]=[],erc20=new Interface(['function approve(address,uint256) returns(bool)','event Approval(address indexed owner,address indexed spender,uint256 value)']);
  const fetcher:typeof fetch=async(url,init)=>{
    if(String(url).includes('GetProspectusesAjax'))return new Response(`<adgm-table-row>${['BTech Holdings Limited','NVIDIA bStocks','NVDAB','Certificates over Shares','Primary','11/06/2026',
      '<adgm-link-button href="https://www.adgm.com/synthetic-prospectus.pdf"></adgm-link-button>'].map(x=>`<adgm-table-cell>${x}</adgm-table-cell>`).join('')}</adgm-table-row><script>var partialViewData={TotalItems:1};</script>`);
    if(!init?.body)return new Response(document);
    const b=JSON.parse(String(init.body)),txHash=records.allowanceApprovalTransactionHash,blockHash=`0x${'a'.repeat(64)}`;
    let result:unknown;
    if(b.method==='eth_blockNumber')result='0x200';
    else if(b.method==='eth_getTransactionByHash')result={hash:txHash,from:context.pilotProfile.wallet,to:context.evidence.quote!.tokenIn,value:'0x0',
      input:erc20.encodeFunctionData('approve',[BSTOCKS_BSC_V3_ROUTER,context.pilotProfile.maximumSpendRaw]),blockNumber:'0x100',blockHash};
    else if(b.method==='eth_getTransactionReceipt')result={transactionHash:txHash,from:context.pilotProfile.wallet,to:context.evidence.quote!.tokenIn,
      blockNumber:'0x100',blockHash,status:'0x1',logs:[{address:context.evidence.quote!.tokenIn,...erc20.encodeEventLog(erc20.getEvent('Approval')!,
        [context.pilotProfile.wallet,BSTOCKS_BSC_V3_ROUTER,context.pilotProfile.maximumSpendRaw])}]};
    else return transferRpc({},seen)(url,init);
    return new Response(JSON.stringify({jsonrpc:'2.0',id:b.id,result}));
  };
  return{owner,context,s,bundle,fetcher,seen};
}

test('P5.5 private pilot records bind owner, current restrictions, exact approval and real route participants',async()=>{
  const {context,s,bundle,fetcher,seen}=await fixture();
  const ports=createPilotManualPorts(context.pilotProfile,bundle,'https://fixture.invalid',fetcher,()=>new Date(now));
  const access=await ports.pilotEligibility!(context,s);
  assert.equal(access?.source,'bstocks-owner-pilot:v1');assert.equal(access?.wallet.toLowerCase(),context.pilotProfile.wallet);
  assert.equal(new Set(seen).size,3);
  const mapping=await ports.economicQuantity(context,s);assert.equal(mapping?.shareUnitsNumerator,1n);
  assert.equal(await ports.economicQuantity(context,{...s,uiMultiplier:2n*10n**18n}),null);
  const decoded=decodeExecutionJson<PilotManualRecords>(JSON.parse(executionJson(bundle)));
  assert.equal(decoded.mapping.uiMultiplier,10n**18n);assert.deepEqual(decoded,bundle);
});

test('P5.5 signed pilot declaration cannot authorize amended records, disallowed country or an expired signature',async()=>{
  const {context,s,bundle,fetcher}=await fixture();
  for(const changed of [{...bundle,revision:'changed-after-signing'},
    {...bundle,declaration:{...bundle.declaration,accessCountry:'US'}},
    {...bundle,declaration:{...bundle.declaration,notUSPerson:false}},
    {...bundle,declaration:{...bundle.declaration,expiresAt:now}}]){
    assert.equal(await createPilotManualPorts(context.pilotProfile,changed,'https://fixture.invalid',fetcher,()=>new Date(now)).pilotEligibility!(context,s),null);
  }
  const ports=createPilotManualPorts(context.pilotProfile,bundle,'https://fixture.invalid',fetcher,()=>new Date(now));
  assert.equal(await ports.pilotEligibility!({...context,now:'2026-09-28T15:00:03.000Z'},s),null);
});

test('P5.5 manual economic/events evidence cannot survive changed documents, old reviews or non-primary URLs',async()=>{
  const {context,s,bundle,fetcher}=await fixture();
  const changedDocument:typeof fetch=async(url,init)=>init?.body?fetcher(url,init):new Response('changed primary content');
  const ports=createPilotManualPorts(context.pilotProfile,bundle,'https://fixture.invalid',changedDocument);
  assert.equal(await ports.economicQuantity(context,s),null);assert.equal(await ports.event(context),null);
  assert.equal(await ports.providerEvent(context),null);assert.equal(await ports.pilotEligibility!(context,s),null);
  assert.throws(()=>validatePilotManualRecords(context.pilotProfile,{...bundle,mapping:{...bundle.mapping,sourceUrl:'https://untrusted.example/formula'}}));
  const expired=createPilotManualPorts(context.pilotProfile,{...bundle,mapping:{...bundle.mapping,expiresAt:now}},'https://fixture.invalid',fetcher);
  assert.equal(await expired.economicQuantity(context,s),null);
});


test('P5.5 Amendment D1 current register and restriction failures block, listed countries deny, local decision is signed',async()=>{
  const {owner,context,s,bundle,fetcher}=await fixture();
  for(const target of ['GetProspectusesAjax','synthetic-prospectus','synthetic-current-restrictions']) {
    for(const failure of ['unavailable','changed']) {
      const failed:typeof fetch=async(url,init)=>String(url).includes(target)
        ?new Response(failure==='changed'?'changed primary document':'unavailable',{status:failure==='changed'?200:503}):fetcher(url,init);
      assert.equal(await createPilotManualPorts(context.pilotProfile,bundle,'https://fixture.invalid',failed).pilotEligibility!(context,s),null);
    }
  }
  const listed=structuredClone(bundle);Object.assign(listed.jurisdiction.currentRestrictions,{restrictedCountries:['US','NG']});
  const {declaration,...records}=listed,{signature:_signature,...unsigned}=declaration;
  const typed=pilotDeclarationTypedData(context.pilotProfile,records,unsigned);
  Object.assign(listed.declaration,{signature:await owner.signTypedData(typed.domain,typed.types,typed.value)});
  const denied=await createPilotManualPorts(context.pilotProfile,listed,'https://fixture.invalid',fetcher).pilotEligibility!(context,s);
  assert.equal(denied?.transferPermitted,false);
  const missing=structuredClone(bundle);Object.assign(missing,{localLawDecision:undefined});
  assert.equal(await createPilotManualPorts(context.pilotProfile,missing,'https://fixture.invalid',fetcher).pilotEligibility!(context,s),null);
  const changed=structuredClone(bundle);Object.assign(changed.localLawDecision,{rulesRevision:'material-rules-change'});
  assert.equal(await createPilotManualPorts(context.pilotProfile,changed,'https://fixture.invalid',fetcher).pilotEligibility!(context,s),null);
  assert.equal(await createPilotManualPorts(context.pilotProfile,bundle,'https://fixture.invalid',fetcher)
    .pilotEligibility!({...context,pilotBootstrapBlock:255n},s),null);
});


test('P5.5 Amendment newly registered supplement blocks until its restrictions and digest are re-reviewed and signed',async()=>{
  const {owner,context,s,bundle,fetcher}=await fixture();
  const url='https://www.adgm.com/synthetic-nvdab-supplement.pdf';
  const changed:typeof fetch=async(target,init)=>{
    const response=await fetcher(target,init);
    if(!String(target).includes('GetProspectusesAjax'))return response;
    const html=await response.text(),row=`<adgm-table-row>${['BTech Holdings Limited','NVIDIA bStocks','NVDAB','Certificates over Shares',
      'Supplement','27/09/2026',`<adgm-link-button href="${url}"></adgm-link-button>`].map(x=>`<adgm-table-cell>${x}</adgm-table-cell>`).join('')}</adgm-table-row>`;
    return new Response(html.replace('TotalItems:1','TotalItems:2')+row);
  };
  assert.equal(await createPilotManualPorts(context.pilotProfile,bundle,'https://fixture.invalid',changed,()=>new Date(now)).pilotEligibility!(context,s),null);
  const reviewed=structuredClone(bundle);
  Object.assign(reviewed.jurisdiction,{prospectuses:[...reviewed.jurisdiction.prospectuses,
    {...publicRecord(url),approvalDate:'2026-09-27',type:'Supplement',restrictedCountries:['US']}]});
  const {declaration,...records}=reviewed,{signature:_signature,...unsigned}=declaration;
  const t=pilotDeclarationTypedData(context.pilotProfile,records,unsigned);
  Object.assign(reviewed.declaration,{signature:await owner.signTypedData(t.domain,t.types,t.value)});
  assert.equal((await createPilotManualPorts(context.pilotProfile,reviewed,'https://fixture.invalid',changed,()=>new Date(now)).pilotEligibility!(context,s))?.transferPermitted,true);
});
