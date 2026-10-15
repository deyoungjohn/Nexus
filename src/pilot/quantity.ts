import { requireInput } from '../domain/errors.js';

export interface PilotQuantityMapping {
  readonly mode: 'dual' | 'reviewed';
  readonly uiMultiplier: bigint;
  /** A reviewed interpretation is a signed record revision, never a runtime switch. */
  readonly interpretation?: 'raw' | 'display';
  readonly clause?: { readonly text: string; readonly page: number; readonly documentDigest: string };
}
export interface ShareRatio { readonly shareUnitsNumerator: bigint; readonly shareUnitsDenominator: bigint }
export function pilotShareRatios(mapping: PilotQuantityMapping): readonly ShareRatio[] {
  requireInput(mapping.uiMultiplier > 0n && ['dual','reviewed'].includes(mapping.mode),
    'INVALID_PILOT_MAPPING','Positive current multiplier and revisioned interpretation required.');
  const raw={shareUnitsNumerator:1n,shareUnitsDenominator:1n};
  const display={shareUnitsNumerator:mapping.uiMultiplier,shareUnitsDenominator:10n**18n};
  if(mapping.mode==='dual') {
    requireInput(mapping.interpretation===undefined && mapping.clause===undefined,
      'INVALID_PILOT_MAPPING','Dual interpretation cannot claim a reviewed clause.');
    return [raw,display];
  }
  requireInput(!!mapping.clause && mapping.clause.text.trim().length>=30
    && Number.isSafeInteger(mapping.clause.page) && mapping.clause.page>0
    && /^[0-9a-f]{64}$/.test(mapping.clause.documentDigest)
    && ['raw','display'].includes(mapping.interpretation??''),
  'INVALID_PILOT_MAPPING','A cited clause and page are required for a single interpretation.');
  return [mapping.interpretation==='raw'?raw:display];
}
export function maximumShareRatio(mapping:PilotQuantityMapping):ShareRatio {
  return pilotShareRatios(mapping).reduce((a,b)=>a.shareUnitsNumerator*b.shareUnitsDenominator
    >=b.shareUnitsNumerator*a.shareUnitsDenominator?a:b);
}
