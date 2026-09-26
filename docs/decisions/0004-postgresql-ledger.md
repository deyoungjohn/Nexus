# ADR 0004: PostgreSQL row locking and leased outbox for P3

- Status: accepted
- Date: 2026-09-26
- Owners: Codex (implementation); project owner (blueprint scope)

## Context

P1's allocation is pure math and cannot serialize simultaneous portfolio
triggers or survive a worker crash. The blueprint requires transactional
reservations, unique occurrences, one executing batch and no lease-based
release of potentially submitted funds. P2 established feasibility only;
no application wallet adapter is enabled.

## Decision

Use a PostgreSQL-backed ledger in the modular monolith with `pg` and explicit
same-client transactions. Lock the portfolio row for each plan or revision
mutation, then check exact raw inventory minus active reservations. Enforce
occurrence and idempotency uniqueness, one active execution batch, and
submitted-reservation state in database constraints as well as application
checks. Store plan/reservation changes and outbox events in one transaction.
Use leased `SKIP LOCKED` outbox claims with at-least-once delivery; downstream
handlers must be idempotent. Applied migration checksums prevent unnoticed
history rewrites. Keep external wallet calls outside these transactions.

The ledger refuses to replace balances while submitted reservations are
unresolved. P7 will add receipt-aware resolution rather than allowing a lease
timeout to imply a chain transaction is impossible. P3 supplies no live worker
handler, signer or chain-state authority.

## Consequences and evidence

A real PostgreSQL 16 test server was used for P3 integration tests. Concurrent
reservation requests on separate pooled clients serialized: one 80-unit plan
on a 100-unit balance succeeded and the other was rejected. Tests also covered
rollback, replay, one executing batch, expiration of an unsubmitted batch,
submitted freeze, revision invalidation,
failed-handler retry and expired-lease reclaim from a new pool. The database
URL remains local and uncommitted. Tests skip the PostgreSQL suite when
`TEST_DATABASE_URL` is absent, so a database-free check is not full P3 evidence.

The design follows PostgreSQL's [row-lock behavior](https://www.postgresql.org/docs/current/explicit-locking.html)
and node-postgres's [same-client transaction requirement](https://node-postgres.com/features/transactions).
The detailed contract is [specification 0002](../specifications/0002-durable-ledger.md).

## Alternatives

- In-memory or message-queue-only reservations: rejected because process
  restarts and concurrent triggers could violate the inventory invariant.
- Treating outbox delivery as exactly once: rejected because a worker can
  crash between an external side effect and acknowledgment.
- Expiring submitted reservations: rejected because an off-chain timer does
  not establish that an on-chain transaction cannot settle.
