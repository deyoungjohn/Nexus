import type {PilotAdmissionProfile} from './profile.js';
import {pilotPriceBand,validatePilotProfile} from './profile.js';
import {requireInput} from '../domain/errors.js';
import {pilotShareRatios,type PilotQuantityMapping} from './quantity.js';

/** Diagnostics never grant admission; sampling counts observed updates, not every published round. */
export interface PilotPriceSample {
  readonly sessionStartAt?:string|null;
  readonly equityRound?:{readonly roundId:string;readonly answeredInRound:string;readonly startedAt:string;readonly blockTimestamp:string}|null;
  readonly settlementRound?:{readonly roundId:string;readonly answeredInRound:string;readonly price18:string;
    readonly sourceAt:string;readonly startedAt:string;readonly blockTimestamp:string}|null;
  readonly pilotMapping?:(Omit<PilotQuantityMapping,'uiMultiplier'> & {readonly uiMultiplier:string})|null;
  readonly dexMidRatio?:{readonly numerator:string;readonly denominator:string}|null;
  readonly observedAt:string;
  readonly sessionDate:string;
  readonly sessionOpen:boolean;
  readonly reference:{readonly source:string;readonly sourceAt:string;readonly price18:string}|null;
  readonly dexMidSettlementPerToken18:string|null;
  readonly settlementUsd18:string|null;
  readonly reviewedMapping:{readonly revision:string;readonly numerator:string;readonly denominator:string}|null;
  readonly unavailableSources:readonly string[];
}
const integer=(v:string)=>/^[1-9][0-9]{0,77}$/.test(v);
export function diagnosePilotPrices(profile:PilotAdmissionProfile,samples:readonly PilotPriceSample[]){
  validatePilotProfile(profile);
  const current=samples.at(-1);
  requireInput(!!current&&samples.length<=10000&&samples.every((s,i)=>Number.isFinite(Date.parse(s.observedAt))
    &&(!i||Date.parse(s.observedAt)>Date.parse(samples[i-1]!.observedAt))
    &&/^\d{4}-\d{2}-\d{2}$/.test(s.sessionDate)
    &&(!s.reference||(integer(s.reference.price18)&&Number.isFinite(Date.parse(s.reference.sourceAt))
      &&Date.parse(s.reference.sourceAt)<=Date.parse(s.observedAt)))
    &&[s.dexMidSettlementPerToken18,s.settlementUsd18].every(v=>v===null||integer(v))
    &&(!s.reviewedMapping||[s.reviewedMapping.numerator,s.reviewedMapping.denominator].every(integer))
    &&(!s.dexMidRatio||[s.dexMidRatio.numerator,s.dexMidRatio.denominator].every(integer))
    &&(!s.pilotMapping||integer(s.pilotMapping.uiMultiplier))),
  'INVALID_PRICE_HISTORY','Chronological, bounded price observations with true source clocks required.');
  const alerts:string[]=[...current.unavailableSources.map(s=>`source-unavailable:${s}`)];
  const reasonCodes=new Set<string>();
  const full=current.equityRound!==undefined&&current.settlementRound!==undefined;
  const reference=current.reference,stock=current.equityRound,stable=current.settlementRound;
  if(full) {
    if(!stock||!stable||!reference||[stock,stable].some(f=>!integer(f.roundId)||!integer(f.answeredInRound)
      ||BigInt(f.answeredInRound)<BigInt(f.roundId)||!Number.isFinite(Date.parse(f.startedAt))
      ||!Number.isFinite(Date.parse(f.blockTimestamp))||Date.parse(f.blockTimestamp)>Date.parse(current.observedAt))
      ||!integer(stable.price18))reasonCodes.add('P1');
    if(stock&&reference&&Date.parse(stock.startedAt)>Date.parse(reference.sourceAt)
      ||stable&&Date.parse(stable.startedAt)>Date.parse(stable.sourceAt))reasonCodes.add('P1');
    if(stock&&reference&&Date.parse(reference.sourceAt)>Date.parse(stock.blockTimestamp)
      ||stable&&Date.parse(stable.sourceAt)>Date.parse(stable.blockTimestamp))reasonCodes.add('P3');
    if(current.sessionOpen&&(!reference||!current.sessionStartAt
      ||Date.parse(reference.sourceAt)<Date.parse(current.sessionStartAt)))reasonCodes.add('P4');
    if(!stable||Date.parse(current.observedAt)-Date.parse(stable.sourceAt)>1350000)reasonCodes.add('P5');
    if(stable&&/^-?\d+$/.test(stable.price18)) {
      const delta=BigInt(stable.price18)-10n**18n;
      if((delta<0n?-delta:delta)*10000n>10n**18n*50n)reasonCodes.add('P6');
    }
    for(const [kind,f] of [['equityRound',stock],['settlementRound',stable]] as const) {
      const previous=samples.slice(0,-1).reverse().find(s=>s[kind])?.[kind];
      if(f&&previous&&integer(f.roundId)&&integer(previous.roundId)&&BigInt(f.roundId)<BigInt(previous.roundId))reasonCodes.add('P2');
    }
    const previous=samples.slice(0,-1).reverse().find(s=>s.settlementRound)?.settlementRound;
    if(previous&&stable&&Date.parse(stable.sourceAt)<Date.parse(previous.sourceAt))reasonCodes.add('P2');
  }
  if(!current.sessionOpen)alerts.push('outside-regular-session');
  const prior=samples.slice(0,-1).reverse().find(s=>s.reference?.source===current.reference?.source)?.reference;
  if(prior&&current.reference&&Date.parse(current.reference.sourceAt)<Date.parse(prior.sourceAt))alerts.push('reference-source-time-regression');
  if(full&&prior&&reference&&Date.parse(reference.sourceAt)<Date.parse(prior.sourceAt))reasonCodes.add('P2');
  const ageMs=current.reference?Date.parse(current.observedAt)-Date.parse(current.reference.sourceAt):null;
  const bandBps=ageMs!==null&&ageMs<=profile.price.heartbeatMs?pilotPriceBand(profile,ageMs):null;
  if(ageMs!==null&&bandBps===null)alerts.push('reference-heartbeat-exceeded');
  let deviationBps:string|null=null;
  const deviationsByInterpretation:{interpretation:string;absoluteBps:string;signedPremiumBps:string}[]=[];
  if(current.reference&&current.dexMidSettlementPerToken18&&current.settlementUsd18&&(current.reviewedMapping||current.pilotMapping)){
    const m=current.reviewedMapping,ratios=current.pilotMapping?pilotShareRatios({...current.pilotMapping,
      uiMultiplier:BigInt(current.pilotMapping.uiMultiplier)}):[{shareUnitsNumerator:BigInt(m!.numerator),shareUnitsDenominator:BigInt(m!.denominator)}];
    for(const [i,ratio]of ratios.entries()) {
      const midN=BigInt(current.dexMidRatio?.numerator??current.dexMidSettlementPerToken18)*BigInt(current.settlementUsd18),
        midD=BigInt(current.dexMidRatio?.denominator??(10n**18n).toString());
      const fairN=BigInt(current.reference.price18)*ratio.shareUnitsNumerator,fairD=ratio.shareUnitsDenominator;
      const signed=midN*fairD-fairN*midD,delta=signed<0n?-signed:signed,den=fairN*midD;
      const absoluteBps=((delta*10000n+den-1n)/den).toString();
      deviationsByInterpretation.push({interpretation:ratios.length===2?(i===0?'raw':'display'):
        current.pilotMapping?.interpretation??'reviewed',absoluteBps,signedPremiumBps:(signed*10000n/den).toString()});
      if(deviationBps===null||BigInt(absoluteBps)>BigInt(deviationBps))deviationBps=absoluteBps;
      if(bandBps!==null&&delta*10000n>den*BigInt(bandBps))reasonCodes.add('P7');
    }
    if(reasonCodes.has('P7'))alerts.push('dex-mid-outside-reference-band');
  }else alerts.push('normalized-deviation-unavailable');
  if(full&&!current.pilotMapping)reasonCodes.add('P7');
  alerts.push(...reasonCodes);
  const sessions=[...new Set(samples.map(s=>s.sessionDate))].map(sessionDate=>{
    const available=samples.filter(s=>s.sessionDate===sessionDate&&s.sessionOpen&&s.reference);
    const observedUpdates=available.filter((s,i)=>!i||s.reference!.source!==available[i-1]!.reference!.source
      ||s.reference!.sourceAt!==available[i-1]!.reference!.sourceAt);
    const intervals=observedUpdates.slice(1).flatMap((s,i)=>{
      const delta=Date.parse(s.reference!.sourceAt)-Date.parse(observedUpdates[i]!.reference!.sourceAt);
      return delta>0?[delta]:[];
    });
    return{sessionDate,regularSessionSamples:available.length,observedDistinctUpdates:observedUpdates.length,
      positiveSourceTimeIntervalsMs:intervals,unavailableSamples:samples.filter(s=>s.sessionDate===sessionDate&&s.unavailableSources.length>0).length};
  });
  return{status:alerts.length?'attention-required':'diagnostics-within-band',policy:'declared-age-band',
    policyEvidenceComplete:full&&!!stock&&!!stable,reasonCodes:[...reasonCodes],deviationsByInterpretation,
    referenceAgeMs:ageMs,bandBps,deviationBps,alerts,sessions,
    samplingLimitation:'Observed updates only; missed rounds and the time between probes are not certified.'};
}
