# Specification 0003 — Portfolio Coordinator

Status: implemented for P4 on 2026-09-26. Source: `Nexus.md` sections 4.1–4.4,
8.2 and 11; implementation plan P4. This is an offline planner and durable
decision writer. It does not establish live market eligibility, quote validity,
owner approval or execution permission.

## Inputs and authority

`coordinatePortfolio` receives an exact-asset snapshot, a conservative
valuation unit, upper/lower position values, cash lower value, raw quantities,
existing holds, a policy and typed buy/sell proposals. The policy has cash and
fee floors, native-gas requirement, and company/sector/issuer caps in integer
basis points. Proposals name immutable instrument IDs, not ticker symbols.
Explicit buy/sell eligibility flags are caller inputs; P5 must establish them
from verified market, token and owner evidence before any automated decision.
The values and synthetic tests do not assume a stablecoin is always worth $1.

`CoordinatorStore` uses PostgreSQL migration `0002_coordinator.sql` for active
policy links, immutable instrument metadata and unique coordination
occurrences. It requires registered exact instrument metadata, an activated
versioned policy and a snapshot whose raw balances and reservations match the
ledger. A policy activation increments the portfolio revision and invalidates
unsubmitted plans. It locks the portfolio while checking the snapshot,
planning, reserving through P3, and writing evidence/decision records in one
transaction. A repeated plan ID with identical content returns the stored
decision; changed content fails. Occurrences are unique even when no trade
leg is planned. A historical replay is not a fresh executable authorization.

## Decision sequence

Mandatory reductions take priority and never net with purchases. Optional
opposing proposals can net only for the **same exact instrument**, when the
sale is eligible and inventory-backed; distinct wrappers remain distinct
trades. Sells use raw inventory and reserve it. An accepted sell makes every
buy a contingent preview: its proceeds and exposure reduction cannot fund or
justify a buy until a new confirmed balance revision is recorded. If a
mandatory reduction is halted or lacks inventory, dependent buys stay blocked.

For a buy phase, P1's allocator splits scarce settlement cash by priority and
proportionally within a priority, including deterministic rounding. The
coordinator then clips each buy against conservative caps in stable priority/ID
order. Upper exposure numerators and lower total-value denominators are used;
cash removed and acquired value are rounded in the conservative direction.
Every intermediate buy is checked, including a cap on an *unrelated* holding
that can become breached when the total lower value falls. A sell cannot
create a new intermediate concentration breach. Unused cash is not silently
redistributed after a leg is blocked or clipped. Native gas is checked
separately from settlement funds.

The output records each proposal's requested, accepted, netted and contingent
amounts with a stable reason. Only accepted legs are reserved; a contingent
amount is never a reservation. A plan created by P4 is `reserved`, not
authorized or submitted. P5 must revalue after actual-size route costs and
recheck instrument quantity mapping; P7 must recheck all hard limits before
each sequential leg.

## Acceptance evidence and limits

The fixture from blueprint section 4.4 starts with $1,000 total, $200 cash,
$280 NVDA and $120 AMD. An event cap of 25% NVDA and 40% semiconductor
sector produces a $30 NVDA sell. The $60 NVDA buy is blocked, and the $50 AMD
buy is shown as **contingent $30**. After a separate confirmed revision with
NVDA $250 and cash $230, P4 reserves only the $30 AMD buy, leaving $200 cash.
A halted NVDA sale cannot justify that purchase. Tests also cover wrapper
aggregation, same-priority proportional cash, issuer caps, lower-denominator
haircuts, intermediate-state limits, exact-instrument netting, reserved raw
inventory, immutable registry classification, policy invalidation, blocked
occurrence replay, and two concurrent attempts on a stale snapshot.

`TEST_DATABASE_URL=… ./scripts/check.sh` runs the PostgreSQL integration cases;
without it, those cases are explicitly skipped. All instrument identities and
holdings in the tests are synthetic. The P4 store verifies consistency with
the **application ledger**, not the chain. P5 must establish source freshness,
eligibility, classification and quantity compatibility; P7 must bind owner
approval and reconcile submitted transactions before any live execution.
