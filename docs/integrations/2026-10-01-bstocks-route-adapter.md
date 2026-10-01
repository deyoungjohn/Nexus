# bStocks production route-adapter smoke — 2026-10-01

Work items: P5.5e/P7.1. Status: read-only adapter works; live admission open.

At BSC block **125153134**, the application adapter verified the canonical
quantity hash, observed factory/pool/router/quoter code identities, token pair,
fee 2500, factory pool lookup, nonzero liquidity and unlocked pool state. An actual
5-USDT quote returned **21500926434853864 raw NVDAB base units** with a
50-bps bounded minimum of **21393421802679595**. All raw token quantities
remain independent of the UI multiplier. Quote source and code-observation blocks
are different; current code was checked again at the quantity frame.

Approved gas ceilings for this smoke were 300,000 units at 5 gwei. The adapter
priced that complete ceiling using same-block Chainlink BNB/USD and USDT/USD
rounds, one-hour maximum age and a 100-bps uncertainty haircut. These smoke limits
are not approved live limits. The real-state simulation correctly returned no
execution evidence for a synthetic unfunded address. No allowance override,
wallet signature, allowance transaction or submission occurred. The persisted
quote's deadline has passed and its bytes must never be reused.

[Structured evidence](2026-10-01-bstocks-route-adapter.json) contains source,
canonical hashes, observed code pins, raw amounts and clocks. Observed pins are
identity evidence, not source/security review or approval of deployment configuration.
This probe does not supply eligibility, share entitlement, events, token security
clearance or a complete P5 packet. Qualified production sources/risk gates stay open.
An initial unpinned probe returned no quantity snapshot; the completed probe pinned
the head/hash before capturing its clock, avoiding a moving-head clock boundary.

Primary interfaces: [Pancake deployment addresses](https://developer.pancakeswap.finance/contracts/v3/addresses),
[QuoterV2](https://raw.githubusercontent.com/pancakeswap/pancake-v3-contracts/main/projects/v3-periphery/contracts/interfaces/IQuoterV2.sol),
[SwapRouter](https://raw.githubusercontent.com/pancakeswap/pancake-v3-contracts/main/projects/v3-periphery/contracts/interfaces/ISwapRouter.sol),
[Chainlink BNB/USD](https://data.chain.link/feeds/bsc/mainnet/bnb-usd).
