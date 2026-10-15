import test from 'node:test';
import assert from 'node:assert/strict';
import {withLeg} from './recovery-worker.test.js';
import {runBscRecoveryOnce} from '../src/execution/recovery-worker.js';
import {prepareBscBalanceEvidence} from '../src/execution/bsc-recovery.js';
import {resolveRecoveryAssets} from '../src/execution/recovery-config.js';
import {createPilotPriceJournal} from '../src/pilot/price-journal.js';
import {pilotFixture} from './pilot-fixture.js';

const pgOptions={skip:!process.env.TEST_DATABASE_URL&&'Set TEST_DATABASE_URL for PostgreSQL integration.'};
test('P7 PostgreSQL Amendment D4 zero allowance is immutable per leg, missing proof cannot apply, nonzero freezes once',pgOptions,async()=>{
  await withLeg(async s=>{
    await s.pool.query("UPDATE eoa_execution_legs SET pilot_profile_hash=repeat('a',64)");
    const rpc=(allowance:bigint|null):typeof fetch=>async(url,init)=>{
      const b=JSON.parse(String(init?.body)),call=b.params?.[0];
      if(b.method==='eth_call'&&String(call?.data).startsWith('0xdd62ed3e'))return allowance===null
        ?new Response('{}',{status:503}):new Response(JSON.stringify({jsonrpc:'2.0',id:b.id,result:`0x${allowance.toString(16).padStart(64,'0')}`}));
      return s.rpc()(url,init);
    };
    assert.equal((await runBscRecoveryOnce(s.pool,s.reviewed,rpc(null)))[0]?.outcome,'unavailable');
    assert.equal((await s.state()).reconciled,false);
    const result=await runBscRecoveryOnce(s.pool,s.reviewed,rpc(1n));
    assert.equal(result[0]?.reason,'PILOT_POST_FILL_ALLOWANCE_NONZERO');
    assert.deepEqual(await s.state(),{revision:'3',execution_paused:true,state:'submitted',reconciled:false});
    await runBscRecoveryOnce(s.pool,s.reviewed,rpc(1n));assert.equal((await s.state()).revision,'3');
    await assert.rejects(s.store.setPaused('portfolio-one',3n,false),{code:'UNRESOLVED_SUBMISSION'});
    const evidence=await prepareBscBalanceEvidence(s.store,{portfolioId:'portfolio-one',legId:'leg-one',
      rpcUrl:s.reviewed.sources[0]!.rpcUrl,finalityBlocks:12n,async resolveTrackedAssets(c){return resolveRecoveryAssets(s.reviewed,c);}},rpc(0n));
    assert.ok(evidence);
    const {allowanceProof:_proof,...missing}=evidence;
    await assert.rejects(s.store.reconcileFinalizedLeg(missing),{code:'PILOT_POST_FILL_ALLOWANCE_INVALID'});
    await s.store.reconcileFinalizedLeg(evidence);
    assert.deepEqual(await s.state(),{revision:'4',execution_paused:true,state:'consumed',reconciled:true});
    const saved=await s.pool.query('SELECT allowance_proof,proof FROM eoa_fill_proofs');
    assert.equal(saved.rows[0].allowance_proof.allowanceRaw,'0');assert.ok(saved.rows[0].proof.logs.length);
    assert.equal((await runBscRecoveryOnce(s.pool,s.reviewed,rpc(0n)))[0]?.outcome,'monitored');
    assert.equal((await s.state()).revision,'4');assert.equal(s.methods.some(x=>/send|sign/i.test(x)),false);
  });
});
test('P5.5 PostgreSQL feed high-water marks and cadence survive restart and profile revision',pgOptions,async()=>{
  await withLeg(async s=>{
    const p=pilotFixture(),prices=p.evidence.pilotPrices;
    assert.equal(await createPilotPriceJournal(s.pool).observe([prices.equity,prices.settlement]),false);
    assert.equal(await createPilotPriceJournal(s.pool).observe([{...prices.equity,roundId:99n}]),true);
    assert.equal(await createPilotPriceJournal(s.pool).observe([{...prices.equity,startedAt:'2026-09-28T13:59:00Z',updatedAt:'2026-09-28T13:59:00Z'}]),true);
    assert.equal(await createPilotPriceJournal(s.pool).observe([prices.equity]),false);
    const restarted=createPilotPriceJournal(s.pool);
    await restarted.record({...p,pilotProfile:{...p.pilotProfile,revision:'new-profile'},evidence:{...p.evidence,
      pilotPrices:{...prices,regression:true}}},'revalidate');
    const log=await s.pool.query('SELECT profile_revision,gate_reason,evidence FROM pilot_price_observations');
    assert.equal(log.rows[0].gate_reason,'P2');assert.equal(log.rows[0].profile_revision,'new-profile');
    assert.equal(log.rows[0].evidence.policy,'declared-age-band');
    const h=await s.pool.query('SELECT round_id FROM pilot_feed_highwater WHERE source=$1',[prices.equity.source]);
    assert.equal(h.rows[0].round_id,'100');
  });
});
