# Full-token security boundary

Work items: P5.5d, P7.1. Decisions: [ADR 0026](../decisions/0026-full-token-security-evidence.md),
[ADR 0028](../decisions/0028-source-governance-and-independent-review-intake.md).

`src/security/token-security.ts` owns pure normalization, exact review parsing,
fingerprints, assessment and bundle verification. `bsc-token-security.ts` owns
public read-only adapters; `token-security-cli.ts` provides operator inspection.
Market Gate integration remains independent of wallets and recovery.

## Evidence and acceptance

`TokenSecurityObservation` records exact chain-56 ERC20 asset ID, raw decimals,
source/expiry, block number/hash, executable component addresses/code hashes,
verified source digests, current control fields and privileged-account runtime
hashes. Runtime-owner and bStocks-beacon profiles require their full known
surfaces. Exact NVDAB cannot be downgraded to a runtime-owner profile. All
NVDAB token, beacon, implementation, compliance and pause-manager components
must be present, plus both privileged wallet proxies and their implementations: nine
components in total. The source-pinned OperatorWallet/BurnWallet adapters bind
inner implementations/admins/owners/pending owners, initialized state, operator,
pause and hot-wallet membership. Controller runtime hashes detect delegated code;
unknown governance implementations/layouts or further delegation remain blocked.

Binance normalization requires successful envelopes, both coverage flags, known
integer risk levels, explicit alert presence, known buy/sell taxes and contract/trade/scam category
coverage with explicit boolean findings. Unsupported responses never report
their risk level/items. GoPlus normalization requires the exact contract result,
known boolean risk fields and taxes. Explicit coverage maps require all seven
Binance and twenty-two GoPlus fields/categories. Missing fields are not zero;
positive warnings remain visible alongside unknown coverage. A proxy flag
alone is an identity/coverage issue; executable source and control review remain
mandatory. The initial policy blocks all detected risks/cautions, positive
taxes, provider alerts and Binance risk levels above 1. A zero-tax route is not
otherwise a safe-token certificate.

`TokenSecurityReview` is operator-owned configuration. The registry container stays
version 1; qualifying records use version 2 with review ID, exact asset, full
fingerprint, publisher ID, exact component/code/source scope, trusted primary
HTTPS report URL, SHA-256 report digest, timestamps and coverage for each of:

- Transfers/taxes: transfer/transferFrom/approval semantics, honeypot/restriction
  behavior, confiscation paths, actual buy and sell restrictions.
- Balances/supply: mint/burn authority, raw balances, fees/rebases and all
  quantity-changing paths, including display changes separate from funds.
- Upgrades/delegation: proxy/beacon/implementation, hidden code/delegate paths,
  upgrade authority and any contract authority's further delegation.
- Privileged authority: current roles, owners, governance and mutable switches;
  an EOA's lack of code does not establish how its private key is managed.
- External controls: compliance/blocklist/sanctions/pause hooks and their
  authority; exact wallet/pool/router permission is rechecked separately.

Coverage values are `clear`, `risk` or `unknown`; only all-clear passes together
with current supported provider evidence and complete sources. There is no risk
exception. Review parsing rejects extras, duplicate assets, bad hashes/URLs,
unknown coverage, invalid clocks and validity longer than 24 hours. The report
digest must match a fresh PDF artifact receipt. The adapter accepts only configured
primary auditor namespaces, pins GitHub paths to commits, rejects redirects and
bounds retrieval to ten seconds/four MiB. It verifies bytes/provenance, not a
signature, endorsement or whether the declared scope is actually covered by the
report. Qualified operators still establish audit adequacy, current scope, coverage
and findings in Git. Version-1 records remain parseable but cannot clear admission.
`config/token-security-reviews.json` intentionally contains no review. A terms
checkbox cannot populate this registry.

`TokenSecurityEvidence` carries observations, separate provider findings,
review, artifact receipt, aggregate state/reasons and SHA-256 evidence hash. Bundle verification
recomputes assessment/hash rather than accepting the state's label. Exactly two
unique reports must match the stock and settlement denomination, including raw
decimals and the same quantity block/hash. Missing, stale, unsupported or risk
findings fail closed. Both reports are included in P5's evidence hash; even an
otherwise valid review revision invalidates existing P7 approval.

## Collection and failures

The initial read-only collector scopes USDT and NVDAB only. It verifies chain 56,
fresh head (or optional paired quantity block number/hash) and EIP-1898
`blockHash`/`requireCanonical` reads. Local recovered-source certificates match
exact addresses/full deployed runtime hashes and bind preserved compiler/input/
rebuild hashes; other identities require verified Sourcify runtime/source. No
production compiler or caller-provided source certificate. Both quantity and
transfer adapters also recheck the number/hash after all reads. Reorg, unavailable
RPC, mismatched JSON-RPC response or changed source returns missing evidence;
an unverified source leaves its component unknown. Binance/GoPlus failures stay
separate, so positive risk findings remain visible when another source fails.
Provider receipt clocks bound retrieval reuse and do not certify fresh scans.

Tokens cannot be added by ticker, browser input or raw recovery registration.
New execution/governance paths need a profile and reviewed full source/control
coverage. Collect the full market bundle at the security block; do not mix
security from one height with quantity/transfer evidence from another. Each
pre-leg check repeats the gate and invalidates changed evidence/authorization.
Production source/session/broadcaster wiring remains a separate P5.5/P7 gate.

Recovery of previously submitted transactions intentionally continues under
ADR 0025's historical accounting rules. A current scanner warning cannot erase
an existing receipt, release submitted reservations or cause resubmission.

## Verification

Named tests cover unsupported flags, coverage omissions, taxes, mint authority,
duplicate/wrong assets, source matches, changed code/owner/roles/source,
governance/delegation, expired/unreviewed claims, forged result/hash, wrong
decimals/blocks and canonical reorgs. P7 signs a valid synthetic bundle, then
rejects a revised security review. PostgreSQL actual-token-identity fixtures
use explicitly synthetic security/code/review evidence, preserving recovery
tests without suggesting production risk clearance.
