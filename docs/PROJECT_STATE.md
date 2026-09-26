# Project state

Last updated: 2026-09-26

## Objective

Build Nexus as specified in [Nexus.md](../Nexus.md): coordinated tokenized-stock
portfolios on BNB Smart Chain with explicit approval, deterministic planning,
inspectable evidence and recoverable sequential execution.

## Current status

- Cross-agent workspace initialized.
- Shared MCP memory initialized with the `Nexus` project entity; all four initial
  observations were retrieved successfully through `open_nodes` on 2026-09-25.
- P0 (roadmap), P1 (domain foundation), P2 (integration feasibility), P3
  (durable ledger), P4 (Portfolio Coordinator) and P5 (offline Market Gate)
  are complete. P6 (rules and scheduling) is next. See
  [the implementation plan](IMPLEMENTATION_PLAN.md) for all phases and exit gates.
- P2 read-only evidence: chain 56, BSC USDT and three Ondo candidate token
  contracts (NVDAon, AMDon, AAPLon); public metadata/status and RPC `decimals()`
  agree on 18 decimal places. Public responses lack a source timestamp for the
  stock reference price; wallet display multipliers alter displayed quantities.
  See [the integration matrix](integrations/2026-09-25-phase-2.md).
- Agentic Wallet CLI version 1.10.0 is installed and reports `CONNECTED` when
  checked outside the sandbox. Quote-only checks succeeded for USDT to NVDAon,
  AMDon and AAPLon, plus each token back to USDT, without submitting transactions.
  After the owner's funding, a read-only balance check showed settlement and
  native-gas assets present. Two 5-USDT NVDAon quotes succeeded; a 4-USDT quote
  was rejected with a greater-than-$5 value message. The
  earlier sandboxed `UNCONNECTED` response was a false negative; its cause and
  correction are logged. A direct V3 route, exact allowance, wallet preview,
  mined trade and reconciled receipt were verified for one supervised NVDAon
  test. No application live execution adapter is enabled.
- KyberSwap supplied an unsigned, decoded 5-USDT-to-NVDAon route with fixed
  wallet recipient, exact input and 0.5% minimum-output bound. Actual router
  allowance is zero; direct `eth_call` reverted, while a read-only exact-
  allowance state override succeeded and estimated gas. Agentic Wallet
  Developer Mode was disabled on 2026-09-25. After a VPN-related DNS failure,
  the owner enabled Developer Mode and 2026-09-26 CLI checks returned
  `CONNECTED` and `devMode.enabled=true`. A deadline-bound PancakeSwap V3
  direct route quoted below a separate opaque wallet quote; it passed
  read-only chain simulation with a temporary exact allowance override.
  The owner authorized an exact 5-USDT approval and bounded trade. Both
  BSC receipts succeeded. Mined swap calldata matched the preview, and token
  transfer logs, raw balances and spent allowance reconciled. The received
  NVDAon exceeded the encoded minimum. Wallet display quantity matched raw
  tokens times the public shares multiplier, truncated to display precision.
  Binance token audit returned no supported result for NVDAon; the trade
  occurred while public token status was open but off-hours.
- For MVP earnings confirmation, use manual issuer investor-relations
  announcements with direct provenance and rechecks. Label demo user-supplied
  events separately; defer automated ingestion until source rights and revision
  behavior are verified. No date-dependent live rule is enabled.
- Implemented: exact denominated quantities and serialization, immutable
  instrument metadata registry, deterministic priority/proportional cash
  allocation with separate native gas checks, and a synthetic CLI example.
- Implemented in P3: PostgreSQL migration for portfolio/revision/balance,
  policy/evidence/decision records, plans, exact reservations, transaction
  identities and outbox. The ledger serializes plan and revision writes per
  portfolio, blocks overspending and unresolved submissions, and exposes an
  at-least-once leased worker helper. See
  [specification 0002](specifications/0002-durable-ledger.md).
- Implemented in P4: pure deterministic coordinator and PostgreSQL decision
  store with versioned policy activation, immutable instrument mappings,
  snapshot-to-ledger checks, exact-instrument netting, sell-first phases,
  priority/proportional cash allocation and conservative company/sector/issuer
  limits. The blueprint NVDA/AMD example resolves to a $30 NVDA sell and a
  contingent $30 AMD buy; only a new reconciled revision can reserve that buy.
  See [specification 0003](specifications/0003-portfolio-coordinator.md).
- Implemented in P5: a pure fail-closed market gate and read-only evidence
  adapter seam. It checks exact eligibility, quantity mapping/version, separate
  reference/session/status/quote clocks, dated holiday/DST sessions, issuer
  events, clear supported audit, held-position valuation freshness, decoded
  direct-V3 route bounds, normalized price and settlement
  conversion, gas/cost limits, full-size P4 limits and exact simulation fields.
  It emits an evidence hash for P7 revalidation. See
  [specification 0004](specifications/0004-market-gate.md).
- Verified: 56 tests with a real PostgreSQL 16 server, including eight P5
  named tests and all P3/P4 database cases; 1,000 generated allocation cases,
  strict typecheck, build and Portable configuration checks pass.
- Next: P6 rules and scheduling. Production source adapters remain blocked by
  unverified owner/transfer eligibility, source-timestamped stock reference,
  token-specific economic quantity mappings, maintained calendar/event checks,
  settlement valuation and unsupported-audit policy. No live market evidence
  is fabricated from P2. P7 must add approval binding, pre-leg revalidation,
  idempotent submission, receipt recovery and reorg handling.
- Detailed work, tests, reporting correction and lessons recorded in
  [the engineering log](ENGINEERING_LOG.md). One supervised mainnet trade was
  performed with separate owner approval; the application remains offline.

## Architecture

- Modular monolith; domain kernel in `src/domain/`, PostgreSQL ledger in
  `src/ledger/`, offline coordinator in `src/coordinator/` and pure market gate
  in `src/market-gate/`; no web runtime framework.
- Node.js 22.x; TypeScript 5.9.3; Node types 22.18.6; pinned npm lockfile.
- Native `bigint` accounting with explicit chain/token denomination; JSON base
  units are strings. Identity never uses ticker symbols as execution keys.
- Runtime database driver: `pg` 8.23.0; types 8.23.1. Numbered SQL migrations
  in `migrations/` (P4 adds `0002_coordinator.sql`); `DATABASE_URL` is required
  for `npm run db:migrate`.
- Tests: Node's built-in runner via explicit `test/run.ts` imports; new suites
  must be registered there. `test/` compiles into ignored `dist-test/`. Set
  `TEST_DATABASE_URL` to run the real PostgreSQL integration suite; without it,
  the suite is reported as skipped.
- Build: TypeScript into ignored `dist/`. `npm run demo` runs synthetic data.
- Planned: P6 rules, Next.js application and verified live EVM/wallet adapters.
  No frontend, signing or application trade execution exists yet.
- Decisions: ADR 0001 (shared memory), ADR 0002 (domain kernel and allocation),
  ADR 0003 (Phase 2 integration gates and quantity semantics), ADR 0004
  (PostgreSQL ledger and leased outbox), ADR 0005 (staged conservative planning),
  ADR 0006 (market evidence boundary and direct V3 decoder).

## Required verification

Run:

```bash
./scripts/check.sh
```

Install pinned dependencies with `npm ci` on Node 22.x first. The script validates
required project records, shell and MCP config syntax, then runs tests, strict
type checking and build. It remains the single entry point for required checks.
For full P3/P4 evidence, run it with `TEST_DATABASE_URL` pointing to an isolated
PostgreSQL test database. A database-free run skips their integration suites.

## Known limitations

- P1 allocation remains pure spending math. The P4 coordinator adds offline
  concentration constraints and durable reservations but cannot establish
  freshness, eligibility, owner authorization or chain state. It must not be
  connected directly to a wallet.
- Registry entries are metadata, not verified token support. Unknown quantity
  models remain read-only; the CLI example identities and balances are synthetic.
  Phase 2 observed real candidate addresses in documentation only; none are
  installed as executable instruments in the application.
- Binance public market status is momentary. The observed reference-price
  payload did not expose a source timestamp; receipt time does not establish
  underlying price freshness. User eligibility remains to be verified.
- Agentic Wallet status returned a false `UNCONNECTED` result in the sandbox;
  the same CLI reported `CONNECTED` outside it. Quote responses expose amounts
  and slippage but no route transaction fields. A separate Kyber route was
  decoded and conditionally simulated with a temporary allowance override,
  not the wallet's then-zero allowance. The connected wallet's exact V3
  allowance and one bounded swap were subsequently confirmed and reconciled.
  This does not establish eligibility or recovery behavior for automation.
  The Binance CLI was
  temporarily unreachable due to DNS on 2026-09-26 and then recovered. A
  successful 5-USDT quote does not guarantee execution at the observed size
  boundary.
- The P3 ledger stores raw balances supplied by a caller; it does not verify
  their chain source or resolve submitted transactions. Outbox delivery is at
  least once and future handlers must deduplicate. A database-free check does
  not exercise concurrency or crash recovery. No P3 worker handler calls a
  wallet. Production deployment roles and backup procedures remain open.
- P4 snapshots match application-ledger balances and immutable registered
  classifications. Their valuation bounds, eligibility flags, proceeds and
  source block are still caller inputs, not externally verified facts. A
  contingent post-sell buy is preview only. P5 must validate market evidence,
  clocks and quantity mapping; P7 must recheck each leg before execution.
- Live adapters, calendar verification and full execution recovery are pending.
- The local MCP memory package should not be written by multiple agent processes
  concurrently. Close one agent and its MCP process before opening the next.
- MCP memory is supplementary and does not replace tests, Git history, decision
  records, specifications, or the change ledger.
