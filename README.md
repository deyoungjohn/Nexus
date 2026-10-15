# Nexus

Many strategies. One portfolio plan.

Nexus is being built to coordinate tokenized-stock baskets, conditional rules
and earnings controls on BNB Smart Chain. The current implementation is an
domain foundation, a PostgreSQL ledger and an offline Portfolio Coordinator.
Phase 2 feasibility included one owner-approved, manually executed route test.
Phase 3 added transactional reservations and a durable outbox; Phase 4 added
conservative portfolio planning. Durable rules and an EOA-authenticated
saved workspace are available alongside the labelled fixture walkthrough. Exact
EOA execution and an explicitly bounded owner-only pilot are implemented; actual
mainnet pilot acceptance and unattended live automation remain incomplete.

## Start here

- [Product blueprint](Nexus.md)
- [Phases, work items and exit criteria](docs/IMPLEMENTATION_PLAN.md)
- [Current status and next step](docs/PROJECT_STATE.md)
- [Project phase log](docs/PROJECT_LOG.md)
- [Detailed work, tests, fixes and lessons](docs/ENGINEERING_LOG.md)
- [Phase 2 integration evidence](docs/integrations/2026-09-25-phase-2.md)
- [Change ledger](docs/CHANGELOG.md), [specifications](docs/specifications/README.md)
  and [architectural decisions](docs/decisions/)
- [Owner-only pilot runbook](docs/runbooks/owner-pilot.md) and
  [senior follow-up questions](docs/SENIOR_ENGINEER_FOLLOWUP.md)
- [Agent contract](AGENTS.md)

## Local setup

Use Node.js 22.x and npm. Install the pinned dependencies, then run all checks:

```bash
npm ci
./scripts/check.sh
```

For the PostgreSQL integration checks, provide a dedicated PostgreSQL database:

```bash
TEST_DATABASE_URL=postgresql://user@localhost:5432/nexus_test ./scripts/check.sh
```

The integration suite creates and removes its own schema. For an application
database, set `DATABASE_URL` and run `npm run db:migrate`.

Recover/monitor existing persisted BSC EOA legs with `npm run recovery:once`.
Set `DATABASE_URL` and `NEXUS_RECOVERY_CONFIG` as described in the
[recovery runbook](docs/runbooks/bsc-recovery-worker.md). The supplied sources
are Sentio and Blockmachine. USDT/NVDAB raw recovery accounting is registered
with code guards; live risk/access gates and other asset reviews remain. This command
cannot sign or broadcast trades.

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
- `src/rules/`: canonical drafts, scheduling, event controls, allocation bounds
  and atomic PostgreSQL occurrence/coordination records.
- `src/pilot/`: explicit one-buy admission, private reviewed records, local round-trip
  proof, inspection/declaration/price commands and owner-only planning.
- `src/execution/`: exact signed-byte storage/one-time claim, receipt-effect recovery,
  owner-signed finalized bootstrap/resync and canonical nonce-history diagnosis.
- `src/application/`: EOA sign-in and owner-scoped saved workspace commands.
- `web/`: independent fixture walkthrough and authenticated saved workspace.
- `test/`: named unit and PostgreSQL integration suites, including
  1,000 generated allocation cases.
  Register new suites in `test/run.ts`.

`npm test`, `npm run typecheck` and `npm run build` can be run individually;
`./scripts/check.sh` is the required combined check and includes
`npm run web:build`. Run `npm run web:dev` to open the P8 fixture workspace at
`http://localhost:3000`. Its local approvals and receipts are synthetic; it
cannot sign or submit a trade. The saved workspace is at
`http://localhost:3000/workspace`. Privately export `DATABASE_URL`, run
`npm run db:migrate` and set `NEXUS_APP_ORIGIN` to the exact browser origin
(default `http://localhost:3000`; HTTPS required outside local development).
New portfolios start paused with unverified balances. A deployment must register
reviewed instruments and connect trusted balance, policy and scheduling sources;
no live instrument or market source is inferred from a browser form.
Signing in uses an EOA message signature only. Trade approval remains unavailable
until the configured profile's P5.5/P7 evidence passes. Review now provides paused
owner-signed chain initialization/resync and the configured owner's one-buy pilot
plan. Neither a sign-in nor a snapshot signature approves a trade. Compiled output
is ignored. See the pilot runbook for private records, external exact allowance,
`pilot:inspect`, `pilot:declaration` and `pilot:prices`; broadcasting defaults off.
For browser interaction tests, run `npx playwright install chromium` once,
then `npm run web:e2e` (builds and tests the production web server). Supply `TEST_DATABASE_URL` to also run saved-workspace
tests against an automatically created/removed isolated schema. The browser binary is external to the npm lockfile.

## Token security inspection

Inspect the initial USDT/NVDAB security scope with `npm run security:tokens`.
This read-only command checks scanner coverage, executable source certificates,
current inner wallet governance and canonical BSC state; blocking findings exit 2.
The strict default gate requires both route-token reports and a qualified current review with
verified primary-publication PDF bytes and exact component scope. Verified source
or report bytes alone do not clear risks. The empty registry enables no live asset under strict admission. ADR 0031 adds a
separate capped owner-only profile that preserves scanner findings/unknowns and
labels independent review deferred; it still requires current controls and real
zero-tax buy/sell proof.
See the [security runbook](docs/runbooks/token-security.md) and
[current findings](docs/integrations/2026-10-01-security-collector.md).

## Portable project memory

Created from Portable. Repository documentation is authoritative; shared MCP
memory is supplementary. All configured clients use `scripts/memory-mcp.sh`.
Use one memory writer at a time and never store credentials or personal data
in project memory. Read the agent contract before making changes.


The guarded EOA server service now connects immutable PostgreSQL reviews to fresh
Market Gate evidence, exact signed-byte persistence, one-time send and historical
recovery. Broadcasting defaults to disabled; production source/risk qualification
and browser approval wiring remain open. See [the execution runbook](docs/runbooks/eoa-execution.md).


The saved Review tab now supports exact EOA approval, raw transaction signing/import,
durable storage and separate guarded submission. The built-in bStocks route adapter
uses canonical real-state checks. Operator execution configuration and qualified
sources are required; default live submission remains disabled. See
[ADR 0030](docs/decisions/0030-bstocks-route-and-web-approval.md).


Owner pilot evidence now follows [ADR 0031 Amendment 1](docs/0031-amendment-1-pilot-evidence-rules.md):
profile/manual records v2, migration 0010, current restriction manifests, dual raw/display
price checks, persistent P1–P9 diagnostics and canonical zero post-fill allowance. The
[owner runbook](docs/runbooks/owner-pilot.md) covers configuration, signing and the narrow
owner-signed R1 re-anchor flow. Strict default admission and public-release gates remain.

Run `./scripts/test-eoa-pilot.sh check` for private diagnostics. The supervised local
EOA runner collects source/gate/receipt/recovery data by default and composes the
normal signed bootstrap, planning, persistence and one-time send services. See
[funded-EOA instructions](docs/runbooks/eoa-pilot-runner.md) for hidden local key
entry, exact allowance setup, the two broadcasting switches and restart checks.
