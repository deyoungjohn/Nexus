import {productionFixture} from './production-execution-fixture.js';
import {assessTokenSecurity,tokenSecurityFingerprint} from '../src/security/token-security.js';
import type {PilotAdmissionProfile} from '../src/pilot/profile.js';
import {routeAbi} from '../src/market-gate/bstocks-route.js';

export function pilotFixture(wallet='0x1111111111111111111111111111111111111111') {
  const base=structuredClone(productionFixture(wallet)),q=base.evidence.quote!;
  const equitySource='chainlink-bsc:0xea5c2cbb5cd57dac24e26180b19a929f3e9699b8';
  Object.assign(base.instrument,{referenceSource:equitySource});
  Object.assign(base.evidence.reference!,{source:equitySource});
  Object.assign(base.evidence.settlement!,{source:'chainlink-bsc:0xb97ad0e74fa7d920791e90258a6e2085088b4320'});
  const min=q.expectedOutputRaw*999n/1000n;
  const data=routeAbi.encodeFunctionData('exactInputSingle',[[q.tokenIn,q.tokenOut,2500,wallet,
    BigInt(Date.parse(q.onchainDeadline)/1000),q.inputRaw,min,0]]);
  const reports=base.evidence.tokenSecurity!.map(s=>assessTokenSecurity({...s,review:null,reviewArtifact:null,
    providers:s.providers.map(p=>({...p,state:'unsupported' as const,coverage:Object.fromEntries(Object.keys(p.coverage!).map(k=>[k,'unknown' as const]))})),
    now:base.now,maxAgeMs:base.marketPolicy.maxStatusAgeMs}));
  const pilotProfile:PilotAdmissionProfile={version:2,revision:'owner-pilot-1',wallet:wallet.toLowerCase(),instrumentId:base.instrument.instrumentId,
    maximumSpendRaw:5n*10n**18n,independentReview:'deferred',gas:{maximumNativeFeeRaw:10n**16n,maximumSettlementFeeRaw:10n**18n,reviewedAt:base.now},price:{heartbeatMs:86400000,
      heartbeatSourceUrl:'https://reference-data-directory.vercel.app/feeds-bsc-mainnet.json',heartbeatSourceDigest:'c'.repeat(64),
      baseBandBps:100,additionalBandBpsPerHour:10,maximumBandBps:200},security:reports.map(s=>({assetId:s.assetId,
        fingerprint:tokenSecurityFingerprint(s.observation!),acceptedFindings:{binance:[],goplus:[]}}))};
  return {...base,pilotProfile,marketPolicy:{...base.marketPolicy,maxReferenceAgeMs:86400000,maxSettlementAgeMs:1350000,approvalClock:'refresh-before-submit' as const,maxQuoteAgeMs:300000},
    evidence:{...base.evidence,
      quantity:{...base.evidence.quantity!,pilotMapping:{mode:'dual' as const,uiMultiplier:10n**18n}},
      pilotPrices:{regression:false,equity:{source:base.evidence.reference!.source,roundId:100n,answeredInRound:100n,
        answer18:base.evidence.reference!.pricePerShare,startedAt:base.evidence.reference!.sourceAt,updatedAt:base.evidence.reference!.sourceAt,
        observedAt:base.now,blockTimestamp:base.now,sourceBlock:base.evidence.quantity!.sourceBlock,
        sourceBlockHash:reports[0]!.observation!.sourceBlockHash},settlement:{source:base.evidence.settlement!.source,
        roundId:200n,answeredInRound:200n,answer18:10n**18n,startedAt:base.evidence.settlement!.observedAt,updatedAt:base.evidence.settlement!.observedAt,
        observedAt:base.now,blockTimestamp:base.now,sourceBlock:base.evidence.quantity!.sourceBlock,
        sourceBlockHash:reports[0]!.observation!.sourceBlockHash},mid:{sourceBlock:base.evidence.quantity!.sourceBlock,
          sourceBlockHash:reports[0]!.observation!.sourceBlockHash,midNumerator:200n,midDenominator:1n}},quote:{...q,minimumOutputRaw:min,calldata:data},simulation:{...base.evidence.simulation!,calldata:data},
      audit:{...base.evidence.audit!,state:'unsupported' as const},tokenSecurity:reports,pilotRoundTrip:{source:'anvil-owner-round-trip:v1' as const,
        wallet,sourceBlock:base.evidence.quantity!.sourceBlock,sourceBlockHash:reports[0]!.observation!.sourceBlockHash,
        observedAt:base.now,expiresAt:'2026-09-28T14:05:00Z',buyCalldata:data,buyInputRaw:q.inputRaw,
        boughtRaw:q.expectedOutputRaw,soldRaw:q.expectedOutputRaw,sellOutputRaw:49n*10n**17n,buyTransferTaxRaw:0n,sellTransferTaxRaw:0n,
        sellCalldata:routeAbi.encodeFunctionData('exactInputSingle',[[q.tokenOut,q.tokenIn,2500,wallet,
          BigInt(Date.parse(q.onchainDeadline)/1000),q.expectedOutputRaw,1n,0]]),success:true,evidenceDigest:'f'.repeat(64)}}};
}
