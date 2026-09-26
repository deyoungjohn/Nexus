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
