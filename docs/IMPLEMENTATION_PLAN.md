# Nexus implementation plan

Source: [Nexus blueprint](../Nexus.md), version 1.0, September 25, 2026.
Last updated: 2026-09-27. Owner/client for the current work: Codex.

## Delivery rules

Build a modular monolith, one tested module at a time. Phase completion means
its exit evidence exists, not merely that scaffolding exists. Dates in the
blueprint are planning estimates, not deadlines. No live trade is authorized by
this engineering plan. Use labelled synthetic data until integration evidence
exists. Preserve the owner-approved, sequential MVP and defer optional custody.

For every work item, record its ID, requirement, components, behavior change,
checks and outcomes in [the engineering log](ENGINEERING_LOG.md). Record bugs
with reproduction, cause, fix, regression check and lesson. Record pivots and
significant choices in `docs/decisions/`, and link them from the log. Update
`PROJECT_STATE.md` and append `CHANGELOG.md` at each completed increment.
Run `./scripts/check.sh` before and after every material change; record baseline
failures separately. Store only durable, non-secret summaries in shared MCP
memory. The versioned documents remain authoritative across agents.

## Phases and exit criteria

| Phase | Scope and ordered work items | Exit evidence | Status |
|---|---|---|---|
| P0 — Blueprint and delivery contract | P0.1 map requirements and dependencies; P0.2 establish specifications, decision records, engineering log and check entry point | Roadmap and first module specification recorded in repository documents; passing baseline | Complete |
| P1 — Domain foundation | P1.1 strict TypeScript/test/build setup; P1.2 exact denominated quantities; P1.3 exact instrument identity; P1.4 deterministic cash budget allocation | 22 named tests including 1,000 generated cases; typecheck/build; synthetic demo; see engineering log | Complete |
| P2 — Integration feasibility | P2.1 verify BSC settlement token and 2–3 equity instruments; P2.2 inspect actual API fields, timestamps and quantity semantics; P2.3 verify quote, sender/spender/recipient, simulation, approval and receipt capabilities; P2.4 choose earnings/calendar source | [Integration matrix](integrations/2026-09-25-phase-2.md) identifies exact BSC candidates, API gaps and raw/display quantity scaling; a bounded V3 route, owner-authorized approval and mainnet swap were previewed, mined and reconciled; issuer IR selected for manual confirmed events. Production eligibility, freshness, audit and recovery remain P5/P7 gates | Complete |
| P3 — Durable portfolio ledger | P3.1 PostgreSQL schema/migrations for portfolios, revisions, policies, evidence and records; P3.2 transactional cash/inventory reservations; P3.3 unique occurrences, idempotency keys and outbox; P3.4 durable worker and restart recovery | PostgreSQL 16 integration suite: concurrent 80+80 requests on 100 units cannot overspend; rollback/retry/restart tests; one executing batch; submitted reservations survive lease expiry. See [specification 0002](specifications/0002-durable-ledger.md) and [ADR 0004](decisions/0004-postgresql-ledger.md) | Complete |
| P4 — Portfolio Coordinator | P4.1 reconciled snapshot and policy inputs; P4.2 mandatory reductions, priorities and exact-instrument netting; P4.3 conservative company/sector/issuer/cash constraints; P4.4 decision reasons, reservations and revisions | Pure blueprint NVDA/AMD sequence and adversarial limits; real PostgreSQL decision/reservation, policy/revision, registry and concurrent-snapshot tests. See [specification 0003](specifications/0003-portfolio-coordinator.md) and [ADR 0005](decisions/0005-coordinator-sequential-bounds.md) | Complete |
| P5 — Market Gate and data adapters | P5.1 eligibility and quantity compatibility; P5.2 separate reference/session/quote clocks; P5.3 event and corporate-action restrictions; P5.4 actual-size quote, cost-aware constraints and simulation evidence | Pure fail-closed gate and read-only adapter seam, full-size P4 recheck, decoded direct-V3 route, hash binding; missing/stale/mapping/holiday/DST/recipient/spender tests. See [specification 0004](specifications/0004-market-gate.md) and [ADR 0006](decisions/0006-market-evidence-boundary.md). Production evidence providers remain unavailable | Complete as offline gate; live blocked |
| P5.5 — Live evidence readiness | P5.5a source-timestamped equity feed; P5.5b provider-specific on-chain quantity and corporate-action checks, now BEP-677 bStocks first; P5.5c wallet/venue/provider eligibility, exchange calendar and issuer events; P5.5d settlement valuation, token-risk policy and end-to-end live evidence verification; P5.5e exact selected-provider BSC venue/route feasibility | Production input for every P5 field, verified under the approved market-session policy; provider failures and unavailable eligibility block. [Live-readiness matrix](integrations/2026-09-26-live-readiness.md), [bStocks BSC route matrix](integrations/2026-09-27-bstocks-bsc.md), [BSC liquidity snapshot](research/2026-09-27-bsc-stock-liquidity.md), [issuer-event runbook](runbooks/issuer-event-review.md), [ADR 0012](decisions/0012-bstocks-first-bsc-provider.md), [ADR 0013](decisions/0013-bstocks-display-mapping-boundary.md) and [ADR 0014](decisions/0014-bstocks-transfer-preflight-boundary.md) | In progress: direct NVDAB/USDT V3 route quoted, bounded and simulated read-only. Separate read-only BEP-677 and route-party transfer-control adapters pin raw/UI mapping, controls, pause state and compliance checks at one block. They do not establish P5 reference-share exposure, geographic/account eligibility or a token audit. Supported risk evidence, timely reference/settlement policy, issuer events and full Market Gate integration remain open. Wallet funding/allowance and P7 approval/recovery remain absent; no trade or application live adapter is enabled. Ondo/xStocks modules remain dormant |
| P6 — Rules and scheduling | P6.1 strict rule schema and deterministic validation; P6.2 basket schedule and occurrence IDs with IANA timezone; P6.3 typed conditional rule; P6.4 earnings freeze/reduction and allocation scope; P6.5 optional LLM drafting boundary | Unknown fields/tokens/signals rejected; no invented parameters; activation distinct from approval; schedule retries and DST do not duplicate proposals; shifted/unconfirmed events suspend dependent rules | Not started |
| P7 — Sequential execution and reconciliation | P7.1 exact owner approval binding and pre-leg checks; P7.2 persisted transaction identity before submission where supported; P7.3 included/confirmed/replaced/unknown states; P7.4 sell-confirm-replan-buy; P7.5 partial baskets, recovery and reorgs | Timeout never causes blind resubmission; crash after fill cannot duplicate; $75/$25 partial example; stale approval, policy change, pause and external wallet change tests | Not started |
| P8 — Web product workflow | P8.1 Next.js shell and wallet discovery; P8.2 Overview and Plan; P8.3 Review with bounds/evidence/expiry and explicit approval; P8.4 Activity receipts, recovery, settings and pause | End-to-end setup → interpreted rule → preview → approval → reconciled receipt; clear fixture/live labels; downloadable records; usable keyboard/error/loading states | Not started |
| P9 — Release validation and demonstration | P9.1 adversarial integration suite; P9.2 source and secret review; P9.3 operational runbooks; P9.4 authorized small-value mainnet demonstration; P9.5 four-minute demo and factual limitations | Blueprint section 11 scenarios mapped to passing tests or explicit release blockers; actual chain evidence; measured duplicate/unaccounted/stale execution counts; reproducible setup | Not started |
| P10 — Optional account/atomic milestone | P10.1 compatibility decision; P10.2 non-upgradeable account and narrow swap adapter; P10.3 signatures, replay, bounds, pause and withdrawal invalidation; P10.4 review and explicit owner migration | Foundry adversarial/fuzz/fork tests for exact routes and tokens; independent security review before production custody; otherwise retain wallet-native MVP | Deferred |

P1 is offline groundwork; P2 established a single supervised live route and
documented production blockers. It does not enable the application to trade.
P3–P5 are complete as durable ledger, offline coordinator and offline market gate. P5.5 is the active bStocks-first live-readiness follow-up before P6. The P2 Ondo trade is historical feasibility evidence, not a bStocks route. Live P5 evidence providers remain incomplete, and P7 must bind approvals and recovery before trading. P3–P7 provide a headless pipeline before P8 connects its screens. Interface
sketches may precede P8, but screens must not imply unimplemented guarantees.

## Scope preserved from the blueprint

MVP: one portfolio, one settlement token, two or three verified equity
instruments; one basket, one conditional rule, one earnings control; owner
approval; sequential execution; inspectable evidence and recoverable outcomes.

Deferred: Telegram/product MCP interfaces (shared developer memory remains),
arbitrary tokens, automatic issuer switching, predictive earnings trading, unrestricted
news interpretation, delegation, monetization and optional atomic custody.

## Continuation protocol

Read `PROJECT_STATE.md`, this plan, the latest engineering/changelog entries and
applicable ADRs; search shared memory; establish the check baseline. Select the
first unfinished item whose prerequisites are satisfied. Never mark a live
integration or recovery gate complete from mocks. Update this table at exits.
