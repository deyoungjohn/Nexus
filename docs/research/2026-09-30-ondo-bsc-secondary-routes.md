# Ondo BSC secondary-market route reassessment

Date: 2026-09-30. Agent/client: Codex. Work items: P5.5a/P5.5c/P5.5d/P5.5e;
P7 dependency. [Structured observations](2026-09-30-ondo-bsc-secondary-routes.json).

**Finding:** Ondo has credible small-order BSC secondary liquidity, including
a directly decoded and conditionally simulated Nvidia route. It is worth
continuing as a fallback candidate. This reassessment does **not** establish a
production-ready alternative: fresh independent equity prices, supported risk
evidence and a reviewed user/venue access process remain missing. Apple's
direct pool cannot fill the requested size; its aggregator alternatives require
additional route and intermediary-token review. The bStocks-first decision
remains in force; no provider switch or application change was made.

## Scope and method

- Discovery: 15:58:16–15:58:23 UTC, during the US regular session. The
  [official NYSE calendar](https://www.nyse.com/trade/hours-calendars) supports
  the session classification; all 25 sampled Binance asset-status responses
  reported `openState=true`, `TRADING`, `regular`. These are momentary status
  receipts, not independent stock prices or permission for Nexus's venue.
- The current Binance public Ondo inventory contained **458 BSC instruments**,
  including 329 labelled equities by its `assetType=1`. DEXScreener discovery
  scanned every address in batches of at most 30, found **45 distinct pools**
  and **19 instruments with reported direct USDT/USDC pools**, without batch
  errors. Discovery is indexed coverage, not an exhaustive proof of all pools.
  Endpoint/batching reference: [DEXScreener API](https://docs.dexscreener.com/api/reference).
- Selected **25 instruments**: those 19 plus otherwise absent NVDA/AAPL/AMD/
  TSLA/MSFT/AMZN/META/GOOGL candidates. PancakeSwap factory checks covered
  USDT fee tiers 100/500/2500/10000; USDC was also checked for the discovered
  USDC candidate. Each asset's metadata, factory/pool identity, active
  liquidity, settlement balance, shares ratio and quotes were read at one
  pinned block via the owner's public BSC dataseed RPC. Assets have different
  pinned blocks; this is not an atomic market-wide snapshot.
- Direct quotes tested **5, 100, 1,000 and 10,000 settlement tokens** during
  16:01:37–16:02:16 UTC. Reverse quotes use the hypothetical buy output at the
  **same original block**, not the pool state after an actual buy. Their ratios
  are two-direction depth screens, **not realizable round-trip returns**.
  Gas, source uncertainty and independent fair-value bounds are excluded.
- The initial 100 Kyber quote requests returned 53 previews and 47 HTTP 429
  responses. Throttling is not evidence of absent liquidity. A paced retry
  of all four sizes for NVDA/AAPL/TSLA/AMD, with `excludeRFQSources=true`,
  returned **16/16 previews** at 16:14:57–16:15:38 UTC. These exclude RFQ
  sources at the API's request level; they are not an issuer onboarding test.
- Agentic Wallet CLI 1.10.0 returned `UNCONNECTED` in this environment. No
  connected-wallet quote is claimed. All evidence below comes from public
  APIs and RPC; no user wallet, private key, signature, approval, broadcast
  or issuer account was used. Synthetic `eth_call` overrides do not change
  chain state. Observations are historical and must be refreshed before use.

## Direct equity depth

Selected best five-unit-output PancakeSwap pools, with outputs rounded for
readability. Outputs are **raw token quantities after 18-decimal scaling**,
not reference shares; Ondo's shares ratio must be applied separately.
Settlement balances are on-chain USDT inventory, **not guaranteed executable
liquidity**. The JSON includes every sampled pool, failure and exact output.

| Equity | Pool USDT balance | Tokens quoted for 5 USDT | Tokens quoted for 100 USDT | Output per USDT falls at 1,000 vs 100 | Reverse quote / 1,000 input* |
| --- | ---: | ---: | ---: | ---: | ---: |
| NVDAon | 12,786.50 | 0.02144844 | 0.42872264 | 0.54% | 96.85% |
| DISon | 31,786.55 | 0.04661781 | 0.93194853 | 0.41% | 98.59% |
| PDDon | 29,566.76 | 0.06400949 | 1.27976937 | 0.31% | 98.81% |
| GMEon | 35,098.23 | 0.19827745 | 3.96381207 | 0.41% | 98.59% |
| BILIon | 17,178.81 | 0.33173721 | 6.63087705 | 0.56% | 98.29% |
| GOOGLon | 1,772.40 | 0.01413912 | 0.28221892 | 23.72% | 73.45% |
| MCDon | 427.29 | 0.02098471 | 0.41849367 | 2.97% | 42.36% |
| NKEon | 371.54 | 0.13701193 | 2.67785914 | 21.99% | 32.99% |
| INTCon | 317.77 | 0.04179882 | 0.78412991 | 80.98% | 15.74% |
| TSLAon | 7.20 | 0.01194099 | 0.23875091 | 17.66% | less than 0.0001% |
| AAPLon | 23.30 | 0.00000221 | 0.00000221 | 90.00% | less than 0.0001% |

*Counterfactual reverse screen defined above. A positive quote alone can
conceal incomplete input consumption, especially in exhausted V3 pools.

Eighteen sampled instruments had some positive direct PancakeSwap output,
including **11 equity-labelled instruments and seven ETFs**. This count
includes unusable Apple/Tesla pools and is not a usable-route count. AMZN,
MSFT and META had no positive output in the tested PancakeSwap USDT pools;
AMD had no such pool. UBER/SPCX/GLD had indexed pools on other DEX paths that
were not directly simulated here. No market-wide claim of untradeability is
made. DIS/PDD/GME/BILI look stronger on these depth screens, but their
independent references and bounded router effects have not been qualified.

ETF liquidity must not inflate the stock-MVP result. FXIon and SGOVon had
relatively stable 10,000-unit depth screens; QQQon/SPYon were thin. ETFs,
leveraged products and private-company exposure require separate instrument
scope and reference review before support.

## Nvidia: bounded route and effects

| Identity | Exact BSC address |
| --- | --- |
| USDT | `0x55d398326f99059ff775485246999027b3197955` |
| NVDAon | `0xa9ee28c80f960b889dfbd1902055218cba016f75` |
| NVDAon/USDT pool, 1% fee | `0xb90bdbfbdffd4af5a636b5805539edeafb969308` |
| PancakeSwap V3 router | `0x1b81d678ffb9c0263b24a97847620c99d213eb14` |
| PancakeSwap V3 factory | `0x0bfbcf9fa4f9c56b0f40a671ad40e0805a091865` |
| QuoterV2 | `0xb048bbc1ee6b733fffcfb9e9cef7375518e25997` |
| Ondo SyntheticSharesOracle | `0xf4fd8a1b412633e10527454137a29db7aa35f15e` |

Factory, quoter and router match
[PancakeSwap's published V3 contracts](https://developer.pancakeswap.finance/contracts/v3/addresses).
Nexus's existing `decodeV3ExactInputSingle` matched the exact input/output,
recipient, fee, requested amount, minimum and deadline. The five-unit route
quoted **0.021448438441766330 NVDAon**, with encoded minimum
**0.021341196249557498** (50-bp output tolerance) and a ten-minute deadline
from the pinned block. A tolerance against a quote is not a fair-value bound.

Read-only router calls first ran at block **124937620**. Further calls at
**124939138** used a temporary EVM observer at a synthetic address to read
both token balances before and after the swap. USDT balance and allowance
storage overrides were separately verified by their getters. All four sizes
spent the full requested USDT and received exactly the quoted NVDAon net
balance increase. Raising the five-unit minimum above the quote reverted
`Too little received`; an expired deadline reverted `Transaction too old`.
This is conditional synthetic execution, not intended-wallet eligibility or
a mined receipt/P7 recovery result.

The 10,000-USDT route still spent all 10,000 but returned only **10.52847511
NVDAon**. It is an extreme execution-price failure, not the partial-consumption
case observed for Apple. The 5–100-unit path is the strongest compatibility
candidate; its 1% pool fee and exit costs must fit an approved cost policy.

## Apple and aggregator alternatives

AAPLon is `0x390a684ef9cade28a7ad0dfa61ab1eb3842618c4`. Its best sampled
direct pool was `0x8dcba688219dc5ee6dbf74ee2f74045e2a07c79c` (fee 100).
Every requested size returned only **0.000002205106855541 AAPLon**. At block
**124939148**, the observer showed the router actually consumed only
**0.000705695629984917 USDT**, leaving the rest of the requested input
unspent. The call's success and minimum-output check therefore do not prove
full-size execution. The quoter reported about 24.6 million gas for this
exhausted-pool traversal, another reason this direct pool is unsuitable.

The initial observer's ten-million gas cap produced an empty revert after
the plain router call had succeeded. A fifty-million cap permitted balance
inspection and exposed partial input consumption. A fresh same-block cap
comparison and its outcome are retained in the JSON. These probe settings
are diagnostic, not proposed production gas limits.

Paced **RFQ-excluded aggregator previews**, rounded raw-token quantities:

| Token | 5 USDT | 100 USDT | 1,000 USDT | 10,000 USDT |
| --- | ---: | ---: | ---: | ---: |
| NVDAon | 0.02164506 | 0.43282857 | 4.32754312 | 25.79189057 |
| AAPLon | 0.01479673 | 0.29299727 | 2.80474152 | 16.10272733 |
| TSLAon | 0.01414001 | 0.27160808 | 2.45385012 | 7.58334425 |
| AMDon | 0.00787979 | 0.15497643 | 1.33799204 | 4.33022980 |

These are estimates, not decoded/simulated Nexus routes. The quoted Kyber
router is `0x6131b5fae19ea4f9d964eac0408e4408b66337b5`. Small Apple/Tesla
previews traversed CAKE and the token
`0x18d0e455b3491e09210292d3953157a4bf104444`, whose on-chain symbol is
`比特币`; a symbol is not evidence of Bitcoin backing or token safety. An
earlier Apple path also traversed ASTER. Larger Nvidia paths included NVDAB
`0x02fca66c1d1afb4e2a7884261eb00f63598a7436`, which would reintroduce bStocks
into a supposed Ondo-only fallback. Other paths use V4/Infinity/split venues.
Every intermediate token and venue needs explicit review; endpoints alone
do not define provider exposure. No Kyber build, calldata approval or effect
simulation was performed, and the aggregator's own USD estimates are not an
independent reference.

[Kyber's current API specification](https://docs.kyberswap.com/developer-guide/aggregator-api/aggregator-api-specification/evm-swaps)
documents the previous endpoint's rate limits and a newer key-based gateway.
Public previews working today do not establish reliable production service
or free gateway access. The current Nexus direct-V3 decoder does not validate
these broader routes.

## Remaining gates and recommendation

At 16:17 UTC, complete Chainlink rounds were last updated at **14:07:31 UTC
for NVDA** and **14:03:45 UTC for AAPL**, roughly **130 and 134 minutes old**.
Both fail the existing **60-second** reference-age gate even in the regular
session. USDT's observed round was roughly nine minutes old; settlement
production limits still need qualification. Positive, unpaused Ondo ratios
with no pending mapping/pause were observed for the two candidates; this
does not close economic/risk/event review.

Using the stale NVDA reference only as an illustration, the five-unit direct
route implies about **$232.58 per reference share**, roughly **0.71% above**
the $230.955 round; its encoded minimum implies about **1.21% above**.
These are not valid current price bounds and cannot support a trade approval.
The prior off-hours/Sunday failures were not the only obstacle.

Binance security checks again returned `isSupported=false` with no audit
result for NVDAon/AAPLon/AMDon. This is unavailable risk coverage, neither a
clean audit nor a finding of malicious behavior. Security checks cannot
guarantee safety; this report is technical evidence, not investment advice.

[Ondo secondary-market restrictions](https://docs.ondo.finance/ondo-stocks/secondary-market-restrictions)
separate acquisition representations from issuer redemption/KYC. These
direct-pool probes used no issuer RFQ/minting API, so they do not establish
that an issuer account is needed for the observed technical path. They also
do not prove any user's jurisdiction, platform compliance or transfer
eligibility. The [verification report](../verificaton-challenges.md) remains
the access-requirements record.

**Recommendation:** keep Ondo secondary acquisition as the next candidate
to qualify, starting with small direct Nvidia orders. Do not switch the
provider or request a trade yet. Qualify a source-timestamped free equity
reference under an explicitly reviewed price policy; complete route-specific
access and risk/event evidence; then either identify a reviewed second-asset
route or deliberately revise the MVP scope. Apple aggregator support would
be additional integration work. P7 runtime/historical evidence and recovery
remain independent prerequisites; the supplied RPC also failed a short-aged
pinned-state replay with `missing trie node` during this investigation.

Verification: pre-change full check passed 139 tests, zero failures/skips,
strict typecheck and both builds. Post-documentation PostgreSQL-backed full
check also passed 139 tests, zero failures/skips, strict typecheck and both
builds. Evidence/count/effect/gas-control assertions, reconstructed calldata
hashes and `git diff --check` passed. Application interfaces, provider priority,
access rules and freshness limits are unchanged.

⚠️ This audit result is for reference only and does not constitute investment
advice. Always conduct your own research.
