import {randomUUID,createHash} from 'node:crypto';
import {verifyTypedData} from 'ethers';
import type {Pool,PoolClient} from 'pg';
import {identifier,requireInput} from '../domain/errors.js';
import {amount,type Amount} from '../domain/amount.js';
import {securityDigest} from '../security/token-security.js';
import type {ExecutionSessions} from './production.js';
import {EoaExecutionStore,type EoaRecoveryContext} from './store.js';
import {parseRecoveryConfig,recoveryConfigurationRecord,type RecoveryConfig} from './recovery-config.js';
import {executionJson} from './execution-json.js';
import {decodeReceiptProof,receiptEffectsIdentity,verifyEoaReceiptEffects,type EoaReceiptEffectProof} from './receipt-effects.js';
import {rawBalanceDigest,type AppliedFillProof,type R1Evidence,type ReanchorReader} from './reanchor-evidence.js';

interface FillRow {signed_transaction:string;proof:EoaReceiptEffectProof;before_balances:readonly Amount[];after_balances:readonly Amount[]}
interface ReviewRow {id:string;leg_id:string;portfolio_id:string;expected_revision:string;evidence_hash:string;
  body:{wallet:string;configurationHash:string;originalProofHash:string;evidence:R1Evidence};
  expires_at:Date;owner_signature:string|null;applied_revision:string|null}
export function reanchorTypedData(row:{id:string;portfolioId:string;legId:string;wallet:string;expectedRevision:bigint;
  evidenceHash:string;configurationHash:string;originalProofHash:string;expiresAt:string}) {
  return{domain:{name:'Nexus disputed fill re-anchor',version:'1',chainId:56},types:{Reanchor:[
    {name:'reviewId',type:'string'},{name:'portfolioId',type:'string'},{name:'legId',type:'string'},
    {name:'wallet',type:'address'},{name:'beforeRevision',type:'uint256'},{name:'afterRevision',type:'uint256'},
    {name:'outcome',type:'string'},{name:'originalProofHash',type:'bytes32'},{name:'evidenceHash',type:'bytes32'},
    {name:'configurationHash',type:'bytes32'},{name:'expiresAt',type:'uint256'}]},value:{reviewId:row.id,
    portfolioId:row.portfolioId,legId:row.legId,wallet:row.wallet,beforeRevision:row.expectedRevision,
    afterRevision:row.expectedRevision+1n,outcome:'R1',originalProofHash:`0x${row.originalProofHash}`,
    evidenceHash:`0x${row.evidenceHash}`,configurationHash:`0x${row.configurationHash}`,expiresAt:BigInt(Date.parse(row.expiresAt))}};
}
const balances=(values:readonly Amount[])=>values.map(b=>amount(BigInt(b.units),b));
const original=(row:FillRow):AppliedFillProof=>{
  const after=balances(row.after_balances),before=balances(row.before_balances);
  // A new output token may not have been in the pre-fill ledger; its prior amount is zero.
  return{proof:decodeReceiptProof(row.proof),after,before:[...before,...after.filter(a=>!before.some(b=>b.assetId===a.assetId)).map(a=>amount(0n,a))]};
};
const decodeEvidence=(e:R1Evidence):R1Evidence=>({...e,finalizedBlock:BigInt(e.finalizedBlock),proof:decodeReceiptProof(e.proof),
  before:balances(e.before),after:balances(e.after),allowanceProof:e.allowanceProof?{...e.allowanceProof,
    sourceBlock:BigInt(e.allowanceProof.sourceBlock),allowanceRaw:BigInt(e.allowanceProof.allowanceRaw)}:null});

export function validateReanchorEvidence(c:EoaRecoveryContext,old:AppliedFillProof,e:R1Evidence,config:RecoveryConfig):void {
  requireInput(e.outcome==='R1'&&e.sources.length===2&&new Set(e.sources.map(s=>s.id)).size===2
    &&new Set(e.sources.map(s=>s.upstreamGroup)).size===2&&e.sources.every(s=>{
      const configured=config.sources.find(x=>x.id===s.id);
      return !!configured?.independence&&configured.independence.upstreamGroup===s.upstreamGroup
        &&configured.independence.reviewDigest===s.reviewDigest
        &&createHash('sha256').update(configured.rpcUrl).digest('hex')===s.endpointDigest
        &&/^[0-9a-f]{64}$/.test(s.evidenceDigest)&&/^0x[0-9a-f]{64}$/.test(s.oldCanonicalHash)
        &&s.oldCanonicalHash!==old.proof.blockHash;
    })&&e.sources[0]!.oldCanonicalHash===e.sources[1]!.oldCanonicalHash,
  'RPC_INDEPENDENCE_REQUIRED','Two agreeing noncanonical proofs with reviewed distinct upstreams required.');
  requireInput(e.proof.transactionHash.toLowerCase()===c.transactionHash&&e.finalizedBlock>=old.proof.blockNumber
    &&e.finalizedBlock-e.proof.blockNumber+1n>=BigInt(config.finalityBlocks)
    &&/^0x[0-9a-f]{64}$/.test(e.finalizedBlockHash)
    &&(e.proof.blockNumber!==old.proof.blockNumber||e.proof.blockHash!==old.proof.blockHash)
    &&receiptEffectsIdentity(e.proof)===receiptEffectsIdentity(old.proof),
  'REANCHOR_EFFECTS_CHANGED','R1 requires the same hash with identical ordered log contents and gas.');
  requireInput(rawBalanceDigest(e.before)===rawBalanceDigest(old.before)&&rawBalanceDigest(e.after)===rawBalanceDigest(old.after)
    &&rawBalanceDigest(e.after)===rawBalanceDigest(c.balances),
  'REANCHOR_BALANCES_CHANGED','R1 changes no accounting amount; the entire finalized ledger must agree.');
  verifyEoaReceiptEffects({proof:e.proof,chainId:c.chainId,wallet:c.wallet,transactionHash:c.transactionHash,
    router:c.router,transactionValue:c.transactionValue,tokenIn:c.tokenIn,tokenOut:c.tokenOut,inputRaw:c.inputRaw,
    minimumOutputRaw:c.minimumOutputRaw,before:e.before,after:e.after});
  if(c.requireZeroAllowance&&e.proof.success)requireInput(!!e.allowanceProof&&e.allowanceProof.allowanceRaw===0n
    &&e.allowanceProof.wallet===c.wallet&&e.allowanceProof.token===c.tokenIn
    &&e.allowanceProof.spender.toLowerCase()===c.router.toLowerCase()&&e.allowanceProof.sourceBlock===e.proof.blockNumber
    &&e.allowanceProof.sourceBlockHash===e.proof.blockHash,
  'PILOT_POST_FILL_ALLOWANCE_INVALID','Re-included pilot receipt must still prove zero allowance.');
}

/** Append-only compensating R1 record; the original proof and accounting fill remain intact. */
export class ReanchorService {
  private readonly config:RecoveryConfig;
  private readonly configurationHash:string;
  constructor(private readonly pool:Pool,private readonly sessions:ExecutionSessions,config:RecoveryConfig,
    private readonly reader:ReanchorReader,private readonly clock:()=>Date=()=>new Date()) {
    this.config=parseRecoveryConfig(config);this.configurationHash=recoveryConfigurationRecord(this.config).hash;
  }
  private async transaction<T>(run:(c:PoolClient)=>Promise<T>) {
    const c=await this.pool.connect();try{await c.query('BEGIN');try{const out=await run(c);await c.query('COMMIT');return out;}
      catch(error){await c.query('ROLLBACK');throw error;}}finally{c.release();}
  }
  private async owned(c:PoolClient,token:string,portfolioId:string,legId:string) {
    identifier(portfolioId);identifier(legId);
    const session=await this.sessions.authenticate(token,this.clock(),c);
    await c.query('SELECT pg_advisory_xact_lock(hashtextextended(current_schema() || $1,0))',[`nexus-eoa-recovery:${portfolioId}`]);
    const p=await c.query<{revision:string;owner_wallet:string;execution_paused:boolean}>(
      'SELECT revision,owner_wallet,execution_paused FROM portfolios WHERE id=$1 AND owner_wallet=$2 AND chain_id=56 FOR UPDATE',
      [portfolioId,session.wallet.toLowerCase()]);
    requireInput(!!p.rows[0]&&p.rows[0].execution_paused,'PORTFOLIO_UNAVAILABLE','Owned frozen portfolio required.');
    const applied=await c.query('SELECT 1 FROM eoa_reanchor_reviews WHERE leg_id=$1 AND applied_revision IS NOT NULL',[legId]);
    requireInput(applied.rowCount===0,'REANCHOR_ALREADY_APPLIED','A competing transition for this leg cannot be applied.');
    const fill=await c.query<FillRow>(`SELECT l.signed_transaction,f.proof,f.before_balances,f.after_balances FROM eoa_execution_legs l
      JOIN eoa_fill_proofs f ON f.leg_id=l.id WHERE l.id=$1 AND l.portfolio_id=$2 AND l.state='reorged'
      AND l.reconciled_at IS NOT NULL FOR UPDATE OF l`,[legId,portfolioId]);
    requireInput(!!fill.rows[0],'APPLIED_REORG_REQUIRED','An immutable original proof of an applied disputed fill is required.');
    const obligations=await c.query(`SELECT 1 FROM eoa_execution_legs WHERE portfolio_id=$1 AND id<>$2
      AND (reconciled_at IS NULL OR state IN ('reorged','replaced')) UNION ALL
      SELECT 1 FROM reservations WHERE portfolio_id=$1 AND state='submitted' LIMIT 1`,[portfolioId,legId]);
    requireInput(obligations.rowCount===0,'UNRESOLVED_SUBMISSION','Other pending obligations require general repair.');
    return {portfolio:p.rows[0],fill:fill.rows[0],original:original(fill.rows[0])};
  }
  async prepare(input:{sessionToken:string;portfolioId:string;legId:string}) {
    const owned=await this.transaction(c=>this.owned(c,input.sessionToken,input.portfolioId,input.legId));
    const context=await new EoaExecutionStore(this.pool).loadRecoveryContext(input.portfolioId,input.legId);
    requireInput(context.revision===BigInt(owned.portfolio.revision),'STALE_REVISION','Portfolio changed during diagnosis.');
    const evidence=await this.reader.read(context,owned.original,owned.fill.signed_transaction);
    requireInput(evidence!==null,'REANCHOR_EVIDENCE_UNAVAILABLE','Two independent complete R1 proofs required.');
    validateReanchorEvidence(context,owned.original,evidence,this.config);
    const id=randomUUID(),expiresAt=new Date(this.clock().getTime()+300000).toISOString();
    const evidenceHash=securityDigest(evidence),originalProofHash=securityDigest(owned.original);
    const packet={id,portfolioId:input.portfolioId,legId:input.legId,wallet:context.wallet,
      expectedRevision:context.revision,evidenceHash,configurationHash:this.configurationHash,originalProofHash,expiresAt};
    await this.transaction(async c=>{
      const current=await this.owned(c,input.sessionToken,input.portfolioId,input.legId);
      requireInput(BigInt(current.portfolio.revision)===context.revision,'STALE_REVISION','Portfolio changed during proof collection.');
      await c.query(`INSERT INTO eoa_reanchor_reviews(id,leg_id,portfolio_id,expected_revision,evidence_hash,body,expires_at)
        VALUES($1,$2,$3,$4,$5,$6::jsonb,$7)`,[id,input.legId,input.portfolioId,context.revision.toString(),evidenceHash,
        executionJson({wallet:context.wallet,configurationHash:this.configurationHash,originalProofHash,evidence}),expiresAt]);
    });
    return{reviewId:id,outcome:'R1' as const,expiresAt,evidence,typedData:reanchorTypedData(packet)};
  }
  async activate(input:{sessionToken:string;reviewId:string;ownerSignature:string}) {
    identifier(input.reviewId);
    const saved=await this.pool.query<ReviewRow>('SELECT * FROM eoa_reanchor_reviews WHERE id=$1',[input.reviewId]);
    const row=saved.rows[0];requireInput(!!row,'REVIEW_UNAVAILABLE','Stored R1 review required.');
    const session=await this.transaction(c=>this.sessions.authenticate(input.sessionToken,this.clock(),c));
    requireInput(session.wallet.toLowerCase()===row.body.wallet,'REVIEW_UNAVAILABLE','Owned transition required.');
    const typed=reanchorTypedData({id:row.id,portfolioId:row.portfolio_id,legId:row.leg_id,wallet:row.body.wallet,
      expectedRevision:BigInt(row.expected_revision),evidenceHash:row.evidence_hash,configurationHash:row.body.configurationHash,
      originalProofHash:row.body.originalProofHash,expiresAt:row.expires_at.toISOString()});
    let signer='';try{signer=verifyTypedData(typed.domain,typed.types,typed.value,input.ownerSignature).toLowerCase();}catch{/* blocked */}
    requireInput(signer===row.body.wallet,'INVALID_SIGNATURE','Exact R1 owner transition signature required.');
    if(row.applied_revision!==null)return{revision:BigInt(row.applied_revision),replay:true};
    requireInput(row.body.configurationHash===this.configurationHash&&row.expires_at>this.clock(),
      'REANCHOR_EXPIRED','Transition/configuration expired or changed.');
    let owned:Awaited<ReturnType<ReanchorService['owned']>>;
    try{owned=await this.transaction(c=>this.owned(c,input.sessionToken,row.portfolio_id,row.leg_id));}
    catch(error) {
      const applied=await this.pool.query<{applied_revision:string|null}>('SELECT applied_revision FROM eoa_reanchor_reviews WHERE id=$1',[row.id]);
      if(applied.rows[0]?.applied_revision!==null&&applied.rows[0]?.applied_revision!==undefined)
        return{revision:BigInt(applied.rows[0].applied_revision),replay:true};
      throw error;
    }
    const context=await new EoaExecutionStore(this.pool).loadRecoveryContext(row.portfolio_id,row.leg_id);
    requireInput(context.revision===BigInt(row.expected_revision)&&securityDigest(owned.original)===row.body.originalProofHash,
      'STALE_REVISION','Original fill or frozen revision changed.');
    const evidence=await this.reader.read(context,owned.original,owned.fill.signed_transaction,decodeEvidence(row.body.evidence));
    requireInput(!!evidence&&securityDigest(evidence)===row.evidence_hash,'REANCHOR_EVIDENCE_CHANGED','Canonical evidence changed after review.');
    validateReanchorEvidence(context,owned.original,evidence,this.config);
    return this.transaction(async c=>{
      // Serialize and accept same-record replay even if another activation finished while RPC was pending.
      const locked=await c.query<ReviewRow>('SELECT * FROM eoa_reanchor_reviews WHERE id=$1 FOR UPDATE',[row.id]);
      if(locked.rows[0]!.applied_revision!==null)return{revision:BigInt(locked.rows[0]!.applied_revision!),replay:true};
      const current=await this.owned(c,input.sessionToken,row.portfolio_id,row.leg_id);
      requireInput(current.portfolio.revision===row.expected_revision&&row.expires_at>this.clock(),
        'STALE_REVISION','Frozen ledger revision changed.');
      const raw=await c.query<{asset_id:string;decimals:number;confirmed_units:string}>(
        'SELECT asset_id,decimals,confirmed_units FROM balances WHERE portfolio_id=$1',[row.portfolio_id]);
      requireInput(rawBalanceDigest(raw.rows.map(b=>amount(BigInt(b.confirmed_units),{assetId:b.asset_id,decimals:b.decimals})))
        ===rawBalanceDigest(evidence.after),'REANCHOR_BALANCES_CHANGED','Ledger changed before atomic compensation.');
      const next=BigInt(row.expected_revision)+1n;
      await c.query('INSERT INTO portfolio_revisions(portfolio_id,revision,reason) VALUES($1,$2,$3)',
        [row.portfolio_id,next.toString(),`eoa-reanchor-R1:${row.id}`]);
      await c.query('UPDATE portfolios SET revision=$2,execution_paused=true WHERE id=$1',[row.portfolio_id,next.toString()]);
      await c.query(`UPDATE eoa_execution_legs SET state=$2,included_block=$3,included_block_hash=$4,
        balance_block=$3,balance_block_hash=$4,updated_at=now() WHERE id=$1`,[row.leg_id,
        evidence.proof.success?'confirmed':'reverted',evidence.proof.blockNumber.toString(),evidence.proof.blockHash]);
      await c.query('UPDATE eoa_reanchor_reviews SET owner_signature=$2,applied_revision=$3 WHERE id=$1',
        [row.id,input.ownerSignature,next.toString()]);
      await c.query(`INSERT INTO decision_records(id,portfolio_id,revision,kind,body) VALUES($1,$2,$3,'chain-incident-R1',$4::jsonb)`,
        [`reanchor-${row.id}`,row.portfolio_id,next.toString(),executionJson({reviewId:row.id,legId:row.leg_id,
          beforeRevision:row.expected_revision,afterRevision:next,outcome:'R1',originalProofHash:row.body.originalProofHash,
          evidenceHash:row.evidence_hash,configurationHash:this.configurationHash,incident:'reorg-beyond-finality',evidence})]);
      return{revision:next,replay:false};
    });
  }
}
