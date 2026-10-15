import type { Pool } from "pg";
import { requireInput } from "../domain/errors.js";
import { eoaApprovalTypedData, type EoaLegApproval } from "../execution/eoa.js";
import { executionJson } from "../execution/execution-json.js";
import type { ProductionEoaExecutor } from "../execution/production.js";
import { applicationTransaction, SessionStore } from "./session.js";

export interface ExecutionRecordView {
  configured:boolean; broadcastEnabled:boolean;
  legs:{planId:string;legIndex:number;instrumentId:string;side:string;inputUnits:string;decimals:number;
    status:string;reanchorAvailable?:boolean;reviewId:string|null;expiresAt:string|null;transactionHash:string|null;transactionState:string|null}[];
}
export interface ExecutionReviewView {
  pilotAdmission?:{mode:'owner-pilot';profileRevision:string;maximumSpendUnits:string;independentReview:'deferred';
    referenceSourceAt:string;referenceAgeMs:number;referenceBandBps:number;roundTripPassed:boolean;
    scannerFindings:string[];unknownScannerChecks:string[]};
  kind:"review";reviewId:string;approval:Record<string,unknown>;
  typedData:Record<string,unknown>;transaction:Record<string,string>;
}
const wire=<T>(v:unknown):T=>JSON.parse(executionJson(v)) as T;
const command=(value:unknown,fields:readonly string[]):Record<string,unknown>=>{
  requireInput(value!==null&&typeof value==="object"&&!Array.isArray(value),"INVALID_COMMAND","Expected an execution command.");
  const r=value as Record<string,unknown>;
  requireInput(Object.keys(r).length===fields.length&&fields.every(k=>Object.hasOwn(r,k)),"INVALID_COMMAND","Unexpected execution fields.");return r;
};
export function executionReviewView(reviewId:string,a:EoaLegApproval):ExecutionReviewView {
  const hex=(n:bigint|number)=>`0x${BigInt(n).toString(16)}`;
  const typed=eoaApprovalTypedData(a);
  return{kind:"review",reviewId,approval:wire(a),typedData:wire({...typed,primaryType:"Leg",
    types:{...typed.types,EIP712Domain:[{name:"name",type:"string"},{name:"version",type:"string"},{name:"chainId",type:"uint256"}]},message:typed.value,value:undefined}),
    transaction:{type:"0x2",chainId:hex(a.chainId),from:a.wallet,to:a.router,data:a.calldata,value:hex(a.value),nonce:hex(a.transactionNonce),
      gas:hex(a.maxGasLimit),maxFeePerGas:hex(a.maxFeePerGas),maxPriorityFeePerGas:"0x0"}};
}
/** HTTP application seam; evidence, configuration, policy and transaction templates are server-owned. */
export class ExecutionApplication {
  constructor(private readonly pool:Pool,private readonly sessions:SessionStore,
    private readonly executor:ProductionEoaExecutor|null,private readonly broadcastEnabled=false){}
  async read(token:string,now:Date,portfolioId:string):Promise<ExecutionRecordView>{return applicationTransaction(this.pool,async client=>{
    const session=await this.sessions.authenticate(token,now,client);
    const portfolio=await client.query("SELECT 1 FROM portfolios WHERE id=$1 AND owner_wallet=$2",[portfolioId,session.wallet]);
    requireInput(portfolio.rowCount===1,"PORTFOLIO_UNAVAILABLE","Owned portfolio required.");
    const plans=await client.query<{id:string;status:string;body:{result:{legs:{instrumentId:string;side:string;amount:{units:string;decimals:number}}[]}}}>(`SELECT p.id,p.status,d.body FROM plans p
      JOIN coordination_occurrences c ON c.plan_id=p.id AND c.portfolio_id=p.portfolio_id
      JOIN decision_records d ON d.id=c.decision_record_id AND d.portfolio_id=p.portfolio_id
      WHERE p.portfolio_id=$1 ORDER BY p.created_at DESC,p.id LIMIT 50`,[portfolioId]);
    const reviews=await client.query<{id:string;plan_id:string;leg_index:number;expires_at:Date;tx_hash:string|null;state:string|null;reconciled_at:Date|null}>(`SELECT r.id,r.plan_id,r.leg_index,r.expires_at,r.tx_hash,l.state,l.reconciled_at
      FROM eoa_execution_reviews r LEFT JOIN eoa_execution_legs l ON l.tx_hash=r.tx_hash
      WHERE r.portfolio_id=$1 ORDER BY (r.tx_hash IS NOT NULL) DESC,r.created_at DESC,r.id DESC`,[portfolioId]);
    return{configured:this.executor!==null,broadcastEnabled:this.executor!==null&&this.broadcastEnabled,
      legs:plans.rows.flatMap(p=>p.body.result.legs.map((leg,index)=>{
        const r=reviews.rows.find(r=>r.plan_id===p.id&&r.leg_index===index);
        return{planId:p.id,legIndex:index,instrumentId:leg.instrumentId,side:leg.side,inputUnits:leg.amount.units,decimals:leg.amount.decimals,
          ...(r?.state==='reorged'&&r.reconciled_at?{reanchorAvailable:true}:{}),
          status:p.status,reviewId:r?.id??null,expiresAt:r?.expires_at.toISOString()??null,transactionHash:r?.tx_hash??null,transactionState:r?.state??null};
      }))};
  });}
  async command(token:string,now:Date,input:unknown){
    const kind=(input as Record<string,unknown>|null)?.kind;
    const fields=kind==="prepare"?["kind","planId","legIndex"]:kind==="persist"?["kind","reviewId","ownerSignature","rawSignedTransaction"]
      :kind==="broadcast"?["kind","reviewId"]:[];
    requireInput(fields.length>0,"INVALID_COMMAND","Unknown execution command.");const c=command(input,fields);
    // Authenticate even unavailable deployments; config errors must not reveal owned records.
    await this.sessions.authenticate(token,now);
    requireInput(this.executor!==null,"EXECUTION_UNCONFIGURED","Trade review is unavailable until trusted execution sources are configured.");
    if(kind==="prepare"){
      requireInput(typeof c.planId==="string"&&Number.isSafeInteger(c.legIndex)&&Number(c.legIndex)>=0,"INVALID_COMMAND","Stored plan and leg index required.");
      const r=await this.executor.prepare({sessionToken:token,planId:c.planId,legIndex:Number(c.legIndex)});
      return r.kind==="review"?{...executionReviewView(r.reviewId,r.approval),...(r.pilotAdmission?{pilotAdmission:r.pilotAdmission}:{})}:r;
    }
    requireInput(typeof c.reviewId==="string","INVALID_COMMAND","Server review ID required.");
    if(kind==="broadcast")return this.executor.broadcast({sessionToken:token,reviewId:c.reviewId});
    requireInput(typeof c.ownerSignature==="string"&&/^0x[0-9a-fA-F]{130}$/.test(c.ownerSignature)
      &&typeof c.rawSignedTransaction==="string"&&/^0x02(?:[0-9a-fA-F]{2})+$/.test(c.rawSignedTransaction)
      &&c.rawSignedTransaction.length<=8192,"INVALID_COMMAND","Exact typed signature and bounded raw type-2 transaction required.");
    return this.executor.persist({sessionToken:token,reviewId:c.reviewId,ownerSignature:c.ownerSignature,rawSignedTransaction:c.rawSignedTransaction});
  }
}
