import assert from 'node:assert/strict';
import test from 'node:test';
import {diagnosePilotPrices,type PilotPriceSample} from '../src/pilot/price-monitor.js';
import {pilotFixture} from './pilot-fixture.js';
const profile=pilotFixture().pilotProfile;
const sample=(at:string,sourceAt:string):PilotPriceSample=>({observedAt:at,sessionDate:'2026-09-28',sessionOpen:true,
  reference:{source:'synthetic-chainlink',sourceAt,price18:(200n*10n**18n).toString()},dexMidSettlementPerToken18:(200n*10n**18n).toString(),
  settlementUsd18:(10n**18n).toString(),reviewedMapping:{revision:'reviewed-synthetic',numerator:'1',denominator:'1'},unavailableSources:[]});
test('P5.5 pilot diagnostics record true source age, per-session observed cadence and normalized DEX mid',()=>{
  const samples=[sample('2026-09-28T14:00:00Z','2026-09-28T13:50:00Z'),sample('2026-09-28T14:01:00Z','2026-09-28T13:50:00Z'),
    sample('2026-09-28T14:02:00Z','2026-09-28T14:02:00Z')],result=diagnosePilotPrices(profile,samples);
  assert.equal(result.status,'diagnostics-within-band');assert.equal(result.referenceAgeMs,0);assert.equal(result.deviationBps,'0');
  assert.equal(result.sessions[0]!.observedDistinctUpdates,2);assert.deepEqual(result.sessions[0]!.positiveSourceTimeIntervalsMs,[720000]);
});
test('P5.5 pilot diagnostics surface heartbeat/outage/source regression and never infer absent share mapping',()=>{
  const first=sample('2026-09-28T14:00:00Z','2026-09-28T13:50:00Z'),regressed=sample('2026-09-28T14:01:00Z','2026-09-28T13:49:00Z');
  assert.ok(diagnosePilotPrices(profile,[first,regressed]).alerts.includes('reference-source-time-regression'));
  const expired=sample('2026-09-28T14:02:00Z','2026-09-27T14:01:00Z');
  assert.ok(diagnosePilotPrices(profile,[expired]).alerts.includes('reference-heartbeat-exceeded'));
  const missing={...first,reference:null,reviewedMapping:null,unavailableSources:['NVDA-reference']};
  const result=diagnosePilotPrices(profile,[missing]);assert.equal(result.deviationBps,null);
  assert.ok(result.alerts.includes('source-unavailable:NVDA-reference'));assert.ok(result.alerts.includes('normalized-deviation-unavailable'));
  assert.throws(()=>diagnosePilotPrices(profile,[first,{...first,observedAt:'invalid'}]));
});
test('P5.5 pilot diagnostics reject a DEX mid outside the declared age band and distinguish closed sessions',()=>{
  const first=sample('2026-09-28T14:00:00Z','2026-09-28T14:00:00Z');
  assert.ok(diagnosePilotPrices(profile,[{...first,dexMidSettlementPerToken18:(210n*10n**18n).toString()}]).alerts.includes('dex-mid-outside-reference-band'));
  assert.ok(diagnosePilotPrices(profile,[{...first,sessionOpen:false}]).alerts.includes('outside-regular-session'));
});


test('P5.5 Amendment sampled diagnostics record both exact premiums, session liveness and USDT limits',()=>{
  const legacy=sample('2026-09-28T14:00:00Z','2026-09-28T13:50:00Z');
  const current:PilotPriceSample={...legacy,sessionStartAt:'2026-09-28T13:30:00Z',
    equityRound:{roundId:'100',answeredInRound:'100',startedAt:legacy.reference!.sourceAt,blockTimestamp:legacy.observedAt},
    settlementRound:{roundId:'200',answeredInRound:'200',startedAt:'2026-09-28T13:59:00Z',sourceAt:'2026-09-28T13:59:00Z',
      blockTimestamp:legacy.observedAt,price18:(10n**18n).toString()},pilotMapping:{mode:'dual',uiMultiplier:'1005000000000000000'},
    dexMidRatio:{numerator:'200',denominator:'1'}};
  const result=diagnosePilotPrices(profile,[current]);assert.equal(result.policy,'declared-age-band');
  assert.equal(result.policyEvidenceComplete,true);assert.deepEqual(result.reasonCodes,[]);
  assert.deepEqual(result.deviationsByInterpretation.map(x=>x.interpretation),['raw','display']);
  assert.equal(result.deviationsByInterpretation[0]!.signedPremiumBps,'0');
  assert.equal(result.deviationsByInterpretation[1]!.absoluteBps,'50');
  const preopen={...current,reference:{...current.reference!,sourceAt:'2026-09-28T13:29:59Z'},
    equityRound:{...current.equityRound!,startedAt:'2026-09-28T13:29:59Z'}};
  assert.ok(diagnosePilotPrices(profile,[preopen]).reasonCodes.includes('P4'));
  const peg={...current,settlementRound:{...current.settlementRound!,price18:'1005000000000000000'}};
  assert.equal(diagnosePilotPrices(profile,[peg]).reasonCodes.includes('P6'),false);
  assert.ok(diagnosePilotPrices(profile,[{...peg,settlementRound:{...peg.settlementRound,price18:'1005000000000000001'}}]).reasonCodes.includes('P6'));
});
