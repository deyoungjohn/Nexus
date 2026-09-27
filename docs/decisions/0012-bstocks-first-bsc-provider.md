# ADR 0012: Prioritize bStocks for the first BSC live-provider integration

- Status: accepted for P5.5 provider priority; live execution remains blocked
- Date: 2026-09-27
- Owners: project owner (provider switch); Codex (route investigation)
- Supersedes: [ADR 0011](0011-xstocks-first-bsc-provider.md) for priority only

## Context

Nexus originally tested Ondo, then prioritized xStocks to reduce the friction
of Ondo-specific access controls. The [671-record BSC liquidity survey](../research/2026-09-27-bsc-stock-liquidity.md)
found a different constraint: only four of 96 equity-scoped xStocks returned a
100-USDT wallet quote, and the successful quotes were generally thin or badly
priced. By comparison, 66 of 67 equity-scoped bStocks returned one; the deepest
20 direct USDT pools also quoted at 10,000 USDT with little size deterioration.
These are dated observations, not guarantees of future liquidity.

Binance's bStocks are separate tokenized securities. Their BEP-677 multiplier
changes the displayed amount while raw ERC-20 balances and transfer amounts
remain the on-chain accounting units. The existing Ondo and xStocks quantity
adapters therefore cannot be reused as bStocks evidence. Binance also describes
jurisdictional and address restrictions for bStocks; a DEX quote cannot prove
user eligibility. See the [bStocks FAQ](https://www.binance.com/en-NG/support/faq/detail/f0c03cd6509a4085b4cce1636f16be38)
and [BEP-677 specification](https://github.com/bnb-chain/BEPs/blob/master/BEPs/BEP-677.md).

## Decision

Make **bStocks the first live-provider target** for P5.5. Select the exact BSC
NVDAB contract `0x02fca66c1d1afb4e2a7884261eb00f63598a7436` as the
initial route candidate, rather than substituting by ticker. Preserve the
issuer-neutral P3/P4/P5 boundaries and retain Ondo and xStocks modules as
separate, dormant integrations. No automatic provider switching is added.

Use a provider-specific bStocks identity and BEP-677 quantity model before
production registration: pin chain, contract code and decimals; read the
current and pending UI multiplier/effective time at one block; keep raw amounts
canonical and apply the multiplier only to economic/display exposure. Review
proxy implementation/control changes, corporate actions, exact wallet/venue
eligibility, token-risk policy, independent timely price evidence and settlement
valuation. Do not treat 24/7 bStocks spot or DEX quotes as a fresh underlying
US-equity reference without an explicit P5 policy decision.

For route research, the currently supported direct PancakeSwap V3
`exactInputSingle` format is the narrow candidate. Require an exact USDT and
bStock contract pair, approved factory/pool/router and fee tier, fixed wallet
recipient, exact raw input, on-chain minimum output and deadline, bounded
price/cost deviation, and read-only simulation. The
[dated BSC evidence matrix](../integrations/2026-09-27-bstocks-bsc.md) records a
successful conditional 5-USDT route probe. That probe used temporary RPC
balance and allowance overrides; neither real funding nor approval was
changed. An expired probe cannot be submitted and must be rebuilt and checked
at execution time.

## Consequences

ADR 0011's xStocks wrapper findings remain valid, but its first-provider
priority is superseded. P5.5 remains open for a bStocks quantity adapter,
current eligibility, supported risk handling, source policy, issuer events and
end-to-end evidence. P7 owner approval, revalidation, idempotent submission and
reconciliation remain mandatory. No bStocks instrument, signer or application
execution route is enabled by this decision.
