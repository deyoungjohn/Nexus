# P5.5e bStocks BSC route evidence — 2026-09-27

Status: **direct V3 route format validated read-only at one block; no live
instrument or transaction enabled.** This is a dated route probe, not a reusable
quote or owner approval. It follows the [bStocks-first decision](../decisions/0012-bstocks-first-bsc-provider.md)
and the [liquidity survey](../research/2026-09-27-bsc-stock-liquidity.md).

## Exact identity and venue

| Item | Observed value | Evidence |
| --- | --- | --- |
| Chain | BSC, `56` | RPC `eth_chainId=0x38` |
| Settlement | USDT `0x55d398326f99059ff775485246999027b3197955`, 18 decimals | RPC `decimals()` |
| bStock | NVDAB `0x02fca66c1d1afb4e2a7884261eb00f63598a7436`, 18 decimals | [Binance `type=3` BSC listing](https://www.binance.com/bapi/defi/v1/public/wallet-direct/buw/wallet/market/token/rwa/stock/detail/list/ai?type=3) and RPC `decimals()`/code |
| Pancake V3 factory | `0x0BFbCF9fa4f9C56B0F40a671Ad40E0805A091865` | [PancakeSwap deployment list](https://developer.pancakeswap.finance/contracts/v3/addresses) |
| Direct pool | `0x8FB4243b553aC29BA088aCf00B9B7dA24bD6690C`, fee `2500` (0.25%) | At block 124347223, pool `token0/token1/fee/factory` matched and the official factory's `getPool` returned this address |
| V3 router | `0x1b81D678ffb9C0263b24A97847620C99d213eB14` | [PancakeSwap deployment list](https://developer.pancakeswap.finance/contracts/v3/addresses) |
| QuoterV2 | `0xB048Bbc1Ee6b733FFfCFb9e9CeF7375518e25997` | [PancakeSwap deployment list](https://developer.pancakeswap.finance/contracts/v3/addresses) |

The token's BSC runtime had code, but its 283-byte proxy-style runtime is not a
review of its implementation, administrators or transfer controls. The public
per-asset status returned `openState=true`, `reasonCode=TRADING` and no
`marketStatus` at 14:19 UTC. It does not establish eligibility or a fresh
underlying reference. The 5-USDT Agentic Wallet quote at 14:17 UTC returned
`0.022236772676862701` token units with `slippage=0.01`, but its path and
calldata were opaque; the direct route below was built independently.

## Pinned direct-route probe

At BSC block **124348179** (2026-09-27 14:23:40 UTC), QuoterV2 estimated a
5-USDT direct buy of **0.022176198062689502 raw NVDAB**. On-chain
`uiMultiplier()` and `newUIMultiplier()` both returned
`1.000778223752807865`; `effectiveAt()` returned zero. The adjusted display
quantity would be `0.02219345610676885872970536616`. [BEP-677](https://github.com/bnb-chain/BEPs/blob/master/BEPs/BEP-677.md)
requires raw ERC-20 operations to remain in raw units; Nexus must not put the
adjusted UI quantity into swap calldata.

The candidate used the supported `exactInputSingle` selector `0x414bf389`:
exact input `5000000000000000000` USDT base units, fee `2500`, the connected
BSC wallet as fixed sender/recipient (address intentionally omitted), zero
native value, zero `sqrtPriceLimitX96`, a 50-bps-below-quote minimum of
`22065317072376054` raw NVDAB units, and on-chain deadline
**2026-09-27 14:33:40 UTC**. The deadline has passed; this exact calldata must
not be reused. Nexus's existing V3 decoder matched token pair, recipient,
input, minimum and fee tier.

A pinned-block `eth_call` with **temporary state overrides only** for an exact
5-USDT wallet balance and router allowance returned
`22176198062689502` raw NVDAB, above the encoded minimum. `eth_estimateGas`
with the same overrides returned **182,595 gas units**. Increasing the minimum
to one raw unit above the quote reverted; setting the deadline before the
block time also reverted. The actual wallet did **not** have both the 5-USDT
balance and exact router allowance at the check. No token approval, wallet
signature, transaction, or on-chain state change was made.

For a same-time **screening comparison**, the [Binance spot best ask](https://api.binance.com/api/v3/ticker/bookTicker?symbol=NVDABUSDT)
was **224.84 USDT per displayed NVDAB** at 14:23:46 UTC. Applying the pinned
UI multiplier, the V3 quote cost **225.29 USDT per displayed unit** (0.20%
above that ask). Even at the encoded minimum, the worst effective price was
**226.42 USDT per displayed unit** (0.70% above that ask). The ask endpoint
has no source-origin timestamp and is the same platform's bStock price, not
an independent fresh underlying-equity feed. This comparison screens obvious
route mispricing but does not satisfy P5's production reference-price gate.
The direct pool's pinned 5-USDT buy/sell round trip returned about 4.9750
USDT (roughly 0.50% loss before gas); larger 100, 1,000 and 10,000 USDT
read-only quotes were available at the same fee tier.

## Remaining gates

- Implement and test a separate bStocks raw/UI quantity adapter, multiplier
  scheduling and code/control revision checks before registering this token.
- Establish current issuer/venue/wallet eligibility and geographic policy.
  Binance's [bStocks FAQ](https://www.binance.com/en-NG/support/faq/detail/f0c03cd6509a4085b4cce1636f16be38)
  describes restrictions; a route quote is not an eligibility result.
- Binance's token-audit response for this contract was
  `hasResult=false, isSupported=false` at 14:25 UTC. Security audit data is
  not available for this token on this chain. P5 must continue to block an
  unsupported audit until a reviewed policy supplies equivalent evidence.
- Obtain a source-timestamped reference/settlement policy for bStocks across
  regular and off-hours trading, plus corporate-action and issuer-event checks.
- Fund and approve only after a fresh owner-reviewed plan; then refresh the
  quote, deadline, exact calldata, real-state wallet preview and simulation.
  P7 approval binding, submission recovery and reconciliation are still absent.

The route is **conditionally viable as a bounded direct V3 call**, not an
immediately executable or application-enabled trade. The audit result is for
reference only and does not constitute investment advice. Always conduct your
own research.
