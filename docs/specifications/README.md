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
- [0004 — Market Gate](0004-market-gate.md): fail-closed route and evidence
  checks; offline P5 complete, live sources pending.
- [0005 — Rules and scheduling](0005-rules-and-scheduling.md): strict pure rule
  core, durable atomic P4 occurrences and allocation bounds; runtime sources pending.
- [0006 — EOA execution](0006-eoa-execution.md): exact owner approval and
  signed-swap verification, persistence and receipt-effect recovery; production gates open.
- [0007 — Web workflow](0007-web-workflow.md): labelled P8 fixture path,
  local fixture plus owner-authenticated saved records/rules/server pause; live execution pending.

- [0008 — Token security](0008-token-security.md): complete route-token evidence,
  source/control review, strict risk policy and P7 approval invalidation.

Product authority: [Nexus blueprint](../../Nexus.md). Delivery sequence:
[implementation plan](../IMPLEMENTATION_PLAN.md). Evidence:
[engineering log](../ENGINEERING_LOG.md).
