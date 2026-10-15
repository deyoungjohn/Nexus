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

## 2026-09-26 — P5.5 Ondo risk-scope clarification

- Agent/client: Codex.
- Change: Recorded Sourcify verified-source and pinned-block findings about
  Ondo's shared implementation, beacon, compliance and pause controls in
  ADR 0010, the integration note, state and logs.
- Reason: A code hash does not capture control-pointer or privileged-role
  changes, so it cannot alone justify a token-audit exception.
- Behavior/compatibility impact: Documentation only. P5 continues to block
  unsupported audit results; no exception or trade path was enabled.
- Verification: Read-only Sourcify source and BSC calls;
  PostgreSQL-backed `./scripts/check.sh` passed 70/70 tests, typecheck/build/
  config, and `git diff --check` passed.

## 2026-09-26 — P5.5 xStocks-first BSC provider integration

- Agent/client: Codex.
- Change: Made xStocks the first live-provider target in the implementation
  plan; added ADR 0011, an xStocks BSC evidence matrix, and a separate
  read-only exact-token/current-v2-wrapper quantity adapter with three tests.
  Updated project state, market-gate specification and phase logs.
- Reason: The owner chose xStocks as the initial provider. Its EVM rebasing
  token and current non-rebasing wrapper need different quantity handling from
  Ondo, while an actual BSC execution route must be verified independently.
- Behavior/compatibility impact: New read-only P5.5 functions and
  `xstocks-v2-wrapper` quantity evidence. Existing P3/P4/P5 interfaces and
  Ondo adapters remain compatible. No xStocks instrument, signer, allowance,
  trade submission or policy exception was enabled. All four tested 5-USDT
  wallet quotes lacked liquidity, so live execution remains blocked.
- Verification: baseline PostgreSQL-backed `./scripts/check.sh` passed 70/70;
  final PostgreSQL-backed run passed 73/73 tests, strict typecheck, build and
  configuration. Read-only issuer/BSC probes verified two current wrappers;
  `git diff --check` passed. No wallet state change occurred.

## 2026-09-26 — P5.5 wider xStocks route evidence

- Agent/client: Codex.
- Change: Documented eight additional read-only 5-USDT BSC xStocks wallet
  quotes and the economically implausible SPYx result in the P5.5 matrix,
  ADR, state and phase logs.
- Reason: A nonempty quote alone could otherwise be mistaken for a viable
  replacement route after NVDAx/AAPLx returned no liquidity.
- Behavior/compatibility impact: Documentation only; no candidate was
  execution registered, and no wallet state changed.
- Verification: PostgreSQL-backed baseline and post-change
  `./scripts/check.sh` passed 73/73 tests, strict typecheck/build/config;
  `git diff --check` passed. Eight wallet quotes were read-only.

## 2026-09-27 — P5.5e BSC tokenized-stock liquidity survey

- Agent/client: Codex.
- Change: Added a dated report and 671-row per-token CSV of BSC stock-provider
  inventory, direct USDT pool reserves, reported 24-hour pool volume, and
  read-only 100/1,000/10,000-USDT wallet quotes. Updated the active P5.5e plan,
  project state and phase/engineering logs. The report ranks the 20 deepest
  quoteable bStocks equity USDT pools and explains why Ondo/xStocks lack a
  defensible top 20 at the Sunday snapshot; five other feed records are
  inventoried separately.
- Reason: Provider listing and token deployment alone had masked a severe BSC
  route-liquidity difference. Decisions need measured depth, quote behavior and
  explicit market-hour limits instead of presumed liquidity.
- Behavior/compatibility impact: Documentation and research data only; no
  application code, provider priority, instrument registration, approval or
  wallet state changed. Quote observations are not execution evidence.
- Verification: PostgreSQL-backed baseline, report-only, expanded-inventory
  and post-documentation `./scripts/check.sh` runs passed 73/73 tests plus
  strict typecheck, build and Portable configuration. Read-only wallet and
  pool queries covered the listed scope; `git diff --check` and CSV/report
  consistency checks passed.

## 2026-09-27 — P5.5 bStocks-first pivot and bounded BSC route

- Agent/client: Codex, following the owner's provider switch.
- Change: Superseded xStocks-first priority with [ADR 0012](decisions/0012-bstocks-first-bsc-provider.md),
  updated the implementation plan and project state, and added a
  [bStocks BSC route matrix](integrations/2026-09-27-bstocks-bsc.md).
  Updated the Market Gate specification and both phase logs. A pinned-block
  5-USDT direct PancakeSwap V3 route to the exact NVDAB contract was quoted,
  encoded with a minimum output/deadline, decoded by Nexus and simulated
  read-only. High-minimum and expired-deadline negative simulations reverted.
- Reason: The 671-record BSC liquidity survey found sparse or economically
  poor xStocks routes, while bStocks provided materially deeper direct USDT
  pools and size-stable wallet quotes. A usable exact route format needed
  verification before treating bStocks as the first live-provider target.
- Behavior/compatibility impact: Documentation and read-only evidence only.
  Ondo/xStocks modules and all application interfaces remain intact. No
  bStocks quantity adapter, instrument registration, signer, approval, trade
  or production market-evidence exception was enabled. The route requires a
  fresh quote and actual funding/allowance; audit and eligibility remain open.
- Verification: PostgreSQL-backed baseline and post-change
  `./scripts/check.sh` passed 73/73 tests, typecheck, build and Portable
  configuration. Official factory/pool/token reads, 5/100/1,000/10,000-USDT
  QuoterV2 probes, on-chain BEP-677 multiplier read, price screening,
  conditional `eth_call`, gas estimate and negative bounds were recorded.
  `git diff --check` passed; no wallet state changed.

## 2026-09-27 — P5.5b bStocks quantity and control snapshot

- Agent/client: Codex, continuing the owner's bStocks-first integration.
- Change: Added a separate read-only exact-NVDAB BSC adapter for pinned BEP-677
  raw/UI multiplier and schedule, beacon/implementation fingerprints, mutable
  compliance/pause-manager pointers, token pause state and admin/issuer role-set
  hashes. Added three named tests, [ADR 0013](decisions/0013-bstocks-display-mapping-boundary.md),
  and updated the integration matrix, Market Gate specification, implementation
  plan, project state and phase logs.
- Reason: The validated route still lacked provider-specific quantity semantics
  and a way to detect changes to the code and controls that govern transfers.
  Binance's multiplier describes display adjustment; the P5 stock-share ratio
  requires separate economic evidence.
- Behavior/compatibility impact: New read-only module only. Raw amounts remain
  canonical; no bStocks instrument is registered, no audit is marked clear,
  and no wallet approval, trade or application executor is enabled. Existing
  Ondo/xStocks and P3/P4/P5 interfaces remain intact. External manager policy,
  eligibility, reference pricing, issuer events and P7 remain open.
- Verification: Baseline `./scripts/check.sh` passed 58 tests with two database
  suites skipped. Post-change local checks pass 61 tests with two database
  suites skipped, plus strict typecheck/build/config. Two live read-only BSC
  probes confirmed the exact contract and controls; the later pinned probe at
  block 124352879 had no pending multiplier and `isTokenPaused=false`.
  Sourcify reports an exact runtime match for the current implementation.
  `git diff --check` passed; no wallet state changed.

## 2026-09-27 — P5.5c bStocks on-chain transfer preflight

- Agent/client: Codex, continuing the owner's bStocks-first integration.
- Change: Added a read-only same-block transfer-control preflight for the
  exact NVDAB V3 route's wallet, pool and router. It rechecks token pause and
  compliance calls, requires a reviewed control fingerprint, and fails closed
  on restrictions, stale blocks or provider errors. Added three named tests,
  [ADR 0014](decisions/0014-bstocks-transfer-preflight-boundary.md), and
  updated the route matrix, Market Gate specification, plan, state and logs.
- Reason: The verified token implementation consults mutable compliance and
  pause contracts during transfers. A route quote or code hash cannot prove
  that the current participants can transfer.
- Behavior/compatibility impact: New read-only evidence only. It does not
  certify geographic/account eligibility, produce P5 `EligibilityEvidence`,
  clear unsupported audit, register an instrument or enable wallet execution.
  Existing P3/P4/P5 and provider modules remain intact.
- Verification: Baseline `./scripts/check.sh` passed 61 tests with two database
  suites skipped. Post-change check passed 64 tests with two database suites
  skipped, plus typecheck/build/config. A live read-only BSC call passed for a
  synthetic address and public route contracts at block 124353819; no user
  eligibility or wallet state was established. `git diff --check` passed.

## 2026-09-27 — P5.5d bStocks external-control fingerprint

- Agent/client: Codex, continuing the bStocks-first integration.
- Change: Extended the read-only bStocks fingerprint with external compliance/
  pause-manager administrator role-set hashes and token mint/burn switches;
  updated regression tests, ADR 0013, the route matrix, plan, state and logs.
- Reason: Manager roles and token issuance switches can change independently of
  code hashes and pointers, invalidating an earlier control review.
- Behavior/compatibility impact: More complete change detection; no token is
  marked audit-clear, no eligibility is inferred, and no live execution is
  enabled. Existing provider and Market Gate behavior remains unchanged.
- Verification: Baseline and post-change `./scripts/check.sh` passed 64 tests
  with two PostgreSQL suites skipped, plus typecheck/build/config. A live
  read-only BSC probe at block 124354706 confirmed both switches enabled,
  no pending multiplier and token not paused. `git diff --check` passed.

## 2026-09-27 — P5.5c bStocks dual-event review requirement

- Agent/client: Codex, continuing the owner's bStocks-first integration.
- Change: Added [ADR 0015](decisions/0015-bstocks-dual-event-review.md),
  updated the issuer-event runbook, Market Gate specification, P5.5 plan,
  bStocks route matrix, project state and phase/engineering logs.
- Reason: Binance's historical NVDAB dividend notice shows token-provider
  multiplier and service changes that an underlying-company event check or
  open spot market would miss.
- Behavior/compatibility impact: Documentation and live-readiness requirement
  only. The existing single-source P5 gate remains unchanged; bStocks live
  registration remains blocked pending schema/policy/tests and other gates.
  No wallet or application state changed.
- Verification: Baseline `./scripts/check.sh` passed 64 tests with two
  PostgreSQL suites skipped, plus typecheck/build/config. Post-change check
  also passed 64 tests with the same two skips, plus typecheck/build/config;
  `git diff --check` passed.

## 2026-09-27 — P5.5c provider-event evidence gate

- Agent/client: Codex, continuing the owner's bStocks-first integration.
- Change: Added separately timed and revisioned `ProviderEventEvidence` to
  the Market Gate collection seam and pure gate. Instruments with canonical
  issuer ID `bstocks` require it; missing/stale/restricted records block and
  notice revisions change the evidence hash. Added synthetic regression tests
  and hardened issuer/provider notice URL and confirmation validation. Updated
  ADR 0015, specification, plan, state, route matrix and logs.
- Reason: A bStocks-specific notice can affect token entitlement and services
  while the underlying issuer calendar and spot status look unchanged.
- Behavior/compatibility impact: bStocks metadata now has a fail-closed event
  check. Other issuer fixture behavior and adapter implementations remain
  compatible via the optional collection method. No live notice source or
  instrument is registered; no wallet execution is enabled.
- Verification: Baseline `./scripts/check.sh` passed 64 tests with two
  PostgreSQL suites skipped. Post-change check passed 66 tests with the same
  two skips, plus typecheck/build/config; `git diff --check` passed.

## 2026-09-28 — EOA-first wallet priority and route-specific eligibility

- Agent/client: Codex, following the owner's EOA-first direction.
- Change: Added [ADR 0016](decisions/0016-eoa-first-wallet-execution.md),
  clarified ADR 0014, and updated the implementation plan, Market Gate
  specification, project state and phase/engineering logs.
- Reason: The blueprint's owner-approved MVP can use an EOA without the
  Agentic Wallet CLI, and the public bStocks FAQ does not state a universal
  Binance account-status prerequisite for direct external-wallet DEX use.
  Provider geographic and address restrictions remain separate requirements.
- Behavior/compatibility impact: Documentation and delivery priority only;
  no signing, trade, live instrument or Market Gate behavior changed. P6 and
  synthetic EOA P7 work may advance while P5.5 live bStocks gates remain open.
- Verification: Baseline `./scripts/check.sh` passed 66 tests with two
  PostgreSQL suites skipped, plus typecheck/build/config. Post-change check
  passed the same 66 tests and two skips, plus typecheck/build/config;
  `git diff --check` passed.

## 2026-09-28 — bStocks access flow and synthetic P6/P7 foundations

- Agent/client: Codex.
- Change: Documented the bStocks server-side access flow; added strict pure
  rules/scheduling, EOA EIP-712 exact-leg approval and signed EIP-1559 swap
  verification, seven named tests, specifications 0005/0006 and ADR 0017.
- Reason: Advance the portable phase plan under the owner's EOA-first direction
  while retaining bStocks jurisdiction and issuer gates.
- Behavior/compatibility impact: New offline APIs only. Existing P3/P4/P5
  behavior is preserved. No live bStocks eligibility source, signer or trade
  broadcaster was enabled. P6 and P7 remain in progress.
- Verification: Baseline `./scripts/check.sh` passed 66 tests and two
  PostgreSQL skips; post-change check passed 73 tests and two skips, plus
  typecheck, build and configuration checks. The database suites require
  `TEST_DATABASE_URL` and were not run in this environment.

## 2026-09-28 — P5.5c bStocks access-control core

- Agent/client: Codex.
- Change: Added short-lived EOA/session challenge binding, a fail-closed
  bStocks access composer over reviewed jurisdiction, country, product and
  on-chain transfer checks, and required route-bound access evidence in P5.
  Added five named tests, ADR 0018 and updated the runbook, plan, state and logs.
- Reason: Enforce the bStocks third-party geographic and wallet restrictions
  inside Nexus before any exact owner-approved leg can be prepared.
- Behavior/compatibility impact: bStocks P5 inputs without the new access
  evidence now block; non-bStocks gate behavior is unchanged. No production
  country endpoint, web runtime, signing or trade submission is enabled.
- Verification: Baseline `./scripts/check.sh` passed 73 tests with two database
  skips. Final check passed 78 tests with two database skips, plus typecheck,
  build and configuration checks; `git diff --check` passed.
## 2026-09-28 — P7 EOA persistence and recovery groundwork

- Agent/client: Codex.
- Change: Added migration 0003, default-paused EOA owner/nonce binding,
  transactional signed-leg persistence and one-time pre-leg claim, read-only
  canonical BSC receipt observation, recovery states, exact balance-delta
  reconciliation and sequential/partial-basket decisions. Added eight named
  tests, ADR 0019 and updated plan, state, specification and logs.
- Reason: Preserve the signed transaction identity before any network action
  and prevent timeouts or crashes from causing blind duplicate submissions.
- Behavior/compatibility impact: New P7 APIs and schema; existing P3 legacy
  interfaces remain. No broadcaster or live instrument was enabled. P7 remains
  in progress because PostgreSQL and chain recovery integration are unverified.
- Verification: Baseline `./scripts/check.sh` passed 78 tests with two database
  skips. Post-change check passed 85 tests with three skips, plus typecheck,
  build and configuration. `git diff --check` passed. The new P7 database suite
  requires `TEST_DATABASE_URL` and was not run here.
- Review correction: a deep reorg after reconciliation now marks the leg
  reorged, pauses execution and advances the portfolio revision; automatic
  execution cannot use the stale balance snapshot. Added pure and PostgreSQL
  regression assertions. The PostgreSQL path remains unverified locally.

## 2026-09-29 — P7 database-verification record

- Agent/client: Codex.
- Change: Recorded the supplied-test-DB attempt and its sandbox connection
  failure in the engineering log, project log and state. No application code
  or database data changed.
- Reason: Preserve the exact verification gate and distinguish an environment
  permission failure from a migration or store defect.
- Behavior/compatibility impact: None; P7 remains in progress and live
  execution disabled.
- Verification: `./scripts/check.sh` with `TEST_DATABASE_URL` set passed 85
  tests and failed three PostgreSQL suites at `connect EPERM 127.0.0.1:5432`
  before running database assertions. The no-database check after the
  documentation update passed 85 tests with three skips, plus typecheck,
  build and configuration checks. A retry after the owner reported the
  container ready failed at the same sandbox TCP boundary.
- Follow-up: owner reports that the full check passes from the host shell with
  the disposable test database. The agent's numeric-localhost retry still
  passed 85 non-database tests and failed P3/P4/P7 before connecting with
  sandbox `EPERM`. Recorded host-side execution as the environment fix; no
  application behavior changed, and the host output was not captured here.

## 2026-09-29 — Correct P7 PostgreSQL validation record

- Agent/client: Codex.
- Change: Marked the current P7 migration/store integration test as passed on
  the owner's host run: 101 passing tests, including the named P7 PostgreSQL
  signed-leg suite. Updated plan, state, specification, ADR and logs; no
  application code changed.
- Reason: Earlier status conflated the agent sandbox's `EPERM` with the host
  result and understated verified P7 progress.
- Behavior/compatibility impact: Documentation only. Remaining P7 recovery
  and guarded-broadcast gates still block live execution.
- Verification: Owner-provided host result above; agent pre-change no-database
  `./scripts/check.sh` passed 85 tests with three skips, typecheck, build and
  configuration. Agent post-change no-database check passed the same 85 tests
  with three skips, plus typecheck, build and configuration.

## 2026-09-29 — Independently verify P7 PostgreSQL store

- Agent/client: Codex.
- Change: Updated the implementation plan, project state, EOA specification,
  ADR 0019 and logs to record direct PostgreSQL-backed validation after
  workspace network access was enabled. No application code changed.
- Reason: Replace the earlier sandbox-limited verification status with an
  accurate result from this session.
- Behavior/compatibility impact: Documentation only; P7 and live bStocks
  remain gated by the other documented requirements.
- Verification: `TEST_DATABASE_URL`-backed `./scripts/check.sh` passed 101
  tests, zero failures/skips, including the P7 signed-leg store suite;
  typecheck, build and configuration passed. The post-documentation run
  passed the same 101 tests with no skips, plus typecheck, build and
  configuration.

## 2026-09-29 — P7 chain-evidence adapters

- Agent/client: Codex.
- Change: Added a read-only chain-56 native/ERC20 balance reader pinned to an
  expected block hash and a bounded canonical same-wallet/same-nonce mined
  replacement scan. Updated specification, plan, state, ADR and phase logs.
- Reason: Supply concrete chain evidence for eventual P7 reconciliation while
  keeping ambiguous nonce use and reorgs unresolved.
- Behavior/compatibility impact: Additive optional read-only APIs; existing
  observation requests and store behavior remain compatible. No broadcaster
  or live bStocks execution is enabled.
- Verification: PostgreSQL-backed `./scripts/check.sh` passed 106 tests, zero
  failures/skips, plus typecheck, build and configuration. Synthetic tests
  cover pinned balances, reorg rejection, replacement detection and incomplete
  evidence. Remaining gates are recorded in specification 0006 and state.

## 2026-09-29 — Harden persisted EOA recovery

- Agent/client: Codex.
- Change: Required exact-receipt-block, complete tracked-asset and native-gas
  snapshots; added store-derived BSC observation and a read-only finalized
  balance-candidate builder; blocked unpause with unresolved execution.
  Expanded PostgreSQL restart and synthetic adversarial tests.
- Reason: Prevent a later-block or incomplete snapshot from silently changing
  portfolio accounting, and prevent a deep reorg from being unpaused without
  repair.
- Behavior/compatibility impact: Additive recovery APIs; reconciliation and
  unpause reject formerly accepted unsafe inputs. No live broadcaster or trade.
- Verification: PostgreSQL-backed `./scripts/check.sh` passed 109 tests, zero
  failures/skips, plus strict typecheck, build and configuration. The balance
  candidate is exercised against the real test store with mocked BSC RPC.
  Production reconciliation still needs receipt-effect proof and authorized
  source wiring.

## 2026-09-29 — Require receipt effects for EOA recovery

- Agent/client: Codex.
- Change: Added canonical BSC receipt/log/gas reader, exact ERC20 Transfer and
  native-gas proof, migration 0004 for the proof digest, and a PostgreSQL
  recovery driver. Added pure adversarial and real-database recovery tests;
  recorded the supported token behavior in ADR 0020.
- Reason: A successful receipt and a balance delta alone cannot attribute the
  wallet's token and gas changes to the tracked transaction.
- Behavior/compatibility impact: Reconciliation now rejects missing or
  contradictory receipt effects and nonzero native transaction value. No live
  broadcaster, wallet action or bStocks execution is enabled.
- Verification: PostgreSQL-backed `./scripts/check.sh` passed 112 tests with
  zero failures/skips, plus typecheck, build and configuration. Invalid proof
  and incomplete gas leave the submitted reservation frozen; valid evidence
  reconciles once and stores a digest.

## 2026-09-29 — Add labelled P8 fixture web workflow

- Agent/client: Codex.
- Change: Added a Next.js/React workspace with read-only EOA discovery,
  synthetic basket planning, bounded/expiring fixture review, local-only
  acknowledgement, sample outcome history, JSON export and browser pause.
  Added five model tests, specification 0007 and ADR 0021; included the web
  build in `./scripts/check.sh`.
- Reason: Make the blueprint's decision flow reviewable while P5.5 and P7 live
  evidence/recovery gates remain open.
- Behavior/compatibility impact: New `npm run web:dev`, `web:build` and
  `web:start` commands; no changes to headless execution interfaces. Browser
  fixture records have no wallet or server authority. Live trading remains
  disabled. The sample spend ceiling now stays within the contribution even
  with a one-cent reserve.
- Verification: PostgreSQL-backed baseline passed 112 tests. Final
  `./scripts/check.sh` passed 117 tests, zero failures/skips, plus strict
  typecheck, headless/Next.js builds and configuration; a local production
  HTTP smoke returned 200 with fixture labels. The one-cent-reserve regression
  assertion passed. Broader accessibility review remains open.
- Additional verification: three Chromium Playwright tests passed for the
  local end-to-end walkthrough, error/pause handling and mobile keyboard/wallet
  discovery. `npm run web:e2e` is a separate command requiring an installed
  Chromium binary. The post-browser-test `./scripts/check.sh` passed 117 tests,
  zero failures/skips, and both builds; broader accessibility review remains
  open.

## 2026-09-30 — P6 durable rule scheduling

- Agent/client: Codex.
- Change: Added migration 0005, immutable compiled drafts/review lifecycle,
  persisted occurrence/evidence batches, conservative intent-to-P4 mapping
  and revision-pinned allocation quantities. Added PostgreSQL concurrency,
  restart, rollback, event/freeze/expiry and allocation tests. Fixed schedule
  windows crossing local midnight. Added specification updates and ADR 0022.
- Reason: Persist reviewed instructions and prevent duplicate reservations
  when a scheduling worker races or restarts.
- Behavior/compatibility impact: Additive `RuleStore`/planning interfaces and
  same-client P4 transaction composition; existing callers remain compatible.
  Rule mutations invalidate held plans and cannot release submitted funds.
  Valuations/events remain trusted server inputs; no signing/submission path.
- Verification: Full PostgreSQL-backed check passed 129 tests with zero
  failures/skips, strict typecheck and both builds. Subsequent integration
  checks passed 138 and 139 tests; original scheduling/DST cases still pass.

## 2026-09-30 — P8 owner-authenticated saved workspace

- Agent/client: Codex.
- Change: Added migration 0006, single-use EOA sign-in/session store,
  transactional owner-scoped application service and `/workspace`. Connected
  canonical basket/price save/review/activation, balances/reservations,
  decision/evaluation and safe receipt display/export, and server pause.
  Added explicit data-provenance labels, HTTP origin/session/body guards,
  wallet-change response invalidation and four PostgreSQL-backed Chromium
  cases. Retained `/` fixture flow; updated ADR 0023 and portable records.
- Reason: Replace browser-only persistence with inspectable saved backend state
  while the live evidence/recovery gates remain open.
- Behavior/compatibility impact: `DATABASE_URL` migrations and exact
  `NEXUS_APP_ORIGIN` configure saved state. New portfolios start paused with
  unverified balances. Shared backend transaction seams are additive. Web
  build/dev use Webpack extension aliases for NodeNext source imports;
  `web:e2e` tests the production server and uses isolated PostgreSQL when
  `TEST_DATABASE_URL` is supplied. No live signer/broadcast or trade endpoint.
  Sign-in does not establish bStocks eligibility. Browser earnings creation
  awaits trusted server event review. Git staging is unavailable under the
  current read-only `.git` policy.
- Verification: Saved backend check passed 138 tests; web integration check
  passed 139 with zero failures/skips and both builds. Seven Chromium tests
  pass for the saved workflow/security/account-change/mobile cases and three
  original fixture cases. Intermediate compiler/browser findings and their
  corrections are recorded in ENGINEERING_LOG. Final PostgreSQL-backed
  `./scripts/check.sh` passed 139 tests, zero failures/skips, typecheck,
  headless/production web builds and configuration checks.

## 2026-09-30 — Free-source readiness and access-policy clarification

- Agent/client: Codex.
- Change: Recorded owner-selected public RPC/free-data preference and dated
  read-only capability/source-clock results; clarified terms acceptance versus
  bStocks eligibility and the limits of the FAQ's contact guidance.
- Reason: Identify usable free inputs without overstating RPC recovery support,
  price freshness or compulsory issuer-contact requirements.
- Behavior/compatibility impact: Documentation only; no live registration,
  application code/interface change, eligibility bypass or policy relaxation.
- Verification: PostgreSQL-backed baseline passed 139 tests, zero failures/skips
  and both builds. Public RPC/feed probes and current official-source review
  are recorded in the integration report. Post-documentation
  `./scripts/check.sh` passed 139 tests, zero failures/skips, strict typecheck,
  headless/production web builds and configuration checks.

## 2026-09-30 — Eligibility challenges and provider reassessment

- Agent/client: Codex.
- Change: Added `docs/verificaton-challenges.md` with the major bStocks access
  dependency, source-backed xStocks/Ondo comparison, responsibility boundaries
  and conditional pivot steps; updated plan, state and project/engineering logs.
- Reason: Assess alternatives under owner-reported support delays without
  treating permissionless transfers or terms acceptance as integration approval.
- Behavior/compatibility impact: Documentation only. Provider priority, access
  policy and application interfaces remain unchanged. Corrected blanket
  direct-issuer onboarding assumptions for secondary Ondo acquisition; other
  live source/risk/recovery prerequisites remain open.
- Verification: PostgreSQL-backed baseline passed 139 tests, zero failures/skips,
  typecheck, both builds and configuration checks. Current official issuer and
  integration sources are linked in the report. Post-documentation full check
  also passed 139 tests, zero failures/skips, strict typecheck, both builds and
  configuration checks; `git diff --check` passed. No wallet action or outreach.

## 2026-09-30 — Regular-session Ondo BSC route evidence

- Agent/client: Codex.
- Change: Added a dated Ondo secondary-route report and structured public
  observations for inventory/pools, four-size quotes, synthetic bounded router
  effects, source clocks, audits and aggregator intermediaries; updated plan,
  state, verification challenges and engineering/project logs.
- Reason: Reassess the alternative-provider recommendation during an open
  regular session and distinguish quote availability from full-size execution.
- Behavior/compatibility impact: Documentation/evidence only. Small direct
  NVDA calls spent full input and received the quote; AAPL's direct pool
  returned dust with partial input consumption. Broader aggregator paths may
  cross unreviewed intermediaries or bStocks. No live price-bound approval,
  provider pivot, application/interface change or policy relaxation.
- Verification: Baseline PostgreSQL-backed full check passed 139 tests,
  zero failures/skips, typecheck, headless/production web builds and config
  checks. Dated read-only probes include minimum/expiry rejection and paired
  observer gas controls. Post-documentation PostgreSQL-backed full check passed
  139 tests, zero failures/skips, strict typecheck, both builds and config
  checks; structured evidence/hash assertions and `git diff --check` passed.

## 2026-09-30 — Historical BSC recovery RPC candidates

- Agent/client: Codex.
- Change: Added Chainlist RPC survey and public evidence, identifying Sentio
  and Blockmachine as historical-read candidates; updated source report,
  implementation plan, state and engineering/project logs.
- Reason: Resolve dataseed's unavailable historical balances through empirical
  endpoint checks required for exact receipt-block execution recovery.
- Behavior/compatibility impact: Documentation/evidence only. Existing P7
  readers passed sampled historical blocks/receipts on candidate endpoints;
  matching stock replays succeeded. No application default, automatic failover,
  intended-wallet reconciliation, live provider switch or broadcast change.
- Verification: PostgreSQL-backed baseline full check passed 139 tests,
  zero failures/skips, strict typecheck, both builds and config checks.
  Read-only endpoint/reader/replay and consistency assertions are recorded
  in the dated report. Post-documentation PostgreSQL-backed full check passed
  139 tests, zero failures/skips, strict typecheck, both builds and config
  checks; stored evidence assertions and `git diff --check` passed.

## 2026-09-30 — P7.3/P7.5 production recovery wiring

- Agent/client: Codex.
- Change: Added trusted versioned recovery config/registry, Sentio/Blockmachine
  complete-source fallback, persisted-leg polling CLI, portfolio advisory
  ownership, migration 0007 and atomic observation/fill provenance. Added
  restart/concurrency, outage/unsupported proof, revert, source inconsistency,
  lost-connection and post-fill crash tests, ADR 0024 and operator runbook.
- Reason: Connect empirically tested historical RPCs to a concrete durable
  recovery runtime that cannot rebroadcast or count a settled fill twice.
- Behavior/compatibility impact: Existing callers remain compatible. Recovery
  configuration and signed identity are server-owned. Unreconciled reorgs now
  pause and advance the portfolio revision; submitted reservations stay frozen.
  Registry reviews are required for all tracked/output ERC20s; only native
  gas is enabled by default. Provider priority, eligibility and live trading
  gates remain unchanged. No deployment scheduler or broadcaster is enabled.
- Verification: PostgreSQL baseline full check passed 139 tests; post-change
  tests passed 147 with zero failures/skips. Both configured historical sources
  passed public balance/receipt reader smoke checks with matching digests.
  Final PostgreSQL-backed full check passed 147 tests, zero failures/skips,
  strict typecheck, both builds and config checks. Production CLI empty-schema
  smoke returned `[]` and exit 0; `git diff --check` passed. Durable findings
  were stored in and retrieved from supplementary Nexus memory.

## 2026-09-30 — P7.3/P7.5 USDT/NVDAB raw recovery registration

- Agent/client: Codex.
- Change: Registered reviewed USDT/NVDAB raw denominations with runtime/beacon
  identity pins; added receipt-block code/decimals validation before and after
  proof collection, UI-accounting and guarded PostgreSQL regression cases,
  dated source/receipt evidence and ADR 0025. Updated plan, state and runbook.
- Reason: Let the durable recovery worker reconcile these exact raw assets
  conditionally without double-counting bStocks UI events or silently accepting
  an unreviewed implementation upgrade.
- Behavior/compatibility impact: Optional schema/callback fields preserve older
  fixtures. Definite code changes require review; unavailable/noncanonical
  views permit complete-source fallback. P5 security, eligibility/economic
  gates, provider priority and live-trading restrictions remain unchanged.
- Verification: Baseline full PostgreSQL check passed 147 tests; latest tests
  passed 154, zero failures/skips. Both sources matched deployed runtime/source
  hashes, public buy/sell block transfer accounting and all four application
  guard smoke checks. Final PostgreSQL-backed full check passed 154 tests,
  zero failures/skips, strict typecheck and both builds. Stored evidence and
  cross-source assertions, `git diff --check` and memory write/retrieval passed.

## 2026-09-30 — Codex — Enforce security for both route tokens

- Change/reason: implemented modular public token-security collection, strict
  scanner coverage normalization, complete executable source/control/authority
  fingerprints and trusted bounded contract-scope reviews. Both stock and
  settlement reports now enter P5 and P7 approval; a plain `clear` label cannot
  replace them. Added inspection command, empty review registry, ADR 0026,
  specification/runbook and public MD/JSON findings; updated portable records.
- Fixes: canonical hash references/final reorg checks in quantity/transfer
  readers, proxy caller for beacon resolution and live head time evaluated
  after retrieval rather than before RPC latency. Delegated privilege code and
  unresolved contract authorities cannot silently pass a review.
- Compatibility: new security adapter method is optional at the type boundary
  but absent/unsupported/risk evidence blocks the gate. Old approval evidence
  requires revalidation. Historical submitted recovery remains unchanged.
  NVDAB and USDT remain blocked under this policy; no exception, provider pivot,
  live registry, owner-wallet call, broadcast or production migration.
- Verification: baseline PostgreSQL full check passed 154 tests; intermediate
  full checks passed 167/169. Final PostgreSQL-backed `./scripts/check.sh` passed
  **171 tests, zero failures/skips**, typecheck, headless/production web builds
  and config checks. Clock regression reproduced against old ignored compiled
  behavior, then passed restored code. Two source observations agree on full
  fingerprints; three RPCs passed canonical hash read probes. Inspection exits
  2 for expected blocking findings. Existing uncommitted work was retained.


## 2026-10-01 — Codex — Recover public beacon source and inspect wallet governance

- Change/reason: resolved the NVDAB beacon source gap locally with a full deployed
  runtime/metadata match from public OpenZeppelin source. Identified both privileged
  proxies as OperatorWallet/BurnWallet with a shared upgrade administrator. Added
  reproducible read-only scripts, dated public RPC/compiler artifacts, retained MIT
  source/license, ADR 0027, three offline research regressions and required check
  artifacts. Updated implementation plan, project state and both work logs.
- Findings: five local rebuilds match executable bytes; beacon and OperatorWallet
  also match metadata. Sentio/Blast agree at recorded block 125081086 on complete
  observations and 12 permission probes per source. Single-address owner/admin
  upgrade powers remain review findings, with no on-chain threshold/delay verified.
  Partial/failed source reads and failed inner calls cannot prove authorization.
- Compatibility: no application code, security clearance, review-registry entry,
  risk exception, production recovery source change, signing, broadcast or remote
  source publication. Dated research does not satisfy fresh live-trade evidence,
  unsupported scanner coverage or independent review. Existing pending work kept.
- Verification: source rebuild/Keccak/block/privacy checks, 24 expected real probe
  results and three research regressions passed; both script syntax checks and
  git diff --check passed. PostgreSQL baseline failed before edits (129 passed,
  13 failed, ECONNREFUSED); database-free baseline passed 129 with 13 skipped.
  Final stable-file repository check result is logged below.
- Final stable-file verification: database-free ./scripts/check.sh passed
  129 application tests (zero failures, 13 PostgreSQL suites skipped), three
  research regressions (zero failures/skips), strict typecheck, headless and
  production web builds plus configuration/artifact checks. Full PostgreSQL
  verification is unavailable because the baseline database refuses connections;
  no current 171-test PostgreSQL success is claimed. node --check, bash -n,
  stored source/hash/block/privacy assertions, all 24 real permission-result
  assertions, git diff --check and supplementary memory retrieval passed.


## 2026-10-01 — Codex — Integrate source, current governance and independent-review intake

- Change/reason: production security collector consumes exact recovered-source
  certificates and canonical inner wallet governance, exposing nine NVDAB execution
  components. Added explicit scanner coverage, review-v2 publisher/component scope
  and bounded PDF-byte verification, CLI intake fingerprints, fifteen regressions,
  ADR 0028, dated observations and updated specification/runbook/state/plan/logs.
- Compatibility: existing latest-head API retained; optional paired quantity frame
  added. Legacy review records parse but cannot clear live admission. New governance,
  coverage and artifact evidence participates in existing approval hashes. Strict
  risk blocking and historical recovery accounting preserved; no wallet operation,
  risk exception, provider pivot or enabled live asset. Registry remains empty.
- Findings: public two-source fingerprints agree with complete source/governance
  closure. USDT historical audit bytes verify, but no qualified current full-scope
  review exists. NVDAB Binance audit unsupported; provider gaps and mint/shared-
  creator/governance findings remain unapproved. Building/testing can continue.
- Verification: restored PostgreSQL baseline passed 171 application plus three
  research tests. Final PostgreSQL-backed ./scripts/check.sh passed 186 application
  and three research tests, zero failures/skips, strict typecheck and both builds.
  Live read-only collectors correctly exit 2; test-fixture typing corrections are
  recorded in the engineering log. Existing unrelated pending work retained.

## 2026-10-01 — Codex — Guarded production EOA evidence orchestration

- Change/reason: connect the separate P5 evidence and P7 execution/recovery modules
  through server-owned PostgreSQL reviews, exact persisted signatures, active owner/
  policy/session checks and a once-only raw-send claim. Added migration 0008,
  USDT/NVDAB production collector, trusted runtime factory, bigint codec and runbook.
- Behavior/compatibility: default-disabled broadcasting; clients cannot supply
  authoritative evidence/policy. Stable access-policy revision and original/current
  gate checks permit receipt/head refresh only inside the original lease. Changed
  approval facts, external wallet state, worse simulated fill or inadequate full gas
  budget block. Existing pure/store/recovery interfaces remain compatible; submitted
  recovery is independent of current warnings. No web trade endpoint or live clearance.
- Verification: passing 186-test application baseline; final PostgreSQL-backed
  ./scripts/check.sh passed 205 application plus three research tests, no failures/
  skips, strict typecheck and both builds. Full synthetic send-to-recovery flow,
  concurrent claims, authentication races, unknown outcomes and repeat-fill prevention
  covered. P5.5/P7/P8 production qualification remains open; ADR 0029 records choices.

## 2026-10-01 — Codex — bStocks route adapters and exact web EOA approval

- Change/reason: replace unresolved route/simulation seams with canonical actual-size
  USDT/NVDAB direct-V3 adapters; connect saved web review to guarded P7 execution.
  Add application service/API, operator configuration and separate approval/store/
  submit UI, browser-safe signing schema and explicit signed-byte import fallback.
- Behavior/compatibility: venue code/config, fee feeds, actual funds/allowance/gas and
  canonical state fail closed. Signed bytes persist before one send; changed payload,
  wallet/session/expiry blocks. Existing EOA exports, explicit provider ports, saved
  rules and recovery remain compatible. Default configuration absent, broadcast off,
  qualified access/economic/event/valuation and security/risk evidence still required.
- Verification: PostgreSQL-backed baseline 205 tests; final ./scripts/check.sh passed
  213 application and three research tests, zero failures/skips, strict typecheck and
  both builds. All 14 Chromium cases passed, including stored-leg reload and real
  origin/body/session guards. Public adapter quote succeeded; unfunded simulation
  correctly blocked. Test-fixture corrections documented; no actual wallet operation.
  ADR 0030 preserves decisions; direct pending web/rule prerequisites included while
  unrelated work remains untouched.


## 2026-10-02 — Codex — Detailed unresolved-challenges engineering handoff

- Change/reason: added docs/SENIOR_ENGINEER_HANDOFF.md for the owner to share with
  a senior engineer. Covers 15 unresolved challenges with chronology, evidence,
  exact public identities, interfaces, policy tensions and actionable acceptance
  criteria. Linked it from state and implementation-plan continuation instructions.
- Behavior/compatibility: documentation only; preserves application APIs, provider
  priority, current admission rules, default-disabled broadcasting and phase gates.
  Records the preference to prove the EOA MVP before commissioning a new audit,
  without creating an exception or describing unreviewed contracts as cleared.
- Verification: PostgreSQL-backed baseline passed 213 application and three research
  tests, zero failures/skips, strict typecheck and both builds. Initial check without
  test URL had 157 passes/27 database skips and is not full PostgreSQL evidence.
  Post-documentation PostgreSQL check also passed 213 application plus three
  research tests, zero failures/skips, strict typecheck and both builds. Handoff
  local links/privacy/structure and whitespace checks passed. No new browser run,
  wallet signature, allowance, send or external message. .git is read-only; local
  changes remain uncommitted and unrelated existing work is preserved.

## 2026-10-02 — Codex: bounded owner-only bStocks pilot

- Change: implemented ADR 0031's one-EOA/one-buy/five-USDT admission, preserving strict
  default security and original scanner states while explicitly deferring independent
  review. Added private reviewed access/mapping/event ports, expiring signed owner
  declaration/export, real-state loopback Anvil buy/sell proof and exact external
  allowance receipt validation. Recovered the ADGM NVDAB primary prospectus/feed
  heartbeats; current country/economic review remains pending.
- Reason: follow the owner's instruction to implement the senior engineer's bounded
  supervised pilot and avoid requiring unavailable scanner/audit data for that scope.
- Behavior/compatibility: optional renewable signing retains exact original approval
  and requires fresh complete current evidence before persistence/one-time claim.
  Added separate settlement-age policy and namespaced reference/status IDs. Default
  strict admission, original-lease behavior, raw import, ledger/recovery/rules remain.
  Added migration 0009, finalized owner-signed paused bootstrap/resync, canonical
  logarithmic nonce diagnosis, owner-only one-trade plan and authenticated web routes.
  New profile/portfolio cannot reset the consumed pilot cap. Resync cannot erase an
  unresolved/disputed leg. Price monitoring is sampled/read-only; no scheduler added.
- Fixes: scoped manual mapping bigint decoding to preserve canonical security strings
  and hashes; corrected the source-ID grammar and settlement/status clock coupling;
  prevented repository dot-prefix/parent-symlink private-output escapes. Logs include
  reproduced failures, fixture corrections and regression verification.
- Verification: PostgreSQL-backed ./scripts/check.sh passed 231 application plus three
  research tests, zero failures/skips, strict typecheck and both builds. 16 Chromium
  cases passed, including owner snapshot activation/tamper rejection and endpoint
  guards. Actual isolated Anvil startup/canonical fork and public owner/source reads
  succeeded without sending/signing a mainnet transaction. Live acceptance is still
  pending funding, qualified current records and fresh exact owner approvals. Updated
  state/plan/logs, source manifest, ADR, runbook and forwardable senior questions.


## 2026-10-02 — Codex: ADR 0031 Amendment 1 pilot evidence and R1 recovery

- Change/reason: implemented the owner's accepted amendment/response002 to resolve
  owner-pilot evidence decisions. Current ADGM primary/supplement manifests and
  Binance restrictions, private signed J1–J5 records, local-decision revision, exact
  dual raw/display mapping, P1–P9 current-session/peg/mid/output/gas policy and
  persistent source high-water/cadence are implemented. Diagnostics expose both
  exact premiums with true source clocks; gas is separately capped.
- Recovery: exact external approval precedes initial bootstrap; persisted pilot legs
  require canonical zero allowance before successful reconciliation. Nonzero freezes
  once without releasing submitted funds. Migration 0010 retains immutable complete
  original fill proofs. R1 appends an owner-signed compensating anchor/revision only
  for identical same-hash effects and complete finalized ledger equality from two
  reviewed independent upstreams. Authenticated/origin-guarded API and exact browser
  review/signing are added. No balance/fill/reservation amounts are overwritten;
  pause remains, replay is a no-op and competing corrections reject.
- Compatibility: pilot profile/manual records and eligibility domain move to v2;
  old pilot approvals require new records/signatures. Strict default/scanner unknowns/
  deferred independent review, wallet-wide one-buy cap, exact transaction persistence,
  once-only broadcast and unresolved resync rejection remain. General R2/R3 repair
  and public-release/legal/issuer API work remain separate.
- Verification: PostgreSQL-backed ./scripts/check.sh passed 243 application plus
  three research tests, zero failures/skips, strict typecheck and both builds.
  Expanded browser verification/final docs checks are recorded below. Read-only
  live register and private v2 source probes succeeded; sampled premiums were in band
  outside the regular session. No mainnet transaction, personal eligibility decision
  or live gate closure was claimed. Logs document test corrections and cash-value
  cap regression. [Runbook](runbooks/owner-pilot.md) and
  [evidence](integrations/2026-10-02-pilot-amendment-verification.json) preserve portability.

- Final expanded Chromium suite: 18 passed, including R1 evidence/signature and
  PostgreSQL HTTP access boundaries. Earlier ambiguous-alert selector corrected;
  product rejection had already succeeded before signing. Mainnet acceptance and
  independent RPC upstream qualification are not implied by synthetic tests.

## 2026-10-02 — Codex/API — Supervised funded-EOA acceptance script

- Change: added scripts/test-eoa-pilot.sh / npm run pilot:eoa, local hidden/file
  signing, diagnostic/allowance/declaration/run/recover commands, mandatory private
  durable evidence and owner-scoped recovery. Added optional production observer,
  consistent ledger/proof export, operator locks and recovery replay comparison.
  Input/evidence collisions and failed-lock cleanup have regression checks. Full
  instructions and [ADR 0032](decisions/0032-supervised-eoa-acceptance-runner.md)
  record setup, broadcast switches and stop/start acceptance.
- Reason: owner needs a reviewable funded EOA workflow script with data for mainnet
  receipt/recovery gates.
- Behavior/compatibility: deployment.broadcastEnabled=true AND --broadcast plus
  exact confirmations required; default run is diagnostics only. Current v2
  eligibility/price/security/simulation, external exact approval before bootstrap,
  one wallet-wide buy <=5 USDT, persist-before-broadcast and no resend remain.
  No web signer/custody/dependency, unlimited approve, second buy/mainnet sale,
  audit clearance or legal decision. Default recovery discovery and runtime remain
  compatible unless the optional filter/observer is supplied. Keys excluded from
  artifacts/database/docs/MCP.
- Verification: final PostgreSQL-backed ./scripts/check.sh passed **257 application
  and three research tests**, zero failures/skips, strict typecheck and both builds;
  **18 Chromium cases passed**. Launcher/help and actual public read-only CLI smoke
  with isolated migrated PostgreSQL passed; mandatory private artifacts exported
  and no portfolios/sessions/legs created. Whitespace/local links passed. Actual owner
  mainnet transaction/receipt/process-restart acceptance remains open.
