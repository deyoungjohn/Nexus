# ADR 0030 — Canonical route adapters and explicit web EOA approval

Date: 2026-10-01. Status: implemented; live qualification open.
Work items: P5.5e/P7.1/P8.3/P8.4. Extends ADR 0029.

## Decision

Implement exact accepted-size USDT/NVDAB buy/sell quotes for the known direct
Pancake V3 pool. Operator-owned configuration pins factory, pool, router and
QuoterV2 code hashes; deployment binds the route configuration digest. At the
canonical quantity block, check code, factory relationships, pair/decimals,
fee, active liquidity and unlocked slot0. Encode only exactInputSingle with
fixed EOA recipient, zero native value, bounded minimum and short deadline.
Compute price impact from the fee-adjusted raw spot ratio with integer rounding;
spread records the 25-bps pool fee, while P5 separately enforces the independent
underlying fair-price bound. No ticker/display quantity supplies swap units.

Price the full maximum gas ceiling, rounding upward, from positive complete
same-block Chainlink BNB/USD and USDT/USD rounds with configured freshness,
depeg and uncertainty limits. Pin all reads by EIP-1898 and check canonical hash
again at completion. Simulation uses exact quoted bytes, real balance/allowance,
real native gas, eth_call and eth_estimateGas with no state overrides. Unsupported
RPC methods, changed code/identity, stale prices, insufficient funds/allowance,
reverts, excess gas or reorg return no evidence. These ports are automatic when
trusted runtime route configuration is present; previous explicit ports remain
compatible. Changed route configuration invalidates stored execution authority.

Add authenticated /api/execution read/prepare/persist/broadcast commands through
an application service. No policy/evidence/configuration/amount fields are accepted
from clients. Safe list records omit owner signatures, signed bytes and nonces;
only an owner-requested fresh review returns the precise signing envelope/template.
Use existing origin/body/cookie/no-store boundaries and the guarded executor's
atomic checks. Operator configuration is read from NEXUS_EXECUTION_CONFIG;
broadcast defaults false. Unconfigured access/economic/events/valuation sources
remain null; no public flag or browser fixture may populate them.

Expose exact trade bounds in a separate P8 panel. Rule activation is not trade
approval. The owner confirms bounds, signs canonical EIP-712, signs the transaction
without sending, stores it and separately submits. Extract the existing canonical
signing schema into a browser-safe module; preserve its exported EOA API. Check
account/chain/session and expiry before/after asynchronous wallet work and verify
returned signed bytes. Unsupported raw signing offers explicit signed-byte import;
never fall back to eth_sendTransaction. Refresh/reload finds a persisted signed
leg without exposing its bytes; accepted/unknown sends await historical recovery.

## Consequences and evidence

EOA extensions differ in signing capabilities. Import is a supported fallback,
not a promise that every extension can export raw transactions. Sign-in and typed
approval alone cannot place a trade or satisfy issuer eligibility. Browser payload
checks complement server authority; they do not establish data-source authenticity.
Actual funded-wallet simulation/mainnet acceptance, qualified source/review/scanner/
risk policy, chain initialization and operational repair remain release gates.

Unit and PostgreSQL tests cover changed venue/source/state/authority, exact payloads,
unsafe imports and secret-free record projection. Browser tests use explicit synthetic
HTTP/wallet fixtures plus real saved-workspace HTTP/PostgreSQL cases; no real signing
or send occurs. The [read-only smoke](../integrations/2026-10-01-bstocks-route-adapter.md)
validates actual public quoting and blocks an unfunded synthetic simulation.

Primary sources: [Pancake addresses](https://developer.pancakeswap.finance/contracts/v3/addresses),
[QuoterV2 interface](https://raw.githubusercontent.com/pancakeswap/pancake-v3-contracts/main/projects/v3-periphery/contracts/interfaces/IQuoterV2.sol),
[SwapRouter interface](https://raw.githubusercontent.com/pancakeswap/pancake-v3-contracts/main/projects/v3-periphery/contracts/interfaces/ISwapRouter.sol),
[Ethereum JSON-RPC](https://ethereum.org/developers/docs/apis/json-rpc/).
