# ADR 0003: Keep live integration gated on exact route and source evidence

- Status: accepted; Phase 2 feasibility closed on 2026-09-26
- Date: 2026-09-25
- Owners: Codex (investigation); product owner retains trade authorization

## Context

Public Binance Ondo endpoints and BNB Chain RPC identify candidate tokens and
show current status and precision. Ondo documents BNB Chain display scaling and
per-token shares multipliers. The public dynamic response observed in P2 lacks
a source timestamp for the underlying reference. Agentic Wallet documentation
describes a quote and order workflow. The local wallet was initially reported
unconnected by a sandboxed CLI check; the same CLI reported `CONNECTED` outside
the sandbox. Four successful quote-only checks confirmed amount estimates but
their responses omitted exact transaction route and bound fields.

## Decision

Treat the three observed Ondo stock tokens and BSC USDT as **candidates**,
not an executable allowlist. Keep raw token base units, displayed units,
underlying share exposure and token/reference prices separate. On a multiplier
change, invalidate pending valuations and plans until an adapter reconciles.

Do not use the public dynamic response alone as a fresh underlying reference,
and do not interpret a market-status reason as a future earnings calendar.
Use explicit user-supplied event records for the labelled demo path; leave
production calendar ingestion and automated date-dependent decisions gated.

Keep the owner-approved wallet-native MVP as the product direction. Do not
commit to Agentic Wallet as the execution adapter until a connected quote,
exact transaction fields, simulation and receipt demonstrate that it meets the
approved-plan boundary. If its quote cannot bind a route, investigate a
separate wallet-native venue/API and record that decision before execution.
An order ID is submitted state, not confirmed fill evidence.

For P2.4, use issuer investor-relations announcements as the MVP's manual
earnings confirmation source. Store direct URL, retrieval time, announced time,
IANA timezone, confirmation state and expiry. Missing, estimated, shifted or
withdrawn dates block dependent rules. Automated calendar ingestion remains
deferred until access rights and revision semantics are verified; P5/P6 must
enforce rechecks before any date-dependent action.

The P2.3 probe found that KyberSwap supplies decoded exact-token calldata and
a minimum output for the connected wallet, and a read-only BSC call succeeded
with a hypothetical exact-amount allowance. The actual router allowance is
zero. This is a **candidate custom route**, not an executable adapter:
Agentic Wallet Developer Mode is disabled, so actual-wallet preview has not
run; the decoded route has no explicit on-chain deadline; the token audit has
no supported result. Require separate approval for any allowance change, fresh
route validation, successful wallet preview, explicit acknowledgement of the
unavailable audit and final trade authorization.

The 2026-09-26 follow-up found a lower-output PancakeSwap V3 direct pool whose
router enforces a deadline and minimum output. It remains a route candidate,
not a change to the approved-plan boundary: the current wallet was unreachable
through the CLI, so recipient-bound calldata, actual-state preview and owner
price acceptance are still required. Do not silently replace a better quote
with this route solely to satisfy the deadline requirement.

Later the same day, the owner restored connectivity and enabled Developer
Mode. A recipient-bound V3 call passed a read-only conditional simulation with
an exact allowance override; the wallet's real allowance was then zero. The
wallet's exact-amount approval preview passed and awaits separate owner
authorization. The V3 route remains lower-output than the wallet's opaque
quote; off-hours status, missing supported audit and owner acceptance must be
explicit before any swap. Rebuild expiring calldata and preview the swap
against real allowance after approval.

The owner subsequently approved that allowance; its receipt succeeded and
the real V3 allowance became exactly 5 USDT. An actual-state chain simulation
and Agentic Wallet swap preview passed for a fresh deadline-bound V3 call.
The owner was shown the lower direct-route output, off-hours status and
unsupported audit, then asked for confirmation of these exact swap terms.
At that point, receipt reconciliation and source/eligibility limits remained
open. The later receipt closed the feasibility test; source and eligibility
limitations remain production gates.

The owner then confirmed the bounded swap. Its first preview request expired,
so the same token pair, router, exact input and minimum output were rebuilt
with a fresh deadline. The final wallet preview had no new risk or authority
flags. The mined BSC calldata matched the preview; receipt, transfers, balances
and spent allowance reconciled. Wallet display quantity matched raw token
units multiplied by the public shares multiplier to display precision.

**Phase 2 feasibility is complete for one supervised NVDAon route.** The
PancakeSwap V3 direct route supplies an on-chain deadline and minimum but
quoted lower output than the opaque Agentic Wallet route. Keep the modular
wallet-native MVP direction, without activating an application execution
adapter from a one-off CLI test. AMDon and AAPLon remain discovery candidates;
their live quantity and transfer behavior is unverified. Defer owner
eligibility, source-price freshness, unsupported-audit policy and market
restrictions to P5 before automated proposals; P7 must implement durable
submission identity, receipt/reorg recovery and replay protection.

## Consequences and next evidence

P2 is complete as an integration feasibility study; the application has no
deployed contract or enabled signing/execution path. The one manual trade does
not authorize future trades. Resolve the production gates in the
[integration matrix](../integrations/2026-09-25-phase-2.md) before enabling
P5 or P7 live behavior. P3 database implementation is next. An automated
earnings provider requires a separate source/access decision before ingestion.
