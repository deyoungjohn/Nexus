import assert from "node:assert/strict";
import { test } from "node:test";
import {
  approveFixturePlan, createFixturePlan, initialFixtureState,
  recordFixtureReceipt, restoreFixtureState,
} from "../web/lib/workflow.js";

const now = new Date("2026-09-29T12:00:00.000Z");

test("P8 fixture preview preserves cash and reduces a leg at the stated cap", () => {
  const draft = { ...initialFixtureState().draft, nvdabWeight: "80", amdbWeight: "20" };
  const plan = createFixturePlan(draft, now, "one");
  assert.equal(plan.contributionCents, 10_000);
  assert.equal(plan.reserveCents, 2_000);
  assert.equal(plan.legs[0]?.intendedCents, 6_400);
  assert.equal(plan.legs[0]?.acceptedCents, 4_800);
  assert.equal(plan.acceptedCents, 6_400);
  assert.equal(plan.unallocatedCents, 1_600);
  assert.equal(plan.legs[0]?.reason, "Reduced by fixture per-leg cap");
  const tinyReserve = createFixturePlan({ ...initialFixtureState().draft, reserve: "0.01" }, now, "tiny-reserve");
  assert.equal(tinyReserve.feeAllowanceCents, 1);
  assert.ok(tinyReserve.acceptedCents + tinyReserve.feeAllowanceCents <= tinyReserve.contributionCents);
});

test("P8 rejects invalid weights, reserve and unsupported schedule before preview", () => {
  const base = initialFixtureState().draft;
  assert.throws(() => createFixturePlan({ ...base, amdbWeight: "39" }, now, "two"), /add to 100/);
  assert.throws(() => createFixturePlan({ ...base, reserve: "100" }, now, "two"), /below/);
  assert.throws(() => createFixturePlan({ ...base, cadence: "daily" as "weekly" }, now, "two"), /supported schedule/);
});

test("P8 approval is local, expires and cannot be made while paused", () => {
  const plan = createFixturePlan(initialFixtureState().draft, now, "three");
  assert.throws(() => approveFixturePlan(plan, true, now), /Resume/);
  assert.throws(() => approveFixturePlan(plan, false, new Date(plan.expiresAt)), /expired/);
  const approval = approveFixturePlan(plan, false, now);
  assert.equal(approval.kind, "LOCAL_FIXTURE_ONLY");
  assert.equal(approval.planId, plan.id);
});

test("P8 fixture outcome requires matching approval and is recorded once", () => {
  const plan = createFixturePlan(initialFixtureState().draft, now, "four");
  const approval = approveFixturePlan(plan, false, now);
  assert.throws(() => recordFixtureReceipt(plan, null, [], now), /Approve/);
  const receipt = recordFixtureReceipt(plan, approval, [], now);
  assert.equal(receipt.kind, "RECONCILED_FIXTURE");
  assert.equal(receipt.spentCents + receipt.unallocatedCents, plan.contributionCents);
  assert.throws(() => recordFixtureReceipt(plan, approval, [receipt], now), /already recorded/);
  assert.throws(() => recordFixtureReceipt(plan, approval, [], new Date(plan.expiresAt)), /expired/);
});

test("P8 restored browser data cannot restore a pending approval", () => {
  const state = initialFixtureState();
  state.plan = createFixturePlan(state.draft, now, "five");
  state.approval = approveFixturePlan(state.plan, false, now);
  const restored = restoreFixtureState(JSON.stringify(state));
  assert.equal(restored.plan, null);
  assert.equal(restored.approval, null);
  assert.deepEqual(restoreFixtureState("not JSON"), initialFixtureState());
});
