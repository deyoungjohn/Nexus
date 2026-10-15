# Nexus implementation plan

Source: [Nexus blueprint](../Nexus.md), version 1.0, September 25, 2026.
Last updated: 2026-10-02. Owner/client for the current work: Codex.

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

Current work follows the owner-only pilot sequence at the end of this document.
ADR 0031 changes admission only for that scope; earlier dated requirements below
remain historical context or the strict general-production default.

| Phase | Scope and ordered work items | Exit evidence | Status |
|---|---|---|---|
| P0 — Blueprint and delivery contract | P0.1 map requirements and dependencies; P0.2 establish specifications, decision records, engineering log and check entry point | Roadmap and first module specification recorded in repository documents; passing baseline | Complete |
| P1 — Domain foundation | P1.1 strict TypeScript/test/build setup; P1.2 exact denominated quantities; P1.3 exact instrument identity; P1.4 deterministic cash budget allocation | 22 named tests including 1,000 generated cases; typecheck/build; synthetic demo; see engineering log | Complete |
| P2 — Integration feasibility | P2.1 verify BSC settlement token and 2–3 equity instruments; P2.2 inspect actual API fields, timestamps and quantity semantics; P2.3 verify quote, sender/spender/recipient, simulation, approval and receipt capabilities; P2.4 choose earnings/calendar source | [Integration matrix](integrations/2026-09-25-phase-2.md) identifies exact BSC candidates, API gaps and raw/display quantity scaling; a bounded V3 route, owner-authorized approval and mainnet swap were previewed, mined and reconciled; issuer IR selected for manual confirmed events. Production eligibility, freshness, audit and recovery remain P5/P7 gates | Complete |
| P3 — Durable portfolio ledger | P3.1 PostgreSQL schema/migrations for portfolios, revisions, policies, evidence and records; P3.2 transactional cash/inventory reservations; P3.3 unique occurrences, idempotency keys and outbox; P3.4 durable worker and restart recovery | PostgreSQL 16 integration suite: concurrent 80+80 requests on 100 units cannot overspend; rollback/retry/restart tests; one executing batch; submitted reservations survive lease expiry. See [specification 0002](specifications/0002-durable-ledger.md) and [ADR 0004](decisions/0004-postgresql-ledger.md) | Complete |
| P4 — Portfolio Coordinator | P4.1 reconciled snapshot and policy inputs; P4.2 mandatory reductions, priorities and exact-instrument netting; P4.3 conservative company/sector/issuer/cash constraints; P4.4 decision reasons, reservations and revisions | Pure blueprint NVDA/AMD sequence and adversarial limits; real PostgreSQL decision/reservation, policy/revision, registry and concurrent-snapshot tests. See [specification 0003](specifications/0003-portfolio-coordinator.md) and [ADR 0005](decisions/0005-coordinator-sequential-bounds.md) | Complete |
| P5 — Market Gate and data adapters | P5.1 eligibility and quantity compatibility; P5.2 separate reference/session/quote clocks; P5.3 event and corporate-action restrictions; P5.4 actual-size quote, cost-aware constraints and simulation evidence | Pure fail-closed gate and read-only adapter seam, full-size P4 recheck, decoded direct-V3 route, hash binding; missing/stale/mapping/holiday/DST/recipient/spender tests. See [specification 0004](specifications/0004-market-gate.md) and [ADR 0006](decisions/0006-market-evidence-boundary.md). Production evidence providers remain unavailable | Complete as offline gate; live blocked |
| P5.5 — Live evidence readiness | P5.5a source-timestamped equity feed; P5.5b provider-specific on-chain quantity and corporate-action checks, now BEP-677 bStocks first; P5.5c wallet/venue/provider eligibility, exchange calendar and issuer events; P5.5d settlement valuation, token-risk policy and end-to-end live evidence verification; P5.5e exact selected-provider BSC venue/route feasibility | Production input for every P5 field, verified under the approved market-session policy; provider failures and unavailable eligibility block. [Live-readiness matrix](integrations/2026-09-26-live-readiness.md), [bStocks BSC route matrix](integrations/2026-09-27-bstocks-bsc.md), [BSC liquidity snapshot](research/2026-09-27-bsc-stock-liquidity.md), [issuer-event runbook](runbooks/issuer-event-review.md), [ADR 0012](decisions/0012-bstocks-first-bsc-provider.md), [ADR 0013](decisions/0013-bstocks-display-mapping-boundary.md) and [ADR 0014](decisions/0014-bstocks-transfer-preflight-boundary.md) | In progress: direct canonical NVDAB route and strict source/security collectors implemented. ADR 0031 adds a separate owner-only capped profile, private access/economic/event review ports, actual-owner local round-trip proof and sampled price diagnostics. Current qualified country/denomination/notice records, funding/allowance and actual mainnet acceptance remain open; strict scanner/review requirements are deferred only within the explicit pilot. Ondo/xStocks remain dormant |
| P6 — Rules and scheduling | P6.1 strict rule schema and deterministic validation; P6.2 basket schedule and occurrence IDs with IANA timezone; P6.3 typed conditional rule; P6.4 earnings freeze/reduction and allocation scope; P6.5 optional LLM drafting boundary | Unknown fields/tokens/signals rejected; no invented parameters; activation distinct from approval; schedule retries and DST do not duplicate proposals; shifted/unconfirmed events suspend dependent rules | Durable offline increment implemented: immutable reviewed versions, atomic occurrence/P4 reservations, restart/concurrency/rollback tests, event freezes and revision-pinned allocation bounds. Saved basket/price review UX is connected. Trusted production inputs, scheduled runtime source wiring and allocation refresh after P7 fills remain; optional LLM drafting is deferred. See [specification 0005](specifications/0005-rules-and-scheduling.md) |
| P7 — Sequential execution and reconciliation | P7.1 exact owner approval binding and pre-leg checks; P7.2 persisted transaction identity before submission where supported; P7.3 included/confirmed/replaced/unknown states; P7.4 sell-confirm-replan-buy; P7.5 partial baskets, recovery and reorgs | Timeout never causes blind resubmission; crash after fill cannot duplicate; $75/$25 partial example; stale approval, policy change, pause and external wallet change tests | In progress: exact signed-byte persistence, one-time claim, canonical receipt/effect recovery and guarded server runtime are implemented. ADR 0031 adds renewable signing, owner-signed finalized bootstrap/resync, trusted nonce anchor and logarithmic diagnosis, with PostgreSQL/browser evidence. Actual owner fill/restart acceptance, complete external activity classification and disputed/general repair remain open; no unresolved leg can be released by resync |
| P8 — Web product workflow | P8.1 Next.js shell and wallet discovery; P8.2 Overview and Plan; P8.3 Review with bounds/evidence/expiry and explicit approval; P8.4 Activity receipts, recovery, settings and pause | End-to-end setup → interpreted rule → preview → approval → reconciled receipt; clear fixture/live labels; downloadable records; usable keyboard/error/loading states | In progress: fixture and owner-authenticated saved rules/records retained. Exact trade approval/persist/submit plus paused signed bootstrap/resync and configured owner-only one-buy planning are connected. Pilot disclosures preserve deferred reviews/scanner unknowns and true price ages. Actual qualified sources, owner signatures/mainnet outcome and wider public eligibility/accessibility qualification remain open; sign-in grants no trade permission |
| P9 — Release validation and demonstration | P9.1 adversarial integration suite; P9.2 source and secret review; P9.3 operational runbooks; P9.4 authorized small-value mainnet demonstration; P9.5 four-minute demo and factual limitations | Blueprint section 11 scenarios mapped to passing tests or explicit release blockers; actual chain evidence; measured duplicate/unaccounted/stale execution counts; reproducible setup | Release not complete: owner-pilot runbook and regression/browser preparation exist; authorized actual mainnet acceptance and general-release evidence remain open |
| P10 — Optional account/atomic milestone | P10.1 compatibility decision; P10.2 non-upgradeable account and narrow swap adapter; P10.3 signatures, replay, bounds, pause and withdrawal invalidation; P10.4 review and explicit owner migration | Foundry adversarial/fuzz/fork tests for exact routes and tokens; independent security review before production custody; otherwise retain wallet-native MVP | Deferred |

P1 is offline groundwork; P2 established a single supervised live route and
documented production blockers. It does not enable the application to trade.
P3–P5 are complete as durable ledger, offline coordinator and offline market gate. P5.5 is the active bStocks-first live-readiness follow-up. P6 and non-live P7 work may now advance alongside it using synthetic fixtures; a live leg still requires completed P5.5 evidence and P7 recovery. The P2 Ondo trade is historical feasibility evidence, not a bStocks route. Live P5 evidence providers remain incomplete, and P7 must bind approvals and recovery before trading. P8 retains its labelled fixture interface and now connects a saved authenticated workspace to P3/P4/P6/P7 records. Execution screens must still connect fresh P5 evidence and exact P7 approvals and must not imply unimplemented guarantees.

P5.5d control review now tracks the current token's mint/burn switches and
external compliance/pause-manager role-set revisions in the read-only bStocks
snapshot. This is change detection, not a supported token audit or a risk
exception. Route-specific jurisdiction/user eligibility and timely reference/issuer-event
evidence still block production registration.

2026-09-30 P5.5d/P7.1 increment: full-token security module, public inspection
CLI and empty trusted review registry implemented. Both stock and settlement
must have current supported provider evidence, complete verified source/control
coverage and qualified contract-scope review; plain `clear` labels cannot pass.
Exact token/profile/decimals, canonical block/hash, privilege account runtimes,
code/role/control revisions and review hashes invalidate stale approval.
Quantity and transfer readers now use EIP-1898 with final canonical checks.
[ADR 0026](decisions/0026-full-token-security-evidence.md),
[specification 0008](specifications/0008-token-security.md) and
[dated report](integrations/2026-09-30-full-token-security.md) preserve the design.
This completes the enforcement increment, not P5.5 risk clearance: NVDAB scan
coverage/production beacon-source integration and independent reviews are missing; mint/creator-warning
findings remain blocked under the strict initial policy. Live market/runtime
and guarded broadcaster qualification remain open. No exception is approved.

P5.5c now requires two independently revisioned event sources for bStocks:
the underlying company's announcements and token-specific issuer/venue
notices. P5 now has a separate provider-event field and fail-closed check for
the canonical `bstocks` issuer ID, with tests for missing/stale/restricted
records and revision hashing. A reviewed production notice source, exact
instrument registration and P7 approval invalidation remain open; manual
review alone does not clear the gate. [ADR 0015](decisions/0015-bstocks-dual-event-review.md)
and the [event runbook](runbooks/issuer-event-review.md) record the requirement.

2026-09-28 owner-directed wallet priority: build P7 and P8 for direct,
owner-approved EOA transactions first. The execution boundary remains wallet-
neutral; Agentic Wallet is an optional later adapter, and the P10 custody
account remains deferred. P7 must bind each EOA signature to exact chain,
token, amount, spender, route, minimum output, deadline and plan revision, then
track transaction identity and reconcile each sequential fill. No unattended
EOA automation is implied. [ADR 0016](decisions/0016-eoa-first-wallet-execution.md)
separates wallet control from provider eligibility. For direct bStocks DEX
use, current provider-supported jurisdiction and actual-wallet transfer checks
remain gates; do not require a Binance account status unless the chosen route
or applicable terms actually require it. P5 `EligibilityEvidence` must reflect
the reviewed route-specific requirements, not a universal account prerequisite.
The [bStocks access-control runbook](runbooks/bstocks-access-control.md)
specifies user-to-EOA binding, reviewed jurisdiction evidence, the official
country result, product restrictions, exact-route on-chain checks, server-side
blocking and pre-leg revalidation. It is a P5.5c implementation gate, not a
live eligibility result. The P5.5c composer and P5 binding are now implemented
in `src/market-gate/bstocks-access.ts` and tested against synthetic source
fixtures; [ADR 0018](decisions/0018-bstocks-access-evidence.md) records the
trust boundary. Production remains blocked until the official country
endpoint/schema, reviewed user-jurisdiction and product sources and a server
session/challenge store are integrated and tested. The composer does not imply
that Nigeria or any particular person is eligible.

## Scope preserved from the blueprint

MVP: one portfolio, one settlement token, two or three verified equity
instruments; one basket, one conditional rule, one earnings control; owner
approval; sequential execution; inspectable evidence and recoverable outcomes.

Deferred: Telegram/product MCP interfaces (shared developer memory remains),
arbitrary tokens, automatic issuer switching, predictive earnings trading, unrestricted
news interpretation, delegation, monetization and optional atomic custody.

## Continuation protocol

For senior-engineering assistance, use the October 2
[unresolved-challenges handoff](SENIOR_ENGINEER_HANDOFF.md). Its U01–U15 register
maps current obstacles to existing P5.5/P6/P7/P8/P9 work items and separates
external requirements from Nexus policy choices. It proposes an order of work;
it does not revise phase status, authorize a pilot or defer a gate automatically.

Read `PROJECT_STATE.md`, this plan, the latest engineering/changelog entries and
applicable ADRs; search shared memory; establish the check baseline. Select the
first unfinished item whose prerequisites are satisfied. Never mark a live
integration or recovery gate complete from mocks. Update this table at exits.


2026-09-30 source constraint: prefer free stock/reference sources and the
owner-supplied public BSC RPC; qualify historical recovery coverage before P7
use. Dated probes found missing historical state and equity rounds beyond the
current age limit. [Free-source readiness](integrations/2026-09-30-free-source-readiness.md)
records the evidence. The subsequent
[Chainlist historical RPC survey](integrations/2026-09-30-chainlist-recovery-rpc.md)
found Sentio and Blockmachine candidates serving matching historical native/
ERC20 balances, receipts and logs and passing the existing P7 readers. Source
capability is now demonstrated at sampled blocks back to June 2024; trusted
worker/registry wiring is now implemented by ADR 0024; stock semantics,
source retention/availability and production execution qualification remain. A terms/declaration
modal may support onboarding, but is
not an approved substitute for ADR 0018's country/product/transfer evidence.
The reviewed FAQ does not establish universal compulsory integration contact
or paid KYC; exact requirements and the country endpoint still need review.

## P5.5c/P5.5e — Access dependency and provider reassessment (2026-09-30)

[Verification challenges](verificaton-challenges.md) records the bStocks
external documentation/verification dependency and the current xStocks/Ondo
primary-source comparison. This is research; ADR 0012's bStocks-first decision
and ADR 0018's access policy remain unchanged. No new architecture or live
permission is introduced.

- P5.5c: obtain verified bStocks country endpoint/schema and accepted
  verification guidance through published sources or the issuer integration
  channel. Distinguish issuer-controlled decisions from Nexus's evidence-policy
  choices; ordinary Binance support is not the only possible source.
- P5.5c: review Ondo secondary-market requirements separately from direct
  issuer onboarding. Review xStocks platform compliance/partner scope and
  issuer account country restrictions; token transferability alone is not
  eligibility. Define route-specific user evidence before wiring either path.
- P5.5e: [regular-session Ondo BSC reassessment](research/2026-09-30-ondo-bsc-secondary-routes.md)
  completed read-only: 458 instruments discovered, 25 sampled at four sizes,
  direct NVDA router bounds and full input/net output conditionally simulated.
  AAPL's direct pool consumes only a tiny fraction of the requested input;
  aggregator alternatives need decoder/intermediate-token review and can
  reintroduce bStocks. This is route feasibility, not a live-gate pass.
- P5.5a/P5.5d: sampled NVDA/AAPL equity rounds remained over two hours old in
  the regular session and all three sampled Ondo audits were unsupported.
  Qualify fresh free references, supported risk/events and the reviewed access
  process before a proposed pivot. Keep xStocks reassessment conditional on
  current actual-size bounds; the Sunday survey remains historical evidence.
- Pivot exit evidence: a reviewed access process, exact provider/token/venue
  identity, current bounded quote/simulation and remaining P5.5/P7 prerequisites;
  record any approved switch in a new ADR and update plan/state. A chain change
  requires its own scope decision. No automatic provider fallback is authorized.
- Parallel prerequisites: free-source freshness/historical RPC qualification,
  supported risk/economic mapping, event sources and P7 production recovery
  work remain open independently of issuer support response time.

## P7.3/P7.5 — Historical RPC discovery (2026-09-30)

The [dated Chainlist survey](integrations/2026-09-30-chainlist-recovery-rpc.md)
screened 45 anonymous HTTPS candidates and verified five more deeply. Four
passed the sampled core P7 read interfaces; three also passed standalone log
queries. Prefer Sentio for the next recovery-source qualification, with
Blockmachine as a backup candidate. Both replayed the earlier Ondo failed block
and the historical bStocks route block through `fetchBscTrackedBalances`.
These are public contract and sampled receipt checks, not an intended wallet's
signed-leg/PostgreSQL reconciliation or automatic failover implementation.
At the survey exit, source/registry/runtime wiring, retention/limits review and
nonce/manual recovery remained. The next increment implements the wiring;
remaining P7/P5.5 gates still prevent broadcasting.

## P7.3/P7.5 — Production recovery wiring (2026-09-30)

Implemented `runBscRecoveryOnce`, the operator CLI (`npm run recovery:once`),
strict versioned registry/source/finality configuration, Sentio-first whole-
proof Blockmachine fallback and immutable migration 0007. Attempts bind safe
configuration snapshots/hashes; observations and reconciliations bind source,
block/hash and proof evidence atomically. One portfolio session lock and its
same database connection protect collection/apply across workers and crashes.
Unreconciled contradictory receipts now pause too. Completed legs continue to
be monitored; no transaction claim/broadcast exists in this runtime.

PostgreSQL cases verify unavailable/invalid/unsupported evidence stays frozen,
consumed-nonce ambiguity stays manual, concurrent workers cannot apply twice,
success and revert settle once, contradictory/deep reorgs pause, lost database
ownership prevents apply, and post-fill/pre-attempt-completion failure survives
restart without another fill. Public configured endpoints also passed historical
June-2024 balance/receipt reader smoke checks with matching digests. See
[ADR 0024](decisions/0024-production-recovery-worker.md),
[operator runbook](runbooks/bsc-recovery-worker.md) and
[smoke evidence](integrations/2026-09-30-recovery-wiring.json).

At this wiring increment the supplied registry authorized native gas only;
the subsequent token review registers USDT/NVDAB for raw recovery accounting. Operators must
document and register reviewed semantics/decimals for every tracked ERC20 and
output; no live stock instrument was enabled. Review anonymous-source limits/
retention, schedule the runtime and close nonce/manual repair, active execution
policy/session, guarded-broadcaster and P5.5 gates before a live demonstration.
No production deployment, intended wallet or mainnet trade was used.

Verification: PostgreSQL-backed final `./scripts/check.sh` passed 147 tests,
zero failures/skips, strict typecheck and both builds. The production CLI
passed an isolated migrated empty-schema smoke check; memory retrieval and
`git diff --check` passed.

## P7.3/P7.5 — USDT/NVDAB raw recovery review and registry (2026-09-30)

Reviewed verified USDT and NVDAB proxy/implementation source, raw balances,
standard Transfer mutations and BEP-677 display-only events. The dated
[review/evidence](integrations/2026-09-30-token-recovery-semantics.md) records
source/runtime digests, public buy/sell receipts, matching public pool block
accounting and application guard checks on both configured sources.

Register USDT/NVDAB raw 18-decimal denominations with runtime/beacon identity
pins and versioned review IDs. Optional contract-review config fields preserve
older operator fixture APIs. Production recovery validates exact receipt-block
identity twice, blocking code changes and leaving unavailable views eligible
for complete-source fallback. Source review does not clear P5 risk, issuer
eligibility, economic mapping or price/event gates; beacon source/privileged
control review remains incomplete. No trade or provider pivot.

Unit and real PostgreSQL cases cover registry/evidence binding, changed code/
raw decimals/beacon/implementation, unavailable/reorged reads, UI double-count
prevention, a change after proof collection, and guarded fallback/once-only
settlement using actual token identities with explicitly synthetic source code.
Live guard checks separately validate the actual runtime pins. ADR 0025 records
the boundary. Complete nonce/manual repair, deployment qualification, active
execution policy/session, broadcaster and P5.5 remain gates.

Token-review verification: final PostgreSQL-backed `./scripts/check.sh` passed
154 tests, zero failures/skips, strict typecheck and both builds. Stored
source/accounting/guard consistency assertions, `git diff --check` and
supplementary memory write/retrieval passed.


## 2026-10-01 — P5.5d/P7.1 public source and governance follow-up

Completed public source recovery and governance inspection; see
[dated report](integrations/2026-10-01-bstocks-governance.md) and
[ADR 0027](decisions/0027-local-source-recovery-governance-evidence.md).
The missing NVDAB beacon is reproduced exactly, including metadata, from public
OpenZeppelin source. The two privileged proxies resolve to OperatorWallet and
BurnWallet; source rebuilds and Sentio/Blast same-block code/storage/roles plus
12 permission probes per source validate their current permissions. Shared proxy
administrator and beacon owner have immediate upgrade powers without an on-chain
threshold/delay in these paths. Off-chain key controls are not established.

Next P5.5d increment: integrate trusted locally recovered source provenance and
fresh inner proxy implementation/admin/owner/operator state into the security
collector, rejecting changes/unavailable views. This dated research is not a
qualified independent audit or a risk-review entry. Supported scanner coverage,
independent contract-scope reviews and explicitly approved risk policy remain
open; no scanner finding or centralized governance risk was silently accepted.
P5.5/P7 live gates remain open. Production recovery configuration is unchanged;
Blast passed these research reads, not complete recovery qualification.


## 2026-10-01 — P5.5d/P7.1 source/governance and independent-review intake increment

Completed the preceding next increment: exact recovered-source certificates,
canonical inner wallet governance with nine-component execution closure, explicit
scanner coverage and review-v2 publisher/artifact/component-scope verification.
CLI exposes current intake fingerprints. The dated
[results](integrations/2026-10-01-security-collector.md) and
[ADR 0028](decisions/0028-source-governance-and-independent-review-intake.md)
preserve interfaces, canonical quantity binding and strict risk blocking.

Remaining P5.5d gates: complete supported scanner coverage for both route assets,
qualified current independent contract/control reviews and an explicitly approved
policy for positive mint/shared-creator/governance findings. A verified historical
USDT report is a candidate only; the review registry remains empty. Public-source
recovery and software integration are complete for this profile, while external
review/coverage and risk acceptance are not. Other P5.5 economic/access/reference/
session/event and P7 guarded-runtime/production exit gates remain unchanged.
Building and PostgreSQL recovery testing can continue without enabling live trades.


## 2026-10-01 — P5.5/P7.1/P7.2/P7.5 production execution composition

Implemented the trusted USDT/NVDAB evidence assembly, immutable PostgreSQL reviews,
server-derived plan/policy/owner/registry/amount checks, exact signature persistence
and one-time raw broadcast after a committed unknown claim. Recovery configuration
is bound into policy and must cover every tracked denomination and ERC20 code path.
Stable access revision plus original/current complete gates allow receipt/head refresh
within the original lease; changed approval facts require a new signature. Actual
simulated fills and full signed gas ceilings are checked. Synthetic PostgreSQL flow
now spans review, persistence, send, historical receipt-effect recovery and repeat
monitoring without double-counting. See [ADR 0029](decisions/0029-production-eoa-evidence-orchestration.md)
and [runbook](runbooks/eoa-execution.md).

Next gates: qualify production quote/real-state simulation and portfolio/event/access/
economic sources; obtain qualified current independent reviews and complete scanner
coverage; approve a reviewed governance-risk policy; wire exact approval UX and chain
initialization into P8; complete operational/manual repair and authorized mainnet
acceptance evidence. Broadcasting remains disabled by default. P5.5/P7 are not closed.


## 2026-10-01 — P5.5e/P7.1/P8.3/P8.4 route and web binding

Implemented canonical actual-size buy/sell quotes and real-state simulation for
USDT/NVDAB, with venue code/identity/liquidity, fee-feed, gas, allowance and reorg
checks. Trusted runtime auto-composes the ports and binds route configuration.
The authenticated web panel now connects server review → explicit typed approval →
raw signature persistence → separate guarded submission → Activity/recovery.
Unconfigured deployments stay unavailable; unsupported raw signing has an explicit
import path. Production sources/scanner/review/risk policy, trusted chain initialization,
funded-wallet acceptance and operational repair remain open. ADR 0030 and the dated
route-adapter smoke distinguish public quoting from live eligibility/clearance.

## 2026-10-02 — Active owner-only pilot work order (ADR 0031)

The owner directed implementation of the senior response. The modular monolith is
retained: `src/pilot/` composes existing market, coordinator, ledger and execution
boundaries; web handlers remain owner/auth/origin guarded. This narrow profile
supersedes strict-only pilot requirements, without qualifying public users or
marking external reviews/scanners complete. No new provider pivot or custody module.

| Ordered work | IDs | Status and next evidence |
| --- | --- | --- |
| Recover ADGM prospectus and published free-feed heartbeat | P5.5a/b/c | Implemented/recovered; current jurisdiction permission and economic denomination still require explicit qualified review |
| Versioned owner-only one-buy ≤5-USDT admission | P5.5d/P7.1 | Implemented; independent review deferred, scanner gaps/findings retained, strict default unchanged |
| Private manual access/mapping/company/provider records; declaration export | P5.5b/c | Implemented and tested; actual current signed records are not configured |
| Same-block actual-wallet Anvil buy/sell and exact external allowance receipt | P5.5d/e | Implemented/tested; actual owner funding/allowance and complete round trip remain live evidence |
| True reference/settlement ages, worst signed fill band and renewable signing clock | P5.5a/d/P7.1 | Implemented/tested; sampled monitoring command added, candidate price parameters require review; no background monitor |
| Paused finalized owner-signed bootstrap/resync and trusted nonce anchor | P7.3/P7.5/P8.4 | Implemented with migration 0009 and browser/PostgreSQL tests; actual owner activation pending |
| Logarithmic canonical nonce diagnosis | P7.3 | Implemented/tested across a distant synthetic transition; archive RPC availability remains operationally qualified, replacement effects not adopted |
| Owner-only one-trade plan → existing exact web approval/persist/submit | P7.1/P7.2/P8.3 | Implemented/tested; broadcast defaults disabled; new profile/portfolio does not reset cap |
| One actual mainnet fill, receipt effects, reconciliation, restart without duplicate | P7.5/P9.4 | Open: current qualified records, funding, fresh exact signatures and supervised acceptance packet required |

Implementation verification passed 231 application plus three research tests, zero
failures/skips, strict typecheck and both builds; 16 Chromium cases passed. Real Anvil
startup/canonical fork was exercised without any simulated trade or mainnet write.
Owner-specific inspection output is private; it is not a completed live acceptance.
[Runbook](runbooks/owner-pilot.md), [sources](integrations/2026-10-02-owner-pilot-sources.md)
and [senior questions](SENIOR_ENGINEER_FOLLOWUP.md) preserve continuation context.

Sequentially after the real fill: P6 unattended scheduler/trusted rule inputs and
post-fill allocation refresh, P7 general/disputed-fill repair and complete external
activity classification, P8 wider user setup/eligibility UX, P9 public legal/source-use/
operations qualification and demonstration. Baskets/additional providers and optional
custody remain separate roadmap items. Pilot resync cannot release unresolved signed,
submitted, replaced or reorged legs; it is not general accounting repair.


## 2026-10-02 — Active ADR 0031 Amendment 1 evidence work

The owner directed implementation of [Amendment 1](0031-amendment-1-pilot-evidence-rules.md)
and [response002](response002.md). This supersedes the older pending pilot permission,
ratio and disputed-fill suggestions; the dated rows above retain their original status.

| Work IDs | Amendment outcome | Remaining owner/live evidence |
| --- | --- | --- |
| P5.5b/c | J1–J5 current register/restriction digests, denied/unknown handling, signed private representations and dated local decision; no affirmative issuer sign-off | Private reviewed lists/notices, local-law decision and fresh v2 declaration |
| P5.5a/c/d | Revisioned dual mapping until cited clause; larger exposure, exact dual price limits, current-session NVDA, USDT 1,350 s/50 bps, P1–P9 and persistent cadence | Current signed mapping/control/event records and within-bound live route |
| P5.5e/P7.1 | Fresh guarded pool mid and separately reviewed absolute gas ceilings; exact source clocks and approval invalidation retained | Funded-wallet real-state round trip and fresh bounded signatures |
| P7.3/P7.5 | Pre-bootstrap exact external approval; per-leg canonical zero post-fill allowance, idempotent incident pause and immutable full fill proof | Actual owner setup/receipt/restart acceptance |
| P7.3/P7.5/P8.3 | R1-only two-independent-source finalized proof, owner-signed append-only correction/revision, no accounting change, pause/idempotency and web review | Reviewed independent upstream configuration and actual incident evidence if needed; not a prerequisite for a normal first fill |
| U11 / P7 general repair | R2 reversal/replacement and R3 wait/cancellation remain manual incident procedures | Separate general repair ADR and implementation |

Migrate through `0010_pilot_evidence.sql` before deploying; records/profile v2 invalidate
legacy pilot approvals. Modular architecture, strict defaults, truthful scanner gaps,
one-buy wallet cap, exact owner approval and persist-before-broadcast remain compatible.
Public legal/issuer API terms, unattended scheduling, post-fill allocations, baskets and
release gates remain separate. Engineering tests are not mainnet or legal clearance.

## 2026-10-02 — Supervised funded-EOA acceptance runner

Work order P5.5e/P7.1/P7.2/P7.5/P9.4, [ADR 0032](decisions/0032-supervised-eoa-acceptance-runner.md).
The owner requested local key input, small transactions, default evidence collection
and explicit broadcasting instructions. `pilot:eoa` composes the existing services;
module boundaries, one-buy cap, strict default and amendment controls remain intact.

| Work IDs | Implementation | Remaining evidence |
| --- | --- | --- |
| P5.5e/P7.1 | Local check/declaration and production market-evidence collection with no fabricated reviews | Actual current private v2 records, funded EOA and live in-session passing gate |
| P7.2 | Exact external setup before bootstrap; separate confirmed sign/persist/send with file flag plus --broadcast | Actual owner approval and exact swap, no unknown resend |
| P7.5/P9.4 | Private durable source/receipt/ledger/recovery packet; scoped worker and no-duplicate replay | Owner-run mainnet receipt/zero allowance and actual process restart packet |

Run [the operator procedure](runbooks/eoa-pilot-runner.md). Live acceptance remains
open until real evidence exists; synthetic checks do not qualify public access,
commission review or implement a second/mainnet exit trade. R1/R2/R3 scope is unchanged.

Verification passed 257 application plus three research tests with PostgreSQL, no
failures/skips, typecheck and both builds; 18 Chromium cases passed. Real read-only
check/default-run CLI smoke retained private evidence and created no portfolio,
session or leg in its isolated migrated schema. Owner mainnet acceptance stays open.
