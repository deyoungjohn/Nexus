import { randomUUID } from "node:crypto";
import { verifyTypedData } from "ethers";
import type { Pool, PoolClient } from "pg";
import { requireInput, identifier } from "../domain/errors.js";
import { nativeAssetId, type Amount } from "../domain/amount.js";
import { BSTOCKS_BSC_NVDAB } from "../market-gate/bstocks-bsc.js";
import { BSC_USDT_ASSET } from "../market-gate/chainlink-bsc.js";
import { securityDigest } from "../security/token-security.js";
import { fetchBscTrackedBalances } from "./bsc-balances.js";
import { verifyBscRecoveryContracts } from "./recovery-contracts.js";
import { parseRecoveryConfig, recoveryConfigurationRecord, type RecoveryConfig } from "./recovery-config.js";
import { executionJson } from "./execution-json.js";
import type { ExecutionSessions } from "./production.js";

export interface FinalizedChainSnapshot {
  readonly sourceBlock: bigint;
  readonly sourceBlockHash: string;
  readonly transactionNonce: bigint;
  readonly balances: readonly Amount[];
}
export interface ChainSnapshotReader {
  read(wallet: string, pinned?: { sourceBlock: bigint; sourceBlockHash: string }): Promise<FinalizedChainSnapshot | null>;
}
const qty = (x: unknown): bigint | null => typeof x === "string" && /^0x(?:0|[1-9a-f][0-9a-f]*)$/i.test(x) ? BigInt(x) : null;
const hash = (x: unknown): x is string => typeof x === "string" && /^0x[0-9a-f]{64}$/i.test(x);
const assets = [nativeAssetId(56), BSC_USDT_ASSET, `eip155:56/erc20:${BSTOCKS_BSC_NVDAB}`];
const balanceDigest = (b: readonly Amount[]) => securityDigest([...b].sort((a,b) => a.assetId.localeCompare(b.assetId)));

/** A complete single-source read. A new head is checked against the finalized snapshot too. */
export function createBscSnapshotReader(rawConfig: RecoveryConfig, fetcher: typeof fetch = fetch): ChainSnapshotReader {
  const config = parseRecoveryConfig(rawConfig);
  const tracked = config.assets.filter(a => assets.includes(a.assetId));
  requireInput(tracked.length === 3 && tracked.every(a => a.decimals === 18),
    "INVALID_BOOTSTRAP_CONFIG", "Reviewed BNB/USDT/NVDAB registry required.");
  return { async read(wallet, pinned) {
    if (!/^0x[0-9a-f]{40}$/i.test(wallet)) return null;
    for (const source of config.sources) {
      try {
        let id = 0;
        const rpc = async (method: string, params: unknown[]) => {
          const requestId = ++id;
          const r = await fetcher(source.rpcUrl, { method: "POST", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ jsonrpc: "2.0", id: requestId, method, params }), signal: AbortSignal.timeout(5000) });
          const body = await r.json() as Record<string,unknown>;
          if (!r.ok || body.id !== requestId || body.error || !Object.hasOwn(body,"result")) throw Error("RPC unavailable");
          return body.result;
        };
        if (await rpc("eth_chainId",[]) !== "0x38") continue;
        const head = qty(await rpc("eth_blockNumber",[]));
        const depth = BigInt(config.finalityBlocks);
        if (head === null || head + 1n < depth) continue;
        const number = pinned?.sourceBlock ?? head - depth + 1n;
        if (number < 0n || number > head - depth + 1n) continue;
        const tag = `0x${number.toString(16)}`;
        const block = await rpc("eth_getBlockByNumber",[tag,false]) as Record<string,unknown> | null;
        if (!block || qty(block.number) !== number || !hash(block.hash)
          || (pinned && block.hash.toLowerCase() !== pinned.sourceBlockHash.toLowerCase())) continue;
        const guard = await verifyBscRecoveryContracts({ rpcUrl: source.rpcUrl, blockNumber: number,
          blockHash: block.hash, assets: tracked }, fetcher);
        if (guard !== true) continue;
        const snapshot = await fetchBscTrackedBalances({ rpcUrl: source.rpcUrl,wallet,blockNumber:number,
          blockHash:block.hash,assets:tracked },fetcher);
        const nonce = qty(await rpc("eth_getTransactionCount",[wallet,tag]));
        const currentNonce = qty(await rpc("eth_getTransactionCount",[wallet,"latest"]));
        const pendingNonce = qty(await rpc("eth_getTransactionCount",[wallet,"pending"]));
        const headTag = `0x${head.toString(16)}`;
        const currentBlock = await rpc("eth_getBlockByNumber",[headTag,false]) as Record<string,unknown> | null;
        if (!snapshot || nonce === null || nonce !== currentNonce || nonce !== pendingNonce
          || !currentBlock || qty(currentBlock.number) !== head || !hash(currentBlock.hash)
          || await rpc("eth_getCode",[wallet,tag]) !== "0x"
          || await rpc("eth_getCode",[wallet,headTag]) !== "0x") continue;
        const current = await fetchBscTrackedBalances({ rpcUrl: source.rpcUrl,wallet,blockNumber:head,
          blockHash:currentBlock.hash,assets:tracked },fetcher);
        const finalBlock = await rpc("eth_getBlockByNumber",[tag,false]) as Record<string,unknown> | null;
        if (!current || balanceDigest(snapshot.balances) !== balanceDigest(current.balances)
          || finalBlock?.hash !== block.hash) continue;
        return { sourceBlock:number, sourceBlockHash:block.hash.toLowerCase(),transactionNonce:nonce,balances:snapshot.balances };
      } catch { /* Try a complete read on the next configured source. */ }
    }
    return null;
  } };
}

interface SnapshotRow {
  id:string;portfolio_id:string;wallet:string;expected_revision:string;kind:"bootstrap"|"resync";reason:string;
  evidence_hash:string;configuration_hash:string;source_block:string;source_block_hash:string;tx_nonce:string;
  body:{ balances: { assetId:string;decimals:number;units:string }[] };expires_at:Date;activated_revision:string|null;
}
export function chainSnapshotTypedData(row: { id:string;portfolioId:string;wallet:string;expectedRevision:bigint;
  evidenceHash:string;configurationHash:string;expiresAt:string }) {
  return { domain:{ name:"Nexus chain snapshot",version:"1",chainId:56 }, types:{ ChainSnapshot:[
    {name:"reviewId",type:"string"},{name:"portfolioId",type:"string"},{name:"wallet",type:"address"},
    {name:"expectedRevision",type:"uint256"},{name:"evidenceHash",type:"bytes32"},
    {name:"configurationHash",type:"bytes32"},{name:"expiresAt",type:"uint256"}
  ] },value:{ reviewId:row.id,portfolioId:row.portfolioId,wallet:row.wallet,expectedRevision:row.expectedRevision,
    evidenceHash:`0x${row.evidenceHash}`,configurationHash:`0x${row.configurationHash}`,expiresAt:BigInt(Date.parse(row.expiresAt)) } };
}

/** Server-owned review + owner signature. Neither bootstrap nor resync lifts the pause. */
export class ChainBootstrapService {
  private readonly configurationHash:string;
  constructor(private readonly pool:Pool,private readonly sessions:ExecutionSessions,
    config:RecoveryConfig,private readonly reader:ChainSnapshotReader,private readonly clock:()=>Date=()=>new Date()) {
    this.configurationHash = recoveryConfigurationRecord(parseRecoveryConfig(config)).hash;
  }
  private async transaction<T>(run:(client:PoolClient)=>Promise<T>):Promise<T> {
    const c=await this.pool.connect();
    try { await c.query("BEGIN");try{const r=await run(c);await c.query("COMMIT");return r;}
      catch(e){await c.query("ROLLBACK");throw e;} }finally{c.release();}
  }
  private async owned(c:PoolClient,token:string,portfolioId:string) {
    identifier(portfolioId);
    const session=await this.sessions.authenticate(token,this.clock(),c);
    await c.query("SELECT pg_advisory_xact_lock(hashtextextended(current_schema() || $1, 0))",[`nexus-eoa-recovery:${portfolioId}`]);
    const r=await c.query<{revision:string;data_mode:string;execution_paused:boolean;owner_wallet:string}>(
      "SELECT revision,data_mode,execution_paused,owner_wallet FROM portfolios WHERE id=$1 AND owner_wallet=$2 AND chain_id=56 FOR UPDATE",
      [portfolioId,session.wallet.toLowerCase()]);
    requireInput(r.rows[0]!==undefined,"PORTFOLIO_UNAVAILABLE","Owned BSC portfolio required.");
    requireInput(r.rows[0].execution_paused,"PORTFOLIO_NOT_PAUSED","Pause before acknowledging a chain snapshot.");
    const pending=await c.query(`SELECT 1 FROM eoa_execution_legs WHERE portfolio_id=$1
      AND (reconciled_at IS NULL OR state IN ('reorged','replaced')) UNION ALL
      SELECT 1 FROM reservations WHERE portfolio_id=$1 AND state='submitted' LIMIT 1`,[portfolioId]);
    requireInput(pending.rowCount===0,"UNRESOLVED_SUBMISSION","Reconcile submitted/signed or disputed legs before resync.");
    return r.rows[0];
  }
  async prepare(input:{sessionToken:string;portfolioId:string;kind:"bootstrap"|"resync";reason:string}) {
    requireInput(["bootstrap","resync"].includes(input.kind) && typeof input.reason==="string"
      && input.reason.trim().length>=8 && input.reason.length<=1000,"INVALID_DIAGNOSIS","A concise operator diagnosis is required.");
    const owner=await this.transaction(c=>this.owned(c,input.sessionToken,input.portfolioId));
    requireInput(input.kind==="bootstrap"?owner.data_mode==="unverified":owner.data_mode==="chain",
      "INVALID_SNAPSHOT_KIND","Bootstrap initializes unverified data; resync revises chain data.");
    const snapshot=await this.reader.read(owner.owner_wallet);
    requireInput(snapshot!==null,"CHAIN_SNAPSHOT_UNAVAILABLE","Finalized complete unchanged EOA snapshot required.");
    requireInput(snapshot.balances.length===3 && new Set(snapshot.balances.map(b=>b.assetId)).size===3
      && snapshot.balances.every(b=>assets.includes(b.assetId)&&b.decimals===18&&b.units>=0n)
      && snapshot.sourceBlock>=0n&&hash(snapshot.sourceBlockHash)&&snapshot.transactionNonce>=0n,
    "INVALID_CHAIN_SNAPSHOT","Exact pilot assets and canonical identity required.");
    const id=randomUUID(),expiresAt=new Date(this.clock().getTime()+300_000).toISOString();
    const evidenceHash=securityDigest({kind:input.kind,reason:input.reason,...snapshot});
    const review={id,portfolioId:input.portfolioId,wallet:owner.owner_wallet,expectedRevision:BigInt(owner.revision),
      evidenceHash,configurationHash:this.configurationHash,expiresAt};
    await this.transaction(async c=>{
      const current=await this.owned(c,input.sessionToken,input.portfolioId);
      requireInput(current.revision===owner.revision,"STALE_REVISION","Portfolio changed during collection.");
      await c.query(`INSERT INTO chain_snapshot_reviews(id,portfolio_id,wallet,expected_revision,kind,reason,evidence_hash,
        configuration_hash,source_block,source_block_hash,tx_nonce,body,expires_at)
        VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12::jsonb,$13)`,
      [id,input.portfolioId,owner.owner_wallet,owner.revision,input.kind,input.reason,evidenceHash,this.configurationHash,
        snapshot.sourceBlock.toString(),snapshot.sourceBlockHash,snapshot.transactionNonce.toString(),executionJson(snapshot),expiresAt]);
    });
    return {reviewId:id,snapshot,reason:input.reason,kind:input.kind,expiresAt,typedData:chainSnapshotTypedData(review)};
  }
  async activate(input:{sessionToken:string;reviewId:string;ownerSignature:string}) {
    identifier(input.reviewId);
    const saved=await this.pool.query<SnapshotRow>("SELECT * FROM chain_snapshot_reviews WHERE id=$1",[input.reviewId]);
    const row=saved.rows[0];requireInput(row!==undefined,"REVIEW_UNAVAILABLE","Stored chain review required.");
    const typed=chainSnapshotTypedData({id:row.id,portfolioId:row.portfolio_id,wallet:row.wallet,expectedRevision:BigInt(row.expected_revision),
      evidenceHash:row.evidence_hash,configurationHash:row.configuration_hash,expiresAt:row.expires_at.toISOString()});
    let signer="";try{signer=verifyTypedData(typed.domain,typed.types,typed.value,input.ownerSignature).toLowerCase();}catch{/* blocked */}
    requireInput(signer===row.wallet,"INVALID_SIGNATURE","Owner must sign the exact stored snapshot.");
    // Authenticate even on replay; an id is not an access token.
    if(row.activated_revision!==null)return this.transaction(async c=>{
      const s=await this.sessions.authenticate(input.sessionToken,this.clock(),c);
      requireInput(s.wallet.toLowerCase()===row.wallet,"PORTFOLIO_UNAVAILABLE","Owned review required.");
      return {revision:BigInt(row.activated_revision!),replay:true};
    });
    requireInput(row.configuration_hash===this.configurationHash&&row.expires_at>this.clock(),
      "SNAPSHOT_EXPIRED","Snapshot/configuration review expired or changed.");
    const snapshot=await this.reader.read(row.wallet,{sourceBlock:BigInt(row.source_block),sourceBlockHash:row.source_block_hash});
    requireInput(snapshot!==null&&snapshot.sourceBlock===BigInt(row.source_block)&&snapshot.sourceBlockHash===row.source_block_hash
      &&snapshot.transactionNonce===BigInt(row.tx_nonce)
      &&securityDigest({kind:row.kind,reason:row.reason,...snapshot})===row.evidence_hash
      &&balanceDigest(snapshot.balances)===balanceDigest(row.body.balances.map(b=>({...b,units:BigInt(b.units)}))),
    "CHAIN_STATE_CHANGED","Canonical balances or nonce changed since review.");
    return this.transaction(async c=>{
      const owner=await this.owned(c,input.sessionToken,row.portfolio_id);
      const locked=await c.query<SnapshotRow>("SELECT * FROM chain_snapshot_reviews WHERE id=$1 FOR UPDATE",[row.id]);
      if(locked.rows[0]!.activated_revision!==null)return{revision:BigInt(locked.rows[0]!.activated_revision!),replay:true};
      requireInput(owner.revision===row.expected_revision&&row.expires_at>this.clock(),"STALE_REVISION","Chain review is no longer current.");
      const next=BigInt(owner.revision)+1n;
      await c.query("UPDATE reservations SET state='released',lease_until=NULL WHERE portfolio_id=$1 AND state='held'",[row.portfolio_id]);
      await c.query("UPDATE plans SET status='stale' WHERE portfolio_id=$1 AND status IN ('reserved','executing')",[row.portfolio_id]);
      await c.query("DELETE FROM balances WHERE portfolio_id=$1",[row.portfolio_id]);
      for(const b of snapshot.balances)await c.query("INSERT INTO balances(portfolio_id,asset_id,decimals,confirmed_units) VALUES($1,$2,$3,$4)",
        [row.portfolio_id,b.assetId,b.decimals,b.units.toString()]);
      await c.query("INSERT INTO portfolio_revisions(portfolio_id,revision,reason) VALUES($1,$2,$3)",
        [row.portfolio_id,next.toString(),`chain-${row.kind}:${row.id}`]);
      await c.query("UPDATE portfolios SET revision=$2,data_mode='chain' WHERE id=$1",[row.portfolio_id,next.toString()]);
      await c.query("UPDATE chain_snapshot_reviews SET owner_signature=$2,activated_revision=$3 WHERE id=$1",
        [row.id,input.ownerSignature,next.toString()]);
      await c.query("INSERT INTO decision_records(id,portfolio_id,revision,kind,body) VALUES($1,$2,$3,'chain-snapshot',$4::jsonb)",
        [`chain-${row.id}`,row.portfolio_id,next.toString(),executionJson({reviewId:row.id,kind:row.kind,reason:row.reason,
          evidenceHash:row.evidence_hash,configurationHash:row.configuration_hash,...snapshot})]);
      return{revision:next,replay:false};
    });
  }
}
