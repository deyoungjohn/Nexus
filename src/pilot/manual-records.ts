import { verifyTypedData } from "ethers";
import { createHash } from "node:crypto";
import { requireInput } from "../domain/errors.js";
import type { BStocksBscControlFingerprint, BStocksBscQuantitySnapshot } from "../market-gate/bstocks-bsc.js";
import { matchesReviewedBStocksControl } from "../market-gate/bstocks-bsc.js";
import { fetchBStocksTransferPreflight, BSTOCKS_BSC_V3_POOL, BSTOCKS_BSC_V3_ROUTER } from "../market-gate/bstocks-transfer.js";
import type { BStocksProductionReviewPorts, ExecutionMarketContext } from "../market-gate/bstocks-production.js";
import type { EventEvidence, ProviderEventEvidence } from "../market-gate/evidence.js";
import { securityDigest } from "../security/token-security.js";
import { validatePilotProfile, type PilotAdmissionProfile } from "./profile.js";
import { discoverNvdabProspectuses, type ProspectusEntry } from './prospectus-register.js';
import { maximumShareRatio, pilotShareRatios, type PilotQuantityMapping } from './quantity.js';
import {verifyPilotAllowanceApproval} from './allowance.js';

interface PublicRecord {
  readonly sourceUrl:string;
  readonly documentDigest:string;
  readonly section:string;
  readonly reviewedAt:string;
  readonly expiresAt:string;
}
export interface PilotDeclaration {
  readonly wallet:string;
  readonly residenceCountry:string;
  readonly accessCountry:string;
  readonly notUSPerson:boolean;
  readonly notForUSBenefit:boolean;
  readonly offshoreAcquisition:boolean;
  readonly followsTransferRestrictions:boolean;
  readonly notRestrictedPerson:boolean;
  readonly notRestrictedJurisdiction:boolean;
  readonly localLawRulesRevision:string;
  readonly issuedAt:string;
  readonly expiresAt:string;
  readonly nonce:string;
  readonly signature:string;
}
/** Personal declaration/signature belongs in private operator storage, never Git or MCP memory. */
export interface PilotManualRecords {
  readonly allowanceApprovalTransactionHash:string;
  readonly version:2;
  readonly revision:string;
  readonly profileRevision:string;
  readonly reviewedControl:BStocksBscControlFingerprint;
  readonly jurisdiction:PublicRecord & {
    readonly restrictedCountries:readonly string[];
    readonly prospectuses:readonly (PublicRecord & ProspectusEntry & {readonly restrictedCountries:readonly string[]})[];
    readonly externalSecondaryTransferPermitted:boolean;
    readonly currentRestrictions:PublicRecord & {readonly restrictedCountries:readonly string[]};
  };
  readonly localLawDecision:{readonly recordedAt:string;readonly reaffirmedAt:string;readonly rulesRevision:string};
  readonly declaration:PilotDeclaration;
  readonly mapping:PublicRecord & PilotQuantityMapping & {
    readonly mappingRevision:string;
    readonly uiMultiplier:bigint;
    readonly shareUnitsNumerator:bigint;
    readonly shareUnitsDenominator:bigint;
    /** Explicit reconciliation of 8-place issuance terms with 18-place raw transfer units. */
    readonly denominationRationale:string;
  };
  readonly event:PublicRecord & {readonly evidence:Omit<EventEvidence,"observedAt"|"expiresAt">};
  readonly providerEvent:PublicRecord & {readonly evidence:Omit<ProviderEventEvidence,"observedAt"|"expiresAt">};
}
const digest=(x:string)=>/^[0-9a-f]{64}$/.test(x);
const valid=(r:PublicRecord,now:string)=>!!r.section && digest(r.documentDigest)
  &&Number.isFinite(Date.parse(r.reviewedAt))&&Number.isFinite(Date.parse(r.expiresAt))
  &&Date.parse(r.reviewedAt)<=Date.parse(now)&&Date.parse(now)<Date.parse(r.expiresAt);
const primary=(url:string,hosts:readonly string[])=>{try{const u=new URL(url);return u.protocol==='https:'
  &&!u.username&&!u.password&&!u.hash&&hosts.includes(u.hostname);}catch{return false;}};

export function pilotDeclarationTypedData(profile:PilotAdmissionProfile,records:Omit<PilotManualRecords,'declaration'>,
  declaration:Omit<PilotDeclaration,'signature'>) {
  return {domain:{name:'Nexus owner-only bStocks pilot eligibility',version:'2',chainId:56},types:{PilotEligibility:[
    {name:'wallet',type:'address'},{name:'profileHash',type:'bytes32'},{name:'recordsHash',type:'bytes32'},
    {name:'declarationHash',type:'bytes32'}]},value:{wallet:declaration.wallet,
      profileHash:`0x${securityDigest(profile)}`,recordsHash:`0x${securityDigest(records)}`,
      declarationHash:`0x${securityDigest(declaration)}`} };
}

export function validatePilotManualRecords(profile:PilotAdmissionProfile,r:PilotManualRecords):void {
  validatePilotProfile(profile);
  requireInput(r.version===2&&r.profileRevision===profile.revision&&!!r.revision
    &&/^0x[0-9a-f]{64}$/i.test(r.allowanceApprovalTransactionHash)
    &&primary(r.jurisdiction.sourceUrl,['www.adgm.com'])&&primary(r.mapping.sourceUrl,['www.adgm.com'])
    &&primary(r.jurisdiction.currentRestrictions.sourceUrl,['www.binance.com'])
    &&r.jurisdiction.currentRestrictions.sourceUrl!==r.jurisdiction.sourceUrl
    &&primary(r.event.sourceUrl,['investor.nvidia.com','nvidianews.nvidia.com'])
    &&primary(r.providerEvent.sourceUrl,['www.adgm.com','www.binance.com'])
    &&r.event.evidence.issuerSourceUrl===r.event.sourceUrl&&r.providerEvent.evidence.providerSourceUrl===r.providerEvent.sourceUrl
    &&r.jurisdiction.prospectuses.length>0&&r.jurisdiction.prospectuses.length<=100
    &&r.jurisdiction.prospectuses.some(x=>x.sourceUrl===r.jurisdiction.sourceUrl&&x.documentDigest===r.jurisdiction.documentDigest)
    &&new Set(r.jurisdiction.prospectuses.map(x=>x.sourceUrl)).size===r.jurisdiction.prospectuses.length
    &&r.jurisdiction.prospectuses.every(x=>primary(x.sourceUrl,['www.adgm.com'])&&digest(x.documentDigest)
      &&/^\d{4}-\d{2}-\d{2}$/.test(x.approvalDate)&&!!x.type)
    &&[r.jurisdiction,r.jurisdiction.currentRestrictions,...r.jurisdiction.prospectuses].every(x=>Array.isArray(x.restrictedCountries)
      &&new Set(x.restrictedCountries).size===x.restrictedCountries.length&&x.restrictedCountries.every(c=>/^[A-Z]{2}$/.test(c)))
    &&r.mapping.sourceUrl===r.jurisdiction.sourceUrl&&r.mapping.documentDigest===r.jurisdiction.documentDigest
    &&r.mapping.denominationRationale.trim().length>=30&&r.mapping.shareUnitsNumerator>0n
    &&r.mapping.shareUnitsDenominator>0n&&r.mapping.uiMultiplier>0n,
  'INVALID_PILOT_RECORDS','Reviewed current restriction manifest, denomination record and issuer events are required.');
  pilotShareRatios(r.mapping);
  const ratio=maximumShareRatio(r.mapping);
  requireInput(ratio.shareUnitsNumerator*r.mapping.shareUnitsDenominator===r.mapping.shareUnitsNumerator*ratio.shareUnitsDenominator
    &&(r.mapping.mode==='dual'||r.mapping.clause?.documentDigest===r.mapping.documentDigest),
    'INVALID_PILOT_RECORDS','Economic ratio must match the revisioned raw/display interpretation.');
}

/** Fresh fetch checks immutable reviewed content; any changed page requires a new manual review. */
export function createPilotManualPorts(profile:PilotAdmissionProfile,records:PilotManualRecords,rpcUrl:string,
  fetcher:typeof fetch=fetch,clock:()=>Date=()=>new Date()):Omit<BStocksProductionReviewPorts,'quote'|'simulation'> {
  validatePilotManualRecords(profile,records);
  const p=structuredClone(profile),r=structuredClone(records);
  const check=async(record:PublicRecord,now:string)=>{
    if(!valid(record,now))return false;
    const response=await fetcher(record.sourceUrl,{headers:{'User-Agent':'Nexus-owner-pilot/1'},signal:AbortSignal.timeout(10000)});
    if(!response.ok)return false;
    const bytes=await response.arrayBuffer();
    return bytes.byteLength<=8_000_000&&createHash('sha256').update(Buffer.from(bytes)).digest('hex')===record.documentDigest;
  };
  const declaration=(c:ExecutionMarketContext)=>{
    const d=r.declaration,{signature,...unsigned}=d,{declaration:_d,...rest}=r;
    if(c.wallet.toLowerCase()!==p.wallet||d.wallet.toLowerCase()!==p.wallet||c.instrument.instrumentId!==p.instrumentId
      ||c.proposal.side!=='buy'||Date.parse(d.issuedAt)>Date.parse(c.now)||!Number.isFinite(Date.parse(d.issuedAt))
      ||!Number.isFinite(Date.parse(d.expiresAt))||Date.parse(c.now)>=Date.parse(d.expiresAt)
      ||Date.parse(d.expiresAt)-Date.parse(d.issuedAt)>86_400_000||!/^0x[0-9a-f]{64}$/i.test(d.nonce)
      ||![d.notUSPerson,d.notForUSBenefit,d.offshoreAcquisition,d.followsTransferRestrictions,d.notRestrictedPerson,d.notRestrictedJurisdiction].every(v=>v===true)
      ||!r.jurisdiction.externalSecondaryTransferPermitted
      ||![d.residenceCountry,d.accessCountry].every(v=>/^[A-Z]{2}$/.test(v))
      ||!r.localLawDecision||!r.localLawDecision.rulesRevision||d.localLawRulesRevision!==r.localLawDecision.rulesRevision
      ||![r.localLawDecision.recordedAt,r.localLawDecision.reaffirmedAt].every(t=>Number.isFinite(Date.parse(t))&&Date.parse(t)<=Date.parse(d.issuedAt))
      ||Date.parse(r.localLawDecision.reaffirmedAt)<Date.parse(r.localLawDecision.recordedAt))return false;
    try{const t=pilotDeclarationTypedData(p,rest,unsigned);
      return verifyTypedData(t.domain,t.types,t.value,signature).toLowerCase()===p.wallet;}catch{return false;}
  };
  return {accessPolicy:null,reviewedControl:r.reviewedControl,
    access:{async session(){return{active:false,binding:null};},async jurisdiction(){return null;},async country(){return null;},async product(){return null;}},
    async pilotEligibility(c,s){
      try {
        if(Date.parse(c.now)-Date.parse(r.jurisdiction.currentRestrictions.reviewedAt)>86_400_000
          ||!declaration(c)||!await check(r.jurisdiction,c.now)||!await check(r.jurisdiction.currentRestrictions,c.now))return null;
        const manifest=await discoverNvdabProspectuses(fetcher);
        const expected=r.jurisdiction.prospectuses.map(x=>({sourceUrl:x.sourceUrl,approvalDate:x.approvalDate,type:x.type}))
          .sort((a,b)=>a.sourceUrl.localeCompare(b.sourceUrl));
        if(securityDigest(manifest)!==securityDigest(expected)
          ||!(await Promise.all(r.jurisdiction.prospectuses.map(x=>check(x,c.now)))).every(Boolean))return null;
        const restricted=new Set(['US',...r.jurisdiction.restrictedCountries,...r.jurisdiction.currentRestrictions.restrictedCountries,
          ...r.jurisdiction.prospectuses.flatMap(x=>x.restrictedCountries)]);
        if([r.declaration.residenceCountry,r.declaration.accessCountry].some(x=>restricted.has(x)))return{
          source:'bstocks-owner-pilot:v1',observedAt:c.now,expiresAt:r.declaration.expiresAt,
          instrumentId:c.instrument.instrumentId,wallet:c.wallet,venueId:'pancake-v3',allowedSides:['buy'],
          verifiedRequirements:[],transferPermitted:false};
        if(c.pilotBootstrapBlock===undefined||!await verifyPilotAllowanceApproval({rpcUrl,profile:p,
          transactionHash:r.allowanceApprovalTransactionHash,snapshotBlock:c.pilotBootstrapBlock,
          amountRaw:c.proposal.side==='buy'?c.proposal.spend.units:0n,finalityBlocks:12n},fetcher))return null;
      }catch{return null;}
      const transfer=await fetchBStocksTransferPreflight({wallet:c.wallet,side:'buy',snapshot:s,reviewedControl:r.reviewedControl,
        rpcUrl,maxBlockAgeMs:c.marketPolicy.maxStatusAgeMs,now:clock().toISOString()},fetcher);
      if(!transfer)return null;
      const authorizationHash=securityDigest({profile:p,records:r});
      return{source:'bstocks-owner-pilot:v1',observedAt:transfer.observedAt,expiresAt:transfer.expiresAt,
        instrumentId:c.instrument.instrumentId,wallet:c.wallet,venueId:'pancake-v3',allowedSides:['buy'],
        verifiedRequirements:c.instrument.eligibilityRequirements,transferPermitted:true,accessControl:{
          accessHash:securityDigest({authorizationHash,transfer}),authorizationHash,side:'buy',token:c.instrument.tokenAddress,
          pool:BSTOCKS_BSC_V3_POOL,router:BSTOCKS_BSC_V3_ROUTER,transferBlock:s.sourceBlock,transferRevision:s.mappingRevision}};
    },
    async economicQuantity(c,s:BStocksBscQuantitySnapshot){
      if(!valid(r.mapping,c.now)||!await check(r.mapping,c.now)||!matchesReviewedBStocksControl(s,r.reviewedControl)
        ||s.uiMultiplier!==r.mapping.uiMultiplier||s.mappingRevision!==r.mapping.mappingRevision)return null;
      return{source:`owner-pilot-prospectus:${r.mapping.documentDigest}`,observedAt:s.observedAt,expiresAt:s.expiresAt,
        instrumentId:c.instrument.instrumentId,quantityModel:c.instrument.quantityModel,adapterVersion:c.instrument.adapterVersion,
        mappingRevision:s.mappingRevision,sourceBlock:s.sourceBlock,pilotMapping:{mode:r.mapping.mode,uiMultiplier:r.mapping.uiMultiplier,
          ...(r.mapping.interpretation?{interpretation:r.mapping.interpretation}:{}),...(r.mapping.clause?{clause:r.mapping.clause}:{})},shareUnitsNumerator:r.mapping.shareUnitsNumerator,
        shareUnitsDenominator:r.mapping.shareUnitsDenominator};
    },
    async portfolioValuations(c){return c.snapshot.positions.every(x=>x.raw.units===0n)?[]:null;},
    async event(c){return await check(r.event,c.now)?{...r.event.evidence,observedAt:clock().toISOString(),expiresAt:r.event.expiresAt}:null;},
    async providerEvent(c){return await check(r.providerEvent,c.now)?{...r.providerEvent.evidence,observedAt:clock().toISOString(),expiresAt:r.providerEvent.expiresAt}:null;}
  };
}
