# Nexus

Many strategies. One portfolio plan.

Nexus is being built to coordinate tokenized-stock baskets, conditional rules
and earnings controls on BNB Smart Chain. The current implementation is an
domain foundation, a PostgreSQL ledger and an offline Portfolio Coordinator.
Phase 2 feasibility included one owner-approved, manually executed route test.
Phase 3 added transactional reservations and a durable outbox; Phase 4 added
conservative portfolio planning. Automated live trading and the web application
are not built.

## Start here

- [Product blueprint](Nexus.md)
- [Phases, work items and exit criteria](docs/IMPLEMENTATION_PLAN.md)
- [Current status and next step](docs/PROJECT_STATE.md)
- [Project phase log](docs/PROJECT_LOG.md)
- [Detailed work, tests, fixes and lessons](docs/ENGINEERING_LOG.md)
- [Phase 2 integration evidence](docs/integrations/2026-09-25-phase-2.md)
- [Change ledger](docs/CHANGELOG.md), [specifications](docs/specifications/README.md)
  and [architectural decisions](docs/decisions/)
- [Agent contract](AGENTS.md)

## Local setup

Use Node.js 22.x and npm. Install the pinned dependencies, then run all checks:

```bash
npm ci
./scripts/check.sh
```

For the Phase 3–4 integration checks, provide a dedicated PostgreSQL database:

```bash
TEST_DATABASE_URL=postgresql://user@localhost:5432/nexus_test ./scripts/check.sh
```

The integration suite creates and removes its own schema. For an application
database, set `DATABASE_URL` and run `npm run db:migrate`.

Run the explicitly synthetic allocation example:

```bash
npm run demo
```

The example allocates 75 settlement-token units after reservations, reserve and
fees: requests of 40/35/25 receive 30/26.25/18.75. Its address is a fixture,
amounts are not USD valuations, and it cannot sign or submit transactions.

## Implemented components

- `src/domain/amount.ts`: exact base units, denomination checks and JSON boundary.
- `src/domain/instrument.ts`: immutable exact identities and underlying grouping.
- `src/domain/allocation.ts`: priority and proportional cash allocation,
  rounding, rejection reasons and independent native gas budget.
- `src/ledger/`: PostgreSQL migrations, exact inventory reservations,
  revision checks, idempotent plan creation and an at-least-once outbox worker.
- `src/coordinator/`: deterministic sell-first proposal arbitration,
  conservative exposure limits and atomic decision/reservation records.
- `test/`: 22 foundation tests, 13 PostgreSQL integration subtests and
  coordinator unit tests, including 1,000 generated allocation cases.
  Register new suites in `test/run.ts`.

`npm test`, `npm run typecheck` and `npm run build` can be run individually;
`./scripts/check.sh` is the required combined check. Compiled output is ignored.

## Portable project memory

Created from Portable. Repository documentation is authoritative; shared MCP
memory is supplementary. All configured clients use `scripts/memory-mcp.sh`.
Use one memory writer at a time and never store credentials or personal data
in project memory. Read the agent contract before making changes.
