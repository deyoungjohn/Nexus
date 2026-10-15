import type { Pool,PoolClient } from 'pg';
import { createInstrument,type InstrumentInput } from '../domain/instrument.js';
import { amount,nativeAssetId } from '../domain/amount.js';
import { requireInput,identifier } from '../domain/errors.js';
import type { CoordinatorPolicy,PortfolioSnapshot,Proposal } from '../coordinator/plan.js';
import { CoordinatorStore } from '../coordinator/store.js';
import type { ExecutionSessions } from '../execution/production.js';
import type { ChainSnapshotReader } from '../execution/chain-bootstrap.js';
import type { SettlementEvidence } from '../market-gate/evidence.js';
import { securityDigest } from '../security/token-security.js';
import { validatePilotProfile,type PilotAdmissionProfile } from './profile.js';

/** One supervised plan from server/chain records, without adding a scheduler. */
export class PilotPlanningService {
  constructor(private readonly pool:Pool,private readonly sessions:ExecutionSessions,
    private readonly profile:PilotAdmissionProfile,private readonly instrumentInput:InstrumentInput,
    private readonly policy:CoordinatorPolicy,private readonly reader:ChainSnapshotReader,
    private readonly settlement:(now:string)=>Promise<SettlementEvidence|null>,private readonly clock:()=>Date=()=>new Date()) {
    validatePilotProfile(profile);
    requireInput(createInstrument(instrumentInput).instrumentId===profile.instrumentId,
      'INVALID_PILOT_CONFIG','Exact configured pilot instrument required.');
  }
  private async transaction<T>(run:(c:PoolClient)=>Promise<T>):Promise<T>{
    const c=await this.pool.connect();try{await c.query('BEGIN');try{const v=await run(c);await c.query('COMMIT');return v;}
      catch(e){await c.query('ROLLBACK');throw e;}}finally{c.release();}
  }
  async prepare(input:{sessionToken:string;portfolioId:string;requestId:string}) {
    identifier(input.portfolioId);identifier(input.requestId);
    const now=this.clock(),session=await this.transaction(c=>this.sessions.authenticate(input.sessionToken,now,c));
    requireInput(session.wallet.toLowerCase()===this.profile.wallet,'PORTFOLIO_UNAVAILABLE','Configured pilot owner required.');
    const chain=await this.reader.read(this.profile.wallet),settlement=await this.settlement(now.toISOString());
    requireInput(chain!==null&&settlement!==null&&settlement.valuationUnit==='USD-18'
      &&Date.parse(settlement.observedAt)<=now.getTime()&&Date.parse(settlement.expiresAt)>now.getTime()
      &&settlement.lowerValueNumerator>0n&&settlement.upperValueNumerator>=settlement.lowerValueNumerator&&settlement.denominator>0n,
    'CHAIN_SNAPSHOT_UNAVAILABLE','Complete unchanged chain balances and settlement observation required.');
    return this.transaction(async c=>{
      await this.sessions.authenticate(input.sessionToken,this.clock(),c);
      await c.query("SELECT pg_advisory_xact_lock(hashtextextended('nexus-pilot:' || $1,0))",[this.profile.wallet]);
      const rows=await c.query<{revision:string;data_mode:string;execution_paused:boolean;active_policy_id:string|null}>(
        'SELECT revision,data_mode,execution_paused,active_policy_id FROM portfolios WHERE id=$1 AND owner_wallet=$2 AND chain_id=56 FOR UPDATE',
        [input.portfolioId,this.profile.wallet]);
      const p=rows.rows[0];requireInput(p!==undefined&&p.data_mode==='chain'&&!p.execution_paused,
        'EXECUTION_UNAVAILABLE','Initialize and explicitly unpause the owner portfolio first.');
      const used=await c.query('SELECT 1 FROM eoa_execution_legs WHERE wallet=$1 AND chain_id=56 LIMIT 1',[this.profile.wallet]);
      requireInput(used.rowCount===0,'PILOT_ALREADY_USED','A persisted leg already consumed this pilot allowance.');
      const instrument=createInstrument(this.instrumentInput);
      const coordinator=new CoordinatorStore(this.pool);
      await coordinator.registerInstrument(instrument,c);
      const registered=await c.query<{body:InstrumentInput}>('SELECT body FROM instruments WHERE instrument_id=$1 FOR SHARE',[this.profile.instrumentId]);
      requireInput(registered.rows[0]!==undefined&&securityDigest(createInstrument(registered.rows[0].body))===securityDigest(instrument),
        'INSTRUMENT_METADATA_CHANGED','Operator must register the exact reviewed instrument before planning.');
      const saved=await c.query<{asset_id:string;decimals:number;confirmed_units:string}>('SELECT * FROM balances WHERE portfolio_id=$1 FOR SHARE',[input.portfolioId]);
      const canonical=(b:readonly {assetId:string;decimals:number;units:bigint}[])=>securityDigest([...b].sort((a,b)=>a.assetId.localeCompare(b.assetId)));
      requireInput(canonical(saved.rows.map(b=>({assetId:b.asset_id,decimals:b.decimals,units:BigInt(b.confirmed_units)})))===canonical(chain.balances),
        'CHAIN_STATE_CHANGED','A changed balance requires owner-signed resync first.');
      const anchor=await c.query<{tx_nonce:string}>(`SELECT tx_nonce FROM chain_snapshot_reviews WHERE portfolio_id=$1
        AND wallet=$2 AND activated_revision IS NOT NULL ORDER BY activated_revision DESC LIMIT 1`,[input.portfolioId,this.profile.wallet]);
      requireInput(anchor.rows[0]!==undefined&&BigInt(anchor.rows[0].tx_nonce)===chain.transactionNonce,
        'UNEXPLAINED_NONCE','External activity requires owner-signed resync first.');
      const previous=await c.query<{id:string;revision:string;status:string}>('SELECT id,revision,status FROM plans WHERE portfolio_id=$1 AND idempotency_key=$2',
        [input.portfolioId,input.requestId]);
      if(previous.rows[0]){
        requireInput(previous.rows[0].revision===p.revision&&previous.rows[0].status==='reserved','STALE_REVISION','Previous request needs a new review.');
        return{planId:previous.rows[0].id,revision:p.revision,replay:true};
      }
      const cash=chain.balances.find(b=>b.assetId===settlement.assetId),native=chain.balances.find(b=>b.assetId===nativeAssetId(56)),stock=chain.balances.find(b=>b.assetId===instrument.assetId);
      requireInput(cash!==undefined&&native!==undefined&&stock!==undefined&&stock.units===0n,
        'PILOT_SCOPE','Pilot requires exactly the reviewed cash/gas and no initial stock holdings.');
      let revision=BigInt(p.revision);
      if(p.active_policy_id===null){
        revision=await coordinator.activatePolicy({portfolioId:input.portfolioId,expectedRevision:revision,
          policyId:`pilot-${input.portfolioId}`,version:1,policy:this.policy},c);
      }else{
        const policy=await c.query<{body:unknown}>('SELECT body FROM policies WHERE id=$1',[p.active_policy_id]);
        requireInput(policy.rows[0]!==undefined&&securityDigest(policy.rows[0].body)===securityDigest(this.policy),
          'PILOT_POLICY_CHANGED','Active policy differs from the configured pilot policy.');
      }
      const holds=await c.query<{asset_id:string;units:string}>("SELECT asset_id,sum(units) AS units FROM reservations WHERE portfolio_id=$1 AND state IN ('held','submitted') GROUP BY asset_id",[input.portfolioId]);
      const held=new Map(holds.rows.map(r=>[r.asset_id,BigInt(r.units)]));
      const snapshot:PortfolioSnapshot={revision,sourceBlock:chain.sourceBlock,valuationUnit:'USD-18',confirmedCash:cash,
        reservedCash:amount(held.get(cash.assetId)??0n,cash),cashValueLower:cash.units*settlement.lowerValueNumerator/settlement.denominator,
        nativeGas:native,positions:[{instrument,raw:stock,reservedRaw:amount(held.get(stock.assetId)??0n,stock),
          valueLower:0n,valueUpper:0n,buyEligible:true,sellEligible:false}]};
      const spend=amount(this.profile.maximumSpendRaw,cash),nominal=spend.units*settlement.upperValueNumerator/settlement.denominator;
      const proposal:Proposal={id:`pilot-${input.requestId}`,instrumentId:instrument.instrumentId,side:'buy',priority:1,
        nominalValue:nominal,spend,acquiredValueLower:0n,acquiredValueUpper:(nominal*10200n+9999n)/10000n};
      const planId=`pilot-${input.requestId}`;
      const result=await coordinator.coordinateAndReserve({portfolioId:input.portfolioId,expectedRevision:revision,planId,
        occurrenceId:planId,idempotencyKey:input.requestId,leaseUntil:new Date(this.clock().getTime()+600_000),snapshot,proposals:[proposal]},c);
      requireInput(result.result.legs.length===1&&result.result.legs[0]!.amount.units===spend.units,
        'PILOT_PLAN_BLOCKED','Full bounded pilot amount must be available; no implicit partial trade.');
      return{planId,revision:revision.toString(),replay:false};
    });
  }
}
