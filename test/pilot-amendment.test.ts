import test from 'node:test';
import assert from 'node:assert/strict';
import {pilotFixture} from './pilot-fixture.js';
import {pilotPriceReasons} from '../src/pilot/price-integrity.js';
import {evaluateMarketGate} from '../src/market-gate/gate.js';
import {pilotPriceBand} from '../src/pilot/profile.js';
import {maximumShareRatio,pilotShareRatios} from '../src/pilot/quantity.js';
import {regularSessionStart} from '../src/market-gate/session.js';

test('P5.5 Amendment D3 emits P1–P9 and retains true clocks, session open and exact boundaries',()=>{
  const base=pilotFixture();assert.equal(evaluateMarketGate(base).allowed,true);
  const cases:readonly [string,(p:ReturnType<typeof pilotFixture>)=>void][]=[
    ['P1',p=>{Object.assign(p.evidence.pilotPrices.equity,{answer18:0n});}],
    ['P2',p=>{p.evidence.pilotPrices.regression=true;}],
    ['P3',p=>{Object.assign(p.evidence.pilotPrices.equity,{updatedAt:'2026-09-28T14:01:00Z'});}],
    ['P4',p=>{Object.assign(p.evidence.pilotPrices.equity,{startedAt:'2026-09-28T13:29:59Z',updatedAt:'2026-09-28T13:29:59Z'});}],
    ['P5',p=>{Object.assign(p.evidence.pilotPrices.settlement,{startedAt:'2026-09-28T13:37:29Z',updatedAt:'2026-09-28T13:37:29Z'});}],
    ['P6',p=>{Object.assign(p.evidence.pilotPrices.settlement,{answer18:1005000000000000001n});}],
    ['P7',p=>{p.evidence.pilotPrices.mid.midNumerator=210n;}],
    ['P8',p=>{p.evidence.quote.minimumOutputRaw=1n;}],
    ['P9',p=>{p.evidence.quote.nativeFeeRaw=p.pilotProfile.gas.maximumNativeFeeRaw+1n;}],
  ];
  for(const [reason,mutate]of cases) {
    const p=structuredClone(base);mutate(p);assert.ok(pilotPriceReasons(p).includes(reason as never),reason);
    const gate=evaluateMarketGate(p);assert.equal(gate.allowed,false,reason);if(!gate.allowed)assert.equal(gate.reason,reason);
  }
  const p=structuredClone(base),time='2026-09-28T13:37:30Z';
  Object.assign(p.evidence.pilotPrices.settlement,{startedAt:time,updatedAt:time,answer18:1005000000000000000n});
  Object.assign(p.evidence.settlement!,{observedAt:time,lowerValueNumerator:1005000000000000000n,upperValueNumerator:1005000000000000000n,denominator:10n**18n});
  assert.equal(pilotPriceReasons(p).includes('P5'),false);assert.equal(pilotPriceReasons(p).includes('P6'),false);assert.equal(evaluateMarketGate(p).allowed,true);
  const incomplete=structuredClone(base);incomplete.evidence.pilotPrices.equity.answeredInRound=99n;
  assert.ok(pilotPriceReasons(incomplete).includes('P1'));
  for(const [age,band]of [[0,100],[3600000,110],[36000000,200],[86400000,200]])
    assert.equal(pilotPriceBand(base.pilotProfile,age!),band);
  assert.equal(regularSessionStart(base.evidence.session!),Date.parse('2026-09-28T13:30:00Z'));
  assert.equal(regularSessionStart({...base.evidence.session!,localDate:'2026-12-07'}),Date.parse('2026-12-07T14:30:00Z'));
});

test('P5.5 Amendment D2 exact dual prices and conservative caps require a revisioned cited mapping',()=>{
  const p=pilotFixture(), multiplier=1005000000000000000n;
  const dual={mode:'dual' as const,uiMultiplier:multiplier};
  const ratio=maximumShareRatio(dual);assert.equal(ratio.shareUnitsNumerator,multiplier);
  assert.equal(ratio.shareUnitsDenominator,10n**18n);
  Object.assign(p.evidence.quantity!,{pilotMapping:dual,...ratio});
  const gate=evaluateMarketGate(p);assert.equal(gate.allowed,true);
  if(gate.allowed&&gate.adjustedProposal.side==='buy')assert.ok(gate.adjustedProposal.acquiredValueUpper>5n*10n**18n);
  const bad={...p,evidence:{...p.evidence,quantity:{...p.evidence.quantity!,pilotMapping:{mode:'dual' as const,uiMultiplier:2n*10n**18n},
    shareUnitsNumerator:2n,shareUnitsDenominator:1n}}};
  assert.ok(pilotPriceReasons(bad).includes('P7'));assert.ok(pilotPriceReasons(bad).includes('P8'));
  assert.equal(evaluateMarketGate(bad).allowed,false);
  assert.throws(()=>pilotShareRatios({mode:'reviewed',uiMultiplier:multiplier,interpretation:'display'}));
  const reviewed=pilotShareRatios({mode:'reviewed',uiMultiplier:multiplier,interpretation:'display',
    clause:{page:13,text:'Synthetic reviewed clause connecting certificate count to displayed units.',documentDigest:'a'.repeat(64)}});
  assert.equal(reviewed.length,1);assert.deepEqual(reviewed[0],ratio);
});


test('P5.5 Amendment pilot cash limits use the current conservative USDT valuation inside the peg band',()=>{
  const p=pilotFixture(),price=995000000000000000n;
  Object.assign(p.evidence.pilotPrices.settlement,{answer18:price});
  Object.assign(p.evidence.settlement!,{lowerValueNumerator:price,upperValueNumerator:price,denominator:10n**18n});
  assert.equal(evaluateMarketGate(p).allowed,true);
  const {pilotProfile:_profile,...strict}=p;
  assert.deepEqual(evaluateMarketGate(strict),{allowed:false,reason:'REFERENCE_UNAVAILABLE'});
  const constrained={...p,coordinatorPolicy:{...p.coordinatorPolicy,
    companyCapsBps:{[p.instrument.underlyingId]:505}}};
  assert.equal(evaluateMarketGate(constrained).allowed,false);
});


test('P5.5 Amendment D3 gas never changes price premium but the absolute caps still apply',()=>{
  const p=pilotFixture();Object.assign(p.marketPolicy,{maxNetworkFeeSettlement:10n**18n});
  p.evidence.quote.networkFeeSettlement=8n*10n**17n;
  assert.equal(evaluateMarketGate(p).allowed,true);
  p.evidence.quote.networkFeeSettlement=10n**18n+1n;
  assert.deepEqual(evaluateMarketGate(p),{allowed:false,reason:'P9'});
});
