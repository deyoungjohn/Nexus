import test from 'node:test';
import assert from 'node:assert/strict';
import {Wallet} from 'ethers';
import {withLeg} from './recovery-worker.test.js';
import {runBscRecoveryOnce} from '../src/execution/recovery-worker.js';
import {parseRecoveryConfig} from '../src/execution/recovery-config.js';
import {ReanchorService} from '../src/execution/reanchor.js';
import {createBscReanchorReader} from '../src/execution/reanchor-evidence.js';
import {ChainBootstrapService} from '../src/execution/chain-bootstrap.js';
import {SessionStore} from '../src/application/session.js';
import {executionJson} from '../src/execution/execution-json.js';
import {checkedReanchor,signReanchor,type ReanchorView} from '../web/lib/reanchor-wallet.js';

const pgOptions={skip:!process.env.TEST_DATABASE_URL&&'Set TEST_DATABASE_URL for PostgreSQL integration.'};
const now=new Date('2026-09-28T14:02:00.000Z');
const newHash=`0x${'d'.repeat(64)}`,finalHash=`0x${'f'.repeat(64)}`,oldCanonicalHash=`0x${'c'.repeat(64)}`;
async function scenario(s:Awaited<Parameters<Parameters<typeof withLeg>[0]>[0]>) {
  assert.equal((await runBscRecoveryOnce(s.pool,s.reviewed,s.rpc()))[0]?.outcome,'reconciled');
  const original=(await s.pool.query('SELECT * FROM eoa_fill_proofs')).rows[0];
  assert.equal((await runBscRecoveryOnce(s.pool,s.reviewed,s.rpc('missing')))[0]?.outcome,'manual-review');
  const config=parseRecoveryConfig({...s.reviewed,sources:s.reviewed.sources.map((source,i)=>({...source,
    independence:{upstreamGroup:`synthetic-upstream-${i}`,reviewDigest:String(i+1).repeat(64),reviewedAt:'2026-09-27T00:00:00Z'}}))});
  const sessions=new SessionStore(s.pool,'https://nexus.example');
  const challenge=await sessions.challenge(s.owner.address,now),session=await sessions.verify(challenge.id,await s.owner.signMessage(challenge.message),now);
  const methods:string[]=[];
  const rpc=(mode='good'):typeof fetch=>async(url,init)=>{
    const b=JSON.parse(String(init?.body)),p=b.params;methods.push(b.method);let result:unknown;
    if(b.method==='eth_chainId')result='0x38';
    else if(b.method==='eth_getBlockByNumber') {
      const tag=p[0]==='finalized'?'0xc8':p[0];
      result={number:tag,hash:tag==='0x64'?(mode==='disagree'&&String(url).includes('backup')?newHash:oldCanonicalHash)
        :tag==='0x66'?newHash:tag==='0xc8'?finalHash:`0x${'e'.repeat(64)}`};
    } else if(b.method==='eth_getTransactionCount')result='0x8';
    else if(b.method==='eth_getTransactionByHash')result={hash:s.prepared.hash,from:s.owner.address,to:s.approval.router,
      nonce:'0x7',value:'0x0',input:s.approval.calldata,blockNumber:'0x66',blockHash:newHash};
    else if(b.method==='eth_getTransactionReceipt') {
      const r=JSON.parse(executionJson(original.proof));
      result={...r,blockNumber:'0x66',blockHash:newHash,status:'0x1',gasUsed:`0x${BigInt(r.gasUsed).toString(16)}`,
        effectiveGasPrice:`0x${(BigInt(r.effectiveGasPrice)+(mode==='gas-changed'?1n:0n)).toString(16)}`,
        logs:r.logs.map((l:Record<string,unknown>)=>({...l,blockNumber:'0x66',blockHash:newHash,
          logIndex:`0x${BigInt(String(l.logIndex)).toString(16)}`,
          ...(mode==='logs-changed'?{data:`0x${'0'.repeat(63)}1`}:{})}))};
    }else if(b.method==='eth_getBalance'||b.method==='eth_call') {
      const before=p[1]==='0x65',balances=before?original.before_balances:original.after_balances;
      const asset=b.method==='eth_getBalance'?'eip155:56/native':`eip155:56/erc20:${String(p[0].to).toLowerCase()}`;
      const raw=BigInt(balances.find((x:{assetId:string})=>x.assetId===asset)?.units??'0');
      const units=mode==='balance-changed'&&!before&&asset==='eip155:56/native'?raw+1n:raw;
      result=b.method==='eth_getBalance'?`0x${units.toString(16)}`:`0x${units.toString(16).padStart(64,'0')}`;
    }else throw Error(`Unexpected read-only method ${b.method}`);
    return new Response(JSON.stringify({jsonrpc:'2.0',id:b.id,result}));
  };
  const service=(mode='good',reviewed=config)=>new ReanchorService(s.pool,sessions,reviewed,createBscReanchorReader(reviewed,rpc(mode)),()=>now);
  const input={sessionToken:session.token,portfolioId:'portfolio-one',legId:'leg-one'};
  return{original,config,sessions,session,methods,service,input};
}

test('P7 PostgreSQL Amendment D5 signed R1 appends an identical-effect anchor, preserves balances and pause, and replays once',pgOptions,async()=>{
  await withLeg(async s=>{
    const x=await scenario(s),before=await s.pool.query('SELECT * FROM balances ORDER BY asset_id');
    const bootstrap=new ChainBootstrapService(s.pool,x.sessions,x.config,{async read(){throw Error('Resync must not read past unresolved guard.');}},()=>now);
    await assert.rejects(bootstrap.prepare({sessionToken:x.session.token,portfolioId:'portfolio-one',kind:'resync',reason:'Attempted disputed fill reset'}),
      {code:'UNRESOLVED_SUBMISSION'});
    const first=await x.service().prepare(x.input),competing=await x.service().prepare(x.input);
    const signature=await s.owner.signTypedData(first.typedData.domain,first.typedData.types,first.typedData.value);
    const command={sessionToken:x.session.token,reviewId:first.reviewId,ownerSignature:signature};
    const raced=await Promise.all([x.service().activate(command),x.service().activate(command)]);
    assert.deepEqual(raced.map(x=>x.replay).sort(),[false,true]);assert.ok(raced.every(x=>x.revision===5n));
    const calls=x.methods.length;
    assert.deepEqual(await x.service().activate(command),{revision:5n,replay:true});assert.equal(x.methods.length,calls);
    const otherSignature=await s.owner.signTypedData(competing.typedData.domain,competing.typedData.types,competing.typedData.value);
    await assert.rejects(x.service().activate({...command,reviewId:competing.reviewId,ownerSignature:otherSignature}),{code:'REANCHOR_ALREADY_APPLIED'});
    assert.deepEqual((await s.pool.query('SELECT * FROM balances ORDER BY asset_id')).rows,before.rows);
    assert.deepEqual(await s.state(),{revision:'5',execution_paused:true,state:'consumed',reconciled:true});
    assert.deepEqual((await s.pool.query('SELECT * FROM eoa_fill_proofs')).rows[0],x.original);
    const saved=await s.pool.query('SELECT included_block,included_block_hash FROM eoa_execution_legs');
    assert.equal(saved.rows[0].included_block,'102');assert.equal(saved.rows[0].included_block_hash,newHash);
    assert.equal((await s.pool.query("SELECT count(*) FROM decision_records WHERE kind='chain-incident-R1'")).rows[0].count,'1');
    assert.equal(x.methods.some(m=>/send|sign/i.test(m)),false);
    const wire=JSON.parse(executionJson({...first,typedData:{domain:first.typedData.domain,primaryType:'Reanchor',
      types:{...first.typedData.types,EIP712Domain:[{name:'name',type:'string'},{name:'version',type:'string'},{name:'chainId',type:'uint256'}]},
      message:first.typedData.value}})) as ReanchorView;
    checkedReanchor(wire,s.owner.address,'portfolio-one','leg-one','4',now.getTime());
    const provider={async request({method}:{method:string}){return method==='eth_accounts'?[s.owner.address]:method==='eth_chainId'?'0x38':signature;}};
    assert.equal(await signReanchor(provider,wire,s.owner.address,'portfolio-one','leg-one','4',()=>true,()=>now.getTime()),signature);
    assert.throws(()=>checkedReanchor({...wire,evidence:{...wire.evidence,outcome:'R2'}},s.owner.address,'portfolio-one','leg-one','4',now.getTime()));
  });
});
test('P7 PostgreSQL Amendment D5 rejects changed effects, incomplete independence and changed evidence after owner review',pgOptions,async()=>{
  await withLeg(async s=>{
    const x=await scenario(s);
    for(const mode of ['gas-changed','logs-changed'])await assert.rejects(x.service(mode).prepare(x.input),{code:'REANCHOR_EFFECTS_CHANGED'});
    await assert.rejects(x.service('balance-changed').prepare(x.input),{code:'REANCHOR_BALANCES_CHANGED'});
    await assert.rejects(x.service('disagree').prepare(x.input),{code:'REANCHOR_EVIDENCE_UNAVAILABLE'});
    const one=parseRecoveryConfig({...x.config,sources:x.config.sources.slice(0,1)});
    await assert.rejects(x.service('good',one).prepare(x.input),{code:'RPC_INDEPENDENCE_REQUIRED'});
    const shared=parseRecoveryConfig({...x.config,sources:x.config.sources.map(source=>({...source,
      independence:{...source.independence!,upstreamGroup:'shared-upstream'}}))});
    await assert.rejects(x.service('good',shared).prepare(x.input),{code:'RPC_INDEPENDENCE_REQUIRED'});
    const review=await x.service().prepare(x.input),signature=await s.owner.signTypedData(review.typedData.domain,review.typedData.types,review.typedData.value);
    await assert.rejects(x.service('gas-changed').activate({sessionToken:x.session.token,reviewId:review.reviewId,ownerSignature:signature}),
      {code:'REANCHOR_EFFECTS_CHANGED'});
    const foreign=Wallet.createRandom(),challenge=await x.sessions.challenge(foreign.address,now),session=await x.sessions.verify(challenge.id,await foreign.signMessage(challenge.message),now);
    await assert.rejects(x.service().activate({sessionToken:session.token,reviewId:review.reviewId,ownerSignature:signature}),{code:'REVIEW_UNAVAILABLE'});
    assert.equal((await s.state()).revision,'4');assert.equal((await s.state()).execution_paused,true);
  });
});
