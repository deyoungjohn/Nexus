import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import test from "node:test";
import { Wallet, id, keccak256 } from "ethers";
import { Pool } from "pg";
import { amount, nativeAssetId } from "../src/domain/amount.js";
import { Ledger } from "../src/ledger/ledger.js";
import { migrate } from "../src/ledger/migrate.js";
import { eoaApprovalTypedData, prepareEoaLegApproval } from "../src/execution/eoa.js";
import { EoaExecutionStore } from "../src/execution/store.js";
import { prepareBscBalanceEvidence } from "../src/execution/bsc-recovery.js";
import { parseRecoveryConfig, recoveryConfigurationRecord, resolveRecoveryAssets } from "../src/execution/recovery-config.js";
import { runBscRecoveryOnce } from "../src/execution/recovery-worker.js";
import { fixture } from "./market-gate.test.js";
import { RECOVERY_BEACON_SLOT } from "../src/execution/recovery-contracts.js";
import { syntheticTokenSecurity } from "./token-security-fixture.js";

const native = { assetId: nativeAssetId(56), decimals: 18 };
const config = parseRecoveryConfig({ version: 1, registryVersion: "fixture-v1", finalityBlocks: "12",
  sources: [{ id: "primary", rpcUrl: "https://primary.example.invalid" },
    { id: "backup", rpcUrl: "https://backup.example.invalid" }],
  assets: [{ ...native, semantics: "native-gas", review: "fixture-review" }] });

test("P7 recovery configuration rejects ambiguous source, chain and token semantics", () => {
  for (const change of [{ finalityBlocks: "0" }, { finalityBlocks: 12 }, { extra: true },
    { sources: [{ id: "primary", rpcUrl: "https://example.invalid/?key=secret" }] },
    { sources: [{ id: "primary", rpcUrl: "http://example.invalid" }] },
    { sources: [config.sources[0], config.sources[0]] },
    { assets: [{ ...native, semantics: "rebasing", review: "fixture" }] },
    { assets: [{ assetId: "eip155:1/native", decimals: 18, semantics: "native-gas", review: "fixture" }] }]) {
    assert.throws(() => parseRecoveryConfig({ ...config, ...change }));
  }
  assert.equal(Object.isFrozen(config), true);
  assert.equal(Object.isFrozen(config.assets), true);
  assert.equal(recoveryConfigurationRecord(config).hash, recoveryConfigurationRecord(config).hash);
  assert.notEqual(recoveryConfigurationRecord(config).hash,
    recoveryConfigurationRecord({ ...config, finalityBlocks: "13" }).hash);
  assert.equal(JSON.stringify(recoveryConfigurationRecord(config)).includes("https://"), false);
});

const databaseUrl = process.env.TEST_DATABASE_URL;
const pgOptions = { skip: !databaseUrl && "Set TEST_DATABASE_URL for real PostgreSQL integration tests." };
const blockHash = `0x${"b".repeat(64)}`;
const reorgHash = `0x${"c".repeat(64)}`;
const topic = (address: string): string => `0x${address.slice(2).toLowerCase().padStart(64, "0")}`;

async function withLeg(run: (value: Awaited<ReturnType<typeof seedLeg>>) => Promise<void>, canonical = false): Promise<void> {
  const admin = new Pool({ connectionString: databaseUrl });
  const schema = `nexus_worker_${randomUUID().replaceAll("-", "")}`;
  await admin.query(`CREATE SCHEMA ${schema}`);
  const pool = new Pool({ connectionString: databaseUrl, options: `-c search_path=${schema}`, max: 3 });
  try {
    await migrate(pool);
    await migrate(pool);
    await run(await seedLeg(pool, canonical));
  } finally {
    await pool.end();
    await admin.query(`DROP SCHEMA ${schema} CASCADE`);
    await admin.end();
  }
}

/** Replace only synthetic fixture token identities; eligibility/prices stay synthetic. */
function canonicalFixture<T>(value: T): T {
  if (typeof value === "string") return value.replaceAll("2".repeat(40), "55d398326f99059ff775485246999027b3197955")
    .replaceAll("3".repeat(40), "02fca66c1d1afb4e2a7884261eb00f63598a7436") as T;
  if (Array.isArray(value)) return value.map(canonicalFixture) as T;
  if (value !== null && typeof value === "object") return Object.fromEntries(
    Object.entries(value).map(([key, item]) => [key, canonicalFixture(item)])) as T;
  return value;
}

async function seedLeg(pool: Pool, canonical = false) {
  const owner = Wallet.createRandom();
  let gate = canonical ? canonicalFixture(fixture(owner.address)) : fixture(owner.address);
  if (canonical) gate = { ...gate, evidence: { ...gate.evidence, tokenSecurity: [
    syntheticTokenSecurity(gate.instrument.assetId), syntheticTokenSecurity(gate.snapshot.confirmedCash.assetId) ] } };
  const store = new EoaExecutionStore(pool);
  const ledger = new Ledger(pool);
  await ledger.createPortfolio({ id: "portfolio-one", chainId: 56,
    settlement: gate.snapshot.confirmedCash,
    balances: [gate.snapshot.confirmedCash, amount(100n * 10n ** 18n, native)] });
  await store.bindOwnerWallet("portfolio-one", owner.address, 0n);
  await store.setPaused("portfolio-one", 1n, false);
  await ledger.reservePlan({ portfolioId: "portfolio-one", planId: "plan-one",
    occurrenceId: "occ-one", idempotencyKey: "key-one", expectedRevision: 2n,
    leaseUntil: new Date(Date.now() + 60_000), reservations: [{ id: "reservation-one",
      amount: gate.proposal.side === "buy" ? gate.proposal.spend : gate.proposal.raw }] });
  await ledger.startExecution("portfolio-one", "plan-one");
  const freshRequest = { ...gate, snapshot: { ...gate.snapshot, revision: 2n } };
  const expected = { portfolioId: "portfolio-one", planId: "plan-one", legId: "leg-one",
    policyHash: `0x${"a".repeat(64)}`, transactionNonce: 7, authorizationNonce: "auth-one",
    maxGasLimit: 300_000n, maxFeePerGas: 5_000_000_000n, expiresAt: "2026-09-28T14:03:00Z" };
  const approval = prepareEoaLegApproval(freshRequest, expected);
  const typed = eoaApprovalTypedData(approval);
  const ownerSignature = await owner.signTypedData(typed.domain, typed.types, typed.value);
  const rawSignedTransaction = await owner.signTransaction({ type: 2, chainId: 56, nonce: 7,
    to: approval.router, data: approval.calldata, value: approval.value,
    gasLimit: 250_000n, maxFeePerGas: 4_000_000_000n, maxPriorityFeePerGas: 1_000_000_000n });
  const input = { reservationId: "reservation-one", approval, ownerSignature,
    rawSignedTransaction, freshRequest, expected };
  const prepared = await store.persistSignedLeg(input);
  await store.claimBroadcastOnce(input); // Synthetic persisted claim; no network send.
  let reviewed = parseRecoveryConfig({ ...config, assets: [config.assets[0],
    { assetId: gate.snapshot.confirmedCash.assetId, decimals: 18, semantics: "erc20-transfer-net", review: "fixture-input" },
    { assetId: gate.instrument.assetId, decimals: 18, semantics: "erc20-transfer-net", review: "fixture-output" }] });
  const codeByAddress = new Map<string, string>();
  let reviewedBeacon = "", reviewedImplementation = "";
  if (canonical) {
    const deployment = parseRecoveryConfig(JSON.parse(readFileSync("config/bsc-recovery.json", "utf8")));
    // Synthetic RPC bytecode is explicitly pinned for this DB test. The actual
    // deployment code hashes are independently checked by live smoke evidence.
    reviewed = parseRecoveryConfig({ ...deployment, sources: config.sources,
      assets: deployment.assets.map(asset => {
        if (!asset.contract) return asset;
        const token = asset.assetId.split("erc20:")[1]!;
        codeByAddress.set(token, asset.contract.kind === "runtime" ? "0x6000" : "0x6001");
        if (asset.contract.kind === "runtime") return { ...asset,
          contract: { ...asset.contract, codeHash: keccak256("0x6000") } };
        reviewedBeacon = asset.contract.beacon; reviewedImplementation = asset.contract.implementation;
        codeByAddress.set(reviewedBeacon, "0x6002"); codeByAddress.set(reviewedImplementation, "0x6003");
        return { ...asset, contract: { ...asset.contract, codeHash: keccak256("0x6001"),
          beaconCodeHash: keccak256("0x6002"), implementationCodeHash: keccak256("0x6003") } };
      }) });
  }
  const gasUsed = 210_000n, gasPrice = 3_000_000_000n;
  const transfer = (token: string, from: string, to: string, units: bigint, index: number, hash: string) => ({
    address: token, topics: [id("Transfer(address,address,uint256)"), topic(from), topic(to)],
    data: `0x${units.toString(16).padStart(64, "0")}`, transactionHash: prepared.hash,
    blockNumber: "0x64", blockHash: hash, logIndex: `0x${index.toString(16)}`, removed: false });
  type Mode = "ok" | "offline" | "archive-unavailable" | "bad-proof" | "missing" | "reorg" | "reverted" | "code-changed";
  const methods: string[] = [];
  const rpc = (primary: Mode = "ok", backup: Mode = "ok"): typeof fetch => (async (url, init) => {
    const body = JSON.parse(String(init?.body)) as { id: number; method: string; params: unknown[] };
    methods.push(body.method);
    const mode = String(url).includes("primary") ? primary : backup;
    if (mode === "offline" || (mode === "archive-unavailable" && body.method === "eth_call"))
      return new Response("{}", { status: 503 });
    const hash = mode === "reorg" ? reorgHash : blockHash;
    const reverted = mode === "reverted";
    const result = body.method === "eth_chainId" ? "0x38"
      : body.method === "eth_blockNumber" ? "0x6f"
      : body.method === "eth_getTransactionCount" ? "0x8"
      : body.method === "eth_getTransactionReceipt" ? mode === "missing" ? null : {
        transactionHash: prepared.hash, from: owner.address, to: approval.router,
        blockNumber: "0x64", blockHash: hash, status: reverted ? "0x0" : "0x1",
        gasUsed: `0x${gasUsed.toString(16)}`, effectiveGasPrice: `0x${gasPrice.toString(16)}`,
        logs: reverted ? [] : [transfer(approval.tokenIn, owner.address, approval.router,
          5n * 10n ** 18n, 0, hash), ...(mode === "bad-proof" ? [] : [transfer(approval.tokenOut,
          approval.router, owner.address, 25n * 10n ** 15n, 1, hash), ...(canonical ? [{
            ...transfer(approval.tokenOut, approval.router, owner.address, 25n * 10n ** 15n, 2, hash),
            topics: [id("TransferWithUIAmount(address,address,uint256,uint256)"), topic(approval.router), topic(owner.address)],
            data: `0x${(25n * 10n ** 15n).toString(16).padStart(64, "0")}${(50n * 10n ** 15n).toString(16).padStart(64, "0")}`
          }] : [])])] }
        : body.method === "eth_getBlockByNumber" ? { number: "0x64", hash }
          : body.method === "eth_getBalance" ? `0x${(100n * 10n ** 18n - gasUsed * gasPrice).toString(16)}`
            : body.method === "eth_getCode" ? mode === "code-changed" && body.params[0] === reviewedImplementation
              ? "0x6005" : codeByAddress.get(String(body.params[0]))
              : body.method === "eth_getStorageAt" ? body.params[1] === RECOVERY_BEACON_SLOT
                ? `0x${reviewedBeacon.slice(2).padStart(64, "0")}` : `0x${"0".repeat(64)}`
                : body.method === "eth_call" ? (body.params[0] as { data: string }).data === "0x313ce567"
                  ? `0x${"12".padStart(64, "0")}`
                  : (body.params[0] as { data: string }).data === "0x5c60da1b"
                    ? `0x${reviewedImplementation.slice(2).padStart(64, "0")}`
                    : `0x${((body.params[0] as { to: string }).to.toLowerCase()
              === approval.tokenIn.toLowerCase() ? (reverted ? 100n : 95n) * 10n ** 18n
              : reverted ? 0n : 25n * 10n ** 15n).toString(16).padStart(64, "0")}` : null;
    return new Response(JSON.stringify({ jsonrpc: "2.0", id: body.id, result }), { status: 200 });
  }) as typeof fetch;
  const state = async () => (await pool.query<{ revision: string; execution_paused: boolean;
    state: string; reconciled: boolean }>(`SELECT p.revision, p.execution_paused, r.state,
      l.reconciled_at IS NOT NULL reconciled FROM portfolios p JOIN reservations r ON r.portfolio_id = p.id
      JOIN eoa_execution_legs l ON l.reservation_id = r.id WHERE p.id = 'portfolio-one'`)).rows[0]!;
  return { pool, store, reviewed, rpc, methods, prepared, rawSignedTransaction, state };
}

test("P7 PostgreSQL USDT/NVDAB registry recovery rejects upgrades and repeats code checks before fill", pgOptions, async () => {
  await withLeg(async ({ pool, reviewed, rpc, methods, state }) => {
    const blocked = await runBscRecoveryOnce(pool, reviewed, rpc("code-changed"));
    assert.equal(blocked[0]?.reason, "RECOVERY_CONTRACT_CHANGED");
    assert.equal(blocked[0]?.outcome, "manual-review");
    assert.equal((await state()).state, "submitted");
    assert.equal((await state()).revision, "2");
    const base = rpc(); let proxyReads = 0;
    const changesAfterProof = (async (url, init) => {
      const body = JSON.parse(String(init?.body)) as { method: string; params: unknown[] };
      if (body.method === "eth_getCode" && body.params[0] === "0x02fca66c1d1afb4e2a7884261eb00f63598a7436" && ++proxyReads === 2)
        return new Response(JSON.stringify({ jsonrpc: "2.0", ...JSON.parse(String(init?.body)), result: "0x6005" }));
      return base(url, init);
    }) as typeof fetch;
    assert.equal((await runBscRecoveryOnce(pool, reviewed, changesAfterProof))[0]?.reason, "RECOVERY_CONTRACT_CHANGED");
    assert.equal((await state()).revision, "2");
    const recovered = await runBscRecoveryOnce(pool, reviewed, rpc("archive-unavailable"));
    assert.equal(recovered[0]?.outcome, "reconciled");
    assert.equal(recovered[0]?.sourceId, "backup");
    assert.equal((await state()).revision, "3");
    assert.ok(methods.includes("eth_getCode"));
    const attempt = await pool.query("SELECT configuration FROM eoa_recovery_attempts WHERE outcome = 'reconciled'");
    assert.equal(attempt.rows[0]?.configuration.assets[2].review, "nvdab-raw-transfer-2026-09-30");
    assert.equal(attempt.rows[0]?.configuration.assets[2].contract.kind, "beacon");
    assert.equal((await runBscRecoveryOnce(pool, reviewed, base))[0]?.outcome, "monitored");
    assert.equal((await state()).revision, "3");
  }, true);
});

test("P7 PostgreSQL production recovery restarts, fails over whole proof and counts a fill once", pgOptions, async () => {
  await withLeg(async ({ pool, reviewed, rpc, state, prepared, rawSignedTransaction, methods }) => {
    // A prior worker died after observing inclusion, before reconciliation.
    await new EoaExecutionStore(pool).recordChainObservation("portfolio-one", "leg-one", {
      headBlock: 111n, latestNonce: 8n, receipt: { hash: prepared.hash, blockNumber: 100n,
        blockHash, success: true }, replacement: null }, 12n);
    const candidate = await prepareBscBalanceEvidence(new EoaExecutionStore(pool), {
      portfolioId: "portfolio-one", legId: "leg-one", rpcUrl: reviewed.sources[0]!.rpcUrl,
      finalityBlocks: 12n, async resolveTrackedAssets(context) { return resolveRecoveryAssets(reviewed, context); }
    }, rpc());
    assert.ok(candidate);
    await assert.rejects(new EoaExecutionStore(pool).reconcileFinalizedLeg({ ...candidate,
      recoverySource: { attemptId: randomUUID(), sourceId: "primary" } }), { code: "INVALID_RECOVERY_SOURCE" });
    assert.equal((await state()).state, "submitted");
    assert.equal((await state()).revision, "2");
    const result = await runBscRecoveryOnce(pool, reviewed, rpc("archive-unavailable"));
    assert.deepEqual(result, [{ legId: "leg-one", outcome: "reconciled",
      reason: "RECEIPT_EFFECTS_APPLIED_ONCE", sourceId: "backup" }]);
    assert.deepEqual(await state(), { revision: "3", execution_paused: false, state: "consumed", reconciled: true });
    assert.equal((await runBscRecoveryOnce(pool, reviewed, rpc()))[0]?.outcome, "monitored");
    assert.equal((await state()).revision, "3");
    const evidence = await pool.query<{ source_id: string; kind: string; block_number: string; block_hash: string }>(
      "SELECT source_id, kind, block_number, block_hash FROM eoa_recovery_evidence ORDER BY id");
    assert.deepEqual(evidence.rows.map(row => [row.source_id, row.kind]),
      [["primary", "observation"], ["backup", "observation"], ["backup", "reconciliation"], ["primary", "observation"]]);
    assert.ok(evidence.rows.every(row => row.block_number === "100" && row.block_hash === blockHash));
    const attempts = await pool.query("SELECT configuration_hash, configuration, outcome, reason FROM eoa_recovery_attempts");
    assert.equal(attempts.rows[0]?.configuration_hash, recoveryConfigurationRecord(reviewed).hash);
    assert.equal(attempts.rows[0]?.configuration.registryVersion, "fixture-v1");
    assert.equal(JSON.stringify(attempts.rows).includes(rawSignedTransaction), false);
    assert.equal(methods.some(method => /send|sign/i.test(method)), false);
  });
});

test("P7 PostgreSQL recovery refuses unsupported registry, bad effects and consumed nonce ambiguity", pgOptions, async () => {
  await withLeg(async ({ pool, reviewed, rpc, state, store }) => {
    assert.equal((await runBscRecoveryOnce(pool, reviewed, rpc("offline", "offline")))[0]?.outcome, "unavailable");
    assert.equal((await state()).revision, "2");
    assert.equal((await runBscRecoveryOnce(pool, reviewed, rpc("missing")))[0]?.reason, "NONCE_USED_UNKNOWN");
    const current = await store.loadRecoveryContext("portfolio-one", "leg-one");
    assert.throws(() => resolveRecoveryAssets(config, current), { code: "UNREVIEWED_RECOVERY_ASSET" });
    assert.equal((await runBscRecoveryOnce(pool, config, rpc()))[0]?.reason, "UNREVIEWED_RECOVERY_ASSET");
    const bad = await runBscRecoveryOnce(pool, reviewed, rpc("bad-proof"));
    assert.equal(bad[0]?.outcome, "manual-review");
    assert.equal(bad[0]?.reason, "RECEIPT_EFFECT_MISMATCH");
    assert.deepEqual(await state(), { revision: "2", execution_paused: false, state: "submitted", reconciled: false });
    const fills = await pool.query("SELECT id FROM eoa_recovery_evidence WHERE kind = 'reconciliation'");
    assert.equal(fills.rowCount, 0);
    // A forged provenance binding rolls back the otherwise valid observation.
    await assert.rejects(store.recordChainObservation("portfolio-one", "leg-one", {
      headBlock: 111n, latestNonce: 8n, receipt: null, replacement: null }, 12n,
    { attemptId: randomUUID(), sourceId: "primary" }), { code: "INVALID_RECOVERY_SOURCE" });
    assert.equal((await store.loadRecoveryContext("portfolio-one", "leg-one")).state, "confirmed");
  });
});

test("P7 PostgreSQL recovery excludes concurrent workers and pauses a deep reorg once", pgOptions, async () => {
  await withLeg(async ({ pool, reviewed, rpc, state }) => {
    let entered!: () => void, resume!: () => void;
    const barrier = new Promise<void>(resolve => { entered = resolve; });
    const release = new Promise<void>(resolve => { resume = resolve; });
    let held = false;
    const base = rpc();
    const slow = (async (url, init) => {
      if (!held) { held = true; entered(); await release; }
      return base(url, init);
    }) as typeof fetch;
    const first = runBscRecoveryOnce(pool, reviewed, slow);
    await barrier;
    const second = await runBscRecoveryOnce(pool, reviewed, base);
    assert.equal(second[0]?.outcome, "busy");
    resume();
    assert.equal((await first)[0]?.outcome, "reconciled");
    assert.equal((await state()).revision, "3");
    assert.equal((await runBscRecoveryOnce(pool, reviewed, rpc("missing")))[0]?.outcome, "manual-review");
    assert.deepEqual(await state(), { revision: "4", execution_paused: true, state: "consumed", reconciled: true });
    assert.equal((await runBscRecoveryOnce(pool, reviewed, base))[0]?.outcome, "manual-review");
    assert.equal((await state()).revision, "4");
  });
});

test("P7 PostgreSQL recovery rejects contradictory fallback receipt before a fill and pauses", pgOptions, async () => {
  await withLeg(async ({ pool, reviewed, rpc, state }) => {
    const result = await runBscRecoveryOnce(pool, reviewed, rpc("archive-unavailable", "reorg"));
    assert.equal(result[0]?.reason, "REORGED");
    assert.equal(result[0]?.outcome, "manual-review");
    assert.deepEqual(await state(), { revision: "3", execution_paused: true, state: "submitted", reconciled: false });
    const fills = await pool.query("SELECT id FROM eoa_recovery_evidence WHERE kind = 'reconciliation'");
    assert.equal(fills.rowCount, 0);
  });
});

test("P7 PostgreSQL recovery reconciles a proved revert with gas loss and released reservation", pgOptions, async () => {
  await withLeg(async ({ pool, reviewed, rpc, state }) => {
    assert.equal((await runBscRecoveryOnce(pool, reviewed, rpc("reverted")))[0]?.outcome, "reconciled");
    assert.deepEqual(await state(), { revision: "3", execution_paused: false, state: "released", reconciled: true });
    const amounts = await pool.query<{ spent_raw: string; received_raw: string }>(
      "SELECT spent_raw, received_raw FROM eoa_execution_legs WHERE id = 'leg-one'");
    assert.deepEqual(amounts.rows[0], { spent_raw: "0", received_raw: "0" });
  });
});

test("P7 PostgreSQL lost recovery connection cannot apply; fresh worker resumes after crash", pgOptions, async () => {
  await withLeg(async ({ pool, reviewed, rpc, state }) => {
    const base = rpc();
    let killed = false;
    const interrupted = (async (url, init) => {
      const body = JSON.parse(String(init?.body)) as { method: string };
      if (!killed && body.method === "eth_getBalance") {
        killed = true;
        // Match only this isolated test schema's exact 64-bit advisory key.
        const owners = (await pool.query<{ pid: number }>(`
          SELECT l.pid FROM pg_locks l
          WHERE l.locktype = 'advisory' AND l.granted AND l.objsubid = 1
            AND l.database = (SELECT oid FROM pg_database WHERE datname = current_database())
            AND l.classid::bigint = ((hashtextextended(current_schema() || 'nexus-eoa-recovery:portfolio-one', 0) >> 32) & 4294967295)
            AND l.objid::bigint = (hashtextextended(current_schema() || 'nexus-eoa-recovery:portfolio-one', 0) & 4294967295)`)).rows;
        assert.equal(owners.length, 1);
        await pool.query("SELECT pg_terminate_backend($1)", [owners[0]!.pid]);
      }
      return base(url, init);
    }) as typeof fetch;
    await assert.rejects(runBscRecoveryOnce(pool, reviewed, interrupted));
    assert.equal(killed, true);
    assert.equal((await state()).revision, "2");
    const interruptedAttempts = await pool.query("SELECT outcome, finished_at FROM eoa_recovery_attempts");
    assert.deepEqual(interruptedAttempts.rows, [{ outcome: "started", finished_at: null }]);
    assert.equal((await runBscRecoveryOnce(pool, reviewed, base))[0]?.outcome, "reconciled");
    assert.equal((await state()).revision, "3");
    assert.equal((await runBscRecoveryOnce(pool, reviewed, base))[0]?.outcome, "monitored");
    assert.equal((await state()).revision, "3");
  });
});

test("P7 PostgreSQL fill survives failure before attempt completion and restart never applies twice", pgOptions, async () => {
  await withLeg(async ({ pool, reviewed, rpc, state }) => {
    await pool.query(`CREATE FUNCTION interrupt_attempt_finish() RETURNS trigger LANGUAGE plpgsql AS $$
      BEGIN RAISE EXCEPTION 'synthetic crash after fill'; END; $$`);
    await pool.query(`CREATE TRIGGER interrupt_attempt_finish BEFORE UPDATE ON eoa_recovery_attempts
      FOR EACH ROW EXECUTE FUNCTION interrupt_attempt_finish()`);
    await assert.rejects(runBscRecoveryOnce(pool, reviewed, rpc()));
    assert.deepEqual(await state(), { revision: "3", execution_paused: false, state: "consumed", reconciled: true });
    const attempts = await pool.query("SELECT outcome, finished_at FROM eoa_recovery_attempts");
    assert.deepEqual(attempts.rows, [{ outcome: "started", finished_at: null }]);
    const evidence = await pool.query("SELECT id FROM eoa_recovery_evidence WHERE kind = 'reconciliation'");
    assert.equal(evidence.rowCount, 1);
    await pool.query("DROP TRIGGER interrupt_attempt_finish ON eoa_recovery_attempts");
    assert.equal((await runBscRecoveryOnce(pool, reviewed, rpc()))[0]?.outcome, "monitored");
    assert.equal((await state()).revision, "3");
  });
});
