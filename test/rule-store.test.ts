import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { test } from "node:test";
import { Pool } from "pg";
import { amount, nativeAssetId, tokenAssetId } from "../src/domain/amount.js";
import { DomainError } from "../src/domain/errors.js";
import { createInstrument } from "../src/domain/instrument.js";
import { CoordinatorStore } from "../src/coordinator/store.js";
import type { CoordinatorPolicy, PortfolioSnapshot } from "../src/coordinator/plan.js";
import { EoaExecutionStore } from "../src/execution/store.js";
import { Ledger } from "../src/ledger/ledger.js";
import { migrate } from "../src/ledger/migrate.js";
import { RuleStore, type RuleBatchInput } from "../src/rules/store.js";
import type { RuleValuation } from "../src/rules/planning.js";

const databaseUrl = process.env.TEST_DATABASE_URL;
const settlement = { assetId: tokenAssetId(56, "0x1111111111111111111111111111111111111111"), decimals: 0 };
const native = { assetId: nativeAssetId(56), decimals: 0 };
const instruments = ["NVDA", "AMD"].map((ticker, index) => createInstrument({ chainId: 56,
  tokenAddress: `0x${(index + 2).toString().repeat(40)}`, issuerId: "fixture", productType: "share",
  underlyingId: ticker, ticker, decimals: 0, quantityModel: "fixed", adapterVersion: "v1",
  sectorTags: ["semi"], classificationVersion: "v1", statusSource: "fixture", referenceSource: "fixture",
  eligibilityRequirements: ["fixture-only"] }));
const nvda = instruments[0]!, amd = instruments[1]!;
const cash = (units: bigint) => amount(units, settlement);
const gas = amount(1n, native);
const balances = [cash(100n), gas, amount(100n, nvda), amount(0n, amd)];
const policy: CoordinatorPolicy = { minimumCash: cash(10n), feeAllowance: cash(0n), requiredNativeGas: amount(0n, native),
  companyCapsBps: {}, sectorCapsBps: {}, issuerCapsBps: {} };
const now = new Date("2026-09-30T08:05:00Z");
const valuations: RuleValuation[] = instruments.map(instrument => ({ instrumentId: instrument.instrumentId,
  settlementValueLowerNumerator: 1n, settlementValueUpperNumerator: 1n, settlementValueDenominator: 1n,
  tokenValueLowerNumerator: 1n, tokenValueUpperNumerator: 1n, tokenValueDenominator: 1n,
  tokenProceedsNumerator: 1n, tokenProceedsDenominator: 1n }));
const basket = (id: string, portfolioId: string, version = 1) => ({ kind: "basket", id, portfolioId, version, expiresAt: null,
  schedule: { zone: "Africa/Lagos", frequency: "daily", weekday: null, localTime: "09:00", windowMinutes: 30 },
  contribution: { ...settlement, units: "40" },
  targets: instruments.map(instrument => ({ instrumentId: instrument.instrumentId, weightBps: 5000 })) });
function snapshot(revision: bigint): PortfolioSnapshot {
  return { revision, sourceBlock: 100n, valuationUnit: "fixture-USD", confirmedCash: cash(100n),
    reservedCash: cash(0n), cashValueLower: 100n, nativeGas: gas,
    positions: instruments.map((instrument, index) => ({ instrument, raw: amount(index === 0 ? 100n : 0n, instrument),
      reservedRaw: amount(0n, instrument), valueLower: index === 0 ? 100n : 0n, valueUpper: index === 0 ? 100n : 0n,
      buyEligible: true, sellEligible: true })) };
}
const code = (expected: string) => (error: unknown) => error instanceof DomainError && error.code === expected;

test("P6 PostgreSQL rules persist versions and commit occurrences with P4 reservations",
  { skip: !databaseUrl && "Set TEST_DATABASE_URL for real PostgreSQL tests." }, async t => {
    const admin = new Pool({ connectionString: databaseUrl });
    const schema = `nexus_p6_${randomUUID().replaceAll("-", "")}`;
    await admin.query(`CREATE SCHEMA ${schema}`);
    const pool = new Pool({ connectionString: databaseUrl, options: `-c search_path=${schema}`, max: 8 });
    const rules = new RuleStore(pool), ledger = new Ledger(pool), coordinator = new CoordinatorStore(pool);
    async function setup(id: string, chosenPolicy = policy): Promise<bigint> {
      await ledger.createPortfolio({ id, chainId: 56, settlement, balances });
      let revision = await coordinator.activatePolicy({ portfolioId: id, expectedRevision: 0n, policyId: `${id}-policy`, version: 1, policy: chosenPolicy });
      const executor = new EoaExecutionStore(pool);
      revision = await executor.bindOwnerWallet(id, "0x5555555555555555555555555555555555555555", revision);
      return executor.setPaused(id, revision, false);
    }
    async function add(id: string, revision: bigint, draft: unknown, eventRevision: string | null = null) {
      const saved = await rules.saveDraft({ portfolioId: id, expectedRevision: revision, draft, eventRevision });
      const next = await rules.setState({ portfolioId: id, ruleId: saved.rule.id, version: saved.rule.version,
        expectedRevision: saved.revision, reviewedHash: saved.reviewHash, state: "ACTIVE", now });
      return { saved, revision: next };
    }
    function batch(id: string, revision: bigint, batchId: string): RuleBatchInput {
      return { portfolioId: id, expectedRevision: revision, batchId, now, leaseUntil: new Date(Date.now() + 60_000),
        snapshot: snapshot(revision), references: {}, events: {}, valuations };
    }
    try {
      await migrate(pool);
      for (const instrument of instruments) await coordinator.registerInstrument(instrument);

      await t.test("immutable version, review hash and denomination guards survive restart", async () => {
        const revision = await setup("versions");
        const saved = await rules.saveDraft({ portfolioId: "versions", expectedRevision: revision, draft: basket("basket", "versions"), eventRevision: null });
        assert.equal(saved.rule.state, "READY_FOR_REVIEW");
        assert.equal((await new RuleStore(pool).list("versions"))[0]?.reviewHash, saved.reviewHash);
        await assert.rejects(rules.setState({ portfolioId: "versions", ruleId: "basket", version: 1, expectedRevision: saved.revision,
          reviewedHash: "bad", state: "ACTIVE", now }), code("RULE_NOT_REVIEWED"));
        await assert.rejects(rules.saveDraft({ portfolioId: "versions", expectedRevision: saved.revision,
          draft: { ...basket("basket", "versions"), contribution: { ...settlement, units: "41" } }, eventRevision: null }), code("RULE_VERSION_CONFLICT"));
        const activeRevision = await rules.setState({ portfolioId: "versions", ruleId: "basket", version: 1,
          expectedRevision: saved.revision, reviewedHash: saved.reviewHash, state: "ACTIVE", now });
        const replacement = await rules.saveDraft({ portfolioId: "versions", expectedRevision: activeRevision,
          draft: basket("basket", "versions", 2), eventRevision: null });
        assert.equal(replacement.rule.version, 2);
        assert.equal((await rules.list("versions"))[0]?.rule.state, "READY_FOR_REVIEW");
        await assert.rejects(rules.setState({ portfolioId: "versions", ruleId: "basket", version: 1,
          expectedRevision: replacement.revision, reviewedHash: saved.reviewHash, state: "ACTIVE", now }), code("RULE_NOT_REVIEWED"));
        await assert.rejects(rules.saveDraft({ portfolioId: "versions", expectedRevision: replacement.revision,
          draft: { ...basket("other", "versions"), contribution: { assetId: amd.assetId, decimals: 0, units: "40" } }, eventRevision: null }), code("DENOMINATION_MISMATCH"));
      });

      await t.test("two workers and a restarted retry create one occurrence and reservation set", async () => {
        const { revision } = await add("race", await setup("race"), basket("basket", "race"));
        const input = batch("race", revision, "one");
        const outcomes = await Promise.all([rules.plan(input), new RuleStore(pool).plan({ ...input, batchId: "two" })]);
        assert.equal(outcomes.filter(x => x.coordination !== null).length, 1);
        const successful = outcomes.find(x => x.coordination !== null)!;
        const replay = await new RuleStore(pool).plan({ ...input, batchId: successful.batchId });
        assert.equal(replay.replay, true);
        assert.deepEqual(replay.coordination, successful.coordination);
        const rows = await pool.query<{ total: string; count: string }>("SELECT sum(units) AS total,count(*) AS count FROM reservations WHERE portfolio_id='race' AND state='held'");
        assert.deepEqual(rows.rows[0], { total: "40", count: "2" });
        assert.equal((await pool.query("SELECT 1 FROM rule_occurrences WHERE portfolio_id='race'")).rowCount, 1);
        await assert.rejects(rules.plan({ ...input, batchId: successful.batchId, now: new Date(now.getTime() + 1000) }), code("IDEMPOTENCY_CONFLICT"));
      });

      await t.test("P4 failure after an occurrence claim rolls back the entire scheduling batch", async () => {
        const { revision } = await add("rollback", await setup("rollback"), basket("basket", "rollback"));
        const input = batch("rollback", revision, "attempt");
        await assert.rejects(rules.plan({ ...input, snapshot: { ...input.snapshot, confirmedCash: cash(101n) } }), code("UNRECONCILED_SNAPSHOT"));
        assert.equal((await pool.query("SELECT 1 FROM rule_occurrences WHERE portfolio_id='rollback'")).rowCount, 0);
        assert.equal((await pool.query("SELECT 1 FROM rule_batches WHERE portfolio_id='rollback'")).rowCount, 0);
        assert.ok((await new RuleStore(pool).plan(input)).coordination?.reservedPlanId);
      });

      await t.test("policy-blocked occurrences remain skipped after restart", async () => {
        const { revision } = await add("blocked", await setup("blocked", { ...policy, requiredNativeGas: amount(2n, native) }), basket("basket", "blocked"));
        const input = batch("blocked", revision, "blocked");
        const first = await rules.plan(input);
        assert.equal(first.coordination?.result.phase, "blocked");
        assert.equal(first.coordination?.reservedPlanId, null);
        const repeated = await new RuleStore(pool).plan({ ...input, batchId: "retry" });
        assert.equal(repeated.evaluations[0]?.evaluation.status, "duplicate");
        assert.equal(repeated.coordination, null);
      });

      await t.test("a changed event revision freezes company buys while allowing unrelated legs", async () => {
        let { revision } = await add("event", await setup("event"), basket("basket", "event"));
        ({ revision } = await add("event", revision, { id: "freeze", portfolioId: "event", version: 1, expiresAt: null,
          kind: "earnings", underlyingId: "NVDA", action: "freeze-buy", scope: "company", allocationId: null, reductionBps: 0 }, "reviewed"));
        const first = await rules.plan(batch("event", revision, "event-batch"));
        assert.equal(first.evaluations.find(x => x.ruleId === "freeze")?.evaluation.reason, "EVENT_REVISION_CHANGED");
        assert.deepEqual(first.suppressed.map(x => x.instrumentId), [nvda.instrumentId]);
        assert.deepEqual(first.coordination?.result.legs.map(x => x.instrumentId), [amd.instrumentId]);
        assert.equal((await pool.query("SELECT 1 FROM rule_occurrences WHERE portfolio_id='event' AND rule_id='freeze'")).rowCount, 0);
      });

      await t.test("allocation reductions use only tagged units and reject stale ownership", async () => {
        let revision = await setup("allocation");
        await assert.rejects(rules.recordAllocations("allocation", revision, [
          { allocationId: "slice", instrumentId: nvda.instrumentId, units: 70n },
          { allocationId: "other", instrumentId: nvda.instrumentId, units: 40n }]), code("ALLOCATION_OVERLAP"));
        revision = await rules.recordAllocations("allocation", revision, [{ allocationId: "slice", instrumentId: nvda.instrumentId, units: 20n }]);
        const draft = { id: "reduce", portfolioId: "allocation", version: 1, expiresAt: null,
          kind: "earnings", underlyingId: "NVDA", action: "reduce", scope: "allocation", allocationId: "slice", reductionBps: 2500 };
        ({ revision } = await add("allocation", revision, draft, "reviewed"));
        const event = { source: "fixture", observedAt: "2026-09-30T08:00:00Z", expiresAt: "2026-09-30T08:30:00Z",
          underlyingId: "NVDA", issuerSourceUrl: "https://issuer.example/ir", revision: "reviewed", confirmation: "confirmed" as const,
          eventAt: "2026-09-30T08:10:00Z", blackoutStart: "2026-09-30T08:00:00Z", blackoutEnd: "2026-09-30T08:20:00Z" };
        const input = { ...batch("allocation", revision, "reduce"), events: { NVDA: event } };
        const first = await rules.plan(input);
        assert.equal(first.coordination?.result.legs[0]?.amount.units, 5n);
        revision = await ledger.recordBalances("allocation", revision, balances, "fixture-reconciliation");
        ({ revision } = await add("allocation", revision, { ...draft, version: 2 }, "reviewed"));
        await assert.rejects(rules.plan({ ...batch("allocation", revision, "stale"), events: { NVDA: event } }), code("STALE_ALLOCATION"));
      });

      await t.test("an expired event rule cannot freeze a later scheduled occurrence", async () => {
        let { revision } = await add("expired", await setup("expired"), basket("basket", "expired"));
        ({ revision } = await add("expired", revision, { id: "freeze", portfolioId: "expired", version: 1,
          expiresAt: "2026-09-30T08:06:00Z", kind: "earnings", underlyingId: "NVDA", action: "freeze-buy",
          scope: "company", allocationId: null, reductionBps: 0 }, "reviewed"));
        const result = await rules.plan({ ...batch("expired", revision, "after-expiry"), now: new Date("2026-09-30T08:07:00Z") });
        assert.equal(result.evaluations.find(x => x.ruleId === "freeze")?.evaluation.status, "inactive");
        assert.equal(result.suppressed.length, 0);
        assert.equal(result.coordination?.result.legs.length, 2);
      });

      await t.test("global pause records inactivity and consumes no occurrence", async () => {
        let { revision } = await add("paused", await setup("paused"), basket("basket", "paused"));
        revision = await new EoaExecutionStore(pool).setPaused("paused", revision, true);
        const result = await rules.plan(batch("paused", revision, "paused"));
        assert.equal(result.evaluations[0]?.evaluation.reason, "PORTFOLIO_PAUSED");
        assert.equal(result.coordination, null);
        assert.equal((await pool.query("SELECT 1 FROM rule_occurrences WHERE portfolio_id='paused'")).rowCount, 0);
      });

      await t.test("submitted reservations remain frozen during attempted rule changes", async () => {
        const { saved, revision } = await add("pending", await setup("pending"), basket("basket", "pending"));
        const result = await rules.plan(batch("pending", revision, "pending"));
        const planId = result.coordination!.reservedPlanId!;
        await ledger.startExecution("pending", planId);
        await ledger.markSubmitted("pending", planId, `${planId}-0`, "fixture-tx");
        await assert.rejects(rules.setState({ portfolioId: "pending", ruleId: "basket", version: 1,
          expectedRevision: revision, reviewedHash: saved.reviewHash, state: "PAUSED", now }), code("UNRESOLVED_SUBMISSION"));
        const reservation = await pool.query<{ state: string }>("SELECT state FROM reservations WHERE id=$1", [`${planId}-0`]);
        assert.equal(reservation.rows[0]?.state, "submitted");
      });
    } finally {
      await pool.end();
      await admin.query(`DROP SCHEMA ${schema} CASCADE`);
      await admin.end();
    }
  });
