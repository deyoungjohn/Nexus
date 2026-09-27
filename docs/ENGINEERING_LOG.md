# Nexus engineering log

This is the detailed, append-only work record. The changelog summarizes completed
increments. Specifications define expected behavior; ADRs explain architecture.
Do not put credentials, personal wallet data or private strategy text here.

## 2026-09-25 — P0.1 / P0.2 — Blueprint decomposition

- Agent/client: Codex.
- Request: implement `Nexus.md` in portable, documented phases, with records of
  each step, bug, test, decision, pivot, lesson and new component.
- Inspected: `AGENTS.md`, project state, changelog, ADR 0001, specification index
  and complete blueprint; retrieved the `Nexus` shared-memory entity.
- Baseline: `./scripts/check.sh` passed; there were no application tests yet.
- Existing workspace changes: `.codex/config.toml`, prior memory documentation,
  untracked `Nexus.md` and a Zone.Identifier file. Preserve them.
- Components: implementation plan, this log, phase-one specification and ADR
  0002. Blueprint remains unchanged and is the product source.
- Compatibility: preserve shared MCP configuration, its pinned dependency and
  `./scripts/check.sh`; no previous application interfaces exist.
- Decision: offline exact-arithmetic and identity groundwork first, while
  retaining real integration feasibility as a gate before live execution.
- Verification: baseline passed; implementation checks recorded below as run.

## Entry requirements for subsequent work

Append dated entries with phase/work-item IDs, agent/client, change and reason,
affected components and behavior, commands/tests and actual outcomes, and next
step. For a bug also record reproduction, cause, fix and regression test. For a
pivot explain old/new direction, evidence and ADR link. State lessons when
evidence supports them; do not invent failures to populate the log.

## 2026-09-25 — P1.1 — Test reporting correction

- Observation/reproduction: `node --test dist-test/test/*.test.js` returned exit
  zero but reported only three file-level tests. Running
  `node dist-test/test/amount.test.js` reported all six named amount tests.
- Cause boundary: the process-isolated runner's reporting in this environment
  hid individual test results; its internal cause was not established. No domain
  assertion failure was observed, and this was not a baseline repository defect.
- Change: explicit `test/run.ts` imports each suite into one Node test process;
  `npm test` compiles and executes that entry point. This also avoids discovering
  removed tests from stale compiled-file globs.
- Regression verification: run the full check with named tests visible and an
  independent intentional-failure probe to verify nonzero exit (results below).
- Lesson: inspect what a green test report actually counts. New suites must be
  added to `test/run.ts`; a file-level pass alone is insufficient evidence of
  the intended named checks.

## 2026-09-25 — P1.1–P1.4 — Domain foundation completed

- Agent/client: Codex.
- Decision: [ADR 0002](decisions/0002-domain-foundation.md); behavior contract:
  [specification 0001](specifications/0001-domain-foundation.md).

| Work item / component | Behavior and reason | Verification |
|---|---|---|
| P1.1 — package/lockfile, TypeScript configs, test entry point | Pin TypeScript 5.9.3 and Node types 22.18.6 on Node 22; ESM modules; retain pinned MCP server; separate test/build output | Compile, strict typecheck and build passed; npm install reported zero vulnerabilities at installation |
| P1.2 — `amount.ts`, `errors.ts` | Explicit asset/precision, bigint arithmetic, strict decimal parsing, string JSON units and structured validation errors | Six named amount tests: large round trip, precision boundaries, invalid syntax, arithmetic/mismatch/underflow, invalid identity, strict serialization |
| P1.3 — `instrument.ts` | Canonical chain/contract/issuer/product identity, shared-underlying lookup, immutable records, reject aliases; no execution permission from metadata | Five named instrument tests: wrappers/grouping, duplicates, immutable snapshots, unsupported model metadata and invalid metadata |
| P1.4 — `allocation.ts` | Deduct reservations/reserve/fees, require separate native gas, honor priority, allocate proportional shares with largest-remainder/ID rounding, preserve cash and reasons | Eleven named allocation tests: deductions, priority/ties, fractional remainders, unspent/empty/zero, commitments, gas shortage, gas denomination, input validation, large values, generated invariants, immutable output |
| P1.4 — `demo.ts` | Runnable synthetic example, labelled as non-executable | `npm run demo` passed; 100 less 10 reserved, 10 reserve and 5 fees allocates 75 as 30/26.25/18.75; all base units serialize as strings |
| P0.2 — agent contract, check script and project records | Require phase/work-item logs and preserve their presence in the single check entry point | Final `./scripts/check.sh` result recorded in the changelog; no existing MCP configuration changed by this increment |

- Generated test evidence: 1,000 reproducible cases check conservation, bounds,
  higher-priority satisfaction, and identical results after reversing inputs.
- Runner verification: corrected suite reports 22 named tests, 22 passed,
  zero failed/skipped/cancelled. A separate intentional assertion-failure probe
  returned exit 1 as expected; it is not part of the repository test suite.
- No domain test failure or product pivot occurred. The only correction was
  test reporting, documented above. This work makes no concurrency, valuation,
  authorization or live-market correctness claim.
- Compatibility: preserved Portable's MCP dependency and configuration checks;
  renamed package metadata to Nexus and added application commands. Existing
  user configuration and blueprint contents were left intact.
- Next: P2.1–P2.4 integration evidence. P3 database reservations precede any
  concurrency claim; P4 implements the full conflict/exposure example.

## 2026-09-25 — P2.1–P2.4 — Read-only integration investigation

- Agent/client: Codex. Request: proceed to Phase 2 and update both
  `PROJECT_LOG.md` and `ENGINEERING_LOG.md`.
- Before editing: read agent contract, blueprint/phase plan, state, recent
  changelog and ADR 0002; searched shared MCP memory; `./scripts/check.sh`
  passed with 22 named tests, typecheck and build. Existing workspace changes
  were preserved. No application interface was changed.
- New components: `docs/PROJECT_LOG.md` (phase summary),
  [P2 integration matrix](integrations/2026-09-25-phase-2.md) (dated evidence),
  [ADR 0003](decisions/0003-p2-integration-gates.md) (quantity/freshness/route
  gate). Agent contract and check script now require the project log and matrix.

| Work item | Step and observation | Outcome / next test |
|---|---|---|
| P2.1 | Retrieved public Binance Ondo `type=1` list: 1,366 rows, 458 on BSC. Selected exact USDT, NVDAon, AMDon and AAPLon addresses. Fetched three stock metadata and status responses. Read BSC RPC `eth_chainId=0x38`, block `123990242`, `decimals()` and nonempty code for four contracts. | Identity/precision candidates documented. RPC confirmed 18 decimals for each. Still requires issuer/product, eligibility, transfer and wallet quantity checks before allowlisting. |
| P2.2 | Inspected list/meta/status/dynamic response keys and matched three list multipliers to dynamic multipliers. Inspected Ondo primary pricing, corporate-action, eligibility and session docs. | Recorded distinct raw/display/underlying quantities and three clocks. Dynamic response had no source price timestamp. Fetch time and next-session timestamps cannot prove reference freshness. |
| P2.3 | Read Binance stock workflow and local Agentic Wallet quote, order status and external-call preview references. CLI version `1.10.0` met skill requirement; `baw wallet status --json` returned `UNCONNECTED`. | No wallet quote, sender/spender/recipient, route, simulation, approval, transaction or receipt test. Documented exact exit sequence. No authenticated wallet data or money movement. |
| P2.4 | Read Binance note requiring off-chain earnings data; reviewed Ondo's current restriction behavior and Nasdaq's public calendar and data terms. | Chose labelled user-supplied events for the demonstration. Did not claim a licensed, confirmed automated earnings feed. Date-dependent production automation remains blocked. |

- Public API calls were read-only GETs. BSC RPC calls were read-only
  `eth_chainId`, `eth_blockNumber`, `eth_call` and `eth_getCode`. The selected
  on-chain `decimals()` calls used `latest`; they were not all pinned to the
  separately observed block, so a future adapter must use a fixed block tag.
- Environment correction: initial sandboxed public `curl` requests failed with
  DNS error 6. After the required network escalation, the same read-only
  requests succeeded. This was a sandbox limitation, not an API defect.
- Process mistake: the first CLI skill-version check used `1.1` instead of the
  installed skill's metadata version `1.12.0`. Repeated with `1.12.0`; it
  returned `needUpdateSkill=false`. No package was changed. Lesson: read the
  declared version before testing the CLI.
- Primary lesson: a ticker, a currently open status and a recent HTTP response
  do not prove an eligible, fresh, executable trade. Ondo BSC wallet displays
  can scale balances without changing raw chain balances; pricing and ledger
  adapters must keep those measures separate.
- Decision: ADR 0003 retains owner-approved wallet-native direction but leaves
  the specific execution adapter unselected until route binding and
  reconciliation are demonstrated. No product pivot or code bug occurred.
- Verification after documentation: recorded in the corresponding changelog
  entry. P2 exit remains open; `PROJECT_LOG.md` shows the phase status.

## 2026-09-25 — P2.3 — Sandbox status correction and live quote-only checks

- Trigger: the user reported `baw auth signin` already showed a connected
  Agentic Wallet, with no funds. This contradicted my `UNCONNECTED` status
  report. No new wallet application or separate CLI was involved.
- Reproduction: `baw wallet status --json` in the restricted sandbox returned
  `UNCONNECTED`; `baw auth signin --json` there failed with
  `uv_interface_addresses returned Unknown system error 1`. The same installed
  CLI version (`1.10.0`) outside the sandbox returned `ALREADY_CONNECTED` for
  `auth signin` and `CONNECTED` for `wallet status`.
- Cause and correction: the sandboxed status response was a false negative in
  this environment. The exact internal cause was not established; blocked
  network-interface access is consistent with the sign-in error. Repeated
  read-only CLI checks outside the sandbox and corrected project status,
  matrix, project log and ADR. Lesson: when wallet auth contradicts a sandboxed
  status result, verify with the same CLI outside that sandbox before inferring
  a missing user session. No re-sign-in was needed.
- Connected checks: four `baw market-order quote` calls succeeded using exact
  BSC contracts: 100 USDT to NVDAon, AMDon and AAPLon; 0.1 NVDAon to USDT.
  Returned fields were symbols, input/output quantities and `slippage=0.005`.
  Full non-secret estimates are in the integration matrix. A wallet with no
  funds can return quotes; no balances or wallet address were saved.
- Unresolved: none of those quote responses exposed a route, calldata,
  spender, recipient, minimum output, fee, source block or expiry. No funded
  transaction, simulation, approval, order status or receipt was tested.
  P2 remains in progress for those gates and the production calendar source.
- Verification: `./scripts/check.sh` passed before this documentation
  correction (22/22 tests, typecheck, build); final result is recorded in the
  same-day changelog. No application code or tests changed.

## 2026-09-25 — P2.3 — Funded balance and small-size quote boundary

- Agent/client: Codex. Trigger: owner reported funding the connected Agentic
  Wallet and asked whether it was enough for the execution test.
- Before editing: read current state, phase plan, logs, integration matrix,
  specification 0001 and ADR 0003; searched shared MCP memory. Baseline
  `./scripts/check.sh` passed: 22/22 tests, typecheck, build and configuration
  checks. No application behavior or interface was changed.
- Read-only checks outside the sandbox: BSC `wallet balance` confirmed both
  settlement and native-gas assets. Exact holdings and wallet address are
  omitted here. Two 5-USDT-to-NVDAon quotes succeeded with different estimated
  outputs; a 4-USDT quote returned `315008 SERVICE_ERROR`, exact message
  `From token value greater than 5 USD`. Sell-direction quotes for 0.01 AMDon
  and 0.01 AAPLon succeeded. Full non-secret quote data is in the matrix.
- Reproduction/lesson: this is a size-boundary rejection, not a repository bug.
  A quote can succeed at 5 while a smaller request fails; the service's error
  does not prove a stable minimum, and a quote is not a balance-aware execution
  simulation. Do not assert that funding alone closes the live-path gate.
- Decision: retain ADR 0003's exact-route and separate trade-authorization
  gates. No swap, approval, simulation, order status or receipt was requested.
  The wallet CLI's documented market-order quote omits route/bound fields;
  its separate contract-call preview requires a verified transaction and
  Developer Mode. Route discovery and a reviewable execution preview remain.
- Compatibility: documentation only. Final `./scripts/check.sh` passed with
  22/22 tests, typecheck, build and configuration checks; `git diff --check`
  passed. Next: verify a route with fixed sender/spender/recipient, bounds
  and a simulation, then present a concrete trade for owner approval.

## 2026-09-25 — P2.3 / P2.4 — Route, simulation and issuer-event source

- Agent/client: Codex. Request: verify route and simulation, then request
  trade approval so P2 can be completed. Baseline `./scripts/check.sh` passed
  (22/22 tests, typecheck, build and configuration checks); read state, phase
  plan, ADR 0003, recent logs/changelog and shared MCP memory. No application
  behavior or interface is changed by this documentation increment.
- P2.3 wallet capability: read-only settings returned Developer Mode disabled.
  Per the Agentic Wallet external-sign reference, `contract-call preview`
  cannot run until the owner enables it in the Binance App. The owner was
  asked asynchronously; no setting was changed by the agent.
- P2.3 route discovery: documented OpenOcean public quote endpoint returned a
  Cloudflare challenge. KyberSwap public route and build endpoints succeeded
  for exact 5-USDT-to-NVDAon BSC input. Decoded router selector, call target,
  exact token pair, amount, wallet recipient, no fee receiver and 50-bps
  minimum output. No explicit on-chain deadline appeared. See integration
  matrix for addresses, public values and source links. This is not the
  opaque Agentic Wallet market-order route.
- P2.3 simulation: at RPC block 124002588, the wallet had the expected input
  balance and zero Kyber router allowance. `eth_call` and `eth_estimateGas`
  reverted with `TransferHelper: TRANSFER_FROM_FAILED`. A later probe of that
  old block returned `missing trie node`; switching to `latest` succeeded. A
  batched allowance-slot probe hit the public RPC's batch rate limit;
  individual read-only calls identified storage slot 2. A fresh Kyber route
  then passed `eth_call` using a temporary exact-amount allowance override,
  returning more than its minimum; `eth_estimateGas` returned 482513 units.
  The override granted no real allowance. Lesson: distinguish feasibility
  under modeled permissions from readiness under actual wallet state; public
  RPC pruning and rate limits affect evidence.
- P2.3 security pre-check: Binance audit returned `hasResult=false` and
  `isSupported=false` for NVDAon, so no risk score or item is reported.
  Explicit owner acknowledgement is required before any swap. No approval,
  signature or transaction was sent.
- P2.3 approval preparation: built exact `approve(router, 5e18)` calldata.
  Read-only `eth_call` returned true and `eth_estimateGas` returned 46576
  units. A later wallet-settings recheck still showed Developer Mode disabled.
  These RPC results are not a wallet preview or permission grant.
- P2.4 decision: [ADR 0003](decisions/0003-p2-integration-gates.md) now
  selects manually checked issuer IR announcements for MVP event confirmation.
  No issuer-confirmed upcoming event means date-dependent actions block;
  automated feed ingestion remains deferred. Primary source examples and
  recheck/expiry semantics are in the integration matrix.
- Next: after Developer Mode is enabled, preview an exact-amount token
  approval; obtain owner authorization for it; refresh the route, preview
  the swap against actual allowance, present unavailable-audit status and
  exact trade bounds for owner approval, then reconcile its receipt. Route
  deadline and production source-freshness limits remain explicit.
- Final documentation verification: `./scripts/check.sh` passed with 22/22
  tests, typecheck, build and configuration checks; `git diff --check` passed.

## 2026-09-26 — P2.3 — Deadline-bound route and wallet connectivity

- Agent/client: Codex. Trigger: owner asked to continue the route/simulation
  investigation before trade approval. Read current project state, P2 matrix,
  ADR 0003, plan, logs and wallet references; retrieved the `Nexus` MCP entity.
  Baseline `./scripts/check.sh` passed (22/22 tests, typecheck, build and
  configuration checks). No application behavior or interface changed.
- Wallet preflight: skill update check reported no update; CLI version
  `1.10.0` meets required `1.10.0`. Outside the sandbox, `baw wallet status`,
  `wallet settings` and `wallet address` failed with exact CLI error
  `DNS_RESOLVE_FAILED` / `getaddrinfo EAI_AGAIN www.binance.com`. System
  resolver lookup for that hostname also failed. Do not infer disconnection
  or current Developer Mode state from this transport failure. Per the wallet
  external-sign reference, no `contract-call preview` was attempted.
- PancakeSwap V3 read-only RPC: official factory `getPool` returned a direct
  USDT/NVDAon pool at each tested fee tier (100, 500, 2500, 10000). QuoterV2
  reverted for a 5-USDT input at the first three tiers; fee 10000 quoted
  `0.021834146028111931` NVDAon. Official router source applies a deadline
  check and minimum output. USDT → WBNB first legs quoted near 0.006455
  WBNB, but tested WBNB → NVDAon second legs reverted across those tiers.
  PancakeSwap V2 direct `getAmountsOut` quoted only
  `0.001391047032795922` NVDAon. These were `eth_call`s only.
- Kyber comparison: refreshed public route at 2026-09-26 11:11:54 UTC
  estimated `0.022135630045419712` NVDAon for the same input via Pancake
  Infinity CL, about 1.36% above the separate V3 direct quote. It was not
  built or simulated for a wallet today and carries no approved trade terms.
- Decision/lesson: a venue with a deadline exists, but deadline enforcement
  alone is insufficient to pick it; price, exact recipient, min output,
  allowance, wallet preview and audit acknowledgement must be considered
  together. The prior Kyber conditional simulation remains historical
  feasibility evidence, not today's wallet simulation. Keep P2 open and do
  not ask for a misleading exact trade approval while the wallet preflight
  and route-bound preview are unavailable. No approval or transaction sent.
- Compatibility: documentation only. The P2 matrix, project state, project
  log, ADR 0003 and changelog record the follow-up. Final repository checks
  are recorded in the corresponding changelog entry.

## 2026-09-26 — P2.3 — Restored wallet, conditional swap and allowance preview

- Agent/client: Codex. Trigger: owner restored VPN and enabled Developer Mode.
  Read state, matrix, ADR 0003, wallet references and MCP memory. Baseline
  `./scripts/check.sh` passed: 22/22 tests, typecheck, build and configuration
  checks. No application code or interface changed.
- Wallet preflight: skill check found no update, CLI `1.10.0` met requirement,
  `wallet status` returned `CONNECTED`, and settings returned
  `devMode.enabled=true`. BSC wallet balance showed 5 USDT and 0.0065 BNB;
  RPC confirmed the exact 5e18 USDT base-unit balance and zero allowance to
  official PancakeSwap V3 SwapRouter. Wallet address and request IDs were used
  transiently and excluded from project records and shared memory.
- Current evidence: connected quote-only request estimated
  `0.022125794345763758` NVDAon for 5 USDT at `0.005` slippage, without route
  fields. Binance asset status reported `openState=true`, `offhours`,
  `TRADING`. Token audit again reported `hasResult=false`,
  `isSupported=false`; no risk conclusion. Direct V3 fee-10000 quote at
  observed BSC state estimated `0.021833351669978713` NVDAon.
- Route simulation: built `exactInputSingle` with exact 5e18 USDT input,
  wallet recipient, fee 10000, 50-bps minimum output
  `0.021724184911628819` NVDAon and deadline 12:07:35 UTC. Read-only
  `eth_call` with temporary exact USDT allowance override returned
  `0.021833351669978713` NVDAon; `eth_estimateGas` returned 209006.
  This is conditional evidence, not actual-wallet swap simulation. The
  deadline/call must be rebuilt after any approval.
- Wallet approval preview: `contract-call preview` parsed an ERC-20 `Approve`
  for exactly 5e18 USDT to V3 SwapRouter. Simulation code `000000000` showed
  allowance 0 → 5e18, empty balance/authority changes and empty risk lists.
  The preview is time-limited; separate owner authorization was requested.
  No execute call was made, so on-chain allowance remains zero.
- Decision/lesson: previewing a permission change is a distinct gate from
  executing it; only after a confirmed allowance can the exact swap be
  re-quoted and wallet-previewed. The token is currently off-hours and the
  audit unavailable, both requiring clear owner acceptance for a manual
  test. P2 is not complete without trade receipt and reconciliation.
- Final repository verification is recorded in the matching changelog entry.

## 2026-09-26 — P2.3 — Confirmed allowance and actual-wallet swap preview

- Agent/client: Codex. Trigger: owner explicitly approved the 5-USDT
  allowance and a trade. Read current state, plan, recent logs/changelog,
  integration evidence and ADR 0003; retrieved MCP memory. Baseline
  `./scripts/check.sh` passed (22/22 tests, typecheck, build, config). Existing
  application behavior and interfaces were preserved.
- Preflight: Agentic Wallet skill version `1.12.0` had no update; CLI `1.10.0`
  met requirement; wallet status `CONNECTED`, Developer Mode enabled. The
  previous approval preview had expired. A new preview matched the authorized
  exact USDT contract, V3 spender and `5e18` amount, with allowance 0 → 5e18,
  no balance/authority changes and empty risk lists.
- Permission transaction: Agentic Wallet `contract-call execute` returned
  `BROADCASTED`. BSC `eth_getTransactionReceipt` returned status `0x1` at
  block `0x7662f89`; later RPC `allowance(owner, V3 router)` returned exactly
  `5e18` USDT. The personal address, request ID, order ID and transaction
  hash are intentionally omitted from versioned project memory. No swap was
  submitted at this step.
- Fresh route: direct V3 fee-10000 quote returned
  `0.021833351669978713` NVDAon for 5 USDT; separate Agentic Wallet
  quote-only result was `0.022136138208480772` and remained route-opaque.
  BNB remained available for gas. Binance per-asset status was open but
  off-hours; token audit again returned `hasResult=false`,
  `isSupported=false`. The direct route is roughly 1.37% lower output than
  the separate wallet quote.
- Actual-state simulation: built exact `5e18` USDT input, wallet recipient,
  V3 fee 10000, minimum `0.021724184911628819` NVDAon and deadline
  2026-09-26 12:19:51 UTC. BSC `eth_call` with **real** allowance returned
  `0.021833351669978713`; `eth_estimateGas` returned 209006. Agentic Wallet
  `contract-call preview` parsed `swap`, simulation code `000000000`,
  5-USDT outflow/NVDAon inflow, allowance 5 → 0, empty authority changes,
  and empty risk lists. This is a preview, not a submitted fill.
- Reporting bug reproduction: the earlier conditional-simulation display
  rendered minimum `0.021724184911628820`; JavaScript `JSON.parse` converted
  the >2^53 base-unit JSON number to an imprecise `number`. Cause: native
  IEEE-754 rounding during tool-output parsing. Correction: decoded the
  unsigned calldata as 256-bit words and recomputed
  `floor(21833351669978713 * 9950 / 10000)` with `bigint`, yielding
  `21724184911628819` base units. Regression verification: decoded calldata
  minimum matched that exact result; both prior record locations were
  corrected. The one-unit reporting error did not alter the signed calldata.
- Owner confirmation: the parsed swap, bound, deadline, lower direct-route
  output, off-hours status and unavailable audit were presented for exact
  post-preview confirmation. The preview may expire; refresh route and risk
  review if so. P2 remains open for swap receipt/reconciliation and residual
  eligibility/source checks. Final repository verification is in changelog.

## 2026-09-26 — P2.2 / P2.3 — Supervised trade and receipt reconciliation

- Agent/client: Codex. Trigger: owner confirmed the exact bounded trade after
  reviewing wallet preview, lower direct-route output, off-hours status and
  unavailable audit. Read current state, plan, recent logs/changelog, ADR
  0003 and shared MCP memory. Baseline `./scripts/check.sh` passed: 22/22
  tests, typecheck, build and configuration checks. No application code or
  public interface changed.
- P2.3 preflight: connected wallet and Developer Mode were confirmed. A
  refreshed read-only check found the same exact 5-USDT balance/allowance,
  no prior NVDAon position, public trading status open but off-hours, and
  unsupported token audit. The direct V3 quote remained above the owner's
  approved minimum. The owner had explicitly accepted those conditions.
- P2.3 expiry reproduction: previewing the prior calldata returned exact CLI
  error `Transaction simulation failed: The order is expired, please cancel
  and try again.` Cause: its on-chain deadline had passed. No execute call
  followed that failed preview. Correction: re-quoted, rebuilt the same
  token pair, router, recipient, exact input and **unchanged minimum output**
  with a new deadline, then reran actual-state `eth_call`, gas estimation and
  Agentic Wallet preview. Regression verification: all passed; the wallet
  again reported no risk or authority flags and allowance 5 → 0. Lesson:
  a refreshed preview request ID alone cannot rescue expired on-chain
  calldata; revalidate the route and its economic bounds.
- P2.3 submission: Agentic Wallet returned `BROADCASTED`. BSC receipt status
  was `0x1`; at the later query head it had over 160 confirmations. The mined
  chain 56 sender, V3 router, zero native value and full calldata matched
  the preview. `Transfer` logs showed exact input spent and output credited;
  RPC balances and allowance matched those logs, with received output above
  the owner's minimum. No repeat submission occurred. Personal wallet,
  request, order and transaction identifiers, and exact holdings are omitted
  from repository and shared MCP memory. The owner received the public
  transaction link separately.
- P2.2 live quantity check: wallet CLI display quantity divided by raw ERC-20
  balance equaled the public NVDAon `sharesMultiplier`
  `1.0017152487959898` to display precision; multiplying raw units by that
  factor and truncating to 18 decimals reproduced the wallet display. This
  verifies the distinction between raw token inventory and display/underlying
  exposure for this instrument. Public dynamic stock reference still has
  no source timestamp; successful transfer does not prove general issuer
  eligibility.
- P2 decision: feasibility exit evidence for P2.1–P2.4 is now sufficient:
  three exact candidate identities, observed API and clock gaps, one bounded
  owner-approved route through receipt, and manual issuer IR event source.
  [ADR 0003](decisions/0003-p2-integration-gates.md) closes P2 as a study
  while keeping the application execution adapter disabled. P3 is next;
  P5/P7 own the remaining production gates.
- Compatibility: the only external wallet state change was the owner's
  approved test; no Nexus application behavior changed. Final repository
  verification is recorded in the matching changelog entry.

## 2026-09-26 — P3.1–P3.4 — PostgreSQL ledger and durable outbox

- Agent/client: Codex. Trigger: owner requested Phase 3. Read project state,
  implementation plan, blueprint sections 4/8/9/11, recent logs/changelog,
  foundation specification, ADRs 0002/0003 and shared MCP memory. Baseline
  `./scripts/check.sh` passed 22/22 tests, typecheck, build and configuration.
  Preserved existing amount, instrument and allocation interfaces and kept
  money-moving behavior disabled.
- P3.1 dependency and test environment: pinned `pg` 8.23.0 and `@types/pg`
  8.23.1. No PostgreSQL binary was installed locally and `sudo` required a
  password. Downloaded official Ubuntu PostgreSQL 16 packages into `/tmp`,
  extracted them without system installation, and initialized a temporary
  local test server. No database URL, credentials or personal data were added
  to project files. The check passed after the dependency change.
- P3.1 component: `migrations/0001_ledger.sql` establishes portfolios,
  immutable revisions, exact asset balances, policy/evidence/decision records,
  plans, reservations, transaction identities and outbox. Added numbered,
  checksum-verified transactional migrations and `npm run db:migrate`.
  `numeric(78,0)` holds base units as integer decimal values; application
  boundaries use `bigint` and strings. See [ADR 0004](decisions/0004-postgresql-ledger.md)
  and [specification 0002](specifications/0002-durable-ledger.md).
- P3.2 component: `Ledger.reservePlan` locks a portfolio, checks its revision,
  aggregates demand by exact asset/precision, subtracts held and submitted
  inventory, then inserts the plan, holds and outbox event in one transaction.
  `recordBalances` creates a new revision and invalidates unsubmitted plans.
  A tested 80/80 concurrent request on 100 units produced one success and one
  `INSUFFICIENT_BALANCE`; the final hold sum was 80. A deliberately duplicated
  reservation ID caused SQL failure and the plan/outbox writes rolled back.
- P3.3 component: unique `(portfolio, occurrence)` and
  `(portfolio, idempotency_key)` constraints plus a request hash reject replay
  with altered content. An identical retry returned the original plan without
  a second outbox event; duplicate occurrence under another key was rejected.
  A partial unique index and `startExecution` allow one active executing batch
  per portfolio. `markSubmitted` persists a transaction identity and freezes
  its reservation atomically; it does not broadcast. Expiry touches only held
  rows. Tests showed a submitted reservation survived expiry and blocked new
  plans and unqualified balance replacement.
- P3.4 component: `SKIP LOCKED` outbox claims, owner leases, attempts, retry and
  acknowledgment support an at-least-once worker helper. A new pool reclaimed
  an artificially expired lease after the original claimant lost it; the old
  claimant could not acknowledge. A failed handler was retried. Lesson: an
  outbox lease provides recovery but cannot make external side effects exactly
  once; future consumers must deduplicate by `eventKey`. No wallet handler is
  installed.
- P3 test correction: the first compile after adding the ledger failed strict
  `noUnusedLocals` because an unused `DomainError` import remained. Removed
  that import; the same full check then passed. The outbox crash test initially
  assumed only one event was ready, although earlier subtests had queued more.
  Scoped readiness to the selected event; the revised test verifies lease
  exclusion and restart reclaim deterministically. These were implementation
  and test setup errors, not baseline failures.
- P3.2 bug reproduction: a new real-database test started a batch, let its
  unsubmitted hold expire, then tried to start another batch. The second start
  failed `BATCH_ALREADY_EXECUTING`. Cause: expiry released the hold but only
  changed a `reserved` plan to `expired`, leaving an `executing` plan occupying
  the unique active-batch slot. Correction: expiry now takes the portfolio lock
  before mutating holds and marks `reserved` or `executing` plans expired when
  they have no submitted reservation. The submitted path remains reconciling.
  Regression verification: the test fails before and passes after the fix; the
  submitted-survival test still passes. Lesson: reservation and plan lifecycle
  must move together, under the same lock order as submission.
- P3 verification: real PostgreSQL 16 integration suite passed seven subtests
  covering migration replay, concurrency, rollback, idempotency, execution
  exclusivity, expired-batch release, submitted freeze, revisions, handler
  retry and crash reclaim. The combined check passed 30 total tests, strict typecheck, build and
  configuration. The final post-documentation check result is in the changelog.
  No Phase 4 planner or application execution adapter was enabled.

## 2026-09-26 — P4.1–P4.4 — Portfolio Coordinator

- Agent/client: Codex. Trigger: owner requested Phase 4. Read state, plan,
  blueprint sections 4/5/8/11, recent project/engineering/changelog entries,
  specifications 0001/0002, ADRs 0002–0004 and shared MCP memory. Baseline
  `./scripts/check.sh` passed 22 foundation tests, typecheck, build and config;
  the P3 database suite was explicitly skipped without `TEST_DATABASE_URL`.
  Existing domain and ledger behavior remained the compatibility baseline.
- P4.1 component: added `migrations/0002_coordinator.sql` for active policy
  links, immutable instrument metadata and unique occurrences even for
  blocked decisions. `CoordinatorStore.activatePolicy` increments the portfolio
  revision and invalidates unsubmitted holds; `coordinateAndReserve` locks one
  portfolio, verifies exact raw balances/reservations and registered metadata,
  then plans and persists evidence, decision and P3 reservations atomically.
  The existing P3 reservation method gained an optional same-transaction
  client; its standalone API and tests remain compatible.
- P4.2 component: `coordinatePortfolio` applies mandatory sells first, never
  nets those sells with purchases, and shows dependent buys only as contingent.
  Optional opposing proposals net only for the same exact eligible instrument
  with sufficient inventory. Different wrappers remain distinct. A confirmed
  new revision is required before a post-sell buy is reserved. P1's allocator
  supplies priority/proportional cash shares and stable rounding; no failed
  leg's unused cash is silently redistributed. The blueprint fixture gives
  $30 NVDA sell, $60 NVDA buy blocked, $50 AMD buy contingent at $30, then a
  separate confirmed-revision $30 AMD reservation. Halted NVDA sale blocks it.
- P4.3 component: bigint upper exposure/lower total valuation checks enforce
  company, sector and issuer caps, minimum cash, fee allowance and separate
  native gas. Wrapper values aggregate by underlying for company limits.
  Each buy is clipped after prior accepted legs; a haircut that shrinks the
  denominator can block an unrelated holding's cap. Each sell is screened for
  a newly introduced intermediate concentration breach. These are planning
  bounds on supplied evidence, not live market validation.
- P4.4 component: decisions include requested, accepted, netted, contingent
  and stable reason fields; only accepted legs become reservations. Evidence,
  decision and blocked-occurrence records persist even when no leg is viable.
  Identical retries replay the stored decision; changed content conflicts.
  Real PostgreSQL tests verified atomic records, stale snapshot/policy
  invalidation, metadata tamper rejection, one post-sell buy reservation,
  blocked-occurrence uniqueness and concurrent stale-snapshot rejection.
- P4 bug reproduction/correction — cash fairness: two same-priority 40-unit
  buys with 50 units cash first produced 40/10 because P4 iterated IDs.
  Added a failing regression, used P1's proportional allocator for the cash
  envelope, and verified 25/25 with the full suite. Lesson: stable order is
  for deterministic limits, not a replacement for same-priority allocation.
- P4 bug reproduction/correction — unsafe netting: an optional sell without
  inventory canceled a valid opposing buy in the first netting draft. The
  failing test had no buy leg. Netting now requires sell eligibility and
  backed inventory, and refuses a group whose aggregate optional sells exceed
  available raw units. Regression tests cover both invalid and oversubscribed
  opposing sells. Lesson: netting cannot create fictitious inventory.
- P4 bug reproduction/correction — reserved inventory: after the first of two
  mandatory sells, the draft projection zeroed an existing raw reservation.
  A failing test then accepted two 30-unit sells despite only 40 unreserved
  units. Preserving the prior hold caused the second sale to be rejected;
  full checks passed. Lesson: projection must carry existing commitments.
- P4 decision/lesson: instrument classifications and blocked occurrences must
  be database records, not only caller fields or plan rows. Added immutable
  registry comparison and a unique coordination-occurrence table; adversarial
  classification and no-leg replay tests passed. [ADR 0005](decisions/0005-coordinator-sequential-bounds.md)
  records sell-first phases and conservative limits.
- Verification: eleven pure coordinator tests and six P4 PostgreSQL subtests
  pass alongside all P1/P3 tests: 48/48 total, strict typecheck, build and
  config with a real PostgreSQL 16 server. `git diff --check` passed. No
  wallet signer, market adapter, owner approval or automated trade was added.

## 2026-09-26 — P5.1–P5.4 — Offline Market Gate

- Agent/client: Codex. Request: proceed to Phase 5. Read the contract,
  blueprint §5, state, phase plan, P2 integration matrix, specification 0003,
  ADRs 0003/0005 and recent logs; searched the Nexus MCP entity. Baseline
  `./scripts/check.sh` passed 33 named tests with two PostgreSQL suites
  explicitly skipped, plus typecheck/build/config. Existing unrelated
  `.codex/config.toml` and Zone.Identifier workspace files were preserved.
- Compatibility: P4's caller-provided eligibility and valuation flags remain
  valid offline APIs; P5 adds a separate pre-approval boundary. No signing,
  live data registration, transaction or approval occurred.

| Work item / component | Change and reason | Test evidence |
|---|---|---|
| P5.1 — `evidence.ts`, `gate.ts` | Require exact instrument identity, wallet/venue/transfer requirements and observed quantity model, adapter version, positive raw-to-share ratio, source block and mapping revision. A changed revision blocks an older plan. | Mapping mismatch, owner transfer denial, missing data and actual-size sell/buy tests pass. |
| P5.2 — `session.ts`, `adapters.ts` | Separate provider `sourceAt` from HTTP receipt, dated exchange session from token status, and quote from simulation. Adapter exceptions become missing evidence. Configure IANA timezone and regular hours. | Timestamp-less/stale reference and outage block; 2026 spring/fall DST, holiday and closed-hour tests pass. |
| P5.3 — `gate.ts` | Require fresh issuer IR provenance, revision, explicit confirmation and blackout bounds; uncertain, withdrawn or active event blocks. Halt/paused/unknown token states and unsupported/risky audits block. | Uncertain and confirmed-blackout event, halted-token and unsupported-audit tests pass. |
| P5.4 — `route.ts`, `gate.ts` | Decode direct V3 calldata to verify exact pair, recipient, input, minimum output and deadline; enforce approved venue/router/fee tier, quote cost and full-size P4 re-evaluation. Bind matching actual-state simulation fields and hash the evidence. | Recipient/spender/calldata/input tampering, impact/native-fee/allowance/portfolio-cap tests pass. |

- P5 design correction — valuation: the first gate draft assigned sell
  `proceedsValueLower` directly from settlement raw units. Review showed this
  silently assumed a stable token always equals the valuation unit. Added
  timed lower/upper settlement conversion evidence and a depeg regression;
  an 0.8 lower conversion now yields 0.8× lower sale value. Lesson: preserve
  denomination boundaries when feeding P4's portfolio caps.
- P5 review correction — aggregate denominator: a fresh quote for one
  instrument did not prove that P4's other held values were current. Added
  per-held-position valuation records and a conservative cash-value ceiling;
  removal of the held record now blocks the sell fixture. Lesson: source
  freshness must cover the whole snapshot used by aggregate constraints.
- P5 design correction — evidence dependency: first collector requested quote
  and simulation concurrently, so simulation could not be bound to the quote.
  It now passes the collected quote to the simulation adapter sequentially;
  missing quotes skip simulation and block. Lesson: dependency order is part
  of a read-only adapter contract.
- P5 compile correction: adding settlement evidence initially reused the
  `settlement` local for the token address; strict typecheck reproduced a
  redeclaration error. Renamed the parsed address `settlementToken` and
  re-ran tests. This was a draft compile failure, not a baseline defect.
- Decision: [ADR 0006](decisions/0006-market-evidence-boundary.md) keeps P5
  pure and restricts calldata decoding to direct V3; opaque wallet/Kyber
  routes remain unsupported. [Specification 0004](specifications/0004-market-gate.md)
  defines the pre-approval boundary and live limitations. No product pivot.
- Full verification after implementation: local PostgreSQL 16-backed
  `TEST_DATABASE_URL=… ./scripts/check.sh` passed 56/56 tests, strict
  typecheck, build and configuration checks. Eight new P5 named tests passed;
  all P3/P4 database cases passed. Final document/check result is recorded in
  the same-day changelog. Production provider verification and P7 owner
  approval/receipt recovery remain open; simulation is not a fill guarantee.

## 2026-09-26 — P5.5a–P5.5d — Live automation readiness investigation

- Agent/client: Codex. User requested the cause of the live block and a fix
  before the next phase. Read the project contract, state, blueprint and P5
  specification/ADR, plan and recent logs; searched shared MCP memory.
  Baseline `./scripts/check.sh` passed 41 named tests, with two PostgreSQL
  suites skipped, plus typecheck/build/config. Existing unrelated
  `.codex/config.toml` and Zone.Identifier files were preserved. Existing P3/P4
  and P5 interfaces remain compatible. No transaction was authorized here.
- P5.5a investigation/component: P2's public Binance reference lacks a
  provider-origin timestamp. Pyth Pro documents `feedUpdateTimestamp`, exact
  equity feed IDs and an authenticated REST endpoint. Implemented
  `pyth-pro.ts` with source-origin timing, exact feed identity, regular-session
  and positive-price checks, exact mantissa/exponent conversion, server-side
  key input and fail-closed fetch. Fixture and provider-error tests pass. An
  authenticated live response is not verified because access is unprovisioned;
  no secret was logged or stored.
- P5.5b investigation/component: issuer-published BSC SyntheticSharesOracle
  responded at a pinned block for NVDAon, AMDon and AAPLon. Implemented
  `ondo-quantity.ts` to check chain 56, block age, `getSValue` against
  `assetData`, active and scheduled pause, and a token/value/update mapping
  revision. Read-only live checks succeeded at blocks 124179311–124179324;
  NVDAon's `sValue` changed relative to P2's display multiplier. Wrong-chain,
  old-block and corporate-action regression tests pass.
- P5.5b draft bug/correction: parallel oracle calls initially compared each
  JSON-RPC response to the mutable shared request counter, which could reject
  a valid first response when a second call incremented it. Captured each
  request ID locally. A live probe then exposed that comparing a newly mined
  block to a clock sampled before network calls could reject a valid block;
  the adapter now checks receipt-time freshness. The final live probe and
  `./scripts/check.sh` passed. Lesson: pin source state, and compare freshness
  to a clock sampled after asynchronous reads.
- P5.5c/P5.5d gate findings: user-specific eligibility cannot be inferred
  from the P2 fill; a dated exchange calendar, reviewed issuer IR events,
  conservative USDT/USD valuation and token-risk policy still need verified
  sources. Binance's unsupported NVDAon audit cannot be labeled clear from
  issuer contract audits. P7's approval, exact pre-leg recheck, transaction
  identity and receipt/reorg recovery also remain unimplemented. These are
  tracked explicitly in the P5.5 matrix. No pivot to live execution.
- Decision: [ADR 0007](decisions/0007-live-market-sources.md) separates Pyth
  price-origin time from Ondo's on-chain economic quantity mapping and keeps
  all other evidence independent. [Live-readiness matrix](integrations/2026-09-26-live-readiness.md)
  records sources, observations and outstanding gates.
- Final verification: local PostgreSQL 16-backed
  `TEST_DATABASE_URL=… ./scripts/check.sh` passed 61/61 tests, strict
  typecheck, build and configuration checks; `git diff --check` passed.
  Five focused P5.5 tests passed. P5.5 remains open for authenticated price
  access and the other matrix gates; no live execution claim is made.

## 2026-09-26 — P5.5a/P5.5c/P5.5d — Keyless market-source pivot

- Agent/client: Codex. The owner reported no Pyth Pro access and supplied
  eligibility context. No identity or wallet details were stored. Read
  state/specification/plan/recent logs and ADR 0007; searched
  shared memory. Baseline `./scripts/check.sh` passed 46 named tests, with two
  PostgreSQL suites skipped, plus typecheck/build/config. Existing unrelated
  workspace changes were preserved. Existing P3/P4/P5 interfaces remain
  compatible.
- P5.5a source decision: Pyth Core Hermes also requires an authenticated data
  plan after its 2026 upgrade, so it is not a free fallback. Chainlink's
  published BSC directory lists underlying NVDA/USD and AAPL/USD proxies with
  `latestRoundData` timestamps, but no AMD/USD BSC proxy at this review. The
  blueprint permits two verified equity instruments; selected NVDAon/AAPLon
  as read-only MVP candidates and kept the Pyth adapter dormant. This pivot
  and its freshness limitation are in [ADR 0008](decisions/0008-keyless-bsc-market-reference.md).
- P5.5a component: `chainlink-bsc.ts` verifies chain 56, proxy label and
  decimals, a pinned block, positive/answered round and provider `updatedAt`.
  It converts eight-decimal USD to 18-decimal exact units. Mainnet read-only
  probes returned NVDA/USD $225.30 at 2026-09-25 19:55Z and AAPL/USD
  $340.745 at 19:40:29Z. A 60-second source-age limit correctly blocked both
  on Saturday. Wrong chain, label, decimals, price, round, age and block tests
  pass. Lesson: a published feed is not always fresh enough to authorize a
  trade; regular-session checks must measure availability before activation.
- P5.5d component: the same validated Chainlink round reader produces a
  conservative lower/upper USDT/USD settlement valuation from the standard
  BSC proxy, with explicit uncertainty basis points. Mainnet read-only probe
  succeeded with a 20-minute policy; a 60-second policy blocked the older
  round. Depeg, stale and invalid-band regression cases pass. The actual
  uncertainty/age policy still needs review.
- P5.5b bug prevention: both Ondo and Chainlink readers now verify that the
  returned block header number matches the pinned RPC block. Mismatched-header
  regression cases pass. Lesson: a block tag alone is insufficient to validate
  metadata returned in a separate RPC response.
- P5.5c eligibility: a conversation confirmation is useful owner context but
  cannot populate live `EligibilityEvidence` without an exact wallet/venue,
  expiry and revocation record. The app has no such flow yet. No details were
  put in the repository or MCP memory. Remaining release gates are in the
  [live-readiness matrix](integrations/2026-09-26-live-readiness.md).
- P5.5c component: `binance-rwa-status.ts` adapts the public per-asset venue
  status to a 30-second token-status receipt and maps all non-explicit-open
  responses to blocked/unknown. A regular exchange session remains an
  independent gate. Fixture failure/expiry tests and read-only NVDAon/AAPLon
  endpoint probes passed. Lesson: off-hours token transferability and equity
  reference-market hours are separate facts.
- P5.5d risk-source finding: read-only Binance audits returned unsupported for
  both candidates. GoPlus returned proxy metadata and zero observed taxes, but
  its critical honeypot/blacklist/whitelist/transfer-pause/mintability fields
  were absent for each proxy, consistent with its documented proxy caveat.
  No `clear` audit evidence was produced. Lesson: a provider response with
  missing risk fields is not a passed risk check; a scoped policy exception
  would require a separate reviewed decision.
- P5.5c component/decision: `nyse-calendar.ts` records the official 2026–2027
  holiday and early-close dates and fetches the publisher page before issuing
  a five-minute session record. It hashes the reviewed table/footnote section;
  a publisher/layout revision, outage, invalid date or date outside the reviewed
  range blocks. Live read-only checks produced weekend, regular, Thanksgiving
  holiday and 13:00 early-close states. Fixture tests cover each and digest
  mismatch. [ADR 0009](decisions/0009-versioned-nyse-calendar.md) records the
  fail-closed maintenance choice. Lesson: static calendar content needs a
  publisher-change detector; an early close must retain its actual close time.
- Full verification after this increment: local PostgreSQL 16-backed
  `TEST_DATABASE_URL=… ./scripts/check.sh` passed 67/67 tests, strict
  typecheck, build and configuration; `git diff --check` passed. Six new
  named tests passed, including the revised Ondo pinned-header regression.
  Mainnet probes were read-only and performed on a closed equity session;
  no regular-session approval or execution test is claimed.

## 2026-09-26 — P5.5c/P5.5d — Owner attestation and unsupported-audit investigation

- Agent/client: Codex. Read state, P5 specification, implementation plan,
  recent logs and applicable ADRs; searched and opened the shared Nexus memory
  entity. Baseline `./scripts/check.sh` passed 52 tests with two
  PostgreSQL suites skipped, plus typecheck/build/config. Preserved the
  pre-existing `.codex/config.toml` modification and unrelated untracked file.
  Existing P3/P4/P5 interfaces and the fail-closed audit gate remain compatible.
- P5.5d reproduction: three Binance BSC token-audit requests used the
  documented `binanceChainId=56` and exact contracts. NVDAon and AAPLon each
  returned HTTP 200/code `000000`, `hasResult=false`, `isSupported=false`;
  control USDT returned `hasResult=true`, `isSupported=true`. Cause visible to
  us is provider noncoverage, not a malformed chain/address request. The API
  does not disclose its internal reason. Correction: keep `unsupported`
  blocked; add an exact on-chain implementation identity reader for future
  review, not a false `clear` result. Regression: P5's existing unsupported-
  audit test still passes; new beacon failure/change tests pass. Lesson: audit
  transport success and provider coverage are independent.
- P5.5d component: `ondo-beacon-risk.ts` pins chain 56 and one block,
  verifies its header timestamp, reads the EIP-1967 beacon slot, calls
  `implementation()`, and hashes proxy/beacon/implementation runtime code.
  Read-only BSC probes at blocks 124188783/124188793 found that NVDAon and
  AAPLon share beacon `0xc046b05a920e4b412815934dd8e58904dda73315`
  and implementation `0x578f397ca4661d1db4d9a65065d6b284a1a850fd`.
  Exact hashes and token addresses are in
  [the integration note](integrations/2026-09-26-eligibility-risk.md).
  Wrong chain, stale/mismatched block, absent beacon/implementation and empty
  code fail closed. A fingerprint proves code identity only; Ondo audit reports
  have not been mapped to this exact runtime hash. The review/exception choice
  is recorded in [ADR 0010](decisions/0010-owner-attestation-and-token-risk.md).
- P5.5c component: `owner-attestation.ts` creates a 24-hour EIP-712
  declaration bound to chain 56, exact wallet/token/router/venue/side and
  random nonce. It requires explicit positive eligibility declarations,
  verifies EOA signature, scope, lifetime and revocation callback; Agentic
  Wallet's split signature/recovery format is accepted. A local CLI generates
  a challenge and checks a signed file plus revocation list. It uses pinned
  `ethers` 6.17.0. Tests cover valid signature, changed asset/route/venue/side,
  altered declarations, expiry, revoked nonce and malformed signature.
  This verifies wallet control and owner representation only; it is not a
  legal/KYC or transfer permission determination, and no production adapter
  or durable revocation store is wired. No actual owner signature was asked
  for or stored. The steps are in
  [the owner procedure](integrations/2026-09-26-eligibility-risk.md).
- P5.5c lesson: a generated challenge must not silently assert eligibility.
  The first factory draft defaulted declaration booleans to `true`; review
  caught this before release. It now requires explicit `true` inputs and the
  CLI requires `I_ATTEST_ELIGIBLE`. A changed-declaration regression test
  passes. Signed declarations will be requested only near activation because
  they expire after 24 hours.
- P5.5c CLI bug reproduction: a smoke test redirected `npm run attestation`
  output to a file and found npm's banner before the JSON. The CLI itself
  returned valid JSON, but the documented redirect would produce an invalid
  challenge file. Corrected the procedure to use `npm --silent run`, then
  repeated the redirect/parse check. Lesson: test copyable operator commands,
  including their wrapper output, not just the TypeScript function.
- Verification: after dependency install and each material code increment,
  `./scripts/check.sh` passed. A synthetic CLI challenge/signature/verify
  round trip passed. Final PostgreSQL 16-backed
  `TEST_DATABASE_URL=… ./scripts/check.sh` passed 70/70 tests, strict
  typecheck, build and configuration; `git diff --check` passed. Mainnet reads
  and audit probes were read-only; no real-wallet signature,
  token approval or transaction was submitted. P5.5 remains open for actual
  owner signature, durable revocation, current transfer checks, issuer events,
  regular-session price evidence and a token-risk policy decision. P7 still
  owns approval and transaction recovery.

## 2026-09-26 — P5.5c/P5.5d — Settlement unit correction and issuer-event procedure

- Agent/client: Codex. Prior committed P5.5 attestation/fingerprint work is
  `da512dd`. Read state, plan, source, test and existing source ADR; baseline
  PostgreSQL 16-backed `./scripts/check.sh` passed 70/70 tests. Existing
  public gate and coordinator interfaces remain compatible.
- P5.5d bug reproduction: `fetchChainlinkBscSettlement` emitted
  `valuationUnit: "USD"`, while P5's snapshot and examples use `"USD-18"`.
  The gate rejects that otherwise fresh settlement record as
  `REFERENCE_UNAVAILABLE`. Cause: adapter label was not aligned with the
  domain valuation-unit contract. Correction: emit `USD-18`; add an adapter
  assertion and a gate mismatch regression. Lesson: evidence adapters must
  be tested against the consumer's semantic units, not only their own value
  arithmetic.
- P5.5d policy control: `maxPegDeviationBps` is now an explicit settlement
  reader input; a 2% USDT/USD deviation fails a 1% fixture ceiling before
  uncertainty is applied. Invalid thresholds fail closed. A read-only BSC
  probe returned a fresh `USD-18` value under illustrative 20-minute age,
  50-bp uncertainty and 100-bp peg parameters. These are test/probe settings,
  not an approved production policy. [ADR 0008](decisions/0008-keyless-bsc-market-reference.md)
  records the source boundary.
- P5.5c issuer event: reviewed official NVIDIA and Apple investor pages.
  NVIDIA's financial report identified the prior quarter, but event sections
  were dynamic or inaccessible to the read-only runtime; Apple's investor
  page was also dynamic. The absence of visible next-date text cannot prove
  `none-confirmed`. Added [the manual runbook](runbooks/issuer-event-review.md)
  with direct-source URL, timezone, revision, expiration and recheck rules;
  ambiguous or inaccessible sources map to `uncertain`. No event evidence
  was issued for live use. Lesson: manual confirmation requires a positive
  reviewer finding; a blank or blocked page is not evidence of no event.
- Verification: full PostgreSQL-backed `./scripts/check.sh` passed 70/70
  after the code change, plus typecheck/build/config. Final documentation
  check and `git diff --check` passed. No application trade,
  token approval or wallet signature was submitted.

## 2026-09-26 — P5.5d — Verified Ondo control-surface review

- Agent/client: Codex. Sourcify's BSC v2 contract lookup reports a runtime
  source `match` for the common GMToken implementation and beacon. The source
  includes role-gated mint/admin burn, configurable compliance and pause
  managers, and a transfer hook that checks pause and parties' compliance.
  The beacon exposes `upgradeTo`. Read-only BSC calls at one block found the
  same compliance/pause pointers for both tokens. This establishes neither
  malicious behavior nor safety. Lesson: code hashes do not capture changing
  role assignments or external control pointers; a risk exception would have
  to bind and recheck those as well. The
  [integration note](integrations/2026-09-26-eligibility-risk.md) and
  [ADR 0010](decisions/0010-owner-attestation-and-token-risk.md) make this
  limitation explicit. No exception was activated. Final PostgreSQL-backed
  `./scripts/check.sh` passed 70/70 tests, typecheck/build/config, and
  `git diff --check` passed.

## 2026-09-26 — P5.5b/P5.5c/P5.5e — xStocks-first BSC integration

- Agent/client: Codex. Owner directed a provider-priority pivot from Ondo to
  xStocks before P6. Read blueprint, phase plan, state, recent logs and ADRs;
  searched shared memory. Baseline PostgreSQL 16-backed `./scripts/check.sh`
  passed 70/70 named tests, strict typecheck/build/config. Preserved P3/P4/P5
  interfaces and the no-execution boundary. Decision: [ADR 0011](decisions/0011-xstocks-first-bsc-provider.md).
- P5.5b source finding: issuer developer documentation says EVM xStocks
  `balanceOf()` rebases, whereas the current v2 ERC-4626 wrapper holds stable
  share units. The legacy v1 wrapper can have a donation-sensitive rate. Live
  issuer API, Binance `type=2` list and read-only BSC calls agreed on NVDAx and
  AAPLx native/current-wrapper identities. At block `124221220`, each wrapper
  `asset()` matched its native token, both decimals were 18, and
  `convertToAssets(10^18)` equaled native `getCurrentMultiplier()`. Lesson:
  do not carry Ondo's quantity model or treat a ticker as a token identity.
- P5.5b component: `xstocks-bsc.ts` accepts only exact registered BSC token
  and v2-wrapper addresses, underlying symbol and USD denomination from the
  public issuer asset response. A pinned
  chain-56 RPC read verifies recent block header, code presence, both decimals,
  `asset()` and multiplier/conversion agreement; it binds multiplier and both
  code hashes into a P5 `xstocks-v2-wrapper` mapping revision. Issuer halt and
  stale issuer identity block quantity evidence. Live read-only adapter calls
  succeeded for both assets at blocks `124221960` and `124221967`. Code hashes
  are identity observations, not a review of upgrade controls or safety.
- P5.5c decision: the Ondo 24-hour signed declaration is not reused as an
  xStocks credential. The issuer's technically transferable token still has
  distribution/jurisdiction restrictions and partner responsibilities. No
  user-specific eligibility or venue-open `EligibilityEvidence` is emitted.
- P5.5e route reproduction: at pinned block `124221220`, Pancake V3 `getPool`
  found no direct USDT/USDC/WBNB pools for either native or current-wrapped
  candidate at fee tiers 100/500/2500/10000. Agentic Wallet read-only 5-USDT
  quotes for NVDAx, AAPLx and both wrappers each failed with exact message
  `No liquidity available, please try again later.` This does not exclude
  PancakeSwap X, CowSwap or a later market-maker route. Their calldata,
  bounds, simulation and wallet compatibility remain unverified. No swap,
  allowance, wallet signature or live registration was attempted.
- Test bug/correction: the first RPC fixture typed every parameter as an
  object, but `eth_getCode` takes a string address. TypeScript rejected the
  impossible comparison. Corrected the fixture to model both parameter
  shapes, then reran the named suite. Three new tests cover exact issuer
  identity, denomination and duplicate/legacy rejection; pinned wrapper mapping; wrong
  chain, stale block/identity, halt, wrong asset, conversion mismatch, missing
  code and bad decimals. `npm test` passed 58 tests with two DB suites skipped;
  full PostgreSQL-backed `./scripts/check.sh` passed 73/73, typecheck/build/config.
- [The integration matrix](integrations/2026-09-26-xstocks-bsc.md) records
  contract identities, route failure and remaining gates. Lesson: an issuer
  deployment plus a valid quantity adapter does not imply reachable liquidity
  or permission to trade; venue feasibility must be verified separately.

## 2026-09-26 — P5.5e — Wider xStocks route probe

- Agent/client: Codex. Baseline PostgreSQL-backed `./scripts/check.sh` passed
  73/73 before this documentation increment. Binance's `type=2` BSC list
  supplied exact AMZNx, COINx, GOOGLx, METAx, MSFTx, QQQx, SPYx and TSLAx
  addresses. Read-only Agentic Wallet 5-USDT quotes returned `No liquidity
  available, please try again later.` for seven. SPYx returned
  `0.000558226306813186` for 5 USDT, an implied $8,956.94/token. The public
  dynamic API indicated about $769.00/token but has no verified source-origin
  timestamp, so this is a screening comparison rather than trade valuation.
- Decision/lesson: a quote object is not evidence of an economically usable
  route. Do not silently substitute SPYx or relax the independent P5
  deviation, liquidity and exact-calldata checks. No wallet state changed and
  no additional execution candidate was registered. [The integration matrix](integrations/2026-09-26-xstocks-bsc.md)
  and [ADR 0011](decisions/0011-xstocks-first-bsc-provider.md) record the
  finding. Final `./scripts/check.sh` and diff verification are recorded in
  the corresponding changelog entry.

## 2026-09-27 — P5.5e — BSC issuer liquidity survey

- Agent/client: Codex. Read the blueprint, active phase plan, state, recent logs,
  relevant ADR and integration notes; searched supplementary project memory.
  PostgreSQL-backed `./scripts/check.sh` passed 73/73 before documentation.
  Wallet skill/CLI preflight reported current versions and a connected session.
- Inventory step: Binance's BSC tokenized-securities feed returned 671 records:
  458 Ondo, 128 xStocks, 80 bStocks, four Paimon pre-IPO SPV records and one
  separately classified BNC4 record. Equity-scoped cohorts were 329/96/67;
  the classification includes 17 bStocks equity tickers with omitted
  `assetType`. Paimon and BNC4 were tested but kept outside the three-provider
  equity ranking. No wallet identifiers or credentials were recorded.
- Pool step: read-only DEX Screener pair queries covered every listed address.
  For each instrument the snapshot selected its largest direct token/USDT
  pool by USDT-side reserve; this is a depth proxy, not an execution promise.
  Quote step: 100-USDT Agentic Wallet read-only quotes covered all 671 entries;
  1,000- and 10,000-USDT quotes covered 100-USDT successes. One bStocks 429
  response was retried successfully; it was not counted as missing liquidity.
  No transaction, approval, signature or wallet-state change occurred.
- Observation: equity 100-USDT quotes succeeded for 23/329 Ondo, 4/96
  xStocks and 66/67 bStocks. All 306 unsuccessful Ondo equity responses cited
  stock-market opening hours. Only 12 Ondo equities had a visible direct
  USDT pool; five of those quoted. xStocks had two dust-sized direct USDT
  pools; three of its four equity quotes deteriorated by more than 56% from
  100 to 10,000 USDT, and MSTRx returned dust-sized output. bStocks had 34
  direct USDT equity pools. Its deepest 20 all quoted at both sizes with
  no more than 0.42% observed quote deterioration; their direct USDT reserves
  spanned about 76,818 to 1,492,287 USDT.
- Decision/lesson: do not rank absent liquidity or weekend-blocked Ondo
  assets as if measured. A successful quote, especially a dust-priced one,
  does not prove a fair or executable route. The dated [report and full CSV](research/2026-09-27-bsc-stock-liquidity.md)
  preserve contracts, method and per-token evidence. This survey recommends
  bStocks route investigation but does not change [ADR 0011](decisions/0011-xstocks-first-bsc-provider.md)
  or enable a live provider. Re-test Ondo in regular hours; continue exact
  route, independent price, audit, eligibility and simulation gates.
- Verification: the report-only and expanded-inventory increments each passed
  PostgreSQL-backed `./scripts/check.sh` (73/73 tests, typecheck, build and
  Portable configuration). CSV staging initially used CRLF line endings;
  `git diff --cached --check` flagged each row as trailing whitespace. The
  snapshot was normalized to LF and the staged diff was rechecked. Final
  documentation checks are in the matching changelog entry.

## 2026-09-27 — P5.5b/P5.5e — bStocks priority and price-bounded V3 route

- Agent/client: Codex. Owner explicitly directed the bStocks-first switch after
  the 671-record survey showed xStocks thin routes. Read `AGENTS.md`, blueprint,
  P5 specification, plan, state, logs and ADR 0011; searched supplementary
  memory. Baseline PostgreSQL-backed `./scripts/check.sh` passed 73/73,
  typecheck/build/config. Wallet skill 1.12.0 and CLI 1.10.0 preflight passed;
  session was connected and not near expiry. No existing P3/P4/P5 interface or
  test behavior was changed.
- P5.5b source/decision: Binance's `type=3` BSC list resolved the exact NVDAB
  contract, and official bStocks/BEP-677 documents distinguish raw ERC-20
  amounts from displayed amounts multiplied by `uiMultiplier()`. [ADR 0012](decisions/0012-bstocks-first-bsc-provider.md)
  makes bStocks the first live-provider target; ADR 0011 retains its xStocks
  technical findings but no longer sets priority. No bStocks adapter was
  prematurely registered. A separate raw/UI mapping, scheduled multiplier
  and proxy-control review remain work items.
- P5.5e pool step: official PancakeSwap BSC factory, QuoterV2 and V3 router
  addresses were rechecked. At block 124347223, the NVDAB/USDT pool's
  `token0/token1/factory/fee` and factory `getPool` agreed on direct pool
  `0x8FB4243b553aC29BA088aCf00B9B7dA24bD6690C`, fee 2500. Both tokens
  reported 18 decimals. Read-only QuoterV2 buy/sell probes at 5/100/1,000/
  10,000 USDT succeeded; the 5-USDT round trip lost about 0.50% before gas.
  A separate Agentic Wallet 5-USDT quote succeeded but omitted exact route.
- P5.5e exact-bound step: at pinned block 124348179, a 5-USDT direct quote
  returned `22176198062689502` raw NVDAB. An `exactInputSingle` call fixed
  the connected wallet as recipient, fee 2500, exact input 5e18, zero native
  value/price limit, 50-bps minimum `22065317072376054` raw units and a
  10-minute on-chain deadline. Nexus's V3 decoder matched the encoded fields.
  On-chain multiplier was `1.000778223752807865`, pending value identical,
  `effectiveAt=0`. Against a contemporaneous Binance bStocks spot best ask
  of 224.84 USDT/displayed unit, the route quote implied 225.29 (0.20%
  premium) and the minimum bound implied 226.42 (0.70% premium). The spot
  response has no source-origin timestamp and is not independent underlying
  stock evidence, so this is screening, not production P5 reference approval.
- P5.5e simulation/negative tests: pinned `eth_call` with temporary exact
  5-USDT balance/allowance state overrides returned the quoted output; gas
  estimation returned 182,595. Raising the minimum to one raw unit above the
  quote reverted; an expired deadline reverted. The actual connected wallet
  lacked both sufficient USDT and exact router allowance, so this is a
  **conditional route proof**, not a ready-to-send wallet transaction. No
  approval, signature, swap, on-chain state change or personal wallet address
  was stored in project records. The dated [bStocks matrix](integrations/2026-09-27-bstocks-bsc.md)
  captures the exact public fields and remaining gates.
- P5.5d risk check: the read-only Binance audit for this exact contract
  returned `hasResult=false, isSupported=false`; no risk level is inferred.
  Binance's bStocks FAQ also requires eligibility and allows address controls.
  Lesson: strong liquidity and successful conditional simulation do not clear
  issuer eligibility, risk or independent price requirements. The route's
  deadline expired after the probe and cannot be reused.
- Documentation increment: updated the implementation plan, project state,
  Market Gate specification, project log, ADR status and CHANGELOG while
  preserving the issuer-neutral modular architecture. Post-change checks are
  recorded in the matching changelog entry.

## 2026-09-27 — P5.5b — bStocks raw/UI and control snapshot

- Agent/client: Codex, continuing the owner's bStocks-first instruction.
  Read the project contract, state, plan, P5 specification, recent logs and
  ADRs; searched supplementary MCP memory. Baseline `./scripts/check.sh`
  passed 58 tests, with two PostgreSQL suites skipped because no
  `TEST_DATABASE_URL` was configured; typecheck/build/config passed. Preserved
  the existing P3/P4/P5 interfaces and unrelated workspace changes.
- Source and decision: current BEP-677 specifies canonical raw BEP-20 amounts,
  18-decimal UI scaling and pending multiplier semantics. The Binance bStocks
  FAQ says displayed units are intended to reflect some corporate actions but
  that entitlement remains subject to product terms. [ADR 0013](decisions/0013-bstocks-display-mapping-boundary.md)
  keeps this UI snapshot separate from P5 economic `QuantityEvidence` until
  reference-share mapping is independently reviewed.
- New component: `src/market-gate/bstocks-bsc.ts` reads the exact NVDAB token
  at one pinned BSC block. It checks chain, freshness, 18 raw decimals,
  required BEP-677 interfaces, active/pending multiplier consistency, EIP-1967
  beacon/implementation and deployed code, plus beacon owner. It returns
  source block, mapping revision and code/control hashes; changed reviewed
  fingerprints or pending changes block review reuse. `bStocksDisplayedRaw`
  applies floor division for display only. No wallet mutation or P5 evidence
  registration was added.
- Test step: registered three named tests for valid mapping, pending schedule,
  wrong token/chain, stale or inconsistent RPC values, absent code, changed
  owner/implementation code and exact display truncation. Initial `npm test`
  failed at TypeScript compilation: an array literal inferred `pending` as
  `bigint[]`, while the mock requires a two-element tuple. Explicitly checked
  the array against `Change[]`; the rerun passed 61 tests with two PostgreSQL
  suites skipped. This was a test fixture typing error, not a production bug.
- Live read-only verification: BSC block 124351665 at 14:49:49 UTC returned
  multiplier `1000778223752807865`, no pending change, 18 decimals and a
  nonempty beacon/implementation code path. The code/control hashes are a
  revision fingerprint, not a security audit; mutable roles and external
  controls remain unreviewed. The public FAQ mentions a country-eligibility
  API without an endpoint path, so no guessed API was integrated. Unsupported
  token audit, current eligibility, source-timestamped bStock pricing,
  issuer-event policy and P7 execution/recovery remain open.
- Source/control follow-up: Sourcify reports an exact runtime match for the
  current implementation. Its verified source shows transfer pause/compliance
  hooks, mutable manager pointers, enumerable admin/issuer roles and issuer
  multiplier authority. Extended the adapter to pin manager addresses/code,
  role-set hashes and token pause state. A second live read at block 124352879
  (14:58:56 UTC) found no pending multiplier and `isTokenPaused=false`.
  Internal manager policies can still change without these fingerprints;
  neither this check nor verified source is a token-risk clearance.
- Regression fixture correction: after adding manager-code checks, the new
  changed-compliance test unexpectedly passed review matching. Reproduction:
  `npm test` failed test 63 at the changed-compliance assertion. Cause: the
  mock matched lowercase addresses while ethers decoded checksummed addresses,
  so it returned the default code for the compliance contract. Normalized
  mock target comparisons; `npm test` then passed 61 tests with two database
  suites skipped. The live RPC probe confirmed the real adapter path.
- Post-change `./scripts/check.sh` passed 61 tests with two database suites
  skipped, plus typecheck/build/config. Final documentation check is recorded
  in the changelog.
