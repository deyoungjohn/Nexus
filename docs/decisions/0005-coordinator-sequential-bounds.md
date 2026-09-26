# ADR 0005: Stage sells and enforce conservative intermediate bounds

- Status: accepted
- Date: 2026-09-26
- Owners: Codex (implementation); project owner (blueprint scope)

## Context

The blueprint's NVDA/AMD example combines a mandatory event reduction, a
scheduled purchase that conflicts with the event cap, and a tactical buy that
fits only after the reduction settles. P3 can reserve exact raw inventory but
has no portfolio-level valuation or proposal arbitration. A preview that
counts unconfirmed sell proceeds could violate limits at an intermediate step.

## Decision

Use a pure, deterministic coordinator for proposal arbitration and
conservative upper-exposure/lower-total valuation. Execute a sell phase before
planning any dependent buy; show hypothetical post-sell buy amounts as
contingent only. Require a new reconciled portfolio revision before reserving
the buy. Apply company caps across wrappers sharing an underlying, sector caps
across tagged instruments, and issuer caps across products from one issuer.
Use P1's priority/proportional allocator for scarce cash, then clip each buy
in a stable order against all caps after each intermediate step. Do not
redistribute cash from a blocked leg by default.

Keep instrument classifications immutable in the P4 registry and verify them
against each planning snapshot. Activation of a new policy increments the
portfolio revision and releases unsubmitted holds. Record a unique occurrence
and decision even when every leg is blocked. Make the P4 decision, evidence
and P3 reservations one PostgreSQL transaction under the portfolio row lock.

Eligibility flags, valuation bounds and projected proceeds remain **inputs**
until P5 verifies their sources, clocks and actual-size quotes. Registry
membership is not an executable allowlist. P7 must recheck approval and every
intermediate hard limit with current chain state before submitting any leg.

## Evidence and consequences

Pure tests reproduce the blueprint's $30 NVDA sell and contingent $30 AMD
buy, then its separately reconciled $30 buy; a halted sale blocks the buy.
Additional tests cover wrapper aggregation, exact-instrument netting,
same-priority allocation, conservative denominators and issuer/sector/cash
limits. Real PostgreSQL tests verify atomic decision/reservation records,
immutable metadata, policy/revision invalidation, duplicate blocked
occurrences and concurrent stale-snapshot rejection. See
[specification 0003](../specifications/0003-portfolio-coordinator.md).

This does not turn a proposal into owner authorization or live execution.
P5/P7 remain explicit production gates. A sell that would introduce a new
concentration breach is blocked; solving conflicting mandatory reductions
may need a later atomic or owner-reviewed recovery policy.
