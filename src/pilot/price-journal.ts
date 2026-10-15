import type { Pool } from 'pg';
import { pilotPriceReasons, type PilotFeedObservation } from './price-integrity.js';
import type { GateRequest } from '../market-gate/evidence.js';
import { evaluateMarketGate } from '../market-gate/gate.js';
import { executionJson } from '../execution/execution-json.js';

/** Serialized, source-scoped high-water marks cannot be erased by a new profile. */
export function createPilotPriceJournal(pool:Pool) {
  return {
    async observe(feeds:readonly (PilotFeedObservation|null)[]):Promise<boolean> {
      const client=await pool.connect();let regression=false;
      try {await client.query('BEGIN');
        for(const f of [...feeds].sort((a,b)=>(a?.source??'').localeCompare(b?.source??''))) {
          if(!f||f.roundId<=0n||f.answer18<=0n||f.answeredInRound<f.roundId
            ||![f.startedAt,f.updatedAt,f.observedAt,f.blockTimestamp].every(x=>Number.isFinite(Date.parse(x)))
            ||Date.parse(f.startedAt)<=0||Date.parse(f.startedAt)>Date.parse(f.updatedAt)
            ||Date.parse(f.blockTimestamp)>Date.parse(f.observedAt)||Date.parse(f.updatedAt)>Date.parse(f.blockTimestamp))continue;
          await client.query('SELECT pg_advisory_xact_lock(hashtextextended(current_schema() || $1,0))',[`pilot-feed:${f.source}`]);
          const old=await client.query<{round_id:string;updated_at:Date}>('SELECT round_id,updated_at FROM pilot_feed_highwater WHERE source=$1',[f.source]);
          const row=old.rows[0];
          if(row&&(f.roundId<BigInt(row.round_id)||Date.parse(f.updatedAt)<row.updated_at.getTime()))regression=true;
          await client.query(`INSERT INTO pilot_feed_highwater(source,round_id,updated_at) VALUES($1,$2,$3)
            ON CONFLICT(source) DO UPDATE SET round_id=greatest(pilot_feed_highwater.round_id,excluded.round_id),
            updated_at=greatest(pilot_feed_highwater.updated_at,excluded.updated_at)`,[f.source,f.roundId.toString(),f.updatedAt]);
        }
        await client.query('COMMIT');return regression;
      }catch(error){await client.query('ROLLBACK');throw error;}finally{client.release();}
    },
    async record(request:GateRequest,phase:'prepare'|'revalidate'):Promise<void> {
      const gate=evaluateMarketGate(request);
      await pool.query('INSERT INTO pilot_price_observations(profile_revision,phase,evidence,gate_reason) VALUES($1,$2,$3::jsonb,$4)',
        [request.pilotProfile!.revision,phase,executionJson({prices:request.evidence.pilotPrices,
          priceReasons:pilotPriceReasons(request),mapping:request.evidence.quantity?.pilotMapping,quote:request.evidence.quote,policy:'declared-age-band',
          sourceAt:request.evidence.reference?.sourceAt}),gate.allowed?null:gate.reason]);
    }
  };
}
