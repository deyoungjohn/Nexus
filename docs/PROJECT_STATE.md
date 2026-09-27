# Project state

Last updated: 2026-09-27

## Objective

Build Nexus as specified in [Nexus.md](../Nexus.md): coordinated tokenized-stock
portfolios on BNB Smart Chain with explicit approval, deterministic planning,
inspectable evidence and recoverable sequential execution.

## Current status

- Cross-agent workspace initialized.
- Shared MCP memory initialized with the `Nexus` project entity; all four initial
  observations were retrieved successfully through `open_nodes` on 2026-09-25.
- P0 (roadmap), P1 (domain foundation), P2 (integration feasibility), P3
  (durable ledger), P4 (Portfolio Coordinator) and P5 (offline Market Gate)
  are complete. P5.5 now targets bStocks first; live-readiness remains active
  before P6. The completed P2 Ondo trade is historical feasibility evidence,
  not proof of a bStocks route. See
  [the implementation plan](IMPLEMENTATION_PLAN.md) for all phases and exit gates.
- P2 read-only evidence: chain 56, BSC USDT and three Ondo candidate token
  contracts (NVDAon, AMDon, AAPLon); public metadata/status and RPC `decimals()`
  agree on 18 decimal places. Public responses lack a source timestamp for the
  stock reference price; wallet display multipliers alter displayed quantities.
  See [the integration matrix](integrations/2026-09-25-phase-2.md).
- Agentic Wallet CLI version 1.10.0 is installed and reports `CONNECTED` when
  checked outside the sandbox. Quote-only checks succeeded for USDT to NVDAon,
  AMDon and AAPLon, plus each token back to USDT, without submitting transactions.
  After the owner's funding, a read-only balance check showed settlement and
  native-gas assets present. Two 5-USDT NVDAon quotes succeeded; a 4-USDT quote
  was rejected with a greater-than-$5 value message. The
  earlier sandboxed `UNCONNECTED` response was a false negative; its cause and
  correction are logged. A direct V3 route, exact allowance, wallet preview,
  mined trade and reconciled receipt were verified for one supervised NVDAon
  test. No application live execution adapter is enabled.
- KyberSwap supplied an unsigned, decoded 5-USDT-to-NVDAon route with fixed
  wallet recipient, exact input and 0.5% minimum-output bound. Actual router
  allowance is zero; direct `eth_call` reverted, while a read-only exact-
  allowance state override succeeded and estimated gas. Agentic Wallet
  Developer Mode was disabled on 2026-09-25. After a VPN-related DNS failure,
  the owner enabled Developer Mode and 2026-09-26 CLI checks returned
  `CONNECTED` and `devMode.enabled=true`. A deadline-bound PancakeSwap V3
  direct route quoted below a separate opaque wallet quote; it passed
  read-only chain simulation with a temporary exact allowance override.
  The owner authorized an exact 5-USDT approval and bounded trade. Both
  BSC receipts succeeded. Mined swap calldata matched the preview, and token
  transfer logs, raw balances and spent allowance reconciled. The received
  NVDAon exceeded the encoded minimum. Wallet display quantity matched raw
  tokens times the public shares multiplier, truncated to display precision.
  Binance token audit returned no supported result for NVDAon; the trade
  occurred while public token status was open but off-hours.
- For MVP earnings confirmation, use manual issuer investor-relations
  announcements with direct provenance and rechecks. Label demo user-supplied
  events separately; defer automated ingestion until source rights and revision
  behavior are verified. No date-dependent live rule is enabled.
- Implemented: exact denominated quantities and serialization, immutable
  instrument metadata registry, deterministic priority/proportional cash
  allocation with separate native gas checks, and a synthetic CLI example.
- Implemented in P3: PostgreSQL migration for portfolio/revision/balance,
  policy/evidence/decision records, plans, exact reservations, transaction
  identities and outbox. The ledger serializes plan and revision writes per
  portfolio, blocks overspending and unresolved submissions, and exposes an
  at-least-once leased worker helper. See
  [specification 0002](specifications/0002-durable-ledger.md).
- Implemented in P4: pure deterministic coordinator and PostgreSQL decision
  store with versioned policy activation, immutable instrument mappings,
  snapshot-to-ledger checks, exact-instrument netting, sell-first phases,
  priority/proportional cash allocation and conservative company/sector/issuer
  limits. The blueprint NVDA/AMD example resolves to a $30 NVDA sell and a
  contingent $30 AMD buy; only a new reconciled revision can reserve that buy.
  See [specification 0003](specifications/0003-portfolio-coordinator.md).
- Implemented in P5: a pure fail-closed market gate and read-only evidence
  adapter seam. It checks exact eligibility, quantity mapping/version, separate
  reference/session/status/quote clocks, dated holiday/DST sessions, issuer
  events, clear supported audit, held-position valuation freshness, decoded
  direct-V3 route bounds, normalized price and settlement
  conversion, gas/cost limits, full-size P4 limits and exact simulation fields.
  It emits an evidence hash for P7 revalidation. See
  [specification 0004](specifications/0004-market-gate.md).
- P5.5 progress: a Pyth Pro reference adapter preserves the provider's
  `feedUpdateTimestamp` and fails closed on malformed/non-regular packets or
  missing credentials; it is dormant because no Pro access is available.
  A read-only BSC adapter reads Ondo's published SyntheticSharesOracle at one
  pinned block and rejects wrong-chain, stale, paused or scheduled mappings.
  Live read-only probes returned positive NVDAon, AMDon and AAPLon ratios on
  2026-09-26. See [the live-readiness matrix](integrations/2026-09-26-live-readiness.md)
  and [ADR 0007](decisions/0007-live-market-sources.md).
- P5.5 no-subscription source pivot: read-only Chainlink BSC adapters now
  source timestamped NVDA/USD and AAPL/USD underlying rounds and a bounded
  USDT/USD settlement valuation. Mainnet probes decoded the feeds; the equity
  rounds were from the prior session and correctly failed a 60-second age
  limit on 2026-09-26. The earlier Ondo candidate scope was NVDAon and AAPLon;
  AMDon remains read-only without a verified BSC reference. See
  [ADR 0008](decisions/0008-keyless-bsc-market-reference.md).
- A short-lived Binance public status adapter now reports only an explicit
  open venue state; read-only NVDAon/AAPLon checks succeeded. Both Binance
  token audits remain unsupported, and GoPlus leaves core proxy-token risk
  fields unknown. Neither result can satisfy P5's `clear` audit state.
- A versioned NYSE calendar adapter now fetches the official holiday and
  early-close section and rejects unreviewed revisions or dates outside
  2026–2027. Read-only weekend, regular-day, holiday and early-close probes
  succeeded. See [ADR 0009](decisions/0009-versioned-nyse-calendar.md).
- P5.5 owner-attestation groundwork now creates and verifies a 24-hour EIP-712
  declaration bound to exact BSC wallet, token, router, venue, side and nonce.
  A local challenge/verify CLI is available; no owner declaration has been
  signed for this workflow and no production eligibility adapter is wired.
  Durable revocation and current transfer checks remain open. See
  [the owner procedure](integrations/2026-09-26-eligibility-risk.md) and
  [ADR 0010](decisions/0010-owner-attestation-and-token-risk.md).
- A repeat Binance audit probe supports BSC USDT but returns unsupported for
  NVDAon and AAPLon, confirming a provider coverage gap without disclosing
  its internal cause. Read-only pinned-block checks found both Ondo tokens
  share one EIP-1967 beacon and implementation; their hashes can invalidate
  a later contract review but do not amount to an audit. P5 still rejects
  unsupported token risk. No exception is active.
- Sourcify's verified runtime source identifies role-gated mint/admin burn,
  mutable compliance and pause managers, and beacon upgrades for the shared
  Ondo implementation. Read-only BSC checks found current control pointers,
  but code hashes alone do not detect later role or pointer changes. Any
  exception policy would need to monitor those controls and actual routes.
- P5.5 settlement correction: the Chainlink USDT/USD reader now emits the
  P5 snapshot's `USD-18` unit and requires an explicit peg-deviation ceiling
  in addition to source age and uncertainty. A read-only mainnet probe passed
  illustrative 20-minute/50-bp/100-bp bounds; production thresholds are not
  activated. The [issuer-event runbook](runbooks/issuer-event-review.md)
  records a manual direct-source process and treats inaccessible/dynamic
  pages as uncertain, not as proof of no event.
- Earlier owner-directed provider pivot: xStocks was the first live-integration target;
  Ondo adapters remain available but dormant. A new read-only BSC adapter
  checks exact issuer-listed NVDAx/AAPLx native tokens and current v2 wrappers,
  then pins code, `asset()`, decimals and multiplier/conversion at one block.
  Both candidates passed live read-only probes. The bare EVM tokens rebase;
  current wrappers are distinct instruments with stable shares. Four 5-USDT
  Agentic Wallet quotes for the bare tokens/wrappers all reported no liquidity;
  tested direct Pancake V3 pools were absent. Seven of eight further BSC
  xStocks wallet quotes also lacked liquidity; SPYx returned an implausibly
  poor quote versus an indicative public price. No xStocks instrument is live-
  registered. See [the xStocks matrix](integrations/2026-09-26-xstocks-bsc.md)
  and [ADR 0011](decisions/0011-xstocks-first-bsc-provider.md).
- P5.5e BSC liquidity survey: a 2026-09-27 read-only snapshot covered all
  671 Binance-listed BSC securities records, including 458 Ondo, 128 xStocks,
  80 bStocks and five separately classified records. Among the three main
  providers' equity-scoped tokens, 100-USDT wallet quotes succeeded for
  23/329 Ondo, 4/96 xStocks and 66/67 bStocks. A direct-USDT-pool and
  100/10,000-USDT quote test supports a provisional bStocks top 20; Sunday
  market-hour blocks and absent/thin routes prevent defensible Ondo or
  xStocks top-20 liquidity ranks. At the time of that survey the
  provider-priority ADR was unchanged;
  no trade or application execution adapter was enabled. See the
  [dated report and full CSV](research/2026-09-27-bsc-stock-liquidity.md).
- Owner-directed P5.5 pivot to bStocks: [ADR 0012](decisions/0012-bstocks-first-bsc-provider.md)
  supersedes xStocks-first priority while retaining the xStocks and Ondo
  adapters as dormant modules. A direct 5-USDT USDT-to-NVDAB PancakeSwap V3
  fee-2500 route was verified against the official factory and exact contracts
  at BSC block 124348179. Its 50-bps minimum output and deadline were decoded;
  a read-only swap simulation with temporary exact balance/allowance overrides
  succeeded, while deliberately too-high minimum and expired-deadline calls
  reverted. On-chain BEP-677 multiplier reconciled the raw quote to a
  contemporaneous bStocks spot ask within about 0.20%; the minimum implied a
  0.70% premium. This is route screening, not a production independent price
  source. The wallet lacked actual 5-USDT balance and router allowance, and
  Binance token audit reported unsupported. No trade or bStocks instrument
  was application-enabled. See the [bStocks route matrix](integrations/2026-09-27-bstocks-bsc.md).
- P5.5b bStocks read-only adapter: `src/market-gate/bstocks-bsc.ts` pins the
  exact NVDAB contract, BSC block, 18 raw decimals, BEP-677 current/pending
  multiplier and proxy/beacon/implementation, compliance, pause-manager and
  token-role fingerprints. A live 2026-09-27 probe succeeded at block 124352879
  with no pending multiplier and `isTokenPaused=false`.
  A later read at block 124354706 also pinned the external managers' role-set
  hashes and found the token's mutable mint and burn switches enabled. This
  broadens change detection but does not clear unsupported token risk.
  Scheduled changes and changed reviewed controls block review reuse. The
  multiplier only converts raw amounts for display; no P5 reference-share
  `QuantityEvidence`, clear audit, eligibility result or live registration is
  produced. [ADR 0013](decisions/0013-bstocks-display-mapping-boundary.md)
  records this boundary. Binance's FAQ mentions a jurisdiction API but gives
  no endpoint in the reviewed public text; no speculative integration exists.
- P5.5c on-chain transfer preflight: `src/market-gate/bstocks-transfer.ts`
  rechecks token pause and wallet, exact validated V3 pool and router against
  the verified compliance contract at the quantity snapshot's BSC block.
  A synthetic-address live read succeeded at block 124353819; it is not the
  owner's wallet or issuer/jurisdiction eligibility. [ADR 0014](decisions/0014-bstocks-transfer-preflight-boundary.md)
  keeps this result separate from P5 `EligibilityEvidence`. No official
  country endpoint path or current account permission was established.
- P5.5c event review found a separate bStocks provider stream. Binance's
  historical NVDAB dividend notice specified an on-chain multiplier adjustment
  and conversion/deposit/withdrawal pauses while spot trading would continue.
  The current P5 `EventEvidence` binds only an underlying-company source, so the provider
  notice cannot yet be represented in a live evidence bundle. The updated
  [runbook](runbooks/issuer-event-review.md) and
  [ADR 0015](decisions/0015-bstocks-dual-event-review.md) require both streams;
  schema, policy and tests remain open. No current event clearance was inferred.
- Current local verification: `./scripts/check.sh` passes 64 tests; two
  PostgreSQL suites are skipped because `TEST_DATABASE_URL` is unavailable.
  Strict typecheck, build and Portable configuration checks pass. The earlier
  PostgreSQL-backed 73/73 result predates this adapter and does not cover it.
- Next: finish bStocks-first P5.5 before P6. Review the issuer's economic
  reference-share mapping and the implications of the verified mutable
  controls beyond their fingerprints;
  establish current
  wallet/jurisdiction eligibility, a supported token-risk policy, bStocks
  reference/session rules, dual-source issuer/provider events and settlement
  bounds. Refresh and simulate the exact route after actual funding/allowance
  only within an owner-approved plan. Existing BSC price, quantity and settlement sources
  are read-only; no instrument is live-registered.
  P7 must still add approval binding, pre-leg revalidation, idempotent
  submission, receipt recovery and reorg handling. Nexus live automation
  remains disabled.
- Detailed work, tests, reporting correction and lessons recorded in
  [the engineering log](ENGINEERING_LOG.md). One supervised mainnet trade was
  performed with separate owner approval; the application remains offline.

## Architecture

- Modular monolith; domain kernel in `src/domain/`, PostgreSQL ledger in
  `src/ledger/`, offline coordinator in `src/coordinator/` and pure market gate
  plus separate read-only bStocks quantity/transfer and xStocks/Ondo/Chainlink
  P5.5 adapters and the dormant
  Ondo owner-attestation verifier in `src/market-gate/`; no web runtime framework.
- Node.js 22.x; TypeScript 5.9.3; Node types 22.18.6; pinned npm lockfile.
- Native `bigint` accounting with explicit chain/token denomination; JSON base
  units are strings. Identity never uses ticker symbols as execution keys.
- Runtime database driver: `pg` 8.23.0; types 8.23.1. Numbered SQL migrations
  in `migrations/` (P4 adds `0002_coordinator.sql`); `DATABASE_URL` is required
  for `npm run db:migrate`.
- Tests: Node's built-in runner via explicit `test/run.ts` imports; new suites
  must be registered there. `test/` compiles into ignored `dist-test/`. Set
  `TEST_DATABASE_URL` to run the real PostgreSQL integration suite; without it,
  the suite is reported as skipped.
- Build: TypeScript into ignored `dist/`. `npm run demo` runs synthetic data.
- `npm --silent run attestation -- challenge ...` generates a 24-hour EIP-712 request;
  `npm --silent run attestation -- verify ...` checks a local signature and revocation
  list. `ethers` 6.17.0 is pinned for typed-data verification and BSC code
  hashing. Keep signed records under ignored `.agent-memory/`.
- Planned: P6 rules, Next.js application and verified live EVM/wallet adapters.
  No frontend, signing or application trade execution exists yet.
- Decisions: ADR 0001 (shared memory), ADR 0002 (domain kernel and allocation),
  ADR 0003 (Phase 2 integration gates and quantity semantics), ADR 0004
  (PostgreSQL ledger and leased outbox), ADR 0005 (staged conservative planning),
  ADR 0006 (market evidence boundary and direct V3 decoder), ADR 0007
  (source-timestamped reference and on-chain share mapping), ADR 0008
  (keyless BSC Chainlink source for the two-asset MVP), ADR 0009
  (versioned NYSE calendar), ADR 0010 (Ondo owner declaration and unsupported
  token-risk boundary), ADR 0011 (historical xStocks priority and wrapper
  identity boundary), ADR 0012 (bStocks-first provider priority), ADR 0013
  (bStocks display mapping boundary), ADR 0014 (on-chain transfer boundary),
  ADR 0015 (dual event review).

## Required verification

Run:

```bash
./scripts/check.sh
```

Install pinned dependencies with `npm ci` on Node 22.x first. The script validates
required project records, shell and MCP config syntax, then runs tests, strict
type checking and build. It remains the single entry point for required checks.
For full P3/P4 evidence, run it with `TEST_DATABASE_URL` pointing to an isolated
PostgreSQL test database. A database-free run skips their integration suites.

## Known limitations

- P1 allocation remains pure spending math. The P4 coordinator adds offline
  concentration constraints and durable reservations but cannot establish
  freshness, eligibility, owner authorization or chain state. It must not be
  connected directly to a wallet.
- Registry entries are metadata, not verified token support. Unknown quantity
  models remain read-only; the CLI example identities and balances are synthetic.
  Phase 2 observed real candidate addresses in documentation only; none are
  installed as executable instruments in the application.
- Binance public market status is momentary. Its observed reference-price
  payload did not expose a source timestamp; receipt time does not establish
  underlying price freshness. Exact wallet/venue eligibility evidence is not
  yet bound to an attestation and cannot be inferred from a prior fill.
- Agentic Wallet status returned a false `UNCONNECTED` result in the sandbox;
  the same CLI reported `CONNECTED` outside it. Quote responses expose amounts
  and slippage but no route transaction fields. A separate Kyber route was
  decoded and conditionally simulated with a temporary allowance override,
  not the wallet's then-zero allowance. The connected wallet's exact V3
  allowance and one bounded swap were subsequently confirmed and reconciled.
  This does not establish eligibility or recovery behavior for automation.
  The Binance CLI was
  temporarily unreachable due to DNS on 2026-09-26 and then recovered. A
  successful 5-USDT quote does not guarantee execution at the observed size
  boundary.
- The P3 ledger stores raw balances supplied by a caller; it does not verify
  their chain source or resolve submitted transactions. Outbox delivery is at
  least once and future handlers must deduplicate. A database-free check does
  not exercise concurrency or crash recovery. No P3 worker handler calls a
  wallet. Production deployment roles and backup procedures remain open.
- P4 snapshots match application-ledger balances and immutable registered
  classifications. Their valuation bounds, eligibility flags, proceeds and
  source block are still caller inputs, not externally verified facts. A
  contingent post-sell buy is preview only. P5 must validate market evidence,
  clocks and quantity mapping; P7 must recheck each leg before execution.
- The Pyth reader has only documentation/fixture verification and is dormant.
  BSC Chainlink equity and settlement plus Ondo quantity readers are live-
  tested read-only; public Binance status is a 30-second venue receipt.
  Chainlink's equity feed heartbeat can leave rounds too old
  for the configured trade gate. Regular-session verification, wallet/venue
  attestation, issuer-event/audit evidence and full execution recovery
  are pending.
- The USDT settlement reader now has compatible units and depeg rejection,
  but its production limits and full P5 evidence-bundle behavior remain
  unvalidated. Issuer-event review requires a fresh human-sourced record;
  no `none-confirmed` record was issued from dynamic or inaccessible pages.
- xStocks' current v2 wrapper conversion has been verified read-only, but
  issuer status is not a DEX venue status and neither selected candidate had
  an available 5-USDT Agentic Wallet quote at the recorded time. Other
  venues/filler paths require new route decoding and simulation. Bare xStocks
  rebasing requires explicit ledger reconciliation; legacy v1 wrappers must
  not be registered as supported instruments. xStocks distribution and
  jurisdiction restrictions remain unresolved for production use.
- A valid owner EIP-712 signature proves wallet control and a dated owner
  representation; it does not prove issuer KYC or transfer permission. The
  current CLI's local revocation file is not durable production state. The
  beacon fingerprint detects implementation changes but does not establish
  token safety or match a reviewed audit report to the runtime code. The
  unsupported Binance audit remains a P5 live-use blocker.
- The local MCP memory package should not be written by multiple agent processes
  concurrently. Close one agent and its MCP process before opening the next.
- MCP memory is supplementary and does not replace tests, Git history, decision
  records, specifications, or the change ledger.
