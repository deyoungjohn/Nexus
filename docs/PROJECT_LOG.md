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
