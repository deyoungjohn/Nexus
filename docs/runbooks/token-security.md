# Inspect and maintain token security evidence

Scope: P5.5d/P7.1, exact BSC USDT and NVDAB. No wallet, API subscription or
private key is required for the public inspection command.

```bash
npm run security:tokens
```

For JSON output without npm's build banners:

```bash
npm run build
node dist/security/token-security-cli.js > /tmp/nexus-token-security.json
```

Optional operator configuration:

```bash
export NEXUS_SECURITY_RPC="https://rpc-bsc.blockmachine.io"
export NEXUS_TOKEN_SECURITY_REVIEWS="config/token-security-reviews.json"
```

The default source is Sentio. Both named sources and the public BNB Chain RPC
were empirically checked for EIP-1898 support on 2026-09-30. Use a trusted HTTPS
source without credentials/query parameters in this adapter. Inspect the JSON's
exact assets, block/hash, per-component source digests, privileged-account code
hashes, inner wallet governance, provider coverage/findings, artifact receipt and
reasons. The top-level `reviewFingerprints` map supplies current intake hashes;
they are not review approvals. Exit 2 is an intentional blocked-readiness
report; exit 1 means the collector/configuration failed. Do not parse npm banners
as JSON. Transient unavailable evidence needs a fresh complete collection.

The committed review registry is empty. Obtain a qualified contract-scope report
covering all areas in [specification 0008](../specifications/0008-token-security.md),
then review the exact current execution/control/authority fingerprint. Source
closure is nine NVDAB components and one USDT component. Record the actual audit
scope, source correspondence, findings, policy decision and expiry in Git.
No owner signature or risk exception qualifies these tokens; never populate
`clear` merely to make a check green.

The registry container stays version 1. A qualifying record is version 2 and
contains `version`, `reviewId`, `assetId`, `fingerprint`, `publisherId`,
`reportUrl`, `reportDigest`, `components`, `coverage`, `observedAt`, `expiresAt`.
Each component contains `address`, full deployed `codeHash` and `sourceDigest`;
its set must exactly match the observed closure. `coverage` contains exactly the
five `SECURITY_AREAS` keys. Validity cannot exceed 24 hours. Legacy record version
1 remains parseable but is insufficient for live admission.

`review-publishers.ts` currently supports EtherAuthority and PeckShield PDFs in
primary GitHub repositories pinned to forty-character commit hashes. PeckShield
reports use the `audit_reports` directory. Other publishers require a reviewed code
change; a browser-supplied URL cannot add one. Use a direct allowed HTTPS PDF URL
without credentials/query/fragment and its SHA-256 hash. The collector fetches the
actual bytes without redirects, with a ten-second/four-MiB limit; inspect the
fresh `reviewArtifact` receipt. Failed/mismatched/expired artifacts block admission.
No API key or paid account is needed for public publication retrieval.

A verified artifact proves bytes and publication namespace, not document meaning,
current scope, reviewer competence or custody. A qualified operator must establish
that the audit supports the declared component scope, current fingerprint and
coverage. Do not repurpose a historical address-named audit as full current
clearance. Keep confidential/personal information out of Git and MCP memory.
The [current report](../integrations/2026-10-01-security-collector.md) records a
verified historical USDT audit candidate, missing NVDAB audit and scanner gaps.
Both supported-but-incomplete scans and positive warnings remain blocking;
report verification does not override scanner coverage or mint/centralization risk.

After every source/control/governance change, revoke the old review by removing
or replacing it in trusted configuration and repeat review/collection. Expiry
and fingerprint matching block old records automatically. Bind the report
bundle through `EvidenceAdapters.tokenSecurity` at the same quantity/transfer
block. Pass `blockNumber` and `blockHash` together to `collectBscTokenSecurity`
when binding an existing quantity frame; mismatch or stale frames block.
The saved web workspace does not yet supply production market adapters;
do not expose review-registry writes to browser users.

Run PostgreSQL-backed `./scripts/check.sh` after any material change. Current
security failure must block new trading while recovery continues to account for
already submitted transactions. This module does not prove issuer reserves,
geographic eligibility, custody guarantees or future freedom to sell.
