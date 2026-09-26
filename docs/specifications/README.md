# Specifications

Add approved behavior and acceptance criteria here before implementation. Each
specification identifies observable behavior, error cases, compatibility
requirements, and the tests that demonstrate completion.

- [0001 — Domain foundation](0001-domain-foundation.md): exact quantities,
  instrument identity and deterministic allocation; P1 complete.
- [0002 — Durable ledger](0002-durable-ledger.md): PostgreSQL records,
  reservations, replay protection and outbox recovery; P3 complete.
- [0003 — Portfolio Coordinator](0003-portfolio-coordinator.md): staged
  reductions, deterministic buys, conservative exposure limits and durable
  decisions; P4 complete.

Product authority: [Nexus blueprint](../../Nexus.md). Delivery sequence:
[implementation plan](../IMPLEMENTATION_PLAN.md). Evidence:
[engineering log](../ENGINEERING_LOG.md).
