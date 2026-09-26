# Specification 0001 — Domain foundation

Status: approved for implementation by the user's blueprint/build instruction.
Source: `Nexus.md` sections 4.2–4.3, 5.1, 9 and 11.
Scope: P1, pure local calculations, no wallet or database side effects.

## Quantities

Represent nonnegative amounts as `bigint` base units with an explicit asset ID
and decimals. Asset IDs are canonical BSC/EVM token identity or native gas
identity, never tickers. Parse unsigned plain decimal strings exactly; reject
exponents, signs, whitespace, excess precision and unsafe raw numbers. Support
0–255 decimals. Add/subtract/compare only identical asset ID and decimals;
reject negative balances. Serialize base units as canonical decimal strings
with denomination, and validate deserialization at runtime. No implicit USD
valuation or stablecoin parity.

## Instrument identity

Canonical identity includes chain, lowercase 20-byte token contract, issuer and
product. Validate positive safe chain IDs, nonzero EVM addresses and explicit
identifier syntax. A ticker cannot resolve to an execution instrument.
Registry records include underlying, decimals, quantity model/adapter version,
classification version and sector tags, evidence source IDs and eligibility
requirements. Copy/freeze stored records; reject duplicate identity or duplicate
chain/contract aliases. Two wrappers may share an underlying but remain distinct
instruments. Unknown quantity models are retained as read-only metadata; registry
membership grants no trading permission, even for fixed-balance models.

## Budget allocation primitive

Input: confirmed settlement balance, reservations, minimum reserve and
conservative settlement fee allowance, each identically denominated; a separate
native gas balance/required allowance; buy spending requests with unique stable
ASCII IDs, nonnegative integer priorities and positive settlement amounts.
Lower priority number executes first. This primitive does not value holdings,
net sells, reserve funds or create an executable plan.

Available settlement = confirmed − reserved − minimum reserve − fee allowance.
Insufficient funds to cover commitments or native gas blocks all allocation
with a reason code. Native gas must be the same chain's native asset and cannot
be substituted with settlement funds. Invalid denomination/IDs throw an input
error. A zero available balance is valid and produces cash-limited rejections.

Fund each priority group fully if affordable. Otherwise floor proportional
shares, then award remaining units by largest fractional remainder and stable
ASCII ID for ties. Lower-priority groups receive no funds until higher-priority
demand is satisfied. Output order is priority then ID, independent of input
order. Report requested/accepted/rejected amounts, accepted/reduced/rejected
status, stable reason code, available budget and unallocated cash. Preserve
every base unit; never accept more than requested. Do not count expected sells.

## Acceptance evidence

- Parsing/serialization round trips above `Number.MAX_SAFE_INTEGER`, 0/255
  decimals, malformed input, mismatched assets and underflow.
- Same company/different wrappers remain distinct; identity validation,
  duplicate rejection, unknown lookup, immutable registry and unsupported model.
- Reservation/minimum/fee deductions, native gas separation, exhausted and
  insufficient budgets, duplicate IDs, priority, proportional allocation and
  deterministic rounding; input permutations produce the same decisions.
- Generated cases assert conservation, request bounds and deterministic replay.
- A runnable synthetic allocation example reports exact string amounts and
  explicitly says it cannot execute. It is not the full NVDA/AMD example, which
  requires P4 concentration and event constraints.
- `./scripts/check.sh` runs tests, type checking and build while retaining
  Portable's existing configuration checks.

Full coordinator, concurrent database reservations, event restrictions, live
instrument validation, quotes, approval, execution and reconciliation remain
unimplemented until their named phases pass. Do not infer those guarantees
from the allocation primitive.
