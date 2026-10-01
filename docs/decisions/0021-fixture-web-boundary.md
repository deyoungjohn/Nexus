# ADR 0021: Isolate the P8 fixture workflow from execution authority

- Status: accepted for the P8 fixture increment; production integration open
- Date: 2026-09-29
- Owners: Codex

## Context

The blueprint calls for a Next.js workflow from setup through approval and
reconciled receipt. The headless P6 rules and P7 recovery are still incomplete,
and P5.5 does not supply production bStocks evidence. A web button presented as
live approval now would imply authority and guarantees the application cannot
provide. P8 can still test whether the decision path is understandable.

## Decision

Build an isolated, labelled local fixture workspace. Keep its draft, synthetic
preview, local acknowledgement and sample outcome in a separate web model.
Permit read-only discovery of already shared EOA account and chain, without a
connection request. Do not expose any live trade, wallet signature, server
mutation, or chain receipt action. Persist only fixture data in browser storage;
invalidate preview and acknowledgement on reload. Display the missing live
evidence and recovery gates at the point of action. Add the web build to the
repository check.

The fixture algorithm illustrates review and caps; it is not an alternate P4
coordinator or P6 compiler. Production P8 must read canonical server-owned
rules, plans, approvals and receipts. A local acknowledgement must never be
accepted by a P7 broadcaster.

## Consequences

The owner can review a complete synthetic product flow without risking a
wallet action. The UI is useful for finding wording and control gaps, but its
sample record proves no market or chain behavior. P8 remains in progress until
the canonical modules, authenticated state and browser validation are wired.
