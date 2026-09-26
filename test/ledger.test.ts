import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import { Pool } from "pg";
import { amount, tokenAssetId } from "../src/domain/amount.js";
import { DomainError } from "../src/domain/errors.js";
import { Ledger, type ReservePlanInput } from "../src/ledger/ledger.js";
import { migrate } from "../src/ledger/migrate.js";
import { runOutboxOnce } from "../src/ledger/worker.js";

const databaseUrl = process.env.TEST_DATABASE_URL;
const usdt = { assetId: tokenAssetId(56, "0x1111111111111111111111111111111111111111"), decimals: 18 };
const equity = { assetId: tokenAssetId(56, "0x2222222222222222222222222222222222222222"), decimals: 18 };
const units = (value: bigint) => amount(value, usdt);
const lease = () => new Date(Date.now() + 60_000);

function request(portfolioId: string, suffix: string, value: bigint): ReservePlanInput {
  return {
    portfolioId, planId: `plan-${suffix}`, occurrenceId: `occ-${suffix}`,
    idempotencyKey: `key-${suffix}`, expectedRevision: 0n, leaseUntil: lease(),
    reservations: [{ id: `reservation-${suffix}`, amount: units(value) }]
  };
}

function code(expected: string): (error: unknown) => boolean {
  return (error) => error instanceof DomainError && error.code === expected;
}

test("P3 PostgreSQL migrations, concurrency, rollback, replay and recovery", { skip: !databaseUrl && "Set TEST_DATABASE_URL for real PostgreSQL integration tests." }, async (t) => {
  const admin = new Pool({ connectionString: databaseUrl });
  const schema = `nexus_p3_${randomUUID().replaceAll("-", "")}`;
  await admin.query(`CREATE SCHEMA ${schema}`);
  const pool = new Pool({ connectionString: databaseUrl, options: `-c search_path=${schema}`, max: 8 });
  try {
    await migrate(pool);
    await migrate(pool);
    const ledger = new Ledger(pool);

    await t.test("two simultaneous plans cannot overspend confirmed balance", async () => {
      await ledger.createPortfolio({ id: "concurrent", chainId: 56, settlement: usdt, balances: [units(100n)] });
      const outcomes = await Promise.allSettled([
        ledger.reservePlan(request("concurrent", "a", 80n)),
        ledger.reservePlan(request("concurrent", "b", 80n))
      ]);
      assert.equal(outcomes.filter((x) => x.status === "fulfilled").length, 1);
      assert.equal(outcomes.filter((x) => x.status === "rejected" && code("INSUFFICIENT_BALANCE")(x.reason)).length, 1);
      const sums = await pool.query<{ reserved: string }>("SELECT sum(units) AS reserved FROM reservations WHERE portfolio_id = 'concurrent' AND state = 'held'");
      assert.equal(sums.rows[0]?.reserved, "80");
    });

    await t.test("same key replays once; changed payload and duplicate occurrence reject", async () => {
      await ledger.createPortfolio({ id: "replay", chainId: 56, settlement: usdt, balances: [units(100n)] });
      const original = request("replay", "one", 20n);
      assert.deepEqual(await ledger.reservePlan(original), { id: "plan-one", replay: false });
      assert.deepEqual(await ledger.reservePlan({ ...original, leaseUntil: lease() }), { id: "plan-one", replay: true });
      await assert.rejects(ledger.reservePlan({ ...original, reservations: [{ id: "reservation-one", amount: units(21n) }] }), code("IDEMPOTENCY_CONFLICT"));
      await assert.rejects(ledger.reservePlan({ ...request("replay", "two", 20n), occurrenceId: "occ-one" }), code("DUPLICATE_OCCURRENCE"));
      const events = await pool.query<{ count: string }>("SELECT count(*) FROM outbox WHERE event_key = 'plan.reserved:plan-one'");
      assert.equal(events.rows[0]?.count, "1");
    });

    await t.test("failed reservation insert rolls back plan and outbox", async () => {
      await ledger.createPortfolio({ id: "rollback", chainId: 56, settlement: usdt, balances: [units(100n)] });
      await assert.rejects(ledger.reservePlan({ ...request("rollback", "bad", 10n),
        reservations: [{ id: "reservation-one", amount: units(10n) }] }));
      const plans = await pool.query("SELECT id FROM plans WHERE id = 'plan-bad'");
      const events = await pool.query("SELECT id FROM outbox WHERE event_key = 'plan.reserved:plan-bad'");
      assert.equal(plans.rowCount, 0);
      assert.equal(events.rowCount, 0);
    });

    await t.test("one executing batch and submitted inventory survives lease expiry", async () => {
      await ledger.createPortfolio({ id: "execution", chainId: 56, settlement: usdt, balances: [units(100n)] });
      await ledger.reservePlan(request("execution", "exec-a", 30n));
      await ledger.reservePlan(request("execution", "exec-b", 30n));
      await ledger.startExecution("execution", "plan-exec-a");
      await assert.rejects(ledger.startExecution("execution", "plan-exec-b"), code("BATCH_ALREADY_EXECUTING"));
      await ledger.markSubmitted("execution", "plan-exec-a", "reservation-exec-a", "tx-exec-a");
      await pool.query("UPDATE reservations SET lease_until = now() - interval '1 second' WHERE id = 'reservation-exec-b'");
      assert.equal(await ledger.expireHeldReservations(), 1);
      const states = await pool.query<{ id: string; state: string }>("SELECT id, state FROM reservations WHERE portfolio_id = 'execution' ORDER BY id");
      assert.deepEqual(states.rows, [
        { id: "reservation-exec-a", state: "submitted" }, { id: "reservation-exec-b", state: "released" }
      ]);
      await assert.rejects(ledger.reservePlan(request("execution", "exec-c", 1n)), code("UNRESOLVED_SUBMISSION"));
      await assert.rejects(ledger.recordBalances("execution", 0n, [units(100n)], "external"), code("UNRESOLVED_SUBMISSION"));
    });

    await t.test("expired unsubmitted execution releases its batch slot", async () => {
      await ledger.createPortfolio({ id: "expiring", chainId: 56, settlement: usdt, balances: [units(100n)] });
      await ledger.reservePlan(request("expiring", "exp-a", 30n));
      await ledger.reservePlan(request("expiring", "exp-b", 30n));
      await ledger.startExecution("expiring", "plan-exp-a");
      await pool.query("UPDATE reservations SET lease_until = now() - interval '1 second' WHERE id = 'reservation-exp-a'");
      assert.equal(await ledger.expireHeldReservations(), 1);
      await ledger.startExecution("expiring", "plan-exp-b");
      const state = await pool.query<{ status: string }>("SELECT status FROM plans WHERE id = 'plan-exp-a'");
      assert.equal(state.rows[0]?.status, "expired");
    });

    await t.test("reconciliation increments revision and invalidates held plan", async () => {
      await ledger.createPortfolio({ id: "revised", chainId: 56, settlement: usdt,
        balances: [units(100n), amount(10n, equity)] });
      await ledger.reservePlan(request("revised", "old", 25n));
      assert.equal(await ledger.recordBalances("revised", 0n, [units(70n), amount(10n, equity)], "external-trade"), 1n);
      await assert.rejects(ledger.startExecution("revised", "plan-old"), code("PLAN_NOT_RESERVED"));
      const next = { ...request("revised", "new", 70n), expectedRevision: 1n };
      await ledger.reservePlan(next);
      await assert.rejects(ledger.recordBalances("revised", 0n, [units(70n)], "late"), code("STALE_REVISION"));
      const released = await pool.query<{ state: string }>("SELECT state FROM reservations WHERE id = 'reservation-old'");
      assert.equal(released.rows[0]?.state, "released");
    });

    await t.test("expired outbox lease reclaims after crash without duplicate event", async () => {
      const first = await ledger.claimOutbox("worker-a", 30);
      assert.ok(first);
      await pool.query("UPDATE outbox SET available_at = now() + interval '1 day' WHERE id <> $1", [first.id]);
      assert.equal(await ledger.claimOutbox("worker-b", 30), null);
      await pool.query("UPDATE outbox SET lease_until = now() - interval '1 second' WHERE id = $1", [first.id]);
      // A new pool models a restarted process, not an in-memory queue.
      const restartedPool = new Pool({ connectionString: databaseUrl, options: `-c search_path=${schema}` });
      const restarted = new Ledger(restartedPool);
      const reclaimed = await restarted.claimOutbox("worker-b", 30);
      assert.equal(reclaimed?.id, first.id);
      assert.equal(reclaimed?.attempts, 2);
      assert.equal(await ledger.acknowledgeOutbox(first.id, "worker-a"), false);
      assert.equal(await restarted.acknowledgeOutbox(first.id, "worker-b"), true);
      assert.equal(await ledger.acknowledgeOutbox(first.id, "worker-b"), false);
      await restartedPool.end();
      await pool.query("UPDATE outbox SET available_at = now() WHERE event_key = 'plan.reserved:plan-one'");
      let handled = 0;
      await assert.rejects(runOutboxOnce(ledger, "worker-c", async () => { throw new Error("handler failed"); }, 30, 0));
      assert.equal(await runOutboxOnce(ledger, "worker-c", async () => { handled++; }), true);
      assert.equal(handled, 1);
      const acknowledged = await pool.query<{ count: string }>("SELECT count(*) FROM outbox WHERE delivered_at IS NOT NULL");
      assert.equal(acknowledged.rows[0]?.count, "2");
    });
  } finally {
    await pool.end();
    await admin.query(`DROP SCHEMA ${schema} CASCADE`);
    await admin.end();
  }
});
