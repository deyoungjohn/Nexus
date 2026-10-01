# ADR 0016: Build owner-approved EOA execution first

- Status: accepted for implementation priority; no live executor enabled
- Date: 2026-09-28
- Owners: project owner (EOA-first direction); Codex (architecture review)

## Context

The [blueprint](../../Nexus.md) already selects owner-approved wallet execution
for the MVP. The Agentic Wallet was used to prove one supervised Phase 2 route,
but its CLI and account session are not required by the domain, ledger,
coordinator, or Market Gate. The decoded direct-V3 route already fixes the
sender and recipient to a wallet address and can be submitted by an EOA after
the owner reviews and signs the exact transaction.

The bStocks eligibility discussion combined two different questions: whether
an EOA user needs a Binance account/product permission, and whether a person
and wallet may access a restricted tokenized security. Binance's reviewed
[bStocks FAQ](https://www.binance.com/en-NG/support/faq/detail/f0c03cd6509a4085b4cce1636f16be38)
describes third-party application geographic controls, a public country
eligibility API, and issuer-managed address restrictions. It does not state
that a Binance account status is a universal prerequisite for an external
wallet's secondary-market DEX trade. That absence is not affirmative approval
for any user, location, wallet, or route.

## Decision

Build P7 and P8 around a wallet-neutral, **EOA-first** path. The owner connects
an EOA, reviews a plan and exact transaction bounds, signs the required token
approval and each sequential transaction, and Nexus tracks nonce/transaction
identity, receipts, replacements, portfolio revisions and recovery. An EOA
signature proves key control and transaction authorization, not legal or
provider eligibility. No background agent receives a broad signing key.
Agentic Wallet becomes an optional future adapter behind the same execution
boundary, not an MVP dependency. The optional custody/account contract remains
deferred under P10.

Separate eligibility by product and route:

1. Determine current provider-supported jurisdiction and product restrictions
   for the user and proposed trade. For bStocks, the country endpoint and a
   reliable way to establish the user's applicable jurisdiction remain open.
2. Recheck token pause, exact EOA, pool and router against current on-chain
   transfer controls. A pass proves only that those on-chain checks currently
   allow transfer.
3. Require a Binance account/product status only for an account-based route or
   when the issuer's applicable terms explicitly make it necessary. Do not
   manufacture such a requirement for every direct EOA route.

Neither a trading page opening, VPN, DEX quote, wallet signature nor successful
`eth_call` settles jurisdiction or all product restrictions. If required
eligibility evidence is unavailable, bStocks live execution remains blocked.
This decision does not weaken the existing Market Gate or authorize a trade.
The [bStocks access-control runbook](../runbooks/bstocks-access-control.md)
defines the server-side evidence and recheck sequence for this route.

P6 rules and the EOA execution/recovery implementation may advance using
synthetic fixtures while P5.5 live evidence remains open. An actual live
bStocks leg still requires all P5.5 evidence and P7 approval/recovery gates.

## Consequences

Nexus can become useful for portfolio setup, planning, evidence review and
owner-approved transaction preparation without an Agentic Wallet account.
With an EOA, unattended execution would need a separately reviewed delegation
or account design; the MVP asks the owner to sign each required transaction.
Changing wallet type does not remove bStocks issuer, jurisdiction, token-risk,
price, event or economic-quantity requirements. Other providers must be
evaluated under their own terms rather than inheriting bStocks rules.
