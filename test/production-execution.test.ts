import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import { Pool } from "pg";
import { Wallet, id } from "ethers";
import { CoordinatorStore } from "../src/coordinator/store.js";
import { Ledger } from "../src/ledger/ledger.js";
import { migrate } from "../src/ledger/migrate.js";
import { EoaExecutionStore } from "../src/execution/store.js";
import { runBscRecoveryOnce } from "../src/execution/recovery-worker.js";
import { parseRecoveryConfig } from "../src/execution/recovery-config.js";
import { SessionStore } from "../src/application/session.js";
import { ProductionEoaExecutor, type ExecutionDeployment } from "../src/execution/production.js";
import { revalidateExecutionMarket } from "../src/execution/market-revalidation.js";
import { createBStocksExecutionRuntime } from "../src/execution/bstocks-runtime.js";
import { createBscExecutionChain, type ExecutionChainPort } from "../src/execution/bsc-execution-chain.js";
import { decodeExecutionJson, executionJson } from "../src/execution/execution-json.js";
import { eoaApprovalTypedData, type EoaLegApproval } from "../src/execution/eoa.js";
import { evaluateMarketGate } from "../src/market-gate/gate.js";
import { createBStocksProductionCollector, type ExecutionMarketCollector } from "../src/market-gate/bstocks-production.js";
import { collectorMock } from "./security-collector-fixture.js";
import { productionFixture, refreshFixtureEvidence } from "./production-execution-fixture.js";

const databaseUrl=process.env.TEST_DATABASE_URL;
const pgOptions={skip:!databaseUrl&&"Set TEST_DATABASE_URL for real PostgreSQL integration tests."};
const originalNow="2026-09-28T14:00:00.000Z";

test("P7 market refresh preserves the signed hash only inside original leases and unchanged facts",()=>{
  const base=productionFixture("0x1111111111111111111111111111111111111111");
  assert.equal(evaluateMarketGate(base).allowed,true);
  const now="2026-09-28T14:00:01.000Z",e=refreshFixtureEvidence(base.evidence,now);
  const refreshed=revalidateExecutionMarket(base,e,now);
  assert.equal(refreshed.evidence,base.evidence);
  assert.deepEqual(evaluateMarketGate(refreshed),evaluateMarketGate({...base,now}));
  for(const patch of [
    {reference:{...e.reference!,pricePerShare:e.reference!.pricePerShare+1n}},
    {reference:{...e.reference!,sourceAt:"2026-09-28T13:59:29.000Z"}},
    {eligibility:{...e.eligibility!,accessControl:{...e.eligibility!.accessControl!,authorizationHash:"f".repeat(64)}}},
    {providerEvent:{...e.providerEvent!,revision:"2"}},
    {simulation:{...e.simulation!,outputRaw:base.evidence.quote!.expectedOutputRaw*102n/100n}},
    {simulation:{...e.simulation!,outputRaw:base.evidence.quote!.minimumOutputRaw}}
  ]) assert.throws(()=>revalidateExecutionMarket(base,{...e,...patch},now));
  assert.throws(()=>revalidateExecutionMarket(base,refreshFixtureEvidence(base.evidence,"2026-09-28T14:03:00.000Z"),"2026-09-28T14:03:00.000Z"));
  assert.throws(()=>revalidateExecutionMarket(base,{...e,tokenSecurity:null},now));
  const old={...base,evidence:{...base.evidence,eligibility:{...base.evidence.eligibility!,accessControl:{...base.evidence.eligibility!.accessControl!}}}};
  delete (old.evidence.eligibility.accessControl as {authorizationHash?:string}).authorizationHash;
  assert.throws(()=>revalidateExecutionMarket(old,e,now),{code:"ACCESS_REVISION_MISSING"});
});

test("P7 durable execution codec preserves raw bigints and string event/review revisions",()=>{
  const base=productionFixture("0x1111111111111111111111111111111111111111");
  const revived=decodeExecutionJson(JSON.parse(executionJson(base)));
  assert.deepEqual(revived,base);
  assert.throws(()=>decodeExecutionJson({units:"1e18"}),{code:"INVALID_EXECUTION_RECORD"});
  assert.throws(()=>decodeExecutionJson({units:"1".repeat(79)}),{code:"INVALID_EXECUTION_RECORD"});
});

test("P5.5 production assembly keeps missing economic/access/event review blocked and pins security to quantity",async()=>{
  const base=productionFixture("0x1111111111111111111111111111111111111111");
  const mock=collectorMock();const requests:Array<{method:string;params:unknown[]}>=[];
  const now=new Date().toISOString();
  const fetcher=(async(url,init)=>{
    const body=init?.body?JSON.parse(String(init.body)):null;
    const response=await mock.fetcher(url,init);
    if(body?.jsonrpc){requests.push(body);
      if(body.method==="eth_getBlockByNumber"){
        const data=await response.json() as {result:Record<string,unknown>};
        data.result.timestamp=`0x${Math.floor(Date.parse(now)/1000).toString(16)}`;
        return new Response(JSON.stringify(data));
      }
    }
    return response;
  }) as typeof fetch;
  let mappingBlock:bigint|undefined;
  const collector=createBStocksProductionCollector({rpcUrl:"https://fixture.invalid",securityReviews:[],
    settlementMaxAgeMs:60_000,settlementUncertaintyBps:0,settlementMaxPegDeviationBps:100},{
    accessPolicy:null,reviewedControl:null,access:{async session(){throw Error("Unconfigured");},async jurisdiction(){return null;},
      async country(){return null;},async product(){return null;}},
    async economicQuantity(_context,snapshot){mappingBlock=snapshot.sourceBlock;return null;},
    async portfolioValuations(){return [];},async event(){return null;},async providerEvent(){return null;},
    async quote(){return null;},async simulation(){throw Error("No quote must mean no simulation");}
  },fetcher);
  const evidence=await collector.collect({...base,now,sessionId:"synthetic-session"});
  assert.equal(mappingBlock,256n);assert.equal(evidence.quantity,null);assert.equal(evidence.eligibility,null);
  assert.equal(evidence.event,null);assert.equal(evidence.simulation,null);
  assert.equal(evaluateMarketGate({...base,now,evidence}).allowed,false);
  assert.ok(requests.filter(r=>r.method==="eth_getBlockByNumber").every(r=>r.params[0]==="0x100"));
  assert.ok(requests.every(r=>r.method!=="eth_sendRawTransaction"));
});

async function withPortfolio(run:(value:Awaited<ReturnType<typeof seed>>)=>Promise<void>){
  const admin=new Pool({connectionString:databaseUrl});
  const schema=`nexus_exec_${randomUUID().replaceAll("-","")}`;await admin.query(`CREATE SCHEMA ${schema}`);
  const pool=new Pool({connectionString:databaseUrl,options:`-c search_path=${schema}`,max:5});
  try{await migrate(pool);await migrate(pool);await run(await seed(pool));}
  finally{await pool.end();await admin.query(`DROP SCHEMA ${schema} CASCADE`);await admin.end();}
}
async function seed(pool:Pool){
  const owner=Wallet.createRandom();const base=productionFixture(owner.address);
  const sessions=new SessionStore(pool,"https://nexus.example");let now=new Date(originalNow);
  const challenge=await sessions.challenge(owner.address,now);
  const session=await sessions.verify(challenge.id,await owner.signMessage(challenge.message),now);
  const ledger=new Ledger(pool),store=new EoaExecutionStore(pool),coordinator=new CoordinatorStore(pool);
  await ledger.createPortfolio({id:"portfolio",chainId:56,settlement:base.snapshot.confirmedCash,
    balances:[base.snapshot.confirmedCash,base.snapshot.nativeGas,...base.snapshot.positions.map(p=>p.raw)]});
  await store.bindOwnerWallet("portfolio",owner.address,0n);
  await coordinator.registerInstrument(base.instrument);
  await coordinator.activatePolicy({portfolioId:"portfolio",expectedRevision:1n,policyId:"policy",version:1,policy:base.coordinatorPolicy});
  await store.setPaused("portfolio",2n,false);
  // Deliberately synthetic chain mode in an isolated test schema, never production evidence.
  await pool.query("UPDATE portfolios SET data_mode='chain' WHERE id='portfolio'");
  await coordinator.coordinateAndReserve({portfolioId:"portfolio",expectedRevision:3n,planId:"plan",occurrenceId:"occurrence",
    idempotencyKey:"request",leaseUntil:new Date(Date.now()+180_000),snapshot:{...base.snapshot,revision:3n},proposals:[base.proposal]});
  const deployment:ExecutionDeployment={version:"synthetic-1",broadcastEnabled:true,recoveryConfigurationHash:"b".repeat(64),marketPolicy:base.marketPolicy,
    mappingRevisions:{[base.instrument.instrumentId]:"map-1"},maxGasLimit:300_000n,maxFeePerGas:5_000_000_000n,approvalLifetimeMs:60_000};
  let change:(e:typeof base.evidence)=>typeof base.evidence=e=>e;
  let onCollect:(()=>Promise<void>)|undefined;let sends=0;let timeout=false;let nonce=7;let balanceDelta=0n;
  const market:ExecutionMarketCollector={async collect(_context,exact){
    await onCollect?.();const refreshed=refreshFixtureEvidence(base.evidence,now.toISOString(),102n);
    return change({...refreshed,quote:exact??base.evidence.quote});
  }};
  const chain:ExecutionChainPort={async state(wallet,assets){return{chainId:56,wallet:wallet.toLowerCase(),nonce,
    blockNumber:103n,blockHash:`0x${"a".repeat(64)}`,balances:assets.map(asset=>{
      const b=[base.snapshot.confirmedCash,base.snapshot.nativeGas,...base.snapshot.positions.map(p=>p.raw)].find(b=>b.assetId===asset.assetId)!;
      return{...b,units:b.units+(b.assetId===base.snapshot.confirmedCash.assetId?balanceDelta:0n)};
    })};},async send(claim){sends++;const rows=await pool.query("SELECT state,signed_transaction,tx_hash FROM eoa_execution_legs WHERE id=$1",[reviewId]);
    assert.equal(rows.rows[0]?.state,"unknown");assert.equal(rows.rows[0]?.signed_transaction,claim.rawSignedTransaction);
    assert.equal(rows.rows[0]?.tx_hash,claim.hash);if(timeout)throw Error("Simulated send timeout/crash");return"accepted";}};
  const executor=(override:Partial<ExecutionDeployment>={})=>new ProductionEoaExecutor(pool,sessions,{...deployment,...override},market,chain,()=>now);
  let reviewId="";
  async function review(){const result=await executor().prepare({sessionToken:session.token,planId:"plan",legIndex:0});
    assert.ok(result.kind==="review");reviewId=result.reviewId;return result;}
  async function signatures(approval:EoaLegApproval){const typed=eoaApprovalTypedData(approval);
    return{ownerSignature:await owner.signTypedData(typed.domain,typed.types,typed.value),
      rawSignedTransaction:await owner.signTransaction({type:2,chainId:56,nonce:approval.transactionNonce,
        to:approval.router,data:approval.calldata,value:0n,gasLimit:250_000n,maxFeePerGas:4_000_000_000n,maxPriorityFeePerGas:1_000_000_000n})};}
  return{pool,owner,base,sessions,session,store,executor,review,signatures,change:(fn:typeof change)=>{change=fn;},
    onCollect:(fn:typeof onCollect)=>{onCollect=fn;},setNow:(value:string)=>{now=new Date(value);},
    setTimeout:(value:boolean)=>{timeout=value;},setNonce:(value:number)=>{nonce=value;},setBalanceDelta:(value:bigint)=>{balanceDelta=value;},
    sendCount:()=>sends};
}

test("P7 PostgreSQL server review to refreshed signature persistence and once-only guarded send",pgOptions,async()=>withPortfolio(async s=>{
  const r=await s.review(),signed=await s.signatures(r.approval);
  assert.equal(r.approval.portfolioRevision,3n);assert.equal(r.approval.inputRaw,5n*10n**18n);
  assert.equal((await s.pool.query("SELECT state FROM reservations WHERE id='plan-0'")).rows[0].state,"held");
  s.setNow("2026-09-28T14:00:01.000Z");
  assert.equal((await s.executor().persist({sessionToken:s.session.token,reviewId:r.reviewId,...signed})).replay,false);
  assert.equal((await s.executor().persist({sessionToken:s.session.token,reviewId:r.reviewId,...signed})).replay,true);
  assert.equal(s.sendCount(),0);
  const results=await Promise.all([s.executor().broadcast({sessionToken:s.session.token,reviewId:r.reviewId}),
    s.executor().broadcast({sessionToken:s.session.token,reviewId:r.reviewId})]);
  assert.deepEqual(results.map(r=>r.outcome).sort(),["accepted","already-claimed"]);assert.equal(s.sendCount(),1);
  assert.equal((await s.executor().broadcast({sessionToken:s.session.token,reviewId:r.reviewId})).outcome,"already-claimed");
  assert.equal((await s.pool.query("SELECT state FROM reservations WHERE id='plan-0'")).rows[0].state,"submitted");
  assert.equal((await s.pool.query("SELECT outcome FROM eoa_broadcast_results")).rows[0].outcome,"accepted");
}));

test("P7 PostgreSQL missing production security never creates an executable review",pgOptions,async()=>withPortfolio(async s=>{
  s.change(e=>({...e,tokenSecurity:null}));
  const result=await s.executor().prepare({sessionToken:s.session.token,planId:"plan",legIndex:0});
  assert.equal(result.kind,"blocked");assert.equal((await s.pool.query("SELECT count(*) FROM eoa_execution_reviews")).rows[0].count,"0");
  assert.equal(s.sendCount(),0);
}));

test("P7 PostgreSQL session/owner, policy, pause and registry changes cannot cross persistence",pgOptions,async()=>{
  for(const mutate of [
    async(s:Awaited<ReturnType<typeof seed>>)=>s.sessions.logout(s.session.token,new Date(originalNow)),
    async(s:Awaited<ReturnType<typeof seed>>)=>s.store.setPaused("portfolio",3n,true),
    async(s:Awaited<ReturnType<typeof seed>>)=>s.pool.query("UPDATE policies SET body=jsonb_set(body,'{companyCapsBps}', '{\"NVDA\":1}') WHERE id='policy'"),
    async(s:Awaited<ReturnType<typeof seed>>)=>s.pool.query("UPDATE instruments SET body=jsonb_set(body,'{classificationVersion}', '\"changed\"')")
  ])await withPortfolio(async s=>{const r=await s.review(),signed=await s.signatures(r.approval);await mutate(s);
    await assert.rejects(s.executor().persist({sessionToken:s.session.token,reviewId:r.reviewId,...signed}));
    assert.equal((await s.pool.query("SELECT count(*) FROM eoa_execution_legs")).rows[0].count,"0");assert.equal(s.sendCount(),0);
  });
});

test("P7 PostgreSQL late revocation/policy change during evidence collection rolls back signed bytes",pgOptions,async()=>{
  for(const policy of [false,true])await withPortfolio(async s=>{
    const r=await s.review(),signed=await s.signatures(r.approval);
    s.onCollect(async()=>{if(policy)await s.pool.query("UPDATE policies SET body=jsonb_set(body,'{companyCapsBps}', '{\"NVDA\":1}') WHERE id='policy'");
      else await s.sessions.logout(s.session.token,new Date(originalNow));});
    await assert.rejects(s.executor().persist({sessionToken:s.session.token,reviewId:r.reviewId,...signed}));
    assert.equal((await s.pool.query("SELECT count(*) FROM eoa_execution_legs")).rows[0].count,"0");assert.equal(s.sendCount(),0);
  });
});

test("P7 PostgreSQL external EOA nonce/balances and expired review block signed persistence",pgOptions,async()=>{
  for(const kind of ["nonce","balances","expiry"])await withPortfolio(async s=>{
    const r=await s.review(),signed=await s.signatures(r.approval);
    if(kind==="nonce")s.setNonce(8);else if(kind==="balances")s.setBalanceDelta(1n);else s.setNow("2026-09-28T14:01:00.000Z");
    await assert.rejects(s.executor().persist({sessionToken:s.session.token,reviewId:r.reviewId,...signed}));assert.equal(s.sendCount(),0);
  });
});

test("P7 PostgreSQL earliest source expiry and stored-request integrity bind the owner review",pgOptions,async()=>{
  await withPortfolio(async s=>{
    s.change(e=>({...e,tokenStatus:{...e.tokenStatus!,expiresAt:"2026-09-28T14:00:10.000Z"}}));
    const r=await s.review();assert.equal(r.approval.expiresAt,"2026-09-28T14:00:10.000Z");
    const signed=await s.signatures(r.approval);
    await s.pool.query("UPDATE eoa_execution_reviews SET request=jsonb_set(request,'{snapshot,confirmedCash,units}', '\"100000000000000000001\"') WHERE id=$1",[r.reviewId]);
    await assert.rejects(s.executor().persist({sessionToken:s.session.token,reviewId:r.reviewId,...signed}),{code:"INVALID_EXECUTION_RECORD"});
    assert.equal(s.sendCount(),0);
  });
});

test("P7 PostgreSQL guarded service send reconciles one receipt with effects and never double-counts",pgOptions,async()=>withPortfolio(async s=>{
  const r=await s.review(),signed=await s.signatures(r.approval);
  const persisted=await s.executor().persist({sessionToken:s.session.token,reviewId:r.reviewId,...signed});
  await s.executor().broadcast({sessionToken:s.session.token,reviewId:r.reviewId});
  const blockHash=`0x${"b".repeat(64)}`,gasUsed=210_000n,gasPrice=3_000_000_000n;
  const output=s.base.evidence.quote!.expectedOutputRaw;
  const after=[{...s.base.snapshot.confirmedCash,units:s.base.snapshot.confirmedCash.units-r.approval.inputRaw},
    {...s.base.snapshot.nativeGas,units:s.base.snapshot.nativeGas.units-gasUsed*gasPrice},
    {...s.base.snapshot.positions[0]!.raw,units:output}];
  const topic=(a:string)=>`0x${a.slice(2).toLowerCase().padStart(64,"0")}`;
  const transfer=(token:string,from:string,to:string,units:bigint,index:number)=>({address:token,
    topics:[id("Transfer(address,address,uint256)"),topic(from),topic(to)],data:`0x${units.toString(16).padStart(64,"0")}`,
    transactionHash:persisted.hash,blockHash,blockNumber:"0x68",logIndex:`0x${index.toString(16)}`,removed:false});
  const rpc=(async(_url,init)=>{const body=JSON.parse(String(init?.body));
    const result=body.method==="eth_chainId"?"0x38":body.method==="eth_blockNumber"?"0x73"
      :body.method==="eth_getTransactionCount"?"0x8":body.method==="eth_getBlockByNumber"?{number:"0x68",hash:blockHash}
      :body.method==="eth_getTransactionReceipt"?{transactionHash:persisted.hash,from:s.owner.address,to:r.approval.router,
        blockNumber:"0x68",blockHash,status:"0x1",gasUsed:`0x${gasUsed.toString(16)}`,effectiveGasPrice:`0x${gasPrice.toString(16)}`,
        logs:[transfer(r.approval.tokenIn,s.owner.address,r.approval.router,r.approval.inputRaw,0),
          transfer(r.approval.tokenOut,r.approval.router,s.owner.address,output,1)]}
      :body.method==="eth_getTransactionByHash"?{hash:persisted.hash,from:s.owner.address,to:r.approval.router,
        value:"0x0",blockHash,blockNumber:"0x68",nonce:"0x7"}
      :body.method==="eth_getBalance"?`0x${after[1]!.units.toString(16)}`
      :body.method==="eth_call"?`0x${(body.params[0].to.toLowerCase()===r.approval.tokenIn?after[0]!:after[2]!).units.toString(16).padStart(64,"0")}`:null;
    return new Response(JSON.stringify({jsonrpc:"2.0",id:body.id,result}));
  }) as typeof fetch;
  // Current trading warnings cannot erase an already submitted receipt.
  s.change(e=>({...e,tokenSecurity:null}));
  const config=parseRecoveryConfig({version:1,registryVersion:"synthetic-execution-recovery",finalityBlocks:"12",
    sources:[{id:"fixture",rpcUrl:"https://fixture.invalid"}],
    assets:after.map(a=>({assetId:a.assetId,decimals:a.decimals,
      semantics:a.assetId==="eip155:56/native"?"native-gas":"erc20-transfer-net",review:"explicitly-synthetic-review"}))});
  const result=await runBscRecoveryOnce(s.pool,config,rpc);assert.equal(result[0]?.outcome,"reconciled");
  const again=await runBscRecoveryOnce(s.pool,config,rpc);assert.equal(again[0]?.outcome,"monitored");
  assert.equal((await s.pool.query("SELECT revision FROM portfolios WHERE id='portfolio'")).rows[0].revision,"4");
  assert.equal((await s.pool.query("SELECT state FROM reservations WHERE id='plan-0'")).rows[0].state,"consumed");
  assert.equal(s.sendCount(),1);
}));

test("P7 BSC execution state rejects pending/delegated wallets, stale headers and changed canonical state",async()=>{
  const wallet="0x1111111111111111111111111111111111111111",blockHash=`0x${"a".repeat(64)}`;
  for(const mode of ["ok","pending","delegated","reorg","wrong-chain","stale"]){let headers=0;
    const fetcher=(async(_url,init)=>{const body=JSON.parse(String(init?.body));let result:unknown;
      if(body.method==="eth_chainId")result=mode==="wrong-chain"?"0x1":"0x38";
      else if(body.method==="eth_blockNumber")result="0x100";
      else if(body.method==="eth_getBlockByNumber"){headers++;result={number:"0x100",hash:mode==="reorg"&&headers>1?`0x${"f".repeat(64)}`:blockHash,
        timestamp:`0x${Math.floor(Date.parse(mode==="stale"?"2026-09-28T13:58:00Z":originalNow)/1000).toString(16)}`};}
      else if(body.method==="eth_getTransactionCount"){
        if(body.params[1]!=="pending")assert.deepEqual(body.params[1],{blockHash,requireCanonical:true});
        result=mode==="pending"&&body.params[1]==="pending"?"0x8":"0x7";
      }else if(body.method==="eth_getCode")result=mode==="delegated"?"0xef0100":"0x";
      else if(body.method==="eth_getBalance")result="0x1";else throw Error("Unexpected method");
      return new Response(JSON.stringify({jsonrpc:"2.0",id:body.id,result}));
    }) as typeof fetch;
    const state=await createBscExecutionChain("https://fixture.invalid",60_000,fetcher).state(wallet,[{assetId:"eip155:56/native",decimals:18}],originalNow);
    if(mode==="ok"){assert.ok(state);assert.equal(state.nonce,7);assert.equal(typeof state.nonce,"number");}
    else assert.equal(state,null);
  }
});

test("P7 PostgreSQL disabled send and changed preclaim market keep persisted leg unclaimed",pgOptions,async()=>withPortfolio(async s=>{
  const r=await s.review();await s.executor().persist({sessionToken:s.session.token,reviewId:r.reviewId,...await s.signatures(r.approval)});
  await assert.rejects(s.executor({broadcastEnabled:false}).broadcast({sessionToken:s.session.token,reviewId:r.reviewId}),{code:"BROADCAST_DISABLED"});
  s.change(e=>({...e,providerEvent:{...e.providerEvent!,revision:"changed"}}));
  await assert.rejects(s.executor().broadcast({sessionToken:s.session.token,reviewId:r.reviewId}));
  assert.equal((await s.pool.query("SELECT state FROM eoa_execution_legs")).rows[0].state,"signed");assert.equal(s.sendCount(),0);
}));

test("P7 PostgreSQL postclaim timeout remains unknown and restart never sends twice",pgOptions,async()=>withPortfolio(async s=>{
  const r=await s.review();await s.executor().persist({sessionToken:s.session.token,reviewId:r.reviewId,...await s.signatures(r.approval)});
  s.setTimeout(true);
  assert.equal((await s.executor().broadcast({sessionToken:s.session.token,reviewId:r.reviewId})).outcome,"unknown");
  assert.equal((await s.executor().broadcast({sessionToken:s.session.token,reviewId:r.reviewId})).outcome,"already-claimed");
  assert.equal(s.sendCount(),1);assert.equal((await s.pool.query("SELECT state FROM reservations")).rows[0].state,"submitted");
  assert.equal((await s.pool.query("SELECT outcome FROM eoa_broadcast_results")).rows[0].outcome,"unknown");
}));

test("P7 production fee ceiling cannot exceed the native fee reviewed by P5",pgOptions,async()=>withPortfolio(async s=>{
  s.change(e=>({...e,quote:{...e.quote!,nativeFeeRaw:1n}}));
  await assert.rejects(s.executor().prepare({sessionToken:s.session.token,planId:"plan",legIndex:0}),{code:"FEE_BOUND"});
  assert.equal((await s.pool.query("SELECT count(*) FROM eoa_execution_reviews")).rows[0].count,"0");
}));

test("P7 BSC send transport has one attempt, validates exact hash/chain and never retries",async()=>{
  const owner=Wallet.createRandom();const raw=await owner.signTransaction({type:2,chainId:56,nonce:7,
    to:owner.address,value:0n,gasLimit:21_000n,maxFeePerGas:1n,maxPriorityFeePerGas:0n});
  const {Transaction}=await import("ethers");const hash=Transaction.from(raw).hash!;
  for(const mode of ["ok","wrong-chain","wrong-hash","timeout"]){let sends=0;
    const fetcher=(async(_url,init)=>{const body=JSON.parse(String(init?.body));
      if(body.method==="eth_sendRawTransaction"){sends++;assert.deepEqual(body.params,[raw]);if(mode==="timeout")throw Error("Timeout");}
      return new Response(JSON.stringify({jsonrpc:"2.0",id:body.id,result:body.method==="eth_chainId"?mode==="wrong-chain"?"0x1":"0x38":mode==="wrong-hash"?`0x${"b".repeat(64)}`:hash}));
    }) as typeof fetch;
    const outcome=await createBscExecutionChain("https://fixture.invalid",60_000,fetcher).send({hash,rawSignedTransaction:raw});
    assert.equal(outcome,mode==="ok"?"accepted":"unknown");assert.equal(sends,mode==="wrong-chain"?0:1);
  }
  assert.throws(()=>createBscExecutionChain("https://fixture.invalid/?key=secret",60_000));
});


test("P7 production composition disables broadcasting by default and requires reviewed recovery source",async()=>{
  const base=productionFixture("0x1111111111111111111111111111111111111111"),pool=new Pool();
  const reviews={accessPolicy:null,reviewedControl:null,access:{async session(){throw Error("Unconfigured");},
    async jurisdiction(){return null;},async country(){return null;},async product(){return null;}},
    async economicQuantity(){return null;},async portfolioValuations(){return [];},async event(){return null;},
    async providerEvent(){return null;},async quote(){return null;},async simulation(){return null;}};
  const config=parseRecoveryConfig({version:1,registryVersion:"synthetic-default",finalityBlocks:"12",
    sources:[{id:"fixture",rpcUrl:"https://fixture.invalid/"}],assets:[{assetId:"eip155:56/native",decimals:18,
      semantics:"native-gas",review:"explicitly-synthetic-review"}]});
  const input={pool,sessions:{async authenticate(){throw Error("No database/session call expected");}},
    deployment:{version:"synthetic-default",marketPolicy:base.marketPolicy,mappingRevisions:{},maxGasLimit:300_000n,
      maxFeePerGas:5_000_000_000n,approvalLifetimeMs:60_000},rpcUrl:"https://fixture.invalid/",recoveryConfig:config,
    securityReviews:[],settlementMaxAgeMs:60_000,settlementUncertaintyBps:0,settlementMaxPegDeviationBps:100};
  try {
    const runtime=createBStocksExecutionRuntime(input,reviews);
    await assert.rejects(runtime.broadcast({sessionToken:"unused",reviewId:"unused"}),{code:"BROADCAST_DISABLED"});
    assert.throws(()=>createBStocksExecutionRuntime({...input,rpcUrl:"https://other.invalid/"},reviews));
  } finally {await pool.end();}
});

test("P7 PostgreSQL owner isolation and changed recovery configuration invalidate stored review",pgOptions,async()=>withPortfolio(async s=>{
  const r=await s.review(),signed=await s.signatures(r.approval),other=Wallet.createRandom(),now=new Date(originalNow);
  const challenge=await s.sessions.challenge(other.address,now);
  const session=await s.sessions.verify(challenge.id,await other.signMessage(challenge.message),now);
  await assert.rejects(s.executor().persist({sessionToken:session.token,reviewId:r.reviewId,...signed}),{code:"REVIEW_UNAVAILABLE"});
  await assert.rejects(s.executor({recoveryConfigurationHash:"c".repeat(64)}).persist({sessionToken:s.session.token,
    reviewId:r.reviewId,...signed}),{code:"EXECUTION_CONTEXT_CHANGED"});
  assert.equal((await s.pool.query("SELECT count(*) FROM eoa_execution_legs")).rows[0].count,"0");
}));

test("P7 PostgreSQL outcome-write failure preserves the committed unknown claim and blocks resend",pgOptions,async()=>withPortfolio(async s=>{
  const r=await s.review();await s.executor().persist({sessionToken:s.session.token,reviewId:r.reviewId,...await s.signatures(r.approval)});
  await s.pool.query("ALTER TABLE eoa_broadcast_results ADD CONSTRAINT synthetic_reject_result CHECK (false)");
  assert.equal((await s.executor().broadcast({sessionToken:s.session.token,reviewId:r.reviewId})).outcome,"unknown");
  assert.equal((await s.pool.query("SELECT state FROM eoa_execution_legs")).rows[0].state,"unknown");
  assert.equal((await s.executor().broadcast({sessionToken:s.session.token,reviewId:r.reviewId})).outcome,"already-claimed");
  assert.equal(s.sendCount(),1);
}));
