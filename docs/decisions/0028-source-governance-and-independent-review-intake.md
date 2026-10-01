# ADR 0028: Revalidate recovered source, governance and independent-report provenance

- Status: accepted
- Date: 2026-10-01
- Work items: P5.5d, P7.1
- Extends: [ADR 0026](0026-full-token-security-evidence.md), [ADR 0027](0027-local-source-recovery-governance-evidence.md)

## Context

Public research recovered the missing NVDAB beacon and identified two privileged
wallet proxies. A dated research snapshot cannot authorize a future trade. Scanner
responses contain omitted fields as well as positive warnings, and a configured
report URL/digest alone does not establish publication provenance or report bytes.

## Decision

Use immutable, address-and-full-runtime-specific certificates for the five
recovered governance sources. Certificates bind compiler, compilation-input and
rebuild-report hashes and distinguish executable correspondence from exact
metadata matches. Unrecognized identities still need verified Sourcify sources.
No compiler or caller-provided source pins enter the production collector.

At the quantity evidence block, resolve the two reviewed wallet layouts through
canonical storage/getter reads. Bind implementation/admin/owner/pending-owner,
initialization, operator, pause and hot-wallet membership plus controller runtime
hashes. NVDAB's execution closure grows from five to nine components. Unknown
upgrades, layouts, delegated controllers or unavailable/contradictory reads block
admission. The optional collector block number/hash must be supplied together;
latest-head callers retain their existing API.

Expose explicit coverage for all required Binance categories/fields and GoPlus
fields. Unsupported Binance responses suppress unreliable findings. Missing fields
remain unknown even if other fields show risks; neither a `clear` label nor a
verified report can override incomplete coverage or the existing risk policy.

Keep registry container version 1; introduce review record version 2 with an
operator-maintained publisher ID and exact component/source scope. Accept only
the primary publication namespaces in `review-publishers.ts`, immutable GitHub
commit paths where applicable, and freshly retrieved PDF bytes with the expected
SHA-256 digest. Disable redirects; bound retrieval to ten seconds and four MiB.
Legacy version-1 records remain parseable but cannot clear live admission.

Report integrity/provenance is machine verified. Audit adequacy, current scope,
findings and declared five-area coverage still require a qualified human review
recorded in Git. PDF magic and a trusted namespace do not prove report completeness,
reviewer competence, off-chain custody or that the document covers a caller's
declared current fingerprint. The registry remains empty until those facts and
the risk decision are established. No AI-generated review or accepted-risk entry.

## Consequences

Current source/governance closure is inspectable and bound to existing security
evidence/approval hashes. Changes invalidate existing review/approval evidence.
Providers, interfaces, P7 signing and historical recovery accounting remain
separate modules; current security warnings do not suppress recovery of submitted
transactions. Receipt leases do not attest the time a scanner performed its scan.

The public USDT audit is a useful historical candidate whose bytes verify, but
does not clear current full-scope review. No matching public NVDAB/control-contract
audit was recovered. Building/testing Nexus can continue; live clearance still
requires qualified reviews, complete scanner coverage and an approved risk policy.
See the [dated results](../integrations/2026-10-01-security-collector.md).
