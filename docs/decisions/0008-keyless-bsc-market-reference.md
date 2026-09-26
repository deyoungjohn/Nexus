# ADR 0008: Use published BSC Chainlink rounds for the two-asset MVP

- Status: accepted for read-only integration; live release remains gated
- Date: 2026-09-26
- Owners: Codex (implementation); project owner (MVP scope)

## Context

Pyth Pro access is not available for this project. Its Core Hermes API also
requires authentication after the August 2026 upgrade and a data plan for
ongoing use. Chainlink's published BSC feed directory lists underlying
NVDA/USD and AAPL/USD reference feeds with `latestRoundData()` timestamps, plus
USDT/USD for settlement valuation. It does not list AMD/USD on BSC at this
review. The blueprint permits two or three verified equity instruments in the
MVP. On-chain equity feeds have a published 24-hour heartbeat, so a live round
may be too old for the market gate even while the exchange is open.

## Decision

Select NVDAon and AAPLon as the two read-only MVP candidates. Read underlying
NVDA/USD and AAPL/USD directly from their Chainlink BSC proxies, separate from
Ondo's BSC `sValue` quantity oracle. Read the standard 8-decimal Chainlink
USDT/USD proxy for settlement valuation and widen its value with an explicit
policy uncertainty band. Require an explicit maximum deviation from $1 and
emit the same `USD-18` valuation unit used by P5 snapshots. Require chain 56,
an exact proxy/description/decimals
match, one pinned block, a valid round, provider `updatedAt` and a configurable
short freshness limit. A stale feed blocks rather than borrowing receipt time.
Keep the Pyth adapter dormant as an optional future source; it is not required
for this two-asset route. Do not register AMDon for execution without a
separately verified reference source. A recent feed round still needs an
independent dated NYSE session, token status, eligibility, event and audit
checks.

Eligibility can be represented only by a future wallet/venue-bound,
time-limited and revocable attestation. A conversation statement is context,
not durable evidence for `EligibilityEvidence`; no identity detail belongs in
the repository or MCP memory.

## Consequences

The project can test reference and settlement source semantics without a Pyth
subscription or wallet transaction. Read-only mainnet probes succeeded for
both equities, USDT/USD and Ondo quantity on 2026-09-26. The equity rounds
were from the prior regular session; they correctly fail a 60-second age
limit on the weekend. A regular-session freshness check and all other P5.5/P7
gates remain mandatory before automation.

The settlement reader now rejects a feed answer beyond a caller-specified
peg-deviation threshold and emits `USD-18`. A read-only Saturday probe passed
with illustrative 20-minute source age, 50-basis-point uncertainty and
100-basis-point peg bounds; production thresholds and regular-session behavior
remain to be reviewed. The threshold is an input, not a standing live policy.

Sources: [Chainlink BSC feed directory](https://reference-data-directory.vercel.app/feeds-bsc-mainnet.json),
[Chainlink feed reading guidance](https://docs.chain.link/data-feeds/using-data-feeds),
[Pyth Core upgrade](https://www.pyth.network/blog/the-pyth-core-upgrade).
