import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import { Wallet, id } from "ethers";
import { Pool } from "pg";
import { amount, nativeAssetId } from "../src/domain/amount.js";
import { Ledger } from "../src/ledger/ledger.js";
import { migrate } from "../src/ledger/migrate.js";
import { EoaExecutionStore } from "../src/execution/store.js";
import { prepareBscBalanceEvidence,
  reconcileBscLeg } from "../src/execution/bsc-recovery.js";
import { eoaApprovalTypedData, prepareEoaLegApproval } from "../src/execution/eoa.js";
import { fixture } from "./market-gate.test.js";

const databaseUrl = process.env.TEST_DATABASE_URL;
const policyHash = `0x${"a".repeat(64)}`;

test("P7 PostgreSQL persists signed EOA bytes before a one-time broadcast claim",
  { skip: !databaseUrl && "Set TEST_DATABASE_URL for real PostgreSQL integration tests." }, async () => {
    const admin = new Pool({ connectionString: databaseUrl });
    const schema = `nexus_p7_${randomUUID().replaceAll("-", "")}`;
    await admin.query(`CREATE SCHEMA ${schema}`);
    const pool = new Pool({ connectionString: databaseUrl, options: `-c search_path=${schema}` });
    try {
      await migrate(pool);
      await migrate(pool);
      const owner = Wallet.createRandom();
      const gate = fixture(owner.address);
      const store = new EoaExecutionStore(pool);
      const ledger = new Ledger(pool);
      const native = { assetId: nativeAssetId(56), decimals: 18 };
      await ledger.createPortfolio({ id: "portfolio-one", chainId: 56,
        settlement: gate.snapshot.confirmedCash,
        balances: [gate.snapshot.confirmedCash, amount(100n * 10n ** 18n, native)] });
      assert.equal(await store.bindOwnerWallet("portfolio-one", owner.address, 0n), 1n);
      assert.equal(await store.setPaused("portfolio-one", 1n, false), 2n);
      await ledger.reservePlan({ portfolioId: "portfolio-one", planId: "plan-one",
        occurrenceId: "occ-one", idempotencyKey: "key-one", expectedRevision: 2n,
        leaseUntil: new Date(Date.now() + 60_000), reservations: [{ id: "reservation-one",
          amount: gate.proposal.side === "buy" ? gate.proposal.spend : gate.proposal.raw }] });
      await ledger.startExecution("portfolio-one", "plan-one");
      const freshRequest = { ...gate, snapshot: { ...gate.snapshot, revision: 2n } };
      const expected = { portfolioId: "portfolio-one", planId: "plan-one", legId: "leg-one",
        policyHash, transactionNonce: 7, authorizationNonce: "auth-one",
        maxGasLimit: 300_000n, maxFeePerGas: 5_000_000_000n,
        expiresAt: "2026-09-28T14:03:00Z" };
      const approval = prepareEoaLegApproval(freshRequest, expected);
      const typed = eoaApprovalTypedData(approval);
      const ownerSignature = await owner.signTypedData(typed.domain, typed.types, typed.value);
      const rawSignedTransaction = await owner.signTransaction({ type: 2, chainId: 56, nonce: 7,
        to: approval.router, data: approval.calldata, value: approval.value,
        gasLimit: 250_000n, maxFeePerGas: 4_000_000_000n,
        maxPriorityFeePerGas: 1_000_000_000n });
      const input = { reservationId: "reservation-one", approval, ownerSignature,
        rawSignedTransaction, freshRequest, expected };
      const prepared = await store.persistSignedLeg(input);
      assert.equal(prepared.replay, false);
      assert.equal((await store.persistSignedLeg(input)).replay, true);
      const stored = await pool.query<{ state: string; signed_transaction: string; tx_hash: string }>(
        "SELECT state, signed_transaction, tx_hash FROM eoa_execution_legs WHERE id = 'leg-one'");
      assert.equal(stored.rows[0]?.state, "signed");
      assert.equal(stored.rows[0]?.signed_transaction, rawSignedTransaction);
      assert.equal(stored.rows[0]?.tx_hash, prepared.hash);
      const context = await new EoaExecutionStore(pool).loadRecoveryContext(
        "portfolio-one", "leg-one");
      assert.equal(context.transactionHash, prepared.hash);
      assert.equal(context.wallet, owner.address.toLowerCase());
      assert.equal(context.nonce, 7n);
      assert.deepEqual(new Set(context.balances.map(value => value.assetId)),
        new Set([gate.snapshot.confirmedCash.assetId, native.assetId]));
      const reservation = await pool.query<{ state: string }>(
        "SELECT state FROM reservations WHERE id = 'reservation-one'");
      assert.equal(reservation.rows[0]?.state, "submitted");
      // A restarted worker may claim a persisted leg; another restart cannot claim it again.
      const firstClaim = await new EoaExecutionStore(pool).claimBroadcastOnce(input);
      assert.deepEqual(firstClaim, { hash: prepared.hash, rawSignedTransaction });
      assert.equal(await new EoaExecutionStore(pool).claimBroadcastOnce(input), null);
      const afterClaimCrash = await new EoaExecutionStore(pool).recordChainObservation(
        "portfolio-one", "leg-one", { headBlock: 99n, latestNonce: 7n,
          receipt: null, replacement: null }, 12n);
      assert.equal(afterClaimCrash.state, "unknown");
      assert.equal(await new EoaExecutionStore(pool).claimBroadcastOnce(input), null);
      await assert.rejects(ledger.recordBalances("portfolio-one", 2n,
        [gate.snapshot.confirmedCash], "external"), { code: "UNRESOLVED_SUBMISSION" });
      const blockHash = `0x${"b".repeat(64)}`;
      const minedObservation = {
        headBlock: 111n, latestNonce: 8n, replacement: null,
        receipt: { hash: prepared.hash, blockNumber: 100n, blockHash, success: true }
      };
      const observed = await new EoaExecutionStore(pool).recordChainObservation(
        "portfolio-one", "leg-one", minedObservation, 12n);
      assert.equal(observed.state, "confirmed");
      assert.equal((await new EoaExecutionStore(pool).recordChainObservation(
        "portfolio-one", "leg-one", minedObservation, 12n)).state, "confirmed");
      const beforeReconcile = await pool.query<{ revision: string; state: string }>(`
        SELECT p.revision, r.state FROM portfolios p JOIN reservations r
          ON r.portfolio_id = p.id WHERE r.id = 'reservation-one'`);
      assert.deepEqual(beforeReconcile.rows[0], { revision: "2", state: "submitted" });
      const gasUsed = 210_000n, effectiveGasPrice = 3_000_000_000n;
      const after = [amount(95n * 10n ** 18n, gate.snapshot.confirmedCash),
        amount(25n * 10n ** 15n, gate.instrument),
        amount(100n * 10n ** 18n - gasUsed * effectiveGasPrice, native)];
      const topic = (address: string): string => `0x${address.slice(2).toLowerCase().padStart(64, "0")}`;
      const transfer = (token: string, from: string, to: string, units: bigint, index: number) => ({
        address: token, topics: [id("Transfer(address,address,uint256)"),
          topic(from), topic(to)], data: `0x${units.toString(16).padStart(64, "0")}`,
        transactionHash: prepared.hash, blockHash, blockNumber: "0x64",
        logIndex: `0x${index.toString(16)}`, removed: false });
      const rpc = (async (_url, init) => {
        const body = JSON.parse(String(init?.body)) as {
          id: number; method: string; params: unknown[] };
        const result = body.method === "eth_chainId" ? "0x38"
          : body.method === "eth_blockNumber" ? "0x6f"
          : body.method === "eth_getTransactionCount" ? "0x8"
          : body.method === "eth_getTransactionReceipt"
            ? { transactionHash: prepared.hash, from: owner.address,
              to: approval.router, blockNumber: "0x64", blockHash, status: "0x1",
              gasUsed: `0x${gasUsed.toString(16)}`,
              effectiveGasPrice: `0x${effectiveGasPrice.toString(16)}`,
              logs: [transfer(approval.tokenIn, owner.address, approval.router,
                5n * 10n ** 18n, 0),
                transfer(approval.tokenOut, approval.router, owner.address,
                  25n * 10n ** 15n, 1)] }
            : body.method === "eth_getBlockByNumber"
              ? { number: "0x64", hash: blockHash }
              : body.method === "eth_getBalance" ? `0x${after[2]!.units.toString(16)}`
              : body.method === "eth_call" ? `0x${((body.params[0] as { to: string }).to
                .toLowerCase() === approval.tokenIn.toLowerCase() ? after[0]!.units
                : after[1]!.units).toString(16).padStart(64, "0")}` : null;
        return new Response(JSON.stringify({ jsonrpc: "2.0", id: body.id, result }), { status: 200 });
      }) as typeof fetch;
      const recoveryRequest = {
        portfolioId: "portfolio-one", legId: "leg-one",
        rpcUrl: "https://rpc.example.invalid", finalityBlocks: 12n,
        async resolveTrackedAssets() { return [gate.snapshot.confirmedCash,
          gate.instrument, native]; }
      };
      const finalized = await prepareBscBalanceEvidence(new EoaExecutionStore(pool),
        recoveryRequest, rpc);
      assert.ok(finalized);
      assert.deepEqual(finalized.balances, after);
      await assert.rejects(store.reconcileFinalizedLeg({ ...finalized, sourceBlock: 101n }),
        { code: "UNFINALIZED_LEG" });
      await assert.rejects(store.reconcileFinalizedLeg({ ...finalized, balances: after.slice(0, 2) }),
        { code: "MISSING_BALANCE" });
      await assert.rejects(store.reconcileFinalizedLeg({ ...finalized,
        receiptEffects: { ...finalized.receiptEffects,
          logs: finalized.receiptEffects.logs.slice(0, 1) } }),
      { code: "RECEIPT_EFFECT_MISMATCH" });
      const incompleteRpc = (async (url, init) => {
        const response = await rpc(url, init);
        const request = JSON.parse(String(init?.body)) as { method: string };
        if (request.method !== "eth_getTransactionReceipt") return response;
        const body = await response.json() as { result: Record<string, unknown> };
        delete body.result.effectiveGasPrice;
        return new Response(JSON.stringify(body), { status: 200 });
      }) as typeof fetch;
      assert.equal(await reconcileBscLeg(new EoaExecutionStore(pool),
        recoveryRequest, incompleteRpc), null);
      const heldAfterBadProof = await pool.query<{ revision: string; state: string }>(`
        SELECT p.revision, r.state FROM portfolios p JOIN reservations r
          ON r.portfolio_id = p.id WHERE r.id = 'reservation-one'`);
      assert.deepEqual(heldAfterBadProof.rows[0], { revision: "2", state: "submitted" });
      const reconciled = await reconcileBscLeg(new EoaExecutionStore(pool),
        recoveryRequest, rpc);
      assert.deepEqual(reconciled, { revision: 3n, spent: 5n * 10n ** 18n,
        received: 25n * 10n ** 15n });
      await assert.rejects(store.reconcileFinalizedLeg(finalized), { code: "STALE_REVISION" });
      const savedProof = await pool.query<{ receipt_effects_hash: string | null }>(
        "SELECT receipt_effects_hash FROM eoa_execution_legs WHERE id = 'leg-one'");
      assert.match(savedProof.rows[0]?.receipt_effects_hash ?? "", /^[0-9a-f]{64}$/);
      const states = await pool.query<{ state: string; status: string }>(`
        SELECT r.state, p.status FROM reservations r JOIN plans p ON p.id = r.plan_id
        WHERE r.id = 'reservation-one'`);
      assert.deepEqual(states.rows[0], { state: "consumed", status: "completed" });
      const deepReorg = await store.recordChainObservation("portfolio-one", "leg-one", {
        headBlock: 112n, latestNonce: 8n, receipt: null, replacement: null
      }, 12n);
      assert.equal(deepReorg.state, "reorged");
      const paused = await pool.query<{ revision: string; execution_paused: boolean }>(
        "SELECT revision, execution_paused FROM portfolios WHERE id = 'portfolio-one'");
      assert.deepEqual(paused.rows[0], { revision: "4", execution_paused: true });
      await assert.rejects(store.setPaused("portfolio-one", 4n, false),
        { code: "UNRESOLVED_SUBMISSION" });
      const transaction = await pool.query<{ state: string }>(
        "SELECT state FROM transactions WHERE id = $1", [prepared.hash]);
      assert.equal(transaction.rows[0]?.state, "unknown");
      assert.equal((await store.recordChainObservation("portfolio-one", "leg-one", {
        headBlock: 113n, latestNonce: 8n, receipt: null, replacement: null
      }, 12n)).state, "reorged");
      const afterReplay = await pool.query<{ revision: string }>(
        "SELECT revision FROM portfolios WHERE id = 'portfolio-one'");
      assert.equal(afterReplay.rows[0]?.revision, "4");
    } finally {
      await pool.end();
      await admin.query(`DROP SCHEMA ${schema} CASCADE`);
      await admin.end();
    }
  });
