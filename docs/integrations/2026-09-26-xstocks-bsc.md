# xStocks BSC integration evidence — 2026-09-26

Scope: P5.5 read-only xStocks-first candidate work. This page is not an
execution allowlist, wallet approval or trade authorization. [ADR 0011](../decisions/0011-xstocks-first-bsc-provider.md)
sets the provider-priority decision. Ondo's P2 trade remains historical.

## Exact candidate identities

The issuer's public `/api/v2/public/assets/{symbol}` API and Binance's
`type=2` BSC list agreed on the native token addresses. The issuer-listed
`wrapperAddressV2` entries were checked on BSC at block `124221220`; both
wrappers returned the expected `asset()` and 18 decimals. The current wrapper
conversion for one 18-decimal share unit equaled the native multiplier. The
older `wrapperAddress` is deliberately excluded.

| Underlying | Native rebasing token | Current v2 wrapper | Pinned `convertToAssets(10^18)` / `getCurrentMultiplier()` |
|---|---|---|---|
| NVIDIA / NVDAx | `0xc845b2894dbddd03858fd2d643b4ef725fe0849d` | `0xa8ddb5cd96b5222afe198316e9a57caa642850d5` | `1001701196801074000` |
| Apple / AAPLx | `0x9d275685dc284c8eb1c79f6aba7a63dc75ec890a` | `0x943bf64d566c32a2bcd41ac92fb63c111cc9de8f` | `1003269012539818700` |

The new `src/market-gate/xstocks-bsc.ts` adapter requires exact registry
expectations, verifies one issuer BSC deployment, pins a fresh block, checks
contract code and current-wrapper conversion, and emits P5 quantity evidence
with a mapping revision containing the multiplier and both code hashes. A
separate live adapter invocation succeeded for both candidates at blocks
`124221960` and `124221967`; these are read-only snapshots, not cached ratios.
Issuer metadata is short-lived receipt evidence. `isTradingHalted=false`
cannot be promoted to P5 venue-open or eligibility evidence.

## Route and product gates

At block `124221220`, PancakeSwap V3 factory `getPool` returned zero for
native and v2-wrapped NVDAx/AAPLx against BSC USDT, USDC and WBNB at fee tiers
100, 500, 2500 and 10000. Four Agentic Wallet `market-order quote` requests
for 5 USDT to those same bare and wrapped candidates returned the exact error
`No liquidity available, please try again later.` No transaction, approval,
signature or wallet state change occurred. This probes only those venues,
pairs, fee tiers, size and time. xStocks names PancakeSwap and CowSwap as BSC
venues, and PancakeSwap X can use off-chain fillers; those routes need their
own decoded-bound, simulation and approval integration before use. The issuer
API reports `supportsAtomicSwaps=true` for the deployments, but its published
xChange guide does not list BSC among the supported EVM networks; this
inconsistency is not resolved by assuming the route works.

| Gate | Current evidence | Remaining condition |
|---|---|---|
| Contract/quantity | Exact issuer/API/BSC identity and current wrapper conversion observed; fail-closed adapter/tests added. | Review current wrapper implementation and corporate-action update timing; reconcile external rebases and wrapper balances across ledger revisions. |
| Venue/route | No direct Pancake V3 pools at tested pairs/fees; Agentic Wallet 5-USDT quotes unavailable. | Find a BSC venue that returns actual-size, wallet-bound executable calldata with spender/recipient/deadline/minimum output; decode, simulate and reconcile it. |
| Eligibility | xStocks says tokens are technically transferable, while distribution and partner access remain restricted. | Establish user/venue-specific legal eligibility and current transfer permission without reusing Ondo's declaration as proof. |
| Market evidence | Existing Chainlink NVDA/USD, AAPL/USD and USDT/USD readers, NYSE calendar and issuer-event procedure may be reused if their source semantics fit the selected route. | Regular-session freshness, current issuer event review, current venue status and price/quote deviation validation. |
| Risk/authorization | Code presence and matching conversion establish neither an audit nor approval. | Supported risk evidence or a separately reviewed policy, then P7 approval binding, per-leg rechecks and transaction recovery. |

Sources: [issuer NVDAx asset](https://api.xstocks.fi/api/v2/public/assets/NVDAx),
[issuer AAPLx asset](https://api.xstocks.fi/api/v2/public/assets/AAPLx),
[issuer wrapper guidance](https://docs.xstocks.fi/developers/wrapped-xstocks),
[issuer multiplier guidance](https://docs.xstocks.fi/developers/multipliers),
[issuer distribution restrictions](https://docs.xstocks.fi/docs/product-legal-overview),
[xStocks BSC launch](https://xstocks.fi/news/xstocks-launches-on-bnb-chain),
[PancakeSwap X FAQ](https://docs.pancakeswap.finance/trade/pancakeswap-x/faqs),
[PancakeSwap V3 contracts](https://developer.pancakeswap.finance/contracts/v3/addresses).
