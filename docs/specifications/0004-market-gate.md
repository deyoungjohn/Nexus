# Specification 0004 — Market Gate

Status: implemented as an offline, fail-closed P5 gate on 2026-09-26.
Source: `Nexus.md` §5, implementation plan P5, P2 integration matrix.
This specification does not grant live trading permission.

## Boundary and inputs

`src/market-gate/` is a pure pre-approval module over one exact instrument and
one actual-size buy or sell proposal. It consumes a P4 snapshot/policy, a
versioned market policy, and provider evidence. `EvidenceAdapters` is the
read-only collection seam; a provider failure becomes missing evidence. The
reference adapter accepts a provider-origin timestamp and rejects an HTTP
receipt without one. No current production provider is registered. In
particular, the P2 public underlying-price response without a source timestamp
cannot pass this gate.

The gate checks instrument metadata, owner/transfer/venue eligibility and the
registered quantity model/version/revision before valuation. Raw token units
map to 10^18 reference-share units through an explicit positive rational
ratio. The ratio and source block must be verified by an adapter; the P2
display multiplier alone does not establish economic share exposure. A changed
mapping revision blocks an earlier plan. Each evidence bundle, route,
proposal, mapping revision, snapshot revision and block is hashed for a future
P7 approval comparison. The hash is a binding identifier, not a signature.

## Independent clocks and restrictions

Reference `sourceAt` and `receivedAt` are separate. Eligibility, quantity,
settlement conversion, exchange calendar, token status and manual issuer-event
records each carry observation and expiry times. Quote, on-chain deadline and
simulation times are checked separately. ISO timestamps require an explicit
UTC/offset designator. A recent HTTP receipt never refreshes an old reference.

Regular-session checks use `Intl` with the configured IANA exchange timezone,
dated open/close and holiday status, and configured regular hours. The dated
calendar is an external evidence input; absence, holidays, weekends, DST
mistakes and closed hours block. Extended-hours execution is not supported by
this policy. Token halt/paused/unknown states block both directions. A fresh
token-audit result must be `clear`; `risk` and `unsupported` block. P2's
unsupported NVDAon audit therefore cannot authorize automation.

P5.5 adds a 24-hour EIP-712 owner declaration verifier scoped to exact wallet,
token, venue, router and side, plus a read-only Ondo beacon/implementation
fingerprint. Neither is wired as production `EligibilityEvidence` or a `clear`
audit result. Signature validity records a wallet-controlled declaration, not
issuer eligibility or current transfer permission; fingerprint identity does
not establish implementation safety. [ADR 0010](../decisions/0010-owner-attestation-and-token-risk.md)
keeps unsupported audits blocked until a separate policy decision and review.

The Chainlink BSC settlement adapter must emit the snapshot's `USD-18`
valuation unit. It rejects a USDT/USD answer beyond an explicit policy peg
deviation, independent of its conservative uncertainty band. The manual
[issuer-event runbook](../runbooks/issuer-event-review.md) requires direct
issuer provenance and marks inaccessible or ambiguous schedules uncertain.

Issuer IR event evidence requires a direct HTTPS URL, revision, confirmation
state and expiry. Uncertain, withdrawn, malformed or in-blackout confirmed
events block. A `none-confirmed` record requires a recent checked source and
no event/blackout dates. Shifted events change the evidence hash; P7 must
recheck that hash before submission. There is no automated earnings scraper.

## Quote, valuation and simulation

The only currently decoded route format is direct V3 `exactInputSingle` with
static ABI fields, zero price-limit parameter and an on-chain deadline. The
calldata must match the quoted exact token pair, raw input, minimum output,
wallet recipient and deadline. The venue, router and fee tier must be approved;
the sender is the wallet and the spender is the router. Opaque Agentic Wallet
quotes and Kyber routes remain unsupported by this adapter. The minimum
output, impact, spread, network/additional fee, slippage, price deviation and
deadline are bounded. This direct route does not support a separate additional
settlement fee. Native gas is kept separate from settlement cost.

Reference-share value and settlement-token value are separate. A fresh lower
and upper settlement conversion is mandatory; raw settlement units are never
assumed to equal the portfolio valuation unit. The P4 cash lower value cannot
exceed the converted lower cash value. Every held position must have a fresh,
block-bounded valuation record that matches P4's lower/upper snapshot values;
missing other-instrument values block portfolio planning. Buy lower exposure uses minimum
output and upper exposure uses expected output plus an explicit positive-fill
buffer. Sell proceeds use minimum output and lower settlement conversion.
The adjusted proposal is rechecked through P4 at its full exact amount; a
clipped/blocked result requires a new actual-size quote. These are conservative
planning estimates, not an on-chain maximum on positive token output.

Simulation must match chain, sender, recipient, router, spender, input token,
allowance, value, calldata and exact input, succeed above minimum output, and
use a recent block no older than the snapshot or quantity evidence. Simulation
reduces uncertainty but does not guarantee inclusion or fill. P7 must bind
owner approval to the evidence hash and revalidate at submission and after
each sequential fill; P5 neither signs nor submits anything.

## Evidence and remaining production gates

Synthetic tests cover missing/stale reference, mapping changes, holiday and
both DST regimes, uncertain/blackout events, halt, recipient/spender/calldata
tampering, wrong input, cost limits, low allowance, settlement depeg conversion,
missing held-position valuation, full-size P4 limits and adapter outage. The PostgreSQL-backed full check also
preserves P3/P4 behavior.

Production evidence still needs wallet/venue-bound owner/transfer eligibility,
regular-session source freshness and quote validation, a maintained exchange
calendar, a checked issuer IR process, reviewed settlement bounds and a
supported audit source or an explicit future policy change for unavailable
audits. P2's one supervised trade supplies no standing eligibility. P7 owns durable approval,
pre-leg revalidation, transaction identity, receipt/reorg recovery and any
actual live executor. Until these gates are met, no automated plan is
executable.

P5.5 follow-up: read-only Ondo quantity and BSC Chainlink reference/settlement
adapters now cover the NVDAon/AAPLon candidate scope. Regular-session
freshness, wallet/venue-bound eligibility and the remaining source/policy
checks are still required. [ADR 0008](../decisions/0008-keyless-bsc-market-reference.md)
records the keyless source pivot; this specification's fail-closed boundary
and no-execution status remain in force.

The earlier xStocks-first P5.5 pivot added a separate read-only BSC current-wrapper
identity/quantity adapter. It verifies exact expected issuer-listed addresses,
chain, deployed token/wrapper code, `asset()`, decimals and pinned-block
`getCurrentMultiplier()`/`convertToAssets(10^18)` equality. Its
`xstocks-v2-wrapper` model is not interchangeable with Ondo or bare rebasing
xStocks. It supplies quantity evidence only. The issuer's non-halted flag does
not establish an executable venue, and no xStocks route is currently accepted
by P5. [ADR 0011](../decisions/0011-xstocks-first-bsc-provider.md) and the
[xStocks matrix](../integrations/2026-09-26-xstocks-bsc.md) record the gates.

The later [bStocks-first decision](../decisions/0012-bstocks-first-bsc-provider.md)
supersedes that provider priority, not the xStocks adapter or this gate's
fail-closed behavior. A bStock requires its own pinned BEP-677 raw/UI
multiplier mapping, code/control revision and eligibility evidence before
registration. The [direct NVDAB BSC route probe](../integrations/2026-09-27-bstocks-bsc.md)
matched this specification's V3 calldata shape and passed a conditional
read-only simulation with temporary balance/allowance overrides. It did not
produce a production P5 evidence bundle or enable an execution route.

The first bStocks adapter now reports a pinned raw/UI mapping, pending schedule
and proxy/beacon/implementation fingerprint. Its output is deliberately not
`QuantityEvidence`: the BEP-677 UI multiplier by itself does not verify the
reference-share entitlement required for P5 portfolio valuation. A pending
multiplier or changed reviewed code/control fingerprint blocks reuse. See
[ADR 0013](../decisions/0013-bstocks-display-mapping-boundary.md).
