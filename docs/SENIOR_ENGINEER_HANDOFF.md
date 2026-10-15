# Nexus: unresolved challenges and senior engineering handoff

Prepared: 2026-10-02. Author/client: Codex. Scope: P5.5, P6, P7, P8 and P9
release prerequisites. Application revision inspected: `5c7d541`, following
`dded685`, `a623baa` and `17e74dd`. This document describes the current workspace,
including earlier uncommitted research; it does not approve a trade or change
application behavior.

## 1. Why help is needed

Nexus has substantial tested infrastructure, but it has not completed its first
application-driven bStocks trade from a real EOA through final reconciliation.
The problem is no longer simply finding a pool or implementing a swap button.
We must align the available evidence, application policy, wallet capabilities
and operational recovery into a usable production path.

There are three different kinds of unfinished work:

1. **External evidence:** issuer access documentation, economic product terms,
   adequate current audit coverage and reliable source service characteristics.
2. **Engineering integration:** production evidence ports, chain-backed portfolio
   initialization, scheduling inputs, post-fill allocation refresh and repair tools.
3. **Product/risk decisions:** whether the current freshness and security rules
   are appropriate for tokenized securities and for a limited supervised MVP.

These must not be conflated. Contacting Binance will not implement the missing
server ports. Passing tests will not establish a person's eligibility. Obtaining
an audit PDF will not automatically satisfy scanners or accept issuer privileges.
Conversely, some of our current requirements are Nexus design choices, rather
than externally imposed obligations.

The owner wants an EOA-first product that works end to end, prefers free data
sources, and wants to defer commissioning a new audit while establishing the
functional MVP. This handoff preserves that direction. The senior engineer is
asked to help translate it into a concrete pilot scope and an explicit admission
policy. No Nexus-owned custody contract is needed for the current MVP; that is
the deferred P10 milestone. Existing token-security policy still needs to be
reconciled with the proposed pilot before its gate can pass.

### Reading order

Start with [PROJECT_STATE](PROJECT_STATE.md), [IMPLEMENTATION_PLAN](IMPLEMENTATION_PLAN.md),
the [blueprint](../Nexus.md), [ADR 0030](decisions/0030-bstocks-route-and-web-approval.md),
[execution runbook](runbooks/eoa-execution.md) and
[current security report](integrations/2026-10-01-security-collector.md).
Then use the challenge sections below to locate the relevant code and evidence.

Earlier integration reports are dated observations, not current authority.
Some retain historical statements such as “no execution path” or “beacon source
missing”; the October 1 implementation supersedes those particular gaps.

## 2. Intended product and preserved architecture

Nexus coordinates several investment rules against one portfolio on BNB Smart
Chain. Rules create intents; the coordinator resolves conflicts and limits;
the Market Gate validates evidence; the owner approves exact transactions;
execution proceeds sequentially and reconciles each outcome before dependent
work is replanned.

The blueprint's MVP calls for one portfolio, one settlement token, two or three
verified equity instruments, a basket, a conditional rule and an earnings
control. The currently assembled production path is narrower: **USDT/NVDAB**.
Supporting one trade is therefore a useful pilot, not full completion of that
MVP scope.

The architecture remains a modular monolith, using TypeScript/Node.js 22,
PostgreSQL and a Next.js web application. Wallets do not own planning or risk
policy. The browser cannot supply authoritative market evidence or register a
token as safe.

| Module | Responsibility | Main location | Current boundary |
| --- | --- | --- | --- |
| Domain | Exact units, instrument identity and deterministic allocation | `src/domain/` | Implemented; tickers are not identities |
| Ledger | Revisions, balances, reservations, idempotency and outbox | `src/ledger/`, `migrations/` | PostgreSQL-tested; caller-supplied balances alone are not chain proof |
| Coordinator | Net intents, reductions, priorities and concentration bounds | `src/coordinator/` | Implemented; needs trusted current valuations and reconciled snapshots |
| Rules | Canonical drafts, schedules, events and durable occurrences | `src/rules/` | Offline/durable logic implemented; production inputs and post-fill allocations unfinished |
| Market Gate | Eligibility, quantity, price/session/event/security and route checks | `src/market-gate/` | Implemented; several production sources missing |
| Security | Exact source/control closure, scanner coverage and report intake | `src/security/` | Collector implemented; current admission remains blocked |
| Execution/recovery | Exact approval, signed-byte storage, one-time submission, effect proof | `src/execution/` | Implemented and synthetically tested; real-wallet and operational gates open |
| Application/web | Authentication, saved rules, review and activity | `src/application/`, `web/` | Saved workspace and exact execution panel implemented; production configuration incomplete |

Important separations to preserve:

- Wallet sign-in, issuer eligibility, rule activation and trade approval are
  four different acts.
- Raw token balances, UI display quantities and underlying economic exposure
  are three different quantities.
- A router quote, an independent price bound and an actual receipt fill are
  three different kinds of evidence.
- New trading admission and recovery of already-submitted transactions are
  separate. A new risk warning cannot erase an existing fill or justify resend.

## 3. How we arrived here

| Period / decision | What happened | Continuing consequence |
| --- | --- | --- |
| P2, September 25–26 | Investigated Ondo through Binance Agentic Wallet. After network/session and Developer Mode issues were resolved, the owner approved an exact allowance and one bounded mainnet NVDAon trade; receipt, raw balances and allowance were reconciled. | Demonstrated a supervised route outside the current application executor. It does not validate today's bStocks/EOA path. |
| [ADR 0011](decisions/0011-xstocks-first-bsc-provider.md), September 26 | Prioritized xStocks to reduce expected Ondo onboarding friction. Added native-token/current-v2-wrapper quantity inspection. | Bare rebasing tokens and stable-share wrappers require different accounting; provider eligibility still applies. |
| September 27 liquidity survey | Surveyed 671 BSC securities-feed records. Only 4/96 equity-scoped xStocks and 23/329 Ondo returned 100-USDT wallet quotes, compared with 66/67 bStocks. Ondo results were affected by Sunday market-hour restrictions. | Liquidity must be measured at actual size and during relevant sessions; listings and quote success are insufficient. |
| [ADR 0012](decisions/0012-bstocks-first-bsc-provider.md), September 27 | Switched first-live-provider priority to bStocks because of deeper observed BSC liquidity; selected NVDAB/direct USDT V3 as the initial candidate. | bStocks remains the selected provider. Dormant Ondo/xStocks adapters are preserved; there is no automatic substitution. |
| [ADR 0016](decisions/0016-eoa-first-wallet-execution.md), September 28 | Prioritized direct, owner-approved EOA execution rather than dependence on Agentic Wallet. | Agentic Wallet is an optional later adapter. EOA control does not remove issuer restrictions or enable unattended signing. |
| September 30 | Built durable rules/saved workspace, recovered historical RPC candidates, wired recovery and reviewed raw USDT/NVDAB accounting. Reassessed Ondo in a regular session. | Historical-state discovery is substantially resolved; retention, ambiguous nonce history and repair remain. Ondo is a candidate, not an approved pivot. |
| October 1 | Recovered beacon source and privileged wallet governance; integrated security evidence, guarded execution orchestration, actual-size route adapters and web approval/storage/submission. | The main remaining work is qualification, production sources, initialization and operational acceptance, rather than missing basic execution classes. |

Evidence: [liquidity report/CSV](research/2026-09-27-bsc-stock-liquidity.md),
[xStocks matrix](integrations/2026-09-26-xstocks-bsc.md),
[bStocks matrix](integrations/2026-09-27-bstocks-bsc.md),
[Ondo reassessment](research/2026-09-30-ondo-bsc-secondary-routes.md).
All numerical liquidity results are historical samples, not current quotes.

## 4. What is demonstrated, and what is not

The current application can produce actual-size direct USDT/NVDAB quotes,
validate venue identity and exact calldata, and simulate against real balances
and allowance. The web flow can review an exact server-generated envelope,
request EIP-712 approval, accept a raw signed transaction, persist it, and
request a separate guarded submission. PostgreSQL fixtures exercise receipt-
effect recovery and repeat monitoring without counting a fill twice.

On October 1, the public quote adapter succeeded at BSC block **125153134**:
5 USDT quoted **21,500,926,434,853,864 raw NVDAB base units**, with bounded
minimum **21,393,421,802,679,595**. The synthetic unfunded address did not
produce simulation evidence. No real owner signature, allowance or bStocks
submission occurred. Smoke gas/feed settings were research settings, not an
approved live policy. [Route evidence](integrations/2026-10-01-bstocks-route-adapter.md).

Current exact route identities, all on chain 56:

| Component | Address / value |
| --- | --- |
| BSC USDT, 18 decimals | `0x55d398326f99059ff775485246999027b3197955` |
| NVDAB, 18 raw decimals | `0x02fca66c1d1afb4e2a7884261eb00f63598a7436` |
| Pancake V3 direct pool | `0x8fb4243b553ac29ba088acf00b9b7da24bd6690c` |
| Pool fee | `2500`, equivalent to 0.25% |
| Factory | `0x0bfbcf9fa4f9c56b0f40a671ad40e0805a091865` |
| Router | `0x1b81d678ffb9c0263b24a97847620c99d213eb14` |
| QuoterV2 | `0xb048bbc1ee6b733fffcfb9e9cef7375518e25997` |

**Not demonstrated:** a complete production P5 evidence bundle, a properly
initialized real-owner portfolio, real-wallet raw signing through this UI,
a current funded/approved bStocks simulation, a Nexus-driven bStocks mainnet
fill, or an operationally repaired ambiguous/reorged production ledger.

## 5. Unresolved challenge register

Priority describes the next path to a supervised live pilot. “External” does
not mean nothing can be done locally; it identifies facts we cannot invent.

| ID | Work items | Challenge | Primary nature | Senior engineer's deliverable |
| --- | --- | --- | --- | --- |
| U01 | P5.5c | bStocks country/person/product eligibility | External + policy + integration | Documented source and accepted verification flow |
| U02 | P5.5b/P5.5d | Raw/display/reference-exposure mapping | Evidence + financial model | Reviewed economic mapping and production adapter |
| U03 | P5.5a/P5.5d | Free reference freshness, settlement and gas bounds | Source qualification + policy | Measured source suitability and executable price policy |
| U04 | P5.5c/P6.4 | Underlying and provider events/session rules | Source + integration | Revisioned, expiring event evidence and failure handling |
| U05 | P5.5d/P7.1 | Incomplete scanner evidence | External coverage + policy | Supported evidence or a reviewed replacement model |
| U06 | P5.5d/P7.1 | Independent review scope and audit expectations | Policy + external evidence | MVP review decision and adequate evidence intake |
| U07 | P5.5d/P7.1 | Known issuer privileges versus strict risk policy | Risk architecture | Explicit token-specific admission and change handling |
| U08 | P5.5/P7.1/P8.3 | Null production ports and chain initialization | Engineering | Trusted bootstrap and complete source composition |
| U09 | P7.1/P7.2/P8.3 | EOA raw signing, allowance and real-state acceptance | Wallet integration | Tested intended-wallet flow and bounded approval handling |
| U10 | P7.3/P7.5 | RPC reliability and complete nonce history | Infrastructure + recovery | Source qualification and trustworthy ambiguous-nonce diagnosis |
| U11 | P7.5 | Manual accounting repair after ambiguity/deep reorg | Engineering + operations | Auditable repair procedure and regression evidence |
| U12 | P6.2–P6.4/P7.4 | Scheduled runtime and post-fill allocations | Engineering | Durable end-to-end rule execution/replanning |
| U13 | P5.5e/P8/P9 | Second asset/provider feasibility and MVP scope | Product + integration | Qualify more instruments or explicitly narrow pilot scope |
| U14 | P8.4/P9.1–P9.5 | Release operations, UX and real-chain acceptance | Engineering + operations | Reproducible release checklist and actual acceptance evidence |
| U15 | P0.2/P9.2/P9.3 | Portable records and execution-environment constraints | Repository/process | Commit-ready handoff, precise test claims and reproducible setup |

### U01 — bStocks eligibility and third-party access

The central issuer dependency is a usable specification for third-party access.
The [official FAQ, section 16](https://www.binance.com/en/support/faq/detail/f0c03cd6509a4085b4cce1636f16be38)
expects integrators to apply geographic controls and references a public
country-eligibility REST API. Its endpoint/schema was not found in the reviewed
material. The linked issuer site could not be retrieved from this environment.
This is not proof that no endpoint exists or that the site fails for everyone.

Nexus needs to distinguish wallet control, country permission, person-level
restrictions, product/venue permission and current on-chain transfer permission.
The access composer and negative tests exist, but trusted jurisdiction/country/
product sources are not connected. A general EOA session is also not yet
composed into the bStocks-specific session/binding port.

Neither a terms checkbox, VPN, open Binance trading page nor successful swap
simulation resolves these different facts. The current policy does not impose
a universal Binance-account requirement on direct EOA DEX use. Whether a
lighter declaration/location process is adequate remains a route-specific
review question; paid KYC and a bespoke issuer partnership are not established
as universally compulsory by the reviewed FAQ.

The request packet should ask for the official country endpoint/schema/access
terms, permitted third-party EOA flow, verification expectations, relevant
country decisions including Nigeria, integration agreements if applicable,
and authoritative product/security/event documents. Review obligations for
Nexus's actual service and target jurisdictions separately from technical
transferability. Engineering cannot grant issuer permission or substitute its
own country list for an unknown issuer decision.

Owner-requested email drafts were supplied in conversation; none were sent.
`vip@binance.com` is a published Binance VIP/Institutional contact and a possible
referral route, **not a verified bStocks inbox**. No direct bStocks email was
verified. [Published contact](https://www.binance.com/en/support/announcement/detail/208856ee107241f281d45bafec55de23).
An unanswered enquiry must not be recorded as an issuer rejection.

Inspect: `src/market-gate/bstocks-access.ts`, `bstocks-transfer.ts`,
[ADR 0018](decisions/0018-bstocks-access-evidence.md),
[access runbook](runbooks/bstocks-access-control.md),
[verification research](verificaton-challenges.md).

Acceptance: test allowed/denied/unknown outcomes from authentic documented
sources, person/location conflicts, restricted persons, expiry/revocation,
wallet/pool/router blocking, changed permissions and pre-submission rechecks.
Keep identity documents, personal eligibility records and session secrets out
of Git and shared memory.

### U02 — Economic exposure cannot be inferred from the UI multiplier

BEP-677 NVDAB keeps raw ERC20 operations separate from a mutable display
multiplier. The current collector reads raw decimals, current/pending multiplier,
effective time and control fingerprints at a canonical block. Raw transfers
are also registered for historical recovery.

Those implementations do not establish P5's reference-share economic ratio.
The planner needs that ratio to value holdings, compare an execution price and
apply company/sector/issuer concentration limits. Treating display-scaled units
as an unconditional legal share entitlement could misprice the token or
miscount exposure. Contract behavior alone cannot establish off-chain rights.

Review issuer product documents for the economic mapping, effective dates,
corporate-action adjustments, deductions, rounding and exceptional treatment.
Bind the reviewed mapping revision to the canonical snapshot and invalidate it
when relevant facts change. Implement `economicQuantity`; do not return a
fabricated ratio or automatically promote `uiMultiplier()` to `QuantityEvidence`.
If reference-share comparison is inappropriate for this product, explicitly
review a different economic model and update the coordinator/gate interfaces.

Inspect: `src/market-gate/bstocks-bsc.ts`, `bstocks-production.ts`,
[ADR 0013](decisions/0013-bstocks-display-mapping-boundary.md),
[raw accounting review](integrations/2026-09-30-token-recovery-semantics.md).
Acceptance must cover mapping changes, scheduled changes, wrong denominations,
rounding and agreement between exposure, display and raw execution accounting.

### U03 — Available free prices do not currently meet the execution policy

Pyth Pro was investigated but remains dormant because no Pro access is available.
Keyless Chainlink BSC equity, USDT/USD and BNB/USD readers exist. Availability
is not the same as suitability for the requested decision interval.

On September 30, the recorded NVDA and AAPL rounds were 959 and 1,186 seconds
old during one probe. A later regular-session Ondo probe observed the same
equity rounds roughly 130/134 minutes old. Both conflict with Nexus's current
60-second reference-age limit. These are historical observations; this handoff
has not collected a new live price sample.

The 60-second cutoff is our policy. Raising it mechanically would conceal the
mismatch rather than establish an execution strategy. The engineer should
measure update cadence and deviations over sessions, inspect permitted use,
and decide between a suitable faster source and a deliberately designed
delayed-reference policy. A last-close or delayed value must retain its actual
source time and cannot be presented as current simply because it was fetched now.
Public availability alone does not establish redistribution rights.

DEX prices and bStock exchange asks can screen a route, but substituting either
for the independent underlying reference changes the risk model. A slippage
minimum protects against deterioration from a quote; it does not prove that the
original quote is fairly priced.

Production settlement/gas parameters also need review: source age, valuation
uncertainty, USDT peg deviation, native gas ceilings and complete valuation of
all Nexus-tracked positions. The route adapter prices the entire approved gas
ceiling, rather than only an estimate. The smoke's one-hour fee-feed age and
300,000-gas/5-gwei caps are not production defaults to copy unreviewed.

Inspect: `chainlink-bsc.ts`, `bstocks-route.ts`, `bstocks-production.ts`,
[free-source findings](integrations/2026-09-30-free-source-readiness.md),
[ADR 0008](decisions/0008-keyless-bsc-market-reference.md).
[Chainlink guidance](https://docs.chain.link/data-feeds/selecting-data-feeds)
recommends evaluating source suitability, market hours and outage controls.
Acceptance: measured freshness/uncertainty and tests for source-time regression,
outages, delayed values, out-of-session use, depeg and excessive full gas cost.

### U04 — Earnings, corporate actions and market sessions need trusted records

There are two independent event streams: the underlying company's announcements
and the token issuer/venue's processing notices. One does not establish the
other. A company event can affect trading policy; a token-specific processing
event can affect mapping, transfer or service availability.

A manual direct-issuer review process was selected to avoid dependence on a paid
earnings feed. The data model and bStocks dual-event gate exist, but production
`event` and `providerEvent` ports are null. Dynamic/inaccessible issuer pages
were correctly treated as uncertainty, not “no upcoming event.”

Implement trusted, revisioned records with direct provenance, explicit event
times/timezones, effective windows, short expiry, corrections and withdrawal
handling. A reviewed manual intake may be sufficient initially if it supplies
real runtime evidence. Repeated documentation notes alone are not that adapter.
Provider notices require a separate interpretation of which service is paused;
one service remaining available does not clear every route.

The official NYSE holiday/early-close reader is implemented for reviewed
2026–2027 revisions. Emergency closures, asset-specific halts and off-hours
policy still need qualification. A bStock venue being open does not establish
that its underlying reference is usable. Earnings-rule creation in the saved
workspace is deliberately unavailable until trusted event records are connected.

Inspect: `src/market-gate/nyse-calendar.ts`, `binance-rwa-status.ts`,
`src/rules/`, [event runbook](runbooks/issuer-event-review.md),
[ADR 0015](decisions/0015-bstocks-dual-event-review.md).
Acceptance: changed/uncertain/withdrawn events, publisher revisions, holidays,
DST/early closes and restriction changes must suspend dependent execution.

### U05 — Scanner support is incomplete, and unknown fields block admission

The October 1 collector explicitly records coverage instead of turning missing
fields into false/zero values. The recorded results were:

| Asset | Binance required coverage | GoPlus required coverage | Remaining findings |
| --- | --- | --- | --- |
| BSC USDT | 5/7 | 21/22 | Binance MID/risk level 3, mint caution; GoPlus mint warning; missing categories/field |
| NVDAB | 0/7, unsupported | 7/22 | Fifteen unknown GoPlus fields and a shared-creator honeypot warning |

The shared-creator warning concerns another token; it does not prove NVDAB is
a honeypot. Unsupported Binance data likewise proves neither malice nor safety.
Its response does not disclose a definitive internal reason for noncoverage.

The current gate requires complete supported evidence from both providers.
Consequently even a good independent report would not by itself resolve these
coverage failures. Options are obtaining proper support, integrating another
qualified source, or explicitly redesigning how independently reviewed evidence
can satisfy particular missing checks. The last option is a policy/architecture
change with regression tests, not a flag or a forged “clear” record.

Inspect: `src/security/token-security.ts`, `bsc-token-security.ts`,
[specification 0008](specifications/0008-token-security.md),
[current report](integrations/2026-10-01-security-collector.md).
Acceptance must preserve positive findings while resolving coverage separately;
transient errors and empty responses cannot become passing assessments.

### U06 — Audit scope, independent judgment and MVP expectations

The missing assessment concerns **external tokens and their present control
paths**, not an undeployed Nexus custody contract. We should not describe a new
audit of “our contracts” as an inevitable prerequisite to every prototype.
The owner has asked to defer commissioning a new audit while proving the MVP.

Under the implemented policy, however, both USDT and NVDAB need qualified
current full-scope reviews. `config/token-security-reviews.json` is empty.
We recovered an EtherAuthority BSC USDT report dated April 3, 2025 and verified
its published bytes. It is a historical candidate: naming the correct address
does not establish the entire present source/control fingerprint or custody.
No matching full-scope NVDAB/control-contract report was recovered. The issuer's
statement that audits exist is not a substitute for inspecting the actual scope.

Review-v2 records bind exact asset, fingerprint, component/code/source closure,
report publisher/digest and five areas: transfers/taxes, balances/supply,
upgrades/delegation, privileged authority and external controls. Current intake
supports narrowly defined EtherAuthority and PeckShield publication namespaces
with immutable commit-pinned PDFs. Other competent reviewers may be usable,
but require a reviewed trust/intake change. The machine verifies provenance and
bytes, not whether the report supports the declared conclusions.

The review record has at most 24-hour validity. That is a revalidation boundary,
not a requirement to buy a new audit every day; unchanged code/control facts
still need a qualified renewal process. Automatically moving expiry timestamps
without revalidation would defeat its purpose.

Requested decision: distinguish a developer demonstration, a supervised limited
mainnet pilot and general live release. Establish which evidence each requires,
whether an existing adequate report can be used, and which costly work can be
deferred. If the pilot defers the existing independent-review requirement, record
that as a truthful, bounded change; do not represent deferred review as completed.
No new assessment was commissioned and no policy exception was implemented here.

Inspect: [ADR 0026](decisions/0026-full-token-security-evidence.md),
[ADR 0028](decisions/0028-source-governance-and-independent-review-intake.md),
[security runbook](runbooks/token-security.md), `review-publishers.ts`,
`review-artifact.ts` and the registry.

### U07 — Issuer privileges conflict with the initial all-clear policy

Public source/governance recovery has resolved the previously missing beacon
and two privileged wallet proxy implementations. The collector now covers nine
NVDAB executable components and eleven current privileged authorities.
Independent nearby-block Sentio/Blast observations agreed on full fingerprints.

Observed powers include beacon implementation upgrades, shared administrative
upgrades of OperatorWallet/BurnWallet, mutable ownership/roles and transfer
compliance/pause controls. OperatorWallet's owner can execute external calls;
its mint/transfer helpers and hot-wallet restrictions must be understood in
that context. The inspected BurnWallet burns its own holdings; we did not
establish an arbitrary-holder burn capability in that method. Upgrade authority
can nevertheless change future behavior.

Relevant controlling addresses lacked execution code at the inspected block.
No on-chain threshold or timelock was established for those paths. That says
nothing definitive about off-chain MPC or the organization's key custody.
Source matching proves correspondence, not security or reserves.

The initial policy blocks all detected risk/caution findings, positive taxes,
alerts and Binance risk levels above 1. It may be unsuitable for admitting
issuer-managed tokenized securities whose known controls are intrinsic to the
product. That is a substantive design tension to resolve, not an excuse to
hide capabilities. Current code has no accepted-risk mechanism.

Requested deliverable: a token-specific policy distinguishing tolerable known
capabilities, unknown evidence and unacceptable behavior; exact authority/code
binding; exposure and allowance caps; change monitoring; expiry/revocation;
and suspension on changed control facts. Limits reduce impact but cannot
eliminate issuer freeze, upgrade, custody or redemption risk. Bind the chosen
policy into the existing P5/P7 approval and revalidation model.

Inspect: `src/security/bstocks-governance.ts`, `reviewed-source-pins.ts`,
[governance research](integrations/2026-10-01-bstocks-governance.md),
[source rebuilds](research/bstocks-governance/README.md), ADRs 0027/0028.

### U08 — Production source ports and portfolio bootstrap are incomplete

The immediate code entry point is `web/server/execution.ts`. Its
`unresolvedProductionSources` explicitly contains:

```text
accessPolicy = null
reviewedControl = null
access.session = inactive, with no wallet binding
access.jurisdiction / country / product = null
economicQuantity = null
portfolioValuations = null
event / providerEvent = null
```

`NEXUS_EXECUTION_CONFIG` is unset by default; broadcasting defaults to false.
Setting a JSON path or enabling broadcasting cannot populate those ports.
The public readers and route ports are composed, but they cannot supply these
missing authorizations and reviewed mappings. Complete each server integration
with actual evidence, explicit revision/expiry and failure behavior.

New saved portfolios start paused with zero unsynchronized balances and an
unverified data mode. The executor requires an unpaused chain-backed portfolio,
active policy, immutable instrument registration, a reconciled complete tracked
snapshot and an accepted/reserved P4 leg at the current revision. There is no
finished production bootstrap flow that establishes all of those prerequisites.
Hand-editing `data_mode='chain'` or copying fixture balances is not initialization.

Build a trusted chain-sync/bootstrap service, reconcile actual BNB/USDT/stock
balances against a reviewed tracked-asset set, retain canonical source provenance,
activate the approved policy and generate a real P4 decision/reservation.
Define treatment of later external wallet activity and initialization retries.
The readers cover supplied tracked assets; they do not discover every token a
wallet might hold or establish the completeness of an arbitrary portfolio.

Inspect: `src/application/workspace.ts`, `src/execution/production.ts`,
`bstocks-runtime.ts`, `src/market-gate/bstocks-production.ts`,
[ADRs 0023](decisions/0023-owner-authenticated-web-workspace.md)/0029/0030.
Acceptance: a newly authenticated intended wallet can reach a genuinely
chain-backed reserved plan without privileged fixture manipulation, while
wrong-owner, stale/revised and incomplete snapshots remain blocked.

### U09 — Real-wallet raw signing and allowance need acceptance evidence

The persist-before-broadcast design requires a separately signed raw EIP-1559
transaction. Many browser extensions do not expose `eth_signTransaction` or
raw export. The explicit import fallback is implemented but does not make an
unsupported wallet compatible automatically.

The UI's EIP-712 approval is a separate signature; it does not itself sign or
submit the chain transaction. Falling back to `eth_sendTransaction` would send
before Nexus durably stores the exact bytes and transaction identity, breaking
the selected recovery design. Do not introduce that fallback casually.

Select and test the intended signing workflow without transmitting its private
key to Nexus. If broad EOA compatibility needs a different submission model,
review how it preserves transaction identity and crash safety before changing
the interface. Account/chain/session changes and expiry during asynchronous
wallet work must continue to invalidate stale actions.

There is also a concrete approval-timing concern to measure. The executor caps
approval at five minutes, but further reduces it to the earliest original
source/quote/simulation/session expiry. The built-in Binance status record lasts
only 30 seconds, so it can cap a review at 30 seconds or less even when other
sources qualify. Collection time, two signing interactions, raw export/import
and the separate submission must all fit. Fresh collection does not extend the
original lease, and changed semantic price/control facts require a new review.
This is a code-derived usability concern, not a reproduced live-wallet defect.
Measure the full flow and review whether unchanged status observations can be
revalidated without repeatedly asking for signatures, while keeping exact signed
bounds and genuine source/price changes protected. The legacy Ondo 24-hour owner
declaration, one-hour web session and 24-hour security review are separate clocks;
none grants a 24-hour trade authorization. Inspect `executionMarketExpiry` in
`src/execution/market-revalidation.ts` alongside `prepare` in `production.ts`.

Current production simulation requires real settlement/native balances and
actual router allowance. The September 27 successful simulation used temporary
state overrides for research; that cannot clear this gate. The October 1
application smoke used no overrides and correctly blocked an unfunded address.
Historical funding and Ondo allowance do not establish today's NVDAB-route funds
or approval. An allowance transaction needs its own exact review and receipt
handling; no production allowance-mutation service was introduced by the latest
execution composition.

Inspect: `web/lib/execution-wallet.ts`, `web/components/execution-panel.tsx`,
`src/execution/signing-payload.ts`, `src/execution/store.ts`,
`src/market-gate/bstocks-route.ts`, ADRs 0019/0030.
Acceptance: funded-wallet simulation, supported raw signing/import, exact-payload
checks, durable storage and separately authorized one-time submit on the actual
wallet path. Ask for the intended public wallet only when that test is ready;
do not request or store private keys.

### U10 — Historical RPC capability is found; reliability and nonce history remain

The supplied BNB Chain dataseed endpoint served current reads but failed sampled
historical state with `missing trie node`. PublicNode's historical reads required
archive access in the sampled requests. Latest balances cannot substitute for
balances at the finalized receipt's exact block.

The Chainlist survey found anonymous Sentio and Blockmachine endpoints that
served sampled balances, receipts/logs and existing P7 readers back to June 2024.
They are now wired into `config/bsc-recovery.json`; full-source fallback and
PostgreSQL recovery are implemented. “We still need any archive RPC” is therefore
an outdated blanket blocker.

Nevertheless, later governance research encountered unavailable historical state
on Blockmachine and throttling elsewhere. Free endpoints have no established
retention/availability SLA for this deployment. Qualify the actual method matrix,
canonical hash support, request limits, latency, old receipt reads and continued
service. Blast's successful research comparison does not automatically make it
a configured recovery source. Different gateways may share upstream operators.

The configuration's 12-block confirmation depth is a deployment policy requiring
review, not proof of protocol fast finality. The worker must also remain scheduled
after reconciliation to notice later canonical receipt changes.

When the original receipt is absent and the EOA nonce has advanced, we cannot
assume a particular replacement. The diagnostic reader's bounded scan supports
at most 32 blocks from a trusted start. The production runtime lacks a trusted
inclusion-start history and does not treat the last 32 blocks as complete.
An indexer/full-history procedure or reviewed operator diagnosis is needed for
such cases, including external use of the same nonce. Do not resend on timeout.

Inspect: `src/execution/bsc-recovery.ts`, `recovery-worker.ts`, `recovery-config.ts`,
[RPC survey](integrations/2026-09-30-chainlist-recovery-rpc.md),
[recovery runbook](runbooks/bsc-recovery-worker.md), ADR 0024.
Acceptance: reproducible real-chain method qualification, degraded/fallback tests,
polling/lag measurements and complete evidence for consumed-nonce diagnosis.

### U11 — Ambiguous/reorged accounting has no reviewed repair command

The worker derives immutable wallet/hash/nonce identities from signed-leg records,
requires exact receipt logs and native gas effects, and verifies complete tracked
balances at the canonical receipt block. Successful/reverted fills apply once.
Contradictions, unsupported token behavior, changed receipt-block code and deep
reorgs deliberately freeze further execution.

After a deep reorg of a previously applied fill, the existing ledger snapshot
is retained for explicit repair and the portfolio is paused. There is currently
no reviewed manual repair command to settle that state safely. Writing SQL to
unpause or overwrite balances would bypass provenance and accounting guards.

Design an operator repair workflow that records diagnosis and canonical evidence,
handles already-applied versus unapplied effects, preserves reservations and
history, invalidates dependent plans, advances revisions and proves idempotency.
Define authority and review for resumption. Include current token-code changes,
external activity and competing repairs. Additional rebasing/intermediate assets
need their own reviewed accounting semantics, not generic Transfer assumptions.

Also define safe handling of a stored signed leg whose review expires before
Nexus attempts submission. Persistence already freezes its input, and possession
of signed bytes is not proof that the transaction was never sent elsewhere.
The worker can wait on an unsubmitted leg but does not provide a general
cancellation/repair workflow. Diagnose whether bytes were exposed/submitted,
nonce use and canonical outcomes before deciding how funds can be released.

Inspect: `src/execution/reconcile.ts`, `receipt-effects.ts`,
`bsc-receipt-effects.ts`, `recovery-contracts.ts`, `recovery-worker.ts`,
ADRs 0020/0024/0025 and the recovery runbook.
Acceptance: crash/retry/concurrency and deep-reorg repair regressions without
duplicate fills, unexplained balance changes or premature release of submitted funds.

### U12 — Rules are durable, but live scheduling/replanning is unfinished

Canonical basket/price/earnings rules and atomic PostgreSQL occurrence/P4
reservation commits exist. DST, rollback, concurrent claims and event freezes
have tests. Rule activation remains distinct from transaction authorization.

Missing production work includes the scheduler's trusted valuation/event inputs,
service lifecycle, refresh/expiry handling and allocation quantities after P7
reconciliation. Allocation-scoped reductions require quantities tied to the
current portfolio revision. Missing allocation data cannot become permission
to sell the entire company holding. A fill advances revision, so attribution
must be refreshed before the next dependent rule evaluation.

The sell-confirm-replan-buy behavior is implemented in pure logic and recovery
interfaces, but still needs actual runtime demonstration. A contingent buy is
not a permanently authorized leg; it needs the new reconciled snapshot, gates,
reservation and owner approval. EOA-first execution requires owner signatures;
unattended trading would require a separate delegation/account design.

Inspect: `src/rules/store.ts`, `planning.ts`, `src/coordinator/`,
[specification 0005](specifications/0005-rules-and-scheduling.md),
[ADR 0022](decisions/0022-durable-rule-occurrences.md).
Acceptance: worker restart and duplicate scheduling cannot repeat an occurrence;
post-fill attribution/replanning respects updated balances, freezes and approvals.

### U13 — The wider basket and alternative providers remain unqualified

The current production assembly admits only the exact NVDAB/USDT candidate.
The blueprint's two/three-instrument basket needs more work or a deliberately
narrow pilot definition. Metadata registration, apparent pool depth and a ticker
match do not establish supported execution/recovery for another token.

xStocks BSC candidates had poor/no executable quotes in the recorded tests.
Bare xStocks rebase; current v2 wrappers have stable shares, while legacy v1
wrappers were excluded because of donation-sensitive conversion. Neither legal
integration questions nor thin liquidity disappear merely by picking that family.

Ondo's regular-session reassessment found a credible small-size direct Nvidia
candidate, but its 1% fee and larger-size deterioration matter. The direct Apple
pool consumed only a tiny part of the requested input despite call success.
Aggregator previews improved available paths, but some traversed unreviewed
intermediate tokens or even NVDAB, reintroducing bStocks exposure.
The current direct-V3 decoder does not validate all split/V4/Infinity routes.
Price, eligibility, event and scanner gaps remained in that reassessment.

Primary issuance/redemption onboarding and secondary acquisition must be assessed
separately. The historical [provider comparison](verificaton-challenges.md)
records this distinction; its jurisdiction conclusions should be refreshed before
any pivot. Ondo's restriction page could not be retrieved in this October 2 check,
so this document does not claim a newly verified Ondo legal determination.

Requested decision: retain bStocks and resolve its actual access dependencies,
or make an explicit provider/scope change based on a complete route-specific
comparison. No automatic issuer switching is approved. A chain change is a
separate product/architecture decision.

Acceptance: exact instruments with reviewed quantity/security/recovery profiles,
actual-size decoded and simulated routes, qualified independent prices and access.
Treat HTTP 429, market-hours denial and no-liquidity results as different outcomes.

### U14 — Real-chain release and operations are still open

P8 has a labelled fixture page at `/` and a saved authenticated workspace at
`/workspace`. Exact execution review/storage/submit is connected, but its
production inputs are incomplete. The fixture acknowledgement is not trading
authority and must remain visibly distinct from chain-backed activity.

P9 has not started. A senior engineer should map blueprint release scenarios to
existing tests and missing acceptance evidence, rather than recreate coverage
that already exists. Remaining work includes broader accessibility/wallet
compatibility, useful blocked-state explanations, deployment migrations/roles,
backup and restore, session cleanup, service monitoring and operator runbooks.
Some sign-in rate limiting exists; public deployment needs a review of protection
across the whole application. These are release qualifications, not claims that
a specific vulnerability has been reproduced.

Exercise the exact runtime with an owner-approved small trade, then verify raw
input/output, native gas, canonical receipt effects, one reconciliation, a real
restart and repeat monitoring. Simulated crash/reorg tests are valuable but do
not establish production RPC or wallet behavior. Pause/logout serialize against
the send claim; they cannot retract already-signed EOA bytes or a committed send.
UX and support instructions must describe that boundary accurately.

Define separate acceptance for limited developer pilot and general availability.
Measure duplicate fills, unresolved outcomes, stale execution attempts and
recovery lag. Record residual limits and prepare a reproducible demonstration.
Do not label a passing build, RPC acceptance or quote as a confirmed trade.

### U15 — Environment and portability can obscure otherwise passing work

Earlier CLI `UNCONNECTED` responses were false negatives compared with the
owner's terminal. DNS/VPN/session and Developer Mode differences were investigated;
they are not current EOA dependencies. Earlier PostgreSQL connection failures
also differed by execution environment. A successful host run and failed agent
run must be recorded independently instead of blaming application changes.

The October 2 environment permits workspace edits and network access, but exposes
`.git` read-only and does not allow permission escalation. This restriction is
separate from Unix file modes; `chmod` inside the workspace is not a reliable fix.
These documentation changes cannot be committed from this session. Use a terminal
with actual Git write permission or adjust the execution policy through the host.
Do not discard existing dirty work to obtain a clean tree.

At handoff creation there are earlier uncommitted documentation/configuration
changes and untracked September 30 research files plus the test Compose file.
Referenced untracked files must be deliberately included in a reviewed commit or
export before sharing a clean checkout. The latest committed runtime is
`5c7d541`; a portable copy of this new handoff also needs committing/exporting.

Git-tracked documents are authoritative. MCP memory is supplementary; concurrent
independent processes writing the same local memory file are a known limitation.
Keep personal information, keys, session tokens and credentials out of both.
Avoid concurrent web builds that contend for the same generated output.

## 6. What has been resolved enough not to restart from zero

| Earlier obstacle | Current result | Residual boundary |
| --- | --- | --- |
| Need a usable direct bStocks route | Exact-size canonical V3 adapter implemented; public quote passed | Real intended-wallet simulation and complete P5 qualification still needed |
| Missing beacon/source/control identities | Local rebuild and production nine-component governance integration complete | This is source correspondence, not independent security approval |
| No usable historical RPC | Sampled Sentio/Blockmachine historical capability and fallback wiring implemented | Reliability/retention and ambiguous nonce history remain |
| No receipt-effect reconciliation | Raw transfer/gas proof, code guards and transactional once-only fill implemented | Limited reviewed token set and no manual repair command |
| No production executor composition | Server-owned original/current gate checks, storage and guarded one-time send implemented | Source ports, bootstrap and deployment qualification remain |
| No exact web EOA review | Typed approval, raw signing/import, storage and separate submission implemented | Real-wallet capabilities and live evidence unverified |
| Database connectivity doubts | October 2 PostgreSQL-backed check passes in this environment | Set the test URL explicitly; an export in another shell is not inherited automatically |

## 7. Verification and reproduction

October 2 **before this documentation change**:

- First check with no test database URL: 157 application tests passed, 27 skipped,
  zero failed; three research tests passed; typecheck and both builds passed.
  This is an offline result and does not prove PostgreSQL gates.
- Repeated `./scripts/check.sh` with the previously supplied dedicated local test
  database URL: **213 application tests and three research tests passed, zero
  failures/skips**, strict typecheck and both builds passed.
- October 1 records additionally report **14 passing Chromium cases**. They
  include synthetic execution interactions and real authenticated HTTP/database
  boundaries. They were not rerun just to create this documentation; they are
  historical browser verification, not current real-wallet evidence.

Use Node.js 22 and the lockfile. Configure credentials privately:

```bash
npm ci
export TEST_DATABASE_URL='<dedicated local test PostgreSQL connection URL>'
./scripts/check.sh
npm run web:e2e
```

`./scripts/check.sh` includes unit/PostgreSQL suites when configured, three
research regressions, strict TypeScript checks and headless/Next.js builds.
It does not run Playwright or perform a mainnet trade. Inspect counts and skip
reasons; a green exit without a database URL is not full database verification.
The database suites create isolated temporary schemas; use a test database.

For application setup, privately set `DATABASE_URL`, migrate with
`npm run db:migrate`, and configure `NEXUS_APP_ORIGIN`. Execution/recovery use
operator-owned `NEXUS_EXECUTION_CONFIG`, `NEXUS_RECOVERY_CONFIG` and
`NEXUS_TOKEN_SECURITY_REVIEWS`. A config file is not a substitute for the
missing runtime integrations. The local test Compose file uses PostgreSQL 15;
older P3 evidence used PostgreSQL 16. Choose and document the supported
deployment version rather than silently assuming the environments match.

Read-only inspection and historical recovery commands:

```bash
npm run security:tokens
npm run recovery:once
```

The security command can exit 2 intentionally for blocked readiness. The
recovery command can update verified ledger observations/fills in the configured
application database but cannot sign or broadcast; run it only against the
intended database. It requires actual persisted leg identities. Exit 0 does not
mean all transactions finalized; consult the [runbook](runbooks/bsc-recovery-worker.md).

Final verification after this documentation increment is recorded in
[ENGINEERING_LOG](ENGINEERING_LOG.md) and [CHANGELOG](CHANGELOG.md).

## 8. Proposed order of assistance and concrete exit evidence

This is a proposed work order, not a newly approved architecture or live policy.

1. **Agree on the pilot boundary and evidence policy (U05–U07/U13).** Decide
   what “ship first” means: local functional release, a supervised single-asset
   mainnet pilot or broader live use. List which review requirements are retained,
   changed or deferred and why. Keep deferred review visibly deferred.
2. **Resolve access/economic/source decisions together (U01–U04).** Send the
   issuer request, inspect product terms, measure free feed behavior and define
   event intake. These tasks can progress independently; support delays should
   not stop unrelated engineering. Produce a per-source qualification dossier.
3. **Complete trusted composition and bootstrap (U08).** Implement the reviewed
   ports, initialize real tracked balances/policy/instruments, and reserve a
   real P4 plan. Show an authentic full P5 pass or precise unresolved reasons.
4. **Verify the intended signing/allowance path (U09).** Use an explicitly
   supported EOA workflow, exact approval handling and funded real-state
   simulation. Preserve durable transaction identity before network submission.
5. **Close operational recovery gaps (U10–U11).** Qualify sources and finality,
   implement consumed-nonce diagnosis and repair, and verify crash/retry behavior.
6. **Conduct the authorized pilot (U14).** Obtain a fresh exact trade approval,
   submit once, prove the receipt effects, reconcile once, restart the worker
   and demonstrate no duplicate fill. This handoff grants no transaction approval.
7. **Finish the intended rule/product scope (U12–U14).** Refresh allocations,
   connect scheduling and qualify additional instruments before declaring the
   blueprint MVP or P9 complete.

Pilot acceptance evidence should include the source/policy revisions, authentic
access decision, economic mapping, timely bounded valuations, event records,
security admission decision, exact decoded quote and real-state simulation,
signed-leg identity, canonical receipt/effect proof, reconciled revision and
restart result. Retain secrets and personal records in appropriate private
storage, with only non-secret technical conclusions in repository records.

## 9. Questions for the senior engineer

1. Which of the current admission rules are justified for this MVP, and which
   reflect overly broad initial assumptions about tokenized securities?
2. Can available free references support a defensible bounded strategy, and
   what policy and source monitoring would be required?
3. What exact verification process is required for Nexus's chosen bStocks
   secondary-market flow, and which unanswered questions truly need issuer input?
4. How should independently reviewed contract facts substitute for missing
   scanner fields without converting unknown or dangerous behavior into “clear”?
5. Which known issuer powers can the chosen pilot tolerate, and what changes
   must revoke eligibility, mapping, security review or trade approval?
6. What is the practical supported EOA raw-signing workflow, including allowance,
   and does the selected persistence model need a deliberate compatibility revision?
7. What chain initialization, nonce-history and repair design completes the
   existing durable execution model with the least new complexity?
8. Can one NVDAB trade serve as a clearly labelled pilot while preserving the
   wider basket roadmap, or should another provider/instrument be qualified first?

## 10. Source and record map

- [Blueprint](../Nexus.md), [implementation plan](IMPLEMENTATION_PLAN.md),
  [state](PROJECT_STATE.md), [project log](PROJECT_LOG.md),
  [engineering log](ENGINEERING_LOG.md), [changelog](CHANGELOG.md).
- [Market Gate specification](specifications/0004-market-gate.md),
  [rules specification](specifications/0005-rules-and-scheduling.md),
  [execution specification](specifications/0006-eoa-execution.md),
  [web specification](specifications/0007-web-workflow.md),
  [security specification](specifications/0008-token-security.md).
- [Eligibility/integration comparison](verificaton-challenges.md),
  [free-source readiness](integrations/2026-09-30-free-source-readiness.md),
  [historical RPC survey](integrations/2026-09-30-chainlist-recovery-rpc.md),
  [raw-token accounting](integrations/2026-09-30-token-recovery-semantics.md).
- [Current security evidence](integrations/2026-10-01-security-collector.md),
  [governance recovery](integrations/2026-10-01-bstocks-governance.md),
  [route adapter evidence](integrations/2026-10-01-bstocks-route-adapter.md).
- Primary external references: [bStocks FAQ](https://www.binance.com/en/support/faq/detail/f0c03cd6509a4085b4cce1636f16be38),
  [BEP-677](https://github.com/bnb-chain/BEPs/blob/master/BEPs/BEP-677.md),
  [PancakeSwap V3 deployments](https://developer.pancakeswap.finance/contracts/v3/addresses),
  [Chainlink source-selection guidance](https://docs.chain.link/data-feeds/selecting-data-feeds),
  [NVIDIA investor relations](https://investor.nvidia.com/),
  [NYSE hours/calendars](https://www.nyse.com/markets/hours-calendars),
  [Ondo secondary restrictions](https://docs.ondo.finance/ondo-stocks/secondary-market-restrictions),
  [xStocks legal overview](https://docs.xstocks.fi/docs/product-legal-overview).

The bStocks FAQ, Chainlink source-selection page and xStocks legal overview were
retrievable on October 2. This handoff does not refresh every referenced source,
liquidity measurement, chain fingerprint or provider-country decision. Verify
dated evidence before changing live policy or submitting a transaction.
