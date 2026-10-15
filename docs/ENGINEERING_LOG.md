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

## 2026-09-27 — P5.5c — bStocks on-chain transfer preflight

- Agent/client: Codex, continuing the active bStocks-first P5.5 work. Prior
  passing `./scripts/check.sh` (61 tests, two PostgreSQL suites skipped) set
  this increment's baseline; read the existing P5 contract, integration
  matrix and ADR 0013. Preserved the raw/UI adapter and existing P5 interfaces.
- Source review: Sourcify exact-runtime matches for the current bStocks
  compliance and pause-manager contracts expose a per-token blocklist, global
  sanctions list, global/token pause and mutable admin/operations roles. The
  token's transfer hook checks sender and recipient; `transferFrom` may also
  check its caller. A route quote does not test these restrictions. The public
  Binance FAQ says a country-eligibility API exists but gives no endpoint path
  in the reviewed text. No country or account permission is inferred from a
  localized web page.
- New component: `src/market-gate/bstocks-transfer.ts` checks the exact
  validated direct-V3 pool/router and supplied wallet at the quantity
  snapshot's block. It requires an unchanged reviewed control fingerprint,
  rejects scheduled multiplier/stale block, rechecks pause state and calls
  `checkIsCompliant` for all three participants. Any RPC error or restriction
  returns no result. The output is deliberately not P5 `EligibilityEvidence`;
  it cannot decide geography, account permission or overall token risk.
  [ADR 0014](decisions/0014-bstocks-transfer-preflight-boundary.md) records
  that separation.
- Tests: three named tests cover exact participant calls, blocked wallet/pool/
  router, token pause, invalid reply, changed reviewed control, pending
  multiplier, stale/expired/mismatched block and wrong chain. Local
  `./scripts/check.sh` passed 64 tests with two PostgreSQL suites skipped,
  plus typecheck/build/config. A read-only BSC probe at block 124353819
  (15:05:59 UTC) passed for a synthetic address and public route contracts;
  it is not an actual-wallet or jurisdiction eligibility result.
- Remaining: issuer-backed country/account eligibility, actual-wallet checks
  at an approved trade preview, full mutable manager policy review, supported
  audit, independent timely price/settlement rules, issuer events and P7
  approval/recovery. No private address or signed data was stored in project
  records. No wallet state changed.

## 2026-09-27 — P5.5d — extend bStocks control-revision coverage

- Agent/client: Codex. Baseline was the passing P5.5c `./scripts/check.sh`
  (64 tests, two PostgreSQL suites skipped). Verified source showed that the
  external compliance and pause managers have independent mutable roles, and
  the token has admin-controlled mint/burn enable flags. The prior fingerprint
  covered manager code and pointers but not those role sets or flags.
- Updated the P5.5b snapshot to hash compliance admin/operations/compliance
  role sets and pause-manager admin/operations role sets, and to bind the
  token's current mint/burn switches. A changed role set or flag now fails
  reviewed-control matching. Empty optional compliance roles are valid;
  missing administrator roles or malformed member lists fail closed. No
  policy interprets `mintEnabled` or `burnEnabled` as safe.
- Extended existing regression tests for external role changes and mint-flag
  changes. A live read-only BSC probe at block 124354706 (15:12:39 UTC)
  returned both switches enabled, no pending multiplier and token not paused.
  `./scripts/check.sh` passed 64 tests, two database suites skipped, plus
  typecheck/build/config. This is control-revision evidence, not a security
  audit or eligibility result. The compliance and pause lists can change
  without a code or role change; the P5.5c/P7 preflight must remain fresh.

## 2026-09-27 — P5.5c — identify bStocks provider-event evidence gap

- Agent/client: Codex. Baseline `./scripts/check.sh` passed 64 tests with two
  PostgreSQL suites skipped, plus typecheck/build/config.
- Discovery: Binance's official 2026-09-04 NVDAB dividend notice specified a
  2026-09-10 holder snapshot, on-chain multiplier adjustment and temporary
  conversion/deposit/withdrawal pauses while spot trading remained available.
  This event would not be fully represented by checking NVIDIA investor
  relations alone or by a successful DEX quote.
- Decision: [ADR 0015](decisions/0015-bstocks-dual-event-review.md) and the
  updated [event runbook](runbooks/issuer-event-review.md) require direct,
  independently revisioned underlying and provider notices for the exact
  bStock. The current P5 `EventEvidence` has only an underlying source;
  schema, policy and approval-invalidation tests remain necessary before live
  registration. No historical event was treated as current clearance.
- Documentation-only step: updated the Market Gate specification, P5.5 plan,
  bStocks route matrix and project state. No application behavior or wallet
  state changed; no new behavior test was needed for this record.
  Post-change `./scripts/check.sh` passed 64 tests with two PostgreSQL suites
  skipped, plus typecheck/build/config; `git diff --check` passed.

## 2026-09-27 — P5.5c — bind provider notices in the Market Gate

- Agent/client: Codex. Baseline was the passing 64-test documentation commit
  `4c3bcb6`; two PostgreSQL suites were skipped because the local database
  test URL is unavailable. Observable compatibility target: existing
  non-bStocks offline evidence and adapter calls remain valid.
- New evidence component: `ProviderEventEvidence` carries the exact
  instrument, direct notice URL, independent revision, timestamps and
  confirmation/blackout fields. `MarketEvidence` includes a nullable record;
  the adapter seam accepts an optional provider notice source and converts
  source errors to missing evidence. The pure gate requires this record for
  canonical issuer ID `bstocks`, checks freshness and restrictions, and
  includes it in the evidence hash. Other issuers can continue without it.
- Bug fix: an invalid issuer-event confirmation string could previously pass
  if all dates were null, and the HTTPS prefix check accepted a URL without
  a host. The shared event validator now accepts only `none-confirmed` or a
  valid out-of-blackout `confirmed` event, and both source URLs must parse as
  HTTPS with a host and no embedded credentials or fragment. Regression
  verification is in the Market Gate test.
- Tests: synthetic bStocks evidence passes only with a fresh matching notice;
  missing, stale, wrong-instrument, insecure URL, uncertain, active blackout
  and provider adapter outage block. A future event outside its blackout may
  pass; a notice revision changes the evidence hash. `./scripts/check.sh`
  passed 66 tests with two PostgreSQL suites skipped, plus typecheck/build.
- Remaining: no live provider-notice feed, no current issuer-event clearance,
  no instrument registration and no P7 approval revalidation. A manually
  asserted `none-confirmed` must be based on a reviewed current source; this
  interface does not discover notices or certify their completeness.

## 2026-09-28 — P5.5c/P7.1 — EOA-first scope and eligibility correction

- Agent/client: Codex, following the owner's EOA-first direction. Baseline
  `./scripts/check.sh` passed 66 tests, with two PostgreSQL suites skipped
  because `TEST_DATABASE_URL` is unavailable; typecheck/build/config passed.
- Reviewed the blueprint's owner-approved wallet MVP, P5 eligibility schema,
  current bStocks transfer preflight and Binance's official bStocks FAQ. The
  FAQ distinguishes third-party geographic enforcement and issuer address
  restrictions. It does not establish a universal Binance account-status
  requirement for an external-wallet DEX route. The prior ADR 0014 wording
  conflated account-based product access with direct EOA use.
- Decision/correction: [ADR 0016](decisions/0016-eoa-first-wallet-execution.md)
  prioritizes an owner-signed EOA path behind a wallet-neutral execution
  boundary. ADR 0014, the Market Gate specification, plan and state now
  describe route-specific eligibility. Account status is required only when
  the actual route or applicable terms require it; bStocks geographic and
  transfer restrictions still block without credible current evidence.
- Scope and compatibility: documentation only. Existing Market Gate checks,
  bStocks live-disabled state and Agentic Wallet feasibility evidence remain
  unchanged. No user location or identity was stored in project memory.
  P6 and synthetic P7 work can proceed without treating P5.5 as complete.
- Verification: Post-change `./scripts/check.sh` passed 66 tests with two
  PostgreSQL suites skipped, plus typecheck/build/config; `git diff --check`
  passed. No behavior test was added for this documentation-only decision.
- Git: focused commit attempted, but this session's `.git` is read-only and
  Git could not create `index.lock`. The documentation changes remain in the
  working tree for a later writable session to commit.

## 2026-09-28 — P5.5c bStocks access-control flow

- Agent/client: Codex. Baseline `./scripts/check.sh` passed 66 tests with two
  PostgreSQL suites skipped; typecheck, build and configuration checks passed.
- Added [the access-control runbook](runbooks/bstocks-access-control.md) and
  linked it from ADR 0016, the implementation plan and project state. It
  specifies session-to-EOA binding, reviewed user/jurisdiction evidence,
  official country/product result, exact-wallet/pool/router transfer preflight,
  server-side enforcement and pre-leg recheck. No endpoint path was invented.
- Decision: page access, VPN state and an on-chain transfer pass cannot produce
  live P5 eligibility. Official endpoint/schema and a privacy-preserving
  jurisdiction evidence process remain open. No code or wallet state changed
  in this design step.

## 2026-09-28 — P6.1–P6.5 pure rule core

- Agent/client: Codex. Added `src/rules/rules.ts`, `schedule.ts`, `evaluate.ts`,
  [specification 0005](specifications/0005-rules-and-scheduling.md) and five
  named tests. Strict structured schemas reject unknown fields, instruments,
  units and signals. Reviewed hash activation is separate from trade approval.
  The evaluator emits basket budgets, price intents and scoped earnings
  restrictions, without a wallet or submission dependency.
- Scheduling uses local IANA time, deterministic occurrence IDs, largest-
  remainder base-unit splits and explicit DST gap/overlap behavior. Duplicate
  IDs are recognized from a supplied seen set; durable claim remains P6 work.
- Bug reproduction: initial TypeScript check failed because
  `Omit<CompiledRule, ...>` collapsed the discriminated union and generic
  activation casts obscured the variants. Cause: mapped types on the union
  erased kind-specific fields. Correction: use an explicit union of omitted
  variants and ordinary union-returning activation/pause functions. The next
  `./scripts/check.sh` passed 71 tests with two PostgreSQL suites skipped,
  typecheck, build and configuration checks. Lesson: preserve discriminants
  explicitly when mapping TypeScript unions.
- Open: persist rule versions/occurrence claims, translate intents to P4
  proposals and restrictions, account for scoped earnings allocation and
  provide the optional reviewed LLM drafting flow. An uncertain freeze event
  returns suspended; an integrating coordinator must block dependent buys.

## 2026-09-28 — P7.1 EOA approval and signed-swap verifier

- Agent/client: Codex. Added `src/execution/eoa.ts`, two named synthetic tests,
  [specification 0006](specifications/0006-eoa-execution.md) and
  [ADR 0017](decisions/0017-eoa-exact-leg-approval.md). A passing P5 gate is
  required to prepare one off-chain EIP-712 leg approval. The owner signature
  binds plan/revision/policy/evidence, exact route, nonce, expiry and gas bounds;
  a second EIP-1559 signature must match the transaction. Fresh P5 evaluation
  and trusted plan metadata are required again before verification.
- Tests prove valid synthetic signature/hash, rejection of changed revision,
  policy, evidence, pause state, signer, calldata and gas bound, plus absent
  eligibility and overlong approval expiry. `./scripts/check.sh` passed 73
  tests with two PostgreSQL suites skipped, typecheck, build and configuration.
- Decision: no broadcaster is exposed before durable signed bytes/hash,
  authorization nonce and receipt/nonce recovery exist. P7.2–P7.5 and real
  bStocks P5.5 evidence remain open. No live order or transaction was sent.

## 2026-09-28 — P5.5c bStocks access-control implementation

- Agent/client: Codex. Baseline `./scripts/check.sh` passed 73 tests, with two
  PostgreSQL suites skipped; typecheck, build and configuration passed. Shared
  MCP memory was searched; Git-tracked specifications, runbook, ADRs, plan,
  state and recent logs were read. Existing uncommitted user/earlier-agent
  changes were preserved.
- Reviewed the official bStocks FAQ and Binance developer search results.
  The FAQ requires third-party geographic enforcement and mentions a public
  country endpoint, but the reviewed public material still does not identify
  its path or response schema. No endpoint was guessed and no Nigeria access
  result was inferred. This is the reason production country sourcing remains
  unavailable.
- Added `src/market-gate/bstocks-access.ts`: short-lived EIP-712 EOA challenge,
  atomic issue/consume store port and verified session binding; fail-closed
  composition of trusted person/jurisdiction, official country, exact product
  permission and pinned-block wallet/pool/router transfer checks. The result
  omits personal country and binds source revisions and route parties in an
  access hash. The module has no location or country data source of its own.
- Review correction: the first access function shape placed reviewed policy
  and transfer-control snapshot in the leg request. That would make it too
  easy for a later HTTP handler to copy client fields into trusted controls.
  Moved them to a separate `BStocksAccessServerContext` argument and retained
  only session, wallet, instrument, side and clock in the request. The final
  check passed 78 tests with two database skips. Lesson: make trust boundaries
  visible in function signatures, even before a web runtime exists.
- Updated P5 `EligibilityEvidence` and the Market Gate so canonical bStocks
  require an access-control record whose token, side, pool, router and transfer
  block match the route and quantity snapshot. Other issuers retain their
  existing eligibility interface. A changed access hash changes the P5 hash
  consumed by P7. [ADR 0018](decisions/0018-bstocks-access-evidence.md)
  records the boundary.
- Added four access tests and one Market Gate regression test: one-use/session-
  scoped challenge, complete synthetic evidence without country disclosure,
  denied/stale/conflicting/outage/blocked-wallet/pool/pause failures, and
  source/route/expiry mismatch. `./scripts/check.sh` passed 78 tests with two
  PostgreSQL suites skipped; typecheck, build and configuration passed.
- Remaining P5.5c integration: reviewed official endpoint/schema, trusted
  jurisdiction and product sources, authenticated server session and durable
  challenge store, actual-wallet live read and pre-leg refresh. Other P5.5/P7
  blockers still apply. No wallet transaction or live trade was sent.
## 2026-09-28 — P7.2–P7.5 EOA persistence and recovery increment

- Agent/client: Codex. The pre-change `./scripts/check.sh` baseline passed 78
  tests with two PostgreSQL suites skipped; typecheck, build and configuration
  checks passed. Reviewed the blueprint §8, implementation plan, P3/P4/P5
  contracts, EOA specification, ADRs and recent logs; searched supplementary
  MCP memory. Existing user/earlier-agent work was preserved.
- P7.2 components: new `0003_eoa_execution.sql` and `EoaExecutionStore` add a
  default-paused bound EOA, one signed leg per reservation, unique chain/wallet
  nonce and authorization nonce, raw signed bytes/hash and approval/evidence
  hashes. `persistSignedLeg` verifies signatures, current P5 and exact reserved
  input, then stores bytes and freezes the reservation atomically. A repeated
  identical leg is idempotent; a different leg ID payload conflicts.
- P7.1/P7.2 correction: an initial `markBroadcastAttempt` shape could mark a
  stored leg unknown without rechecking the approval or Market Gate. Replaced
  it with `claimBroadcastOnce`, which revalidates P5, the owner signature and
  stored bytes, checks portfolio pause/owner/revision under a row lock, and
  returns those bytes once. No broadcaster was installed. A crash after this
  claim remains unknown and cannot automatically claim again.
- P7.3 components: pure receipt classifier and read-only BSC RPC adapter
  distinguish missing receipt, nonce used elsewhere, included, finalized
  success/revert, replacement and reorg. The adapter checks chain 56, sender,
  transaction hash and canonical block. `recordChainObservation` stores the
  state while keeping reservations frozen until a separate balance check.
- P7.4/P7.5 components: pure sequential action requires a confirmed sell and
  a new portfolio revision before a buy plan; the partial-basket example
  leaves $25 in cash after $75 of confirmed buys. Exact-input balance-delta
  validation rejects insufficient output and unrelated token changes.
  `reconcileFinalizedLeg` requires finalized success/revert plus a pinned,
  trusted complete balance snapshot, then updates balances, reservations and
  portfolio revision in one transaction. Replaced/reorged legs remain frozen.
- Migration-review correction: a nullable SQL check could have accepted an
  included block without a hash under PostgreSQL three-valued logic. Made
  non-null presence explicit. Lesson: SQL `CHECK` accepts `UNKNOWN`, so
  nullable branches need explicit `IS NOT NULL` terms.
- Added seven passing pure/read-only named tests and one PostgreSQL integration
  suite. `./scripts/check.sh` passes 85 tests; three database suites are skipped
  because `TEST_DATABASE_URL` is unset and PostgreSQL binaries are unavailable.
  Typecheck, build and configuration pass. The new migration/store test has
  **not** run against PostgreSQL; P7 cannot be called complete.
- [ADR 0019](decisions/0019-eoa-persist-before-broadcast.md) records the
  persistence/recovery decision. Open: actual trusted full-wallet balance
  reader, external nonce/replacement resolution, crash/reorg database tests,
  manual recovery and a guarded broadcaster. P5.5 bStocks evidence still
  prevents live submission. No wallet transaction was sent.
- P7.3/P7.5 review correction: a previously reconciled final receipt can
  disappear in a deeper reorg, leaving recorded balances stale. The store now
  marks that leg reorged, pauses the portfolio, advances its revision and
  invalidates unsigned holds; repeated missing-receipt observations are
  idempotent. Added pure classifier and PostgreSQL regression assertions.
  The PostgreSQL assertions remain unrun locally. Lesson: finality depth
  reduces reorg risk but does not make reconciled state irreversible.

## 2026-09-29 — P7.2/P7.3 PostgreSQL verification attempt

- Agent/client: Codex. The owner supplied a disposable test database URL for
  the three PostgreSQL suites. No credential or full URL was written to
  project documentation or MCP memory.
- Baseline `./scripts/check.sh` with `TEST_DATABASE_URL` set ran 85 pure/read-
  only tests successfully, but the P3, P4 and P7 database suites all failed
  before connecting: `connect EPERM 127.0.0.1:5432`. This is a sandbox TCP
  permission failure, not evidence of an invalid password, unavailable server
  or broken migration. No application code was changed or database mutation
  reached the server.
- No local PostgreSQL Unix socket or PostgreSQL CLI is present. Docker CLI is
  installed, but this sandbox cannot access `/var/run/docker.sock`. The new
  P7 migration/store and deep-reorg assertions remain unverified on PostgreSQL.
  Run the same check from an environment allowed to connect to the test DB;
  retain the failing result as the current database-backed baseline here.
- After the owner reported the PostgreSQL container ready, a second
  `TEST_DATABASE_URL` check again passed 85 non-database tests and failed P3,
  P4 and P7 at the same `connect EPERM 127.0.0.1:5432` boundary. This confirms
  the ready container is insufficient for this sandbox's TCP permission; no
  database assertion or migration was reached on the retry.
- P7.2/P7.3 host-side verification correction: the owner exported the test
  database URL and reports that `./scripts/check.sh` passed on the host. This
  indicates the host can reach the ready PostgreSQL container and reportedly
  ran the P3/P4/P7 suites. The agent repeated the check with the numeric
  localhost address and again saw 85 non-database passes plus three `EPERM`
  connection failures before authentication. The fix is to run the database
  check in the host environment, not to change application code. No host test
  output was captured in this workspace, so record that result as owner-
  reported rather than independently verified here. No credential was logged.

## 2026-09-29 — P7.2 PostgreSQL validation status corrected

- Agent/client: Codex. The owner clarified that the host-side
  `TEST_DATABASE_URL ./scripts/check.sh` run passed **101 tests**, explicitly
  including “P7 PostgreSQL persists signed EOA bytes before a one-time
  broadcast claim.” This is concrete host test evidence for migration 0003
  and the current signed-leg store suite; the P7 database test gate is passed.
- Reporting bug: earlier current-state wording treated the agent sandbox's
  `EPERM` as if the PostgreSQL test had not run anywhere. Cause: conflating
  restricted agent execution with the owner's host check. Corrected the
  implementation plan, project state, EOA specification and ADR 0019 to
  distinguish host verification from this sandbox's network restriction.
  Historical failed sandbox attempts remain logged as observed.
- Regression verification: before the documentation correction, the agent's
  no-database `./scripts/check.sh` passed 85 tests with three PostgreSQL
  suites skipped, plus typecheck, build and configuration. The owner reports
  the full host run passed 101 tests. The host output was not captured in
  this sandbox, and no database connection was retried here because the
  sandbox restriction is already established. No application code changed.
- Lesson: report test results with their execution environment. A sandbox
  connection failure cannot negate a successful host integration run. P7
  remains open for trusted chain balances, replacement resolution, broader
  crash/reorg coverage, manual recovery and guarded broadcast.

## 2026-09-29 — P7.2 direct PostgreSQL verification after network access

- Agent/client: Codex. The owner enabled workspace network access. With
  `TEST_DATABASE_URL` supplied only to the test process, Codex independently
  reran `./scripts/check.sh` against the local disposable PostgreSQL database.
  The check passed **101 tests, zero failures, zero skips**, including “P7
  PostgreSQL persists signed EOA bytes before a one-time broadcast claim.”
  Typecheck, build and Portable configuration checks passed. No credential was
  written to the repository, logs or shared memory.
- Corrected current-status documents from owner-reported/agent-blocked to
  directly verified P3/P4/P7 integration. The earlier `connect EPERM` attempts
  remain in the history as the network restriction that prompted this check;
  their cause was environmental. No application code or database schema was
  changed. P7.2's current migration/store suite is validated, while broader
  crash/reorg and production-adapter work remains open.
- Post-documentation `TEST_DATABASE_URL`-backed `./scripts/check.sh` again
  passed 101 tests with no failures or skips, plus typecheck, build and
  configuration checks.

## 2026-09-29 — P7.3/P7.5 chain-evidence adapters

- Agent/client: Codex. Baseline `TEST_DATABASE_URL`-backed
  `./scripts/check.sh` passed 101 tests, zero failures/skips, before edits.
  Read P7 specification, state, plan, ADR 0019 and recent logs; searched the
  supplementary Nexus MCP memory. Existing receipt/reconciliation interfaces
  and fail-closed unknown state were preserved.
- P7.5: added read-only `fetchBscTrackedBalances` for native BNB and the
  complete caller-supplied Nexus-tracked ERC20 set at one expected chain-56
  block/hash. It rejects invalid denomination/duplicate/missing native assets,
  chain mismatch, malformed/incomplete RPC responses and canonical block hash
  changes between state reads. Three named synthetic tests cover the success,
  reorg and rejection paths. This is a balance-evidence primitive, not a
  trusted full-wallet snapshot until the registry and recovery store supply and
  verify its inputs.
- Test correction: the first reorg test expected a changed header before the
  mock changed it, so the test failed although the adapter continued safely.
  Corrected the mock's reorg trigger; reran `npm test` with all non-database
  tests passing. Lesson: fail-closed tests must inject the fault at the precise
  read being asserted.
- P7.3: extended read-only `fetchEoaBscObservation` with an optional
  32-block canonical scan when the tracked receipt is missing and wallet nonce
  advanced. A mined same-wallet/same-nonce alternative requires a matching
  receipt and canonical block recheck. Incomplete coverage, malformed data and
  reorgs yield no observation; covered scans with no candidate remain unknown.
  Two named tests cover replacement detection and unresolved/fail-closed paths.
  Decision extends [ADR 0019](decisions/0019-eoa-persist-before-broadcast.md).
- Regression verification: database-backed `./scripts/check.sh` passed **106
  tests, zero failures, zero skips**, plus typecheck, build and configuration.
  No live broadcaster or wallet transaction was introduced. Remaining P7 gates:
  trusted complete asset-set and finalized-block store wiring, nonce history
  outside scan window, PostgreSQL crash/reorg coverage, reviewed manual repair,
  active policy/session integration and guarded broadcast. P5.5 separately
  blocks live bStocks execution.

## 2026-09-29 — P7.3/P7.5 persisted recovery hardening

- Agent/client: Codex. Baseline database-backed `./scripts/check.sh` passed
  106 tests, zero failures/skips. Read current P7 specification, state, plan,
  ADR 0019 and recent logs; searched supplementary MCP memory. Existing
  approval, one-time claim and receipt state interfaces remain compatible.
- P7.5 bug reproduction: `reconcileFinalizedLeg` accepted a later block than
  the stored receipt, and pure balance delta validation could omit an existing
  asset. Cause: a `>=` source-block condition and symmetric-difference logic
  that treated missing assets as zero. Corrected the store to require the
  receipt's exact block/hash and the validator to retain every previously
  tracked asset plus native gas. Added negative pure and PostgreSQL assertions.
  An initially failing assertion expected the old external-change error for
  an extra asset; it now correctly expects incomplete coverage. Rerun passed.
- P7.3/P7.5 new component: `loadRecoveryContext` reads immutable leg identity,
  revision, receipt state and tracked balances under the portfolio lock.
  `observeBscLeg` derives the RPC wallet/hash/nonce from that record and leaves
  state unchanged on unavailable evidence. `prepareBscBalanceEvidence`
  requires a server-side registry asset list matching persisted holdings plus
  output, rechecks receipt finality/canonicality around pinned balance reads,
  validates deltas and returns a candidate without updating balances. Three
  named synthetic tests cover identity binding, unavailable RPC, complete
  candidate and reorg rejection; the PostgreSQL suite checks the context.
- P7.2/P7.3 restart coverage: the PostgreSQL suite now restarts the store
  before the first claim, after claim with no receipt, after receipt observation
  and before reconciliation. Repeated claim and observation cannot duplicate
  submission or apply balances twice. It rejects a later-block snapshot,
  missing native balance and a second reconciliation. A deep reorg now prevents
  owner unpause until a separate repair path exists.
- Test correction: the new mock initially failed TypeScript narrowing when a
  callback assigned a nullable observation; an array capture made the observed
  call explicit. This was a test-only compile issue, corrected before full
  verification. Lesson: closure assignment is not treated as synchronous
  control-flow proof by strict TypeScript.
- PostgreSQL-backed `./scripts/check.sh` passed **109 tests, zero failures,
  zero skips**, plus typecheck, build and configuration. Candidate evidence is
  not yet automatically reconciled; receipt-effect verification, broader nonce
  history, manual repair, active policy/session wiring and guarded broadcast
  remain. No live wallet action occurred. See [ADR 0019](decisions/0019-eoa-persist-before-broadcast.md).
- Follow-up integration assertion: the real PostgreSQL signed-leg suite now
  feeds its persisted recovery context through mocked canonical BSC receipt and
  balance RPC calls, builds the validated candidate and reconciles that exact
  candidate once. The database-backed check still passes 109 tests with no
  skips. This tests the store-to-adapter boundary without claiming production
  source trust or receipt-effect completeness.

## 2026-09-29 — P7.5 receipt-effect proof and PostgreSQL recovery

- Agent/client: Codex. Baseline PostgreSQL-backed `./scripts/check.sh` passed
  109 tests, zero failures/skips, before edits. Read the active specification,
  state, plan, ADR 0019, recent logs and supplementary MCP memory. Reviewed
  the official ERC-20 `Transfer` requirement and JSON-RPC receipt/log fields.
  Existing signed-leg identity, one-time claim and canonical balance behavior
  remain compatible; reconciliation now requires additional proof.
- Added pure `verifyEoaReceiptEffects` and read-only
  `fetchBscReceiptEffectProof`. The adapter binds all logs, gas fields and
  receipt identity to the stored transaction and canonical block. The pure
  proof checks zero native transaction value, exact wallet-level input and
  output `Transfer` nets from the two token contracts, native gas equality,
  ordered/nonremoved log identity and a reverted receipt with no logs. Missing
  or inconsistent data fails closed. This is a reviewed standard-ERC20 path,
  not a generic token audit; [ADR 0020](decisions/0020-eoa-receipt-effect-proof.md)
  records the scope and its unsupported behaviors.
- P7.5 store/recovery wiring: `prepareBscBalanceEvidence` now collects and
  verifies the proof before returning a candidate. `reconcileBscLeg` drives
  the trusted read-only evidence and one PostgreSQL reconciliation. The store
  re-verifies effects against its locked signed leg and balances, atomically
  records a SHA-256 proof digest through migration 0004, and releases the
  reservation/advances revision once. It still freezes unknown or incomplete
  evidence and never broadcasts.
- Tests: added three named pure adversarial cases for valid effects, missing/
  spoofed/malformed/duplicate logs and reverted receipts. The PostgreSQL
  signed-leg suite now rejects altered proof and incomplete gas RPC without
  changing portfolio revision or submitted reservation, then reconciles the
  valid receipt once and checks the stored proof digest. An initial test compile
  failure came from an implicit callback type in the proof hash serializer;
  explicit string typing corrected it. This was a strict TypeScript compile
  failure, not a runtime receipt failure. The non-database test run passed
  after correction.
- Full PostgreSQL-backed `./scripts/check.sh` passed **112 tests, zero failures,
  zero skips**, plus typecheck, build and configuration. Production token event
  semantics, source/registry wiring, broader nonce recovery, manual repair,
  session/policy wiring and guarded broadcast remain open. No wallet action.

## 2026-09-29 — P8.1–P8.4 labelled fixture web workflow

- Agent/client: Codex. Read the blueprint navigation/review flow, P8 plan,
  project state, recent logs, ADR 0016/0017 and supplementary MCP memory.
  Baseline PostgreSQL-backed `./scripts/check.sh` passed **112 tests**, no
  failures or skips. Existing headless interfaces and the no-live-trade boundary
  were identified as compatibility requirements.
- P8.1: added a separate Next.js 16.3.7/React 19.3.0 App Router under `web/`.
  The shell has keyboard-reachable five-surface navigation and read-only
  EIP-1193 discovery through `eth_accounts`/`eth_chainId`. Wallet account data
  is transient; no connection request, signature or transaction call exists.
  `scripts/check.sh` now includes `next build web`.
- P8.2: added an Overview and editable two-leg fixture basket. The isolated
  local model validates exact-cent contribution/reserve, whole-percent weights
  summing to 100, schedule and per-leg cap. It renders intended versus accepted
  amounts and unallocated cash. This is an illustrative UX model, not a P6
  compiled rule or P4 coordinator result.
- P8.3: Review exposes fixture bounds, price assumptions, source label,
  creation/15-minute expiry, reduction reason and an explicit local-only
  acknowledgement. Edits, pause and reload invalidate that acknowledgement.
  There is no EIP-712 or on-chain approval and no P5 quote/simulation.
- P8.4: Activity records a one-time `RECONCILED_FIXTURE` sample outcome, states
  that no chain reconciliation occurred, and exports a labelled JSON record.
  Settings offers browser-only pause/reset. The recovery explainer identifies
  the live P7 gap without offering a fake recovery control.
- Bug reproduction and correction: a $100 contribution with a $0.01 reserve
  and full accepted allocation initially displayed a $100.24 fixture spend
  ceiling because the 25-cent fee allowance was added outside the cash budget.
  Cause: fee allowance was constant regardless of reserve. It is now capped at
  the reserve; the regression assertion requires the ceiling to stay within
  contribution and checks the one-cent allowance. Lesson: even synthetic
  bounds must conserve the displayed cash budget.
- Dependency setup correction: the first `@types/react-dom` version requested
  did not exist on npm (`ETARGET`); the registry-reported 19.3.0 was installed.
  No application behavior changed during that failed install.
- Decision: [ADR 0021](decisions/0021-fixture-web-boundary.md) keeps browser
  fixture state separate from execution authority. [Specification 0007](specifications/0007-web-workflow.md)
  records the observable behavior and remaining production gates. Five named
  model tests cover cash/caps, validation, expiry/pause, one-time outcome and
  reload invalidation. An initial full PostgreSQL-backed check after the web
  build passed **117 tests, zero failures/skips** and built the Next.js page.
  Production HTTP smoke returned 200 with the fixture labels. The final
  PostgreSQL-backed `./scripts/check.sh` after the cash-bound correction passed
  **117 tests, zero failures, zero skips**, plus strict typecheck, headless
  build, Next.js build and repository configuration checks. `git diff --check`
  passed.
- P8.1–P8.4 browser verification: added Playwright 1.63.0 and three Chromium
  tests for the full local preview/approval/record/export/reload path, invalid
  input and pause, and mobile keyboard plus read-only wallet discovery. All
  three passed. The first run stayed on server-rendered HTML because the test
  used `127.0.0.1` while Next dev expected `localhost`; changing the test
  origin restored hydration. The next run found two ambiguous test locators
  (a receipt label also appeared in prose, and Next added its own alert).
  Exact/scoped locators corrected the tests; no application behavior changed.
  Lesson: browser tests must verify hydration and target a unique accessible
  control or explicit UI region. Wider accessibility review remains open.
  After adding Playwright, the PostgreSQL-backed `./scripts/check.sh` passed
  **117 tests, zero failures/skips**, with headless and Next.js builds.
  Desktop Overview/Plan screenshots were inspected for layout and fixture
  labelling; no visual correction was needed.

## 2026-09-30 — P6 durable rules and scheduling

- Agent/client: Codex. Read current state, P6/P8 specifications, blueprint,
  relevant ADRs and recent logs; searched supplementary MCP memory. Baseline
  PostgreSQL-backed check passed 117 tests, zero failures/skips.
- P6.1/P6.2: migration 0005 and `RuleStore` persist strict canonical drafts,
  immutable versions/content/review hashes, lifecycle changes, input evidence,
  evaluation batches and unique occurrence claims. Rule changes advance
  portfolio revision and invalidate held plans while refusing unresolved
  submitted execution. Activation binds the reviewed event revision separately
  from a transaction permission.
- P6.2/P6.3: `mapRuleProposals` converts ready canonical intents into P4
  proposals using explicit conservative server-supplied ratios. P4 gained an
  optional same-client transaction seam. Claims, decisions and reservations
  commit together; rollback and restarted/concurrent worker cases are tested.
- P6.4: company and named-allocation event controls suppress dependent buys.
  Changed/unavailable event revisions suspend reductions and freezes; freezes
  are reapplied, never consumed once. Persisted allocation ownership must fit
  confirmed balances and match revision before an allocation reduction.
  Whole-company quantities cannot substitute for a missing allocation tag.
- P6.2 bug: a weekly 23:30 Africa/Lagos rule with a two-hour window returned
  not-due at 01:00 the next day. Cause: scheduling examined only the current
  local calendar date. It now considers the preceding date, preserving its
  occurrence ID and rejecting the exact window expiry. A named regression
  test covers the boundary. Existing DST tests still pass.
- Store correction: event-revision mismatch initially preceded expiration,
  which could make an expired control suppress a buy. Expiration now takes
  precedence, verified by a PostgreSQL expired-control test.
- PostgreSQL-backed `./scripts/check.sh` passed 129 tests, zero failures/skips,
  plus strict typecheck and both builds. [ADR 0022](decisions/0022-durable-rule-occurrences.md)
  records atomic scheduling. Production valuation sources and allocation
  refresh after P7 reconciliation remain integration prerequisites; no trade.

## 2026-09-30 — P8 owner-authenticated saved workspace

- Agent/client: Codex. Resumed check passed 129 PostgreSQL-backed tests with
  no failures/skips. Saved-workspace backend increment passed 138 tests and
  both builds before the screen increment.
- P8.1: migration 0006, `SessionStore` and `WorkspaceService` add exact stored
  EOA sign-in challenges, five-minute expiry, serialized one-time consumption,
  one-hour revocable token-digest sessions and a per-wallet challenge limit.
  Authentication and owner-scoped reads/commands share a transaction. New
  portfolios reuse P3/P7, start paused and carry unverified zero balances.
- P8.2/P8.3: saved `/workspace` reads P3 balances/reservations, P6 rules,
  interpretations/review hashes, P4 decisions and evaluation batches. Basket
  and price forms save through the canonical compiler; activation requires
  the exact current version/hash and portfolio revision. Browser earnings
  creation is rejected until a trusted server event source supplies its
  reviewed revision. Browser-supplied valuations/signing envelopes are rejected.
- P8.4: P7 receipt display uses an explicit safe projection, excluding signed
  bytes/signatures/authorization nonces. Saved JSON and the existing P7
  server pause are connected; pause invalidates held plans. HttpOnly Strict
  cookies, exact-origin writes, no-store reads and a 16 KiB streamed body
  limit guard the HTTP boundary. Wallet account/chain changes clear the UI
  session. `/` remains the independent fixture walkthrough.
- P8 integration bug: `next build web` failed to resolve the headless modules'
  NodeNext `.js` specifiers to their `.ts` sources with default Turbopack.
  Preserved the headless import API and selected Next's supported Webpack
  command with extension aliases. The production build now compiles shared
  source modules, all four dynamic endpoints and both pages successfully.
  Browser/regression verification is pending below.
- [ADR 0023](decisions/0023-owner-authenticated-web-workspace.md) records the
  authentication boundary. Sign-in and rule activation confer no trade
  approval or issuer eligibility. No transaction was signed or broadcast.
- P8 build correction: the first combined screen check passed all 139 Node
  tests but failed Next's TypeScript step on required custom `Window` fields
  in the new browser harness. Explicit test-only `unknown` casts now describe
  those injected fields; this is not a baseline failure or a production cast.
- P8 session-race review: an in-flight record read could restore an old
  wallet's screen after an account change or logout. Added session generation
  checks, sign-in account/chain rechecks and ordering of automatic logout
  before a new sign-in. A browser regression will release an old read after
  account change and verify it cannot restore saved data.
- P8 browser findings: the first seven-test run passed four cases, including
  the original fixture tests and actual HTTP/session security, and failed
  three new cases. Decorative navigation numbers polluted accessible button
  names; marked the saved navigation numbers `aria-hidden`. The mobile
  harness matched Next's route announcer as a second alert; scoped it to the
  visible error banner. The delayed-read harness failed to match portfolio
  query strings; corrected its route pattern. These failures did not change
  or weaken backend assertions. Reverification follows below.
- P8 second browser run passed six of seven tests. The backend pause update
  succeeded (revision 4 and resumed state were visible), but the development
  page navigated/reloaded to Overview during the workflow. Added explicit
  non-submit button types and moved the browser suite to the production
  build/start server to verify shipped behavior without development reloads.
  This observation does not establish a backend pause failure.
- P8 production browser run exercised save, activation, P4 planning/export,
  server pause and reload successfully. Its final wallet-method assertion
  failed because the harness resets its method array on the intentional
  reload. Captured method history before reload, preserving the assertion
  that only message sign-in (no transaction/typed trade signature) occurs.
  Session clearing now also blocks future poll reads until a new sign-in,
  including the interval-cleanup gap after an account change.
- P8 amount correction: zero percent entered as `0.00` was treated differently
  from `0` by the form's exclusion filter. The shared parser now accepts zero
  at supported two-decimal precision; the form filters the parsed zero weight.
  A regression assertion preserves exact positive amounts and rejects excess
  precision. Final combined checks and production-browser run follow.
- P8.1–P8.4 final browser verification: all seven Chromium tests passed against
  the production build/start server with an isolated PostgreSQL schema. The
  saved rule becomes ACTIVE, a trusted synthetic P6 batch creates a real P4
  database decision/reservation, export retains fixture provenance, server
  pause releases the reservation and survives reload, and logout revokes
  access. The wallet call history includes `personal_sign` only, with no
  transaction or typed trade approval signature. Delayed reads cannot restore
  the old account. All three original fixture browser cases still pass.
- Updated phase outcomes/gates in PROJECT_LOG, implementation plan, state,
  changelog, specifications and ADRs; documented setup/runtime dependencies.
  Current policy makes `.git` read-only; no commit can be created here.
  Existing user/agent changes were preserved. Live P5.5/P7 gates remain open.

- Final post-browser PostgreSQL-backed `./scripts/check.sh`: **139 tests,
  139 passed, zero failed, zero skipped**; strict typecheck, headless build,
  production Next.js build and repository configuration checks passed.
  `git diff --check` passed. Only verification records changed afterward.
- Added durable, non-secret P6/P8 findings and verification to the shared
  `Nexus` MCP entity; retrieval confirmed the new observations. Repository
  documents remain authoritative; memory contains no credentials or wallet
  signatures/personal identifiers.

## 2026-09-30 — P5.5/P7 free-source preferences and eligibility clarification

- Agent/client: Codex. Read current plan/state, ADRs 0018/0023 and recent
  logs; searched shared memory. PostgreSQL-backed baseline passed 139 tests,
  zero failures/skips, typecheck and both builds.
- P5.5a/P5.5d/P7.3: owner supplied a public BSC RPC and requested free stock
  sources. Live read-only checks verified chain 56/current header but found
  historical native/contract calls fail `missing trie node` and log queries
  fail `limit exceeded`. PublicNode allowed logs/blocks but required a personal
  archive token for historical balances/contracts and the sampled receipt.
  No RPC/key purchase, intended wallet access, signature or transaction.
- P5.5a: pinned Chainlink NVDA/AAPL complete rounds were 959/1,186 seconds old;
  USDT was seven seconds old. Equity reads fail the existing 60-second limit.
  Preserved source timestamps and policy; no freshness relaxation or P5 pass.
- Probe correction: the fallback script's outer catch labelled a failed
  receipt call as a block failure after the block had succeeded. The saved
  report identifies the failing method as receipt, following the recorded
  call path. No application code behavior or recovery assertion changed.
- P5.5c: re-read the current official bStocks FAQ. Terms acceptance can record
  agreement/declarations; geographic enforcement and official country decisions
  remain expected. The FAQ invites integration contact but does not establish
  a universal bespoke-permission or KYC requirement in that section. No such
  blanket rule was added; no modal/self-declaration was promoted to eligibility.
- Added dated public-source evidence under integrations and updated portable
  preferences. Existing modules/interfaces and ADR 0018 gates remain intact.
  Historical RPC coverage, free-feed freshness/risk review, official eligibility
  source/schema and reviewed verification process remain open.

- Post-documentation `./scripts/check.sh` passed 139 tests, zero failures/skips,
  strict typecheck, headless/production web builds and configuration checks.
  `git diff --check` passed. Shared memory records the public, non-secret
  source constraints and dated limitations; no app code or gate policy changed.

## 2026-09-30 — P5.5c/P5.5e — Verification roadblock and provider research

- Agent/client: Codex. Read AGENTS, state/plan, recent logs/changelog, blueprint,
  Market Gate specification, ADRs 0010/0011/0012/0018 and the access runbook;
  searched Nexus shared memory. Baseline PostgreSQL-backed `./scripts/check.sh`
  passed 139 tests with zero failures/skips, typecheck, headless/web builds and
  configuration checks. Preserved existing uncommitted user/agent work.
- P5.5c: wrote `docs/verificaton-challenges.md` using the requested filename.
  Documented the issuer country/API/verification dependency, what is beyond
  Nexus's control and what remains implementable. Re-read bStocks official
  FAQ and searched issuer/developer documentation; no verified country endpoint
  URL/schema established. FAQ links the issuer integration channel. Issuer-site
  tool retrieval failed; this is not proof of a universal outage or rejection.
- P5.5c research: official xStocks partner guide places KYC at venue/platform
  level and geographic compliance on partners; its main site reserves partner
  review. Primary-market docs require KYC/AML and whitelisted wallets; CEX
  integration may use an already onboarded market maker, without proving the
  same process is approved for Nexus. Backed's Nigeria non-serviceable listing
  applies to issuer service/accounts and does not settle every secondary venue.
- P5.5c research: Ondo secondary-market docs impose acquisition representations
  and redemption KYC; official FAQ acknowledges holdings without issuer
  onboarding. Persona KYC/KYB, approved wallets and API keys belong to direct
  issuer access. Corrected the inference that direct-account requirements
  necessarily apply to every DEX buyer. No issuer-signed attestation can be
  replaced by Nexus's owner-signed declaration.
- P5.5e: preserved the 2026-09-27 survey's bStocks depth advantage and xStocks
  thin routes. Sunday market-hour failures limit Ondo comparison. Recommended
  regular-session secondary-route reassessment before a switch, explicitly
  labelled as an inference; no new liquidity measurements or wallet calls.
- Decision/compatibility: research only; ADR 0012/0018 remain in force. No new
  architectural decision, provider switch, gate relaxation, live registration,
  app-code/interface change, outreach, signature or transaction. Source/RPC,
  risk/mapping/event and P7 runtime/recovery gates are additional launch blockers.
  Updated plan/state/phase log/changelog for portable context.
- Lesson: technical transferability, issuer primary access, platform-level
  obligations and secondary-market eligibility are different. Assess exact
  provider/venue/activity before adding friction or declaring support the only
  dependency. Missing specifications are not permission to invent an allowed
  decision; a historical quote is not current executable liquidity.
- Post-documentation PostgreSQL-backed `./scripts/check.sh` passed **139 tests,
  139 passed, zero failed, zero skipped**, strict typecheck, headless/production
  web builds and repository configuration checks. `git diff --check` passed.
  Only documentation/verification records changed; no new application behavior
  was introduced. Current policy makes `.git` read-only; no commit created.

## 2026-09-30 — P5.5a/P5.5c/P5.5d/P5.5e — Ondo regular-session routes

- Agent/client: Codex. Read AGENTS, state/plan/specification, recent portable
  records and applicable source/provider/receipt ADRs; searched Nexus memory.
  PostgreSQL-backed baseline `./scripts/check.sh` passed 139 tests, zero
  failures/skips, strict typecheck, headless/production web builds and config
  checks. Preserve application behavior, provider priority and existing work.
- P5.5e discovery: scanned 458 current Ondo BSC inventory addresses via public
  indexed pool batches; found 45 distinct pools and 19 stable-paired assets.
  Selected 25 instruments, including absent blue chips. Binance status was
  open/regular for all sampled assets. Pinned per-asset factory/pair/fee/
  quantity/liquidity/settlement balance and four-size bidirectional quotes.
  Eighteen assets had positive direct output, including dust/exhausted pools;
  do not equate this count with usable liquidity or fair current prices.
- P5.5e quote correction: initial four-worker Kyber scan returned 53 previews
  and 47 HTTP 429 responses, limiting coverage. Paced RFQ-excluded four-size
  retries for NVDA/AAPL/TSLA/AMD returned 16/16 previews. Preserve throttling
  separately from no-liquidity failures. Current official API docs describe
  rate limits and the newer key-based gateway; no key/service purchase.
- P5.5e simulation: exact Pancake V3 NVDA fields matched the existing decoder.
  Synthetic read-only overrides verified exact USDT balance/allowance; an
  ephemeral observer read settlement and stock balances around the router
  call. All four sizes spent full input and delivered the quoted net NVDA.
  The 5-USDT minimum/deadline negative checks reverted as expected. The
  10,000-USDT quote is severely mispriced despite full input consumption.
  These are conditional calls, not intended-wallet eligibility or P7 receipts.
- Probe bug reproduction/correction: AAPL's plain router call succeeded but
  the initial ten-million-gas observer reverted empty. The quoter estimated
  about 24.6 million gas. Raising the diagnostic cap to fifty million enabled
  effects inspection; a fresh same-block comparison reproduced failure at
  ten million and success at fifty million. The initial observer error is
  labelled separately from plain-router success in the saved evidence. No
  production gas policy changed and no application behavior bug was inferred.
- P5.5e lesson: AAPL's exact-input router returned dust while consuming only
  about 0.0007057 USDT for every requested size; a successful return/minimum
  check is not proof of full-size consumption. Reverse depth screens use the
  original block, not post-buy state, and are not realizable round trips.
  P7's actual effects and P5's full-size price checks remain necessary.
- P5.5e intermediary review: small AAPL/TSLA previews traversed CAKE and an
  unreviewed token whose symbol is `比特币`; larger NVDA previews included
  NVDAB. Endpoint issuer labels do not establish every intermediary's safety
  or access requirements. V4/Infinity/split/Kyber paths are previews only;
  no encoded-data simulation or new application decoder was implemented.
- P5.5a/P5.5d: regular-session NVDA/AAPL complete Chainlink rounds were about
  130/134 minutes old in the effects probe, failing the retained 60-second
  gate. Ratios were positive/unpaused with no pending scheduled mapping for
  those two tokens; this does not close risk/event review. Binance audits
  returned unsupported/no result for NVDAon/AAPLon/AMDon; no clear-risk flag.
- P7 source lesson: a short-aged pinned replay at block 124939148 failed
  `missing trie node` on the supplied dataseed. Fresh paired gas probes worked.
  Immediate current-state simulation support is not historical recovery
  coverage. No recovery/source gate was closed.
- P5.5c decision: these direct secondary paths used no issuer mint/RFQ API;
  this supports the primary/secondary distinction but cannot establish
  jurisdiction/platform/user permission. Ondo remains a candidate to qualify,
  initially at small NVDA sizes. ADRs 0012/0018 remain authoritative; no new
  provider pivot, eligibility exception, price-age relaxation, application
  registration, signing, transaction or outreach. CLI returned UNCONNECTED;
  no connected-wallet quote is claimed and no user wallet was requested.
- Added the dated research report and public structured evidence; updated
  verification challenges, implementation plan, state and phase/changelog
  records. No application interface changes or production gate closures.
- Post-documentation PostgreSQL-backed `./scripts/check.sh` passed **139 tests,
  139 passed, zero failed, zero skipped**, strict typecheck, headless/production
  web builds and config checks. Structured evidence parses and independent
  assertions match discovery counts, four-size net effects, paired gas control
  and all 16 retry previews; reconstructed calldata matches saved hashes.
  `git diff --check` passed. Durable non-secret findings were written to Nexus
  shared memory. No commit is possible under the current read-only `.git` policy.

## 2026-09-30 — P7.3/P7.5 — Chainlist historical RPC survey

- Agent/client: Codex. Read AGENTS/state/plan, recent portable records, P7
  specification and ADRs 0019/0020; searched shared memory for historical
  source failures. Baseline PostgreSQL-backed `./scripts/check.sh` passed
  139 tests, zero failures/skips, strict typecheck, headless/production web
  builds and configuration checks. Preserve all existing uncommitted work.
- Discovery: requested Chainlist page succeeded via direct HTTPS while the
  browsing tool timed out; used its officially documented `rpcs.json` feed.
  Chain 56 contained 58 entries. Excluded 13 WebSocket/credential-shaped/query
  URLs; screened 45 distinct anonymous HTTPS endpoints. No public demo keys,
  credentials, accounts or intended wallet access. Five endpoints returned
  historical native and real ERC20 balances at a prior-day block.
- Deep checks: pinned blocks 124938263, 124743263 and 40000000, including
  June 2024. Read nonzero WBNB native backing, USDT/WBNB public pool balances
  and historical nonce; canonical block numbers/hashes matched. Varied old
  balances matched across four endpoints, avoiding constant-zero/latest-only
  interpretations. Full transaction blocks, two sampled receipts, gas and
  complete logs were checked. Only public contract balances, transaction
  hashes, counts/digests and method outcomes are retained; public transaction
  sender was transient input for identity verification, never stored.
- Invoked unchanged `fetchBscTrackedBalances`, `fetchBscReceiptEffectProof`
  and `fetchEoaBscObservation` against live endpoints with their normal
  five-second request limits. Sentio, Blockmachine and thirdweb passed all
  sampled core/extended reads; Blast passed core readers but standalone
  log queries were rate-limited. Swiftnodes had deep `header not found`
  errors and returned no snapshot/proof in some reader calls. Do not equate
  standalone `eth_getLogs` with receipt-log availability: current P7 reads
  transaction receipt logs. No approved Nexus leg/effect reconciliation exists
  for these unrelated public sample transactions.
- Probe failure/correction: hardcoded Blast reference-log discovery aborted
  on the provider's rate-limit response before deeper results were written.
  Used Sentio for research discovery and paced calls, then repeated the full
  candidate matrix. No application baseline failure or code bug resulted.
  Network/registration/rate-limit failures are kept separate from missing
  historical state and are not universal provider-capability judgments.
- P7 source replay: Sentio and Blockmachine both passed the existing tracked-
  balance adapter at Ondo block 124939148 (earlier dataseed `missing trie node`)
  and NVDAB route block 124347223. Canonical hashes and nonzero settlement/stock
  balances matched. Normalized receipt/log digests and three-date state values
  also matched across the successful endpoints. Matching gateways alone do
  not prove independent upstreams or production availability.
- Decision/scope: prefer Sentio as the next historical recovery-source
  candidate, Blockmachine as backup. Record capability without installing a
  production default/failover or altering ADRs 0019/0020. No new architectural
  decision or application behavior change. Runtime/registry/source-limit
  qualification, nonce/manual repair, crash/reorg and P5.5 gates remain open;
  no user wallet request, signature, allowance, trade or outreach.
- Added dated report/structured evidence, linked the original source report
  without rewriting its dated failures, and updated plan/state/phase/changelog
  records. Evidence assertions verify counts, core versus extended outcomes,
  candidate consistency and four successful stock replays. Post-documentation
  PostgreSQL-backed `./scripts/check.sh` passed **139 tests, 139 passed, zero
  failed, zero skipped**, strict typecheck, headless/production web builds
  and config checks; `git diff --check` passed. Stored evidence assertions also
  require nonzero historical backing/token balances and stock replays. Durable
  non-secret findings were written to Nexus memory. Current `.git` policy
  is read-only; no commit was created.

## 2026-09-30 — P7.3/P7.5 production recovery wiring

- Preparation: read project state, P7 specification, implementation plan,
  recent logs and ADRs 0019/0020/0023; verified relevant shared-memory context
  against repository records. PostgreSQL-backed baseline `./scripts/check.sh`
  passed 139 tests with zero failures/skips, strict typecheck, both builds and
  configuration checks. Preserve all pre-existing uncommitted changes.
- P7.3 component: strict operator-owned configuration binds registry version,
  positive finality depth, unique named public HTTPS sources and exact reviewed
  chain-56 asset IDs/decimals/event semantics. Frozen parsed records prevent
  mutation during a run. Source endpoint digests, not potentially sensitive
  URLs, enter durable configuration snapshots. Native gas only is enabled in
  the supplied registry: stock/other ERC20 reviews remain an explicit gate.
- P7.3/P7.5 component: `runBscRecoveryOnce` and `recovery:once` CLI discover
  persisted legs, including settled receipts for later reorg monitoring. Use
  Sentio first and Blockmachine on unavailable complete evidence, collecting
  every balance/receipt-proof candidate from one endpoint. Never mix source
  logs/balances or seek a favorable alternative after invalid economic proof.
  No signer, broadcast claim or submission port. Batch rotation retains crash
  attempts and bounds one invocation; deployment scheduling remains operator work.
- P7.5 concurrency/restart decision: portfolio session advisory ownership and
  every store transaction use the same PostgreSQL connection. This avoids
  holding a lock on one connection while writing after its ownership is lost,
  and avoids consuming an additional pool connection for each store operation.
  Transactions remain short and do not span RPC calls. Lost connections cannot
  commit later fills. Existing transactional store APIs remain compatible.
  Significant design recorded in ADR 0024.
- P7.3 durable evidence: migration 0007 adds attempts and observation/fill
  provenance. Configuration snapshot/hash binds source IDs, endpoint digests,
  finality and reviewed registry. Observation/fill evidence records source,
  block/hash and receipt-proof/amount data in the same transaction as the state
  transition. Forged/finished/wrong-source attempt bindings reject and roll
  back a valid observation or fill. Attempts never store signed bytes or keys.
- P7.5 reproduced gap/correction: after a canonical receipt was stored but
  before reconciliation, an unavailable primary archive view followed by a
  different backup canonical hash classified the leg reorged without pausing
  its portfolio. Reproduced with divergent receipt hashes and a held submitted
  reservation. Cause: the pause branch previously covered reconciled legs only.
  Correction: unreconciled reorg transitions now pause, advance one revision
  and invalidate unsigned holds transactionally. Regression case proves no
  fill occurs and submitted funds stay frozen; existing deep-reorg tests pass.
- P7.5 tests: real isolated PostgreSQL migrations/replay, restarted inclusion
  before fill, whole-proof fallback, once-only successful/reverted settlement,
  unsupported registry/mismatched proof, all-source outage, consumed nonce
  ambiguity, forged provenance rollback, concurrent ownership, conflicting
  fallback receipt and deep-reorg pause. Terminate only the isolated test's
  exact advisory-lock backend to prove loss before apply prevents writes;
  a fresh worker resumes once. A database failure at attempt completion after
  a committed fill proves restart monitors without counting another fill.
- Test iteration: strict compilation initially rejected one unused imported
  type in the new suite; removed it and reran. This was a new test compilation
  issue, not a baseline failure. Final `npm test` passed 147 tests, zero failures/
  skips. Invalid proof is evidence to retain, not a reason to weaken checks.
- P7.3 live smoke: configured Sentio/Blockmachine served nonzero public-pool
  historical USDT/WBNB balances, complete receipt proof and canonical
  observations at block 40000000 (June 2024) through unchanged P7 readers.
  Balance/proof digests matched. Dated structured evidence is in
  `docs/integrations/2026-09-30-recovery-wiring.json`. An unrelated public
  receipt does not prove a Nexus approved mainnet fill or stock semantics;
  public sender identity was used transiently, never stored in the report.
- Portability: documented operator setup, registry review, outcome/exit codes,
  frozen nonce/reorg diagnosis and remaining gates in the runbook; updated
  specification, plan, state, README, phase log and changelog. Check script
  requires the runtime/config/migration/ADR/runbook and parses config JSON.
  P5.5, stock semantics/source retention, nonce history/manual repair, active
  execution policy/session, deployment scheduling and broadcaster remain open.
  Current `.git` policy is read-only; no commit was created.
- Final verification: PostgreSQL-backed `./scripts/check.sh` passed **147 tests,
  147 passed, zero failures/skips**, strict typecheck, headless and production
  web builds and configuration checks. The production CLI also ran against a
  separately migrated isolated empty schema, emitted `[]` and exited 0; no
  production database was used. `git diff --check` passed. Three durable
  non-secret findings were written to Nexus memory and retrieved successfully.
- Verification tooling corrections: the temporary CLI-smoke script initially
  imported pg's raw CommonJS file using a named ESM import; use its default
  export instead. The application imports pg through its package entry and
  was unaffected. Initial memory write used the old observation field name;
  corrected to `contents` and verified all three new observations. Neither
  failure altered application/database state.

## 2026-09-30 — P7.3/P7.5 USDT/NVDAB raw recovery review and registry

- Preparation: read AGENTS, state, P7 specification, plan, recent logs and ADRs
  0013/0014/0020/0024; searched shared Nexus memory and checked facts against
  versioned records. PostgreSQL-backed baseline full `./scripts/check.sh`
  passed 147 tests, zero failures/skips, strict typecheck and both builds.
  Preserve existing uncommitted work; keep P5 gate/provider priority compatible.
- P7.3 source review: current NVDAB discovery still identified SecuritiesToken
  implementation `0xcfed6c4679297ea4889f8183bc057b4a86c64e46`. Retrieved Sourcify
  source/compiler/runtime metadata for USDT, NVDAB proxy and implementation.
  USDT runtime label is match with only a CBOR metadata replacement at byte
  4361; executable prefix matched recompilation. NVDAB proxy/implementation
  were exact runtime matches, including constructor-bound immutable beacon.
  Runtime hashes on both sources matched the verified on-chain bytecode.
  Retain source digests and accounting conclusions in the dated report/JSON.
- P7.3 accounting decision: reviewed USDT raw balance subtraction/addition and
  mint/burn Transfer paths; NVDAB static compliance/pause checks precede inherited
  OpenZeppelin raw balance updates. ERC8056 emits a separate TransferWithUIAmount
  after standard Transfer. Display multiplier scheduling does not rewrite raw
  balances. Count standard Transfer once, ignoring UI events/multiplier notices
  and zero UI overflow sentinels. ADR 0025 binds this recovery-only decision.
- P7.3 empirical evidence: sampled public buy/sell receipts at blocks 124963262
  and 124963239 from the exact direct NVDAB/USDT pool. Both sources verified
  canonical success and matching stock raw/UI event pairs (two on buy, one on
  sell). For each token/block, public pool before/after raw balances equalled
  the net of every pool Transfer event in that block, accounting for other
  same-block activity rather than attributing all of it to one sample receipt.
  Six runtime/source identity checks and four source/block accounting samples
  passed. No user wallet address, signed bytes, state override or broadcast.
- Probe corrections/lessons: a Uniswap five-field Swap topic initially returned
  zero events; bounded unfiltered discovery found Pancake V3's seven-field
  event, and both samples' exact topics were verified. Do not infer thin
  activity from a wrong event ABI. Sentio rejected a 99,968-block log range
  with an explicit 10,000 cap; corrected to a compliant range (2,547 pool logs,
  2,540 swap-shaped events). These research log queries are not a production
  recovery dependency; existing receipt readers remain authoritative.
- Source limitation: Sourcify beacon lookup returned 404, explorer 403, and
  content-addressed metadata gateway attempts yielded rate-limit/network/404
  errors. The beacon bytecode/getter is pinned, without claiming a full
  upgrade/control audit. Receipt-block end state cannot reconstruct every
  intra-block code transition. P5 risk/eligibility/economic mapping remains
  independent; this review must not label the unsupported NVDAB audit clear.
- P7.3 new component: `recovery-contracts.ts` checks chain 56, canonical receipt
  block, exact token code/18 raw decimals and NVDAB proxy/beacon/implementation
  identity/code. Resolve the implementation using the proxy caller, bind the
  immutable-beacon runtime and check the unused direct-implementation slot.
  Config contract reviews are deeply frozen and included in existing durable
  attempt hashes/snapshots. Optional new fields preserve previous fixture APIs.
- P7.5 runtime integration: production worker validates the complete tracked/
  output asset set's code pins before balances and again after receipt proof.
  Definite code changes require review without fallback to a favorable source;
  missing/malformed/noncanonical evidence yields no candidate and can retry
  the entire proof on backup. Registry revision now includes native BNB,
  exact USDT and NVDAB only; unknown assets still block. No P5 live instrument,
  trading permission, execution policy, migration or new dependency enabled.
- P7.5 failure-reason refinement: during guard review, a simultaneous code
  mismatch and changed block could be mislabeled a definite upgrade before
  the final header check. Reproduced with changed runtime bytes and canonical
  hash; recheck canonicality before treating a mismatch as definite. A reorg/
  missing recheck now remains unavailable, with a regression assertion. No
  ledger mutation or unsafe acceptance occurs in either outcome.
- Tests: runtime/decimals/proxy/beacon/implementation changes, wrong chain,
  unavailable/malformed/reorged RPC, config/evidence binding, unknown/wrong
  denominations, UI duplicate/overflow/notice behavior and missing raw logs.
  Real PostgreSQL uses exact USDT/NVDAB identities with explicit synthetic
  bytecode pins/P5 evidence; proves changed implementation or late code change
  keeps reservation submitted, complete-source fallback settles once, and
  restart monitors. Existing fixtures remain unchanged. Latest `npm test`
  passed 154 tests with zero failures/skips before the final refinement.
- Live verification: new application guard passed four source/receipt-block
  checks using actual deployment hashes and normal five-second timeouts. This
  is distinct from synthetic PostgreSQL fills; no approved Nexus mainnet fill
  is claimed. Stored evidence contains only public contract/transaction data.
- Portability: added ADR 0025 and dated source/receipt report with JSON evidence;
  updated registry, runbook, P7 specification, README, plan/state and logs.
  Added required runtime/review artifacts to the check script. `.git` remains
  read-only under workspace policy; no commit created.
- Final verification: PostgreSQL-backed `./scripts/check.sh` passed **154 tests,
  154 passed, zero failures/skips**, strict typecheck, headless/production web
  builds and configuration checks. Stored evidence assertions verified source
  counts, every block accounting equality, cross-source sample consistency and
  all four actual-code guard checks. `git diff --check` passed. Three durable
  non-secret findings were added to Nexus memory and retrieved successfully.

## 2026-09-30 — P5.5d/P7.1 full-token security enforcement

- Requirement/baseline: owner requested full-token security immediately. Read
  state, plan, specifications, risk/control ADRs and recent logs; retrieved Nexus
  memory as supplementary context. Baseline PostgreSQL-backed `./scripts/check.sh`
  passed 154 tests, zero failures/skips, typecheck and both builds. Existing
  uncommitted work was preserved. Accounting recovery and provider/access gates
  must remain compatible; this request authorizes implementation, not trading
  or an unsupported-token risk exception.
- Components: introduced `src/security/token-security.ts` for separate strict
  Binance/GoPlus normalization, source/control/authority fingerprints, trusted
  24-hour review parsing, aggregate reasons/hashes and bundle revalidation.
  Unsupported Binance flags suppress unreliable embedded risks; omitted GoPlus
  checks remain unknown. Initial policy blocks any tax, warning, above-low score
  or alert. Both supported scanners, full source closure and qualified review
  are required. The versioned review registry is empty, with no exception state.
- Integration: added read-only `bsc-token-security.ts`, inspection CLI and
  `security:tokens` command; exactly USDT/NVDAB profiles. P5 requires exact stock
  AND settlement reports at the same quantity block/hash and raw decimals,
  recomputes assessment/hash, and includes reports in existing P7 approval hash.
  Optional adapter port preserves source compatibility but missing reports now
  deny `TOKEN_SECURITY_BLOCKED`. Trusted synthetic reports were added to existing
  fixtures, including PostgreSQL actual-token-identity recovery tests; they do
  not attest to real token safety. Submitted recovery is unchanged.
- Control/authority work: pin token/beacon/implementation/manager code and all
  current roles/switches/pointers/mapping. Added privileged account runtime pins;
  contract/delegated accounts remain unresolved until their governance has a
  verified adapter. Exact NVDAB cannot use the simpler runtime-owner profile.
  Source matching requires deployed bytecode plus source/compiler records for
  every execution component. Verification alone cannot clear an audit.
- Reorg/caller bug: inspection identified that old quantity/transfer readers
  accepted number/timestamp without a canonical hash or final recheck. A changed
  hash at the same height could mix controls. Corrected with EIP-1898 canonical
  state reads, shared `sourceBlockHash` and end-of-read checks. Beacon resolution
  now supplies the token proxy as caller. New quantity and transfer regressions
  reject wrong initial hashes and a reorg after reads, and inspect canonical
  references/proxy caller. Existing valid preflight/mapping cases pass.
- Development checks: initial typechecks found optional-adapter `undefined`
  under exact optional types and test metadata/readonly fixture mismatches;
  corrected with null normalization and proper immutable fixture/approval
  shapes. First full PostgreSQL check passed 167 tests; the expanded authority
  and quantity increment passed 169 tests, zero failures/skips and both builds.
- Live clock bug: initial collector runs sometimes returned unavailable
  observations although direct public RPC probes succeeded. Cause: the default
  clock was captured before sequential head retrieval; a new block mined during
  that wait appeared future-dated. Evaluate default time after header receipt;
  explicitly supplied clocks remain deterministic. A regression delays header
  retrieval across a second boundary. Temporarily restoring the old clock in
  ignored compiled output reproduced the assertion failure; restoring the
  corrected output passes. No source/user work was reverted.
- Empirical checks: Sentio and Blockmachine now return complete shared-block
  USDT/NVDAB observations at blocks 124974058/124974062. Their full fingerprints
  match. EIP-1898 code/call/storage support also passed on BNB Chain's public
  RPC. USDT has 1/1 verified source, supported Binance MID/3/mint caution and
  GoPlus mint flag. NVDAB has 4/5 verified execution sources, missing beacon
  source, unsupported Binance audit and omitted GoPlus proxy fields plus a
  shared-creator warning (not proof NVDAB is a honeypot). Nine privileged stock
  accounts were inspected; two have contract code with unresolved governance.
  Both current tokens remain blocked. CLI exit 2 is expected findings, not a
  failed inspection. Only public contract/control data was collected.
- Portability/decision: ADR 0026, specification 0008, security runbook and dated
  MD/JSON report record policy, evidence and remaining gaps. Updated state,
  implementation plan, P5/P7 specifications, README, environment examples and
  check-required artifacts. Lesson: a supported scan, source match or zero tax
  cannot stand in for full coverage/current control review; both trade tokens
  and delegated privilege paths matter. `.git` remains read-only by workspace
  policy, so no commit was created; no permission escalation was requested.
- Regression verification: focused no-database test run passed 129 tests,
  skipped 13 PostgreSQL suites as expected, zero failures. Full PostgreSQL-backed
  final `./scripts/check.sh` passed **171 tests, 171 passed, zero failures/skips**,
  strict typecheck, headless/production web builds and config checks. Baseline
  154 → final 171 adds 17 security/canonical/approval regressions.
- Compatibility refinement: security clocks accept the same explicit UTC or
  numeric-offset ISO timestamps as the existing Market Gate. Added an equivalent
  `+01:00` clock assertion to the full-token assessment test; no stricter timezone
  interpretation is imposed on existing gate requests. Final full check rerun
  verifies this last refinement. `git diff --check` passed; three non-secret
  security findings were written to and retrieved from shared Nexus memory.

## 2026-10-01 — P5.5d public source recovery and governance inspection

- Scope: recover the NVDAB beacon source and inspect the two privileged contracts;
  preserve current trading/security/recovery behavior and empty risk-review registry.
  Read project state, plan, recent logs and ADRs 0010/0013/0025/0026 plus security
  specification; retrieved relevant shared Nexus memory.
- Pre-existing baseline failure: PostgreSQL-backed `./scripts/check.sh` returned
  129 passed / 13 failed because every database suite encountered ECONNREFUSED
  at 127.0.0.1:5432. Local PostgreSQL binaries are absent; Docker socket access is
  denied by OS permissions and noninteractive sudo requires a password. These
  infrastructure failures preceded all repository edits and are unrelated to
  this research. Database-free baseline `./scripts/check.sh` passed 129 tests,
  zero failures, 13 database suites skipped, typecheck and both builds.

- P5.5d source recovery: Sourcify beacon record unavailable, explorer HTTP 403,
  IPFS gateway 429/payment/timeouts. Downloaded official OpenZeppelin v5.2.0 MIT
  source; isolated solc 0.8.24/0.8.4 under /tmp, preserving project dependencies.
  Initial beacon compile matched all executable bytes but not metadata. Reused
  published token-proxy compiler layout: Cancun, optimizer 200, viaIR=false,
  lib/openzeppelin-contracts paths/remappings and IPFS metadata. Final beacon
  rebuild matches all 644 deployed bytes and metadata. Preserved standard input,
  license and result hashes; no remote verification submission or paid service.
- P5.5d governance: decoded both transparent proxies' EIP-1967 implementation/
  administrator slots. Resolved OperatorWallet and BurnWallet. Fresh Sourcify
  source rebuilt all five scoped runtimes: beacon and OperatorWallet exact;
  both wrappers and BurnWallet executable-only, metadata differs. Compared
  observed bytecode before compiling. Remote personal absolute developer paths
  remain transient; stored results retain source URLs, input digests, sanitized
  labels/layouts and runtime hashes without those paths or personal data.
- P5.5d permission/state evidence: source-derived owner/operator/private storage
  agrees with getters; initialized flags set, pending owners empty, operator
  wallet unpaused, two hot wallets. Confirmed stock beacon and both wallet issuer
  memberships. Sentio and Blast agree at canonical block 125081086 / recorded
  2026-10-01T10:02:41Z on the full observation. Each runs 12 ephemeral eth_call
  probes: five authorized successes, seven execution reverts, including proxy
  admin fallback rejection. No signing, persistent upgrade, mint/burn spending,
  broadcast or user-wallet query. This is dated research, not fresh trade evidence.
- P5.5d research components: added read-only inspection/source rebuild scripts,
  full public JSON, dated report and reproduction README. Inspector bounds
  anonymous request load/read retries, pins one canonical hash, checks storage/
  getters/roles, rejects partial/mismatched proofs and rechecks the block header.
  Boolean-returning permission probes must return true; transport/internal RPC
  errors cannot masquerade as authorization denial. Compiler verification keeps
  exact matches distinct from executable-only metadata differences.
- P5.5d troubleshooting: reproduced HTTP 429 and Node connection timeouts;
  increasing the network-family connection-attempt timeout to 2000 ms restored
  sampled transport. Added bounded whole-body read retries with backoff and source/
  method diagnostics to the research script. BNB returned missing trie node;
  Blockmachine passed a code probe but later lacked same-block storage state.
  Replayed the initial observation block and used Blast for a complete comparison;
  recovery application/configuration unchanged. Lesson: chain-ID/code/interface
  success does not prove complete archival state; never mix partial providers or
  convert unavailable state into a successful negative permission test.
- P5.5d/P7.1 decision/lesson: ADR 0027 separates source correspondence from
  independent review and risk acceptance. Owner/admin single-address upgrade
  powers have no verified on-chain timelock/threshold in these paths; off-chain
  MPC/key identity is unknown. Outer proxy hashes alone cannot detect inner logic
  upgrades. Production source/governance adapter work, scanner gaps, qualified
  reviews and policy acceptance remain gates. Preserved the empty review registry
  and application/security/recovery interfaces; no risk exception or live enablement.
- Empirical verification: two canonical snapshots match; 24 caller-specific
  probe outcomes match expectations. Five source rebuilds pass executable byte
  comparisons; beacon and OperatorWallet also pass full metadata comparison.
  Stored compiled/deployed Keccak hashes, block bindings and privacy assertions
  pass. Both new scripts pass node --check. Final repository check follows below.
- Regression coverage: added three offline research tests for unavailable state/
  rate-limit errors being rejected as denials, false inner execution being rejected
  despite successful outer eth_call, malformed return data, unexpected outsider
  success, and unsafe endpoint/invalid replay block rejection. The final validator
  also accepts all 24 captured real expected permission outcomes. Required research
  artifacts and the three tests are included in ./scripts/check.sh; no network or
  extra compiler dependency is required for normal repository checks.
- Check-run correction/lesson: expanded check.sh required-files while a check
  process was still executing. Tests/typecheck/builds passed, then that process
  reached a stale file offset and reported unexpected ')' at the end. bash -n
  passes on the completed file; rerun after stabilizing all script edits. This was
  an agent workflow error, not an application regression. Do not edit a running
  shell check script; validate its final syntax and rerun the complete check.
- Supplementary memory: three non-secret dated findings saved to Nexus and
  retrieved successfully; versioned evidence remains authoritative.
- Final stable-file verification: database-free ./scripts/check.sh passed
  129 application tests (zero failures, 13 PostgreSQL suites skipped), three
  research regressions (zero failures/skips), strict typecheck, headless and
  production web builds plus configuration/artifact checks. Full PostgreSQL
  verification is unavailable because the baseline database refuses connections;
  no current 171-test PostgreSQL success is claimed. node --check, bash -n,
  stored source/hash/block/privacy assertions, all 24 real permission-result
  assertions, git diff --check and supplementary memory retrieval passed.


## 2026-10-01 — P5.5d/P7.1 integrate recovered source, governance and review evidence

- Scope: production read-only security source/governance integration, explicit
  scanner field/category coverage and authenticated independent-report intake.
  Preserve Market Gate/EOA/recovery interfaces and strict risk blocking; no live
  asset, risk exception, signing, transaction or issuer-contact authorization.
  Read current state, plan, logs, security specification and ADRs 0010/0026/0027;
  searched shared Nexus memory and read query-token-audit skill.
- Baseline: supplied isolated PostgreSQL is reachable again. Full
  ./scripts/check.sh passed 171 application tests plus three research tests,
  zero failures/skips, strict typecheck and both builds. This supersedes the
  prior task's unavailable-database result; do not relabel that historical result.
- Public independent-review discovery: EtherAuthority publishes a BSC-USD/USDT
  report dated 2025-04-03 naming the exact settlement contract. Inspect its source
  identity/scope and findings before treating it as qualified current review.
  Binance FAQ claims bStocks independent audits but does not expose a matching
  audit artifact in the inspected page; issuer statement alone is insufficient.
  bstocks.finance could not resolve; unrelated scanner/score pages are not
  independent full-scope audit reports. No claim that no audit exists.

- P5.5d source integration: added immutable full-runtime/address certificates for
  five locally reproduced governance sources, binding preserved report/compiler/
  input/executable hashes and exact-vs-metadata correspondence. Other identities
  retain strict Sourcify matching; no production compiler or arbitrary source pins.
- P5.5d governance component: added canonical source-derived OperatorWallet and
  BurnWallet profiles. Revalidate EIP-1967 slots, initialization/reentrancy state,
  inner implementation/admin/owner/pending owner, operator/pause/hot-wallet controls
  and controller code. NVDAB execution closure is nine components. Optional paired
  collector quantity block/hash prevents collection drifting to a different head.
- P5.5d/P7.1 reproduced gap: changing an inner proxy implementation while keeping
  its outer runtime unchanged could escape wrapper-only identity. Regression
  fixtures reproduce this condition; the new source-pinned inner layout/logic and
  fingerprint validation reject upgrades, unavailable/mismatched reads and further
  delegated controllers. Admin/owner/operator/hot-wallet changes invalidate review.
- P5.5d scanners: expose exact coverage maps (seven Binance, twenty-two GoPlus).
  Missing fields never become false/zero; positive warnings survive partial
  coverage. Unsupported Binance values remain suppressed. Forged clear labels,
  omitted/extra coverage and invalid envelopes cannot clear the pure assessment.
- P5.5d independent-review intake: added reviewed primary publisher namespaces,
  version-2 exact component/source scope and fresh SHA-256 PDF artifact receipts.
  Reject mutable GitHub paths, lookalikes, redirects, HTML/non-PDF, oversized bodies,
  changed bytes, failed retrieval and stale/mismatched receipts. Ten-second/four-MiB
  bounds; no paid source or credential. Version-1 parsing stays compatible but
  cannot grant live clearance. CLI exposes intake fingerprints. Registry unchanged
  and empty; verified report bytes cannot override risk/unknown coverage. ADR 0028
  documents provenance vs qualified operator judgments of scope/finding adequacy.
- Public validation: Sentio block 125113819 and Blast 125113823 produced complete
  nine-source NVDAB/two-wallet governance observations and identical fingerprints;
  these are different-block collections. USDT source closure is one component.
  Both commands exit 2 as expected. Saved non-secret public observations and fresh
  scanner coverage to the dated integration report/JSON; no trade or wallet read.
- Public review result: immutable EtherAuthority USDT PDF bytes verify SHA-256
  94cedb0cb27d4266ce9dd6414775ab79708ef75f6a205c65e050d2453932014f.
  The historical address-named report does not establish current full source/
  controller scope; it is a candidate only. No matching NVDAB review recovered and
  the user has no audit URL. Independent review is needed for live admission under
  current policy, not for continuing implementation/offline/PostgreSQL testing.
- Remaining findings: USDT Binance 5/7 and GoPlus 21/22 coverage with mint warnings;
  NVDAB Binance unsupported 0/7 and GoPlus 7/22 with a shared-creator warning (not
  proof NVDAB is a honeypot). Qualified reviews, full scanner coverage, risk policy
  approval and other P5.5/P7 production gates remain open. No risk was accepted.
- Tests: fifteen new focused regressions cover certificate provenance, canonical
  layouts, changed inner logic/controllers, delegation/closure, explicit scanner
  coverage and report provenance/scope/receipt boundaries. Existing P7 approval-
  change test supplies matching synthetic artifact ID so a valid review revision
  still invalidates signed approval. Real PostgreSQL execution/recovery tests pass;
  recovery accounting and wallet/Market Gate interfaces remain unchanged.
- Test-fixture corrections: first TypeScript compile rejected Node Buffer as DOM
  Response BodyInit; wrap bytes in Uint8Array. Extracting a shared collector mock
  then left an unused Interface import (TS6133); remove it and rerun the full check.
  These were agent fixture/type integration errors, not application behavior bugs.
- Final verification: PostgreSQL-backed ./scripts/check.sh passed 186 application
  tests and three research regressions, zero failures/skips, strict typecheck,
  headless and production web builds plus configuration/artifact checks. Earlier
  incremental PostgreSQL run passed 185 tests before the final regression was
  added. Existing unrelated pending work is preserved.
- Supplementary memory: three durable non-secret integration/gate/test findings
  saved to Nexus and retrieved successfully. Git documentation remains authority;
  git diff --check passed. Focused commit includes security-module dependencies,
  preserving unrelated pending phase work rather than staging the entire workspace.
- Portability verification: exported the focused staged tree without unrelated
  pending phase code. Its first compile found a legacy transfer fixture missing
  the newly required quantity block hash/authority list. Included only those two
  fixture fields; isolated checks then passed 97 application plus three research
  tests, no failures/skips. This validates the security module independently of
  pending workspace P7/web changes, not completed production wiring.
- Public namespace regression: primary PeckShield repository inspection showed
  the report directory is audit_reports, not the initially assumed audits path.
  Corrected the allowlist and added accepted/rejected path, branch and publisher
  assertions. Limit the catalog to verified EtherAuthority/PeckShield repositories;
  unverified additional publishers stay unsupported. Rerun checks after this fix.
- Post-correction final workspace verification: PostgreSQL-backed check passed
  186 application and three research tests, no failures/skips, strict typecheck
  and both builds; includes the corrected publisher-path regression assertions.
- Final isolated focused-tree check after the publisher fix passed 97 application
  and three research tests, zero failures/skips, typecheck and headless build.
  The full workspace additionally passes its PostgreSQL/P7/web suites and web
  build as reported above. Fourth non-secret publisher-provenance memory finding
  saved/retrieved; staged and workspace diff whitespace checks passed.

## 2026-10-01 — P5.5/P7.1/P7.2/P7.5 production evidence and guarded EOA orchestration

- Scope: connect canonical bStocks production evidence assembly to an authenticated,
  PostgreSQL-derived exact-leg review/persist/one-time broadcast service. Preserve
  strict token risk, economic mapping and access gates, existing EOA/store/recovery
  APIs, and disabled web trading. No real wallet signing, approval or mainnet send.
- Read state, plan, recent logs/changelog, Market Gate/EOA/security specifications
  and ADRs 0013/0017/0019/0023/0024/0025/0028; searched supplementary Nexus memory.
  Baseline PostgreSQL-backed check passed 186 application plus three research tests,
  no failures/skips, strict typecheck and both builds. Existing pending work retained.
- Identified compatibility requirements: raw amounts remain canonical; browser input
  never supplies authoritative policies/snapshots/evidence; signed bytes persist
  before network send; a lost response remains unknown; recovery stays independent.
  A bStocks UI multiplier alone cannot create economic QuantityEvidence. Missing
  reviewed issuer/venue sources must stay null rather than be fabricated.
- Design requirement: transport receipt timestamps and head changes alone must not
  require repeated signatures while an original review remains fresh. Revalidate
  the current complete gate and stable approval facts against the original bundle;
  retain its immutable signed hash only when all facts match and its original TTL
  still passes. Price/control/review/access revisions must invalidate approval.

- P5.5c/P5.5d component: production collector composes canonical quantity, current
  detailed security at the same block/hash, free Chainlink prices, calendar and token
  status with explicit reviewed entitlement/access/event/valuation/quote/simulation
  ports. Failed/unconfigured ports remain null; no UI multiplier or allowance override.
- P7.1/P7.2 components: bounded bigint persistence codec, migration 0008 immutable
  reviews/network observations, server-owned executor and reviewed runtime factory.
  PostgreSQL accepted legs, active policy/body/version, instruments, complete balances,
  reservations, owner sessions and recovery/deployment hashes determine authority.
  Optional existing-client store/ledger arguments compose those checks atomically.
- P7.1 reproduced signature churn: fresh receipt clocks/security heads change the
  byte-level evidence hash despite unchanged facts. Correction: require both complete
  original/current gates, stable access-policy/revision hash and exact semantic facts,
  within the original earliest lease. Never renew the signed packet; changed source
  times cannot move backwards, changed prices/control/reviews invalidate it. Regression
  covers refreshed receipts, changed facts, missing auth revision and expired leases.
- P7.1 reproduced fill/gas bounds gaps: signed minimum alone permits a worse current
  fill that exceeds fair-price limits; estimated native cost can be lower than approved
  gas ceiling. Correction: evaluate current simulated output through P5 and positive
  fill bounds, and require quoted gas cost >= maxGasLimit * maxFeePerGas. Regressions
  block both cases before persistence/claim.
- P7.2/P7.5 transport: canonical full-balance/mined+pending nonce and nondelegated EOA
  reads, then one chain-56 raw-send attempt after durable unknown claim. A lost response
  or network-result write cannot reopen the claim. Runtime source must belong to the
  reviewed recovery configuration; tracked ERC20s must have code/decimals pins.
  Trusted factory defaults broadcast disabled; browser flows remain trading disabled.
- Tests: intermediate PostgreSQL run passed 198 application tests. Additional stored
  context integrity, earliest-expiry, access-hash and full receipt recovery regressions
  passed in a later 202-test run, zero failures/skips. Synthetic USDT/NVDAB metadata,
  reviews/prices/events, random wallets and isolated chain-mode schemas are explicitly
  fixtures, not mainnet eligibility or clearance. No real signing/broadcast occurred.
- Fixture/type corrections: optional null guards needed explicit narrowing; actual
  session API is SessionStore. Initial direct receipt test incorrectly expected worker
  outcomes from reconcileBscLeg and skipped observation; TypeScript caught the wrong
  result API. Replaced it with runBscRecoveryOnce: first run reconciles, repeat monitors,
  revision advances once and submitted reservation is consumed. These are test wiring
  errors, not observed production bugs. Added owner isolation, recovery-config change,
  disabled runtime default and committed claim/result-write-failure regressions.
- Decision and portability: ADR 0029 records server trust, lease semantics and claim
  ordering. Updated P5/P7/security specifications, state/plan/README and execution
  runbook; source qualification and P5.5/P7/P8 operational gates remain explicit.

- Final workspace verification: PostgreSQL-backed ./scripts/check.sh passed 205
  application plus three research tests, zero failures/skips, strict typecheck,
  headless and web builds. Workspace/staged-tree whitespace checks are required
  before commit; no live source clearance or production trading is claimed.

- Focused portability verification: exported the staged tree without unrelated
  pending rules/web workspace code. Its PostgreSQL-backed check passed 173 application
  and three research tests, zero failures/skips, strict typecheck and headless build.
  Includes previously pending EOA store/recovery/session/access prerequisites because
  the guarded service directly depends on them; leaves other phase/config changes
  untouched. Full workspace separately passed 205 application tests and web build.
  Three durable non-secret findings saved to Nexus MCP and retrieved successfully;
  Git docs remain authoritative. Workspace and staged diff whitespace checks passed.

## 2026-10-01 — P5.5e/P7.1/P8.3 exact route adapters and web approval

- Scope/read: inspected project state/plan/recent logs, ADRs 0023/0029, P5/P7/P8
  specifications, route/recovery runbooks and supplementary Nexus memory. Read
  web/AGENTS.md and local Next.js route-handler/client-component guides.
- Baseline: PostgreSQL-backed ./scripts/check.sh passed 205 application and three
  research tests, zero failures/skips, strict typecheck and both builds.
- Compatibility: preserve server-derived authority, immutable reviews and exact
  signed bytes before send; no fixture evidence promoted to live use. Real-state
  simulation must require actual funds/allowance with no overrides. Keep broadcasting
  disabled by default, existing rules/sign-in/export behavior and recovery accounting.
- Design: pin exact Pancake V3 venue/code and canonical quantity frame; implement
  actual accepted-size buy/sell quotes, conservative gas valuation and exact-byte
  simulation. Web approval uses owner-scoped reviews and two explicit signatures;
  wallets lacking raw transaction signing need an explicit import path, never a
  silent eth_sendTransaction fallback. Primary Pancake addresses/ABI and Ethereum
  RPC documentation were checked; document provenance in ADR 0030.

- P5.5e/P7.1: added canonical route ports, four venue code pins, factory/pool/pair/
  decimals/fee/liquidity checks, exact-size raw buy/sell quotes, integer impact and
  bounded minimum/deadline. Full gas ceiling uses same-block Chainlink BNB/USDT
  valuation with freshness/depeg/uncertainty checks. Exact-byte simulation requires
  actual allowance, token/native funds, successful call and bounded gas estimate;
  no overrides or sends. Runtime auto-wiring binds route configuration digest.
- P8.3/P8.4: execution application service, strict safe HTTP DTO/commands and
  /api/execution route; operator configuration reload with unresolved sources null.
  Browser-safe canonical signing-schema extraction preserves existing EOA exports.
  Added separate review/sign/store/submit panel, exact-payload/raw validation,
  explicit import fallback and account/chain/session/expiry invalidation. Persisted
  signed legs are visible after reload without exposing signatures/bytes.
- Test corrections: sell fixture lacked mandatory flag and union result needed
  narrowing; signature mock queried a review ID only initialized by its old helper,
  so query exact tx_hash instead. Positive quote fixture inherited venue `v3` and
  a $0.001 gas cap: explicitly use the test venue and realistic synthetic gas budget;
  production limits unchanged. Browser selectors matched Next's empty announcer
  alert; scope by text. HTTP fixture glob omitted query strings, causing refresh
  to hit real unauthenticated API and hide stored transaction; include query strings.
  These fixture errors were reproduced, corrected and regressed, not bypassed.
- Increment verification: PostgreSQL npm test passed 213 application tests, zero
  failures/skips; all 14 Chromium cases passed, including existing fixture/saved
  workflows. Added actual execution HTTP origin/extra-field/foreign/revoked-session
  assertions for final browser run. Real application gateway PG tests cover
  owner-scoped prepare/persist/once-only submit and secret-free read projection.
- Live read-only smoke: observed four public venue code hashes and the application
  quote succeeded at canonical block 125153134. Unfunded synthetic-wallet simulation
  returned null as required. Initial moving-head probe returned no quantity; final
  probe pinned head/hash before clock capture. Preserved empirical JSON/report;
  observed identity hashes and relaxed smoke fee age are not qualified live policy.
- ADR 0030 records route/capability/trust decisions. Updated specifications, plan,
  state, runbook and README. Production access/economic/events/valuations, scanner/
  reviews/risk policy and mainnet/chain-initialization/repair gates remain open.

- Added reload regression: stored signed leg remains submit-ready after reload,
  with no second approval/signing request. Initial assertion incorrectly read the
  reset synthetic wallet-call log after reload; capture before/after separately.
  No application error was found. Final Chromium run passed all 14 cases including
  new real HTTP guards, explicit import, unknown outcomes and reload/no-resigning.
- Included directly required saved-workspace/rule foundation files and their prior
  regression suites in the focused web integration, preserving unrelated pending
  source-research/config changes. Do not build two web artifacts concurrently;
  headless and browser checks must retain independent build ownership.

- Final verification: PostgreSQL-backed ./scripts/check.sh passed 213 application
  plus three research tests, zero failures/skips, strict typecheck and both builds.
  Final Chromium run passed all 14 cases. Workspace/staged whitespace checks pass.
  No live qualification or phase completion beyond this implementation is claimed.

- Focused-tree portability check: exported the staged tree without unrelated pending
  configuration/research work. PostgreSQL-backed ./scripts/check.sh passed the same
  213 application plus three research tests, zero failures/skips, strict typecheck
  and both builds. Included direct prior web/rule dependencies; preserved unrelated
  work. Three durable non-secret findings were saved to Nexus MCP and retrieved;
  repository documentation remains authoritative. Whitespace checks passed.


## 2026-10-02 — P5.5/P6/P7/P8/P9 senior-engineering handoff

- Request: provide a detailed Markdown brief of all unresolved challenges, their
  history and the help needed from a senior engineer. Read current state/plan,
  specifications, relevant ADRs/reports/runbooks and recent logs; searched Nexus
  shared memory and verified context against repository code.
- Baseline: default check passed 157 application tests with 27 PostgreSQL skips,
  zero failures, plus three research tests/typecheck/both builds. Cause of skips:
  TEST_DATABASE_URL was unset in this process; an export in another shell is not
  inherited automatically. Repeated with the previously supplied dedicated local
  test database: 213 application plus three research tests passed, no failures/skips,
  strict typecheck and both builds. No application bug or new baseline failure.
- Added docs/SENIOR_ENGINEER_HANDOFF.md: U01–U15 covers access, economics, free
  prices/events, scanner/report/governance policy, null production ports and chain
  bootstrap, wallet/allowance, historical RPC/nonce/repair, scheduling/allocation,
  wider MVP scope, release evidence and portability. Includes chronology, exact
  public route identities, entry points, acceptance criteria and reading map.
- Recorded the owner's preference to prove the EOA MVP before commissioning a
  new audit, distinguishing external-token assessment from optional Nexus custody
  contracts. No risk exception or policy deferral was implemented. October 1
  14-case browser success is explicitly historical, not a new run or live trade.
- Rechecked official bStocks FAQ, Chainlink guidance and xStocks legal overview;
  Ondo restriction-page retrieval failed, so the handoff labels its prior findings
  historical. No contact email was invented or sent. Existing dirty work preserved.
- Linked handoff from current state and continuation plan. No ADR required because
  this records unresolved decisions without making a new architecture choice.
  Current .git filesystem policy is read-only; no commit or permission request.
- Post-documentation verification: PostgreSQL-backed ./scripts/check.sh passed
  213 application plus three research tests, zero failures/skips, strict typecheck
  and both builds. Handoff validation passed 57 local links, U01–U15 section
  consistency, no test credentials/secret-shaped hex and whitespace checks.
  No new browser/live-wallet result claimed; current gates remain open.
- Code inspection additionally identifies a pilot UX timing question: approval
  expiry is the earliest original source lease, so the 30-second Binance status
  can dominate a configured five-minute trade approval. Added explicit clock
  distinctions and requested real-wallet latency measurements, without claiming
  a reproduced application bug or changing expiry policy. Added stored-but-expired
  signed-leg handling to the manual-repair scope; no cancellation behavior invented.
- Two durable non-secret handoff findings were added to the Nexus MCP entity and
  retrieved successfully. Versioned records remain authoritative. Revalidated all
  57 local handoff links, challenge IDs and privacy shapes after the added context.

## 2026-10-02 — P5.5/P7/P8 owner-pilot implementation, baseline and first increment

- Owner directed implementation of the senior engineer response. Read current state,
  plan, logs, ADRs and shared Nexus memory; retained all unrelated dirty work.
  PostgreSQL baseline passed 213 application + three research tests, no failures or
  skips, typecheck and both builds (`/tmp/nexus-pilot-baseline.log`).
- P5.5a–e/P7.1: introduced explicit owner-only five-USDT, one-buy admission profile.
  Strict security remains default; scanner state/findings are retained and independent
  review is deferred. Exact full fingerprints and fresh zero-tax buy/sell proof are
  mandatory. Added a configured age-dependent reference band and worst signed-fill
  bound. Price parameters are declared policy, not a guessed volatility estimate.
- P7.1: reproduced the source-lease signing constraint in fixtures. Added opt-in
  fresh-before-submit approval clocks, retaining original signed evidence and semantic
  authorization checks. The first post-change full check passed the original 213 +
  three tests and both builds (`/tmp/nexus-pilot-step1.log`). New regression tests are
  being added for 30-second renewal, stale/current changed facts and signature binding.
- P7.3/P7.5: added canonical logarithmic nonce diagnosis, finalized owner-signed
  bootstrap/resync records and migration 0009. Resync does not release unresolved
  signed/submitted inventory or rewrite disputed fills. Owner unpause stays separate.
- P5.5c: recovered the NVDAB ADGM prospectus through the register’s public issuer
  filter, not a guessed URL. Nigeria is absent from its dated restricted list; the
  amendment clause prevents treating that absence as current universal clearance.
  External secondary addresses are covered, distinct from Binance-platform KYC.
  Eight-place issuance rounding vs 18-place raw transfers needs a cited mapping
  rationale. Primary-source digest and sections are being recorded durably.
- P5.5c/P5.5d: added private reviewed-record ports with signed owner declarations,
  primary-source content checks, explicit mapping rationale and separate company/
  issuer notices. Added a loopback-only Anvil round-trip adapter; no private key,
  test balance/storage override or mainnet write is used. Live results remain open
  until the intended wallet and reviewed current records are available. ADR 0031
  records the narrow policy change and deferred general-release work.

## 2026-10-02 — P5.5/P7/P8 owner-pilot implementation, regression evidence and continuation

Client: Codex. Decision: ADR 0031. The initial 213-application/three-research PostgreSQL
baseline was passing; failures below were introduced during this increment and were
corrected before reporting its completion. Unrelated existing dirty work is retained.

### P5.5a/d/P7.1 — Admission, source clocks and original approval compatibility

- Added `src/pilot/profile.ts`: exact configured owner/NVDAB identity, one-buy principal
  ≤5 USDT, immutable full per-asset fingerprints, individually accepted issuer-trust
  findings, published-heartbeat/declared age-band policy and fresh round-trip proof.
  The existing strict assessment is recomputed and hashes retained. Unknown scanner
  coverage and independent-review deferral are never rewritten as passes. Providers
  must supply complete explicit covered/unknown key sets; unavailable is blocking.
- Tests retain unsupported/risk states under the explicit pilot, reject changed
  fingerprint, wrong owner/cap, unsafe scanner findings, actual tax, failed/incomplete
  sell, expired reference and unbounded signed minimum. Strict default still blocks
  incomplete review/coverage. Candidate parameters are policy, not a volatility model.
- Reproduced the 30-second original-status lease limiting a five-minute human signing
  window. Added optional `refresh-before-submit` in market-revalidation/eoa/production/
  store: original issue-time packet remains signed, current full packet must pass,
  semantic facts/source-clock regressions cannot change permission and exact bytes/
  evidence hash remain bound. Tests include one-minute signing after 30-second lease,
  stale/changed sources, altered context and expiry. Default original leases remain.
- Reproduced two real composition obstacles: exact Chainlink source IDs contain a
  colon rejected by instrument metadata, and stock/USDT feed age was coupled to the
  shorter status age. Allowed namespaces only in reference/status IDs, preserving
  issuer/product/identity grammar. Added optional independent settlement freshness;
  default status-age behavior remains. Tests reject issuer/URL identity expansion,
  retain USDT's true timestamp, accept configured 900-second heartbeat and reject expiry.
- The candidate uses maxBlockLag 2048 for subsecond BSC blocks over five-minute signing;
  actual current funds/nonce, controls and simulation still must be refreshed. No
  clock is fabricated to make a source pass; source timestamp is displayed explicitly.

### P5.5b/c/d/e — Private reviewed ports, allowance and actual-state local proof

- Recovered ADGM primary NVDAB prospectus through its register's public issuer filter;
  plain request 403 corrected with a normal User-Agent, not guessed contract/legal
  evidence. Recorded exact PDF URL, SHA-256 and relevant sections plus published
  NVDA 86400-second/USDT 900-second directory evidence in the dated source manifest.
  Nigeria's absence from the dated list does not prove current permission. External
  secondary representations and 8-place issuance versus 18-place raw transfers are
  preserved as review context, not legal/economic auto-clearance.
- `manual-records.ts` binds profile, all reviewed records, exact allowance receipt and
  an owner EIP-712 declaration with ≤24-hour expiry. Requires cited primary URLs,
  digest/section, current restriction review, explicit economic ratio/rationale,
  exact reviewed control/mapping/multiplier and separate company/provider events.
  Changed source bytes or expiry blocks; held-stock valuation remains out of scope.
  The evidence label distinguishes an owner pilot from the issuer country API.
- `allowance.ts` only verifies an externally owner-signed/submitted exact setup leg:
  correct token/from/to/value/calldata/spender/amount, unique exact Approval event,
  successful canonical receipt and finality. Unlimited/reverted/reorged/insufficiently
  finalized approvals fail. Raw import remains swap-only; no unimplemented Nexus
  approval leg is claimed. Setup precedes trusted bootstrap to account for nonce/gas.
- `round-trip.ts` starts an isolated loopback Anvil at the canonical reviewed block,
  checks chain/EOA and four venue code hashes, uses actual owner funds/exact allowance,
  buys then approves/sells the entire acquired raw position locally, verifies exact
  wallet/pool raw effects and restores the stock balance. No generated accounts,
  balance/storage/code overrides or mainnet writes. Cleanup is bounded on success/
  failure. Tests reproduce tax, failed sell, unlimited allowance and changed venue.
- Private ports regression tests verify actual route participants, economic revision/
  multiplier, declaration/records binding, country/expiry, changed documents and
  non-primary source rejection. Added `pilot:inspect`, `pilot:declaration` and the
  hardware/local-keystore runbook; inspection exports a disabled candidate with
  findings initially unaccepted. No signer/private key is stored by these tools.
- Reproduced a private-output bug: relative path `..owner/...` inside the repository
  passed a naive startsWith('..') test, as could an outside parent symlink into the
  repository. `private-output.ts` resolves parent symlinks and checks path components;
  exclusive 0600 writes prevent existing-file overwrite. Regression tests cover both,
  legitimate outside output and filesystem-root basename preservation.
- Intended EOA was supplied during implementation. Public code/funds/nonce, current
  controls and source inspection succeeded; private candidate/snapshot remains outside
  Git/MCP. No owner-specific balance/address/signature is copied into durable memory.
  Funding and actual allowance remain owner prerequisites, not inferred permission.

### P7.2/P7.3/P7.5/P8.3/P8.4 — Initialization, one-trade plan and recovery

- Added migration 0009 immutable snapshot-review records and `chain-bootstrap.ts`:
  exact finalized BNB/USDT/NVDAB data, canonical code guards, code-free EOA, historical/
  latest/pending nonce equality and complete head balances. Reads fall back only as
  a whole source. Owner/authenticated paused review and signed canonical activation
  are transactional/idempotent, preserve history, invalidate held plans and stay paused.
- Resync requires a diagnosis/reason and no unresolved signed/submitted/unknown/
  replaced/reorged obligation. It records external state acknowledgement, not complete
  transaction classification; deep-reorg/disputed-fill accounting remains frozen.
  Regression tests cover concurrent activation, owner/signature/nonce mismatch,
  submitted resync rejection and revision/plan preservation.
- `nonce-history.ts` binary-searches historical counts from the trusted activated
  bootstrap anchor, verifies interval bounds, exact canonical transition transaction,
  receipt and end-of-read anchors/head. Worker/store compose the anchor without
  removing compatible bounded scan behavior. A distant million-block synthetic case
  takes ≤25 count reads and one full-block read. Missing history/receipt/tx and reorg
  remain unavailable; a replacement is diagnosis and cannot reconcile its effects.
- `planning.ts` registers trusted immutable NVDAB metadata and a matching configured
  coordinator policy atomically, checks chain revision/current balances/nonce/empty
  holdings and reserves one full bounded buy. Wallet advisory lock plus portfolio
  lock prevents cap reset across portfolios/profile revisions. Idempotent retries
  do not create another plan. Store independently enforces the persisted cap.
- Auth/origin/body-size guarded `/api/chain-snapshot` and `/api/pilot-plan`, Review
  panel and strict browser typed-snapshot checker connect initialization/resync and
  one-trade planning to the existing execution screen. Disclosure shows deferred
  review, scanner findings/gaps, issuer powers, true price clock/band and cap. Wallet/
  chain/session/revision changes invalidate late UI results. No automatic send fallback.
- PostgreSQL pilot flow verifies renewed signing→exact bytes→one-time claim/send;
  a second portfolio/new profile cannot reset the persisted allowance. Existing
  receipt/effect/restart suites still pass. Browser tests demonstrate signed snapshot
  activation and tampered displayed-balance rejection without transaction sends;
  actual HTTP guards cover the new endpoints.

### P5.5a/d — Price monitoring and public smoke

- Added `price-monitor.ts` and `pilot:prices`: canonical exact pool mid, true equity/
  settlement observations, reviewed ratio-dependent normalized deviation, heartbeat
  overrun, source-time regression, outside-session/outage labels and per-session
  observed-update cadence. Missing mapping leaves deviation unavailable. Unit tests
  cover unchanged/update cadence, regression/outage/expiry, unknown mapping, declared
  band violation and closed session. Monitoring grants no admission and no continuous
  scheduler; sampled observations cannot certify intervening rounds.
- Real Anvil 1.8.3 startup/fork smoke confirmed chain 56, canonical fork header,
  zero generated accounts, zero simulated transactions and zero mainnet writes.
  Real public price probe obtained reference, settlement, NYSE calendar and DEX mid;
  outside regular hours and unreviewed mapping produced attention-required as intended.
  Source time was retained, not changed to receipt time. No normalized price clearance
  or actual funded-wallet round trip is claimed.

### Test failures, corrections and verification

- First full test after early implementation: original 213 + three tests passed.
  Initial targeted 18-case run passed. New full test step 2: 217 application tests,
  seven failures. Cause: adding `uiMultiplier` to the global bigint revival keys
  converted canonical security controls from string to bigint, invalidating source
  fingerprints and stored review hashes. Correction: revive only manual
  `parsed.mapping.uiMultiplier`; keep security controls strings. Full corrected
  check passed 217 + three, no failures/skips, typecheck and both builds. Lesson:
  identical JSON key spelling can belong to different schemas; conversion must
  preserve the original security canonicalization, not rewrite all matching keys.
- A new PostgreSQL planner fixture failed INVALID_LEASE: injected September clock
  disagreed with Ledger's actual wall clock for a future reservation. Updated test
  to use current signed session/current synthetic settlement; production clock was
  not weakened. Unused imports after extracting a fixture were compile-corrected.
  Subsequent full check passed 224 + three and both builds.
- First 16-case browser run: 15 passed, one selector failure. Correct tamper rejection
  produced an alert, but getByRole('alert') also matched Next's route announcer. Scoped
  the assertion to the expected message; all 16 cases then passed. The production
  snapshot rejection behavior did not need a change.
- Private-record fixture initially lacked required sessionId (compile error), then
  compared checksum/lowercase addresses literally (226/227 passed). Added session
  context and compared normalized semantic addresses. Full check passed 227 + three.
  Private-path additions passed 228 + three. Monitoring additions passed 231 + three,
  zero failures/skips, strict typecheck and both builds. No failure is attributed to
  the initial baseline or obscured as an external environment problem.
- Durable documents now include state/plan/project log/changelog, ADR 0031, source
  manifest, owner runbook and forwardable senior questions. Required-artifact checks
  include the new migration/modules/routes/docs. Final verification is recorded below.
  .git remains read-only under the environment policy; no commit/revert attempted.

- Final implementation check passed 231 application plus three research tests,
  zero failures/skips, PostgreSQL enabled, strict typecheck and headless/web builds.
  All 16 Chromium cases passed after the selector correction. Two actual public
  source probes retain true source time and report outside-session/unqualified
  economic deviation rather than granting clearance. The nonpersonal machine-readable
  evidence is [owner-pilot verification](integrations/2026-10-02-owner-pilot-verification.json).
  Documentation validation passed 227 local links across eleven changed records,
  owner-address/test-secret exclusion and git diff --check. Four durable non-secret
  observations were added to the Nexus MCP entity and retrieved successfully.
  Current access/economic qualification and actual mainnet receipt/restart gates
  remain open; no transaction, personal eligibility signature or issuer message sent.

- P7.3 final review reproduced an inconsistent-transition bug in the new nonce
  diagnosis: a full-block transaction claiming a different block number/hash was
  accepted when its separately returned receipt matched the searched canonical block.
  Added wrong-transaction-block/hash regression variants; reproduction ran 231
  tests with 230 passing and one failure. Cause: candidate from/nonce/hash checks
  omitted the full transaction's inclusion metadata. Correction requires its own
  block number/hash to match the canonical transition before accepting a replacement
  diagnosis. Replacement effects still cannot be reconciled from this observation.
  Final checks below include this correction; prior passing runs remain historical.
- Post-correction ./scripts/check.sh passed 231 application plus three research tests,
  zero failures/skips, strict typecheck and both builds. The distant replacement
  regression now rejects both inconsistent transaction block fields, preserving the
  logarithmic success case. Whitespace and 228 local documentation links passed;
  private artifacts were confirmed mode 0600. No live acceptance gate was inferred
  from these tests. This is the final code verification for the increment.

## 2026-10-02 — ADR 0031 Amendment 1 implementation (Codex)

- P5.5a/b/c/d/e, P7.3/P7.5: user authorized the amendment and response002.
  Baseline ./scripts/check.sh passed 231 application and three research tests,
  PostgreSQL enabled, strict typecheck and both builds. Strict admission, exact
  EOA bytes, persist-before-broadcast, one-buy cap, ledger amounts and unresolved
  resync rejection are compatibility requirements. Existing unrelated changes
  are preserved; Git metadata remains read-only.
- P5.5a/c/d: added revisioned dual/raw/display mapping, exact rational checks,
  dated NYSE open conversion, P1–P9 integrity diagnosis, canonical raw feed
  observations and fresh guarded pool mid. Pilot profile v2 binds absolute gas
  ceilings; old profiles cannot inherit changed rules. Migration 0010 adds
  source-scoped persistent feed high-water marks and a private cadence journal.
  First typecheck caught an inspection-clock variable mismatch; corrected it
  to the observed canonical quantity snapshot clock. Regression verification
  and subsequent increments are recorded below.

- P5.5b/c: manual records and eligibility signature domain are v2. Implemented
  current ADGM register pagination/completeness, unique latest NVDAB primary and
  all potentially applicable issuer supplements. Per-trade manifest and byte
  digests plus current Binance restrictions must match the signed review. A
  listed residence/access country returns denied; unavailable/changed evidence
  stays unknown. J4 adds restricted-person/jurisdiction representations; J5
  checks only a privately recorded dated decision and signed rules revision.
  No personal sign-off from the issuer is required for this owner-only profile.
  Live read-only register probe found the June 11 NVDAB primary; no supplements
  were returned by the complete current issuer register. This proves discovery,
  not a country decision or document-content review.
- P5.5a/d, P7.1: initial regression runs failed because the synthetic instrument
  factory returns frozen metadata, then because the refresh fixture changed
  reference/settlement clocks without matching raw-round metadata. Corrected
  fixtures by cloning before synthetic source configuration and retaining
  consistent source clocks. Strict production behavior was preserved. A temporary
  assertion attempted JSON serialization of bigint; removed that diagnostic.
  Targeted renewed approval/persistence/send tests then passed.
- P7.3/P7.5: persist the pilot profile fingerprint per signed leg (legacy pilot
  review rows remain subject to the invariant); store independently requires
  matching zero-allowance proof. Trusted recovery reads at the receipt canonical
  hash. Missing allowance evidence does not apply a fill. Nonzero allowance
  appends an idempotent incident/pause without releasing submitted funds. Original
  full receipts and before/after raw balances are stored immutably for recovery.
  PostgreSQL tests cover missing/omitted proof, nonzero freeze, repeated attempts,
  blocked unpause, eventual zero proof, restart monitoring and strict compatibility.
- P7.3/P7.5/P8.3: implemented only R1 re-anchoring, with two configured explicitly
  reviewed independent upstreams, finalized-tag proof of the original block's
  absence, exact signed transaction/nonce, identical ordered logs and gas,
  original raw balances and complete finalized ledger equality. Five-minute owner
  EIP-712 reviews bind evidence/configuration/original proof/before-after revisions.
  Compensation is append-only; original fill proof and all accounting amounts
  remain unchanged. Pausing persists; resync still rejects unresolved disputed
  fills. PostgreSQL tests passed valid R1, idempotency, competing transition,
  changed gas/logs/balances, source disagreement, one/shared upstream and owner
  isolation. Added owner/origin-guarded API and bounded browser review/signing.
  R2/R3 remain manual procedures; no replacement/cancellation signer was added.
- ./scripts/check.sh passed 238 application and three research tests, zero failures
  or skips, PostgreSQL enabled, typecheck and headless/web builds after the initial
  access/price/allowance/R1 increment. Subsequent diagnostics/browser tests and
  documentation verification are recorded below.
- P5.5a/c/d: sampled diagnostics now retain raw round IDs/source clocks, current
  session liveness, P1–P7, exact raw/display premiums and signed premium direction.
  A missing cited mapping uses explicitly unreviewed dual diagnostics, never trade
  admission. Trading's PostgreSQL journal records every price reason as well as
  the first gate reason; profile revisions cannot reset source history. Gas remains
  outside price ratios and bound separately. Added invalid/future/reorged feed,
  exact band/peg/heartbeat boundary, dual-cap and new-supplement regression tests.

- P5.5a/c/e: boundary review identified a cash-valuation conflict: the pilot planner
  initializes nominal USDT cash at one dollar, while a within-band feed below one
  dollar made the inherited strict gate reject the snapshot before portfolio checks.
  Pilot-only caps now use the lesser of stored cash lower value and current sourced
  conservative USDT value; strict rejection remains unchanged. Regression tests
  cover the negative 50-bps boundary and concentration cap with the lower NAV.
  A test initially referenced a nonexistent companyId; corrected the fixture to
  use the domain's underlyingId grouping. Another new-supplement test initially
  used the wall clock against dated synthetic evidence; injected its fixture clock.
  These failures were in newly added tests, after the passing increment above.

- Final expanded ./scripts/check.sh passed 243 application and three research tests,
  zero failures/skips, PostgreSQL enabled, typecheck and both builds. Boundary
  tests initially forgot that the old synthetic settlement ratio is 1/1, rather
  than production USD-18/10^18; corrected the denominator alongside feed values.
  Negative peg, gas-excluded band, inclusive age/peg and conservative cap tests pass.
- First expanded Chromium run passed 17/18 cases. The changed-evidence rejection
  worked, but the new test's unfiltered alert locator also selected Next's route
  announcer. Reproduced selector ambiguity, filtered by recovery error text (same
  lesson as earlier snapshot tests); rerun follows below. Product behavior was
  already blocking before any signature.
- Read-only v2 intended-wallet inspection and standalone source diagnostics wrote
  mode-0600 candidates outside Git. Candidate remains disabled and requires review;
  no private records were activated. Live ADGM discovery succeeded. Current free
  reference/pool diagnostics retain true clocks and explicitly unreviewed dual
  economics; no actual allowance/signature/broadcast or eligibility decision was
  inferred. Source diagnostic outcome is retained privately and in a nonpersonal
  verification manifest. Owner-specific facts remain outside repository/MCP.

- P8.3 final browser rerun passed all 18 Chromium cases. R1 display/evidence tamper
  blocks before signing; a valid exact typed correction signs only the recovery
  record and preserves pause. Actual PostgreSQL HTTP tests also verify reanchor
  origin, body-size, foreign-owner and signed-out guards. No transaction signer or
  broadcaster is invoked by the correction UI. Component boundaries: pilot
  prospectus-register/quantity/price-integrity/price-journal; execution
  allowance-proof/reanchor-evidence/reanchor; guarded server route and separate
  client reanchor-wallet/panel. CLI inspection/diagnostics remain read-only.
- Portable documentation updated: accepted amendment and original ADR cross-reference,
  state/plan/project/engineering/changelog, owner runbook, senior response link repair
  after its user move, and nonpersonal verification JSON. No user amendment/response
  content was discarded; legal assertions are user-supplied context, not a Nexus
  legal opinion. Git metadata is read-only, so this work remains uncommitted.
  Final repository verification, links/privacy and MCP retrieval follow below.

- Final completion verification: ./scripts/check.sh passed again after the portable
  documentation changes: 243 application tests and three research tests, zero
  failures/skips, PostgreSQL enabled, typecheck and both builds. The separate
  Chromium rerun passed all 18 cases. git diff --check passed; 239 local links
  across ten relevant documents resolve. The verification JSON parses, intended
  owner addresses and test password are absent from these documents, and all three
  private amendment artifacts remain mode 0600 outside Git. The README database
  URI is its existing illustrative local command, not a stored credential.
  Retrieved the Nexus MCP entity and confirmed all five new durable amendment
  observations; versioned documentation remains authoritative. Live acceptance
  gates remain open as listed in PROJECT_STATE and the owner runbook.

## 2026-10-02 — P5.5e/P7.1/P7.2/P7.5/P9.4 supervised EOA acceptance runner

- User requested a local private-key runner, small funded-EOA transactions,
  default data collection and broadcasting instructions. Before edits, read the
  state/plan/recent logs, ADR 0031 and accepted amendment, owner runbook and service
  interfaces; retrieved Nexus MCP context. PostgreSQL baseline ./scripts/check.sh
  passed 243 application plus three research tests, zero failures/skips, strict
  typecheck and both builds. Existing unrelated/user changes remain intact.
- Compatible boundaries: one wallet-wide lifetime buy capped at five USDT,
  separately verified external exact approval before bootstrap, current reviewed
  v2 records and signed declarations, normal gate/simulation/revalidation,
  persist-before-broadcast, one claim, no resend on ambiguity, canonical zero
  post-fill allowance and immutable recovery accounting. Runner will compose
  existing services; it will not enable additional buys or a mainnet exit sale.
  Private keys are local-only hidden terminal/file input; private evidence remains
  outside Git/MCP. Implementation and verification follow below.

- P7.1/P7.2/P9.4: added scripts/test-eoa-pilot.sh and pilot:eoa with independent
  check, allowance, declaration, run and recover commands. runner-input exposes
  an offline signer through capability methods only, accepts hidden TTY input or
  absolute mode-0600 external files, rejects key arguments/noninteractive signing,
  and requires an exact action acknowledgement. Both reviewed deployment flag and
  --broadcast are mandatory. No Agentic Wallet authentication is required for these
  EOA commands; the wallet skill's credential guidance was read, and its read-only
  skill/CLI version probes reported current versions. No wallet operation or
  state-changing skill command was performed by this agent.
- P9.4: runner-evidence validates outside-project paths before mkdir, enforces
  0700/0600 files/no-follow/exclusive lock, fsyncs the timeline and atomically exports
  packets. Keys/session/database/RPC credential fields and arbitrary error messages
  are excluded while actual contract token addresses remain. runner-runtime composes
  existing services and collects default diagnostics plus a repeatable-read owner
  packet: source/review/control/security/round-trip evidence, raw feeds/P reasons,
  full original receipt/allowance/balance proof, reservations/revisions and recovery
  provenance. Optional production observer preserves default web behavior; runner
  sink failures stop before review/persistence/claim. Private signed records are
  copied only to the private evidence directory for signature/hash verification.
- P5.5e/P7.2: runner-allowance signs the exact configured USDT approval externally,
  with current funded code-free EOA, reviewed controls/router and accepted findings,
  gas estimate plus 20% bounded headroom, native reserve and current BNB/USDT fee
  conversion. Saved bytes/no-retry claim precede one send; ambiguous sends only
  inspect. Existing allowance/bootstrap/wallet leg blocks new setup. Finality uses
  at least 12 confirmations; existing unique exact canonical receipt verification
  is reused. No persisted Nexus approval leg, unlimited authorization or new sale.
- P7.1/P7.2/P7.5: runner-services/trade use real owner sign-in, signed finalized
  paused bootstrap, explicit unpause, existing single-buy planning/production gate,
  exact typed/raw signatures, PostgreSQL persistence then guarded one-time claim.
  Renewed evidence and local real-state round trip remain mandatory. Claimed or
  ambiguous legs only recover; a saved signed leg needs fresh authentication and
  exact stored-send acknowledgement. Wallet cap survives new directories/profiles.
  Recovery worker gained an optional bound wallet/leg filter; default all-leg
  discovery is preserved. Successful reconciliation requires full immutable proof/
  zero allowance; fresh worker replay must preserve accounting/claim. Actual process
  restart is explicitly an owner-run recover step, not claimed by that replay.
- Tests cover commands/two broadcast switches, key/file/path/privacy boundaries,
  exact BSC signatures, bounded approval and unlimited rejection, write/cancellation/
  lock failures, changed setup, blocked gate capture, persist-before-send and no
  resend, scoped real PostgreSQL receipt/zero-allowance recovery/packet and replay.
  Production observer PostgreSQL regression proves blocked evidence is captured
  and a failed sink cannot create an execution review or leg.
- Corrections: first typecheck caught an unused DomainError import, removed before
  the passing suite. Review found reproducible boundaries: managed filenames could
  overwrite an operator input at the same path; failed advisory-lock acquisition
  could strand a pool connection and stall shutdown. Added pre-write collision
  validation and discard-on-lock-error, with named regressions. Repository-directory
  rejection happens before mkdir; contract-address token fields survive credential
  projection. These are tested, rather than inferred from inspection.
- Verification: incremental PostgreSQL suite passed 254 tests, then full checks
  passed 255 plus three research tests. Final ./scripts/check.sh after refinements
  passed **257 application and three research tests**, zero failures/skips, strict
  typecheck and both builds. **18 Chromium cases passed**. Launcher/help smoke
  passed. Actual check/default-run CLI smoke made public read-only probes against
  an isolated migrated PostgreSQL schema, exported five private artifacts at mode
  0600, and left zero portfolios/sessions/legs. No key, declaration, allowance,
  signature, broadcast, mainnet receipt or legal decision was obtained from the owner.
  Smoke schema/artifacts were cleaned afterward.
- ADR 0032/runbook document configuration/commands, mandatory data, pending/incident
  handling and stop/start acceptance. State/plan/project/changelog retain scope and
  open gates. Local links/whitespace checked; Git metadata read-only, uncommitted.

- Post-documentation ./scripts/check.sh passed again: 257 application/three research
  tests, zero failures/skips, PostgreSQL enabled, typecheck and both builds. Checked
  240 local links across nine relevant documents with no missing targets; intended
  owner address, test password and private-key examples are absent. Launcher is
  executable (0755); private output modes were verified in tests/CLI smoke.
  Retrieved all four new Nexus MCP observations successfully. A documentation patch
  initially mismatched a wrapped plan line and applied no edits; reread the exact
  line and reapplied atomically. Versioned documentation remains authoritative.
