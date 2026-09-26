import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import { Pool } from "pg";
import { amount, nativeAssetId, tokenAssetId } from "../src/domain/amount.js";
import { DomainError } from "../src/domain/errors.js";
import { createInstrument, type Instrument } from "../src/domain/instrument.js";
import { CoordinatorStore } from "../src/coordinator/store.js";
import type { BuyProposal, CoordinatorPolicy, PortfolioSnapshot, Position, SellProposal } from "../src/coordinator/plan.js";
import { Ledger } from "../src/ledger/ledger.js";
import { migrate } from "../src/ledger/migrate.js";

const databaseUrl = process.env.TEST_DATABASE_URL;
const settlement = { assetId: tokenAssetId(56, "0x1111111111111111111111111111111111111111"), decimals: 0 };
const gas = { assetId: nativeAssetId(56), decimals: 0 };
const cash = (units: bigint) => amount(units, settlement);
const native = (units: bigint) => amount(units, gas);

function instrument(address: string, underlying: string, sector: string): Instrument {
  return createInstrument({ chainId: 56, tokenAddress: address, issuerId: "ondo", productType: "share",
    underlyingId: underlying, ticker: underlying, decimals: 0, quantityModel: "fixed", adapterVersion: "v1",
    sectorTags: [sector], classificationVersion: "v1", statusSource: "fixture", referenceSource: "fixture",
    eligibilityRequirements: ["fixture-only"] });
}

const nvda = instrument("0x2222222222222222222222222222222222222222", "NVDA", "semi");
const amd = instrument("0x3333333333333333333333333333333333333333", "AMD", "semi");
const other = instrument("0x4444444444444444444444444444444444444444", "OTHER", "other");

function raw(i: Instrument, units: bigint) { return amount(units, { assetId: i.assetId, decimals: i.decimals }); }
function position(i: Instrument, units: bigint, reserved = 0n, sellEligible = true): Position {
  return { instrument: i, raw: raw(i, units), reservedRaw: raw(i, reserved), valueLower: units, valueUpper: units,
    buyEligible: true, sellEligible };
}
function snapshot(revision: bigint, cashUnits: bigint, nvdaUnits: bigint, amdUnits: bigint,
  nvdaReserved = 0n, cashReserved = 0n): PortfolioSnapshot {
  return { revision, sourceBlock: 100n + revision, valuationUnit: "USD-0", confirmedCash: cash(cashUnits),
    reservedCash: cash(cashReserved), cashValueLower: cashUnits, nativeGas: native(1n),
    positions: [position(nvda, nvdaUnits, nvdaReserved), position(amd, amdUnits), position(other, 400n)] };
}
const policy: CoordinatorPolicy = { minimumCash: cash(0n), feeAllowance: cash(0n), requiredNativeGas: native(0n),
  companyCapsBps: { NVDA: 2500 }, sectorCapsBps: { semi: 4000 }, issuerCapsBps: {} };
function buy(id: string, i: Instrument, units: bigint): BuyProposal {
  return { id, instrumentId: i.instrumentId, side: "buy", priority: 2, nominalValue: units,
    spend: cash(units), acquiredValueLower: units, acquiredValueUpper: units };
}
function sell(id: string, units: bigint): SellProposal {
  return { id, instrumentId: nvda.instrumentId, side: "sell", priority: 0, nominalValue: units,
    raw: raw(nvda, units), proceeds: cash(units), proceedsValueLower: units, mandatory: true };
}
const code = (expected: string) => (error: unknown) => error instanceof DomainError && error.code === expected;

test("P4 PostgreSQL coordinator records and reserves under one portfolio lock",
  { skip: !databaseUrl && "Set TEST_DATABASE_URL for real PostgreSQL integration tests." }, async (t) => {
    const admin = new Pool({ connectionString: databaseUrl });
    const schema = `nexus_p4_${randomUUID().replaceAll("-", "")}`;
    await admin.query(`CREATE SCHEMA ${schema}`);
    const pool = new Pool({ connectionString: databaseUrl, options: `-c search_path=${schema}`, max: 8 });
    try {
      await migrate(pool);
      const ledger = new Ledger(pool);
      const coordinator = new CoordinatorStore(pool);
      for (const i of [nvda, amd, other]) await coordinator.registerInstrument(i);
      await ledger.createPortfolio({ id: "blueprint", chainId: 56, settlement,
        balances: [cash(200n), native(1n), raw(nvda, 280n), raw(amd, 120n), raw(other, 400n)] });
      assert.equal(await coordinator.activatePolicy({ portfolioId: "blueprint", expectedRevision: 0n,
        policyId: "policy-v1", version: 1, policy }), 1n);

      await t.test("sell decision, inventory hold and records commit together; retry replays", async () => {
        const input = { portfolioId: "blueprint", expectedRevision: 1n, planId: "sell-phase",
          occurrenceId: "event-1", idempotencyKey: "event-1-key", leaseUntil: new Date(Date.now() + 60_000),
          snapshot: snapshot(1n, 200n, 280n, 120n), proposals: [sell("event", 30n),
            buy("schedule", nvda, 60n), buy("tactical", amd, 50n)] };
        const first = await coordinator.coordinateAndReserve(input);
        assert.equal(first.replay, false);
        assert.equal(first.result.phase, "sell");
        assert.equal(first.result.decisions.find((x) => x.proposalId === "tactical")?.contingentUnits, 30n);
        assert.equal(first.reservedPlanId, "sell-phase");
        const repeated = await coordinator.coordinateAndReserve(input);
        assert.equal(repeated.replay, true);
        assert.deepEqual(repeated.result, first.result);
        const counts = await pool.query<{ plans: string; reservations: string; evidence: string; decisions: string }>(`
          SELECT (SELECT count(*) FROM plans) AS plans, (SELECT count(*) FROM reservations) AS reservations,
            (SELECT count(*) FROM evidence_snapshots) AS evidence,
            (SELECT count(*) FROM decision_records) AS decisions`);
        assert.deepEqual(counts.rows[0], { plans: "1", reservations: "1", evidence: "1", decisions: "1" });
        await assert.rejects(coordinator.coordinateAndReserve({ ...input, proposals: [buy("changed", amd, 1n)] }), code("IDEMPOTENCY_CONFLICT"));
      });

      await t.test("stale or mismatched snapshots cannot create plans", async () => {
        await assert.rejects(coordinator.coordinateAndReserve({ portfolioId: "blueprint", expectedRevision: 0n,
          planId: "stale", occurrenceId: "stale", idempotencyKey: "stale", leaseUntil: new Date(Date.now() + 60_000),
          snapshot: snapshot(0n, 200n, 280n, 120n), proposals: [buy("amd", amd, 1n)] }), code("STALE_REVISION"));
        await assert.rejects(coordinator.coordinateAndReserve({ portfolioId: "blueprint", expectedRevision: 1n,
          planId: "wrong-balance", occurrenceId: "wrong-balance", idempotencyKey: "wrong-balance",
          leaseUntil: new Date(Date.now() + 60_000), snapshot: snapshot(1n, 201n, 280n, 120n, 30n),
          proposals: [buy("amd", amd, 1n)] }), code("UNRECONCILED_SNAPSHOT"));
        const forged = snapshot(1n, 200n, 280n, 120n, 30n);
        const forgedPositions = [...forged.positions];
        forgedPositions[0] = { ...forgedPositions[0]!, instrument: { ...nvda, sectorTags: ["other"] } };
        await assert.rejects(coordinator.coordinateAndReserve({ portfolioId: "blueprint", expectedRevision: 1n,
          planId: "forged-classification", occurrenceId: "forged", idempotencyKey: "forged",
          leaseUntil: new Date(Date.now() + 60_000), snapshot: { ...forged, positions: forgedPositions },
          proposals: [buy("amd", amd, 1n)] }), code("INSTRUMENT_METADATA_CHANGED"));
      });

      await t.test("new reconciled revision permits only the bounded buy", async () => {
        assert.equal(await ledger.recordBalances("blueprint", 1n,
          [cash(230n), native(1n), raw(nvda, 250n), raw(amd, 120n), raw(other, 400n)], "fixture-confirmed-sell"), 2n);
        const outcome = await coordinator.coordinateAndReserve({ portfolioId: "blueprint", expectedRevision: 2n,
          planId: "buy-phase", occurrenceId: "after-sell", idempotencyKey: "after-sell-key",
          leaseUntil: new Date(Date.now() + 60_000), snapshot: snapshot(2n, 230n, 250n, 120n),
          proposals: [buy("schedule", nvda, 60n), buy("tactical", amd, 50n)] });
        assert.equal(outcome.result.phase, "buy");
        assert.deepEqual(outcome.result.legs.map((x) => [x.instrumentId, x.amount.units]), [[amd.instrumentId, 30n]]);
        const hold = await pool.query<{ asset_id: string; units: string }>("SELECT asset_id, units FROM reservations WHERE plan_id = 'buy-phase'");
        assert.deepEqual(hold.rows, [{ asset_id: settlement.assetId, units: "30" }]);
      });

      await t.test("policy activation invalidates held plans and their revisions", async () => {
        assert.equal(await coordinator.activatePolicy({ portfolioId: "blueprint", expectedRevision: 2n,
          policyId: "policy-v2", version: 2, policy: { ...policy, sectorCapsBps: { semi: 3500 } } }), 3n);
        const state = await pool.query<{ status: string; state: string }>(`
          SELECT p.status, r.state FROM plans p JOIN reservations r ON r.plan_id = p.id WHERE p.id = 'buy-phase'`);
        assert.deepEqual(state.rows, [{ status: "stale", state: "released" }]);
        await assert.rejects(coordinator.coordinateAndReserve({ portfolioId: "blueprint", expectedRevision: 2n,
          planId: "old-policy", occurrenceId: "old-policy", idempotencyKey: "old-policy",
          leaseUntil: new Date(Date.now() + 60_000), snapshot: snapshot(2n, 230n, 250n, 120n),
          proposals: [buy("amd", amd, 1n)] }), code("STALE_REVISION"));
      });

      await t.test("blocked occurrences remain unique and replayable without a reservation", async () => {
        const base = { portfolioId: "blueprint", expectedRevision: 3n, planId: "blocked-plan",
          occurrenceId: "blocked-occ", idempotencyKey: "blocked-key", leaseUntil: new Date(Date.now() + 60_000),
          snapshot: snapshot(3n, 230n, 250n, 120n), proposals: [buy("amd", amd, 10n)] };
        const blocked = await coordinator.coordinateAndReserve(base);
        assert.equal(blocked.result.phase, "blocked");
        assert.equal(blocked.reservedPlanId, null);
        assert.equal((await coordinator.coordinateAndReserve(base)).replay, true);
        await assert.rejects(coordinator.coordinateAndReserve({ ...base, planId: "alternate-plan" }), code("DUPLICATE_OCCURRENCE"));
      });

      await t.test("concurrent requests cannot reserve from the same stale snapshot", async () => {
        await ledger.createPortfolio({ id: "race", chainId: 56, settlement,
          balances: [cash(100n), native(1n), raw(nvda, 0n), raw(amd, 0n), raw(other, 400n)] });
        await coordinator.activatePolicy({ portfolioId: "race", expectedRevision: 0n,
          policyId: "race-policy", version: 1, policy: { ...policy, companyCapsBps: {}, sectorCapsBps: {} } });
        const current = snapshot(1n, 100n, 0n, 0n);
        const make = (id: string) => coordinator.coordinateAndReserve({ portfolioId: "race", expectedRevision: 1n,
          planId: `race-${id}`, occurrenceId: `race-${id}`, idempotencyKey: `race-${id}`,
          leaseUntil: new Date(Date.now() + 60_000), snapshot: current,
          proposals: [buy(`buy-${id}`, amd, 80n)] });
        const outcomes = await Promise.allSettled([make("a"), make("b")]);
        assert.equal(outcomes.filter((x) => x.status === "fulfilled").length, 1);
        assert.equal(outcomes.filter((x) => x.status === "rejected" && code("UNRECONCILED_SNAPSHOT")(x.reason)).length, 1);
        const total = await pool.query<{ units: string }>("SELECT sum(units) AS units FROM reservations WHERE portfolio_id = 'race' AND state = 'held'");
        assert.equal(total.rows[0]?.units, "80");
      });
    } finally {
      await pool.end();
      await admin.query(`DROP SCHEMA ${schema} CASCADE`);
      await admin.end();
    }
  });
