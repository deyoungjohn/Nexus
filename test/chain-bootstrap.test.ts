import assert from 'node:assert/strict';
import test from 'node:test';
import {randomUUID} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {Wallet} from 'ethers';
import {Pool} from 'pg';
import {Ledger} from '../src/ledger/ledger.js';
import {migrate} from '../src/ledger/migrate.js';
import {SessionStore} from '../src/application/session.js';
import {EoaExecutionStore} from '../src/execution/store.js';
import {ChainBootstrapService,type FinalizedChainSnapshot} from '../src/execution/chain-bootstrap.js';
import {parseRecoveryConfig} from '../src/execution/recovery-config.js';
import {productionFixture} from './production-execution-fixture.js';

const databaseUrl=process.env.TEST_DATABASE_URL;
const options={skip:!databaseUrl&&'Set TEST_DATABASE_URL for real PostgreSQL tests.'};
test('P7 PostgreSQL owner-signed bootstrap and resync are atomic, idempotent and preserve pause/history',options,async()=>{
  const admin=new Pool({connectionString:databaseUrl}),schema=`nexus_bootstrap_${randomUUID().replaceAll('-','')}`;
  await admin.query(`CREATE SCHEMA ${schema}`);const pool=new Pool({connectionString:databaseUrl,options:`-c search_path=${schema}`,max:4});
  try{
    await migrate(pool);await migrate(pool);
    const owner=Wallet.createRandom(),base=productionFixture(owner.address),sessions=new SessionStore(pool,'https://nexus.example');
    const clock=new Date(base.now),challenge=await sessions.challenge(owner.address,clock);
    const session=await sessions.verify(challenge.id,await owner.signMessage(challenge.message),clock);
    const ledger=new Ledger(pool),store=new EoaExecutionStore(pool);
    await ledger.createPortfolio({id:'p',chainId:56,settlement:base.snapshot.confirmedCash,balances:[base.snapshot.confirmedCash,base.snapshot.nativeGas]});
    await store.bindOwnerWallet('p',owner.address,0n);
    let current:FinalizedChainSnapshot={sourceBlock:100n,sourceBlockHash:`0x${'b'.repeat(64)}`,transactionNonce:7n,
      balances:[base.snapshot.confirmedCash,base.snapshot.nativeGas,base.snapshot.positions[0]!.raw]};
    const config=parseRecoveryConfig(JSON.parse(readFileSync('config/bsc-recovery.json','utf8')));
    const service=new ChainBootstrapService(pool,sessions,config,{async read(){return structuredClone(current);}},()=>clock);
    const review=await service.prepare({sessionToken:session.token,portfolioId:'p',kind:'bootstrap',reason:'Owner initialization from finalized chain.'});
    const signature=await owner.signTypedData(review.typedData.domain,review.typedData.types,review.typedData.value);
    const args={sessionToken:session.token,reviewId:review.reviewId,ownerSignature:signature};
    const other=Wallet.createRandom();const wrong=await other.signTypedData(review.typedData.domain,review.typedData.types,review.typedData.value);
    await assert.rejects(()=>service.activate({...args,ownerSignature:wrong}),{code:'INVALID_SIGNATURE'});
    current={...current,transactionNonce:8n};await assert.rejects(()=>service.activate(args),{code:'CHAIN_STATE_CHANGED'});
    current={...current,transactionNonce:7n};
    const results=await Promise.all([service.activate(args),service.activate(args)]);
    assert.equal(results.filter(r=>!r.replay).length,1);assert.equal(results[0]!.revision,2n);
    assert.deepEqual(await service.activate(args),{revision:2n,replay:true});
    const row=(await pool.query("SELECT revision,data_mode,execution_paused FROM portfolios WHERE id='p'")).rows[0];
    assert.equal(row.data_mode,'chain');assert.equal(row.execution_paused,true);assert.equal(row.revision,'2');
    assert.equal((await pool.query("SELECT count(*) FROM balances WHERE portfolio_id='p'")).rows[0].count,'3');
    await ledger.reservePlan({portfolioId:'p',expectedRevision:2n,planId:'plan',occurrenceId:'o',idempotencyKey:'k',
      leaseUntil:new Date(Date.now()+60000),reservations:[{id:'r',amount:base.snapshot.confirmedCash}]});
    current={...current,sourceBlock:200n,sourceBlockHash:`0x${'c'.repeat(64)}`,transactionNonce:8n,
      balances:current.balances.map(b=>b.assetId===base.snapshot.confirmedCash.assetId?{...b,units:b.units+1n}:b)};
    const resync=await service.prepare({sessionToken:session.token,portfolioId:'p',kind:'resync',reason:'External allowance nonce and deposit acknowledged.'});
    const signed=await owner.signTypedData(resync.typedData.domain,resync.typedData.types,resync.typedData.value);
    await pool.query("UPDATE reservations SET state='submitted',lease_until=NULL WHERE id='r'");
    await assert.rejects(()=>service.activate({sessionToken:session.token,reviewId:resync.reviewId,ownerSignature:signed}),{code:'UNRESOLVED_SUBMISSION'});
    await pool.query("UPDATE reservations SET state='held',lease_until=now()+interval '1 minute' WHERE id='r'");
    assert.deepEqual(await service.activate({sessionToken:session.token,reviewId:resync.reviewId,ownerSignature:signed}),{revision:3n,replay:false});
    assert.equal((await pool.query("SELECT status FROM plans WHERE id='plan'")).rows[0].status,'stale');
    assert.equal((await pool.query("SELECT state FROM reservations WHERE id='r'")).rows[0].state,'released');
    assert.equal((await pool.query("SELECT count(*) FROM chain_snapshot_reviews WHERE activated_revision IS NOT NULL")).rows[0].count,'2');
    assert.equal((await pool.query("SELECT count(*) FROM portfolio_revisions WHERE portfolio_id='p'")).rows[0].count,'4');
    assert.equal((await pool.query("SELECT execution_paused FROM portfolios WHERE id='p'")).rows[0].execution_paused,true);
    const {PilotPlanningService}=await import('../src/pilot/planning.js');
    const {pilotFixture}=await import('./pilot-fixture.js');
    const profile=pilotFixture(owner.address).pilotProfile;
    const planClock=new Date(),planChallenge=await sessions.challenge(owner.address,planClock);
    const planSession=await sessions.verify(planChallenge.id,await owner.signMessage(planChallenge.message),planClock);
    const planner=new PilotPlanningService(pool,sessions,profile,base.instrument,base.coordinatorPolicy,{async read(){return current;}},
      async()=>({...base.evidence.settlement!,observedAt:planClock.toISOString(),expiresAt:new Date(planClock.getTime()+900000).toISOString()}),()=>planClock);
    const planArgs={sessionToken:planSession.token,portfolioId:'p',requestId:'first-pilot'};
    await assert.rejects(()=>planner.prepare(planArgs),{code:'EXECUTION_UNAVAILABLE'});
    await store.setPaused('p',3n,false);
    const plans=await Promise.all([planner.prepare(planArgs),planner.prepare(planArgs)]);
    assert.equal(plans.filter(p=>!p.replay).length,1);assert.equal(plans[0]!.revision,'5');
    assert.equal((await pool.query("SELECT count(*) FROM policies WHERE portfolio_id='p'")).rows[0].count,'1');
    assert.equal((await pool.query("SELECT count(*) FROM plans WHERE status='reserved'")).rows[0].count,'1');
    current={...current,transactionNonce:9n};await assert.rejects(()=>planner.prepare({...planArgs,requestId:'external-change'}),{code:'UNEXPLAINED_NONCE'});
  }finally{await pool.end();await admin.query(`DROP SCHEMA ${schema} CASCADE`);await admin.end();}
});

test('P7 browser snapshot signing binds displayed balances, wallet, revision, expiry and typed schema',async()=>{
  const {chainSnapshotTypedData}=await import('../src/execution/chain-bootstrap.js');
  const {securityDigest}=await import('../src/security/token-security.js');
  const {checkedChainSnapshot,signChainSnapshot}=await import('../web/lib/chain-snapshot-wallet.js');
  const owner=Wallet.createRandom(),base=productionFixture(owner.address);
  const snapshot={sourceBlock:'100',sourceBlockHash:`0x${'a'.repeat(64)}`,transactionNonce:'7',balances:[base.snapshot.confirmedCash,base.snapshot.nativeGas,base.snapshot.positions[0]!.raw]
    .map(b=>({...b,units:b.units.toString()}))};
  const expiry='2026-09-28T14:05:00.000Z',reason='Owner initializes actual finalized balances.',kind='bootstrap' as const;
  const t=chainSnapshotTypedData({id:'r',portfolioId:'p',wallet:owner.address,expectedRevision:1n,evidenceHash:securityDigest({kind,reason,...snapshot}),
    configurationHash:'f'.repeat(64),expiresAt:expiry});
  const review={reviewId:'r',reason,kind,expiresAt:expiry,snapshot,typedData:{domain:t.domain,primaryType:'ChainSnapshot',types:{...t.types,
    EIP712Domain:[{name:'name',type:'string'},{name:'version',type:'string'},{name:'chainId',type:'uint256'}]},
    message:JSON.parse(JSON.stringify(t.value,(_k,v:unknown)=>typeof v==='bigint'?v.toString():v))}};
  const now=Date.parse(base.now);
  assert.doesNotThrow(()=>checkedChainSnapshot(review,owner.address,'p','1',now));
  const provider={async request({method,params}:{method:string;params?:unknown[]}){
    if(method==='eth_accounts')return[owner.address];if(method==='eth_chainId')return'0x38';
    if(method==='eth_signTypedData_v4'){assert.ok(String(params?.[1]).includes('ChainSnapshot'));
      return owner.signTypedData(t.domain,t.types,t.value);}throw Error('Unexpected wallet method');}};
  assert.match(await signChainSnapshot(provider,review,owner.address,'p','1',()=>true,()=>now),/^0x/);
  assert.throws(()=>checkedChainSnapshot({...review,snapshot:{...snapshot,transactionNonce:'8'}},owner.address,'p','1',now));
  assert.throws(()=>checkedChainSnapshot(review,owner.address,'p','2',now));
  assert.throws(()=>checkedChainSnapshot(review,owner.address,'p','1',Date.parse(expiry)));
  await assert.rejects(()=>signChainSnapshot(provider,review,owner.address,'p','1',()=>false,()=>now));
});
