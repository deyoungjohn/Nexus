# ADR 0002: Start with a strict TypeScript domain kernel

- Status: accepted
- Date: 2026-09-25
- Owners: project owner (blueprint and build authorization), Codex (implementation)

## Context

`Nexus.md` selects a modular monolith and requires exact accounting, stable
instrument identity and deterministic allocation. The repository has no
application stack. Integration feasibility must precede money-moving features.

## Decision

Use strict TypeScript with explicit module imports and Node's built-in test
runner for the initial pure domain modules. Pin development dependencies and
commit their lockfile. Keep the MCP server dependency and single check entry
point. Compile tests before running them; build production domain code
separately. Use `bigint` and explicit denominations, converting only to string
at JSON boundaries. Add no wallet credentials, runtime API dependency or web
framework until its implementation phase.

Use largest-remainder proportional allocation with stable ASCII ID tie breaks
inside a priority group. This resolves the blueprint's rounding requirement
without allocating more than available base units. Native gas remains separate.

## Consequences

Foundation tests run offline after dependency installation. This is a budget
primitive, not a production portfolio coordinator, reservation ledger, valuation
engine or executable authorization. P2 verifies real integrations; P3 implements
PostgreSQL transactions before any concurrency guarantee. The Next.js web app,
worker and EVM client remain planned, not installed or claimed operational.

There is no strategy SDK with wallet authority. Unsupported quantity models
remain read-only, and registry membership alone never enables execution.

## Alternatives

- Floating-point accounting: rejected because base-unit precision is required.
- Full frontend first: deferred so the workflow can bind to tested domain logic.
- In-memory reservation service: deferred to avoid implying crash/concurrency
  guarantees without the transactional database required by the blueprint.

## References and verification

- [TypeScript strict configuration](https://www.typescriptlang.org/tsconfig/strict.html).
- Blueprint sections 4, 5, 9 and 11; specification 0001.
- Verify exact arithmetic, deterministic generated cases and the repository
  checks; record actual outcomes in `docs/ENGINEERING_LOG.md`.
