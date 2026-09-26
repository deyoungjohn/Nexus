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
