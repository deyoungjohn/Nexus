import type { GateRequest } from '../market-gate/evidence.js';
import { regularSessionOpen, regularSessionStart } from '../market-gate/session.js';
import { BSC_EQUITY_FEEDS, BSC_USDT_USD_FEED } from '../market-gate/chainlink-bsc.js';
import { pilotPriceBand } from './profile.js';
import { pilotShareRatios } from './quantity.js';

export type PilotPriceReason='P1'|'P2'|'P3'|'P4'|'P5'|'P6'|'P7'|'P8'|'P9';
export interface PilotFeedObservation {
  readonly source:string; readonly roundId:bigint; readonly answeredInRound:bigint;
  readonly answer18:bigint; readonly startedAt:string; readonly updatedAt:string; readonly observedAt:string;
  readonly sourceBlock:bigint; readonly sourceBlockHash:string; readonly blockTimestamp:string;
}
export interface PilotPriceEvidence {
  readonly equity:PilotFeedObservation|null; readonly settlement:PilotFeedObservation|null;
  readonly regression:boolean;
  readonly mid:{readonly sourceBlock:bigint;readonly sourceBlockHash:string;
    readonly midNumerator:bigint;readonly midDenominator:bigint}|null;
}
const abs=(n:bigint)=>n<0n?-n:n;
/** Exact rational comparison: rounding cannot turn an out-of-band price into a pass. */
const outside=(an:bigint,ad:bigint,bn:bigint,bd:bigint,band:number)=>
  an<=0n||ad<=0n||bn<=0n||bd<=0n||abs(an*bd-bn*ad)*10000n>bn*ad*BigInt(band);

export function pilotPriceReasons(request:GateRequest):readonly PilotPriceReason[] {
  if(!request.pilotProfile)return [];
  const {evidence:e,now,pilotProfile:p}=request, v=e.pilotPrices, reasons=new Set<PilotPriceReason>();
  const equity=v?.equity,settlement=v?.settlement, feeds=[equity,settlement];
  if(feeds.some(f=>!f||f.roundId<=0n||f.roundId>=1n<<80n||f.answer18<=0n||f.answeredInRound<f.roundId
    ||!Number.isFinite(Date.parse(f.startedAt))||Date.parse(f.startedAt)<=0||Date.parse(f.startedAt)>Date.parse(f.updatedAt)
    ||!/^0x[0-9a-f]{64}$/.test(f.sourceBlockHash)
    ||![f.updatedAt,f.observedAt,f.blockTimestamp].every(t=>Number.isFinite(Date.parse(t)))
    ||Date.parse(f.observedAt)>Date.parse(now)||Date.parse(f.blockTimestamp)>Date.parse(f.observedAt)
    ||Date.parse(now)-Date.parse(f.blockTimestamp)>request.marketPolicy.maxStatusAgeMs)
    ||equity?.source!==`chainlink-bsc:${BSC_EQUITY_FEEDS.NVDA.proxy}`
    ||settlement?.source!==`chainlink-bsc:${BSC_USDT_USD_FEED.proxy}`)reasons.add('P1');
  if(v?.regression)reasons.add('P2');
  if(feeds.some(f=>f&&Date.parse(f.updatedAt)>Date.parse(f.blockTimestamp)))reasons.add('P3');
  if(e.session&&regularSessionOpen(new Date(now),e.session)
    &&(!equity||Date.parse(equity.updatedAt)<(regularSessionStart(e.session)??Infinity)))reasons.add('P4');
  if(!settlement||Date.parse(now)-Date.parse(settlement.updatedAt)>1350000)reasons.add('P5');
  if(settlement&&abs(settlement.answer18-10n**18n)*10000n>10n**18n*50n)reasons.add('P6');
  if(equity&&e.reference&&(equity.answer18!==e.reference.pricePerShare||equity.updatedAt!==e.reference.sourceAt))reasons.add('P1');
  if(settlement&&e.settlement&&(e.settlement.observedAt!==settlement.updatedAt
    ||e.settlement.lowerValueNumerator*10n**18n>settlement.answer18*e.settlement.denominator
    ||e.settlement.upperValueNumerator*10n**18n<settlement.answer18*e.settlement.denominator))reasons.add('P1');
  if(e.quantity?.pilotMapping&&equity&&settlement&&equity.answer18>0n&&settlement.answer18>0n) {
    const age=Date.parse(now)-Date.parse(equity.updatedAt);
    if(age>=0&&age<=p.price.heartbeatMs) {
      const band=pilotPriceBand(p,age), mid=v?.mid;
      for(const ratio of pilotShareRatios(e.quantity.pilotMapping)) {
        const fairN=equity.answer18*ratio.shareUnitsNumerator, fairD=ratio.shareUnitsDenominator;
        if(!mid||mid.sourceBlock!==e.quantity.sourceBlock
          ||mid.sourceBlockHash!==e.tokenSecurity?.[0]?.observation?.sourceBlockHash
          ||outside(mid.midNumerator*settlement.answer18,mid.midDenominator,fairN,fairD,band))reasons.add('P7');
        if(e.quote&&e.settlement)for(const raw of [e.quote.expectedOutputRaw,e.quote.minimumOutputRaw])for(const usd of [e.settlement.lowerValueNumerator,e.settlement.upperValueNumerator]) {
          // USDT and NVDAB both use 18 decimals; compare principal only.
          if(outside((e.quote.inputRaw+e.quote.additionalFeeSettlement)*usd,
            e.settlement!.denominator,raw*fairN,fairD*10n**18n,band))reasons.add('P8');
        }
      }
    }
  } else if(e.quantity)reasons.add('P7');
  if(e.quote&&(e.quote.nativeFeeRaw>p.gas.maximumNativeFeeRaw
    ||e.quote.networkFeeSettlement>p.gas.maximumSettlementFeeRaw))reasons.add('P9');
  return [...reasons];
}
