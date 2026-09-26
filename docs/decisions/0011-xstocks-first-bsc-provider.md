# ADR 0011: Integrate xStocks first through an exact BSC wrapper boundary

- Status: accepted for P5.5 integration priority; live execution remains blocked
- Date: 2026-09-26
- Owners: project owner (provider priority); Codex (implementation)

## Context

The blueprint is issuer-neutral but P2 and the first P5.5 adapters concentrated
on Ondo. The owner selected xStocks as the first live-provider target because
its secondary-market tokens may require less repetitive onboarding. That is a
provider-priority pivot, not an instruction to bypass geographic restrictions
or grant trading authority. The P2 Ondo trade remains a valid historical
feasibility test but cannot certify an xStocks route.

xStocks EVM `balanceOf()` rebases after corporate actions. Its current v2
ERC-4626 wrapper holds a stable share balance and exposes `asset()` and
`convertToAssets()`. Legacy v1 wrappers have a donation-sensitive conversion
and must not be used as a pricing or trading integration. The issuer's BSC
public asset listing identifies the native token and current wrapper for each
symbol. Public metadata is discovery evidence, not immutable contract identity
or a venue quote. xStocks' legal restrictions and integration review still
apply to the product despite permissionless token transfers.

## Decision

Prioritize NVDAx and AAPLx on chain 56 as **candidate** instruments. Keep the
Ondo adapters as dormant, separate modules. Model each current v2 wrapper as
its own exact instrument with `quantityModel=xstocks-v2-wrapper`; never treat
the bare rebasing token and wrapper as interchangeable. Require immutable
expected token and wrapper addresses, underlying symbol and USD denomination
before accepting the issuer API. At one
pinned BSC block verify chain, fresh header, deployed code, both 18-decimal
interfaces, wrapper `asset()` identity, and equality between the native
`getCurrentMultiplier()` and wrapper `convertToAssets(10^18)`. Bind both code
hashes and the multiplier into the mapping revision. These are read-only
identity and quantity checks; they do not constitute a contract audit or price.
If either token or wrapper is upgradeable, a proxy runtime hash alone does not
identify its current implementation or administrator; that control surface
must be reviewed separately before production registration.

Keep issuer halt as a veto, but do not interpret `isTradingHalted=false` or
issuer `openNow` as proof of a DEX route or a current underlying reference.
Maintain P5's regular-session, freshness, eligibility, audit and exact-route
gates until separately revised with evidence. The Ondo-specific 24-hour owner
attestation is not an xStocks eligibility credential. A provider-specific
eligibility and jurisdiction policy must be established before production.

No automatic issuer substitution is added. A missing xStocks route leaves the
plan blocked rather than switching to an Ondo or bStocks token with the same
ticker. P7 approval, revalidation and recovery remain prerequisites for all
providers.

## Consequences

P3/P4/P5's provider-neutral public interfaces remain compatible. P5.5 must
now establish an executable xStocks BSC venue, actual-size quote and simulation,
current wrapper contract review, corporate-action update handling, provider
eligibility, supported risk evidence, regular-session price checks and P7
lifecycle integration. On 2026-09-26 the wallet's 5-USDT quotes for both bare
tokens and current wrappers all returned no liquidity, and direct Pancake V3
pools against USDT, USDC and WBNB were absent at the tested fee tiers. Those
observations are time-specific and do not rule out other venues or off-chain
filler routes. No instrument was enabled for execution.

Sources: [xStocks developers](https://docs.xstocks.fi/developers),
[current and legacy wrappers](https://docs.xstocks.fi/developers/wrapped-xstocks),
[corporate-action multipliers](https://docs.xstocks.fi/developers/multipliers),
[legal overview](https://docs.xstocks.fi/docs/product-legal-overview),
[xStocks BSC announcement](https://xstocks.fi/news/xstocks-launches-on-bnb-chain),
[PancakeSwap V3 addresses](https://developer.pancakeswap.finance/contracts/v3/addresses).
