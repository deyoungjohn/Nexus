## 2026-07-25 — newproject initialization

- Agent/client: Codex
- Change: Created Nexus from the Portable cross-agent template.
- Reason: Establish isolated project memory, agent instructions, and change tracking.
- Behavior/compatibility impact: No application behavior exists yet.
- Verification: `./scripts/check.sh`.

## 2026-09-25 — shared project memory initialization

- Agent/client: Codex
- Change: Created the `Nexus` project entity in shared MCP memory with the four
  requested observations covering Portable origins, authoritative Git-tracked
  documentation, supplementary MCP memory, and checks before and after material
  changes. Recorded initialization in project state.
- Reason: Establish retrievable shared context for future agent sessions.
- Behavior/compatibility impact: No application code or interfaces changed.
- Verification: `open_nodes` retrieved `Nexus` with all four observations;
  `./scripts/check.sh` passed before and after initialization.

## 2026-09-25 — P0/P1: phased delivery and domain foundation

- Agent/client: Codex.
- Change: Added phased implementation plan, engineering log, foundation
  specification and ADR 0002; extended the agent contract and required-document
  checks. Implemented exact denominated amounts, immutable instrument registry,
  deterministic cash allocation, synthetic CLI demo and strict TypeScript
  tooling. Added 22 named tests including 1,000 generated allocation cases.
- Reason: Begin the Nexus blueprint module by module with portable delivery
  records and tested accounting primitives before live integrations.
- Behavior/compatibility impact: New offline domain APIs and npm test/typecheck/
  build/demo commands; package renamed to Nexus. Preserved MCP configuration,
  pinned memory dependency and original checks. No wallet, database, web UI,
  executable authorization or live trade is implemented by this increment.
- Correction/lesson: Replaced file-level process-isolated test discovery with an
  explicit suite entry point for visible named results; confirmed failure exit
  propagation. Full reproduction and evidence are in `ENGINEERING_LOG.md`.
- Verification: `./scripts/check.sh` passed before implementation and after:
  22/22 named tests, strict typecheck, build and configuration checks. Synthetic
  `npm run demo` passed; `git diff --check` passed. Intentional external failure
  probe exited 1 as expected. Live integration validation remains P2.

## 2026-09-25 — P2 read-only integration evidence

- Agent/client: Codex.
- Change: Added `docs/PROJECT_LOG.md`, a dated Phase 2 integration matrix and
  ADR 0003; updated the phase plan, state, agent contract and README. Verified
  public BSC token candidates, metadata/status field shapes, share multipliers
  and on-chain decimals/code with read-only queries. Documented the open wallet,
  freshness, eligibility, quote, simulation, receipt and calendar gates.
- Reason: Ground execution architecture in observed fields and current primary
  documentation before allowing real money movement, while preserving a clear
  portable phase record.
- Behavior/compatibility impact: Documentation and required-record check only;
  no application behavior, wallet connection, trade, or dependency changed.
  P2 remains in progress, with no live execution adapter enabled.
- Verification: baseline `./scripts/check.sh` passed (22/22 named tests,
  typecheck, build and configuration checks); read-only Binance GETs and BSC RPC
  calls succeeded after network escalation; `baw wallet status --json` returned
  `UNCONNECTED`. Final `./scripts/check.sh` and `git diff --check` results were
  checked after the document changes.

## 2026-09-25 — P2 wallet status correction and quotes

- Agent/client: Codex.
- Change: Corrected the Phase 2 wallet status conclusion across project state,
  project log, integration matrix, phase plan and ADR 0003. Verified that the
  installed Agentic Wallet CLI is connected outside the sandbox. Recorded four
  successful quote-only checks for exact BSC token addresses and the fields
  their responses did and did not provide.
- Reason: The earlier sandboxed `UNCONNECTED` result contradicted the user's
  sign-in report; an outside-sandbox status check showed `CONNECTED`.
- Behavior/compatibility impact: Documentation correction only. No app code,
  wallet funds, approval or transaction changed. Quote availability improved
  Phase 2 evidence, but exact-route and funded execution gates remain open.
- Correction/lesson: Restricted CLI status can misstate the actual session;
  reproduce outside the sandbox before asking for re-authentication. Detailed
  errors, checks and remaining limitations are in `ENGINEERING_LOG.md`.
- Verification: `./scripts/check.sh` passed before and after the correction
  (22/22 tests, typecheck, build); connected `auth signin` returned
  `ALREADY_CONNECTED`, `wallet status` returned `CONNECTED`, and four
  `market-order quote` requests returned `success=true`. `git diff --check`
  passed. No trade was submitted.

## 2026-09-25 — P2 funded read-only quote boundary

- Agent/client: Codex.
- Change: Recorded a funded BSC balance check, two successful 5-USDT NVDAon
  quotes, a rejected 4-USDT quote, and AMDon/AAPLon sell-direction quotes in
  the P2 integration matrix, project log and engineering log. Updated state.
- Reason: Check whether the owner's small deposit supports the planned test
  without assuming that a successful quote guarantees execution.
- Behavior/compatibility impact: Documentation only; no application interface,
  wallet approval, order or transaction changed. P2 remains in progress.
- Verification: `./scripts/check.sh` passed before editing (22/22 tests,
  typecheck, build and configuration checks); connected read-only balance and
  quote commands returned the outcomes above. Final `./scripts/check.sh`
  passed with the same 22/22 tests, typecheck, build and configuration checks;
  `git diff --check` passed.

## 2026-09-25 — P2 candidate route and conditional simulation

- Agent/client: Codex.
- Change: Recorded a decoded KyberSwap route, failed actual-allowance call,
  successful exact-allowance state-override simulation, unsupported Binance
  token audit, and issuer IR manual event-source decision in the integration
  matrix, logs, ADR 0003, plan and project state.
- Reason: Verify concrete execution bounds and source provenance before asking
  the owner to approve any on-chain permission or trade.
- Behavior/compatibility impact: Documentation only. No application behavior,
  wallet setting, token allowance or transaction changed. P2 remains open for
  actual-wallet preview, separate approvals and receipt.
- Verification: Baseline and final `./scripts/check.sh` passed (22/22 tests,
  typecheck, build and configuration checks). Read-only Kyber API and BSC RPC
  outcomes are detailed in the engineering log and integration matrix;
  `git diff --check` passed.

## 2026-09-26 — P2 deadline-route investigation and wallet transport status

- Agent/client: Codex.
- Change: Documented a deadline-enforcing PancakeSwap V3 route candidate,
  read-only V3/V2 quote outcomes, refreshed Kyber comparison and Binance CLI
  DNS failure in the integration matrix, project state, logs and ADR 0003.
- Reason: Test whether the blueprint's on-chain deadline can be met before
  asking the owner to approve an exact trade, and record the current wallet
  preview blocker accurately.
- Behavior/compatibility impact: Documentation only. No application behavior,
  wallet setting, allowance, order or transaction changed; P2 remains open.
- Verification: Baseline and final `./scripts/check.sh` passed (22/22 tests,
  typecheck, build and configuration checks). BSC RPC V3/V2 quotes and Kyber
  route results are detailed in the integration matrix; wallet CLI returned
  `DNS_RESOLVE_FAILED` for status, settings and address. `git diff --check`
  passed. No live wallet preview or trade was performed.

## 2026-09-26 — P2 restored wallet and exact-allowance preview

- Agent/client: Codex.
- Change: Recorded restored Agentic Wallet connectivity and Developer Mode,
  current balances/zero V3 allowance, off-hours asset status, unsupported
  audit, fresh direct V3 quote, conditional deadline-bound swap simulation,
  and successful exact-5-USDT allowance preview across the integration matrix,
  project state, logs and ADR 0003.
- Reason: Make the permission request reviewable without mistaking a
  hypothetical allowance simulation for an actual wallet swap preview.
- Behavior/compatibility impact: Documentation only. No application code,
  wallet setting, allowance, order or trade changed. P2 remains open pending
  permission authorization, real swap preview, trade approval and receipt.
- Verification: Baseline and final `./scripts/check.sh` passed (22/22 tests,
  typecheck, build and configuration checks); read-only CLI preview and RPC
  results are detailed in the integration matrix. `git diff --check` passed.

## 2026-09-26 — P2 confirmed allowance and exact swap preview

- Agent/client: Codex.
- Change: Recorded the owner-authorized exact 5-USDT allowance, successful
  BSC receipt and allowance check, fresh deadline-bound V3 route, actual-state
  chain simulation, successful Agentic Wallet swap preview and pending exact
  trade confirmation. Corrected a one-base-unit minimum-output display error
  across the integration matrix and engineering log.
- Reason: Verify the live permission and complete route-bound wallet preview
  before submitting a trade, while preserving exact integer evidence.
- Behavior/compatibility impact: Documentation and external wallet allowance
  only; no application interface or trade changed. The V3 router can now spend
  at most 5 USDT until a swap consumes or the owner revokes the allowance.
  P2 remains open for trade receipt/reconciliation and source/eligibility gates.
- Verification: Baseline and final `./scripts/check.sh` passed (22/22 tests,
  typecheck, build, configuration checks); receipt status `0x1`, exact
  allowance `5e18`, actual-state RPC swap simulation and wallet swap preview
  passed; decoded calldata matched `bigint` minimum arithmetic.
  `git diff --check` passed.

## 2026-09-26 — P2 supervised route receipt and feasibility exit

- Agent/client: Codex.
- Change: Recorded the confirmed owner-approved V3 test trade, matched mined
  calldata/transfer events/receipt/balances, and raw-versus-displayed Ondo
  quantity evidence. Closed P2 in the plan, state, logs and ADR 0003 with
  production limitations assigned to P5/P7.
- Reason: Complete the Phase 2 quote → exact approval → preview → bounded
  submission → receipt and quantity-reconciliation feasibility chain.
- Behavior/compatibility impact: Nexus application code and interfaces did
  not change. The externally approved test spent the wallet's 5-USDT test
  balance and consumed its exact router allowance. Automated live trading
  remains disabled; AMDon/AAPLon are not executable allowlist entries.
- Verification: Baseline and final `./scripts/check.sh` passed (22/22 tests,
  typecheck, build, configuration checks). BSC receipt status `0x1`, matching
  calldata and ERC-20 transfers, post-trade balances/allowance and output
  above minimum were checked; wallet display matched the published multiplier
  to its precision. `git diff --check` passed. The expired-preview failure,
  correction and regression result are detailed in the engineering log.

## 2026-09-26 — P3 PostgreSQL ledger and outbox

- Agent/client: Codex.
- Change: Added pinned PostgreSQL driver/types, transactional numbered migration
  and CLI, exact portfolio balance/revision ledger, serializable per-portfolio
  reservation API, unique occurrence/idempotency protection, one active batch
  index, submitted-transaction freeze, and leased outbox worker helper. Added
  specification 0002, ADR 0004, seven real-database integration subtests and
  updated phase plan, project state and both logs.
- Reason: Give P4–P7 durable, replay-safe state and inventory accounting before
  coordinating or executing plans. Avoid treating queue delivery or elapsed
  reservation leases as proof of a chain outcome.
- Behavior/compatibility impact: New `src/ledger/` APIs, `npm run db:migrate`
  and optional `TEST_DATABASE_URL` integration mode. P1 domain interfaces and
  synthetic demo remain compatible. No wallet adapter, signer, frontend or
  automated trade path was enabled. The ledger requires PostgreSQL for use;
  without `TEST_DATABASE_URL`, its integration suite is skipped.
- Verification: Baseline check passed 22/22 tests plus typecheck/build/config.
  After implementation and documentation, a PostgreSQL 16-backed
  `TEST_DATABASE_URL=… ./scripts/check.sh` passed 30/30 tests (22 foundation,
  seven integration subtests and parent), typecheck, build and configuration.
  The two-client overspend, rollback, retry, restart, batch exclusivity,
  expired-unsubmitted-batch release and
  submitted-reservation cases passed. `git diff --check` passed. Temporary
  PostgreSQL binaries and cluster were kept outside the repository.

## 2026-09-26 — P4 Portfolio Coordinator

- Agent/client: Codex.
- Change: Added a pure coordinator for mandatory sell phases, exact-instrument
  netting, priority/proportional cash allocation and conservative company,
  sector, issuer, cash and gas limits. Added PostgreSQL policy activation,
  immutable instrument records, unique blocked occurrences and atomic
  evidence/decision/reservation commits. Added specification 0003, ADR 0005,
  phase logs and eleven pure plus six database integration tests.
- Reason: Resolve competing portfolio proposals against one versioned policy
  and reconciled application snapshot while keeping dependent purchases
  contingent until sell proceeds are confirmed.
- Behavior/compatibility impact: New `src/coordinator/` APIs and migration
  `0002_coordinator.sql`; P3 `reservePlan` accepts an optional same-transaction
  client while its original call behavior remains. No live eligibility,
  quote, owner approval, signing or automated execution path was enabled.
- Verification: Baseline `./scripts/check.sh` passed 22 foundation tests,
  typecheck/build/config with the P3 database suite explicitly skipped.
  Final real PostgreSQL 16-backed `TEST_DATABASE_URL=… ./scripts/check.sh`
  passed 48/48 tests, typecheck, build and configuration. Blueprint conflict,
  halted sale, conservative intermediate limits, wrapper/issuer aggregation,
  exact netting, cash fairness, stale revisions, policy changes and concurrent
  attempts passed. `git diff --check` passed. Reproduced and corrected P4 cash
  fairness, invalid-sell netting and raw-hold projection bugs are logged in
  the engineering log.

## 2026-09-26 — P5 offline Market Gate

- Agent/client: Codex.
- Change: Added a fail-closed market gate, read-only evidence adapter seam,
  dated exchange-session logic and direct V3 calldata decoder; added eight
  adversarial tests, specification 0004, ADR 0006 and phase records.
- Reason: P4's caller-supplied eligibility and valuations need verified source,
  quantity, route and simulation boundaries before owner approval.
- Behavior/compatibility impact: New pure `src/market-gate/` API; existing P4
  and P3 interfaces remain compatible. No production provider, signer or live
  execution path is enabled. Missing/stale/unsupported inputs block this gate.
- Verification: baseline `./scripts/check.sh` passed 33 named tests, with two
  PostgreSQL suites skipped; real PostgreSQL 16-backed final
  `TEST_DATABASE_URL=… ./scripts/check.sh` passed 56/56 tests, typecheck, build
  and configuration checks. Holiday/DST, mapping, source-age, event, quote,
  recipient/spender, settlement-conversion and simulation cases passed;
  `git diff --check` passed.

## 2026-09-26 — P5.5 read-only live-evidence groundwork

- Agent/client: Codex.
- Change: Added a fail-closed Pyth Pro reference parser/accessor and a BSC
  Ondo SyntheticSharesOracle quantity reader, five focused tests, P5.5 plan
  item, live-readiness matrix and ADR 0007.
- Reason: The P2 public price lacks a source timestamp and wallet display
  multipliers are not a durable raw-to-share mapping; live automation also
  lacks several independent safety and execution gates.
- Behavior/compatibility impact: New read-only market-evidence adapters;
  existing P3/P4/P5 APIs stay compatible. No instrument registration, signing,
  trade submission or live automation enabled. Provider/access gaps remain.
- Verification: Baseline `./scripts/check.sh` passed 41 named tests with two
  database suites skipped. Final PostgreSQL 16-backed `./scripts/check.sh`
  passed 61/61 tests, typecheck, build and configuration checks; `git diff
  --check` passed. Live read-only BSC oracle probes succeeded for NVDAon,
  AMDon and AAPLon; no authenticated Pyth response was available.

## 2026-09-26 — P5.5 keyless market evidence and calendar

- Agent/client: Codex.
- Change: Added pinned-block Chainlink BSC readers for NVDA/USD, AAPL/USD and
  USDT/USD, a short-lived Binance token-status reader, and a versioned NYSE
  calendar reader. Hardened Ondo block-header matching; added ADRs 0008/0009,
  updated P5.5 records and six named tests.
- Reason: The owner has no Pyth Pro access; a two-equity MVP can use published
  on-chain prices without a new API subscription. Calendar changes and proxy
  token-risk unknowns must fail closed.
- Behavior/compatibility impact: New read-only P5.5 adapters and an MVP
  candidate scope of NVDAon/AAPLon; AMDon remains read-only. P3/P4/P5 public
  APIs stay compatible. No wallet signer, trade submission or live instrument
  registration was added. Unsupported token audits still block live execution.
- Verification: baseline `./scripts/check.sh` passed 46 named tests with two
  database suites skipped. PostgreSQL-backed final `./scripts/check.sh`
  passed 67/67 tests, typecheck, build and configuration; `git diff --check`
  passed. Read-only BSC and NYSE probes validated decoding and stale/weekend
  blocking; no regular-session execution was tested.

## 2026-09-26 — P5.5 owner attestation and Ondo beacon identity

- Agent/client: Codex.
- Change: Added pinned `ethers` dependency, 24-hour EIP-712 owner
  attestation challenge/verification and local CLI, plus a read-only BSC
  Ondo beacon/implementation fingerprint reader. Reproduced unsupported
  NVDAon/AAPLon audits against a supported USDT control, added ADR 0010 and
  the owner/risk operating note, and updated plan, state and logs.
- Reason: Give the owner a concrete wallet-bound declaration workflow and
  detect upgrades to the contracts a later risk review would examine without
  misclassifying unsupported provider data as a clear audit.
- Behavior/compatibility impact: New read-only P5.5 APIs and
  `npm --silent run attestation -- ...`; existing P3/P4/P5 interfaces and fail-closed
  audit behavior remain intact. No actual signature, live instrument,
  signer, token approval or trade path was enabled.
- Verification: database-free baseline passed 52 tests with two database
  suites skipped; full PostgreSQL 16-backed final `./scripts/check.sh`
  passed 70/70 tests, typecheck, build and configuration. Signature-scope,
  revocation, expiry and beacon-change/failure regressions passed. Read-only
  BSC/API probes reproduced the documented observations. A synthetic CLI
  challenge/signature/verify round trip and `git diff --check` passed.

## 2026-09-26 — P5.5 settlement unit and issuer-event review process

- Agent/client: Codex.
- Change: Corrected Chainlink USDT/USD evidence to `USD-18`, added a
  configurable peg-deviation ceiling and regression checks, and documented
  the manual NVDA/AAPL issuer-event review and fail-closed uncertainty rules.
- Reason: A fresh adapter record labeled `USD` could never satisfy a
  `USD-18` P5 portfolio snapshot; an explicit peg ceiling prevents using a
  materially depegged USDT round as ordinary settlement evidence.
- Behavior/compatibility impact: P5 and P4 interfaces remain unchanged;
  `fetchChainlinkBscSettlement` now requires `maxPegDeviationBps` and returns
  the compatible valuation unit. No event evidence or live execution was
  enabled.
- Verification: PostgreSQL 16-backed baseline and post-change
  `./scripts/check.sh` passed 70/70 tests, strict typecheck, build and
  configuration. Fresh BSC settlement probe passed illustrative bounds;
  2% depeg, invalid threshold and unit mismatch regressions passed.
