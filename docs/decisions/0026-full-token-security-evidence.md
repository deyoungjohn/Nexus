# ADR 0026: Require security evidence for both route tokens

- Status: accepted for implementation; no risk exception authorized
- Date: 2026-09-30
- Work items: P5.5d, P7.1

## Context

Raw recovery semantics in ADR 0025 establish conditional accounting compatibility,
not full token security. The Market Gate previously accepted an adapter's plain
`audit.state=clear` for the stock without equivalent settlement-token coverage.
The bStocks quantity/transfer readers pinned block numbers but did not bind
canonical block hashes throughout their reads. Current public audit checks
still do not cover NVDAB, and supported USDT data reports minting authority.

## Decision

Introduce `src/security/` as a separate read-only module. Require security
reports for exactly the stock and settlement denominations, at the quantity
evidence's same canonical block. The gate recomputes report state and hashes;
an old `clear` label, omitted settlement report, forged result, changed identity,
expired review or unknown field coverage cannot authorize a leg. Full reports
enter the existing P5 evidence hash and P7 signature revalidation.

Normalize Binance and GoPlus results separately. Both must have complete,
supported, unflagged coverage under the conservative initial policy. Binance
unsupported flags suppress all embedded risk fields, including misleading LOW
labels. Null/omitted GoPlus fields are unknown. Any positive tax, risk/caution
hit, above-low risk level or provider alert blocks; known warnings are not
silently accepted because they are common in centralized assets. A later
explicit risk policy would need its own owner-approved ADR and a distinct
exception state as required by ADR 0010.

The initial production collector supports exact BSC USDT and NVDAB. It checks
EIP-1898 canonical hash reads, decimals, proxy slots, all discovered executable
component runtimes and source matches. NVDAB additionally binds beacon owner,
all enumerated token/manager role sets, switches, mapping and control pointers.
Read beacon `implementation()` with the token proxy as caller. Track privileged
account runtime hashes to detect delegation/code changes. Contract or delegated
authorities remain unresolved until their governance can be separately verified;
no assumption that a contract address is a secure multisig is permitted.

Source verification requires matching deployed runtime plus nonempty source and
compiler records for every component. It does not certify security. A trusted
operator registry must additionally contain a report digest, direct HTTPS report
provenance, exact fingerprint and explicit coverage of transfers/taxes,
balances/supply, upgrades/delegation, privileged authority and external controls.
Reviews expire within 24 hours. The committed registry is empty; neither current
token has a qualified independent contract-scope review. Browser declarations,
wallet signatures, recovery registration and successful simulations cannot
create such a review. A report digest identifies a reviewed artifact; this
module does not fetch/independently authenticate the reviewer or report.

The CLI collects facts without a signer or broadcast capability. Exit 0 means
all scoped token checks passed, 2 means blocking findings were collected, and 1
means invalid configuration/collector failure. Provider observation clocks are
retrieval leases, not claims about the provider's internal scan time. The module
does not establish custody backing, legal access or future issuer behavior.

## Compatibility and consequences

The legacy audit field remains, but is insufficient alone. Adapter ports gain
an optional security method for source compatibility; absent security evidence
now fails the gate with `TOKEN_SECURITY_BLOCKED`. Old stored approvals cannot
pass the stricter pre-leg gate. Recovery continues to reconcile already
submitted transactions using historical receipt semantics without requiring a
current trading risk clearance; trapping previously spent funds behind a new
audit finding would undermine recovery. No migration, new live instrument,
trade, signer or broad risk bypass is introduced.

See [specification 0008](../specifications/0008-token-security.md),
[dated findings](../integrations/2026-09-30-full-token-security.md) and
[operator runbook](../runbooks/token-security.md).
