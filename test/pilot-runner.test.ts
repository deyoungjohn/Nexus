import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdtemp, chmod, readFile, readdir, rm, stat, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { Wallet, Interface, Transaction, verifyTypedData } from 'ethers';
import { randomUUID } from 'node:crypto';
import { PilotEvidence, evidenceProjection, runnerErrorCode, requireDistinctEvidenceInputs, type RunnerEvidence } from '../src/pilot/runner-evidence.js';
import { privateKeySigner, readPrivateKeyFile, parsePilotRunnerOptions } from '../src/pilot/runner-input.js';
import { runPilotTrade, signRunnerSwap, type PilotTradePorts, type RunnerLeg } from '../src/pilot/runner-trade.js';
import { runSetupApproval, type SetupApproval, type SetupApprovalPort } from '../src/pilot/runner-allowance.js';
import { requireRunnerBroadcast, collectPilotPacket, lockPilotOperator, type PilotRunnerConfig, type PilotRunnerRuntime } from '../src/pilot/runner-runtime.js';
import { collectRunnerAccounting, recoverPilotUntil } from '../src/pilot/runner-services.js';
import { prepareEoaLegApproval, eoaApprovalTypedData } from '../src/execution/eoa.js';
import { runBscRecoveryOnce } from '../src/execution/recovery-worker.js';
import { DomainError } from '../src/domain/errors.js';
import { pilotFixture } from './pilot-fixture.js';
import { withLeg } from './recovery-worker.test.js';
import { BSTOCKS_BSC_V3_ROUTER } from '../src/market-gate/bstocks-transfer.js';
import { BSC_USDT_ASSET } from '../src/market-gate/chainlink-bsc.js';

class MemoryEvidence implements RunnerEvidence {
  readonly events: { stage: string; data: unknown }[] = [];
  readonly files = new Map<string, unknown>();
  async append(stage: string, data: unknown) { this.events.push({ stage, data }); }
  async save(name: string, data: unknown) { this.files.set(name, data); }
  async load<T>(name: string): Promise<T | null> { return this.files.get(name) as T ?? null; }
}
const confirm = async () => true;

test('P9 EOA runner accepts only explicit commands/options and two independent broadcast switches', () => {
  assert.deepEqual(parsePilotRunnerOptions(['check']), { command: 'check', broadcast: false, waitSeconds: 180 });
  assert.equal(parsePilotRunnerOptions(['run', '--broadcast', '--wait-seconds', '0']).broadcast, true);
  for (const args of [['run', '--private-key', 'secret'], ['run', '--yes'], ['check', '--broadcast'], ['recover', '--key-file', '/private/key'],
    ['run', '--broadcast', '--broadcast'], ['run', '--wait-seconds', '3601'], ['run', '--wait-seconds', '-1'], ['run', '--wait-seconds', '01'],
    ['run', '--evidence-dir'], ['declaration'], ['run', '--signed-records-output', '/tmp/wrong']]) {
    assert.throws(() => parsePilotRunnerOptions(args), { code: 'INVALID_ARGUMENTS' });
  }
  const config = { deployment: {} } as PilotRunnerConfig;
  for (const flag of [undefined, false, 'true']) {
    assert.throws(() => requireRunnerBroadcast({ ...config, deployment: { ...config.deployment, broadcastEnabled: flag } } as PilotRunnerConfig, true), { code: 'BROADCAST_DISABLED' });
  }
  const enabled = { ...config, deployment: { ...config.deployment, broadcastEnabled: true } };
  assert.throws(() => requireRunnerBroadcast(enabled, false), { code: 'BROADCAST_DISABLED' });
  assert.doesNotThrow(() => requireRunnerBroadcast(enabled, true));
});

test('P9 local signer exposes only capabilities, rejects bad keys and signs exact bounded BSC bytes', async () => {
  const owner = Wallet.createRandom(), signer = privateKeySigner(owner.privateKey);
  assert.equal(signer.address, owner.address.toLowerCase());
  assert.equal(JSON.stringify(signer).includes(owner.privateKey), false);
  assert.equal(Object.hasOwn(signer, 'privateKey'), false);
  assert.throws(() => privateKeySigner('not-a-key'), { code: 'INVALID_PRIVATE_KEY' });
  const request = pilotFixture(owner.address);
  const approval = prepareEoaLegApproval(request, { portfolioId: 'p', planId: 'plan', legId: 'review', transactionNonce: 7,
    policyHash: `0x${'a'.repeat(64)}`, authorizationNonce: 'authorization', expiresAt: '2026-09-28T14:03:00Z', maxGasLimit: 300000n, maxFeePerGas: 5000000000n });
  const signed = await signRunnerSwap(signer, approval), tx = Transaction.from(signed.rawSignedTransaction), typed = eoaApprovalTypedData(approval);
  assert.equal(tx.chainId, 56n); assert.equal(tx.type, 2); assert.equal(tx.to?.toLowerCase(), approval.router);
  assert.equal(tx.data, approval.calldata); assert.equal(tx.value, 0n); assert.equal(tx.nonce, 7);
  assert.equal(tx.gasLimit, approval.maxGasLimit); assert.equal(tx.maxFeePerGas, approval.maxFeePerGas); assert.equal(tx.maxPriorityFeePerGas, 0n);
  assert.equal(verifyTypedData(typed.domain, typed.types, typed.value, signed.ownerSignature), owner.address);
  await assert.rejects(() => signRunnerSwap(privateKeySigner(Wallet.createRandom().privateKey), approval), { code: 'PILOT_WALLET_MISMATCH' });
});

test('P9 evidence is private, durable and exclusive; credentials/errors are excluded but contract tokens retained', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'nexus-runner-evidence-'));
  await chmod(directory, 0o700);
  const secret = Wallet.createRandom().privateKey, token = BSC_USDT_ASSET.split('erc20:')[1]!;
  const evidence = await PilotEvidence.create(directory);
  try {
    await assert.rejects(() => PilotEvidence.create(directory), { code: 'RUNNER_LOCKED' });
    const data = { privateKey: secret, nested: { sessionToken: 'secret', password: 'secret', rpcUrl: 'https://secret.example' },
      error: new Error(`Do not expose ${secret}`), quantity: 9n, controls: { token } };
    await evidence.append('runner.test', data); await evidence.save('state.json', data);
    const timeline = await readFile(join(directory, 'timeline.jsonl'), 'utf8');
    assert.equal(timeline.includes(secret), false); assert.equal(timeline.includes('secret'), false);
    assert.equal(timeline.includes(token), true); assert.equal(timeline.includes('"quantity":"9"'), true);
    assert.equal((await stat(join(directory, 'timeline.jsonl'))).mode & 0o777, 0o600);
    assert.equal((await stat(join(directory, 'state.json'))).mode & 0o777, 0o600);
    assert.equal(runnerErrorCode(new Error(secret)), 'PILOT_RUNNER_FAILED');
    assert.equal(runnerErrorCode(new DomainError('SAFE_CODE', secret)), 'SAFE_CODE');
    assert.deepEqual(evidenceProjection(new Error(secret)), { code: 'PILOT_RUNNER_FAILED' });
    await assert.rejects(() => evidence.save('../escape.json', {}), { code: 'INVALID_EVIDENCE_FILE' });
    await symlink(join(directory, 'state.json'), join(directory, 'linked.json'));
    await assert.rejects(() => evidence.load('linked.json'));
  } finally { await evidence.close(); await rm(directory, { recursive: true, force: true }); }
  const forbidden = resolve(`.nexus-runner-rejected-${randomUUID()}`);
  await assert.rejects(() => PilotEvidence.create(forbidden), { code: 'PRIVATE_OUTPUT_REQUIRED' });
  await assert.rejects(() => stat(forbidden), { code: 'ENOENT' });
});

test('P9 key files reject shared permissions, repository paths, symlinks and oversized inputs', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'nexus-runner-key-')), key = Wallet.createRandom().privateKey, path = join(dir, 'key');
  try {
    await writeFile(path, key + '\n', { mode: 0o600 });
    assert.equal((await readPrivateKeyFile(path)).address, new Wallet(key).address.toLowerCase());
    await chmod(path, 0o644);
    await assert.rejects(() => readPrivateKeyFile(path), { code: 'PRIVATE_KEY_FILE_UNSAFE' });
    await chmod(path, 0o600); await symlink(path, join(dir, 'linked'));
    await assert.rejects(() => readPrivateKeyFile(join(dir, 'linked')));
    await writeFile(path, 'x'.repeat(101));
    await assert.rejects(() => readPrivateKeyFile(path), { code: 'PRIVATE_KEY_FILE_UNSAFE' });
    await assert.rejects(() => readPrivateKeyFile(resolve('package.json')), { code: 'PRIVATE_OUTPUT_REQUIRED' });
  } finally { await rm(dir, { recursive: true, force: true }); }
});

test('P9 managed evidence cannot overwrite an operator configuration, records or key file', () => {
  for (const name of ['configuration.json', 'manual-records-evidence.json', 'allowance.json', 'timeline.jsonl', 'summary.json']) {
    assert.throws(() => requireDistinctEvidenceInputs('/tmp/private-evidence', [`/tmp/private-evidence/${name}`]), { code: 'EVIDENCE_INPUT_COLLISION' });
    assert.throws(() => requireDistinctEvidenceInputs('/tmp/private-evidence', [`/tmp/private-evidence/nested/../${name}`]), { code: 'EVIDENCE_INPUT_COLLISION' });
  }
  assert.doesNotThrow(() => requireDistinctEvidenceInputs('/tmp/private-evidence', [undefined, '/tmp/private-records.json']));
});

test('P7 failed operator-lock acquisition discards its connection rather than hanging shutdown', async () => {
  let discarded = false;
  const pool = { async connect() { return { async query() { throw new Error('Synthetic connection loss'); },
    release(value: boolean) { discarded = value; } }; } } as unknown as Parameters<typeof lockPilotOperator>[0];
  await assert.rejects(() => lockPilotOperator(pool, Wallet.createRandom().address.toLowerCase()), /Synthetic connection loss/);
  assert.equal(discarded, true);
});

function tradeFixture() {
  const owner = Wallet.createRandom(), signer = privateKeySigner(owner.privateKey), evidence = new MemoryEvidence();
  const request = pilotFixture(owner.address);
  const approval = prepareEoaLegApproval(request, { portfolioId: 'p', planId: 'plan', legId: 'review', policyHash: `0x${'a'.repeat(64)}`,
    transactionNonce: 7, authorizationNonce: 'auth', expiresAt: '2026-09-28T14:03:00Z', maxGasLimit: 300000n, maxFeePerGas: 5000000000n });
  const calls: string[] = []; let existing: RunnerLeg | null = null, blocked = false, pending = false, incident = false, changed = false;
  const ports: PilotTradePorts = {
    async existingLeg() { calls.push('existing'); return existing; },
    async authenticate() { calls.push('authenticate'); }, async initialize() { calls.push('initialize'); return 'p'; },
    async plan() { calls.push('plan'); return { planId: 'plan' }; },
    async prepare() { calls.push('prepare'); return blocked ? { kind: 'blocked', gate: { reason: 'reference-stale' } } : { kind: 'review', reviewId: 'review', approval }; },
    async persist(id, signature, raw) { calls.push('persist');
      const typed = eoaApprovalTypedData(approval); assert.equal(verifyTypedData(typed.domain, typed.types, typed.value, signature), owner.address);
      existing = { id, state: 'signed', hash: Transaction.from(raw).hash!, portfolioId: 'p' }; return { hash: existing.hash }; },
    async broadcast() { calls.push('broadcast'); assert.equal(existing?.state, 'signed'); existing = { ...existing!, state: 'unknown' }; return { outcome: 'unknown' }; },
    async recover() { calls.push('recover'); return { complete: !pending, incident }; },
    async accounting() { calls.push('accounting'); return { revision: changed && calls.filter(c => c === 'accounting').length > 1 ? '4' : '3', amount: '5000000000000000000' }; }
  };
  return { signer, evidence, calls, ports, input: { wallet: signer.address, signer, evidence, ports, confirm, requestId: 'request' },
    setExisting: (leg: RunnerLeg) => { existing = leg; }, blocked: () => { blocked = true; }, pending: () => { pending = true; },
    incident: () => { incident = true; }, changed: () => { changed = true; } };
}
test('P7 runner persists before one send, gathers blocked evidence and proves no duplicate on repeat', async () => {
  const f = tradeFixture(); assert.equal(await runPilotTrade(f.input), 'complete');
  assert.deepEqual(f.calls, ['existing', 'authenticate', 'initialize', 'plan', 'prepare', 'persist', 'broadcast', 'recover', 'accounting', 'recover', 'accounting']);
  assert.ok(f.evidence.events.some(e => e.stage === 'acceptance.complete'));
  assert.equal(await runPilotTrade(f.input), 'complete'); assert.equal(f.calls.filter(c => c === 'broadcast').length, 1);
  assert.equal(f.calls.filter(c => c === 'plan').length, 1);
  const blocked = tradeFixture(); blocked.blocked();
  await assert.rejects(() => runPilotTrade(blocked.input), { code: 'MARKET_GATE_BLOCKED' });
  assert.equal(blocked.evidence.files.get('trade-review.json') !== undefined, true);
  assert.equal(blocked.calls.includes('persist'), false); assert.equal(blocked.calls.includes('broadcast'), false);
});
test('P7 runner confirmation, evidence-write and persistence failures prevent sending', async () => {
  for (const failure of ['cancel', 'evidence', 'persist']) {
    const f = tradeFixture();
    if (failure === 'evidence') f.evidence.append = async stage => { if (stage === 'sign-trade.review') throw new Error('Disk unavailable'); };
    if (failure === 'persist') f.ports.persist = async () => { f.calls.push('persist'); throw new Error('Database unavailable'); };
    await assert.rejects(() => runPilotTrade({ ...f.input, confirm: failure === 'cancel' ? async () => false : confirm }));
    assert.equal(f.calls.includes('broadcast'), false);
  }
});
test('P7 claimed/ambiguous/reorged legs only recover; signed legs need exact stored-send approval', async () => {
  for (const state of ['unknown', 'included', 'confirmed', 'reorged', 'replaced']) {
    const f = tradeFixture(); f.setExisting({ id: 'old', state, hash: `0x${'b'.repeat(64)}`, portfolioId: 'p' }); f.pending();
    assert.equal(await runPilotTrade(f.input), 'pending'); assert.deepEqual(f.calls, ['existing', 'recover']);
  }
  const f = tradeFixture(); f.setExisting({ id: 'old', state: 'signed', hash: `0x${'b'.repeat(64)}`, portfolioId: 'p' }); f.pending();
  assert.equal(await runPilotTrade(f.input), 'pending'); assert.deepEqual(f.calls, ['existing', 'authenticate', 'broadcast', 'recover']);
  const incident = tradeFixture(); incident.incident(); await assert.rejects(() => runPilotTrade(incident.input), { code: 'PILOT_INCIDENT_REQUIRES_REVIEW' });
  const changed = tradeFixture(); changed.changed(); await assert.rejects(() => runPilotTrade(changed.input), { code: 'RECOVERY_REPLAY_CHANGED_ACCOUNTING' });
});

function setupFixture() {
  const owner = Wallet.createRandom(), signer = privateKeySigner(owner.privateKey), evidence = new MemoryEvidence(); let sends = 0;
  const setup: SetupApproval = { wallet: signer.address, token: BSC_USDT_ASSET.split('erc20:')[1]!, spender: BSTOCKS_BSC_V3_ROUTER,
    amount: '5000000000000000000', chainId: 56, nonce: 7, gasLimit: '70000', maxFeePerGas: '100000000',
    maximumNativeFeeRaw: '7000000000000', maximumSettlementFeeRaw: '10000000000000000', configurationHash: 'a'.repeat(64) };
  const port: SetupApprovalPort = { async inspect() { return setup; }, async verify() { return null; }, async send(hash, raw) {
    assert.ok(evidence.files.has('allowance.json')); assert.ok(evidence.events.some(e => e.stage === 'allowance.send-claimed'));
    const tx = Transaction.from(raw), abi = new Interface(['function approve(address,uint256) returns(bool)']);
    assert.equal(tx.hash, hash); assert.equal(tx.data, abi.encodeFunctionData('approve', [BSTOCKS_BSC_V3_ROUTER, 5n * 10n ** 18n]));
    sends++; return 'unknown';
  } };
  return { input: { wallet: signer.address, signer, port, evidence, confirm, assertOperatorLock: async () => undefined }, setup, port, sends: () => sends, evidence };
}
test('P7 exact external approval is durable before send and never resent after ambiguity or restart', async () => {
  const f = setupFixture(); const first = await runSetupApproval(f.input); assert.equal(first.receipt, null); assert.equal(f.sends(), 1);
  assert.equal((await runSetupApproval(f.input)).hash, first.hash); assert.equal(f.sends(), 1);
  f.port.verify = async () => ({ status: '0x1' });
  assert.deepEqual((await runSetupApproval(f.input)).receipt, { status: '0x1' }); assert.equal(f.sends(), 1);
});
test('P7 setup changed nonce, confirmation, disk failure or operator-lock loss blocks send', async () => {
  for (const failure of ['changed', 'cancel', 'disk', 'lock']) {
    const f = setupFixture(); let reads = 0;
    if (failure === 'changed') f.port.inspect = async () => ({ ...f.setup, nonce: ++reads });
    if (failure === 'disk') f.evidence.save = async () => { throw new Error('Disk unavailable'); };
    await assert.rejects(() => runSetupApproval({ ...f.input, confirm: failure === 'cancel' ? async () => false : confirm,
      assertOperatorLock: failure === 'lock' ? async () => { throw new Error('Lock lost'); } : async () => undefined }));
    assert.equal(f.sends(), 0);
  }
  const unlimited = setupFixture(); unlimited.port.inspect = async () => ({ ...unlimited.setup, amount: ((1n << 256n) - 1n).toString() });
  await assert.rejects(() => runSetupApproval(unlimited.input), { code: 'INVALID_SETUP_RECORD' }); assert.equal(unlimited.sends(), 0);
});

const pgOptions = { skip: !process.env.TEST_DATABASE_URL && 'Set TEST_DATABASE_URL for real PostgreSQL integration tests.' };
test('P7 PostgreSQL runner exports original fill/zero allowance and repeats recovery without another fill', pgOptions, async () => withLeg(async s => {
  await s.pool.query("UPDATE eoa_execution_legs SET pilot_profile_hash=repeat('c',64)");
  const fetcher: typeof fetch = async (url, init) => {
    const request = JSON.parse(String(init?.body));
    if (request.method === 'eth_call' && request.params[0].data.startsWith('0xdd62ed3e')) return new Response(JSON.stringify({ jsonrpc: '2.0', id: request.id, result: `0x${'0'.repeat(64)}` }));
    return s.rpc()(url, init);
  };
  const profile = pilotFixture(s.owner.address).pilotProfile;
  const runtime = { pool: s.pool, config: { deployment: { pilotProfile: profile } },
    async recover(legId?: string) { return runBscRecoveryOnce(s.pool, s.reviewed, fetcher, 25, { wallet: profile.wallet, ...(legId ? { legId } : {}) }); } } as PilotRunnerRuntime;
  const leg: RunnerLeg = { id: s.approval.legId, state: 'unknown', hash: s.prepared.hash, portfolioId: 'portfolio-one' };
  const evidence = new MemoryEvidence();
  assert.deepEqual(await recoverPilotUntil(runtime, evidence, leg, 0), { complete: true, incident: false });
  const before = await collectRunnerAccounting(runtime, leg);
  assert.deepEqual(await recoverPilotUntil(runtime, evidence, leg, 0), { complete: true, incident: false });
  assert.deepEqual(await collectRunnerAccounting(runtime, leg), before);
  const packet = await collectPilotPacket(s.pool, profile.wallet, profile.revision) as Record<string, unknown[]>;
  assert.equal(packet.fillProofs!.length, 1); assert.equal(packet.legs!.length, 1); assert.equal(packet.recoveryAttempts!.length, 2);
  assert.equal(packet.recoveryEvidence!.length, 3); assert.equal(packet.snapshots!.length, 0);
  assert.equal(JSON.stringify(packet).includes(s.owner.privateKey), false);
  const other = await collectPilotPacket(s.pool, Wallet.createRandom().address.toLowerCase(), 'unused') as Record<string, unknown[]>;
  assert.equal(other.portfolios!.length, 0); assert.equal(other.legs!.length, 0); assert.equal(other.fillProofs!.length, 0);
  assert.ok(s.methods.every(m => m !== 'eth_sendRawTransaction'));
}, true));
test('P7 PostgreSQL recovery selection excludes foreign wallets and wallet operator lock is exclusive', pgOptions, async () => withLeg(async s => {
  const wallet = s.owner.address.toLowerCase(), foreign = Wallet.createRandom().address.toLowerCase();
  assert.deepEqual(await runBscRecoveryOnce(s.pool, s.reviewed, s.rpc(), 25, { wallet: foreign }), []);
  assert.deepEqual(await runBscRecoveryOnce(s.pool, s.reviewed, s.rpc(), 25, { wallet, legId: 'absent' }), []);
  assert.equal((await s.pool.query('SELECT count(*) FROM eoa_recovery_attempts')).rows[0].count, '0');
  const lock = await lockPilotOperator(s.pool, wallet);
  try { await lock.assertHeld(); await assert.rejects(() => lockPilotOperator(s.pool, wallet), { code: 'RUNNER_LOCKED' }); }
  finally { await lock.close(); }
  const next = await lockPilotOperator(s.pool, wallet); await next.close();
  const dir = await mkdtemp(join(tmpdir(), 'nexus-runner-pg-')); await chmod(dir, 0o700);
  const evidence = await PilotEvidence.create(dir);
  try { await evidence.save('database-evidence.json', await collectPilotPacket(s.pool, wallet, 'fixture'));
    assert.deepEqual((await readdir(dir)).sort(), ['database-evidence.json', 'runner.lock', 'timeline.jsonl']);
  } finally { await evidence.close(); await rm(dir, { recursive: true, force: true }); }
}));
