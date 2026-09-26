# Specification 0002 — Durable portfolio ledger

Status: implemented for P3 on 2026-09-26. Source: `Nexus.md` sections 4.1,
4.3, 8.3, 9 and 11; `docs/IMPLEMENTATION_PLAN.md` P3. This is storage and work
dispatch, not a planner, authorization service or chain reconciler.

## Storage and interface

PostgreSQL migration `0001_ledger.sql` creates portfolios, immutable revision
records, exact raw asset balances, policies, evidence snapshots, decision
records, plans, reservations, transaction identities and an outbox. Quantities
are integer `numeric(78,0)` base units with asset ID and precision, converted
to/from TypeScript `bigint` through decimal strings. A ticker is never an asset
key. Policies and evidence are append-only records for later modules to populate;
their interpretation is not implemented in P3.

`Ledger.createPortfolio` records revision zero and a full initial balance
snapshot. `recordBalances` atomically replaces that snapshot, increments the
revision, and invalidates unsubmitted plans and holds. It rejects reconciliation
while submitted inventory is unresolved; P7 must provide receipt-aware
resolution. These calls require a known block and trusted balance source from
future adapters; P3 itself does not read a wallet.

`reservePlan` requires an expected revision, unique occurrence and idempotency
key, a future hold lease, and positive exact-denomination inventory requests.
It locks the portfolio row and checks confirmed inventory minus all held and
submitted reservations before writing the plan, reservations and outbox event
in one transaction. An identical idempotency retry returns the existing plan;
changed content fails. One `executing`/`reconciling`/`unknown` plan per portfolio
is also enforced by a partial unique index. `startExecution` refuses stale or
expired holds. `markSubmitted` requires an external transaction identity,
persists it, freezes the reservation and enqueues reconciliation atomically.
It **does not broadcast**. Expiry releases only `held` rows, never `submitted`
rows; an unsubmitted executing batch whose hold expires also releases its
execution slot. An unresolved submission blocks new plans and balance
replacement.

Outbox claims use row locks with `SKIP LOCKED`, owner leases and attempt counts.
The worker helper processes a claimed event, acknowledges it only after the
handler succeeds, and makes failed work available for retry. A restarted worker
can reclaim an expired lease. Delivery is **at least once**: a crash after a
handler's side effect but before acknowledgment can replay it. Consumers must
deduplicate using `eventKey`; no external execution handler is installed in P3.

## Verification and operation

`./scripts/check.sh` runs domain tests, typecheck and build without requiring a
database. Set `TEST_DATABASE_URL` to a dedicated PostgreSQL test database to
run the P3 integration suite inside the same check. It creates a randomly named
schema, applies migrations twice, and drops only that schema. The suite verifies
simultaneous triggers cannot overspend, rollback of partial writes, retry and
occurrence uniqueness, one executing batch, submitted-reservation survival,
revision invalidation, outbox retry and reclaim from a new pool after a crash.
No wallet or chain calls occur.

Set `DATABASE_URL` and run `npm run db:migrate` to apply migrations to the
selected database. Use separate least-privilege runtime and migration database
roles in deployment; no connection string is committed. Applied migration
checksums reject silent edits. Future schema changes need new numbered files.

## Remaining gates

P4 will populate plans and decision records from portfolio policy. P5 validates
market evidence before a plan. P7 binds approvals and transaction identities to
actual wallet submission, resolves uncertain receipts and reorgs, then makes
submitted reservations consumable or releasable. P3 cannot guarantee that an
owner's external wallet action has not changed the chain since a balance
snapshot. No money-moving path is enabled by this ledger.
