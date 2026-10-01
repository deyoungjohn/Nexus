# ADR 0018: Compose bStocks access evidence from independent checks

- Status: accepted for P5.5c access-control implementation; production source integration open
- Date: 2026-09-28
- Owners: Codex, under the owner's bStocks access-control request

## Context

The bStocks FAQ places geographic enforcement on third-party applications and
mentions a public country endpoint, but the reviewed public FAQ and developer
documentation do not identify that endpoint or its response schema. An EOA
signature proves wallet control; on-chain compliance checks prove only current
transfer permission. Neither alone establishes a person's jurisdiction or
product eligibility. The existing P5 gate accepted a generic eligibility
record and could not distinguish a complete bStocks access decision.

## Decision

Create a server-side access composer with five independent inputs: an active
authenticated session with a short-lived EOA challenge binding, reviewed
person/residence/current-access-country evidence, a revision-pinned official
bStocks country decision, route-specific product permission, and the exact
wallet/pool/router on-chain transfer preflight. Missing, denied, conflicting,
stale or errored input returns no eligibility. A result carries a hash of source
revisions and exact route identity, but no personal country in P5 evidence.

P5 now requires this access-control record for canonical `bstocks` instruments
and checks side, token, pool, router, source block and route consistency. The
record is included in P5's evidence hash, so P7 approval verification rejects
a changed access decision. Other issuer paths remain compatible.

The country and person/product ports are trusted server integrations, not
client claims. The reviewed policy and transfer-control snapshot are passed
in a separate server context, not the leg request. No production country port
is registered because the issuer's
endpoint path/schema and an acceptable user-jurisdiction verification process
remain unverified. The implementation does not infer Nigeria eligibility or
replace an issuer decision with a VPN, localized webpage or wallet signature.

## Consequences

The control can be tested end to end with synthetic, clearly labelled source
fixtures while production bStocks access remains fail-closed. The future web
server must store challenges atomically, persist the verified EOA binding in
the authenticated session, configure only reviewed evidence providers, and
call the composer before actionable quote preparation and again before each
P7 leg. P7's EOA verifier already rebuilds P5 against fresh evidence; P7
submission/recovery and all other P5.5 gates remain open.
