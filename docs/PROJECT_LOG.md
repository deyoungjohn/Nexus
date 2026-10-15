# Nexus project log

This is the short, chronological record of phase outcomes and remaining gates.
For individual steps, tests, bugs, decisions and lessons, read
[ENGINEERING_LOG.md](ENGINEERING_LOG.md). The
[implementation plan](IMPLEMENTATION_PLAN.md) defines phase exit criteria.
Repository documents remain authoritative; shared MCP memory is supplementary.

## 2026-09-25 — P0/P1 complete

- Established the blueprint-driven phase plan and engineering record.
- Built exact denominated amounts, exact instrument metadata identities and a
  deterministic, offline cash allocation primitive.
- `./scripts/check.sh`: 22 named tests passed, including 1,000 generated cases;
  type checking and build passed. Synthetic demo passed.
- Next gate: P2 live integration feasibility.

## 2026-09-25 — P2 in progress

- Read-only public evidence identified BSC USDT and three Ondo equity token
  candidates (NVDAon, AMDon, AAPLon); Binance metadata and BSC RPC agreed on
  chain and 18-decimal token precision. See the dated
  [integration matrix](integrations/2026-09-25-phase-2.md).
- Confirmed that token display scaling and underlying stock reference prices
  require separate interpretation; a current HTTP response does not prove the
  underlying reference price is current.
- The Agentic Wallet CLI is installed but reported `UNCONNECTED`. Wallet-bound
  quote, actual sender/spender/recipient, simulation, approval and receipt were
  therefore not tested. No authenticated account data or trade was used.
- Earnings calendar: user-supplied, clearly labelled records are selected for
  the demonstration path. A licensed, confirmable automated source remains open.
- P2 exit is **open**. Do not mark the instruments or trading route executable
  until the evidence gaps in the integration matrix are resolved.
- Repository check outcome is recorded in the same-day changelog and detailed
  engineering entry. Next action: connected read-only wallet quote and exact
  route assessment, followed by a separately authorized transaction test.

## 2026-09-25 — P2 wallet status correction and quote checks

- The earlier `UNCONNECTED` result was a sandbox false negative. Outside the
  sandbox, the same CLI reported `ALREADY_CONNECTED` at sign-in and `CONNECTED`
  at wallet status. The CLI is the Agentic Wallet CLI used in both checks.
- Quote-only requests succeeded for USDT to NVDAon, AMDon and AAPLon, plus
  NVDAon to USDT. The wallet need not hold funds for these estimates. The user
  reports no funds; no balances, personal address or transaction were recorded.
- Quote output contained input/output amounts and slippage, but no route,
  spender, recipient, allowance, deadline, source block or executable bound.
  Exact-plan authorization, simulation, source freshness, funded trade and
  receipt verification remain open. P2 is **still in progress**.
- The false-negative cause, corrected tests and lesson are recorded in the
  [engineering log](ENGINEERING_LOG.md); current fields are in the
  [integration matrix](integrations/2026-09-25-phase-2.md).

## 2026-09-25 — P2 funded read-only checks

- The owner funded the connected wallet. A BSC balance query verified the
  presence of settlement and native-gas assets; no address or exact personal
  holdings were copied to project records.
- A 5-USDT NVDAon quote succeeded twice. A 4-USDT quote returned `315008`
  with `From token value greater than 5 USD`; the smaller amount cannot be
  assumed executable. AMDon and AAPLon sell-direction quotes also succeeded.
- Quotes remain estimates, with no route, simulation or fee bound. No swap was
  authorized or submitted. P2's execution and calendar gates remain open.

## 2026-09-25 — P2 custom route and conditional simulation

- KyberSwap returned an unsigned 5-USDT-to-NVDAon BSC route with exact token
  addresses, fixed wallet recipient and a 0.5% encoded minimum-output bound.
  Direct chain simulation failed because the wallet has no router allowance;
  a read-only override modeling exact allowance succeeded. No permission or
  transaction was sent.
- Agentic Wallet Developer Mode is disabled, so wallet-specific preview remains
  open. The candidate route showed no explicit on-chain deadline. Binance's
  token audit reported no supported result; the owner must acknowledge that
  gap before a swap.
- P2.4 source choice: issuer investor-relations announcements, manually
  recorded and rechecked, for confirmed MVP earnings events. No automated
  event feed or date-dependent live rule is enabled. P2 remains in progress
  pending actual-wallet preview, approvals, trade receipt and reconciliation.

## 2026-09-26 — P2 route deadline follow-up

- Baseline repository checks passed. Binance wallet status, settings and
  address checks failed with `DNS_RESOLVE_FAILED`; current wallet state and
  Developer Mode could not be verified. No wallet preview was attempted.
- A read-only PancakeSwap V3 direct-pool quote found a possible deadline-bound
  route, but its 5-USDT output was below a refreshed Kyber estimate. V2's
  direct quote was much lower; tested V3 WBNB second legs reverted. None is
  an approved or wallet-simulated trade.
- P2 remains **in progress**. Restore wallet access, construct and preview an
  exact deadline-bound route, seek separate token-allowance authorization,
  then request trade approval and reconcile a receipt. Details and source
  links are in the [integration matrix](integrations/2026-09-25-phase-2.md).

## 2026-09-26 — P2 wallet restored and approval preview

- The owner restored VPN access and enabled Agentic Wallet Developer Mode.
  Connected wallet status and settings now pass. A current 5-USDT quote,
  BSC balance and zero V3-router allowance were verified. Public token status
  reported off-hours but open; the security audit still has no supported
  result for NVDAon.
- The deadline-bound V3 route passed a read-only swap simulation only with a
  temporary exact-allowance override. The actual-wallet preview of an exact
  5-USDT router approval passed and showed no risk flags or authority change.
  Separate owner authorization for that permission change was requested.
- No allowance, swap or receipt has been submitted. P2 remains **in progress**
  until actual allowance, fresh wallet swap preview, explicit off-hours/audit
  acknowledgement and trade authorization, receipt and reconciliation.

## 2026-09-26 — P2 confirmed allowance and swap preview

- The owner authorized the exact 5-USDT allowance. A refreshed identical
  wallet preview was executed; the BSC receipt succeeded and the on-chain
  V3-router allowance is exactly 5 USDT.
- A fresh deadline-bound V3 route passed real-allowance chain simulation and
  Agentic Wallet swap preview. It spends exactly 5 USDT, enforces 50-bps
  minimum output and an on-chain deadline. No wallet risk or authority flag
  appeared; Binance audit remains unsupported and the token is off-hours.
- The owner was shown exact terms and asked to confirm this preview before
  submission. No swap or receipt exists yet, so P2 remains **in progress**.
  One-base-unit display rounding in the prior minimum was corrected from
  decoded calldata; the engineering log records reproduction and lesson.

## 2026-09-26 — P2 feasibility complete

- The owner confirmed the bounded 5-USDT NVDAon trade. An expired preview
  failed closed; a rebuilt route kept the same exact input and minimum output
  with a fresh deadline. The final wallet preview passed without new risk or
  authority flags.
- BSC receipt status was successful. The mined calldata, token transfer logs,
  raw wallet balances and spent allowance reconciled; output exceeded the
  approved minimum. Wallet display quantity tracked raw on-chain units times
  the published shares multiplier to display precision. No personal wallet or
  transaction identifiers are stored in project memory.
- P2.1–P2.4 now have feasibility evidence, so **P2 is complete** and P3 is
  next. One supervised trade does not enable Nexus automation. P5 retains
  eligibility, reference freshness, audit policy and other-instrument checks;
  P7 retains durable submission and recovery. See the
  [integration matrix](integrations/2026-09-25-phase-2.md) and
  [ADR 0003](decisions/0003-p2-integration-gates.md).

## 2026-09-26 — P3 durable ledger complete

- Added PostgreSQL migrations and a modular ledger for exact raw balances,
  revisions, transactional cash/inventory holds, unique occurrences and
  idempotency keys, one executing batch per portfolio, transaction identity
  records and a leased outbox. A submitted reservation cannot expire with an
  unsubmitted hold; unresolved submissions block fresh plans.
- On a real local PostgreSQL 16 server, concurrent requests for 80 + 80 units
  against 100 units accepted only one. Rollback, replay, stale revision,
  expired hold, worker failure and restart/lease reclaim checks passed.
  `TEST_DATABASE_URL=… ./scripts/check.sh` passed 30 tests in total,
  typecheck, build and configuration checks. The temporary test server is not
  an application deployment.
- **P3 is complete** as storage and dispatch infrastructure. P4 coordinator is
  next. P5 must establish trustworthy market/eligibility evidence, and P7 must
  resolve wallet submissions, receipts and reorgs before live automation. See
  [specification 0002](specifications/0002-durable-ledger.md) and
  [ADR 0004](decisions/0004-postgresql-ledger.md).

## 2026-09-26 — P4 Portfolio Coordinator complete

- Added deterministic, offline coordination of mandatory reductions, exact-
  instrument netting, priority/proportional buys and conservative company,
  sector, issuer, cash and gas limits. A sell can be reserved first; dependent
  buys remain contingent until a new reconciled portfolio revision.
- The blueprint fixture produced a $30 NVDA sell, rejected $60 NVDA buy and
  contingent $30 AMD buy. On a separately reconciled snapshot, only the $30
  AMD buy was reserved. A halted sale, a new intermediate breach, changed
  instrument classification or stale revision blocked dependent planning.
- PostgreSQL records activated policy versions, exact instrument metadata,
  evidence and decisions under the same portfolio lock as P3 reservations.
  Blocked occurrences are unique and safe to replay. A concurrent stale-
  snapshot test accepted one reservation and rejected the competing attempt.
  Full `TEST_DATABASE_URL=… ./scripts/check.sh` passed 48/48 tests, typecheck,
  build and configuration checks.
- **P4 is complete** as an offline coordinator. P5 is next: real source clocks,
  eligibility, quantity compatibility, quote costs and simulation evidence.
  P7 still owns owner approval, submission and receipt/reorg recovery. See
  [specification 0003](specifications/0003-portfolio-coordinator.md) and
  [ADR 0005](decisions/0005-coordinator-sequential-bounds.md).

## 2026-09-26 — P5 offline Market Gate complete

- Added a pure, fail-closed market gate and read-only adapter seam. Exact
  eligibility, verified raw-to-share quantity mapping, source-timestamped
  reference, settlement valuation, dated exchange session, token status,
  issuer event, clear supported token audit, actual-size direct-V3 quote and
  exact simulation are required.
  Missing or stale evidence blocks; P2's timestamp-less public price cannot
  be treated as fresh. Every held position also needs a current valuation
  record matching P4's portfolio snapshot.
- The direct-V3 calldata decoder checks token pair, wallet recipient, amount,
  minimum output and on-chain deadline independently of quote labels. Venue,
  router, spender, fee tier, slippage, impact, spread, gas, price deviation and
  full-size P4 portfolio constraints are bounded. Mapping changes invalidate
  an old evidence hash and block its plan at the P5 gate.
- Tests cover exchange DST and holiday states, changed mappings, missing/stale
  prices, eligibility, events, halts, route substitutions, fees, low allowance,
  sell proceeds under a depegged settlement valuation and adapter outages.
  Real PostgreSQL-backed `./scripts/check.sh` passed 56/56 tests, typecheck,
  build and configuration checks.
- **P5 is complete as an offline gate.** Production evidence providers and
  the unsupported token-audit policy remain open. No live execution adapter
  or standing trade permission was added. P6 rules are next; P7 must bind
  approvals, recheck evidence and recover submitted transactions. See
  [specification 0004](specifications/0004-market-gate.md) and
  [ADR 0006](decisions/0006-market-evidence-boundary.md).

## 2026-09-26 — P5.5 live-readiness investigation in progress

- Live automation was blocked by missing authenticated, source-timestamped
  reference prices, owner/transfer eligibility, maintained session and event
  evidence, settlement conversion, unsupported token audit and P7's approval,
  submission and recovery lifecycle. The earlier supervised trade proved one
  route and receipt, not standing authorization or automation safety.
- Added a read-only Pyth Pro parser/accessor using the provider's price-origin
  timestamp. A provider key and authenticated regular-session response remain
  outstanding. Added an Ondo BSC oracle reader for three P2 candidate tokens;
  one pinned-block read checks share ratio, active/scheduled pause and mapping
  revision. The real BSC read succeeded for NVDAon, AMDon and AAPLon.
- P5.5 remains open. No wallet call, signer, trade or executable instrument
  registration was added. P6 has not begun. The remaining gates are tracked in
  [the live-readiness matrix](integrations/2026-09-26-live-readiness.md).

## 2026-09-26 — P5.5 keyless reference and settlement pivot

- A production Pyth subscription is unavailable, so the two-asset MVP now
  targets published BSC Chainlink NVDA/USD and AAPL/USD underlying feeds and
  the USDT/USD settlement feed. AMDon remains outside the executable scope.
- Added read-only pinned-block Chainlink adapters and source-age/round checks.
  The live probes decoded the three feeds; Friday equity timestamps correctly
  blocked a Saturday 60-second freshness policy. The owner eligibility
  discussion does not create wallet/venue-bound evidence or a standing trade
  approval. No signer or execution path was enabled.
- P5.5 remains open for regular-session validation and the remaining matrix
  gates. P6 has not begun; P7 still owns approval and recovery.
- A separate short-lived public token-status reader passed read-only checks
  for both candidates. Neither Binance nor GoPlus produced enough token-risk
  evidence to mark either token clear; the audit gate remains blocked.
- A versioned official NYSE calendar reader passed read-only weekend,
  regular-day, holiday and early-close probes. Publisher revisions block until
  reviewed. Issuer events, wallet/venue attestation, audit policy, regular-
  session source validation and P7 execution/recovery remain open.

## 2026-09-26 — P5.5 owner-attestation and token-risk groundwork

- Added an EIP-712 owner declaration and local challenge/verify workflow for
  exact BSC wallet, Ondo token, direct-V3 router, venue and side. It expires
  after 24 hours and checks signature and revocation lookup. No owner
  declaration has been signed or stored, and no production eligibility
  adapter or durable revocation store is connected.
- Reproduced Binance's unsupported NVDAon/AAPLon audit responses against a
  supported BSC USDT control. A read-only BSC adapter now pins and hashes the
  shared Ondo beacon and implementation so upgrades invalidate a later
  review. The fingerprint does not replace a security audit; P5 continues
  to block `unsupported`. [ADR 0010](decisions/0010-owner-attestation-and-token-risk.md)
  and [the integration note](integrations/2026-09-26-eligibility-risk.md)
  record the decision and owner steps.
- Full PostgreSQL 16-backed `./scripts/check.sh` passed 70/70 tests,
  typecheck/build/config. P5.5 remains open for a timely signed owner
  declaration, current transfer check, supported audit or explicit reviewed
  exception, issuer events and regular-session source validation. P6 has
  not begun; P7 execution/recovery is still required before live use.

## 2026-09-26 — P5.5 settlement compatibility and issuer-event process

- Corrected the read-only Chainlink USDT/USD adapter's valuation unit from
  `USD` to `USD-18`, matching the P5 snapshot interface, and added an
  explicit peg-deviation ceiling. A mainnet read passed illustrative
  20-minute source age, 50-bp uncertainty and 100-bp peg bounds; these are
  not activated production thresholds. The full PostgreSQL-backed check
  passed after the code change.
- Added a manual issuer-event runbook for official NVDA/AAPL sources and
  fail-closed revision/recheck handling. Dynamic or inaccessible issuer pages
  do not justify a `none-confirmed` record. P5.5 remains open for current
  reviewed event records, production settlement policy, regular-session
  evidence, actual owner attestation and token-risk decision. P6 remains
  unstarted; P7 execution/recovery still blocks live automation.

## 2026-09-26 — P5.5 Ondo control-surface review

- Verified-source review of the shared Ondo implementation found role-gated
  mint/admin burn, mutable compliance and pause managers, and an upgradeable
  beacon. Read-only BSC calls found current shared control pointers for both
  tokens. These facts explain why a code-only fingerprint cannot complete a
  risk exception; it must include privileged roles and control configuration.
  The P5 audit remains `unsupported`, with no exception or live use enabled.

## 2026-09-26 — P5.5 xStocks-first provider pivot

- The owner selected xStocks as the first live-provider target. The blueprint's
  instrument identity and adapter boundaries support this; the completed P2
  Ondo trade remains historical and its route is not transferred to xStocks.
  Ondo adapters are retained for later integration. [ADR 0011](decisions/0011-xstocks-first-bsc-provider.md)
  and the [xStocks BSC matrix](integrations/2026-09-26-xstocks-bsc.md)
  record the provider decision and evidence.
- Added a read-only exact-contract xStocks BSC identity and current-v2-wrapper
  quantity adapter. Issuer/API and BSC checks passed for NVDAx and AAPLx;
  three new named regression tests pass. No instrument is execution registered.
- Four 5-USDT Agentic Wallet quotes to the two bare tokens and two wrappers
  each returned `No liquidity available, please try again later.` Direct
  Pancake V3 pools at the tested pairs/fee tiers were absent. P5.5 remains
  open for a bound venue route, current eligibility and token-risk evidence,
  corporate-action handling, regular-session validation and issuer events.
  P7 approval/submission/recovery still blocks live trading; P6 has not begun.
- A follow-up 5-USDT wallet quote sweep over eight more issuer-listed BSC
  xStocks returned seven no-liquidity errors. SPYx returned a nonempty but
  economically implausible quote against Binance's indicative token price;
  it was not substituted into the MVP. Venue liquidity and independent
  reference-price validation remain a release gate.

## 2026-09-27 — P5.5e BSC stock-liquidity survey

- Ran a read-only, dated survey of all 671 BSC tokenized-securities records
  in the Binance Web3 listing. The [report and full CSV](research/2026-09-27-bsc-stock-liquidity.md)
  separate direct USDT pool reserves from actual-size wallet quotes.
- Among equity-scoped Ondo/xStocks/bStocks listings, 100-USDT quotes worked for
  23/329, 4/96 and 66/67 respectively. bStocks alone supported a credible
  direct-USDT-pool top 20 with successful 100- and 10,000-USDT quotes. Ondo's
  Sunday market-hour blocks and xStocks' absent/thin routes prevent a
  defensible top 20 for either provider now. Four Paimon SPV tokens and one
  separately classified BNC4 token were also tested and identified separately.
- P5.5 remains open. This is evidence for a possible provider-priority review,
  not a pivot or permission to trade. Exact executable route, fair reference
  price, risk review, eligibility, simulation and P7 approval/recovery gates
  remain outstanding. No wallet state changed.

## 2026-09-27 — P5.5b/P5.5e bStocks-first provider switch and bounded route

- The owner switched the first live-provider target from xStocks to bStocks
  after the [BSC liquidity survey](research/2026-09-27-bsc-stock-liquidity.md)
  exposed xStocks' missing or economically poor routes. [ADR 0012](decisions/0012-bstocks-first-bsc-provider.md)
  supersedes ADR 0011 for provider priority only; Ondo and xStocks modules
  remain separate and dormant. No automatic provider substitution was added.
- A read-only [NVDAB BSC route probe](integrations/2026-09-27-bstocks-bsc.md)
  verified the exact USDT/NVDAB PancakeSwap V3 fee-2500 pool, a 5-USDT quote,
  encoded minimum output and deadline, Nexus route decoding, successful
  conditional `eth_call`, gas estimate and negative bound/deadline simulations.
  The connected wallet's actual settlement balance and allowance were below
  the test amount, and no transaction was submitted.
- P5.5 remains open for bStocks quantity/control, eligibility, reference and
  settlement evidence, unsupported token audit, issuer events and full market
  gate integration. P7 owner approval and recovery remain absent. The route
  proof is time-specific and its deadline has expired; Nexus live automation
  remains disabled.

## 2026-09-27 — P5.5b bStocks quantity/control groundwork

- Added a separate read-only NVDAB adapter for BEP-677 raw/UI mapping,
  scheduled multiplier detection and pinned proxy, compliance, pause-manager
  and token-role fingerprints. A live block-124352879 probe succeeded and
  reported no token pause. Three named tests cover valid, changed and
  invalid states; local checks pass 61 tests with two database suites skipped.
- [ADR 0013](decisions/0013-bstocks-display-mapping-boundary.md) preserves raw
  accounting and keeps UI scaling distinct from verified stock-share exposure.
  No bStock is registered for live P5 use.
- Remaining P5.5 gates: issuer economic mapping and full control review,
  current jurisdiction/wallet eligibility, supported token-risk evidence,
  timely independent reference and settlement policy, issuer events and an
  end-to-end Market Gate bundle. P7 approval/recovery and actual wallet
  funding/allowance are still absent; live automation remains disabled.

## 2026-09-27 — P5.5c on-chain bStocks transfer preflight

- Added a read-only same-block check for token pause and the exact V3 route's
  wallet, pool and router against bStocks compliance controls. A synthetic-
  address BSC probe at block 124353819 succeeded; it cannot establish the
  intended user's eligibility. Three named tests cover passing, restricted,
  stale and changed-control paths. Local checks pass 64 tests with two
  database suites skipped.
- [ADR 0014](decisions/0014-bstocks-transfer-preflight-boundary.md) keeps
  on-chain transfer state separate from geographic/account eligibility. The
  reviewed public FAQ gives no country-eligibility endpoint path. Current
  issuer-supported jurisdiction/account proof and actual-wallet preflight
  remain gates, along with P5.5 risk/price/event evidence and P7 recovery.

## 2026-09-27 — P5.5d bStocks control review follow-up

- Extended the read-only fingerprint to capture external compliance/pause
  manager role sets and token mint/burn switches. Verified source shows these
  controls can change; a live block-124354706 read found mint and burn enabled.
  Existing tests now reject changed reviewed roles and flags. Local checks
  pass 64 tests with two database suites skipped.
- Unsupported token audit remains unresolved. Fingerprints detect revisions;
  they do not judge contract safety or replace current transfer, eligibility,
  price, event and execution-recovery gates.

## 2026-09-27 — P5.5c bStocks provider-event review

- The official NVDAB dividend notice demonstrated a provider-specific event
  stream: it specified a multiplier adjustment and temporary conversion,
  deposit and withdrawal pauses while spot trading would continue. The P5
  event schema binds only underlying-company announcements.
  [ADR 0015](decisions/0015-bstocks-dual-event-review.md)
  and the runbook now require both sources for bStocks.
- P5.5 remains open. Before live registration, implement and test dual-source
  event evidence and approval invalidation, then resolve eligibility,
  economic quantity, supported token risk, independent pricing and settlement.
  P7 execution/recovery remains a separate prerequisite.

## 2026-09-27 — P5.5c provider-event gate implementation

- P5 now accepts a separate, revisioned bStocks provider notice record and
  requires it for instruments with canonical `bstocks` issuer ID. Tests cover
  absent, stale, mismatched, uncertain, blackout and adapter-failure cases,
  plus evidence-hash change on notice revision. Existing other-provider
  offline behavior remains available.
- P5.5 remains open: this is an evidence interface, not a connected current
  notice source or trade permission. Production event sourcing, eligibility,
  economic quantity, supported risk and pricing evidence and P7 approval/
  recovery are still required before live bStocks use.

## 2026-09-28 — EOA-first wallet priority and eligibility clarification

- The owner chose a direct EOA as the first execution wallet. [ADR 0016](decisions/0016-eoa-first-wallet-execution.md)
  keeps the blueprint's owner-approved, sequential MVP and makes Agentic
  Wallet optional. P6 and synthetic P7 execution/recovery may advance while
  bStocks P5.5 live evidence remains open.
- A Binance account/product status is not a universal prerequisite for a
  direct EOA DEX route in the reviewed public bStocks FAQ. Current supported
  jurisdiction, user eligibility and exact-wallet transfer evidence still
  need a route-specific policy and verification. No live permission was
  inferred from wallet control, page access or a quote; no wallet code or
  transaction changed in this documentation decision.

## 2026-09-28 — P5.5c access flow, P6/P7 in progress

- Documented server-side bStocks geographic/user/product and exact-wallet
  transfer checks in the [access-control runbook](runbooks/bstocks-access-control.md).
  No production country endpoint or live eligibility adapter is connected.
- P6 has a tested pure rule compiler and evaluator with deterministic
  occurrence IDs, DST handling, price triggers and scoped earnings restrictions.
  Durable claims, P4 integration and reviewed drafting UX remain before exit.
- P7 has a tested EOA leg-approval and exact signed-transaction verifier.
  It cannot broadcast; durable identity, nonce/receipt/reorg recovery and
  sequential partial-basket handling remain before exit. [ADR 0017](decisions/0017-eoa-exact-leg-approval.md)
  records the signature boundary.
- `./scripts/check.sh` passes 73 tests with two PostgreSQL suites skipped;
  typecheck, build and configuration checks pass. Live bStocks remains blocked
  by P5.5 evidence and incomplete P7 execution/recovery.

## 2026-09-28 — P5.5c access-control core implemented

- Added short-lived EOA/session challenge binding and a fail-closed bStocks
  access composer. It requires reviewed person/jurisdiction, official country,
  route-specific product and actual wallet/pool/router transfer evidence.
- P5 now rejects bStocks eligibility without the route-bound access record;
  changed access hashes require a new P7 owner approval. Five new named tests
  cover successful synthetic composition and adversarial denial paths.
- `./scripts/check.sh`: 78 passed, two PostgreSQL suites skipped; typecheck,
  build and configuration passed. Production still needs the official endpoint
  and schema, trusted jurisdiction/product providers, durable session/challenge
  storage and all other P5.5/P7 gates. No live bStocks trading is enabled.
## 2026-09-28 — P7 EOA execution/recovery in progress

- Added default-paused EOA binding, a signed-leg migration/store, exact
  persisted bytes/hash and a one-time pre-leg-checked broadcast claim. There
  is no production broadcaster.
- Read-only BSC receipt observation and pure recovery distinguish timeout,
  nonce use, inclusion, finality, replacement and reorg. A finalized leg needs
  a trusted full balance snapshot before reservations and portfolio revision
  can be reconciled. Confirmed sells require a new buy plan; partial buys
  retain unspent cash.
- `./scripts/check.sh`: 85 passed, three PostgreSQL suites skipped, including
  the new P7 integration test; typecheck/build/config passed. P7 remains open
  until its migration and crash/reorg flows pass on PostgreSQL, trusted chain
  balance and replacement sources are connected, and guarded submission is
  implemented. Live bStocks remains blocked by P5.5.
- A deep reorg after reconciliation now automatically pauses the portfolio and
  advances its revision. Manual balance repair is required to resume; this
  regression is in the unrun PostgreSQL suite.

## 2026-09-29 — P7 database test connection blocked

- A supplied test database URL enabled the three PostgreSQL suites, but each
  failed at the connection step with sandbox `EPERM` on localhost port 5432.
  The 85 non-database tests passed. No database migration or P7 store assertion
  ran; Phase 7 remains in progress.
- This workspace has no accessible PostgreSQL Unix socket, and Docker daemon
  access is denied. Database-backed validation must run in an environment
  that can reach the disposable test server. No live trade was attempted.
- Owner reported the PostgreSQL container ready; a retry from this sandbox
  still failed at TCP `EPERM` before authentication. Host-side test execution
  remains the next verification step.
- Owner subsequently ran `./scripts/check.sh` with the test database URL in
  the host shell and reported all checks passing. A further sandbox retry with
  numeric localhost still failed at `EPERM`; the working path is host-side
  execution. This is an environment verification fix, not a P7 code change.
  P7 remains open for trusted balance/replacement sources, manual recovery,
  crash-path coverage and guarded submission.

## 2026-09-29 — P7 database gate passed on host

- The owner clarified that the host `./scripts/check.sh` run with the test
  database passed 101 tests, explicitly including the P7 PostgreSQL signed-
  leg store suite. The earlier agent `EPERM` applies only to its restricted
  sandbox. The P7 migration/store test gate is therefore recorded as passed
  on the host, with no application code change.
- Phase 7 remains in progress: trusted wallet balances and replacement
  resolution, expanded crash/reorg recovery, manual repair and guarded
  submission are still required. Live bStocks remains blocked by P5.5.

## 2026-09-29 — P7 PostgreSQL check reproduced locally

- After workspace network access was enabled, Codex ran the complete check
  directly against the disposable PostgreSQL database: 101 tests passed, none
  failed or skipped; typecheck, build and configuration passed. The P7 signed-
  leg store suite is now directly verified in this session.
- No application code changed. P7 remains in progress for trusted chain
  evidence, external nonce/replacement recovery, broader crash/reorg tests,
  manual repair and guarded broadcasting. P5.5 still blocks live bStocks.

## 2026-09-29 — P7 chain-evidence increment

- Added tested read-only BSC readers for pinned native/tracked ERC20 balances
  and a bounded canonical search for mined same-wallet/same-nonce replacement
  transactions. Ambiguous, incomplete or reorged evidence stays unresolved.
- Database-backed `./scripts/check.sh` passed 106 tests with zero failures or
  skips, plus typecheck, build and configuration. No live execution was enabled.
- P7 remains open for trusted complete asset/finality wiring, recovery beyond
  the scan window, crash/reorg database cases, manual repair, active
  policy/session wiring and guarded broadcasting. P5.5 bStocks evidence still
  blocks any live leg.

## 2026-09-29 — P7 persisted recovery hardening

- Store-derived BSC observation now uses the persisted wallet, hash and nonce.
  A separate read-only builder produces a pinned, registry-checked balance
  candidate. It does not apply balances or enable live submission.
- Reconciliation now requires the exact receipt block, native gas coverage and
  every previously tracked asset. PostgreSQL restart assertions cover the
  one-time claim, unknown receipt, repeated observation, final reconciliation
  and deep-reorg unpause denial. Database-backed `./scripts/check.sh` passed
  109 tests with zero failures/skips, plus typecheck, build and configuration.
- Phase 7 remains open for receipt-effect proof, complete nonce-history/manual
  recovery, active policy/session wiring and a guarded broadcaster. P5.5
  bStocks live evidence remains a separate prerequisite.

## 2026-09-29 — P7 receipt-effect recovery proof

- A canonical BSC receipt now must explain the exact input/output ERC20
  wallet movements and native gas loss before PostgreSQL can reconcile an EOA
  leg. Migration 0004 stores the normalized proof digest. The recovery worker
  leaves incomplete or contradictory RPC evidence unresolved.
- The PostgreSQL suite verifies invalid proof and missing gas leave revision
  and reservation unchanged, then verifies one successful reconciliation and
  persisted digest. `./scripts/check.sh` passes 112 tests, zero failures/skips,
  plus typecheck, build and configuration.
- P7 remains in progress for reviewed production token/source behavior, nonce
  recovery beyond the bounded scan, manual repair, active policy/session wiring
  and guarded broadcast. P5.5 still blocks live bStocks trading.

## 2026-09-29 — P8 fixture web workflow

- P8.1–P8.4 now have a labelled Next.js walkthrough: read-only EOA discovery,
  Overview/Plan/Review/Activity/Settings, an interpreted synthetic basket,
  bounded and expiring local preview, explicit fixture acknowledgement,
  one-time sample outcome, JSON export and browser-only pause.
- The web build joins `./scripts/check.sh`. Five new model tests cover cash
  bounds, invalid input, pause/expiry, one-time recording and reload behavior.
  The initial database-backed run passed 117 tests with no failures or skips;
  a subsequent cash-bound correction has a dedicated regression assertion.
  The final PostgreSQL-backed check passed 117 tests, zero failures/skips,
  including the Next.js production build.
- P8 remains **in progress**. Broader accessibility validation,
  authenticated portfolio/EOA state, canonical P6/P4/P5/P7 data, real approval,
  server pause and actual chain receipt display remain. The interface cannot
  sign or trade; P5.5 and P7 still block live execution.
- Three Chromium browser tests now pass for the walkthrough/export/reload,
  validation/pause and mobile keyboard/wallet discovery. Broader accessibility
  review and production integration remain P8 gates. The post-browser-test
  PostgreSQL-backed check still passes 117 tests with no failures/skips.

## 2026-09-30 — P6 durable scheduling and P8 saved workspace

- P6.1–P6.4 now persist immutable reviewed rule versions, event revisions,
  evaluation evidence and allocation ownership. Occurrence claims, P4
  decisions and P3 reservations commit atomically. PostgreSQL restart,
  concurrent-worker and rollback tests pass; midnight-spanning schedules keep
  the original local-date occurrence. Missing/shifted event controls suppress
  dependent buys, and allocation reductions cannot use whole-company inventory.
- P8.1–P8.4 now expose `/workspace` backed by owner-authenticated PostgreSQL
  state. Sign-in uses a single-use EOA message challenge, not trade authority.
  Basket/price instructions compile/save/review/activate through P6. P3 balances,
  P4 decisions, evaluations and safe P7 receipt fields can be inspected/exported;
  pause changes server state and invalidates held plans. The original `/`
  walkthrough is retained with its fixture labels.
- Passing increments: 129 PostgreSQL-backed tests after P6; 138 after saved
  backend; 139 after web integration. Seven production Chromium tests pass,
  including the persisted saved workflow and original fixture regression cases.
  Final combined verification is appended in ENGINEERING_LOG.
- P6/P8 remain in progress for trusted valuation/event scheduling sources,
  automatic allocation refresh after reconciled fills, server-reviewed event
  creation, exact execution approval and production source/access composition.
  P5.5 bStocks evidence and P7 complete recovery/manual repair/broadcast remain
  live gates. No issuer registration, eligibility result or trade is inferred
  from sign-in or rule activation. Broader accessibility and deployment
  protections/session cleanup remain release work.
- ADRs 0022/0023, specifications 0005/0007, implementation plan and project
  state were updated. The active policy makes `.git` read-only; source and
  portable records remain uncommitted. No existing unrelated work was discarded.

## 2026-09-30 — Free-source constraints and eligibility clarification

- Owner selected the public BSC dataseed RPC and free stock data alternatives;
  the test wallet will be requested when an executable reviewed plan is ready.
- P5.5/P7 read-only probes found current reads available, but historical
  recovery reads unavailable without another suitable source. Free Chainlink
  equity rounds were too old for the existing gate. The dated
  [source report](integrations/2026-09-30-free-source-readiness.md) preserves
  the observations; no gate was closed and no price policy was relaxed.
- A terms modal is a declaration/consent component, not a substitute for current
  bStocks geographic/product/transfer decisions. The official FAQ invites
  integration contact; a universal compulsory-contact/KYC claim has not been
  established. Existing access-control evidence requirements remain unchanged.

## 2026-09-30 — Eligibility dependency and alternative-provider review

- P5.5c/P5.5e: created [verificaton-challenges.md](verificaton-challenges.md)
  with the requested major-roadblock explanation, external versus internal
  ownership, issuer-integration questions, source-linked provider comparison
  and steps for a possible pivot. Support delay is owner-reported, not an
  independently verified rejection or proof that all contact is compulsory.
- xStocks places KYC/geographic responsibilities at platform level and reserves
  partner eligibility review; its issuer-account country policy requires
  separate review from third-party secondary trading. Ondo expressly separates
  secondary acquisition representations from issuer onboarding/redemption KYC.
  Primary API access still needs issuer onboarding. Neither source grants
  Nexus live permission or makes a terms-only process automatically adequate.
- Recommendation: reassess regular-session Ondo secondary BSC routes before
  reversing to xStocks. The prior bStocks liquidity advantage is preserved as
  dated evidence. Provider priority and control boundaries are unchanged;
  P5.5 access/source/risk and P7 production/recovery gates remain open.
- PostgreSQL-backed baseline passed 139 tests, zero failures/skips, strict
  typecheck, both builds and configuration checks. The final check also passed
  139 tests with zero failures/skips and both builds; `git diff --check` passed.
  Application code and execution interfaces are unchanged.

## 2026-09-30 — Ondo BSC secondary-route reassessment

- P5.5e: [regular-session report](research/2026-09-30-ondo-bsc-secondary-routes.md)
  and structured evidence cover inventory discovery, 25 sampled instruments
  at four sizes, public aggregator previews and bounded direct router effects.
  Small Nvidia direct orders are a credible candidate; Apple's direct pool
  consumes only a tiny fraction of the requested input. Other equity pools
  show better depth screens, but no independent fair-value pass is claimed.
- RFQ-excluded Apple/Tesla/AMD alternatives need additional route/intermediate
  review; some Nvidia aggregator paths cross bStocks. Open regular-session
  status did not solve the stale free equity references or unsupported audits.
  Reviewed access, source/risk/events and P7 runtime/recovery remain gates.
- Recommendation is continued Ondo qualification, starting with small direct
  Nvidia orders. Provider priority and access/freshness rules remain unchanged;
  no trade or provider switch occurred. All simulations used synthetic state.
- Baseline and post-documentation PostgreSQL-backed full checks passed
  139 tests with zero failures/skips, strict typecheck, both builds and config
  checks. Structured evidence assertions and `git diff --check` passed;
  durable findings were added to supplementary Nexus memory.

## 2026-09-30 — P7 historical RPC candidates found

- P7.3/P7.5: [Chainlist survey](integrations/2026-09-30-chainlist-recovery-rpc.md)
  and structured evidence screen 45 public HTTPS endpoints and deeply verify
  five. Sentio and Blockmachine passed historical native/token balances back
  to June 2024, full blocks, receipts/logs and existing P7 reader checks. Their
  stock-pool replays matched at the failed Ondo block and earlier NVDAB block.
- Historical-read capability now has usable anonymous candidates; prefer
  Sentio for the next qualification and Blockmachine as a backup. Four
  endpoints passed core readers; three additionally passed standalone log
  queries. Blast's query throttling does not invalidate its receipt-log reads.
- No account/key, intended test wallet, application source default, automatic
  failover, signing, reconciliation or broadcast was introduced. Source limits,
  trusted runtime/registry and remaining P7/P5.5 gates remain open.
- PostgreSQL-backed baseline full check passed 139 tests with zero failures/
  skips, strict typecheck, both builds and config checks. The post-documentation
  full check also passed 139 tests with zero failures/skips and both builds.
  Evidence/count/consistency/replay assertions and `git diff --check` passed;
  non-secret findings were added to supplementary Nexus memory.

## 2026-09-30 — P7 production recovery runtime connected

- P7.3/P7.5 wiring is implemented: operator-owned versioned registry/source/
  finality configuration, Sentio-first complete-proof Blockmachine fallback,
  persisted-leg discovery, portfolio worker ownership and once-only receipt-
  proven PostgreSQL reconciliation. Migration 0007 saves configuration-bound
  attempts and atomic observation/fill source/block/hash evidence.
- Restart/concurrency and before/after-fill failure tests now cover actual
  PostgreSQL recovery ownership; invalid proof and missing registry remain
  frozen. Contradictory receipts before settlement now pause too. Settled
  receipts continue to be monitored for deep reorgs. No signing or broadcast.
- Native gas is the only enabled registry asset. Reviewed stock ERC20 semantics,
  source limits/retention, complete nonce/manual repair, active execution policy/
  session, guarded broadcast and P5.5 remain gates. Deployment scheduling and
  the production database migration were documented, not performed.
- Both configured endpoints passed a public June-2024 historical state/receipt
  smoke check with matching digests. This does not represent an intended
  wallet trade or an approved Nexus mainnet settlement. See ADR 0024, the
  recovery runbook and structured smoke evidence.
- Baseline full check passed 139 tests; post-change `npm test` passed 147 tests,
  zero failures/skips. Final PostgreSQL-backed `./scripts/check.sh` passed
  147 tests, zero failures/skips, strict typecheck, both builds and config checks.
  Production CLI smoke against a migrated isolated empty schema returned `[]`
  and exit 0. `git diff --check` passed; durable findings were written to and
  retrieved from Nexus memory.

## 2026-09-30 — P7 USDT/NVDAB raw recovery registry reviewed

- P7.3/P7.5 immediate task implemented: reviewed exact deployed source/raw
  transfer semantics and registered 18-decimal USDT/NVDAB for recovery. Code
  and NVDAB immutable-beacon/implementation pins are checked at the receipt
  block before and after evidence collection. Changed identities require
  review; unavailable views can use full-source fallback. UI events never
  duplicate raw funds. Existing registry/store fixture interfaces preserved.
- Public buy/sell receipt and pool block accounting agreed on both configured
  RPCs; live application code guards passed four source/block checks. Real
  PostgreSQL guarded settlement tests use clearly synthetic source/P5 evidence
  with actual asset IDs. No trade, provider pivot or live instrument activation.
- Beacon source/complete privileged-control audit remains incomplete. This
  closes the raw recovery registry task only: P5.5 eligibility, token security,
  economic mapping, price/event evidence, manual nonce/reorg repair, deployment
  qualification, active execution policy/session and broadcaster remain gates.
- Baseline full check passed 147 tests. Latest tests passed 154 tests with zero
  failures/skips. Final PostgreSQL-backed full check passed 154 tests, zero
  failures/skips, strict typecheck and both builds. Stored evidence/cross-source
  consistency assertions and `git diff --check` passed; durable findings were
  written to and retrieved from Nexus memory.

## 2026-09-30 — P5.5d/P7.1 security enforcement increment

- Implemented modular full-token security assessment, public inspection CLI,
  empty trusted review registry and mandatory P5 reports for both route assets.
  Current source/control/role/privileged-code fingerprints, scanner coverage,
  review scope/expiry and canonical identity bind to P7 approval. Changed
  review evidence invalidates an existing signature. Accounting recovery for
  already-submitted legs remains compatible. No live asset or risk exception.
- Fixed hash consistency in bStocks quantity/transfer readers and live head
  receipt-time validation. Public EIP-1898 checks pass on three RPCs; complete
  Sentio/Blockmachine security observations agree on fingerprints.
- Remaining gates: NVDAB beacon source, two contract authorities' governance,
  supported scan coverage and qualified independent reviews; known mint and
  shared-creator warnings remain blocked under the initial policy. P5.5 access,
  economic mapping, timely reference/session/events and guarded P7 runtime remain
  open. Full-token enforcement is implemented; live-token security clearance
  and overall phase completion are not claimed. See ADR 0026 and the dated report.
- Verification: 154-test baseline; full PostgreSQL increments passed 167 then
  169 tests. Final PostgreSQL-backed `./scripts/check.sh` passed 171/171 tests,
  no failures/skips, strict typecheck and both builds. Development-only offline
  run skipped database suites accurately; clock regression fails with old
  compiled behavior and passes with the correction. No mainnet transaction.


## 2026-10-01 — P5.5d/P7.1 public source/governance research completed

Recovered the NVDAB beacon from public OpenZeppelin source and reproduced its
entire deployed runtime including metadata. Resolved the two previously unknown
privileged proxies to OperatorWallet/BurnWallet, verified their sources, inner
implementations, administrators, owners/operator and source-derived storage.
Sentio and Blast agree at the task's recorded observation block, with 12
permission probes per source (five successes/seven reverts). Evidence and
reproduction commands are in the [dated report](integrations/2026-10-01-bstocks-governance.md)
and ADR 0027. No independent audit or off-chain key-control attestation is claimed.

Public recovery research is complete; production source/governance integration,
scanner coverage, independent reviews and approved risk policy remain P5.5d gates.
Centralized upgrade powers are findings to review. Current token-security policy,
review registry, application code and production recovery sources stay unchanged;
P5.5/P7 live readiness remains open. Blast is qualified for sampled research
reads only. No transaction, provider pivot or live asset enablement.

The PostgreSQL baseline failed before edits with ECONNREFUSED at 127.0.0.1:5432
(129 passed/13 failed). Database-free baseline passed 129 tests with 13 database
suites skipped, strict typecheck and both builds. Historical September 30
171-test PostgreSQL success is not represented as current validation.
- Final stable-file verification: database-free ./scripts/check.sh passed
  129 application tests (zero failures, 13 PostgreSQL suites skipped), three
  research regressions (zero failures/skips), strict typecheck, headless and
  production web builds plus configuration/artifact checks. Full PostgreSQL
  verification is unavailable because the baseline database refuses connections;
  no current 171-test PostgreSQL success is claimed. node --check, bash -n,
  stored source/hash/block/privacy assertions, all 24 real permission-result
  assertions, git diff --check and supplementary memory retrieval passed.


## 2026-10-01 — P5.5d/P7.1 recovered source and current governance integration

Integrated the recovered source certificates and live canonical wallet governance
into the security collector, closing the nine-component NVDAB source/governance
integration gap. Added explicit scanner coverage and independent-report-v2
publication/byte/scope verification. See [ADR 0028](decisions/0028-source-governance-and-independent-review-intake.md)
and [findings](integrations/2026-10-01-security-collector.md).

Public Sentio/Blast collections agree on full fingerprints at nearby blocks.
The recovered USDT audit is a verified historical candidate, not current complete
clearance. No qualified NVDAB review was recovered; scanner coverage and known
risk findings remain blocking under current policy. The user has no audit URL;
building/testing can continue without one. No live asset or risk exception was
enabled, and other P5.5/P7 production gates remain open. Recovery stays independent.

PostgreSQL connectivity is restored. Baseline passed 171 application plus three
research tests; final ./scripts/check.sh passed 186 application plus three research
tests, zero failures/skips, strict typecheck and both builds. Logs document fixture
compile corrections and the exact remaining gates; unrelated pending work retained.

## 2026-10-01 — P5.5/P7 production evidence and guarded EOA execution

Codex implemented server-owned evidence assembly and PostgreSQL review → exact
signature persistence → one-time guarded raw send → historical receipt-effect
recovery. Active policy/session/owner/registry/revision and recovery configuration
are rechecked atomically; original and fresh P5 gates must both pass. Receipt/head
refresh does not renew signed leases, while changed facts require new approval.
Current fill and full gas-ceiling checks prevent weaker execution than the preview.
Broadcasting defaults to disabled and the web workspace still reports trading off.

Final PostgreSQL-backed ./scripts/check.sh passed 205 application tests and three
research tests, zero failures/skips, strict typecheck, headless and web builds.
Synthetic fixtures cover concurrent claims, logout/policy races, owner isolation,
timeout/result-write failures, external nonce/balance changes and repeat recovery
without duplicate fills. No actual wallet signing, allowance or mainnet send.
P5.5/P7 remain open for qualified sources/scanner/reviews/risk policy, browser exact
approval and chain initialization, operational repair and mainnet acceptance evidence.
See [ADR 0029](decisions/0029-production-eoa-evidence-orchestration.md) and
[the execution runbook](runbooks/eoa-execution.md).

## 2026-10-01 — P5.5e/P7.1/P8.3/P8.4 route and exact web approval

Codex implemented canonical actual-size USDT/NVDAB quotes and real-state simulation
with reviewed venue identity/code, fee-feed/gas, actual allowance/funds and reorg
checks. The saved web Review panel connects server-owned exact review, explicit
EIP-712 approval, raw signing/import, durable storage and separate guarded submission.
Account/chain/session/expiry changes block stale actions; reload does not repeat
signing for a stored leg. Existing saved rules/records and recovery remain compatible.

Verification: PostgreSQL-backed ./scripts/check.sh passed 213 application plus three
research tests, zero failures/skips, strict typecheck and both builds. All 14 Chromium
cases pass, including actual authenticated HTTP guards and explicit synthetic trade
flows. A public 5-USDT quote succeeded at block 125153134; an unfunded synthetic
simulation returned no evidence. No allowance, signature or mainnet send was made.
Production sources/scanner/reviews/risk policy, trusted chain initialization and funded
mainnet/operational gates remain open. Broadcasting defaults disabled. See ADR 0030,
the execution runbook and dated route-adapter evidence.


## 2026-10-02 — P5.5/P6/P7/P8/P9 senior-engineering assistance brief

Prepared [the detailed handoff](SENIOR_ENGINEER_HANDOFF.md) with 15 unresolved
challenges, provider/wallet pivots, resolved historical obstacles, implementation
entry points, required evidence and a proposed pilot-to-release work order. Live
sources, policy alignment, bootstrap, real-wallet execution and operational repair
remain open. The owner's preference to defer commissioning a new audit is recorded;
no existing admission policy or phase exit was changed. No application code/trade.

The current PostgreSQL baseline passed 213 application plus three research tests,
zero failures/skips, strict typecheck and both builds. The initial database-free
check's 27 skips are separately recorded. Post-documentation ./scripts/check.sh
also passed 213 application plus three research tests, no failures/skips, typecheck
and both builds. Handoff links/privacy/structure and whitespace checks passed.
Existing unrelated workspace changes are retained; .git is read-only under the
current policy, so the handoff is not committed from this session.

## 2026-10-02 — P5.5/P7/P8 supervised owner-pilot implementation

Codex implemented the senior response as the narrow [ADR 0031](decisions/0031-owner-only-bstocks-pilot.md)
profile: one configured EOA, one NVDAB buy, at most five USDT. Strict default admission
is preserved; scanner unknowns/findings remain visible and independent review is
explicitly deferred. Added actual-wallet local round-trip proof, exact external
allowance receipt verification, private primary-source records/declaration export,
true-heartbeat price bands and renewable signing with fresh complete preclaim gates.
Owner-signed finalized bootstrap/resync establishes a trusted nonce-history start;
canonical binary search diagnoses distant replacements without adopting their effects.
One-trade PostgreSQL planning and Review controls connect to existing exact signing,
persist-before-broadcast and recovery. Modular boundaries remain intact.

Recovered the ADGM NVDAB prospectus, including external secondary representations,
denomination terms and amendment-sensitive selling restrictions. Added private price
probes for true clocks/cadence/DEX mid/outages, with unavailable normalized deviation
until an economic ratio is reviewed. No owner address, declaration or signature is
stored in project documents/MCP. Actual owner inspection/candidate is outside Git.

Verification passed 231 application plus three research tests, no failures/skips,
strict typecheck and both builds; 16 Chromium cases passed. Actual Anvil startup/fork
checks confirmed canonical chain 56 with no generated accounts, simulated trade or
mainnet write. Tests demonstrate recovery behavior with synthetic chain effects;
they do not stand in for actual owner receipt/restart acceptance.

P5.5/P7/P8/P9 remain open for current jurisdiction/economic/notice review, funding,
owner snapshot/declaration/exact trade signatures, actual buy/sell simulation and
mainnet receipt-effect/restart evidence. No transaction or issuer message was sent.
Deep-reorg/disputed-fill repair, public integration/eligibility/source-use clearance,
scheduler/post-fill allocation and baskets remain deferred. The
[runbook](runbooks/owner-pilot.md) and [senior questions](SENIOR_ENGINEER_FOLLOWUP.md)
make the remaining work reviewable; these are not hidden behind a completed phase.


## 2026-10-02 — Owner pilot Amendment 1 implemented (P5.5a–e, P7.1/P7.3/P7.5, P8.3)

Implemented the accepted senior response and amendment across the existing modular
boundaries. J1–J5 replaces the personal issuer-confirmation roadblock for this one-owner
pilot with per-trade current primary documents/restriction manifests, signed expiring
representations and a privately dated owner local-law decision. Exact dual economic
interpretation, current-session NVDA, USDT age/peg, P1–P9, fresh mid and absolute gas
caps are implemented; source history survives restart and profile revision. Pending
or changed multipliers and changed documents still invalidate records/approvals.

Exact external approval must belong to the signed initial bootstrap. Successful pilot
fills require zero allowance at the canonical receipt block; anomalies pause once and
keep submitted funds reserved. Immutable original receipts/balances support R1-only
owner-signed correction, with two explicitly reviewed independent upstreams, identical
logs/raw/gas, complete finalized ledger equality and append-only revisions. Browser
Review exposes the exact correction; original fill/accounting remains intact, replay
is idempotent, competing corrections reject and trading stays paused. Resync cannot
reset a disputed fill. Migration 0010 and profile/manual records v2 are required.

The expanded project checks passed 243 application and three research tests, zero
failures/skips, PostgreSQL enabled, typecheck and both builds. Browser and final
verification are recorded in the final entry below. Public register discovery and v2
free-price diagnostics succeeded; both raw/display premiums were within the declared
band in the sampled observation, but it was outside regular session. This is not
current-session liveness, economic legal review or trade permission. Private wallet
candidates are disabled and outside Git/MCP. No allowance or trade was submitted.

Open first-fill gates: private reviewed current restriction/control/company/provider
records, dated owner decision, fresh v2 declaration, funded EOA, exact allowance/trade
signatures and actual mainnet receipt/restart acceptance. R1 source independence is
not yet reviewed for the public endpoint candidates; needed only if an incident
requires correction. R2/R3 general repair, public legal/issuer API/source-use terms,
unattended scheduling/post-fill refresh, baskets and release gates remain deferred.
See [runbook](runbooks/owner-pilot.md) and
[verification](integrations/2026-10-02-pilot-amendment-verification.json).

- Final expanded browser suite passed all 18 Chromium cases, including valid/tampered
  R1 signing and real PostgreSQL HTTP owner/origin/body/session boundaries. Together
  with the passing 243 application plus three research tests, this closes the
  amendment's engineering verification. Owner/mainnet, source independence for R1,
  public-service and general repair gates listed above remain open.

## 2026-10-02 — P5.5e/P7.1/P7.2/P7.5/P9.4 EOA acceptance runner ready

Implemented the requested local EOA test script and
[run instructions](runbooks/eoa-pilot-runner.md). Check/default run collect private
diagnostics without signing or portfolio mutation. Live allowance/run require the
reviewed configuration flag and --broadcast plus exact per-action confirmation.
Key material stays local; the script uses normal signed bootstrap/planning/gate,
persisted exact bytes, one-time claim and canonical receipt-effect recovery. Exact
external allowance remains separate and precedes bootstrap. No second buy or live
exit sale was added; the buy/sell round trip remains local simulation.

Collection is mandatory: privately retained source/scanner/control/feed/gate/quote/
round-trip evidence, signatures/receipts/raw effects/zero allowance, database
revision/reservation history, recovery provenance and no-duplicate worker replay.
Operator locks, input collision guards and scoped recovery preserve isolation.
[ADR 0032](decisions/0032-supervised-eoa-acceptance-runner.md) records boundaries.

Final PostgreSQL-backed ./scripts/check.sh passed **257 application plus three
research tests**, zero failures/skips, strict typecheck and both builds; **18 browser
cases passed**. Launcher/help and actual isolated-schema read-only CLI smoke passed:
private packets collected, zero portfolios/sessions/legs/signatures/sends created.

Remaining: owner supplies current reviewed private v2 records/local-law decision
and funded intended EOA, explicitly signs declaration/setup/trade and runs the actual
mainnet receipt plus process-restart procedure. The agent sent no mainnet transactions.
Strict admission/default-disabled broadcasting, deferred independent review, R1
qualification, R2/R3, public legal/API/source-use and wider release remain open.
No phase exit is closed by writing the script alone.
